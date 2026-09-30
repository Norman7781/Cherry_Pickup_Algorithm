"""
Build the term-project report (report.html -> Cherry_Pickup_Report.pdf).

1. Fill in TEAM, COURSE and LEETCODE below.
2. Run:  python3 benchmark.py      (only if you changed the solutions)
3. Run:  python3 build_report.py

The PDF is printed with headless Google Chrome.
"""

import html
import json
import math
import subprocess
from pathlib import Path

# ----------------------------------------------------------------- edit me --
TEAM = [
    ("[Name 1]", "[Student ID 1]"),
    ("[Name 2]", "[Student ID 2]"),
    ("[Name 3]", "[Student ID 3]"),
]
COURSE = "[Course code] Algorithm Design"
INSTRUCTOR = "[Instructor name]"
DATE = "30 September 2026"
# Copy these from your accepted LeetCode submission (one per approach).
LEETCODE = {
    "top_down": {"status": "[Accepted]", "runtime": "[__ ms]", "memory": "[__ MB]"},
    "bottom_up": {"status": "[Accepted]", "runtime": "[__ ms]", "memory": "[__ MB]"},
}
# ---------------------------------------------------------------------------

HERE = Path(__file__).parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
R = json.loads((HERE / "benchmark_results.json").read_text())


def esc(text):
    return html.escape(str(text))


def fmt(value):
    return "−∞" if value == float("-inf") else str(int(value))


def ph(text):
    """Highlight placeholders like [Name 1] so they are easy to spot."""
    text = esc(text)
    return f'<span class="ph">{text}</span>' if text.startswith("[") else text


# ------------------------------------------------------------ small figures --
def grid_svg(grid, route_a=(), route_b=(), diag=None, size=34, labels=True):
    n = len(grid)
    pad = 18 if labels else 2
    w = n * size + pad + 2
    parts = [f'<svg viewBox="0 0 {w} {w}" width="{w}" height="{w}" class="fig">']
    for r in range(n):
        for c in range(n):
            x, y = pad + c * size, pad + r * size
            v = grid[r][c]
            inA, inB = (r, c) in route_a, (r, c) in route_b
            fill = "#ffffff"
            if diag is not None and r + c == diag:
                fill = "#f7e7b6"
            if inA and inB:
                fill = "url(#both)"
            elif inA:
                fill = "#f6c9b6"
            elif inB:
                fill = "#bfdde7"
            if v == -1:
                fill = "#273532"
            parts.append(
                f'<rect x="{x}" y="{y}" width="{size}" height="{size}" '
                f'fill="{fill}" stroke="#9aa69f" stroke-width="1"/>'
            )
            label = "●" if v == 1 else "✕" if v == -1 else ""
            color = "#c0392b" if v == 1 else "#ffffff"
            if label:
                parts.append(
                    f'<text x="{x + size / 2}" y="{y + size / 2 + 5}" '
                    f'text-anchor="middle" font-size="14" fill="{color}">{label}</text>'
                )
    if labels:
        for i in range(n):
            parts.append(
                f'<text x="{pad + i * size + size / 2}" y="12" text-anchor="middle" '
                f'font-size="10" fill="#6e7871">{i}</text>'
            )
            parts.append(
                f'<text x="8" y="{pad + i * size + size / 2 + 4}" text-anchor="middle" '
                f'font-size="10" fill="#6e7871">{i}</text>'
            )
    parts.insert(
        1,
        '<defs><linearGradient id="both" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="50%" stop-color="#f6c9b6"/><stop offset="50%" stop-color="#bfdde7"/>'
        "</linearGradient></defs>",
    )
    parts.append("</svg>")
    return "".join(parts)


