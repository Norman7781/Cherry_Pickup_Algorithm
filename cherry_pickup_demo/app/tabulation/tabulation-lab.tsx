"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PRESETS, type Grid } from "../presets";

type Table = number[][];
type Kind =
  "init" | "layer" | "skip1" | "skip2" | "unreachable" | "fill" | "done";
type Candidate = {
  label: string;
  row1: number;
  row2: number;
  value: number;
};
type TableEvent = {
  kind: Kind;
  step: number;
  row1: number;
  row2: number;
  minRow: number;
  maxRow: number;
  prev: Table | null;
  cur: Table;
  candidates: Candidate[];
  best: number;
  gain: number;
  value: number;
};
type Answer = { guess: string; correct: boolean };
type Parent = [number, number] | null;

const NEG = Number.NEGATIVE_INFINITY;
const MIN_SIZE = 2;
const MAX_SIZE = 8;
const SPEEDS = { slow: 1100, normal: 650, fast: 280 } as const;

// Condensed version of the bottom-up solution. Each line is tagged with the
// event kinds that execute it, so the current line can be highlighted.
const CODE: [Kind[], string][] = [
  [[], "def cherry_pickup(grid):"],
  [[], "    n = len(grid)"],
  [["init"], "    previous = [[-inf] * n for _ in range(n)]"],
  [["init"], "    previous[0][0] = grid[0][0]"],
  [["layer"], "    for step in range(1, 2 * n - 1):"],
  [["layer"], "        current = [[-inf] * n for _ in range(n)]"],
  [["layer"], "        lo, hi = max(0, step - (n - 1)), min(n - 1, step)"],
  [["skip1"], "        for row1 in range(lo, hi + 1):"],
  [["skip1"], "            if grid[row1][step - row1] == -1: continue"],
  [["skip2"], "            for row2 in range(lo, hi + 1):"],
  [["skip2"], "                if grid[row2][step - row2] == -1: continue"],
  [["fill", "unreachable"], "                best = max(previous[row1][row2],"],
  [
    ["fill", "unreachable"],
    "                           previous[row1 - 1][row2],",
  ],
  [
    ["fill", "unreachable"],
    "                           previous[row1][row2 - 1],",
  ],
  [
    ["fill", "unreachable"],
    "                           previous[row1 - 1][row2 - 1])",
  ],
  [["unreachable"], "                if best == -inf: continue"],
  [["fill"], "                gain = grid[row1][step - row1]"],
  [
    ["fill"],
    "                if row1 != row2: gain += grid[row2][step - row2]",
  ],
  [["fill"], "                current[row1][row2] = best + gain"],
  [["layer"], "        previous = current"],
  [["done"], "    return max(0, previous[n - 1][n - 1])"],
];

const KIND_LABEL: Record<Kind, string> = {
  init: "start",
  layer: "new layer",
  skip1: "thorn · A",
  skip2: "thorn · B",
  unreachable: "unreachable",
  fill: "fill cell",
  done: "finished",
};

function fmt(value: number) {
  return value === NEG ? "−∞" : String(value);
}

function emptyTable(n: number): Table {
  return Array.from({ length: n }, () => Array<number>(n).fill(NEG));
}

function copy(table: Table): Table {
  return table.map((row) => [...row]);
}

function emptyParents(n: number): Parent[][] {
  return Array.from({ length: n }, () => Array<Parent>(n).fill(null));
}

// Follow parent pointers from (step, row1, row2) back to the start and return
// the cells each walker passed through, as "row,col" keys.
function traceRoute(
  parents: Parent[][][],
  step: number,
  row1: number,
  row2: number,
) {
  const a = new Set<string>();
  const b = new Set<string>();
  let r1 = row1;
  let r2 = row2;
  for (let s = step; s >= 0; s -= 1) {
    a.add(`${r1},${s - r1}`);
    b.add(`${r2},${s - r2}`);
    if (s === 0) break;
    const from = parents[s][r1][r2];
    if (!from) break;
    [r1, r2] = from;
  }
  return { a, b };
}

function rowRange(step: number, n: number) {
  return { minRow: Math.max(0, step - (n - 1)), maxRow: Math.min(n - 1, step) };
}

