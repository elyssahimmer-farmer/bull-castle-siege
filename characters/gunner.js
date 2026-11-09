// gunner.js: a Lion gunner for the bombards of c. 1400 (DESIGN §6, §9, decision 10; research §16e-f; palette DESIGN §1).
// A craftsman, not a soldier: a knee-length tunic in Lion blue, hose, a leather apron, his buff hood pushed back onto
// his shoulders, and a felt cap. His tools (research §16f): a rammer-and-sponge staff (rammer head up, sheepskin
// sponge down) in the right hand, and a touch-iron (a short iron rod on a wooden handle, its tip red-hot from the
// brazier) in the left. Clothing is ours: the sources are silent beyond "working clothes, perhaps a leather apron".
//   CHARACTERS.gunner.build(ctx, B, kit, rig)                      → the sheet's gunner (both tools)
//   CHARACTERS.gunner.make(ctx, B, kit, rig, { tools, hair, beard, cap })
//     tools 'both' | 'rammer' | 'iron' | 'none' (a master gunner with the iron, loaders with the staff),
//     hair colour hex, beard 'block' | 'none', cap colour hex.
// The props follow the pose, so they blend with it:
//   - right arm raised forward (af1 over about 0.8): the staff goes level, pointing ahead into the bore;
//   - at1 at -0.4 or below while it's level: the staff turns end for end, sponge first (pose sponge);
//   - left arm raised forward (af0 over about 0.6): the iron tips forward and down to the touch hole (pose touchOff);
//   - both arms turned in (at0 and at1 0.45 or more): the 30 cm stone ball shows between the hands and both tools
//     go (pose carry). While the staff is level the iron is put away too (ram, sponge).
//   f.prop('rammer' | 'iron' | 'ball', k) scales a prop 0..1 on top of that, for the choreographer (e.g. tools left
//   by the gun).
// Poses (static, add to f.base): ram, sponge, touchOff, carry, ready, wave.
// CHARACTERS.gunner.moment(f, s): the tap moment (4 s), a wave with the free hand.
// On the sheet: &view=pose&pose=ram, &yaw=1.57 to turn it, &p=af1:1.2 to try angles, &anim=moment.
(function () {
  'use strict';
  window.CHARACTERS = window.CHARACTERS || {};
  const PI = Math.PI, TAU = PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const win = (s, a, b, e) => smooth((s - a) / e) * (1 - smooth((s - (b - e)) / e));
  const C = { tunic: 0x2f4f9a, hood: 0xc9b282, apron: 0x7a5232, hose: 0x5e5048, shoe: 0x4e3a2a, belt: 0x4a3426,
    cap: 0x23396e, hair: 0x5a3a24, skin: 0xeec09a, ball: 0xb7b1a2, pole: 0x9a7a52, rammer: 0x7a5a3a, sponge: 0xe4dac2,
    handle: 0x8a6440, iron: 0x4a4a52, hot: 0xff6a1e, glow: 0xffc24a };

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
  // a lid on the kit's forearm sleeve, which is open at the elbow and shows a sliver of background when it bends
  function elbowCaps(rig, f, col) {
    const { armR } = dims(f);
    for (const el of f.elbows) rig.piece(el, new THREE.CircleGeometry(armR * 1.08, 6), col, 0, -0.004, 0, { r: [-PI / 2, 0, 0] });
  }
  // a full head of hair under the cap: a crown, and a fall round the sides and back down to the ears and neck
  function hair(rig, f, col) {
    const { R } = dims(f), h = f.head, s = [R * 1.08, R * 1.08, R * 1.07];
    rig.piece(h, new THREE.SphereGeometry(1, 8, 2, 0, TAU, 0, 1.38), col, 0, R * 0.04, -R * 0.02, { s });
    rig.piece(h, new THREE.SphereGeometry(1, 6, 1, PI * 0.82, PI * 1.36, 1.38, 0.8), col, 0, R * 0.04, -R * 0.02, { s });
  }
  // the felt cap: a soft round crown and a thick rolled brim, sitting low over the hair (one lathe)
  function feltCap(rig, f, col) {
    const { R } = dims(f), h = f.head, r = [-0.14, PI / 7, 0];
    rig.lathe(h, [[0.0001, R * 1.38], [R * 0.9, R * 1.26], [R * 1.17, R * 0.86], [R * 1.3, R * 0.58], [R * 1.17, R * 0.36]], 7, col, { r });
  }
  // the hood pushed back: its shoulder cape and collar on the shoulders, the empty hood lying on the upper back
  function hoodDown(rig, f, col) {
    const { R, shHalf, tl, chestR } = dims(f);
    const skin = (x) => {
      const w = 0.7 * smooth((Math.abs(x) - shHalf * 0.5) / (shHalf * 0.55));
      return [[f.torso, 1 - w], [f.arms[x > 0 ? 0 : 1], w]];
    };
    rig.lathe(f.torso, [[R * 1.1, tl + 0.012], [shHalf * 1.25, tl * 0.87], [shHalf * 1.27, tl * 0.75]], 8, col,
      { skin: (x, y, z) => skin(x) });
    rig.limb(f.torso, V(0, tl * 0.97, -chestR * 1.12), V(0, tl * 0.5, -chestR * 1.12), R * 0.62, R * 0.12, col, 5, false, 0.45);
  }
  // the leather apron: a bib from under the cape to the belt, and a skirt to just below the tunic's hem, which
  // sways with it
  function apron(rig, f, col) {
    const { shHalf, waistR, hemR, chestR, tl } = dims(f), sk = f.spec.skirt, hipY = f.hipY, a = 0.72;
    rig.lathe(f.torso, [[chestR * 1.06, tl * 0.74], [chestR * 1.06, tl * 0.55], [waistR * 1.12, 0.0]], 2, col, { phi0: -a, phiLen: 2 * a });
    rig.lathe(f.skirt, [[waistR * 1.14, 0.02], [waistR * 1.18, -0.06], [hemR * 1.08 + 0.012, -hipY * sk - 0.05]], 2, col, { phi0: -a, phiLen: 2 * a });
  }
  // the rammer and sponge on one long staff, gripped a third of the way up
  function staff(rig, node) {
    rig.limb(node, V(0, 1.12, 0), V(0, -0.28, 0), 0.024, 0.024, C.pole, 5, true);
    rig.limb(node, V(0, 1.3, 0), V(0, 1.12, 0), 0.068, 0.068, C.rammer, 5);
    rig.limb(node, V(0, -0.28, 0), V(0, -0.44, 0), 0.072, 0.064, C.sponge, 5);
  }
  // the touch-iron: a wooden handle in the fist, an iron rod ahead of it, the tip glowing from the brazier
  function touchIron(rig, node) {
    rig.limb(node, V(0, -0.13, 0), V(0, 0.08, 0), 0.026, 0.026, C.handle, 4);
    rig.limb(node, V(0, 0.08, 0), V(0, 0.5, 0), 0.014, 0.014, C.iron, 3, true);
    rig.limb(node, V(0, 0.5, 0), V(0, 0.6, 0), 0.022, 0.014, C.hot, 4);
    rig.ball(node, rig.sphere(4, 3), C.glow, 0.03, 0, 0.6, 0);
  }
  // a round stone between the hands: placed where the hands meet in the carry pose, hung on the right hand
  function stoneBall(rig, f, P, pose, r, col) {
    f.pose(P(Object.assign({}, f.base, pose)));
    f.root.updateMatrixWorld(true);
    const a = f.hands[0].localToWorld(V(0, -0.02, 0)), b = f.hands[1].localToWorld(V(0, -0.02, 0));
    const local = f.hands[1].worldToLocal(a.add(b).multiplyScalar(0.5));
    rest(f);
    const nd = rig.node(f.hands[1], local.x, local.y, local.z);
    rig.piece(nd, new THREE.IcosahedronGeometry(1, 0), col, 0, 0, 0, { s: [r, r * 0.95, r], r: [0.3, 0.5, 0.2] });
    return nd;
  }
  // on the sheet only: &yaw= turns a posed figure, &anim= plays a motion, &p= overrides angles
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
    const P = window.FigureKit.P, sm = window.Motion.smooth, tools = o.tools || 'both';
    const hairCol = o.hair || C.hair;
    const f = B.make(kit, rig, { preset: 'man', skirt: 0.56, hem: 1.24, mantle: false, hat: 'none', hair: 'none',
      beard: o.beard || 'block', staff: 'none', eyes: o.eyes || { r: 0.08, x: 0.37, y: -0.02 },
      col: { skin: o.skin || C.skin, hair: hairCol, beard: new THREE.Color(hairCol).multiplyScalar(0.9).getHex(), robe: C.tunic, top: C.tunic,
        sleeve: C.tunic, pants: C.hose, sandal: C.shoe, belt: C.belt } });
    rest(f);
    elbowCaps(rig, f, C.tunic);
    hair(rig, f, hairCol);
    feltCap(rig, f, o.cap || C.cap);
    hoodDown(rig, f, C.hood);
    apron(rig, f, C.apron);
    const ball = stoneBall(rig, f, P, POSES.carry, 0.15, C.ball);
    const pole = tools === 'both' || tools === 'rammer' ? rig.node(f.hands[1], 0, -0.02, 0.03) : null;
    if (pole) staff(rig, pole);
    const iron = tools === 'both' || tools === 'iron' ? rig.node(f.hands[0], 0, -0.02, 0.03) : null;
    if (iron) touchIron(rig, iron);
    f.staff = pole;   // Blocky.walkPose keeps a steady grip on the staff hand
    f.base = pole ? { af0: 0.08, ao0: 0.14, e0: 0.3, af1: 0.3, ao1: 0.12, e1: 0.5, hx: 0.04 }
      : { af0: 0.08, ao0: 0.14, e0: 0.3, af1: 0.08, ao1: 0.14, e1: 0.3, hx: 0.04 };
    const extra = { rammer: 1, iron: 1, ball: 1 };
    f.prop = (name, k) => { extra[name] = clamp(k, 0, 1); };
    const show = (nd, k) => { if (nd) nd.scale.setScalar(Math.max(1e-3, k)); };
    const pose0 = f.pose;
    f.pose = (p) => {
      pose0(p);
      const carry = sm((Math.min(p.at0, p.at1) - 0.25) / 0.2);
      show(ball, carry * extra.ball);
      // the staff: upright in the fist, level ahead when the arm comes up, end for end when the arm turns out
      const lv = sm((p.af1 - 0.5) / 0.45), flip = lv * sm((-p.at1 - 0.15) / 0.25);
      if (pole) {
        pole.rotation.set(p.af1 + p.e1 - p.lean + lv * PI / 2 - (1 - lv) * 0.08 + flip * PI, 0, p.ao1 * (1 - lv));
        show(pole, (1 - carry) * extra.rammer);
      }
      // the iron: held like a torch, the hot tip up and ahead where it can be seen, tipping forward and down to the
      // touch hole as the arm comes up
      if (iron) {
        const reach = sm((p.af0 - 0.35) / 0.45);
        iron.rotation.set(p.af0 + p.e0 - p.lean + 0.55 + 1.55 * reach, 0, -p.ao0);
        show(iron, (1 - carry) * (1 - (pole ? lv : 0)) * extra.iron);
      }
    };
    rest(f);
    return f;
  }

  // ---------- poses (added to the base pose) ----------
  const POSES = {
    // pushing the rammer into the bore: a lunge, both hands on the level staff, the left hand ahead
    ram: { lf0: 0.75, k0: 0.7, lf1: -0.45, k1: 0.05, lo0: 0.08, lo1: 0.08, lean: 0.3, hx: -0.1, af0: 1.3, e0: 0.1, ao0: -0.55, af1: 1.12, e1: 0.3, ao1: 0.02 },
    // the same with the staff turned end for end, the wet sponge into the bore
    sponge: { lf0: 0.75, k0: 0.7, lf1: -0.45, k1: 0.05, lo0: 0.08, lo1: 0.08, lean: 0.3, hx: -0.1, af0: 1.3, e0: 0.1, ao0: -0.55, af1: 1.12, e1: 0.3, ao1: 0.02, at1: -0.5 },
    // stepped back from the gun, the iron at arm's length to the touch hole, his face turned away (calm, no flinch)
    touchOff: { lf0: 0.3, k0: 0.1, lf1: -0.35, k1: 0.25, lo0: 0.1, lo1: 0.08, lean: -0.08, twist: 0.12, roll: -0.04,
      af0: 1.05, e0: 0.15, ao0: 0.12, af1: 0.15, e1: 0.4, ao1: 0.3, hy: -0.95, hx: 0.05, hz: 0.05 },
    // a 30 cm stone ball hugged against the belly
    carry: { lean: -0.08, hx: 0.12, af0: 0.62, e0: 1.05, ao0: 0.12, at0: 0.7, af1: 0.62, e1: 1.05, ao1: 0.12, at1: 0.7, k0: 0.1, k1: 0.1 },
    // standing ready by the gun, the staff grounded beside him, looking at the wall
    ready: { hx: -0.08, af1: 0.3, e1: 0.5, ao1: 0.16, af0: 0.12, e0: 0.35, lo0: 0.08, lo1: 0.08 },
    // a wave with the left hand (the iron stays point-down at his side if he holds one)
    wave: { af0: 2.45, e0: 0.5, ao0: 0.5, hx: -0.1, hz: 0.08 },
  };

  // the tap moment: a wave with the left hand, blending in and out over 4 s
  function moment(f, s) {
    const P = window.FigureKit.P, FK = window.FigureKit, b = P(f.base), k = win(s, 0, 4, 0.7);
    const w = P(Object.assign({}, f.base, POSES.wave));
    w.ao0 += 0.25 * Math.sin(s * 9); w.e0 += 0.2 * Math.sin(s * 9 + 0.8);
    return FK.mix(b, w, k);
  }

  window.CHARACTERS.gunner = {
    name: 'Lion gunner',
    note: 'Blue tunic, leather apron, hood pushed back, felt cap; rammer-and-sponge staff and a red-hot touch-iron',
    build(ctx, B, kit, rig) {
      const q = new URLSearchParams(location.search), f = make(ctx, B, kit, rig, { tools: q.get('tools') || 'both' });
      return sheet(f, { moment: (t) => moment(f, t % 5) });
    },
    make, moment,
    poses: POSES,
  };
})();
