import DatabaseConstructor, { type Database } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrations/index.js";

let db: Database | null = null;

export function getDb(): Database {
  if (db) {
    return db;
  }

  const dbPath = resolveDbPath();

  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  db = new DatabaseConstructor(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  runMigrations(db);

  return db;
}

export function closeDb(): void {
  if (!db) {
    return;
  }

  db.close();
  db = null;
}

function resolveDbPath(): string {
  if (process.env.DB_PATH?.trim()) {
    return path.resolve(process.env.DB_PATH.trim());
  }

  if (process.env.NODE_ENV === "test") {
    return ":memory:";
  }

  return path.join(getServerRoot(), "data", "game.db");
}

function getServerRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "..", "..");
}