function buildTabulation(grid: Grid) {
  const n = grid.length;
  const events: TableEvent[] = [];
  const layers: Table[] = [];
  // parents[step][row1][row2] = the previous (row1, row2) that gave the best value.
  const parents: Parent[][][] = [emptyParents(n)];
  const base = {
    candidates: [] as Candidate[],
    best: NEG,
    gain: 0,
    value: NEG,
  };

  let previous = emptyTable(n);
  previous[0][0] = grid[0][0];
  layers.push(copy(previous));
  events.push({
    ...base,
    kind: "init",
    step: 0,
    row1: 0,
    row2: 0,
    minRow: 0,
    maxRow: 0,
    prev: null,
    cur: copy(previous),
    value: grid[0][0],
  });

  for (let step = 1; step < 2 * n - 1; step += 1) {
    const current = emptyTable(n);
    const parent = emptyParents(n);
    parents.push(parent);
    const { minRow, maxRow } = rowRange(step, n);
    const shared = { step, minRow, maxRow, prev: previous };
    events.push({
      ...base,
      ...shared,
      kind: "layer",
      row1: -1,
      row2: -1,
      cur: copy(current),
    });

    for (let row1 = minRow; row1 <= maxRow; row1 += 1) {
      if (grid[row1][step - row1] === -1) {
        events.push({
          ...base,
          ...shared,
          kind: "skip1",
          row1,
          row2: -1,
          cur: copy(current),
        });
        continue;
      }
      for (let row2 = minRow; row2 <= maxRow; row2 += 1) {
        if (grid[row2][step - row2] === -1) {
          events.push({
            ...base,
            ...shared,
            kind: "skip2",
            row1,
            row2,
            cur: copy(current),
          });
          continue;
        }

        const candidates: Candidate[] = [
          { label: "A → , B →", row1, row2, value: previous[row1][row2] },
        ];
        if (row1 > 0) {
          candidates.push({
            label: "A ↓ , B →",
            row1: row1 - 1,
            row2,
            value: previous[row1 - 1][row2],
          });
        }
        if (row2 > 0) {
          candidates.push({
            label: "A → , B ↓",
            row1,
            row2: row2 - 1,
            value: previous[row1][row2 - 1],
          });
        }
        if (row1 > 0 && row2 > 0) {
          candidates.push({
            label: "A ↓ , B ↓",
            row1: row1 - 1,
            row2: row2 - 1,
            value: previous[row1 - 1][row2 - 1],
          });
        }
        const best = Math.max(...candidates.map((c) => c.value));
        const gain =
          grid[row1][step - row1] +
          (row1 === row2 ? 0 : grid[row2][step - row2]);

        if (best === NEG) {
          events.push({
            ...shared,
            kind: "unreachable",
            row1,
            row2,
            cur: copy(current),
            candidates,
            best,
            gain,
            value: NEG,
          });
          continue;
        }

        current[row1][row2] = best + gain;
        const from = candidates.find((c) => c.value === best)!;
        parent[row1][row2] = [from.row1, from.row2];
        events.push({
          ...shared,
          kind: "fill",
          row1,
          row2,
          cur: copy(current),
          candidates,
          best,
          gain,
          value: best + gain,
        });
      }
    }
    layers.push(copy(current));
    previous = current;
  }

  const last = n - 1;
  const answer = Math.max(0, previous[last][last]);
  events.push({
    ...base,
    kind: "done",
    step: 2 * last,
    row1: last,
    row2: last,
    minRow: last,
    maxRow: last,
    prev: null,
    cur: copy(previous),
    value: answer,
  });
  return { events, layers, parents, answer };
}

// Whether the loop has already reached (row1, row2) in the current layer.
function visited(event: TableEvent, row1: number, row2: number) {
  switch (event.kind) {
    case "init":
    case "done":
      return true;
    case "layer":
      return false;
    case "skip1":
      return row1 <= event.row1;
    default:
      return row1 < event.row1 || (row1 === event.row1 && row2 <= event.row2);
  }
}

