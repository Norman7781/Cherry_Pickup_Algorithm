import type { Grid } from "./presets";

export type PlayNode = {
  id: number;
  parent: number | null;
  step: number;
  a: number;
  b: number;
  gain: number;
  total: number;
  move: string;
  visited: boolean;
  children: number[];
};
export type PlayState = { nodes: PlayNode[]; active: number; best: number | null; bestNode: number | null; trips: number };
export const PLAY_MOVES = [[0, 0], [0, 1], [1, 0], [1, 1]] as const;

export function playMove(grid: Grid, node: Pick<PlayNode, "step" | "a" | "b">, da: number, db: number) {
  const step = node.step + 1;
  const a = node.a + da;
  const b = node.b + db;
  const ca = step - a;
  const cb = step - b;
  const label = `A ${da ? "↓" : "→"} · B ${db ? "↓" : "→"}`;
  if (step > 2 * (grid.length - 1)) return { label, reason: "Already at the finish", gain: 0, step, a, b };
  if (grid[a]?.[ca] === undefined || grid[b]?.[cb] === undefined) return { label, reason: "Outside the grid", gain: 0, step, a, b };
  if (grid[a][ca] === -1 || grid[b][cb] === -1) return { label, reason: "Blocked by a thorn", gain: 0, step, a, b };
  return { label, reason: null, gain: grid[a][ca] + (a === b ? 0 : grid[b][cb]), step, a, b };
}

function expand(grid: Grid, nodes: PlayNode[], id: number) {
  const node = nodes[id];
  if (node.children.length || node.step === 2 * (grid.length - 1)) return;
  for (const [da, db] of PLAY_MOVES) {
    const move = playMove(grid, node, da, db);
    if (move.reason) continue;
    const childId = nodes.length;
    nodes.push({ id: childId, parent: id, step: move.step, a: move.a, b: move.b, gain: move.gain, total: node.total + move.gain, move: move.label, visited: false, children: [] });
    node.children.push(childId);
  }
}

export function startPlay(grid: Grid): PlayState {
  const nodes: PlayNode[] = [{ id: 0, parent: null, step: 0, a: 0, b: 0, gain: grid[0][0], total: grid[0][0], move: "Start · A + B", visited: true, children: [] }];
  expand(grid, nodes, 0);
  return { nodes, active: 0, best: null, bestNode: null, trips: 0 };
}

export function visitPlay(grid: Grid, state: PlayState, id: number): PlayState {
  const target = state.nodes[id];
  if (!target || (!target.visited && target.parent !== state.active)) return state;
  const nodes = state.nodes.map((node) => ({ ...node, children: [...node.children] }));
  const firstFinish = !target.visited && target.step === 2 * (grid.length - 1);
  nodes[id].visited = true;
  expand(grid, nodes, id);
  const improve = firstFinish && (state.best === null || target.total > state.best);
  return { nodes, active: id, trips: state.trips + Number(firstFinish), best: improve ? target.total : state.best, bestNode: improve ? id : state.bestNode };
}

export function playPath(state: PlayState, id = state.active) {
  const path: PlayNode[] = [];
  for (let node: PlayNode | undefined = state.nodes[id]; node; node = node.parent === null ? undefined : state.nodes[node.parent]) path.unshift(node);
  return path;
}

export function playOutcome(grid: Grid, state: PlayState, target: number): "playing" | "won" | "lost" {
  const node = state.nodes[state.active];
  if (node.step === 2 * (grid.length - 1)) return node.total === target ? "won" : "lost";
  return node.children.length === 0 ? "lost" : "playing";
}

export function randomAdventure(size = 3 + Math.floor(Math.random() * 3)) {
  const grid: Grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => {
      const roll = Math.random();
      return roll < 0.18 ? -1 : roll < 0.72 ? 1 : 0;
    }),
  );
  // Carve an open path so every generated game can be won.
  let row = 0;
  let col = 0;
  grid[0][0] = 0;
  while (row < size - 1 || col < size - 1) {
    if (row === size - 1 || (col < size - 1 && Math.random() < 0.5)) col++;
    else row++;
    grid[row][col] = Math.random() < 0.7 ? 1 : 0;
  }
  grid[size - 1][size - 1] = 1;

  const memo = new Map<string, number>();
  function future(step: number, a: number, b: number): number {
    if (step === 2 * (size - 1)) return 0;
    const key = `${step},${a},${b}`;
    if (memo.has(key)) return memo.get(key)!;
    let best = Number.NEGATIVE_INFINITY;
    for (const [da, db] of PLAY_MOVES) {
      const move = playMove(grid, { step, a, b }, da, db);
      if (!move.reason) best = Math.max(best, move.gain + future(move.step, move.a, move.b));
    }
    memo.set(key, best);
    return best;
  }
  return { grid, optimum: grid[0][0] + future(0, 0, 0) };
}
