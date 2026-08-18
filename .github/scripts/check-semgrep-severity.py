#!/usr/bin/env python3
"""Fail if a Semgrep SARIF file contains any result at 'error' level.

Semgrep's own severity scale is INFO/WARNING/ERROR (mapped to SARIF's
note/warning/error) -- there is no separate "critical" tier, so 'error'
is the highest severity Semgrep can report and is treated as the
high/critical gate threshold.
"""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "semgrep-results.sarif"

with open(path) as f:
    sarif = json.load(f)

run = sarif["runs"][0]
rules_by_id = {rule["id"]: rule for rule in run["tool"]["driver"]["rules"]}

blocking = []
for result in run.get("results", []):
    level = result.get("level")
    if not level:
        rule = rules_by_id.get(result.get("ruleId"), {})
        level = rule.get("defaultConfiguration", {}).get("level", "warning")
    if level == "error":
        location = result["locations"][0]["physicalLocation"]
        uri = location["artifactLocation"]["uri"]
        line = location["region"]["startLine"]
        blocking.append(f"{result.get('ruleId')} at {uri}:{line}")

if blocking:
    print("High/critical Semgrep findings (level=error):")
    for item in blocking:
        print(f"  - {item}")
    sys.exit(1)

print("No high/critical Semgrep findings.")
