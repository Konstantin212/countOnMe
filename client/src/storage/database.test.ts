import { describe, expect, it, vi, beforeEach } from "vitest";

import { initDatabase, clearAllUserData, type Database } from "./database";

/**
 * Create a mock Database for testing.
 * Since expo-sqlite cannot run in jsdom, we mock the interface.
 */
const createMockDb = (): Database & {
  _execCalls: string[];
  _runCalls: Array<{ sql: string; args: unknown[] }>;
} => {
  const execCalls: string[] = [];
  const runCalls: Array<{ sql: string; args: unknown[] }> = [];
  let userVersion = 0;

  return {
    _execCalls: execCalls,
    _runCalls: runCalls,
    execAsync: vi.fn(async (sql: string) => {
      execCalls.push(sql);
      const versionMatch = sql.match(/PRAGMA user_version\s*=\s*(\d+)/);
      if (versionMatch) {
        userVersion = parseInt(versionMatch[1], 10);
      }
    }),
    runAsync: vi.fn(async (sql: string, ...args: unknown[]) => {
      runCalls.push({ sql, args: args.flat() });
      return { lastInsertRowId: 0, changes: 0 };
    }),
    getFirstAsync: vi.fn(async () => ({ user_version: userVersion })),
    getAllAsync: vi.fn(async () => []),
    withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  };
};

describe("database", () => {
  describe("initDatabase", () => {
    it("creates schema when user_version is 0", async () => {
      const db = createMockDb();

      await initDatabase(db);

      expect(db.getFirstAsync).toHaveBeenCalledWith("PRAGMA user_version");
      // V1 schema + V1 pragma + V2 schema + V2 pragma + V3 schema + V3 pragma = 6 exec calls
      expect(db._execCalls.length).toBe(6);
      expect(db._execCalls[0]).toContain("CREATE TABLE IF NOT EXISTS products");
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS user_goals",
      );
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS body_weights",
      );
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS water_logs",
      );
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS favourites",
      );
      expect(db._execCalls[0]).toContain("CREATE TABLE IF NOT EXISTS recents");
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS sync_outbox",
      );
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS sync_cursors",
      );
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS product_portions",
      );
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS food_entries",
      );
      expect(db._execCalls[1]).toBe("PRAGMA user_version = 1");
      expect(db._execCalls[2]).toContain(
        "CREATE TABLE IF NOT EXISTS fasting_sessions",
      );
      expect(db._execCalls[3]).toBe("PRAGMA user_version = 2");
      expect(db._execCalls[4]).toContain("ALTER TABLE fasting_sessions");
      expect(db._execCalls[5]).toBe("PRAGMA user_version = 3");
    });

    it("runs only V2 migration when user_version is 1", async () => {
      const db = createMockDb();
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        user_version: 1,
      });

      await initDatabase(db);

      // V2 schema + V2 pragma + V3 schema + V3 pragma = 4 exec calls
      expect(db._execCalls.length).toBe(4);
      expect(db._execCalls[0]).toContain(
        "CREATE TABLE IF NOT EXISTS fasting_sessions",
      );
      expect(db._execCalls[1]).toBe("PRAGMA user_version = 2");
      expect(db._execCalls[2]).toContain("ALTER TABLE fasting_sessions");
      expect(db._execCalls[3]).toBe("PRAGMA user_version = 3");
    });

    it("skips all migrations when user_version is >= 3", async () => {
      const db = createMockDb();
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        user_version: 3,
      });

      await initDatabase(db);

      expect(db._execCalls.length).toBe(0);
    });

    it("runs only V3 migration when user_version is 2", async () => {
      const db = createMockDb();
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        user_version: 2,
      });

      await initDatabase(db);

      // Only V3 schema + V3 pragma = 2 exec calls
      expect(db._execCalls.length).toBe(2);
      expect(db._execCalls[0]).toContain("ALTER TABLE fasting_sessions");
      expect(db._execCalls[1]).toBe("PRAGMA user_version = 3");
    });

    it("is idempotent — calling twice does not error", async () => {
      const db = createMockDb();

      await initDatabase(db);
      // After first init, userVersion is now 3 internally
      await initDatabase(db);

      // First call: 6 exec calls (V1+V2+V3 schemas + pragmas), second: 0
      expect(db._execCalls.length).toBe(6);
    });
  });

  describe("clearAllUserData", () => {
    let db: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      db = createMockDb();
    });

    it("deletes data from all domain tables for the given user", async () => {
      await clearAllUserData(db, "user-123");

      expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);

      const deletedTables = db._runCalls.map((c) => c.sql);
      expect(deletedTables).toContain(
        "DELETE FROM fasting_sessions WHERE user_id = ?",
      );
      expect(deletedTables).toContain(
        "DELETE FROM water_logs WHERE user_id = ?",
      );
      expect(deletedTables).toContain(
        "DELETE FROM body_weights WHERE user_id = ?",
      );
      expect(deletedTables).toContain(
        "DELETE FROM user_goals WHERE user_id = ?",
      );
      expect(deletedTables).toContain(
        "DELETE FROM food_entries WHERE user_id = ?",
      );
      expect(deletedTables).toContain(
        "DELETE FROM product_portions WHERE user_id = ?",
      );
      expect(deletedTables).toContain("DELETE FROM products WHERE user_id = ?");
      expect(deletedTables).toContain(
        "DELETE FROM favourites WHERE user_id = ?",
      );
      expect(deletedTables).toContain("DELETE FROM recents");
      expect(deletedTables).toContain("DELETE FROM sync_outbox");
      expect(deletedTables).toContain("DELETE FROM sync_cursors");

      // Verify userId is passed as parameter (8 user-scoped tables)
      const userScopedCalls = db._runCalls.filter(
        (c) => c.args[0] === "user-123",
      );
      expect(userScopedCalls.length).toBe(8);
    });
  });
});
