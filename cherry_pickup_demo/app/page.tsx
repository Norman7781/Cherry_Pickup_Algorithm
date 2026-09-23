"use client";

import { useEffect, useMemo, useState } from "react";

type Grid = number[][];
type Point = { row: number; col: number };
type SimState = { step: number; row1: number; row2: number; cherries: number };
type EventKind = "enter" | "branch" | "memo" | "return";
type TraceEvent = {
  kind: EventKind;
  state: SimState;
  message: string;
  stack: SimState[];
  memo: Map<string, number>;
};
type TreeNode = {
  id: number;
  parentId: number | null;
  state: SimState;
  result?: number;
};

const PRESETS: Record<string, Grid> = {
  "classic 5 × 5": [
    [0, 1, -1, 1, 0],
    [1, 0, 0, 1, 0],
    [0, 1, 0, 0, 1],
    [1, 0, 1, 1, 1],
    [0, 1, 0, 1, 0],
  ],
  "small 4 × 4": [
    [1, 1, 1, -1],
    [1, -1, 1, 1],
    [1, 1, 1, 1],
    [-1, 1, 1, 1],
  ],
  "open 5 × 5": Array.from({ length: 5 }, () => [0, 1, 0, 1, 0]),
};

const MOVES = [
  [1, 1],
  [1, 0],
  [0, 1],
  [0, 0],
] as const;
const MIN_CUSTOM_SIZE = 2;
const MAX_CUSTOM_SIZE = 10;

function key(state: SimState) {
  return `${state.step},${state.row1},${state.row2}`;
}

function buildTrace(grid: Grid) {
  const n = grid.length;
  const events: TraceEvent[] = [];
  const memo = new Map<string, number>();
  const stack: SimState[] = [];
  const treeNodes: TreeNode[] = [];
  const treeStack: number[] = [];
  let calls = 0;

  const point = (state: SimState, which: 1 | 2): Point => {
    const row = which === 1 ? state.row1 : state.row2;
    return { row, col: state.step - row };
  };
  const valid = (state: SimState) => {
    const a = point(state, 1);
    const b = point(state, 2);
    return [a, b].every(
      ({ row, col }) =>
        row >= 0 && row < n && col >= 0 && col < n && grid[row][col] !== -1,
    );
  };
  const successors = (state: SimState) =>
    MOVES.map(([dr1, dr2]) => ({
      ...state,
      step: state.step + 1,
      row1: state.row1 + dr1,
      row2: state.row2 + dr2,
    })).filter(valid);

  function dfs(state: SimState): number {
    calls += 1;
    const node: TreeNode = {
      id: treeNodes.length,
      parentId: treeStack.at(-1) ?? null,
      state,
    };
    treeNodes.push(node);
    treeStack.push(node.id);
    stack.push(state);
    events.push({
      kind: "enter",
      state,
      message: `dfs(${state.step}, ${state.row1}, ${state.row2})`,
      stack: [...stack],
      memo: new Map(memo),
    });
    if (state.step === 2 * (n - 1)) {
      const result = state.cherries;
      events.push({
        kind: "return",
        state,
        message: `reached the end → ${result} cherries`,
        stack: [...stack],
        memo: new Map(memo),
      });
      node.result = result;
      treeStack.pop();
      stack.pop();
      return result;
    }

    const stateKey = key(state);
    if (memo.has(stateKey)) {
      const result = memo.get(stateKey)!;
      events.push({
        kind: "memo",
        state,
        message: `memo hit: ${stateKey} → ${result}`,
        stack: [...stack],
        memo: new Map(memo),
      });
      node.result = result;
      treeStack.pop();
      stack.pop();
      return result;
    }

    let best = Number.NEGATIVE_INFINITY;
    for (const next of successors(state)) {
      const a = point(next, 1);
      const b = point(next, 2);
      const gain =
        grid[a.row][a.col] +
        (a.row === b.row && a.col === b.col ? 0 : grid[b.row][b.col]);
      events.push({
        kind: "branch",
        state: next,
        message: `try move → gain +${gain}`,
        stack: [...stack],
        memo: new Map(memo),
      });
      best = Math.max(best, dfs({ ...next, cherries: state.cherries + gain }));
    }
    memo.set(stateKey, best);
    events.push({
      kind: "return",
      state,
      message: `memoize ${stateKey} = ${best}`,
      stack: [...stack],
      memo: new Map(memo),
    });
    node.result = best;
    treeStack.pop();
    stack.pop();
    return best;
  }

  const start = { step: 0, row1: 0, row2: 0, cherries: grid[0][0] };
  const result = Math.max(dfs(start), 0);
  return { events, result, calls, memo, treeNodes };
}

