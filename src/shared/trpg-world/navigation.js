// Engine-independent local navigation. The browser and authoritative server share
// the authored AABBs; NPCs use deterministic A* rather than walking through walls.
export const distance = (a, b) => Math.hypot(a[0] - b[0], (a[1] || 0) - (b[1] || 0), a[2] - b[2]);
const validPosition = position => Array.isArray(position) && position.length === 3 && position.every(Number.isFinite);
export function hasLineOfSight(region,from,to) {
  if (!validPosition(from) || !validPosition(to)) return false;
  const d=distance(from,to),steps=Math.max(1,Math.ceil(d/.7));
  for(let i=1;i<steps;i++) {
    const t=i/steps,x=from[0]+(to[0]-from[0])*t,z=from[2]+(to[2]-from[2])*t,y=(from[1]||0)+((to[1]||0)-(from[1]||0))*t+1.4;
    if((region.obstacles||[]).some(o=>y<(o.height||3)&&Math.abs(x-o.x)<o.width/2&&Math.abs(z-o.z)<o.depth/2))return false;
  }
  return true;
}
const radius = 0.45;
export function canOccupy(region, position, bodyRadius = radius) {
  if (!validPosition(position) || !Number.isFinite(bodyRadius) || bodyRadius < 0) return false;
  const half = (region.size || 160) / 2 - bodyRadius;
  if (Math.abs(position[0]) > half || Math.abs(position[2]) > half || position[1] < 0 || position[1] > 24) return false;
  // Keep a tiny numerical tolerance at an AABB boundary. Swept steps can land
  // one ULP inside an otherwise valid tangent, which would make a doorway or
  // path corner permanently sticky even though the authored clearance is safe.
  const epsilon = 1e-6;
  return !(region.obstacles || []).some(o => position[1] < (o.height || 3) + 0.3 &&
    Math.abs(position[0] - o.x) < o.width / 2 + bodyRadius - epsilon && Math.abs(position[2] - o.z) < o.depth / 2 + bodyRadius - epsilon);
}
export function moveBody(region, position, delta) {
  if (!validPosition(position) || !validPosition(delta)) throw new TypeError('Movement requires finite three-dimensional vectors.');
  const result = [...position];
  // Swept substeps prevent tunnelling even during coarse offline updates.
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / 0.35));
  for (let i = 0; i < steps; i++) {
    const step = [delta[0] / steps, delta[1] / steps, delta[2] / steps];
    // Try the complete step first, then both axis orders and individual
    // slides. A fixed X-then-Z order can get wedged on a building corner:
    // the first axis reaches the expanded wall while the second axis cannot
    // move far enough to clear it. All candidates still pass the same swept
    // body test, and choosing by progress preserves deterministic wall sliding.
    const candidates = [];
    const add = (candidate) => {
      candidate[1] = Math.max(0, Math.min(24, candidate[1]));
      if (canOccupy(region, candidate)) candidates.push(candidate);
    };
    add([result[0] + step[0], result[1] + step[1], result[2] + step[2]]);
    const xFirst = [...result]; xFirst[0] += step[0]; if (canOccupy(region, xFirst)) xFirst[2] += step[2]; add(xFirst);
    const zFirst = [...result]; zFirst[2] += step[2]; if (canOccupy(region, zFirst)) zFirst[0] += step[0]; add(zFirst);
    add([result[0] + step[0], result[1] + step[1], result[2]]);
    add([result[0], result[1] + step[1], result[2] + step[2]]);
    add([result[0], result[1] + step[1], result[2]]);
    if (candidates.length) {
      const score = candidate => {
        const moved = [candidate[0] - result[0], candidate[1] - result[1], candidate[2] - result[2]];
        return moved[0] * step[0] + moved[1] * step[1] + moved[2] * step[2];
      };
      result.splice(0, 3, ...candidates.reduce((best, candidate) => score(candidate) > score(best) ? candidate : best));
    }
  }
  return result;
}
function lineClear(region, from, to) {
  if (!canOccupy(region, from) || !canOccupy(region, to)) return false;
  // Sweep the body against each expanded rectangle. Sampling points can miss a
  // thin wall or a corner even when both grid nodes are individually walkable.
  for (const obstacle of region.obstacles || []) {
    if (Math.min(from[1], to[1]) >= (obstacle.height || 3) + .3) continue;
    let enter = 0, leave = 1;
    for (const [axis, centre, extent] of [[0, obstacle.x, obstacle.width / 2 + radius], [2, obstacle.z, obstacle.depth / 2 + radius]]) {
      const delta = to[axis] - from[axis], low = centre - extent, high = centre + extent;
      if (Math.abs(delta) < 1e-12) {
        if (from[axis] <= low || from[axis] >= high) { enter = 1; leave = 0; break; }
      } else {
        const a = (low - from[axis]) / delta, b = (high - from[axis]) / delta;
        enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
      }
    }
    if (enter < leave && leave > 0 && enter < 1) return false;
  }
  return true;
}
export function findPath(region, from, target) {
  if (!canOccupy(region, from) || !canOccupy(region, target)) return [];
  if (lineClear(region, from, target)) return [[...target]];
  const step = 2, bound = Math.floor(((region.size || 160) / 2 - 1) / step);
  const key = (x, z) => `${x},${z}`, parse = k => k.split(',').map(Number);
  const end = [Math.round(target[0] / step), Math.round(target[2] / step)];
  // An accessible doorway can round to a blocked grid cell. Connect both exact
  // endpoints to visible nearby cells instead of requiring the rounded cell.
  const connections = position => {
    const cells = [], x = Math.round(position[0] / step), z = Math.round(position[2] / step);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const nx = x + dx, nz = z + dz, point = [nx * step, 0, nz * step];
      if (Math.abs(nx) <= bound && Math.abs(nz) <= bound && lineClear(region, position, point)) cells.push({k:key(nx,nz),point});
    }
    return cells;
  };
  const starts = connections(from), ends = new Set(connections(target).map(cell => cell.k));
  if (!starts.length || !ends.size) return [];
  const open = starts.map(({k,point}) => ({k,g:distance(from,point)/step,f:(distance(from,point)+distance(point,target))/step}));
  const scores = new Map(open.map(cell => [cell.k,cell.g])), parents = new Map(), closed = new Set();
  const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (let iteration = 0; open.length && iteration < 9000; iteration++) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const current = open.splice(best, 1)[0];
    if (closed.has(current.k)) continue;
    if (ends.has(current.k)) {
      const points = [[...target]]; let cursor = current.k;
      while (cursor) { const [x,z] = parse(cursor); points.push([x * step,0,z * step]); cursor = parents.get(cursor); }
      points.reverse();
      // Only turn corners when direct line-of-sight is safe.
      const smoothed = []; let origin = from, index = 0;
      while (index < points.length) {
        let far = index;
        while (far + 1 < points.length && lineClear(region, origin, points[far + 1])) far++;
        smoothed.push(points[far]); origin = points[far]; index = far + 1;
      }
      return smoothed;
    }
    closed.add(current.k); const [x,z] = parse(current.k);
    for (const [dx,dz] of directions) {
      const nx = x + dx, nz = z + dz, nextKey = key(nx,nz);
      if (Math.abs(nx) > bound || Math.abs(nz) > bound || closed.has(nextKey) || !canOccupy(region,[nx * step,0,nz * step])) continue;
      if (dx && dz && (!canOccupy(region,[(x + dx) * step,0,z * step]) || !canOccupy(region,[x * step,0,(z + dz) * step]))) continue;
      if (!lineClear(region,[x * step,0,z * step],[nx * step,0,nz * step])) continue;
      const g = current.g + Math.hypot(dx,dz);
      if (g >= (scores.get(nextKey) ?? Infinity)) continue;
      scores.set(nextKey,g); parents.set(nextKey,current.k);
      open.push({k:nextKey,g,f:g + Math.hypot(nx - end[0],nz - end[1])});
    }
  }
  return [];
}
export function followPath(region, entity, target, metres) {
  if (!entity.path || !entity.pathTarget || distance(entity.pathTarget,target) > 1.5) {
    entity.path = findPath(region,entity.position,target); entity.pathTarget = [...target];
  }
  let budget = Math.min(metres, (region.size || 160) * 4);
  while (entity.path.length && budget > 0) {
    const point = entity.path[0], d = distance(entity.position,point);
    if (d < 0.08) { entity.path.shift(); continue; }
    const amount = Math.min(d,budget), before = entity.position;
    entity.position = moveBody(region,before,[(point[0]-before[0])/d*amount,0,(point[2]-before[2])/d*amount]);
    const moved = distance(before,entity.position); budget -= amount;
    if (moved < amount * .2) { entity.path = []; break; }
    if (amount >= d) entity.path.shift();
  }
}
