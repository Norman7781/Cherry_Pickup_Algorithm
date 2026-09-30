export type Grid = number[][];

export const PRESETS: Record<string, Grid> = {
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
