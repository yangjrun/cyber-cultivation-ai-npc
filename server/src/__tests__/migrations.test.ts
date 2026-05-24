import DatabaseConstructor from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrations/index.js";

describe("migrations", () => {
  it("runs all migrations on a fresh in-memory DB and creates the phase 3+4 tables", () => {
    const db = new DatabaseConstructor(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
      .map((row) => row.name);

    expect(tables).toEqual(expect.arrayContaining([
      "sessions",
      "players",
      "npc_states",
      "memories",
      "player_items",
      "alchemy_attempts",
      "quest_progress",
      "npc_relations",
      "active_scene",
      "npc_personality",
      "background_scene_events",
      "world_state",
      "unlocked_milestones",
      "run_chronicles",
      "equipped_artifacts",
      "schema_migrations"
    ]));

    db.close();
  });

  it("is idempotent on a DB where migrations have already run", () => {
    const db = new DatabaseConstructor(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    runMigrations(db);

    const versions = (db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: string }>)
      .map((row) => row.version);

    expect(versions).toEqual([
      "001_init",
      "002_cultivation",
      "003_world",
      "004_personality",
      "005_background_events",
      "006_storyline",
      "007_artifacts"
    ]);

    db.close();
  });

  it("phase 3+4 tables enforce FK cascade on session delete", () => {
    const db = new DatabaseConstructor(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db);

    const sessionId = "test-session";
    const now = new Date().toISOString();
    db.prepare("INSERT INTO sessions (id, created_at, updated_at) VALUES (?, ?, ?)").run(sessionId, now, now);
    db.prepare("INSERT INTO quest_progress (session_id, quest_id, status, progress_json, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(sessionId, "steal_inspector_key", "accepted", "{}", now);
    db.prepare("INSERT INTO active_scene (session_id, scene_id, updated_at) VALUES (?, ?, ?)")
      .run(sessionId, "black_market", now);
    db.prepare("INSERT INTO npc_personality (session_id, base_npc_id, evolved_traits_json, counters_json, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(sessionId, "baili", "[]", "{}", now);
    db.prepare("INSERT INTO background_scene_events (session_id, scene_id, player_absent_since, daily_count_date, daily_count) VALUES (?, ?, ?, ?, ?)")
      .run(sessionId, "thunder_tavern", now, now.slice(0, 10), 1);
    db.prepare("INSERT INTO world_state (session_id, flag_key, value, updated_at) VALUES (?, ?, ?, ?)")
      .run(sessionId, "completed_trades", 3, now);
    db.prepare("INSERT INTO unlocked_milestones (session_id, milestone_id, unlocked_at) VALUES (?, ?, ?)")
      .run(sessionId, "market_regular", now);
    db.prepare("INSERT INTO run_chronicles (session_id, content, milestones_snapshot, created_at) VALUES (?, ?, ?, ?)")
      .run(sessionId, "...", "[]", now);
    db.prepare("INSERT INTO equipped_artifacts (session_id, item_id, equipped_at) VALUES (?, ?, ?)")
      .run(sessionId, "fentian_ling", now);

    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);

    const quests = db.prepare("SELECT * FROM quest_progress WHERE session_id = ?").all(sessionId);
    const scenes = db.prepare("SELECT * FROM active_scene WHERE session_id = ?").all(sessionId);
    const personality = db.prepare("SELECT * FROM npc_personality WHERE session_id = ?").all(sessionId);
    const backgroundEvents = db.prepare("SELECT * FROM background_scene_events WHERE session_id = ?").all(sessionId);
    const worldState = db.prepare("SELECT * FROM world_state WHERE session_id = ?").all(sessionId);
    const milestones = db.prepare("SELECT * FROM unlocked_milestones WHERE session_id = ?").all(sessionId);
    const chronicles = db.prepare("SELECT * FROM run_chronicles WHERE session_id = ?").all(sessionId);
    const equippedArtifacts = db.prepare("SELECT * FROM equipped_artifacts WHERE session_id = ?").all(sessionId);

    expect(quests).toEqual([]);
    expect(scenes).toEqual([]);
    expect(personality).toEqual([]);
    expect(backgroundEvents).toEqual([]);
    expect(worldState).toEqual([]);
    expect(milestones).toEqual([]);
    expect(chronicles).toEqual([]);
    expect(equippedArtifacts).toEqual([]);

    db.close();
  });
});