function formatCell(value: number) {
  return value === 1 ? "🍒" : value === -1 ? "🚫" : "";
}

function MiniGrid({ grid, state }: { grid: Grid; state: SimState }) {
  const size = grid.length;
  const walkerA = { row: state.row1, col: state.step - state.row1 };
  const walkerB = { row: state.row2, col: state.step - state.row2 };
  return (
    <span
      className="tree-mini-grid"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {grid.flatMap((row, rowIndex) =>
        row.map((value, colIndex) => {
          const isA = walkerA.row === rowIndex && walkerA.col === colIndex;
          const isB = walkerB.row === rowIndex && walkerB.col === colIndex;
          return (
            <span
              className={`tree-mini-cell ${value === -1 ? "mini-blocked" : ""}`}
              key={`${rowIndex}-${colIndex}`}
            >
              {isA && <i className="mini-walker mini-a">A</i>}
              {isB && !isA && <i className="mini-walker mini-b">B</i>}
              {!isA && !isB && value === 1 && "🍒"}
            </span>
          );
        }),
      )}
    </span>
  );
}

function TreeBranch({
  node,
  childrenByParent,
  grid,
}: {
  node: TreeNode;
  childrenByParent: Map<number, TreeNode[]>;
  grid: Grid;
}) {
  const children = childrenByParent.get(node.id) ?? [];
  return (
    <div className="tree-branch">
      <div className="tree-node">
        <MiniGrid grid={grid} state={node.state} />
        <span className="tree-node-index">
          #{String(node.id + 1).padStart(2, "0")}
        </span>
        <code>{key(node.state)}</code>
        <span className="tree-node-result">
          {node.result === undefined ? "…" : `→ ${node.result}`}
        </span>
      </div>
      {children.length > 0 ? (
        <div className="tree-children">
          {children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              childrenByParent={childrenByParent}
              grid={grid}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const [preset, setPreset] = useState("classic 5 × 5");
  const [grid, setGrid] = useState<Grid>(() =>
    PRESETS["classic 5 × 5"].map((row) => [...row]),
  );
  const [draftGrid, setDraftGrid] = useState<Grid>(() =>
    PRESETS["classic 5 × 5"].map((row) => [...row]),
  );
  const [gridNotice, setGridNotice] = useState("");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const trace = useMemo(() => buildTrace(grid), [grid]);
  const childrenByParent = useMemo(() => {
    const children = new Map<number, TreeNode[]>();
    trace.treeNodes.forEach((node) => {
      if (node.parentId !== null) {
        children.set(node.parentId, [
          ...(children.get(node.parentId) ?? []),
          node,
        ]);
      }
    });
    return children;
  }, [trace.treeNodes]);
  const event = trace.events[Math.min(cursor, trace.events.length - 1)];
  const size = grid.length;
  const active1 = event
    ? { row: event.state.row1, col: event.state.step - event.state.row1 }
    : { row: 0, col: 0 };
  const active2 = event
    ? { row: event.state.row2, col: event.state.step - event.state.row2 }
    : { row: 0, col: 0 };

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setCursor((value) => {
          if (value >= trace.events.length - 1) {
            setPlaying(false);
            return value;
          }
          return value + 1;
        }),
      620,
    );
    return () => window.clearInterval(timer);
  }, [playing, trace.events.length]);

  const reset = () => {
    setCursor(0);
    setPlaying(false);
  };
  const changePreset = (value: string) => {
    if (value === "custom input") {
      setPreset(value);
      window.requestAnimationFrame(() => {
        document.getElementById("grid-editor")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }
    const nextGrid = PRESETS[value].map((row) => [...row]);
    setPreset(value);
    setGrid(nextGrid);
    setDraftGrid(nextGrid.map((row) => [...row]));
    setGridNotice("");
    setCursor(0);
    setPlaying(false);
  };
  const editCell = (row: number, col: number) => {
    setGridNotice("");
    const currentValue = draftGrid[row][col];
    const nextValue = currentValue === 0 ? 1 : currentValue === 1 ? -1 : 0;
    const isEndpoint =
      (row === 0 && col === 0) ||
      (row === draftGrid.length - 1 && col === draftGrid.length - 1);
    if (isEndpoint && nextValue === -1) {
      setGridNotice("The start and finish cells must stay open.");
      return;
    }
    const nextGrid = draftGrid.map((line, rowIndex) =>
      line.map((value, colIndex) =>
        rowIndex === row && colIndex === col ? nextValue : value,
      ),
    );
    setDraftGrid(nextGrid);
    setGrid(nextGrid);
    setPreset("custom input");
    setCursor(0);
    setPlaying(false);
  };
  const applyGrid = () => {
    const draftSize = draftGrid.length;
    if (
      draftGrid[0][0] === -1 ||
      draftGrid[draftSize - 1][draftSize - 1] === -1
    ) {
      setGridNotice("Keep the start and finish cells open.");
      return;
    }
    const nextGrid = draftGrid.map((row) => [...row]);
    setGrid(nextGrid);
    setPreset("custom input");
    setGridNotice("Input applied. The trace below now follows this grid.");
    setCursor(0);
    setPlaying(false);
  };
  const changeDraftSize = (value: string) => {
    const nextSize = Math.min(
      MAX_CUSTOM_SIZE,
      Math.max(MIN_CUSTOM_SIZE, Number.parseInt(value, 10) || MIN_CUSTOM_SIZE),
    );
    setPreset("custom input");
    setGridNotice("");
    const nextGrid = Array.from({ length: nextSize }, (_, rowIndex) =>
      Array.from(
        { length: nextSize },
        (_, colIndex) => draftGrid[rowIndex]?.[colIndex] ?? 0,
      ),
    ).map((row, rowIndex) =>
      row.map((cell, colIndex) =>
        (rowIndex === 0 && colIndex === 0) ||
        (rowIndex === nextSize - 1 && colIndex === nextSize - 1)
          ? 0
          : cell,
      ),
    );
    setDraftGrid(nextGrid);
    setGrid(nextGrid);
    setCursor(0);
    setPlaying(false);
  };
  const jumpEnd = () => {
    setCursor(trace.events.length - 1);
    setPlaying(false);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">↘</span>
          <span>algorithm lab</span>
        </div>
        <div className="topbar-note">
          <span className="live-dot" /> interactive trace{" "}
          <span className="slash">/</span> dfs + memoization
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">Problem 741 · dynamic programming</p>
          <h1>
            Cherry Pickup, <em>unfolded.</em>
          </h1>
          <p className="lede">
            Watch two walkers move through the same grid as recursive DFS
            explores, backtracks, and remembers its work.
          </p>
        </div>
        <div className="complexity">
          <span>state key</span>
          <strong>(step, row₁, row₂)</strong>
          <small>O(n³) memoized states</small>
        </div>
      </section>

      <section
        className={`input-section panel ${preset === "custom input" ? "custom-active" : ""}`}
        id="grid-editor"
      >
        <div className="input-copy">
          <span className="section-kicker">00 / YOUR INPUT</span>
          <h2>Shape the search space</h2>
          <p>
            Click a cell to cycle through an empty square, a cherry, and a
            blocked square. Both tables update immediately, and the DFS trace
            follows the grid you are editing.
          </p>
          <div className="input-legend">
            <span>
              <i className="input-swatch empty" /> empty
            </span>
            <span>
              <i className="input-swatch cherry" /> cherry
            </span>
            <span>
              <i className="input-swatch obstacle" /> blocked
            </span>
          </div>
          {preset === "custom input" && (
            <label className="grid-size-control">
              <span>GRID SIZE</span>
              <input
                type="number"
                min={MIN_CUSTOM_SIZE}
                max={MAX_CUSTOM_SIZE}
                value={draftGrid.length}
                onChange={(event) => changeDraftSize(event.target.value)}
                aria-label="Custom grid size"
              />
              <small>
                from {MIN_CUSTOM_SIZE} × {MIN_CUSTOM_SIZE} to {MAX_CUSTOM_SIZE}{" "}
                × {MAX_CUSTOM_SIZE}
              </small>
            </label>
          )}
          <button className="apply-button" onClick={applyGrid}>
            restart this trace <span>↗</span>
          </button>
          {gridNotice && <p className="grid-notice">{gridNotice}</p>}
        </div>
        <div className="editor-wrap">
          <div className="editor-label">
            <span>click to edit</span>
            <b>
              {draftGrid.length} × {draftGrid.length}
            </b>
          </div>
          <div
            className="editor-board"
            style={{ gridTemplateColumns: `repeat(${draftGrid.length}, 1fr)` }}
          >
            {draftGrid.flatMap((row, rowIndex) =>
              row.map((value, colIndex) => (
                <button
                  className={`editor-cell editor-value-${value}`}
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => editCell(rowIndex, colIndex)}
                  aria-label={`row ${rowIndex + 1}, column ${colIndex + 1}, ${value === -1 ? "blocked" : value === 1 ? "one cherry" : "empty"}`}
                >
                  {formatCell(value)}
                </button>
              )),
            )}
          </div>
          <p className="editor-hint">
            Start <b>(1, 1)</b> and finish{" "}
            <b>
              ({draftGrid.length}, {draftGrid.length})
            </b>{" "}
            must stay open.
          </p>
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
          className={`edit-grid-button ${preset === "custom input" ? "selected" : ""}`}
          onClick={() => changePreset("custom input")}
        >
          edit grid <span>↗</span>
        </button>
        <div className="transport">
          <button
            className="icon-button"
            onClick={reset}
            aria-label="Reset trace"
          >
            ↺
          </button>
          <button
            className="play-button"
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "Ⅱ pause" : "▶ play trace"}
          </button>
          <button
            className="icon-button step-button"
            onClick={() => {
              setPlaying(false);
              setCursor((value) => Math.min(value + 1, trace.events.length - 1));
            }}
            disabled={cursor >= trace.events.length - 1}
            aria-label="Advance one trace step"
            title="Advance one trace step"
          >
            ▷|
          </button>
          <button
            className="icon-button"
            onClick={jumpEnd}
            aria-label="Jump to end"
          >
            ↠
          </button>
        </div>
        <div className="progress-wrap">
          <div className="progress-label">
            <span>TRACE PROGRESS</span>
            <b>
              {String(cursor + 1).padStart(2, "0")} /{" "}
              {String(trace.events.length).padStart(2, "0")}
            </b>
          </div>
          <input
            type="range"
            min="0"
            max={trace.events.length - 1}
            value={cursor}
            onChange={(e) => {
              setCursor(Number(e.target.value));
              setPlaying(false);
            }}
          />
        </div>
      </section>

      <section className="workspace">
        <div className="board-panel panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">01 / SEARCH SPACE</span>
              <h2>Shared grid</h2>
            </div>
            <div className="legend">
              <span>
                <i className="legend-dot walker-one" /> walker A
              </span>
              <span>
                <i className="legend-dot walker-two" /> walker B
              </span>
            </div>
          </div>
          <div
            className="board"
            style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
          >
            {grid.flatMap((row, rowIndex) =>
              row.map((value, colIndex) => {
                const one =
                  active1.row === rowIndex && active1.col === colIndex;
                const two =
                  active2.row === rowIndex && active2.col === colIndex;
                return (
                  <div
                    className={`cell ${value === -1 ? "blocked" : ""} ${one || two ? "occupied" : ""}`}
                    key={`${rowIndex}-${colIndex}`}
                  >
                    <span
                      className={`cell-value ${value === 1 ? "cherry-token" : ""}`}
                    >
                      {formatCell(value)}
                    </span>
                    {one && <span className="walker walker-a">A</span>}
                    {two && <span className="walker walker-b">B</span>}
                  </div>
                );
              }),
            )}
          </div>
          <div className="board-footer">
            <span>
              <b>step</b> {event?.state.step ?? 0} / {2 * (size - 1)}
            </span>
            <span>
              <b>cherries collected</b> {event?.state.cherries ?? 0}
            </span>
          </div>
        </div>

        <div className="trace-panel panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">02 / CALL STACK</span>
              <h2>What DFS is doing</h2>
            </div>
            <span className={`event-tag ${event?.kind}`}>
              {event?.kind ?? "ready"}
            </span>
          </div>
          <div className="event-card">
            <span className="event-number">
              {String(cursor + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>{event?.message}</strong>
              <p>
                {event?.kind === "memo"
                  ? "This state was already solved. Return the stored answer instead of exploring again."
                  : event?.kind === "return"
                    ? "The branch is complete. DFS bubbles the best value back to its caller."
                    : "The next frame is pushed onto the stack and the search continues forward."}
              </p>
            </div>
          </div>
          <div className="stack-list">
            {event?.stack
              .slice()
              .reverse()
              .map((frame, index) => (
                <div
                  className={`stack-row ${index === 0 ? "current" : ""}`}
                  key={`${key(frame)}-${index}`}
                >
                  <span className="stack-index">
                    {String(event.stack.length - index).padStart(2, "0")}
                  </span>
                  <code>
                    ({frame.step}, {frame.row1}, {frame.row2})
                  </code>
                  <span className="stack-cherries">+{frame.cherries}</span>
                </div>
              ))}
          </div>
          <div className="trace-note">
            <span className="note-mark">i</span>
            <span>
              Memo key ignores <b>cherries</b>. Once a position is solved, its
              best future is reusable.
            </span>
          </div>
        </div>
      </section>

      <section className="stats-row">
        <div className="stat">
          <span>ANSWER</span>
          <strong>{trace.result}</strong>
          <small>maximum cherries</small>
        </div>
        <div className="stat">
          <span>STATES VISITED</span>
          <strong>{trace.calls}</strong>
          <small>recursive calls</small>
        </div>
        <div className="stat">
          <span>MEMO ENTRIES</span>
          <strong>{trace.memo.size}</strong>
          <small>unique keys solved</small>
        </div>
        <div className="stat accent-stat">
          <span>NOW EXPLORING</span>
          <strong>
            {event?.kind === "memo" ? "cached" : (event?.kind ?? "ready")}
          </strong>
          <small>trace event</small>
        </div>
      </section>

      <section className="tree-section panel">
        <div className="tree-heading">
          <div>
            <span className="section-kicker">03 / RECURSION MAP</span>
            <h2>The search tree, made visible</h2>
            <p>
              Every branch below came from the grid you applied above. A
              repeated key is a revisit that memoization can answer instantly.
            </p>
          </div>
          <div className="tree-count">
            <strong>{trace.treeNodes.length}</strong>
            <span>calls in this run</span>
          </div>
        </div>
        <div className="tree-input-line">
          <span>INPUT SNAPSHOT</span>
          <code>{grid.map((row) => `[ ${row.join("  ")} ]`).join("  ")}</code>
        </div>
        <div className="tree-scroll">
          <TreeBranch
            node={trace.treeNodes[0]}
            childrenByParent={childrenByParent}
            grid={grid}
          />
        </div>
        <div className="tree-footer">
          <span>
            <i className="tree-key-dot" /> key = (step, row₁, row₂)
          </span>
          <span>
            scroll sideways to follow branches · scroll down to explore deeper
            calls
          </span>
        </div>
      </section>

      <footer className="footer">
        <span>cherry pickup / visual study</span>
        <span>
          four possible moves per step <b>·</b> overlap counts once
        </span>
      </footer>
    </main>
  );
}
