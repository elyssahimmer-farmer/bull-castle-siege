// horse.js: a knight's war horse of about 1400 for the castle siege (DESIGN.md §6: "Bay and grey, with long cloth
// caparisons in their rider's arms"; research.md §4a: the caparison is a cloth covering "frequently embroidered with the
// coat of arms of the horse's rider"). Built from the rig primitives in the same language as the kit figures.
//
//   const h = CHARACTERS.horse.make(kit, rig, { coat: 'bay' | 'grey', livery: 'lion' | 'bull' });
//   h.pose(p), h.set(state), h.base, h.eyes, h.shadowR, h.headTop(), h.follow (the lag)
//   h.gait / h.stride: the walk (what FigureKit.Script.walk uses by default)
//   h.gaits.walk | trot | gallop = { gait, stride, speed }: pass one as the figure to Script.walk at its speed:
//       S.walk(pts, h.gaits.gallop.speed, h.gaits.gallop)  then  h.set(S.sample(ct, I)).  The stride is matched to the
//       leg swing, so the hooves stay planted at any speed; the suggested speeds are walk 1.3, trot 3.0, gallop 5.5 m/s.
//   h.seat: a pivot on the horse's back at the top of the saddle seat (moves with the body's bob and pitch). For a rider,
//       add rider.root to h.seat after the bake at (0, rootY - 1.35, 0): with the knights' ride numbers
//       (CHARACTERS.lionKnight.ride.rootY 0.95) that's (0, -0.40, 0).
//
// Sizes (metres, horse at the origin facing +z): back 1.25, saddle SEAT TOP 1.35 at z = 0.10 (seat 0.40 wide, z -0.10 ..
// 0.31), high cantle to 1.60 at z -0.11, front bow to 1.49 at z 0.31 (0.24 wide), stirrup irons at x ±0.33, y 0.93 ..
// 0.99, z 0.14, reins ending at (±0.07, 1.47, 0.36) above the bow. Flanks under the rider's thighs: the caparison is
// ±0.24 wide at y 1.25 and ±0.29 at y 0.95. Nose 1.5 forward, ears 1.9 up, tail tip 1.0 behind. Legs 0.75 hip to hoof.
//
// The caparison is cloth in four panels, slit at the front, at both sides (under the rider's leg) and behind, hanging
// to about 0.45 m (just above the hocks) with a dagged edge. Each panel's lower half is skinned to a "flap" pivot that
// slides with its leg's swing (only along the body, never sideways), so it moves with the legs and nothing pokes
// through. The arms are on the hindquarters, one beast each side, both facing the head as heraldry requires.
//
// Pose keys reuse the kit's bag (so Script's blends and FigureKit.idle just work); each is a delta from P()'s defaults,
// so a plain P() is the rest pose (the one it's built and baked in):
//   lf0 lf1 hind legs forward (0 left = +x, 1 right)    k0 k1 hocks flexed (the cannon folds forward under the belly)
//   af0 af1 fore legs forward                           e0 e1 fore knees bent (the cannon folds back)
//   at0 neck down (+)  hx head nose down (+)  hy head turn  hz head tilt   ao0 ao1 ears back (+)
//   at1 tail swish (sideways)  lo0 tail lifted back  lo1 the caparison streaming back (gallop)  y lean twist roll body
// Poses: stand, toss, stamp. CHARACTERS.horse.anim: stand(t, seed, base) resting with ear and tail flicks;
//   tap(u, seed, base) u 0..1 over about 3 s: a head toss, two stamps of the right fore and a big tail swish (the tap
//   moment); toss(u, seed, base) the head toss alone (about 1.6 s).
// The sheet: &coat=bay|grey &livery=lion|bull &anim=stand|tap|walk|trot|gallop (in place; &ph=0..1 freezes the phase).
window.CHARACTERS = window.CHARACTERS || {};
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const frac = (x) => x - Math.floor(x);

  const COATS = {
    // bay: red-brown with black points (mane, tail, lower legs)
    bay: { body: 0x8a5230, mane: 0x2e1d14, lower: 0x35231a, muzzle: 0x5e3b26 },
    // grey: pale with a silver mane, darker legs and muzzle, as greys often are
    grey: { body: 0xc4c0b6, mane: 0xeeeae0, lower: 0x7d7a73, muzzle: 0x6e6b66 },
  };
  // the riders' arms (DESIGN.md §10.9): Azure, a lion rampant or; Gules, a bull passant argent, armed or
  const LIVERY = {
    lion: { field: 0x2f4f9a, lining: 0x22396f, charge: 0xe3b52f, accent: 0xb5322a },
    bull: { field: 0xb5322a, lining: 0x83251f, charge: 0xefe9dc, accent: 0xd9a92c },
  };
  const TACK = { leather: 0x553522, seat: 0x3e2719, iron: 0x8d969e, eye: 0x2b1d16 };

  // ---------- measurements ----------
  const BODYC = 0.96, L = 0.75, SEG = L / 2;
  const LEGX = 0.17, FORE_Z = 0.52, HIND_Z = -0.42, HIP_Y = L - BODYC;          // hip pivots in the body's frame
  const NECK_Y = 1.10, NECK_Z = 0.58, NECK_A = 0.52, NECK_L = 0.62, HEAD_A = 0.74;
  const SEAT_Y = 1.35, SEAT_Z = 0.10;
  // the caparison's rings: top edge on the back, the slit tops, the hem (fore panels flare a little wider at the hem so
  // that where a fore and a hind panel cross at a side slit, the fore one lies outside)
  const ZM = 0.10;
  const R0 = { y: 1.25, X: 0.235, Xf: 0.235, F: 0.66, B: -0.60, c: 0.10, g: 0 };
  const R1 = { y: 0.80, X: 0.315, Xf: 0.315, F: 0.94, B: -0.76, c: 0.13, g: 0 };
  const R3 = { y: 0.47, X: 0.365, Xf: 0.382, F: 1.02, B: -0.83, c: 0.14, g: 0.03 };
  const DAG = 0.065;

  // ---------- gaits: footfall offsets [hind L, hind R, fore L, fore R] as fractions of a stride, the share of it each
  // hoof is on the ground, the stride (metres per cycle), hoof lift, the dip in stance and the rise in flight ----------
  const GAITS = {
    walk: { off: [0, 0.5, 0.25, 0.75], duty: 0.6, stride: 0.95, speed: 1.3, lift: [0.07, 0.09], dip: 0.01, rise: 0 },
    trot: { off: [0, 0.5, 0.5, 0], duty: 0.4, stride: 1.45, speed: 3.0, lift: [0.11, 0.14], dip: 0.025, rise: 0.035 },
    // the gallop on the right lead: left hind, right hind, left fore, right fore, then all four in the air
    gallop: { off: [0, 0.12, 0.38, 0.5], duty: 0.3, stride: 2.2, speed: 5.5, lift: [0.12, 0.15], dip: 0.03, rise: 0.06 },
  };

  // a 4-sided tapered prism, flat faces front, back and sides (open-ended when open)
  function prism(rTop, rBot, h, open, depth) {
    const g = new THREE.CylinderGeometry(rTop * Math.SQRT2, rBot * Math.SQRT2, h, 4, 1, !!open);
    g.rotateY(Math.PI / 4);
    if (depth) g.scale(1, 1, depth);
    return g;
  }
  // a cone from a (its wide end) to b
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  function coneAB(a, b, r, segs) {
    const dir = V(0, 0, 0).subVectors(b, a), len = dir.length();
    const g = new THREE.ConeGeometry(r, len, segs, 1);
    g.rotateX(Math.PI);
    g.applyMatrix4(_m.compose(a.clone().add(b).multiplyScalar(0.5), _q.setFromUnitVectors(V(0, -1, 0), dir.normalize()), V(1, 1, 1)));
    return g;
  }
  function triGeo(pos) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }
  // push a triangle facing `out` (flipped if its winding faces the other way)
  function tri(arr, a, b, c, out) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) { const t = b; b = c; c = t; }
    arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }
  const outward = (p, sgn) => { const zc = clamp(p[2], -0.35, 0.5); const o = [p[0], 0, p[2] - zc]; return sgn < 0 ? o.map((v) => -v) : o; };

  // the four panels' plan points on a ring: 0 fore left, 1 hind left, 2 hind right, 3 fore right, going round
  function plan(R, j) {
    const g = R.g;
    if (j === 0) return [[g, R.F], [R.Xf - R.c, R.F], [R.Xf, R.F - R.c], [R.Xf, ZM + g]];
    if (j === 1) return [[R.X, ZM - g], [R.X, R.B + R.c], [R.X - R.c, R.B], [g, R.B]];
    if (j === 2) return [[-g, R.B], [-(R.X - R.c), R.B], [-R.X, R.B + R.c], [-R.X, ZM - g]];
    return [[-R.Xf, ZM + g], [-R.Xf, R.F - R.c], [-(R.Xf - R.c), R.F], [-g, R.F]];
  }
  const ring = (R, j) => plan(R, j).map(([x, z]) => [x, R.y, z]);
  // the hindquarter's flank (x) at height y, for the beasts painted on it
  const flankX = (y) => (y >= R1.y ? R0.X + (R0.y - y) / (R0.y - R1.y) * (R1.X - R0.X) : R1.X + (R1.y - y) / (R1.y - R3.y) * (R3.X - R1.X));

  // the beasts, drawn flat in a unit box (u forward toward the horse's head, v up), as quads and triangles
  const LION = [
    [[0.52, 1.10], [0.55, 0.88], [0.80, 0.84], [0.98, 0.93], [1.01, 1.06], [0.87, 1.12], [0.80, 1.23], [0.68, 1.16]],  // head, mane, ear
    [[0.30, 0.30], [0.52, 0.28], [0.80, 0.70], [0.80, 0.88], [0.54, 0.94], [0.38, 0.68]],   // the body, erect
    [[0.72, 0.78], [0.80, 0.70], [1.05, 0.88], [0.99, 0.97]],                               // the forelegs, clawing out
    [[0.64, 0.62], [0.70, 0.53], [0.98, 0.58], [0.97, 0.69]],
    [[0.30, 0.36], [0.48, 0.32], [0.42, 0.09], [0.52, 0.0], [0.22, 0.0]],                   // the hind leg it stands on
    [[0.44, 0.44], [0.52, 0.31], [0.78, 0.30], [0.76, 0.41]],                               // the other, raised
    [[0.28, 0.40], [0.36, 0.46], [0.22, 0.92], [0.12, 0.88]],                               // the tail, striking up,
    [[0.04, 0.86], [0.30, 0.94], [0.16, 1.12]],                                             // and its tuft
  ];
  const BULL = [
    [[0.12, 0.36], [0.82, 0.36], [0.86, 0.62], [0.72, 0.78], [0.30, 0.72], [0.12, 0.68]],   // the body, the hump
    [[0.80, 0.72], [0.98, 0.68], [1.05, 0.42], [0.92, 0.36], [0.80, 0.48]],                 // the head, lowered
    [[0.14, 0.40], [0.26, 0.40], [0.24, 0.0], [0.13, 0.0]],                                 // four legs, walking
    [[0.32, 0.40], [0.43, 0.40], [0.42, 0.0], [0.31, 0.0]],
    [[0.60, 0.40], [0.71, 0.40], [0.71, 0.0], [0.60, 0.0]],
    [[0.74, 0.40], [0.85, 0.40], [0.95, 0.16], [0.86, 0.10]],                               // one forefoot raised
    [[0.12, 0.66], [0.17, 0.60], [0.02, 0.28], [-0.03, 0.33]],                              // the tail and its tuft
    [[-0.07, 0.30], [0.08, 0.30], [0.0, 0.16]],
  ];
  const HORNS = [[[0.86, 0.71], [0.95, 0.69], [1.0, 0.90]], [[0.79, 0.72], [0.86, 0.72], [0.76, 0.90]]];

  function make(kit, rig, spec) {
    spec = spec || {};
    const P = window.FigureKit.P, M = window.Motion, D = P();
    const coat = COATS[spec.coat] || COATS.bay, liv = LIVERY[spec.livery] || LIVERY.lion;
    const C = Object.assign({}, coat, TACK, spec.col || {});
    const start = rig.pieces.length;
    const box = (nd, col, w, h, d, x, y, z, rot) => rig.box(nd, col, w, h, d, x, y, z, rot);

    const root = rig.node(null, 0, 0, 0);
    root.rotation.order = 'YXZ';
    // spec.back / spec.drop move the whole horse on a static node (the character sheet's face view only)
    const OFF = { y: -(spec.drop || 0), z: -(spec.back || 0) };
    const frame = OFF.y || OFF.z || spec.yaw0 ? rig.node(root, 0, OFF.y, OFF.z) : root;
    if (spec.yaw0) { frame.rotation.y = spec.yaw0; frame.updateMatrixWorld(true); }
    const body = rig.node(frame, 0, BODYC, 0);
    const by = (y) => y - BODYC;
    const f = { legs: [], knees: [], arms: [], elbows: [], ears: [], hooves: [], flaps: [], spec, rig };

    // the barrel (only its underside shows below the caparison)
    box(body, coat.body, 0.40, 0.50, 1.07, 0, by(0.97), 0.015);

    // the neck: a deep arched block leaning forward out of the caparison, the mane along its crest
    const neck = rig.node(body, 0, by(NECK_Y), NECK_Z);
    const d = V(0, Math.cos(NECK_A), Math.sin(NECK_A)), n = V(0, Math.sin(NECK_A), -Math.cos(NECK_A));
    const at = (along, back) => d.clone().multiplyScalar(along).addScaledVector(n, back || 0);
    let c = at(0.25);
    box(neck, coat.body, 0.27, NECK_L + 0.2, 0.33, c.x, c.y, c.z, [NECK_A, 0, 0]);
    c = at(0.34, 0.19);
    box(neck, coat.mane, 0.1, 0.62, 0.12, c.x, c.y, c.z, [NECK_A, 0, 0]);

    // the head: a long block angled down, the muzzle, the eyes on the upper corners, two ears
    const hp = at(NECK_L), head = rig.node(neck, hp.x, hp.y, hp.z);
    const dh = V(0, -Math.sin(HEAD_A), Math.cos(HEAD_A)), uh = V(0, Math.cos(HEAD_A), Math.sin(HEAD_A));
    const hat = (along, up, x) => dh.clone().multiplyScalar(along).addScaledVector(uh, up || 0).setX(x || 0);
    c = hat(0.2);
    box(head, coat.body, 0.26, 0.3, 0.5, c.x, c.y, c.z, [HEAD_A, 0, 0]);
    c = hat(0.5, -0.03);
    box(head, coat.muzzle, 0.21, 0.23, 0.27, c.x, c.y, c.z, [HEAD_A, 0, 0]);
    const ec = hat(0.08, 0.1), eyes = rig.node(head, 0, ec.y, ec.z);
    for (const s of [-1, 1]) rig.ball(eyes, kit.ball(4, 2), C.eye, 0.046, s * 0.126, 0, 0, null, [0, 0.6155, -Math.PI / 4]);
    for (const s of [-1, 1]) {
      c = hat(-0.03, 0.13, s * 0.075);
      const ear = rig.node(head, c.x, c.y, c.z);
      rig.piece(ear, new THREE.ConeGeometry(0.055, 0.18, 3), coat.body, 0, 0.08, 0, { r: [-0.2, Math.PI / 6, -s * 0.28] });
      f.ears.push(ear);
    }
    // the bridle: a headstall behind the eyes and a noseband round the muzzle
    c = hat(0.0);
    box(head, C.leather, 0.285, 0.325, 0.04, c.x, c.y, c.z, [HEAD_A, 0, 0]);
    c = hat(0.42, -0.03);
    box(head, C.leather, 0.235, 0.255, 0.045, c.x, c.y, c.z, [HEAD_A, 0, 0]);

    // the tail: raked back from the croup, clear of the caparison behind
    const tail = rig.node(body, 0, by(1.29), -0.6);
    rig.limb(tail, V(0, 0.05, 0.0), V(0, 0.07, -0.16), 0.06, 0.075, coat.mane, 4, true, 0.8);
    rig.limb(tail, V(0, 0.07, -0.14), V(0, -0.76, -0.32), 0.075, 0.055, coat.mane, 4, false, 0.8);

    // four legs on hip pivots, a joint at the knee (fore) or hock (hind); the cannons dark on a bay
    for (const fore of [false, true]) for (const sx of [1, -1]) {
      const hip = rig.node(body, sx * LEGX, HIP_Y, fore ? FORE_Z : HIND_Z), knee = rig.node(hip, 0, -SEG, 0);
      rig.piece(hip, prism(0.085, 0.065, SEG + 0.12, true, 1.15), coat.body, 0, -(SEG + 0.12) / 2 + 0.12, 0);
      box(knee, coat.lower, 0.115, SEG + 0.03, 0.13, 0, -SEG / 2 + 0.015, 0);
      f.hooves.push(rig.node(knee, 0, -SEG, 0));
      if (fore) { f.arms.push(hip); f.elbows.push(knee); } else { f.legs.push(hip); f.knees.push(knee); }
    }
    // hooves[] order: hind L, hind R, fore L, fore R

    // ---------- the caparison ----------
    // the flap pivots the panels' lower halves follow (0 fore L, 1 hind L, 2 hind R, 3 fore R)
    for (let j = 0; j < 4; j++) f.flaps.push(rig.node(body, 0, by(R3.y), 0));
    const flapLeg = [() => f.arms[0], () => f.legs[0], () => f.legs[1], () => f.arms[1]];
    const skinFor = (j) => (x, y) => {
      const w = clamp((R1.y - (y - OFF.y)) / (R1.y - R3.y), 0, 1);
      return [[body, 1 - w], [f.flaps[j], w]];
    };
    const sh = (p) => p;   // cloth is built in the horse's own frame
    for (let j = 0; j < 4; j++) {
      const a0 = ring(R0, j), a1 = ring(R1, j), a3 = ring(R3, j), cloth = [], lining = [];
      for (let s = 0; s < 3; s++) {
        for (const [A, B, arr, sgn] of [[a0, a1, cloth, 1], [a1, a3, cloth, 1], [a1, a3, lining, -1]]) {
          const p = A[s], q = A[s + 1], r = B[s + 1], t = B[s];
          const mid = [(p[0] + r[0]) / 2, 0, (p[2] + r[2]) / 2], o = outward(mid, sgn);
          tri(arr, sh(p), sh(q), sh(r), o); tri(arr, sh(p), sh(r), sh(t), o);
        }
        // the dagged edge: little tongues hanging from the hem, carrying on the cloth's slope
        const h0 = a3[s], h1 = a3[s + 1], u0 = a1[s], u1 = a1[s + 1];
        const len = Math.hypot(h1[0] - h0[0], h1[2] - h0[2]), nT = Math.max(1, Math.round(len / 0.17));
        for (let k = 0; k < nT; k++) {
          const L3 = (t) => [h0[0] + (h1[0] - h0[0]) * t, h0[1], h0[2] + (h1[2] - h0[2]) * t];
          const m = (k + 0.5) / nT, hm = L3(m), um = [u0[0] + (u1[0] - u0[0]) * m, u0[1], u0[2] + (u1[2] - u0[2]) * m];
          const dv = [hm[0] - um[0], hm[1] - um[1], hm[2] - um[2]], dl = Math.hypot(dv[0], dv[1], dv[2]);
          const tip = [hm[0] + dv[0] / dl * DAG, hm[1] + dv[1] / dl * DAG, hm[2] + dv[2] / dl * DAG];
          tri(cloth, sh(L3((k + 0.06) / nT)), sh(L3((k + 0.94) / nT)), sh(tip), outward(hm, 1));
        }
      }
      rig.geo(frame, triGeo(cloth), liv.field, skinFor(j));
      rig.geo(frame, triGeo(lining), liv.lining, skinFor(j));
    }
    // the cloth over the back, rising a little to the spine
    {
      const roof = [], top = [0, 1.31, 0.03];
      for (let j = 0; j < 4; j++) {
        const a0 = ring(R0, j);
        for (let s = 0; s < 3; s++) tri(roof, sh(top), sh(a0[s]), sh(a0[s + 1]), [0, 1, 0]);
      }
      rig.geo(frame, triGeo(roof), liv.field, () => [[body, 1]]);
    }
    // the rider's arms on the hindquarters, each side, facing the head
    {
      const lion = spec.livery !== 'bull', S = lion ? 0.44 : 0.46, zc = -0.33, yc = lion ? 0.9 : 0.92;
      for (const sx of [1, -1]) {
        const j = sx > 0 ? 1 : 2, parts = lion ? [[LION, liv.charge]] : [[BULL, liv.charge], [HORNS, liv.accent]];
        for (const [polys, col] of parts) {
          const arr = [];
          const pt = (u, v) => { const y = yc + (v - 0.55) * S; return sh([sx * (flankX(y) + 0.012), y, zc + (u - 0.5) * S]); };
          for (const poly of polys) for (let k = 1; k < poly.length - 1; k++) {
            tri(arr, pt(...poly[0]), pt(...poly[k]), pt(...poly[k + 1]), [sx, 0, 0]);
          }
          rig.geo(frame, triGeo(arr), col, skinFor(j));
        }
      }
    }

    // ---------- the saddle: a seat with a high cantle wrapping the rider's back, a front bow, stirrups ----------
    box(body, C.seat, 0.40, 0.07, 0.41, 0, by(SEAT_Y - 0.035), SEAT_Z + 0.005);
    box(body, C.leather, 0.42, 0.27, 0.065, 0, by(1.47), -0.11, [-0.22, 0, 0]);
    box(body, C.leather, 0.24, 0.16, 0.07, 0, by(1.41), 0.31, [0.28, 0, 0]);
    for (const sx of [1, -1]) {
      rig.limb(body, V(sx * 0.215, by(1.31), 0.14), V(sx * 0.322, by(0.995), 0.14), 0.016, 0.016, C.leather, 3, true);
      const g = new THREE.CylinderGeometry(0.05, 0.05, 0.085, 3, 1, true);
      g.rotateX(Math.PI / 2);
      g.rotateZ(Math.PI);
      rig.piece(body, g, C.iron, sx * 0.33, by(0.955), 0.14);
    }
    // the seat pivot for a rider
    const seat = rig.node(body, 0, by(SEAT_Y), SEAT_Z);

    // the reins: from the bit up to above the front bow, following the head at one end and the body at the other
    root.updateMatrixWorld(true);
    for (const sx of [1, -1]) {
      const a = head.localToWorld(hat(0.47, -0.09, sx * 0.118)), b = frame.localToWorld(V(sx * 0.07, 1.47, 0.36));
      const ab = V(0, 0, 0).subVectors(b, a), L2 = ab.lengthSq();
      const g = kit.limbGeo(frame.worldToLocal(a.clone()), frame.worldToLocal(b.clone()), 0.014, 0.014, 3, true);
      rig.geo(frame, g, C.leather, (x, y, z) => {
        const t = clamp(((x - a.x) * ab.x + (y - a.y) * ab.y + (z - a.z) * ab.z) / L2, 0, 1);
        return [[head, 1 - t], [body, t]];
      });
    }

    f.eyes = eyes;
    f.range = [start, rig.pieces.length];
    // H sets the sheet's layout and the baked shade (darker toward the ground); the real height is 1.9 to the ears
    f.H = 3.4; f.height = 1.9; f.chinY = -5;
    f.shadowR = 1.0;
    f.root = root; f.body = body; f.neck = neck; f.head = head; f.tail = tail; f.seat = seat;
    f.saddle = { x: 0, y: SEAT_Y, z: SEAT_Z };
    f.headTop = () => head.localToWorld(V(0, 0.28, 0.05));
    f.base = {};

    // every key is a delta from P()'s defaults
    const dl = (p, k) => p[k] - D[k];
    const flapRest = f.flaps.map((fl) => fl.position.clone());
    f.pose = (p) => {
      body.position.y = BODYC + dl(p, 'y');
      body.rotation.set(dl(p, 'lean'), dl(p, 'twist'), dl(p, 'roll'));
      neck.rotation.x = dl(p, 'at0');
      head.rotation.set(dl(p, 'hx'), dl(p, 'hy'), dl(p, 'hz'));
      for (let i = 0; i < 2; i++) {
        f.legs[i].rotation.x = -dl(p, 'lf' + i);
        f.knees[i].rotation.x = -dl(p, 'k' + i);
        f.arms[i].rotation.x = -dl(p, 'af' + i);
        f.elbows[i].rotation.x = dl(p, 'e' + i);
        f.ears[i].rotation.x = dl(p, 'ao' + i);
      }
      tail.rotation.set(Math.max(0, dl(p, 'lo0')), 0, dl(p, 'at1'));
      // the caparison's panels slide with their legs, and stream back at speed
      const trail = dl(p, 'lo1');
      for (let j = 0; j < 4; j++) {
        const leg = flapLeg[j](), sw = Math.sin(-leg.rotation.x);
        f.flaps[j].position.set(flapRest[j].x, flapRest[j].y + 0.04 * Math.max(0, trail), flapRest[j].z + 0.11 * sw - 0.06 * trail);
      }
    };

    // ---------- the gaits: each hoof planted on the ground through its stance while the body passes over it, then
    // lifted and swung forward; the legs solved to reach the hooves, the body's height and pitch to fit them ----------
    const xs = [0, 0, 0, 0], hs = [0, 0, 0, 0], vs = [0, 0, 0, 0], st = [0, 0, 0, 0];
    const LZ = [HIND_Z, HIND_Z, FORE_Z, FORE_Z];
    function makeGait(G, name) {
      const fn = (ph, amt, base) => {
        const p = P(Object.assign({}, f.base, base || {}));
        const u = ph / TAU, X = G.duty * G.stride * amt / 2;
        const Lr = L * (1 - 0.015 * amt), H0 = Math.sqrt(Math.max(0.05, Lr * Lr - X * X));
        for (let i = 0; i < 4; i++) {
          const v = frac(u - G.off[i]);
          vs[i] = v;
          if (v < G.duty) { const k = v / G.duty; xs[i] = X * (1 - 2 * k); hs[i] = 0; st[i] = Math.sin(Math.PI * k); }
          else {
            const k = (v - G.duty) / (1 - G.duty);
            xs[i] = X * (-1 + 2 * smooth(k)); hs[i] = G.lift[i < 2 ? 0 : 1] * amt * Math.sin(Math.PI * Math.pow(k, 0.8)); st[i] = -1;
          }
        }
        // each pair's hip height: dipping as a leg takes the weight, rising in a flight when neither hoof is down
        const pairH = (a, b) => {
          if (st[a] >= 0 || st[b] >= 0) return H0 - G.dip * amt * Math.max(st[a], st[b], 0);
          const s0 = Math.min(vs[a] - G.duty, vs[b] - G.duty), s1 = Math.min(1 - vs[a], 1 - vs[b]);
          return H0 + G.rise * amt * Math.sin(Math.PI * s0 / Math.max(1e-6, s0 + s1));
        };
        const Hh = pairH(0, 1), Hf = pairH(2, 3);
        const sn = clamp((Hh - Hf) / (FORE_Z - HIND_Z), -0.3, 0.3), th = Math.asin(sn), cs = Math.cos(th);
        const BY = Hf - HIP_Y * cs + FORE_Z * sn;
        p.y = D.y + BY - BODYC;
        p.lean = D.lean + th;
        for (let i = 0; i < 4; i++) {
          const yH = BY + HIP_Y * cs - LZ[i] * sn, zH = HIP_Y * sn + LZ[i] * cs;
          const dz = LZ[i] + xs[i] - zH, dy = hs[i] + 0.004 - yH;
          const dd = Math.min(L * 0.9999, Math.hypot(dz, dy)), g = Math.atan2(dz, -dy), b = Math.acos(dd / L);
          const fore = i >= 2, j = i & 1;
          if (fore) { p['af' + j] = D['af' + j] + g + b + th; p['e' + j] = D['e' + j] + 2 * b; }
          else { p['lf' + j] = D['lf' + j] + g - b + th; p['k' + j] = D['k' + j] + 2 * b; }
        }
        const w = u * TAU;
        if (name === 'walk') {
          p.at0 += 0.06 * amt * Math.sin(2 * w + 1.2); p.hx += 0.07 * amt * Math.sin(2 * w + 1.8);
          p.hz += 0.03 * amt * Math.sin(w); p.roll += 0.02 * amt * Math.cos(w);
          p.at1 += 0.18 * amt * Math.sin(w + 1); p.lo0 += 0.05 * amt;
        } else if (name === 'trot') {
          p.at0 += 0.03 * amt * Math.sin(2 * w + 0.5); p.hx += 0.04 * amt * Math.sin(2 * w + 1.0);
          p.at1 += 0.1 * amt * Math.sin(w); p.lo0 += 0.25 * amt + 0.05 * amt * Math.sin(2 * w); p.lo1 += 0.3 * amt;
        } else {
          // the gallop: the neck reaches out and pumps once a stride, ears pricked, tail and caparison streaming
          p.at0 += amt * (0.22 + 0.13 * Math.sin(w - 0.4)); p.hx += amt * (-0.12 + 0.1 * Math.sin(w + 0.3));
          p.ao0 -= 0.1 * amt; p.ao1 -= 0.1 * amt;
          p.lo0 += amt * (0.75 + 0.1 * Math.sin(w + 1.5)); p.at1 += 0.06 * amt * Math.sin(2 * w);
          p.lo1 += amt * (1 + 0.25 * Math.sin(w + 2.0));
        }
        p.wk = amt;
        return p;
      };
      return { gait: fn, stride: G.stride, speed: G.speed, name };
    }
    f.gaits = { walk: makeGait(GAITS.walk, 'walk'), trot: makeGait(GAITS.trot, 'trot'), gallop: makeGait(GAITS.gallop, 'gallop') };
    f.gait = f.gaits.walk.gait; f.stride = GAITS.walk.stride;

    // follow-through on the head, neck, ears and tail, none on the legs and body (the hooves must stay planted)
    f.follow = M.lag({ hx: 0.16, hy: 0.3, hz: 0.18, at0: 0.2, at1: 0.3, ao0: 0.06, ao1: 0.06,
      af0: 1e-4, af1: 1e-4, e0: 1e-4, e1: 1e-4, lean: 1e-4, twist: 1e-4, roll: 1e-4 });
    f.seed = rig.figures.length * 2.3 + 0.7;
    f.floor = null;
    f.set = (s) => {
      if (s.hide) { root.scale.setScalar(1e-4); return; }
      root.scale.setScalar(1);
      const y = s.y !== undefined && s.y !== null ? s.y : f.floor ? f.floor(s.x, s.z) : 0;
      root.position.set(s.x, y + (s.lift || 0), s.z);
      root.rotation.set(s.pitch || 0, s.yaw, 0);
      f.pose(f.follow(s.pose || P(f.base)));
    };
    f.pose(P());
    rig.figures.push(f);
    return f;
  }

  // ---------- poses (static) and the moving versions ----------
  const rel = (o) => { const p = window.FigureKit.P(), r = {}; for (const k in o) r[k] = p[k] + o[k]; return r; };
  const POSES = {
    stand: {},
    toss: { at0: -0.32, hx: -0.4, ao0: 0.25, ao1: 0.25, lo0: 0.35 },
    stamp: { af1: 0.42, e1: 1.25, at0: -0.08, hx: -0.1 },
  };
  const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
  const win = (s, a, b, e) => window.Motion.win(s, a, b, e);
  const addRel = (p, o, w) => { const D = window.FigureKit.P(); for (const k in o) p[k] += o[k] * w; return p; };
  // an ear flicks now and then, the tail swishes
  function flicks(p, t, seed) {
    const T = 3.1, u = t + seed * 5, nn = Math.floor(u / T), r = hash(nn, seed);
    const g = win(u - nn * T - r * 1.8, 0, 0.5, 0.2);
    if (r < 0.5) p.ao0 += 0.7 * g; else p.ao1 += 0.7 * g;
    p.at1 += 0.28 * Math.sin(t * 1.9 + seed) * (0.6 + 0.4 * Math.sin(t * 0.37 + seed * 2));
    return p;
  }
  const anim = {
    // standing: breathing, a slow look about, ear and tail flicks, the weight off one hind foot now and then
    stand(t, seed, base) {
      const p = window.FigureKit.P(Object.assign({}, base || {}));
      p.y += 0.004 * Math.sin(t * 1.5 + seed);
      p.hy += 0.3 * Math.sin(t * 0.17 + seed) * Math.sin(t * 0.09 + seed * 2);
      p.hx += 0.06 * Math.sin(t * 0.29 + seed);
      p.at0 += 0.05 * Math.sin(t * 0.23 + seed * 3);
      const ws = Math.max(0, Math.sin(t * 0.15 + seed * 5)) ** 2;
      p.k0 += 0.22 * ws; p.lf0 += 0.06 * ws; p.roll -= 0.012 * ws;
      return flicks(p, t, seed);
    },
    // u 0..1 over about 1.6 s: the head comes up, shakes side to side, and settles
    toss(u, seed, base) {
      const p = window.FigureKit.P(Object.assign({}, base || {}));
      const w = win(u, 0, 1, 0.3);
      addRel(p, POSES.toss, w);
      p.hy += 0.35 * w * Math.sin(u * TAU * 2.5 + (seed || 0));
      p.hz += 0.2 * w * Math.sin(u * TAU * 2.5 + (seed || 0) + 1.2);
      return p;
    },
    // the tap moment, u 0..1 over about 3 s: a head toss, two stamps of the right forefoot, a big swish of the tail
    tap(u, seed, base) {
      const p = anim.toss(clamp(u / 0.5, 0, 1), seed, base);
      for (const [a, b] of [[0.44, 0.7], [0.68, 0.94]]) {
        const k = clamp((u - a) / (b - a), 0, 1), lift = k < 0.62 ? smooth(k / 0.62) : 1 - smooth((k - 0.62) / 0.3);
        addRel(p, POSES.stamp, lift);
        p.y -= 0.012 * lift;
      }
      p.at1 += 0.55 * Math.sin(u * TAU * 1.5) * win(u, 0.1, 1, 0.2);
      p.lo0 += 0.25 * win(u, 0.1, 1, 0.2);
      return p;
    },
  };

  window.CHARACTERS.horse = {
    name: "A knight's horse",
    note: 'caparison in the rider\'s arms (&livery=lion|bull), bay or grey (&coat=); saddle seat 1.35 m up at z 0.10',
    make,
    anim,
    gaits: GAITS,
    build(ctx, B, kit, rig) {
      const q = new URLSearchParams(location.search), view = q.get('view'), face = view === 'face';
      // the sheet's face camera sits 3.2 m out for a human head: set the horse back and down so its head is there
      const num = (k, v) => (q.get(k) !== null ? parseFloat(q.get(k)) : v);
      const h = make(kit, rig, { coat: q.get('coat') || 'bay', livery: q.get('livery') || 'lion', back: num('back', face ? 1.12 : 0), drop: num('drop', face ? 0.12 : 0), yaw0: num('yaw0', 0) });
      if (face) h.H = 1.6;
      (window.__horses = window.__horses || []).push(h);   // for checks from the sheet
      // &anim= shows a gait or a moment in place on any still view (&ph= freezes a gait's phase, 0..1)
      const an = q.get('anim'), ph0 = parseFloat(q.get('ph'));
      if (an && view !== 'walk') {
        const lagged = h.follow, P = window.FigureKit.P;
        h.follow = () => {
          const t = performance.now() / 1000;
          let p;
          if (h.gaits[an]) { const G = h.gaits[an]; p = G.gait(isNaN(ph0) ? t * G.speed / G.stride * TAU : ph0 * TAU, 1); }
          else if (an === 'tap') p = anim.tap(isNaN(ph0) ? (t % 3.6) / 3 : ph0, 1);
          else p = anim.stand(t, h.seed);
          return isNaN(ph0) ? lagged(p) : p;
        };
      }
      return h;
    },
    poses: { stand: rel(POSES.stand), toss: rel(POSES.toss), stamp: rel(POSES.stamp) },
  };
})();
