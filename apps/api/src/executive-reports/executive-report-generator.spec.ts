import { buildExecutiveReportPrompt, parseExecutiveReportResponse } from "./executive-report-generator";

describe("buildExecutiveReportPrompt", () => {
  it("includes the organization name and every team's summary", () => {
    const { systemPrompt, userPrompt } = buildExecutiveReportPrompt({
      organizationName: "Acme Corp",
      teams: [
        {
          teamName: "Payments",
          latestScores: [{ principleTitle: "Champion Advocacy", score: 2 }],
          historicalAverageScores: [1, 1.5, 2],
          checklistCompletionPercent: 40,
        },
      ],
    });

    expect(systemPrompt).toContain("STRICT JSON");
    expect(systemPrompt).not.toContain("industry benchmark");
    expect(userPrompt).toContain("Acme Corp");
    expect(userPrompt).toContain("Payments");
    expect(userPrompt).toContain("Champion Advocacy: 2/4");
    expect(userPrompt).toContain("40%");
    expect(userPrompt).toContain("UNTRUSTED DATA");

    // organizationName and teamName are DB-stored, admin-authored strings but still
    // less controlled than the maturity-score data -- they must sit after the marker.
    const untrustedMarkerIndex = userPrompt.indexOf("UNTRUSTED DATA");
    const orgNameIndex = userPrompt.indexOf("Acme Corp");
    const teamNameIndex = userPrompt.indexOf("Payments");
    expect(untrustedMarkerIndex).toBeGreaterThan(-1);
    expect(orgNameIndex).toBeGreaterThan(untrustedMarkerIndex);
    expect(teamNameIndex).toBeGreaterThan(untrustedMarkerIndex);
  });

  it("handles an organization with no teams yet", () => {
    const { userPrompt } = buildExecutiveReportPrompt({ organizationName: "Acme Corp", teams: [] });
    expect(userPrompt).toContain("no teams have been created yet");
  });
});

describe("parseExecutiveReportResponse", () => {
  it("returns the report string from a valid response", () => {
    const raw = JSON.stringify({ report: "# Executive summary\n..." });
    expect(parseExecutiveReportResponse(raw)).toBe("# Executive summary\n...");
  });

  it("throws when the response has no report field", () => {
    expect(() => parseExecutiveReportResponse("not json")).toThrow("AI response did not contain a valid report");
  });

  it("throws when the report field is an empty string", () => {
    const raw = JSON.stringify({ report: "   " });
    expect(() => parseExecutiveReportResponse(raw)).toThrow("AI response did not contain a valid report");
  });

  it("parses a report field that contains an inner code fence", () => {
    const raw = JSON.stringify({
      report: "# Executive summary\n```js\nconst risk = 'high';\n```\nAll teams reviewed.",
    });
    expect(parseExecutiveReportResponse(raw)).toBe("# Executive summary\n```js\nconst risk = 'high';\n```\nAll teams reviewed.");
  });
});
