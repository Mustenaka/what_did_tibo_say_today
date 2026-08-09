import { env } from "cloudflare:workers";

type RuntimeEnv = {
  DB?: D1Database;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  ACTIVITY_SOURCES?: string;
  FXTWITTER_BASE_URL?: string;
  X_HANDLE?: string;
  NITTER_INSTANCES?: string;
  REFRESH_TTL_SECONDS?: string;
  REFRESH_SECRET?: string;
};

export function getRuntimeEnv(): RuntimeEnv {
  return env as RuntimeEnv;
}
