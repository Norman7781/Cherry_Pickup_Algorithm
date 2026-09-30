"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRESETS, type Grid } from "./presets";

type Point = { row: number; col: number };
type SimState = { step: number; row1: number; row2: number; cherries: number };
type EventKind = "enter" | "end" | "memo" | "dead" | "return" | "done";
type TraceEvent = {
  kind: EventKind;
  nodeId: number;
  state: SimState;
  message: string;
  detail: string;
  stack: SimState[];
  memoSize: number;
  memoHits: number;
};
type NodeKind = "end" | "memo" | "dead" | "solved";
type TreeNode = {
  id: number;
  parentId: number | null;
  state: SimState;
  move: string | null;
  gain: number;
  enterAt: number;
  doneAt: number;
  kind: NodeKind;
  // Best cherries still collectable from this state onward.
  result: number;
  bestChild: number | null;
};

const NEG = Number.NEGATIVE_INFINITY;
const MOVES = [
  [1, 1],
  [1, 0],
  [0, 1],
  [0, 0],
] as const;
const MIN_CUSTOM_SIZE = 2;
const MAX_CUSTOM_SIZE = 10;
const SPEEDS = { slow: 1100, normal: 620, fast: 250 } as const;
const EVENT_LABEL: Record<EventKind, string> = {
  enter: "call",
  end: "base case",
  memo: "memo hit",
  dead: "dead end",
  return: "return",
  done: "answer",
};

function key(state: SimState) {
  return `${state.step},${state.row1},${state.row2}`;
}

function fmt(value: number) {
  return value === NEG ? "−∞" : String(value);
}

function moveLabel(dr1: number, dr2: number) {
  return `A${dr1 ? "↓" : "→"} B${dr2 ? "↓" : "→"}`;
}

function buildTrace(grid: Grid) {
  const n = grid.length;
  const events: TraceEvent[] = [];
  const memo = new Map<string, number>();
  // The move chosen from each solved state, used to rebuild the best route.
  const choice = new Map<string, SimState>();
  const stack: SimState[] = [];
  const treeNodes: TreeNode[] = [];
  let memoHits = 0;

  const point = (state: SimState, which: 1 | 2): Point => {
    const row = which === 1 ? state.row1 : state.row2;
    return { row, col: state.step - row };
  };
  const valid = (state: SimState) =>
    [point(state, 1), point(state, 2)].every(
      ({ row, col }) =>
        row >= 0 && row < n && col >= 0 && col < n && grid[row][col] !== -1,
    );
  const record = (
    kind: EventKind,
    node: TreeNode,
    message: string,
    detail: string,
  ) => {
    events.push({
      kind,
      nodeId: node.id,
      state: node.state,
      message,
      detail,
      stack: [...stack],
      memoSize: memo.size,
      memoHits,
    });
  };

  function dfs(
    state: SimState,
    parentId: number | null,
    move: string | null,
    gain: number,
  ): number {
    const node: TreeNode = {
      id: treeNodes.length,
      parentId,
      state,
      move,
      gain,
      enterAt: events.length,
      doneAt: -1,
      kind: "solved",
      result: NEG,
      bestChild: null,
    };
    treeNodes.push(node);
    stack.push(state);
    const a = point(state, 1);
    const b = point(state, 2);
    record(
      "enter",
      node,
      `dfs(${state.step}, ${state.row1}, ${state.row2})`,
      `A is at (${a.row}, ${a.col}) and B is at (${b.row}, ${b.col}). ` +
        (move
          ? `Reached by ${move}, picking up +${gain}. Push the call onto the stack.`
          : "Both walkers start here. Push the first call onto the stack."),
    );

    const stateKey = key(state);
    if (state.step === 2 * (n - 1)) {
      node.kind = "end";
      node.result = 0;
      node.doneAt = events.length;
      record(
        "end",
        node,
        "base case → 0",
        "Both walkers are on the finish cell. Nothing is left to collect, so this call returns 0.",
      );
    } else if (memo.has(stateKey)) {
      memoHits += 1;
      node.kind = "memo";
      node.result = memo.get(stateKey)!;
      node.doneAt = events.length;
      record(
        "memo",
        node,
        `memo hit → ${fmt(node.result)}`,
        `(${stateKey}) was already solved. Reuse memo[${stateKey}] instead of exploring the same subtree again.`,
      );
    } else {
      const options: { label: string; gain: number; future: number }[] = [];
      let best = NEG;
      for (const [dr1, dr2] of MOVES) {
        const next = {
          step: state.step + 1,
          row1: state.row1 + dr1,
          row2: state.row2 + dr2,
          cherries: 0,
        };
        if (!valid(next)) continue;
        const na = point(next, 1);
        const nb = point(next, 2);
        const nextGain =
          grid[na.row][na.col] +
          (na.row === nb.row && na.col === nb.col ? 0 : grid[nb.row][nb.col]);
        next.cherries = state.cherries + nextGain;
        const childId = treeNodes.length;
        const label = moveLabel(dr1, dr2);
        const future = dfs(next, node.id, label, nextGain);
        options.push({ label, gain: nextGain, future });
        if (nextGain + future > best) {
          best = nextGain + future;
          node.bestChild = childId;
          choice.set(stateKey, next);
        }
      }
      memo.set(stateKey, best);
      node.result = best;
      node.doneAt = events.length;
      if (best === NEG) {
        node.kind = "dead";
        record(
          "dead",
          node,
          "dead end → −∞",
          options.length === 0
            ? "Every move runs into a wall or a thorn. No route reaches the finish from here."
            : "Every move from here ends in a dead end. No route reaches the finish.",
        );
      } else {
        const bestOption = options.find((o) => o.gain + o.future === best)!;
        record(
          "return",
          node,
          `max(${options.map((o) => `${o.gain} + ${fmt(o.future)}`).join(", ")}) = ${best}`,
          `Each option is “cherries picked up by the move + best future after it”. The best is ${bestOption.label}. Save memo[${stateKey}] = ${best} and return it to the caller.`,
        );
      }
    }
    stack.pop();
    return node.result;
  }

  const start = { step: 0, row1: 0, row2: 0, cherries: grid[0][0] };
  const future = dfs(start, null, null, grid[0][0]);
  const result = future === NEG ? 0 : grid[0][0] + future;
  events.push({
    kind: "done",
    nodeId: 0,
    state: start,
    message: `answer = ${grid[0][0]} + ${fmt(future)} = ${result}`,
    detail:
      future === NEG
        ? "The finish cannot be reached, so the answer is 0."
        : "The start cell’s cherries plus the root’s best future. The best route is highlighted on the grid and in the tree.",
    stack: [],
    memoSize: memo.size,
    memoHits,
  });

  // Follow the saved choices from the start to rebuild the best route.
  const bestRoute: SimState[] = [start];
  let cursor = start;
  while (future !== NEG && choice.has(key(cursor))) {
    cursor = choice.get(key(cursor))!;
    bestRoute.push(cursor);
  }
  return { events, result, memo, treeNodes, bestRoute };
}

