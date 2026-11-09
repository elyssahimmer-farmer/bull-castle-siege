// The Lady of the Bull (DESIGN.md §5, §6; research.md §2, §8). She is modelled on two real women: Agnes of Dunbar,
// "gud Dame Annes off Dwnbare", who held her castle (Wyntoun VIII.xxxiii), and the Countess at Hennebont, who
// "ascended a high tower, to see how her people behaved" (Froissart, Johnes p. 106).
// The sources read don't describe what either wore, so the dress is from the time (about 1400; DESIGN.md §12): a long
// red kirtle with fitted sleeves, a gold girdle low on the hips with its end hanging down the front, a white veil over
// a wimple that wraps the chin and throat, brown hair showing at the temples, a gold circlet over the veil, and a
// . Distinctive colour: the red with the white head-dress. Distinctive shape: the veil and circlet.
//
// Poses: stand (hands together at the girdle), watch (a hand shading her eyes), wave, triumph (both arms up), walk
// (the loose walk, a little gentler). CHARACTERS.lady.anim gives the moving versions for the choreographer:
//   anim.stand(t, seed)        standing with her hands together, breathing, glancing about
//   anim.watch(t, seed)        shading her eyes, looking slowly across the field
//   anim.wave(u, seed, base)   u 0..1 over about 3.5 s: the arm comes up, waves four times, comes down (the tap moment)
//   anim.triumph(t, seed)      both arms raised, a gentle lift and sway (the triumph, 142 to 158 s)
// The pivots are back at rest when build returns, so the bake binds at rest (see the note at the end of build).
window.CHARACTERS = window.CHARACTERS || {};
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const C = { gown: 0xb5322a, veil: 0xefe9dc, gold: 0xd4a83a, hair: 0x6e4a30, shoe: 0x6a2a22, skin: 0xf2c9a8 };
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const win = (s, a, b, e) => smooth((s - a) / e) * (1 - smooth((s - (b - e)) / e));

  const POSES = {
    // hands resting together in front, at the girdle
    stand: { af0: 0.3, af1: 0.3, e0: 0.78, e1: 0.78, ao0: -0.1, ao1: -0.1, at0: 0.5, at1: 0.5, hx: 0.04 },
    // the right hand flat at the brow, shading her eyes; the left resting at the girdle; looking out and a little up
    watch: { af1: 1.97, e1: 0.72, ao1: 0.57, at1: 1.48, af0: 0.3, e0: 0.78, ao0: -0.1, at0: 0.5, hx: -0.06, hy: 0.12, lean: -0.02 },
    // the right arm up and out, the hand open
    wave: { af1: 2.45, e1: 0.55, ao1: 0.45, at1: 0.0, af0: 0.3, e0: 0.78, ao0: -0.1, at0: 0.5, hx: -0.06, hz: -0.05 },
    // both arms raised, looking up a little
    triumph: { af0: 2.65, af1: 2.65, e0: 0.25, e1: 0.25, ao0: 0.42, ao1: 0.42, at0: 0, at1: 0, hx: -0.16, lean: -0.05 },
  };
  // a relaxed base for walking: arms down, the loose swing kept but gentler
  const WALK = { af0: 0.08, af1: 0.08, e0: 0.3, e1: 0.3, ao0: 0.12, ao1: 0.12, at0: 0, at1: 0, hx: 0.04 };

  function build(ctx, B, kit, rig) {
    const THREE = ctx.THREE, V = (x, y, z) => new THREE.Vector3(x, y, z), P = window.FigureKit.P;
    const f = B.make(kit, rig, {
      preset: 'woman', hair: 'none', mantle: false, beard: 'none', hat: 'none', hem: 1.62,
      col: { skin: C.skin, robe: C.gown, top: C.gown, sleeve: C.gown, mantle: C.veil, belt: C.gold, sandal: C.shoe, hair: C.hair },
    });
    // build the extras with every pivot at rest
    const REST = P({ hx: 0, af0: 0, af1: 0, ao0: 0, ao1: 0, e0: 0, e1: 0 });
    f.pose(REST);
    const S = f.spec, H = f.H, headH = H / S.heads, R = headH / 2, hipY = f.hipY, tl = f.chinY - hipY;
    const shHalf = S.shoulder * headH / 2, waistR = shHalf * S.waist, hemR = waistR * S.hem;
    const head = f.head, torso = f.torso, skirt = f.skirt;
    const robeProf = [[waistR * 0.98, 0.03], [waistR * 1.08, -0.06], [(waistR + hemR) * 0.55, -hipY * 0.5], [hemR, -hipY + 0.03]];
    const rAt = (y) => { for (let i = 0; i < robeProf.length - 1; i++) { const [r0, y0] = robeProf[i], [r1, y1] = robeProf[i + 1]; if (y <= y0 && y >= y1) return r0 + (r1 - r0) * (y0 - y) / (y0 - y1); } return hemR; };

    // the veil, made here rather than with the kit's (which falls to the elbows): a cap over the crown, then a drape
    // open at the face that falls behind to the shoulders
    rig.piece(head, new THREE.SphereGeometry(1, 6, 3, 0, TAU, 0, 1.2), C.veil, 0, R * 0.04, -R * 0.03, { s: [R * 1.13, R * 1.16, R * 1.13] });
    rig.lathe(head, [[R * 1.1, R * 0.5], [R * 1.13, -R * 0.35], [R * 1.2, -R * 0.95], [R * 1.27, -R * 1.25]], 8, C.veil,
      { phi0: Math.PI * 0.36, phiLen: Math.PI * 1.28, z: -R * 0.06 });
    // brown hair in front of the drape: a band at the brow and fuller bunches at the temples, as the ladies of about
    // 1400 wore it under the veil (so she isn't bald under it)
    rig.piece(head, new THREE.SphereGeometry(1, 6, 2, Math.PI * 0.15, Math.PI * 0.7, 1.0, 0.35), C.hair, 0, R * 0.02, 0, { s: [R * 1.06, R * 1.08, R * 1.05] });
    for (const s of [-1, 1]) rig.ball(head, rig.sphere(6, 4), C.hair, R * 0.3, s * R * 0.74, R * 0.1, R * 0.4, [0.75, 1.15, 0.9]);
    // a gold circlet over the veil, its corners on the veil's
    rig.lathe(head, [[R * 1.115, R * 0.62], [R * 1.125, R * 0.47]], 6, C.gold, { phi0: Math.PI / 6 });
    // the wimple: white linen wrapping the throat up to the jaw, under the veil
    rig.lathe(torso, [[R * 0.84, tl + 0.1], [shHalf * 0.8, tl * 0.965], [shHalf * 0.91, tl * 0.912]], 6, C.veil);

    // the girdle's end hanging down the front of the gown, swinging with it, with a gold tip
    const zA = rAt(-0.06) + 0.012, zB = rAt(-hipY * 0.58) + 0.014;
    rig.limb(skirt, V(0, -0.02, zA), V(0, -hipY * 0.58, zB), 0.017, 0.015, C.gold, 4, false, 0.5);
    rig.box(skirt, C.gold, 0.035, 0.05, 0.02, 0, -hipY * 0.6, zB + 0.002);

    // Back to rest for the bake: rig.bake binds every pivot where it is, and Blocky.make leaves its figure in the base
    // pose, which would put every later pose off by the base. The sheet and the scene pose it every frame.
    f.range[1] = rig.pieces.length;   // the shade bake covers the added pieces too
    f.pose(REST);
    f.base = POSES.stand;

    // the walk: the loose walk from a relaxed stance, the arm swing and head nod softened to a lady's pace
    const kitGait = f.gait;
    f.gait = (ph, amt, base) => {
      const b = Object.assign({}, WALK, base || {}), p = kitGait(ph, amt, b);
      for (const k of ['af0', 'af1', 'e0', 'e1']) p[k] = b[k] + 0.7 * (p[k] - b[k]);
      p.hx = b.hx + 0.7 * (p.hx - b.hx);
      return p;
    };
    return f;
  }

  // ---------- the moving versions ----------
  const P = (o) => window.FigureKit.P(o);
  const life = (t, seed, p) => window.Motion.life(t, seed, p, true);
  const anim = {
    stand(t, seed) { return life(t, seed || 1, P(POSES.stand)); },
    watch(t, seed) {
      const p = P(POSES.watch);
      p.hy += 0.35 * Math.sin(t * 0.21 + (seed || 0)) * Math.sin(t * 0.13 + 1.3 * (seed || 0));
      p.twist += 0.06 * Math.sin(t * 0.21 + (seed || 0));
      p.lean += 0.01 * Math.sin(t * 1.2);
      return p;
    },
    wave(u, seed, base) {
      const b = P(base || POSES.stand), w = POSES.wave, k = win(u, 0, 1, 0.22), p = P(b);
      for (const key in w) p[key] = b[key] + (w[key] - b[key]) * k;
      // four waves of the forearm, side to side
      const wv = Math.sin(u * TAU * 4) * win(u, 0.12, 0.88, 0.12);
      p.e1 += 0.35 * wv; p.ao1 += 0.12 * wv; p.hz += 0.04 * wv;
      return p;
    },
    triumph(t, seed) {
      const p = P(POSES.triumph), s = Math.sin(t * 2.4 + (seed || 0));
      p.af0 += 0.12 * s; p.af1 -= 0.12 * s; p.roll += 0.04 * s; p.hz -= 0.05 * s;
      p.y += 0.015 * Math.max(0, Math.sin(t * 4.8));
      return p;
    },
  };

  window.CHARACTERS.lady = {
    name: 'The Lady of the Bull',
    note: 'red kirtle, white veil and wimple, gold girdle and circlet; watches from the gatehouse tower',
    build, anim, poses: POSES,
  };
})();
