"use client";

import { useState } from "react";
import results from "./data/test-case-results.json";

const METRICS = {
  time: { title: "Execution time as grid size increases", description: "Milliseconds · lower points mean faster runs", unit: "ms", axis: "Time (ms)", label: "Execution time" },
  space: { title: "Peak memory used by each method", description: "KiB of auxiliary Python allocations · lower points mean less memory", unit: "KiB", axis: "Peak memory (KiB)", label: "Space complexity" },
  cherries: { title: "Maximum cherries across the test cases", description: "Cherries · the two lines overlap because answers match", unit: "cherries", axis: "Cherries", label: "Cherries collected" },
};

export default function TestRunComparison() {
  const [selected, setSelected] = useState("large.txt");
  const [metric, setMetric] = useState<keyof typeof METRICS>("time");
  const current = results.cases.find((item) => item.file === selected)!;
  const category = METRICS[metric];
  const value = (run: { seconds: number; answer: number; peakKiB: number }) => {
    if (metric === "time") return run.seconds * 1000;
    if (metric === "space") return run.peakKiB;
    return run.answer;
  };
  const maximum = Math.max(1, ...results.cases.flatMap((item) => [value(item.dfs), value(item.dp)])) * 1.1;
  const chartX = (index: number) => 68 + index / (results.cases.length - 1) * 800;
  const chartY = (number: number) => 310 - number / maximum * 275;
  const format = (number: number) => metric === "cherries" ? String(number) : number.toFixed(metric === "space" ? 2 : 3);
  return (
    <section className="panel method-comparison" aria-labelledby="test-runs-title">
      <span className="section-kicker">TEST CASES / ACTUAL PYTHON OUTPUT</span>
      <h2 id="test-runs-title">Run the same input through both versions</h2>
      <p>These results use your current <code>Cherry_DFS.py</code> and <code>Cherry_DP.py</code> with {results.cases.length} files in <code>test_cases</code>. Inputs cover sizes 1–50, empty gardens, blocked routes, shared paths, and open grids. Both corrected versions return the same maximum cherry count on every case.</p>
      <div className="run-chart-controls" role="group" aria-label="Graph measurement">
        {(Object.keys(METRICS) as (keyof typeof METRICS)[]).map((key) => <button type="button" key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>{METRICS[key].label}</button>)}
      </div>
      <figure className="run-chart" aria-labelledby="run-chart-title">
        <figcaption id="run-chart-title"><b>{category.title}</b><span>{category.description}</span></figcaption>
        <div className="run-chart-legend"><span><i className="run-swatch-dfs" /> DFS + memoization</span><span><i className="run-swatch-dp" /> Bottom-up DP</span><span className="test-run-pass">✓ {results.cases.length} / {results.cases.length} answers match</span></div>
        <svg className="run-line-chart" viewBox="0 0 900 445" role="group" aria-label={`${category.title} in ${category.unit} by test case, ordered by grid size. Select a point for its console output.`}>
          {[0, 1, 2, 3, 4].map((tick) => {
            const amount = maximum * tick / 4;
            const y = chartY(amount);
            return <g key={tick}><line x1="68" x2="868" y1={y} y2={y} className="run-line-grid" /><text x="57" y={y + 4} textAnchor="end" className="run-line-tick">{metric === "cherries" ? Math.round(amount) : amount.toFixed(1)}</text></g>;
          })}
          <text x="68" y="18" className="run-line-unit">{category.axis}</text>
          <line x1="68" x2="868" y1="310" y2="310" className="run-line-baseline" />
          <line x1={chartX(results.cases.findIndex((item) => item.file === selected))} x2={chartX(results.cases.findIndex((item) => item.file === selected))} y1="30" y2="310" className="run-line-selection" />
          {(["dfs", "dp"] as const).map((method) => <polyline key={method} className={`run-series run-series-${method}`} points={results.cases.map((item, index) => `${chartX(index)},${chartY(value(item[method]))}`).join(" ")} />)}
          {results.cases.map((item, index) => <g key={item.file} role="button" tabIndex={0} aria-pressed={item.file === selected}
            className="run-line-point" onClick={() => setSelected(item.file)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(item.file); } }}
            aria-label={`${item.file}, ${item.size} by ${item.size}, DFS ${format(value(item.dfs))}, DP ${format(value(item.dp))} ${category.unit}. Show console outputs.`}>
            <title>{`${item.file} (${item.size} × ${item.size}) · DFS: ${format(value(item.dfs))} · DP: ${format(value(item.dp))}`}</title>
            <circle cx={chartX(index)} cy={chartY(value(item.dfs))} r="7" className="run-point-dfs" />
            <circle cx={chartX(index)} cy={chartY(value(item.dp))} r="4" className="run-point-dp" />
            <text transform={`translate(${chartX(index)}, 330) rotate(50)`} className="run-line-tick">{item.file}</text>
            <text x={chartX(index)} y="412" textAnchor="middle" className="run-line-tick">{item.size}</text>
          </g>)}
          <text x="468" y="438" textAnchor="middle" className="run-line-unit">Test cases ordered by grid size (n)</text>
        </svg>
        <p className="run-line-note">Each point is one input file. Cases with the same grid size can have different cherries and thorns; connecting lines help compare these recorded runs.</p>
      </figure>
      <div className="run-case-summary" aria-live="polite">
        <b>{current.file} · {current.size} × {current.size}</b><span>DFS: {format(value(current.dfs))} {category.unit}</span><span>DP: {format(value(current.dp))} {category.unit}</span><span className="test-run-pass">✓ Both return {current.dp.answer} cherries</span>
      </div>
      {metric === "space" && <div className="run-space-explanation">
        <p><b>DFS + memoization: O(n³) space</b> for saved states, plus O(n) recursion depth. <b>Bottom-up DP: O(n²) space</b> for two rolling tables.</p>
        <p>The graph shows measured peak memory, while Big O describes how space grows in the worst case. Thorns and unreachable states can reduce the memory used on an individual input. Input grid storage and interpreter memory are excluded.</p>
      </div>}
      <label className="run-case-picker">View test case <select value={selected} onChange={(event) => setSelected(event.target.value)}>{results.cases.map((item) => <option key={item.file} value={item.file}>{item.file} · {item.size} × {item.size}</option>)}</select></label>
      <p>Click a point or choose a test case to see its console outputs. <a href={`/test-cases/${current.file}`} download>Download {current.file}</a> to run it yourself.</p>
      <div className="test-run-terminals">
        {([
          ["Version 1 · DFS + memoization", "Cherry_DFS.py", current.dfs],
          ["Version 2 · bottom-up DP", "Cherry_DP.py", current.dp],
        ] as const).map(([label, script, run]) => <div className="test-run-terminal" key={script}>
          <h3>{label}</h3>
          <pre><code><span className="test-run-command">{`$ python3 ${script} < test_cases/${current.file}\n`}</span>{run.output}</code></pre>
        </div>)}
      </div>
      <p><b>How to read the output:</b> the first number is the maximum cherries, not the time. For <code>{current.file}</code>, both versions return <b>{current.dp.answer}</b>. DFS’s <code>state count</code> counts recursive calls, including memo hits. <code>time taken</code> measures the solver’s execution time in seconds.</p>
      <p className="tb-trace-stage">Recorded {results.recordedAt.slice(0, 10)} with Python {results.python}. Timings are the median of {results.runs} runs per method and input, excluding interpreter startup. Memory is the median peak from {results.memoryRuns} separate runs measured with tracemalloc, excluding the input grid and imports. Timing runs have tracing disabled. These are saved measurements; your timings may differ. The report’s older benchmarks appear below.</p>
      <details className="test-run-refresh"><summary>Refresh the recorded outputs</summary><p>From the demo folder, run:</p><pre><code>python3 scripts/record-python-comparison.py</code></pre><p>This reruns the Python files in the parent term_project folder and updates the saved results and downloadable inputs.</p></details>
    </section>
  );
}
