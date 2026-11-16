/**
 * Pure, testable graph-search implementations for a 4-connected grid.
 * Cell weights are the cost of ENTERING a cell; obstacles have weight 0.
 * The lower bound for any passable step is 1, making Manhattan admissible for A*.
 */
export const WALL = 0;
export const PLAIN = 1;
export const SAND = 3;
export const ROUGH = 6;
export const ALGORITHMS = ['astar', 'dijkstra', 'bfs'];

export function pointKey({ x, y }) { return `${x},${y}`; }
export function inside(grid, { x, y }) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}
export function neighbors(grid, point) {
  const positions = [
    {x: point.x + 1, y: point.y},
    {x: point.x, y: point.y + 1},
    {x: point.x - 1, y: point.y},
    {x: point.x, y: point.y - 1},
  ];
  return positions.filter(p => inside(grid, p) && grid[p.y][p.x] !== WALL);
}
export function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
export function makeGrid(width = 24, height = 16) {
  return Array.from({length: height}, () => Array(width).fill(PLAIN));
}

export function validateGrid(grid, start, goal) {
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length) throw new Error('Grid must be a non-empty rectangle.');
  const width = grid[0].length;
  if (grid.some(row => !Array.isArray(row) || row.length !== width || row.some(weight => !Number.isFinite(weight) || weight < 0))) throw new Error('Grid dimensions or weights are invalid.');
  if (!inside(grid, start) || !inside(grid, goal)) throw new Error('Start and goal must be within the grid.');
  if (grid[start.y][start.x] === WALL || grid[goal.y][goal.x] === WALL) throw new Error('Start and goal must be passable.');
  if (grid.some(row => row.some(weight => weight > 0 && weight < 1))) throw new Error('Passable terrain costs must be >= 1.');
}

class PriorityQueue {
  constructor() { this.values = []; }
  get size() { return this.values.length; }
  push(value) {
    const a = this.values;
    a.push(value);
    let i = a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (PriorityQueue.compare(a[p], a[i]) <= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.values;
    if (a.length === 0) return null;
    const result = a[0];
    const end = a.pop();
    if (a.length) {
      a[0] = end;
      let i = 0;
      while (true) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < a.length && PriorityQueue.compare(a[left], a[smallest]) < 0) smallest = left;
        if (right < a.length && PriorityQueue.compare(a[right], a[smallest]) < 0) smallest = right;
        if (smallest === i) break;
        [a[i], a[smallest]] = [a[smallest], a[i]];
        i = smallest;
      }
    }
    return result;
  }
  static compare(a, b) { return a.priority - b.priority || a.order - b.order; }
}

function reconstruct(parent, pointByKey, goalKey) {
  const path = [];
  let current = goalKey;
  while (current !== undefined) {
    path.push(pointByKey.get(current));
    current = parent.get(current);
  }
  return path.reverse();
}

/**
 * @param {number[][]} grid - 0 indicates wall; positive entries are traversal costs.
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} goal
 * @param {'astar'|'dijkstra'|'bfs'} algorithm
 */
export function findPath(grid, start, goal, algorithm = 'astar') {
  validateGrid(grid, start, goal);
  if (!ALGORITHMS.includes(algorithm)) throw new Error('Unsupported algorithm.');
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const startKey = pointKey(start);
  const goalKey = pointKey(goal);
  const visitedOrder = [];
  const parent = new Map();
  const pointByKey = new Map([[startKey, {...start}]]);
  const score = new Map([[startKey, 0]]);
  const explored = new Set();
  let frontierPeak = 1;
  let found = false;

  if (algorithm === 'bfs') {
    const queue = [{...start}];
    let head = 0;
    const discovered = new Set([startKey]);
    while (head < queue.length) {
      const point = queue[head++];
      const key = pointKey(point);
      visitedOrder.push(point);
      if (key === goalKey) { found = true; break; }
      for (const next of neighbors(grid, point)) {
        const nextKey = pointKey(next);
        if (discovered.has(nextKey)) continue;
        discovered.add(nextKey);
        parent.set(nextKey, key);
        pointByKey.set(nextKey, next);
        score.set(nextKey, score.get(key) + 1);
        queue.push(next);
      }
      frontierPeak = Math.max(frontierPeak, queue.length - head);
    }
  } else {
    const heap = new PriorityQueue();
    let order = 0;
    heap.push({point: {...start}, priority: algorithm === 'astar' ? manhattan(start, goal) : 0, g: 0, order: order++});
    while (heap.size) {
      const current = heap.pop();
      const point = current.point;
      const key = pointKey(point);
      if (explored.has(key) || current.g !== score.get(key)) continue;
      explored.add(key);
      visitedOrder.push(point);
      if (key === goalKey) { found = true; break; }
      for (const next of neighbors(grid, point)) {
        const nextKey = pointKey(next);
        const candidate = current.g + grid[next.y][next.x];
        if (candidate >= (score.get(nextKey) ?? Infinity)) continue;
        score.set(nextKey, candidate);
        parent.set(nextKey, key);
        pointByKey.set(nextKey, next);
        const h = algorithm === 'astar' ? manhattan(next, goal) : 0;
        heap.push({point: next, priority: candidate + h, g: candidate, order: order++});
      }
      frontierPeak = Math.max(frontierPeak, heap.size);
    }
  }
  const path = found ? reconstruct(parent, pointByKey, goalKey) : [];
  // BFS optimizes steps; actual terrain cost is reported for apples-to-apples comparison.
  const totalCost = found ? path.slice(1).reduce((acc, p) => acc + grid[p.y][p.x], 0) : null;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    algorithm, found, path, visitedOrder, steps: found ? path.length - 1 : null,
    cost: totalCost, expanded: visitedOrder.length, frontierPeak,
    runtimeMs: Number((now - t0).toFixed(3)),
  };
}

export function compareAlgorithms(grid, start, goal) {
  return ALGORITHMS.map(name => findPath(grid, start, goal, name));
}

export function createSampleField(width = 24, height = 16) {
  const grid = makeGrid(width, height);
  const wall = (x, y) => { if (y < height && x < width) grid[y][x] = WALL; };
  for (let y = 1; y <= 12; y++) if (![3, 10].includes(y)) wall(7, y);
  for (let y = 3; y <= 14; y++) if (![5, 12].includes(y)) wall(15, y);
  for (let x = 10; x <= 19; x++) if (![12, 17].includes(x)) wall(x, 7);
  for (let y = 2; y <= 5; y++) for (let x = 9; x <= 12; x++) grid[y][x] = SAND;
  for (let y = 9; y <= 13; y++) for (let x = 17; x <= 20; x++) grid[y][x] = ROUGH;
  const start = {x: 2, y: 8};
  const goal = {x: width - 3, y: 8};
  grid[start.y][start.x] = grid[goal.y][goal.x] = PLAIN;
  return {grid, start, goal};
}

/** Deterministic random map, with a guaranteed path by retrying bounded layouts. */
export function generateField(width, height, seed = 1337, density = 0.22) {
  let state = seed >>> 0;
  const rand = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  const start = {x: 1, y: Math.floor(height / 2)};
  const goal = {x: width - 2, y: Math.floor(height / 2)};
  for (let attempt = 0; attempt < 100; attempt++) {
    const grid = makeGrid(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if ((x === start.x && y === start.y) || (x === goal.x && y === goal.y)) continue;
      const n = rand();
      grid[y][x] = n < density ? WALL : n < density + 0.10 ? SAND : n < density + 0.15 ? ROUGH : PLAIN;
    }
    if (findPath(grid, start, goal).found) return {grid, start, goal};
  }
  return createSampleField(width, height);
}
