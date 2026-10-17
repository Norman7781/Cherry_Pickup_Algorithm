"""Version 2: DP table (bottom-up dynamic programming).

Girl = walker A. Boy = walker B. Both move right or down together.
After each move: column = step - row.
Each table entry stores the best total collected SO FAR.

Time: O(n^3). Space: O(n^2), using only two table layers.
Run: python3 Cherry_DP.py < test_cases/large.txt
"""

import sys
import time


def cherryPickup(grid):
    # 1. Check that the grid is square and contains valid cells.
    size = len(grid)
    if size == 0:
        return 0
    for row in grid:
        if len(row) != size:
            raise ValueError("The grid must be square.")
        for cell in row:
            if cell not in (-1, 0, 1):
                raise ValueError("Grid cells must be -1, 0, or 1.")

    # 2. A blocked start or finish means no complete route exists.
    if grid[0][0] == -1 or grid[size - 1][size - 1] == -1:
        return 0

    # 3. Create the first layer; -infinity marks an impossible state.
    impossible = float("-inf")
    previous = []
    for row in range(size):
        previous.append([impossible] * size)
    previous[0][0] = grid[0][0]  # Both walkers share the start.

    # 4. Build one new table for each step towards the finish.
    final_step = 2 * (size - 1)
    for step in range(1, final_step + 1):
        current = []
        for row in range(size):
            current.append([impossible] * size)

        # These row limits keep column = step - row inside the grid.
        first_row = max(0, step - (size - 1))
        last_row = min(size - 1, step)

        # 5. Try every pair of positions on this step's diagonal.
        for row_a in range(first_row, last_row + 1):
            col_a = step - row_a
            if grid[row_a][col_a] == -1:
                continue

            for row_b in range(first_row, last_row + 1):
                col_b = step - row_b
                if grid[row_b][col_b] == -1:
                    continue

                # 6. Compare the four possible ways to arrive here.
                best_previous = previous[row_a][row_b]  # Both moved right.
                if row_a > 0:  # A moved down; B moved right.
                    best_previous = max(best_previous, previous[row_a - 1][row_b])
                if row_b > 0:  # A moved right; B moved down.
                    best_previous = max(best_previous, previous[row_a][row_b - 1])
                if row_a > 0 and row_b > 0:  # Both moved down.
                    best_previous = max(best_previous, previous[row_a - 1][row_b - 1])

                # Skip this state if no previous route can reach it.
                if best_previous == impossible:
                    continue

                # 7. Collect these squares; count a shared square only once.
                cherries = grid[row_a][col_a]
                if row_a != row_b:
                    cherries += grid[row_b][col_b]

                # 8. Store the best total collected up to this state.
                current[row_a][row_b] = best_previous + cherries

        # 9. Keep this layer for the next step; older layers are not needed.
        previous = current

    # 10. Read the finish entry. An impossible trip returns 0.
    answer = previous[size - 1][size - 1]
    if answer == impossible:
        return 0
    return int(answer)


class Solution:
    # Optional wrapper for submitting this function to LeetCode.
    def cherryPickup(self, grid):
        return cherryPickup(grid)


def main():
    # Read: grid size, followed by size * size cell values.
    try:
        values = sys.stdin.read().split()
        if len(values) == 0:
            raise ValueError("Enter the grid size and its cells.")
        size = int(values[0])
        if size < 1 or len(values) != 1 + size * size:
            raise ValueError("Enter a positive size and exactly size * size cells.")

        grid = []
        position = 1
        for row_number in range(size):
            row = []
            for column_number in range(size):
                row.append(int(values[position]))
                position += 1
            grid.append(row)

        # Run the solver and measure its execution time.
        start = time.perf_counter()
        answer = cherryPickup(grid)
        elapsed = time.perf_counter() - start
    except ValueError as error:
        sys.exit(f"Input error: {error}")

    # Print the answer first, followed by execution time.
    print(answer)
    print(f"time taken = {elapsed:.6f} sec")


# Run the input/output code only when this file is executed directly.
if __name__ == "__main__":
    main()
