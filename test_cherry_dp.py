"""Run with: python3 -m unittest -v test_cherry_dp.py

Includes examples, edge cases, CLI checks, and an independent exhaustive
path-pair oracle for small random grids. No third-party packages required.
"""

import copy
from pathlib import Path
import random
import subprocess
import sys
import unittest

from Cherry_DP import Solution, cherryPickup


def brute_force(grid: list[list[int]]) -> int:
    """Enumerate all legal paths and count unique cherries for every pair."""
    n = len(grid)
    paths = []

    def walk(row, col, cherries):
        if row >= n or col >= n or grid[row][col] == -1:
            return
        cherries = cherries | ({(row, col)} if grid[row][col] == 1 else set())
        if row == n - 1 and col == n - 1:
            paths.append(cherries)
            return
        walk(row + 1, col, cherries)
        walk(row, col + 1, cherries)

    walk(0, 0, set())
    return max((len(a | b) for a in paths for b in paths), default=0)


class CherryDPTests(unittest.TestCase):
    def test_named_cases(self):
        cases = [
            ("example 1", [[0, 1, -1], [1, 0, -1], [1, 1, 1]], 5),
            ("example 2, no route", [[1, 1, -1], [1, -1, 1], [-1, 1, 1]], 0),
            ("one cherry", [[1]], 1),
            ("one empty cell", [[0]], 0),
            ("empty input", [], 0),
            ("all empty", [[0, 0], [0, 0]], 0),
            ("two distinct routes", [[1, 1], [1, 1]], 4),
            ("shared route counts once", [[1, -1, -1], [1, -1, -1], [1, 1, 1]], 5),
            ("blocked start", [[-1, 1], [1, 1]], 0),
            ("blocked finish", [[0, 1], [1, -1]], 0),
            ("isolated cherries", [[0, -1, 1], [1, -1, -1], [1, 1, 0]], 3),
        ]
        for name, grid, expected in cases:
            with self.subTest(name=name):
                self.assertEqual(cherryPickup(grid), expected)

    def test_maximum_size_open_grid(self):
        # Two edge paths overlap only at the start and finish: 4n - 4.
        self.assertEqual(cherryPickup([[1] * 50 for _ in range(50)]), 196)

    def test_input_is_not_modified(self):
        grid = [[0, 1, -1], [1, 0, -1], [1, 1, 1]]
        before = copy.deepcopy(grid)
        self.assertEqual(cherryPickup(grid), 5)
        self.assertEqual(grid, before)

    def test_leetcode_entry_point_and_repeated_calls(self):
        solution = Solution()
        self.assertEqual(solution.cherryPickup([[1, 1], [1, 1]]), 4)
        self.assertEqual(solution.cherryPickup([[0]]), 0)
        self.assertEqual(solution.cherryPickup([[1]]), 1)

    def test_random_grids_against_exhaustive_search(self):
        rng = random.Random(741)
        for index in range(300):
            n = rng.randint(1, 5)
            grid = [[rng.choices([-1, 0, 1], weights=[2, 4, 4])[0]
                     for _ in range(n)] for _ in range(n)]
            grid[0][0] = rng.randint(0, 1)
            grid[-1][-1] = rng.randint(0, 1)
            with self.subTest(index=index, grid=grid):
                self.assertEqual(cherryPickup(grid), brute_force(grid))

    def test_invalid_grid(self):
        for grid in ([[0, 1]], [[0, 1], [1]], [[2]]):
            with self.subTest(grid=grid), self.assertRaises(ValueError):
                cherryPickup(grid)

    def run_cli(self, text):
        return subprocess.run(
            [sys.executable, str(Path(__file__).with_name("Cherry_DP.py"))],
            input=text, capture_output=True, text=True, check=False,
        )

    def test_cli_example(self):
        result = self.run_cli("3\n0 1 -1\n1 0 -1\n1 1 1\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines()[0], "5")
        self.assertIn("time taken =", result.stdout)

    def test_cli_invalid_input(self):
        for text in ("", "0", "2\n0 1", "1\n2", "hello"):
            with self.subTest(text=text):
                result = self.run_cli(text)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Input error:", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
