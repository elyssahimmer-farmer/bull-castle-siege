// The siege soldiers: Lion and Bull archers and spearmen in the picture 12 look (DESIGN §6, decision 2; research §4b-4d, §5).
// A conical steel helmet with a nose bar over a full head of hair, a grey mail shirt to mid-thigh with short sleeves over a
// coloured tunic to the knee, leg wraps and boots, and a long kite shield (chin to knee) painted with the arms:
//   Lion: a blue tunic, a blue shield with a gold lion rampant, red claws (Azure, a lion rampant Or, armed gules).
//   Bull: a red tunic, a red shield with a white bull passant, gold horns (Gules, a bull passant argent, armed Or).
// Archers carry a yew longbow about as tall as themselves, an arrow bag at the belt, and the kite shield slung on the back
// by its strap (the family's request). Spearmen carry the shield on the left forearm and a 2.75 m spear.
//
// lionArcher.js, bullArcher.js, lionSpear.js and bullSpear.js are the SAME FILE (edit one, then copy it over the other
// three). Loading any one of them defines all four keys, so a scene needs only one <script>.
//   CHARACTERS.lionArcher.build(ctx, B, kit, rig)                        the sheet's figure
//   CHARACTERS.siegeSoldier.make(ctx, B, kit, rig, { side: 'lion' | 'bull', role: 'archer' | 'spear', v: 0..3, token })
//     v: the face under the helmet (0 brown hair and beard, 1 fair and clean-shaven, 2 dark with a beard, 3 red with a
//     full beard). token: a lighter build for the massed ranks (same pivots, poses and props, fewer facets).
//   CHARACTERS.siegeSoldier.sheaf(rig, node, x, y, z, seed)                   a sheaf of arrows stuck in the ground (a prop)
//   CHARACTERS.siegeSoldier.fall(k)  → { pitch, lift }                        the toy-soldier topple, k 0..1, for Script states
//
// Props work from the arm angles alone, so a Script only sets poses:
//   the bow stays upright in the left hand while the arm is low, and stands square to the forearm when the arm is raised
//   to shoot. Its string follows the right hand whenever that hand is behind the bow (nock, draw), the limbs bend with the
//   draw, and an arrow shows on the string while the hand holds it; move the hand away (loose) and the string snaps back
//   and the arrow is gone (the arrows in flight are siegeworks.js's).
//   The spear stays upright in the right hand while the arm is low, levels forward over the shield as the arm rises
//   (brace, push), and stands upright again with the arm right up (cheer).
// Walking: Script.walk(points, speed, f) uses the loose walk with the bow (or shield) arm keeping its hold. To run (the Lion
// withdrawal), pass opt.base = () => ({ run: 1 }) at about 2.4 m/s.
// Lying still (spearmen): blend to poses.lie and drive the Script state's pitch and lift with siegeSoldier.fall(k): the figure
// tips over backwards stiffly like a toy soldier and lies on its back with the shield over it. Close its eyes
// (f.eyes.scale.y = 0.1) once it lies there. No injury is shown. (On the sheet, poses.lie carries pitch and lift itself.)
// Planting arrows (the archers' tap moment): poses.plant has sheaf: 1, which shows a bundle in the right hand; a Script
// holds that pose for a second or two and the choreographer then shows a siegeSoldier.sheaf in the ground at the hand.
(function () {
  'use strict';
  window.CHARACTERS = window.CHARACTERS || {};
  if (window.CHARACTERS.siegeSoldier) return;
  const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;

  const COL = { mail: 0x8a8f92, mailEdge: 0x767c80, steel: 0xc9d0d6, steelShade: 0x8d969e, wraps: 0x8c7a5e, boot: 0x5a4030,
    belt: 0x5a3e28, strap: 0x6b4a2e, yew: 0xb5783e, grip: 0x5a3e28, string: 0xeee6cc, shaft: 0xd8c49a, fletch: 0xf2eee4,
    head: 0x8d969e, bag: 0xd9ccb0, shieldBack: 0x9a7650, rim: 0x5a4030, spear: 0x8a6a44 };
  const SIDES = {
    lion: { tunic: 0x2f4f9a, field: 0x2f4f9a, charge: 0xe3b52f, armed: 0xc23a2c },
    bull: { tunic: 0xb5322a, field: 0xb5322a, charge: 0xefe9dc, armed: 0xd9a92c },
  };
  // faces under the helmet
  const VARIANTS = [
    { hair: 0x6a4a30, beard: 'block', beardC: 0x5e402a, skin: 0xf2c9a8 },
    { hair: 0xc89c5c, beard: 'none', beardC: 0xb08848, skin: 0xf5d2b2 },
    { hair: 0x3e2c20, beard: 'block', beardC: 0x34251a, skin: 0xe2b692 },
    { hair: 0x8a4a2a, beard: 'full', beardC: 0x7a3e22, skin: 0xf0c4a0 },
  ];

  // ---------- the arms, in shield space (x across, y up; metres) ----------
  // the kite: a rounded top, straight sides tapering to a point (right half, top to bottom)
  const KITE = [[0, 0.44], [0.19, 0.415], [0.28, 0.3], [0.27, 0.08], [0.2, -0.25], [0.105, -0.45], [0, -0.58]];
  // a lion rampant facing dexter (the viewer's left), standing on the sinister hind paw, tail flicked up behind
  const LION = [[-0.15, 1.15], [-0.45, 1.18], [-0.64, 1.08], [-0.84, 0.98], [-0.84, 0.86], [-0.62, 0.84], [-0.86, 0.7], [-0.55, 0.62],
    [-0.5, 0.55], [-0.98, 0.66], [-1.04, 0.48], [-0.52, 0.38], [-0.94, 0.24], [-0.98, 0.06], [-0.42, 0.12],
    [-0.3, -0.2], [-0.62, -0.38], [-0.86, -0.66], [-0.8, -0.86], [-0.48, -0.66], [-0.26, -0.54],
    [-0.2, -0.8], [-0.42, -1.1], [0.12, -1.12], [0.16, -0.7], [0.34, -0.36],
    [0.56, -0.42], [0.86, -0.22], [0.8, 0.18], [1.0, 0.42], [0.82, 0.58], [0.6, 0.44], [0.66, 0.2], [0.68, -0.04], [0.42, -0.1],
    [0.22, 0.34], [0.24, 0.6], [0.1, 0.7], [0.18, 0.88], [0.02, 0.96], [0.04, 1.1]];
  const LION_CLAWS = [[[-1.0, 0.66], [-1.14, 0.6], [-1.04, 0.5]], [[-0.96, 0.24], [-1.1, 0.16], [-1.0, 0.08]],
    [[-0.86, -0.66], [-0.96, -0.78], [-0.82, -0.84]], [[-0.4, -1.0], [-0.54, -1.1], [-0.42, -1.12]]];
  // a bull passant facing dexter, near forefoot raised, tail hanging, a hump at the shoulders
  const BULL = [[-0.48, 0.42], [-0.66, 0.42], [-0.9, 0.16], [-0.92, -0.02], [-0.7, -0.06], [-0.52, 0.0], [-0.48, -0.14],
    [-0.46, -0.22], [-0.66, -0.34], [-0.64, -0.46], [-0.52, -0.46], [-0.5, -0.36], [-0.36, -0.28],
    [-0.36, -0.66], [-0.2, -0.66], [-0.2, -0.28], [0.3, -0.28], [0.28, -0.66], [0.44, -0.66], [0.46, -0.38], [0.54, -0.66], [0.7, -0.66], [0.7, -0.12],
    [0.72, 0.14], [0.78, -0.3], [0.74, -0.44], [0.92, -0.46], [0.86, -0.3], [0.84, 0.24], [0.72, 0.34], [0.1, 0.36], [-0.2, 0.5], [-0.38, 0.52]];
  const HORNS = [[[-0.64, 0.38], [-0.52, 0.42], [-0.64, 0.58], [-0.8, 0.66], [-0.94, 0.76], [-0.84, 0.6], [-0.72, 0.48]],
    [[-0.5, 0.44], [-0.38, 0.46], [-0.3, 0.6], [-0.3, 0.78], [-0.4, 0.64], [-0.46, 0.54]]];
  // the same beasts in fewer points, for the tokens in the massed ranks
  const LION_T = [[-0.15, 1.15], [-0.64, 1.1], [-0.86, 0.9], [-0.55, 0.62], [-1.02, 0.58], [-0.52, 0.38], [-0.98, 0.14], [-0.42, 0.12], [-0.3, -0.2],
    [-0.84, -0.76], [-0.26, -0.54], [-0.32, -1.1], [0.14, -1.1], [0.34, -0.36], [0.86, -0.22], [0.94, 0.5], [0.62, 0.32], [0.62, -0.06], [0.22, 0.34], [0.12, 0.9]];
  const BULL_T = [[-0.48, 0.42], [-0.66, 0.42], [-0.92, 0.08], [-0.5, -0.06], [-0.66, -0.4], [-0.36, -0.28], [-0.36, -0.66], [-0.2, -0.66], [-0.2, -0.28],
    [0.3, -0.28], [0.3, -0.66], [0.7, -0.66], [0.7, 0.14], [0.86, -0.42], [0.84, 0.24], [0.72, 0.34], [-0.2, 0.5]];
  const HORNS_T = [[[-0.64, 0.38], [-0.5, 0.42], [-0.8, 0.66], [-0.94, 0.76], [-0.72, 0.48]], [[-0.5, 0.44], [-0.38, 0.46], [-0.3, 0.78], [-0.46, 0.54]]];
  const DEVICE = {
    lion: { body: LION, extra: LION_CLAWS, tbody: LION_T, textra: [], s: 0.24, x: 0.02, y: 0.04 },
    bull: { body: BULL, extra: HORNS, tbody: BULL_T, textra: HORNS_T, s: 0.27, x: 0.0, y: 0.11 },
  };

  // ---------- 2D helpers ----------
  const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };
  const ccw = (p) => (area(p) < 0 ? p.slice().reverse() : p);
  // Sutherland-Hodgman: the part of `poly` inside the convex, counter-clockwise `win`
  function clip(poly, win) {
    let out = poly;
    for (let i = 0; i < win.length && out.length; i++) {
      const a = win[i], b = win[(i + 1) % win.length], inp = out;
      const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      out = [];
      for (let j = 0; j < inp.length; j++) {
        const p = inp[j], q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q);
        if (sp >= 0) out.push(p);
        if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
    }
    return out;
  }

  // The shield, built in shield space and placed in its node's frame by the matrix M: a flat board whose painted face is
  // a little smaller than its back, so the rim is a bevel that catches the light. The beast is cut to the face's edge and
  // lies a few millimetres out from it, so it never flickers or pokes through.
  function shield(rig, node, M, side, token, backFace) {
    const half = token ? [KITE[0], KITE[2], KITE[4], KITE[6]] : KITE;
    const back = ccw(half.concat(half.slice(1, -1).reverse().map(([x, y]) => [-x, y])));
    const C0 = [0, -0.06], B = 0.03, T = 0.016;
    // the face, drawn in by the bevel toward the middle
    const face = back.map(([x, y]) => { const dx = x - C0[0], dy = y - C0[1], d = Math.hypot(dx, dy); return [x - dx / d * B, y - dy / d * B]; });
    const groups = new Map(), put = (col, pts) => { if (!groups.has(col)) groups.set(col, []); groups.get(col).push(...pts.flat()); };
    const fan = (poly, z, col, flip) => {
      for (let i = 1; i + 1 < poly.length; i++) {
        const a = [...poly[0], z], b = [...poly[i], z], c = [...poly[i + 1], z];
        put(col, flip ? [a, c, b] : [a, b, c]);
      }
    };
    fan([C0].concat(face, [face[0]]), T, SIDES[side].field, false);
    if (backFace) fan([C0].concat(back, [back[0]]), -T, COL.shieldBack, true);
    if (!token) for (let i = 0; i < back.length; i++) {
      const j = (i + 1) % back.length, pf = [...face[i], T], qf = [...face[j], T], pb = [...back[i], -T], qb = [...back[j], -T];
      put(COL.rim, [pf, pb, qb]); put(COL.rim, [pf, qb, qf]);
    }
    const D = DEVICE[side], tf = (pts) => ccw(pts.map(([x, y]) => [D.x + x * D.s, D.y + y * D.s]));
    const paint = (pts, col, z) => {
      const P = tf(pts), tris = THREE.ShapeUtils.triangulateShape(P.map(([x, y]) => new THREE.Vector2(x, y)), []);
      for (const [a, b, c] of tris) fan(clip(ccw([P[a], P[b], P[c]]), face), z, col, false);
    };
    paint(token ? D.tbody : D.body, SIDES[side].charge, T + 0.004);
    for (const e of token ? D.textra : D.extra) paint(e, SIDES[side].armed, T + 0.007);
    for (const [col, arr] of groups) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      rig.geo(node, g.applyMatrix4(M), col);
    }
  }
  // a matrix from basis vectors (shield x, y, z in the node's frame), a position, and a turn about the node's axes
  const basis = (sx, sy, sz, pos, rot) => {
    const m = new THREE.Matrix4().makeBasis(V(...sx), V(...sy), V(...sz));
    if (rot) m.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])));
    return m.premultiply(new THREE.Matrix4().makeTranslation(pos[0], pos[1], pos[2]));
  };

  // ---------- the pieces ----------
  // put every pivot back at rest so the bake's bind pose is the built pose (Blocky.make leaves it in its base pose)
  function rest(f) {
    for (const n of [f.torso, f.head, f.skirt].concat(f.legs, f.knees, f.arms, f.elbows)) n.rotation.set(0, 0, 0);
    f.hips.position.y = f.hipY;
    f.root.updateMatrixWorld(true);
  }

  // a conical helmet with a nose bar and a rim band, over hair that shows at the sides and back
  function helmet(rig, head, R, hairC, token) {
    // the hair: one mass behind and round the sides, tucked inside the helmet's line
    if (token) rig.ball(head, rig.sphere(5, 3), hairC, R, 0, -R * 0.22, -R * 0.36, [1.1, 0.86, 0.86], [0, PI / 5, 0]);
    else rig.ball(head, rig.sphere(6, 3), hairC, R, 0, -R * 0.2, -R * 0.2, [1.2, 0.9, 1.02]);
    const segs = token ? 5 : 6, tilt = { r: [0.06, 0, 0] };
    if (token) {
      rig.lathe(head, [[0.0001, R * 1.9], [R * 1.13, R * 0.3]], segs, COL.steel, tilt);
      rig.lathe(head, [[R * 1.18, R * 0.4], [R * 1.19, R * 0.24]], segs, COL.steelShade, tilt);
      return;
    }
    rig.lathe(head, [[0.0001, R * 1.9], [R * 0.92, R * 1.04], [R * 1.13, R * 0.26]], segs, COL.steel, tilt);
    rig.lathe(head, [[R * 1.16, R * 0.38], [R * 1.17, R * 0.22]], segs, COL.steelShade, tilt);
    // the nose bar, from the rim down between the eyes
    rig.box(head, COL.steelShade, R * 0.17, R * 0.66, R * 0.1, 0, R * 0.02, R * 1.06, [0.22, 0, 0]);
  }
  function beard(rig, head, R, v, token) {
    if (v.beard === 'none') return;
    const b = token ? rig.sphere(4, 2) : rig.sphere(5, 3);
    if (v.beard === 'full') rig.ball(head, b, v.beardC, R * 0.74, 0, -R * 0.76, R * 0.36, [1.04, 0.92, 0.8]);
    else rig.ball(head, b, v.beardC, R * 0.62, 0, -R * 0.68, R * 0.4, [1.0, 0.75, 0.8]);
  }
  // the token's body: the same pivots as the kit's figure, in a handful of facets
  function tokenBody(rig, f, v, tunic, d) {
    const { R, tl, hipY, shHalf, waistR, hemR, armR, ua, fa, hs, mHem, robeR } = d, sk = f.spec.skirt;
    rig.ball(f.head, rig.sphere(6, 4), v.skin, R, 0, 0, 0, [1, 1.04, 0.96]);
    for (const s of [-1, 1]) rig.ball(f.eyes, rig.sphere(4, 2), 0x2b1d16, R * 0.09, s * 0.36 * R, -0.02 * R, R * 0.9);
    rig.lathe(f.torso, [[R * 0.4, tl + 0.02], [shHalf * 0.86, tl * 0.9], [waistR * 0.98, -0.03]], 5, COL.mail);
    rig.lathe(f.skirt, [[waistR * 1.04, 0.04], [robeR(mHem) * 1.07 + 0.012, mHem]], 5, COL.mail);
    rig.lathe(f.skirt, [[robeR(mHem) * 0.98, mHem + 0.02], [hemR, -hipY * sk], [0.0001, -hipY * sk + 0.005]], 5, tunic);
    const legR = waistR * 0.26;
    for (let i = 0; i < 2; i++) {
      rig.limb(f.legs[i], V(0, 0.02, 0), V(0, -hipY * 0.5, 0), legR, legR * 0.9, COL.wraps, 4, true);
      rig.limb(f.knees[i], V(0, 0, 0), V(0, -hipY * 0.5 + R * 0.12, 0), legR * 0.9, legR * 0.8, COL.wraps, 4, true);
      rig.ball(f.knees[i], rig.sphere(4, 2), COL.boot, R * 0.22, 0, -hipY * 0.5 + R * 0.08, R * 0.22, [1.05, 0.6, 1.5]);
      rig.limb(f.arms[i], V(0, 0.02, 0), V(0, -ua, 0), armR * 1.1, armR * 1.2, COL.mail, 4, true);
      rig.limb(f.elbows[i], V(0, 0.02, 0), V(0, -fa, 0), armR * 1.05, armR * 1.35, tunic, 4, true);
      rig.ball(f.hands[i], rig.sphere(4, 2), v.skin, hs, 0, -hs * 0.08, 0, [0.45, 0.6, 0.36]);
    }
  }

  // the bow: two limbs that bend, a string whose middle follows the right hand, and an arrow that shows on the string
  // (bow frame: y along the stave, +z the back of the bow toward the target, the string on the -z side)
  const LIMB = 0.83, BRACE = 0.13;
  function bow(rig, f, hs, token) {
    const node = rig.node(f.hands[0], 0, -hs * 0.1, 0);
    const top = rig.node(node, 0, 0.05, 0), bot = rig.node(node, 0, -0.05, 0), nock = rig.node(node, 0, 0, -BRACE);
    const arrow = rig.node(nock, 0.026, 0, 0);
    const n = token ? 2 : 3;
    for (const [nd, s] of [[top, 1], [bot, -1]]) {
      const spine = [], radii = [];
      for (let i = 0; i < n; i++) { const t = i / (n - 1); spine.push(V(0, s * t * LIMB, -BRACE * 0.9 * t * t)); radii.push(lerp(0.024, 0.012, t)); }
      rig.geo(nd, window.Blocky.sweep(spine, radii, 3, PI / 2), COL.yew);
    }
    if (!token) rig.limb(node, V(0, -0.09, 0), V(0, 0.09, 0), 0.029, 0.029, COL.grip, 4, true);
    // the string, in two runs that meet at the nock; the ends follow the limbs, the middle the nock
    node.updateWorldMatrix(true, false);
    const inv = node.matrixWorld.clone().invert(), tv = V(0, 0, 0);
    const skin = (x, y, z) => { tv.set(x, y, z).applyMatrix4(inv); return [[tv.y > 0.3 ? top : tv.y < -0.3 ? bot : nock, 1]]; };
    const tipT = V(0, LIMB + 0.05, -BRACE * 0.9), tipB = V(0, -LIMB - 0.05, -BRACE * 0.9), mid = V(0, 0, -BRACE);
    rig.geo(node, rig.limbGeo(tipT, mid, 0.009, 0.009, 3, true), COL.string, skin);
    rig.geo(node, rig.limbGeo(mid, tipB, 0.009, 0.009, 3, true), COL.string, skin);
    // the arrow, from the nock forward along +z
    rig.limb(arrow, V(0, 0, 0), V(0, 0, 0.74), 0.012, 0.012, COL.shaft, 3, true);
    rig.limb(arrow, V(0, 0, 0.73), V(0, 0, 0.85), 0.026, 0.003, COL.head, 3, true);
    if (!token) rig.box(arrow, COL.fletch, 0.07, 0.014, 0.14, 0, 0, 0.1);
    return { node, top, bot, nock, arrow };
  }
  // a bundle of arrows, heads down, held in the right hand to plant (hidden unless the pose asks for it)
  function handSheaf(rig, f, hs, token) {
    const node = rig.node(f.hands[1], 0, -hs * 0.2, 0);
    rig.limb(node, V(0, -0.42, 0), V(0, 0.32, 0), 0.03, 0.045, COL.shaft, 4, true);
    if (!token) rig.box(node, COL.fletch, 0.11, 0.13, 0.11, 0, 0.3, 0, [0, PI / 4, 0]);
    return node;
  }
  // the arrow bag at the right hip, behind the hand: linen, the fletchings showing
  function arrowBag(rig, f, waistR, token) {
    const x = -waistR * 0.9, z = -waistR * 0.55;
    rig.limb(f.torso, V(x, 0.05, z), V(x - 0.03, -0.27, z - 0.02), 0.064, 0.056, COL.bag, token ? 3 : 5, !!token);
    if (!token) rig.box(f.torso, COL.fletch, 0.08, 0.11, 0.08, x + 0.003, 0.12, z + 0.002, [0, 0.5, 0.1]);
  }
  // the strap (guige) over the right shoulder, across the chest to the left hip, kept just outside the mail
  function strap(rig, f, prof, tl) {
    const path = [[-0.5, 0.97], [0.0, 0.56], [0.55, 0.16], [0.85, -0.02]], pts = path.map(([fx, fy]) => {
      const y = tl * fy, r = prof(y) + 0.03, a = Math.atan2(fx, Math.sqrt(Math.max(0, 1 - fx * fx)));
      return V(Math.sin(a) * r, y, Math.cos(a) * r);
    });
    pts[0].set(-prof(tl * 0.95) * 0.64, tl + 0.012, 0.0);
    for (let i = 0; i < pts.length - 1; i++) rig.limb(f.torso, pts[i], pts[i + 1], 0.022, 0.022, COL.strap, 3, true);
  }
  // the spear: an ash shaft held a third of the way up, a leaf-shaped steel head
  function spear(rig, f, token) {
    const node = rig.node(f.hands[1], 0, -0.02, 0.0);
    rig.limb(node, V(0, -0.85, 0), V(0, 1.68, 0), 0.022, 0.02, COL.spear, token ? 3 : 4, true);
    rig.lock(node, V(0, 1.62, 0), V(0, 1.94, 0), 0.042, COL.steel, 0, 0.45, token ? 3 : 4);
    return node;
  }
  // ---------- the run (the Lion withdrawal): longer strides with a moment off the ground, arms pumping ----------
  function runPose(f, ph, amt, base, role) {
    const p = window.FigureKit.P(Object.assign({}, f.base, base || {})), b = Object.assign({}, p);
    const q = ph * 0.62, s = Math.sin(q), A = 0.62 * amt;
    const leg = (u) => [A * Math.sin(u), amt * (0.2 + 1.25 * Math.max(0, Math.cos(u)) + 0.15 * Math.max(0, -Math.cos(u)))];
    const [l0, k0] = leg(q), [l1, k1] = leg(q + PI);
    p.lf0 = l0; p.k0 = k0; p.lf1 = l1; p.k1 = k1;
    p.y = 0.045 * amt * (0.5 - 0.5 * Math.cos(2 * q));
    p.lean = b.lean + 0.22 * amt; p.twist = b.twist + 0.12 * s * amt; p.roll = b.roll + 0.03 * Math.cos(q) * amt;
    p.hx = b.hx - 0.18 * amt + 0.05 * Math.sin(2 * q + 0.6) * amt;
    if (role === 'archer') {
      // the bow arm keeps its carry and swings a little; the free right arm pumps with the elbow bent
      p.af0 = b.af0 - 0.2 * s * amt;
      p.af1 = lerp(b.af1, 0.25, amt) + 0.8 * s * amt; p.e1 = lerp(b.e1, 1.4, amt); p.ao1 = lerp(b.ao1, 0.2, amt);
    } else {
      // the spear and the shield keep their hold
      p.af1 = b.af1 + 0.25 * s * amt; p.af0 = b.af0 - 0.25 * s * amt;
    }
    p.wk = amt;
    return p;
  }

  function make(ctx, B, kit, rig, o) {
    o = o || {};
    const side = o.side === 'bull' ? 'bull' : 'lion', role = o.role === 'spear' ? 'spear' : 'archer', token = !!o.token;
    const v = VARIANTS[((o.v | 0) % VARIANTS.length + VARIANTS.length) % VARIANTS.length], tunic = SIDES[side].tunic;
    const spec = { preset: 'man', skirt: 0.56, hem: 1.32, mantle: false, hat: 'none', hair: 'none', beard: 'none', staff: 'none', seg: 0.42,
      col: { skin: v.skin, hair: v.hair, robe: tunic, top: COL.mail, sleeve: tunic, pants: COL.wraps, sandal: COL.boot, belt: COL.belt } };
    let f;
    if (token) {
      // the token borrows the kit figure's pivots, pose and walk, but none of its pieces: those go on a rig that's
      // thrown away, and the token's own few facets go on this one
      f = B.make(kit, kit.makeRig(), spec);
      rig.root.add(f.root);
      f.seed = rig.figures.length * 2.3 + 0.7;
      rig.figures.push(f);
      f.rig = rig;
      rest(f);
      f.range = [rig.pieces.length, 0];
    } else {
      f = B.make(kit, rig, spec);
      rest(f);
    }
    const S = f.spec, headH = f.H / S.heads, R = headH / 2, shHalf = S.shoulder * headH / 2, waistR = shHalf * S.waist, chestR = shHalf * 0.92;
    const tl = f.chinY - f.hipY, hipY = f.hipY, armR = Math.max(0.035, shHalf * 0.24), ua = tl * 0.5, fa = tl * 0.45, hs = R * 0.55;
    const hemR = waistR * S.hem, sk = S.skirt;
    // the torso's radius at a height (the kit's own profile), for keeping straps outside it
    const tprof = [[R * 0.32, tl + 0.02], [shHalf * 0.62, tl * 0.99], [shHalf * 0.92, tl * 0.9], [chestR, tl * 0.55], [waistR, 0.0], [waistR * 0.95, -0.04]];
    const rAt = (prof, y) => { for (let i = 0; i < prof.length - 1; i++) { const [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; if (y <= y0 && y >= y1) return r0 + (r1 - r0) * (y0 - y) / Math.max(1e-6, y0 - y1); } return prof[prof.length - 1][0]; };
    const torsoR = (y) => rAt(tprof, y);
    const robeR = (y) => rAt([[waistR * 1.08, -0.06], [hemR, -hipY * sk]], y);
    const mHem = -hipY * 0.27;

    if (token) tokenBody(rig, f, v, tunic, { R, tl, hipY, shHalf, waistR, hemR, armR, ua, fa, hs, mHem, robeR });
    else {
      // the mail: a skirt to mid-thigh over the tunic with a darker lip at the hem, short sleeves over the tunic's sleeves
      rig.lathe(f.skirt, [[waistR * 1.04, 0.05], [robeR(mHem) * 1.07 + 0.012, mHem], [robeR(mHem) * 0.99, mHem - 0.014]], 6, COL.mail);
      for (const arm of f.arms) rig.limb(arm, V(0, armR * 1.2, 0), V(0, -ua * 0.98, 0), armR * 1.2, armR * 1.32, COL.mail, 5, true);
      // a ball at each elbow closes the kit's open forearm sleeve
      for (const el of f.elbows) rig.ball(el, rig.sphere(4, 2), tunic, armR * 1.12, 0, 0, 0);
    }
    helmet(rig, f.head, R, v.hair, token);
    beard(rig, f.head, R, v, token);

    let B0 = null, spr = null, sheafN = null;
    if (role === 'archer') {
      B0 = bow(rig, f, hs, token);
      sheafN = handSheaf(rig, f, hs, token);
      arrowBag(rig, f, waistR, token);
      if (!token) strap(rig, f, torsoR, tl);
      // the shield on the back, point down, hung a little across from the right shoulder, its bottom off the legs
      shield(rig, f.torso, basis([-1, 0, 0], [0, 1, 0], [0, 0, -1], [0.0, tl - 0.42, -(chestR + 0.05)], [-0.1, 0, 0.14]), side, token, false);
    } else {
      spr = spear(rig, f, token);
      // the shield on the left forearm: its face outward, its top toward the hand's thumb side when the forearm is level
      shield(rig, f.elbows[0], basis([0, 1, 0], [0, 0, 1], [1, 0, 0], [armR * 1.45 + 0.03, -fa * 0.5, -0.11]), side, token, true);
    }
    f.range[1] = rig.pieces.length;

    // ---------- poses with props ----------
    const pose0 = f.pose, tv = V(0, 0, 0), Z = V(0, 0, 1), dir = V(0, 0, 0);
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qh = new THREE.Quaternion(), m4 = new THREE.Matrix4();
    const ex = V(0, 0, 0), ey = V(0, 0, 0), ez = V(0, 0, 0), up = V(0, 0, 0), pe = V(0, 0, 0), ph = V(0, 0, 0), pf = V(0, 0, 0), pr = V(0, 0, 0);
    const TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0)), LEVEL = new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2 + 0.1, 0, 0));
    f.pose = (p) => {
      pose0(p);
      // the short tunic and mail lift at the front as the thighs come up (a crouch, a kneel)
      const a = (p.lf0 + p.lf1) / 2;
      f.skirt.rotation.x = -(0.1 * a + 0.55 * Math.max(0, a - 0.25));
      if (p.pitch !== undefined) { f.root.rotation.x = p.pitch; f.root.position.y = p.lift || 0; }
      if (spr) {
        // upright with the body while the arm is low or right up; levelled forward over the shield, the point a little
        // down, while the upper arm is raised about level (brace, push)
        f.root.updateMatrixWorld(true);
        f.arms[1].getWorldPosition(pe); f.elbows[1].getWorldPosition(ph);
        f.root.getWorldQuaternion(qa); up.set(0, 1, 0).applyQuaternion(qa);
        const fy = ez.subVectors(ph, pe).normalize().dot(up), w = smooth((fy + 0.62) / 0.3) * (1 - smooth((fy - 0.72) / 0.15));
        if (w > 0) qa.slerp(qb.copy(qa).multiply(LEVEL), w);
        f.hands[1].getWorldQuaternion(qh);
        spr.quaternion.copy(qh.invert().multiply(qa));
      }
      if (sheafN) {
        sheafN.scale.setScalar(p.sheaf > 0.5 ? 1 : 1e-4);
        sheafN.rotation.set(p.af1 + p.e1 - p.lean, 0, p.ao1);
      }
      if (B0) {
        // the bow's back faces along the left forearm with its stave as upright as it can be (so a raised arm aims
        // it, and a forearm held level carries it upright); with the arm right up it stands upright with the body
        f.root.updateMatrixWorld(true);
        f.elbows[0].getWorldPosition(pe); f.hands[0].getWorldPosition(ph);
        ez.subVectors(ph, pe).normalize();
        // drawing: the bow faces straight along the line from the drawing fist to the bow hand
        f.hands[1].localToWorld(pf.set(0, -hs * 0.35, 0));
        const along = ph.distanceTo(pf), ca = ex.subVectors(ph, pf).normalize().dot(ez);
        const t = smooth((ca - 0.35) / 0.25) * smooth((along - 0.2) / 0.1);
        if (t > 0) ez.lerp(ex, t).normalize();
        f.root.getWorldQuaternion(qa); up.set(0, 1, 0).applyQuaternion(qa);
        // aimed while the upper arm is lifted to shoot; carried upright (top a little forward) while it hangs, and
        // held upright with the arm right up
        f.arms[0].getWorldPosition(pr);
        const fu = pr.subVectors(pe, pr).normalize().dot(up), w = smooth((fu + 0.45) / 0.3) * (1 - smooth((fu - 0.8) / 0.15));
        const fy = ez.dot(up);
        qa.multiply(TILT);
        if (w > 0) {
          ey.copy(up).addScaledVector(ez, -fy).normalize(); ex.crossVectors(ey, ez);
          qa.slerp(qb.setFromRotationMatrix(m4.makeBasis(ex, ey, ez)), w);
        }
        f.hands[0].getWorldQuaternion(qh);
        B0.node.quaternion.copy(qh.invert().multiply(qa));
        B0.node.updateMatrixWorld(true);
        f.hands[1].localToWorld(tv.set(0, -hs * 0.35, 0));
        B0.node.worldToLocal(tv);
        // the string follows the right hand when it's behind the bow and in line with it
        const back = -tv.z, lat = Math.hypot(tv.x, tv.y);
        const k = smooth((back - 0.07) / 0.07) * smooth((0.09 + 0.15 * back - lat) / 0.05) * (1 - smooth((back - 0.85) / 0.1));
        B0.nock.position.set(tv.x * k, tv.y * k, lerp(-BRACE, Math.max(-0.76, tv.z), k));
        const draw = Math.max(0, -B0.nock.position.z - BRACE);
        B0.top.rotation.x = -0.5 * draw; B0.bot.rotation.x = 0.5 * draw;
        B0.arrow.scale.setScalar(k > 0.8 ? 1 : 1e-4);
        dir.copy(B0.nock.position).negate().normalize();
        B0.arrow.quaternion.setFromUnitVectors(Z, dir);
      }
    };
    const Pf = window.FigureKit.P;
    f.base = role === 'archer'
      ? { af0: 0.55, e0: 1.5, ao0: 0.26, at0: -0.2, af1: 0.08, ao1: 0.14, e1: 0.3, hx: 0.04 }
      : { af0: 0.3, e0: 1.5, at0: 0.55, ao0: 0.12, af1: 0.4, e1: 1.0, ao1: 0.05, hx: 0.04 };
    // the loose walk, the carrying arm keeping its hold; a run when the base asks for one
    f.gait = (ph, amt, base) => {
      if (base && base.run) return runPose(f, ph, amt, base, role);
      const p = B.walkPose(f, ph, amt, base), b = Pf(Object.assign({}, f.base, base || {}));
      p.af0 = b.af0 + (p.af0 - b.af0) * 0.35; p.e0 = b.e0 + 0.05 * Math.sin(ph);
      if (role === 'spear') { p.af1 = b.af1 + (p.af1 - b.af1) * 0.6; p.e1 = b.e1; }
      return p;
    };
    f.role = role; f.side = side; f.bow = B0; f.spear = spr; f.sheaf = sheafN;
    return f;
  }

  // ---------- poses ----------
  const ARCHER = {
    stand: {},
    // an arrow from the bag laid on the string, the bow held across the body
    nock: { twist: -0.7, lean: 0, hy: 0.28, hx: 0.3, af0: 1.37, at0: 0.04, ao0: -0.18, e0: 0, af1: -0.12, at1: 1.14, ao1: 1.43, e1: 1.73, lf0: 0.1, lf1: -0.06 },
    // a volley: the bow arm raised high, the string drawn to the cheek, the body side-on
    drawHigh: { twist: -1.25, lean: -0.15, hy: 1.06, af0: 2.11, at0: 0.11, ao0: 0.18, e0: 0, af1: 0.01, at1: 0.8, ao1: 1.9, e1: 1.94, hx: 0.1, lf0: 0.2, lf1: -0.16, k0: 0.08, lo0: 0.1, lo1: 0.1 },
    looseHigh: { twist: -1.25, lean: -0.15, hy: 1.06, af0: 2.11, at0: 0.11, ao0: 0.18, e0: 0, af1: -0.2, at1: 0.2, ao1: 2.05, e1: 1.0, hx: 0.1, lf0: 0.2, lf1: -0.16, k0: 0.08, lo0: 0.1, lo1: 0.1 },
    // a flatter shot, from a wall: leaning into it
    drawLevel: { twist: -1.05, lean: -0.06, hy: 0.89, af0: 1.62, at0: 0, ao0: 0.09, e0: 0, af1: 0.12, at1: 0.57, ao1: 1.79, e1: 2.1, hx: 0.1, lf0: 0.2, lf1: -0.16, k0: 0.08, lo0: 0.1, lo1: 0.1 },
    looseLevel: { twist: -1.05, lean: -0.06, hy: 0.89, af0: 1.62, at0: 0, ao0: 0.09, e0: 0, af1: -0.15, at1: 0.0, ao1: 2.0, e1: 1.1, hx: 0.1, lf0: 0.2, lf1: -0.16, k0: 0.08, lo0: 0.1, lo1: 0.1 },
    // bending to stick a sheaf of arrows in the ground in front (the tap moment)
    plant: { lean: 0.5, lf0: 0.55, k0: 0.85, lf1: 0.05, k1: 0.6, af1: 0.85, e1: 0.15, ao1: 0.2, af0: 1.0, e0: 2.0, ao0: 0.3, hx: 0.25, sheaf: 1 },
    // ducked behind a merlon, the bow held up in front
    duck: { lf0: 1.15, lf1: 1.0, k0: 2.05, k1: 1.9, lo0: 0.14, lo1: 0.14, lean: 0.38, hx: -0.15, af0: 1.4, e0: 1.5, ao0: 0.6, af1: 0.7, e1: 1.2, ao1: 0.1 },
    // cheering, the bow raised high
    cheer: { af0: 2.8, e0: 0.2, ao0: 0.3, af1: 2.5, e1: 0.5, ao1: 0.4, hx: -0.3, lean: -0.06 },
  };
  const SPEAR = {
    stand: {},
    // marching: the walk's base, spear upright, shield carried
    march: { af0: 0.3, e0: 1.5, at0: 0.55, ao0: 0.12, af1: 0.4, e1: 1.0, ao1: 0.05 },
    // the shield wall: leaning in, the shield square in front, the spear levelled over it
    brace: { lean: 0.26, twist: -0.4, lf0: 0.45, k0: 0.45, lf1: -0.35, k1: 0.12, af0: 0.5, e0: 1.55, at0: 1.17, ao0: 0.1, af1: 1.65, e1: 1.2, ao1: 0.55, at1: 0, hx: -0.18, hy: 0.32 },
    push: { lean: 0.42, twist: -0.4, lf0: 0.55, k0: 0.6, lf1: -0.55, k1: 0.12, af0: 0.62, e0: 1.55, at0: 1.17, ao0: 0.1, af1: 1.6, e1: 1.25, ao1: 0.55, at1: 0, hx: -0.3, hy: 0.32 },
    // cheering, the spear thrust up and the shield raised
    cheer: { af1: 2.75, e1: 0.2, ao1: 0.3, af0: 0.45, e0: 1.5, at0: 0.6, ao0: 0.2, hx: -0.3, lean: -0.05 },
    // lying still on the back like a toy soldier knocked over, the shield over the chest (pitch and lift for the sheet)
    lie: { af0: 0.3, e0: 1.55, at0: 1.35, ao0: 0.1, af1: 0.1, e1: 0.1, ao1: 0.12, hx: 0.0, lo0: 0.08, lo1: 0.08, pitch: -PI / 2, lift: 0.34 },
  };
  // the topple, k 0..1: falling backwards about the heels, slow then faster, a small settle at the end
  const fall = (k) => {
    k = Math.max(0, Math.min(1, k));
    const e = k < 0.85 ? Math.pow(k / 0.85, 2.2) : 1 + 0.04 * Math.sin((k - 0.85) / 0.15 * PI);
    return { pitch: -PI / 2 * e, lift: 0.34 * smooth((e - 0.6) / 0.4) };
  };
  // a sheaf of arrows stuck in the ground, fanned a little, fletchings up (a prop at x, y, z on `node`)
  function sheaf(rig, node, x, y, z, seed) {
    seed = seed || 1;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + seed, r = 0.03 + 0.02 * ((i * 7 + seed * 3) % 3), tx = Math.cos(a) * r * 3.2, tz = Math.sin(a) * r * 3.2;
      const b = V(x + Math.cos(a) * r, y - 0.03, z + Math.sin(a) * r), t = V(x + tx, y + 0.66, z + tz);
      rig.limb(node, b, t, 0.011, 0.011, COL.shaft, 3, true);
      const d = V(0, 0, 0).subVectors(t, b).normalize();
      rig.box(node, COL.fletch, 0.05, 0.13, 0.012, t.x - d.x * 0.08, t.y - d.y * 0.08, t.z - d.z * 0.08, [Math.atan2(d.z, d.y) * 0, a, -Math.atan2(d.x, d.y)]);
    }
  }

  // on the character sheet only: ?yaw=1.57 turns a posed figure, ?v=2 picks another face
  const Q = new URLSearchParams(location.search);
  function sheet(f) {
    const yaw = parseFloat(Q.get('yaw'));
    if (!isNaN(yaw)) { const pose0 = f.pose; f.pose = (p) => { pose0(p); f.root.rotation.y = yaw; }; }
    return f;
  }
  const entry = (side, role, name, note, v0) => ({
    name, note,
    build(ctx, B, kit, rig) {
      const v = Q.get('v') !== null ? +Q.get('v') : v0;
      return sheet(make(ctx, B, kit, rig, { side, role, v, token: Q.get('token') === '1' }));
    },
    make: (ctx, B, kit, rig, o) => make(ctx, B, kit, rig, Object.assign({ side, role }, o || {})),
    poses: role === 'archer' ? ARCHER : SPEAR,
  });
  Object.assign(window.CHARACTERS, {
    siegeSoldier: { make, sheaf, fall, poses: { archer: ARCHER, spear: SPEAR }, COL, SIDES },
    lionArcher: entry('lion', 'archer', 'Lion archer', 'mail over a blue tunic, nose-bar helmet, yew longbow, the gold lion on blue shield slung on his back', 0),
    bullArcher: entry('bull', 'archer', 'Bull archer', 'mail over a red tunic, nose-bar helmet, yew longbow, the white bull on red shield slung on his back', 1),
    lionSpear: entry('lion', 'spear', 'Lion spearman', 'mail over a blue tunic, nose-bar helmet, spear, kite shield with the gold lion rampant', 2),
    bullSpear: entry('bull', 'spear', 'Bull spearman', 'mail over a red tunic, nose-bar helmet, spear, kite shield with the white bull passant', 3),
  });
})();
