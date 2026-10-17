"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Grid } from "./presets";
import { PLAY_MOVES, playMove, playOutcome, playPath, randomAdventure, startPlay, visitPlay, type PlayState } from "./dfs-play-state";

const PRACTICE: Grid = [[0, 1, -1], [1, 0, -1], [1, 1, 1]];

function GardenMap({ state, fullTree, onVisit }: { state: PlayState; fullTree: boolean; onVisit: (id: number) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const pathsRef = useRef<SVGSVGElement>(null);
  const partyRef = useRef<HTMLDivElement>(null);
  const path = playPath(state);
  const route = new Set(path.map((item) => item.id));
  const best = new Set(state.bestNode === null ? [] : playPath(state, state.bestNode).map((item) => item.id));
  const visible = fullTree ? state.nodes : state.nodes.filter((item) => route.has(item.id) || (item.parent !== null && route.has(item.parent)));
  const levels = Array.from({ length: Math.max(...visible.map((item) => item.step)) + 1 }, (_, step) => visible.filter((item) => item.step === step));

  useLayoutEffect(() => {
    const map = mapRef.current;
    const svg = pathsRef.current;
    if (!map || !svg) return;
    const draw = () => {
      const bounds = map.getBoundingClientRect();
      const lines: SVGPathElement[] = [];
      svg.setAttribute("viewBox", `0 0 ${map.clientWidth} ${map.clientHeight}`);
      for (const node of visible) {
        if (node.parent === null) continue;
        const parent = map.querySelector<HTMLElement>(`[data-play-node="${node.parent}"]`);
        const child = map.querySelector<HTMLElement>(`[data-play-node="${node.id}"]`);
        if (!parent || !child) continue;
        const a = parent.getBoundingClientRect();
        const b = child.getBoundingClientRect();
        const x1 = a.left + a.width / 2 - bounds.left;
        const y1 = a.bottom - bounds.top;
        const x2 = b.left + b.width / 2 - bounds.left;
        const y2 = b.top - bounds.top;
        const middle = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`;
        for (const outline of [true, false]) {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
          line.setAttribute("d", d);
          line.setAttribute("class", outline ? "garden-road-base" : route.has(node.id) ? "garden-road-chosen" : node.parent === state.active ? "garden-road-next" : "garden-road-unused");
          lines.push(line);
        }
      }
      svg.replaceChildren(...lines);
      const current = map.querySelector<HTMLElement>(`[data-play-node="${state.active}"]`);
      if (current && partyRef.current) {
        const stop = current.getBoundingClientRect();
        partyRef.current.style.left = `${stop.left + stop.width / 2 - bounds.left}px`;
        partyRef.current.style.top = `${stop.top + 25 - bounds.top}px`;
        partyRef.current.style.opacity = "1";
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(map);
    return () => observer.disconnect();
  });

  return (
    <div className="dfs-garden-map" ref={mapRef} role="region" aria-label="Garden paths of the DFS tree">
      <svg ref={pathsRef} className="garden-roads" aria-hidden="true" />
      <div ref={partyRef} className="garden-map-party" role="img" aria-label="Girl and boy at your current garden stop">👧 👦</div>
      {levels.map((level, step) => <div className="garden-map-level" key={step}>
        <span className="garden-level-label">{step === 0 ? "GARDEN ENTRANCE" : `PATH ${step}`}</span>
        <div className="garden-map-stops">{level.map((node) => {
          const active = node.id === state.active;
          const available = !node.visited && node.parent === state.active;
          const unchosen = !route.has(node.id) && node.parent !== state.active;
          const parent = node.parent === null ? null : state.nodes[node.parent];
          const girl = parent ? node.a === parent.a ? "→" : "↓" : "";
          const boy = parent ? node.b === parent.b ? "→" : "↓" : "";
          return <button key={node.id} type="button" data-play-node={node.id}
            className={`dfs-play-node ${active ? "is-active" : ""} ${route.has(node.id) ? "on-route" : ""} ${best.has(node.id) ? "on-best" : ""} ${available ? "is-choice" : ""} ${unchosen ? "is-unchosen" : ""}`}
            disabled={(!node.visited && !available) || (!fullTree && unchosen)} aria-current={active ? "step" : undefined}
            aria-label={`${parent ? `Girl ${girl === "→" ? "right" : "down"}, boy ${boy === "→" ? "right" : "down"}` : "Girl and boy start here"}, ${node.visited ? node.total : node.gain} cherries, ${active ? "you are here" : available ? "choose this path" : unchosen ? "path not taken" : "chosen path, backtrack"}`}
            onClick={() => onVisit(node.id)}>
            <strong className={`dfs-character-moves ${active ? "garden-players-here" : ""}`}>{active ? "👧 👦" : parent ? <><span>👧 {girl}</span><span>👦 {boy}</span></> : "🌳"}</strong>
            <span>{node.visited ? `${node.total} 🍒` : `+${node.gain} 🍒`}</span>
            <small>{active ? "YOU ARE HERE" : available ? "TAKE PATH" : unchosen ? "NOT TAKEN" : "CHOSEN"}</small>
          </button>;
        })}</div>
      </div>)}
    </div>
  );
}

function TreeAdventure({ grid, optimum }: { grid: Grid; optimum: number }) {
  const [state, setState] = useState(() => startPlay(grid));
  const [fullTree, setFullTree] = useState(false);
  const [notice, setNotice] = useState("Choose a green circle in the tree. 👧 shows the girl’s direction; 👦 shows the boy’s direction. They will follow the paths you choose.");
  const node = state.nodes[state.active];
  const path = playPath(state);
  const collected = new Set(path.flatMap((item) => [`${item.a},${item.step - item.a}`, `${item.b},${item.step - item.b}`]));
  const girlTrail = new Set(path.map((item) => `${item.a},${item.step - item.a}`));
  const boyTrail = new Set(path.map((item) => `${item.b},${item.step - item.b}`));
  const n = grid.length;
  const finished = node.step === 2 * (n - 1);
  const dead = !finished && node.children.length === 0;
  const outcome = playOutcome(grid, state, optimum);



  function visit(id: number) {
    const target = state.nodes[id];
    if (!target || id === state.active) return;
    const returning = target.visited;
    setState((current) => visitPlay(grid, current, id));
    setNotice(returning
      ? `Back on this branch with ${target.total} cherries. Other branches keep their own cherries; try an unexplored move.`
      : `👧 The girl moves ${target.a === node.a ? "right" : "down"}; 👦 the boy moves ${target.b === node.b ? "right" : "down"}. They picked ${target.gain} ${target.gain === 1 ? "cherry" : "cherries"}${target.a === target.b ? " — sharing a cherry counts once" : ""}. Choose their next paths in the tree.`);
  }

  return (
    <>
      <div className="dfs-play-stats">
        <span>THIS ROUTE <b>{node.total} 🍒</b></span>
        <span>BEST FINISHED ROUTE <b>{state.best === null ? "—" : `${state.best} 🍒`}</b></span>
        <span>MOVES <b>{node.step} / {2 * (n - 1)}</b></span>
        <span>TARGET TO WIN <b>{optimum} 🍒</b></span>
      </div>
      <div className="dfs-adventure-layout">
        <div className="dfs-play-board">
          <h3>👧 👦 Cherry garden</h3>
          <div className="board dfs-garden" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
            {grid.flatMap((row, r) => row.map((value, c) => {
              const a = r === node.a && c === node.step - node.a;
              const b = r === node.b && c === node.step - node.b;
              const picked = collected.has(`${r},${c}`);
              const girl = girlTrail.has(`${r},${c}`);
              const boy = boyTrail.has(`${r},${c}`);
              return <div key={`${r},${c}`} className={`cell ${value === -1 ? "blocked" : ""} ${picked ? "dfs-picked" : ""} ${girl && boy ? "garden-shared-trail" : girl ? "garden-girl-trail" : boy ? "garden-boy-trail" : ""} ${a || b ? "occupied" : ""}`}
                aria-label={`row ${r}, column ${c}${a ? ", girl" : ""}${b ? ", boy" : ""}, ${value === -1 ? "thorn" : value === 1 ? picked ? "cherry collected" : "cherry" : "empty"}${r === n - 1 && c === n - 1 ? ", finish" : ""}`}>
                <span className="cell-value">{value === -1 ? "🌵" : value === 1 ? picked ? "✓" : "🍒" : ""}</span>
                {r === n - 1 && c === n - 1 && <span className="garden-finish" aria-hidden="true">🏁</span>}
                <small className="tb-coord">{r},{c}</small>
              </div>;
            }))}
            <svg className="garden-paths" viewBox={`0 0 ${n * 100} ${n * 100}`} aria-hidden="true">
              <polyline className="garden-girl-line" points={path.map((item) => `${(item.step - item.a + 0.5) * 100 - 9},${(item.a + 0.5) * 100}`).join(" ")} />
              <polyline className="garden-boy-line" points={path.map((item) => `${(item.step - item.b + 0.5) * 100 + 9},${(item.b + 0.5) * 100}`).join(" ")} />
            </svg>
            <span className="garden-character garden-girl" role="img" aria-label="Girl" style={{ fontSize: `${Math.min(30, 180 / n)}px`, left: `${(node.step - node.a + 0.5) / n * 100}%`, top: `${(node.a + 0.5) / n * 100}%` }}>👧</span>
            <span className="garden-character garden-boy" role="img" aria-label="Boy" style={{ fontSize: `${Math.min(30, 180 / n)}px`, left: `${(node.step - node.b + 0.5) / n * 100}%`, top: `${(node.b + 0.5) / n * 100}%` }}>👦</span>
          </div>
          <p className="dfs-play-key">👧 Pink trail · 👦 Blue trail<br />🍒 Pick cherries · 🌵 Avoid thorns · 🏁 Reach the finish</p>
          <div className={`dfs-play-message dfs-result-${outcome}`} role="status" aria-live="polite">
            {outcome === "won" ? <><b>🏆 You win!</b><p>The girl and boy reached the flag with {node.total} / {optimum} cherries. You found their best paths!</p></>
              : outcome === "lost" ? <><b>✕ Route failed</b><p>{dead ? "The paths are blocked! Both friends must reach the flag for the route to count." : `The friends reached the flag with ${node.total} / ${optimum} cherries — ${optimum - node.total} short of the target.`} Backtrack to try a different branch, or start a new attempt.</p></>
                : <><b>{node.step === 0 ? "Start exploring" : "Choose the next branch"}</b><p>{notice}</p></>}
          </div>
          <div className="dfs-play-actions">
            <button type="button" className="apply-button" disabled={node.parent === null} onClick={() => { if (node.parent !== null) visit(node.parent); }}>↑ Backtrack one move</button>
            <button type="button" className="edit-grid-button" disabled={state.bestNode === null || state.active === state.bestNode} onClick={() => { if (state.bestNode !== null) visit(state.bestNode); }}>View best trail</button>
            <button type="button" className="edit-grid-button" onClick={() => { setState(startPlay(grid)); setNotice("Fresh tree! Choose a branch to start collecting."); }}>{outcome === "won" ? "Play again ↺" : outcome === "lost" ? "Try again ↺" : "Restart tree ↺"}</button>
          </div>
          {!finished && <details className="dfs-blocked-moves"><summary>Why are some moves missing?</summary>{PLAY_MOVES.map(([da, db]) => {
            const move = playMove(grid, node, da, db);
            return <p key={move.label}>👧 {da ? "↓" : "→"} · 👦 {db ? "↓" : "→"}: {move.reason ?? `open, +${move.gain} cherries`}</p>;
          })}</details>}
        </div>
        <div className="dfs-play-tree-panel">
          <h3>Choose a way through the garden</h3>
          <p>The garden’s branching roads form your DFS tree. Each <b>green circle</b> is a path choice for both friends. Read 👧 and 👦 arrows, then click the circle to send them right → or down ↓. Reach 🏁 with {optimum} cherries to win.</p>
          <div className="dfs-tree-toolbar">
            <span>Step {node.step} · {state.trips} routes finished</span>
            <button type="button" className="edit-grid-button" aria-pressed={fullTree} onClick={() => setFullTree(!fullTree)}>{fullTree ? "Show compact tree" : "Show explored tree"}</button>
          </div>
          {!fullTree && <nav className="dfs-path-crumbs" aria-label="Backtrack to a previous move">
            {path.slice(0, -1).map((item) => <button type="button" key={item.id} onClick={() => visit(item.id)}>↰ {item.step === 0 ? "Start" : `Step ${item.step}`} · {item.total} 🍒</button>)}
          </nav>}
          <GardenMap state={state} fullTree={fullTree} onVisit={visit} />
          <p className="dfs-play-key">Orange trail = chosen path · Green = choose next · Gray = path not taken · Gold edge = best completed trail. Backtrack to a chosen circle to unlock its other branches.</p>
        </div>
      </div>
      <details className="dfs-play-lesson"><summary>How this teaches DFS + memoization</summary>
        <p>Each tree card is a DFS call. Going deeper adds a call to your path; backtracking returns to its parent. Explore a child fully before trying its sibling to follow depth-first order. Backtracking restores cherries for the next branch; it never adds the scores of separate routes.</p>
        <p>The girl represents walker A and the boy represents walker B. Different branches can reach the same (step, row A, row B). Memoization remembers the best future from that state so the solver can reuse it. The trace above shows how the memoized solver reuses those results.</p>
      </details>
    </>
  );
}

export default function DfsTreeGame({ grid, optimum }: { grid: Grid; optimum: number }) {
  const [mode, setMode] = useState<"practice" | "custom" | "random">("practice");
  const [randomGame, setRandomGame] = useState<ReturnType<typeof randomAdventure> | null>(null);
  const [randomId, setRandomId] = useState(0);
  const selectedGrid = mode === "random" && randomGame ? randomGame.grid : mode === "practice" ? PRACTICE : grid;
  const selectedOptimum = mode === "random" && randomGame ? randomGame.optimum : mode === "practice" ? 5 : optimum;
  return (
    <section className="panel calculation-panel dfs-tree-game" aria-labelledby="dfs-game-title">
      <span className="section-kicker">PLAY / CHERRY TREE ADVENTURE</span>
      <h2 id="dfs-game-title">Help the girl and boy find the cherries.</h2>
      <p>You control their paths through the tree. Choose a circle to move both friends through the garden, collect cherries, and reach the flag together. Collect the target to win; if a trail fails, backtrack and choose another path.</p>
      <div className="dfs-game-modes" aria-label="Game grid">
        <button type="button" className="edit-grid-button" aria-pressed={mode === "practice"} onClick={() => setMode("practice")}>Practice · 3 × 3</button>
        <button type="button" className="edit-grid-button" aria-pressed={mode === "custom"} onClick={() => setMode("custom")}>Use my grid · {grid.length} × {grid.length}</button>
        <button type="button" className="edit-grid-button" aria-pressed={mode === "random"} onClick={() => {
          setRandomGame(randomAdventure()); setRandomId((value) => value + 1); setMode("random");
        }}>🎲 Random grid</button>
      </div>
      {mode === "random" && <p role="status">Random garden · {selectedGrid.length} × {selectedGrid.length}. A path to the flag is guaranteed. Click Random grid again for a new adventure.</p>}
      <TreeAdventure key={mode === "random" ? `random-${randomId}` : mode} grid={selectedGrid} optimum={selectedOptimum} />
    </section>
  );
}
