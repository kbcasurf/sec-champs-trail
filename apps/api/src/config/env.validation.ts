export function validateEnv(env: NodeJS.ProcessEnv): void {
  const missing: string[] = [];

  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");
  if (!env.WEB_ORIGIN) missing.push("WEB_ORIGIN");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  if (env.JWT_SECRET!.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }

  if (env.AI_PROVIDER_API_URL && !env.AI_PROVIDER_API_URL.startsWith("https://")) {
    throw new Error("AI_PROVIDER_API_URL must start with https://");
  }
}
