import time

class State:
    def __init__(self, row1, row2, step, cherries):
        self.row1 = row1
        self.row2 = row2
        self.step = step
        self.cherries = cherries

def cherryPickup(grid):
    n = len(grid)
    memo = {}

    global count
    count = 0

    def valid(row1, row2, step):
        col1 = step - row1
        col2 = step - row2
        if row1 >= n or col1 >= n or row2 >= n or col2 >= n:
            return False
        if grid[row1][col1] == -1 or grid[row2][col2] == -1:
            return False
        return True

    def successor(s):
        succ = []
        moves = [(1, 1), (1, 0), (0, 1), (0, 0)]  # (d_row1, d_row2)
        for dr1, dr2 in moves:
            nr1 = s.row1 + dr1
            nr2 = s.row2 + dr2
            nstep = s.step + 1
            if valid(nr1, nr2, nstep):
                ncol1 = nstep - nr1
                ncol2 = nstep - nr2
                gain = grid[nr1][ncol1]
                if (nr1, ncol1) != (nr2, ncol2):
                    gain += grid[nr2][ncol2]
                succ.append(State(nr1, nr2, nstep, s.cherries + gain))
        return succ

    def dfs(s):
        global count
        count += 1

        if s.step == 2 * (n - 1):
            return s.cherries

        key = (s.step, s.row1, s.row2)
        if key in memo:
            return memo[key]

        best = float('-inf')
        for u in successor(s):
            best = max(best, dfs(u))

        memo[key] = best
        return best

    start_cherries = grid[0][0]
    start = State(0, 0, 0, start_cherries)
    result = dfs(start)
    return max(result, 0)


n = int(input())
grid = []
for i in range(n):
    grid.append(list(map(int, input().split())))

t0 = time.time()
ans = cherryPickup(grid)
t1 = time.time()

print(ans)
print("state count = ", count)
print("time taken  = %.6f sec" % (t1 - t0))