"""Measure solver allocations separately so tracing does not affect timing."""

import gc
import json
from pathlib import Path
import runpy
import sys
import tracemalloc


# Load the solver and input before tracing to exclude setup and grid storage.
solver = runpy.run_path(sys.argv[1])["cherryPickup"]
values = list(map(int, Path(sys.argv[2]).read_text().split()))
size = values[0]
grid = [values[1 + row * size:1 + (row + 1) * size] for row in range(size)]
gc.collect()

tracemalloc.start()
answer = solver(grid)
current, peak = tracemalloc.get_traced_memory()
tracemalloc.stop()

print(json.dumps({"answer": answer, "peakKiB": peak / 1024}))
