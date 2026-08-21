import { buildTrainingTrackPrompt, parseTrainingTrackResponse } from "./training-track-generator";

describe("buildTrainingTrackPrompt", () => {
  it("includes the explicit inputs and marks team data as untrusted", () => {
    const { systemPrompt, userPrompt } = buildTrainingTrackPrompt({
      techStack: "Node.js, Express",
      experienceLevel: "intermediate",
      hoursPerWeek: 4,
      weakestPrinciples: [{ title: "Champion Advocacy", score: 1 }],
      pendingChecklistItems: ["Publish a champion newsletter"],
    });

    expect(systemPrompt).toContain("STRICT JSON");
    expect(systemPrompt).toContain("do not use tables, links, images, blockquotes, or code fences");
    expect(userPrompt).toContain("Node.js, Express");
    expect(userPrompt).toContain("intermediate");
    expect(userPrompt).toContain("4 hours/week");
    expect(userPrompt).toContain("Champion Advocacy (score 1/4)");
    expect(userPrompt).toContain("Publish a champion newsletter");
    expect(userPrompt).toContain("UNTRUSTED DATA");

    // techStack is free-text supplied directly by the requesting user, so it must sit
    // after the UNTRUSTED DATA marker, not bare/unmarked earlier in the prompt.
    const untrustedMarkerIndex = userPrompt.indexOf("UNTRUSTED DATA");
    const techStackIndex = userPrompt.indexOf("Node.js, Express");
    expect(untrustedMarkerIndex).toBeGreaterThan(-1);
    expect(techStackIndex).toBeGreaterThan(untrustedMarkerIndex);
  });

  it("handles a team with no assessment or pending checklist items yet", () => {
    const { userPrompt } = buildTrainingTrackPrompt({
      techStack: "Python/Django",
      experienceLevel: "beginner",
      hoursPerWeek: 2,
      weakestPrinciples: [],
      pendingChecklistItems: [],
    });

    expect(userPrompt).toContain("none recorded yet");
  });
});

describe("parseTrainingTrackResponse", () => {
  it("parses a valid modules array and assigns sequential order", () => {
    const raw = JSON.stringify({
      modules: [
        { title: "Intro to OWASP Top 10", content: "## Overview\n..." },
        { title: "Hands-on: SQL injection", content: "## Exercise\n..." },
      ],
    });

    expect(parseTrainingTrackResponse(raw)).toEqual([
      { order: 0, title: "Intro to OWASP Top 10", content: "## Overview\n..." },
      { order: 1, title: "Hands-on: SQL injection", content: "## Exercise\n..." },
    ]);
  });

  it("drops modules missing a title or content instead of failing the whole response", () => {
    const raw = JSON.stringify({
      modules: [
        { title: "Valid module", content: "some content" },
        { title: "", content: "missing title" },
        { title: "Missing content" },
      ],
    });

    expect(parseTrainingTrackResponse(raw)).toEqual([{ order: 0, title: "Valid module", content: "some content" }]);
  });

  it("throws when the response has no modules array", () => {
    expect(() => parseTrainingTrackResponse("not json")).toThrow("AI response did not contain a valid modules array");
  });

  it("throws when every module is invalid", () => {
    const raw = JSON.stringify({ modules: [{ title: "" }] });
    expect(() => parseTrainingTrackResponse(raw)).toThrow("AI response contained no valid modules");
  });

  it("parses a module whose content contains an inner code fence", () => {
    const raw = JSON.stringify({
      modules: [
        {
          title: "Hands-on: SQL injection",
          content: "## Exercise\nRun this query:\n```js\nconst q = \"SELECT * FROM users\";\n```\nNow try it.",
        },
      ],
    });

    expect(parseTrainingTrackResponse(raw)).toEqual([
      {
        order: 0,
        title: "Hands-on: SQL injection",
        content: "## Exercise\nRun this query:\n```js\nconst q = \"SELECT * FROM users\";\n```\nNow try it.",
      },
    ]);
  });
});
