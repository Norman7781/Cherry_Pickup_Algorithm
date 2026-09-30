"""
Cherry Pickup (LeetCode 741) - Approach 2: bottom-up tabulation

Team members:
    [Name 1] - [Student ID 1]
    [Name 2] - [Student ID 2]
    [Name 3] - [Student ID 3]

Idea: same two-walker state (step, row1, row2) as the top-down version, but
the table is filled forward one step (anti-diagonal) at a time, with no
recursion. previous[row1][row2] holds the most cherries collected so far when
walker A is in row1 and walker B is in row2. Only the previous layer is
needed to build the current one, so two n x n tables are enough.

Time  O(n^3): (2n-1) layers, n * n cells each, 4 predecessors per cell.
Space O(n^2): two n x n layers.
"""

import time
from typing import List


class Solution:
    def cherryPickup(self, grid: List[List[int]]) -> int:
        n = len(grid)
        negative_infinity = float("-inf")
        self.state_count = 0

        # At step 0, both walkers are at (0, 0)
        previous = [[negative_infinity] * n for _ in range(n)]
        previous[0][0] = grid[0][0]

        # Both walkers need 2(n - 1) steps to reach the destination
        for step in range(1, 2 * n - 1):
            current = [[negative_infinity] * n for _ in range(n)]

            minimum_row = max(0, step - (n - 1))
            maximum_row = min(n - 1, step)

            for row1 in range(minimum_row, maximum_row + 1):
                column1 = step - row1

                if grid[row1][column1] == -1:
                    continue

                for row2 in range(minimum_row, maximum_row + 1):
                    column2 = step - row2

                    if grid[row2][column2] == -1:
                        continue

                    self.state_count += 1
                    best_previous = previous[row1][row2]

                    if row1 > 0:
                        best_previous = max(best_previous, previous[row1 - 1][row2])

                    if row2 > 0:
                        best_previous = max(best_previous, previous[row1][row2 - 1])

                    if row1 > 0 and row2 > 0:
                        best_previous = max(
                            best_previous, previous[row1 - 1][row2 - 1]
                        )

                    if best_previous == negative_infinity:
                        continue

                    cherries = grid[row1][column1]

                    # Count the second cell only when positions differ
                    if row1 != row2:
                        cherries += grid[row2][column2]

                    current[row1][row2] = best_previous + cherries

            previous = current

        return max(0, previous[n - 1][n - 1])


if __name__ == "__main__":
    # Input: n, then n rows of n integers.
    n = int(input())
    grid = [list(map(int, input().split())) for _ in range(n)]

    solver = Solution()
    t0 = time.perf_counter()
    answer = solver.cherryPickup(grid)
    t1 = time.perf_counter()

    print(answer)
    print("cells computed =", solver.state_count)
    print("time taken     = %.6f sec" % (t1 - t0))
