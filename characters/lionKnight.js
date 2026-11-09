// lionKnight.js / bullKnight.js: the knights of the siege (DESIGN.md §6, research.md §4a and §5). THE TWO FILES ARE
// IDENTICAL (each defines both keys, so the character sheet can load either alone): edit one, then copy it over the other.
//
// A knight of about 1400 in shiny plate (the family's choice, picture 14): pauldrons, couters, vambraces, gauntlets,
// cuisses, poleyns, greaves and sabatons as chunky faceted steel; a pointed bascinet with a mail aventail over the
// shoulders and its snouted visor RAISED so the dot eyes show; a short, tight, padded jupon in his arms with a gold
// knightly belt low on the hips; a sword at the left hip; a lance with a pennon.
//   lionKnight: Azure, a lion rampant or, armed and langued gules (blue jupon, gold lion, red claws and tongue).
//   bullKnight: Gules, a bull passant argent, armed or (red jupon, white bull, gold horns).
// The steel's shine is baked into its vertex colours (facets facing the sky bright, facing the ground dark), since the
// scene's single material is matte.
//
//   const f = CHARACTERS.lionKnight.build(ctx, B, kit, rig)      // or CHARACTERS.bullKnight
//   f.gear({ lance: 'whole' | 'broken' | 'none', sword: 'hip' | 'hand' })   call any time (before f.set each frame)
//   f.pose(p) / f.set(state) / f.gait(...) as every Blocky figure. The lance follows the right arm on its own:
//     right hand at the waist (af1 ~0.45, e1 ~0.95) holds it upright; forearm forward with the upper arm down
//     (e1 - af1 > 1.3) couches it under the arm, pointing forward and a little left, over the horse's neck.
//   The visor lifts a little higher when the LEFT hand reaches up to it (the salute pose).
//   Seated (both thighs forward, lf0 and lf1 > 0.6): the shins hug the horse, the jupon spreads, the sword swings back.
//   f.wind (0..1, default 0.4) how hard the pennon streams; it flutters on its own.
//
// Riding: CHARACTERS.lionKnight.ride = { saddleTop: 1.35, hipY: 1.41, hipAboveOrigin, rootY }. With a ride pose the
// feet hang hipAboveOrigin (0.46 m) below the hip pivot; put the knight's root at y = rootY (0.95 m) in the horse's frame
// (hip pivot 1.41 m up = the 1.35 m saddle seat plus the thigh's thickness), x 0, z at the saddle seat centre.
// On the sheet, &horse=1 shows a stand-in horse back under the ride poses (for checking only).
//
// Falling: CHARACTERS.lionKnight.anim.fall(s) → { pose, pitch, lift } for s seconds after he starts to fall: he tips
// over backwards stiffly like a toy soldier, settles in a little bounce, and lies still on his back. Use pitch and
// lift in the Script state (root pivot at the feet). anim.salute(u, base) for u 0..1 the tap moment: the left hand
// goes up to the visor, lifts it, holds a moment and comes down. anim.swing(u, base) one sword stroke for u 0..1.
window.CHARACTERS = window.CHARACTERS || {};
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  const STEEL = 0xc9d0d6, SHADE = 0x8d969e, MAIL = 0x8a8f92, MAIL_DK = 0x6c7174, HI = 0xf3f6f8, WOOD = 0xa9835a, GRIP = 0x5a3a24;
  const ARMS = {
    lion: { jupon: 0x2f4f9a, charge: 0xe3b52f, accent: 0xc8322a, belt: 0xd9a92c, pennon: [0x2f4f9a, 0xe3b52f] },
    bull: { jupon: 0xb5322a, charge: 0xefe9dc, accent: 0xd9a92c, belt: 0xd9a92c, pennon: [0xb5322a, 0xefe9dc] },
  };

  // the figure's measurements (kept in step with Blocky.make for this spec)
  const H = 1.8, HEADS = 2.9, HIP = 0.3, SHOULDER = 1.14, WAIST = 0.72, SKIRT = 0.36;
  const headH = H / HEADS, R = headH / 2, hipY = H * HIP, shY = H - headH * 0.92, tl = shY - hipY;
  const shHalf = SHOULDER * headH / 2, waistR = shHalf * WAIST, chestR = shHalf * 0.92, armR = Math.max(0.035, shHalf * 0.24);
  const legR = waistR * 0.26, th = hipY * 0.5;

  // riding: long stirrups, the thighs well down and splayed round the horse, the shins hanging nearly straight
  const RIDE_LF = 0.78, RIDE_K = 0.6, RIDE_LO = 0.5;
  const hipAboveOrigin = th * Math.cos(RIDE_LF) + th * Math.cos(RIDE_LF - RIDE_K);
  const SEAT = 0.06;   // the hip pivot sits this far above the saddle seat (the thighs' thickness)
  const ride = { saddleTop: 1.35, hipY: 1.35 + SEAT, hipAboveOrigin, rootY: 1.35 + SEAT - hipAboveOrigin };
  const RIDE = { lf0: RIDE_LF, lf1: RIDE_LF, k0: RIDE_K, k1: RIDE_K, lo0: RIDE_LO, lo1: RIDE_LO, lean: 0.02, hx: 0.02,
    af0: 0.62, e0: 0.75, ao0: 0.12 };                                     // the left hand forward and low, on the reins
  const LANCE_UP = { af1: 0.45, e1: 0.95, ao1: 0.1, at1: 0 };
  const LANCE_COUCH = { af1: 0.12, e1: 1.5, ao1: 0.32, at1: -0.15, twist: -0.12 };
  const SWING_UP = { af1: 2.2, e1: 1.05, ao1: 0.8, at1: 0.2, twist: 0.3, hy: -0.14, hz: 0.06, lean: -0.03 };
  const SWING_DOWN = { af1: 0.95, e1: 0.15, ao1: 0.05, twist: -0.3, hy: -0.08, lean: 0.08 };
  const SALUTE = { af0: 2.62, e0: 0.5, ao0: 0.02, at0: 0.35, hx: -0.1, hz: -0.05 };
  const STAND = { af0: 0.22, e0: 0.62, ao0: 0.26, at0: 0.25, af1: 0.45, e1: 0.95, ao1: 0.1, hx: 0.03, lo0: 0.07, lo1: 0.07 };
  const LIE = { af0: 0.1, ao0: 0.34, e0: 0.2, af1: 0.1, ao1: 0.34, e1: 0.2, lean: -0.04, hx: 0.12, lf0: -0.16, lf1: -0.16, k0: 0, k1: 0, lo0: 0.1, lo1: 0.1 };
  const LIE_PITCH = -(Math.PI / 2 - 0.04), LIE_LIFT = 0.25;

  // ---------- the charges, drawn in a box u -0.5..0.5 (to the viewer's right), v 0..1 (up), facing dexter (left) ----------
  const LION = {
    w: 0.3, h: 0.4, y0: 0.05,
    body: [
      [[-0.2, 0.68], [0.0, 0.78], [0.24, 0.36], [0.02, 0.24]],              // the body, rearing
      [[0.0, 0.2], [0.3, 0.2], [0.3, 0.42], [0.0, 0.42]],                  // the haunch
      [[-0.34, 0.68], [-0.02, 0.64], [0.02, 0.92], [-0.28, 1.0]],           // the head and mane
      [[-0.5, 0.85], [-0.3, 0.83], [-0.3, 0.97], [-0.46, 0.97]],            // the upper jaw
      [[-0.48, 0.73], [-0.3, 0.73], [-0.3, 0.79], [-0.44, 0.79]],           // the lower jaw, open
      [[-0.14, 0.62], [-0.44, 0.62], [-0.44, 0.71], [-0.12, 0.72]],         // the upper foreleg, reaching out
      [[-0.5, 0.64], [-0.4, 0.62], [-0.38, 0.8], [-0.48, 0.82]],            // its paw, raised
      [[-0.1, 0.5], [-0.4, 0.43], [-0.4, 0.52], [-0.08, 0.6]],              // the lower foreleg
      [[-0.47, 0.41], [-0.37, 0.41], [-0.37, 0.54], [-0.47, 0.54]],         // its paw
      [[0.04, 0.32], [-0.22, 0.24], [-0.2, 0.15], [0.06, 0.22]],            // the dexter hind leg, raised
      [[-0.32, 0.17], [-0.2, 0.12], [-0.18, 0.25], [-0.3, 0.29]],           // its paw
      [[0.14, 0.26], [0.26, 0.24], [0.18, 0.04], [0.06, 0.06]],             // the sinister hind leg, standing
      [[-0.02, 0.0], [0.22, 0.0], [0.22, 0.07], [-0.02, 0.07]],             // its foot
      [[0.22, 0.38], [0.3, 0.34], [0.44, 0.6], [0.37, 0.65]],               // the tail, striking out
      [[0.3, 0.64], [0.46, 0.57], [0.5, 0.75], [0.36, 0.8]],                // its flame-like tuft
    ],
    accent: [
      [[-0.46, 0.79], [-0.32, 0.79], [-0.32, 0.83], [-0.48, 0.84]],         // the tongue
      [[-0.53, 0.8], [-0.46, 0.8], [-0.47, 0.86], [-0.53, 0.86]],           // claws
      [[-0.51, 0.53], [-0.45, 0.53], [-0.45, 0.58], [-0.51, 0.58]],
      [[-0.36, 0.27], [-0.3, 0.27], [-0.3, 0.32], [-0.36, 0.32]],
    ],
  };
  const BULL = {
    w: 0.27, h: 0.3, y0: 0.12,
    body: [
      [[-0.28, 0.3], [0.4, 0.3], [0.4, 0.7], [-0.24, 0.76]],                // the barrel, deep and heavy
      [[-0.3, 0.6], [0.02, 0.7], [-0.04, 0.9], [-0.24, 0.92]],              // the hump over the shoulders
      [[0.22, 0.6], [0.42, 0.62], [0.42, 0.76], [0.24, 0.78]],              // the rump
      [[-0.52, 0.42], [-0.24, 0.4], [-0.2, 0.76], [-0.48, 0.8]],            // the head, lowered
      [[-0.6, 0.34], [-0.44, 0.33], [-0.42, 0.52], [-0.6, 0.52]],           // the muzzle
      [[-0.24, 0.34], [-0.1, 0.34], [-0.16, 0.18], [-0.3, 0.2]],            // the dexter foreleg, raised and bent
      [[-0.3, 0.2], [-0.17, 0.17], [-0.27, 0.05], [-0.39, 0.09]],
      [[-0.06, 0.32], [0.08, 0.32], [0.08, 0.0], [-0.06, 0.0]],             // the other foreleg
      [[0.26, 0.32], [0.4, 0.32], [0.38, 0.0], [0.26, 0.0]],                // the hind legs
      [[0.11, 0.32], [0.24, 0.32], [0.2, 0.02], [0.09, 0.04]],
      [[0.39, 0.7], [0.46, 0.68], [0.5, 0.3], [0.44, 0.3]],                 // the tail, hanging
      [[0.42, 0.32], [0.53, 0.32], [0.53, 0.15], [0.42, 0.15]],             // its tuft
    ],
    accent: [
      [[-0.5, 0.77], [-0.43, 0.78], [-0.5, 0.95], [-0.61, 0.99]],           // the horns, gold, curving up like a crescent
      [[-0.31, 0.76], [-0.24, 0.75], [-0.17, 0.96], [-0.26, 0.95]],
    ],
  };

  function build(ctx, B, kit, rig, opt) {
    const THREE = ctx.THREE, V = (x, y, z) => new THREE.Vector3(x, y, z), P = window.FigureKit.P, M = window.Motion;
    const side = opt.side, A = ARMS[side];
    const q = new URLSearchParams(location.search), PREVIEW_YAW = q.has('yaw') ? Number(q.get('yaw')) : null;
    const f = B.make(kit, rig, {
      preset: 'man', height: H, heads: HEADS, hip: HIP, shoulder: SHOULDER, waist: WAIST, skirt: SKIRT, hem: 1.14,
      hair: 'none', beard: 'none', hat: 'none', mantle: false, staff: 'none',
      col: { skin: 0xf2c9a8, robe: A.jupon, top: A.jupon, sleeve: STEEL, pants: STEEL, sandal: STEEL, eye: 0x2b1d16 },
    });
    const root = f.root, hips = f.hips, torso = f.torso, head = f.head, skirt = f.skirt;
    // Blocky.make leaves its pivots in the still pose: put them back to rest, so what's added (and the bake) is at rest
    const kitNodes = [torso, head, skirt].concat(f.arms, f.elbows, f.legs, f.knees, f.hands);
    kitNodes.forEach((n) => n.rotation.set(0, 0, 0));
    hips.position.y = hipY;
    root.updateMatrixWorld(true);

    // ---- the kit's pieces: steel on the arms, hands and legs; the plate made chunkier; the jupon turned flat-fronted;
    // what the armour hides taken out (the shoulder balls under the pauldrons, the head under the helmet) ----
    const metal = new Set(), seen = new Map();
    const steelNodes = new Set([].concat(f.arms, f.elbows, f.hands, f.legs, f.knees));
    const fatten = (pc, cx, cz, k) => { const a = pc.arr; for (let i = 0; i < a.length; i += 3) { a[i] = cx + (a[i] - cx) * k; a[i + 2] = cz + (a[i + 2] - cz) * k; } };
    const turn = (pc, ang) => { const a = pc.arr, c = Math.cos(ang), s = Math.sin(ang); for (let i = 0; i < a.length; i += 3) { const x = a[i], z = a[i + 2]; a[i] = x * c + z * s; a[i + 2] = -x * s + z * c; } };
    // drop the triangles whose three corners are all hidden
    const cull = (pc, hidden) => {
      const a = pc.arr, out = [];
      for (let i = 0; i < a.length; i += 9) {
        if (hidden(a[i], a[i + 1], a[i + 2]) && hidden(a[i + 3], a[i + 4], a[i + 5]) && hidden(a[i + 6], a[i + 7], a[i + 8])) continue;
        for (let k = 0; k < 9; k++) out.push(a[i + k]);
      }
      pc.arr = new Float32Array(out);
    };
    const hc = V(0, shY + R * 0.92, 0.01);   // the head's centre at rest
    for (let i = f.range[0]; i < f.range[1]; i++) {
      const pc = rig.pieces[i], k = (seen.get(pc.nd) || 0);
      seen.set(pc.nd, k + 1);
      if (steelNodes.has(pc.nd)) {
        pc.color.setHex(STEEL); metal.add(pc);
        const li = f.legs.indexOf(pc.nd), ki = f.knees.indexOf(pc.nd), ai = f.arms.indexOf(pc.nd), ei = f.elbows.indexOf(pc.nd), hi = f.hands.indexOf(pc.nd);
        const lx = (li >= 0 ? li : ki) === 0 ? waistR * 0.45 : -waistR * 0.45, ax = (ai >= 0 ? ai : ei) === 0 ? shHalf * 0.86 : -shHalf * 0.86;
        // Blocky.make adds the thigh and shin first on the leg and knee (then the foot), the shoulder ball then the upper
        // arm on the arm, the forearm on the elbow, the mitten then the thumb on the hand
        if ((li >= 0 || ki >= 0) && k === 0) fatten(pc, lx, 0, 1.42);
        if ((ai >= 0 && k === 1) || (ei >= 0 && k === 0)) fatten(pc, ax, 0, 1.12);
        if ((ai >= 0 && k === 0) || hi >= 0) pc.arr = new Float32Array(0);
      }
      if (pc.nd === torso || pc.nd === skirt) turn(pc, Math.PI / 6);
      if (pc.nd === torso && k === 0) cull(pc, (x, y) => y - hipY > tl * 0.985);
      if (pc.nd === head && k === 0) cull(pc, (x, y, z) => {
        const dy = y - hc.y, dz = z - hc.z, rr = Math.hypot(x, dz);
        return dy > R * 0.62 || (dy > -R * 0.3 && dz < 0.3 * rr) || (dy <= -R * 0.3 && dz < 0);
      });
      if (pc.nd === f.eyes) cull(pc, (x, y, z) => (x / R) ** 2 + ((y - hc.y) / (R * 1.04)) ** 2 + ((z - hc.z) / (R * 0.96)) ** 2 < 0.97);
    }

    const add = (fn) => { const n0 = rig.pieces.length; fn(); for (let i = n0; i < rig.pieces.length; i++) if (rig.pieces[i].metalTag) metal.add(rig.pieces[i]); };
    // helpers that tag a piece as polished steel (its shine is baked after the bake)
    const tag = () => { rig.pieces[rig.pieces.length - 1].metalTag = true; };
    const sball = (nd, w, h, col, r, x, y, z, s, rot) => { rig.ball(nd, kit.ball(w, h), col, r, x, y, z, s, rot); tag(); };
    const slathe = (nd, prof, segs, col, o) => { rig.lathe(nd, prof, segs, col, o); tag(); };
    const slimb = (nd, a, b, ra, rb, col, segs, open, flat) => { rig.limb(nd, a, b, ra, rb, col, segs, open, flat); tag(); };

    add(() => {
      // ---- the bascinet: a pointed skull leaning back, open wide at the face ----
      const tilt = { r: [-0.13, 0, 0] };
      slathe(head, [[0.0001, R * 1.95], [R * 0.78, R * 1.3], [R * 1.08, R * 0.74], [R * 1.13, R * 0.46]], 8, STEEL, Object.assign({ phi0: Math.PI / 8 }, tilt));
      slathe(head, [[R * 1.13, R * 0.46], [R * 1.14, -R * 0.3]], 5, STEEL, Object.assign({ phi0: Math.PI / 8 + Math.PI / 4, phiLen: TAU - Math.PI * 0.75 }, tilt));
      // the mail aventail from the helmet's lower edge, over the chin and out over the tops of the shoulders
      rig.lathe(head, [[R * 1.07, -R * 0.2], [R * 1.17, -R * 0.62]], 6, MAIL, { phi0: Math.PI / 6 });
      rig.lathe(head, [[R * 1.17, -R * 0.62], [R * 1.34, -R * 1.0]], 6, MAIL_DK, { phi0: Math.PI / 6 });
    });
    // the visor on its own pivot at the temples, raised: a broad pointed muzzle sitting up over the brow
    const visor = rig.node(head, 0, R * 0.3, 0);
    add(() => {
      // a short, broad muzzle tipped up 60 degrees, flat underneath (a lathe turned so a face, not an edge, is below)
      slathe(visor, [[0.0001, R * 0.62], [R * 0.24, R * 0.62], [R * 0.68, 0]], 6, STEEL,
        { phi0: Math.PI / 6, x: 0, y: R * 0.52, z: R * 0.6, r: [1.05, 0, 0], s: [1, 1, 0.7] });
      rig.pieces[rig.pieces.length - 1].soft = true;
    });

    // ---- plate on the limbs ----
    add(() => {
      for (let i = 0; i < 2; i++) {
        const sx = i === 0 ? 1 : -1;
        // the pauldron: a broad faceted dome over the shoulder
        sball(f.arms[i], 5, 3, STEEL, armR * 1.8, sx * armR * 0.2, armR * 0.2, 0, [1.05, 0.78, 1.1]);
        // the gauntlet, a block of a mitten (in place of the kit's hand and thumb)
        rig.box(f.hands[i], STEEL, R * 0.42, R * 0.52, R * 0.3, 0, -R * 0.06, 0, [0, 0, sx * 0.08]); tag();
        // the couter, a cop at the elbow; the poleyn, a cop over the knee
        sball(f.elbows[i], 4, 2, STEEL, armR * 1.4, sx * armR * 0.2, 0, -armR * 0.2, [1, 1.1, 1]);
        sball(f.knees[i], 4, 2, STEEL, legR * 1.75, 0, 0.0, legR * 0.45, [1, 1.1, 0.85]);
      }
    });

    // ---- the jupon's charge, front and back, on the flat panel of the (turned) torso ----
    const chg = side === 'lion' ? LION : BULL;
    const slope = (chestR - waistR) * Math.cos(Math.PI / 6) / (tl * 0.55), d0 = waistR * Math.cos(Math.PI / 6);
    const chargeGeo = (polys, back, lift) => {
      const pos = [];
      const pt = (u, v) => { const y = chg.y0 + v * chg.h, d = d0 + slope * y + lift; return [u * chg.w, y, back ? -d : d]; };
      for (const poly of polys) {
        let pp = poly.map(([u, v]) => pt(u, v));
        // counter-clockwise as seen from its own side
        const area = poly.reduce((s, p, k) => { const n = poly[(k + 1) % poly.length]; return s + p[0] * n[1] - n[0] * p[1]; }, 0);
        if ((area < 0) !== back) pp = pp.reverse();
        for (let k = 1; k < pp.length - 1; k++) pos.push(...pp[0], ...pp[k], ...pp[k + 1]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return g;
    };
    for (const back of [false, true]) {
      rig.geo(torso, chargeGeo(chg.body, back, 0.007), A.charge);
      if (!back || chg === BULL) rig.geo(torso, chargeGeo(chg.accent, back, 0.011), A.accent);
    }

    // ---- the knightly belt, low on the hips ----
    rig.lathe(hips, [[waistR * 1.15, -0.035], [waistR * 1.15, -0.095]], 6, A.belt, { phi0: Math.PI / 6 });

    // ---- the sword at the left hip: a scabbard on its own pivot (it swings back when he's mounted) ----
    const scab = rig.node(hips, waistR * 1.22, -0.06, 0.04);
    scab.rotation.set(0.45, 0, 0.12);
    root.updateMatrixWorld(true);
    rig.limb(scab, V(0, 0, 0), V(0, -0.47, 0), 0.042, 0.03, 0x4a3326, 4, false, 0.6);
    // the sword itself, which moves between the scabbard and the right hand (grip at its origin, blade along +y)
    const sword = rig.node(scab, 0, 0.075, 0);
    sword.rotation.set(Math.PI, 0, 0);
    root.updateMatrixWorld(true);
    add(() => {
      slimb(sword, V(0, 0.08, 0), V(0, 0.62, 0), 0.05, 0.01, STEEL, 4, false, 0.42);
      rig.box(sword, SHADE, 0.2, 0.032, 0.04, 0, 0.065, 0); tag();
      rig.limb(sword, V(0, -0.06, 0), V(0, 0.055, 0), 0.021, 0.023, GRIP, 4, true);
      sball(sword, 4, 2, A.belt, 0.036, 0, -0.085, 0);
    });

    // ---- the lance in the right hand, ash with a steel head and a vamplate, and the pennon near its tip ----
    const lance = rig.node(f.hands[1], 0.015, -0.01, 0.025);
    const front = rig.node(lance, 0, 0.42, 0);
    const pennon = rig.node(front, 0, 1.43, 0);
    root.updateMatrixWorld(true);
    add(() => {
      rig.limb(lance, V(0, -0.75, 0), V(0, 0.42, 0), 0.034, 0.032, WOOD, 4);
      slimb(lance, V(0, 0.07, 0), V(0, 0.22, 0), 0.085, 0.034, STEEL, 4);
      rig.limb(front, V(0, -0.01, 0), V(0, 1.68, 0), 0.032, 0.022, WOOD, 4, true);
      slimb(front, V(0, 1.66, 0), V(0, 1.9, 0), 0.036, 0.004, STEEL, 4, true);
    });
    {
      // a small swallow-tailed pennon in two colours, its hoist on the shaft, double-sided
      const T = [[0, 0.13], [0, 0.005], [0.36, -0.005], [0.58, 0.07]], Bt = [[0, 0.005], [0, -0.12], [0.58, -0.09], [0.36, -0.005]];
      const flag = (pts) => {
        const p3 = pts.map(([z, y]) => [0, y, z + 0.03]), pos = [];
        for (const pp of [p3, p3.slice().reverse()]) for (let k = 1; k < pp.length - 1; k++) pos.push(...pp[0], ...pp[k], ...pp[k + 1]);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        return g;
      };
      rig.geo(pennon, flag(T), A.pennon[0]);
      rig.geo(pennon, flag(Bt), A.pennon[1]);
    }

    // a stand-in horse back for checking the ride poses on the sheet (&horse=1), never in the scene
    if (q.get('horse') === '1') {
      const top = hipAboveOrigin - SEAT, hb = rig.node(root, 0, 0, 0);
      rig.ball(hb, kit.ball(8, 6), 0x8a6040, 1, 0, top - 0.3, -0.05, [0.27, 0.32, 0.8]);
      rig.box(hb, 0x5a3a24, 0.4, 0.05, 0.45, 0, top - 0.02, 0);
      rig.box(hb, 0x5a3a24, 0.4, 0.22, 0.06, 0, top + 0.08, -0.24);
    }

    f.range = [f.range[0], rig.pieces.length];

    // ---- the shine: polished steel catches the sky on its upper facets and the ground's shade below ----
    f.afterBake = () => {
      const geo = rig.mesh.geometry, col = geo.attributes.color, nrm = geo.attributes.normal;
      const c = new THREE.Color(), hi = new THREE.Color(HI), sh = new THREE.Color(0x7f8994), dk = new THREE.Color(0x56616d), gr = new THREE.Color(0x6c747e);
      let off = 0;
      for (let i = 0; i < rig.pieces.length; i++) {
        const pc = rig.pieces[i], n = pc.arr.length / 3;
        if (i >= f.range[0] && i < f.range[1] && metal.has(pc)) {
          for (let v = off; v < off + n; v++) {
            const ny = nrm.getY(v), nz = nrm.getZ(v), nx = nrm.getX(v);
            c.copy(pc.color);
            // like chrome: the sky bright on the top facets, steel on the upper ones, a darker band round the sides (lit
            // toward the front and the key light), the warm ground reflected underneath
            if (ny > 0.62) c.lerp(hi, 0.45);
            else if (ny > 0.28) c.multiplyScalar(0.97);
            else if (ny > -0.22) {
              const k = 0.62 * nz - 0.42 * nx;
              if (k > 0.55) c.multiplyScalar(0.9); else if (k > -0.1) c.lerp(sh, 1); else c.lerp(dk, 1);
            } else c.lerp(pc.soft ? sh : gr, pc.soft ? 0.5 : 1);
            col.setXYZ(v, c.r, c.g, c.b);
          }
        }
        off += n;
      }
      col.needsUpdate = true;
    };

    // ---- gear, and the pose on top of the kit's ----
    const G = { lance: 'whole', sword: 'hip' };
    f.wind = 0.4;
    f.gear = (g) => { Object.assign(G, g || {}); return G; };
    const SWORD_HIP = { p: V(0, 0.075, 0), r: new THREE.Euler(Math.PI, 0, 0) };
    const swordHand = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(0, -0.55, 0.84).normalize());
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qh = new THREE.Quaternion(), dir = V(0, 0, 0), w = V(0, 0, 0);
    const UP = V(0, 1, 0), D_UP = V(0, 1, 0.08).normalize(), D_COUCH = V(0.17, -0.04, 1).normalize();
    const basePose = f.pose;
    f.pose = (p) => {
      basePose(p);
      const lanceMode = p.lance || G.lance, swordMode = p.sword || G.sword;
      // seated: the shins hug the horse, the jupon spreads over the thighs, the scabbard swings back along the flank
      const seat = smooth((Math.min(p.lf0, p.lf1) - 0.45) / 0.25);
      for (let i = 0; i < 2; i++) f.knees[i].rotation.z = (i === 0 ? -1 : 1) * 0.42 * seat;
      skirt.rotation.x -= 0.22 * seat;
      skirt.scale.set(1 + 0.16 * seat, 1 - 0.12 * seat, 1 + 0.06 * seat);
      scab.rotation.set(0.45 + 0.5 * seat, 0, 0.12 + 0.42 * seat);
      // the visor lifts higher as the left hand reaches it
      const reach = smooth((p.af0 - 1.8) / 0.4);
      visor.rotation.x = -0.32 * reach;
      // the sword: in its scabbard, or in the right hand
      const inHand = swordMode === 'hand';
      if (inHand && sword.parent !== f.hands[1]) { f.hands[1].add(sword); sword.position.set(0, -0.025, 0.015); sword.quaternion.copy(swordHand); }
      if (!inHand && sword.parent !== scab) { scab.add(sword); sword.position.copy(SWORD_HIP.p); sword.rotation.copy(SWORD_HIP.r); }
      // the lance: hidden, broken off, or whole; upright, or couched as the forearm comes forward
      const show = lanceMode !== 'none' && !inHand;
      lance.scale.setScalar(show ? 1 : 1e-4);
      front.scale.setScalar(lanceMode === 'whole' ? 1 : 1e-4);
      f.staff = show ? lance : null;
      if (show) {
        const c = smooth((p.e1 - p.af1 - 0.85) / 0.45);
        dir.copy(D_UP).lerp(D_COUCH, c).normalize();
        root.getWorldQuaternion(qa);
        qb.setFromUnitVectors(UP, dir);
        qa.multiply(qb);
        f.hands[1].getWorldQuaternion(qh);
        lance.quaternion.copy(qh.invert().multiply(qa));
        // the pennon streams downwind of the shaft (back, and a little down), fluttering
        const t = performance.now() / 1000;
        root.getWorldQuaternion(qa);
        w.set(0.18 * Math.sin(t * 1.3 + f.seed), -0.3 - 0.4 * (1 - f.wind), -1).applyQuaternion(qa);
        lance.getWorldQuaternion(qh);
        w.applyQuaternion(qh.invert());
        pennon.rotation.set(0, Math.atan2(w.x, w.z) + (0.12 + 0.2 * f.wind) * Math.sin(t * 6.5 + f.seed * 3), 0);
      }
      if (PREVIEW_YAW !== null) root.rotation.y = PREVIEW_YAW;
      // only on the sheet: a root pitch and lift for the lying pose (in a scene the Script state does this)
      if (p.rootPitch !== undefined) { root.rotation.x = p.rootPitch; root.position.y = p.rootLift || 0; }
    };
    f.base = Object.assign({}, STAND);
    // the walk, a little heavier in plate: a shorter step, a wider stance, more rock from foot to foot, a steadier left arm
    f.stride = hipY * 1.42;
    f.gait = (ph, amt, base) => {
      const b = Object.assign({}, f.base, base || {});
      if (G.lance === 'none' || G.sword === 'hand') b.noStaff = true;
      if (!f.staff) b.noStaff = true;
      const p = B.walkPose(f, ph, amt, b);
      p.af0 = b.af0 * (1 - amt) + 0.05 * amt + (p.af0 - b.af0) * 0.85;
      p.e0 = p.e0 - (b.e0 - 0.3) * amt;
      p.ao0 = p.ao0 - (b.ao0 - 0.16) * amt;
      p.at0 = b.at0 * (1 - amt);
      p.roll += 0.03 * amt * Math.cos(ph);
      p.lo0 += 0.02 * amt; p.lo1 += 0.02 * amt;
      p.lean += 0.015 * amt;
      return p;
    };
    // rest, so the bake binds at rest; the sheet and the scene pose him after
    kitNodes.forEach((n) => n.rotation.set(0, 0, 0));
    hips.position.y = hipY;
    return f;
  }

  // ---------- poses and little animations ----------
  const O = (...a) => Object.assign({}, ...a);
  const poses = {
    stand: O(STAND),
    walkLance: O(STAND),
    ride: O(RIDE, LANCE_UP),
    rideCouch: O(RIDE, LANCE_COUCH, { lean: 0.1, hx: -0.04 }),
    rideSwingUp: O(RIDE, SWING_UP, { sword: 'hand' }),
    rideSwingDown: O(RIDE, SWING_DOWN, { sword: 'hand' }),
    rideSalute: O(RIDE, LANCE_UP, SALUTE),
    swingUp: O(STAND, SWING_UP, { af0: 0.4, e0: 0.5, ao0: 0.2, at0: 0, lf0: 0.28, lf1: -0.18, k0: 0.12, sword: 'hand' }),
    swingDown: O(STAND, SWING_DOWN, { af0: 0.2, e0: 0.4, ao0: 0.24, at0: 0, lf0: 0.32, lf1: -0.2, k0: 0.18, k1: 0.05, sword: 'hand' }),
    salute: O(STAND, SALUTE),
    lie: O(LIE, { rootPitch: LIE_PITCH, rootLift: LIE_LIFT }),
  };
  const P = (o) => window.FigureKit.P(o);
  const mixP = (a, b, k) => window.FigureKit.mix(P(a), P(b), k);
  const anim = {
    // s seconds into the fall: a stiff tip backwards, gathering speed like a toy, a small bounce, then still
    fall(s, base) {
      const T = 0.85, u = clamp(s / T, 0, 1), tip = u * u;
      const settle = s > T ? 0.06 * Math.exp(-(s - T) * 7) * Math.sin((s - T) * 18) : 0;
      const pitch = LIE_PITCH * tip + settle;
      const lift = LIE_LIFT * smooth((tip - 0.5) / 0.5);
      const pose = mixP(O(STAND, base || {}), LIE, smooth(u * 1.3));
      return { pose, pitch, lift };
    },
    // u 0..1: the left hand goes up to the visor, lifts it, holds a moment, comes down (about 3 s)
    salute(u, base) {
      const k = smooth(u / 0.3) * (1 - smooth((u - 0.72) / 0.28));
      return mixP(base || STAND, O(base || STAND, SALUTE), k);
    },
    // u 0..1: one sword stroke, the raise slow, the cut quick, the recovery slow (about 1.6 s); base: RIDE or STAND
    swing(u, base) {
      const b = base || STAND, up = O(b, SWING_UP), down = O(b, SWING_DOWN);
      if (u < 0.5) return mixP(down, up, smooth(u / 0.5));
      if (u < 0.65) return mixP(up, down, smooth((u - 0.5) / 0.15));
      return P(down);
    },
  };

  const make = (side, name, note) => ({
    name, note, ride, poses, anim,
    build(ctx, B, kit, rig, opt) { return build(ctx, B, kit, rig, Object.assign({ side }, opt || {})); },
  });
  CHARACTERS.lionKnight = make('lion', 'Knight of the Lion', 'shiny plate, a raised visor, a blue jupon with a gold lion rampant, a lance with a blue and gold pennon');
  CHARACTERS.bullKnight = make('bull', 'Knight of the Bull', 'shiny plate, a raised visor, a red jupon with a white bull passant, gold horns, a red and white pennon');
})();
