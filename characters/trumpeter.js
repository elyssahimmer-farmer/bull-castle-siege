// The Bull trumpeter (DESIGN.md §5, §6, §9; research.md §5, §7). Froissart has "sounds of trumpets and other warlike
// instruments" as the garrison comes back from the sally at Hennebont (Johnes p. 106). He sounds the alarm, the sally
// and the triumph.
// The sources read don't describe a trumpeter, so his dress is from the time (about 1400; DESIGN.md §12): a short
// tunic parti-coloured in the Bull's livery, white on his left and red on his right (livery colours: research.md §5),
// hose counterchanged red and white, his hair cut round at the ears under a dark felt cap with a rolled brim, and a long straight trumpet (a busine) of brass with a
// small square banner of the Bull's arms hanging from it: a white bull walking on red, with gold horns (the family's
// arms, DESIGN.md §10.9). Distinctive colour: the red-and-white halves. Distinctive shape: the long trumpet and its
// banner.
//
// Poses: stand (the trumpet held by its middle, angled down), sound (lifted to his lips, blowing), cheer (the trumpet
// raised high, the other fist up), walk. The trumpet follows the right arm by itself: held by the middle when the arm
// is low, slid to the mouthpiece and pointed up and out as the arm lifts. So it works from a Script too.
// The banner hangs on the trumpet's side: it reads best when he stands side-on or three-quarters to the camera.
// CHARACTERS.trumpeter.anim gives the moving versions for the choreographer:
//   anim.stand(t, seed)          standing, breathing, glancing about
//   anim.sound(u, seed, base)    u 0..1 over about 4 s: he lifts the trumpet, fills his chest, blows (leaning back a
//                                little, swaying with the call), and lowers it (the alarm at 96 s, the triumph, a tap)
//   anim.cheer(t, seed)          the trumpet raised high and shaken, the left fist pumping (the triumph, 142 to 158 s)
// The pivots are back at rest when build returns, so the bake binds at rest.
window.CHARACTERS = window.CHARACTERS || {};
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const C = { red: 0xb5322a, white: 0xefe9dc, hose: 0x7a2a24, cap: 0x4a3a34, capBrim: 0x5c4a42, brass: 0xd4a83a, brassDark: 0xa8822a,
    hair: 0x5e3e2a, shoe: 0x4a3222, belt: 0x5a3a24, skin: 0xf2c9a8, gold: 0xe0b040 };
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const win = (s, a, b, e) => smooth((s - a) / e) * (1 - smooth((s - (b - e)) / e));

  const POSES = {
    stand: { af0: 0.08, ao0: 0.14, e0: 0.3, af1: 0.2, ao1: 0.1, e1: 0.75, at1: 0.2, hx: 0.04 },
    // the trumpet at his lips, pointing up and out, the left hand steadying it further along
    sound: { af1: 1.69, ao1: 0.07, at1: 0.95, e1: 1.26, af0: 2.03, ao0: -0.27, at0: 0.85, e0: 0.46, lean: -0.08, hx: -0.12 },
    // the trumpet raised high, the left fist up
    cheer: { af1: 2.6, ao1: 0.35, at1: 0, e1: 0.35, af0: 2.5, ao0: 0.5, at0: 0, e0: 0.9, lean: -0.05, hx: -0.15 },
  };

  function build(ctx, B, kit, rig) {
    const THREE = ctx.THREE, V = (x, y, z) => new THREE.Vector3(x, y, z), P = window.FigureKit.P;
    const f = B.make(kit, rig, {
      preset: 'man', height: 1.74, skirt: 0.55, hem: 1.28, mantle: false, hair: 'none', beard: 'none', hat: 'none',
      col: { skin: C.skin, robe: C.red, top: C.red, sleeve: C.red, pants: C.hose, sandal: C.shoe, belt: C.belt, hair: C.hair },
    });
    const REST = P({ hx: 0, af0: 0, af1: 0, ao0: 0, ao1: 0, e0: 0, e1: 0 });
    f.pose(REST);
    const S = f.spec, H = f.H, headH = H / S.heads, R = headH / 2, hipY = f.hipY, tl = f.chinY - hipY;
    const shHalf = S.shoulder * headH / 2, waistR = shHalf * S.waist, hemR = waistR * S.hem, chestR = shHalf * 0.92;
    const armR = Math.max(0.035, shHalf * 0.24), ua = tl * 0.5, fa = tl * 0.45;
    const head = f.head, torso = f.torso, skirt = f.skirt;

    // ---- the livery, counterchanged: the tunic white on his left (+x) and red on his right, the hose the other way
    // round. Done by recolouring the kit's own pieces (no extra triangles): the left sleeve and shoulder go white,
    // the torso and skirt split down the middle (their facets meet there), the left leg goes red and the right white.
    const pieces = rig.pieces, mine = pieces.slice(f.range[0]);
    const recolour = (pc, hex) => { pc.color = new THREE.Color(hex); };
    const split = (pc, hex) => {
      const a = pc.arr, keep = [], move = [];
      for (let i = 0; i < a.length; i += 9) ((a[i] + a[i + 3] + a[i + 6]) / 3 > 1e-4 ? move : keep).push(...a.subarray(i, i + 9));
      if (!move.length) return;
      pc.arr = new Float32Array(keep);
      pieces.push({ nd: pc.nd, arr: new Float32Array(move), nrm: null, color: new THREE.Color(hex), skin: pc.skin });
    };
    const red = new THREE.Color(C.red), hose = new THREE.Color(C.hose);
    for (const pc of mine) {
      if (pc.nd === f.arms[0] || pc.nd === f.elbows[0]) recolour(pc, C.white);
      else if ((pc.nd === torso || pc.nd === skirt) && pc.color.equals(red)) split(pc, C.white);
      else if ((pc.nd === f.legs[0] || pc.nd === f.knees[0]) && pc.color.equals(hose)) recolour(pc, C.hose);
      else if ((pc.nd === f.legs[1] || pc.nd === f.knees[1]) && pc.color.equals(hose)) recolour(pc, C.white);
    }
    // a brass belt buckle
    rig.box(torso, C.brass, 0.05, 0.04, 0.02, 0, 0.015, waistR * 1.07 + 0.006);

    // ---- his hair, cut round at the ears as men wore it about 1400, and over it a soft dark felt cap with a rolled brim
    const hc = [0, R * 0.06, -R * 0.06];
    rig.piece(head, new THREE.SphereGeometry(1, 6, 3, Math.PI * 0.8, Math.PI * 1.4, 0.8, 1.15), C.hair, hc[0], hc[1], hc[2], { s: [R * 1.1, R * 1.08, R * 1.1] });
    rig.piece(head, new THREE.SphereGeometry(1, 4, 1, Math.PI * 0.2, Math.PI * 0.6, 0.9, 0.42), C.hair, 0, R * 0.04, 0, { s: [R * 1.06, R * 1.08, R * 1.04] });
    rig.lathe(head, [[0.0001, R * 1.34], [R * 0.74, R * 1.28], [R * 1.12, R * 0.98], [R * 1.19, R * 0.62]], 8, C.cap, { phi0: Math.PI / 8, z: -R * 0.06, r: [-0.14, 0, 0] });
    rig.lathe(head, [[R * 1.2, R * 0.74], [R * 1.27, R * 0.66], [R * 1.25, R * 0.5]], 8, C.capBrim, { phi0: Math.PI / 8, z: -R * 0.06, r: [-0.14, 0, 0] });

    // ---- the trumpet: along +z from the mouthpiece (z = -0.12, behind the hand) to the bell, on a pivot in the right
    // hand; pose() turns and slides it
    const trumpet = rig.node(f.hands[1], 0, -R * 0.16, 0);
    const L = 1.12, M = -0.12;
    rig.limb(trumpet, V(0, 0, M), V(0, 0, L - 0.14), 0.016, 0.016, C.brass, 5, true);
    rig.limb(trumpet, V(0, 0, L - 0.14), V(0, 0, L), 0.02, 0.075, C.brass, 6, true);
    rig.limb(trumpet, V(0, 0, M - 0.03), V(0, 0, M), 0.024, 0.016, C.brassDark, 5, true);
    rig.limb(trumpet, V(0, 0, 0.32), V(0, 0, 0.4), 0.028, 0.028, C.brassDark, 5, true);
    // the banner: red, square, hanging under the tube between two ties, with the bull on both faces
    const b0 = 0.5, b1 = 0.84, bw = b1 - b0, bh = 0.3, by = -0.024 - bh / 2, bz = (b0 + b1) / 2;
    rig.box(trumpet, C.red, 0.012, bh, bw, 0, by, bz);
    rig.box(trumpet, C.gold, 0.016, 0.02, bw, 0, by - bh / 2 - 0.006, bz);
    // the bull passant, facing the staff (the mouthpiece end) on both faces, as heraldry is drawn: body, head, horns,
    // fore and hind legs, tail
    const plane = new THREE.PlaneGeometry(1, 1);
    for (const sx of [1, -1]) {
      const x = sx * 0.0075, ry = sx * Math.PI / 2;
      const q = (hex, w, h, y, z) => rig.piece(trumpet, plane, hex, x, by + y, bz + z, { s: [w, h, 1], r: [0, ry, 0] });
      q(C.white, 0.16, 0.08, 0.0, 0.01);          // body
      q(C.white, 0.06, 0.06, 0.035, -0.095);      // head, forward and up
      q(C.gold, 0.1, 0.018, 0.072, -0.095);       // horns
      q(C.white, 0.035, 0.07, -0.07, -0.05);      // forelegs
      q(C.white, 0.035, 0.07, -0.07, 0.06);       // hind legs
      q(C.white, 0.015, 0.09, 0.0, 0.1);          // tail
    }

    f.range[1] = rig.pieces.length;   // the shade bake covers the added pieces too
    f.pose(REST);
    f.base = POSES.stand;

    // ---- the trumpet follows the arm: held by the middle and angled down when the arm is low, slid to the
    // mouthpiece and pointed up and out at his lips, raised steeply when the arm goes overhead
    const basePose = f.pose, sm = smooth;
    const D0 = V(0, -0.42, 0.9).normalize(), D1 = V(0, 0.2, 0.98).normalize(), D2 = V(0, 0.62, 0.78).normalize();
    const Z = V(0, 0, 1), dir = V(0, 0, 0), ax = V(0, 0, 0), qc = new THREE.Quaternion(), qt = new THREE.Quaternion();
    const grip0 = 0.42, home = V(0, -R * 0.16, 0);
    f.pose = (p) => {
      basePose(p);
      const k1 = sm((p.af1 - 0.45) / 0.65), k2 = sm((p.af1 - 1.9) / 0.5);
      dir.copy(D0).lerp(D1, k1).lerp(D2, k2).normalize();
      // the direction is in the body's frame: undo the arm and forearm above the hand
      qc.copy(f.arms[1].quaternion).multiply(f.elbows[1].quaternion).invert();
      qt.setFromUnitVectors(Z, dir);
      trumpet.quaternion.copy(qc).multiply(qt);
      // slide it so the hand holds the middle when carried, near the mouthpiece when sounding
      ax.copy(Z).applyQuaternion(trumpet.quaternion);
      trumpet.position.copy(home).addScaledVector(ax, -grip0 * (1 - k1));
    };

    // the walk: the loose walk, the trumpet hand swinging less (it's long)
    const kitGait = f.gait;
    f.gait = (ph, amt, base) => {
      const b = Object.assign({}, f.base, base || {}), p = kitGait(ph, amt, b);
      p.af1 = b.af1 + 0.45 * (p.af1 - b.af1); p.e1 = b.e1 + 0.5 * (p.e1 - b.e1);
      return p;
    };
    return f;
  }

  // ---------- the moving versions ----------
  const P = (o) => window.FigureKit.P(o);
  const blend = (a, b, w) => { const o = P(a), A = P(a); for (const key in b) o[key] = A[key] + (b[key] - A[key]) * w; return o; };
  const anim = {
    stand(t, seed) { return window.Motion.life(t, seed || 3, P(POSES.stand), true); },
    sound(u, seed, base) {
      const b = Object.assign({}, POSES.stand, base || {});
      const up = win(u, 0, 1, 0.16), p = blend(b, POSES.sound, up);
      // a breath in before the call, then the call: leaning back, swaying, the chest lifting with each phrase
      const breath = win(u, 0.12, 0.26, 0.06), call = win(u, 0.24, 0.86, 0.06);
      p.lean += 0.04 * breath - 0.06 * call;
      p.hx -= 0.06 * call;
      const ph = (u - 0.24) / 0.62 * TAU * 3;
      p.lean -= 0.025 * call * (0.5 + 0.5 * Math.sin(ph));
      p.roll += 0.035 * call * Math.sin(ph * 0.5);
      p.twist += 0.05 * call * Math.sin(ph * 0.5 + 0.8);
      p.af1 += 0.05 * call * Math.sin(ph); p.af0 += 0.05 * call * Math.sin(ph);
      return p;
    },
    cheer(t, seed) {
      const p = P(POSES.cheer), s = Math.sin(t * 5.2 + (seed || 0));
      p.af1 += 0.12 * s; p.e1 += 0.12 * s;
      p.e0 += 0.45 * Math.max(0, Math.sin(t * 5.2 + 1.4 + (seed || 0)));
      p.y += 0.02 * Math.max(0, Math.sin(t * 5.2 + (seed || 0)));
      p.roll += 0.03 * Math.sin(t * 2.6);
      return p;
    },
  };

  window.CHARACTERS.trumpeter = {
    name: 'The Bull trumpeter',
    note: 'red-and-white livery, a felt cap, a long trumpet with the Bull banner; sounds the alarm, the sally and the triumph',
    build, anim, poses: POSES,
  };
})();
