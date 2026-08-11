export function validateEnv(env: NodeJS.ProcessEnv): void {
  const missing: string[] = [];

  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  if (env.JWT_SECRET!.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters long");
  }
}
