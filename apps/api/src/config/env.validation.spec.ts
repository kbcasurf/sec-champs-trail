import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    JWT_SECRET: "a-secret-that-is-long-enough",
  };

  it("does not throw when all required vars are present and valid", () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when JWT_SECRET is missing", () => {
    const { JWT_SECRET, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_SECRET is shorter than 16 characters", () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });
});