def line_chart(title, series, y_label, log=False, width=318, height=210):
    """series: list of (label, color, [(x, y), ...])."""
    left, right, top, bottom = 48, 12, 26, 34
    xs = [x for _, _, pts in series for x, _ in pts]
    ys = [y for _, _, pts in series for _, y in pts]
    x0, x1 = min(xs), max(xs)
    if log:
        y0 = 10 ** math.floor(math.log10(min(ys)))
        y1 = 10 ** math.ceil(math.log10(max(ys)))
        fy = lambda y: (math.log10(y) - math.log10(y0)) / (math.log10(y1) - math.log10(y0))
        ticks = [10**k for k in range(int(math.log10(y0)), int(math.log10(y1)) + 1)]
    else:
        y0, y1 = 0, max(ys) * 1.08
        step = 10 ** math.floor(math.log10(y1 / 4))
        step *= 2 if y1 / step > 8 else 1
        ticks = [k * step for k in range(int(y1 / step) + 1)]
        fy = lambda y: (y - y0) / (y1 - y0)
    px = lambda x: left + (x - x0) / (x1 - x0) * (width - left - right)
    py = lambda y: height - bottom - fy(y) * (height - top - bottom)
    out = [f'<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" class="chart">']
    out.append(f'<text x="{left}" y="14" font-size="11" font-weight="700">{esc(title)}</text>')
    for t in ticks:
        y = py(t)
        out.append(f'<line x1="{left}" x2="{width - right}" y1="{y}" y2="{y}" stroke="#e3e6df"/>')
        label = f"{t:g}"
        out.append(f'<text x="{left - 5}" y="{y + 3}" font-size="9" text-anchor="end" fill="#6e7871">{label}</text>')
    for x in sorted(set(xs)):
        if x % 10 == 0 or x == x0:
            out.append(f'<text x="{px(x)}" y="{height - bottom + 13}" font-size="9" text-anchor="middle" fill="#6e7871">{x}</text>')
    out.append(f'<text x="{(left + width - right) / 2}" y="{height - 6}" font-size="9" text-anchor="middle" fill="#6e7871">grid size n</text>')
    out.append(f'<text x="11" y="{(top + height - bottom) / 2}" font-size="9" text-anchor="middle" fill="#6e7871" transform="rotate(-90 11 {(top + height - bottom) / 2})">{esc(y_label)}</text>')
    for i, (label, color, pts) in enumerate(series):
        d = " ".join(f"{'M' if j == 0 else 'L'}{px(x):.1f},{py(y):.1f}" for j, (x, y) in enumerate(pts))
        out.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2"/>')
        for x, y in pts:
            out.append(f'<circle cx="{px(x):.1f}" cy="{py(y):.1f}" r="2.3" fill="{color}"/>')
        lx = left + 8 + i * 125
        out.append(f'<rect x="{lx}" y="{top}" width="10" height="3" fill="{color}"/>')
        out.append(f'<text x="{lx + 14}" y="{top + 4}" font-size="9">{esc(label)}</text>')
    out.append("</svg>")
    return "".join(out)


# ------------------------------------------------------- worked example data --
def tabulation_layers(grid):
    n = len(grid)
    neg = float("-inf")
    prev = [[neg] * n for _ in range(n)]
    prev[0][0] = grid[0][0]
    layers = [prev]
    for step in range(1, 2 * n - 1):
        cur = [[neg] * n for _ in range(n)]
        lo, hi = max(0, step - (n - 1)), min(n - 1, step)
        for r1 in range(lo, hi + 1):
            if grid[r1][step - r1] == -1:
                continue
            for r2 in range(lo, hi + 1):
                if grid[r2][step - r2] == -1:
                    continue
                best = max(
                    prev[r1][r2],
                    prev[r1 - 1][r2] if r1 else neg,
                    prev[r1][r2 - 1] if r2 else neg,
                    prev[r1 - 1][r2 - 1] if r1 and r2 else neg,
                )
                if best == neg:
                    continue
                gain = grid[r1][step - r1] + (grid[r2][step - r2] if r1 != r2 else 0)
                cur[r1][r2] = best + gain
        layers.append(cur)
        prev = cur
    return layers


def layer_table(layer, step, n):
    lo, hi = max(0, step - (n - 1)), min(n - 1, step)
    rows = ['<table class="layer"><tr><th>r1\\r2</th>' + "".join(f"<th>{c}</th>" for c in range(n)) + "</tr>"]
    for r1 in range(n):
        cells = []
        for r2 in range(n):
            if not (lo <= r1 <= hi and lo <= r2 <= hi):
                cells.append('<td class="off"></td>')
            else:
                v = layer[r1][r2]
                cells.append(f'<td class="{"neg" if v == float("-inf") else "val"}">{"−∞" if v == float("-inf") else int(v)}</td>')
        rows.append(f"<tr><th>{r1}</th>{''.join(cells)}</tr>")
    rows.append("</table>")
    return f'<div class="layer-box"><div class="layer-title">step {step}</div>{"".join(rows)}</div>'


def best_routes(grid):
    """Recover one optimal pair of routes with the top-down recurrence."""
    from functools import lru_cache

    n = len(grid)

    @lru_cache(None)
    def f(step, r1, r2):
        if step == 2 * n - 2:
            return 0, None
        best, arg = float("-inf"), None
        for d1, d2 in ((1, 1), (1, 0), (0, 1), (0, 0)):
            a, b, s = r1 + d1, r2 + d2, step + 1
            if a >= n or b >= n or s - a >= n or s - b >= n:
                continue
            if grid[a][s - a] == -1 or grid[b][s - b] == -1:
                continue
            g = grid[a][s - a] + (grid[b][s - b] if a != b else 0)
            v = g + f(s, a, b)[0]
            if v > best:
                best, arg = v, (s, a, b)
        return best, arg

    state, ra, rb = (0, 0, 0), [(0, 0)], [(0, 0)]
    while f(*state)[1]:
        state = f(*state)[1]
        s, a, b = state
        ra.append((a, s - a))
        rb.append((b, s - b))
    return ra, rb


