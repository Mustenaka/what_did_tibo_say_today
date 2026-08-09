import { getRuntimeEnv } from "../lib/runtime-env";

export function getD1() {
  const database = getRuntimeEnv().DB;
  if (!database) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable");
  }
  return database;
}