function describe(event: TableEvent, grid: Grid) {
  const n = grid.length;
  const colA = event.step - event.row1;
  const colB = event.step - event.row2;
  switch (event.kind) {
    case "init":
      return {
        title: `Step 0 · previous[0][0] = grid[0][0] = ${event.value}`,
        body: "Both walkers start on the top-left cell. Every other pair of rows is still −∞, meaning “impossible”.",
      };
    case "layer":
      return {
        title: `Step ${event.step} · start a new layer`,
        body: `After ${event.step} moves a walker satisfies row + col = ${event.step}, so only rows ${event.minRow}…${event.maxRow} are possible. The finished layer becomes “previous”.`,
      };
    case "skip1":
      return {
        title: `Walker A hits a thorn at (${event.row1}, ${colA})`,
        body: `Every current[${event.row1}][·] stays −∞: walker A can never stand there, whatever walker B does.`,
      };
    case "skip2":
      return {
        title: `Walker B hits a thorn at (${event.row2}, ${colB})`,
        body: `current[${event.row1}][${event.row2}] stays −∞.`,
      };
    case "unreachable":
      return {
        title: `current[${event.row1}][${event.row2}] stays −∞`,
        body: "All the previous states that could lead here are −∞, so no pair of paths reaches this pair of cells.",
      };
    case "fill":
      return {
        title: `current[${event.row1}][${event.row2}] = ${event.best} + ${event.gain} = ${event.value}`,
        body:
          event.row1 === event.row2
            ? "Both walkers stand on the same cell, so its cherry is counted only once."
            : "Take the best of the previous states that can move here, then add both walkers’ cells.",
      };
    case "done":
      return {
        title: `Answer = max(0, previous[${n - 1}][${n - 1}]) = ${event.value}`,
        body: "Both walkers reached the bottom-right corner. The last layer’s corner value is the most cherries two paths can collect.",
      };
  }
}

function needsAnswer(event: TableEvent) {
  return event.kind === "fill" || event.kind === "unreachable";
}