# ------------------------------------------------------------------ report --
def main():
    perf_open = R["performance"]["open"]
    perf_rand = R["performance"]["random"]
    last = perf_open[-1]
    speedup = last["top_down"]["time_ms"] / last["bottom_up"]["time_ms"]
    mem_ratio = last["top_down"]["peak_kb"] / last["bottom_up"]["peak_kb"]
    c9849 = math.comb(98, 49)

    ex1 = R["examples"][0]["grid"]
    ex_layers = tabulation_layers(ex1)
    ra, rb = best_routes(ex1)
    greedy = R["greedy"]
    ga, gb = best_routes(greedy["grid"])

    team_rows = "".join(f"<tr><td>{ph(name)}</td><td>{ph(sid)}</td></tr>" for name, sid in TEAM)
    team_line = ", ".join(f"{ph(n)} ({ph(i)})" for n, i in TEAM)

    def perf_rows(rows):
        return "".join(
            f"<tr><td>{p['n']}</td><td>{p['top_down']['answer']}</td>"
            f"<td>{p['top_down']['states']:,}</td><td>{p['top_down']['time_ms']:.2f}</td><td>{p['top_down']['peak_kb']:,.1f}</td>"
            f"<td>{p['bottom_up']['states']:,}</td><td>{p['bottom_up']['time_ms']:.2f}</td><td>{p['bottom_up']['peak_kb']:,.1f}</td></tr>"
            for p in rows
        )

    time_chart = line_chart(
        "Running time, open grid (worst case)",
        [
            ("top-down DFS + memo", "#e56f45", [(p["n"], p["top_down"]["time_ms"]) for p in perf_open]),
            ("bottom-up table", "#4b91a5", [(p["n"], p["bottom_up"]["time_ms"]) for p in perf_open]),
        ],
        "time (ms)",
    )
    mem_chart = line_chart(
        "Peak extra memory (log scale)",
        [
            ("top-down DFS + memo", "#e56f45", [(p["n"], p["top_down"]["peak_kb"]) for p in perf_open]),
            ("bottom-up table", "#4b91a5", [(p["n"], p["bottom_up"]["peak_kb"]) for p in perf_open]),
        ],
        "memory (KB)",
        log=True,
    )
    code_td = esc((HERE / "cherry_pickup_dfs_memo.py").read_text())
    code_bu = esc((HERE / "cherry_pickup_bottom_up.py").read_text())
    lc = LEETCODE

    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Cherry Pickup – Term Project Report</title>
