"""Refresh analysis-page results: python3 scripts/record-python-comparison.py."""

from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys


app = Path(__file__).resolve().parents[1]
project = app.parent
cases = []
parser = argparse.ArgumentParser(description="Record DFS and DP console outputs.")
parser.add_argument("--cases-dir", type=Path, default=project / "test_cases")
arguments = parser.parse_args()
inputs = sorted(arguments.cases_dir.glob("*.txt"), key=lambda path: (int(path.read_text().split()[0]), path.name))
if not inputs:
    raise SystemExit("No .txt input files found.")

# Run each solver three times on exactly the same input.
for input_file in inputs:
    filename = input_file.name
    text = input_file.read_text()
    case = {"file": filename, "size": int(text.split()[0])}
    for method, script in (("dfs", "Cherry_DFS.py"), ("dp", "Cherry_DP.py")):
        runs = []
        for _ in range(3):
            result = subprocess.run(
                [sys.executable, str(project / script)], input=text,
                text=True, capture_output=True, check=True,
            )
            lines = result.stdout.splitlines()
            seconds = float(lines[-1].split("=")[1].split()[0])
            runs.append({"answer": int(lines[0]), "seconds": seconds, "output": result.stdout.rstrip()})
        if len({run["answer"] for run in runs}) != 1:
            raise RuntimeError(f"Unstable answers: {filename}, {script}")
        # Keep the real console output from the median-time run.
        case[method] = sorted(runs, key=lambda run: run["seconds"])[1]
    if case["dfs"]["answer"] != case["dp"]["answer"]:
        raise RuntimeError(f"DFS and DP disagree on {filename}")
    cases.append(case)
    destination = app / "public" / "test-cases" / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(text)

# Store a snapshot so the webpage does not need to execute Python.
data = {
    "recordedAt": datetime.now(timezone.utc).isoformat(),
    "python": platform.python_version(),
    "runs": 3,
    "sources": {script: hashlib.sha256((project / script).read_bytes()).hexdigest()
                for script in ("Cherry_DFS.py", "Cherry_DP.py")},
    "cases": cases,
}
destination = app / "app" / "data" / "test-case-results.json"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(data, indent=2) + "\n")
print(f"Recorded {len(cases)} cases; both methods agree on every answer.")
