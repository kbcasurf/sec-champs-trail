import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    JWT_SECRET: "a-secret-that-is-at-least-32-characters-long",
    WEB_ORIGIN: "http://localhost:5173",
  };

  it("does not throw when all required vars are present and valid", () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it("throws when DATABASE_URL is missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { DATABASE_URL, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when JWT_SECRET is missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { JWT_SECRET, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_SECRET is shorter than 32 characters", () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: "a".repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it("does not throw when JWT_SECRET is exactly 32 characters", () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: "a".repeat(32) })).not.toThrow();
  });

  it("throws when WEB_ORIGIN is missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { WEB_ORIGIN, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow(/WEB_ORIGIN/);
  });

  it("throws when AI_PROVIDER_API_URL does not start with https://", () => {
    expect(() => validateEnv({ ...validEnv, AI_PROVIDER_API_URL: "http://insecure.example.com" })).toThrow(
      /AI_PROVIDER_API_URL/,
    );
  });

  it("does not throw when AI_PROVIDER_API_URL starts with https://", () => {
    expect(() => validateEnv({ ...validEnv, AI_PROVIDER_API_URL: "https://api.example.com" })).not.toThrow();
  });

  it("does not throw when AI_PROVIDER_API_URL is absent (AI features stay disabled)", () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });
});
