"""Version 2: bottom-up DP, separated into small helper functions.

Girl = walker A. Boy = walker B. Both move right or down together.
After each move: column = step - row.
Each table entry stores the best total collected SO FAR.

Reading order: cherryPickup() -> build_layer() -> the calculation helpers.
Time: O(n^3). Space: O(n^2), using only two table layers.
Run: python3 Cherry_DP.py < test_cases/large.txt
"""

import sys
import time


# A state marked -infinity cannot be reached by a valid route.
IMPOSSIBLE = float("-inf")


def validate_grid(grid):
    """Check that the grid is square and its cells are -1, 0, or 1."""
    size = len(grid)
    for row in grid:
        if len(row) != size:
            raise ValueError("The grid must be square.")
        for cell in row:
            if cell not in (-1, 0, 1):
                raise ValueError("Grid cells must be -1, 0, or 1.")


def create_table(size):
    """Create a new table with every state marked impossible."""
    table = []
    for row in range(size):
        table.append([IMPOSSIBLE] * size)
    return table


def get_row_limits(step, size):
    """Find rows whose column = step - row stays inside the grid."""
    first_row = max(0, step - (size - 1))
    last_row = min(size - 1, step)
    return first_row, last_row


def get_best_previous(previous, row_a, row_b):
    """Compare the four possible ways the walkers arrived here."""
    best = previous[row_a][row_b]  # Both moved right.

    # A moved down; B moved right.
    if row_a > 0:
        best = max(best, previous[row_a - 1][row_b])

    # A moved right; B moved down.
    if row_b > 0:
        best = max(best, previous[row_a][row_b - 1])

    # Both moved down.
    if row_a > 0 and row_b > 0:
        best = max(best, previous[row_a - 1][row_b - 1])

    return best


def count_cherries(grid, step, row_a, row_b):
    """Count the current squares, counting a shared square only once."""
    col_a = step - row_a
    col_b = step - row_b
    cherries = grid[row_a][col_a]
    if row_a != row_b:
        cherries += grid[row_b][col_b]
    return cherries


def build_layer(grid, previous, step):
    """Fill one step's table by trying every valid pair of walker rows."""
    size = len(grid)
    current = create_table(size)
    first_row, last_row = get_row_limits(step, size)

    # The outer loop chooses A's row; the inner loop chooses B's row.
    for row_a in range(first_row, last_row + 1):
        col_a = step - row_a
        if grid[row_a][col_a] == -1:
            continue

        for row_b in range(first_row, last_row + 1):
            col_b = step - row_b
            if grid[row_b][col_b] == -1:
                continue

            # Skip a state that no previous route can reach.
            best_previous = get_best_previous(previous, row_a, row_b)
            if best_previous == IMPOSSIBLE:
                continue

            # Save the best previous total plus this step's cherries.
            cherries = count_cherries(grid, step, row_a, row_b)
            current[row_a][row_b] = best_previous + cherries

    return current


def cherryPickup(grid):
    """Run the DP stages and return the maximum collected cherries."""
    # 1. Validate the input and check the two corners.
    validate_grid(grid)
    size = len(grid)
    if size == 0:
        return 0
    if grid[0][0] == -1 or grid[size - 1][size - 1] == -1:
        return 0

    # 2. Step 0: both walkers share the start cell.
    previous = create_table(size)
    previous[0][0] = grid[0][0]

    # 3. Each loop iteration builds and preserves one completed layer.
    final_step = 2 * (size - 1)
    for step in range(1, final_step + 1):
        current = build_layer(grid, previous, step)
        previous = current

    # 4. Read the finish entry; an impossible trip returns 0.
    answer = previous[size - 1][size - 1]
    if answer == IMPOSSIBLE:
        return 0
    return int(answer)


class Solution:
    # Optional wrapper for submitting this function to LeetCode.
    def cherryPickup(self, grid):
        return cherryPickup(grid)


def read_grid():
    """Read a positive grid size followed by exactly size * size cells."""
    values = sys.stdin.read().split()
    if len(values) == 0:
        raise ValueError("Enter the grid size and its cells.")
    size = int(values[0])
    if size < 1 or len(values) != 1 + size * size:
        raise ValueError("Enter a positive size and exactly size * size cells.")

    # Read one row at a time from the input values.
    grid = []
    position = 1
    for row_number in range(size):
        row = []
        for column_number in range(size):
            row.append(int(values[position]))
            position += 1
        grid.append(row)
    return grid


def main():
    # Read input, run the solver, and measure only the solving time.
    try:
        grid = read_grid()
        start = time.perf_counter()
        answer = cherryPickup(grid)
        elapsed = time.perf_counter() - start
    except ValueError as error:
        sys.exit(f"Input error: {error}")

    # Keep the answer on the first line for manual comparisons.
    print(answer)
    print(f"time taken = {elapsed:.6f} sec")


if __name__ == "__main__":
    main()
