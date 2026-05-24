import type { Database } from "better-sqlite3";
import { runInitialMigration } from "./001_init.js";
import { runCultivationMigration } from "./002_cultivation.js";
import { runWorldMigration } from "./003_world.js";
import { runPersonalityMigration } from "./004_personality.js";
import { runBackgroundEventsMigration } from "./005_background_events.js";
import { runStorylineMigration } from "./006_storyline.js";
import { runArtifactsMigration } from "./007_artifacts.js";

type Migration = {
  version: string;
  run: (db: Database) => void;
};

const migrations: Migration[] = [
  { version: "001_init", run: runInitialMigration },
  { version: "002_cultivation", run: runCultivationMigration },
  { version: "003_world", run: runWorldMigration },
  { version: "004_personality", run: runPersonalityMigration },
  { version: "005_background_events", run: runBackgroundEventsMigration },
  { version: "006_storyline", run: runStorylineMigration },
  { version: "007_artifacts", run: runArtifactsMigration }
];

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: string }>).map((row) => row.version)
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    db.transaction(() => {
      migration.run(db);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
    })();
  }
}
