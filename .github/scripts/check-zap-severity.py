#!/usr/bin/env python3
"""Fail if a ZAP JSON report contains any alert at High risk.

ZAP's riskcode scale is 0=Informational, 1=Low, 2=Medium, 3=High -- there
is no separate "critical" tier, so riskcode 3 is the highest ZAP can
report and is treated as the high/critical gate threshold.
"""
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "report_json.json"

with open(path) as f:
    report = json.load(f)

blocking = []
for site in report.get("site", []):
    for alert in site.get("alerts", []):
        if int(alert.get("riskcode", 0)) >= 3:
            blocking.append(alert.get("name"))

if blocking:
    print("High/critical ZAP findings (riskcode>=3):")
    for item in blocking:
        print(f"  - {item}")
    sys.exit(1)

print("No high/critical ZAP findings.")