<style>
@page {{ size: A4; margin: 18mm 17mm 18mm 17mm; }}
* {{ box-sizing: border-box; }}
body {{ font: 10.5pt/1.5 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #17211f; margin: 0; }}
h1 {{ font-size: 26pt; line-height: 1.1; margin: 0 0 6px; letter-spacing: -0.02em; }}
h2 {{ font-size: 15pt; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #e56f45; break-after: avoid; }}
h3 {{ font-size: 11.5pt; margin: 14px 0 6px; break-after: avoid; }}
p {{ margin: 0 0 8px; text-align: justify; }}
code, pre {{ font-family: Menlo, Consolas, monospace; }}
code {{ font-size: 9pt; background: #f1f3ee; padding: 0 3px; border-radius: 2px; }}
pre {{ font-size: 8pt; line-height: 1.4; background: #f6f7f3; border: 1px solid #dde2da; padding: 8px 10px; white-space: pre-wrap; margin: 6px 0 10px; }}
pre.code {{ font-size: 7.6pt; }}
table {{ border-collapse: collapse; margin: 6px 0 12px; width: 100%; break-inside: avoid; }}
th, td {{ border: 1px solid #d4d9d0; padding: 4px 6px; font-size: 9pt; text-align: left; vertical-align: top; }}
th {{ background: #eef1ea; }}
td.num, .perf td {{ text-align: right; }}
.perf td:first-child {{ text-align: center; }}
.ph {{ background: #fff1a8; padding: 0 2px; }}
.cover {{ height: 245mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }}
.kicker {{ color: #e56f45; font: 700 9pt/1 Menlo, monospace; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 14px; }}
.subtitle {{ font-size: 13pt; color: #52605a; margin-bottom: 28px; }}
.cover table {{ width: 70%; }}
.cover .meta td {{ border: 0; padding: 2px 0; font-size: 10.5pt; }}
.box {{ border: 1px solid #d4d9d0; border-left: 4px solid #e56f45; background: #fbf7f3; padding: 8px 12px; margin: 8px 0 12px; break-inside: avoid; }}
.box.blue {{ border-left-color: #4b91a5; background: #f2f8fa; }}
.box p:last-child {{ margin: 0; }}
.figs {{ display: flex; gap: 12px; align-items: flex-start; justify-content: center; margin: 8px 0; break-inside: avoid; flex-wrap: wrap; }}
.figs figure {{ margin: 0; text-align: center; }}
figcaption {{ font-size: 8.5pt; color: #52605a; margin-top: 4px; max-width: 330px; }}
.layers {{ display: flex; flex-wrap: wrap; gap: 8px; break-inside: avoid; }}
.layer-box {{ border: 1px solid #d4d9d0; padding: 4px; }}
.layer-title {{ font: 700 8pt Menlo, monospace; color: #e56f45; margin-bottom: 2px; }}
table.layer {{ width: auto; margin: 0; }}
table.layer th, table.layer td {{ font: 8pt Menlo, monospace; padding: 2px 5px; text-align: center; }}
table.layer td.off {{ background: repeating-linear-gradient(45deg, #eceee8, #eceee8 3px, #e3e6df 3px, #e3e6df 6px); }}
table.layer td.val {{ background: #d9eee2; font-weight: 700; }}
table.layer td.neg {{ color: #a8b0aa; }}
.legend {{ font-size: 8.5pt; color: #52605a; }}
.sw {{ display: inline-block; width: 10px; height: 10px; border: 1px solid #9aa69f; vertical-align: -1px; margin: 0 3px 0 8px; }}
.two {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
.page-break {{ break-before: page; }}
ul, ol {{ margin: 0 0 8px; padding-left: 20px; }}
li {{ margin-bottom: 3px; }}
.small {{ font-size: 9pt; color: #52605a; }}
</style></head><body>

<section class="cover">
  <div>
    <div class="kicker">Term Project · Algorithm Design</div>
    <h1>Cherry Pickup</h1>
    <div class="subtitle">LeetCode 741 — solved with top-down DFS + memoization and bottom-up tabulation, with a comparison of both approaches</div>
    <table class="meta">
      <tr><td style="width:120px"><b>Course</b></td><td>{ph(COURSE)}</td></tr>
      <tr><td><b>Instructor</b></td><td>{ph(INSTRUCTOR)}</td></tr>
      <tr><td><b>Date</b></td><td>{esc(DATE)}</td></tr>
      <tr><td><b>Online judge</b></td><td>LeetCode, problem 741 “Cherry Pickup” (Hard)</td></tr>
    </table>
  </div>
  <div>
    <h3>Team members</h3>
    <table><tr><th>Name</th><th>Student ID</th></tr>{team_rows}</table>
  </div>
  <div class="small">
    <b>Contents.</b> 1 Problem description · 2 Key ideas · 3 Approach 1: top-down DFS + memoization ·
    4 Approach 2: bottom-up tabulation · 5 Complexity analysis · 6 Comparison of the two approaches ·
    7 Testing and online-judge submission · 8 Visualization tool · 9 Conclusion · 10 AI usage disclosure ·
    References · Appendix: source code
  </div>
</section>

<h2>1. Problem description</h2>
<p>We are given an <i>n × n</i> grid (1 ≤ n ≤ 50). Every cell holds one of three values:
<b>0</b> — an empty cell that can be walked through, <b>1</b> — a cell with one cherry that can be picked up and walked
through, and <b>−1</b> — a thorn that blocks the way. The top-left and bottom-right cells are never thorns.</p>
<p>A player starts at (0, 0), walks to (n−1, n−1) moving only <b>right or down</b> through non-thorn cells, and then walks
back to (0, 0) moving only <b>left or up</b>. Whenever the player passes a cell with a cherry, the cherry is picked up and the
cell becomes empty, so a cherry can be collected <b>at most once</b>. The task is to return the maximum number of cherries
that can be collected. If there is no valid path between the two corners, the answer is 0.</p>
<div class="figs">
  <figure>{grid_svg(ex1, ra, rb)}<figcaption>Example 1: grid [[0,1,−1],[1,0,−1],[1,1,1]], answer 5. ● = cherry, ✕ = thorn.
  The shaded cells show one optimal pair of routes (A = orange, B = blue, shared = split).</figcaption></figure>
  <figure>{grid_svg(R["examples"][1]["grid"])}<figcaption>Example 2: grid [[1,1,−1],[1,−1,1],[−1,1,1]]. The thorns cut every
  path from the start to the finish, so the answer is 0.</figcaption></figure>
</div>

<h2>2. Key ideas</h2>
<h3>2.1 Why a greedy approach fails</h3>
<p>A natural idea is to take the best single path to the corner, remove its cherries, and then take the best path back.
This greedy strategy is <b>not optimal</b>, because the first path does not consider what the return trip can still reach.
On the 7 × 7 grid below, greedy collects <b>{greedy["greedy"]}</b> cherries while the optimum is <b>{greedy["optimal"]}</b>
(both values computed by our benchmark script). The two trips must therefore be planned <i>together</i>.</p>
<div class="figs"><figure>{grid_svg(greedy["grid"], ga, gb, size=22)}<figcaption>Greedy counterexample. Planning both routes together (shaded)
collects {greedy["optimal"]}; greedy stops at {greedy["greedy"]}.</figcaption></figure></div>

<h3>2.2 Two walkers instead of a round trip</h3>
<p>A path back from (n−1, n−1) to (0, 0) using left/up moves is the same set of cells as a path from (0, 0) to (n−1, n−1)
using right/down moves. So the round trip is equivalent to <b>two walkers, A and B, that both start at (0, 0) and walk to
(n−1, n−1) at the same time</b>, one step each per time unit. Both walks take exactly 2(n−1) steps.</p>

<h3>2.3 State reduction: (step, row1, row2)</h3>
<p>After <i>t</i> steps a walker at row <i>r</i> must be in column <i>c = t − r</i>, because every move increases
<i>r + c</i> by exactly one. So instead of four coordinates (r1, c1, r2, c2) we only need
<b>(t, r1, r2)</b>. All positions reachable at step <i>t</i> lie on the anti-diagonal <i>r + c = t</i>.</p>

<h3>2.4 Counting a shared cell once</h3>
<p>Because both walkers move in lock-step, they can only stand on the same cell at the same step. At step <i>t</i>,
they are on the same cell exactly when r1 = r2. That cell’s cherry is added once. A cell visited by A at one step and by B at a
<i>different</i> step is impossible, since a cell (r, c) is only reachable at step r + c. This is what makes the
“at most once” rule easy to enforce.</p>

<h3>2.5 Transitions</h3>
<p>Each walker moves either down (row + 1) or right (row unchanged), giving four combined moves:
(A↓, B↓), (A↓, B→), (A→, B↓), (A→, B→). A move is valid only if both new cells are inside the grid and are not thorns.
The cherries gained by a move are</p>
<pre>gain(t, r1, r2) = grid[r1][t − r1] + (grid[r2][t − r2]  if r1 ≠ r2  else 0)</pre>

<h2>3. Approach 1 — Top-down DFS with memoization</h2>
<h3>3.1 Recurrence</h3>
<p>Let <b>F(t, r1, r2)</b> be the maximum number of cherries that can <i>still</i> be collected after the walkers are at
(r1, t − r1) and (r2, t − r2). This is the <b>best future</b> from the state.</p>
<pre>F(2n−2, n−1, n−1) = 0                                              (both walkers are at the finish)
F(t, r1, r2)      = max over the 4 moves (d1, d2) that are valid of
                        gain(t+1, r1+d1, r2+d2) + F(t+1, r1+d1, r2+d2)
F(t, r1, r2)      = −∞   if no move is valid                            (dead end)

answer = grid[0][0] + F(0, 0, 0),   or 0 if F(0, 0, 0) = −∞</pre>
<p>The recursion is a depth-first search: it follows one sequence of moves all the way to the finish, returns the value, and
backtracks to try the next move. Many different move sequences reach the same state, so each F value is stored in a
dictionary keyed by (t, r1, r2) and reused. That turns an exponential search into a polynomial one.</p>

<h3>3.2 Why the memo must store the <i>future</i>, not the running total</h3>
<div class="box"><p>Our first version (<code>Cherry_DFS.py</code>) passed the number of cherries collected <i>so far</i> down the recursion and
returned that running total at the finish, while memoizing by (t, r1, r2) only. The stored value then depended on
<i>which path</i> first reached the state. A later path with a different running total reused a number that was wrong for it.
For example, on the grid [[0,1,−1,−1],[0,1,0,1],[−1,1,0,1],[0,1,1,1]] it printed 6 instead of 8. Returning the best
<b>future</b> (which depends only on the state) fixes this. The corrected version is the one presented in this report.</p></div>

<h3>3.3 Algorithm</h3>
<pre>function DFS(t, r1, r2):
    if t = 2n − 2:                 return 0
    if (t, r1, r2) in memo:        return memo[(t, r1, r2)]
    best ← −∞
    for (d1, d2) in {{(1,1), (1,0), (0,1), (0,0)}}:
        a ← r1 + d1;  b ← r2 + d2;  s ← t + 1
        if cells (a, s−a) and (b, s−b) are inside the grid and not thorns:
            best ← max(best, gain(s, a, b) + DFS(s, a, b))
    memo[(t, r1, r2)] ← best
    return best

answer ← max(0, grid[0][0] + DFS(0, 0, 0))</pre>

<h2>4. Approach 2 — Bottom-up tabulation</h2>
<h3>4.1 Recurrence</h3>
<p>The bottom-up version fills the same state space forward in time. Let <b>G(t, r1, r2)</b> be the maximum number of
cherries collected <i>so far</i> when A is at (r1, t − r1) and B is at (r2, t − r2). A state can be entered from the
state at step t − 1 in which each walker was either one row up (it moved down) or in the same row (it moved right):</p>
<pre>G(0, 0, 0)   = grid[0][0]
G(t, r1, r2) = gain(t, r1, r2) + max( G(t−1, r1,   r2  ),     A→, B→
                                      G(t−1, r1−1, r2  ),     A↓, B→
                                      G(t−1, r1,   r2−1),     A→, B↓
                                      G(t−1, r1−1, r2−1) )    A↓, B↓
G(t, r1, r2) = −∞   if either cell is a thorn or all four predecessors are −∞

answer = max(0, G(2n−2, n−1, n−1))</pre>
<p>G is the “prefix” counterpart of F: for every state on an optimal route, G + F equals the answer.
Both describe the same DP. They only differ in the direction the table is filled.</p>

<h3>4.2 Filling order and the rolling array</h3>
<p>G(t, ·, ·) depends only on G(t − 1, ·, ·), so the table is filled one step (one anti-diagonal) at a time, and only two
n × n layers are kept: <code>previous</code> and <code>current</code>. For each step only rows
max(0, t − n + 1) … min(n − 1, t) are valid, which skips impossible cells.</p>

<h3>4.3 Worked example (Example 1)</h3>
<p>The layers below are produced by the algorithm for Example 1. Hatched cells are rows that cannot occur at that step,
and −∞ marks unreachable pairs (a thorn or no valid predecessor). The final layer’s corner value is the answer,
<b>{int(ex_layers[-1][2][2])}</b>. The tables are symmetric because swapping A and B gives the same situation.</p>
<div class="layers">{"".join(layer_table(layer, s, len(ex1)) for s, layer in enumerate(ex_layers))}</div>
<p class="small">For example, G(2, 1, 2) puts A on (1, 1) and B on (2, 0). Its four candidates are
G(1, 1, 2) = −∞, G(1, 0, 2) = −∞ (row 2 does not exist at step 1), G(1, 1, 1) = {fmt(ex_layers[1][1][1])} and
G(1, 0, 1) = {fmt(ex_layers[1][0][1])}. The best is {fmt(max(ex_layers[1][1][1], ex_layers[1][0][1]))}, and the walkers add
0 + 1 cherries, so G(2, 1, 2) = {fmt(ex_layers[2][1][2])}.</p>

<h2>5. Complexity analysis</h2>
<h3>5.1 Number of states</h3>
<p>t ranges over 0 … 2n − 2 (2n − 1 values) and r1, r2 over 0 … n − 1, so there are at most (2n − 1)·n² states. Only rows
in the valid range for each step count. If k<sub>t</sub> = min(t, 2n − 2 − t) + 1 is the length of anti-diagonal t, the exact
number of pairs is Σ<sub>t</sub> k<sub>t</sub><sup>2</sup> = (2n³ + n)/3 ≈ (2/3)n³. For n = 50 this is
{(2 * 50**3 + 50) // 3:,}, which matches the {perf_open[-1]["bottom_up"]["states"]:,} cells computed by the bottom-up solution on the
open 50 × 50 grid.</p>

<h3>5.2 Approach 1 — top-down</h3>
<ul>
<li><b>Time: Θ(n³).</b> Each state is solved once. Its body tries 4 moves in O(1) time each, and every later visit is an O(1)
memo lookup. The number of <code>dfs</code> calls is at most 4·(number of states) + 1. On the open 50 × 50 grid we measured
{perf_open[-1]["top_down"]["states"]:,} calls ≈ 4 × {perf_open[-1]["bottom_up"]["states"]:,}.</li>
<li><b>Space: Θ(n³)</b> for the memo dictionary (one entry per solved state) <b>+ O(n)</b> for the recursion stack. The
depth is at most 2n − 1 = 99 frames, well within Python’s default limit of 1000.</li>
</ul>
<h3>5.3 Approach 2 — bottom-up</h3>
<ul>
<li><b>Time: Θ(n³).</b> There are 2n − 1 layers, at most n² cells per layer, and 4 predecessor lookups per cell, all O(1).</li>
<li><b>Space: Θ(n²).</b> Only two n × n layers are stored. The full 3-D table is never materialized.</li>
</ul>
<h3>5.4 Brute force for reference</h3>
<p>A single monotone path from corner to corner is a choice of which n − 1 of the 2n − 2 moves go down, giving
C(2n − 2, n − 1) paths, so trying every pair costs Θ(C(2n−2, n−1)² · n) ≈ Θ(16ⁿ / √n). For n = 50, C(98, 49) ≈
{c9849:.2e}, so there are about {c9849**2:.1e} pairs. That is infeasible, while the DP needs only about 83,000 states.</p>

<table>
<tr><th></th><th>Brute force</th><th>Top-down DFS + memo</th><th>Bottom-up tabulation</th></tr>
<tr><td>Time</td><td>Θ(C(2n−2, n−1)² · n)</td><td>Θ(n³)</td><td>Θ(n³)</td></tr>
<tr><td>Extra space</td><td>Θ(n)</td><td>Θ(n³) memo + Θ(n) stack</td><td>Θ(n²)</td></tr>
<tr><td>n = 50</td><td>≈ {c9849**2:.0e} path pairs</td><td>≈ 83 k states, 323 k calls</td><td>≈ 83 k cells</td></tr>
</table>

<h2>6. Comparison of the two approaches</h2>
<h3>6.1 Side by side</h3>
<table>
<tr><th style="width:22%">Aspect</th><th>Top-down DFS + memoization</th><th>Bottom-up tabulation</th></tr>
<tr><td>Value stored</td><td>F = best <b>future</b> from a state</td><td>G = best <b>so far</b> at a state</td></tr>
<tr><td>Direction</td><td>From the start, recursing towards the finish; values return backwards</td><td>Layer by layer from step 0 to step 2n − 2</td></tr>
<tr><td>Order of evaluation</td><td>Automatic: the recursion discovers what it needs</td><td>Must be chosen by hand (by step)</td></tr>
<tr><td>States computed</td><td>Only states reachable from the start without thorns</td><td>Every non-thorn pair on each anti-diagonal, including unreachable ones</td></tr>
<tr><td>Time</td><td>Θ(n³), with a larger constant: function calls, dict hashing of tuples</td><td>Θ(n³), with a small constant: list indexing in loops</td></tr>
<tr><td>Space</td><td>Θ(n³) memo + Θ(n) call stack</td><td>Θ(n²) with two rolling layers</td></tr>
<tr><td>Risk</td><td>Recursion depth; memoizing a path-dependent value (see 3.2)</td><td>Boundary / index errors when reading row − 1</td></tr>
<tr><td>Recovering the route</td><td>Easy: follow the move that achieved each max</td><td>Needs parent pointers, or the full 3-D table</td></tr>
<tr><td>Ease of writing</td><td>Follows the recurrence directly; easiest to get right first</td><td>Needs more thought about order and bounds</td></tr>
</table>

<h3>6.2 Experimental results</h3>
<p>Both solutions were run on the same machine (Python {esc(R["python"])}), timed with <code>time.perf_counter</code>
(median of 3–5 runs) and measured with <code>tracemalloc</code> for peak extra memory. “Open” grids contain only cherries
(no thorns), which is the worst case because every state is reachable. “Random” grids have about 15% thorns and 50% cherries.
The script is <code>benchmark.py</code>.</p>
<div class="figs"><figure>{time_chart}</figure><figure>{mem_chart}</figure></div>
<table class="perf">
<tr><th rowspan="2">n</th><th rowspan="2">answer</th><th colspan="3">Top-down DFS + memo</th><th colspan="3">Bottom-up tabulation</th></tr>
<tr><th>dfs calls</th><th>time (ms)</th><th>peak mem (KB)</th><th>cells</th><th>time (ms)</th><th>peak mem (KB)</th></tr>
{perf_rows(perf_open)}
</table>
<p class="small">Table: open grids (worst case).</p>
<table class="perf">
<tr><th rowspan="2">n</th><th rowspan="2">answer</th><th colspan="3">Top-down DFS + memo</th><th colspan="3">Bottom-up tabulation</th></tr>
<tr><th>dfs calls</th><th>time (ms)</th><th>peak mem (KB)</th><th>cells</th><th>time (ms)</th><th>peak mem (KB)</th></tr>
{perf_rows(perf_rand)}
</table>
<p class="small">Table: random grids (≈ 15% thorns).</p>

<h3>6.3 Discussion</h3>
<ul>
<li><b>Both grow as n³.</b> From n = 25 to n = 50 (n doubles), the open-grid time grows by
{perf_open[-1]["top_down"]["time_ms"] / perf_open[4]["top_down"]["time_ms"]:.1f}× (top-down) and
{perf_open[-1]["bottom_up"]["time_ms"] / perf_open[4]["bottom_up"]["time_ms"]:.1f}× (bottom-up), close to the 2³ = 8× predicted
by Θ(n³).</li>
<li><b>Bottom-up is faster in practice</b>, about {speedup:.1f}× at n = 50 on the open grid. Both do Θ(n³) work, but a Python
function call plus a tuple-keyed dictionary lookup is much more expensive than indexing a list inside a loop.</li>
<li><b>Bottom-up uses far less memory</b>: {last["bottom_up"]["peak_kb"]:.0f} KB against {last["top_down"]["peak_kb"]:,.0f} KB at
n = 50, about {mem_ratio:.0f}× less. This matches Θ(n²) against Θ(n³). The memo dictionary also stores a tuple key per entry.</li>
<li><b>Top-down benefits from thorns.</b> On random grids, the top-down search only reaches states connected to the start, so
its gap to bottom-up shrinks. At n = 50 the ratio drops from {speedup:.1f}× to
{perf_rand[-1]["top_down"]["time_ms"] / perf_rand[-1]["bottom_up"]["time_ms"]:.1f}×. Bottom-up still evaluates every non-thorn pair
on each diagonal.</li>
<li><b>Both are fast enough.</b> With n ≤ 50 the worst case is about 83,000 states, so both solutions finish in well under a
second, far inside LeetCode’s time limit.</li>
</ul>

<h2>7. Testing and online-judge submission</h2>
<ul>
<li><b>Brute-force cross-check.</b> Both solutions were compared with an exhaustive search over every pair of paths on 3,000
random grids (n = 1 … 5, about 20% thorns). Result: {R["correctness"]["checks"]:,} checks and
<b>{R["correctness"]["mismatches"]} mismatches</b>.</li>
<li><b>LeetCode examples.</b> Example 1 → {R["examples"][0]["top_down"]} / {R["examples"][0]["bottom_up"]} (expected {R["examples"][0]["expected"]});
Example 2 → {R["examples"][1]["top_down"]} / {R["examples"][1]["bottom_up"]} (expected {R["examples"][1]["expected"]}).</li>
<li><b>Agreement.</b> On every benchmark grid (n up to 50) the two solutions returned the same answer.</li>
</ul>
<table>
<tr><th>LeetCode submission</th><th>Status</th><th>Runtime</th><th>Memory</th></tr>
<tr><td>Approach 1 — top-down DFS + memoization</td><td>{ph(lc["top_down"]["status"])}</td><td>{ph(lc["top_down"]["runtime"])}</td><td>{ph(lc["top_down"]["memory"])}</td></tr>
<tr><td>Approach 2 — bottom-up tabulation</td><td>{ph(lc["bottom_up"]["status"])}</td><td>{ph(lc["bottom_up"]["runtime"])}</td><td>{ph(lc["bottom_up"]["memory"])}</td></tr>
</table>
<p class="small">Screenshots of the accepted submissions are submitted as separate files.</p>

<h2>8. Visualization tool</h2>
<p>To explain both algorithms in the presentation, we built an interactive web application (Next.js / React).</p>
<ul>
<li><b>DFS + memoization page.</b> The recursion tree grows one call at a time. It highlights the current call, the calls waiting on
the stack, memo hits, base cases and dead ends, and shows each return as “max(gain + future, …)”. At the end it highlights the
best route in the tree and on the grid.</li>
<li><b>Bottom-up page.</b> Shows the <code>previous → current</code> layers, the four candidate cells for each entry, the formula
being evaluated, and the matching line of Python code. It has a <i>predict mode</i> in which the viewer fills in each cell
before it is revealed.</li>
</ul>

<h2>9. Conclusion</h2>
<p>Cherry Pickup looks like two separate path problems, but the trips interact through shared cherries, so greedy fails.
Modelling the round trip as two walkers moving together, and using the fact that a walker’s column is determined by the step
and its row, reduces the state to (step, row1, row2) and gives an O(n³) dynamic program. We implemented it both ways. The
top-down version maps directly onto the recurrence and only explores reachable states. The bottom-up version has the same
Θ(n³) time but a smaller constant factor, and it needs only Θ(n²) memory thanks to the rolling layers. In our measurements
it was about {speedup:.0f}× faster and used about {mem_ratio:.0f}× less memory at n = 50. We also learned that the value a memo
stores must depend only on the state. Otherwise memoization silently returns wrong answers.</p>

<h2>10. AI usage disclosure</h2>
<div class="box blue">
<p><b>Tool used.</b> Claude Code, Anthropic’s AI coding assistant (model: Claude Opus 5.5), used in the terminal inside our
project folder.</p>
<p><b>How it assisted us.</b></p>
<ul>
<li>Explained how to run our visualization project and explained the DFS + memoization technique used in it.</li>
<li>Found the memoization bug in our original top-down code (<code>Cherry_DFS.py</code>) and in the visualization, and
wrote the corrected top-down solution (<code>cherry_pickup_dfs_memo.py</code>).</li>
<li>Wrapped our bottom-up solution in the LeetCode <code>Solution</code> class format with a local test driver
(<code>cherry_pickup_bottom_up.py</code>). The algorithm itself is unchanged.</li>
<li>Built the interactive pages of the visualization tool: the bottom-up table page, the step-by-step recursion tree, and
route highlighting.</li>
<li>Wrote the benchmark / brute-force testing script (<code>benchmark.py</code>) and drafted this report, including the
complexity analysis and the comparison of the two approaches.</li>
</ul>
<p><b>What we did ourselves.</b> {ph("[Describe your own contributions, e.g. choosing the problem, writing the original DFS and bottom-up code, designing the visualization, reviewing and editing the report, submitting to LeetCode, preparing the presentation.]")}</p>
<p><b>Responsibility.</b> We have reviewed, tested and understood all code and text in this submission, including every part
produced with AI assistance, and we take full responsibility for the final output.</p>
<p>Signed: {team_line}</p>
</div>

<h2>References</h2>
<ol>
<li>LeetCode, “741. Cherry Pickup”. https://leetcode.com/problems/cherry-pickup/</li>
<li>T. H. Cormen, C. E. Leiserson, R. L. Rivest, C. Stein. <i>Introduction to Algorithms</i>, 4th ed., MIT Press, 2022 — Chapter 14, Dynamic Programming.</li>
<li>J. Kleinberg, É. Tardos. <i>Algorithm Design</i>, Pearson, 2006 — Chapter 6, Dynamic Programming.</li>
</ol>

<h2 class="page-break">Appendix A — cherry_pickup_dfs_memo.py</h2>
<pre class="code">{code_td}</pre>
<h2 class="page-break">Appendix B — cherry_pickup_bottom_up.py</h2>
<pre class="code">{code_bu}</pre>
</body></html>"""

    out_html = HERE / "report.html"
    out_pdf = HERE / "Cherry_Pickup_Report.pdf"
    out_html.write_text(doc, encoding="utf-8")
    subprocess.run(
        [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={out_pdf}",
            out_html.as_uri(),
        ],
        check=True,
        capture_output=True,
    )
    print("wrote", out_pdf)


if __name__ == "__main__":
    main()
