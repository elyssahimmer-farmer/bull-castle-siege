// crow.js: a small black crow for the castle siege (DESIGN.md §6: "Black, blocky; flap over the woods, burst up on tap";
// Froissart before Crécy: "a great number of crows"). Built from the rig primitives in the same language as the figures.
// Slate-black rather than pure black (STYLE: the eyes are the darkest thing), about 0.45 m long with a 0.82 m span.
//
//   const c = CHARACTERS.crow.make(kit, rig, { col: { body, beak } });   build several on one rig, then one bake
//   c.pose(p), c.set(state) (x y z yaw pitch lift hide, pose; y is where its feet are), c.eyes (scale.y to blink),
//   c.gait / c.stride (a hop along the ground, for FigureKit.Script.walk at about 0.8 m/s), c.base (perched),
//   c.scale (the size set() keeps; 1 is life size), c.shadowR, c.headTop().
//   CHARACTERS.crow.anim (each returns a pose; pure functions of time):
//     perch(t, seed)   standing with its wings folded, looking about, now and then a shuffle of the wings
//     flap(t, seed)    flying, flapping about three times a second, the body rising a little on each downstroke
//     glide(t, seed)   wings held out and a little raised, tilting gently
//     liftoff(u, seed) u 0..1 over about 1.4 s: crouch, spring, wings open, hard flaps; the pose itself rises
//                      CHARACTERS.crow.liftY(u) metres (to 1.1 m) and leans back, then hand over to flap() with
//                      the root at that height (the tap moment: crows bursting up out of the woods, staggered by seed)
//     mix(a, b, w)     FigureKit.mix, for blending flap into glide.
// Pose keys (deltas from FigureKit.P()'s defaults, so P() is the bind pose: wings spread flat, legs down):
//   af0 wings raised (+ up)  af1 wings folded (0 open .. 1 folded)  e0 wrists bent down (+)  hx head nose down
//   hy head turn  at1 tail down (+)  k0 legs tucked (0 down .. 1 tucked)  y body lifted  lean body nose down  roll bank
// The sheet: &anim=flap|glide|liftoff|perch (in place, &ph=0..1 freezes it), shown 2.5 times life size (&zoom=1 for real).
window.CHARACTERS = window.CHARACTERS || {};
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const COL = { body: 0x33343d, wing: 0x2b2c35, beak: 0x4a4a52, leg: 0x3c3a3e, eye: 0x0e0c10 };
  const BY = 0.12;   // the body's centre above the feet

  // a flat panel seen from both sides: a fan of triangles from pts[0], facing up and down
  function panel(pts) {
    const pos = [];
    for (let k = 1; k < pts.length - 1; k++) {
      let a = pts[0], b = pts[k], c = pts[k + 1];
      // (b - a) x (c - a) has y = dz_b * dx_c - dx_b * dz_c; make the first triangle face up
      if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) { const t = b; b = c; c = t; }
      pos.push(a[0], 0, a[1], b[0], 0, b[1], c[0], 0, c[1]);                              // facing up (+y)
      pos.push(a[0], -0.004, a[1], c[0], -0.004, c[1], b[0], -0.004, b[1]);               // facing down
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  function make(kit, rig, spec) {
    spec = spec || {};
    const P = window.FigureKit.P, D = P();
    const C = Object.assign({}, COL, spec.col || {});
    const root = rig.node(null, 0, 0, 0);
    root.rotation.order = 'YXZ';
    const body = rig.node(root, 0, BY, 0);
    const f = { wings: [], wrists: [], legs: [], spec, rig };

    // the body: a faceted egg, the chest forward; the head on a pivot; a stout beak
    rig.ball(body, kit.ball(5, 3), C.body, 1, 0, 0, 0, [0.075, 0.068, 0.15]);
    const head = rig.node(body, 0, 0.055, 0.12);
    rig.ball(head, kit.ball(4, 3), C.body, 0.056, 0, 0, 0, [0.95, 0.92, 1.08], [0, Math.PI / 4, 0]);
    const beak = new THREE.ConeGeometry(0.022, 0.075, 3, 1);
    beak.rotateX(Math.PI / 2);
    rig.piece(head, beak, C.beak, 0, -0.008, 0.085, { r: [0.12, 0, 0], s: [1, 0.85, 1] });
    const eyes = rig.node(head, 0, 0.016, 0.03);
    for (const s of [-1, 1]) rig.ball(eyes, kit.ball(3, 2), C.eye, 0.012, s * 0.041, 0, 0, null, [0, 0.6155, -Math.PI / 4]);

    // the wings: an inner panel to the wrist, an outer one with fingered primaries
    for (const sx of [1, -1]) {
      const sh = rig.node(body, sx * 0.065, 0.035, 0.05);
      sh.rotation.order = 'ZYX';
      const m = (pts) => pts.map(([x, z]) => [sx * x, z]);
      rig.piece(sh, panel(m([[0, 0.03], [0.14, 0.02], [0.14, -0.11], [0, -0.14]])), C.wing, 0, 0, 0);
      const wr = rig.node(sh, sx * 0.14, 0, 0);
      rig.piece(wr, panel(m([[0, 0.02], [0.12, -0.005], [0.2, -0.05], [0.17, -0.085], [0.1, -0.1], [0, -0.11]])), C.wing, 0, 0, 0);
      f.wings.push(sh); f.wrists.push(wr);
    }
    // a square-ended tail
    const tail = rig.node(body, 0, 0.012, -0.12);
    rig.piece(tail, panel([[-0.025, 0.02], [0.025, 0.02], [0.05, -0.15], [-0.05, -0.15]]), C.wing, 0, 0, 0);
    // two short legs
    for (const sx of [1, -1]) {
      const leg = rig.node(body, sx * 0.025, -0.04, 0.0);
      rig.limb(leg, V(0, 0, 0), V(0, -(BY - 0.04), 0.01), 0.008, 0.007, C.leg, 3, true);
      f.legs.push(leg);
    }

    f.eyes = eyes;
    f.H = 0.35; f.height = 0.25; f.shadowR = 0.16; f.scale = 1;
    f.root = root; f.body = body; f.head = head; f.tail = tail;
    f.headTop = () => head.localToWorld(V(0, 0.07, 0));
    const dl = (p, k) => p[k] - D[k];
    f.pose = (p) => {
      body.position.y = BY + dl(p, 'y');
      body.rotation.set(dl(p, 'lean'), 0, dl(p, 'roll'));
      head.rotation.set(dl(p, 'hx'), dl(p, 'hy'), 0);
      const fold = clamp(dl(p, 'af1'), 0, 1), flap = dl(p, 'af0'), bend = dl(p, 'e0');
      for (let i = 0; i < 2; i++) {
        const sx = i === 0 ? 1 : -1;
        // folding sweeps the wing back along the body and rolls it down the flank
        f.wings[i].rotation.set(0, sx * 1.5 * fold, sx * (flap * (1 - fold) + 1.66 * fold));
        f.wings[i].scale.set(1 - 0.2 * fold, 1, 1 - 0.45 * fold);   // folded, the feathers lie close
        f.wrists[i].rotation.set(0, sx * 0.06 * fold, -sx * bend * (1 - fold));
        f.legs[i].rotation.x = 1.35 * clamp(dl(p, 'k0'), 0, 1);
      }
      tail.rotation.x = dl(p, 'at1');
    };
    f.base = PERCH;

    // the hop along the ground: in the air most of the cycle, the feet down briefly and swept back under it
    f.stride = 0.3;
    f.gait = (ph, amt, base) => {
      const p = P(Object.assign({}, PERCH, base || {}));
      const u = ((ph / TAU) % 1 + 1) % 1, GND = 0.22;
      if (u < GND) { const k = u / GND, a = 0.38 * amt * (1 - 2 * k); p.y += -0.01 * amt * Math.sin(Math.PI * k); p.lean += 0.1 * amt * Math.sin(Math.PI * k); legAngle(p, a); }
      else { const k = (u - GND) / (1 - GND); p.y += 0.055 * amt * Math.sin(Math.PI * k); legAngle(p, 0.38 * amt * (-1 + 2 * smooth(k))); p.at1 -= 0.2 * amt * Math.sin(Math.PI * k); }
      p.hx += 0.12 * amt * Math.sin(u * TAU + 0.5);
      p.at1 -= 0.15 * amt * Math.sin(u * TAU);
      p.wk = amt;
      return p;
    };
    // the hop's legs swing on the k0 key's spare range: store the angle on lo0 (unused by the crow otherwise)
    const legAngle = (p, a) => { p.lo0 = D.lo0 + a; };
    const basePose = f.pose;
    f.pose = (p) => {
      basePose(p);
      const a = dl(p, 'lo0');
      if (a) for (const leg of f.legs) leg.rotation.x -= a;
    };

    f.follow = window.Motion.lag({ hx: 0.1, hy: 0.15, af0: 1e-4, e0: 1e-4, af1: 0.08, lean: 0.06, roll: 0.1 });
    f.seed = rig.figures.length * 1.7 + 0.3;
    f.floor = null;
    f.set = (s) => {
      if (s.hide) { root.scale.setScalar(1e-4); return; }
      root.scale.setScalar(f.scale);
      const y = s.y !== undefined && s.y !== null ? s.y : f.floor ? f.floor(s.x, s.z) : 0;
      root.position.set(s.x, y + (s.lift || 0), s.z);
      root.rotation.set(s.pitch || 0, s.yaw, 0);
      f.pose(f.follow(s.pose || P(f.base)));
    };
    f.pose(P());
    rig.figures.push(f);
    return f;
  }

  const rel = (o) => { const p = window.FigureKit.P(), r = {}; for (const k in o) r[k] = p[k] + o[k]; return r; };
  const PERCH = rel({ af1: 1, lean: -0.12, at1: 0.12, hx: 0.05 });
  const FLY = rel({ k0: 1, at1: -0.05 });
  const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
  const win = (s, a, b, e) => window.Motion.win(s, a, b, e);
  const RATE = 3.1;
  const anim = {
    perch(t, seed) {
      seed = seed || 0;
      const p = window.FigureKit.P(PERCH);
      // a look this way, then that, every couple of seconds; a little bob; now and then a shuffle of the wings
      const T = 1.7, n = Math.floor((t + seed) / T), r = hash(n, seed), k = smooth(((t + seed) % T) / 0.25);
      const prev = (hash(n - 1, seed) - 0.5) * 1.6, cur = (r - 0.5) * 1.6;
      p.hy += prev + (cur - prev) * k;
      p.hx += 0.08 * Math.sin(t * 2.3 + seed);
      p.y += 0.003 * Math.sin(t * 2 + seed);
      const T2 = 5.3, n2 = Math.floor((t + seed * 3) / T2), w = win((t + seed * 3) % T2 - hash(n2, seed) * 3, 0, 0.6, 0.2);
      p.af1 -= 0.12 * w; p.at1 -= 0.25 * w; p.lean -= 0.05 * w;
      return p;
    },
    flap(t, seed) {
      const p = window.FigureKit.P(FLY), w = (t * RATE + (seed || 0) * 0.37) * TAU;
      p.af0 += 0.15 + 0.78 * Math.sin(w);
      p.e0 += 0.32 * Math.sin(w - 1.0);
      p.y += -0.025 * Math.sin(w);
      p.lean += 0.04 * Math.sin(w + 1);
      p.hx -= 0.05 * Math.sin(w + 0.6);
      p.at1 += 0.05 * Math.sin(w - 0.8);
      return p;
    },
    glide(t, seed) {
      seed = seed || 0;
      const p = window.FigureKit.P(FLY);
      p.af0 += 0.16 + 0.03 * Math.sin(t * 1.3 + seed);
      p.e0 -= 0.06;
      p.roll += 0.12 * Math.sin(t * 0.6 + seed) ;
      p.hy += 0.15 * Math.sin(t * 0.5 + seed * 2);
      p.at1 -= 0.06;
      return p;
    },
    liftoff(u, seed) {
      u = clamp(u, 0, 1);
      const p = window.FigureKit.P(PERCH), F = anim.flap(u * 1.4 * 1.15, seed);
      const crouch = win(u, 0.0, 0.3, 0.14), open = smooth((u - 0.16) / 0.18), fly = smooth((u - 0.2) / 0.2);
      for (const k in F) p[k] += (F[k] - p[k]) * fly;
      p.af1 = window.FigureKit.P().af1 + (1 - open);
      p.af0 += 0.5 * open * (1 - fly);
      p.y += -0.03 * crouch + liftY(u);
      p.lean += 0.25 * crouch - 0.35 * fly * (1 - smooth((u - 0.7) / 0.3));
      p.k0 = window.FigureKit.P().k0 + smooth((u - 0.3) / 0.3);
      return p;
    },
    mix: (a, b, w) => window.FigureKit.mix(a, b, w),
  };
  // how far the lift-off has carried it up, metres (a spring, then a steep climb easing off)
  function liftY(u) { u = clamp(u, 0, 1); return 0.12 * smooth((u - 0.2) / 0.12) + 0.98 * Math.pow(smooth((u - 0.28) / 0.72), 1.3); }

  window.CHARACTERS.crow = {
    name: 'A crow',
    note: 'flaps, glides, lifts off (&anim=flap|glide|liftoff|perch); shown 2.5× life size',
    make, anim, liftY,
    build(ctx, B, kit, rig) {
      const q = new URLSearchParams(location.search), view = q.get('view');
      const c = make(kit, rig, {});
      const zoom = q.get('zoom') !== null ? parseFloat(q.get('zoom')) : 2.5;
      c.scale = zoom;
      c.afterBake = () => c.root.scale.setScalar(zoom);
      c.H = view === 'face' ? 0.24 * zoom : 0.8 * zoom;   // the sheet's framing only
      c.shadowR = 0.16 * zoom;
      (window.__crows = window.__crows || []).push(c);
      const an = q.get('anim'), ph0 = parseFloat(q.get('ph'));
      if (an && view !== 'walk') {
        c.follow = () => {
          const t = isNaN(ph0) ? performance.now() / 1000 : ph0 * 1.4;
          if (an === 'liftoff') return anim.liftoff(isNaN(ph0) ? (t % 2.2) / 1.4 : ph0, 0);
          const p = (anim[an] || anim.perch)(t, 0);
          if (an === 'flap' || an === 'glide') p.y += 0.25;   // held up off the sheet's floor
          return p;
        };
      }
      return c;
    },
    poses: { perch: PERCH, fly: FLY },
  };
})();
