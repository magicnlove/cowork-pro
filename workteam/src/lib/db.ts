import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return databaseUrl;
}

export const db =
  global.__pgPool ??
  new Pool({
    connectionString: getDatabaseUrl()
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = db;
}
