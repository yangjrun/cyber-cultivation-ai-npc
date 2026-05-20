import DatabaseConstructor from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrations/index.js";

describe("migrations", () => {
  it("runs all migrations on a fresh in-memory DB and creates the phase 3 tables", () => {
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
      "schema_migrations"
    ]));

    db.close();
  });

  it("is idempotent on a DB where migrations have already run", () => {
    const db = new DatabaseConstructor(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    runMigrations(db); // second call should be a no-op, not throw

    const versions = (db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: string }>)
      .map((row) => row.version);

    expect(versions).toEqual(["001_init", "002_cultivation", "003_world"]);

    db.close();
  });

  it("003_world tables enforce FK cascade on session delete", () => {
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

    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);

    const quests = db.prepare("SELECT * FROM quest_progress WHERE session_id = ?").all(sessionId);
    const scenes = db.prepare("SELECT * FROM active_scene WHERE session_id = ?").all(sessionId);

    expect(quests).toEqual([]);
    expect(scenes).toEqual([]);

    db.close();
  });
});
