"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { Grid } from "../presets";

type Point = { row: number; col: number };
type Move = "right" | "down";

// Only choose moves that can still reach the finish, so a round never traps a walker.
function makeRoutes(grid: Grid, seed: number) {
  const n = grid.length;
  const reachable = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  for (let r = n - 1; r >= 0; r--) {
    for (let c = n - 1; c >= 0; c--) {
      reachable[r][c] = grid[r][c] !== -1 && (
        (r === n - 1 && c === n - 1) ||
        (reachable[r + 1]?.[c] ?? false) || (reachable[r][c + 1] ?? false)
      );
    }
  }
  if (!reachable[0][0]) return null;
  return [0, 1].map((walker) => {
    const route: Point[] = [{ row: 0, col: 0 }];
    let random = (seed + 1) * 7919 + walker * 104729;
    while (route.length < 2 * n - 1) {
      const { row, col } = route[route.length - 1];
      const options = [{ row, col: col + 1 }, { row: row + 1, col }]
        .filter((point) => reachable[point.row]?.[point.col]);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const choice = options.length === 1 ? 0 : ((random >>> 16) + walker) % options.length;
      route.push(options[choice]);
    }
    return route;
  });
}

export default function MovementGame({ grid }: { grid: Grid }) {
  const [seed, setSeed] = useState(0);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"watch" | "guess">("watch");
  const [revealed, setRevealed] = useState(false);
  const [guessA, setGuessA] = useState<Move | null>(null);
  const [guessB, setGuessB] = useState<Move | null>(null);
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const routes = useMemo(() => makeRoutes(grid, seed), [grid, seed]);
  const n = grid.length;
  const lastStep = 2 * (n - 1);
  const finished = step === lastStep;
  const starts = routes?.map((route) => route[step]) ?? [];
  const targets = routes?.map((route) => route[Math.min(step + 1, lastStep)]) ?? [];
  const moves = starts.map((start, i): Move => start.row === targets[i].row ? "right" : "down");

  function clearRound() {
    setRevealed(false); setGuessA(null); setGuessB(null); setFeedback(""); setAttempted(false);
  }
  function restart(nextMode = mode) {
    setMode(nextMode); setStep(0); setScore(0); setAttempts(0); clearRound();
  }
  function check() {
    if (!guessA || !guessB || revealed) return;
    if (!attempted) { setAttempts((value) => value + 1); setAttempted(true); }
    if (guessA !== moves[0] || guessB !== moves[1]) {
      setFeedback(`${guessA === moves[0] ? "A is correct." : "Look again at A’s next square."} ${guessB === moves[1] ? "B is correct." : "Look again at B’s next square."} Across means right; below means down. Try again, or watch the answer.`);
      return;
    }
    if (!attempted) setScore((value) => value + 1);
    setRevealed(true);
    setFeedback(`Correct! A moves ${moves[0]} and B moves ${moves[1]}.`);
  }

  return (
    <section className="movement-game" aria-label="Independent movement guessing game">
      <h3>A & B: watch and guess their moves</h3>
      <p>This game follows one continuous trip from start to finish. It has its own controls and score.</p>
      <div className="movement-mode" aria-label="Movement game mode">
        <button aria-pressed={mode === "watch"} onClick={() => restart("watch")}>Watch the walkers</button>
        <button aria-pressed={mode === "guess"} onClick={() => restart("guess")}>Guess their moves</button>
      </div>
      <p><b>Right →</b> = one square across. <b>Down ↓</b> = one square below. Both walkers move once per turn. They can share a square, but cannot enter a thorn.</p>
      {!routes ? <p className="movement-lesson">This grid has no open route from start to finish. Edit the grid or choose another scenario to play.</p> : <>
        <div className="movement-lesson">
          <b>{finished ? "Both walkers reached the finish!" : mode === "watch" ? `Watch turn ${step + 1}` : `Guess turn ${step + 1}: which way will each walker go?`}</b>
          {!finished && <p>{revealed ? `A moves ${moves[0]} ${moves[0] === "right" ? "→" : "↓"}; B moves ${moves[1]} ${moves[1] === "right" ? "→" : "↓"}.` : mode === "guess" ? "The squares marked A next and B next show their next positions. Guess the direction from each walker to its next square." : "Press Play this move to watch A and B move together."}</p>}
          <p>Journey: {finished ? lastStep : step + (revealed ? 1 : 0)} / {lastStep} moves{mode === "guess" && ` · First-try score: ${score} / ${attempts}`}</p>
        </div>
        <div className="movement-board" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {grid.flatMap((row, r) => row.map((value, c) => {
            const nextA = !finished && targets[0].row === r && targets[0].col === c;
            const nextB = !finished && targets[1].row === r && targets[1].col === c;
            return <div key={`${r}-${c}`} className={`movement-square ${value === -1 ? "movement-blocked" : ""} ${nextA || nextB ? "movement-active-goal" : ""}`}>
              <span>{value === -1 ? "🚫" : value === 1 ? "🍒" : ""}</span>
              <small>{r},{c}</small>
              {(nextA || nextB) && <em>{nextA && nextB ? "A+B next" : nextA ? "A next" : "B next"}</em>}
            </div>;
          }))}
          {starts.map((start, index) => {
            const position = revealed ? targets[index] : start;
            return <span key={`${seed}-${mode}-${step}-${index}-${revealed}`} aria-label={`${index === 0 ? "A" : "B"} at row ${position.row}, column ${position.col}`}
              className={`movement-token movement-token-${index} ${revealed ? "movement-animate" : ""}`} style={{
                left: `${(position.col + 0.5) / n * 100}%`, top: `${(position.row + 0.5) / n * 100}%`,
                "--from-left": `${(start.col + 0.5) / n * 100}%`, "--from-top": `${(start.row + 0.5) / n * 100}%`,
              } as CSSProperties}>{index === 0 ? "A" : "B"}</span>;
          })}
        </div>
        {mode === "guess" && !finished && !revealed && <div className="movement-directions">
          {[{ name: "A", value: guessA, set: setGuessA }, { name: "B", value: guessB, set: setGuessB }].map(({ name, value, set }) => <fieldset key={name}>
            <legend>Which way will {name} move?</legend>
            {(["right", "down"] as const).map((move) => <button type="button" key={move} aria-pressed={value === move} onClick={() => set(move)}>{move === "right" ? "Right →" : "Down ↓"}</button>)}
          </fieldset>)}
        </div>}
        <div className="movement-actions">
          {!finished && !revealed && (mode === "watch" ? <button className="apply-button" onClick={() => setRevealed(true)}>Play this move ▶</button> : <>
            <button className="apply-button" disabled={!guessA || !guessB} onClick={check}>Check my guesses</button>
            <button className="apply-button" onClick={() => {
              if (!attempted) { setAttempts((value) => value + 1); setAttempted(true); }
              setRevealed(true); setFeedback(`Watch: A moves ${moves[0]}, B moves ${moves[1]}.`);
            }}>Show me the moves</button>
          </>)}
          {!finished && revealed && <button className="apply-button" onClick={() => { setStep(step + 1); clearRound(); }}>{step + 1 === lastStep ? "Finish journey ✓" : "Next turn →"}</button>}
          <button className="apply-button" onClick={() => restart()}>Restart journey ↺</button>
          <button className="apply-button" onClick={() => { setSeed(seed + 1); restart(); }}>New journey ↗</button>
        </div>
        <p role="status">{feedback}</p>
        {finished && <p>Try another journey, or switch between watching and guessing. Each turn continues from the last position.</p>}
      </>}
    </section>
  );
}
