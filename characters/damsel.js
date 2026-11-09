// The damsel with the towel (DESIGN.md §5, §6; research.md §2, §8). At Dunbar in 1338, when the besiegers' stones
// struck the wall, "Wyth a towalle a damyselle / Arayid jolyly and welle / Wipyt the wall, that thai mycht se, / To gere
// thaim mare anoyid be" (Wyntoun VIII.xxxiii). At Hennebont the women carried paving stones up to the walls (Froissart,
// Johnes p. 106).
// "Arrayed jollily and well": a bright gown. Wyntoun says no more, so the dress is from the time (about 1400;
// DESIGN.md §12): a soft green kirtle with fitted sleeves, a white linen apron tied at the waist, a white kerchief over
// her auburn hair, knotted at the nape, with a plait down her back, and a white linen towel in her right hand.
// Distinctive colour: the spring green with white. Distinctive shape: the towel and the plait.
//
// Poses: stand, wipe (leaning over the parapet, wiping), carry (a paving stone held in both arms), flourish (the towel
// lifted at the end of the wipe), walk. The stone shows by itself whenever both forearms come up to hold it (so it
// works from a Script too), and the towel always hangs straight down from her hand.
// CHARACTERS.damsel.anim gives the moving versions for the choreographer:
//   anim.stand(t, seed)          standing, breathing, glancing about, the towel swinging a little
//   anim.wipe(u, seed, base)     u 0..1 over about 5 s: she leans out over the wall, wipes it in four big cheeky
//                                strokes, glances up at the Lions, straightens and flicks the towel (the scripted
//                                moment at 45 s and the tap moment). Place her with the parapet about 0.45 m in front.
//   walk: Script.walk with this figure; to walk carrying the stone, give the walk { base: () => poses.carry } and the
//   arms stay on the stone.
// The pivots are back at rest when build returns, so the bake binds at rest.
window.CHARACTERS = window.CHARACTERS || {};
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const C = { gown: 0x7fa65a, apron: 0xf1eadb, kerchief: 0xf5f0e4, towel: 0xfaf6ec, hair: 0xa8653a, shoe: 0x6e4a30,
    skin: 0xf2c9a8, stone: 0xa39d90 };
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const win = (s, a, b, e) => smooth((s - a) / e) * (1 - smooth((s - (b - e)) / e));

  const POSES = {
    stand: { af0: 0.08, ao0: 0.14, e0: 0.3, af1: 0.14, ao1: 0.12, e1: 0.4, hx: 0.04 },
    // leaning out over the parapet: the left hand on the wall top, the right reaching down the outside with the towel
    wipe: { lean: 0.8, hx: 0.35, af0: 0.16, e0: 1.98, ao0: -0.02, at0: 0, af1: 0.89, e1: 0.9, ao1: -0.33, at1: 0.08, lf0: 0.05, lf1: -0.05 },
    // a paving stone held in both arms in front
    carry: { af0: 0.11, af1: 0.11, e0: 1.91, e1: 1.91, ao0: 0.01, ao1: 0.01, at0: 0.3, at1: 0.3, lean: -0.06, hx: 0.12 },
    // the towel flicked up at the end, chin up
    flourish: { af1: 2.3, e1: 0.45, ao1: 0.75, af0: 0.1, e0: 0.5, ao0: 0.25, hx: -0.12, hz: -0.12, roll: 0.04 },
  };

  function build(ctx, B, kit, rig) {
    const THREE = ctx.THREE, V = (x, y, z) => new THREE.Vector3(x, y, z), P = window.FigureKit.P;
    const f = B.make(kit, rig, {
      preset: 'woman', height: 1.58, heads: 2.8, hair: 'none', mantle: false, beard: 'none', hat: 'none', hem: 1.5,
      col: { skin: C.skin, robe: C.gown, top: C.gown, sleeve: C.gown, belt: C.apron, sandal: C.shoe, hair: C.hair },
    });
    const REST = P({ hx: 0, af0: 0, af1: 0, ao0: 0, ao1: 0, e0: 0, e1: 0 });
    f.pose(REST);
    const S = f.spec, H = f.H, headH = H / S.heads, R = headH / 2, hipY = f.hipY, tl = f.chinY - hipY;
    const shHalf = S.shoulder * headH / 2, waistR = shHalf * S.waist, hemR = waistR * S.hem, chestR = shHalf * 0.92;
    const head = f.head, torso = f.torso, skirt = f.skirt;

    // her hair, made here so it sits right under the kerchief: a hood of hair open at the face, falling to the nape,
    // and a fringe at the brow
    const hc = [0, R * 0.06, -R * 0.08];
    rig.piece(head, new THREE.SphereGeometry(1, 6, 3, Math.PI * 0.78, Math.PI * 1.44, 0.85, 1.6), C.hair, hc[0], hc[1], hc[2], { s: [R * 1.1, R * 1.1, R * 1.08] });
    for (const sx of [-1, 1]) rig.ball(head, rig.sphere(4, 3), C.hair, R * 0.45, sx * R * 0.78, -R * 0.28, -R * 0.16, [0.82, 1.5, 1.12]);
    rig.piece(head, new THREE.SphereGeometry(1, 4, 2, Math.PI * 0.17, Math.PI * 0.66, 0.75, 0.6), C.hair, 0, R * 0.04, 0, { s: [R * 1.07, R * 1.08, R * 1.04] });
    // the kerchief over the crown (eight facets round, so its faces stay outside the hair's), knotted at the nape with
    // two short ends
    rig.piece(head, new THREE.SphereGeometry(1, 8, 3, Math.PI / 8, TAU, 0, 1.22), C.kerchief, hc[0], hc[1], hc[2], { s: [R * 1.21, R * 1.2, R * 1.2] });
    rig.ball(head, rig.sphere(5, 3), C.kerchief, R * 0.22, 0, R * 0.42, -R * 1.2, [1.1, 0.8, 0.7]);
    for (const s of [-1, 1]) rig.box(head, C.kerchief, R * 0.2, R * 0.5, R * 0.06, s * R * 0.12, R * 0.2, -R * 1.2, [0.25, 0, s * 0.3]);
    // her plait down the back, on the body so it stays on her back when she turns her head
    const rT = (y) => waistR + (chestR - waistR) * Math.min(1, y / (tl * 0.55));
    const nape = V(0, tl + R * 0.08, -R * 0.8), mid = V(0, tl * 0.55, -rT(tl * 0.55) - 0.016), end = V(0, tl * 0.16, -rT(tl * 0.16) - 0.014);
    rig.limb(torso, nape, mid, R * 0.14, R * 0.13, C.hair, 4, false, 0.6);
    rig.limb(torso, mid, end, R * 0.13, R * 0.1, C.hair, 4, false, 0.6);
    rig.ball(torso, rig.sphere(4, 3), C.apron, R * 0.09, end.x, end.y, end.z, [1.2, 0.8, 0.8]);
    rig.limb(torso, end, V(0, tl * 0.16 - R * 0.3, -rT(0) - 0.012), R * 0.1, R * 0.03, C.hair, 4, false, 0.6);

    // the apron: a front panel of the gown's own facets, standing just outside it, swinging with it
    const robeProf = [[waistR * 0.98, 0.03], [waistR * 1.08, -0.06], [(waistR + hemR) * 0.55, -hipY * 0.5], [hemR, -hipY + 0.03]];
    const k = 1.04, d = 0.006;
    rig.lathe(skirt, [[robeProf[0][0] * k + d, 0.0], [robeProf[1][0] * k + d, -0.06], [robeProf[2][0] * k + d, -hipY * 0.5],
      [(robeProf[2][0] + (hemR - robeProf[2][0]) * 0.6) * k + d, -hipY * 0.8]], 2, C.apron, { phi0: -Math.PI / 3, phiLen: Math.PI * 2 / 3 });

    // the towel: it hangs from her right hand on a pivot that cancels the arm's swing, so it always falls straight down
    const towel = rig.node(f.hands[1], 0, -R * 0.08, R * 0.04);
    rig.box(towel, C.towel, R * 0.42, R * 1.35, R * 0.07, 0, -R * 0.62, 0);

    // the paving stone, where her hands are in the carry pose (worked out from the pose itself)
    f.pose(P(Object.assign({}, POSES.stand, POSES.carry)));
    f.root.updateMatrixWorld(true);
    const hL = torso.worldToLocal(f.hands[0].localToWorld(V(0, -R * 0.1, 0))), hR = torso.worldToLocal(f.hands[1].localToWorld(V(0, -R * 0.1, 0)));
    f.pose(REST);
    f.root.updateMatrixWorld(true);
    const stone = rig.node(torso, (hL.x + hR.x) / 2, (hL.y + hR.y) / 2, (hL.z + hR.z) / 2);
    const sw = Math.max(0.12, Math.abs(hL.x - hR.x) - 0.09);
    rig.box(stone, C.stone, sw, 0.12, 0.17, 0, 0.02, 0, [0.06, 0.1, 0]);

    f.range[1] = rig.pieces.length;   // the shade bake covers the added pieces too
    f.pose(REST);
    const basePose = f.pose, sm = smooth, hq = new THREE.Quaternion();
    const show = (nd, v) => nd.scale.setScalar(Math.max(1e-3, v));
    f.pose = (p) => {
      basePose(p);
      // the towel hangs straight down: undo the turn of the torso, arm and forearm above it
      hq.copy(torso.quaternion).multiply(f.arms[1].quaternion).multiply(f.elbows[1].quaternion).invert();
      towel.quaternion.copy(hq);
      // both forearms up and forward: she has the stone
      const hold = sm((Math.min(p.e0, p.e1) - 1.45) / 0.25) * (1 - sm((Math.max(p.af0, p.af1) - 0.9) / 0.2));
      show(stone, hold);
      // the towel tucks away while she carries
      show(towel, 1 - hold);
    };
    // (both props stay at full size until the bake; a prop scaled before it would bake in hidden)
    f.base = POSES.stand;

    // the walk: the loose walk; carrying the stone the arms stay on it and only bob with the steps
    const kitGait = f.gait;
    f.gait = (ph, amt, base) => {
      const b = Object.assign({}, f.base, base || {}), p = kitGait(ph, amt, b);
      if (b.e0 > 1.45 && b.e1 > 1.45) {
        for (const kk of ['af0', 'af1', 'e0', 'e1', 'ao0', 'ao1', 'at0', 'at1']) p[kk] = b[kk];
        p.af0 += 0.03 * amt * Math.sin(ph * 2); p.af1 += 0.03 * amt * Math.sin(ph * 2);
      }
      return p;
    };
    return f;
  }

  // ---------- the moving versions ----------
  const P = (o) => window.FigureKit.P(o);
  const lerpPose = (a, b, w) => { const o = P(a); for (const k in b) o[k] = (a[k] !== undefined ? a[k] : P()[k]) + (b[k] - (a[k] !== undefined ? a[k] : P()[k])) * w; return o; };
  const anim = {
    stand(t, seed) {
      const p = window.Motion.life(t, seed || 2, P(POSES.stand), true);
      p.af1 += 0.04 * Math.sin(t * 0.9 + (seed || 0));
      return p;
    },
    wipe(u, seed, base) {
      const b = Object.assign({}, POSES.stand, base || {});
      // lean in (0 to 0.12), four strokes (0.12 to 0.62), a look up at the Lions still leaning (0.62 to 0.76),
      // straighten (0.76 to 0.86) and flick the towel (0.84 to 1), back to where she was by the end
      const inW = win(u, 0, 0.86, 0.12), fl = win(u, 0.82, 1, 0.08);
      const p = lerpPose(b, POSES.wipe, inW);
      const s = win(u, 0.12, 0.62, 0.05), ph = (u - 0.12) / 0.5 * TAU * 4;
      // big side-to-side strokes: the arm sweeps, the shoulders and hips go with it, the head follows the towel
      p.ao1 += 0.42 * s * Math.sin(ph);
      p.at1 += 0.25 * s * Math.sin(ph);
      p.e1 += 0.25 * s * (0.5 + 0.5 * Math.cos(ph));
      p.twist += 0.14 * s * Math.sin(ph);
      p.roll += 0.06 * s * Math.sin(ph + 0.6);
      p.hy -= 0.22 * s * Math.sin(ph - 0.4);
      p.hz += 0.06 * s * Math.sin(ph);
      // the cheeky look: still bent over the wall, her head comes up and tips to see the Lions see it
      const look = win(u, 0.6, 0.8, 0.05);
      p.hx -= 0.75 * look; p.hz += 0.18 * look; p.lean -= 0.1 * look;
      // the flick of the towel, held out to the side
      const q = lerpPose(p, POSES.flourish, fl);
      q.e1 += 0.3 * fl * Math.sin((u - 0.82) / 0.18 * TAU * 1.5);
      return q;
    },
  };

  window.CHARACTERS.damsel = {
    name: 'The damsel with the towel',
    note: 'green kirtle, white apron and kerchief, a plait, a linen towel; wipes the wall after a stone strikes',
    build, anim, poses: POSES,
  };
})();
