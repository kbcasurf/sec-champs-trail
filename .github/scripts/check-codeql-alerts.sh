#!/usr/bin/env bash
# Fail if the repo has any OPEN CodeQL alert at high/critical severity for
# the given ref. Uses the Code Scanning Alerts API (not the raw SARIF)
# because dismissal state -- e.g. an alert already triaged as a false
# positive -- lives only server-side; the raw SARIF re-reports the same
# finding on every run regardless of dismissal.
set -euo pipefail

REPO="$1"
REF="$2"

alerts=$(gh api "repos/${REPO}/code-scanning/alerts?state=open&ref=${REF}" \
  --jq '[.[] | select(.rule.security_severity_level == "critical" or .rule.security_severity_level == "high")]')

count=$(echo "$alerts" | jq 'length')

if [ "$count" -gt 0 ]; then
  echo "Open high/critical CodeQL findings:"
  echo "$alerts" | jq -r '.[] | "  - " + .rule.id + " (" + .rule.security_severity_level + ") at " + .most_recent_instance.location.path + ":" + (.most_recent_instance.location.start_line|tostring)'
  exit 1
fi

echo "No open high/critical CodeQL findings."
