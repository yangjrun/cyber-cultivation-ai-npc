import { getRulesForNpc, type EvolutionRule, type PersonalityCounterKey, type PersonalityCounters } from "../data/evolutionRules.js";
import { getDb } from "../db/connection.js";
import type { NpcIntent, NpcStateDelta } from "../types/npc.js";
import type { QuestStatusChange } from "./questEngine.js";

export type PersonalityEventType =
  | "threat"
  | "quest_completed"
  | "quest_failed"
  | "gift"
  | "report"
  | "refused_trade"
  | "successful_trade"
  | "query";

export type PersonalityRecord = {
  sessionId: string;
  npcId: string;
  evolvedTraits: string[];
  counters: PersonalityCounters;
  updatedAt: string;
};

type PersonalityRow = {
  session_id: string;
  base_npc_id: string;
  evolved_traits_json: string;
  counters_json: string;
  updated_at: string;
};

const EVENT_TO_COUNTER: Record<PersonalityEventType, PersonalityCounterKey> = {
  threat: "threats",
  quest_completed: "completed_quests",
  quest_failed: "failed_quests",
  gift: "gifts",
  report: "reports",
  refused_trade: "refused_trades",
  successful_trade: "successful_trades",
  query: "queries"
};

export function getPersonality(sessionId: string, npcId: string): PersonalityRecord {
  const row = getDb()
    .prepare(
      `SELECT session_id, base_npc_id, evolved_traits_json, counters_json, updated_at
       FROM npc_personality
       WHERE session_id = ? AND base_npc_id = ?`
    )
    .get(sessionId, npcId) as PersonalityRow | undefined;

  if (!row) {
    return {
      sessionId,
      npcId,
      evolvedTraits: [],
      counters: {},
      updatedAt: ""
    };
  }

  return mapRow(row);
}

export function recordEvents(sessionId: string, npcId: string, events: PersonalityEventType[]): PersonalityRecord {
  if (events.length === 0) {
    const current = getPersonality(sessionId, npcId);
    return current;
  }

  const current = getPersonality(sessionId, npcId);
  const counters: PersonalityCounters = { ...current.counters };

  for (const event of events) {
    const key = EVENT_TO_COUNTER[event];
    counters[key] = (counters[key] ?? 0) + 1;
  }

  return persist(sessionId, npcId, current.evolvedTraits, counters);
}

export function evaluateRules(sessionId: string, npcId: string): PersonalityRecord {
  const current = getPersonality(sessionId, npcId);
  const rules = getRulesForNpc(npcId);
  const traits = new Set(current.evolvedTraits);
  let changed = false;

  for (const rule of rules) {
    if (rule.once && traits.has(rule.addsTrait)) {
      continue;
    }

    if (!matchesRule(rule, current.counters)) {
      continue;
    }

    if (!traits.has(rule.addsTrait)) {
      traits.add(rule.addsTrait);
      changed = true;
    }
  }

  if (!changed) {
    return current;
  }

  return persist(sessionId, npcId, Array.from(traits), current.counters);
}

export function resetPersonality(sessionId: string, npcId: string): void {
  getDb()
    .prepare("DELETE FROM npc_personality WHERE session_id = ? AND base_npc_id = ?")
    .run(sessionId, npcId);
}

export function clearPersonalityForTests(): void {
  getDb().prepare("DELETE FROM npc_personality").run();
}

export function deriveEvents(intent: NpcIntent, stateDelta: NpcStateDelta, questChanges: QuestStatusChange[]): PersonalityEventType[] {
  const events: PersonalityEventType[] = [];

  if (intent.type === "refuse_service") {
    events.push("refused_trade");
  }

  if (intent.type === "report_player") {
    events.push("report");
  }

  if (intent.type === "complete_trade") {
    events.push("successful_trade");
  }

  if (intent.type === "offer_trade" || intent.type === "give_quest") {
    events.push("query");
  }

  if (stateDelta.anger >= 5) {
    events.push("threat");
  }

  if (stateDelta.trust >= 5) {
    events.push("gift");
  }

  for (const change of questChanges) {
    if (change.to === "completed") {
      events.push("quest_completed");
    } else if (change.to === "failed") {
      events.push("quest_failed");
    }
  }

  return events;
}

function matchesRule(rule: EvolutionRule, counters: PersonalityCounters): boolean {
  for (const [key, threshold] of Object.entries(rule.requires) as Array<[PersonalityCounterKey, number]>) {
    const value = counters[key] ?? 0;

    if (value < threshold) {
      return false;
    }
  }

  return true;
}

function persist(sessionId: string, npcId: string, evolvedTraits: string[], counters: PersonalityCounters): PersonalityRecord {
  const updatedAt = new Date().toISOString();

  getDb()
    .prepare(
      `INSERT INTO npc_personality (session_id, base_npc_id, evolved_traits_json, counters_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_id, base_npc_id) DO UPDATE SET
        evolved_traits_json = excluded.evolved_traits_json,
        counters_json = excluded.counters_json,
        updated_at = excluded.updated_at`
    )
    .run(sessionId, npcId, JSON.stringify(evolvedTraits), JSON.stringify(counters), updatedAt);

  return { sessionId, npcId, evolvedTraits, counters, updatedAt };
}

function mapRow(row: PersonalityRow): PersonalityRecord {
  return {
    sessionId: row.session_id,
    npcId: row.base_npc_id,
    evolvedTraits: parseTraits(row.evolved_traits_json),
    counters: parseCounters(row.counters_json),
    updatedAt: row.updated_at
  };
}

function parseTraits(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseCounters(json: string): PersonalityCounters {
  try {
    const parsed = JSON.parse(json) as unknown;

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const result: PersonalityCounters = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        result[key as PersonalityCounterKey] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
}