function routeCells(states: SimState[]) {
  const a = new Set<string>();
  const b = new Set<string>();
  states.forEach((s) => {
    a.add(`${s.row1},${s.step - s.row1}`);
    b.add(`${s.row2},${s.step - s.row2}`);
  });
  return { a, b };
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

type TreeView = {
  nodes: TreeNode[];
  childrenByParent: Map<number, TreeNode[]>;
  grid: Grid;
  cursor: number;
  currentId: number;
  stackIds: Set<number>;
  bestPath: Set<number>;
  onPick: (index: number) => void;
};

function TreeBranch({ node, view }: { node: TreeNode; view: TreeView }) {
  const { cursor, currentId, stackIds, bestPath } = view;
  const children = (view.childrenByParent.get(node.id) ?? []).filter(
    (child) => child.enterAt <= cursor,
  );
  const done = node.doneAt <= cursor;
  const parent = node.parentId === null ? null : view.nodes[node.parentId];
  const chosen =
    parent !== null && parent.doneAt <= cursor && parent.bestChild === node.id;
  const status = !done
    ? node.id === currentId
      ? "exploring…"
      : "waiting for children"
    : node.kind === "end"
      ? "base → 0"
      : node.kind === "memo"
        ? `memo → ${fmt(node.result)}`
        : node.kind === "dead"
          ? "✗ −∞"
          : `= ${node.result}`;
  const className = [
    "tree-node",
    node.id === currentId && "tn-current",
    node.id !== currentId && stackIds.has(node.id) && "tn-stack",
    done && `tn-${node.kind}`,
    chosen && "tn-chosen",
    bestPath.has(node.id) && "tn-best",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="tree-branch">
      <button
        className={className}
        onClick={() => view.onPick(node.enterAt)}
        data-node={node.id}
        title="Jump to this call"
      >
        {node.move && (
          <span className="tn-move">
            {node.move} <b>+{node.gain}</b>
          </span>
        )}
        <MiniGrid grid={view.grid} state={node.state} />
        <span className="tree-node-index">
          #{String(node.id + 1).padStart(2, "0")}
        </span>
        <code>dfs({key(node.state)})</code>
        <span className="tree-node-result">{status}</span>
        {chosen && <span className="tn-star">★ best</span>}
      </button>
      {children.length > 0 ? (
        <div className="tree-children">
          {children.map((child) => (
            <TreeBranch key={child.id} node={child} view={view} />
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
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>("normal");
  const [follow, setFollow] = useState(true);
  const treeRef = useRef<HTMLDivElement>(null);
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
  const lastIndex = trace.events.length - 1;
  const event = trace.events[Math.min(cursor, lastIndex)];
  const finished = event.kind === "done";
  const size = grid.length;
  const active1 = {
    row: event.state.row1,
    col: event.state.step - event.state.row1,
  };
  const active2 = {
    row: event.state.row2,
    col: event.state.step - event.state.row2,
  };
  const route = routeCells(finished ? trace.bestRoute : event.stack);

  const stackIds = new Set<number>();
  for (
    let id: number | null = event.nodeId;
    id !== null;
    id = trace.treeNodes[id].parentId
  ) {
    stackIds.add(id);
  }
  const bestPath = new Set<number>();
  if (finished) {
    // A memo hit has no children of its own, so continue from the call that
    // originally solved the same state.
    const solvedBy = new Map<string, number>();
    trace.treeNodes.forEach((node) => {
      if (node.kind === "solved") solvedBy.set(key(node.state), node.id);
    });
    for (let id: number | null = 0; id !== null;) {
      bestPath.add(id);
      const node: TreeNode = trace.treeNodes[id];
      if (node.kind === "memo") {
        const original = solvedBy.get(key(node.state))!;
        bestPath.add(original);
        id = trace.treeNodes[original].bestChild;
      } else {
        id = node.bestChild;
      }
    }
  }
  const callsSoFar = trace.treeNodes.filter((n) => n.enterAt <= cursor).length;

  useEffect(() => {
    if (!playing || cursor >= lastIndex) return;
    const timer = window.setTimeout(() => {
      setCursor(cursor + 1);
      if (cursor + 1 >= lastIndex) setPlaying(false);
    }, SPEEDS[speed]);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, lastIndex, speed]);

  // Keep the current call in view inside the tree panel (not the whole page).
  useEffect(() => {
    const box = treeRef.current;
    if (!follow || !box) return;
    const node = box.querySelector<HTMLElement>(
      `[data-node="${event.nodeId}"]`,
    );
    if (!node) return;
    const boxRect = box.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    box.scrollTo({
      top: box.scrollTop + nodeRect.top - boxRect.top - boxRect.height / 2 + 40,
      left: box.scrollLeft + nodeRect.left - boxRect.left - 60,
      behavior: "smooth",
    });
  }, [cursor, follow, event.nodeId]);

  const goTo = (index: number) =>
    setCursor(Math.max(0, Math.min(index, lastIndex)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        setCursor((value) => Math.min(value + 1, lastIndex));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        setCursor((value) => Math.max(value - 1, 0));
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastIndex]);

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
    setCursor(lastIndex);
    setPlaying(false);
  };

  const treeView: TreeView = {
    nodes: trace.treeNodes,
    childrenByParent,
    grid,
    cursor,
    currentId: event.nodeId,
    stackIds: finished ? new Set() : stackIds,
    bestPath,
    onPick: (index) => {
      setPlaying(false);
      goTo(index);
    },
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
          <span className="slash">/</span>
          <Link className="page-link" href="/tabulation">
            bottom-up table ↗
          </Link>
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
            explores, backtracks, and remembers its work. The recursion tree
            grows one call at a time.
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
            title="Reset trace"
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
            disabled={cursor >= lastIndex}
          >
            {playing ? "Ⅱ pause" : "▶ play trace"}
          </button>
          <button
            className="icon-button step-button"
            onClick={() => {
              setPlaying(false);
              goTo(cursor + 1);
            }}
            disabled={cursor >= lastIndex}
            aria-label="Next step"
            title="Next step (→)"
          >
            ▷|
          </button>
          <button
            className="icon-button"
            onClick={jumpEnd}
            aria-label="Jump to end"
            title="Jump to end"
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
            <span>TRACE PROGRESS</span>
            <b>
              {String(cursor + 1).padStart(2, "0")} /{" "}
              {String(trace.events.length).padStart(2, "0")}
            </b>
          </div>
          <input
            type="range"
            min="0"
            max={lastIndex}
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
                  !finished &&
                  active1.row === rowIndex &&
                  active1.col === colIndex;
                const two =
                  !finished &&
                  active2.row === rowIndex &&
                  active2.col === colIndex;
                const cellKey = `${rowIndex},${colIndex}`;
                const inA = route.a.has(cellKey);
                const inB = route.b.has(cellKey);
                const routeClass =
                  inA && inB
                    ? "tb-route-both"
                    : inA
                      ? "tb-route-a"
                      : inB
                        ? "tb-route-b"
                        : "";
                return (
                  <div
                    className={`cell ${value === -1 ? "blocked" : ""} ${one || two ? "occupied" : ""} ${routeClass}`}
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
          <div className="tb-route-legend">
            <span>{finished ? "best route" : "path on the call stack"}</span>
            <span>
              <i className="tb-swatch tb-route-a" /> A
            </span>
            <span>
              <i className="tb-swatch tb-route-b" /> B
            </span>
            <span>
              <i className="tb-swatch tb-route-both" /> both
            </span>
          </div>
          <div className="board-footer">
            <span>
              <b>step</b> {event.state.step} / {2 * (size - 1)}
            </span>
            <span>
              <b>cherries on this path</b>{" "}
              {finished ? trace.result : event.state.cherries}
            </span>
          </div>
        </div>

        <div className="trace-panel panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">02 / CALL STACK</span>
              <h2>What DFS is doing</h2>
            </div>
            <span className={`event-tag ${event.kind}`}>
              {EVENT_LABEL[event.kind]}
            </span>
          </div>
          <div className="event-card">
            <span className="event-number">
              {String(cursor + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>{event.message}</strong>
              <p>{event.detail}</p>
            </div>
          </div>
          <div className="stack-list">
            {event.stack.length === 0 && (
              <p className="stack-empty">The stack is empty. DFS is done.</p>
            )}
            {event.stack
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
                  <span className="stack-cherries">{frame.cherries} 🍒</span>
                </div>
              ))}
          </div>
          <div className="trace-note">
            <span className="note-mark">i</span>
            <span>
              Each call returns the <b>best future</b>: the most cherries still
              collectable from its state. That value doesn’t depend on how the
              walkers got there, so it is safe to memoize.
            </span>
          </div>
        </div>
      </section>

      <section className="stats-row">
        <div className="stat">
          <span>ANSWER</span>
          <strong>{finished ? trace.result : "…"}</strong>
          <small>maximum cherries</small>
        </div>
        <div className="stat">
          <span>CALLS SO FAR</span>
          <strong>
            {callsSoFar} / {trace.treeNodes.length}
          </strong>
          <small>recursive calls</small>
        </div>
        <div className="stat">
          <span>MEMO</span>
          <strong>{event.memoSize}</strong>
          <small>
            entries saved · {event.memoHits} hit
            {event.memoHits === 1 ? "" : "s"}
          </small>
        </div>
        <div className="stat accent-stat">
          <span>NOW</span>
          <strong>{EVENT_LABEL[event.kind]}</strong>
          <small>trace event</small>
        </div>
      </section>

      <section className="tree-section panel">
        <div className="tree-heading">
          <div>
            <span className="section-kicker">03 / RECURSION TREE</span>
            <h2>The search tree, growing step by step</h2>
            <p>
              Each box is one <code>dfs</code> call. Calls appear when they are
              made, and show their value once they return. The <b>orange</b> box
              is the current call, and the boxes with an orange edge are still
              waiting on the stack. <b>★ best</b> marks the child each call
              picked. Click any box to jump to it.
            </p>
          </div>
          <div className="tree-count">
            <strong>
              {callsSoFar} / {trace.treeNodes.length}
            </strong>
            <span>calls shown</span>
          </div>
        </div>
        <div className="tree-input-line">
          <span>NOW</span>
          <code>{event.message}</code>
          <label className="tree-follow">
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
            />{" "}
            follow current call
          </label>
        </div>
        <div className="tree-scroll dfs-tree" ref={treeRef}>
          <TreeBranch node={trace.treeNodes[0]} view={treeView} />
        </div>
        <div className="tree-footer tn-legend">
          <span>
            <i className="tn-swatch tn-current" /> current
          </span>
          <span>
            <i className="tn-swatch tn-stack" /> on stack
          </span>
          <span>
            <i className="tn-swatch tn-solved" /> returned
          </span>
          <span>
            <i className="tn-swatch tn-memo" /> memo hit
          </span>
          <span>
            <i className="tn-swatch tn-end" /> base case
          </span>
          <span>
            <i className="tn-swatch tn-dead" /> dead end
          </span>
          <span>
            <i className="tn-swatch tn-best" /> best route
          </span>
        </div>
      </section>

      <footer className="footer">
        <span>cherry pickup / visual study</span>
        <span>
          ← → step · space play <b>·</b> overlap counts once
        </span>
      </footer>
    </main>
  );
}
