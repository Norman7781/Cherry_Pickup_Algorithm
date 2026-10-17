const comparisons = [
  ["Value stored", "Best future: cherries still collectable after this state. The start cell is added separately.", "Best so far: cherries collected up to and including this state."],
  ["Evaluation order", "Explore from the start towards the finish; return values back through recursive calls.", "Build from step 0 to step 2n − 2, using the previous layer."],
  ["States visited", "Only states reachable from the start without crossing thorns.", "Inspect every non-thorn pair on each diagonal, including unreachable pairs."],
  ["Worst-case time", "Θ(n³): up to four next moves per state, with function-call and dictionary overhead.", "Θ(n³): up to four predecessors per entry, using list indexing and loops."],
  ["Algorithm space", "Θ(n³) memo entries plus Θ(n) recursion depth.", "Θ(n²) with two rolling n × n tables."],
  ["Recovering a route", "Save the best move for each state and follow those choices.", "Save parent pointers or retain all layers; this adds storage beyond the rolling tables."],
  ["Implementation pitfalls", "Memoize a value that depends only on the state. A total tied to the route taken is unsafe to cache.", "Check row − 1 bounds before indexing, and leave unreachable entries at −∞."],
  ["When it helps", "Useful for understanding the recurrence and avoiding states disconnected from the start.", "Useful for predictable iteration, lower memory use, and avoiding recursion."],
];

export default function MethodComparison() {
  return (
    <section className="panel method-comparison" aria-labelledby="method-comparison-title">
      <span className="section-kicker">COMPARE / TWO DP METHODS</span>
      <h2 id="method-comparison-title">Same problem, two ways to solve it</h2>
      <p>
        Both methods plan the two trips together as walkers A and B. They use
        the state (step, row₁, row₂), with column = step − row, and count a
        shared cherry once. They produce the same maximum; the meaning of each
        saved value and the order of calculation differ.
      </p>
      <div className="comparison-scroll" tabIndex={0} role="region" aria-label="Method comparison table">
        <table>
          <thead><tr><th scope="col">Aspect</th><th scope="col">Top-down DFS + memoization</th><th scope="col">Bottom-up tabulation</th></tr></thead>
          <tbody>{comparisons.map(([aspect, dfs, table]) => (
            <tr key={aspect}><th scope="row">{aspect}</th><td>{dfs}</td><td>{table}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <h3>Recorded benchmark · 50 × 50 grids</h3>
      <p>
        The submission report measured Python 3.14.6 implementations on the
        same machine: median of 3–5 runs with time.perf_counter, and peak extra
        memory with tracemalloc. These are recorded results, rather than timings
        of the browser visualization.
      </p>
      <div className="comparison-scroll" tabIndex={0} role="region" aria-label="Recorded benchmark results">
        <table>
          <thead><tr><th scope="col">Grid</th><th scope="col">Same answer</th><th scope="col">DFS time / memory</th><th scope="col">Tabulation time / memory</th></tr></thead>
          <tbody>
            <tr><th scope="row">Open · all cherries</th><td>196</td><td>115.65 ms / 8,423.7 KB</td><td>18.23 ms / 41.2 KB</td></tr>
            <tr><th scope="row">Random · ≈15% thorns</th><td>156</td><td>41.45 ms / 4,305.7 KB</td><td>14.04 ms / 41.2 KB</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        On the open grid, tabulation was about <b>6.3× faster</b> and used about
        <b> 204× less memory</b>. Thorns reduced the states reached by DFS,
        narrowing the speed gap to about 3× on the random grid. These ratios
        describe the report’s measurements and can vary with the input and machine.
      </p>
      <p>
        <b>Correctness:</b> the report records 6,000 checks against exhaustive
        path-pair search on 3,000 random grids of sizes 1–5, with zero mismatches.
        Both methods also agreed on every benchmark grid up to size 50.
      </p>
      <p className="tb-trace-stage">
        Source: submission report, sections 5–7, and benchmark_results.json.
        Space bounds above describe the solver algorithms; this teaching app
        retains extra history, routes, and trace events for display.
      </p>
    </section>
  );
}
