import {
  PLAIN, WALL, SAND, ROUGH, ALGORITHMS,
  createSampleField, makeGrid, generateField, findPath, compareAlgorithms, validateGrid,
} from './pathfinding.mjs';

const $ = id => document.getElementById(id);
const board = $('board');
let {grid, start, goal} = createSampleField();
let brush = 'wall';
let cells = [];
let drawing = false;
let animationId = 0;
let randomSeed = 42;

function cellLabel(x,y) {
  if (start.x === x && start.y === y) return `Start at column ${x + 1}, row ${y + 1}`;
  if (goal.x === x && goal.y === y) return `Goal at column ${x + 1}, row ${y + 1}`;
  return `Column ${x + 1}, row ${y + 1}, ${({0:'wall',1:'clear',3:'sand cost 3',6:'rough cost 6'})[grid[y][x]] ?? 'terrain'}`;
}
function cellClasses(x,y) {
  const value = grid[y][x];
  const c = ['cell'];
  if(value === WALL) c.push('wall');
  if(value === SAND) c.push('sand');
  if(value === ROUGH) c.push('rough');
  if(start.x === x && start.y === y) c.push('start');
  if(goal.x === x && goal.y === y) c.push('goal');
  return c.join(' ');
}
function rebuildBoard() {
  board.replaceChildren();
  board.style.setProperty('--w', String(grid[0].length));
  board.style.aspectRatio = `${grid[0].length}/${grid.length}`;
  cells = [];
  const fragment = document.createDocumentFragment();
  for(let y=0;y<grid.length;y++) {
    const row=[];
    for(let x=0;x<grid[0].length;x++) {
      const c=document.createElement('button');
      c.type='button'; c.className=cellClasses(x,y); c.dataset.x=x; c.dataset.y=y;
      c.setAttribute('role','gridcell'); c.setAttribute('aria-label',cellLabel(x,y));
      c.title=cellLabel(x,y);
      fragment.append(c); row.push(c);
    }
    cells.push(row);
  }
  board.append(fragment);
}
function repaint() {
  for(let y=0;y<grid.length;y++) for(let x=0;x<grid[y].length;x++) {
    const c=cells[y][x]; c.className=cellClasses(x,y);
    c.setAttribute('aria-label',cellLabel(x,y)); c.title=cellLabel(x,y);
  }
}
function resetMetrics() {
  ['cost','steps','expanded','duration','frontier'].forEach(k=>$(`metric-${k}`).textContent='—');
  $('metric-note').textContent='Run a simulation to populate real results.';
  $('run-status').textContent='Ready to simulate';
}
function halt() {
  animationId++;
  $('run').disabled=false; $('compare').disabled=false;
}
function onEdit(x,y) {
  halt();
  if(brush === 'start') { if(x===goal.x && y===goal.y) return; start={x,y}; grid[y][x]=PLAIN; }
  else if(brush === 'goal') { if(x===start.x && y===start.y) return; goal={x,y}; grid[y][x]=PLAIN; }
  else {
    if((start.x===x && start.y===y)||(goal.x===x && goal.y===y))return;
    grid[y][x]=({wall:WALL,erase:PLAIN,sand:SAND,rough:ROUGH})[brush];
  }
  repaint();resetMetrics();
  $('comparison').innerHTML='<p class="empty-compare">Map modified. Compare algorithms to refresh the benchmark.</p>';
}
function inputCell(e) {
  const element=e.target.closest('.cell');
  if(!element || !board.contains(element)) return;
  onEdit(Number(element.dataset.x),Number(element.dataset.y));
}
board.addEventListener('pointerdown',e=>{
  if(e.button!==0) return;
  drawing=true;inputCell(e);drawing=true;e.preventDefault();
});
board.addEventListener('pointerover',e=>{if(drawing) inputCell(e);drawing=true;});
// Touch painting via hit-testing (pointerover is not fired while moving a finger).
board.addEventListener('pointermove',e=>{
  if(!drawing || e.pointerType!=='touch') return;
  const hit=document.elementFromPoint(e.clientX,e.clientY);
  if(hit && hit.closest('.cell')) inputCell({target:hit});
});
window.addEventListener('pointerup',()=>drawing=false);
window.addEventListener('pointercancel',()=>drawing=false);
board.addEventListener('click',e=>{ if(e.detail===0)inputCell(e); }); // keyboard accessibility

for(const button of document.querySelectorAll('[data-brush]')) button.addEventListener('click',()=>{
  brush=button.dataset.brush;
  for(const b of document.querySelectorAll('[data-brush]')) {const selected=b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}
});

