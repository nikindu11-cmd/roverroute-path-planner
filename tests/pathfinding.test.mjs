import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGrid, findPath, createSampleField, generateField, compareAlgorithms, validateGrid} from '../pathfinding.mjs';

test('all algorithms find shortest open-field path', () => {
  const grid = makeGrid(8, 6);
  for (const algorithm of ['astar','dijkstra','bfs']) {
    const result = findPath(grid, {x:0,y:0}, {x:7,y:5}, algorithm);
    assert.equal(result.found, true);
    assert.equal(result.steps, 12);
    assert.equal(result.cost, 12);
    assert.deepEqual(result.path[0], {x:0,y:0});
  }
});

test('A* and Dijkstra minimize terrain cost; BFS minimizes steps only', () => {
  const grid = [[1,6,6,6,1],[1,1,1,1,1],[1,1,1,1,1]];
  const start = {x:0,y:0}, goal = {x:4,y:0};
  const bfs = findPath(grid,start,goal,'bfs');
  const dijkstra = findPath(grid,start,goal,'dijkstra');
  const astar = findPath(grid,start,goal,'astar');
  assert.equal(bfs.steps, 4);
  assert.equal(bfs.cost, 19);
  assert.equal(dijkstra.cost, 6);
  assert.equal(astar.cost, 6);
  assert.equal(dijkstra.steps, 6);
});

test('unreachable goals are reported correctly', () => {
  const grid = [[1,0,1],[1,0,1],[1,0,1]];
  const results = compareAlgorithms(grid,{x:0,y:0},{x:2,y:2});
  for (const r of results) { assert.equal(r.found, false); assert.equal(r.cost, null); assert.deepEqual(r.path, []); }
});

test('start equals goal has zero cost', () => {
  const p={x:2,y:2};
  for(const r of compareAlgorithms(makeGrid(4,4),p,p)) { assert.equal(r.cost,0); assert.equal(r.steps,0); }
});

test('grid and endpoints are validated', () => {
  assert.throws(() => validateGrid([[1,2],[1]],{x:0,y:0},{x:0,y:1}));
  assert.throws(() => findPath([[0,1]],{x:0,y:0},{x:1,y:0}));
  assert.throws(() => findPath(makeGrid(3,3),{x:0,y:0},{x:2,y:2},'unknown'));
});

test('sample and generated fields are solvable', () => {
  for(const field of [createSampleField(), generateField(24,16,100), generateField(24,16,11,.30)]) {
    assert.equal(findPath(field.grid,field.start,field.goal).found,true);
  }
});

test('A* and Dijkstra agree on randomized weighted maps', () => {
  for(let i=1;i<=60;i++) {
    const f=generateField(16,12,i*1234,.21);
    const a=findPath(f.grid,f.start,f.goal,'astar');
    const d=findPath(f.grid,f.start,f.goal,'dijkstra');
    assert.equal(a.cost,d.cost,`Disagreement on seed ${i}`);
  }
});
