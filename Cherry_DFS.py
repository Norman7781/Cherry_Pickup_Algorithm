"""Version 1: DFS + memoization (top-down dynamic programming).

Girl = walker A. Boy = walker B. Both move right or down together.
After each move: column = step - row.
dfs() returns the best FUTURE cherries, excluding cherries already collected.

Time: O(n^3). Space: O(n^3) for memo + O(n) for the call stack.
Run: python3 Cherry_DFS.py < test_cases/large.txt
"""

import sys
import time


# Count all DFS calls, including calls that reuse a saved answer.
count = 0


def cherryPickup(grid):
    global count
    count = 0

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

    # 3. Save answers by (step, row A, row B); -infinity means impossible.
    memo = {}
    impossible = float("-inf")
    final_step = 2 * (size - 1)
    moves = [
        (1, 1),  # A down,  B down.
        (1, 0),  # A down,  B right.
        (0, 1),  # A right, B down.
        (0, 0),  # A right, B right.
    ]

    def is_open(row, column):
        # A position must stay inside the grid and avoid thorns.
        if row < 0 or row >= size or column < 0 or column >= size:
            return False
        return grid[row][column] != -1

    def dfs(step, row_a, row_b):
        global count
        count += 1

        # 4. At the finish, no future cherries remain.
        if step == final_step:
            return 0

        # 5. Reuse a state that was already solved.
        state = (step, row_a, row_b)
        if state in memo:
            return memo[state]

        # 6. Try the four pairs of next moves.
        best_future = impossible
        next_step = step + 1
        for move_a, move_b in moves:
            next_row_a = row_a + move_a
            next_row_b = row_b + move_b
            next_col_a = next_step - next_row_a
            next_col_b = next_step - next_row_b

            # Skip a move if either walker leaves the grid or hits a thorn.
            if not is_open(next_row_a, next_col_a):
                continue
            if not is_open(next_row_b, next_col_b):
                continue

            # 7. Collect the next squares; count a shared square only once.
            cherries = grid[next_row_a][next_col_a]
            if next_row_a != next_row_b:
                cherries += grid[next_row_b][next_col_b]

            # 8. Add this move's cherries to the child's best future.
            future = dfs(next_step, next_row_a, next_row_b)
            total = cherries + future
            best_future = max(best_future, total)

        # 9. Save only the future value, never a path's running total.
        memo[state] = best_future
        return best_future

    # 10. Add the shared start cell once. An impossible trip returns 0.
    best_future = dfs(0, 0, 0)
    if best_future == impossible:
        return 0
    return grid[0][0] + best_future


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

    # Print the answer first, followed by useful measurements.
    print(answer)
    print("state count =", count)
    print(f"time taken = {elapsed:.6f} sec")


# Run the input/output code only when this file is executed directly.
if __name__ == "__main__":
    main()
