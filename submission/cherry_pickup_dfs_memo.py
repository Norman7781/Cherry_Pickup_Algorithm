"""
Cherry Pickup (LeetCode 741) - Approach 1: top-down DFS with memoization

Team members:
    [Name 1] - [Student ID 1]
    [Name 2] - [Student ID 2]
    [Name 3] - [Student ID 3]

Idea: the round trip is modelled as two walkers A and B moving from (0, 0)
to (n-1, n-1) at the same time. After `step` moves a walker at row r stands
in column step - r, so the state is (step, row1, row2).

dfs(state) returns the BEST FUTURE: the most cherries that can still be
collected after this state. That value does not depend on how the walkers got
there, which is what makes it safe to memoize by (step, row1, row2).

Time  O(n^3): at most (2n-1) * n * n states, 4 moves each.
Space O(n^3) for the memo table, O(n) recursion depth.
"""

import sys
import time
from typing import List

MOVES = [(1, 1), (1, 0), (0, 1), (0, 0)]  # (d_row1, d_row2): 1 = down, 0 = right


class Solution:
    def cherryPickup(self, grid: List[List[int]]) -> int:
        n = len(grid)
        last_step = 2 * (n - 1)
        memo = {}
        self.state_count = 0

        def valid(row1, row2, step):
            col1 = step - row1
            col2 = step - row2
            if row1 >= n or col1 >= n or row2 >= n or col2 >= n:
                return False
            return grid[row1][col1] != -1 and grid[row2][col2] != -1

        def dfs(step, row1, row2):
            self.state_count += 1
            if step == last_step:
                return 0  # both walkers are on (n-1, n-1): nothing left

            key = (step, row1, row2)
            if key in memo:
                return memo[key]

            best = float("-inf")
            next_step = step + 1
            for dr1, dr2 in MOVES:
                nr1, nr2 = row1 + dr1, row2 + dr2
                if not valid(nr1, nr2, next_step):
                    continue
                gain = grid[nr1][next_step - nr1]
                if nr1 != nr2:  # same row on the same step = same cell
                    gain += grid[nr2][next_step - nr2]
                best = max(best, gain + dfs(next_step, nr1, nr2))

            memo[key] = best
            return best

        future = dfs(0, 0, 0)
        if future == float("-inf"):
            return 0  # no route reaches the finish
        return grid[0][0] + future


if __name__ == "__main__":
    # Input: n, then n rows of n integers (same format as Cherry_DFS.py).
    sys.setrecursionlimit(10000)
    n = int(input())
    grid = [list(map(int, input().split())) for _ in range(n)]

    solver = Solution()
    t0 = time.perf_counter()
    answer = solver.cherryPickup(grid)
    t1 = time.perf_counter()

    print(answer)
    print("state count =", solver.state_count)
    print("time taken  = %.6f sec" % (t1 - t0))
