// engineer.js: a Lion trebuchet crewman for the castle siege (DESIGN §6, §9; research §6a; palette DESIGN §1).
// A camp worker, not a soldier: a knee-length tunic in Lion blue, hose, and a russet hood with a short shoulder cape
// (the hood of c. 1400; the cut is ours, research is silent on crew clothing), leather gloves, a belt with a
// mallet tucked through it on the right hip. No armour.
//   CHARACTERS.engineer.build(ctx, B, kit, rig)               → the sheet's engineer
//   CHARACTERS.engineer.make(ctx, B, kit, rig, { hair, beard, tunic, hood })  → a variant for a crew (hair colour hex,
//     beard 'none' | 'short', other tunic or hood colours)
// The stone (about 40 cm) shows by itself whenever both arms are turned in to hold it: at0 and at1 both 0.45 or more
// (the poses carry and lay do this). It grows in over the blend, so pick it up from the pile with the hands low.
// Poses (static, add to f.base): tread, haul, carry, lay, trigger, wipeBrow, wave, run.
// Motions (pure functions of time, for a Script's hold(dur, (s) => ({ pose: ... }))):
//   CHARACTERS.engineer.tread(f, t)   stepping steadily up the inside of a treadwheel, hands on the spokes
//   CHARACTERS.engineer.haul(f, t)    hand over hand on a rope, leaning back
//   CHARACTERS.engineer.moment(f, s)  the tap moment, 4.5 s: wipes his brow with his glove, then waves (s in 0..4.5)
//   f.runner                          a figure-like { stride, gait } for running away: S.walk(pts, 3.2, f.runner)
// On the sheet: &view=pose&pose=carry, &anim=tread|haul|moment|run to play a motion, &yaw=1.57 to turn it,
//   &p=af1:2.2,e1:1.7 to try angles.
(function () {
  'use strict';
  window.CHARACTERS = window.CHARACTERS || {};
  const PI = Math.PI, TAU = PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const win = (s, a, b, e) => smooth((s - a) / e) * (1 - smooth((s - (b - e)) / e));
  const C = { tunic: 0x2f4f9a, hood: 0x9a6b3f, hose: 0x6e5a44, shoe: 0x4e3a2a, glove: 0x8a5c38, belt: 0x4a3426,
    hair: 0xd2a865, skin: 0xf0c6a2, stone: 0xbdb5a2, malletHead: 0x9a7650, malletHandle: 0x7a5a3a };

  // put every pivot back at rest so the bake's bind pose is the built pose (Blocky.make leaves it in its base pose)
  function rest(f) {
    for (const n of [f.torso, f.head, f.skirt].concat(f.legs, f.knees, f.arms, f.elbows, f.hands)) n.rotation.set(0, 0, 0);
    f.hips.position.y = f.hipY;
    f.root.updateMatrixWorld(true);
  }
  function dims(f) {
    const S = f.spec, headH = f.H / S.heads, R = headH / 2, shHalf = S.shoulder * headH / 2, waistR = shHalf * S.waist;
    return { R, shHalf, waistR, hemR: waistR * S.hem, chestR: shHalf * 0.92, tl: f.chinY - f.hipY, armR: Math.max(0.035, shHalf * 0.24) };
  }
  // the mitten hands in leather: recolour the hand and thumb pieces Blocky.make made
  function gloves(f, rig, col) {
    for (let i = f.range[0]; i < rig.pieces.length; i++) if (f.hands.includes(rig.pieces[i].nd)) rig.pieces[i].color.setHex(col);
  }
  // the hood, up, close round the skull: a full crown and a band open only round the face, their facets lined up
  // (8 round, the opening is the front quarter). The hair shows in the opening only: a fringe under the brow of the
  // hood and locks down the temples, cut on the hood's own facets a little inside it, so it can never poke through.
  function hoodUp(rig, f, col, hairCol) {
    const { R } = dims(f), h = f.head, sc = [R * 1.1, R * 1.11, R * 1.1], cy = R * 0.05, cz = -R * 0.03, Q = PI / 4;
    rig.piece(h, new THREE.SphereGeometry(1, 8, 2, 0, TAU, 0, 1.12), col, 0, cy, cz, { s: sc });
    rig.piece(h, new THREE.SphereGeometry(1, 6, 2, PI * 0.75, PI * 1.5, 1.12, 1.26), col, 0, cy, cz, { s: sc });   // tucks into the collar
    const hs = sc.map((v) => v * 0.955);
    rig.piece(h, new THREE.SphereGeometry(1, 2, 1, Q, 2 * Q, 1.12, 0.32), hairCol, 0, cy, cz, { s: hs });
    for (const p0 of [Q, 2.62 * Q]) rig.piece(h, new THREE.SphereGeometry(1, 1, 1, p0, 0.38 * Q, 1.44, 0.5), hairCol, 0, cy, cz, { s: hs });
  }
  // the hood's shoulder cape, cut short: a collar up round the chin and a capelet over the tops of the shoulders, so
  // the blue tunic and the shoulders show below it; its sides follow the arms a little so a raised arm lifts it
  function cape(rig, f, col) {
    const { R, shHalf, tl } = dims(f);
    const skin = (x) => {
      const w = 0.7 * smooth((Math.abs(x) - shHalf * 0.5) / (shHalf * 0.55));
      return [[f.torso, 1 - w], [f.arms[x > 0 ? 0 : 1], w]];
    };
    rig.lathe(f.torso, [[R * 0.92, tl + 0.1], [R * 1.07, tl + 0.005], [shHalf * 1.21, tl * 0.89]], 8, col,
      { skin: (x, y, z) => skin(x) });
  }
  // a mallet tucked through the belt at the right hip, head up, handle down along the thigh, swaying with the tunic
  function mallet(rig, f) {
    const { waistR } = dims(f), sk = f.skirt, a = -PI * 0.58, ux = Math.sin(a), uz = Math.cos(a);
    const r0 = waistR * 1.16, r1 = waistR * 1.34;
    rig.limb(sk, V(ux * r0, 0.08, uz * r0), V(ux * r1, -0.17, uz * r1), 0.02, 0.018, C.malletHandle, 4);
    rig.box(sk, C.malletHead, 0.085, 0.085, 0.17, ux * (r0 + 0.02), 0.08, uz * (r0 + 0.02), [0, a, 0]);
  }
  // a lid on the kit's forearm sleeve, which is open at the elbow and shows a sliver of background when it bends
  function elbowCaps(rig, f, col) {
    const { armR } = dims(f);
    for (const el of f.elbows) rig.piece(el, new THREE.CircleGeometry(armR * 1.08, 6), col, 0, -0.004, 0, { r: [-PI / 2, 0, 0] });
  }
  // a round stone between the hands: placed where the hands meet in the carry pose, hung on the right hand
  function stone(rig, f, P, pose, r, col) {
    f.pose(P(Object.assign({}, f.base, pose)));
    f.root.updateMatrixWorld(true);
    const a = f.hands[0].localToWorld(V(0, -0.02, 0)), b = f.hands[1].localToWorld(V(0, -0.02, 0));
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const local = f.hands[1].worldToLocal(mid.clone());
    rest(f);
    const nd = rig.node(f.hands[1], local.x, local.y, local.z);
    const g = new THREE.IcosahedronGeometry(1, 0);
    rig.piece(nd, g, col, 0, 0, 0, { s: [r, r * 0.94, r], r: [0.3, 0.5, 0.2] });
    return nd;
  }
  // on the sheet only: &yaw= turns a posed figure, &anim= plays one of the motions
  function sheet(f, anims) {
    const q = new URLSearchParams(location.search), yaw = parseFloat(q.get('yaw')), anim = anims[q.get('anim')];
    const over = {};
    for (const kv of (q.get('p') || '').split(',')) { const [k, v] = kv.split(':'); if (v !== undefined) over[k] = parseFloat(v); }
    const pose0 = f.pose;
    f.pose = (p) => {
      pose0(Object.assign(anim ? anim(performance.now() / 1000) : p, over));
      if (!isNaN(yaw)) f.root.rotation.y = yaw;
    };
    return f;
  }

  function make(ctx, B, kit, rig, o) {
    o = o || {};
    const P = window.FigureKit.P;
    const hair = o.hair || C.hair, tunic = o.tunic || C.tunic, hood = o.hood || C.hood;
    const f = B.make(kit, rig, { preset: 'man', skirt: 0.56, hem: 1.24, mantle: false, hat: 'none', hair: 'none',
      beard: 'none', staff: 'none', eyes: o.eyes || { r: 0.085, x: 0.35, y: -0.04 },
      col: { skin: o.skin || C.skin, hair, beard: hair, robe: tunic, top: tunic, sleeve: tunic, pants: C.hose, sandal: C.shoe, belt: C.belt } });
    rest(f);
    const sm = window.Motion.smooth;
    gloves(f, rig, C.glove);
    elbowCaps(rig, f, tunic);
    hoodUp(rig, f, hood, hair);
    cape(rig, f, hood);
    mallet(rig, f);
    if (o.beard === 'short') {
      const { R } = dims(f);
      rig.ball(f.head, rig.sphere(5, 3), hair, R * 0.5, 0, -R * 0.62, R * 0.52, [1.05, 0.62, 0.62]);
    }
    const rock = stone(rig, f, P, POSES.carry, 0.2, C.stone);
    f.base = { af0: 0.08, ao0: 0.14, e0: 0.3, af1: 0.08, ao1: 0.14, e1: 0.3, hx: 0.04 };
    const pose0 = f.pose;
    f.pose = (p) => {
      pose0(p);
      rock.scale.setScalar(Math.max(1e-3, sm((Math.min(p.at0, p.at1) - 0.25) / 0.2)));
    };
    f.runner = { stride: f.stride * 1.75, gait: (ph, amt, base) => runPose(f, ph, amt, base) };
    rest(f);
    return f;
  }

  // ---------- poses (added to the base pose) ----------
  const POSES = {
    // mid-step on the treadwheel: leaning into the climb, hands forward on the spokes
    tread: { lean: 0.22, hx: -0.12, lf0: 0.45, k0: 0.55, lf1: -0.2, k1: 0.1, af0: 1.15, e0: 0.55, ao0: 0.05, af1: 1.05, e1: 0.6, ao1: 0.05 },
    // both hands on a rope in front, leaning back with one foot braced forward
    haul: { lean: -0.2, hx: 0.08, lf0: 0.5, k0: 0.25, lf1: -0.25, k1: 0.35, af0: 0.95, e0: 0.7, ao0: -0.05, af1: 0.8, e1: 0.9, ao1: -0.05 },
    // a 40 cm stone hugged in both arms against the belly, leaning back against its weight
    carry: { lean: -0.1, hx: 0.12, af0: 0.62, e0: 1.0, ao0: 0.22, at0: 0.55, af1: 0.62, e1: 1.0, ao1: 0.22, at1: 0.55, k0: 0.12, k1: 0.12 },
    // bending to lay the stone in the sling's pouch in the trough
    lay: { lean: 0.5, hx: -0.2, lf0: 0.75, k0: 1.1, lf1: 0.3, k1: 1.0, af0: 0.5, e0: 0.7, ao0: 0.22, at0: 0.55, af1: 0.5, e1: 0.7, ao1: 0.22, at1: 0.55 },
    // pulling the trigger rope: right fist yanked down and back, left arm out for balance, looking up at the arm
    trigger: { lean: -0.12, twist: -0.2, hx: -0.45, hy: 0.25, lf0: 0.35, k0: 0.2, lf1: -0.3, k1: 0.3, af1: -0.45, e1: 0.6, ao1: 0.18, af0: 0.55, e0: 0.4, ao0: 0.5 },
    // the back of the right glove across the brow
    wipeBrow: { hx: 0.34, hz: 0.06, lean: 0.06, af1: 2.4, e1: 1.65, ao1: 0.12, at1: 1.35, af0: 0.1, e0: 0.3, ao0: 0.14 },
    // a friendly wave with the right hand
    wave: { hx: -0.1, hz: -0.08, af1: 2.45, e1: 0.5, ao1: 0.5, af0: 0.1, e0: 0.3, ao0: 0.16 },
    // a running stride, arms pumping
    run: { lean: 0.22, hx: -0.12, lf0: 0.6, k0: 0.9, lf1: -0.45, k1: 0.35, af0: -0.55, e0: 1.35, af1: 0.75, e1: 1.25, ao0: 0.14, ao1: 0.14 },
  };

  // ---------- motions ----------
  // the treadwheel: steady steps in place up the inside of the wheel (the floor runs back under the planted foot),
  // leaning into it, hands on the spokes rocking a little with each step
  function tread(f, t) {
    const M = window.Motion, P = window.FigureKit.P, ph = t * TAU * 0.5;
    const p = P(Object.assign({}, f.base, POSES.tread, { lf0: 0, k0: 0, lf1: 0, k1: 0 }));
    const g = M.gait(ph, 0.75, M.legSwing(f.stride * 0.7, f.hipY), 0);
    for (const k of ['lf0', 'lf1', 'k0', 'k1', 'roll']) p[k] += g[k];
    p.lf0 += 0.12; p.lf1 += 0.12; p.k0 += 0.1; p.k1 += 0.1;
    p.af0 += 0.08 * Math.sin(ph); p.af1 -= 0.08 * Math.sin(ph); p.twist = 0.05 * Math.sin(ph);
    p.hx += 0.04 * Math.sin(ph * 2 + 0.6); p.hz = 0.04 * Math.sin(ph);
    return p;
  }
  // hauling: hand over hand, each pull drawing the hands to the chest while he leans back
  function haul(f, t) {
    const P = window.FigureKit.P, u = (t / 1.7) % 1, s = Math.sin(u * TAU), c = Math.cos(u * TAU);
    const p = P(Object.assign({}, f.base, POSES.haul));
    p.af0 += 0.3 * s; p.e0 -= 0.35 * s; p.af1 -= 0.3 * s; p.e1 += 0.35 * s;
    p.lean += 0.06 * c - 0.04; p.twist = 0.08 * s; p.hx += 0.04 * c; p.k0 += 0.06 * c; p.k1 += 0.08 * c;
    return p;
  }
  // the tap moment: wipe the brow (0.5 to 2.2 s), then a wave (2.2 to 4.5 s), blending in and out
  function moment(f, s) {
    const P = window.FigureKit.P, FK = window.FigureKit, b = P(f.base);
    const wipe = win(s, 0, 2.6, 0.6), wave = win(s, 2.0, 4.5, 0.6);
    let p = FK.mix(b, P(Object.assign({}, f.base, POSES.wipeBrow)), wipe);
    // the glove slides across the brow and back
    p.ao1 += 0.22 * wipe * Math.sin(clamp((s - 0.6) / 1.4, 0, 1) * PI) - 0.1 * wipe; p.hz += 0.05 * wipe * Math.sin(s * 3);
    if (wave > 0) {
      const w = FK.mix(b, P(Object.assign({}, f.base, POSES.wave)), 1);
      w.ao1 += 0.25 * Math.sin((s - 2.0) * 9); w.e1 += 0.2 * Math.sin((s - 2.0) * 9 + 0.8);
      p = FK.mix(p, w, wave);
    }
    return p;
  }
  // running away: a long stride, the body forward, the elbows bent and the arms pumping, a little bounce
  function runPose(f, ph, amt, base) {
    const M = window.Motion, P = window.FigureKit.P;
    const p = P(Object.assign({}, f.base, base || {})), g = M.gait(ph, amt, M.legSwing(f.stride * 1.75, f.hipY), 0.75);
    for (const k in g) p[k] += g[k];
    p.k0 += 0.35 * amt; p.k1 += 0.35 * amt;
    p.e0 += 1.0 * amt; p.e1 += 1.0 * amt;
    p.lean += 0.14 * amt; p.hx -= 0.1 * amt;
    p.y += 0.035 * amt * Math.abs(Math.sin(ph));
    p.hx += 0.05 * amt * Math.sin(ph * 2 + 0.6); p.hz += 0.05 * amt * Math.sin(ph);
    p.wk = amt;
    return p;
  }

  window.CHARACTERS.engineer = {
    name: 'Lion trebuchet crewman',
    note: 'Blue tunic, russet hood and shoulder cape, leather gloves, mallet in his belt',
    build(ctx, B, kit, rig) {
      const f = make(ctx, B, kit, rig, {});
      return sheet(f, { tread: (t) => tread(f, t), haul: (t) => haul(f, t), moment: (t) => moment(f, t % 5.5), run: (t) => runPose(f, t * TAU * 1.6, 1) });
    },
    make, tread, haul, moment, run: runPose,
    poses: POSES,
  };
})();
