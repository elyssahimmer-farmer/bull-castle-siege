// land.js: the land and the water of the Siege of the Bull Castle (DESIGN.md 1, 2, 7, 9; research.md 3).
// The moat (still green-grey, soft ripples, a pale lapping edge, a little sparkle, gold at dusk), woods of chunky
// blocky trees in clumps along the woods' edges west, east and north (instanced, swaying) with one faceted canopy over
// the body of each wood (static, its edges sloping down behind the edge trees), a few hedges and ridge-and-furrow field strips, wildflowers in the meadow, bushes on the moat's banks, reeds at its
// corners, smoke from the camp's cooking fires, crows (CHARACTERS.crow: a few circling over the north and west woods,
// a flock perched in the east wood that bursts up when tapped), and the night mist that rolls in over the field
// (152-164), covers it while the siege is put back (164-174) and lifts at dawn (0-12), from ctx.mistAt.
// Everything moving is a pure function of the clock. Keeps clear of the castle, the bridges, the trodden ways, the
// pavises, the guns, the trebuchets, the camp, the meadow fight and the routes (SIEGE).
// Labels: moat (two places on the water), crows (the east flock, whose tap moment is the burst; the north group).
// For checking: ?crowsAt=seconds starts the crows' tap moment at that clock time.
(function () {
  'use strict';

  // The crow is one of the approved characters. They load with people.js or armies.js; when land.js is loaded alone
  // (?only=land) it fetches the crow itself. A script added before the page's load event holds that event back, so
  // the crows are ready before the first frame either way.
  if (!(window.CHARACTERS && window.CHARACTERS.crow)) {
    const s = document.createElement('script');
    s.src = 'characters/crow.js';
    document.head.appendChild(s);
  }

  const TAU = Math.PI * 2;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const sm = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
  const win = (s, a, b, e) => sm((s - a) / e) * (1 - sm((s - (b - e)) / e));
  const lerp = (a, b, k) => a + (b - a) * k;

  // the camp's cooking fires: siegeworks.js builds them and shares them on ctx.siege.camp.fires (it loads after this
  // file, so the smoke picks its list up on the first frame); these are its positions as built, [x, z]
  let FIRES = [[-16, 69], [-27.5, 74.5], [13, 73]];
  const MAX_FIRES = 6;

  const S = {};   // everything update() needs

  window.Scene.register({
    name: 'land',

    init(ctx) {
      const { THREE, SIEGE, C } = ctx;
      const lin = ctx.lin, hash = ctx.hash, groundY = ctx.groundY;
      const H = (x, z, s) => hash(Math.round(x * 100) / 100, 0.5, Math.round(z * 100) / 100, s);
      const M = SIEGE.moat;
      const rrectSD = (x, z, R) => {
        const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, hx = (R.x1 - R.x0) / 2 - R.r, hz = (R.z1 - R.z0) / 2 - R.r;
        const qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz;
        return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - R.r;
      };
      const inRect = (x, z, R, pad) => x > R.x0 - pad && x < R.x1 + pad && z > R.z0 - pad && z < R.z1 + pad;
      const ROUTES = [SIEGE.campPath, SIEGE.ramPath, SIEGE.sally, SIEGE.retreat, SIEGE.road];
      const BULL_FALLS = ctx.spots.BULL_GUNS.map((g) => [g.fall.x, g.fall.z]);

      // Is a thing of radius r at (x, z) clear of everything the siege needs? (trees, bushes, hedges)
      function clear(x, z, r) {
        if (rrectSD(x, z, M) < M.bank + 1.5 + r) return false;                     // the moat and its banks
        for (const pts of ROUTES) if (ctx.routeDist(pts, x, z) < r + 4.5) return false;
        if (inRect(x, z, SIEGE.camp, r + 5)) return false;
        if (inRect(x, z, SIEGE.meadow, r + 4)) return false;
        if (Math.hypot(x - SIEGE.clash[0], z - SIEGE.clash[1]) < r + 22) return false;
        if (Math.hypot(x - SIEGE.t1[0], z - SIEGE.t1[1]) < r + 16) return false;
        if (Math.hypot(x - SIEGE.t2[0], z - SIEGE.t2[1]) < r + 14) return false;
        if (Math.abs(z - SIEGE.pavise.z) < r + 7 && Math.abs(x) < 26 + r) return false;
        for (const g of ctx.spots.LION_GUNS) if (Math.hypot(x - g.x, z - g.z) < r + 9) return false;
        for (const [fx, fz] of BULL_FALLS) if (Math.hypot(x - fx, z - fz) < r + 6) return false;
        for (const [fx, fz] of FIRES) if (Math.hypot(x - fx, z - fz) < r + 6) return false;
        if (Math.hypot(x - SIEGE.hillSE[0], z - SIEGE.hillSE[1]) < r + 8) return false;   // the road's crest
        return true;
      }
      // how far into the woods (x < west, x > east, z < north), metres; negative outside
      const WD = SIEGE.woods;
      const woodsDepth = (x, z) => Math.max(WD.west - x, x - WD.east, WD.north - z);

      // ---------------------------------------------------------------- materials
      // Each material gets a key of its own (extraKey), so the base's haze compiles a program for each and none is
      // shared with another builder's material of the same colour.
      const keyed = (m, key) => { m.userData.extraKey = key; m.customProgramCacheKey = () => key; return m; };
      const crownMat = keyed(ctx.mat(0xffffff, { vertexColors: true, name: 'land-crowns' }), 'land-crowns');
      const trunkMat = keyed(ctx.mat(0xffffff, { vertexColors: true, name: 'land-trunks' }), 'land-trunks');
      const staticMat = keyed(ctx.mat(0xffffff, { vertexColors: true, name: 'land-static', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), 'land-static');
      const reedMat = keyed(ctx.mat(0xffffff, { vertexColors: true, name: 'land-reeds', side: THREE.DoubleSide }), 'land-reeds');
      const flowerMat = keyed(ctx.mat(0xffffff, { name: 'land-flowers' }), 'land-flowers');

      // the crowns sway (ctx.addWind), each tree on its own phase (the wind's phase taken from where the tree stands)
      ctx.addWind(crownMat, 0.022);
      {
        const windCompile = crownMat.onBeforeCompile;
        crownMat.onBeforeCompile = (sh, r) => {
          windCompile.call(crownMat, sh, r);
          sh.vertexShader = sh.vertexShader.split('transformed.x * 0.35').join('(transformed.x + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23) * 0.35')
            .split('transformed.x * 0.3)').join('(transformed.x + instanceMatrix[3].z * 0.31) * 0.3)');
        };
      }
      ctx.addWind(reedMat, 0.16);

      // ---------------------------------------------------------------- geometry pieces
      // a faceted crown: an icosahedron, jittered, sitting on y 0 (0..2), shade baked per face (darker underneath)
      const crownGeo = (() => {
        let g = new THREE.IcosahedronGeometry(1, 0);
        g = ctx.jitterGeo(g, 0.22, 11);
        g.translate(0, 1, 0);
        const p = g.attributes.position, col = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i += 3) {
          const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
          const k = 0.66 + 0.4 * sm(cy / 1.7);
          for (let j = 0; j < 3; j++) col.set([k, k, k], (i + j) * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return g;
      })();
      // a square trunk, tapering, open top and bottom, 0..1 high, darker at the foot
      const trunkGeo = (() => {
        const pos = [], col = [], b = 0.5, t = 0.36;
        const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let i = 0; i < 4; i++) {
          const [ax, az] = c[i], [bx, bz] = c[(i + 1) % 4];
          const A0 = [ax * b, 0, az * b], B0 = [bx * b, 0, bz * b], A1 = [ax * t, 1, az * t], B1 = [bx * t, 1, bz * t];
          for (const q of [A0, B1, B0, A0, A1, B1]) { pos.push(...q); const k = 0.7 + 0.3 * q[1]; col.push(k, k, k); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        return g;
      })();

      // ---------------------------------------------------------------- trees
      // Colours: the woods' greens, with a lighter beech and a darker oak now and then (DESIGN 1: early summer).
      const GREENS = [C.woods, C.woods, C.woodsDark, 0x5b8640, 0x45693a, 0x6a8f3c];
      const crowns = [], trunks = [], trees = [];
      const lighten = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return c.getHex(); };
      // kinds: 'oak' (a short trunk, a broad crown, maybe a side crown), 'tall' (an ash or beech: two crowns stacked),
      // 'mass' (a tree in the body of a wood: one big crown down near the ground, no trunk showing), 'bush'
      function addTree(x, z, s, kind, seed) {
        const y = groundY(x, z), g = GREENS[Math.floor(H(x, z, seed) * GREENS.length)];
        const yaw = H(x, z, seed + 1) * TAU, tree = { x, z, y, s, crowns: [] };
        const push = (cx, cy, cz, sx, sy, sz, hex, rot) => { const c = { x: cx, y: cy, z: cz, sx, sy, sz, hex, rot }; crowns.push(c); tree.crowns.push(c); };
        if (kind === 'bush') {
          push(x, y - 0.3, z, s, s * 0.72, s * 0.9, g, yaw);
          if (H(x, z, seed + 2) > 0.4) push(x + Math.sin(yaw) * s * 0.8, y - 0.3, z + Math.cos(yaw) * s * 0.8, s * 0.65, s * 0.5, s * 0.6, lighten(g, 0.03), yaw + 1);
        } else if (kind === 'mass') {
          push(x, y + 0.4, z, s, s * 1.0, s * 0.95, g, yaw);
        } else if (kind === 'tall') {
          const h = 0.5 * s + 1.4;
          trunks.push({ x, y: y - 0.3, z, h: h + 0.6 + 0.3 * s, w: 0.2 * s + 0.15, yaw });
          push(x, y + h - 0.1 * s, z, s * 0.85, s * 1.1, s * 0.85, g, yaw);
          push(x + Math.sin(yaw) * 0.25 * s, y + h + 1.5 * s, z + Math.cos(yaw) * 0.25 * s, s * 0.52, s * 0.58, s * 0.52, lighten(g, 0.025), yaw + 2);
        } else {   // an oak: a broad crown and a lower side crown
          const h = 0.35 * s + 1.0;
          trunks.push({ x, y: y - 0.3, z, h: h + 0.3 + 0.6 * s, w: 0.24 * s + 0.15, yaw });
          push(x, y + h, z, s, s * 0.8, s * 0.95, g, yaw);
          if (H(x, z, seed + 3) > 0.35) {
            const a = yaw + 0.8;
            push(x + Math.sin(a) * 0.85 * s, y + h - 0.1 * s, z + Math.cos(a) * 0.85 * s, s * 0.62, s * 0.55, s * 0.62, lighten(g, 0.02), a);
          }
        }
        trees.push(tree);
        return tree;
      }

      // The woods: clumps of trees in rows along the woods' edges facing the field (two rows deep, the front one with
      // trunks showing), big crowns overlapping so each clump reads as one mass, and gaps between the clumps. The
      // edge runs down the west side, along the north, and down the east side (SIEGE.woods); the woods thin out to the
      // south so the camp and the road stand in open country.
      const EDGE = [[-124, 24], [WD.west, 24], [WD.west, WD.north], [WD.east, WD.north], [WD.east, 36], [124, 36]];
      const southEnds = [-124 - WD.west, 124 - WD.east].map(Math.abs);
      const edgeLen = ctx.routeLen(EDGE);
      const clump = (x, z) => 0.5 + 0.4 * Math.sin(x * 0.083 + 1.3) * Math.sin(z * 0.097 + 0.4) + 0.2 * Math.sin(x * 0.21 - z * 0.17);
      const at = { x: 0, z: 0, yaw: 0 };
      let ci = 0;
      for (const [row, depth0, depth1, step] of [[0, 4, 10, 19], [1, 14, 24, 21]]) {
        for (let d = (row * 7) % step; d < edgeLen; d += step, ci++) {
          // the south ends of the woods get only the front row
          if (row === 1 && (d < southEnds[0] || d > edgeLen - southEnds[1])) continue;
          ctx.routeAt(EDGE, Math.min(edgeLen, d + (H(ci, row, 1) - 0.5) * 7), at);
          // the inward normal (into the woods): the edge runs west side north, then east, then south
          const nx = Math.cos(at.yaw), nz = -Math.sin(at.yaw);
          const dep = lerp(depth0, depth1, H(ci, row, 2));
          let cx = at.x + nx * dep, cz = at.z + nz * dep;
          // round the two inner corners, push the clump out into the corner of the woods
          const southFade = cx < 0 ? 1 - sm((cz - 22) / 12) : 1 - sm((cz - 34) / 12);
          if (H(ci, row, 3) > 0.2 + 0.8 * southFade) continue;
          const n = row === 1 ? 2 + Math.floor(H(ci, row, 4) * 2) : 3 + Math.floor(H(ci, row, 4) * 2.4);
          for (let k = 0; k < n; k++) {
            const a = H(ci, k, 5) * TAU, rr = k === 0 ? 0 : 3 + 4 * H(ci, k, 6);
            const x = cx + Math.sin(a) * rr, z = cz + Math.cos(a) * rr;
            const wd = woodsDepth(x, z);
            if (wd < 1.5) continue;
            const s = (row === 1 ? 4.0 : 3.3) + 1.7 * H(ci, k, 7);
            if (!clear(x, z, s * 0.8)) continue;
            const kind = wd > 12 ? 'mass' : H(ci, k, 8) < 0.28 ? 'tall' : 'oak';
            addTree(x, z, s, kind, 7 + k);
          }
          // a bush or two under the front of a front-row clump
          if (row === 0 && H(ci, 0, 9) > 0.55) {
            const x = cx - nx * (dep - 1.5) + (H(ci, 0, 10) - 0.5) * 6, z = cz - nz * (dep - 1.5) + (H(ci, 0, 11) - 0.5) * 6;
            if (woodsDepth(x, z) > 0 && clear(x, z, 1.5)) addTree(x, z, 1.5 + 0.8 * H(ci, 0, 12), 'bush', 15);
          }
        }
      }
      // lone oaks by the hedges and the road, and bushes in a few clusters on the moat's outer banks
      const LONE = [[-50, 34, 3.8], [-62, 99, 4.4], [-28, 103, 3.6], [18, 104, 3.9], [56, 90, 3.6], [90, 101, 4.2], [64, 44, 3.6], [-14, -82, 3.4]];
      for (const [x, z, s] of LONE) if (clear(x, z, s * 0.9)) addTree(x, z, s, 'oak', 21);
      const BUSHES = [[-40, -52, 1.8], [-41.5, -48, 1.3], [-40.5, -24, 1.6], [-39.5, 0, 1.7], [-41.5, 3, 1.2], [-38, -68, 1.9], [-22, -71, 1.5], [-26, -71.5, 1.2]];
      for (const [x, z, s] of BUSHES) if (clear(x, z, -1.2)) addTree(x, z, s, 'bush', 13);

      // the instanced crowns and trunks
      {
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
        const crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, crowns.length);
        crowns.forEach((c, i) => {
          crownMesh.setMatrixAt(i, m4.compose(p.set(c.x, c.y, c.z), q.setFromEuler(e.set(0, c.rot, 0)), sc.set(c.sx, c.sy, c.sz)));
          crownMesh.setColorAt(i, lin(c.hex));
        });
        crownMesh.frustumCulled = false;
        ctx.root.add(crownMesh);
        const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trunks.length);
        const tc = lin(0x6e5338);
        trunks.forEach((t, i) => {
          trunkMesh.setMatrixAt(i, m4.compose(p.set(t.x, t.y, t.z), q.setFromEuler(e.set(0, t.yaw, 0)), sc.set(t.w, t.h, t.w)));
          trunkMesh.setColorAt(i, tc);
        });
        trunkMesh.frustumCulled = false;
        ctx.root.add(trunkMesh);
        S.crownMesh = crownMesh; S.trunkMesh = trunkMesh; S.crownGeo = crownGeo;
      }

      // ---------------------------------------------------------------- the static world: far crowns, hedges, strips
      // All vertex-coloured on one material (merged by the base on the first frame).
      {
        const pos = [], col = [], tmp = new THREE.Color();
        const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(k.r, k.g, k.b); };
        // The body of each wood: one faceted canopy, a quilt of treetops (a low pyramid over each 12 m cell, its peak
        // jittered), rising from the ground behind the edge trees to 10-13 m and running back to the land's far edge.
        // From the field it reads as the dark mass of the woods; from above, as a roof of leaves.
        {
          const CS = 12, X0 = -168, Z0 = -176, NX = 28, NZ = 22;
          const inCanopy = (x, z) => {
            const wd = woodsDepth(x, z);
            if (wd < 17 || Math.max(Math.abs(x), Math.abs(z + 10)) > 152) return false;
            if (x < 0 ? z > 6 : z > 18) return false;
            return clear(x, z, 4);
          };
          const corner = [];
          for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) corner.push([X0 + i * CS + (H(i, j, 50) - 0.5) * 4, Z0 + j * CS + (H(i, j, 51) - 0.5) * 4]);
          const cellIn = [];
          for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) cellIn.push(inCanopy(X0 + (i + 0.5) * CS, Z0 + (j + 0.5) * CS));
          const isIn = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && cellIn[j * NX + i];
          // a corner on the canopy's edge is pushed out, away from the cells it belongs to, and down to the ground,
          // so the edge of the wood slopes like a shoulder rather than standing like a wall
          for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
            const adj = [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]].filter(([a, b]) => isIn(a, b));
            if (adj.length === 0 || adj.length === 4) continue;
            const k = corner[j * (NX + 1) + i];
            let ax = 0, az = 0;
            for (const [a, b] of adj) { ax += X0 + (a + 0.5) * CS; az += Z0 + (b + 0.5) * CS; }
            ax /= adj.length; az /= adj.length;
            const dx = k[0] - ax, dz = k[1] - az, L = Math.hypot(dx, dz) || 1;
            k[0] += dx / L * 6; k[1] += dz / L * 6;
          }
          const cornerY = (i, j) => {
            const [x, z] = corner[j * (NX + 1) + i], g0 = groundY(x, z);
            const all = isIn(i - 1, j - 1) && isIn(i, j - 1) && isIn(i - 1, j) && isIn(i, j);
            return all ? g0 + 6.6 + 2.0 * H(i, j, 52) : g0 - 0.8;
          };
          const CAN = [C.woods, C.woodsDark, 0x40633a, 0x4a7538, C.woodsDark, 0x36562c];
          const ab = new THREE.Vector3(), ac = new THREE.Vector3();
          S.canopy = { CS, X0, Z0, NX, NZ, isIn, top: [] };
          for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
            if (!isIn(i, j)) { S.canopy.top.push(null); continue; }
            const k00 = corner[j * (NX + 1) + i], k10 = corner[j * (NX + 1) + i + 1], k01 = corner[(j + 1) * (NX + 1) + i], k11 = corner[(j + 1) * (NX + 1) + i + 1];
            const P00 = [k00[0], cornerY(i, j), k00[1]], P10 = [k10[0], cornerY(i + 1, j), k10[1]], P01 = [k01[0], cornerY(i, j + 1), k01[1]], P11 = [k11[0], cornerY(i + 1, j + 1), k11[1]];
            const cx = (k00[0] + k11[0]) / 2 + (H(i, j, 53) - 0.5) * 4, cz = (k00[1] + k11[1]) / 2 + (H(i, j, 54) - 0.5) * 4;
            const edgeCell = !(isIn(i - 1, j) && isIn(i + 1, j) && isIn(i, j - 1) && isIn(i, j + 1));
            const cy = groundY(cx, cz) + (edgeCell ? 7.4 + 1.4 * H(i, j, 55) : 9.4 + 2.2 * H(i, j, 55));
            const Cp = [cx, cy, cz];
            S.canopy.top.push(cy);
            const base = lin(CAN[Math.floor(H(i, j, 56) * CAN.length)]);
            for (const [A, B] of [[P00, P01], [P01, P11], [P11, P10], [P10, P00]]) {
              ab.set(A[0] - Cp[0], A[1] - Cp[1], A[2] - Cp[2]); ac.set(B[0] - Cp[0], B[1] - Cp[1], B[2] - Cp[2]);
              const ny = ab.clone().cross(ac).normalize().y;
              tmp.copy(base).multiplyScalar(0.6 + 0.4 * ny * ny);
              tri(Cp, A, B, tmp);
            }
          }
          // the fly camera rides over the treetops rather than through them
          ctx.addCamFloor((x, z) => {
            const i = Math.floor((x - X0) / CS), j = Math.floor((z - Z0) / CS);
            if (!isIn(i, j)) return null;
            return S.canopy.top[j * NX + i] + 1.5;
          });
        }
        // hedges: lumpy blocks along a line, about 1.3 m high, each a box with a jittered top
        const hedgeCol = lin(0x47703a), hedgeTop = lin(0x5a8442);
        function hedge(pts) {
          for (let i = 1; i < pts.length; i++) {
            const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 5));
            for (let k = 0; k < n; k++) {
              const x0 = lerp(ax, bx, k / n), z0 = lerp(az, bz, k / n), x1 = lerp(ax, bx, (k + 1) / n), z1 = lerp(az, bz, (k + 1) / n);
              const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
              if (!clear(mx, mz, 0.8)) continue;
              const wob = 0.75 + 0.3 * H(mx, mz, 18), dx = (x1 - x0) / L * n, dz = (z1 - z0) / L * n, nx = -dz * wob, nz = dx * wob;
              const h0 = 1.0 + 0.8 * H(x0, z0, 16), h1 = 1.0 + 0.8 * H(x1, z1, 16);
              const y0 = groundY(x0, z0) - 0.2, y1 = groundY(x1, z1) - 0.2;
              // ends slightly overlapping, so a hedge reads as one long lumpy mass
              const ex = (x1 - x0) * 0.12, ez = (z1 - z0) * 0.12;
              const A = [x0 - ex + nx, y0, z0 - ez + nz], B = [x1 + ex + nx, y1, z1 + ez + nz], Cc = [x1 + ex - nx, y1, z1 + ez - nz], D = [x0 - ex - nx, y0, z0 - ez - nz];
              const lift = (P, h, s) => [P[0] - nx * 0.25 * s, P[1] + h, P[2] - nz * 0.25 * s];
              const At = lift(A, h0, 1), Bt = lift(B, h1, 1), Ct = lift(Cc, h1, -1), Dt = lift(D, h0, -1);
              tmp.copy(hedgeCol);
              tri(A, Bt, B, tmp); tri(A, At, Bt, tmp); tri(Cc, Dt, D, tmp); tri(Cc, Ct, Dt, tmp);
              tri(D, At, A, tmp); tri(D, Dt, At, tmp); tri(B, Ct, Cc, tmp); tri(B, Bt, Ct, tmp);
              tmp.copy(hedgeTop);
              tri(At, Dt, Ct, tmp); tri(At, Ct, Bt, tmp);
            }
          }
        }
        hedge([[-47, 36], [-47, 94], [-96, 96]]);                 // round the strip fields west of the camp
        hedge([[-70, 100], [8, 100]]);                            // south of the camp
        hedge([[50, 83], [72, 88.5], [98, 96]]);                  // below the road as it goes over the hill
        hedge([[-8, -76.5], [-42, -76.5]]);                       // along the north wood's edge, west of the postern bridge
        // field strips: ridge and furrow (each strip domed along its middle), a few crops side by side
        const CROPS = [0xb9b45a, 0x9a8a5c, 0x86a64c, 0xc9c27a, 0x7c9a48, 0xa99862];
        function strips(x0, x1, z0, z1, n, along) {
          const W = (along === 'z' ? x1 - x0 : z1 - z0) / n, Lz = along === 'z' ? z1 - z0 : x1 - x0, segs = Math.max(2, Math.round(Lz / 6));
          for (let s = 0; s < n; s++) {
            const c = lin(CROPS[Math.floor(H(x0 + s, z0, 17) * CROPS.length)]);
            for (let k = 0; k < segs; k++) {
              const P = (u, w, lift) => {
                const a = lerp(0, Lz, u), b = (s + w) * W;
                const x = along === 'z' ? x0 + b : x0 + a, z = along === 'z' ? z0 + a : z0 + b;
                return [x, groundY(x, z) + 0.07 + lift, z];
              };
              const u0 = k / segs, u1 = (k + 1) / segs, m = 0.5, top = 0.16;
              const A0 = P(u0, 0.04, 0), A1 = P(u1, 0.04, 0), M0 = P(u0, m, top), M1 = P(u1, m, top), B0 = P(u0, 0.96, 0), B1 = P(u1, 0.96, 0);
              const sunny = tmp.copy(c).multiplyScalar(1.04), sh = c.clone().multiplyScalar(0.9);
              if (along === 'z') { tri(A0, M1, A1, sunny); tri(A0, M0, M1, sunny); tri(M0, B1, M1, sh); tri(M0, B0, B1, sh); }
              else { tri(A0, A1, M1, sunny); tri(A0, M1, M0, sunny); tri(M0, M1, B1, sh); tri(M0, B1, B0, sh); }
            }
          }
        }
        strips(-92, -52, 40, 92, 6, 'z');
        strips(-60, 4, 104, 132, 4, 'x');
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        ctx.add(ctx.world, g, staticMat, 0, 0, 0, { noShadow: true });
      }

      // ---------------------------------------------------------------- reeds at the moat's corners
      {
        const pos = [], col = [], c0 = lin(0x6f8a44), c1 = lin(0xa9b46a), cB = lin(0x7a5a3a);
        const corners = [[M.x0, M.z0], [M.x1, M.z0], [M.x0, M.z1], [M.x1, M.z1]];
        const cx = (M.x0 + M.x1) / 2, cz = (M.z0 + M.z1) / 2;
        corners.forEach(([kx, kz], ci) => {
          const ix = Math.sign(cx - kx), iz = Math.sign(cz - kz);
          for (let i = 0; i < 12; i++) {
            // along the corner's curve, just inside the water's edge
            const a = (i / 11) * Math.PI / 2, ox = M.r - M.r * Math.cos(a), oz = M.r - M.r * Math.sin(a);
            const x = kx + ix * (ox + 0.4 + 1.6 * H(ci, i, 18)), z = kz + iz * (oz + 0.4 + 1.6 * H(ci, i, 20));
            if (rrectSD(x, z, M) > -0.2) continue;
            const h = 1.4 + 0.9 * H(ci, i, 21), lean = (H(ci, i, 22) - 0.5) * 0.4, yaw = H(ci, i, 23) * TAU, w = 0.07;
            const b = M.level - 0.25, tx = x + Math.sin(yaw) * lean, tz = z + Math.cos(yaw) * lean;
            // a blade: a thin three-sided spike
            for (let s = 0; s < 3; s++) {
              const a0 = yaw + s * TAU / 3, a1 = yaw + (s + 1) * TAU / 3;
              pos.push(x + Math.sin(a0) * w, b, z + Math.cos(a0) * w, x + Math.sin(a1) * w, b, z + Math.cos(a1) * w, tx, b + h, tz);
              col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
            }
            // now and then a bulrush head
            if (i % 4 === 1) {
              const hy = b + h * 0.82, hx = lerp(x, tx, 0.82), hz = lerp(z, tz, 0.82), r = 0.09;
              for (let s = 0; s < 3; s++) {
                const a0 = s * TAU / 3, a1 = (s + 1) * TAU / 3;
                const P0 = [hx + Math.sin(a0) * r, hy, hz + Math.cos(a0) * r], P1 = [hx + Math.sin(a1) * r, hy, hz + Math.cos(a1) * r];
                pos.push(...P0, ...P1, hx, hy + 0.32, hz, ...P1, ...P0, hx, hy - 0.06, hz);
                for (let j = 0; j < 6; j++) col.push(cB.r, cB.g, cB.b);
              }
            }
          }
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        ctx.add(ctx.world, g, reedMat, 0, 0, 0, { noShadow: true });
      }

      // ---------------------------------------------------------------- wildflowers
      // Little faceted blossoms: buttercups, oxeye daisies, clover and a few poppies and cornflowers; thick in the
      // east meadow, a sprinkle elsewhere in the open grass. Off the trodden ways.
      {
        const FL = [[0xf2d14a, 5], [0xf4efe0, 4], [0xd77a9a, 2], [0xd2543c, 1], [0x7088d6, 1]];
        // where the knights and the shield walls fight there are no red poppies or pink clover (they'd read as red flecks
        // by the fallen): buttercups, daisies and cornflowers only
        const FL_FIGHT = [[0xf2d14a, 5], [0xf4efe0, 4], [0x7088d6, 1.5]];
        const inFight = (x, z) => x > 8 && x < 52 && z > 0 && z < 58;
        const pickFrom = (L, r) => { let tot = 0; for (const f of L) tot += f[1]; let a = r * tot; for (const f of L) { a -= f[1]; if (a <= 0) return f[0]; } return L[0][0]; };
        const list = [];
        const MD = SIEGE.meadow;
        const okAt = (x, z, pad) => {
          if (rrectSD(x, z, M) < M.bank + 1) return false;
          for (const pts of ROUTES) if (ctx.routeDist(pts, x, z) < pad) return false;
          if (inRect(x, z, SIEGE.camp, 2) || woodsDepth(x, z) > -2) return false;
          return !(Math.abs(z - SIEGE.pavise.z) < 4 && Math.abs(x) < 24);
        };
        // patches of one flower with a stranger or two among them; most in the east meadow
        for (let pi = 0, made = 0; pi < 200 && made < 18; pi++) {
          const inMeadow = pi % 4 !== 3;
          const px = inMeadow ? lerp(MD.x0 - 4, MD.x1 + 2, H(pi, 1, 24)) : lerp(-42, 48, H(pi, 3, 24));
          const pz = inMeadow ? lerp(MD.z0 - 2, MD.z1 + 4, H(pi, 2, 24)) : lerp(-74, 54, H(pi, 4, 24));
          if (!okAt(px, pz, 3.5)) continue;
          made++;
          const L = inFight(px, pz) ? FL_FIGHT : FL, main = pickFrom(L, H(pi, 6, 24)), n = 5 + Math.floor(H(pi, 7, 24) * 3);
          for (let k = 0; k < n; k++) {
            const a = k * 2.39996 + H(pi, k, 25) * 0.8, r = 0.5 + 1.6 * Math.sqrt((k + 0.5) / n);
            const x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
            if (!okAt(x, z, 2.2)) continue;
            list.push([x, z, H(pi, k, 26) < 0.18 ? pickFrom(inFight(x, z) ? FL_FIGHT : FL, H(pi, k, 27)) : main]);
          }
        }
        // a flower: a little five-sided cup of petals (in the flower's colour) on a short stem (darker, green-tinted by the
        // vertex colour), 16 triangles, so it reads as a flower and not a fleck. Unit size; placed with its foot on the ground.
        const g = (() => {
          const cup = new THREE.CylinderGeometry(0.8, 0.12, 0.85, 5, 1, true).toNonIndexed(); cup.translate(0, 1.75, 0);
          const stem = new THREE.CylinderGeometry(0.09, 0.13, 1.4, 3, 1, true).toNonIndexed(); stem.translate(0, 0.7, 0);
          const pos = [], col = [];
          for (const [G, c] of [[cup, [1, 1, 1]], [stem, [0.32, 0.55, 0.2]]]) { const a = G.attributes.position.array; for (let i = 0; i < a.length; i += 3) { pos.push(a[i], a[i + 1], a[i + 2]); col.push(c[0], c[1], c[2]); } }
          const out = new THREE.BufferGeometry();
          out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
          out.computeVertexNormals();
          return out;
        })();
        flowerMat.vertexColors = true; flowerMat.side = THREE.DoubleSide;
        const mesh = new THREE.InstancedMesh(g, flowerMat, list.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
        list.forEach(([x, z, hex], i) => {
          const s = 0.15 + 0.06 * H(x, z, 25);
          mesh.setMatrixAt(i, m4.compose(p.set(x, groundY(x, z) - 0.02, z), q.setFromEuler(e.set(0.15 * (H(x, z, 27) - 0.5), H(x, z, 26) * TAU, 0)), sc.set(s, s * 1.15, s)));
          mesh.setColorAt(i, lin(hex));
        });
        mesh.frustumCulled = false;
        ctx.root.add(mesh);
        S.flowers = mesh;
      }

      // ---------------------------------------------------------------- the moat
      // Still green-grey water exactly at SIEGE.moat.level over the base's basin: a gently heaving faceted sheet, darker
      // where it's deep, soft ripple bands drifting across it, a pale lapping line at every edge (the banks, the
      // islands, the towers standing in the water), a little sparkle, and gold at dusk. Fed by springs (research 3).
      {
        const step = 4, pos = [], idx = [], map = new Map();
        const wet = (x, z) => groundY(x, z) < M.level + 0.25;
        const vid = (x, z) => { const k = x + ',' + z; if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(x, M.level, z); } return map.get(k); };
        for (let x = M.x0 - 2; x < M.x1 + 2 - 1e-6; x += step) for (let z = M.z0 - 2; z < M.z1 + 2 - 1e-6; z += step) {
          const x1 = Math.min(x + step, M.x1 + 2), z1 = Math.min(z + step, M.z1 + 2);
          if (!(wet(x, z) || wet(x1, z) || wet(x, z1) || wet(x1, z1) || wet((x + x1) / 2, (z + z1) / 2))) continue;
          const a = vid(x, z), b = vid(x1, z), c = vid(x, z1), d = vid(x1, z1);
          idx.push(a, c, b, b, c, d);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const wm = keyed(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.78, metalness: 0 }), 'land-water');
        const U = {
          uT: { value: 0 }, uShallow: { value: lin(C.moat) }, uDeep: { value: lin(C.moatDeep) }, uLight: { value: lin(0x86a59a) },
          uFoam: { value: lin(0xd9e4d6) }, uSpark: { value: new THREE.Color() }, uGold: { value: new THREE.Color() }, uSkyR: { value: new THREE.Color() }, uSkyH: { value: new THREE.Color() }, uDayW: { value: 1 },
        };
        const n = (x) => x.toFixed(3);
        const rr = (R) => 'rrSD(p, vec2(' + n((R.x0 + R.x1) / 2) + ',' + n((R.z0 + R.z1) / 2) + '), vec2(' + n((R.x1 - R.x0) / 2) + ',' + n((R.z1 - R.z0) / 2) + '), ' + n(R.r) + ')';
        const towerR = SIEGE.towerR * Math.cos(Math.PI / 12) - 0.05;
        const edgeFn = [
          'float rrSD(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - (h - r); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
          'float waterEdge(vec2 p) {',
          '  float d = -' + rr(M) + ';',
          '  d = min(d, ' + rr(SIEGE.island) + ' - ' + n(SIEGE.island.bank) + ');',
          '  d = min(d, ' + rr(SIEGE.apron) + ' - ' + n(SIEGE.apron.bank) + ');',
          '  d = min(d, ' + rr(SIEGE.barbIsland) + ' - ' + n(SIEGE.barbIsland.bank) + ');',
          ...Object.values(SIEGE.towers).map(([x, z]) => '  d = min(d, length(p - vec2(' + n(x) + ',' + n(z) + ')) - ' + n(towerR) + ');'),
          ...Object.values(SIEGE.midTowers).map(([x, z]) => '  d = min(d, rrSD(p, vec2(' + n(x) + ',' + n(z) + '), vec2(' + n(SIEGE.midHx) + ',' + n(SIEGE.midHz) + '), 0.0));'),
          '  return d;',
          '}',
        ].join('\n');
        wm.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, U);
          sh.vertexShader = 'uniform float uT;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'vWP = transformed;',
            'transformed.y += 0.035 * sin(transformed.x * 0.55 + uT * 0.9) * sin(transformed.z * 0.47 - uT * 0.7) + 0.02 * sin(transformed.x * 0.21 - transformed.z * 0.33 + uT * 0.5);',
          ].join('\n'));
          sh.fragmentShader = 'uniform float uT;\nuniform vec3 uShallow;\nuniform vec3 uDeep;\nuniform vec3 uLight;\nuniform vec3 uFoam;\nuniform vec3 uSpark;\nuniform vec3 uGold;\nuniform vec3 uSkyR;\nuniform vec3 uSkyH;\nuniform float uDayW;\nvarying vec3 vWP;\n' + edgeFn + '\n' + sh.fragmentShader
            .replace('#include <color_fragment>', [
              '#include <color_fragment>',
              'vec2 p = vWP.xz;',
              'float wd = waterEdge(p);',
              'vec3 wc = mix(uShallow, uDeep, smoothstep(0.6, 5.5, wd));',
              // soft ripple bands drifting across, stepped so they read as low-poly
              // thin wandering ripple lines drifting across, two sets crossing, broken into dashes
              'float r1 = sin(p.y * 0.95 + p.x * 0.12 + 1.6 * sin(p.x * 0.19 + uT * 0.21) - uT * 0.55);',
              'float r2 = sin(p.x * 0.85 - p.y * 0.1 + 1.4 * sin(p.y * 0.17 - uT * 0.17) + uT * 0.45);',
              'float dash1 = smoothstep(0.55, 0.85, sin(p.x * 0.47 + p.y * 0.07 + uT * 0.3));',
              'float dash2 = smoothstep(0.55, 0.85, sin(p.y * 0.41 - p.x * 0.05 - uT * 0.25));',
              'float band = max(smoothstep(0.955, 0.99, r1) * dash1, smoothstep(0.96, 0.99, r2) * dash2);',
              'wc = mix(wc, uLight, 0.3 * band * uDayW);',
              // the pale edge, lapping in and out, and a faint second line a little way off the bank
              'float lap = 0.28 + 0.1 * sin(uT * 1.3 + p.x * 0.7 + p.y * 0.5);',
              'float edge = 1.0 - smoothstep(lap, lap + 0.1, wd);',
              'float ringD = 0.85 + 0.3 * sin(uT * 0.8 + p.x * 0.31 - p.y * 0.23);',
              'float ring = (1.0 - smoothstep(0.05, 0.11, abs(wd - ringD))) * 0.35;',
              // (the ring of ripples off the bank softens as the light goes, so the dusk water isn't dashed with white)
              'wc = mix(wc, uFoam, max(edge * (0.55 + 0.3 * uDayW), ring * (0.35 + 0.65 * uDayW)));',
              'diffuseColor.rgb = wc;',
            ].join('\n'))
            .replace('#include <emissivemap_fragment>', [
              '#include <emissivemap_fragment>',
              // a little sparkle: small glints that come and go, and the gold of the evening on the water
              'float sp = sin(p.x * 3.1 + uT * 2.3 + 2.0 * sin(p.y * 1.7)) * sin(p.y * 3.7 - uT * 1.9 + 2.0 * sin(p.x * 1.3));',
              'sp = smoothstep(0.986, 0.999, sp) * (1.0 - edge) * smoothstep(0.8, 2.0, wd);',
              // the far water mirrors the bright horizon (the gold of the sunset at dusk); looking down it stays dark
              'float fres = pow(1.0 - abs(normalize(vWP - cameraPosition).y), 5.0);',
              'totalEmissiveRadiance += uSpark * sp + uGold * (0.15 + 0.4 * band) + uSkyR + uSkyH * fres;',
              // a glitter path where the water mirrors the sun (strongest low in the evening)
              '#ifdef SKY_FOG',
              'vec3 wv = normalize(vWP - cameraPosition); vec3 wr = vec3(wv.x, -wv.y, wv.z);',
              'float gl = pow(max(dot(wr, uSunDir), 0.0), 90.0);',
              'totalEmissiveRadiance += uSpark * gl * (0.18 + 3.0 * sp + (0.25 + 0.75 * uDayW) * band);',
              '#endif',
            ].join('\n'));
        };
        const water = new THREE.Mesh(g, wm);
        water.frustumCulled = false;
        ctx.root.add(water);
        S.waterU = U;
        S.skyTint = new THREE.Color();
      }

      // ---------------------------------------------------------------- smoke from the camp's cooking fires
      {
        const g = ctx.jitterGeo(new THREE.IcosahedronGeometry(1, 0), 0.25, 31);
        const m = keyed(ctx.mat(C.smoke, { transparent: true, opacity: 0.3, depthWrite: false, emissive: 0x9a948a, name: 'land-smoke' }), 'land-smoke');
        const PUFFS = 5;
        const mesh = new THREE.InstancedMesh(g, m, MAX_FIRES * PUFFS);
        mesh.count = FIRES.length * PUFFS;
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        ctx.root.add(mesh);
        S.smoke = { mesh, PUFFS, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() };
      }

      // ---------------------------------------------------------------- the night mist
      // One soft, faceted blanket over the whole field. Each corner of it rises out of the ground as the mist reaches
      // it: in the evening it creeps out of the woods and up off the moat and spreads across the field (152-164),
      // lies thick over everything (164-174: everyone and the camp are put back under it), and at dawn it thins and
      // breaks into banks and is gone (0-12). Its top heaves slowly. ctx.mistAt(t) drives it.
      {
        const step = 13, X0 = -130, X1 = 130, Z0 = -130, Z1 = 130;
        const nx = Math.round((X1 - X0) / step), nz = Math.round((Z1 - Z0) / step);
        const pos = [], aE = [], aN = [], aB = [], idx = [];
        for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
          const x = X0 + i * step + (i > 0 && i < nx ? (H(i, j, 40) - 0.5) * 5 : 0), z = Z0 + j * step + (j > 0 && j < nz ? (H(i, j, 41) - 0.5) * 5 : 0);
          pos.push(x, Math.max(groundY(x, z), M.level), z);
          // how far the mist must travel to get here: from the woods (and the far south), or up off the moat
          const fromWoods = Math.min(Math.max(0, x - WD.west), Math.max(0, WD.east - x), Math.max(0, z - WD.north), Math.max(0, 118 - z)) / 50;
          const fromMoat = Math.max(0, rrectSD(x, z, M)) / 30 + 0.12;
          aE.push(Math.min(1, fromWoods, fromMoat));
          aN.push(Math.sin(x * 0.071 + 0.4) * Math.sin(z * 0.083 + 1.1) * 0.7 + 0.3 * Math.sin(x * 0.19 - z * 0.13));
          // fade out toward the sheet's own edges
          const edge = Math.min(x - X0, X1 - x, z - Z0, Z1 - z);
          aB.push(sm(edge / 25));
        }
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
          const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('aE', new THREE.Float32BufferAttribute(aE, 1));
        g.setAttribute('aN', new THREE.Float32BufferAttribute(aN, 1));
        g.setAttribute('aB', new THREE.Float32BufferAttribute(aB, 1));
        g.setIndex(idx);
        g.computeVertexNormals();
        // mist is soft: smooth shading (its normals point up), the banks shown by their outline and a gentle
        // brightening on the billows, not by facets
        const mm = keyed(new THREE.MeshStandardMaterial({ color: lin(0xe4ebf2), flatShading: false, roughness: 1, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 'land-mist');
        const U = { uM: { value: 0 }, uL: { value: 0 }, uLift: { value: 0 }, uT: { value: 0 }, uAlpha: { value: 0.97 } };
        mm.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, U);
          sh.vertexShader = 'uniform float uM;\nuniform float uL;\nuniform float uLift;\nuniform float uT;\nattribute float aE;\nattribute float aN;\nattribute float aB;\nvarying float vMA;\nvarying float vMB;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'float c;',
            // rolling in: it reaches each place in turn, from the woods and the moat toward the middle of the field
            'if (uLift < 0.5) c = smoothstep(0.0, 1.0, (uM * 2.0 - aE - 0.5 + 0.2 * aN) / 0.25);',
            // lifting at dawn: it thins and breaks into banks, the thinnest places clearing first
            'else c = smoothstep(0.0, 1.0, ((1.0 - uL) * 1.4 - 0.1 - 0.7 * (0.5 + 0.5 * aN)) / 0.25);',
            // (the heave turns a whole number of times per 180 s cycle, 3 and 2, so nothing jumps at the 180 to 0 seam)
            'float bill = sin(position.x * 0.085 + uT * 0.10472 + aN * 2.0) * sin(position.z * 0.075 - uT * 0.069813);',
            'float lump = 1.5 * bill + 0.8 * aN;',
            'float top = (5.6 + lump) * (1.0 - 0.45 * uL);',
            'transformed.y = position.y + mix(-0.35, top, c);',
            'vMA = c * aB;',
            'vMB = 0.5 + 0.5 * bill;',
          ].join('\n'));
          sh.fragmentShader = 'uniform float uAlpha;\nvarying float vMA;\nvarying float vMB;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.86 + 0.24 * vMB;\ndiffuseColor.a *= uAlpha * smoothstep(0.05, 0.85, vMA);');
        };
        const mesh = new THREE.Mesh(g, mm);
        mesh.frustumCulled = false;
        mesh.renderOrder = 3;
        mesh.visible = false;
        ctx.root.add(mesh);
        S.mist = { mesh, U, mat: mm, cDay: lin(0xdde3e9), cNight: lin(0x8c98ae), glow: lin(0x1a2236) };
      }

      // ---------------------------------------------------------------- crows
      S.crowsWanted = true;
      S.trees = trees;
      S.tapAt = -1e9;
      // ?crowsAt=seconds starts the crows' tap moment at that clock time (for checking it in stepped shots)
      { const q = new URLSearchParams(location.search); if (q.has('crowsAt')) S.tapAt = Number(q.get('crowsAt')); }
      S.ctx = ctx;
      S.lin = lin;

      // the moat's label: on the water south-west of the bridge, and on the east side
      ctx.tag('moat', () => S.moatPosW || (S.moatPosW = new THREE.Vector3(-26, M.level, 0.5)), { r: 5 });
      ctx.tag('moat', () => S.moatPosE || (S.moatPosE = new THREE.Vector3(29, M.level, -34)), { r: 5 });
      if (window.CHARACTERS && window.CHARACTERS.crow) buildCrows(ctx);
    },

    update(t, dt, ctx) {
      if (!S.crows && S.crowsWanted && window.CHARACTERS && window.CHARACTERS.crow) buildCrows(ctx);
      const ct = ctx.cycle.t, day = ctx.light.day;
      // the gold of the evening (as the base warms the light) and how far into night
      const warm = sm(1 - Math.abs(day - 0.4) / 0.4) * (day < 1 ? 1 : 0) * (1 - 0.55 * ctx.light.dawn);

      // the moat
      {
        const U = S.waterU;
        U.uT.value = t;
        U.uSpark.value.setRGB(0.42, 0.42, 0.38).multiplyScalar(0.25 + 0.75 * day).lerp(S.gold || (S.gold = S.lin(0xffb860)), warm * 0.8);
        U.uGold.value.copy(S.gold).multiplyScalar(0.3 * warm);
        // the water mirrors a little of the sky overhead: more of it as the light goes, blue at dusk and night (the gold of
        // the sunset is on its ripples and in the far water, uGold and uSkyH)
        U.uSkyR.value.copy(ctx.scene.fog.color).lerp(S.skyBlue || (S.skyBlue = S.lin(0x3a5a8a)), 0.5 * (1 - day) + 0.4 * warm).multiplyScalar(0.03 + 0.1 * (1 - day))
          .lerp(S.duskTeal || (S.duskTeal = S.lin(0x2f7a80).multiplyScalar(0.16)), 0.85 * warm);   // a deep teal glow in the gold hour
        U.uDayW.value = sm((day - 0.5) / 0.4);
        // in the gold hour the water deepens to a dark bronze-green that carries the sunset's warmth, not a pale sheet
        if (!S.wDay) { S.wDay = [U.uShallow.value.clone(), U.uDeep.value.clone()]; S.wDusk = [S.lin(0x1c5a62), S.lin(0x0e3a52)]; S.wHor = S.lin(0xf2b86a); }
        U.uShallow.value.copy(S.wDay[0]).lerp(S.wDusk[0], 0.75 * warm);
        U.uDeep.value.copy(S.wDay[1]).lerp(S.wDusk[1], 0.75 * warm);
        U.uSkyH.value.copy(S.wHor).multiplyScalar(0.3 * warm);
      }

      // smoke: puffs rise from each fire, swell, drift downwind and thin away; lower and fewer at night
      {
        const K = S.smoke, n = K.PUFFS, wd = ctx.wind.dir;
        if (!S.firesFound) {
          S.firesFound = true;
          const F = ctx.siege && ctx.siege.camp && ctx.siege.camp.fires;
          if (F && F.length) { FIRES = F.slice(0, MAX_FIRES); K.mesh.count = FIRES.length * n; }
        }
        const lowFire = 0.55 + 0.45 * sm((day - 0.2) / 0.5);
        for (let f = 0; f < FIRES.length; f++) {
          const [fx, fz] = FIRES[f], fy = ctx.groundY(fx, fz);
          for (let k = 0; k < n; k++) {
            const u = ((ct / 6 + k / n + f * 0.37) % 1 + 1) % 1;
            const rise = u * 6.5 * lowFire, drift = (u * u * 6 + u * 1.2) * (0.7 + 0.3 * ctx.wind.strength);
            const sc = (0.4 + 1.05 * u) * sm(u / 0.12) * (1 - sm((u - 0.5) / 0.5)) * lowFire;
            K.p.set(fx + wd.x * drift + 0.3 * Math.sin(u * 7 + f), fy + 0.9 + rise, fz + wd.z * drift + 0.3 * Math.cos(u * 5 + k));
            K.q.setFromEuler(K.e.set(u * 1.3 + k, u * 2.1 + f, 0));
            K.s.set(sc, sc * 0.85, sc);
            K.mesh.setMatrixAt(f * n + k, K.m4.compose(K.p, K.q, K.s));
          }
        }
        K.mesh.instanceMatrix.needsUpdate = true;
      }

      // the mist
      {
        const m = ctx.mistAt(t), K = S.mist;
        const lifting = ct < 20 || ct >= 174;
        // the dawn lift runs on its own clock, 0 at first light (still full) to 1 at 12 s (all gone)
        const L = ct < 20 ? sm(ct / 12) : 0;
        K.mesh.visible = lifting ? L < 0.97 : m > 0.002;
        K.U.uM.value = m;
        K.U.uL.value = L;
        K.U.uLift.value = lifting ? 1 : 0;
        K.U.uT.value = ct;
        K.mat.color.copy(K.cNight).lerp(K.cDay, sm(day / 0.7));
        // thick enough to hide everything while the siege is put back (164-174); thinner in the dawn light
        K.U.uAlpha.value = ct >= 174 ? 0.97 - 0.09 * sm((ct - 174) / 6) : ct < 20 ? 0.88 : 0.97;
        K.mat.emissive.copy(K.glow).multiplyScalar(1 - sm(day / 0.5));
        // under the full mist nothing low can be seen: the flowers and the trunks needn't be drawn
        const hidden = !lifting && m > 0.97;
        S.flowers.visible = !hidden;
        S.trunkMesh.visible = !hidden;
      }

      if (S.crows) updateCrows(t, ct, ctx);
    },
  });

  // ------------------------------------------------------------------ crows
  // CHARACTERS.crow (approved), all on one rig and one draw. Shown at twice life size so they read from across the
  // room. Two little groups circle over the north and west woods by day and drop into the trees at dusk; a flock
  // perches on the crowns in the east wood and, when tapped, bursts up, wheels round once and settles again.
  function buildCrows(ctx) {
    const { THREE, SIEGE } = ctx;
    const CR = window.CHARACTERS.crow;
    const rig = ctx.kit.makeRig();
    const list = [];
    for (let i = 0; i < 12; i++) list.push(CR.make(ctx.kit, rig, {}));
    window.Blocky.finish(rig, ctx.root);
    S.crowRig = rig;
    const trees = S.trees;
    const nearest = (x, z, skip) => {
      let best = null, bd = 1e9;
      for (const tr of trees) { if (tr.crowns.length < 2 || (skip && skip.includes(tr))) continue; const d = Math.hypot(tr.x - x, tr.z - z); if (d < bd) { bd = d; best = tr; } }
      return best;
    };
    // where a crown's surface is under (x, z): a ray dropped onto the crown itself
    const ray = new THREE.Raycaster(), probe = new THREE.Mesh(S.crownGeo, new THREE.MeshBasicMaterial());
    const surfaceOf = (c, x, z) => {
      probe.position.set(c.x, c.y, c.z); probe.rotation.set(0, c.rot, 0); probe.scale.set(c.sx, c.sy, c.sz);
      probe.updateMatrixWorld(true);
      ray.set(new THREE.Vector3(x, c.y + 3 * c.sy + 5, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(probe, false)[0];
      return hit ? hit.point.y : c.y + 1.7 * c.sy;
    };
    // circling groups: 3 over the north woods, 3 over the west woods
    const circles = [
      { cx: -16, cz: -100, R: 13, h: 24, n: 16, dir: 1, count: 3, first: 0 },
      { cx: -74, cz: -32, R: 11, h: 21, n: 18, dir: -1, count: 2, first: 3 },
    ];
    const flyers = [];
    circles.forEach((C0, gi) => {
      const tr = nearest(C0.cx, C0.cz);
      C0.cx = tr.x; C0.cz = tr.z;
      C0.roost = { x: tr.x, y: tr.crowns[0].y + tr.crowns[0].sy * 1.1, z: tr.z };
      C0.ground = ctx.groundY(tr.x, tr.z);
      for (let k = 0; k < C0.count; k++) flyers.push({ c: list[C0.first + k], C: C0, k, seed: C0.first + k + 0.5 });
    });
    // the east flock: seven on the tops of three trees near the edge of the east wood
    const flock = [], used = [];
    const centre = [61, -16];
    for (let k = 0; k < 3; k++) {
      const tr = nearest(centre[0] + k * 3, centre[1] + k * 5, used);
      used.push(tr);
    }
    for (let i = 0; i < 7; i++) {
      const tr = used[i % 3], c = tr.crowns[0];
      const a = i * 2.4 + 0.5, rr = c.sx * 0.3 * (i < 3 ? 0.25 : 1);
      const x = c.x + Math.sin(a) * rr, z = c.z + Math.cos(a) * rr;
      const y = surfaceOf(c, x, z) - 0.04;
      flock.push({ c: list[5 + i], x, y, z, yaw: a + Math.PI / 2 + (i % 2 ? 0.4 : -0.3), seed: i + 1.3, delay: (i * 0.137 + (i % 3) * 0.11) % 0.7, loop: { R: 7 + (i % 3) * 2.2, H: 9 + (i % 4) * 1.8, th: i * 0.8, dur: 6.2 + (i % 3) * 0.5 } });
    }
    S.crows = { list, flyers, circles, flock, pos: new THREE.Vector3(), tagPos: new THREE.Vector3(), q: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, pose: null } };
    for (const c of list) c.scale = 2.0;
    const fl = flock[0];
    S.crows.tagPos.set(fl.x, fl.y + 0.4, fl.z);
    ctx.tag('crows', () => S.crows.tagPos, {
      r: 2.5,
      onTap(now) {
        if (now - S.tapAt < 9.5 || S.flockAsleep) return;   // already up, or roosting for the night
        S.tapAt = now;
        ctx.sound.play('wings', fl.x, fl.y, fl.z);
      },
    });
    S.crows.northPos = new THREE.Vector3();
    ctx.tag('crows', () => S.crows.northPos, { r: 3 });
  }

  // a flight loop for the tapped flock: out of the perch, up and round once, back to the same perch (offsets from it)
  function loopAt(L, tau, out) {
    const th = L.th + TAU * tau;
    const e = sm(tau);
    out.x = L.R * (Math.cos(th) - Math.cos(L.th)) * Math.sin(Math.PI * Math.min(1, tau * 1.15));
    out.z = L.R * (Math.sin(th) - Math.sin(L.th)) * Math.sin(Math.PI * Math.min(1, tau * 1.15));
    out.y = L.H * Math.pow(Math.sin(Math.PI * tau), 0.8) * (1 - 0.1 * e);
    return out;
  }
  const _a = { x: 0, y: 0, z: 0 }, _b = { x: 0, y: 0, z: 0 }, HIDE = { hide: true };

  function updateCrows(t, ct, ctx) {
    const K = S.crows, CR = window.CHARACTERS.crow, A = CR.anim, q = K.q;
    // the circling crows are up once the dawn mist thins (4 → 14 s) until dusk (148 → 156); they drop into their
    // roost tree. The flock hops down into its crowns at dusk (150 → 155) and up again at dawn (4 → 8 s). At night
    // every crow is roosting, and the crows' mesh isn't drawn.
    const p = ct;
    let up;
    if (p >= 14 && p < 148) up = 1;
    else if (p >= 148 && p < 156) up = 1 - sm((p - 148) / 8);
    else if (p >= 156 || p < 4) up = 0;
    else up = sm((p - 4) / 10);
    const asleep = p >= 150 && p < 155 ? sm((p - 150) / 5) : p >= 155 || p < 4 ? 1 : p < 8 ? 1 - sm((p - 4) / 4) : 0;
    S.flockAsleep = asleep > 0.02;
    S.crowRig.mesh.visible = up > 0.001 || asleep < 0.999 || t - S.tapAt < 10;
    for (const F of K.flyers) {
      const C = F.C, c = F.c;
      if (up <= 0.001) { c.set(HIDE); continue; }
      const w = C.dir * TAU * C.n / 180;   // laps per cycle: no jump at the seam
      const ang = ct * w + F.k * 2.1 + F.seed * 0.3;
      const R = C.R * (0.85 + 0.15 * Math.sin(ct * 0.21 + F.k)) * sm(up / 0.6 + 0.0) ;
      const hy = C.ground + C.h + 2.5 * Math.sin(ct * TAU / 30 + F.k * 1.7);
      const y = lerp(C.roost.y, hy, sm(up));
      q.x = C.cx + Math.cos(ang) * R; q.z = C.cz + Math.sin(ang) * R; q.y = y;
      // heading: along the circle
      q.yaw = Math.atan2(-Math.sin(ang) * C.dir, Math.cos(ang) * C.dir);
      q.pitch = 0;
      // glide most of the time, a few flaps every few seconds; banked into the turn
      const flapW = 0.5 + 0.5 * Math.sin(ct * TAU / 6 + F.seed * 2.3);
      const pose = A.mix(A.glide(t, F.seed), A.flap(t, F.seed), sm((flapW - 0.55) / 0.2) * up + (1 - up) * 0.8);
      pose.roll += -0.35 * C.dir * sm(up);
      q.pose = pose;
      c.scale = 2.0 * sm(up / 0.12);
      c.set(q);
    }
    {
      const n = K.flyers[1].c.root.position;
      K.northPos.set(n.x, n.y + 0.5, n.z);
    }
    // the east flock: perched (looking about), or the tap moment: lift off, wheel round, glide back and settle
    const u0 = t - S.tapAt;
    for (const F of K.flock) {
      const c = F.c, s = u0 - F.delay, L = F.loop;
      q.x = F.x; q.y = F.y; q.z = F.z; q.yaw = F.yaw; q.pitch = 0;
      if (s < 0 || s > 1.4 + L.dur + 1.6) {
        q.pose = A.perch(t, F.seed);
        // roosting: a little hop down into the leaves (and back up at dawn)
        if (asleep > 0) {
          q.y -= 1.1 * sm(asleep) - 0.35 * Math.sin(Math.PI * Math.min(1, asleep * 1.6));
          if (asleep > 0.85) { c.scale = 2.0 * (1 - sm((asleep - 0.85) / 0.15)); if (c.scale < 0.01) { c.set(HIDE); continue; } }
          else c.scale = 2.0;
        } else c.scale = 2.0;
      } else if (s < 1.4) {
        q.pose = A.liftoff(s / 1.4, F.seed);
        // turn toward the loop's heading as it springs up
        loopAt(L, 0.01, _a);
        const hy = Math.atan2(_a.x, _a.z);
        q.yaw = F.yaw + Math.atan2(Math.sin(hy - F.yaw), Math.cos(hy - F.yaw)) * sm(s / 1.0);
      } else if (s < 1.4 + L.dur) {
        const tau = (s - 1.4) / L.dur;
        loopAt(L, tau, _a); loopAt(L, Math.min(1, tau + 0.01), _b);
        q.x += _a.x; q.y += _a.y; q.z += _a.z;
        const dx = _b.x - _a.x, dz = _b.z - _a.z, dy = _b.y - _a.y;
        if (dx * dx + dz * dz > 1e-8) q.yaw = Math.atan2(dx, dz);
        q.pitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 0.6;
        const pose = A.mix(A.flap(t, F.seed), A.glide(t, F.seed), sm((tau - 0.35) / 0.2) * (1 - sm((tau - 0.8) / 0.15)));
        pose.y += CR.liftY(1);
        pose.roll += 0.4 * Math.sin(Math.PI * tau);
        q.pose = pose;
      } else {
        // settle: the lift-off played backwards brings it down onto its perch
        const v = (s - 1.4 - L.dur) / 1.6;
        q.yaw = F.yaw;
        q.pose = A.mix(A.liftoff(1 - v, F.seed), A.perch(t, F.seed), sm((v - 0.7) / 0.3));
      }
      c.set(q);
    }
  }
})();