function setResult(r) {
  $('metric-cost').textContent=r.cost ?? 'No path';
  $('metric-steps').textContent=r.steps ?? '—';
  $('metric-expanded').textContent=r.expanded.toLocaleString();
  $('metric-duration').textContent=r.runtimeMs.toFixed(2);
  $('metric-frontier').textContent=r.frontierPeak.toLocaleString();
  $('metric-note').textContent=r.found
    ? `${({astar:'A*','dijkstra':'Dijkstra','bfs':'BFS'})[r.algorithm]} explored ${r.expanded} nodes and produced a ${r.steps}-step path at weighted cost ${r.cost}.`
    : 'No valid route exists. Erase a wall to reopen a corridor.';
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function animate(r) {
  halt();
  const token=animationId;
  $('run').disabled=true;$('compare').disabled=true;
  repaint();setResult(r);
  $('run-status').textContent=r.found?'Searching field…':'Scanning for a route…';
  const speeds={1:45,2:22,3:11,4:4,5:0};
  const delay=speeds[Number($('speed').value)] ?? 4;
  let idx=0;
  for(const p of r.visitedOrder) {
    if(token!==animationId) return;
    const cell=cells[p.y][p.x];cell.classList.add('visited');
    if(idx++%((delay===0)?12:1)===0) await sleep(delay);
  }
  if(r.found) {
    for(const p of r.path) {
      if(token!==animationId)return;
      cells[p.y][p.x].classList.add('path');
      await sleep(Math.max(5,delay));
    }
  }
  if(token!==animationId)return;
  $('run-status').textContent=r.found?'Route successfully computed':'No route available';
  $('run').disabled=false;$('compare').disabled=false;
}
$('run').addEventListener('click',()=>{
  const result=findPath(grid,start,goal,$('algorithm').value);
  animate(result);
});
$('speed').addEventListener('input',()=>{
  $('speed-label').textContent=['','Slow','Steady','Medium','Fast','Instant'][Number($('speed').value)];
});

function renderComparison(results){
  const bestCost=Math.min(...results.filter(r=>r.found).map(r=>r.cost));
  const bestSteps=Math.min(...results.filter(r=>r.found).map(r=>r.steps));
  $('comparison').replaceChildren();
  const header=document.createElement('div');header.className='compare-grid compare-labels';
  for(const title of ['ALGORITHM','COST','STEPS','EXPLORED','TIME']){
    const s=document.createElement('span');s.textContent=title;header.append(s);
  }
  $('comparison').append(header);
  for(const r of results) {
    const row=document.createElement('div');row.className='compare-grid compare-result';
    const name=document.createElement('span');name.className='compare-algo';name.textContent=({astar:'A* search',dijkstra:'Dijkstra',bfs:'Breadth-first'})[r.algorithm];row.append(name);
    for(const [key,value] of [ ['cost',r.cost],['steps',r.steps],['expanded',r.expanded],['runtimeMs',r.runtimeMs.toFixed(2)+' ms']]) {
      const c=document.createElement('span');
      c.textContent=value===null?'—':String(value);
      if((key==='cost' && r.cost===bestCost)||(key==='steps' && r.steps===bestSteps)){
        const strong=document.createElement('strong');strong.textContent=c.textContent;c.replaceChildren(strong);
      }
      row.append(c);
    }
    $('comparison').append(row);
  }
  const foot=document.createElement('p');foot.className='comparison-message';
  foot.textContent='Green values mark the lowest weighted cost or fewest steps. Runtime can vary with your browser, machine, and page load.';
  $('comparison').append(foot);
}
$('compare').addEventListener('click',()=>{
  halt();repaint();
  const results=compareAlgorithms(grid,start,goal);
  renderComparison(results);
  setResult(results[0]);
  $('run-status').textContent='Comparison ready — visualize any algorithm';
});
function replaceField(field) {halt();({grid,start,goal}=field);rebuildBoard();resetMetrics();$('comparison').innerHTML='<p class="empty-compare">Select “Compare all algorithms” to see route efficiency side by side.</p>';}
$('sample').addEventListener('click',()=>replaceField(createSampleField()));
$('clear').addEventListener('click',()=>replaceField({grid:makeGrid(24,16),start:{x:2,y:8},goal:{x:21,y:8}}));
$('random').addEventListener('click',()=>replaceField(generateField(24,16,++randomSeed*527,.25)));
$('export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({version:1,grid,start,goal},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='roverroute-map.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try {
    if(file.size>200_000)throw new Error('File too large.');
    const field=JSON.parse(await file.text());
    validateGrid(field.grid,field.start,field.goal);
    if(field.grid.length!==16||field.grid[0].length!==24)throw new Error('Only 24 × 16 maps are supported in this studio.');
    if(field.grid.some(row=>row.some(v=>![0,1,3,6].includes(v))))throw new Error('Terrain must use costs 0, 1, 3, or 6.');
    replaceField(field);
    $('run-status').textContent='Imported map loaded';
  } catch(err) {alert(`Could not import map: ${err.message}`);}
  e.target.value='';
});
rebuildBoard();
