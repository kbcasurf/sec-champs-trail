import { extractJson } from "./extract-json";

describe("extractJson", () => {
  it("parses a bare JSON object with a properly-escaped newline", () => {
    const raw = '{"report": "line one\\nline two"}';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "line one\nline two" });
  });

  it("repairs a literal unescaped newline inside a JSON string value (the confirmed Finding #4 defect)", () => {
    // The template literal below embeds an ACTUAL newline byte (0x0A) inside
    // the string value, not the two-character escape sequence -- this is
    // exactly what plain JSON.parse rejects with an "invalid/bad control
    // character" error, and what the real Anthropic response in Finding #4
    // was shown (via curl, outside the app) to contain.
    const raw = '{"report": "First paragraph.\n- Bullet one\n- Bullet two"}';
    expect(extractJson<{ report: string }>(raw)).toEqual({
      report: "First paragraph.\n- Bullet one\n- Bullet two",
    });
  });

  it("repairs a literal unescaped tab and carriage return inside a string value", () => {
    const raw = '{"content": "before\tafter\rend"}';
    expect(extractJson<{ content: string }>(raw)).toEqual({ content: "before\tafter\rend" });
  });

  it("does not corrupt whitespace used as JSON structural formatting outside of strings", () => {
    const raw = '{\n  "report": "one line, no control chars"\n}';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "one line, no control chars" });
  });

  it("does not get confused by an escaped quote inside a string value that also has a raw newline", () => {
    const raw = '{"report": "She said \\"hello\\".\nNext line."}';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: 'She said "hello".\nNext line.' });
  });

  it("still returns null for structurally malformed JSON (missing closing brace)", () => {
    const raw = '{"report": "unterminated';
    expect(extractJson(raw)).toBeNull();
  });

  it("repairs a raw control character even when the JSON is wrapped in a fenced code block", () => {
    const raw = '```json\n{"report": "line one\nline two"}\n```';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "line one\nline two" });
  });

  it("parses JSON wrapped in a plain fence with no language tag", () => {
    const raw = '```\n{"report": "already escaped\\nvalue"}\n```';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "already escaped\nvalue" });
  });

  it("parses JSON surrounded by prose with no fence at all, via brace-slicing", () => {
    const raw = 'Here is the result: {"a": 1} — done.';
    expect(extractJson<{ a: number }>(raw)).toEqual({ a: 1 });
  });

  it("returns null for a raw string that isn't JSON at all", () => {
    expect(extractJson("not json")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractJson("")).toBeNull();
  });

  it("parses a JSON string value that itself contains an inner code-fence-looking substring", () => {
    const raw = '{"report": "See ```js\\nconst x=1;\\n``` above"}';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "See ```js\nconst x=1;\n``` above" });
  });

  it("parses the same inner-fence case when the JSON is also wrapped in an outer ```json fence", () => {
    const raw = '```json\n{"report": "See ```js\\nconst x=1;\\n``` above"}\n```';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "See ```js\nconst x=1;\n``` above" });
  });
});