function DpTable({
  table,
  n,
  step,
  event,
  mode,
  hidden,
  revealBest = true,
}: {
  table: Table;
  n: number;
  step: number;
  event: TableEvent;
  mode: "current" | "previous" | "mini";
  hidden?: boolean;
  revealBest?: boolean;
}) {
  const { minRow, maxRow } = rowRange(step, n);
  const candidate = (r1: number, r2: number) =>
    mode === "previous" &&
    event.candidates.find((c) => c.row1 === r1 && c.row2 === r2);
  const cells = [];
  if (mode !== "mini") {
    cells.push(
      <span className="tb-axis tb-corner" key="corner">
        r₁╲r₂
      </span>,
    );
    for (let c = 0; c < n; c += 1) {
      cells.push(
        <span className="tb-axis" key={`h${c}`}>
          {c}
        </span>,
      );
    }
  }
  for (let r1 = 0; r1 < n; r1 += 1) {
    if (mode !== "mini") {
      cells.push(
        <span className="tb-axis" key={`r${r1}`}>
          {r1}
        </span>,
      );
    }
    for (let r2 = 0; r2 < n; r2 += 1) {
      const onDiagonal =
        r1 >= minRow && r1 <= maxRow && r2 >= minRow && r2 <= maxRow;
      const seen = mode !== "current" || visited(event, r1, r2);
      const isCurrent =
        mode === "current" &&
        needsAnswer(event) &&
        event.row1 === r1 &&
        event.row2 === r2;
      const cand = candidate(r1, r2);
      const isBest =
        revealBest && cand && cand.value !== NEG && cand.value === event.best;
      const value = table[r1][r2];
      let text = "";
      if (onDiagonal && seen) text = fmt(value);
      if (isCurrent && hidden) text = "?";
      if (mode === "mini" && value === NEG) text = "";
      const className = [
        "tb-cell",
        !onDiagonal && "tb-off",
        onDiagonal && seen && value === NEG && "tb-neg",
        onDiagonal && seen && value !== NEG && "tb-val",
        isCurrent && "tb-current",
        cand && "tb-cand",
        isBest && "tb-best",
      ]
        .filter(Boolean)
        .join(" ");
      cells.push(
        <span
          className={className}
          key={`${r1}-${r2}`}
          title={cand ? cand.label : undefined}
        >
          {text}
        </span>,
      );
    }
  }
  const columns = mode === "mini" ? n : n + 1;
  return (
    <div
      className={`tb-table tb-table-${mode}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {cells}
    </div>
  );
}

export default function TabulationLab() {
  const [preset, setPreset] = useState("classic 5 × 5");
  const [grid, setGrid] = useState<Grid>(() =>
    PRESETS["classic 5 × 5"].map((row) => [...row]),
  );
  const [editing, setEditing] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>("normal");
  const [quiz, setQuiz] = useState(false);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [guess, setGuess] = useState("");
  const [showHint, setShowHint] = useState(false);

  const trace = useMemo(() => buildTabulation(grid), [grid]);
  const n = grid.length;
  const lastIndex = trace.events.length - 1;
  const event = trace.events[Math.min(cursor, lastIndex)];
  const info = describe(event, grid);
  const answered = answers.get(cursor);
  const locked = quiz && needsAnswer(event) && !answered;
  const highlight = new Set<Kind>([event.kind]);
  const stepStart = useMemo(() => {
    const starts = new Map<number, number>();
    trace.events.forEach((e, index) => {
      if (!starts.has(e.step)) starts.set(e.step, index);
    });
    return starts;
  }, [trace.events]);

  const score = useMemo(() => {
    let correct = 0;
    let streak = 0;
    let bestStreak = 0;
    [...answers.entries()]
      .sort(([a], [b]) => a - b)
      .forEach(([, answer]) => {
        if (answer.correct) {
          correct += 1;
          streak += 1;
          bestStreak = Math.max(bestStreak, streak);
        } else {
          streak = 0;
        }
      });
    return { correct, total: answers.size, streak, bestStreak };
  }, [answers]);

  const restart = (nextGrid: Grid) => {
    setGrid(nextGrid);
    setCursor(0);
    setPlaying(false);
    setAnswers(new Map());
    setGuess("");
    setShowHint(false);
  };
  const goTo = (index: number) => {
    setCursor(Math.max(0, Math.min(index, lastIndex)));
    setGuess("");
    setShowHint(false);
  };
  const next = () => {
    if (locked || cursor >= lastIndex) return;
    goTo(cursor + 1);
  };

  // Auto-play stops on cells the player still has to predict.
  const running = playing && !locked && cursor < lastIndex;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      const nextIndex = cursor + 1;
      setCursor(nextIndex);
      setGuess("");
      setShowHint(false);
      if (
        nextIndex >= lastIndex ||
        (quiz && needsAnswer(trace.events[nextIndex]))
      ) {
        setPlaying(false);
      }
    }, SPEEDS[speed]);
    return () => window.clearTimeout(timer);
  }, [running, quiz, cursor, lastIndex, speed, trace.events]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        goTo(cursor - 1);
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = (raw: string) => {
    const text = raw.trim().toLowerCase();
    if (!text) return;
    const isNeg = ["-inf", "−∞", "-∞", "inf", "∞"].includes(text);
    const number = Number(text);
    if (!isNeg && !Number.isFinite(number)) return;
    const value = isNeg ? NEG : number;
    setAnswers((prev) =>
      new Map(prev).set(cursor, {
        guess: isNeg ? "−∞" : String(number),
        correct: value === event.value,
      }),
    );
    setGuess("");
  };

  const changePreset = (value: string) => {
    setPreset(value);
    if (value === "custom input") {
      setEditing(true);
      return;
    }
    setEditing(false);
    restart(PRESETS[value].map((row) => [...row]));
  };
  const editCell = (row: number, col: number) => {
    const isEndpoint =
      (row === 0 && col === 0) || (row === n - 1 && col === n - 1);
    const current = grid[row][col];
    let nextValue = current === 0 ? 1 : current === 1 ? -1 : 0;
    if (isEndpoint && nextValue === -1) nextValue = 0;
    setPreset("custom input");
    restart(
      grid.map((line, r) =>
        line.map((value, c) => (r === row && c === col ? nextValue : value)),
      ),
    );
  };
  const resize = (size: number) => {
    setPreset("custom input");
    restart(
      Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) =>
          (r === 0 && c === 0) || (r === size - 1 && c === size - 1)
            ? Math.max(0, grid[r]?.[c] ?? 0)
            : (grid[r]?.[c] ?? 0),
        ),
      ),
    );
  };

  const walkerA =
    event.kind === "layer"
      ? null
      : { row: event.row1, col: event.step - event.row1 };
  const walkerB =
    event.kind === "layer" || event.kind === "skip1"
      ? null
      : { row: event.row2, col: event.step - event.row2 };
  const hideValue = locked;
  // Routes are only known once the cell has a value; in predict mode they
  // stay hidden until the player answers, since they give the answer away.
  const routeTarget =
    event.kind === "fill" || event.kind === "init"
      ? event
      : event.kind === "done" && trace.answer > 0
        ? event
        : null;
  const route =
    routeTarget && !hideValue
      ? traceRoute(
          trace.parents,
          routeTarget.step,
          routeTarget.row1,
          routeTarget.row2,
        )
      : null;
  const filled = trace.events
    .slice(0, cursor + 1)
    .filter((e) => e.kind === "fill").length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">↘</span>
          <span>algorithm lab</span>
        </div>
        <div className="topbar-note">
          <Link className="page-link" href="/">
            ↖ dfs + memoization
          </Link>
          <span className="slash">/</span>
          <span className="live-dot" /> bottom-up table
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">Problem 741 · bottom-up tabulation</p>
          <h1>
            Fill the table, <em>layer by layer.</em>
          </h1>
          <p className="lede">
            No recursion here. Each step builds a new table{" "}
            <code>current[row₁][row₂]</code> from the one before it. Turn on{" "}
            <b>predict mode</b> and fill each cell yourself before it is
            revealed.
          </p>
        </div>
        <div className="complexity">
          <span>table entry</span>
          <strong>current[row₁][row₂]</strong>
          <small>O(n³) time · O(n²) space</small>
        </div>
      </section>

      <section className="control-strip">
        <label className="select-wrap">
          <span>SCENARIO</span>
          <select value={preset} onChange={(e) => changePreset(e.target.value)}>
            <option value="custom input">custom input</option>
            {Object.keys(PRESETS).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <button
          className={`edit-grid-button ${editing ? "selected" : ""}`}
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? "done editing" : "edit grid"} <span>↗</span>
        </button>
        <button
          className={`edit-grid-button ${quiz ? "selected" : ""}`}
          onClick={() => {
            setQuiz((value) => !value);
            setPlaying(false);
          }}
          aria-pressed={quiz}
        >
          predict mode {quiz ? "on" : "off"} <span>★</span>
        </button>
        <div className="transport">
          <button
            className="icon-button"
            onClick={() => restart(grid)}
            aria-label="Restart"
            title="Restart"
          >
            ↺
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setPlaying(false);
              goTo(cursor - 1);
            }}
            disabled={cursor === 0}
            aria-label="Previous step"
            title="Previous step (←)"
          >
            ◁
          </button>
          <button
            className="play-button"
            onClick={() => setPlaying((value) => !value)}
            disabled={locked || cursor >= lastIndex}
          >
            {running ? "Ⅱ pause" : "▶ play"}
          </button>
          <button
            className="icon-button step-button"
            onClick={() => {
              setPlaying(false);
              next();
            }}
            disabled={locked || cursor >= lastIndex}
            aria-label="Next step"
            title="Next step (→)"
          >
            ▷|
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setPlaying(false);
              goTo(lastIndex);
            }}
            disabled={quiz}
            aria-label="Jump to end"
            title={quiz ? "Turn off predict mode to skip ahead" : "Jump to end"}
          >
            ↠
          </button>
        </div>
        <label className="select-wrap tb-speed">
          <span>SPEED</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(e.target.value as keyof typeof SPEEDS)}
          >
            {Object.keys(SPEEDS).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <div className="progress-wrap">
          <div className="progress-label">
            <span>PROGRESS</span>
            <b>
              {String(cursor + 1).padStart(3, "0")} /{" "}
              {String(trace.events.length).padStart(3, "0")}
            </b>
          </div>
          <input
            type="range"
            min="0"
            max={lastIndex}
            value={cursor}
            disabled={quiz}
            onChange={(e) => {
              setPlaying(false);
              goTo(Number(e.target.value));
            }}
          />
        </div>
      </section>

      <section className="workspace tb-workspace">
        <div className="board-panel panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">01 / GRID</span>
              <h2>Where the walkers stand</h2>
            </div>
            <div className="legend">
              <span>
                <i className="legend-dot walker-one" /> walker A · row₁
              </span>
              <span>
                <i className="legend-dot walker-two" /> walker B · row₂
              </span>
            </div>
          </div>
          {editing && (
            <div className="tb-edit-bar">
              <span>Click a cell: empty → 🍒 → 🚫</span>
              <label>
                size
                <select
                  value={n}
                  onChange={(e) => resize(Number(e.target.value))}
                >
                  {Array.from(
                    { length: MAX_SIZE - MIN_SIZE + 1 },
                    (_, i) => i + MIN_SIZE,
                  ).map((size) => (
                    <option key={size} value={size}>
                      {size} × {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div
            className={`board ${editing ? "tb-editing" : ""}`}
            style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
          >
            {grid.flatMap((row, r) =>
              row.map((value, c) => {
                const one = walkerA?.row === r && walkerA.col === c;
                const two = walkerB?.row === r && walkerB.col === c;
                const onStep = !editing && r + c === event.step;
                const inA = !editing && route?.a.has(`${r},${c}`);
                const inB = !editing && route?.b.has(`${r},${c}`);
                const className = [
                  "cell",
                  value === -1 && "blocked",
                  (one || two) && "occupied",
                  onStep && "tb-diag",
                  inA && inB
                    ? "tb-route-both"
                    : inA
                      ? "tb-route-a"
                      : inB && "tb-route-b",
                ]
                  .filter(Boolean)
                  .join(" ");
                const content = (
                  <>
                    <span
                      className={`cell-value ${value === 1 ? "cherry-token" : ""}`}
                    >
                      {value === 1 ? "🍒" : value === -1 ? "🚫" : ""}
                    </span>
                    {one && <span className="walker walker-a">A</span>}
                    {two && <span className="walker walker-b">B</span>}
                    <span className="tb-coord">
                      {r},{c}
                    </span>
                  </>
                );
                return editing ? (
                  <button
                    className={className}
                    key={`${r}-${c}`}
                    onClick={() => editCell(r, c)}
                    aria-label={`row ${r}, column ${c}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={className} key={`${r}-${c}`}>
                    {content}
                  </div>
                );
              }),
            )}
          </div>
          <div className="tb-route-legend">
            <span>{event.kind === "done" ? "best route" : "route so far"}</span>
            <span>
              <i className="tb-swatch tb-route-a" /> A
            </span>
            <span>
              <i className="tb-swatch tb-route-b" /> B
            </span>
            <span>
              <i className="tb-swatch tb-route-both" /> both
            </span>
            {!route && (
              <small>
                {hideValue
                  ? "shown after you answer"
                  : "shown when a cell is filled"}
              </small>
            )}
          </div>
          <div className="board-footer">
            <span>
              <b>step</b> {event.step} / {2 * (n - 1)}
            </span>
            <span>
              <b>diagonal</b> row + col = {event.step}
            </span>
          </div>
        </div>

        <div className="trace-panel panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">02 / THE TABLES</span>
              <h2>previous → current</h2>
            </div>
            <span className={`event-tag tb-tag-${event.kind}`}>
              {KIND_LABEL[event.kind]}
            </span>
          </div>

          <div className="tb-pair">
            <div>
              <p className="tb-table-label">
                previous · step {Math.max(event.step - 1, 0)}
              </p>
              {event.prev ? (
                <DpTable
                  table={event.prev}
                  n={n}
                  step={event.step - 1}
                  event={event}
                  mode="previous"
                  revealBest={!hideValue || showHint}
                />
              ) : (
                <div className="tb-placeholder">
                  {event.kind === "init" ? "nothing yet" : "—"}
                </div>
              )}
            </div>
            <span className="tb-arrow">→</span>
            <div>
              <p className="tb-table-label">
                {event.kind === "init" || event.kind === "done"
                  ? "table"
                  : "current"}{" "}
                · step {event.step}
              </p>
              <DpTable
                table={event.cur}
                n={n}
                step={event.step}
                event={event}
                mode="current"
                hidden={hideValue}
              />
            </div>
          </div>

          <div className="event-card tb-event">
            <span className="event-number">
              {String(cursor + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>
                {hideValue ? "What goes in the orange cell?" : info.title}
              </strong>
              <p>
                {hideValue
                  ? `Look at the highlighted cells in “previous”, take the best, and add the cherries under A and B. Type −∞ (or "inf") if no candidate is reachable.`
                  : info.body}
              </p>
            </div>
          </div>

          {needsAnswer(event) && (
            <div className="tb-equation">
              {event.candidates.map((c) => (
                <div
                  className={`tb-eq-row ${c.value !== NEG && c.value === event.best && (!hideValue || showHint) ? "best" : ""}`}
                  key={c.label}
                >
                  <span className="tb-eq-move">{c.label}</span>
                  <code>
                    previous[{c.row1}][{c.row2}]
                  </code>
                  <b>{fmt(c.value)}</b>
                </div>
              ))}
              <div className="tb-eq-total">
                <span>
                  best {hideValue && !showHint ? "?" : fmt(event.best)}
                </span>
                <span>
                  + cherries {hideValue && !showHint ? "?" : event.gain}
                  {event.row1 === event.row2 ? " (shared cell)" : ""}
                </span>
                <strong>= {hideValue ? "?" : fmt(event.value)}</strong>
              </div>
            </div>
          )}

          {quiz && needsAnswer(event) && (
            <div className="tb-quiz">
              {answered ? (
                <p className={answered.correct ? "tb-right" : "tb-wrong"}>
                  {answered.correct
                    ? `✓ Correct, ${answered.guess}!`
                    : `✗ You said ${answered.guess}. The answer is ${fmt(event.value)}.`}
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(guess);
                  }}
                >
                  <input
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="your value"
                    aria-label="Your predicted value"
                    autoFocus
                  />
                  <button type="submit">check</button>
                  <button type="button" onClick={() => submit("-inf")}>
                    −∞
                  </button>
                  <button
                    type="button"
                    className="tb-hint"
                    onClick={() => setShowHint(true)}
                  >
                    hint
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="stats-row">
        <div className="stat">
          <span>ANSWER</span>
          <strong>{event.kind === "done" ? trace.answer : "…"}</strong>
          <small>maximum cherries</small>
        </div>
        <div className="stat">
          <span>CELLS FILLED</span>
          <strong>{filled}</strong>
          <small>finite table entries so far</small>
        </div>
        <div className="stat">
          <span>{quiz ? "SCORE" : "LAYER"}</span>
          <strong>
            {quiz
              ? `${score.correct} / ${score.total}`
              : `${event.step} / ${2 * (n - 1)}`}
          </strong>
          <small>
            {quiz
              ? `streak ${score.streak} · best ${score.bestStreak}`
              : "steps taken by each walker"}
          </small>
        </div>
        <div className="stat accent-stat">
          <span>NOW</span>
          <strong>{KIND_LABEL[event.kind]}</strong>
          <small>current event</small>
        </div>
      </section>

      {event.kind === "done" && (
        <section className="tb-finish panel">
          <strong>🍒 × {trace.answer}</strong>
          <p>
            The table is complete.
            {quiz && score.total > 0
              ? ` You predicted ${score.correct} of ${score.total} cells correctly.`
              : " Turn on predict mode and restart to play it as a quiz."}
          </p>
          <button className="apply-button" onClick={() => restart(grid)}>
            play again <span>↺</span>
          </button>
        </section>
      )}

      <section className="tb-lower">
        <div className="panel tb-layers">
          <span className="section-kicker">03 / EVERY LAYER</span>
          <h2>The whole run at a glance</h2>
          <p>
            One small table per step. Only two are kept in memory at any time.
            Click a layer to jump to it.
          </p>
          <div className="tb-layer-strip">
            {trace.layers.map((layer, step) => {
              const state =
                step < event.step || event.kind === "done"
                  ? "done"
                  : step === event.step
                    ? "active"
                    : "todo";
              const table =
                state === "done"
                  ? layer
                  : state === "active"
                    ? event.cur
                    : emptyTable(n);
              return (
                <button
                  className={`tb-layer ${state}`}
                  key={step}
                  onClick={() => {
                    setPlaying(false);
                    goTo(stepStart.get(step) ?? 0);
                  }}
                  disabled={quiz}
                >
                  <DpTable
                    table={table}
                    n={n}
                    step={step}
                    event={event}
                    mode="mini"
                  />
                  <span>step {step}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel tb-code">
          <span className="section-kicker">04 / THE CODE</span>
          <h2>Line being executed</h2>
          <pre>
            {CODE.map(([tags, text], index) => (
              <span
                className={
                  tags.some((tag) => highlight.has(tag)) ? "tb-line-on" : ""
                }
                key={index}
              >
                {text}
                {"\n"}
              </span>
            ))}
          </pre>
        </div>
      </section>

      <footer className="footer">
        <span>cherry pickup / bottom-up tabulation</span>
        <span>
          ← → step · space play <b>·</b> overlap counts once
        </span>
      </footer>
    </main>
  );
}
