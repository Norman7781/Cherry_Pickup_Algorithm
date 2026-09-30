"""
Compare the two Cherry Pickup approaches.

1. Correctness: both solutions against a brute-force search over every pair
   of paths, on random small grids.
2. Performance: running time, peak memory (tracemalloc) and number of states
   for n = 5 ... 50 (the LeetCode limit), on open grids (worst case, no thorns)
   and on random grids.

Writes benchmark_results.json next to this file.

Team members:
    [Name 1] - [Student ID 1]
    [Name 2] - [Student ID 2]
    [Name 3] - [Student ID 3]
"""

import json
import random
import statistics
import sys
import time
import tracemalloc
from itertools import product
from pathlib import Path

from cherry_pickup_bottom_up import Solution as BottomUp
from cherry_pickup_dfs_memo import Solution as TopDown

sys.setrecursionlimit(10000)
HERE = Path(__file__).parent


def all_paths(grid):
    n = len(grid)
    paths = []

    def go(r, c, path):
        if grid[r][c] == -1:
            return
        path = path + [(r, c)]
        if (r, c) == (n - 1, n - 1):
            paths.append(path)
            return
        if r + 1 < n:
            go(r + 1, c, path)
        if c + 1 < n:
            go(r, c + 1, path)

    go(0, 0, [])
    return paths


def brute_force(grid):
    """Try every pair of monotone paths; a cell's cherry counts once."""
    best = 0
    paths = all_paths(grid)
    for p, q in product(paths, repeat=2):
        cells = set(p) | set(q)
        best = max(best, sum(grid[r][c] for r, c in cells))
    return best


def greedy_twice(grid):
    """Take the best single path, remove its cherries, take the best again."""
    n = len(grid)
    g = [row[:] for row in grid]
    total = 0
    for _ in range(2):
        paths = all_paths(g)
        if not paths:
            return 0
        best = max(paths, key=lambda p: sum(g[r][c] for r, c in p))
        total += sum(g[r][c] for r, c in best)
        for r, c in best:
            g[r][c] = 0
    return total


def random_grid(n, rng, thorn=0.15, cherry=0.5):
    grid = []
    for _ in range(n):
        row = []
        for _ in range(n):
            x = rng.random()
            row.append(-1 if x < thorn else 1 if x < thorn + cherry else 0)
        grid.append(row)
    grid[0][0] = max(grid[0][0], 0)
    grid[n - 1][n - 1] = max(grid[n - 1][n - 1], 0)
    return grid


def measure(solver_cls, grid, repeats):
    times = []
    for _ in range(repeats):
        solver = solver_cls()
        t0 = time.perf_counter()
        answer = solver.cherryPickup(grid)
        times.append(time.perf_counter() - t0)
    tracemalloc.start()
    solver = solver_cls()
    solver.cherryPickup(grid)
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return {
        "answer": answer,
        "time_ms": statistics.median(times) * 1000,
        "peak_kb": peak / 1024,
        "states": solver.state_count,
    }


def main():
    rng = random.Random(741)
    results = {"python": sys.version.split()[0]}

    # 1. Correctness against brute force
    checked = mismatches = 0
    for _ in range(3000):
        n = rng.randint(1, 5)
        grid = random_grid(n, rng, thorn=0.2)
        expected = brute_force(grid)
        for cls in (TopDown, BottomUp):
            checked += 1
            if cls().cherryPickup(grid) != expected:
                mismatches += 1
    results["correctness"] = {"checks": checked, "mismatches": mismatches}

    # LeetCode examples
    examples = [
        ([[0, 1, -1], [1, 0, -1], [1, 1, 1]], 5),
        ([[1, 1, -1], [1, -1, 1], [-1, 1, 1]], 0),
    ]
    results["examples"] = [
        {
            "grid": g,
            "expected": e,
            "top_down": TopDown().cherryPickup(g),
            "bottom_up": BottomUp().cherryPickup(g),
        }
        for g, e in examples
    ]

    # Greedy counterexample: two independent best paths are not optimal
    greedy_grid = [
        [1, 1, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 1],
        [1, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1],
    ]
    results["greedy"] = {
        "grid": greedy_grid,
        "greedy": greedy_twice(greedy_grid),
        "optimal": BottomUp().cherryPickup(greedy_grid),
    }

    # 2. Performance
    sizes = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
    perf = {"open": [], "random": []}
    for n in sizes:
        repeats = 5 if n <= 30 else 3
        open_grid = [[1] * n for _ in range(n)]
        rand_grid = random_grid(n, random.Random(n))
        for name, grid in (("open", open_grid), ("random", rand_grid)):
            td = measure(TopDown, grid, repeats)
            bu = measure(BottomUp, grid, repeats)
            assert td["answer"] == bu["answer"], (name, n)
            perf[name].append({"n": n, "top_down": td, "bottom_up": bu})
            print(
                f"{name:6} n={n:2}  answer={td['answer']:4}  "
                f"top-down {td['time_ms']:8.2f} ms {td['peak_kb']:9.1f} KB "
                f"{td['states']:7} calls | bottom-up {bu['time_ms']:8.2f} ms "
                f"{bu['peak_kb']:7.1f} KB {bu['states']:7} cells"
            )
    results["performance"] = perf

    (HERE / "benchmark_results.json").write_text(json.dumps(results, indent=2))
    print("correctness:", results["correctness"])
    print("greedy:", results["greedy"]["greedy"], "optimal:", results["greedy"]["optimal"])


if __name__ == "__main__":
    main()
