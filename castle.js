// castle.js: the Bull castle (DESIGN.md 1, 2, 5, 7, 9; research.md 3 and 6b). Built on Bodiam (licence of 1385): a
// square sandstone castle with no keep, round corner towers, square mid-towers in the east and west walls, a
// twin-towered gatehouse with a corbelled, machicolated and crenellated parapet, three keyhole gunloops at its foot
// (shapes only), a portcullis, a barbican on its own island, a postern tower with a long timber bridge, and the
// domestic ranges round an open courtyard. Lancet windows only (Bodiam has no arrow slits). Turned so the gate faces
// south (ours, DESIGN 2). Every measurement comes from ctx.SIEGE.
//
// Moving parts, all pure functions of the cycle:
//   the breakable battlement on the south-west tower: its merlons burst outward at SIEGE.times.breakAt (58), tumble and
//   splash at breachSplash (59.7) with a dust puff, leave a ragged stump, and rise back into place under the full night
//   mist (165-172) so the loop starts whole (research 6b: "They overthrow the battlements around," Langtoft);
//   the portcullis: half up, it drops at the alarm (96) and is wound up again under the mist (166-172);
//   the postern gate: opens at 99 for the sally, shuts at 157 after the knights are home;
//   the Bull banner over the gatehouse and the pennons on the towers stir in the wind (a tap on the castle or the
//   gatehouse lifts them in a gust); torches on the walls glow at night (ctx.addLantern).
//
// For the choreographers: ctx.castle (also window.CASTLE) publishes the standing heights and every crenel's standing
// spot ({ x, y, z, face, where }), the lady's and the damsel's places, and the merlons (for arrows to stick in).
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  // state shared by init and update
  let S, T, C3, G;                         // SIEGE, SIEGE.times, THREE, misc
  let pieces = [], piecesMesh = null, chipsN = 0;
  let dustMesh = null, splashMesh = null, dust = [], splashes = [];
  let portcullis = null, leaves = null, flames = null, flameSpots = [];
  let INSIDE = null, NAV_API = null;
  const INSIDE_NEAR = 6.5;                   // an area of rooms is drawn while Soldier's eye is this near it (m)          // the rooms inside (drawn only in Soldier's eye) and the walking map
  let flagMat = null, flagU = null, tapAt = -1e9;
  const M4 = [], Q = [], V = [];

  window.Scene.register({
    name: 'castle',
    init(ctx) {
      const THREE = ctx.THREE;
      C3 = THREE; S = ctx.SIEGE; T = S.times;
      const lin = ctx.lin, hash = ctx.hash, smooth01 = ctx.smooth01;
      const rnd = ctx.mulberry32(13851021);            // our own seed (the licence to crenellate, 1385)
      const rr = (a, b) => a + (b - a) * rnd();
      for (let i = 0; i < 4; i++) { M4.push(new THREE.Matrix4()); Q.push(new THREE.Quaternion()); V.push(new THREE.Vector3()); }

      // ---------- colours (sRGB picked, linear through ctx.lin) ----------
      const SAND = lin(ctx.C.sandstone), CAP = lin(0xe2d3a8), SHADE = lin(ctx.C.sandShade);
      const DARK = lin(0x2a231d), DEEP = lin(0x1d1915), LEAD = lin(0x8b9197), OAK = lin(ctx.C.oak), OAK_L = lin(0x96714a);
      const IRON = lin(0x4a4846), RED = lin(ctx.C.bullRed), WHITE = lin(ctx.C.bullWhite), GOLD = lin(ctx.C.hornGold);
      const POLE = lin(0x6a4c30);
      const M = ctx.mat(0xffffff, { vertexColors: true });

      // ---------- geometry: triangles straight into arrays, coloured per vertex ----------
      let P = [], CL = [];
      const tc = new THREE.Color();
      function begin() { P = []; CL = []; }
      function end() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(CL, 3));
        g.computeVertexNormals();
        g.computeBoundingSphere();
        return g;
      }
      function pushV(p, c) { P.push(p[0], p[1], p[2]); CL.push(c[0], c[1], c[2]); }
      // a triangle turned to face n (any winding in)
      function tri(a, b, c, ca, cb, cc, n) {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (nx * n[0] + ny * n[1] + nz * n[2] < 0) { pushV(a, ca); pushV(c, cc); pushV(b, cb); } else { pushV(a, ca); pushV(b, cb); pushV(c, cc); }
      }
      // shade baked toward the ground, a damp band at the water
      function shadeY(y) { return y >= 0 ? 0.74 + 0.26 * smooth01(y / 11) : 0.74 - 0.16 * smooth01(-y / 2.2); }
      function colAt(base, y, m, flat) {
        tc.copy(base).multiplyScalar(m * (flat ? 1 : shadeY(y)));
        if (!flat && y < 0.2) { const w = smooth01((0.2 - y) / 0.7); tc.r *= 1 - 0.2 * w; tc.g *= 1 - 0.1 * w; tc.b *= 1 - 0.24 * w; }
        return [tc.r, tc.g, tc.b];
      }
      // a convex polygon (fan from its first point) facing n
      function poly(pts, n, base, m, flat) {
        const cs = pts.map((p) => colAt(base, p[1], m, flat));
        for (let i = 1; i < pts.length - 1; i++) tri(pts[0], pts[i], pts[i + 1], cs[0], cs[i], cs[i + 1], n);
      }
      // stone courses: alternating bands with a little variety, every CH metres (absolute heights, so walls line up)
      const CH = 0.9;
      const course = (k, seed) => 1 + ((k & 1) ? -0.035 : 0.03) + 0.06 * (hash(k, seed, 3, 7) - 0.5);
      // a vertical face from A to B ([x, z]) between y0 and y1, facing n ([nx, 0, nz]); o: { c, m, bands, seed, bandFn, flat }
      function wall(A, B, y0, y1, n, o) {
        const base = o.c || SAND, m = o.m === undefined ? 1 : o.m;
        const ys = [y0];
        if (o.bands !== false) for (let k = Math.floor(y0 / CH) + 1; k * CH < y1 - 0.05; k++) if (k * CH > y0 + 0.05) ys.push(k * CH);
        if (o.cuts) for (const c of o.cuts) if (c > y0 + 0.02 && c < y1 - 0.02) ys.push(c);
        ys.sort((a, b) => a - b);
        ys.push(y1);
        for (let i = 0; i < ys.length - 1; i++) {
          const ya = ys[i], yb = ys[i + 1], ym = (ya + yb) / 2;
          let bm = o.bands === false ? 1 : course(Math.floor(ym / CH), o.seed || 1);
          if (o.bandFn) bm *= o.bandFn(ym);
          if (o.fmY) bm *= o.fmY(ym);
          const a = [A[0], ya, A[1]], b = [B[0], ya, B[1]], c = [B[0], yb, B[1]], d = [A[0], yb, A[1]];
          const ca = colAt(base, ya, m * bm, o.flat), cd = colAt(base, yb, m * bm, o.flat);
          tri(a, b, c, ca, ca, cd, n); tri(a, c, d, ca, cd, cd, n);
        }
      }
      // a prism over a convex polygon [[x, z], ...] from y0 to y1. o: { c, m, top (colour), topM, under (mult), fm(nx, nz) side mult, noTop, bands, seed, skip(nx, nz) (leave that side out) }
      function prism(pts, y0, y1, o) {
        o = o || {};
        let cx = 0, cz = 0;
        for (const p of pts) { cx += p[0]; cz += p[1]; }
        cx /= pts.length; cz /= pts.length;
        for (let i = 0; i < pts.length; i++) {
          const A = pts[i], B = pts[(i + 1) % pts.length];
          let nx = -(B[1] - A[1]), nz = B[0] - A[0];
          const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
          if (nx * ((A[0] + B[0]) / 2 - cx) + nz * ((A[1] + B[1]) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
          const fnx = nx, fnz = nz;
          if (o.skip && o.skip(nx, nz)) continue;
          wall(A, B, y0, y1, [nx, 0, nz], Object.assign({}, o, { fmY: o.fm ? (ym) => o.fm(fnx, fnz, ym) : null }));
        }
        if (!o.noTop) poly(pts.map((p) => [p[0], y1, p[1]]), [0, 1, 0], o.top || o.c || SAND, (o.topM || 1.06) * (o.m === undefined ? 1 : o.m), o.flat);
        if (o.under) poly(pts.map((p) => [p[0], y0, p[1]]), [0, -1, 0], o.c || SAND, o.under, true);
      }
      const box = (x0, x1, y0, y1, z0, z1, o) => prism([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, o);
      // an oriented box: centre (cx, cz), yaw (its local +z points along (sin yaw, cos yaw)), half-sizes hw (local x), hd (local z)
      function oboxPts(cx, cz, yaw, hw, hd) {
        const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
        return [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]].map(([a, b]) => [cx + rx * a + fx * b, cz + rz * a + fz * b]);
      }
      const obox = (cx, cz, yaw, hw, hd, y0, y1, o) => prism(oboxPts(cx, cz, yaw, hw, hd), y0, y1, o);
      function ngonPts(cx, cz, rv, n, phase) { const out = []; for (let i = 0; i < n; i++) { const a = phase + i * TAU / n; out.push([cx + Math.sin(a) * rv, cz + Math.cos(a) * rv]); } return out; }
      // a sloping ring (a plinth's batter): radius r0 at y0 to r1 at y1
      function frustum(cx, cz, r0, r1, y0, y1, n, phase, base, m) {
        for (let i = 0; i < n; i++) {
          const a = phase + i * TAU / n, b = phase + (i + 1) * TAU / n, am = (a + b) / 2;
          const p = [cx + Math.sin(a) * r0, y0, cz + Math.cos(a) * r0], q = [cx + Math.sin(b) * r0, y0, cz + Math.cos(b) * r0];
          const r = [cx + Math.sin(b) * r1, y1, cz + Math.cos(b) * r1], s = [cx + Math.sin(a) * r1, y1, cz + Math.cos(a) * r1];
          const n3 = [Math.sin(am), (r0 - r1) / Math.max(0.01, y1 - y0), Math.cos(am)];
          const c0 = colAt(base, y0, m), c1 = colAt(base, y1, m);
          tri(p, q, r, c0, c0, c1, n3); tri(p, r, s, c0, c1, c1, n3);
        }
      }
      // a flat shape on a wall: centre (cx, cy, cz) on the face, facing (nx, nz); shape in (right, up) metres; off: lift off the face
      function decal(cx, cy, cz, nx, nz, shape, base, m, off) {
        const ux = nz, uz = -nx;
        const pts = shape.map(([a, b]) => [cx + ux * a + nx * off, cy + b, cz + uz * a + nz * off]);
        poly(pts, [nx, 0, nz], base, m, true);
      }
      const lancetShape = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h - w * 0.75], [0, h], [-w / 2, h - w * 0.75]];
      // a lancet window: a pale drafted frame and a dark opening (dark recesses do the work)
      function lancet(cx, cy, cz, nx, nz, w, h) {
        decal(cx, cy - 0.12, cz, nx, nz, lancetShape(w + 0.24, h + 0.26), CAP, 1.02, 0.025);
        decal(cx, cy, cz, nx, nz, lancetShape(w, h), DARK, 1, 0.05);
      }
      function squareWin(cx, cy, cz, nx, nz, w, h) {
        decal(cx, cy - 0.1, cz, nx, nz, [[-w / 2 - 0.1, 0], [w / 2 + 0.1, 0], [w / 2 + 0.1, h + 0.2], [-w / 2 - 0.1, h + 0.2]], CAP, 1.02, 0.025);
        decal(cx, cy, cz, nx, nz, [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]], DARK, 1, 0.05);
      }
      // a two-light hall window: two lancets under one pointed head, a stone mullion between
      function hallWindow(cx, cy, cz, nx, nz, w, h) {
        decal(cx, cy - 0.15, cz, nx, nz, lancetShape(w + 0.3, h + 0.35), CAP, 1.02, 0.025);
        decal(cx, cy, cz, nx, nz, lancetShape(w, h), DARK, 1, 0.05);
        decal(cx, cy, cz, nx, nz, [[-0.08, 0], [0.08, 0], [0.08, h - w * 0.55], [-0.08, h - w * 0.55]], CAP, 0.95, 0.075);
        decal(cx, cy + h * 0.55, cz, nx, nz, [[-w / 2, 0], [w / 2, 0], [w / 2, 0.12], [-w / 2, 0.12]], CAP, 0.95, 0.075);
      }
      // a window of three plain pointed lights under a drafted surround (Bodiam's chapel window, research 18a)
      function threeLights(cx, cy, cz, nx, nz, col, off) {
        decal(cx, cy - 0.15, cz, nx, nz, [[-0.95, 0], [0.95, 0], [0.95, 2.6], [0, 3.15], [-0.95, 2.6]], CAP, 1.02, (off || 0) + 0.025);
        for (const u of [-0.55, 0, 0.55]) decal(cx + nz * u, cy, cz - nx * u, nx, nz, lancetShape(0.4, u === 0 ? 2.8 : 2.45), col || DARK, 1, (off || 0) + 0.05);
      }
      // a keyhole gunloop (Bodiam's gatehouse: "for hand-held cannons"), as a shape only
      function gunloop(cx, cy, cz, nx, nz) {
        decal(cx, cy - 0.1, cz, nx, nz, [[-0.42, 0], [0.42, 0], [0.42, 1.55], [-0.42, 1.55]], CAP, 1.04, 0.025);
        const circ = []; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; circ.push([Math.sin(a) * 0.24, 0.3 + Math.cos(a) * 0.24]); }
        decal(cx, cy, cz, nx, nz, circ, DEEP, 1, 0.05);
        decal(cx, cy, cz, nx, nz, [[-0.07, 0.3], [0.07, 0.3], [0.07, 1.3], [-0.07, 1.3]], DEEP, 1, 0.05);
        decal(cx, cy, cz, nx, nz, [[-0.26, 0.98], [0.26, 0.98], [0.26, 1.06], [-0.26, 1.06]], DEEP, 1, 0.05);
      }
      // a shield of arms on a wall: the Bull (gules, a bull passant argent, armed or), boiled down to a few blocks
      function shield(cx, cy, cz, nx, nz, s) {
        decal(cx, cy, cz, nx, nz, [[-0.5 * s, 1.1 * s], [0.5 * s, 1.1 * s], [0.5 * s, 0.5 * s], [0, 0], [-0.5 * s, 0.5 * s]].map(([a, b]) => [a * 1.15, b * 1.1 - 0.06 * s]), CAP, 1.05, 0.03);
        decal(cx, cy, cz, nx, nz, [[-0.5 * s, 1.1 * s], [0.5 * s, 1.1 * s], [0.5 * s, 0.5 * s], [0, 0], [-0.5 * s, 0.5 * s]], RED, 1, 0.05);
        decal(cx, cy, cz, nx, nz, [[-0.22 * s, 0.5 * s], [0.3 * s, 0.5 * s], [0.3 * s, 0.75 * s], [-0.22 * s, 0.78 * s]], WHITE, 1, 0.07);    // the body
        decal(cx, cy, cz, nx, nz, [[-0.36 * s, 0.6 * s], [-0.2 * s, 0.6 * s], [-0.2 * s, 0.82 * s], [-0.36 * s, 0.8 * s]], WHITE, 1, 0.07);  // the head
        decal(cx, cy, cz, nx, nz, [[-0.2 * s, 0.36 * s], [-0.1 * s, 0.36 * s], [-0.1 * s, 0.5 * s], [-0.2 * s, 0.5 * s]], WHITE, 1, 0.07);   // legs
        decal(cx, cy, cz, nx, nz, [[0.16 * s, 0.36 * s], [0.26 * s, 0.36 * s], [0.26 * s, 0.5 * s], [0.16 * s, 0.5 * s]], WHITE, 1, 0.07);
        decal(cx, cy, cz, nx, nz, [[-0.36 * s, 0.8 * s], [-0.3 * s, 0.8 * s], [-0.36 * s, 0.94 * s], [-0.42 * s, 0.93 * s]], GOLD, 1, 0.09); // a horn
      }
      // a pointed (two-centred) arch in a passage mouth: the two spandrels between the curve and the vault, as solid
      // stone `depth` deep. The passage runs along z; zf is the face, dir +1 or -1 the way into the passage.
      function archZ(cx, zf, dir, hw, vault, depth) {
        const c = 0.5 * hw, r = hw + c, rise = Math.sqrt(r * r - c * c), spring = vault - rise;
        const phiMax = Math.acos(c / r), N = 5;
        for (const side of [-1, 1]) {
          const curve = [];
          for (let i = 0; i <= N; i++) { const ph = phiMax * i / N; curve.push([side * (c - r * Math.cos(ph)) * -1, spring + r * Math.sin(ph)]); }
          // curve runs from the springing (x = side*hw) up to the apex (x = 0)
          const corner = [side * hw, vault];
          const pts2 = [corner].concat(curve);
          const z0 = zf, z1 = zf + dir * depth;
          poly(pts2.map(([x, y]) => [cx + x, y, z0]), [0, 0, -dir], SAND, 1, false);
          poly(pts2.map(([x, y]) => [cx + x, y, z1]), [0, 0, dir], SAND, 0.5, false);
          for (let i = 0; i < curve.length - 1; i++) {
            const a = curve[i], b = curve[i + 1];
            const nn = [-side * 0.5, -1, 0];
            const p0 = [cx + a[0], a[1], z0], p1 = [cx + b[0], b[1], z0], p2 = [cx + b[0], b[1], z1], p3 = [cx + a[0], a[1], z1];
            const ca = colAt(SAND, a[1], 0.62), cb = colAt(SAND, b[1], 0.62);
            tri(p0, p1, p2, ca, cb, cb, nn); tri(p0, p2, p3, ca, cb, ca, nn);
          }
        }
        return spring;
      }
      // ---- openings to walk through (Soldier's eye, decision 24; research.md 18) ----
      // A vertical face from A to B ([x, z]) facing n ([nx, 0, nz]) with rectangular holes [{ s0, s1, h0, h1 }] (s along
      // A→B in metres, h heights). Cut in rows, so the courses below and above a hole run the face's whole width.
      function holeWall(A, B, y0, y1, n, holes, o) {
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]), at = (s) => [A[0] + (B[0] - A[0]) * s / L, A[1] + (B[1] - A[1]) * s / L];
        const ys = [y0, y1];
        for (const h of holes) for (const y of [h.h0, h.h1]) if (y > y0 + 0.005 && y < y1 - 0.005) ys.push(y);
        ys.sort((a, b) => a - b);
        for (let i = 0; i < ys.length - 1; i++) {
          const ya = ys[i], yb = ys[i + 1];
          if (yb - ya < 0.005) continue;
          const cut = holes.filter((h) => h.h0 <= ya + 0.005 && h.h1 >= yb - 0.005).sort((a, b) => a.s0 - b.s0);
          let s = 0;
          for (const h of cut) { if (h.s0 > s + 0.005) wall(at(s), at(h.s0), ya, yb, n, o); s = Math.max(s, h.s1); }
          if (L > s + 0.005) wall(at(s), at(L), ya, yb, n, o);
        }
      }
      // the hole for an opening centred at c ([x, z], on the line A→B) w wide from h0 to h1, as holeWall wants it
      const holeOn = (A, B, c, w, h0, h1) => { const L = Math.hypot(B[0] - A[0], B[1] - A[1]); const s = ((c[0] - A[0]) * (B[0] - A[0]) + (c[1] - A[1]) * (B[1] - A[1])) / L; return { s0: s - w / 2, s1: s + w / 2, h0, h1 }; };
      // the throat of an opening in a face whose outward normal is (nx, nz): its jambs, head and sill, `depth` into the
      // wall; and a dark plug a little way in (one of the pieces) that shows from outside, as the dark doorways did,
      // until Soldier's eye is inside the castle and the rooms are drawn
      const PLUGS = [], FLAGC = lin(0xbfae86);
      function throat(cx, cz, nx, nz, w, h0, h1, depth, plug) {
        const tx = nz, tz = -nx, P0 = (u, d) => [cx + tx * u - nx * d, cz + tz * u - nz * d];
        const l0 = P0(-w / 2, 0), l1 = P0(-w / 2, depth), r0 = P0(w / 2, 0), r1 = P0(w / 2, depth);
        wall(l0, l1, h0, h1, [tx, 0, tz], { c: SAND, m: 0.78, bands: false });
        wall(r0, r1, h0, h1, [-tx, 0, -tz], { c: SAND, m: 0.78, bands: false });
        poly([[l0[0], h1, l0[1]], [r0[0], h1, r0[1]], [r1[0], h1, r1[1]], [l1[0], h1, l1[1]]], [0, -1, 0], SAND, 0.5, true);
        poly([[l0[0], h0, l0[1]], [r0[0], h0, r0[1]], [r1[0], h0, r1[1]], [l1[0], h0, l1[1]]], [0, 1, 0], h0 < 1 ? FLAGC : SAND, 0.85, true);
        if (plug !== false) PLUGS.push({ x: cx - nx * 0.16, y: (h0 + h1) / 2, z: cz - nz * 0.16, yaw: Math.atan2(nx, nz), w: w + 0.03, h: h1 - h0 + 0.02 });
      }
      // a pointed head over a square-headed opening: the drafted surround and a dark tympanum on the face (w wide, the
      // opening hs high, the point at hs + w / 2)
      function doorHead(cx, y0, cz, nx, nz, w, hs) {
        const a = w / 2, b = a + 0.15;
        decal(cx, y0, cz, nx, nz, [[-b, hs], [b, hs], [b, hs + 0.1], [0, hs + a + 0.3], [-b, hs + 0.1]], CAP, 1.02, 0.025);
        decal(cx, y0, cz, nx, nz, [[-a, hs], [a, hs], [0, hs + a]], SAND, 0.72, 0.04);
      }

      // ================= the castle =================
      begin();
      const BED = S.moat.bed, WALK = S.curtain.h, SILL = 0.6, MER = S.curtain.merlon, PT = 0.55, CW = 0.9, PITCH = 2.1;
      const CU = S.curtain, half = CU.thick / 2;
      const merlons = [], crenels = [];
      // a crenellated parapet whose outer face runs from A to B ([x, z]) facing n ([nx, nz]); crenel centres as distances
      // along A→B (or 'auto'); floor: the walk it stands on. Records standing spots behind each crenel.
      function parapet(A, B, n, floor, cren, where, o) {
        o = o || {};
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]), tx = (B[0] - A[0]) / L, tz = (B[1] - A[1]) / L;
        const at = (s, d) => [A[0] + tx * s - n[0] * d, A[1] + tz * s - n[1] * d];
        if (cren === 'auto') {
          // symmetric about the middle; whichever phase leaves end merlons nearest 1.3 m
          let best = null;
          for (const ph of [0, 0.5]) {
            const list = [];
            for (let k = -10; k <= 10; k++) { const s = L / 2 + (k + ph) * PITCH; if (s - CW / 2 >= 0.85 && s + CW / 2 <= L - 0.85) list.push(s); }
            if (!list.length) continue;
            const endM = list[0] - CW / 2, score = Math.abs(endM - 1.3);
            if (!best || score < best.score) best = { list, score };
          }
          cren = best ? best.list : [];
        }
        if (!o.noSill) prism([at(0, 0), at(L, 0), at(L, PT), at(0, PT)], floor, floor + SILL, { c: CAP, m: 0.97, bands: false, topM: 1.05 });
        let s0 = 0;
        const segs = [];
        for (const s of cren.concat([L + CW / 2])) { const a = s0, b = s - CW / 2; if (b - a > 0.05) segs.push([a, b]); s0 = s + CW / 2; }
        for (const [a, b] of segs) {
          if (!o.noMerlons) prism([at(a, 0), at(b, 0), at(b, PT), at(a, PT)], floor + SILL, floor + MER, { c: CAP, m: 1, bands: false, topM: 1.1 });
          const mid = at((a + b) / 2, PT / 2);
          merlons.push({ x: mid[0], y: floor + SILL, z: mid[1], top: floor + MER, w: b - a, face: Math.atan2(n[0], n[1]), where });
        }
        for (const s of cren) { const p = at(s, PT + 0.5); crenels.push({ x: +p[0].toFixed(2), y: floor, z: +p[1].toFixed(2), face: +Math.atan2(n[0], n[1]).toFixed(3), where }); }
      }

      // ---- the curtain walls (centre lines x ±18, z -12 and -48; 1.8 thick; wall-walk y 10) ----
      const zS = CU.zS, zN = CU.zN, X = CU.x;
      const SO = zS + half, NO = zN - half, EO = X + half;            // outer faces: z -11.1, z -48.9, x 18.9
      const TR = S.towerR, RV = TR + 0.1, AP = RV * Math.cos(Math.PI / 12);   // the towers: 12 sides, vertex radius 4.6, apothem 4.44
      const towerEdge = (dz) => X - Math.sqrt(AP * AP - dz * dz);         // where a curtain face meets a tower (approx.)
      const GH = S.gatehouse, PO = S.postern, BA = S.barbican;
      // south: either side of the gatehouse; north: either side of the postern
      // ---- the way in and up for Soldier's eye (decision 24; research.md 18, Bodiam's plan turned 180°): the numbers the
      // masonry's openings and the rooms inside share ----
      const FL = 0.06, WK = WALK + 0.02, RH0 = S.rangesH, CYw = S.courtyard;
      const DW = 1.1, DH = 2.3;                          // courtyard doors: width and clear height (a pointed head above)
      const NEc = S.towers.NE, NEA = -Math.PI / 3;       // the north-east tower; its well is reached from the kitchen through its side at -60°
      const RTR = 3.9;                                   // the corner towers' rooms at the wall-walk: apothem of their linings
      const XK = 13.4;                                   // the north range's east end: the kitchen's east wall (the tower beyond)
      const STH = { x0: -17.1, x1: -14.2, z0: -42.95, z1: -40.05, top: RH0 + 3.4, c: [-15.65, -41.5], R: 1.15 };   // the north-west stair and its head on the west range roof
      const GST = { c: [4.2, -12.15], R: 1.25 };          // the gatehouse stair, in its east tower
      for (const sx of [-1, 1]) {
        box(Math.min(sx * GH.x1, sx * X), Math.max(sx * GH.x1, sx * X), BED, WALK, zS - half, zS + half, { seed: 11 });
        // (the north-east tower is hollow for its well: the curtains stop inside its masonry there)
        box(Math.min(sx * PO.x1, sx * (sx > 0 ? X - 4 : X)), Math.max(sx * PO.x1, sx * (sx > 0 ? X - 4 : X)), BED, WALK, zN - half, zN + half, { seed: 12 });
        box(sx * X - half, sx * X + half, BED, WALK, sx > 0 ? zN + 4 : zN, zS, { seed: 13 });
      }
      // a drip course just under the parapet, all round the outer faces
      const DRIP = (x0, x1, z0, z1) => box(x0, x1, WALK - 0.45, WALK - 0.2, z0, z1, { c: CAP, bands: false, m: 0.98 });
      for (const sx of [-1, 1]) {
        DRIP(Math.min(sx * GH.x1, sx * 14.5), Math.max(sx * GH.x1, sx * 14.5), SO - 0.05, SO + 0.12);
        DRIP(Math.min(sx * PO.x1, sx * 14.5), Math.max(sx * PO.x1, sx * 14.5), NO - 0.12, NO + 0.05);
        DRIP(sx > 0 ? EO - 0.05 : -EO - 0.12, sx > 0 ? EO + 0.12 : -EO + 0.05, -43.5, -16.5);
      }
      // parapets: south (explicit crenels so the curtain gun at x 11.5 and the damsel above the T2 hit have one)
      {
        const eS = towerEdge(SO - zS + PT / 2);
        // east run from the gatehouse (x 6) to the tower; crenels at x 7.3, 9.4, 11.5
        parapet([GH.x1, SO], [eS + 0.3, SO], [0, 1], WALK, [7.3, 9.4, 11.5].map((x) => x - GH.x1), 'curtainS');
        parapet([-(eS + 0.3), SO], [-GH.x1, SO], [0, 1], WALK, [-11.5, -9.4, -7.3].map((x) => x + eS + 0.3), 'curtainS');
        parapet([PO.x1, NO], [eS + 0.3, NO], [0, -1], WALK, 'auto', 'curtainN');
        parapet([-(eS + 0.3), NO], [-PO.x1, NO], [0, -1], WALK, 'auto', 'curtainN');
        const MT = S.midTowers, mz0 = -30 - S.midHz, mz1 = -30 + S.midHz, tz = zS - Math.sqrt(AP * AP - (EO - X - PT / 2) ** 2) + 0.3;
        for (const sx of [-1, 1]) {
          parapet([sx * EO, tz], [sx * EO, mz1], [sx, 0], WALK, 'auto', sx > 0 ? 'curtainE' : 'curtainW');
          parapet([sx * EO, mz0], [sx * EO, zN + (zS - tz)], [sx, 0], WALK, 'auto', sx > 0 ? 'curtainE' : 'curtainW');
        }
        void MT;
      }
      // lancet windows in the curtain (two storeys over basements, research 3), and small lower lights
      for (const sx of [-1, 1]) {
        for (const x of [8.6, 12.0]) { lancet(sx * x, 5.4, SO, 0, 1, 0.55, 1.7); squareWin(sx * x, 2.1, SO, 0, 1, 0.45, 0.6); }
        for (const x of [6.0, 10.0]) { lancet(sx * x, 5.4, NO, 0, -1, 0.55, 1.7); squareWin(sx * x, 2.1, NO, 0, -1, 0.45, 0.6); }
        for (const z of [-20.5, -24.5, -35.5, -39.5]) {
          // the chapel's window in the west curtain: three plain pointed lights (research 18a, 18c), over its altar
          if (sx < 0 && z === -20.5) { threeLights(-EO, 2.6, -19.2, -1, 0); continue; }
          lancet(sx * EO, 5.4, z, sx, 0, 0.55, 1.7); squareWin(sx * EO, 2.1, z, sx, 0, 0.45, 0.6);
        }
      }

      // ---- the four round corner towers: 12 sides (a side's middle faces due south), battlements at 14 ----
      const TH = S.towerH, BR = S.breach, breachTower = 'SW';
      const towerTops = {};
      for (const [name, [cx, cz]] of Object.entries(S.towers)) {
        const pts = ngonPts(cx, cz, RV, 12, Math.PI / 12), seed = 20 + cx + cz;
        const vtx = (j, r) => { const a = Math.PI / 12 + j * TAU / 12; return [cx + Math.sin(a) * r, cz + Math.cos(a) * r]; };   // side k runs from vtx(k-1) to vtx(k)
        // the doors where the wall-walks come in (into the room at the walk's level, RTR), and the north-east tower's way
        // down to its well from the kitchen: real openings (holes in those sides, a throat through to the room)
        const thX = cx > 0 ? -Math.PI / 2 : Math.PI / 2, thZ = cz > -30 ? Math.PI : 0;
        const tdoors = [
          { th: thX, c: [cx + Math.sin(thX) * AP, cz + (cz > -30 ? -PT / 2 : PT / 2)] },
          { th: thZ, c: [cx + (cx > 0 ? -PT / 2 : PT / 2), cz + Math.cos(thZ) * AP] },
        ];
        for (const d of tdoors) { d.h0 = WK; d.h1 = WK + 2.0; d.w = 0.8; d.depth = AP - RTR + 0.02; }
        if (name === 'NE') tdoors.push({ th: NEA, c: [cx + Math.sin(NEA) * AP, cz + Math.cos(NEA) * AP], h0: -0.55, h1: 2.45, w: 1.0, inner: true });
        const tSkip = (nx, nz) => tdoors.some((d) => nx * Math.sin(d.th) + nz * Math.cos(d.th) > 0.99);
        const tFaces = (y1) => {
          for (const d of tdoors) {
            const k = Math.round(d.th / (TAU / 12)), A = vtx(k - 1, RV), B = vtx(k, RV);
            holeWall(A, B, BED, y1, [Math.sin(d.th), 0, Math.cos(d.th)], [holeOn(A, B, d.c, d.w, d.h0, d.h1)], { seed });
            if (!d.inner) { throat(d.c[0], d.c[1], Math.sin(d.th), Math.cos(d.th), d.w, d.h0, d.h1, d.depth); doorHead(d.c[0], d.h0, d.c[1], Math.sin(d.th), Math.cos(d.th), d.w, d.h1 - d.h0); }
          }
        };
        prism(pts, BED, TH, { seed, skip: tSkip }); tFaces(TH);
        frustum(cx, cz, RV + 0.45, RV + 0.45, BED, 0.3, 12, Math.PI / 12, SAND, 0.95);       // the plinth in the water
        frustum(cx, cz, RV + 0.45, RV, 0.3, 1.0, 12, Math.PI / 12, SAND, 0.98);
        frustum(cx, cz, RV + 0.14, RV + 0.14, TH - 0.55, TH - 0.25, 12, Math.PI / 12, CAP, 1.0);   // a string course
        const out = Math.atan2(cx - 0, cz + 30);                     // away from the courtyard
        const inward = out + Math.PI;
        // the stair turret on the courtyard side, the head of the tower's newel stair (research 18b), rising over the
        // parapet; its door opens onto the roof, facing the tower's middle
        const tx = cx + Math.sin(inward) * 2.85, tzz = cz + Math.cos(inward) * 2.85, TT = TH + 2.4;
        {
          const tp = ngonPts(tx, tzz, 1.3, 8, Math.PI / 8), on = [Math.sin(out), Math.cos(out)];
          prism(tp, TH - 1, TT, { seed: 31, skip: (nx, nz) => nx * on[0] + nz * on[1] > 0.99 });
          const A = [tx + Math.sin(out - Math.PI / 8) * 1.3, tzz + Math.cos(out - Math.PI / 8) * 1.3], B = [tx + Math.sin(out + Math.PI / 8) * 1.3, tzz + Math.cos(out + Math.PI / 8) * 1.3];
          const fc = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
          holeWall(A, B, TH - 1, TT, [on[0], 0, on[1]], [holeOn(A, B, fc, 0.8, TH + 0.02, TH + 2.0)], { seed: 31 });
          throat(fc[0], fc[1], on[0], on[1], 0.8, TH + 0.02, TH + 2.0, 1.3 * Math.cos(Math.PI / 8) - 1.0 + 0.02);
        }
        for (let k = 0; k < 4; k++) { const a = inward + k * Math.PI / 2; obox(tx + Math.sin(a) * 0.98, tzz + Math.cos(a) * 0.98, a, 0.42, 0.22, TT, TT + 0.55, { c: CAP, bands: false, topM: 1.1 }); }
        towerTops[name] = { cx, cz, turret: [tx, tzz], poleTop: TT + 0.55, out, rail: null };
        // parapet: per side a sill and a merlon in the middle of the side; crenels at the corners
        const sideLen = 2 * RV * Math.sin(Math.PI / 12);
        for (let k = 0; k < 12; k++) {
          const th = k * TAU / 12;
          let dth = th - BR.face; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
          const inBreach = name === breachTower && Math.abs(dth) < BR.arc;
          const mx = cx + Math.sin(th) * (AP - PT / 2), mz = cz + Math.cos(th) * (AP - PT / 2);
          if (inBreach) {
            // the stump: a few ragged teeth of the parapet that stay when the battlement is knocked off
            for (let j = 0; j < 4; j++) {
              const off = (j - 1.5) * 0.62 + 0.12 * (hash(k, j, 2, 2) - 0.5), h = 0.08 + 0.42 * hash(k, j, 5, 1), w = 0.2 + 0.1 * hash(k, j, 7, 3);
              obox(mx + Math.cos(th) * off, mz - Math.sin(th) * off, th + 0.15 * (hash(k, j, 1, 9) - 0.5), w, PT / 2 - 0.05, TH, TH + h, { c: CAP, bands: false, m: 0.86, topM: 1.12 });
            }
            continue;
          }
          obox(mx, mz, th, sideLen / 2 + 0.16, PT / 2, TH, TH + SILL, { c: CAP, bands: false, m: 0.97, topM: 1.05 });
          obox(mx, mz, th, 0.7, PT / 2, TH + SILL, TH + MER, { c: CAP, bands: false, topM: 1.1 });
          merlons.push({ x: mx, y: TH + SILL, z: mz, top: TH + MER, w: 1.4, face: th, where: 'tower' + name });
        }
        // crenels at the corners, except where the turret stands
        for (let k = 0; k < 12; k++) {
          const a = Math.PI / 12 + k * TAU / 12;
          let d = Math.atan2(Math.sin(a - inward), Math.cos(a - inward));
          if (Math.abs(d) < 0.75) continue;
          let db = Math.atan2(Math.sin(a - BR.face), Math.cos(a - BR.face));
          crenels.push({ x: +(cx + Math.sin(a) * 3.3).toFixed(2), y: TH, z: +(cz + Math.cos(a) * 3.3).toFixed(2), face: +Math.atan2(Math.sin(a), Math.cos(a)).toFixed(3), where: 'tower' + name, breach: name === breachTower && Math.abs(db) < BR.arc + 0.3 ? true : undefined });
        }
        // lancets on the sides facing out of the castle; doors where the wall-walks come in
        for (let k = 0; k < 12; k++) {
          const th = k * TAU / 12;
          const d = Math.abs(Math.atan2(Math.sin(th - out), Math.cos(th - out)));
          const fx = cx + Math.sin(th) * AP, fz = cz + Math.cos(th) * AP;
          if (d < 1.4) {
            lancet(fx, 6.6, fz, Math.sin(th), Math.cos(th), 0.55, 1.7);
            if (k % 2 === 0) lancet(fx, 10.3, fz, Math.sin(th), Math.cos(th), 0.5, 1.5);
            else squareWin(fx, 2.6, fz, Math.sin(th), Math.cos(th), 0.4, 0.55);
          }
        }
        // (the wall-walk doors into the tower are real openings: see tdoors above)
      }

      // ---- the square mid-towers in the east and west walls, 13 high ----
      const MH = S.midTowerH;
      for (const [name, [cx, cz]] of Object.entries(S.midTowers)) {
        const sx = Math.sign(cx), x0 = cx - S.midHx, x1 = cx + S.midHx, z0 = cz - S.midHz, z1 = cz + S.midHz;
        // the wall-walk runs through it at the walk's level: a door in each of its north and south faces
        box(x0, x1, BED, MH, z0, z1, { seed: 40, skip: (nx, nz) => Math.abs(nz) > 0.9 });
        for (const zf of [z0, z1]) {
          const nz = Math.sign(zf - cz), A = [x0, zf], B = [x1, zf], c = [sx * (Math.abs(cx) - S.midHx + 0.45), zf];
          holeWall(A, B, BED, MH, [0, 0, nz], [holeOn(A, B, c, 0.8, WK, WK + 2.0)], { seed: 40 });
          throat(c[0], zf, 0, nz, 0.8, WK, WK + 2.0, 0.47);
          doorHead(c[0], WK, zf, 0, nz, 0.8, 2.0);
        }
        box(x0 - 0.35, x1 + 0.35, BED, 0.3, z0 - 0.35, z1 + 0.35, { m: 0.95, topM: 1 });
        box(x0 - 0.12, x1 + 0.12, MH - 0.55, MH - 0.25, z0 - 0.12, z1 + 0.12, { c: CAP, bands: false });
        const xo = sx > 0 ? x1 : x0;
        parapet([xo, z0], [xo, z1], [sx, 0], MH, 'auto', 'mid' + name);
        parapet([x0, z1], [x1, z1], [0, 1], MH, 'auto', 'mid' + name);
        parapet([x0, z0], [x1, z0], [0, -1], MH, 'auto', 'mid' + name);
        const xi = sx > 0 ? x0 : x1;
        parapet([xi, z0], [xi, z1], [-sx, 0], MH, [], 'mid' + name, {});
        lancet(xo, 6.4, cz, sx, 0, 0.6, 1.8); lancet(xo, 9.9, cz, sx, 0, 0.5, 1.5); squareWin(xo, 2.6, cz, sx, 0, 0.45, 0.6);
        for (const zf of [z0, z1]) lancet(cx + sx * 1.0, 8.0, zf, 0, Math.sign(zf - cz), 0.5, 1.5);
      }

      // ---- the gatehouse: twin towers either side of the vaulted passage, a machicolated parapet across the front ----
      const GV = GH.vault, GP = GH.passage / 2, GT = GH.h, GF = GH.z1, GR = GF - 1.2;   // the towers' fronts at z -7, the arch set back 1.2 between them
      // a face turned into a passage is dark (deeper toward the vault), up to the vault
      const passDark = (vault) => (nx, side, ym) => (Math.abs(nx) > 0.9 && Math.sign(nx) === -side && ym < vault + 0.05 ? 0.42 + 0.1 * (1 - ym / vault) : 1);
      const inPass = passDark(GV);
      for (const sx of [-1, 1]) {
        // its east and west faces carry doors: the guardroom off the passage (west tower), the stair off the passage and
        // its top door onto the south-east wall-walk (east tower), research 18a-b
        box(Math.min(sx * GP, sx * GH.x1), Math.max(sx * GP, sx * GH.x1), BED, GT, GH.z0, GF, { seed: 50, skip: (nx) => Math.abs(nx) > 0.9 });
        {
          const Ai = [sx * GP, GH.z0], Bi = [sx * GP, GF], ci = sx < 0 ? [-GP, -11.6] : [GP, GST.c[1]], wi = sx < 0 ? 0.9 : 0.8;
          holeWall(Ai, Bi, BED, GT, [-sx, 0, 0], [holeOn(Ai, Bi, ci, wi, FL, FL + DH)], { seed: 50, fmY: (ym) => inPass(-sx, sx, ym) });
          throat(ci[0], ci[1], -sx, 0, wi, FL, FL + DH, sx < 0 ? 0.5 : GST.c[0] - GST.R - GP + 0.02, false);
          const Ao = [sx * GH.x1, GH.z0], Bo = [sx * GH.x1, GF], co = [GH.x1, GST.c[1]];
          holeWall(Ao, Bo, BED, GT, [sx, 0, 0], sx > 0 ? [holeOn(Ao, Bo, co, 0.8, WK, WK + 2.0)] : [], { seed: 50 });
          if (sx > 0) { throat(co[0], co[1], 1, 0, 0.8, WK, WK + 2.0, GH.x1 - GST.c[0] - GST.R + 0.02); doorHead(co[0], WK, co[1], 1, 0, 0.8, 2.0); }
        }
        box(Math.min(sx * (GH.x1 + 0.3), sx * GP), Math.max(sx * (GH.x1 + 0.3), sx * GP), -1, 0.35, GF - 0.05, GF + 0.3, { m: 0.92, topM: 1 });  // a plinth on the apron
      }
      box(-GP, GP, GV, GT, GH.z0, GR, { seed: 51, under: 0.3 });              // over the passage (the vault)
      const gSpring = archZ(0, GR, -1, GP, GV, 0.6);
      // the machicolations: corbels across the front, and the parapet jutting out on them (stones dropped between)
      const MZ0 = GF, MZ1 = GF + 0.7, MY0 = GT - 1.25;
      for (let i = 0; i <= 12; i++) {
        const x = -5.75 + i * (11.5 / 12);
        const zb = Math.abs(x) < GP + 0.2 ? GF - 0.2 : GF;
        box(x - 0.2, x + 0.2, MY0 - 0.85, MY0, zb, MZ1 - 0.05, { c: CAP, bands: false, m: 0.95, under: 0.7 });
      }
      box(-GH.x1 - 0.1, GH.x1 + 0.1, MY0, GT + SILL, MZ1 - 0.75, MZ1, { c: CAP, bands: false, m: 0.98, under: 0.34, topM: 1.05 });
      box(-GP, GP, GT - 0.5, GT, GR, MZ1 - 0.74, { c: CAP, bands: false, under: 0.35, topM: 1.0 });   // the floor over the recess
      // its merlons: crenels over the gate and at the two Bull guns (x ±3.8)
      parapet([-GH.x1 - 0.1, MZ1], [GH.x1 + 0.1, MZ1], [0, 1], GT, [-3.8, -1.9, 0, 1.9, 3.8].map((x) => x + GH.x1 + 0.1), 'gatehouse', { noSill: true });
      for (const sx of [-1, 1]) parapet([sx * GH.x1, GH.z0], [sx * GH.x1, MZ1 - 0.75], [sx, 0], GT, 'auto', 'gatehouse');
      parapet([-GH.x1, GH.z0], [GH.x1, GH.z0], [0, -1], GT, 'auto', 'gatehouse');
      // the arms over the gate (Bodiam has three shields over its gate)
      shield(0, 6.0, GR, 0, 1, 1.05); shield(-1.0, 6.25, GR, 0, 1, 0.7); shield(1.0, 6.25, GR, 0, 1, 0.7);
      // three keyhole gunloops at its foot; windows above
      gunloop(-3.8, 0.55, GF, 0, 1); gunloop(3.8, 0.55, GF, 0, 1); gunloop(-GH.x1, 0.55, -10.6, -1, 0);
      for (const sx of [-1, 1]) {
        lancet(sx * 3.8, 5.6, GF, 0, 1, 0.55, 1.7); lancet(sx * 3.8, 9.6, GF, 0, 1, 0.6, 1.9);
        lancet(sx * GH.x1, 9.6, -9.0, sx, 0, 0.5, 1.6);
      }
      lancet(0, 9.2, GR, 0, 1, 0.6, 1.9);
      // the gate's doors, folded back against the passage walls; the passage floor
      for (const sx of [-1, 1]) box(Math.min(sx * GP, sx * (GP - 0.14)), Math.max(sx * GP, sx * (GP - 0.14)), 0.03, 3.6, -10.9, -9.25, { c: OAK, bands: false, m: 0.8, bandFn: (y) => (Math.abs(y - 0.8) < 0.15 || Math.abs(y - 2.6) < 0.15 ? 0.6 : 1), cuts: [0.65, 0.95, 2.45, 2.75] });

      // ---- the domestic ranges round the courtyard (two storeys, roofs at 9: lead flats) ----
      const CY = S.courtyard, RH = S.rangesH, IN = X - half;     // inner face of the curtain: 17.1
      const rangeO = { seed: 60, top: LEAD, topM: 1 };
      // the courtyard doors and the screens passage's openings are real (Soldier's eye walks in): a hole in the face, a
      // throat through to the room's lining, a dark plug, and a pointed head (decision 24; research 18)
      const cdoor = (A, B, c, nx, nz, w, depth, plug) => ({ hole: holeOn(A, B, c, w, FL, FL + DH), go: () => { throat(c[0], c[1], nx, nz, w, FL, FL + DH, depth, plug); doorHead(c[0], FL, c[1], nx, nz, w, DH); } });
      const faceDoors = (A, B, n, list, o) => { holeWall(A, B, -0.3, RH, n, list.map((d) => d.hole), o); for (const d of list) d.go(); };
      for (const sx of [-1, 1]) {
        // south range, split by the gate passage (and kept out of the gatehouse's towers, which hold the guardroom and
        // the stair); its vault over the passage
        box(Math.min(sx * GP, sx * GH.x1), Math.max(sx * GP, sx * GH.x1), -0.3, RH, CY.z1, GH.z0, Object.assign({ fm: (nx, nz, ym) => inPass(nx, sx, ym) }, rangeO));
        box(Math.min(sx * GH.x1, sx * IN), Math.max(sx * GH.x1, sx * IN), -0.3, RH, CY.z1, zS - half + 0.01, rangeO);
        // north range, split by the postern passage (the screens passage: research 18c). West of it the great hall; east
        // of it the buttery, the way to the kitchen and the pantry behind three arches, then the kitchen, which ends at XK
        // (the north-east tower beyond is hollow for its well; over the corner there is only the roof)
        const xa = Math.min(sx * PO.passage / 2, sx * (sx > 0 ? XK : IN)), xb = Math.max(sx * PO.passage / 2, sx * (sx > 0 ? XK : IN)), PP2 = PO.passage / 2;
        const zA = zN + half - 0.01;
        box(xa, xb, -0.3, RH, zA, CY.z0, Object.assign({ skip: (nx, nz) => nz > 0.9 || nx * sx < -0.9 || (sx > 0 && nx > 0.9) }, rangeO));
        {
          const sA = [xa, CY.z0], sB = [xb, CY.z0];
          faceDoors(sA, sB, [0, 0, 1], [cdoor(sA, sB, [sx < 0 ? -2.6 : 6.5, CY.z0], 0, 1, DW, 0.5)], { seed: 60 });
          const pA = [sx * PP2, zA], pB = [sx * PP2, CY.z0], pn = [-sx, 0, 0], pf = { seed: 60, fmY: (ym) => passDark(PO.vault)(-sx, sx, ym) };
          // (in the passage, seen only from inside the castle: no plugs)
          if (sx < 0) faceDoors(pA, pB, pn, [cdoor(pA, pB, [-PP2, -45.3], 1, 0, 0.9, 0.5, false)], pf);
          else faceDoors(pA, pB, pn, [-46.45, -45.3, -44.12].map((z) => cdoor(pA, pB, [PP2, z], -1, 0, 0.7, 0.5, false)), pf);
          if (sx > 0) {
            // the kitchen's east end, with the way through to the tower (no throat: the passage's own lining runs through)
            const eA = [XK, zA], eB = [XK, CY.z0];
            holeWall(eA, eB, -0.3, RH, [1, 0, 0], [holeOn(eA, eB, [XK, -45.34], 1.25, FL - 0.02, 2.5)], { seed: 60 });
            poly([[XK, RH, zA], [IN, RH, zA], [IN, RH, CY.z0], [XK, RH, CY.z0]], [0, 1, 0], LEAD, 1, false);   // the roof over the corner
          }
        }
        // east and west ranges. The west range holds the north-west stair (its head on the roof), the great chamber and
        // the chapel; the east range the retainers' hall and their kitchen (research 18a)
        const ex0 = Math.min(sx * CY.x1, sx * IN), ex1 = Math.max(sx * CY.x1, sx * IN);
        box(ex0, ex1, -0.3, RH, CY.z0, CY.z1, Object.assign({}, rangeO, { noTop: sx < 0, skip: (nx) => nx * sx < -0.9 }));
        {
          const fA = [sx * CY.x1, CY.z0], fB = [sx * CY.x1, CY.z1];
          faceDoors(fA, fB, [-sx, 0, 0], (sx < 0 ? [STH.c[1], -34, -22] : [-34, -22]).map((z) => cdoor(fA, fB, [sx * CY.x1, z], -sx, 0, 1.0, 0.5)), { seed: 60 });
          if (sx < 0) {
            // the roof round the stair head
            const T0 = RH, top = (x0, x1, z0, z1) => poly([[x0, T0, z0], [x1, T0, z0], [x1, T0, z1], [x0, T0, z1]], [0, 1, 0], LEAD, 1, false);
            top(ex0, ex1, CY.z0, STH.z0); top(ex0, ex1, STH.z1, CY.z1); top(STH.x1, ex1, STH.z0, STH.z1);
          }
        }
      }
      // the north-west stair's head: a square turret on the west range roof against the curtain, its door onto the
      // west wall-walk (research 18b: "climb up an internal stair to the parapet walk in several places")
      {
        box(STH.x0, STH.x1, RH0, STH.top, STH.z0, STH.z1, { seed: 62, skip: (nx) => nx < -0.9, top: CAP, topM: 1.02 });
        const A = [STH.x0, STH.z0], B = [STH.x0, STH.z1], c = [STH.x0, STH.c[1]];
        holeWall(A, B, RH0, STH.top, [-1, 0, 0], [holeOn(A, B, c, 0.8, WK, WK + 2.0)], { seed: 62 });
        throat(c[0], c[1], -1, 0, 0.8, WK, WK + 2.0, STH.c[0] - STH.R - STH.x0 + 0.02);
        doorHead(c[0], WK, c[1], -1, 0, 0.8, 2.0);
        box(STH.x0 - 0.08, STH.x1 + 0.08, STH.top - 0.3, STH.top, STH.z0 - 0.08, STH.z1 + 0.08, { c: CAP, bands: false, topM: 1.05 });
        lancet(STH.x1, RH0 + 1.4, STH.c[1], 1, 0, 0.4, 1.1);
      }
      box(-GP, GP, GV, RH, CY.z1, GH.z0 + 0.01, Object.assign({ under: 0.3 }, rangeO));
      box(-PO.passage / 2, PO.passage / 2, PO.vault, RH, zN + half - 0.01, CY.z0, Object.assign({ under: 0.3 }, rangeO));
      const cpO = { c: CAP, bands: false, m: 0.98, topM: 1.06 };
      box(CY.x0 - 0.01, CY.x1 + 0.01, RH, RH + 0.6, CY.z1 - 0.01, CY.z1 + 0.4, cpO);
      box(CY.x0 - 0.01, CY.x1 + 0.01, RH, RH + 0.6, CY.z0 - 0.4, CY.z0 + 0.01, cpO);
      box(CY.x1 - 0.01, CY.x1 + 0.4, RH, RH + 0.6, CY.z0 + 0.4, CY.z1 - 0.4, cpO);
      box(CY.x0 - 0.4, CY.x0 + 0.01, RH, RH + 0.6, CY.z0 + 0.4, CY.z1 - 0.4, cpO);
      archZ(0, CY.z1, 1, GP, GV, 0.5);                                         // the gate passage's courtyard mouth
      archZ(0, CY.z0, -1, PO.passage / 2, PO.vault, 0.5);                       // the postern passage's courtyard mouth
      // chimneys (Bodiam's ranges carry tall chimney stacks): the hall and the kitchen in the north range, two more
      for (const [x, z, w, d] of [[-7, -45.4, 1.1, 0.8], [6.5, -45.4, 1.3, 0.9], [10, -45.4, 1.3, 0.9], [15.2, -25, 0.8, 1.1], [-15.2, -36, 0.8, 1.1]]) {
        box(x - w / 2, x + w / 2, RH - 0.5, 12.6, z - d / 2, z + d / 2, { seed: 70 });
        box(x - w / 2 - 0.12, x + w / 2 + 0.12, 12.6, 12.85, z - d / 2 - 0.12, z + d / 2 + 0.12, { c: CAP, bands: false });
        poly([[x - w / 2 + 0.1, 12.86, z - d / 2 + 0.1], [x + w / 2 - 0.1, 12.86, z - d / 2 + 0.1], [x + w / 2 - 0.1, 12.86, z + d / 2 - 0.1], [x - w / 2 + 0.1, 12.86, z + d / 2 - 0.1]], [0, 1, 0], DEEP, 1, true);
      }
      // courtyard faces: the great hall's tall two-light windows (north range, west of the screens passage), the kitchen,
      // the chapel (east range), chambers; doors as dark pointed openings
      const door = (cx, cz, nx, nz, w, h) => { decal(cx, 0, cz, nx, nz, [[-w / 2 - 0.15, 0], [w / 2 + 0.15, 0], [w / 2 + 0.15, h - w * 0.4], [0, h + 0.3], [-w / 2 - 0.15, h - w * 0.4]], CAP, 1.02, 0.025); decal(cx, 0, cz, nx, nz, [[-w / 2, 0], [w / 2, 0], [w / 2, h - w * 0.5], [0, h], [-w / 2, h - w * 0.5]], DEEP, 1, 0.05); };
      for (const x of [-11, -8, -5]) hallWindow(x, 3.6, CY.z0, 0, 1, 1.3, 4.0);
      // (the hall door at x -2.6 is a real opening: see the ranges above)
      for (const x of [4.5, 8.5, 11.5]) { lancet(x, 5.6, CY.z0, 0, 1, 0.55, 1.6); squareWin(x, 1.9, CY.z0, 0, 1, 0.55, 0.7); }
      // (the kitchen door at x 6.5 likewise)
      for (const z of [-20, -24, -28, -32, -36, -40]) { lancet(CY.x1, 5.6, z, -1, 0, 0.55, 1.6); lancet(CY.x0, 5.6, z, 1, 0, 0.55, 1.6); }
      hallWindow(CY.x1, 3.6, -38.5, -1, 0, 1.1, 3.6);                           // the retainers' hall's window
      // (the doors at z -22 and -34 in the east and west ranges are real openings: see the ranges above)
      for (const z of [-26, -30]) { squareWin(CY.x1, 1.9, z, -1, 0, 0.5, 0.7); squareWin(CY.x0, 1.9, z, 1, 0, 0.5, 0.7); }
      for (const sx of [-1, 1]) for (const x of [4.5, 8, 11.5]) { lancet(sx * x, 5.6, CY.z1, 0, -1, 0.55, 1.6); squareWin(sx * x, 1.9, CY.z1, 0, -1, 0.5, 0.7); }
      // the gatehouse's back rising over the south range
      for (const sx of [-1, 1]) lancet(sx * 3.8, 11.2, GH.z0, 0, -1, 0.5, 1.5);

      // ---- the barbican: a squat two-storey outer gate on its own island ----
      const BP = BA.passage / 2, BV = BA.vault, BT = BA.h;
      for (const sx of [-1, 1]) {
        box(Math.min(sx * BP, sx * BA.x1), Math.max(sx * BP, sx * BA.x1), -2.0, BT, BA.z0, BA.z1, { seed: 80, fm: (nx, nz, ym) => passDark(BA.vault)(nx, sx, ym) });
        box(Math.min(sx * BP, sx * (BA.x1 + 0.25)), Math.max(sx * BP, sx * (BA.x1 + 0.25)), -2.0, 0.3, BA.z0 - 0.25, BA.z1 + 0.25, { m: 0.93, topM: 1 });
      }
      box(-BP, BP, BV, BT, BA.z0, BA.z1, { seed: 81, under: 0.3 });
      archZ(0, BA.z1, -1, BP, BV, 0.25);
      archZ(0, BA.z0, 1, BP, BV, 0.5);
      box(-BA.x1 - 0.1, BA.x1 + 0.1, BT - 0.5, BT - 0.22, BA.z0 - 0.1, BA.z1 + 0.1, { c: CAP, bands: false });
      parapet([-BA.x1, BA.z1], [BA.x1, BA.z1], [0, 1], BT, [-2.1, 0, 2.1].map((x) => x + BA.x1), 'barbican');
      parapet([BA.x1, BA.z0], [-BA.x1, BA.z0], [0, -1], BT, 'auto', 'barbican');
      for (const sx of [-1, 1]) parapet([sx * BA.x1, BA.z0 + PT], [sx * BA.x1, BA.z1 - PT], [sx, 0], BT, 'auto', 'barbican', {});
      shield(0, 5.55, BA.z1, 0, 1, 0.95);
      for (const sx of [-1, 1]) { lancet(sx * 2.55, 5.2, BA.z1, 0, 1, 0.45, 1.4); lancet(sx * BA.x1, 5.2, -3, sx, 0, 0.45, 1.4); }
      // its gate: two closed oak leaves, iron-strapped, set behind the arch (the ram strikes here)
      {
        const z0 = BA.z1 - 0.42, z1 = BA.z1 - 0.27;
        const strap = (y) => (Math.abs(y - 0.6) < 0.12 || Math.abs(y - 1.9) < 0.12 || Math.abs(y - 3.2) < 0.12 ? 0.55 : 1);
        for (const sx of [-1, 1]) box(Math.min(sx * 0.02, sx * (BP + 0.1)), Math.max(sx * 0.02, sx * (BP + 0.1)), 0.03, BV, z0, z1, { c: OAK, bands: false, m: 0.95, bandFn: strap, cuts: [0.48, 0.72, 1.78, 2.02, 3.08, 3.32] });
        box(-0.03, 0.03, 0.03, BV, z1 - 0.02, z1 + 0.01, { c: DEEP, bands: false, flat: true, noTop: true });
      }

      // ---- the postern tower: a small square gate tower in the north wall ----
      const PP = PO.passage / 2, PV = PO.vault, PTH = PO.h;
      // (below the wall-walk's level it's two blocks either side of the vaulted passage; above, one block with a small
      // room the north wall-walk passes through, a door each side: decision 24)
      const PY = WALK - 0.05;
      for (const sx of [-1, 1]) box(Math.min(sx * PP, sx * PO.x1), Math.max(sx * PP, sx * PO.x1), BED, PY, PO.z0, PO.z1, { seed: 90, noTop: true, fm: (nx, nz, ym) => passDark(PO.vault)(nx, sx, ym) });
      box(-PP, PP, PV, PY, PO.z0, PO.z1, { seed: 91, under: 0.3, noTop: true });
      box(PO.x0, PO.x1, PY, PTH, PO.z0, PO.z1, { seed: 90, skip: (nx) => Math.abs(nx) > 0.9 });
      for (const sx of [-1, 1]) {
        const A = [sx * PO.x1, PO.z0], B = [sx * PO.x1, PO.z1], c = [sx * PO.x1, zN - half + PT + (CU.thick - PT) / 2];
        holeWall(A, B, PY, PTH, [sx, 0, 0], [holeOn(A, B, c, 0.8, WK, WK + 1.86)], { seed: 90 });
        throat(c[0], c[1], sx, 0, 0.8, WK, WK + 1.86, 0.52);
      }
      archZ(0, PO.z0, 1, PP, PV, 0.5);
      box(-PO.x1 - 0.1, PO.x1 + 0.1, PTH - 0.5, PTH - 0.22, PO.z0 - 0.1, PO.z1 + 0.1, { c: CAP, bands: false });
      parapet([PO.x1, PO.z0], [-PO.x1, PO.z0], [0, -1], PTH, 'auto', 'postern');
      for (const sx of [-1, 1]) parapet([sx * PO.x1, PO.z0 + PT], [sx * PO.x1, PO.z1 - PT], [sx, 0], PTH, [], 'postern', {});
      parapet([-PO.x1, PO.z1], [PO.x1, PO.z1], [0, 1], PTH, [], 'postern', {});
      lancet(0, 5.6, PO.z0, 0, -1, 0.55, 1.6); lancet(0, 8.7, PO.z0, 0, -1, 0.5, 1.4);
      shield(0, 4.0, PO.z0, 0, -1, 0.6);

      // ---- floors: stone flags in the passages and a paved way across the courtyard (3 cm proud of the ground) ----
      const FY = 0.03, FLAG = lin(0xbfae86);
      const pave = (x0, x1, z0, z1, step) => {
        for (let z = z0; z < z1 - 1e-6; z += step) {
          const za = z, zb = Math.min(z1, z + step), k = Math.round((z - z0) / step);
          const m = (k & 1 ? 0.9 : 0.97) + 0.06 * (hash(k, x0, 9, 2) - 0.5);
          poly([[x0, FY, za], [x1, FY, za], [x1, FY, zb], [x0, FY, zb]], [0, 1, 0], FLAG, m, true);
        }
      };
      const PS = S.passages;
      pave(PS.gate.x0, PS.gate.x1, PS.gate.z0, PS.gate.z1, 0.7);
      pave(PS.barbican.x0, PS.barbican.x1, PS.barbican.z0, PS.barbican.z1, 0.7);
      pave(PS.postern.x0, PS.postern.x1, PS.postern.z0, PS.postern.z1, 0.7);
      pave(-1.4, 1.4, CY.z0 + 0.5, PS.gate.z0, 0.9);
      ctx.addSurface((x, z) => {
        if (S.inPassage(x, z)) return FY;
        if (Math.abs(x) <= 1.4 && z > CY.z0 + 0.5 && z < PS.gate.z0) return FY;
        return null;
      });
      // the floors people stand on up on the walls (never over a passage, whose floor is the one below): the wall-walks
      // (10), the corner towers' tops (14), the mid-towers (13), the gatehouse roof (16), the barbican (8), the postern (12)
      {
        const R2 = (AP - PT) * (AP - PT), inR = (x, z, x0, x1, z0, z1) => x > x0 && x < x1 && z > z0 && z < z1;
        const TW = Object.values(S.towers), MIDS = Object.values(S.midTowers);
        ctx.addSurface((x, z) => {
          if (Math.abs(x) > 23 || z > 0 || z < -52 || S.inPassage(x, z)) return null;
          for (const [cx, cz] of TW) if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < R2) return TH;
          for (const [cx, cz] of MIDS) if (inR(x, z, cx - S.midHx + PT, cx + S.midHx - PT, cz - S.midHz + PT, cz + S.midHz - PT)) return MH;
          if (inR(x, z, -GH.x1 + PT, GH.x1 - PT, GH.z0 + PT, MZ1 - 0.75)) return GT;
          if (inR(x, z, BA.x0 + PT, BA.x1 - PT, BA.z0 + PT, BA.z1 - PT)) return BT;
          if (inR(x, z, PO.x0 + PT, PO.x1 - PT, PO.z0 + PT, PO.z1)) return PTH;
          if (inR(x, z, -X, X, zS - half, SO - PT) || inR(x, z, -X, X, NO + PT, zN + half)) return WALK;
          if (inR(Math.abs(x), z, X - half, EO - PT, zN, zS)) return WALK;
          return null;
        });
      }

      // ---- the bridges: deck tops exactly on SIEGE.deckY ----
      const deck = (D, thick, step, planks) => {
        const zs = [];
        for (let z = D.z0; z < D.z1 - 1e-6; z += step) zs.push(z);
        zs.push(D.z1);
        for (let i = 0; i < zs.length - 1; i++) {
          const za = zs[i], zb = zs[i + 1];
          const L0 = S.deckY(D.x - D.half, za), R0 = S.deckY(D.x + D.half, za), L1 = S.deckY(D.x - D.half, zb), R1 = S.deckY(D.x + D.half, zb);
          const m = planks ? (i & 1 ? 0.88 : 1) * (0.96 + 0.08 * hash(i, D.z0, 4, 4)) : 1;
          const a = [D.x - D.half, L0, za], b = [D.x + D.half, R0, za], c = [D.x + D.half, R1, zb], d = [D.x - D.half, L1, zb];
          poly([a, b, c, d], [0, 1, 0], OAK_L, m, true);
          // the deck's sides and underside
          poly([a, d, [d[0], d[1] - thick, d[2]], [a[0], a[1] - thick, a[2]]], [-1, 0, 0], OAK, 0.8, true);
          poly([b, [b[0], b[1] - thick, b[2]], [c[0], c[1] - thick, c[2]], c], [1, 0, 0], OAK, 0.8, true);
          poly([[a[0], a[1] - thick, a[2]], [d[0], d[1] - thick, d[2]], [c[0], c[1] - thick, c[2]], [b[0], b[1] - thick, b[2]]], [0, -1, 0], OAK, 0.45, true);
        }
      };
      const BRG = S.bridge, LK = S.link, PB = S.posternBridge;
      deck(BRG, 0.32, 0.5, true);
      deck(LK, 0.28, 0.4, true);
      deck(PB, 0.26, 0.5, true);
      const deckBot = BRG.y - 0.32;
      // the main bridge: stone piers in the moat, three stringers, low kerbs (the ram is pushed over it)
      for (const zc of [1.5, 4.5]) {
        box(-BRG.half - 0.35, BRG.half + 0.35, BED, deckBot - 0.28, zc - 0.6, zc + 0.6, { seed: 95 });
        obox(-BRG.half - 0.35, zc, Math.PI / 4, 0.42, 0.42, BED, deckBot - 0.28, { seed: 95 });       // cutwaters
        obox(BRG.half + 0.35, zc, Math.PI / 4, 0.42, 0.42, BED, deckBot - 0.28, { seed: 95 });
        box(-BRG.half - 0.2, BRG.half + 0.2, deckBot - 0.28, deckBot - 0.0, zc - 0.35, zc + 0.35, { c: OAK, bands: false, m: 0.75 });
      }
      for (const x of [-1.5, 0, 1.5]) box(x - 0.15, x + 0.15, deckBot - 0.28, deckBot - 0.001, BRG.z0 + 0.6, BRG.z1 - 0.6, { c: OAK, bands: false, m: 0.65, noTop: true });
      for (const sx of [-1, 1]) {
        const kx0 = sx > 0 ? BRG.half - 0.22 : -BRG.half, kx1 = kx0 + 0.22;
        box(kx0, kx1, BRG.y, BRG.y + 0.18, BRG.z0 + 1.05, BRG.z1 - 1.05, { c: OAK, bands: false, m: 0.82 });
        for (const z of [BRG.z0 + 1.05, BRG.z1 - 1.25]) box(kx0, kx1, BRG.y, BRG.y + 0.75, z, z + 0.2, { c: OAK, bands: false, m: 0.75, topM: 1 });
      }
      // the link: a drawbridge (lowered), with its chains up into the gatehouse front
      for (const sx of [-1, 1]) {
        const a = new THREE.Vector3(sx * 1.4, LK.y + 0.05, LK.z1 - 0.25), b = new THREE.Vector3(sx * 1.4, gSpring + 2.6, GR - 0.05);
        const dir = b.clone().sub(a), L = dir.length(); dir.normalize();
        const yaw = Math.atan2(dir.x, dir.z), mid = a.clone().add(b).multiplyScalar(0.5);
        // a chain as a thin dark bar
        const g = new THREE.BoxGeometry(0.08, 0.08, L).toNonIndexed();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate(mid.x, mid.y, mid.z);
        const pa = g.attributes.position;
        for (let i = 0; i < pa.count; i += 3) {
          const t0 = [pa.getX(i), pa.getY(i), pa.getZ(i)], t1 = [pa.getX(i + 1), pa.getY(i + 1), pa.getZ(i + 1)], t2 = [pa.getX(i + 2), pa.getY(i + 2), pa.getZ(i + 2)];
          const ic = [IRON.r * 0.8, IRON.g * 0.8, IRON.b * 0.8];
          pushV(t0, ic); pushV(t1, ic); pushV(t2, ic);
        }
        void yaw;
      }
      // the postern bridge: timber trestles down to the moat bed, a hand-rail each side
      const pdb = PB.y - 0.26;
      for (let z = PB.z0 + 3; z < PB.z1 - 1.5; z += 3.5) {
        for (const sx of [-1, 1]) box(sx * 1.0 - 0.13, sx * 1.0 + 0.13, BED, pdb, z - 0.13, z + 0.13, { c: OAK, bands: false, m: 0.7 });
        box(-1.3, 1.3, pdb - 0.22, pdb - 0.001, z - 0.16, z + 0.16, { c: OAK, bands: false, m: 0.72 });
        box(-0.9, 0.9, -1.4, -1.2, z - 0.08, z + 0.08, { c: OAK, bands: false, m: 0.6 });
      }
      for (const sx of [-1, 1]) {
        const xr = sx * (PB.half - 0.08);
        for (let z = PB.z0 + 1.2; z <= PB.z1 - 1.0; z += 2.2) box(xr - 0.07, xr + 0.07, PB.y, PB.y + 1.05, z - 0.07, z + 0.07, { c: OAK, bands: false, m: 0.78 });
        box(xr - 0.06, xr + 0.06, PB.y + 0.95, PB.y + 1.1, PB.z0 + 1.1, PB.z1 - 0.9, { c: OAK_L, bands: false, m: 0.9 });
      }

      // ---- torch brackets (the flames are below, lit at night) ----
      const torchAt = [
        [-2.45, 3.7, GF + 0.1, 0, 1], [2.45, 3.7, GF + 0.1, 0, 1],                  // either side of the gate
        [-2.55, 3.4, BA.z1 + 0.1, 0, 1], [2.55, 3.4, BA.z1 + 0.1, 0, 1],            // the barbican
        [-2.0, 3.0, PO.z0 - 0.1, 0, -1], [2.0, 3.0, PO.z0 - 0.1, 0, -1],            // the postern
        [-3.75, 3.2, CY.z0 + 0.1, 0, 1], [3.75, 3.2, CY.z0 + 0.1, 0, 1],             // the hall door and the kitchen
      ];
      for (const [x, y, z, nx, nz] of torchAt) {
        box(x - 0.06, x + 0.06, y - 0.5, y - 0.38, z - 0.1 * nz - 0.06, z + 0.25 * nz + 0.06, { c: IRON, bands: false, flat: true });
        obox(x, z + 0.25 * nz, 0, 0.07, 0.07, y - 0.55, y + 0.05, { c: OAK, bands: false, flat: true, m: 0.7 });
        flameSpots.push([x, y + 0.28, z + 0.25 * nz]);
      }
      // on the merlons: the two south corner towers (clear of the breach) and the south curtain
      for (const sx of [-1, 1]) {
        const [cx, cz] = sx < 0 ? S.towers.SW : S.towers.SE, th = sx < 0 ? TAU / 6 : -TAU / 6;
        const mx = cx + Math.sin(th) * (AP - PT / 2), mz = cz + Math.cos(th) * (AP - PT / 2);
        obox(mx, mz, 0, 0.07, 0.07, TH + MER, TH + MER + 0.55, { c: OAK, bands: false, flat: true, m: 0.7 });
        flameSpots.push([mx, TH + MER + 0.8, mz]);
        obox(sx * 10.45, SO - PT / 2, 0, 0.07, 0.07, WALK + MER, WALK + MER + 0.55, { c: OAK, bands: false, flat: true, m: 0.7 });
        flameSpots.push([sx * 10.45, WALK + MER + 0.8, SO - PT / 2]);
      }

      // ---- flagpoles ----
      const flags = [];   // { x, y (top), z, kind }
      const pole = (x, y0, y1, z) => {
        obox(x, z, Math.PI / 4, 0.09, 0.09, y0, y1, { c: POLE, bands: false, flat: true });
        prism(ngonPts(x, z, 0.16, 6, 0), y1, y1 + 0.22, { c: GOLD, bands: false, flat: true, topM: 1.1 });
      };
      pole(0, GT, GT + 5.6, GH.z0 + 0.9); flags.push({ x: 0, y: GT + 5.5, z: GH.z0 + 0.9, kind: 'banner' });
      for (const k of Object.keys(towerTops)) { const tt = towerTops[k]; pole(tt.turret[0], tt.poleTop, tt.poleTop + 3.6, tt.turret[1]); flags.push({ x: tt.turret[0], y: tt.poleTop + 3.5, z: tt.turret[1], kind: 'pennon' }); }
      for (const [cx, cz] of Object.values(S.midTowers)) { pole(cx, MH, MH + 4.2, cz); flags.push({ x: cx, y: MH + 4.1, z: cz, kind: 'pennon' }); }
      pole(0, PTH, PTH + 3.6, PO.z1 - 1.2); flags.push({ x: 0, y: PTH + 3.5, z: PO.z1 - 1.2, kind: 'pennon' });

      const worldMesh = new THREE.Mesh(end(), M);
      ctx.world.add(worldMesh);

      const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)), SI = zS - half;
      // ================= inside: the rooms, the stairs and the walks, for Soldier's eye (decision 24) =================
      // research.md 18, Bodiam's plan turned 180° (its south range is our north range, its east range our west range):
      // the great hall west of the postern passage (the screens passage, with the hall's door on one side and three
      // arches on the other to the buttery, the way to the kitchen and the pantry), the great kitchen, the well in the
      // north-east tower's basement down steps from the kitchen, the lord's great chamber and the chapel (west range),
      // the retainers' hall and their kitchen (east range), a guardroom beside the gate passage; stone newel stairs in the
      // gatehouse's east tower, by the north-west tower (its head on the roof) and in every corner tower's stair turret;
      // small rooms where the wall-walk passes through the towers [INVENTED, research 18b]. Furniture, hangings and
      // colours are ours, from the period (research 18c: the sources are silent). One mesh, drawn only while Soldier's
      // eye is in the castle (ctx.eyeView), so the automatic camera and Fly pay nothing for it. Its floors, walls and
      // stairs are published as castle.nav for the base's walking.
      const NAV = { regions: [], obstacles: [], rails: [] };
      const IFIRE = [], IFL = [], ITAG = [];
      const reg = (x0, x1, z0, z1, y, o) => { const R = Object.assign({ x0, x1, z0, z1, y, ceil: Infinity }, o || {}); NAV.regions.push(R); return R; };
      const blk = (x0, x1, z0, z1, y0, y1) => NAV.obstacles.push({ x0, x1, z0, z1, y0, y1: y1 === undefined ? y0 + 2 : y1 });
      // a region along direction a from c, from distance d0 to d1, half-width hw
      const oreg = (c, a, d0, d1, hw, y, o) => {
        const ux = Math.sin(a), uz = Math.cos(a);
        const pts = [[d0, -hw], [d1, -hw], [d1, hw], [d0, hw]].map(([d, w]) => [c[0] + ux * d + uz * w, c[1] + uz * d - ux * w]);
        const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
        return reg(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), y, Object.assign({ inside: (x, z) => { const dx = x - c[0], dz = z - c[1], d = dx * ux + dz * uz, w = dx * uz - dz * ux; return d >= d0 && d <= d1 && w >= -hw && w <= hw; } }, o || {}));
      };
      // a door's throat as floor: from the face at c (outward normal n) `depth` in, w wide
      const doorReg = (c, nx, nz, w, depth, y, ceil) => oreg(c, Math.atan2(-nx, -nz), -0.06, depth + 0.06, w / 2 - 0.01, y, { ceil });
      const tagAt = (key, x, y, z, r, ringY) => ITAG.push([key, new THREE.Vector3(x, y, z), r, ringY]);
      const fire = (x, y, z, R, bx, k, flames) => { IFIRE.push({ x, y, z, R, bx, k }); for (const f of flames || []) IFL.push(f); };
      // colours (sRGB picked, linear): limewashed plaster, timber, flags, cloth, the light in the windows
      const PLA = lin(0xdac8a4), CHALK = lin(0xeee7d5), CEIL = lin(0x5d4834), FLR = lin(0xb4a37d), SOOT = lin(0x2c251f), CLOTH = lin(0xf0e8d4);
      const HANG = lin(0xa33a2c), HANG2 = lin(0x3d5a86), GREEN = lin(0x58714b), TILE_R = lin(0xa94e33), TILE_Y = lin(0xd9b45e), WATERC = lin(0x1d4148);
      const SKYW = lin(0xfdf1d0).multiplyScalar(2.2), COPPER = lin(0x8a5a36), BREAD = lin(0xc58b45);
      const lm = (nx, nz) => 0.74 + 0.26 * Math.max(0, nx * 0.45 + nz * 0.89) + 0.06 * nx;
      const win = (cx, cy, cz, nx, nz, w, h, round) => {
        decal(cx, cy - 0.12, cz, nx, nz, round ? lancetShape(w + 0.3, h + 0.3) : [[-w / 2 - 0.14, 0], [w / 2 + 0.14, 0], [w / 2 + 0.14, h + 0.26], [-w / 2 - 0.14, h + 0.26]], CHALK, 0.95, 0.012);
        decal(cx, cy, cz, nx, nz, round ? lancetShape(w, h) : [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]], SKYW, 1, 0.022);
      };
      // a floor of flags (or boards) in rows along the room's length
      function floorRows(x0, x1, z0, z1, y, col, step) {
        const alongX = (x1 - x0) >= (z1 - z0), st = step || 0.9, a0 = alongX ? z0 : x0, a1 = alongX ? z1 : x1;
        let k = 0;
        for (let a = a0; a < a1 - 1e-6; a += st, k++) {
          const b = Math.min(a1, a + st), m = (k & 1 ? 0.9 : 0.98) + 0.06 * (hash(k, x0, z0, 5) - 0.5);
          poly(alongX ? [[x0, y, a], [x1, y, a], [x1, y, b], [x0, y, b]] : [[a, y, z0], [b, y, z0], [b, y, z1], [a, y, z1]], [0, 1, 0], col, m * 0.86, true);
        }
      }
      // a rectangular room's lining, facing in: walls with holes ({ at (along the side), w, h0, h1 }), a floor, a ceiling
      function room(x0, x1, z0, z1, y0, y1, o) {
        o = o || {};
        const sides = { n: [[x0, z0], [x1, z0], [0, 0, 1]], e: [[x1, z0], [x1, z1], [-1, 0, 0]], s: [[x1, z1], [x0, z1], [0, 0, -1]], w: [[x0, z1], [x0, z0], [1, 0, 0]] };
        for (const k of Object.keys(sides)) {
          const [A, B, n] = sides[k];
          const hs = ((o.holes || {})[k] || []).map((h) => holeOn(A, B, (k === 'n' || k === 's') ? [h.at, A[1]] : [A[0], h.at], h.w, h.h0, h.h1));
          holeWall(A, B, y0, y1, n, hs, { c: o.c || PLA, m: (o.m || 1) * lm(n[0], n[2]), bands: !!o.stone, seed: 5 });
        }
        if (!o.noFloor) floorRows(x0, x1, z0, z1, y0 + 0.002, o.floor || FLR, o.step);
        poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, -1, 0], o.ceilC || CEIL, 0.8, true);
        if (o.beams) {
          const alongX = (x1 - x0) >= (z1 - z0), a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1, nB = Math.max(1, Math.round((a1 - a0) / 1.7));
          for (let i = 1; i < nB; i++) { const a = a0 + (a1 - a0) * i / nB; if (alongX) box(a - 0.12, a + 0.12, y1 - 0.32, y1 - 0.01, z0, z1, { c: CEIL, bands: false, flat: true, m: 0.75, noTop: true, under: 0.55 }); else box(x0, x1, y1 - 0.32, y1 - 0.01, a - 0.12, a + 0.12, { c: CEIL, bands: false, flat: true, m: 0.75, noTop: true, under: 0.55 }); }
        }
      }
      // furniture (outward boxes, no undersides unless raised)
      const fbox = (x0, x1, y0, y1, z0, z1, c, m, o) => box(x0, x1, y0, y1, z0, z1, Object.assign({ c, bands: false, flat: true, m: m || 1, topM: 1.06 }, o || {}));
      function table(x0, x1, z0, z1, y, h, cloth) {
        fbox(x0, x1, y + h - 0.07, y + h, z0, z1, cloth ? CLOTH : OAK_L, 0.95, { under: 0.6 });
        const along = (x1 - x0) > (z1 - z0);
        for (const t of [0.25, 0.75]) {
          if (along) { const x = x0 + (x1 - x0) * t; fbox(x - 0.05, x + 0.05, y, y + h - 0.07, z0 + 0.12, z1 - 0.12, OAK, 0.7, { noTop: true }); }
          else { const z = z0 + (z1 - z0) * t; fbox(x0 + 0.12, x1 - 0.12, y, y + h - 0.07, z - 0.05, z + 0.05, OAK, 0.7, { noTop: true }); }
        }
      }
      function bench(x0, x1, z0, z1, y) {
        fbox(x0, x1, y + 0.4, y + 0.46, z0, z1, OAK, 0.9, { under: 0.6 });
        const along = (x1 - x0) > (z1 - z0);
        for (const t of [0.12, 0.88]) { if (along) { const x = x0 + (x1 - x0) * t; fbox(x - 0.04, x + 0.04, y, y + 0.4, z0 + 0.03, z1 - 0.03, OAK, 0.65, { noTop: true }); } else { const z = z0 + (z1 - z0) * t; fbox(x0 + 0.03, x1 - 0.03, y, y + 0.4, z - 0.04, z + 0.04, OAK, 0.65, { noTop: true }); } }
      }
      const barrel = (cx, cz, y, r, h) => prism(ngonPts(cx, cz, r, 6, 0.3), y, y + h, { c: OAK_L, bands: false, flat: true, m: 0.9, topM: 1.1, cuts: [y + h * 0.22, y + h * 0.3, y + h * 0.7, y + h * 0.78], bandFn: (ym) => ((ym > y + h * 0.22 && ym < y + h * 0.3) || (ym > y + h * 0.7 && ym < y + h * 0.78) ? 0.45 : 1) });
      const pot = (cx, cz, y, r, h, c) => prism(ngonPts(cx, cz, r, 6, 0), y, y + h, { c: c || IRON, bands: false, flat: true, m: 0.9, topM: 0.5 });
      // a fireplace on a wall: the breast projecting `depth` from the wall line (c, its inward normal n), W wide, up to
      // yTop; an opening w x h with a sooty back and hearth; flames and the glow of its fire (box: the room)
      function fireplace(c, nx, nz, W, depth, y, yTop, w, h, roomBox, k, nFl) {
        const tx = nz, tz = -nx, at = (u, d) => [c[0] + tx * u + nx * d, c[1] + tz * u + nz * d];
        const fA = at(-W / 2, depth), fB = at(W / 2, depth), fc = at(0, depth);
        holeWall(fA, fB, y, yTop, [nx, 0, nz], [holeOn(fA, fB, fc, w, y, y + h)], { c: CAP, m: 0.95, bands: false });
        wall(at(-W / 2, 0), at(-W / 2, depth), y, yTop, [-tx, 0, -tz], { c: CAP, m: 0.85, bands: false });
        wall(at(W / 2, 0), at(W / 2, depth), y, yTop, [tx, 0, tz], { c: CAP, m: 0.85, bands: false });
        const l0 = at(-w / 2, 0.02), l1 = at(-w / 2, depth), r0 = at(w / 2, 0.02), r1 = at(w / 2, depth);
        wall(l0, l1, y, y + h, [tx, 0, tz], { c: SOOT, m: 1.3, bands: false, flat: true });
        wall(r0, r1, y, y + h, [-tx, 0, -tz], { c: SOOT, m: 1.3, bands: false, flat: true });
        poly([[l0[0], y + h, l0[1]], [r0[0], y + h, r0[1]], [r1[0], y + h, r1[1]], [l1[0], y + h, l1[1]]], [0, -1, 0], SOOT, 0.9, true);
        wall(l0, r0, y, y + h, [nx, 0, nz], { c: SOOT, m: 1.1, bands: false, flat: true });
        poly([[l0[0], y + 0.03, l0[1]], [r0[0], y + 0.03, r0[1]], [r1[0], y + 0.03, r1[1]], [l1[0], y + 0.03, l1[1]]], [0, 1, 0], SOOT, 1.2, true);
        if (yTop < 7) poly([at(-W / 2, 0), at(W / 2, 0), at(W / 2, depth), at(-W / 2, depth)].map((p) => [p[0], yTop, p[1]]), [0, 1, 0], CAP, 1, true);
        const fx = at(0, depth * 0.45);
        const fl = [];
        for (let i = 0; i < nFl; i++) { const u = (i - (nFl - 1) / 2) * Math.min(0.32, w / (nFl + 1)); const p = at(u, depth * 0.45); fl.push([p[0], y + 0.18, p[1], 0.9 + 0.25 * ((i + 1) % 2)]); }
        fire(fx[0], y + 0.4, fx[1], 4.2 + w, roomBox, k, fl);
        // embers: a low glowing heap
        fbox(fx[0] - w * 0.3, fx[0] + w * 0.3, y + 0.03, y + 0.1, fx[1] - 0.18, fx[1] + 0.18, lin(0x7a2e12), 1);
        return fx;
      }
      // a stone newel stair (research 18b): a ten-sided well facing in, a newel, wedge steps winding up `turns` times
      // from y0 at angle a0 to y1; door holes at its foot (a0) and its head (a1); `yTop` its cap. Its rail is the path
      // Soldier's eye climbs along; its landings are floor.
      function stair(key, c, R, y0, y1, a0, turns, yTop, doorH0, doorH1) {
        const NS = 10, dir = 1, a1 = a0 + dir * TAU * turns, rv = R / Math.cos(Math.PI / NS), NR = 0.2;
        const pts = ngonPts(c[0], c[1], rv, NS, a0 + Math.PI / NS);
        const near = (m, a) => Math.abs(angDiff(m, a)) < 0.05;
        for (let i = 0; i < NS; i++) {
          const A = pts[i], B = pts[(i + 1) % NS], m = Math.atan2((A[0] + B[0]) / 2 - c[0], (A[1] + B[1]) / 2 - c[1]);
          const hs = [];
          if (near(m, a0)) hs.push(holeOn(A, B, [c[0] + Math.sin(m) * R, c[1] + Math.cos(m) * R], 0.8, y0 - 0.02, doorH0 || y0 + DH));
          if (near(m, a1)) hs.push(holeOn(A, B, [c[0] + Math.sin(m) * R, c[1] + Math.cos(m) * R], 0.8, y1 - 0.02, doorH1 || y1 + 2.0));
          holeWall(A, B, y0 - 0.05, yTop, [-Math.sin(m), 0, -Math.cos(m)], hs, { c: SAND, m: 0.82 * lm(-Math.sin(m), -Math.cos(m)), seed: 9 });
          // a light slit now and then, away from the doors
          // (none on the sides next to a door, where the steps' undersides would cut them into odd shapes)
          if (!hs.length && i % 2 === 1 && Math.abs(angDiff(m, a0)) > 0.75 && Math.abs(angDiff(m, a1)) > 0.75) for (let yy = y0 + 1.4 + (i % 4) * 0.7; yy < yTop - 1.2; yy += 2.6) win(c[0] + Math.sin(m) * (R - 0.01), yy, c[1] + Math.cos(m) * (R - 0.01), -Math.sin(m), -Math.cos(m), 0.16, 0.8, true);
        }
        poly(pts.map((p) => [p[0], y0 - 0.01, p[1]]), [0, 1, 0], FLR, 0.8, true);
        poly(pts.map((p) => [p[0], yTop, p[1]]), [0, -1, 0], CEIL, 0.7, true);
        prism(ngonPts(c[0], c[1], NR, 6, 0), y0 - 0.05, yTop, { c: SAND, m: 0.85, seed: 9, noTop: true });
        const N = Math.round(14 * turns), rise = (y1 - y0) / N, P2 = (a, r, y) => [c[0] + Math.sin(a) * r, y, c[1] + Math.cos(a) * r];
        for (let i = 0; i < N; i++) {
          const aa = a0 + dir * TAU * turns * i / N, ab = a0 + dir * TAU * turns * (i + 1) / N, ht = y0 + rise * (i + 0.5), R2 = R * 1.03;
          const m = (i & 1) ? 0.94 : 1.0;
          poly([P2(aa, NR, ht), P2(aa, R2, ht), P2(ab, R2, ht), P2(ab, NR, ht)], [0, 1, 0], CAP, 1.05 * m, true);
          poly([P2(aa, NR, ht - rise - 0.22), P2(aa, R2, ht - rise - 0.22), P2(aa, R2, ht), P2(aa, NR, ht)], [-Math.cos(aa) * dir, 0, Math.sin(aa) * dir], SAND, 0.5, true);
          poly([P2(aa, NR, ht - rise - 0.22), P2(aa, R2, ht - rise - 0.22), P2(ab, R2, ht - 0.22), P2(ab, NR, ht - 0.22)], [0, -1, 0], SAND, 0.42, true);
        }
        const rm = NR + (R - NR) * 0.58;
        const rail = { key, cx: c[0], cz: c[1], R, rm, y0, y1, a0, a1, turns, dir, len: Math.hypot(TAU * rm * turns, y1 - y0) };
        NAV.rails.push(rail);
        oreg(c, a0, -0.2, R + 0.35, 0.39, y0, { ceil: doorH0 || y0 + DH });
        oreg(c, a1, -0.2, R + 0.35, 0.39, y1, { ceil: doorH1 || y1 + 2.0 });
        return rail;
      }
      begin();
      const RT = (x0, x1, z0, z1, y) => reg(x0, x1, z0, z1, y);   // a room's floor
      const zR0 = zN + half + 0.05, zR1 = CY.z0 - 0.5;                // the north range's rooms, curtain to courtyard wall
      // --- the great hall (research 18a, 18c): tables lengthways, a stepped dais with the lord's table at the west end
      // (by the lord's range), a large wall fireplace, the tall window near the dais, its windows to the courtyard
      {
        const x0 = -13.2, x1 = -PO.passage / 2 - 0.5, Y1 = 7.6;
        room(x0, x1, zR0, zR1, FL, Y1, { beams: true, holes: { s: [{ at: -2.6, w: DW, h0: FL, h1: FL + DH }], e: [{ at: -45.3, w: 0.9, h0: FL, h1: FL + DH }] } });
        for (const x of [-11, -8, -5]) win(x, 3.3, zR1 - 0.01, 0, -1, 1.2, 3.6, true);
        // the tall two-light window by the dais, in the curtain
        win(-10.0, 2.5, zR0 + 0.01, 0, 1, 1.5, 4.4, true); decal(-10.0, 2.5, zR0 + 0.01, 0, 1, [[-0.07, 0], [0.07, 0], [0.07, 4.0], [-0.07, 4.0]], CHALK, 0.9, 0.035);
        // the dais (two steps of 0.18) and the lord's table on it, a cloth of estate on the wall behind
        const DY = FL + 0.36;
        fbox(x0, -11.2, FL, DY, zR0, zR1, CAP, 0.92); fbox(-11.2, -10.9, FL, FL + 0.18, zR0, zR1, CAP, 0.88);
        reg(x0, -11.2, zR0, zR1, DY); reg(-11.2, -10.9, zR0, zR1, FL + 0.18); reg(-10.9, x1, zR0, zR1, FL);
        table(-12.55, -11.85, -46.5, -44.0, DY, 0.76, true); blk(-12.6, -11.8, -46.55, -43.95, DY);
        bench(-13.1, -12.75, -46.1, -44.4, DY); fbox(-13.15, -13.05, DY, DY + 1.3, -46.1, -44.4, OAK, 0.8); blk(-13.2, -12.7, -46.15, -44.35, DY);
        decal(x0 + 0.01, DY + 0.6, -45.25, 1, 0, [[-1.2, 0], [1.2, 0], [1.2, 2.6], [-1.2, 2.6]], GOLD, 0.85, 0.015);
        decal(x0 + 0.01, DY + 0.7, -45.25, 1, 0, [[-1.08, 0], [1.08, 0], [1.08, 2.4], [-1.08, 2.4]], HANG, 1, 0.025);
        shield(x0 + 0.01, DY + 1.3, -45.25, 1, 0, 0.9);
        // two long tables along the north wall with benches either side, the fireplace between them
        for (const [a, b] of [[-10.4, -8.1], [-5.9, -2.6]]) {
          table(a, b, -46.35, -45.6, FL, 0.76); bench(a, b, -46.8, -46.48, FL); bench(a, b, -45.47, -45.15, FL);
          blk(a - 0.05, b + 0.05, -46.85, -45.1, FL);
        }
        fireplace([-7.0, zR0], 0, 1, 1.9, 0.55, FL, Y1, 1.35, 1.25, [x0, x1, zR0, zR1, FL, Y1], 1.0, 3);
        blk(-7.95, -6.05, zR0, zR0 + 0.6, FL);
        tagAt('greatHall', -7.5, 2.2, -44.3, 3.5, FL);
      }
      // --- the screens passage (the postern passage itself): the hall's door on its west side, three arches on its east
      tagAt('screens', 0, 2.0, -45.3, 1.6, 0.03);
      // --- behind the arches: the buttery (ale and wine), the way through to the kitchen, the pantry (research 18a, 18c)
      {
        const xa = PO.passage / 2 + 0.5, xb = 5.0, Y1 = 4.2;
        room(xa, xb, zR0, -45.85, FL, Y1, { holes: { w: [{ at: -46.45, w: 0.7, h0: FL, h1: FL + DH }] } });
        room(xa, xb + 0.15, -45.7, -44.9, FL, 3.0, { holes: { w: [{ at: -45.3, w: 0.7, h0: FL, h1: FL + DH }], e: [{ at: -45.3, w: 0.8, h0: FL, h1: FL + 2.25 }] } });
        room(xa, xb, -44.75, zR1, FL, Y1, { holes: { w: [{ at: -44.12, w: 0.7, h0: FL, h1: FL + DH }] } });
        RT(xa, xb, zR0, -45.85, FL); RT(xa, xb + 0.2, -45.7, -44.9, FL); RT(xa, xb, -44.75, zR1, FL);
        // barrels in the buttery, a counter and loaves in the pantry
        for (const x of [2.55, 3.35, 4.15]) barrel(x, -46.68, FL, 0.32, 0.85);
        barrel(4.6, -46.1, FL, 0.26, 0.7);
        blk(2.15, 4.9, zR0, -46.3, FL); blk(4.3, 4.95, -46.4, -45.8, FL);
        fbox(2.2, 4.7, FL, FL + 0.92, -44.7, -44.25, OAK_L, 0.9); fbox(2.15, 4.75, FL + 0.92, FL + 0.97, -44.72, -44.2, OAK, 0.85);
        for (const x of [2.5, 2.95, 3.4, 3.9]) fbox(x - 0.14, x + 0.14, FL + 0.97, FL + 1.1, -44.55, -44.35, BREAD, 1);
        prism(ngonPts(4.35, -44.45, 0.17, 6, 0), FL + 0.97, FL + 1.08, { c: TILE_Y, bands: false, flat: true, topM: 1.05 });
        blk(2.15, 4.8, -44.75, -44.15, FL);
        win(4.5, 1.5, zR1 - 0.01, 0, -1, 0.5, 0.65);
        tagAt('buttery', 3.4, 1.4, -46.3, 1.3, FL); tagAt('pantry', 3.4, 1.4, -44.1, 1.3, FL);
      }
      // --- the great kitchen (research 18c: "a huge roasting hearth in the south wall and a second hearth in the north,
      // inset with bread or pastry ovens"; turned round, the roasting hearth is on our north wall, the ovens on the south)
      {
        const x0 = 5.15, x1 = XK, Y1 = 7.6;
        room(x0, x1, zR0, zR1, FL, Y1, { stone: true, c: SAND, m: 0.9, beams: true, holes: { s: [{ at: 6.5, w: DW, h0: FL, h1: FL + DH }], w: [{ at: -45.3, w: 0.8, h0: FL, h1: FL + 2.25 }], e: [{ at: -45.34, w: 1.25, h0: FL - 0.02, h1: 2.5 }] } });
        RT(x0, x1, zR0, zR1, FL);
        for (const x of [8.5, 11.5]) { win(x, 5.3, zR1 - 0.01, 0, -1, 0.5, 1.5, true); }
        win(8.5, 1.55, zR1 - 0.01, 0, -1, 0.5, 0.65);
        const fx = fireplace([9.9, zR0], 0, 1, 3.8, 0.9, FL, Y1, 3.2, 2.1, [x0, x1, zR0, zR1, FL, Y1], 1.3, 5);
        blk(7.95, 11.85, zR0, zR0 + 0.95, FL);
        // a spit across the hearth with a joint on it, and a cauldron
        fbox(8.4, 11.4, FL + 0.86, FL + 0.92, fx[1] - 0.03, fx[1] + 0.03, IRON, 1);
        fbox(9.55, 10.25, FL + 0.7, FL + 1.05, fx[1] - 0.18, fx[1] + 0.18, lin(0x8b4b2a), 1);
        pot(8.75, fx[1] + 0.05, FL, 0.3, 0.42);
        // the second hearth, with two bread ovens beside it, on the courtyard wall
        fireplace([10.1, zR1], 0, -1, 2.2, 0.55, FL, 3.2, 0.95, 0.95, [x0, x1, zR0, zR1, FL, Y1], 0.8, 2);
        for (const u of [-0.78, 0.78]) { const ox = 10.1 + u; decal(ox, FL + 0.55, zR1 - 0.56, 0, -1, [[-0.22, 0], [0.22, 0], [0.22, 0.25], [0.15, 0.4], [0, 0.46], [-0.15, 0.4], [-0.22, 0.25]], SOOT, 1, 0.01); }
        blk(8.95, 11.25, zR1 - 0.6, zR1, FL);
        table(7.2, 10.0, -45.5, -44.85, FL, 0.84);
        pot(7.7, -45.15, FL + 0.84, 0.16, 0.2, COPPER); pot(8.3, -45.2, FL + 0.84, 0.12, 0.16, COPPER); pot(9.4, -45.15, FL + 0.84, 0.2, 0.14, IRON);
        for (const x of [8.8, 9.05]) fbox(x - 0.1, x + 0.1, FL + 0.84, FL + 0.95, -45.05, -44.95, BREAD, 1);
        blk(7.15, 10.05, -45.55, -44.8, FL);
        tagAt('kitchen', 9.0, 2.4, -44.4, 3.5, FL);
      }
      // --- the well, in the north-east tower's basement, down steps from the kitchen (research 18a, 18c: stone-lined,
      // about 2.75 m across, spring-fed). The way runs radially into the tower through its side at NEA
      {
        const c = NEc, a = NEA, ux = Math.sin(a), uz = Math.cos(a), sxv = uz, szv = -ux, hw = 0.5, FW = -0.28, Y1 = 3.0, YC = 2.45;
        const P = (d, w, y) => [c[0] + ux * d + sxv * w, y, c[1] + uz * d + szv * w];
        const dEnd = (w) => (c[0] + sxv * w - XK) / -ux;          // where each side meets the kitchen's east wall (x = XK)
        const dL = dEnd(-hw), dR = dEnd(hw), d0 = RTR - 0.06;
        // the passage: walls, ceiling, and its steps down
        wall([P(d0, -hw, 0)[0], P(d0, -hw, 0)[2]], [P(dL, -hw, 0)[0], P(dL, -hw, 0)[2]], FW, YC, [sxv, 0, szv], { c: SAND, m: 0.85, seed: 9 });
        wall([P(d0, hw, 0)[0], P(d0, hw, 0)[2]], [P(dR, hw, 0)[0], P(dR, hw, 0)[2]], FW, YC, [-sxv, 0, -szv], { c: SAND, m: 0.85, seed: 9 });
        poly([P(d0, -hw, YC), P(dL, -hw, YC), P(dR, hw, YC), P(d0, hw, YC)], [0, -1, 0], CEIL, 0.7, true);
        const steps = [[d0, 4.4, FW], [4.4, 4.8, FW + 0.17], [4.8, Math.max(dL, dR), FL]];
        for (const [da, db, y] of steps) {
          poly([P(da, -hw, y), P(Math.min(db, dL), -hw, y), P(Math.min(db, dR), hw, y), P(da, hw, y)], [0, 1, 0], FLR, 0.82, true);
          if (y > FW) poly([P(da, -hw, y - 0.17), P(da, hw, y - 0.17), P(da, hw, y), P(da, -hw, y)], [-ux, 0, -uz], SAND, 0.7, true);
          oreg(c, a, da, db === Math.max(dL, dR) ? db + 0.1 : db, hw - 0.01, y, { ceil: YC });
        }
        // the chamber: twelve sides like the tower, flags, a dark vault, slits of light
        const rv = RTR / Math.cos(Math.PI / 12) - 0.05, cp = ngonPts(c[0], c[1], rv, 12, Math.PI / 12);
        for (let k = 0; k < 12; k++) {
          const A = cp[k], B = cp[(k + 1) % 12], th = Math.atan2((A[0] + B[0]) / 2 - c[0], (A[1] + B[1]) / 2 - c[1]);
          const hs = Math.abs(angDiff(th, a)) < 0.05 ? [holeOn(A, B, [c[0] + ux * (RTR - 0.05), c[1] + uz * (RTR - 0.05)], 2 * hw, FW - 0.02, YC)] : [];
          holeWall(A, B, FW, Y1, [-Math.sin(th), 0, -Math.cos(th)], hs, { c: SAND, m: 0.88, seed: 9 });
          const outA = Math.atan2(c[0], c[1] + 30);
          if (!hs.length && Math.abs(angDiff(th, outA)) < 1.2 && k % 2 === 1) win(c[0] + Math.sin(th) * (RTR - 0.06), 1.7, c[1] + Math.cos(th) * (RTR - 0.06), -Math.sin(th), -Math.cos(th), 0.25, 0.65);
        }
        poly(cp.map((p) => [p[0], FW, p[1]]), [0, 1, 0], FLR, 0.75, true);
        poly(cp.map((p) => [p[0], Y1, p[1]]), [0, -1, 0], CEIL, 0.6, true);
        reg(c[0] - RTR, c[0] + RTR, c[1] - RTR, c[1] + RTR, FW, { ceil: Y1, inside: (x, z) => { const r = Math.hypot(x - c[0], z - c[1]); return r < RTR - 0.08 && r > 1.62; } });
        // the well: a stone ring, its water a metre down, a windlass with a bucket
        const W0 = 1.2, W1 = 1.48, WT = 0.45, WY = -0.3;
        prism(ngonPts(c[0], c[1], W1, 8, Math.PI / 8), FW, WT, { c: SAND, seed: 9, noTop: true });
        const wi = ngonPts(c[0], c[1], W0, 8, Math.PI / 8), wo = ngonPts(c[0], c[1], W1, 8, Math.PI / 8);
        for (let k = 0; k < 8; k++) {
          const A = wi[k], B = wi[(k + 1) % 8], m = Math.atan2((A[0] + B[0]) / 2 - c[0], (A[1] + B[1]) / 2 - c[1]);
          wall(A, B, WY, WT, [-Math.sin(m), 0, -Math.cos(m)], { c: SAND, m: 0.7, seed: 9 });
          poly([[A[0], WT, A[1]], [wo[k][0], WT, wo[k][1]], [wo[(k + 1) % 8][0], WT, wo[(k + 1) % 8][1]], [B[0], WT, B[1]]], [0, 1, 0], CAP, 1.0, true);
        }
        poly(wi.map((p) => [p[0], WY, p[1]]), [0, 1, 0], WATERC, 1.0, true);
        for (const s of [-1, 1]) fbox(c[0] + s * 1.36 - 0.07, c[0] + s * 1.36 + 0.07, WT, WT + 1.35, c[1] - 0.07, c[1] + 0.07, OAK, 0.8);
        fbox(c[0] - 1.45, c[0] + 1.45, WT + 1.2, WT + 1.32, c[1] - 0.07, c[1] + 0.07, OAK_L, 0.85);
        fbox(c[0] - 0.015, c[0] + 0.015, WT + 0.55, WT + 1.2, c[1] - 0.015, c[1] + 0.015, lin(0xcbb68a), 1);
        prism(ngonPts(c[0], c[1], 0.16, 6, 0), WT + 0.3, WT + 0.6, { c: OAK_L, bands: false, flat: true, topM: 0.5 });
        fire(c[0] + ux * 3.2 + sxv * 0.9, 1.8, c[1] + uz * 3.2 + szv * 0.9, 3.5, [c[0] - 4, c[0] + 4, c[1] - 4, c[1] + 4, FW - 2, Y1], 0.55, [[c[0] + ux * 3.55 + sxv * 0.95, 1.85, c[1] + uz * 3.55 + szv * 0.95, 0.7]]);
        tagAt('well', c[0], 0.9, c[1], 1.7, FW);
      }
      // --- the west range: the north-west stair's passage, the great chamber, the chapel (research 18a)
      const xW0 = -IN + 0.05, xW1 = CY.x0 - 0.5;
      {
        // the passage from the courtyard to the foot of the north-west stair
        const zc = STH.c[1], xs = STH.c[0] + STH.R;
        room(xs, xW1, zc - 0.5, zc + 0.5, FL, 2.6, { stone: true, c: SAND, m: 0.85, holes: { e: [{ at: zc, w: 1.0, h0: FL, h1: FL + DH }], w: [{ at: zc, w: 0.8, h0: FL, h1: FL + DH }] } });
        RT(xs - 0.05, xW1, zc - 0.49, zc + 0.49, FL);
        stair('cornerStair', STH.c, STH.R, FL, WALK, Math.PI / 2, 3.5, STH.top - 0.25);
        tagAt('cornerStair', STH.c[0], 1.6, STH.c[1], 1.0, FL);
      }
      {
        // the lord's great chamber: a bed with hangings, a chest, a fireplace, a tapestry
        const z0 = -40.7, z1 = -29.3, Y1 = 4.2;
        room(xW0, xW1, z0, z1, FL, Y1, { beams: true, floor: OAK_L, step: 0.3, holes: { e: [{ at: -34, w: 1.0, h0: FL, h1: FL + DH }] } });
        RT(xW0, xW1, z0, z1, FL);
        win(xW1 - 0.01, 1.5, -30, -1, 0, 0.5, 0.65); win(xW0 + 0.01, 1.7, -39.5, 1, 0, 0.42, 0.6);
        fireplace([xW0, -36], 1, 0, 1.8, 0.55, FL, Y1, 1.2, 1.1, [xW0, xW1, z0, z1, FL, Y1], 0.9, 2);
        blk(xW0, xW0 + 0.6, -36.95, -35.05, FL);
        // the bed: a frame, a red cover, four posts, a tester and hangings on three sides
        const bx0 = xW0 + 0.05, bx1 = xW0 + 1.85, bz0 = z0 + 0.1, bz1 = z0 + 2.2;
        fbox(bx0, bx1, FL, FL + 0.5, bz0, bz1, OAK, 0.85); fbox(bx0 + 0.05, bx1 - 0.05, FL + 0.5, FL + 0.66, bz0 + 0.05, bz1 - 0.05, HANG, 1);
        fbox(bx0 + 0.1, bx0 + 0.6, FL + 0.66, FL + 0.8, bz0 + 0.3, bz1 - 0.3, CLOTH, 1);
        for (const [px, pz] of [[bx0, bz0], [bx1 - 0.1, bz0], [bx0, bz1 - 0.1], [bx1 - 0.1, bz1 - 0.1]]) fbox(px, px + 0.1, FL, FL + 2.35, pz, pz + 0.1, OAK, 0.75);
        fbox(bx0 - 0.03, bx1 + 0.03, FL + 2.3, FL + 2.5, bz0 - 0.03, bz1 + 0.03, HANG, 0.9, { under: 0.7 });
        fbox(bx0 + 0.02, bx0 + 0.06, FL + 0.55, FL + 2.3, bz0 + 0.1, bz1 - 0.1, HANG, 0.8);
        fbox(bx0 + 0.1, bx1 - 0.1, FL + 0.55, FL + 2.3, bz0 + 0.02, bz0 + 0.06, HANG, 0.85); fbox(bx0 + 0.1, bx1 - 0.1, FL + 0.55, FL + 2.3, bz1 - 0.06, bz1 - 0.02, HANG, 0.85);
        for (const pz of [bz0 + 0.12, bz1 - 0.32]) fbox(bx1 - 0.14, bx1 - 0.06, FL + 0.6, FL + 2.3, pz, pz + 0.2, HANG, 0.7);
        blk(bx0, bx1 + 0.05, z0, bz1 + 0.05, FL);
        // a chest at its foot, a chair, a tapestry on the north wall
        fbox(xW0 + 0.2, xW0 + 1.4, FL, FL + 0.55, bz1 + 0.25, bz1 + 0.8, OAK_L, 0.9); fbox(xW0 + 0.18, xW0 + 1.42, FL + 0.55, FL + 0.62, bz1 + 0.23, bz1 + 0.82, OAK, 0.9);
        blk(xW0, xW0 + 1.45, bz1 + 0.2, bz1 + 0.85, FL);
        bench(-15.3, -14.6, -33.2, -32.6, FL); fbox(-15.3, -14.6, FL + 0.46, FL + 1.15, -33.25, -33.18, OAK, 0.8); blk(-15.35, -14.55, -33.3, -32.55, FL);
        decal(-15.3, FL + 1.2, z1 - 0.01, 0, -1, [[-1.0, 0], [1.0, 0], [1.0, 1.8], [-1.0, 1.8]], HANG2, 1, 0.02);
        decal(-15.3, FL + 1.35, z1 - 0.01, 0, -1, [[-0.75, 0], [0.75, 0], [0.75, 1.5], [-0.75, 1.5]], GREEN, 1, 0.03);
        for (const [u, v] of [[-0.35, 0.45], [0.3, 0.9], [-0.1, 1.15]]) decal(-15.3 + u, FL + 1.35 + v, z1 - 0.01, 0, -1, [[-0.12, 0], [0.12, 0], [0.12, 0.2], [-0.12, 0.2]], TILE_Y, 1, 0.04);
        tagAt('greatChamber', -15.3, 2.0, -35.0, 3.0, FL);
      }
      {
        // the chapel: a screen across it, the altar under the three-light window, coloured tiles (research 18c)
        const z0 = -27.4, z1 = CY.z1 - 0.05, Y1 = 6.0, zS2 = -20.4;
        room(xW0, xW1, z0, z1, FL, Y1, { beams: true, noFloor: true, holes: { e: [{ at: -22, w: 1.0, h0: FL, h1: FL + DH }] } });
        RT(xW0, xW1, z0, z1, FL);
        floorRows(xW0, xW1, z0, zS2, FL + 0.002, FLR, 0.9);
        const nT = 6, tw = (xW1 - xW0) / nT, nZ = Math.round((z1 - zS2) / tw);
        for (let i = 0; i < nT; i++) for (let j = 0; j < nZ; j++) { const xa = xW0 + i * tw, za = zS2 + j * (z1 - zS2) / nZ, zb = zS2 + (j + 1) * (z1 - zS2) / nZ; poly([[xa, FL + 0.003, za], [xa + tw, FL + 0.003, za], [xa + tw, FL + 0.003, zb], [xa, FL + 0.003, zb]], [0, 1, 0], (i + j) & 1 ? TILE_R : TILE_Y, 0.85, true); }
        // the chalk screen: a solid base, posts and a beam, an opening in the middle
        const sm0 = (xW0 + xW1) / 2 - 0.55, sm1 = (xW0 + xW1) / 2 + 0.55;
        for (const [a, b] of [[xW0, sm0], [sm1, xW1]]) { fbox(a, b, FL, FL + 1.05, zS2 - 0.12, zS2 + 0.12, CHALK, 0.95); for (let x = a + 0.3; x < b - 0.1; x += 0.45) fbox(x - 0.05, x + 0.05, FL + 1.05, FL + 2.7, zS2 - 0.06, zS2 + 0.06, CHALK, 0.9); blk(a, b, zS2 - 0.15, zS2 + 0.15, FL); }
        fbox(xW0, xW1, FL + 2.7, FL + 2.95, zS2 - 0.1, zS2 + 0.1, CHALK, 0.95, { under: 0.7 });
        // the altar and its cloth, a cross and two candles; the window of three lights over it
        const za = -19.2;
        fbox(xW0, xW0 + 0.8, FL, FL + 1.0, za - 0.8, za + 0.8, CHALK, 0.9); fbox(xW0, xW0 + 0.85, FL + 1.0, FL + 1.05, za - 0.85, za + 0.85, CLOTH, 1);
        decal(xW0 + 0.81, FL + 0.15, za, 1, 0, [[-0.7, 0], [0.7, 0], [0.7, 0.8], [-0.7, 0.8]], HANG, 1, 0.01);
        fbox(xW0 + 0.3, xW0 + 0.36, FL + 1.05, FL + 1.65, za - 0.03, za + 0.03, GOLD, 1.1); fbox(xW0 + 0.3, xW0 + 0.36, FL + 1.42, FL + 1.48, za - 0.17, za + 0.17, GOLD, 1.1);
        for (const s of [-0.55, 0.55]) { fbox(xW0 + 0.38, xW0 + 0.46, FL + 1.05, FL + 1.32, za + s - 0.04, za + s + 0.04, CLOTH, 1); fire(xW0 + 0.42, FL + 1.5, za + s, 2.4, [xW0, xW1, zS2, z1, FL, Y1], 0.35, [[xW0 + 0.42, FL + 1.38, za + s, 0.28]]); }
        blk(xW0, xW0 + 0.9, za - 0.9, za + 0.9, FL);
        threeLights(xW0 + 0.01, 2.6, za, 1, 0, SKYW, -0.01);
        decal(-14.4, FL + 0.9, z1 - 0.01, 0, -1, [[-0.18, 0], [0.18, 0], [0.18, 0.35], [0, 0.5], [-0.18, 0.35]], SOOT, 1, 0.02);   // the piscina
        tagAt('chapel', -15.3, 2.0, -21.0, 2.5, FL);
      }
      // --- the east range: the retainers' hall (benches, no fireplace) and their kitchen (research 18a)
      const xE0 = CY.x1 + 0.5, xE1 = IN - 0.05;
      {
        const z0 = CY.z0 + 0.05, z1 = -28.6, Y1 = 4.2;
        room(xE0, xE1, z0, z1, FL, Y1, { beams: true, holes: { w: [{ at: -34, w: 1.0, h0: FL, h1: FL + DH }] } });
        RT(xE0, xE1, z0, z1, FL);
        win(xE0 + 0.01, 1.5, -30, 1, 0, 0.5, 0.65);
        for (const [a, b] of [[-41.8, -36.0], [-33.0, -29.4]]) {
          table(15.5, 16.2, a, b, FL, 0.76); bench(16.35, 16.7, a, b, FL); bench(15.0, 15.35, a, b, FL);
          blk(14.95, 16.75, a - 0.05, b + 0.05, FL);
        }
        bench(xE1 - 0.35, xE1, -42.6, -42.0, FL);
        tagAt('retainersHall', 15.3, 2.0, -35.0, 3.0, FL);
      }
      {
        const z0 = -28.4, z1 = CY.z1 - 0.05, Y1 = 4.2;
        room(xE0, xE1, z0, z1, FL, Y1, { beams: true, holes: { w: [{ at: -22, w: 1.0, h0: FL, h1: FL + DH }] } });
        RT(xE0, xE1, z0, z1, FL);
        win(xE0 + 0.01, 1.5, -26, 1, 0, 0.5, 0.65);
        fireplace([xE1, -25], -1, 0, 2.0, 0.6, FL, Y1, 1.4, 1.2, [xE0, xE1, z0, z1, FL, Y1], 1.0, 3);
        blk(xE1 - 0.65, xE1, -26.05, -23.95, FL);
        pot(xE1 - 0.35, -25, FL, 0.25, 0.35);
        table(14.3, 15.6, -21.0, -19.6, FL, 0.8); blk(14.25, 15.65, -21.05, -19.55, FL);
        pot(14.7, -20.3, FL + 0.8, 0.14, 0.16, COPPER); barrel(16.4, -18.0, FL, 0.3, 0.8); blk(16.0, 16.8, -18.4, -17.6, FL);
        tagAt('retainersKitchen', 15.3, 2.0, -22.5, 2.5, FL);
      }
      // --- the guardroom in the gatehouse's west tower, off the passage (research 18a: guardrooms either side)
      {
        const x0 = -GH.x1 + 0.5, x1 = -GP - 0.5, z0 = GH.z0 + 0.5, z1 = GF - 0.5, Y1 = 4.0;
        room(x0, x1, z0, z1, FL, Y1, { stone: true, c: SAND, m: 0.85, beams: true, holes: { e: [{ at: -11.6, w: 0.9, h0: FL, h1: FL + DH }] } });
        RT(x0, x1, z0, z1, FL);
        // keyhole gunloops: light through the one in the west wall and the one in the front
        win(x0 + 0.01, 0.55 + 0.45, -10.6, 1, 0, 0.14, 0.9); win(x0 + 0.01, 0.65, -10.6, 1, 0, 0.36, 0.34);
        win(-3.8, 1.0, z1 - 0.01, 0, -1, 0.14, 0.9); win(-3.8, 0.65, z1 - 0.01, 0, -1, 0.36, 0.34);
        bench(x0, x0 + 0.38, -12.6, -9.2, FL); blk(x0, x0 + 0.42, -12.65, -9.15, FL);
        table(-4.4, -3.2, -12.75, -12.05, FL, 0.76); blk(-4.45, -3.15, -12.8, -12.0, FL);
        // a spear rack, a brazier
        fbox(x1 - 0.25, x1 - 0.1, FL, FL + 1.6, -8.55, -8.45, OAK, 0.75); fbox(x1 - 0.25, x1 - 0.1, FL, FL + 1.6, -7.65, -7.55, OAK, 0.75);
        fbox(x1 - 0.28, x1 - 0.07, FL + 1.3, FL + 1.38, -8.6, -7.5, OAK, 0.8);
        for (let i = 0; i < 4; i++) { const z = -8.4 + i * 0.25; fbox(x1 - 0.2, x1 - 0.16, FL, FL + 2.5, z - 0.02, z + 0.02, OAK_L, 0.85); fbox(x1 - 0.21, x1 - 0.15, FL + 2.5, FL + 2.75, z - 0.04, z + 0.04, IRON, 1.2); }
        blk(x1 - 0.35, x1, -8.7, -7.5, FL);
        prism(ngonPts(-4.0, -9.0, 0.3, 6, 0), FL + 0.55, FL + 0.75, { c: IRON, bands: false, flat: true, topM: 0.4 });
        for (let i = 0; i < 3; i++) { const a = i * TAU / 3; fbox(-4.0 + Math.sin(a) * 0.22 - 0.03, -4.0 + Math.sin(a) * 0.22 + 0.03, FL, FL + 0.55, -9.0 + Math.cos(a) * 0.22 - 0.03, -9.0 + Math.cos(a) * 0.22 + 0.03, IRON, 0.9); }
        fire(-4.0, FL + 1.0, -9.0, 3.4, [x0, x1, z0, z1, FL, Y1], 0.85, [[-4.0, FL + 0.78, -9.0, 0.5], [-3.9, FL + 0.76, -8.92, 0.38]]);
        blk(-4.4, -3.6, -9.4, -8.6, FL);
        tagAt('guardroom', -3.8, 2.0, -10.3, 2.0, FL);
      }
      // --- the gatehouse stair, in its east tower: from the passage up to the south-east wall-walk
      stair('gateStair', GST.c, GST.R, FL, WALK, -Math.PI / 2, 3.5, GT - 3.6);
      tagAt('gateStair', GST.c[0], 1.6, GST.c[1], 1.0, FL);
      // --- the wall-walks behind the parapets, at WALK (castle.js's own walk floors, broken where a stone has bitten
      // the wall top: never walk through a hole into air)
      const XT = X - AP, mz0 = -30 - S.midHz, mz1 = -30 + S.midHz;
      reg(GH.x1, XT, SI, SO - PT, WALK); reg(-XT, -GH.x1, SI, SO - PT, WALK);
      reg(PO.x1, XT, NO + PT, zN + half, WALK); reg(-XT, -PO.x1, NO + PT, zN + half, WALK);
      for (const sx of [-1, 1]) {
        const xa = Math.min(sx * (X - half), sx * (EO - PT)), xb = Math.max(sx * (X - half), sx * (EO - PT));
        reg(xa, xb, mz1, zS - AP, WALK); reg(xa, xb, zN + AP, mz0, WALK);
      }
      tagAt('wallWalk', 10, WALK + 1.0, -12.3, 1.2, WALK); tagAt('wallWalk', -17.7, WALK + 1.0, -37, 1.2, WALK);
      // the gatehouse stair's head door onto the south-east walk, the north-west stair's onto the west walk
      doorReg([GH.x1, GST.c[1]], 1, 0, 0.8, GH.x1 - GST.c[0] - GST.R + 0.02, WALK, WK + 2.0);
      doorReg([STH.x0, STH.c[1]], -1, 0, 0.8, STH.c[0] - STH.R - STH.x0 + 0.02, WALK, WK + 2.0);
      // the courtyard doors and the screens openings as floor; the guardroom's and the stair's doors off the passage
      for (const [cx2, cz2, nx2, nz2, w2] of [[-2.6, CY.z0, 0, 1, DW], [6.5, CY.z0, 0, 1, DW], [-PO.passage / 2, -45.3, 1, 0, 0.9], [PO.passage / 2, -46.45, -1, 0, 0.7], [PO.passage / 2, -45.3, -1, 0, 0.7], [PO.passage / 2, -44.12, -1, 0, 0.7],
        [CY.x0, STH.c[1], 1, 0, 1.0], [CY.x0, -34, 1, 0, 1.0], [CY.x0, -22, 1, 0, 1.0], [CY.x1, -34, -1, 0, 1.0], [CY.x1, -22, -1, 0, 1.0], [-GP, -11.6, 1, 0, 0.9]]) doorReg([cx2, cz2], nx2, nz2, w2, 0.5, FL, FL + DH);
      doorReg([GP, GST.c[1]], -1, 0, 0.8, GST.c[0] - GST.R - GP + 0.02, FL, FL + DH);
      // --- the towers: a room where the walk passes through (its two doors), the stair in the turret up to the roof,
      // the roof itself (the south-west tower's notch is its broken floor until the mist puts it back)
      for (const [name, [cx, cz]] of Object.entries(S.towers)) {
        const tt = towerTops[name], out = tt.out, CR = WK + 2.6;
        const thX = cx > 0 ? -Math.PI / 2 : Math.PI / 2, thZ = cz > -30 ? Math.PI : 0;
        const dX = { th: thX, c: [cx + Math.sin(thX) * AP, cz + (cz > -30 ? -PT / 2 : PT / 2)] }, dZ = { th: thZ, c: [cx + (cx > 0 ? -PT / 2 : PT / 2), cz + Math.cos(thZ) * AP] };
        const rv = RTR / Math.cos(Math.PI / 12), rp = ngonPts(cx, cz, rv, 12, Math.PI / 12);
        for (let k = 0; k < 12; k++) {
          const A = rp[k], B = rp[(k + 1) % 12], th = Math.atan2((A[0] + B[0]) / 2 - cx, (A[1] + B[1]) / 2 - cz);
          const hs = [];
          for (const d of [dX, dZ]) if (Math.abs(angDiff(th, d.th)) < 0.05) hs.push(holeOn(A, B, [d.c[0] - Math.sin(d.th) * (AP - RTR), d.c[1] - Math.cos(d.th) * (AP - RTR)], 0.8, WK, WK + 2.0));
          holeWall(A, B, WK, CR, [-Math.sin(th), 0, -Math.cos(th)], hs, { c: SAND, m: 0.9, seed: 9 });
          if (!hs.length && Math.abs(angDiff(th, out)) < 1.1 && k % 2 === 0) win(cx + Math.sin(th) * (RTR - 0.01), WK + 0.5, cz + Math.cos(th) * (RTR - 0.01), -Math.sin(th), -Math.cos(th), 0.3, 1.3, true);
        }
        poly(rp.map((p) => [p[0], WK, p[1]]), [0, 1, 0], FLR, 0.85, true);
        poly(rp.map((p) => [p[0], CR, p[1]]), [0, -1, 0], CEIL, 0.75, true);
        for (const d of [dX, dZ]) doorReg(d.c, Math.sin(d.th), Math.cos(d.th), 0.8, AP - RTR + 0.1, WK, WK + 2.0);
        const T0 = tt.turret, RW = 1.0;
        reg(cx - RTR, cx + RTR, cz - RTR, cz + RTR, WK, { ceil: CR, inside: (x, z) => Math.hypot(x - cx, z - cz) < RTR - 0.06 && Math.hypot(x - T0[0], z - T0[1]) > RW + 0.17 });
        // the stair's enclosure standing in the room, its door facing the tower's middle
        {
          const RE = RW + 0.15, ep = ngonPts(T0[0], T0[1], RE / Math.cos(Math.PI / 10), 10, out + Math.PI / 10);
          for (let i = 0; i < 10; i++) {
            const A = ep[i], B = ep[(i + 1) % 10], m = Math.atan2((A[0] + B[0]) / 2 - T0[0], (A[1] + B[1]) / 2 - T0[1]);
            const isDoor = Math.abs(angDiff(m, out)) < 0.05;
            holeWall(A, B, WK, CR, [Math.sin(m), 0, Math.cos(m)], isDoor ? [holeOn(A, B, [T0[0] + Math.sin(m) * RE, T0[1] + Math.cos(m) * RE], 0.8, WK, WK + 2.0)] : [], { c: SAND, m: 0.9, seed: 9 });
          }
          const dc = [T0[0] + Math.sin(out) * RE, T0[1] + Math.cos(out) * RE];
          const tx2 = Math.cos(out), tz2 = -Math.sin(out);
          for (const s of [-1, 1]) wall([dc[0] + tx2 * s * 0.4, dc[1] + tz2 * s * 0.4], [dc[0] + tx2 * s * 0.4 - Math.sin(out) * 0.16, dc[1] + tz2 * s * 0.4 - Math.cos(out) * 0.16], WK, WK + 2.0, [-tx2 * s, 0, -tz2 * s], { c: SAND, m: 0.75, bands: false });
          poly([[dc[0] - tx2 * 0.4, WK + 2.0, dc[1] - tz2 * 0.4], [dc[0] + tx2 * 0.4, WK + 2.0, dc[1] + tz2 * 0.4], [dc[0] + tx2 * 0.4 - Math.sin(out) * 0.16, WK + 2.0, dc[1] + tz2 * 0.4 - Math.cos(out) * 0.16], [dc[0] - tx2 * 0.4 - Math.sin(out) * 0.16, WK + 2.0, dc[1] - tz2 * 0.4 - Math.cos(out) * 0.16]], [0, -1, 0], SAND, 0.5, true);
        }
        tt.rail = stair('towerStair', T0, RW, WK, TH, out, 1, TH + 2.2, WK + 2.0, TH + 2.0);
        // a torch on the room's wall by the stair
        { const a = out + 0.85, p = [cx + Math.sin(a) * (RTR - 0.12), cz + Math.cos(a) * (RTR - 0.12)]; fbox(p[0] - 0.05, p[0] + 0.05, WK + 1.4, WK + 1.95, p[1] - 0.05, p[1] + 0.05, OAK, 0.7); fire(p[0], WK + 2.1, p[1], 3.2, [cx - 4, cx + 4, cz - 4, cz + 4, WK - 0.5, CR], 0.75, [[p[0], WK + 2.08, p[1], 0.45]]); }
        // the roof, and the landing at the turret's door
        const rr2 = AP - PT - 0.04;
        reg(cx - rr2, cx + rr2, cz - rr2, cz + rr2, TH, {
          inside: (x, z) => Math.hypot(x - cx, z - cz) < rr2 && Math.hypot(x - T0[0], z - T0[1]) > 1.36,
        });
        oreg(T0, out, -0.2, 1.3 * Math.cos(Math.PI / 8) + 0.3, 0.39, TH, { ceil: TH + 2.0 });
        tagAt('towerRoom', cx, WK + 1.6, cz, 2.0, WK);
        if (name === 'SE' || name === 'NW') tagAt('towerStair', T0[0], WK + 1.4, T0[1], 1.0, WK);
      }
      // --- the mid-towers and the postern: the walk passes through a small room in each
      for (const [cx, cz] of Object.values(S.midTowers)) {
        const sx = Math.sign(cx), x0 = Math.min(sx * (Math.abs(cx) - S.midHx + 0.05), sx * (Math.abs(cx) + S.midHx - 0.5)), x1 = Math.max(sx * (Math.abs(cx) - S.midHx + 0.05), sx * (Math.abs(cx) + S.midHx - 0.5));
        const z0 = cz - S.midHz + 0.45, z1 = cz + S.midHz - 0.45, Y1 = WK + 2.5, xd = sx * (Math.abs(cx) - S.midHx + 0.45);
        room(x0, x1, z0, z1, WK, Y1, { stone: true, c: SAND, m: 0.9, holes: { n: [{ at: xd, w: 0.8, h0: WK, h1: WK + 2.0 }], s: [{ at: xd, w: 0.8, h0: WK, h1: WK + 2.0 }] } });
        reg(x0, x1, z0, z1, WK, { ceil: Y1 });
        win(sx > 0 ? x1 - 0.01 : x0 + 0.01, WK + 0.5, cz, -sx, 0, 0.3, 1.3, true);
        for (const zf of [cz - S.midHz, cz + S.midHz]) doorReg([xd, zf], 0, Math.sign(zf - cz), 0.8, 0.47, WK, WK + 2.0);
        bench(sx > 0 ? x1 - 0.4 : x0, sx > 0 ? x1 : x0 + 0.4, cz - 1.2, cz + 1.2, WK); blk(sx > 0 ? x1 - 0.45 : x0, sx > 0 ? x1 : x0 + 0.45, cz - 1.25, cz + 1.25, WK);
        tagAt('towerRoom', (x0 + x1) / 2, WK + 1.6, cz, 1.8, WK);
      }
      {
        const x0 = PO.x0 + 0.5, x1 = PO.x1 - 0.5, z0 = PO.z0 + 0.5, z1 = PO.z1 - 0.5, Y1 = PTH - 0.12, zd = zN - half + PT + (CU.thick - PT) / 2;
        room(x0, x1, z0, z1, WK, Y1, { stone: true, c: SAND, m: 0.9, holes: { e: [{ at: zd, w: 0.8, h0: WK, h1: WK + 1.86 }], w: [{ at: zd, w: 0.8, h0: WK, h1: WK + 1.86 }] } });
        reg(x0, x1, z0, z1, WK, { ceil: Y1 });
        for (const sx of [-1, 1]) doorReg([sx * PO.x1, zd], sx, 0, 0.8, 0.52, WK, WK + 1.86);
        win(0, WK + 0.35, z0 + 0.01, 0, 1, 0.3, 1.1, true);
        tagAt('towerRoom', 0, WK + 1.4, -48.5, 1.5, WK);
      }
      const insideGeo = end();
      // the firelight each vertex gets (fires light their own room only)
      {
        const pa = insideGeo.attributes.position, gl = new Float32Array(pa.count);
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
          let g = 0;
          for (const F of IFIRE) {
            const b = F.bx;
            if (x < b[0] - 0.2 || x > b[1] + 0.2 || z < b[2] - 0.2 || z > b[3] + 0.2 || y < b[4] - 0.3 || y > b[5] + 0.3) continue;
            const d = Math.hypot(x - F.x, (y - F.y) * 1.3, z - F.z) / F.R;
            if (d < 1) g += F.k * (1 - d) * (1 - d);
          }
          gl[i] = Math.min(1.6, g);
        }
        insideGeo.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
      }
      // split into areas, each its own mesh drawn only while the eye is within a few metres of it (so at most one or
      // two at a time): the hall, the service end and kitchen, the north-east tower with its well, the west range, the
      // east range, the gatehouse, each other corner tower, the mid-towers and the postern
      const ZN = ['hall', 'service', 'towerNE', 'west', 'east', 'gate', 'towerNW', 'towerSW', 'towerSE', 'midW', 'midE', 'postern'];
      const zoneOf = (x, y, z) => {
        if ((x - NEc[0]) ** 2 + (z - NEc[1]) ** 2 < 4.5 * 4.5 || (x > XK + 0.05 && z < CY.z0 - 0.4)) return 2;
        for (const [nm, i] of [['NW', 6], ['SW', 7], ['SE', 8]]) { const c = S.towers[nm]; if ((x - c[0]) ** 2 + (z - c[1]) ** 2 < 4.5 * 4.5) return i; }
        if (Math.abs(x) > X - 0.95 && Math.abs(z + 30) < S.midHz + 0.2 && y > WALK - 0.5) return x < 0 ? 9 : 10;
        if (Math.abs(x) < PO.x1 + 0.1 && z < PO.z1 + 0.1 && y > WALK - 0.5) return 11;
        if (z > CY.z1 - 0.5 && Math.abs(x) < GH.x1 + 0.6) return 5;
        if (z < CY.z0 + 0.1 && Math.abs(x) < XK + 0.1) return x < -PO.passage / 2 - 0.1 ? 0 : 1;
        return x < 0 ? 3 : 4;
      };
      const zones = ZN.map((name) => ({ name, P: [], C: [], G: [], box: [Infinity, -Infinity, Infinity, -Infinity], shown: false, k: 0, mesh: null }));
      {
        const pa = insideGeo.attributes.position.array, ca = insideGeo.attributes.color.array, ga = insideGeo.attributes.aGlow.array;
        for (let t = 0; t < pa.length / 9; t++) {
          const o = t * 9, cx = (pa[o] + pa[o + 3] + pa[o + 6]) / 3, cy = (pa[o + 1] + pa[o + 4] + pa[o + 7]) / 3, cz = (pa[o + 2] + pa[o + 5] + pa[o + 8]) / 3;
          const Z = zones[zoneOf(cx, cy, cz)];
          for (let k = 0; k < 9; k++) { Z.P.push(pa[o + k]); Z.C.push(ca[o + k]); }
          for (let k = 0; k < 3; k++) { Z.G.push(ga[t * 3 + k]); const x = pa[o + k * 3], z = pa[o + k * 3 + 2]; Z.box[0] = Math.min(Z.box[0], x); Z.box[1] = Math.max(Z.box[1], x); Z.box[2] = Math.min(Z.box[2], z); Z.box[3] = Math.max(Z.box[3], z); }
        }
      }
      const insideMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
      const IU = { uAmb: { value: new THREE.Color(1, 1, 1) }, uFire: { value: new THREE.Color(1, 0.6, 0.3) } };
      insideMat.onBeforeCompile = (sh) => {
        sh.uniforms.uAmb = IU.uAmb; sh.uniforms.uFire = IU.uFire;
        sh.vertexShader = 'attribute float aGlow;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
        sh.fragmentShader = 'uniform vec3 uAmb;\nuniform vec3 uFire;\nvarying float vGlow;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= uAmb + vGlow * uFire;');
      };
      insideMat.customProgramCacheKey = () => 'castleInside';
      for (const Z of zones) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(Z.P, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(Z.C, 3));
        g.setAttribute('aGlow', new THREE.Float32BufferAttribute(Z.G, 1));
        g.computeVertexNormals(); g.computeBoundingSphere();
        Z.mesh = new THREE.Mesh(g, insideMat); Z.mesh.visible = false; Z.mesh.frustumCulled = false;
        Z.tris = Z.P.length / 9; Z.P = Z.C = Z.G = null;
        ctx.root.add(Z.mesh);
      }
      insideGeo.dispose();
      // each doorway's plug and each fire belongs to the area it opens into
      for (const G of PLUGS) G.zone = zoneOf(G.x - Math.sin(G.yaw) * 0.6, G.y, G.z - Math.cos(G.yaw) * 0.6);
      for (const f of IFL) f[4] = zoneOf(f[0], f[1], f[2]);
      INSIDE = { zones, U: IU, flames: IFL, shown: false };
      // the walking map for the base's Soldier's eye: floorAt(x, z, y) is the floor at (x, z) for someone whose floor is
      // y (within a step of 0.66), or NaN where it's wall, air or furniture; nav.ceil is that floor's ceiling
      const NREG = NAV.regions, NOBS = NAV.obstacles;
      const navApi = {
        near: (x, z) => x > -24 && x < 24 && z > -55 && z < -6.6,
        rails: NAV.rails,
        ceil: Infinity,
        floorAt(x, z, y) {
          let best = NaN, bd = 0.66, ceil = Infinity;
          for (let i = 0; i < NREG.length; i++) {
            const R = NREG[i];
            if (x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1) continue;
            if (R.inside && !R.inside(x, z)) continue;
            const h = R.yf ? R.yf(x, z) : R.y, d = Math.abs(h - y);
            if (d < bd) { bd = d; best = h; ceil = R.ceil; }
          }
          if (best !== best) return NaN;
          for (let i = 0; i < NOBS.length; i++) { const O = NOBS[i]; if (x > O.x0 && x < O.x1 && z > O.z0 && z < O.z1 && best > O.y0 - 0.3 && best < O.y1) return NaN; }
          navApi.ceil = ceil;
          return best;
        },
      };
      NAV_API = navApi;
      // the rooms' labels: only while they're drawn
      for (const [key, p, r, ringY] of ITAG) { const Z = zones[zoneOf(p.x, ringY + 0.5, p.z)]; ctx.tag(key, () => (Z.shown ? p : null), { r, ringY }); }

      // ================= the breakable battlement =================
      // The south-west tower's parapet facing T1 (SIEGE.breach): per side a sill in two halves and its merlon. They burst
      // outward at breakAt, tumble and splash into the moat around breachSplash, and rise back into place under the mist.
      {
        const sideLen = 2 * RV * Math.sin(Math.PI / 12), [cx, cz] = S.towers.SW;
        const sp = BR.splash;
        for (let k = -2; k <= 2; k++) {
          const th = k * TAU / 12;
          let dth = Math.atan2(Math.sin(th - BR.face), Math.cos(th - BR.face));
          if (Math.abs(dth) >= BR.arc) continue;
          const mx = cx + Math.sin(th) * (AP - PT / 2), mz = cz + Math.cos(th) * (AP - PT / 2);
          const L = sideLen + 0.32;
          const parts = [
            { off: -L / 4, w: L / 2, y0: TH, y1: TH + SILL },
            { off: L / 4, w: L / 2, y0: TH, y1: TH + SILL },
            { off: 0, w: 1.4, y0: TH + SILL, y1: TH + MER },
          ];
          for (const pt of parts) {
            const px = mx + Math.cos(th) * pt.off, pz = mz - Math.sin(th) * pt.off, py = (pt.y0 + pt.y1) / 2;
            const ox = Math.sin(th), oz = Math.cos(th);
            const reach = rr(2.6, 4.2);
            const lx = ctx.lerpN(px + ox * reach, sp[0], 0.3) + rr(-0.6, 0.6), lz = Math.max(-6.5, ctx.lerpN(pz + oz * reach, sp[1], 0.3) + rr(-0.5, 0.7));
            const Tf = 1.7 + rr(-0.12, 0.12) + (pt.y0 > TH ? 0.05 : -0.05);
            pieces.push({
              rest: [px, py, pz], yaw: th, size: [pt.w - 0.02, pt.y1 - pt.y0 - 0.01, PT - 0.01], land: [lx, lz], T: Tf, delay: rr(0, 0.07),
              axis: new THREE.Vector3(rr(-1, 1), rr(-0.3, 0.3), rr(-1, 1)).normalize(), spin: rr(3, 7) * (rnd() < 0.5 ? -1 : 1),
              rise: pt.y0 > TH ? 1.3 : 0.7, back: 165 + rr(0, 4.5),
            });
          }
        }
        // chips: small stones that only show in the burst
        const bp = BR.point;
        for (let i = 0; i < 7; i++) {
          const a = BR.face + rr(-1.0, 1.0), reach = rr(2.5, 5.5), s = rr(0.22, 0.42);
          pieces.push({
            chip: true, rest: [bp[0] + rr(-0.6, 0.6), bp[1] + rr(-0.2, 0.4), bp[2] + rr(-0.3, 0.2)], yaw: rr(0, TAU), size: [s, s * rr(0.7, 1.1), s * rr(0.7, 1.2)],
            land: [bp[0] + Math.sin(a) * reach, Math.max(-6.6, bp[2] + Math.cos(a) * reach)], T: rr(1.75, 2.1), delay: rr(0, 0.05),
            axis: new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize(), spin: rr(6, 11),
          });
          chipsN++;
        }
        // the dark plugs in the walk-through doorways (they hide the rooms from outside; gone while Soldier's eye is in)
        for (const G of PLUGS) pieces.push({ plug: true, zone: G.zone, rest: [G.x, G.y, G.z], yaw: G.yaw, size: [G.w, G.h, 0.05] });
        begin();
        // a unit block in the parapet's stone: sides a touch darker than its top
        prism([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], -0.5, 0.5, { c: CAP, bands: false, flat: true, m: 0.95, topM: 1.1, under: 0.7 });
        const g = end();
        // (its own material: the plugs are coloured dark per instance, and r128 won't switch programs on a shared one)
        piecesMesh = new THREE.InstancedMesh(g, ctx.mat(0xffffff, { vertexColors: true, roughness: 0.94 }), pieces.length);
        piecesMesh.frustumCulled = false;
        ctx.root.add(piecesMesh);
        { const cW = new THREE.Color(1, 1, 1), cD = new THREE.Color(0.16, 0.14, 0.12); pieces.forEach((P, i) => piecesMesh.setColorAt(i, P.plug ? cD : cW)); }
        for (const p of pieces) {
          if (p.plug) { p.q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw); continue; }
          // the time it falls: from its rest place to the landing at y = water level in T seconds
          p.vy = (S.moat.level - p.rest[1] + 0.5 * 9.8 * p.T * p.T) / p.T;
          p.q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
          p.splashIdx = p.chip ? -1 : splashes.length;
          if (!p.chip) splashes.push({ x: p.land[0], z: p.land[1], t: T.breakAt + p.delay + p.T, s: rr(0.8, 1.15) });
        }
      }
      // the dust puff where the stone strikes, and splashes where the pieces fall
      {
        const smokeMat = new THREE.MeshStandardMaterial({ color: lin(0xd9c9a6), flatShading: true, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
        const ico = new THREE.IcosahedronGeometry(1, 0);
        dustMesh = new THREE.InstancedMesh(ico, smokeMat, 14);
        dustMesh.frustumCulled = false;
        ctx.root.add(dustMesh);
        const bp = BR.point;
        for (let i = 0; i < 14; i++) {
          const a = BR.face + rr(-1.3, 1.3), low = i >= 10;
          dust.push({ p: [bp[0] + rr(-0.9, 0.9), bp[1] + rr(-0.5, 0.4), bp[2] + rr(-0.7, 0.3)], v: [Math.sin(a) * rr(1.0, 2.6), low ? rr(-1.6, -0.9) : rr(0.2, 1.4), Math.cos(a) * rr(1.0, 2.6)], r0: rr(0.25, 0.45), r1: low ? rr(0.7, 1.1) : rr(1.0, 1.9), spin: rr(-1, 1) });
        }
        const splashMat = new THREE.MeshStandardMaterial({ color: lin(0xe9f1ee), flatShading: true, roughness: 0.6, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
        const cone = new THREE.CylinderGeometry(1, 0.3, 1, 7, 1, true); cone.translate(0, 0.5, 0);
        splashMesh = new THREE.InstancedMesh(cone, splashMat, splashes.length);
        splashMesh.frustumCulled = false;
        ctx.root.add(splashMesh);
      }

      // ================= the portcullis (iron-clad oak, Bodiam's survives) =================
      {
        begin();
        const W = GH.passage + 0.4, H = GV + 0.3;
        for (let i = 0; i < 6; i++) { const x = -W / 2 + 0.2 + i * (W - 0.4) / 5; box(x - 0.09, x + 0.09, 0, H, -0.09, 0.09, { c: OAK, bands: false, flat: true, m: 0.62, topM: 0.7 }); prism(ngonPts(x, 0, 0.11, 4, Math.PI / 4).map((p) => p), -0.28, 0.0, { c: IRON, bands: false, flat: true }); }
        for (let j = 0; j < 6; j++) { const y = 0.45 + j * (H - 0.7) / 5; box(-W / 2, W / 2, y - 0.08, y + 0.08, -0.13, 0.13, { c: OAK, bands: false, flat: true, m: 0.55 }); }
        portcullis = new THREE.Mesh(end(), M);
        portcullis.position.set(0, 2.5, GR - 0.82);
        portcullis.matrixAutoUpdate = true;
        ctx.root.add(portcullis);
      }
      // ================= the postern's gate leaves (two, hung on the passage walls, opening inward) =================
      {
        begin();
        const strap = (y) => (Math.abs(y - 0.6) < 0.1 || Math.abs(y - 2.4) < 0.1 ? 0.55 : 1);
        box(0, PP, 0, PV - 0.1, -0.07, 0.07, { c: OAK, bands: false, m: 0.9, bandFn: strap, cuts: [0.5, 0.7, 2.3, 2.5], under: 0.6 });
        leaves = new THREE.InstancedMesh(end(), M, 2);
        leaves.frustumCulled = false;
        leaves.userData.z = PO.z0 + 0.58;
        ctx.root.add(leaves);
      }
      // ================= torch flames (lit with the lamps, from dusk to morning) =================
      {
        const g = new THREE.OctahedronGeometry(1, 0);
        flames = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: lin(0xffb44a) }), flameSpots.length + INSIDE.flames.length);
        flames.frustumCulled = false;
        ctx.root.add(flames);
        for (const f of flameSpots) ctx.addLantern(new THREE.Vector3(f[0], f[1] + 0.12, f[2]));
      }

      // ================= the Bull banner and the pennons =================
      {
        // the arms, drawn once on a canvas: Gules, a bull passant argent, armed or (the same drawing as the knights' jupons)
        const BULL = {
          body: [
            [[-0.28, 0.3], [0.4, 0.3], [0.4, 0.7], [-0.24, 0.76]], [[-0.3, 0.6], [0.02, 0.7], [-0.04, 0.9], [-0.24, 0.92]],
            [[0.22, 0.6], [0.42, 0.62], [0.42, 0.76], [0.24, 0.78]], [[-0.52, 0.42], [-0.24, 0.4], [-0.2, 0.76], [-0.48, 0.8]],
            [[-0.6, 0.34], [-0.44, 0.33], [-0.42, 0.52], [-0.6, 0.52]], [[-0.24, 0.34], [-0.1, 0.34], [-0.16, 0.18], [-0.3, 0.2]],
            [[-0.3, 0.2], [-0.17, 0.17], [-0.27, 0.05], [-0.39, 0.09]], [[-0.06, 0.32], [0.08, 0.32], [0.08, 0.0], [-0.06, 0.0]],
            [[0.26, 0.32], [0.4, 0.32], [0.38, 0.0], [0.26, 0.0]], [[0.11, 0.32], [0.24, 0.32], [0.2, 0.02], [0.09, 0.04]],
            [[0.39, 0.7], [0.46, 0.68], [0.5, 0.3], [0.44, 0.3]], [[0.42, 0.32], [0.53, 0.32], [0.53, 0.15], [0.42, 0.15]],
          ],
          accent: [[[-0.5, 0.77], [-0.43, 0.78], [-0.5, 0.95], [-0.61, 0.99]], [[-0.31, 0.76], [-0.24, 0.75], [-0.17, 0.96], [-0.26, 0.95]]],
        };
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
        const g2 = cv.getContext('2d');
        g2.fillStyle = '#b5322a'; g2.fillRect(0, 0, 256, 128);
        const drawBull = (cx, cy, s) => {
          for (const [list, colr] of [[BULL.body, '#efe9dc'], [BULL.accent, '#d9a92c']]) {
            g2.fillStyle = colr;
            for (const q of list) { g2.beginPath(); q.forEach(([u, v2], i) => { const X2 = cx + u * s, Y2 = cy - v2 * s; if (i) g2.lineTo(X2, Y2); else g2.moveTo(X2, Y2); }); g2.closePath(); g2.fill(); }
          }
          g2.fillStyle = '#efe9dc';
        };
        drawBull(64, 100, 92);            // the banner (left half): the whole coat
        drawBull(162, 86, 50);            // the pennon (right half): the bull by the staff
        const tex = new THREE.CanvasTexture(cv);
        tex.encoding = THREE.sRGBEncoding;
        flagMat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, flatShading: true, roughness: 0.9 });
        flagU = { uT: { value: 0 }, uAmp: { value: 1 }, uBoost: { value: 0 } };
        flagMat.onBeforeCompile = (sh) => {
          sh.uniforms.uFT = flagU.uT; sh.uniforms.uFA = flagU.uAmp; sh.uniforms.uFB = flagU.uBoost;
          sh.vertexShader = 'uniform float uFT;\nuniform float uFA;\nuniform float uFB;\nattribute vec2 aFlag;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'float fu = aFlag.x, fph = aFlag.y;',
            'float fw = sin(uFT * 3.4 - fu * 5.5 + fph) * 0.26 + sin(uFT * 5.9 - fu * 9.0 + fph * 1.7) * 0.07;',
            'transformed.z += fw * fu * uFA * (1.0 + 0.8 * uFB);',
            'transformed.y += (-0.16 * (1.0 - uFB) + 0.18 * uFB * sin(uFT * 2.0 + fph)) * fu * fu;',
            'transformed.x -= abs(fw) * 0.12 * fu;',
          ].join('\n'));
        };
        flagMat.customProgramCacheKey = () => 'castleFlag';
        flagMat.userData.extraKey = 'castleFlag';
        const pos = [], uv = [], fl = [];
        // a flag flying east (the wind) from a staff at (x, y top, z): w long, h at the hoist, h2 at the fly, a swallow tail
        const addFlag = (x, yTop, z, w, h, h2, nu, nv, u0, u1, tail, ph) => {
          const at = (i, j) => {
            const fu = i / nu, hh = h + (h2 - h) * fu, fv = j / nv;
            let px = x + 0.1 + fu * w;
            if (tail && fu > 0.75) px -= (1 - Math.abs(fv - 0.5) * 2) * (fu - 0.75) / 0.25 * w * 0.2;
            const py = yTop - h / 2 + (fv - 0.5) * hh;
            return [px, py, z, u0 + (u1 - u0) * fu, 0.5 + (py - (yTop - h / 2)) / h, fu];
          };
          for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
            const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
            for (const p of [a, b, c, a, c, d]) { pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]); fl.push(p[5], ph); }
          }
        };
        for (const f of flags) {
          if (f.kind === 'banner') addFlag(f.x, f.y, f.z, 2.5, 2.3, 2.3, 7, 4, 0.0, 0.5, false, 0.0);
          else addFlag(f.x, f.y, f.z, 3.0, 1.0, 0.4, 6, 2, 0.5, 1.0, true, f.x * 0.37 + f.z * 0.21);
        }
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        fg.setAttribute('aFlag', new THREE.Float32BufferAttribute(fl, 2));
        fg.computeVertexNormals();
        const fm = new THREE.Mesh(fg, flagMat);
        fm.frustumCulled = false;
        ctx.root.add(fm);
      }

      // ================= what the choreographers need =================
      const ladyCren = crenels.find((c) => c.where === 'gatehouse' && Math.abs(c.x) < 0.1 && c.face === 0);
      const damselCren = crenels.find((c) => c.where === 'curtainS' && Math.abs(c.x - 7.3) < 0.1);
      const castle = {
        // standing heights (floors people stand on)
        walkY: WALK, towerTopY: TH, midTowerTopY: MH, gatehouseTopY: GT, barbicanTopY: BT, posternTopY: PTH, rangeRoofY: RH, floorY: FY,
        sill: SILL, merlonTop: MER,                 // a crenel's sill and a merlon's top, above the floor
        crenels, merlons,
        lady: ladyCren ? { x: ladyCren.x, y: GT, z: ladyCren.z, face: 0 } : null,     // over the gate, at the middle crenel
        damsel: damselCren || null,                                            // above T2's hit on the south curtain (x 6.5)
        bullGuns: ctx.spots.BULL_GUNS,
        // the moving parts' state at a cycle time
        portcullisBottom: (t) => portcullisY(t), posternOpen: (t) => posternK(t), breachBroken: (t) => breachBroken(t),
      };
      // the walking map inside the castle for the base's Soldier's eye (floors, walls, the stairs' rails)
      castle.nav = NAV_API;
      ctx.castle = castle;
      window.CASTLE = castle;

      // ================= taps =================
      const lift = () => { tapAt = ctx.clock.elapsed; };
      const tagC = new THREE.Vector3(0, 12, -30), tagG = new THREE.Vector3(0, 9, GF), tagB = new THREE.Vector3(0, 5, BA.z1), tagX = new THREE.Vector3(BR.point[0], BR.point[1], BR.point[2]);
      ctx.tag('castle', () => tagC, { r: 22, onTap: lift });
      ctx.tag('gatehouse', () => tagG, { r: 6, onTap: lift });
      ctx.tag('barbican', () => tagB, { r: 4 });
      ctx.tag('breach', () => tagX, { r: 4 });

      // debug: ?debug=castle logs the counts
      if ((new URLSearchParams(location.search).get('debug') || '').includes('castle')) {
        console.log('castle: static tris', worldMesh.geometry.attributes.position.count / 3, 'crenels', crenels.length, 'merlons', merlons.length, 'flames', flameSpots.length, 'pieces', pieces.length);
        window.__castleCounts = { tris: worldMesh.geometry.attributes.position.count / 3 };
      }
    },

    update(t, dt, ctx) {
      const ct = ctx.cycle.t, smooth01 = ctx.smooth01;
      const m = M4[0], q = Q[0], q2 = Q[1], p = V[0], s = V[1];
      // ---- the breakable battlement ----
      const tb = T.breakAt;
      for (let i = 0; i < pieces.length; i++) {
        const P = pieces[i];
        if (P.plug) {
          const v = 1 - (INSIDE ? INSIDE.zones[P.zone].k : 0);
          p.set(P.rest[0], P.rest[1], P.rest[2]); q.copy(P.q0); s.set(P.size[0] * v, P.size[1] * v, P.size[2]);
          if (v < 0.002) s.set(0, 0, 0);
          piecesMesh.setMatrixAt(i, m.compose(p, q, s));
          continue;
        }
        const t0 = tb + P.delay, tau = ct - t0;
        let vis = 1;
        if (tau < 0 || (!P.chip && ct >= P.back + 3.2)) {
          // whole (before the hit, and after it's put back)
          if (P.chip) vis = 0;
          p.set(P.rest[0], P.rest[1], P.rest[2]); q.copy(P.q0);
        } else if (tau <= P.T + 0.5) {
          const k = Math.min(tau, P.T) / P.T;
          const x = P.rest[0] + (P.land[0] - P.rest[0]) * k, z = P.rest[2] + (P.land[1] - P.rest[2]) * k;
          let y = P.rest[1] + P.vy * Math.min(tau, P.T) - 4.9 * Math.min(tau, P.T) * Math.min(tau, P.T);
          if (tau > P.T) { const u = (tau - P.T) / 0.5; y -= 1.2 * u; vis = 1 - smooth01(u); }   // sinking into the moat
          if (P.chip) vis *= smooth01(tau / 0.06);
          p.set(x, y, z);
          q2.setFromAxisAngle(P.axis, P.spin * Math.min(tau, P.T + 0.3));
          q.copy(q2).multiply(P.q0);
        } else if (!P.chip && ct >= P.back) {
          // put back under the mist: it rises out of the tower's wall into its place
          const u = smooth01((ct - P.back) / 3.2);
          p.set(P.rest[0], P.rest[1] - P.rise * (1 - u), P.rest[2]); q.copy(P.q0);
        } else { vis = 0; p.set(P.rest[0], P.rest[1] - 2, P.rest[2]); q.copy(P.q0); }
        s.set(P.size[0] * vis, P.size[1] * vis, P.size[2] * vis);
        if (vis <= 0.001) s.set(0, 0, 0);
        piecesMesh.setMatrixAt(i, m.compose(p, q, s));
      }
      piecesMesh.instanceMatrix.needsUpdate = true;
      // dust: a puff at the strike that swells, drifts east on the wind and thins
      {
        const tau = ct - tb, on = tau > 0 && tau < 4.5;
        dustMesh.material.opacity = on ? 0.6 * smooth01(tau / 0.08) * (1 - smooth01((tau - 0.3) / 4.0)) : 0;
        dustMesh.visible = on;
        if (on) {
          for (let i = 0; i < dust.length; i++) {
            const D = dust[i], e = 1 - Math.exp(-tau * 1.4);
            p.set(D.p[0] + D.v[0] * e * 1.6 + 0.7 * tau, D.p[1] + D.v[1] * e * 1.6 + 0.25 * tau, D.p[2] + D.v[2] * e * 1.6 - 0.2 * tau);
            const r = D.r0 + (D.r1 - D.r0) * smooth01(tau / 2.2);
            q.setFromAxisAngle(V[2].set(0, 1, 0), D.spin * tau);
            s.set(r, r * 0.85, r);
            dustMesh.setMatrixAt(i, m.compose(p, q, s));
          }
          dustMesh.instanceMatrix.needsUpdate = true;
        }
      }
      // splashes: a white burst where each piece goes in
      {
        let any = false;
        for (let i = 0; i < splashes.length; i++) {
          const W = splashes[i], tau = ct - W.t;
          if (tau > 0 && tau < 1.4) {
            any = true;
            const hgt = 2.2 * W.s * Math.sin(Math.PI * Math.min(1, tau / 1.1)) + 0.01, r = (0.3 + 0.7 * smooth01(tau / 1.2)) * W.s;
            p.set(W.x, ctx.WATER.level - 0.05, W.z); q.identity(); s.set(r, hgt, r);
          } else { p.set(W.x, -5, W.z); q.identity(); s.set(0, 0, 0); }
          splashMesh.setMatrixAt(i, m.compose(p, q, s));
        }
        splashMesh.instanceMatrix.needsUpdate = true;
        splashMesh.visible = any;
        
      }
      // ---- the portcullis ----
      portcullis.position.y = portcullisY(ct);
      // ---- the postern's leaves ----
      {
        const k = posternK(ct), a = 1.5 * k;
        const z = leaves.userData.z, PP = S.postern.passage / 2;
        p.set(-PP, 0.03, z); q.setFromAxisAngle(V[2].set(0, 1, 0), -a); s.set(1, 1, 1);
        leaves.setMatrixAt(0, m.compose(p, q, s));
        p.set(PP, 0.03, z); q.setFromAxisAngle(V[2].set(0, 1, 0), Math.PI + a);
        leaves.setMatrixAt(1, m.compose(p, q, s));
        leaves.instanceMatrix.needsUpdate = true;
      }
      // ---- the rooms inside: drawn only while Soldier's eye is in the castle (the doorways' plugs fade as they come) ----
      const night = smooth01((0.75 - ctx.light.day) / 0.4);
      {
        const E = ctx.eyeView, inZone = !!(E && E.on && Math.abs(E.x) < 24 && E.z > -55 && E.z < -7.2);
        INSIDE.shown = false;
        for (const Z of INSIDE.zones) {
          // drawn while the eye is in the castle and within NEAR m of this area
          const b = Z.box, dx = inZone ? Math.max(b[0] - E.x, 0, E.x - b[1]) : 99, dz = inZone ? Math.max(b[2] - E.z, 0, E.z - b[3]) : 99;
          Z.shown = dx * dx + dz * dz < INSIDE_NEAR * INSIDE_NEAR; Z.mesh.visible = Z.shown; INSIDE.shown = INSIDE.shown || Z.shown;
          Z.k += ((Z.shown ? 1 : 0) - Z.k) * Math.min(1, Math.max(0, dt) * 5);
          if (Z.k < 0.002) Z.k = 0; else if (Z.k > 0.998) Z.k = 1;
        }
        if (INSIDE.shown) {
          // daylight through the windows by day, a dim blue at night; the firelight warm, stronger in the dark
          const d = ctx.light.day, fl = 0.93 + 0.07 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.0);
          INSIDE.U.uAmb.value.setRGB(0.17 + 0.57 * d, 0.18 + 0.46 * d, 0.28 + 0.24 * d);
          INSIDE.U.uFire.value.setRGB(1.0, 0.56, 0.26).multiplyScalar((0.4 + 0.75 * night) * fl);
        }
      }
      // ---- torch flames: with the lamps (the base lights those from dusk to morning, both nights); the fires inside burn
      // while the rooms are drawn ----
      {
        const inK = INSIDE.shown ? 1 : 0, ZS = INSIDE.zones;
        flames.visible = night > 0.01 || inK > 0;
        if (flames.visible) {
          for (let i = 0; i < flameSpots.length; i++) {
            const f = flameSpots[i], fl = 0.85 + 0.15 * Math.sin(t * 9.0 + i * 2.1) * Math.sin(t * 5.3 + i);
            p.set(f[0] + 0.03 * Math.sin(t * 6 + i), f[1], f[2]); q.identity(); s.set(0.13 * night, 0.3 * night * fl, 0.13 * night);
            flames.setMatrixAt(i, m.compose(p, q, s));
          }
          const IF = INSIDE.flames, n0 = flameSpots.length;
          for (let j = 0; j < IF.length; j++) {
            const f = IF[j], fl = 0.8 + 0.2 * Math.sin(t * 8.1 + j * 1.7) * Math.sin(t * 4.7 + j), k = (ZS[f[4]].shown ? 1 : 0) * f[3];
            p.set(f[0] + 0.02 * Math.sin(t * 5 + j), f[1] + 0.12 * k * fl, f[2]); q.setFromAxisAngle(V[2].set(0, 1, 0), j + 0.3 * Math.sin(t * 2 + j)); s.set(0.17 * k, 0.36 * k * fl, 0.17 * k);
            flames.setMatrixAt(n0 + j, m.compose(p, q, s));
          }
          flames.instanceMatrix.needsUpdate = true;
        }
      }
      // ---- flags: the wind, and a gust on a tap ----
      {
        const since = ctx.clock.elapsed - tapAt;
        const boost = since >= 0 && since < 5 ? Math.sin(Math.PI * Math.min(1, since / 5)) * (since < 0.6 ? smooth01(since / 0.6) : 1) : 0;
        flagU.uT.value = t;
        flagU.uAmp.value = 0.75 + 0.35 * (ctx.wind ? ctx.wind.strength - 0.6 : 0) / 0.6;
        flagU.uBoost.value = Math.max(boost, ctx.wind ? ctx.wind.gust * 0.6 : 0);
      }
    },
  });

  // ---------- the timeline of the moving parts (pure functions of the cycle) ----------
  const sm = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
  const HALF_UP = 2.5;
  // the portcullis's bottom edge: half up; it drops at the alarm (96.0, down by 96.9, a little bounce), and is wound
  // up again under the night mist (166-172)
  function portcullisY(ct) {
    const a = T.alarm;
    if (ct < a) return HALF_UP;
    if (ct < a + 0.75) { const u = (ct - a) / 0.75; return HALF_UP * (1 - u * u); }
    if (ct < a + 1.15) { const u = (ct - a - 0.75) / 0.4; return 0.12 * Math.sin(Math.PI * u); }
    if (ct < 166) return 0;
    if (ct < 172) return HALF_UP * sm((ct - 166) / 6);
    return HALF_UP;
  }
  // the postern gate: 0 shut, 1 open. Opens at 99 (open by 100, when the knights ride out); shuts 157-158.6 once the
  // knights are home (SIEGE.times.knightsHome ends 156)
  function posternK(ct) {
    const o = T.posternOpens, c = T.knightsHome[1] + 1;
    if (ct < o || ct > c + 1.6) return 0;
    if (ct < o + 1.0) return sm(ct - o);
    if (ct < c) return 1;
    return 1 - sm((ct - c) / 1.6);
  }
  // are the battlements down? (from the burst until the last piece is back under the mist)
  function breachBroken(ct) { return ct >= T.breakAt && ct < 172.5; }
})();
