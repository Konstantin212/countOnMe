import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type SQLiteDatabase } from "expo-sqlite";

import { openAppDatabase, type Database } from "./database";
import { setDatabase as setSyncEngineDb } from "@services/syncEngine";

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

type DatabaseContextValue = {
  db: Database;
  userId: string;
};

const DatabaseContext = createContext<DatabaseContextValue | undefined>(
  undefined,
);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the SQLite database and current userId.
 * Must be used inside DatabaseProvider.
 */
export const useDatabaseContext = (): DatabaseContextValue => {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error(
      "useDatabaseContext must be used within a DatabaseProvider",
    );
  }
  return ctx;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type DatabaseProviderProps = {
  userId: string;
  children: ReactNode;
  /** Override db for testing */
  db?: Database;
};

export const DatabaseProvider = ({
  userId,
  children,
  db: injectedDb,
}: DatabaseProviderProps) => {
  const [db, setDb] = useState<SQLiteDatabase | Database | null>(
    injectedDb ?? null,
  );

  useEffect(() => {
    if (injectedDb) {
      setSyncEngineDb(injectedDb, userId);
      return;
    }

    let cancelled = false;

    const init = async () => {
      const database = await openAppDatabase();
      if (!cancelled) {
        setSyncEngineDb(database, userId);
        setDb(database);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [injectedDb]);

  if (!db) {
    // DB is still initialising — render nothing (parent can show splash)
    return null;
  }

  return (
    <DatabaseContext.Provider value={{ db: db as Database, userId }}>
      {children}
    </DatabaseContext.Provider>
  );
};
