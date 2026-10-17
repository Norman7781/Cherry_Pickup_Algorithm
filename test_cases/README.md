# Manual Cherry Pickup input cases

These five inputs exposed a correctness bug in the original `Cherry_DFS.py`.
That file is now fixed: both DFS and DP return the expected answers below.
These are valid grids with an open route, not timeout tests.
Every expected answer was checked against both `Cherry_DP.py` and the corrected
memoized DFS in `submission/cherry_pickup_dfs_memo.py`.

Run from the `term_project` folder:

```bash
python3 Cherry_DP.py < test_cases/small.txt
python3 Cherry_DFS.py < test_cases/small.txt
```

Replace the input filename to run another size. Each program prints its answer
on the first line; timing information follows. For a corrected DFS comparison:

```bash
python3 submission/cherry_pickup_dfs_memo.py < test_cases/small.txt
```

| Input | Size | Expected / DP / fixed DFS | DFS before fix (wrong) |
| --- | --- | ---: | ---: |
| `small.txt` | 3 × 3 | 6 | 5 |
| `medium.txt` | 10 × 10 | 28 | 16 |
| `large.txt` | 20 × 20 | 57 | 36 |
| `huge.txt` | 35 × 35 | 118 | 70 |
| `max.txt` | 50 × 50 | 159 | 78 |

## What was fixed in DFS

Its cache key is `(step, row1, row2)`, but the original cached result included
`s.cherries`, the total accumulated along a particular path. Two different
paths can reach the same state with different totals. Reusing a cached total
then produces a wrong answer.

A correct memoized DFS caches the best *future* from that state, independent
of the path used to reach it. These inputs do not make every DFS algorithm
fail: the corrected DFS agrees with DP on all five cases. Both correct solvers
have O(n³) worst-case time; the rolling-layer DP uses O(n²) extra space.

The fixed code returns 0 at the finish, maximizes `gain + dfs(child)`,
and adds the start cell once to the root’s best future. Cached values no longer
include cherries collected before reaching a state.

## Additional manual inputs

There are now 15 input files in total. Both fixed solvers agree on all files.

| Input | Size | Expected cherries |
| --- | --- | ---: |
| `tiny.txt` | 1 × 1 | 1 |
| `blocked.txt` | 3 × 3 | 0 |
| `empty.txt` | 4 × 4 | 0 |
| `path.txt` | 5 × 5 | 9 |
| `open.txt` | 10 × 10 | 36 |
| `n15.txt` | 15 × 15 | 34 |
| `n25.txt` | 25 × 25 | 69 |
| `n30.txt` | 30 × 30 | 79 |
| `n40.txt` | 40 × 40 | 113 |
| `full.txt` | 50 × 50 | 196 |

`tiny` checks one shared cherry; `empty` has no cherries; `blocked` has no
complete path; `path` forces a shared corridor; `open` and `full` have no
thorns. The n15/n25/n30/n40 files provide intermediate random grid sizes.

Run any case manually, for example:

```bash
python3 Cherry_DFS.py < test_cases/n25.txt
python3 Cherry_DP.py < test_cases/n25.txt
```
