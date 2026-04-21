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

let pool: Pool | undefined;

function getPool(): Pool {
  if (global.__pgPool) {
    return global.__pgPool;
  }
  if (pool) {
    return pool;
  }
  const next = new Pool({
    connectionString: getDatabaseUrl()
  });
  pool = next;
  if (process.env.NODE_ENV !== "production") {
    global.__pgPool = next;
  }
  return next;
}

/**
 * Next.js 빌드 시에는 모듈만 로드되고 Pool을 만들지 않습니다.
 * 첫 `db.query` 등 호출 시에만 연결하며, 그때 DATABASE_URL이 없으면 에러가 납니다.
 */
export const db = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const p = getPool();
    const value = Reflect.get(p, prop, receiver);
    if (typeof value === "function") {
      return value.bind(p);
    }
    return value;
  }
}) as Pool;
