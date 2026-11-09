// siegeworks.js: the Lion siegeworks and everything that flies (DESIGN.md 2, 5, 7, 9; decisions 9, 10, 12;
// research.md 4c, 4e, 4f, 6a, 6c, 16).
//   T1, the great trebuchet (the Warwick look, picture 7): two triangle frames on a timber base, two treadwheels, a
//     hinged box of earth, a 12 m arm and a rope sling lying in a trough. Wound down 12-21.5 and 42-51.5, shoots at
//     SIEGE.times.treb (26.5 short into the moat, 56.0 onto the south-west tower's battlements).
//   T2, the smaller trebuchet with a capstan: shoots at 40.5 (the curtain shrugs it off), is wound half down again
//     60-75, and at 110 the Bull knights cut its ropes: the arm drops slack and stays so until the mist.
//   Five Lion guns on spots.LION_GUNS (research 16: dark hoop-bound wrought-iron bombards lying in heavy timber beds
//     staked to the ground, wedges, a hinged timber shutter; two small bronze guns on short beds; a brazier, water
//     buckets, stone balls), five small Bull guns on the castle (spots.BULL_GUNS). Each shot of SIEGE.times.gunShots:
//     shutter up, flash, white smoke drifting east, the ball to `hit`, dust and chips (Lion) or earth (Bull).
//   The arrow volleys (SIEGE.times.volleys): instanced arrows arcing from behind the pavises and from the walls,
//     landing `flight` s later on the wall face, the moat, the ground and the pavises. Never near anyone.
//   The ram (picture 10; Vegetius IV.14): an A-framed shed on four solid wheels, plank roof under hides, an
//     iron-headed log on ropes. Follows SIEGE.ramPath 68-88, swings at each blow, takes three stones on its roof and
//     caves in at 100.
//   The ten pavises, and the Lion camp (research 4f): tents and a striped pavilion, banners, wagons, a horse line,
//     cooking fires, barrels and sacks, piles of stones and balls, lanterns at night.
//
// Shared with people.js and armies.js on ctx.siege (all pure functions of cycle time, or the current values):
//   ctx.siege.t1 = { x, y, z, yaw, axle, wheels: [{x,y,z}, {x,y,z}], wheelAxis, treadR, wheelAngle, wheelAngleAt(ct),
//                    wheelSpeedAt(ct) (rad/s), winds, loads, triggers, pouch (current), pile, catchAt }
//   ctx.siege.t2 = { x, y, z, yaw, axle, capstan: {x,y,z}, barR, capstanAngle, capstanAngleAt(ct), capstanSpeedAt(ct),
//                    winds, loads, triggers, cutAt, pile, pouch }
//   ctx.siege.ram = { x, y, z, yaw, pitch, s, speed, swing, broken, at(ct, out) }   (the shed's centre on the ground)
//   ctx.siege.guns = { lion: [{x,y,z,yaw,big,muzzle,shots,shutter, shutterAt(ct)}], bull: [...], brazier }
//   ctx.siege.archers = { lion: [[x,y,z]...], bull: [[x,y,z]...] }   where the arrows leave from
//   ctx.siege.camp = { horseLine: {x0, x1, z}, fires: [[x,z]...], tents: [...] }
//
// Draws: the static world (one vertex-coloured material, merged), one skinned mesh for every moving part (36 rigid
// bones, flags fluttering in its shader), smoke and dust (instanced), stones, balls and bits (instanced), arrows
// (instanced), muzzle flashes, flames. 7 in all.
(function () {
  'use strict';
  const THREE = window.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
  const easeIn = (x) => { const c = clamp01(x); return c * c; };
  const easeOut = (x) => { const c = clamp01(x); return 1 - (1 - c) * (1 - c); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const win = (t, a, b) => clamp01((t - a) / (b - a));

  // colours (DESIGN.md 1; research 4e, 16)
  const COL = {
    oak: 0x7a5a3a, oakDark: 0x5e4630, oakLight: 0x94724c, iron: 0x3b3936, ironLight: 0x5c5852, rope: 0xc9b282,
    canvas: 0xe9dfc8, blue: 0x2f4f9a, gold: 0xe3b52f, claw: 0xb5322a, bronze: 0xb4884a, stone: 0x9d978b,
    stoneLight: 0xb8b09c, earth: 0x6e5a40, hide: 0xa9845a, hay: 0xd2bb68, sack: 0xcdb894, bore: 0x161412,
    door: 0x3a3026, ash: 0x4a4440, hideLight: 0xc9a67a, water: 0x6f8f88, glass: 0xe8c070,
  };
  const MIST_RESET = 169;   // under the full mist (SIEGE.times.mistFull 164-174) the engines and the ram are put back
  const CLEAR_AT = 166;     // and the stuck arrows, the lying balls and stones go
  const T2_UP = [165, 173]; // T2's arm is winched back upright under the mist

  let ctx, S, TM, spots;
  const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _s = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
  const _c = new THREE.Color();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---------- geometry: pieces with baked vertex colours, merged into one geometry per builder ----------
  // A builder collects triangles in world space (B.M places the current object), shaded darker toward the object's
  // base. A skinned builder also tags each vertex with its bone (B.b), and flags with their flutter (aFlap).
  function builder(skinned) {
    return { pos: [], col: [], bone: [], flap: [], skinned, M: new THREE.Matrix4(), shadeH: 3, lo: 0.66, b: 0, shade: null };
  }
  function frame(B, x, y, z, yaw) { B.M.compose(_v.set(x, y, z), _q.setFromAxisAngle(UP, yaw || 0), _s.set(1, 1, 1)); return B.M; }
  function X(x, y, z, rx, ry, rz, sx, sy, sz) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
      new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? (sx === undefined ? 1 : sx) : sy, sz === undefined ? (sx === undefined ? 1 : sx) : sz));
  }
  const linCache = new Map();
  const L = (hex) => { let c = linCache.get(hex); if (!c) { c = ctx.lin(hex); linCache.set(hex, c); } return c; };
  // put(B, geometry, colour, { m: local matrix, t: tint, col(cx, cy, cz): colour per face, sh: false (no shade),
  //   flap: { n: [x,y,z] world normal, w(lx, ly, lz) → 0..1 } })
  function put(B, geo, hex, opt) {
    opt = opt || {};
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (opt.m) g.applyMatrix4(opt.m);
    const lp = g.attributes.position.array.slice();
    g.applyMatrix4(B.M);
    const wp = g.attributes.position.array, n = wp.length / 3, tint = opt.t || 1;
    for (let i = 0; i < n; i += 3) {
      const cx = (lp[i * 3] + lp[i * 3 + 3] + lp[i * 3 + 6]) / 3, cy = (lp[i * 3 + 1] + lp[i * 3 + 4] + lp[i * 3 + 7]) / 3, cz = (lp[i * 3 + 2] + lp[i * 3 + 5] + lp[i * 3 + 8]) / 3;
      const c = L(opt.col ? opt.col(cx, cy, cz) : hex);
      const j = 0.95 + 0.1 * ctx.hash(Math.round(cx * 50), Math.round(cy * 50), Math.round(cz * 50), 7);
      for (let k = 0; k < 3; k++) {
        const vi = i + k, y = lp[vi * 3 + 1];
        const sh = opt.sh === false ? 1 : B.shade ? B.shade(lp[vi * 3], y, lp[vi * 3 + 2]) : B.lo + (1 - B.lo) * clamp01(y / B.shadeH);
        const f = sh * j * tint;
        B.pos.push(wp[vi * 3], wp[vi * 3 + 1], wp[vi * 3 + 2]);
        B.col.push(c.r * f, c.g * f, c.b * f);
        if (B.skinned) {
          B.bone.push(B.b);
          if (opt.flap) { const w = opt.flap.w(lp[vi * 3], y, lp[vi * 3 + 2]); B.flap.push(opt.flap.n[0], opt.flap.n[1], opt.flap.n[2], w); }
          else B.flap.push(0, 0, 0, 0);
        }
      }
    }
  }
  function finish(B) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    if (B.skinned) {
      const n = B.bone.length, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = B.bone[i]; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      g.setAttribute('aFlap', new THREE.Float32BufferAttribute(B.flap, 4));
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
  const box = (w, h, d, a, b, c) => new THREE.BoxGeometry(w, h, d, a || 1, b || 1, c || 1);
  const cylX = (r, len, seg, open) => new THREE.CylinderGeometry(r, r, len, seg || 8, 1, !!open).rotateZ(PI / 2);
  const cylZ = (rF, rB, len, seg, open) => new THREE.CylinderGeometry(rF, rB, len, seg || 8, 1, !!open).rotateX(PI / 2);
  const rock = (r, seed, amt) => ctx.jitterGeo(new THREE.IcosahedronGeometry(r, 0), (amt === undefined ? 0.35 : amt) * r, seed);
  // a square timber from a to b (object frame), w thick
  function beam(B, a, b, w, hex, opt) {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
    const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1));
    if (opt && opt.m) m.premultiply(opt.m);
    put(B, box(w, len, (opt && opt.d) || w), hex, Object.assign({}, opt, { m }));
  }

  // ---------- the lion rampant (decision 9: gold on blue, red claws), a flat shape facing +z, about 1 m tall ----------
  const LION = [[-0.15, 0.48], [-0.33, 0.41], [-0.31, 0.31], [-0.44, 0.31], [-0.47, 0.19], [-0.3, 0.18], [-0.45, 0.06], [-0.41, -0.03], [-0.22, 0.03],
    [-0.13, -0.12], [-0.31, -0.21], [-0.35, -0.34], [-0.2, -0.3], [-0.07, -0.23], [-0.09, -0.48], [0.08, -0.48], [0.1, -0.3], [0.2, -0.18], [0.33, -0.1],
    [0.39, 0.1], [0.47, 0.3], [0.37, 0.33], [0.31, 0.13], [0.23, 0.05], [0.1, 0.22], [0.03, 0.4]];
  const CLAWS = [[-0.47, 0.25], [-0.45, 0.0], [-0.36, -0.36]];
  let lionGeo = null, clawGeo = null;
  function lionShapes() {
    if (lionGeo) return;
    lionGeo = new THREE.ShapeGeometry(new THREE.Shape(LION.map(([x, y]) => new THREE.Vector2(x, y))));
    const tris = [];
    for (const [x, y] of CLAWS) tris.push(new THREE.Shape([new THREE.Vector2(x - 0.05, y - 0.03), new THREE.Vector2(x + 0.04, y - 0.04), new THREE.Vector2(x + 0.0, y + 0.05)]));
    clawGeo = new THREE.ShapeGeometry(tris);
  }
  // the lion on a surface: its own frame m (the lion stands in its x-y plane and faces +z), size s
  function lion(B, m, s, opt) {
    lionShapes();
    put(B, lionGeo, COL.gold, Object.assign({ m: new THREE.Matrix4().multiplyMatrices(m, X(0, 0, 0, 0, 0, 0, s, s, 1)), sh: false }, opt));
    put(B, clawGeo, COL.claw, Object.assign({ m: new THREE.Matrix4().multiplyMatrices(m, X(0, 0, 0.004, 0, 0, 0, s, s, 1)), sh: false }, opt));
  }

  // =====================================================================================================
  // THE TREBUCHETS (research 6a: Vemming Hansen's and Warwick's machines; Villard's hopper of earth)
  // Engine frame: +z toward the target, x across, y up, origin on the ground under the axle.
  // The arm's angle phi: 0 hangs straight up (the box down); positive tips the long arm back (-z) and down.
  // =====================================================================================================
  const T1 = {
    key: 't1', x: -22, z: 44, H: 7.0, L: 9.6, Sh: 2.4, R: 5.5, hw: 1.5, len: 5.5, th: 0.4, out: 3.1,
    box: { hang: 0.55, w: 2.3, h: 2.1, d: 2.0 }, wheel: { r: 2.4, x: 2.7, y: 2.55, z: -3.4, post: 3.5 },
    stoneR: 0.42, lift: 5.5, D: 0.75, apex: 9,
    winds: [[12, 21.5], [42, 51.5]], loads: [22.5, 52.5], triggers: [26.5, 56.0],
  };
  const T2 = {
    key: 't2', x: 24, z: 46, H: 5.0, L: 6.6, Sh: 1.7, R: 4.0, hw: 1.1, len: 4.0, th: 0.32, out: 2.2,
    box: { hang: 0.42, w: 1.6, h: 1.4, d: 1.4 }, capstan: { z: -8.6, bar: 1.7 },
    stoneR: 0.32, lift: 3.6, D: 0.65, apex: 6,
    winds: [[28, 37], [60, 75]], loads: [38], triggers: [40.5], cutAt: 110, halfPhi: 70 * PI / 180,
  };
  const A1 = 45 * PI / 180, A2 = 62 * PI / 180, B_REL = -300 * PI / 180, B_HANG = -PI / 2 - TAU;
  const WHEEL_TURN = 7 * PI / 8;      // per winding: two windings make 7/4 pi, a multiple of the wheel's 8-fold symmetry
  const CAP_TURNS = [3 * PI, 2 * PI]; // the capstan per winding: 5 pi in all, a multiple of its four bars' symmetry

  function prepTreb(E) {
    E.y = ctx.groundY(E.x, E.z);
    if (E.key === 't2') E.y = (ctx.groundY(E.x, E.z) + 0.5 * (ctx.groundY(E.x + Math.sin(E.yaw) * 4, E.z + Math.cos(E.yaw) * 4) + ctx.groundY(E.x - Math.sin(E.yaw) * 4, E.z - Math.cos(E.yaw) * 4))) / 2;
    E.M = new THREE.Matrix4().compose(new THREE.Vector3(E.x, E.y, E.z), new THREE.Quaternion().setFromAxisAngle(UP, E.yaw), new THREE.Vector3(1, 1, 1));
    E.tipY0 = E.key === 't1' ? 1.2 : 0.9;                              // the arm's tip, caught at the bottom
    E.phiC = Math.acos((E.tipY0 - E.H) / E.L);
    const phiL = Math.acos((E.lift - E.H) / E.L);
    E.uLift = Math.sqrt((E.phiC - phiL) / (E.phiC + A1));
    E.bLift = -Math.asin((E.lift - 0.5) / E.R);
    E.cur = { phi: 0, psi: 0, lean: 0, roll: 0 };
    E.pouch = new THREE.Vector3(); E.tip = new THREE.Vector3(); E.shortEnd = new THREE.Vector3();
    E.armM = new THREE.Matrix4();
  }
  // the arm released from phiC at s = 0: it whips over to -A1 in D seconds, swings on to -A2, and settles
  function releasePhi(E, s) {
    if (s < E.D) { const u = s / E.D; return E.phiC - (E.phiC + A1) * u * u; }
    const s2 = s - E.D;
    if (s2 < 0.15) return -A1 - (A2 - A1) * easeOut(s2 / 0.15);
    const s3 = s2 - 0.15;
    return -A2 * Math.exp(-1.1 * s3) * Math.cos(2.5 * s3);
  }
  function boxSwing(s) { return s < 0 ? 0 : 0.22 * Math.exp(-0.8 * s) * Math.sin(2.4 * s); }
  // T1's state at cycle time ct: the arm, the box's swing, the wheels, and what the sling does
  function t1State(ct, st) {
    const E = T1, [w1, w2] = E.winds, [r1, r2] = E.triggers;
    st.lean = 0; st.roll = 0; st.psi = 0; st.mode = 'rest'; st.s = 0; st.fall = 0;
    if (ct < w1[0]) st.phi = 0;
    else if (ct < w1[1]) st.phi = E.phiC * smooth(win(ct, w1[0], w1[1]));
    else if (ct < r1) st.phi = E.phiC;
    else if (ct < w2[0]) { st.phi = releasePhi(E, ct - r1); st.psi = boxSwing(ct - r1); st.mode = 'release'; st.s = ct - r1; }
    else if (ct < w2[1]) st.phi = E.phiC * smooth(win(ct, w2[0], w2[1]));
    else if (ct < r2) st.phi = E.phiC;
    else { st.phi = releasePhi(E, ct - r2); st.psi = boxSwing(ct - r2); st.mode = 'release'; st.s = ct - r2; }
    return st;
  }
  const t1Wheel = (ct) => WHEEL_TURN * (smooth(win(ct, T1.winds[0][0], T1.winds[0][1])) + smooth(win(ct, T1.winds[1][0], T1.winds[1][1])));
  const dsmooth = (ct, a, b) => { const u = (ct - a) / (b - a); return u <= 0 || u >= 1 ? 0 : 6 * u * (1 - u) / (b - a); };
  const t1WheelSpeed = (ct) => WHEEL_TURN * (dsmooth(ct, T1.winds[0][0], T1.winds[0][1]) + dsmooth(ct, T1.winds[1][0], T1.winds[1][1]));
  const t2Cap = (ct) => CAP_TURNS[0] * smooth(win(ct, T2.winds[0][0], T2.winds[0][1])) + CAP_TURNS[1] * smooth(win(ct, T2.winds[1][0], T2.winds[1][1]));
  const t2CapSpeed = (ct) => CAP_TURNS[0] * dsmooth(ct, T2.winds[0][0], T2.winds[0][1]) + CAP_TURNS[1] * dsmooth(ct, T2.winds[1][0], T2.winds[1][1]);
  function t2State(ct, st) {
    const E = T2, [w1, w2] = E.winds, r1 = E.triggers[0], cut = E.cutAt;
    st.lean = 0; st.roll = 0; st.psi = 0; st.mode = 'rest'; st.s = 0; st.fall = 0; st.box = 0;
    if (ct >= T2_UP[1] || ct < w1[0]) st.phi = 0;
    else if (ct >= T2_UP[0]) {
      // put back in the night mist: the arm is winched slowly upright (its top shows above the mist, so it never
      // jumps), the sling hangs from it again, and the box is lifted back onto its hinge under cover at the end
      const k = smooth(win(ct, T2_UP[0], T2_UP[1]));
      st.phi = 2.37 * (1 - k); st.lean = 0.2 * (1 - k); st.mode = 'restore';
      st.box = 1 - smooth(win(ct, T2_UP[1] - 1.1, T2_UP[1] - 0.1));
    }
    else if (ct < w1[1]) st.phi = E.phiC * smooth(win(ct, w1[0], w1[1]));
    else if (ct < r1) st.phi = E.phiC;
    else if (ct < w2[0]) { st.phi = releasePhi(E, ct - r1); st.psi = boxSwing(ct - r1); st.mode = 'release'; st.s = ct - r1; }
    else if (ct < w2[1]) st.phi = E.halfPhi * smooth(win(ct, w2[0], w2[1]));
    else if (ct < cut) st.phi = E.halfPhi;
    else {
      // the ropes are cut (Froissart, Hennebont: "broke down ... this large machine"): the box drops off its hinge
      // into the frame, and the freed arm falls back and lies askew across the catch, away from the knights in front
      const s = ct - cut, PHI_DOWN = 2.37;
      if (s < 0.1) st.phi = E.halfPhi;
      else if (s < 1.2) st.phi = E.halfPhi + (PHI_DOWN - E.halfPhi) * easeIn((s - 0.1) / 1.1);
      else st.phi = PHI_DOWN - 0.07 * Math.exp(-3 * (s - 1.2)) * Math.abs(Math.sin(9 * (s - 1.2)));
      st.lean = 0.2 * smooth(win(ct, cut + 0.2, cut + 1.2));
      st.box = easeIn(win(ct, cut, cut + 0.55));
      st.mode = 'cut'; st.s = s; st.fall = easeIn(win(ct, cut + 0.1, cut + 0.75));
    }
    return st;
  }
  // the arm's matrix (engine local), its tip and short end
  function armLocal(E, st) {
    E.armM.makeTranslation(0, E.H, 0);
    if (st.lean) E.armM.multiply(_m.makeRotationZ(st.lean));
    E.armM.multiply(_m.makeRotationX(-st.phi));
    E.tip.set(0, E.L, 0).applyMatrix4(E.armM);
    E.shortEnd.set(0, -E.Sh, 0).applyMatrix4(E.armM);
  }
  // the pouch (engine local) for the tip at (ty, tz): hanging below it, or lying along the trough when it's low
  function pouchRest(E, ty, tz, out) {
    const R = E.R, floor = 0.5;
    if (ty - R > floor) { out.y = ty - R; out.z = tz; }
    else { const dy = ty - floor; out.y = floor; out.z = tz + Math.sqrt(Math.max(0, R * R - dy * dy)); }
    return out;
  }
  const _p = { y: 0, z: 0 };
  function pouchLocal(E, st, out) {
    const ty = E.tip.y, tz = E.tip.z;
    out.x = E.tip.x;
    if (st.mode === 'release') {
      const u = st.s / E.D;
      let beta = null;
      if (u < 1) { if (u > E.uLift) { const k = (u - E.uLift) / (1 - E.uLift); beta = E.bLift + (B_REL - E.bLift) * k * k; } }
      else {
        const s = st.s - E.D;
        if (s < 1.3) beta = B_REL + (B_HANG - B_REL) * easeOut(s / 1.3);
        else beta = -PI / 2 + 0.3 * Math.exp(-0.9 * (s - 1.3)) * Math.sin(3 * (s - 1.3));
      }
      if (beta !== null) { out.y = ty + E.R * Math.sin(beta); out.z = tz + E.R * Math.cos(beta); return out; }
    }
    pouchRest(E, ty, tz, _p); out.y = _p.y; out.z = _p.z;
    return out;
  }

  function buildTreb(W, K, E, bones) {
    const { H, L: AL, Sh, hw, len, th, out } = E;
    W.M.copy(E.M); W.shadeH = 6; W.lo = 0.62; W.shade = null;
    // sleepers under the sill ends, then the base: two long sills, cross sills, the outrigger sill across the middle
    for (const sx of [-hw, hw]) for (const sz of [-len, 0, len]) put(W, box(th * 1.7, 0.7, th * 1.7), COL.oakDark, { m: X(sx, -0.18, sz) });
    for (const sx of [-hw, hw]) put(W, box(th, th, 2 * len + th), COL.oak, { m: X(sx, th / 2, 0) });
    put(W, box(2 * hw + th * 2, th * 0.9, th * 0.9), COL.oak, { m: X(0, th * 0.45, -len) });
    put(W, box(2 * hw + th * 2, th * 0.9, th * 0.9), COL.oak, { m: X(0, th * 0.45, len) });
    put(W, box(2 * (hw + out) + th, th * 0.9, th * 0.9), COL.oak, { m: X(0, th * 0.45, 0) });
    for (const sx of [-1, 1]) {
      const x = sx * hw;
      beam(W, [x, th, -len * 0.92], [x, H, 0], th, COL.oak);
      beam(W, [x, th, len * 0.92], [x, H, 0], th, COL.oak);
      beam(W, [x, th, 0], [x, H - 0.2, 0], th * 0.9, COL.oakLight);
      beam(W, [sx * (hw + out), th * 0.8, 0], [x, H * 0.66, 0], th * 0.8, COL.oak);
      const yt = H * 0.42, zt = len * 0.92 * (1 - (yt - th) / (H - th));
      put(W, box(th * 0.7, th * 0.7, 2 * zt + th), COL.oakLight, { m: X(x, yt, 0) });
      put(W, box(th * 1.6, th * 1.0, th * 2.0), COL.oakDark, { m: X(x, H, 0) });                 // the bearing block
      put(W, box(th * 1.4, th * 0.12, th * 2.1), COL.iron, { m: X(x, H + th * 0.55, 0) });       // its iron strap
    }
    put(W, cylX(0.17, 2 * hw + th * 2.2, 8), COL.iron, { m: X(0, H, 0) });                         // the axle
    // the trough the sling lies in (Middelaldercentret: a V-shaped trough), from the catch to under the axle
    const tipZ = -E.L * Math.sin(E.phiC), tz0 = tipZ + 0.3, tz1 = 0.8, tl = tz1 - tz0;
    for (const sx of [-1, 1]) put(W, box(0.06, 0.5, tl), COL.oakLight, { m: X(sx * 0.22, 0.32, (tz0 + tz1) / 2, 0, 0, sx * 0.55) });
    for (let z = tz0 + 0.5; z < tz1; z += 2.2) put(W, box(0.9, 0.12, 0.2), COL.oakDark, { m: X(0, 0.06, z) });
    // the catch: two posts and a bar the arm's tip rests on
    for (const sx of [-1, 1]) put(W, box(0.22, 1.25, 0.22), COL.oak, { m: X(sx * 0.55, 0.62, tipZ - 0.25) });
    put(W, box(1.35, 0.16, 0.2), COL.oakDark, { m: X(0, E.tipY0 - 0.3, tipZ - 0.25) });
    put(W, box(0.08, 0.3, 0.08), COL.iron, { m: X(0, E.tipY0 - 0.1, tipZ - 0.38) });              // the hook
    const wPos = [];
    if (E.wheel) {
      // the treadwheels' frame: a shared axle on A-legs outside the side frames, the winding drum in the middle
      const Wh = E.wheel;
      for (const sx of [-1, 1]) {
        const x = sx * Wh.post;
        beam(W, [x, 0, Wh.z - 1.1], [x, Wh.y + 0.15, Wh.z], th * 0.8, COL.oak);
        beam(W, [x, 0, Wh.z + 1.1], [x, Wh.y + 0.15, Wh.z], th * 0.8, COL.oak);
        put(W, box(th, th * 0.8, 2.8), COL.oakDark, { m: X(x, th * 0.4, Wh.z) });
        beam(W, [x, th * 0.6, Wh.z], [sx * hw, th * 0.6, Wh.z], th * 0.7, COL.oakDark);
      }
      put(W, cylX(0.16, 2 * Wh.post + 0.4, 8), COL.oakDark, { m: X(0, Wh.y, Wh.z) });
      put(W, cylX(0.38, 1.0, 8), COL.rope, { m: X(0, Wh.y, Wh.z) });                                  // rope wound on the drum
      wPos.push([-Wh.x, Wh.y, Wh.z], [Wh.x, Wh.y, Wh.z]);
    }
    if (E.capstan) {
      const cz = E.capstan.z;
      put(W, box(2.6, 0.26, 0.3), COL.oakDark, { m: X(0, 0.13, cz) });
      put(W, box(0.3, 0.26, 2.6), COL.oakDark, { m: X(0, 0.13, cz) });
      beam(W, [0, 0.2, cz + 1.2], [0, 0.2, -len], th * 0.8, COL.oak);                                 // tied back to the frame
      put(W, box(0.5, 0.6, 0.4), COL.oakDark, { m: X(0, 0.5, -len - 0.4) });                           // the rope's guide block
    }
    // a coil of spare rope at the foot of the frame
    put(W, new THREE.TorusGeometry(0.4, 0.12, 4, 8).rotateX(PI / 2), COL.rope, { m: X(hw + 0.9, 0.1, len - 0.8) });

    // ----- moving parts (skinned) -----
    W.shade = null;
    K.shade = () => 1;
    // the arm (bone frame at the axle, the long arm along +y)
    K.b = bones.arm;
    K.M.identity();
    put(K, box(0.5, Sh + 0.4, 0.5), COL.oak, { m: X(0, -(Sh + 0.4) / 2 + 0.25, 0), t: 0.95 });
    put(K, new THREE.CylinderGeometry(0.17 * th / 0.4, 0.33 * th / 0.4, AL, 4).rotateY(PI / 4), COL.oak, { m: X(0, AL / 2, 0) });
    for (const [y, w] of [[-Sh * 0.55, 0.58], [0.5, 0.56], [AL * 0.18, 0.5], [AL * 0.36, 0.44], [AL * 0.6, 0.38]]) put(K, box(w * th / 0.4, 0.1, w * th / 0.4), COL.iron, { m: X(0, y, 0) });
    put(K, cylX(0.3 * th / 0.4, 0.66, 8), COL.iron, { m: X(0, 0, 0) });
    put(K, cylX(0.11, 1.3 * th / 0.4, 6), COL.iron, { m: X(0, -Sh, 0) });
    put(K, box(0.07, 0.45, 0.07), COL.iron, { m: X(0, AL + 0.15, 0.08, 0.35, 0, 0) });          // the prong the sling's loop slips off
    // the box of earth, hanging from its hinge (bone frame at the hinge pin)
    K.b = bones.box;
    const Bx = E.box, top = -Bx.hang;
    for (const sx of [-1, 1]) put(K, box(0.12, Bx.hang + 0.3, 0.16), COL.iron, { m: X(sx * 0.55 * th / 0.4, -Bx.hang / 2 + 0.05, 0) });
    put(K, box(Bx.w + 0.3, 0.26, 0.34), COL.oakDark, { m: X(0, top, 0) });
    put(K, box(Bx.w, Bx.h, Bx.d, 1, 5, 1), COL.oak, { m: X(0, top - 0.08 - Bx.h / 2, 0), col: (cx, cy) => (Math.floor((cy - top) / (Bx.h / 5) + 100) % 2 ? COL.oak : COL.oakLight) });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(K, box(0.09, Bx.h + 0.04, 0.09), COL.iron, { m: X(sx * Bx.w / 2, top - 0.08 - Bx.h / 2, sz * Bx.d / 2) });
    put(K, box(Bx.w - 0.14, 0.06, Bx.d - 0.14), COL.earth, { m: X(0, top - 0.24, 0) });
    for (let i = 0; i < 3; i++) put(K, rock(0.22 * th / 0.4, 11 + i), COL.stone, { m: X((i - 1) * 0.6 * th / 0.4, top - 0.18, (i % 2 ? 0.3 : -0.25) * th / 0.4) });
    // the treadwheels (bone frame at each wheel's centre, axis x): two rims, sixteen treads, eight spokes a side
    if (E.wheel) {
      const r = E.wheel.r;
      for (const wb of [bones.wheelL, bones.wheelR]) {
        K.b = wb;
        for (const sx of [-0.52, 0.52]) {
          put(K, new THREE.TorusGeometry(r, 0.11, 4, 16).rotateY(PI / 2), COL.oak, { m: X(sx, 0, 0) });
          for (let k = 0; k < 4; k++) put(K, box(0.1, 2 * r, 0.12), COL.oakDark, { m: X(sx, 0, 0, k * PI / 4, 0, 0) });
        }
        for (let k = 0; k < 16; k++) { const a = k * TAU / 16; put(K, box(1.12, 0.07, 0.5), k % 2 ? COL.oakLight : COL.oak, { m: X(0, (r - 0.1) * Math.cos(a), (r - 0.1) * Math.sin(a), a, 0, 0) }); }
        put(K, cylX(0.24, 1.3, 8), COL.oakDark, { m: X(0, 0, 0) });
      }
    }
    if (E.capstan) {
      K.b = bones.capstan;
      put(K, new THREE.CylinderGeometry(0.3, 0.36, 1.1, 8), COL.oak, { m: X(0, 0.55, 0) });
      put(K, new THREE.CylinderGeometry(0.33, 0.33, 0.35, 8), COL.rope, { m: X(0, 0.45, 0) });
      put(K, new THREE.CylinderGeometry(0.42, 0.42, 0.16, 8), COL.oakDark, { m: X(0, 1.12, 0) });
      put(K, box(2 * E.capstan.bar, 0.12, 0.12), COL.oakLight, { m: X(0, 1.0, 0) });
      put(K, box(0.12, 0.12, 2 * E.capstan.bar), COL.oakLight, { m: X(0, 1.0, 0) });
    }
    // the sling: two ropes from the tip and a net pouch (bone frame at the tip, +z toward the pouch, scaled by length)
    K.b = bones.sling;
    for (const sx of [-1, 1]) put(K, box(0.06, 0.06, 0.86), COL.rope, { m: X(sx * 0.05, 0, 0.43) });
    put(K, box(0.42, 0.16, 0.13), COL.rope, { m: X(0, 0, 0.93) });
    // the winding rope (bone frame at the drum, +z toward the arm, scaled by length; thinned to nothing when unhooked)
    K.b = bones.rope;
    put(K, box(0.08, 0.08, 1), COL.rope, { m: X(0, 0, 0.5) });
    K.shade = null;
    return wPos;
  }
  // place a trebuchet's bones for cycle time ct
  const ST1 = { phi: 0, psi: 0, lean: 0, roll: 0, mode: 'rest', s: 0, fall: 0, box: 0 }, ST2 = Object.assign({}, ST1);
  const pl = { x: 0, y: 0, z: 0 };
  function placeTreb(E, st, bones, ct) {
    armLocal(E, st);
    setBone(bones.arm, _m2.multiplyMatrices(E.M, E.armM));
    // the box hangs from the short end, swinging on its hinge; once T2 is broken it lies dropped in the frame
    if (st.mode === 'cut' || st.mode === 'restore') {
      const cut = st.mode === 'cut';
      const y0 = cut ? E.H - E.Sh * Math.cos(E.halfPhi) : E.shortEnd.y, z0 = cut ? E.Sh * Math.sin(E.halfPhi) : E.shortEnd.z, yG = E.box.hang + 0.08 + E.box.h - 0.08;
      const zG = E.Sh * Math.sin(E.halfPhi) + 0.25, x0 = cut ? 0 : E.shortEnd.x;
      _m.makeTranslation(lerp(x0, 0.15, st.box), lerp(y0, yG, st.box), lerp(z0, zG, st.box));
      _m.multiply(_m2.makeRotationZ(0.16 * st.box)).multiply(_m2.makeRotationX(-0.12 * st.box));
    } else {
      _m.makeTranslation(E.shortEnd.x, E.shortEnd.y, E.shortEnd.z);
      _m.multiply(_m2.makeRotationX(st.psi));
    }
    setBone(bones.box, _m2.multiplyMatrices(E.M, _m));
    // the sling
    pouchLocal(E, st, pl);
    _v.set(pl.x, pl.y, pl.z);
    if (st.mode === 'cut') {
      // cut free: it falls and lies in the grass under the arm
      const a = _v2.copy(E.tip), b = _v.copy(_v);
      a.lerp(_v3.set(0.5, 0.12, -1.0), st.fall); b.lerp(_v3.set(1.0, 0.1, -1.0 - E.R * 0.95), st.fall);
      E.pouch.copy(b).applyMatrix4(E.M);
      ropeBone(bones.sling, _v2.copy(a).applyMatrix4(E.M), _v3.copy(b).applyMatrix4(E.M), 1);
    } else {
      E.pouch.copy(_v).applyMatrix4(E.M);
      ropeBone(bones.sling, _v2.copy(E.tip).applyMatrix4(E.M), E.pouch, 1);
    }
  }
  // a stretched part (a rope) from a to b (world), thickness k
  function ropeBone(i, a, b, k) {
    const d = _v3.subVectors(b, a), len = d.length();
    if (len < 1e-4 || k <= 0.001) { setBone(i, ZERO); return; }
    _q.setFromUnitVectors(ZAX, d.multiplyScalar(1 / len));
    _m.compose(a, _q, _s.set(k, k, len));
    setBone(i, _m);
  }

  // =====================================================================================================
  // THE RAM (picture 10; Vegetius IV.14: "woven of timber and planks", covered with hides, the head "clad in iron")
  // Body frame: +z forward along its path, origin on the ground at the shed's centre.
  // =====================================================================================================
  const RAM_W = 0.5, RAM_PIV = 2.8, RAM_D = 1.7, RAM_RIDGE = 3.0;
  function buildRam(K, bones) {
    K.M.identity(); K.shade = (x, y) => 0.68 + 0.32 * clamp01(y / 3);
    K.b = bones.ramBody;
    for (const sx of [-1, 1]) put(K, box(0.26, 0.26, 4.9), COL.oak, { m: X(sx * 1.3, 0.72, 0) });
    for (const sz of [-1.6, 1.6]) put(K, box(3.15, 0.18, 0.18), COL.oakDark, { m: X(0, 0.5, sz) });
    for (const sz of [-2.35, 2.35]) put(K, box(2.8, 0.2, 0.2), COL.oak, { m: X(0, 0.72, sz) });
    for (const sx of [-1, 1]) for (const sz of [-2.3, 2.3]) put(K, box(0.18, 0.5, 0.18), COL.oakDark, { m: X(sx * 1.3, 1.0, sz) });
    // the wheels: solid discs of three planks, iron-bound
    for (let i = 0; i < 4; i++) {
      K.b = bones.ramWheels[i];
      put(K, cylX(RAM_W, 0.22, 8), COL.oak, { m: X(0, 0, 0), col: (cx, cy, cz) => (Math.abs(cy) < 0.17 ? COL.oakLight : COL.oak) });
      put(K, cylX(RAM_W + 0.02, 0.1, 8, true), COL.iron, { m: X(0, 0, 0) });
      put(K, cylX(0.12, 0.34, 6), COL.iron, { m: X(0, 0, 0) });
    }
    // the ropes the log hangs from (sheared as it swings)
    K.b = bones.ramRopes;
    for (const sz of [-1.1, 1.1]) put(K, box(0.07, RAM_D - 0.15, 0.07), COL.rope, { m: X(0, RAM_PIV - RAM_D / 2 + 0.1, sz) });
    // the log with its iron head (Vegetius: "caput ipsius uestitur ferro")
    K.b = bones.ramLog;
    const ly = RAM_PIV - RAM_D;
    put(K, cylZ(0.2, 0.2, 4.15, 6), COL.oakLight, { m: X(0, ly, -0.22) });
    put(K, cylZ(0.15, 0.25, 0.5, 6), COL.iron, { m: X(0, ly, 2.05) });
    for (const z of [-1.6, -0.2, 1.1]) put(K, cylZ(0.225, 0.225, 0.1, 6, true), COL.iron, { m: X(0, ly, z) });
    for (const z of [-1.1, 1.1]) put(K, cylZ(0.24, 0.24, 0.12, 6, true), COL.rope, { m: X(0, ly, z) });
    // the roof: two halves of planks under rawhides, with their rafters; the ridge beam on the left half
    for (const side of [-1, 1]) {
      K.b = side < 0 ? bones.ramRoofL : bones.ramRoofR;
      const ex = side * 1.45, ey = -2.15, sl = Math.hypot(ex, ey), a = side * Math.atan2(1.45, 2.15);
      const nx = side * 2.15 / sl, ny = 1.45 / sl;
      const half = (x, y, z, w, h, d, hex, opt) => put(K, box(w, h, d, 1, opt && opt.bands ? 7 : 1, 1), hex, Object.assign({ m: X(x, y, z, 0, 0, a) }, opt));
      half(ex / 2 + nx * 0.06, ey / 2 + ny * 0.06, 0, 0.1, sl + 0.3, 5.0, COL.oak, { bands: true, col: (cx, cy) => (Math.floor(-cy / 0.33 + 100) % 2 ? COL.oak : COL.oakLight) });
      for (const [k, z, len] of [[0.3, -1.5, 1.6], [0.62, 0.5, 1.9], [0.25, 1.7, 1.3], [0.8, -0.9, 1.2]]) half(ex * k + nx * 0.13, ey * k + ny * 0.13, z, 0.04, 0.75 + 0.2 * k, len, k > 0.5 ? COL.hide : COL.hideLight);
      for (const z of [-2.2, 0, 2.2]) beam(K, [-nx * 0.05, -0.1, z], [ex - nx * 0.1, ey - 0.05, z], 0.16, COL.oakDark);
      if (side < 0) put(K, box(0.26, 0.26, 5.0), COL.oakDark, { m: X(0, -0.05, 0) });
    }
    K.shade = null;
  }
  // the ram along its path at cycle time ct (pure): { x, y, z, yaw, pitch, s, speed }
  function rampS(t, T, ta, td, Lr) {
    const vmax = Lr / (T - ta / 2 - td / 2);
    if (t <= 0) return 0;
    if (t <= ta) return vmax * (t / 2 - ta / (2 * PI) * Math.sin(PI * t / ta));
    const sA = vmax * ta / 2;
    if (t <= T - td) return sA + vmax * (t - ta);
    const tt = Math.min(t, T) - (T - td);
    return sA + vmax * (T - td - ta) + vmax * (tt / 2 + td / (2 * PI) * Math.sin(PI * tt / td));
  }
  const RA = { x: 0, z: 0, yaw: 0 }, RB = { x: 0, z: 0, yaw: 0 }, RC = { x: 0, z: 0, yaw: 0 };
  // metres along SIEGE.ramPath at cycle time ct: parked in the camp, rolled out 68-88, put back under the mist
  function ramS(ct) {
    const R = TM.ram, T = R.arrive - R.leave;
    return ct >= R.leave && ct < MIST_RESET ? rampS(Math.min(ct - R.leave, T), T, 2.5, 3.0, S.lengths.ramPath) : 0;
  }
  function ramAt(ct, out) {
    out = out || {};
    const R = TM.ram, Lr = S.lengths.ramPath;
    const s = ramS(ct), s2 = ct < R.arrive ? ramS(ct + 0.05) : s;
    ctx.routeAt(S.ramPath, s, RA);
    ctx.routeAt(S.ramPath, Math.max(0, s - 2), RB);
    ctx.routeAt(S.ramPath, Math.min(Lr, s + 2), RC);
    out.x = RA.x; out.z = RA.z; out.s = s; out.speed = (s2 - s) / 0.05;
    out.yaw = Math.atan2(RC.x - RB.x, RC.z - RB.z);
    const fx = Math.sin(out.yaw), fz = Math.cos(out.yaw);
    const yF = ctx.surfaceY(RA.x + fx * 1.6, RA.z + fz * 1.6), yB = ctx.surfaceY(RA.x - fx * 1.6, RA.z - fz * 1.6);
    out.y = (yF + yB) / 2; out.pitch = Math.atan2(yF - yB, 3.2);
    // the blows, the stones on the roof and the cave-in
    out.swing = ramSwing(ct);
    let hits = 0;
    for (const rs of R.roofStones) hits += easeOut(win(ct, rs, rs + 0.25));
    out.sag = ct < MIST_RESET ? hits : 0;
    out.broken = ct < MIST_RESET ? easeIn(win(ct, R.cave, R.cave + 0.6)) : 0;
    out.logFall = ct < MIST_RESET ? easeIn(win(ct, R.cave + 0.1, R.cave + 0.5)) : 0;
    return out;
  }
  // the log's swing angle: pulled back, swung into the gate at each blow, rebounding (SIEGE.times.ram.blows)
  // (integration: a bigger swing so the blows read from across the room: drawn back the log's tail swings 0.9 m out of
  // the back of the shed; at the blow its iron head reaches the barbican's doors, 0.42 m inside the arch)
  const TH_BACK = -0.72, TH_HIT = 0.36, TH_REB = -0.14;
  // the shed's jolt at each blow: thrown back a few centimetres and rocked, settling in half a second
  function ramJolt(ct) {
    const B = TM.ram.blows;
    if (ct < B[0] || ct >= TM.ram.cave) return 0;
    let j = 0;
    for (let i = 0; i < B.length; i++) { const u = ct - B[i]; if (u >= 0 && u < 0.7) j += Math.sin(Math.min(1, u / 0.05) * PI / 2) * Math.exp(-7 * u) * Math.cos(20 * u); }
    return j;
  }
  function ramSwing(ct) {
    const B = TM.ram.blows;
    if (ct >= TM.ram.cave || ct < B[0] - 1.6) return 0;
    for (let i = 0; i < B.length; i++) {
      const b = B[i], from = i === 0 ? b - 1.6 : B[i - 1] + 0.4, th0 = i === 0 ? 0 : TH_REB;
      if (ct < from) break;
      if (ct < b - 0.55) return lerp(th0, TH_BACK, smooth(win(ct, from, b - 0.55)));
      if (ct < b) return TH_BACK + (TH_HIT - TH_BACK) * easeIn(win(ct, b - 0.55, b));
      if (ct < b + 0.4) return lerp(TH_HIT, TH_REB, easeOut(win(ct, b, b + 0.4)));
      if (i === B.length - 1) return lerp(TH_REB, 0, smooth(win(ct, b + 0.4, b + 1.6)));
    }
    return 0;
  }
  const RAM = { x: 0, y: 0, z: 0, yaw: PI, pitch: 0, s: 0, speed: 0, swing: 0, sag: 0, broken: 0, logFall: 0, M: new THREE.Matrix4() };
  function placeRam(ct, bones) {
    ramAt(ct, RAM);
    const roll = 0.05 * RAM.broken, jolt = ramJolt(ct);
    RAM.M.compose(_v.set(RAM.x - Math.sin(RAM.yaw) * 0.09 * jolt, RAM.y, RAM.z - Math.cos(RAM.yaw) * 0.09 * jolt), _q.setFromAxisAngle(UP, RAM.yaw), _s.set(1, 1, 1));
    RAM.M.multiply(_m.makeRotationX(-RAM.pitch + 0.025 * jolt));
    if (roll) RAM.M.multiply(_m.makeRotationZ(roll));
    setBone(bones.ramBody, RAM.M);
    const wa = RAM.s / RAM_W;
    const wp = [[-1.5, -1.6], [1.5, -1.6], [-1.5, 1.6], [1.5, 1.6]];
    for (let i = 0; i < 4; i++) {
      _m.makeTranslation(wp[i][0], RAM_W, wp[i][1]).multiply(_m2.makeRotationX(wa));
      setBone(bones.ramWheels[i], _m2.multiplyMatrices(RAM.M, _m));
    }
    // ropes: sheared about the pivot by the swing; cut when the roof caves
    const th = RAM.swing, c = Math.cos(th), sn = Math.sin(th);
    if (RAM.logFall > 0) setBone(bones.ramRopes, ZERO);
    else {
      _m.set(1, 0, 0, 0, 0, c, 0, RAM_PIV * (1 - c), 0, -sn, 1, RAM_PIV * sn, 0, 0, 0, 1);
      setBone(bones.ramRopes, _m2.multiplyMatrices(RAM.M, _m));
    }
    // the log: carried along the arc of its ropes, or fallen to the ground
    const lf = RAM.logFall;
    _m.makeTranslation(0, RAM_D * (1 - c) * (1 - lf) - (RAM_PIV - RAM_D - 0.2) * lf, RAM_D * sn * (1 - lf) + 0.15 * lf);
    if (lf) _m.multiply(_m2.makeRotationY(0.12 * lf));
    setBone(bones.ramLog, _m2.multiplyMatrices(RAM.M, _m));
    // the roof halves: sagging with each stone, then caving in (the ridge drops, the halves splay)
    // (lopsided: the left half, under the most stones, goes further)
    const drop = 0.08 * RAM.sag + (1.1 - 0.08 * 3) * RAM.broken;
    for (const side of [-1, 1]) {
      const rot = 0.03 * RAM.sag + (side < 0 ? 0.36 : 0.22) * RAM.broken, twist = (side < 0 ? 0.06 : -0.03) * RAM.broken;
      _m.makeTranslation(side * 0.12 * RAM.broken, RAM_RIDGE - drop - (side < 0 ? 0.12 : 0) * RAM.broken, 0).multiply(_m2.makeRotationZ(side * rot));
      if (twist) _m.multiply(_m2.makeRotationX(twist));
      setBone(side < 0 ? bones.ramRoofL : bones.ramRoofR, _m2.multiplyMatrices(RAM.M, _m));
    }
  }

  // =====================================================================================================
  // THE GUNS (research 16; decisions 10, 12)
  // =====================================================================================================
  const TILT = 0.05;
  const lionGuns = [], bullGuns = [];
  function bedTilt() { return new THREE.Matrix4().makeTranslation(0, 0.16, -1.2).multiply(new THREE.Matrix4().makeRotationX(-TILT)).multiply(new THREE.Matrix4().makeTranslation(0, -0.16, 1.2)); }
  function buildLionGun(W, K, G, i, bones) {
    const g = { i, x: G.x, y: G.y, z: G.z, yaw: G.face, big: G.big, shots: [], fwd: [Math.sin(G.face), Math.cos(G.face)] };
    g.M = new THREE.Matrix4().compose(new THREE.Vector3(G.x, G.y, G.z), new THREE.Quaternion().setFromAxisAngle(UP, G.face), new THREE.Vector3(1, 1, 1));
    W.M.copy(g.M); W.shadeH = 1.6; W.lo = 0.6; W.shade = null;
    const tilt = bedTilt();
    const T = (x, y, z, rx, ry, rz) => new THREE.Matrix4().multiplyMatrices(tilt, X(x, y, z, rx, ry, rz));
    if (G.big) {
      // a heavy timber bed on sleepers, staked down, with a backstop and a wedge under the front (research 16c)
      for (const z of [-1.2, 0.9]) put(W, box(1.4, 0.16, 0.32), COL.oakDark, { m: X(0, 0.08, z) });
      put(W, box(1.05, 0.2, 3.3), COL.oak, { m: T(0, 0.26, -0.35) });
      for (const sx of [-1, 1]) put(W, box(0.2, 0.42, 3.3), COL.oak, { m: T(sx * 0.52, 0.47, -0.35), col: (cx, cy) => (cy > 0.55 ? COL.oakLight : COL.oak) });
      put(W, box(1.6, 0.6, 0.4), COL.oakDark, { m: X(0, 0.4, -2.2) });
      for (const sx of [-0.55, 0, 0.55]) put(W, box(0.15, 1.0, 0.15), COL.oak, { m: X(sx, 0.32, -2.55, -0.25, 0, 0) });
      for (const sx of [-1, 1]) for (const z of [-1.3, 0.6]) put(W, box(0.13, 0.75, 0.13), COL.oak, { m: X(sx * 0.78, 0.3, z, 0, 0, sx * 0.12) });
      put(W, box(0.9, 0.16, 0.6), COL.oakLight, { m: X(0, 0.22, 1.15, 0.22, 0, 0) });                                   // the wedge
      // the shutter's frame, propped from behind
      for (const sx of [-1, 1]) {
        put(W, box(0.16, 2.2, 0.16), COL.oak, { m: X(sx * 1.2, 1.1, 2.55) });
        beam(W, [sx * 1.2, 1.3, 2.5], [sx * 1.2, 0, 1.6], 0.12, COL.oakDark);
      }
      put(W, box(2.65, 0.18, 0.22), COL.oakDark, { m: X(0, 2.12, 2.55) });
      // stone balls piled behind, a bucket of water beside (research 16f: "A bucket of water was always kept beside")
      ballPile(W, -1.35, -1.7, 0.27, 5, 31 + i);
      bucket(W, 1.15, -1.3);
    } else {
      // a small bronze gun on a short wooden bed, on two trestles
      for (const z of [-0.6, 0.55]) put(W, box(0.8, 0.32, 0.26), COL.oakDark, { m: X(0, 0.16, z) });
      put(W, box(0.44, 0.22, 1.9), COL.oak, { m: X(0, 0.43, 0) });
      for (const sx of [-1, 1]) put(W, box(0.08, 0.12, 1.9), COL.oakLight, { m: X(sx * 0.18, 0.6, 0) });
      for (const sx of [-0.3, 0.3]) put(W, box(0.1, 0.7, 0.1), COL.oak, { m: X(sx, 0.25, -1.05, -0.2, 0, 0) });
      for (const sx of [-1, 1]) put(W, box(0.13, 1.7, 0.13), COL.oak, { m: X(sx * 0.85, 0.85, 1.55) });
      put(W, box(1.9, 0.15, 0.18), COL.oakDark, { m: X(0, 1.65, 1.55) });
      for (const sx of [-1, 1]) beam(W, [sx * 0.85, 1.0, 1.5], [sx * 0.85, 0, 0.9], 0.1, COL.oakDark);
      ballPile(W, -0.8, -1.3, 0.15, 4, 41 + i);
      bucket(W, 0.8, -1.2);
    }
    // the barrel (bone frame on its axis at the chamber's mouth, +z toward the muzzle)
    K.M.identity(); K.shade = (x, y) => 0.78 + 0.22 * clamp01((y + 0.3) / 0.6); K.b = bones.lionBarrel[i];
    if (G.big) {
      // wrought iron, hoop and stave (research 16b): a wide banded barrel, a narrower chamber behind
      put(K, cylZ(0.25, 0.25, 0.95, 8), COL.iron, { m: X(0, 0, -0.5) });
      put(K, cylZ(0.27, 0.27, 0.12, 8), COL.ironLight, { m: X(0, 0, -0.99) });
      put(K, cylZ(0.34, 0.34, 1.8, 8), COL.iron, { m: X(0, 0, 0.9) });
      for (const z of [0.1, 0.4, 0.7, 1.0, 1.3, 1.62]) put(K, cylZ(0.375, 0.375, 0.1, 8, true), COL.ironLight, { m: X(0, 0, z) });
      for (const z of [-0.3, -0.7]) put(K, cylZ(0.28, 0.28, 0.09, 8, true), COL.ironLight, { m: X(0, 0, z) });
      put(K, new THREE.CircleGeometry(0.24, 8), COL.bore, { m: X(0, 0, 1.805), sh: false });
      put(K, box(0.08, 0.06, 0.08), COL.ironLight, { m: X(0, 0.26, -0.62) });                   // the touch-hole
      g.muzzleZ = 1.8; g.axisY = 0.70;
    } else {
      put(K, cylZ(0.13, 0.13, 0.45, 8), COL.bronze, { m: X(0, 0, -0.42) });
      put(K, cylZ(0.14, 0.155, 1.0, 8), COL.bronze, { m: X(0, 0, 0.25) });
      put(K, cylZ(0.18, 0.18, 0.12, 8), COL.bronze, { m: X(0, 0, 0.72), t: 1.08 });
      put(K, new THREE.CircleGeometry(0.09, 8), COL.bore, { m: X(0, 0, 0.785), sh: false });
      g.muzzleZ = 0.78; g.axisY = 0.72;
    }
    // the shutter (bone frame at its hinge): a plank panel that lifts up and out for the shot (research 16d)
    K.b = bones.lionShutter[i]; K.shade = () => 1;
    const sw = G.big ? 2.2 : 1.6, shh = G.big ? 1.85 : 1.35;
    put(K, box(sw, shh, 0.1, 6, 1, 1), COL.oak, { m: X(0, -shh / 2 - 0.02, 0), col: (cx) => (Math.floor(cx / (sw / 6) + 100) % 2 ? COL.oak : COL.oakLight) });
    for (const y of [-0.3, -shh + 0.3]) put(K, box(sw - 0.1, 0.12, 0.07), COL.oakDark, { m: X(0, y, -0.08) });
    K.shade = null;
    g.hinge = G.big ? [0, 2.0, 2.66] : [0, 1.55, 1.66];
    g.barrelBase = new THREE.Matrix4().multiplyMatrices(g.M, G.big ? tilt : new THREE.Matrix4()).multiply(new THREE.Matrix4().makeTranslation(0, g.axisY, 0));
    g.muzzle = new THREE.Vector3(0, 0, g.muzzleZ).applyMatrix4(g.barrelBase);
    lionGuns.push(g);
  }
  function buildBullGun(W, K, G, i, bones) {
    const g = { i, x: G.x, y: G.y, z: G.z, yaw: G.face, big: false, shots: [], fwd: [Math.sin(G.face), Math.cos(G.face)], where: G.where };
    g.M = new THREE.Matrix4().compose(new THREE.Vector3(G.x, G.y, G.z), new THREE.Quaternion().setFromAxisAngle(UP, G.face), new THREE.Vector3(1, 1, 1));
    W.M.copy(g.M); W.shadeH = 1.2; W.lo = 0.65; W.shade = null;
    for (const z of [-0.4, 0.35]) {
      put(W, box(0.62, 0.1, 0.18), COL.oakDark, { m: X(0, 0.66, z) });
      for (const sx of [-1, 1]) put(W, box(0.09, 0.66, 0.09), COL.oak, { m: X(sx * 0.24, 0.33, z, 0, 0, sx * 0.12) });
    }
    put(W, box(0.36, 0.16, 1.25), COL.oak, { m: X(0, 0.79, 0) });
    for (const z of [-0.3, 0.3]) put(W, box(0.4, 0.05, 0.07), COL.iron, { m: X(0, 0.9, z) });
    ballPile(W, -0.65, -0.6, 0.13, 3, 51 + i);
    K.M.identity(); K.shade = (x, y) => 0.8 + 0.2 * clamp01((y + 0.15) / 0.3); K.b = bones.bullBarrel[i];
    const hex = i % 2 ? COL.iron : COL.bronze;
    put(K, cylZ(0.1, 0.1, 0.38, 8), hex, { m: X(0, 0, -0.38) });
    put(K, cylZ(0.12, 0.13, 0.85, 8), hex, { m: X(0, 0, 0.22) });
    put(K, cylZ(0.145, 0.145, 0.1, 8), hex, { m: X(0, 0, 0.62), t: 1.08 });
    put(K, new THREE.CircleGeometry(0.075, 8), COL.bore, { m: X(0, 0, 0.672), sh: false });
    K.shade = null;
    g.muzzleZ = 0.67;
    g.barrelBase = new THREE.Matrix4().multiplyMatrices(g.M, new THREE.Matrix4().makeTranslation(0, 1.0, 0));
    g.muzzle = new THREE.Vector3(0, 0, g.muzzleZ).applyMatrix4(g.barrelBase);
    bullGuns.push(g);
  }
  function ballPile(W, x, z, r, n, seed) {
    const pts = [[0, 0], [2.05, 0], [1.02, 1.8], [1.02, 0.6], [3.05, 1.0]];
    for (let k = 0; k < n; k++) {
      const top = k === 3;
      put(W, rock(r, seed + k, 0.12), COL.stone, { m: X(x + pts[k][0] * r, top ? r * 2.5 : r * 0.92, z + pts[k][1] * r * (top ? 0.4 : 1)), sh: false, t: 0.85 + 0.25 * ((k * 7) % 3) / 2 });
    }
  }
  function bucket(W, x, z) {
    put(W, new THREE.CylinderGeometry(0.22, 0.18, 0.36, 7, 1, true), COL.oakLight, { m: X(x, 0.18, z), sh: false });
    put(W, new THREE.CircleGeometry(0.2, 7).rotateX(-PI / 2), COL.water, { m: X(x, 0.31, z), sh: false });
    put(W, new THREE.CylinderGeometry(0.225, 0.225, 0.05, 7, 1, true), COL.iron, { m: X(x, 0.28, z), sh: false });
  }
  function shutterAt(g, ct) {
    let k = 0;
    for (const t of g.shots) k = Math.max(k, smooth((ct - (t - 3.6)) / 0.8) * (1 - smooth((ct - (t + 2.4)) / 0.9)));
    return k;
  }
  function recoilAt(g, ct, R) {
    for (const t of g.shots) {
      const age = ct - t;
      if (age >= 0 && age < 1.6) return R * Math.min(1, age / 0.05) * (1 - easeOut((age - 0.05) / 1.55));
    }
    return 0;
  }

  // =====================================================================================================
  // THE PAVISES (research 4c): tall round-topped standing shields, propped from behind, painted with the Lion
  // =====================================================================================================
  const PAV_TILT = -0.14;
  const pavises = [];
  let pavShape = null;
  function buildPavise(W, P, i) {
    if (!pavShape) {
      const s = new THREE.Shape();
      s.moveTo(-0.45, 0); s.lineTo(0.45, 0); s.lineTo(0.45, 1.35);
      for (let k = 1; k <= 5; k++) { const a = k / 6 * PI; s.lineTo(0.45 * Math.cos(a), 1.35 + 0.42 * Math.sin(a)); }
      s.lineTo(-0.45, 1.35); s.lineTo(-0.45, 0);
      pavShape = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -0.04);
    }
    const M = frame(W, P.x, P.y - 0.04, P.z, P.face).clone();
    W.shadeH = 1.8; W.lo = 0.7; W.shade = null;
    const tilt = X(0, 0.05, 0, PAV_TILT, 0, 0);
    put(W, pavShape, COL.blue, { m: tilt, col: (cx, cy, cz) => (Math.abs(cz) > 0.035 ? COL.blue : COL.oak) });
    // a gold rim on the front, and the lion
    put(W, box(0.06, 1.3, 0.02), COL.gold, { m: new THREE.Matrix4().multiplyMatrices(tilt, X(-0.42, 0.7, 0.045)) });
    put(W, box(0.06, 1.3, 0.02), COL.gold, { m: new THREE.Matrix4().multiplyMatrices(tilt, X(0.42, 0.7, 0.045)) });
    lion(W, new THREE.Matrix4().multiplyMatrices(tilt, X(0, 0.92, 0.043)), 0.78);
    // the prop and a hand grip on the back, two iron feet
    beam(W, [0, 1.0 * Math.cos(PAV_TILT) + 0.05, 1.0 * Math.sin(PAV_TILT) - 0.06], [0, 0, -0.95], 0.07, COL.oakDark);
    put(W, box(0.36, 0.06, 0.06), COL.oakDark, { m: new THREE.Matrix4().multiplyMatrices(tilt, X(0, 1.1, -0.08)) });
    pavises.push({ x: P.x, y: P.y, z: P.z, face: P.face, M, tilt });
  }
  // a point on a pavise's painted front (u across, v up), and its outward normal, in world space
  function paviseFront(p, u, v, out, nOut) {
    _m.multiplyMatrices(p.M, p.tilt);
    out.set(u, v, 0.045).applyMatrix4(_m);
    if (nOut) nOut.set(0, 0, 1).transformDirection(_m);
    return out;
  }

  // =====================================================================================================
  // THE CAMP (research 4f: "tents and pavilions"; banners and pennons; wagons; the rest ours)
  // =====================================================================================================
  const tents = [], footprints = [], flames = [], fires = [];
  const segCol = (n, a, b, off) => (cx, cy, cz) => (Math.round((Math.atan2(cx, cz) + TAU) / (TAU / n) + (off || 0)) % 2 ? a : b);
  function bellTent(W, K, x, z, yaw, r) {
    const y = ctx.groundY(x, z) - 0.08;
    frame(W, x, y, z, yaw); W.shadeH = 3.2; W.lo = 0.7; W.shade = null;
    const rot = PI / 8;
    put(W, new THREE.CylinderGeometry(r, r, 1.25, 8, 1, true).rotateY(rot), COL.canvas, { m: X(0, 0.62, 0) });
    put(W, new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.32, 8, 1, true).rotateY(rot), COL.blue, { m: X(0, 1.12, 0), col: segCol(8, COL.blue, COL.gold) });
    put(W, new THREE.CylinderGeometry(0.07, r + 0.28, 2.1, 8, 1, true).rotateY(rot), COL.canvas, { m: X(0, 2.3, 0), t: 1.02 });
    const fz = r * Math.cos(PI / 8);
    put(W, box(0.8, 1.15, 0.04), COL.door, { m: X(0, 0.58, fz + 0.01), sh: false });
    put(W, box(0.42, 1.1, 0.04), COL.canvas, { m: X(0.62, 0.6, fz + 0.12, 0, 0.5, 0) });
    put(W, box(0.07, 1.0, 0.07), COL.oakDark, { m: X(0, 3.75, 0) });
    flag(K, x + Math.sin(yaw) * 0, y + 4.2, z, 0.1, 1.0, 0.36, 'pennon');
    tents.push({ x, z, r: r + 0.3, top: y + 3.5 });
    footprints.push({ x, z, r: r + 0.35, top: y + 3.6 });
  }
  function ridgeTent(W, K, x, z, yaw) {
    const y = ctx.groundY(x, z) - 0.06;
    frame(W, x, y, z, yaw); W.shadeH = 2.2; W.lo = 0.72; W.shade = null;
    const hw = 1.3, h = 2.0, len = 3.4, a = Math.atan2(hw, h), sl = Math.hypot(hw, h);
    for (const sx of [-1, 1]) put(W, box(0.05, sl, len), COL.canvas, { m: X(sx * hw / 2, h / 2, 0, 0, 0, sx * a) });
    const tri = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(0, h)]));
    put(W, tri, COL.canvas, { m: X(0, 0, len / 2) });
    put(W, tri, COL.canvas, { m: X(0, 0, -len / 2, 0, PI, 0) });
    const door = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.45, 0), new THREE.Vector2(0.45, 0), new THREE.Vector2(0, 1.3)]));
    put(W, door, COL.door, { m: X(0, 0.02, len / 2 + 0.01), sh: false });
    put(W, box(0.32, 0.08, len + 0.1), COL.blue, { m: X(0, h + 0.01, 0) });
    for (const sz of [-1, 1]) put(W, box(0.07, h + 0.5, 0.07), COL.oakDark, { m: X(0, (h + 0.5) / 2, sz * (len / 2 + 0.06)) });
    const fx = Math.sin(yaw) * (len / 2 + 0.06), fz = Math.cos(yaw) * (len / 2 + 0.06);
    flag(K, x + fx, y + h + 0.5, z + fz, 0.15, 0.8, 0.3, 'pennon');
    footprints.push({ x, z, hx: hw + 0.2, hz: len / 2 + 0.2, yaw, top: y + h + 0.6 });
  }
  function pavilion(W, K, x, z) {
    const y = ctx.groundY(x, z) - 0.1, r = 3.4, n = 10, rot = PI / n;
    frame(W, x, y, z, 0.15); W.shadeH = 4; W.lo = 0.72; W.shade = null;
    put(W, new THREE.CylinderGeometry(r, r, 2.3, n, 1, true).rotateY(rot), COL.canvas, { m: X(0, 1.15, 0), col: segCol(n, COL.blue, COL.canvas) });
    put(W, new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.4, n, 1, true).rotateY(rot), COL.gold, { m: X(0, 2.1, 0), col: segCol(n, COL.gold, COL.blue) });
    put(W, new THREE.CylinderGeometry(0.1, r + 0.35, 3.1, n, 1, true).rotateY(rot), COL.blue, { m: X(0, 3.85, 0), col: segCol(n, COL.blue, COL.gold, 1) });
    const fz = r * Math.cos(PI / n);
    put(W, box(1.2, 1.9, 0.04), COL.door, { m: X(0, 0.95, fz + 0.01), sh: false });
    for (const sx of [-1, 1]) put(W, box(0.55, 1.9, 0.04), COL.blue, { m: X(sx * 0.95, 0.98, fz + 0.18, 0, -sx * 0.55, 0) });
    put(W, box(0.09, 1.5, 0.09), COL.oakDark, { m: X(0, 6.1, 0) });
    put(W, new THREE.OctahedronGeometry(0.14), COL.gold, { m: X(0, 6.9, 0) });
    flag(K, x, y + 6.75, z, 0.05, 1.8, 0.55, 'pennon');
    footprints.push({ x, z, r: r + 0.4, top: y + 5.6 });
  }
  // a flag in the skinned mesh (bone 0): its hoist at (x, y, z), flying east (downwind); flutters in the shader
  function flag(K, x, y, z, yaw, w, h, kind, big) {
    K.b = 0; K.shade = () => 1;
    frame(K, x, y, z, yaw);
    const n = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, yaw);
    const nk = big ? 2 : 1;
    const fl = { n: [n.x * nk, n.y * nk, n.z * nk], w: (lx) => clamp01(lx / w) };
    if (kind === 'pennon') {
      // gold over blue: two triangles split along the middle
      const top = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, -h * 0.5), new THREE.Vector2(w, -h * 0.55)]));
      const bot = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, -h * 0.5), new THREE.Vector2(0, -h), new THREE.Vector2(w, -h * 0.55)]));
      put(K, top, COL.gold, { flap: fl, sh: false });
      put(K, bot, COL.blue, { flap: fl, sh: false });
      put(K, top, COL.gold, { m: X(0, 0, 0, 0, PI, 0, -1, 1, 1), flap: fl, sh: false });
      put(K, bot, COL.blue, { m: X(0, 0, 0, 0, PI, 0, -1, 1, 1), flap: fl, sh: false });
    } else {
      // the square banner: blue with the gold lion on both faces
      const cloth = new THREE.PlaneGeometry(w, h, 5, 1).translate(w / 2, -h / 2, 0);
      put(K, cloth, COL.blue, { flap: fl, sh: false });
      put(K, cloth, COL.blue, { m: X(w, 0, 0, 0, PI, 0), flap: fl, sh: false });
      lion(K, X(w / 2, -h / 2, 0.03), h * 0.82, { flap: fl });
      lion(K, X(w / 2, -h / 2, -0.03, 0, PI, 0), h * 0.82, { flap: fl });
    }
    K.shade = null;
  }
  function wagon(W, x, z, yaw, covered, seed) {
    const y = ctx.groundY(x, z);
    frame(W, x, y, z, yaw); W.shadeH = 2; W.lo = 0.62; W.shade = null;
    put(W, box(1.5, 0.12, 3.0), COL.oak, { m: X(0, 0.9, 0) });
    for (const sx of [-1, 1]) put(W, box(0.08, 0.45, 3.0), COL.oakLight, { m: X(sx * 0.75, 1.18, 0) });
    for (const sz of [-1, 1]) put(W, box(1.5, 0.45, 0.08), COL.oakLight, { m: X(0, 1.18, sz * 1.5) });
    for (const sz of [-1, 1]) {
      put(W, box(1.9, 0.12, 0.12), COL.oakDark, { m: X(0, 0.55, sz * 1.0) });
      for (const sx of [-1, 1]) {
        put(W, cylX(0.55, 0.1, 8, true), COL.oakDark, { m: X(sx * 0.9, 0.55, sz * 1.0) });
        for (const a of [0, PI / 2]) put(W, box(0.06, 1.04, 0.06), COL.oak, { m: X(sx * 0.9, 0.55, sz * 1.0, a + 0.3, 0, 0) });
        put(W, cylX(0.11, 0.2, 6), COL.oakDark, { m: X(sx * 0.9, 0.55, sz * 1.0) });
      }
    }
    for (const sx of [-1, 1]) beam(W, [sx * 0.42, 0.85, 1.5], [sx * 0.5, 0.06, 3.7], 0.09, COL.oak);
    if (covered) {
      put(W, new THREE.CylinderGeometry(0.8, 0.8, 2.8, 6, 1, true, PI / 2, PI).rotateX(PI / 2), COL.canvas, { m: X(0, 1.35, 0) });
      put(W, new THREE.CircleGeometry(0.8, 6, 0, PI), COL.canvas, { m: X(0, 1.35, 1.4), t: 0.92 });
      put(W, new THREE.CircleGeometry(0.8, 6, 0, PI), COL.canvas, { m: X(0, 1.35, -1.4, 0, PI, 0), t: 0.92 });
    } else {
      W.M.multiply(X(0, 0.96, 0));
      barrelAt(W, -0.35, -0.8, true, 0.3); barrelAt(W, 0.35, -0.8, true, 0.9);
      sackAt(W, -0.3, 0.6, seed); sackAt(W, 0.3, 0.75, seed + 1); sackAt(W, 0, 0.5, seed + 2, 0.45);
    }
    footprints.push({ x, z, hx: 1.1, hz: 2.4, yaw, top: y + 2.4 });
  }
  function barrelAt(W, x, z, upright, yaw, lift) {
    put(W, new THREE.CylinderGeometry(0.3, 0.3, 0.8, 6, 3), COL.oak, { m: upright ? X(x, 0.4 + (lift || 0), z, 0, yaw || 0, 0) : X(x, 0.3, z, 0, yaw || 0, PI / 2),
      col: (cx, cy, cz) => (Math.abs(upright ? cy : cx) > 0.2 ? COL.oakDark : COL.oakLight) });
  }
  function sackAt(W, x, z, seed, lift) {
    put(W, ctx.jitterGeo(new THREE.BoxGeometry(0.48, 0.55, 0.38), 0.1, seed), COL.sack, { m: X(x, 0.27 + (lift || 0), z, 0, seed * 0.7, 0) });
  }
  function fire(W, x, z) {
    const y = ctx.groundY(x, z);
    frame(W, x, y, z, 0); W.shadeH = 1.5; W.lo = 0.7; W.shade = null;
    put(W, new THREE.CircleGeometry(0.62, 7).rotateX(-PI / 2), COL.ash, { m: X(0, 0.04, 0), sh: false });
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; put(W, ctx.jitterGeo(new THREE.OctahedronGeometry(0.17), 0.08, 60 + k), COL.stone, { m: X(Math.sin(a) * 0.62, 0.08, Math.cos(a) * 0.62) }); }
    for (let k = 0; k < 3; k++) put(W, box(0.12, 0.12, 0.85), COL.oakDark, { m: X(0, 0.12, 0, 0.15, k * PI / 3, 0), t: 0.7 });
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + 0.4; beam(W, [Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8], [0, 1.55, 0], 0.07, COL.oak); }
    beam(W, [0, 1.55, 0], [0, 0.98, 0], 0.03, COL.iron);
    put(W, new THREE.CylinderGeometry(0.28, 0.22, 0.38, 7), COL.iron, { m: X(0, 0.78, 0) });
    flames.push({ x, y: y + 0.18, z, s: 1 });
    fires.push([x, z]);
    ctx.addLantern(ctx.v(x, y + 0.45, z));
  }
  function lanternPost(W, x, z) {
    const y = ctx.groundY(x, z);
    frame(W, x, y, z, 0.6); W.shadeH = 2.2; W.lo = 0.7; W.shade = null;
    put(W, box(0.1, 2.1, 0.1), COL.oakDark, { m: X(0, 1.05, 0) });
    put(W, box(0.55, 0.07, 0.07), COL.oakDark, { m: X(0.24, 2.0, 0) });
    put(W, box(0.2, 0.28, 0.2), COL.glass, { m: X(0.45, 1.75, 0), sh: false });
    put(W, new THREE.ConeGeometry(0.17, 0.14, 4).rotateY(PI / 4), COL.iron, { m: X(0.45, 1.96, 0) });
    _v.set(0.45, 1.75, 0).applyMatrix4(W.M);
    ctx.addLantern(_v.clone());
  }
  function stonePile(W, x, z, n, r, seed) {
    const y = ctx.groundY(x, z);
    frame(W, x, y, z, seed); W.shadeH = 1.2; W.lo = 0.65; W.shade = null;
    const rnd = ctx.mulberry32(seed);
    for (let k = 0; k < n; k++) {
      const ring = k < 6 ? 0 : k < 9 ? 1 : 2, a = k * 2.4 + rnd();
      const d = ring === 0 ? 1.0 * r * 2 : ring === 1 ? 0.55 * r * 2 : 0;
      put(W, rock(r * (0.85 + 0.3 * rnd()), seed + k), rnd() < 0.5 ? COL.stone : COL.stoneLight, { m: X(Math.sin(a) * d, r * (0.8 + ring * 1.4), Math.cos(a) * d, rnd(), rnd(), rnd()) });
    }
  }
  function buildCamp(W, K) {
    pavilion(W, K, -10, 72);
    bellTent(W, K, -20, 63.5, 0.3, 2.3);
    bellTent(W, K, -31, 70, -0.4, 2.2);
    bellTent(W, K, -22, 78.5, 0.2, 2.4);
    bellTent(W, K, 13.5, 79, -0.3, 2.2);
    ridgeTent(W, K, -33, 60.5, 0.35);
    ridgeTent(W, K, -12, 61, -0.15);
    ridgeTent(W, K, 25, 81, 0.25);
    ridgeTent(W, K, 34.5, 83, -0.2);
    // the Lion banner (DESIGN.md 2: the commander's square banner by the pavilion), and two more on poles
    {
      const [bx, bz] = S.lionBanner, by = ctx.groundY(bx, bz);
      frame(W, bx, by, bz, 0); W.shadeH = 7; W.lo = 0.75; W.shade = null;
      put(W, new THREE.CylinderGeometry(0.06, 0.08, 7.0, 6), COL.oakDark, { m: X(0, 3.5, 0) });
      put(W, new THREE.OctahedronGeometry(0.13), COL.gold, { m: X(0, 7.1, 0) });
      for (const a of [0, 2.1, 4.2]) beam(W, [0, 0.9, 0], [Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7], 0.06, COL.oak);
      flag(K, bx + 0.06, by + 6.9, bz, 0, 1.6, 1.6, 'banner', true);
      BANNER_TAG.set(bx + 0.8, by + 6.1, bz);
    }
    for (const [x, z, yaw] of [[-5, 69.5, 0.2], [-15.5, 75.5, -0.1]]) {
      const y = ctx.groundY(x, z);
      frame(W, x, y, z, 0); W.shadeH = 4; W.lo = 0.75;
      put(W, new THREE.CylinderGeometry(0.05, 0.06, 4.6, 6), COL.oakDark, { m: X(0, 2.3, 0) });
      flag(K, x + 0.05, y + 4.5, z, yaw, 0.9, 0.9, 'banner');
    }
    // wagons, the horse line (posts and a rope rail, hay, a trough), fires, lanterns, barrels and sacks
    wagon(W, -15, 83, 0.45, false, 70);
    wagon(W, -40, 66, 1.45, true, 74);
    {
      // the horse line, where people.js tethers the six Lion horses (x 36.5-47.5, z 64, heads north): a tethering post
      // between each pair of heads with a coil of halter rope (no rail across their way out at 108), and the hay and the
      // water trough behind them
      const z = 62.4;
      for (const x of [35.4, 37.6, 39.8, 42.0, 44.2, 46.4]) {
        const y = ctx.groundY(x, z); frame(W, x, y, z, 0); W.shadeH = 1.4;
        put(W, box(0.14, 1.4, 0.14), COL.oakDark, { m: X(0, 0.62, 0) });
        put(W, box(0.22, 0.1, 0.22), COL.rope, { m: X(0, 1.02, 0) });
      }
      for (const [hx, hz] of [[51.2, 65.2], [33.4, 66.2]]) { const y = ctx.groundY(hx, hz); frame(W, hx, y, hz, hx); put(W, ctx.jitterGeo(new THREE.ConeGeometry(0.9, 0.9, 7), 0.15, 80), COL.hay, { m: X(0, 0.42, 0) }); }
      { const y = ctx.groundY(42, 67.3); frame(W, 42, y, 67.3, 0); put(W, box(1.9, 0.42, 0.5), COL.oak, { m: X(0, 0.21, 0) }); put(W, box(1.7, 0.03, 0.36), COL.water, { m: X(0, 0.4, 0), sh: false }); }
      HORSE_LINE.x0 = 36.5; HORSE_LINE.x1 = 47.5; HORSE_LINE.z = 64;
    }
    fire(W, -16, 69); fire(W, -27.5, 74.5); fire(W, 13, 73);
    for (const [x, z] of [[-14.5, 66.5], [-26, 66.5], [-6.5, 77], [-24.5, 74.5], [17.5, 76.5], [-34.5, 75.5]]) lanternPost(W, x, z);
    for (const [x, z, k] of [[-11.5, 79.5, 0], [-36, 64, 1], [9, 83.5, 2], [29, 77.5, 3], [-27, 82, 4]]) {
      const y = ctx.groundY(x, z);
      frame(W, x, y, z, k * 1.3); W.shadeH = 1; W.lo = 0.7;
      barrelAt(W, 0, 0, true, 0.2); barrelAt(W, 0.66, 0.12, true, 0.9); barrelAt(W, 0.25, 0.75, false, 0.4);
      sackAt(W, -0.62, 0.2, 90 + k); sackAt(W, -0.55, 0.72, 95 + k);
    }
    // stones for the trebuchets, piled beside them
    stonePile(W, -27.8, 49.5, 10, 0.4, 101);
    stonePile(W, 29.5, 51, 8, 0.3, 117);
  }
  const BANNER_TAG = new THREE.Vector3();
  const HORSE_LINE = { x0: 0, x1: 0, z: 0 };

  // =====================================================================================================
  // ARROWS (research 4c; Froissart: "so thick, that it seemed snow"). Never near anyone (BRIEF.md rules).
  // =====================================================================================================
  const arrows = [];
  const ARCHERS = { lion: [], bull: [] };
  function isWater(x, z) { return ctx.groundY(x, z) < S.moat.level + 0.05; }
  // Built at init from our own guesses, and again on the first frame once armies.js has said where its archers stand
  // and draw (ctx.armies.lionLoose / bullLoose): then every arrow leaves a real bow as it looses.
  function makeArrows() {
    arrows.length = 0; ARCHERS.lion.length = 0; ARCHERS.bull.length = 0;
    const rnd = ctx.mulberry32(1415);
    const R = (a, b) => a + (b - a) * rnd();
    const sgn = () => (rnd() < 0.5 ? -1 : 1);
    const AM = ctx.armies && ctx.armies.lionLoose && ctx.armies.lionLoose.length && ctx.armies.bullLoose && ctx.armies.bullLoose.length ? ctx.armies : null;
    if (AM) {
      for (const p of AM.lionLoose) ARCHERS.lion.push(p.slice());
      for (const p of AM.bullLoose) ARCHERS.bull.push(p.slice());
    } else {
      // where they leave from: two archers behind each pavise and a second rank; Bull archers at the crenels
      for (const p of spots.PAVISES) for (const o of [-0.5, 0.5]) ARCHERS.lion.push([p.x + o, p.y + 1.45, p.z + 1.05]);
      for (const x of [-17, -10, 10, 17]) ARCHERS.lion.push([x, ctx.groundY(x, 19.5) + 1.5, 19.5]);
      for (const x of [-13, -11, -9, -7.5, 7.5, 9, 13]) ARCHERS.bull.push([x, S.curtain.h + 0.9, -10.85]);
      for (const x of [-5, 5]) ARCHERS.bull.push([x, S.gatehouse.h + 0.9, -6.75]);
      for (const [cx, a] of [[18, 0.25], [18, -0.35], [-18, 0.95], [-18, -1.0]]) ARCHERS.bull.push([cx + 4.75 * Math.sin(a), S.towerH + 0.9, -12 + 4.75 * Math.cos(a)]);
    }
    // from the volley before the stone, the two Bull archers who stood on the parapet that breaks have gone: leave them out
    const bullAfter = ARCHERS.bull.filter((f) => Math.hypot(f[0] - S.breach.point[0], f[2] - S.breach.point[2]) > 3);
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const vl of TM.volleys) {
      const lionSide = vl.side === 'lion';
      const from = lionSide ? ARCHERS.lion : AM && vl.t > TM.breakAt - 3 ? bullAfter : ARCHERS.bull;
      const kinds = lionSide ? ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'tower', 'tower', 'tower', 'gate', 'gate', 'moat', 'moat', 'moat', 'moat', 'grass', 'grass']
        : ['pavise', 'pavise', 'pavise', 'pavise', 'pavise', 'pavise', 'ground', 'ground', 'ground', 'ground', 'moatS', 'moatS'];
      const order = from.map((_, i) => i).sort(() => rnd() - 0.5);
      kinds.forEach((kind, k) => {
        const f = from[order[k % order.length]];
        const lag = R(0, 0.28);
        const a = { t0: vl.t + (AM ? lag * 0.15 : lag), P0: v(f[0] + R(-0.2, 0.2) * (AM ? 0.3 : 1), f[1] + R(-0.1, 0.15) * (AM ? 0.3 : 1), f[2]), P1: v(), type: 'stick', foot: null, sink: false };
        a.t1 = a.t0 + vl.flight;
        a.h = lionSide ? R(7, 11) : R(3, 5);
        if (kind === 'wall') { a.P1.set(sgn() * R(6.8, 13.2), R(6, 9.4), -11.1); a.type = 'drop'; a.foot = v(a.P1.x + R(-0.4, 0.4), 0, R(-10.9, -10.2)); }
        else if (kind === 'tower') { const cx = sgn() * 18, ang = R(-0.6, 0.6) + (cx < 0 ? 0.25 : -0.25); a.P1.set(cx + 4.5 * Math.sin(ang), R(6, 11), -12 + 4.5 * Math.cos(ang)); a.type = 'drop'; a.foot = v(cx + 5.1 * Math.sin(ang), 0, -12 + 5.1 * Math.cos(ang)); }
        else if (kind === 'gate') { a.P1.set(sgn() * R(2.3, 5.5), R(7, 13), -7.0); a.type = 'drop'; a.foot = v(a.P1.x, 0, -6.5); }
        else if (kind === 'moat' || kind === 'moatS') {
          let x = 0, z = 0;
          for (let tries = 0; tries < 20; tries++) { x = sgn() * (kind === 'moat' ? R(6, 26) : R(6, 25)); z = kind === 'moat' ? R(-6, 1.5) : R(0, 3); if (isWater(x, z)) break; }
          a.P1.set(x, S.moat.level, z); a.type = 'sink';
        }
        else if (kind === 'grass') { const x = sgn() * R(7, 13); const z = R(-10.7, -9.6); a.P1.set(x, ctx.groundY(x, z), z); }
        else if (kind === 'ground') { const x = rnd() < 0.7 ? R(-19, -6) : R(6, 11), z = R(8, 13.5); a.P1.set(x, ctx.groundY(x, z), z); }
        else if (kind === 'pavise') { const p = pavises[Math.floor(rnd() * pavises.length)]; paviseFront(p, R(-0.3, 0.3), R(0.45, 1.4), a.P1); }
        // where it falls to from a wall: the island's grass, or the water (it sinks)
        if (a.foot) { const g = ctx.groundY(a.foot.x, a.foot.z); if (g < S.moat.level + 0.05) { a.foot.y = S.moat.level; a.sinkAfter = true; } else a.foot.y = g + 0.04; }
        // the direction at impact, its rest pose, and how far it goes in
        const dir = v(a.P1.x - a.P0.x, a.P1.y - a.P0.y - 4 * a.h, a.P1.z - a.P0.z).normalize();
        a.qHit = new THREE.Quaternion().setFromUnitVectors(ZAX, dir);
        a.rest = a.P1.clone().addScaledVector(dir, a.type === 'stick' ? 0.2 : 0);
        if (a.type === 'drop') {
          const yaw = R(0, TAU);
          a.qLie = new THREE.Quaternion().setFromUnitVectors(ZAX, v(Math.sin(yaw), -0.05, Math.cos(yaw)).normalize());
          a.tFall = Math.sqrt(2 * Math.max(0.2, a.P1.y - a.foot.y) / 9.8);
        }
        arrows.push(a);
      });
    }
    arrows.sort((a, b) => a.t0 - b.t0);
  }

  // =====================================================================================================
  // EFFECTS: smoke, dust and spray (puffs), and stones, balls and bits (debris)
  // =====================================================================================================
  const puffs = [], debris = [];
  let WIND_X = 1, WIND_Z = 0;
  function makeEffects() {
    const rnd = ctx.mulberry32(1399);
    const R = (a, b) => a + (b - a) * rnd();
    const smokeC = L(ctx.C.smoke), smoke2 = L(0xdcd4c6), dustC = L(0xd9c9a0), earthC = L(0x9a8463), sprayC = L(0xf2f6f4);
    const puff = (o) => puffs.push(Object.assign({ v: [0, 0, 0], drag: 0, g: 0, wind: 0, rise: 0, s0: 0.3, s1: 1, a0: 0.6, life: 2, col: smokeC, floor: -99 }, o));
    const bit = (o) => debris.push(Object.assign({ v: [0, 0, 0], g: 9.8, r: 0.08, col: L(COL.stone), mode: 'fade', stay: 2.5, spin: R(2, 8) }, o));
    const dust = (t, p, n, size, col, out) => {
      for (let i = 0; i < n; i++) puff({ t0: t + i * 0.03, life: R(2.2, 3.2), p: [p[0] + R(-0.3, 0.3), p[1] + R(-0.2, 0.3), p[2] + R(-0.2, 0.2)],
        v: [R(-1.5, 1.5) + out[0] * R(1.5, 3), R(0.5, 2), R(-0.6, 0.6) + out[2] * R(1.5, 3)], drag: 2, wind: 0.4, rise: 0.6, s0: 0.35 * size, s1: R(1.2, 1.7) * size, a0: 0.75, col });
    };
    const splash = (t, p, size, drops) => {
      for (let i = 0; i < 6; i++) puff({ t0: t + i * 0.02, life: R(1.4, 1.9), p: [p[0] + R(-0.4, 0.4) * size, p[1], p[2] + R(-0.4, 0.4) * size], v: [R(-0.6, 0.6), R(5.5, 8.5) * Math.sqrt(size), R(-0.6, 0.6)],
        g: 9.8, s0: 0.35 * size, s1: R(0.9, 1.4) * size, a0: 0.9, col: sprayC, floor: p[1] - 0.2 });
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; puff({ t0: t + 0.05, life: R(1.6, 2.2), p: [p[0], p[1] + 0.1, p[2]], v: [Math.sin(a) * 2.6 * size, 0.6, Math.cos(a) * 2.6 * size], drag: 1.5, s0: 0.4 * size, s1: 1.2 * size, a0: 0.6, col: sprayC }); }
      for (let i = 0; i < drops; i++) bit({ t0: t, p: [p[0], p[1] + 0.2, p[2]], v: [R(-2.5, 2.5) * size, R(4, 8) * Math.sqrt(size), R(-2.5, 2.5) * size], r: R(0.07, 0.13) * size, col: sprayC, land: p[1], mode: 'vanish' });
    };
    // the guns: smoke from every shot, then dust and chips on the wall (Lion) or earth in the empty field (Bull)
    for (const s of TM.gunShots) {
      const g = s.side === 'lion' ? lionGuns[s.gun] : bullGuns[s.gun];
      const M = g.muzzle, fx = g.fwd[0], fz = g.fwd[1], big = s.big ? 1.35 : s.side === 'lion' ? 0.85 : 0.72;
      for (let i = 0; i < 3; i++) puff({ t0: s.t, life: 3.4 + i * 0.5, p: [M.x + fx * 0.3, M.y, M.z + fz * 0.3], v: [fx * (6 + 2.5 * i) * big + R(-0.6, 0.6), R(0.6, 1.3), fz * (6 + 2.5 * i) * big + R(-0.6, 0.6)],
        drag: 2.3, wind: 0.6, rise: 0.8, s0: 0.35 * big, s1: (1.3 + 0.4 * i) * big, a0: 0.85, col: smokeC });
      for (let i = 0; i < 3; i++) puff({ t0: s.t + 0.12, life: R(9.5, 12), p: [M.x + fx * (1 + i * 0.9) * big, M.y + 0.2, M.z + fz * (1 + i * 0.9) * big], v: [fx * 1.2, 0.3, fz * 1.2],
        drag: 0.8, wind: 0.9, rise: 2.8, s0: 0.8 * big, s1: R(2.4, 3.3) * big, a0: 0.42, col: smoke2 });
      const H = s.hit;
      if (s.side === 'lion') {
        dust(s.hitAt, [H[0], H[1], H[2] + 0.25], 5, s.big ? 1.2 : 0.8, dustC, [0, 0, 1]);
        for (let i = 0; i < 5; i++) bit({ t0: s.hitAt, p: [H[0], H[1], H[2] + 0.15], v: [R(-1.6, 1.6), R(-0.5, 2), R(0.6, 2.2)], r: R(0.06, 0.13), col: L(i % 2 ? COL.stoneLight : 0xc8b688), land: 0.03, mode: 'fade', stay: 3 });
        // the ball drops to the wall's foot and lies there till the mist
        bit({ t0: s.hitAt, p: [H[0], H[1], H[2] + 0.3], v: [R(-0.3, 0.3), 0.5, 0.8], r: s.big ? 0.27 : 0.15, col: L(COL.stone), land: (s.big ? 0.27 : 0.15) * 0.8, mode: 'rest', spin: 3, ball: true });
      } else {
        for (let i = 0; i < 3; i++) puff({ t0: s.hitAt + i * 0.03, life: R(1.8, 2.4), p: [H[0] + R(-0.3, 0.3), H[1] + 0.2, H[2] + R(-0.3, 0.3)], v: [R(-0.8, 0.8), R(2.5, 4.5), R(-0.8, 0.8)], drag: 2, wind: 0.4, s0: 0.3, s1: R(1.0, 1.5), a0: 0.75, col: earthC });
        for (let i = 0; i < 7; i++) bit({ t0: s.hitAt, p: [H[0], H[1] + 0.1, H[2]], v: [R(-2.2, 2.2), R(3.5, 6.5), R(-2.2, 2.2)], r: R(0.07, 0.14), col: L(i % 2 ? COL.earth : 0x5f7a38), land: H[1] + 0.03, mode: 'fade', stay: 1.5 });
      }
    }
    // the trebuchet stones: a splash in the moat (28.5), dust on the curtain (42.5) and on the tower (58)
    for (const s of TM.treb) {
      if (s.hit === 'splash') splash(s.impact, s.at, 1.25, 12);
      else if (s.hit === 'wall') {
        dust(s.impact, [s.at[0], s.at[1], s.at[2] + 0.3], 7, 1.3, dustC, [0, 0, 1]);
        for (let i = 0; i < 6; i++) bit({ t0: s.impact, p: [s.at[0], s.at[1], s.at[2] + 0.2], v: [R(-2, 2), R(0, 2.5), R(0.5, 2.5)], r: R(0.07, 0.15), col: L(i % 2 ? COL.stoneLight : 0xc8b688), land: 0.03, mode: 'fade', stay: 4 });
        bit({ t0: s.impact, p: [s.at[0], s.at[1], s.at[2] + 0.35], v: [0.3, 0.8, 0.9], r: T2.stoneR, col: L(COL.stoneLight), land: T2.stoneR * 0.8, mode: 'rest', spin: 2, ball: true });
      }   // (the breach's dust and falling pieces are castle.js's own)
    }
    // the stones dropped on the ram's roof (Vegetius IV.23): each falls from the barbican, cracks the roof and
    // tumbles off into the moat with a splash
    const roofZ = S.ramPath[S.ramPath.length - 1][1] - 1.9;
    TM.ram.roofStones.forEach((rs, i) => {
      const side = i % 2 ? 1 : -1, x0 = side * 0.35, top = S.barbican.h + 0.5, roofY = ctx.surfaceY(0, roofZ) + RAM_RIDGE + 0.15 - 0.08 * i;
      const tf = Math.sqrt(2 * (top - roofY) / 9.8);
      bit({ t0: rs - tf, p: [x0, top, roofZ], v: [0, 0, 0], r: 0.26, col: L(COL.stoneLight), land: roofY, mode: 'handoff', spin: 1.5, emerge: true });
      const vx = side * 2.6, vy = 2.2, vz = 0.5;
      let wx = x0, wz = roofZ;
      { // where it comes down, beside the bridge
        const tl = (vy + Math.sqrt(vy * vy + 2 * 9.8 * (roofY - S.moat.level))) / 9.8; wx = x0 + vx * tl; wz = roofZ + vz * tl;
        bit({ t0: rs, p: [x0, roofY, roofZ], v: [vx, vy, vz], r: 0.26, col: L(COL.stoneLight), land: S.moat.level - 0.3, mode: 'vanish', spin: 4 });
        splash(rs + tl, [wx, S.moat.level, wz], 0.55, 5);
      }
      dust(rs, [x0, roofY, roofZ], 3, 0.8, L(0xc9b79a), [0, 0.3, 0.6]);
      for (let k = 0; k < 4; k++) bit({ t0: rs, p: [x0, roofY, roofZ], v: [R(-2, 2), R(1, 3.5), R(-1, 2)], r: R(0.06, 0.1), col: L(COL.oakLight), land: 0.3, mode: 'fade', stay: 1.5 });
    });
    // the roof caves in (100): dust and splinters
    dust(TM.ram.cave, [0, ctx.surfaceY(0, roofZ + 1.9) + 2.4, roofZ + 1.9], 7, 1.4, L(0xc9b79a), [0, 0.3, 0.8]);
    for (let k = 0; k < 6; k++) bit({ t0: TM.ram.cave, p: [R(-1, 1), ctx.surfaceY(0, 1.6) + 2.4, 1.6 + R(-1.5, 1.5)], v: [R(-2.5, 2.5), R(1, 3), R(-1, 2)], r: R(0.06, 0.12), col: L(COL.oak), land: 0.3, mode: 'fade', stay: 2 });
    // land times for the debris
    for (const d of debris) {
      if (d.g === 0) { d.tLand = 0; continue; }
      const h = d.p[1] - d.land;
      d.tLand = (d.v[1] + Math.sqrt(Math.max(0, d.v[1] * d.v[1] + 2 * d.g * h))) / d.g;
    }
    puffs.sort((a, b) => a.t0 - b.t0);
  }

  // =====================================================================================================
  // INIT
  // =====================================================================================================
  let skinMesh, bones = [];
  const BN = {};
  function setBone(i, m) { const b = bones[i]; b.matrix.copy(m); b.matrixWorldNeedsUpdate = true; }
  let smokeMesh, smokeAlpha, debrisMesh, arrowMesh, flashMesh, flameMesh;
  const FU = { uFT: { value: 0 }, uFA: { value: 0.3 }, uFTap: { value: 0 } };
  let tapAt = -1e9;
  const RAM_TAG = new THREE.Vector3();
  const stoneShots = [];

  function init(c) {
    ctx = c; S = ctx.SIEGE; TM = S.times; spots = ctx.spots;
    WIND_X = ctx.wind.dir.x; WIND_Z = ctx.wind.dir.z;
    T1.yaw = Math.atan2(S.breach.point[0] - T1.x, S.breach.point[2] - T1.z);
    T2.yaw = Math.atan2(TM.treb[1].at[0] - T2.x, TM.treb[1].at[2] - T2.z);
    prepTreb(T1); prepTreb(T2);

    // the bones: 0 holds the flags still; the rest are the rigid moving parts
    let nb = 1;
    const nb1 = () => nb++;
    BN.t1 = { arm: nb1(), box: nb1(), wheelL: nb1(), wheelR: nb1(), sling: nb1(), rope: nb1() };
    BN.t2 = { arm: nb1(), box: nb1(), capstan: nb1(), sling: nb1(), rope: nb1() };
    BN.ramBody = nb1(); BN.ramWheels = [nb1(), nb1(), nb1(), nb1()]; BN.ramLog = nb1(); BN.ramRopes = nb1(); BN.ramRoofL = nb1(); BN.ramRoofR = nb1();
    BN.lionBarrel = [0, 1, 2, 3, 4].map(nb1); BN.lionShutter = [0, 1, 2, 3, 4].map(nb1); BN.bullBarrel = [0, 1, 2, 3, 4].map(nb1);

    const W = builder(false), K = builder(true);
    const t1Wheels = buildTreb(W, K, T1, BN.t1);
    buildTreb(W, K, T2, BN.t2);
    buildRam(K, BN);
    spots.LION_GUNS.forEach((G, i) => buildLionGun(W, K, G, i, BN));
    spots.BULL_GUNS.forEach((G, i) => buildBullGun(W, K, G, i, BN));
    for (const s of TM.gunShots) if (s.side === 'lion') lionGuns[s.gun].shots.push(s.t); else bullGuns[s.gun].shots.push(s.t);
    spots.PAVISES.forEach((P, i) => buildPavise(W, P, i));
    buildCamp(W, K);
    // the brazier by the Lion guns (research 16f: hot coals for the touch-iron)
    const brz = { x: -27.2, z: 34.2 };
    {
      const y = ctx.groundY(brz.x, brz.z); brz.y = y;
      frame(W, brz.x, y, brz.z, 0); W.shadeH = 1; W.lo = 0.7;
      for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; beam(W, [Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45], [Math.sin(a) * 0.2, 0.8, Math.cos(a) * 0.2], 0.05, COL.iron); }
      put(W, new THREE.CylinderGeometry(0.36, 0.2, 0.26, 7, 1, true), COL.iron, { m: X(0, 0.88, 0) });
      put(W, new THREE.CircleGeometry(0.3, 7).rotateX(-PI / 2), 0x6a3018, { m: X(0, 0.92, 0), sh: false });
      flames.push({ x: brz.x, y: y + 0.93, z: brz.z, s: 0.45, coal: true });
      ctx.addLantern(ctx.v(brz.x, y + 1.05, brz.z));
    }

    // the static world: one mesh, merged by the base with the rest of the world on the first frame
    const worldMat = ctx.mat(0xffffff, { vertexColors: true });
    ctx.world.add(new THREE.Mesh(finish(W), worldMat));

    // the moving parts: one skinned mesh, rigid bones; flags flutter in its vertex shader
    const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0, skinning: true });
    skinMat.userData.extraKey = 'siegeworks-skin';
    skinMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, FU);
      sh.vertexShader = 'attribute vec4 aFlap;\nuniform float uFT;\nuniform float uFA;\nuniform float uFTap;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'if (aFlap.w > 0.0) {',
        '  vec3 fn = aFlap.xyz; float big = step(1.5, length(fn)); fn = normalize(fn);',
        '  float ph = uFT * 3.1 - aFlap.w * 3.4 + position.x * 0.23 + position.z * 0.19;',
        '  float amp = uFA * (1.0 + big * uFTap * 1.8);',
        '  transformed += fn * aFlap.w * amp * (0.55 * sin(ph) + 0.22 * sin(1.9 * ph + 1.1));',
        '  transformed.y += big * uFTap * aFlap.w * 0.18;',
        '}',
      ].join('\n'));
    };
    const geo = finish(K);
    for (let i = 0; i < nb; i++) { const b = new THREE.Bone(); b.matrixAutoUpdate = false; bones.push(b); }
    skinMesh = new THREE.SkinnedMesh(geo, skinMat);
    for (const b of bones) skinMesh.add(b);
    skinMesh.updateMatrixWorld(true);
    skinMesh.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
    skinMesh.frustumCulled = false;
    ctx.root.add(skinMesh);

    // smoke, dust and spray: faceted blobs with their own alpha (as in Gettysburg's artillery)
    {
      const g = ctx.jitterGeo(new THREE.IcosahedronGeometry(1, 0), 0.28, 5);
      smokeAlpha = new THREE.InstancedBufferAttribute(new Float32Array(160), 1);
      smokeAlpha.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aAlpha', smokeAlpha);
      const sm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: ctx.lin(ctx.C.smoke).multiplyScalar(0.28), flatShading: true, roughness: 1, metalness: 0, transparent: true, depthWrite: false });
      sm.userData.extraKey = 'siegeworks-smoke';
      sm.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute float aAlpha;\nvarying float vAlpha;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
        sh.fragmentShader = 'varying float vAlpha;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vAlpha;');
      };
      smokeMesh = new THREE.InstancedMesh(g, sm, 160);
      for (let k = 0; k < 160; k++) { smokeMesh.setMatrixAt(k, ZERO); smokeMesh.setColorAt(k, _c.set(1, 1, 1)); }
      smokeMesh.count = 0; smokeMesh.frustumCulled = false; smokeMesh.renderOrder = 2;
      ctx.root.add(smokeMesh);
    }
    // stones, balls, chips, clods and drops
    {
      const g = ctx.jitterGeo(new THREE.IcosahedronGeometry(1, 0), 0.18, 9);
      debrisMesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, metalness: 0 }), 150);
      for (let k = 0; k < 150; k++) { debrisMesh.setMatrixAt(k, ZERO); debrisMesh.setColorAt(k, _c.set(1, 1, 1)); }
      debrisMesh.count = 0; debrisMesh.frustumCulled = false;
      ctx.root.add(debrisMesh);
    }
    // arrows: a steel head, a shaft, grey-white fletching; the tip at the origin, the shaft back along -z
    makeArrows();
    {
      // 11 triangles: a three-sided shaft, a three-sided head, one fletching vane (double-sided)
      const A = builder(false); A.shade = () => 1;
      const tri3 = (r, z0, z1, rTip) => {
        const g = new THREE.BufferGeometry(), p = [];
        for (let k = 0; k < 3; k++) {
          const a0 = k / 3 * TAU, a1 = (k + 1) / 3 * TAU, x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
          if (rTip === 0) p.push(x0, y0, z0, x1, y1, z0, 0, 0, z1);
          else p.push(x0, y0, z0, x1, y1, z0, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y0, z1);
        }
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        return g;
      };
      put(A, tri3(0.055, -0.15, 0, 0), COL.ironLight);
      put(A, tri3(0.028, -0.86, -0.15, 1), 0xb08d62);
      put(A, new THREE.PlaneGeometry(0.16, 0.22), 0xe8e4da, { m: X(0, 0, -0.75, 0, PI / 2, 0) });
      arrowMesh = new THREE.InstancedMesh(finish(A), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }), arrows.length);
      arrowMesh.count = 0; arrowMesh.frustumCulled = false;
      ctx.root.add(arrowMesh);
    }
    // muzzle flashes: a star of two octahedra, additive
    {
      const a = new THREE.OctahedronGeometry(1, 0), b = new THREE.OctahedronGeometry(0.8, 0).rotateZ(PI / 4);
      const fp = new Float32Array(a.attributes.position.array.length + b.attributes.position.array.length);
      fp.set(a.attributes.position.array, 0); fp.set(b.attributes.position.array, a.attributes.position.array.length);
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
      flashMesh = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ color: ctx.lin(0xffa040).multiplyScalar(1.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 4);
      flashMesh.count = 0; flashMesh.frustumCulled = false;
      ctx.root.add(flashMesh);
    }
    // flames: the cooking fires and the brazier's coals
    {
      const g = ctx.jitterGeo(new THREE.OctahedronGeometry(1, 0), 0.25, 3).scale(1, 1.8, 1).translate(0, 1.2, 0);
      flameMesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), flames.length * 2);
      flames.forEach((f, k) => { flameMesh.setColorAt(k * 2, ctx.lin(f.coal ? 0xff5a1e : 0xff8a2a)); flameMesh.setColorAt(k * 2 + 1, ctx.lin(f.coal ? 0xffb040 : 0xffd060)); });
      flameMesh.frustumCulled = false;
      ctx.root.add(flameMesh);
    }
    makeEffects();
    // the trebuchet stones: loaded, whirled, flown, and what becomes of them
    for (const [k, s] of TM.treb.entries()) {
      const E = s.engine === 't1' ? T1 : T2;
      const ti = E.triggers.indexOf(s.release);
      const st = { phi: 0, psi: 0, lean: 0, roll: 0, mode: 'release', s: E.D, fall: 0 };
      st.phi = releasePhi(E, E.D);
      armLocal(E, st);
      const p = pouchLocal(E, st, { x: 0, y: 0, z: 0 });
      const P0 = new THREE.Vector3(p.x, p.y + E.stoneR * 0.5, p.z).applyMatrix4(E.M);
      stoneShots.push({ E, load: E.loads[ti], release: s.release, tRel: s.release + E.D, impact: s.impact, P0, P1: new THREE.Vector3(s.at[0], s.at[1], s.at[2]), hit: s.hit, k });
    }

    // where the stuff is, for the people and the armies
    const t1W = t1Wheels.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(T1.M));
    const T1axle = new THREE.Vector3(0, T1.H, 0).applyMatrix4(T1.M), T2axle = new THREE.Vector3(0, T2.H, 0).applyMatrix4(T2.M);
    const cap = new THREE.Vector3(0, 0, T2.capstan.z).applyMatrix4(T2.M);
    const sg = ctx.siege = ctx.siege || {};
    sg.t1 = {
      x: T1.x, y: T1.y, z: T1.z, yaw: T1.yaw, axle: T1axle, wheels: t1W, wheelAxis: new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, T1.yaw),
      wheelR: T1.wheel.r, treadR: T1.wheel.r - 0.1 - 0.035, wheelAngle: 0, wheelAngleAt: t1Wheel, wheelSpeedAt: t1WheelSpeed,
      winds: T1.winds, loads: T1.loads, triggers: T1.triggers, pouch: T1.pouch, catchAt: new THREE.Vector3(0, 0, -T1.L * Math.sin(T1.phiC) - 0.6).applyMatrix4(T1.M),
      pile: new THREE.Vector3(-27.8, ctx.groundY(-27.8, 49.5), 49.5), armAt: (ct) => t1State(ct, {}).phi,
    };
    sg.t2 = {
      x: T2.x, y: T2.y, z: T2.z, yaw: T2.yaw, axle: T2axle, capstan: cap, barR: T2.capstan.bar, capstanAngle: 0, capstanAngleAt: t2Cap, capstanSpeedAt: t2CapSpeed,
      winds: T2.winds, loads: T2.loads, triggers: T2.triggers, cutAt: T2.cutAt, pouch: T2.pouch,
      pile: new THREE.Vector3(29.5, ctx.groundY(29.5, 51), 51), armAt: (ct) => t2State(ct, {}).phi,
    };
    // the working spots people.js asks for (world points), matched to this geometry so nobody stands in a stake
    const cockedPouch = (E) => { const st = { phi: E.phiC, psi: 0, lean: 0, mode: 'rest' }; armLocal(E, st); const p = pouchLocal(E, st, { x: 0, y: 0, z: 0 }); return new THREE.Vector3(p.x, 0, p.z).applyMatrix4(E.M); };
    const atE = (E, x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(E.M);
    Object.assign(sg.t1, { face: T1.yaw, wheelFloor: T1.wheel.y - (T1.wheel.r - 0.1 - 0.035), trough: cockedPouch(T1), trigger: atE(T1, 1.3, -T1.L * Math.sin(T1.phiC) - 0.2) });
    Object.assign(sg.t2, { face: T2.yaw, capstanR: T2.capstan.bar - 0.25, trough: cockedPouch(T2), trigger: atE(T2, 1.1, -T2.L * Math.sin(T2.phiC) - 0.2) });
    armLocal(T1, ST1); armLocal(T2, ST2);
    sg.lionGuns = lionGuns.map((g) => {
      const W = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(g.M);
      return g.big ? { loader: W(0.75, 2.1), gunner: W(1.1, -0.7), balls: W(-1.05, -1.55), ready: W(1.6, -2.2), muzzle: g.muzzle, shots: g.shots }
        : { loader: W(0.6, 1.15), gunner: W(0.75, -0.5), balls: W(-0.65, -1.15), ready: W(1.2, -1.7), muzzle: g.muzzle, shots: g.shots };
    });
    sg.ram = RAM; RAM.at = (ct, out) => ramAt(ct, out || {}); RAM.dist = ramS;
    sg.guns = {
      lion: lionGuns.map((g) => ({ x: g.x, y: g.y, z: g.z, yaw: g.yaw, big: g.big, muzzle: g.muzzle, shots: g.shots, shutter: 0, shutterAt: (ct) => shutterAt(g, ct), hinge: new THREE.Vector3(...g.hinge).applyMatrix4(g.M) })),
      bull: bullGuns.map((g) => ({ x: g.x, y: g.y, z: g.z, yaw: g.yaw, muzzle: g.muzzle, shots: g.shots, where: g.where })),
      brazier: new THREE.Vector3(brz.x, brz.y + 0.95, brz.z),
    };
    sg.archers = ARCHERS;
    sg.camp = { horseLine: HORSE_LINE, fires, tents };

    // labels (labels.js)
    ctx.tag('t1', () => T1axle, { r: 6 });
    ctx.tag('t2', () => T2axle, { r: 4.5 });
    ctx.tag('ram', () => RAM_TAG, { r: 2.6 });
    { const p = spots.PAVISES[7], v = ctx.v(p.x, p.y + 1.3, p.z); ctx.tag('pavise', () => v, { r: 1.3 }); }
    { const g = lionGuns[2], v = ctx.v(g.x, g.y + 1.3, g.z); ctx.tag('guns', () => v, { r: 4 }); }
    { const v = ctx.v(0, S.gatehouse.h + 1.0, -8.2); ctx.tag('bullGuns', () => v, { r: 3.5 }); }
    { const v = ctx.v(-14, ctx.groundY(-14, 70) + 2, 70); ctx.tag('camp', () => v, { r: 12 }); }
    // the banner lifts and streams out in a gust when it's tapped (nothing else happens)
    ctx.tag('lionBanner', () => BANNER_TAG, { r: 1.4, onTap: () => { tapAt = ctx.clock.elapsed; } });

    // camera floors: the engines, tents, wagons, guns, pavises and the ram (never over the castle's passages)
    for (const E of [T1, T2]) footprints.push({ x: E.x, z: E.z, hx: E.hw + E.out + 0.4, hz: E.len + 1.0, yaw: E.yaw, top: E.y + E.H + 1.2 });
    for (const g of lionGuns) footprints.push({ x: g.x, z: g.z, hx: g.big ? 1.4 : 1.0, hz: g.big ? 3.0 : 1.8, yaw: g.yaw, top: g.y + 2.6 });
    for (const p of pavises) footprints.push({ x: p.x, z: p.z, hx: 0.6, hz: 0.6, yaw: p.face, top: p.y + 2.4 });
    ctx.addCamFloor((x, z) => {
      let h = null;
      for (const f of footprints) {
        const dx = x - f.x, dz = z - f.z;
        if (f.r) { if (dx * dx + dz * dz < f.r * f.r && (h === null || f.top > h)) h = f.top; continue; }
        const c = Math.cos(f.yaw), s = Math.sin(f.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) < f.hx && Math.abs(lz) < f.hz && (h === null || f.top > h)) h = f.top;
      }
      // the ram, wherever it is
      const dx = x - RAM.x, dz = z - RAM.z, c = Math.cos(RAM.yaw), s = Math.sin(RAM.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < 1.9 && Math.abs(lz) < 2.7) { const top = RAM.y + 3.4 - 1.2 * RAM.broken; if (h === null || top > h) h = top; }
      return h;
    });
    update(ctx.clock.elapsed, 0);
  }

  // =====================================================================================================
  // UPDATE (a pure function of the cycle time; nothing allocated)
  // =====================================================================================================
  let aimed = false;
  function update(t) {
    const ct = ctx.cycle.t;
    if (!aimed && ctx.armies) { aimed = true; if (ctx.armies.lionLoose) makeArrows(); }
    FU.uFT.value = t;
    FU.uFA.value = 0.16 + 0.12 * ctx.wind.strength;
    { const u = (ctx.clock.elapsed - tapAt) / 4; FU.uFTap.value = u >= 0 && u < 1 ? Math.sin(PI * u) : 0; }

    // T1
    t1State(ct, ST1);
    placeTreb(T1, ST1, BN.t1, ct);
    const wa = t1Wheel(ct);
    for (let side = -1; side <= 1; side += 2) {
      _m.makeTranslation(side * T1.wheel.x, T1.wheel.y, T1.wheel.z).multiply(_m2.makeRotationX(wa));
      setBone(side < 0 ? BN.t1.wheelL : BN.t1.wheelR, _m2.multiplyMatrices(T1.M, _m));
    }
    ctx.siege.t1.wheelAngle = wa;
    windRope(T1, BN.t1.rope, ct, _v.set(0, T1.wheel.y + 0.38, T1.wheel.z));
    // T2
    t2State(ct, ST2);
    placeTreb(T2, ST2, BN.t2, ct);
    const ca = t2Cap(ct);
    _m.makeTranslation(0, 0, T2.capstan.z).multiply(_m2.makeRotationY(ca));
    setBone(BN.t2.capstan, _m2.multiplyMatrices(T2.M, _m));
    ctx.siege.t2.capstanAngle = ca;
    windRope(T2, BN.t2.rope, ct, _v.set(0, 0.45, T2.capstan.z + 0.3));
    // the ram
    placeRam(ct, BN);
    RAM_TAG.set(RAM.x, RAM.y + 2.6 - RAM.broken, RAM.z);
    // the guns
    for (const g of lionGuns) {
      const r = recoilAt(g, ct, g.big ? 0.16 : 0.28);
      _m.makeTranslation(0, 0, -r);
      setBone(BN.lionBarrel[g.i], _m2.multiplyMatrices(g.barrelBase, _m));
      const sh = shutterAt(g, ct);
      ctx.siege.guns.lion[g.i].shutter = sh;
      _m.makeTranslation(g.hinge[0], g.hinge[1], g.hinge[2]).multiply(_m2.makeRotationX(-1.32 * sh));
      setBone(BN.lionShutter[g.i], _m2.multiplyMatrices(g.M, _m));
    }
    for (const g of bullGuns) {
      _m.makeTranslation(0, 0, -recoilAt(g, ct, 0.22));
      setBone(BN.bullBarrel[g.i], _m2.multiplyMatrices(g.barrelBase, _m));
    }
    placeFlashes(ct);
    placeArrows(ct);
    placeSmoke(ct);
    placeDebris(ct);
    placeFlames(t);
  }

  // the winding rope from the drum (or capstan) to the arm: there while it's being wound, unhooked before the shot;
  // T2's is cut at 110 and lies in the grass till the mist
  function windRope(E, bone, ct, drumLocal) {
    let k = 0;
    for (const [a, b] of E.winds) k = Math.max(k, smooth((ct - (a - 0.8)) / 0.6) * (1 - smooth((ct - (b + 0.4)) / 0.5)));
    let cut = 0;
    if (E === T2 && ct >= E.winds[1][0] && ct < T2_UP[0]) { k = Math.max(k, smooth((ct - (E.winds[1][0] - 0.8)) / 0.6)); cut = ct >= E.cutAt ? easeIn(win(ct, E.cutAt, E.cutAt + 0.6)) : 0; }
    if (k <= 0.001) { setBone(bone, ZERO); return; }
    const a = _v2.copy(drumLocal).applyMatrix4(E.M);
    const b = _v3.set(0, E.L * 0.72, 0).applyMatrix4(E.armM);
    if (cut) b.lerp(_s.set(0.4, 0.06, E.capstan ? E.capstan.z + 3.5 : -2), cut);
    b.applyMatrix4(E.M);
    ropeBone(bone, a, _v.copy(b), k);
  }

  function placeFlashes(ct) {
    let n = 0;
    for (const s of TM.gunShots) {
      const age = ct - s.t;
      if (age < 0 || age >= 0.2 || n >= 4) continue;
      const g = s.side === 'lion' ? lionGuns[s.gun] : bullGuns[s.gun], k = Math.sin(PI * age / 0.2), sz = (s.big ? 1.1 : 0.6) * k;
      _v.copy(g.muzzle); _v.x += g.fwd[0] * 0.5 * k; _v.z += g.fwd[1] * 0.5 * k;
      _q.setFromAxisAngle(UP, g.yaw).multiply(_q2.setFromAxisAngle(ZAX, ct * 9));
      flashMesh.setMatrixAt(n++, _m.compose(_v, _q, _s.set(0.8 * sz, 0.8 * sz, 1.6 * sz)));
    }
    flashMesh.count = n;
    flashMesh.instanceMatrix.needsUpdate = true;
  }

  const _a = new THREE.Vector3();
  function placeArrows(ct) {
    let n = 0;
    if (ct < CLEAR_AT) for (const a of arrows) {
      if (ct < a.t0) break;
      let sc = 1;
      if (ct < a.t1) {
        const s = (ct - a.t0) / (a.t1 - a.t0);
        _a.lerpVectors(a.P0, a.P1, s); _a.y += 4 * a.h * s * (1 - s);
        _v.subVectors(a.P1, a.P0); _v.y += 4 * a.h * (1 - 2 * s);
        _q.setFromUnitVectors(ZAX, _v.normalize());
      } else if (a.type === 'stick') { _a.copy(a.rest); _q.copy(a.qHit); }
      else if (a.type === 'sink') {
        const u = (ct - a.t1) / 0.35; if (u >= 1) continue;
        _a.copy(a.P1); _a.y -= 0.3 * u; _q.copy(a.qHit); sc = 1 - u;
      } else {
        const tau = ct - a.t1;
        if (tau < a.tFall) {
          const u = tau / a.tFall;
          _a.lerpVectors(a.P1, a.foot, u); _a.y = a.P1.y - 0.5 * 9.8 * tau * tau; if (_a.y < a.foot.y) _a.y = a.foot.y;
          _q.slerpQuaternions(a.qHit, a.qLie, smooth(u));
        } else {
          if (a.sinkAfter) { const u = (tau - a.tFall) / 0.3; if (u >= 1) continue; sc = 1 - u; }
          _a.copy(a.foot); _a.y += 0.02; _q.copy(a.qLie);
          if (!a.sinkAfter) { _a.x += Math.sin(a.t0 * 7) * 0.05; }
        }
      }
      arrowMesh.setMatrixAt(n++, _m.compose(_a, _q, _s.set(sc, sc, sc)));
    }
    arrowMesh.count = n;
    arrowMesh.instanceMatrix.needsUpdate = true;
  }

  function placeSmoke(ct) {
    let n = 0;
    for (const p of puffs) {
      if (p.t0 > ct) break;
      const age = ct - p.t0;
      if (age >= p.life || n >= 160) continue;
      const u = age / p.life;
      const d = p.drag > 0 ? (1 - Math.exp(-p.drag * age)) / p.drag : age;
      const x = p.p[0] + p.v[0] * d + WIND_X * p.wind * age;
      const y = p.p[1] + p.v[1] * d - 0.5 * p.g * age * age + p.rise * Math.sqrt(u);
      const z = p.p[2] + p.v[2] * d + WIND_Z * p.wind * age;
      if (y < p.floor) continue;
      const size = p.s0 + (p.s1 - p.s0) * (1 - (1 - u) * (1 - u));
      const a = p.a0 * Math.min(1, age / 0.08) * Math.pow(1 - u, 1.3);
      if (a < 0.004) continue;
      smokeAlpha.setX(n, a);
      smokeMesh.setColorAt(n, p.col);
      _q.setFromAxisAngle(UP, p.t0 * 3.1 + age * 0.2);
      smokeMesh.setMatrixAt(n, _m.compose(_v.set(x, y, z), _q, _s.set(size, size * 0.85, size)));
      n++;
    }
    smokeMesh.count = n;
    smokeMesh.instanceMatrix.needsUpdate = true;
    smokeAlpha.needsUpdate = true;
    if (smokeMesh.instanceColor) smokeMesh.instanceColor.needsUpdate = true;
  }

  const STONE_COL = new THREE.Color(), BALL_COL = new THREE.Color();
  let nDeb = 0;
  const SPIN_AX = new THREE.Vector3(0.6, 0.7, 0.3).normalize();
  function emit(x, y, z, r, col, spin) {
    if (nDeb >= 150) return;
    _q.setFromAxisAngle(SPIN_AX, spin);
    debrisMesh.setMatrixAt(nDeb, _m.compose(_v.set(x, y, z), _q, _s.set(r, r, r)));
    debrisMesh.setColorAt(nDeb, col);
    nDeb++;
  }
  function placeDebris(ct) {
    nDeb = 0;
    if (STONE_COL.r === 0) { STONE_COL.copy(L(COL.stoneLight)); BALL_COL.copy(L(COL.stone)); }
    // the trebuchet stones: loaded into the pouch, whirled with the sling, then flying
    for (const s of stoneShots) {
      if (ct < s.load || ct >= (s.hit === 'wall' ? s.impact : s.impact + 0.02)) continue;
      const E = s.E;
      if (ct < s.tRel) {
        const k = easeOut(win(ct, s.load, s.load + 0.5));
        _v2.copy(E.pouch); _v2.y += E.stoneR * 0.5;
        emit(_v2.x, _v2.y, _v2.z, E.stoneR * k, STONE_COL, 0.3);
      } else {
        const u = (ct - s.tRel) / (s.impact - s.tRel);
        _v2.lerpVectors(s.P0, s.P1, u); _v2.y += 4 * E.apex * u * (1 - u);
        emit(_v2.x, _v2.y, _v2.z, E.stoneR, STONE_COL, u * 9);
      }
    }
    // the gun balls in flight (Lion to the wall, Bull to the empty field, where they bury themselves)
    for (const s of TM.gunShots) {
      const end = s.side === 'lion' ? s.hitAt : s.hitAt + 0.3;
      if (ct < s.t || ct >= end) continue;
      const r = s.side === 'lion' ? (s.big ? 0.27 : 0.15) : 0.13;
      if (ct < s.hitAt) {
        const u = (ct - s.t) / (s.hitAt - s.t), arc = s.side === 'lion' ? 0.6 : 3;
        emit(lerp(s.from[0], s.hit[0], u), lerp(s.from[1], s.hit[1], u) + 4 * arc * u * (1 - u), lerp(s.from[2], s.hit[2], u), r, BALL_COL, u * 6);
      } else emit(s.hit[0], s.hit[1] + r - 2 * r * smooth((ct - s.hitAt) / 0.3), s.hit[2], r, BALL_COL, 0);
    }
    // everything else that falls: chips, clods, drops, splinters, the balls at the wall's foot, the roof stones
    for (const d of debris) {
      const age = ct - d.t0;
      if (age < 0) continue;
      let x, y, z, r = d.r, spin;
      if (age < d.tLand) {
        x = d.p[0] + d.v[0] * age; z = d.p[2] + d.v[2] * age; y = d.p[1] + d.v[1] * age - 0.5 * d.g * age * age; spin = d.spin * age;
        if (d.emerge) r *= smooth(age / 0.15);
      } else {
        if (d.mode === 'handoff') continue;
        const tl = d.tLand, after = age - tl;
        x = d.p[0] + d.v[0] * tl; z = d.p[2] + d.v[2] * tl; y = d.land; spin = d.spin * tl;
        if (d.mode === 'vanish') { const u = after / 0.25; if (u >= 1) continue; r *= 1 - u; y -= 0.2 * u; }
        else if (d.mode === 'fade') { const u = (after - d.stay) / 0.5; if (u >= 1) continue; if (u > 0) r *= 1 - u; }
        else if (ct >= CLEAR_AT) continue;
      }
      emit(x, y, z, r, d.col, spin);
    }
    debrisMesh.count = nDeb;
    debrisMesh.instanceMatrix.needsUpdate = true;
    if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
  }

  function placeFlames(t) {
    const night = 1 - ctx.light.day;
    for (let k = 0; k < flames.length; k++) {
      const f = flames[k];
      const s = f.s * (1 - 0.3 * night) * (0.85 + 0.15 * Math.sin(t * 9 + k * 2.1) + 0.08 * Math.sin(t * 23 + k));
      const h = f.coal ? 0.25 : 1;
      flameMesh.setMatrixAt(k * 2, _m.compose(_v.set(f.x, f.y, f.z), _q.setFromAxisAngle(UP, t * 1.3 + k), _s.set(0.2 * s, 0.22 * s * h, 0.2 * s)));
      const s2 = s * (0.8 + 0.2 * Math.sin(t * 13 + k * 3.3));
      flameMesh.setMatrixAt(k * 2 + 1, _m.compose(_v.set(f.x, f.y + 0.02, f.z), _q.setFromAxisAngle(UP, -t * 1.7 + k), _s.set(0.11 * s2, 0.16 * s2 * h, 0.11 * s2)));
    }
    flameMesh.instanceMatrix.needsUpdate = true;
  }

  window.Scene.register({ name: 'siegeworks', init, update });
})();
