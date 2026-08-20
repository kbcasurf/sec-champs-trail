import { extractJson } from "./extract-json";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in a ```json fence", () => {
    const raw = 'Here you go:\n```json\n{"a": 1}\n```\nHope that helps!';
    expect(extractJson(raw)).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in a plain ``` fence", () => {
    const raw = '```\n{"a": 1}\n```';
    expect(extractJson(raw)).toEqual({ a: 1 });
  });

  it("parses a JSON object surrounded by prose without fences", () => {
    const raw = 'Sure, here is the result: {"a": 1} — let me know if you need changes.';
    expect(extractJson(raw)).toEqual({ a: 1 });
  });

  it("returns null for unparseable content", () => {
    expect(extractJson("not json at all")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractJson("")).toBeNull();
  });

  it("parses a bare JSON object whose string value contains an inner code fence", () => {
    const raw = JSON.stringify({
      content: "Try this:\n```js\nconsole.log('hi');\n```\nThat's it.",
    });
    expect(extractJson(raw)).toEqual({
      content: "Try this:\n```js\nconsole.log('hi');\n```\nThat's it.",
    });
  });

  it("parses a ```json-fenced JSON object whose string value also contains an inner code fence", () => {
    const payload = {
      content: "Try this:\n```js\nconsole.log('hi');\n```\nThat's it.",
    };
    const raw = "```json\n" + JSON.stringify(payload) + "\n```";
    expect(extractJson(raw)).toEqual(payload);
  });
});
