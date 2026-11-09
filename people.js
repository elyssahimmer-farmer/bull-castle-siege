// people.js: the full figures of the Siege of the Bull Castle (DESIGN.md §5, §6, §9; decisions 5, 8, 11-15). Every one
// is an approved character (characters/*.js) built on one of four rigs, each baked once with Blocky.finish (one draw
// each), and driven by its own FigureKit.Script that fills the 180 s cycle exactly and matches at the seam.
//
//   the Bull knights: eight on eight horses, waiting in the courtyard; out of the postern at 100 in a column round the
//     north and east of the moat (SIEGE.sally); the two leaders cut T2's ropes at 110-113 and dismount to fight on foot
//     (decision 14: six riders and two on foot); the six riders wheel into lanes and charge the Lions at 116-117
//     (lances couched, broken on the pass), then fight with swords in pairs, circling; home through the postern
//     150-155 (the two southern riders first chase the Lions to the camp's edge and loop back).
//   the Lion knights: six standing by their horses on the camp's east side, mounting at 108, riding in an echelon up the
//     meadow's east edge and wheeling west into the lanes; two more on foot walk from the camp to defend T2. Falls (toy
//     soldiers, on their backs, eyes closed, nobody touched once down): a Lion rider at the joust (116.5), a Lion rider
//     in the melee (125.5), a Bull knight on foot (127.5), a Lion knight on foot (132.5). The riderless horses trot to
//     the meadow's edge and stand. The surviving Lion riders flee up the road over the hill (138-150) and are hidden far
//     off; under the full mist (164-174) the fallen go and everyone comes back to the morning places.
//   T1's crew of five: two walk the treadwheels while the arm comes down (12.5-23.5, 43-52.5), one hauls the arm down,
//     one carries a stone from the pile and lays it in the sling, one pulls the trigger rope at each release (26.5, 56).
//     T2's crew of three walk the capstan (27-35), load, trigger at 40.5, and run to the camp at 107.8.
//   two Lion gunners at the nearest guns (LION_GUNS 3 and 4): load (ball, ram), touch off with the hot iron at their
//     SIEGE.times.gunShots times, sponge.
//   the Lady of the Bull over the gate (ctx.castle.lady): watches, looks at each blow, arms raised in triumph 142-158.
//   the damsel at her crenel (ctx.castle.damsel) on a little step so the sill is at her hip: carries paving stones
//     along the wall-walk in the morning, wipes the wall at 45 (Wyntoun), waves her towel at the triumph.
//   the Bull trumpeter on the gatehouse: walks to the north parapet and sounds the sally call at 96.3, the triumph at
//     143, 148.5 and 154 (the sounds are the base's).
// Tap moments (gestures only, a few seconds, blended over the timeline): a knight raises his visor and salutes, a horse
// tosses its head and stamps, the lady waves, the damsel wipes the wall, the trumpeter sounds a call, a crewman wipes
// his brow and waves, a gunner waves.
// Positions come from ctx.SIEGE, ctx.spots and ctx.castle; the engines' working spots from ctx.siege if siegeworks.js
// publishes them (see ENGINE below), else from the guesses in ENGINE_DEFAULTS.
// Checks: window.__people.check() lists any two figures closer than they should be over the whole cycle.
(function () {
  'use strict';
  const TAU = Math.PI * 2, PI = Math.PI;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const wrapA = (a) => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
  const lerpA = (a, b, k) => a + wrapA(b - a) * k;
  const win = (s, a, b, e) => smooth((s - a) / e) * (1 - smooth((s - (b - e)) / e));
  const yawTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const hyp = Math.hypot;

  // ---------- moving steps on a FigureKit.Script ----------
  // A walk that eases up to speed over ra seconds and down over rb, with smooth (jerk-free) ramps.
  function easeAB(L, dur, ra, rb) {
    ra = Math.min(ra, dur * 0.5); rb = Math.min(rb, dur - ra);
    const v = L / Math.max(1e-6, dur - 0.5 * ra - 0.5 * rb);
    const f = (s) => {
      if (s <= 0) return 0;
      if (s >= dur) return L;
      if (s > dur - rb && rb > 0) { const u = (dur - s) / rb; return L - v * rb * (u * u * u - 0.5 * u * u * u * u); }
      if (s < ra) { const u = s / ra; return v * ra * (u * u * u - 0.5 * u * u * u * u); }
      return v * (0.5 * ra + (s - ra));
    };
    f.v = v;
    return f;
  }
  const invEase = (ez, dur, d) => { let a = 0, b = dur; for (let i = 0; i < 40; i++) { const m = 0.5 * (a + b); if (ez(m) < d) a = m; else b = m; } return 0.5 * (a + b); };
  // round a polyline's corners (radius r, never more than 45% of a side), so a fast rider turns instead of snapping
  function roundPts(pts, r) {
    if (pts.length < 3 || !r) return pts.map((p) => [p[0], p[1]]);
    const out = [[pts[0][0], pts[0][1]]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const l1 = hyp(b[0] - a[0], b[1] - a[1]), l2 = hyp(c[0] - b[0], c[1] - b[1]);
      if (l1 < 1e-3 || l2 < 1e-3) continue;
      const rr = Math.min(r, l1 * 0.45, l2 * 0.45);
      const p = [b[0] - (b[0] - a[0]) / l1 * rr, b[1] - (b[1] - a[1]) / l1 * rr], q = [b[0] + (c[0] - b[0]) / l2 * rr, b[1] + (c[1] - b[1]) / l2 * rr];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
        out.push([w0 * p[0] + w1 * b[0] + w2 * q[0], w0 * p[1] + w1 * b[1] + w2 * q[1]]);
      }
    }
    out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    return out;
  }
  // a polyline sampler: at(d, out) → x, z and the heading there
  function Path(pts) {
    this.p = pts; this.c = [0];
    for (let i = 1; i < pts.length; i++) this.c.push(this.c[i - 1] + hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.L = this.c[this.c.length - 1];
  }
  Path.prototype.xz = function (d, out) {
    const p = this.p, c = this.c;
    d = clamp(d, 0, this.L);
    let i = 1;
    while (i < p.length - 1 && c[i] < d) i++;
    const k = (d - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]);
    out[0] = lerp(p[i - 1][0], p[i][0], k); out[1] = lerp(p[i - 1][1], p[i][1], k);
    return out;
  };
  const _pa = [0, 0], _pb = [0, 0];
  Path.prototype.yaw = function (d) {
    const a = this.xz(Math.max(0, Math.min(d, this.L - 0.5) - 0.3), _pa), b = this.xz(Math.min(this.L, Math.max(d, 0.5) + 0.3), _pb);
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  };
  // distance along the path of the point nearest (x, z)
  Path.prototype.near = function (x, z) {
    let best = 1e9, bd = 0;
    for (let i = 1; i < this.p.length; i++) {
      const ax = this.p[i - 1][0], az = this.p[i - 1][1], ex = this.p[i][0] - ax, ez = this.p[i][1] - az, L2 = ex * ex + ez * ez;
      const u = clamp(((x - ax) * ex + (z - az) * ez) / Math.max(1e-9, L2), 0, 1), dd = hyp(x - ax - ex * u, z - az - ez * u);
      if (dd < best) { best = dd; bd = this.c[i - 1] + u * Math.sqrt(L2); }
    }
    return bd;
  };

  // The general moving step: pos(s, out) gives x, z, yaw for s in 0..dur. The step is sampled at 60 Hz once; the speed
  // (with turning on the spot counted as stepping, o.turnR metres per radian) drives the stride phase of every gait in
  // the set, so the feet (or hooves) stay planted whatever the speed does.
  function pushMove(S, dur, pos, set, o) {
    o = o || {};
    const n = Math.max(2, Math.ceil(dur * 60)), dt = dur / n;
    const X = new Float32Array(n + 1), Z = new Float32Array(n + 1), Y = new Float64Array(n + 1), V = new Float32Array(n + 1);
    const tmp = [0, 0, 0];
    for (let i = 0; i <= n; i++) {
      pos(i * dt, tmp);
      X[i] = tmp[0]; Z[i] = tmp[1]; Y[i] = i ? Y[i - 1] + wrapA(tmp[2] - Y[i - 1]) : tmp[2];
    }
    const tr = o.turnR || 0;
    for (let i = 0; i <= n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n, i + 1), h = (b - a) * dt;
      V[i] = hyp(X[b] - X[a], Z[b] - Z[a]) / h + tr * Math.abs(Y[b] - Y[a]) / h;
    }
    V[0] = 0.5 * V[1]; V[n] = 0.5 * V[n - 1];
    const G = set.gaits, PH = G.map(() => new Float64Array(n + 1));
    for (let g = 0; g < G.length; g++) {
      PH[g][0] = o.phase0 || 0;
      for (let i = 1; i <= n; i++) {
        const v = 0.5 * (V[i] + V[i - 1]), a = Math.sqrt(clamp(v / G[g].vmax, 0, 1));
        PH[g][i] = PH[g][i - 1] + v * dt / (G[g].stride * Math.max(0.35, a)) * TAU;
      }
    }
    const ph = new Float64Array(G.length), yf = o.y;
    return S._push(dur, (s, I) => {
      const u = clamp(s / dt, 0, n), i = Math.min(n - 1, Math.floor(u)), k = u - i;
      for (let g = 0; g < G.length; g++) ph[g] = PH[g][i] + (PH[g][i + 1] - PH[g][i]) * k;
      const v = V[i] + (V[i + 1] - V[i]) * k, x = X[i] + (X[i + 1] - X[i]) * k, z = Z[i] + (Z[i + 1] - Z[i]) * k;
      return { x, z, y: typeof yf === 'function' ? yf(x, z, s) : yf, yaw: Y[i] + (Y[i + 1] - Y[i]) * k, pose: set.pose(v, ph, s, I, x, z),
        lift: 0, pitch: 0, hide: false, tag: o.tag, v };
    });
  }
  // along a polyline (from where the figure stands), rounded, eased in over ra and out over rb; o.endYaw turns to a
  // facing over the last 0.6 m
  function pushPath(S, pts, dur, set, o) {
    o = o || {};
    const R = new Path(roundPts([[S.x, S.z]].concat(pts), o.round === undefined ? 1.2 : o.round));
    const ez = easeAB(R.L, dur, o.ra === undefined ? 0.7 : o.ra, o.rb === undefined ? 0.7 : o.rb), ey = o.endYaw;
    const st = pushMove(S, dur, (s, out) => {
      const d = ez(s);
      R.xz(d, out);
      let y = R.yaw(d);
      if (ey !== undefined) y = lerpA(y, ey, smooth(1 - (R.L - d) / 0.6));
      out[2] = y;
    }, set, Object.assign({ turnR: ey !== undefined ? 0.5 : 0 }, o));
    st.path = R; st.ez = ez;
    return st;
  }
  // the duration of a path at a cruising speed v, and the time its walker passes the point nearest (px, pz)
  function pathPlan(S, pts, v, o) {
    o = o || {};
    const R = new Path(roundPts([[S.x, S.z]].concat(pts), o.round === undefined ? 1.2 : o.round));
    const ra = o.ra === undefined ? 0.7 : o.ra, rb = o.rb === undefined ? 0.7 : o.rb;
    const dur = R.L / v + 0.5 * (ra + rb), ez = easeAB(R.L, dur, ra, rb);
    return { R, dur, ez, at: (px, pz) => invEase(ez, dur, R.near(px, pz)) };
  }
  // a turn on the spot
  function pushTurn(S, yaw1, dur, set, o) {
    const x = S.x, z = S.z, y0 = S.yaw;
    return pushMove(S, dur, (s, out) => { out[0] = x; out[1] = z; out[2] = lerpA(y0, yaw1, smooth(s / dur)); }, set, Object.assign({ turnR: 0.7 }, o || {}));
  }
  // round a centre (cx, cz) at radius r from angle th0 to th1 (the position is c + r (sin th, cos th)), facing the way
  // it goes
  function pushArc(S, cx, cz, r, th0, th1, dur, set, o) {
    o = o || {};
    const ez = easeAB(Math.abs(th1 - th0), dur, o.ra === undefined ? 0.8 : o.ra, o.rb === undefined ? 0.8 : o.rb), sg = Math.sign(th1 - th0) || 1;
    return pushMove(S, dur, (s, out) => {
      const th = th0 + sg * ez(s);
      out[0] = cx + r * Math.sin(th); out[1] = cz + r * Math.cos(th);
      out[2] = sg > 0 ? Math.atan2(Math.cos(th), -Math.sin(th)) : Math.atan2(-Math.cos(th), Math.sin(th));
    }, set, o);
  }

  window.Scene.register({
    name: 'people',
    init(ctx) {
      const THREE = ctx.THREE, K = ctx.figureKit, M = window.Motion, B = ctx.Blocky, P = K.P, CH = window.CHARACTERS || {};
      const SG = ctx.SIEGE, T = SG.times, spots = ctx.spots, CA = ctx.castle || window.CASTLE || null;
      const need = ['lionKnight', 'bullKnight', 'horse', 'engineer', 'gunner', 'lady', 'damsel', 'trumpeter'];
      for (const k of need) if (!CH[k]) { console.warn('people: missing character ' + k); return; }
      const KA = CH.bullKnight.anim, KP = CH.bullKnight.poses, RIDE = CH.bullKnight.ride, HA = CH.horse.anim, HG = CH.horse.gaits;
      const EN = CH.engineer, GU = CH.gunner, LA = CH.lady, DA = CH.damsel, TR = CH.trumpeter;
      const ground = (x, z) => ctx.surfaceY(x, z);
      const all = [];          // every actor: { f, S, kind, ... }
      this.all = all;
      const I0 = { t: 0, ct: 0, n: 0 };

      // ================= the rigs: four batches, four draws =================
      const kit = ctx.kit;
      const rigB = kit.makeRig(), rigL = kit.makeRig(), rigC = kit.makeRig(), rigW = kit.makeRig();

      // ---------- the horse's charge: the approved gallop with a longer, flatter stride, so it can keep up with the
      // timeline's sally (about 18 m/s round the moat) with its hooves still planted ----------
      const CHARGE = { duty: 0.16, stride: 5.0, speed: 18 };
      function chargeGait(h, ph, amt) {
        const G = HG.gallop, d = G.duty, st = G.stride;
        G.duty = CHARGE.duty; G.stride = CHARGE.stride;
        const p = h.gaits.gallop.gait(ph, amt);
        G.duty = d; G.stride = st;
        return p;
      }
      function horseSet(h, still) {
        const gs = [{ stride: HG.walk.stride, vmax: HG.walk.speed }, { stride: HG.trot.stride, vmax: HG.trot.speed }, { stride: CHARGE.stride, vmax: CHARGE.speed }];
        return {
          gaits: gs,
          pose(v, ph, s, I) {
            const w0 = 1 - smooth((v - 1.6) / 0.7), w2 = smooth((v - 4.2) / 1.6), w1 = Math.max(0, 1 - w0 - w2);
            const a = (g) => Math.sqrt(clamp(v / gs[g].vmax, 0, 1));
            let p = null, ws = 0;
            if (w0 > 0.002) { p = h.gaits.walk.gait(ph[0], a(0)); ws = w0; }
            if (w1 > 0.002) { const q = h.gaits.trot.gait(ph[1], a(1)); p = p ? K.mix(p, q, w1 / (ws + w1)) : q; ws += w1; }
            if (w2 > 0.002) { const q = chargeGait(h, ph[2], a(2)); p = p ? K.mix(p, q, w2 / (ws + w2)) : q; ws += w2; }
            const k = smooth(v / 0.3);
            if (k < 1) p = K.mix(still ? still(I.t) : HA.stand(I.t, h.seed), p, k);
            return p;
          },
        };
      }
      // people on foot: the figure's own walk (or the engineer's run), easing into its standing life
      function footSet(f, base, o) {
        o = o || {};
        const g = o.run ? f.runner : f, vmax = o.vmax || (o.run ? 3.2 : 1.2);
        return {
          gaits: [{ stride: g.stride, vmax }],
          pose(v, ph, s, I) {
            const b = typeof base === 'function' ? base(s, I) : base;
            let p = g.gait(ph[0], Math.sqrt(clamp(v / vmax, 0, 1)), b);
            const k = smooth(v / 0.22);
            if (k < 1) p = K.mix(K.idle(I.t, f.seed, Object.assign({}, f.base, b || {})), p, k);
            return p;
          },
        };
      }

      // ================= the engines' working spots =================
      // siegeworks.js may publish its engines as ctx.siege; these are the defaults (local frames: a metres along the
      // engine's aim, b metres to its left)
      const SW = ctx.siege || window.SIEGEWORKS || {};
      const pick = (o, names, d) => { if (o) for (const n of names) if (o[n] !== undefined) return o[n]; return d; };
      const engFrame = (cx, cz, face) => {
        const d = [Math.sin(face), Math.cos(face)], l = [Math.cos(face), -Math.sin(face)];
        return { face, w: (a, b) => [cx + a * d[0] + b * l[0], cz + a * d[1] + b * l[1]] };
      };
      const T1f = pick(SW.t1, ['face', 'yaw'], Math.atan2(SG.towers.SW[0] - SG.t1[0], SG.towers.SW[1] - SG.t1[1]));
      const T2f = pick(SW.t2, ['face', 'yaw'], Math.atan2(6.5 - SG.t2[0], -11.1 - SG.t2[1]));
      const E1 = engFrame(SG.t1[0], SG.t1[1], T1f), E2 = engFrame(SG.t2[0], SG.t2[1], T2f);
      const asXZ = (p, d) => (p ? (Array.isArray(p) ? [p[0], p.length > 2 ? p[2] : p[1]] : [p.x, p.z]) : d);
      const t1w = SW.t1 && SW.t1.wheels;
      const ENG = {
        wheelL: asXZ(t1w && t1w[0], E1.w(-1.5, 3.4)), wheelR: asXZ(t1w && t1w[1], E1.w(-1.5, -3.4)),
        wheelFloor: pick(SW.t1, ['wheelFloor'], 0.16),
        t1Trough: asXZ(pick(SW.t1, ['trough', 'sling'], null), E1.w(-7.6, 0)), t1Pile: asXZ(pick(SW.t1, ['pile', 'stones'], null), E1.w(-5.4, -4.4)),
        t1Trigger: asXZ(pick(SW.t1, ['trigger'], null), E1.w(-3.2, 1.9)),
        t1Wind: pick(SW.t1, ['wind', 'winds'], [[12.5, 23.5], [42.5, 53.0]]),
        cap: asXZ(pick(SW.t2, ['capstan'], null), E2.w(-4.5, 0)), capR: pick(SW.t2, ['capstanR'], 1.35),
        t2Trough: asXZ(pick(SW.t2, ['trough', 'sling'], null), E2.w(-7.0, 0)), t2Pile: asXZ(pick(SW.t2, ['pile', 'stones'], null), E2.w(-3.8, -3.2)),
        t2Wind: pick(SW.t2, ['wind', 'winds'], [[28, 37], [60, 75]]),
        t2Trigger: asXZ(pick(SW.t2, ['trigger'], null), E2.w(-3.0, 1.8)),
      };
      this.ENG = ENG;
      const t1Load = pick(SW.t1, ['loads'], [22.5, 52.5]);
      const t1Rel = T.treb.filter((s) => s.engine === 't1').map((s) => s.release), t2Rel = T.treb.filter((s) => s.engine === 't2').map((s) => s.release);

      // ================= small pose helpers =================
      const O = (...a) => Object.assign({}, ...a);
      const addLook = (p, x, z, yaw, tx, tz, w, lim) => { p.hy += K.lookYaw(x, z, yaw, tx, tz, lim || 1.1) * (w === undefined ? 1 : w); return p; };
      const mixKeys = (p, q, w, keys) => { if (w <= 0) return p; for (const k of keys) p[k] += (q[k] - p[k]) * w; return p; };
      const UPPER = ['lean', 'twist', 'roll', 'hx', 'hy', 'hz', 'af0', 'af1', 'ao0', 'ao1', 'at0', 'at1', 'e0', 'e1'];
      const ARMS_HEAD = ['hx', 'hy', 'hz', 'af0', 'af1', 'ao0', 'ao1', 'at0', 'at1', 'e0', 'e1'];
      const CHEER = { af0: 2.5, af1: 2.5, e0: 0.45, e1: 0.45, ao0: 0.45, ao1: 0.45, at0: 0, at1: 0, hx: -0.18, lean: -0.05 };
      const cheer = (t, base, seed) => { const p = P(O(base, CHEER)), s = Math.sin(t * 5 + seed); p.e0 += 0.35 * Math.max(0, s); p.e1 += 0.35 * Math.max(0, -s); p.y += 0.02 * Math.abs(s); return p; };
      // a little startle (an arm up, a step back of the weight) at a thump
      const startle = (p, s, at) => { const k = win(s - at, 0, 1.3, 0.25); p.lean -= 0.12 * k; p.hx -= 0.12 * k; p.af1 += 0.5 * k; p.e1 += 0.6 * k; return p; };

      // ================= the Bull knights and their horses =================
      // lanes for the charge, north (0) to south (5): the Bull rides east along zB, the Lion west along zL, they pass left
      // side to left side at x XC
      const NL = 6, XC = 42.5, zB = (k) => 20 + 3.8 * k, zL = (k) => zB(k) - 1.9;
      const tC = (k) => 116.0 + 0.22 * k;                              // the northern lanes meet first
      const MEL = (k) => [k % 2 ? 45.5 : 39.5, zB(k) - 0.95], MR = 1.1;   // the pairs' melee centres and radius
      const LANE_FALL = 2, MELEE_FALL = 4, T_JOUST_FALL = tC(LANE_FALL) + 0.12, T_MELEE_FALL = 127.2;
      // column order out of the postern: c 0 and 1 the foot knights (they lead, to cut T2's ropes), then the riders, lane
      // 5 first, so each stops on the route before the next comes up behind
      const SPOTX = [-1.5, 1.5, -4.5, 4.5, -7.5, 7.5, -10.5, 10.5], SPOTZ = -30;
      const laneOf = (c) => (c >= 2 ? 7 - c : -1);
      const colOf = (k) => 7 - k;
      const HOME_ORDER = [6, 7, 4, 5, 2, 3, 0, 1];                       // outermost spots first, the chasers late
      const HOME_SLOT = [148.0, 148.6, 149.6, 150.2, 151.8, 152.6, 153.6, 154.6];
      const homeT = (c) => HOME_SLOT[HOME_ORDER.indexOf(c)];
      const sallyT = (c) => T.sally + 0.6 * c;                          // passing the postern's middle (0, -46)
      const SALLY_V = 18, HOME_V = 16;
      const sally = SG.sally;
      // the T2 stops of the two foot knights, and their duels with the Lion knights on foot (south-east of T2)
      const T2STOP = [[26.2, 42.6], [29.4, 42.6]];
      const DUEL = [[33.4, 52.6], [37.2, 49.8]], DUELD = 1.15;          // centre; each stands DUELD from it
      const T_FOOT_FALL_B = 129.0, T_FOOT_FALL_L = 133.0;
      // the Lion side
      const LIONX = (k) => 47.5 - 2.2 * k, LIONZ = 64, LIONYAW = PI;      // the horse line on the camp's east side
      const LION_V = 10, COLX = 50.5;
      const LFOOT = [[30.4, 63.4], [34.0, 62.8]];
      const MIST0 = T.mistFull[0], MIST1 = T.mistFull[1];
      const OUT_T = MIST0 + 1.0, IN_T = MIST0 + 5.0;                    // under the full mist: go, and come back

      // --- tags (constants, so nothing is allocated per frame) ---
      const TAG = {
        rideUp: { m: 'ride', lance: 'whole', sword: 'hip' }, rideCouch: { m: 'ride', lance: 'whole', sword: 'hip' },
        rideBroken: { m: 'ride', lance: 'broken', sword: 'hip' }, rideSword: { m: 'ride', lance: 'none', sword: 'hand' },
        rideNone: { m: 'ride', lance: 'none', sword: 'hip' },
        footUp: { m: 'foot', lance: 'whole', sword: 'hip' }, footSword: { m: 'foot', lance: 'none', sword: 'hand' },
        footNone: { m: 'foot', lance: 'none', sword: 'hip' },
      };

      // ---- the knights' pose helpers ----
      const kRide = (t, seed, look) => { const p = M.life(t, seed, P(KP.ride), false); p.hy *= 0.6; if (look) p.hy += look; return p; };
      const kCouch = (t, seed) => { const p = P(KP.rideCouch); p.lean += 0.03 * Math.sin(t * 1.3 + seed); return p; };
      const RIDE_GUARD = K.mix(P(KP.rideSwingDown), P(KP.rideSwingUp), 0.45);
      const kGuard = (t, seed) => { const p = Object.assign({}, RIDE_GUARD); p.af1 += 0.08 * Math.sin(t * 1.7 + seed); p.hy += 0.1 * Math.sin(t * 0.6 + seed); return p; };
      const STAND_GUARD = K.mix(P(KP.swingDown), P(KP.swingUp), 0.4);
      const kStandGuard = (t, seed) => { const p = M.life(t, seed, Object.assign({}, STAND_GUARD), false); return p; };
      // the guard's arms only, for walking in it
      const GUARD_UP = {}; for (const q of ['af0', 'af1', 'ao0', 'ao1', 'at0', 'at1', 'e0', 'e1', 'twist']) GUARD_UP[q] = STAND_GUARD[q];
      // a schedule of sword strokes (1.6 s each) laid over a guard
      const swingAt = (t, times, base, guard) => {
        for (const t0 of times) if (t >= t0 - 0.4 && t < t0 + 2.0) {
          const u = clamp((t - t0) / 1.6, 0, 1), sw = KA.swing(u, base), k = win(t - t0, -0.4, 2.0, 0.4);
          return K.mix(guard, sw, k);
        }
        return guard;
      };
      const strokes = (t0, t1, every, off) => { const a = []; for (let t = t0 + off; t < t1 - 1.6; t += every) a.push(t); return a; };
      // the mount (u 0..1 over 1.4 s), in the horse's frame: from standing at its left side, facing it, up and over
      const MOUNT_K = [
        [0, P(KP.stand)],
        [0.28, P(O(KP.stand, { lf0: 1.15, k0: 1.45, af0: 1.35, e0: 0.55, af1: 1.15, e1: 0.75, lean: 0.25, hx: 0.1 }))],
        [0.6, P(O(KP.ride, { lf1: -0.35, lo1: 0.95, k1: 0.25, af0: 1.0, e0: 0.5, af1: 0.95, e1: 0.8, lean: 0.3 }))],
        [1, P(KP.ride)],
      ];
      const mountPose = (u) => { for (let i = 1; i < MOUNT_K.length; i++) if (u <= MOUNT_K[i][0]) { const [u0, a] = MOUNT_K[i - 1], [u1, b] = MOUNT_K[i]; return K.mix(a, b, smooth((u - u0) / (u1 - u0))); } return P(KP.ride); };
      const RIDE_ROOT = RIDE.rootY;              // the rider's root in the horse's frame when seated (0.95)
      const SEAT_Z = 0.10;
      const mountLocal = (u, out) => {
        const up = smooth((u - 0.22) / 0.42), over = smooth((u - 0.38) / 0.45), turn = smooth((u - 0.32) / 0.5);
        out.x = lerp(0.72, 0, over); out.y = RIDE_ROOT * up + 0.12 * Math.sin(PI * smooth((u - 0.3) / 0.6)); out.z = lerp(0.16, SEAT_Z, over);
        out.yaw = lerpA(-PI / 2, 0, turn);
        return out;
      };
      // where a rider standing at the horse's left side (after a dismount, before a mount) stands in the world
      const besideHorse = (hs) => {
        const c = Math.cos(hs.yaw), s = Math.sin(hs.yaw), lx = 0.72, lz = 0.16;
        return { x: hs.x + lx * c + lz * s, z: hs.z - lx * s + lz * c, yaw: hs.yaw - PI / 2 };
      };

      // ---- build the Bull side ----
      const bull = [];       // index c (column order): { f: knight, h: horse, S: knight script, HS: horse script }
      for (let c = 0; c < 8; c++) {
        const h = CH.horse.make(kit, rigB, { coat: c % 3 === 1 ? 'grey' : 'bay', livery: 'bull' });
        const f = CH.bullKnight.build(ctx, B, kit, rigB);
        bull.push({ c, h, f, k: laneOf(c), side: 'bull' });
      }
      const lion = [];       // index k (lane) for the riders, 6 and 7 the foot knights
      for (let k = 0; k < 8; k++) {
        const h = k < 6 ? CH.horse.make(kit, rigL, { coat: k % 3 === 0 ? 'grey' : 'bay', livery: 'lion' }) : null;
        const f = CH.lionKnight.build(ctx, B, kit, rigL);
        lion.push({ k, h, f, side: 'lion' });
      }

      // ================= the crews, the gunners, the castle's people =================
      const ENG_LOOK = [
        { hair: 0xd2a865, beard: 'none' }, { hair: 0x6e4a30, beard: 'short' }, { hair: 0x9a6a3a, beard: 'short', hood: 0x8a6a48 },
        { hair: 0x3e2a1c, beard: 'none', tunic: 0x36589e }, { hair: 0xb88850, beard: 'short' },
        { hair: 0x5a3a24, beard: 'short' }, { hair: 0xc89a5a, beard: 'none', hood: 0xa87848 }, { hair: 0x4a3020, beard: 'none' },
      ];
      const eng = ENG_LOOK.map((o) => ({ f: EN.make(ctx, B, kit, rigC, o), kind: 'engineer' }));
      const gun = [{ f: GU.make(ctx, B, kit, rigC, { tools: 'both', hair: 0x5a3a24, beard: 'block' }), kind: 'gunner', gi: 3 },
        { f: GU.make(ctx, B, kit, rigC, { tools: 'both', hair: 0x8a5a34, beard: 'none', cap: 0x2a4478 }), kind: 'gunner', gi: 4 }];
      // armies.js mans the other Lion guns: tell it which are ours, so every gun has exactly one crew
      ctx.people = Object.assign(ctx.people || {}, { lionGuns: gun.map((g) => g.gi) });
      const lady = { f: LA.build(ctx, B, kit, rigW), kind: 'lady' };
      const damsel = { f: DA.build(ctx, B, kit, rigW), kind: 'damsel' };
      const trump = { f: TR.build(ctx, B, kit, rigW), kind: 'trumpeter' };
      // the damsel's step (a worn stone block behind her crenel, so the sill is at her hip) and the paving stones she
      // carries up: on the rig, so they cost no draw of their own
      const DS = (CA && CA.damsel) || { x: 7.3, y: SG.curtain.h, z: -12.15, face: 0 };
      const SILL = (CA && CA.sill) || 0.6, D_HIP = damsel.f.hipY, STEP = clamp(SILL - D_HIP, 0, 0.3);
      {
        const stat = rigW.node(null, 0, 0, 0);
        const yW = DS.y;
        rigW.box(stat, 0xb8a47c, 0.62, STEP, 0.5, DS.x, yW + STEP / 2, DS.z + 0.06);
        const st = [[9.15, -12.62, 0.1], [9.5, -12.6, -0.2], [9.32, -12.58, 0.3, 0.12], [6.55, -11.82, 0.05], [6.85, -11.84, -0.1]];
        for (const [x, z, r, up] of st) rigW.box(stat, 0xa39d90, 0.3, 0.11, 0.2, x, yW + 0.055 + (up || 0), z, [0, r, 0]);
      }

      B.finish(rigB, ctx.root); B.finish(rigL, ctx.root); B.finish(rigC, ctx.root); B.finish(rigW, ctx.root);
      this.rigs = [rigB, rigL, rigC, rigW];
      for (const r of this.rigs) r.mesh.renderOrder = 0;
      const allFigs = [].concat(bull.map((b) => b.f), bull.map((b) => b.h), lion.map((l) => l.f), lion.filter((l) => l.h).map((l) => l.h),
        eng.map((e) => e.f), gun.map((g) => g.f), [lady.f, damsel.f, trump.f]);
      for (const f of allFigs) f.floor = ground;
      this.rigRoots = [rigB.root, rigL.root, rigC.root, rigW.root];

      // ================= the Bull scripts =================
      const hsAt = (HS, t) => HS.sample(t, { t, ct: t, n: 0 });
      for (const b of bull) {
        const { c, h, f } = b, k = b.k;
        const HS = new K.Script(SPOTX[c], SPOTZ, 0, 'bullHorse' + c), S = new K.Script(SPOTX[c], SPOTZ, 0, 'bullKnight' + c);
        b.HS = HS; b.S = S;
        const hset = horseSet(h), seed = 1.3 + c * 0.77;
        const stand = (s, I) => ({ pose: HA.stand(I.t, h.seed) });
        // the morning: facing the gate passage, in a line across the courtyard
        HS.holdTo(T.alarm + 0.1 + 0.1 * c, stand);
        pushTurn(HS, PI, 1.6, hset);
        // the sally: one path from the spot, through the postern and round the moat to its stop
        let route = [[SPOTX[c] * 0.35, -37.6], [0, -42.4], [0, -46]].concat(sally.slice(1));
        let stop;
        if (c < 2) {
          route = route.slice(0, route.length - 1).concat([T2STOP[c]]);
          stop = null;
        } else {
          // the stop: where the route crosses this lane's line (zB)
          const zz = zB(k);
          const segs = [[40, 8, 33, 28], [33, 28, 26, 42]];
          for (const [x0, z0, x1, z1] of segs) if (zz >= z0 && zz <= z1) stop = [lerp(x0, x1, (zz - z0) / (z1 - z0)), zz];
          const iA = route.findIndex((p) => p[0] === 40 && p[1] === 8);
          route = route.slice(0, iA + 1).concat(stop[1] > 28 ? [[33, 28], stop] : [stop]);
        }
        const plan = pathPlan(HS, route, SALLY_V, { ra: 2.2, rb: 1.5, round: 3 });
        const tPass = plan.at(0, -46);
        const tDep = sallyT(c) - tPass;
        if (tDep < HS.T) console.warn('people: Bull horse ' + c + ' leaves before its turn', tDep, HS.T);
        HS.holdTo(Math.max(HS.T + 0.01, tDep), stand);
        const sallyStep = pushPath(HS, route, plan.dur, hset, { ra: 2.2, rb: 1.5, round: 3 });
        b.tSallyEnd = HS.T;
        // the rider through all of that: lance up while waiting, couched at the gallop (to pass the postern's vault)
        S.holdTo(97.0 + 0.12 * c, (s, I) => ({ pose: kRide(I.t, seed, 0.15 * Math.sin(I.t * 0.13 + seed)), tag: c < 2 ? TAG.rideNone : TAG.rideUp }));
        S.holdTo(tDep - 0.6, (s, I) => ({ pose: kRide(I.t, seed, 0), tag: c < 2 ? TAG.rideNone : TAG.rideUp }));
        S.holdTo(b.tSallyEnd, (s, I) => ({ pose: c < 2 ? P(O(KP.ride, { lean: 0.12, hx: -0.05 })) : kCouch(I.t, seed), tag: c < 2 ? TAG.rideNone : TAG.rideCouch }));
        b.sallyStep = sallyStep;
      }

      // ---- the two foot knights (c 0, 1): cut T2's ropes from the saddle, dismount, walk to their duels ----
      const footFall = {};          // name → { t0, x, z, yaw }
      const knightFootSet = (f, base) => footSet(f, base, { vmax: 1.2 });
      for (const c of [0, 1]) {
        const b = bull[c], { h, f, HS, S } = b, seed = 1.3 + c * 0.77, hset = horseSet(h);
        const t0 = b.tSallyEnd;
        // the horse stands at T2 until it goes home
        const cut = strokes(t0 + 0.2, t0 + 2.3, 1.2, c * 0.3);
        const CUTG = P(O(KP.ride, { af1: 0.9, e1: 0.4 }));
        S.holdTo(t0 + 2.4, (s, I) => ({ pose: swingAt(I.ct, cut, KP.ride, CUTG), tag: TAG.rideSword }));
        // dismount (1.4 s): the mount in reverse
        const td = S.T, hsD = hsAt(HS, td + 1.5), side = besideHorse(hsD);
        S.hold(1.4, (s) => ({ pose: mountPose(1 - s / 1.4), tag: { m: 'mount', u: 1 - s / 1.4, horse: h, lance: 'none', sword: s < 0.7 ? 'hand' : 'hip' } }));
        S.x = side.x; S.z = side.z; S.yaw = side.yaw;
        b.footFrom = S.T;
        // draw, turn to the Lions coming from the camp, walk to the duel
        const D = DUEL[c], dirz = 1;   // the Lion stands south of the centre
        const me = [D[0], D[1] - DUELD * dirz];
        S.hold(0.8, (s, I) => ({ pose: K.idle(I.t, seed, f.base), tag: TAG.footSword }));
        S.walk([[lerp(S.x, me[0], 0.5) + 0.6, lerp(S.z, me[1], 0.5)], me], 1.3, f, { endYaw: 0, base: () => GUARD_UP, tag: TAG.footSword });
        b.atDuel = S.T;
      }

      // ---- the six riders: stop on the route, wheel to face east, charge down their lane, wheel back, melee ----
      for (let c = 2; c < 8; c++) {
        const b = bull[c], { h, f, HS, S } = b, k = b.k, seed = 1.3 + c * 0.77, hset = horseSet(h);
        // wheel to face east
        HS.hold(0.15, (s, I) => ({ pose: HA.stand(I.t, h.seed) }));
        pushTurn(HS, PI / 2, 1.6, hset);
        // the charge: through the contact point (XC, zB) at tC(k), easing down to a stop at x 49
        const pts = [[XC, zB(k)], [48, zB(k)]];
        let lo = 3, hi = 16, plan = null, tDep = 0;
        for (let i = 0; i < 40; i++) {
          const v = 0.5 * (lo + hi);
          plan = pathPlan(HS, pts, v, { ra: 1.4, rb: 1.3, round: 0 });
          const tCon = plan.at(XC, zB(k));
          tDep = tC(k) - tCon;
          if (tDep < HS.T + 0.2) lo = v; else hi = v;
        }
        HS.holdTo(tDep, (s, I) => ({ pose: HA.stand(I.t, h.seed) }));
        pushPath(HS, pts, plan.dur, hset, { ra: 1.4, rb: 1.3, round: 0 });
        b.tChargeEnd = HS.T;
        // the rider: couched from the stop through the pass, the lance broken at the pass
        S.holdTo(tC(k) - 0.05, (s, I) => ({ pose: kCouch(I.t, seed), tag: TAG.rideCouch }));
        S.holdTo(tC(k) + 1.2, (s, I) => ({ pose: K.mix(P(KP.rideCouch), P(O(KP.ride, { af1: 0.5, e1: 1.1 })), smooth(s / 1.2)), tag: TAG.rideBroken }));
        S.holdTo(tC(k) + 2.1, (s, I) => ({ pose: P(O(KP.ride, { af1: 0.15, e1: 0.25, ao1: 0.25, at1: 0.6, twist: -0.1 })), tag: s < 0.45 ? TAG.rideBroken : TAG.rideNone }));
      }

      // ================= the Lion scripts =================
      for (let k = 0; k < 6; k++) {
        const l = lion[k], { h, f } = l, seed = 4.1 + k * 0.53, hset = horseSet(h);
        const x0 = LIONX(k), HS = new K.Script(x0, LIONZ, LIONYAW, 'lionHorse' + k), S = new K.Script(x0, LIONZ, LIONYAW, 'lionKnight' + k);
        l.HS = HS; l.S = S;
        const side = besideHorse({ x: x0, z: LIONZ, yaw: LIONYAW });
        S.x = side.x; S.z = side.z; S.yaw = side.yaw;
        l.morning = side;
        // the ride: a column up the meadow's east edge (lane 0 leading), each wheeling west into its lane, through the
        // contact at tC(k), easing to a stop at x 35.5. The departure (and the mount before it) is worked back from tC.
        const pts = [[x0 + 0.6, LIONZ - 5], [COLX, LIONZ - 12], [COLX, zL(k) + 3.2], [COLX - 3.2, zL(k)], [XC, zL(k)], [35.5, zL(k)]];
        const plan = pathPlan(HS, pts, LION_V, { ra: 1.8, rb: 1.3, round: 3 });
        const tDep = tC(k) - plan.at(XC, zL(k)), tMount = tDep - 1.65;
        HS.holdTo(tDep, (s, I) => ({ pose: HA.stand(I.t, h.seed) }));
        // the knight by his horse: standing, the lance up, glancing at the castle
        S.holdTo(tMount, (s, I) => ({ pose: addLook(K.idle(I.t, seed, f.base), side.x, side.z, side.yaw, 0, -20, 0.5), tag: TAG.footUp }));
        S.hold(1.4, (s) => ({ pose: mountPose(s / 1.4), tag: { m: 'mount', u: s / 1.4, horse: h, lance: 'whole', sword: 'hip' } }));
        pushPath(HS, pts, plan.dur, hset, { ra: 1.8, rb: 1.3, round: 3 });
        l.tChargeEnd = HS.T;
        S.holdTo(tC(k) - 2.2, (s, I) => ({ pose: kRide(I.t, seed, 0), tag: TAG.rideUp }));
        S.holdTo(tC(k) - 0.05, (s, I) => ({ pose: kCouch(I.t, seed), tag: TAG.rideCouch }));
        if (k === LANE_FALL) {
          // unhorsed at the pass: tips back off his horse and lies still
          const hs = hsAt(HS, T_JOUST_FALL);
          S.holdTo(T_JOUST_FALL, (s, I) => ({ pose: P(KP.rideCouch), tag: TAG.rideBroken }));
          l.fall = { t0: T_JOUST_FALL, x: hs.x + Math.sin(hs.yaw) * SEAT_Z, z: hs.z + Math.cos(hs.yaw) * SEAT_Z, yaw: hs.yaw, yawEnd: hs.yaw, v: hs.v * 0.65, side: 0 };
        } else {
          S.holdTo(tC(k) + 1.2, (s, I) => ({ pose: K.mix(P(KP.rideCouch), P(O(KP.ride, { af1: 0.5, e1: 1.1 })), smooth(s / 1.2)), tag: TAG.rideBroken }));
          S.holdTo(tC(k) + 2.1, (s, I) => ({ pose: P(O(KP.ride, { af1: 0.15, e1: 0.25, ao1: 0.25, at1: 0.6, twist: -0.1 })), tag: s < 0.45 ? TAG.rideBroken : TAG.rideNone }));
        }
      }
      // the two Lion knights on foot: in the camp all morning; at 108 they walk out to save T2
      for (const j of [6, 7]) {
        const l = lion[j], f = l.f, seed = 7.7 + j, d = j - 6;
        const S = new K.Script(LFOOT[d][0], LFOOT[d][1], PI, 'lionFoot' + d);
        l.S = S; l.morning = { x: LFOOT[d][0], z: LFOOT[d][1], yaw: PI };
        S.holdTo(T.lionMount + 1.0 + 0.2 * d, (s, I) => ({ pose: addLook(K.idle(I.t, seed, f.base), LFOOT[d][0], LFOOT[d][1], PI, 24, 46, 0.6), tag: TAG.footNone }));
        const D = DUEL[d], me = [D[0], D[1] + DUELD];
        S.hold(0.9, (s, I) => ({ pose: K.idle(I.t, seed, f.base), tag: TAG.footSword }));
        S.walk([[lerp(S.x, me[0], 0.5) - 0.4, lerp(S.z, me[1], 0.5)], me], 1.15, f, { endYaw: PI, base: () => GUARD_UP, tag: TAG.footSword });
        l.atDuel = S.T;
      }

      // ================= the melee (both sides) =================
      // Each pair circles nose to tail round its centre (the Bull at c + r u(th), the Lion opposite), the opponent on
      // his sword side; they hold still to trade strokes, then wheel a quarter turn at a walk. At 138 every pair has
      // come round to the Bull north and the Lion south, ready to go home or run.
      const wheels = (k) => { const o = (k % 3) * 0.4; return [[123.6 + o, 2.8], [129.4 + o, 2.8], [134.2 + o, 2.8]]; };
      const TH0 = PI / 2, DTH = -PI / 2;
      const thAt = (k, t) => { let th = TH0; for (const [a, d] of wheels(k)) th += DTH * smooth((t - a) / d); return th; };
      for (let k = 0; k < 6; k++) {
        const bb = bull[colOf(k)], ll = lion[k], [mx, mz] = MEL(k);
        const bset = horseSet(bb.h), lset = horseSet(ll.h);
        const posB = (th) => [mx + MR * Math.sin(th), mz + MR * Math.cos(th)], posL = (th) => [mx - MR * Math.sin(th), mz - MR * Math.cos(th)];
        // the Bull: wheel round at his stop and come back west to his side of the pair, facing south
        if (k !== LANE_FALL) {
          const HS = bb.HS;
          HS.hold(0.2, (s, I) => ({ pose: HA.stand(I.t, bb.h.seed) }));
          pushTurn(HS, -PI / 2, 1.6, bset);
          const p = posB(TH0);
          pushPath(HS, [[p[0] + 1.6, p[1] - 0.6], p], 2.6, bset, { endYaw: 0, ra: 0.9, rb: 0.9 });
        } else {
          // no one to fight: out of the press to the meadow's north-east corner, watching
          const HS = bb.HS;
          HS.holdTo(121.6, (s, I) => ({ pose: HA.stand(I.t, bb.h.seed) }));
          pushPath(HS, [[49.7, zB(k) - 3.0], [49.6, 20.5], [49.2, 15.6]], 4.6, bset, { endYaw: -2.6, ra: 1.0, rb: 1.2 });
        }
        if (k !== LANE_FALL) {
          const HS = ll.HS;
          HS.hold(0.2, (s, I) => ({ pose: HA.stand(I.t, ll.h.seed) }));
          pushTurn(HS, PI / 2, 1.6, lset);
          const p = posL(TH0);
          pushPath(HS, [[p[0] - 1.6, p[1] + 0.6], p], 2.6, lset, { endYaw: PI, ra: 0.9, rb: 0.9 });
        }
        bb.meleeFrom = bb.HS.T; ll.meleeFrom = k !== LANE_FALL ? ll.HS.T : 0;
        bb.pos = posB; ll.pos = posL; bb.mel = [mx, mz]; ll.mel = [mx, mz];
      }

      // ---- the melee steps: holds and quarter wheels, until 138 (or a fall) ----
      const meleeHorse = (HS, h, k, isBull, tEnd) => {
        const set = horseSet(h), [mx, mz] = MEL(k);
        for (const [a, d] of wheels(k)) {
          if (a + d > tEnd) break;
          HS.holdTo(a, (s, I) => ({ pose: HA.stand(I.t, h.seed) }));
          const th0 = thAt(k, a - 0.01);
          pushArc(HS, mx, mz, MR, isBull ? th0 : th0 + PI, isBull ? th0 + DTH : th0 + PI + DTH, d, set, { ra: 0.9, rb: 0.9 });
        }
        HS.holdTo(tEnd, (s, I) => ({ pose: HA.stand(I.t, h.seed) }));
      };
      const T_BREAK = T.retreatCall;            // 138
      for (let k = 0; k < 6; k++) {
        if (k === LANE_FALL) continue;
        const bb = bull[colOf(k)], ll = lion[k];
        const tEndB = k <= 3 ? T_BREAK - (k <= 1 ? 0.4 : 0) : T_BREAK - 0.2;
        meleeHorse(bb.HS, bb.h, k, true, k === MELEE_FALL ? T_MELEE_FALL + 1.2 : tEndB);
        meleeHorse(ll.HS, ll.h, k, false, k === MELEE_FALL ? T_MELEE_FALL + 1.2 : T_BREAK);
      }
      // B4 after his foe falls: rides a few metres east and watches over the rest
      {
        const bb = bull[colOf(MELEE_FALL)];
        // he turns away from the fallen man and walks his horse clear, to watch over the rest
        pushPath(bb.HS, [[37.4, 36.4], [35.0, 40.6]], 4.6, horseSet(bb.h), { endYaw: 0.9, ra: 1.0, rb: 1.2 });
        bb.HS.holdTo(T_BREAK - 0.2, (s, I) => ({ pose: HA.stand(I.t, bb.h.seed) }));
      }
      // ---- the riders' poses through the melee: guard, strokes (the Bulls and Lions in turn), never at anyone down ----
      for (let k = 0; k < 6; k++) {
        const bb = bull[colOf(k)], ll = lion[k], sB = 1.3 + bb.c * 0.77, sL = 4.1 + k * 0.53;
        const strokesB = strokes(122.2 + 0.3 * k, k === MELEE_FALL ? T_MELEE_FALL - 0.6 : T_BREAK - 0.5, 3.1, 0);
        const strokesL = strokes(123.7 + 0.3 * k, k === MELEE_FALL ? T_MELEE_FALL - 1.8 : T_BREAK - 0.5, 3.1, 0);
        if (k !== LANE_FALL) {
          const endB = k === MELEE_FALL ? T_MELEE_FALL + 0.2 : T_BREAK - 0.3;
          bb.S.holdTo(endB, (s, I) => ({ pose: swingAt(I.ct, strokesB, KP.ride, kGuard(I.t, sB)), tag: TAG.rideSword }));
          if (k === MELEE_FALL) bb.S.holdTo(T_BREAK - 0.3, (s, I) => ({ pose: kGuard(I.t, sB), tag: TAG.rideSword }));
        } else {
          bb.S.holdTo(T_BREAK - 0.3, (s, I) => ({ pose: kGuard(I.t, sB), tag: TAG.rideSword }));
        }
        if (k !== LANE_FALL) {
          if (k === MELEE_FALL) {
            ll.S.holdTo(T_MELEE_FALL, (s, I) => ({ pose: swingAt(I.ct, strokesL, KP.ride, kGuard(I.t, sL)), tag: TAG.rideSword }));
            const hs = hsAt(ll.HS, T_MELEE_FALL), lx = Math.cos(hs.yaw), lz = -Math.sin(hs.yaw);
            // he goes over his horse's far side (away from his foe), turning as he tips, and lies on his back
            ll.fall = { t0: T_MELEE_FALL, x: hs.x + Math.sin(hs.yaw) * SEAT_Z, z: hs.z + Math.cos(hs.yaw) * SEAT_Z, yaw: hs.yaw, yawEnd: hs.yaw - PI / 2,
              v: 0, side: 1, sx: lx, sz: lz };
          } else ll.S.holdTo(T_BREAK, (s, I) => ({ pose: swingAt(I.ct, strokesL, KP.ride, kGuard(I.t, sL)), tag: TAG.rideSword }));
        }
      }

      // ---- the duels on foot (T2's side): strokes in turn, a sidestep now and then; the Bull at duel 0 falls ----
      const duelSteps = (S, f, D, isBull, tFrom, tTo, seed, sAt) => {
        const st = strokes(tFrom + 0.6 + (isBull ? 0 : 1.5), tTo, 3.0, 0);
        const ang0 = isBull ? PI : 0;   // the Bull north of the centre (yaw 0, facing south), the Lion south
        let ang = ang0, t = S.T;
        S.holdTo(tFrom, (s, I) => ({ pose: kStandGuard(I.t, seed), tag: TAG.footSword }));
        for (const ts of [tFrom + 4.6, tFrom + 10.2, tFrom + 15.0]) {
          if (ts + 1.4 > tTo) break;
          S.holdTo(ts, (s, I) => ({ pose: swingAt(I.ct, st, KP.stand, kStandGuard(I.t, seed)), tag: TAG.footSword }));
          ang += 0.45;
          const p = [D[0] + DUELD * Math.sin(ang), D[1] + DUELD * Math.cos(ang)];
          S.walk([p], 0.6, f, { endYaw: wrapA(ang + PI), base: () => GUARD_UP, tag: TAG.footSword });
        }
        S.holdTo(tTo, (s, I) => ({ pose: swingAt(I.ct, st, KP.stand, kStandGuard(I.t, seed)), tag: TAG.footSword }));
        void t; void ang0; void sAt;
      };
      // the Bull foot knights
      {
        const b0 = bull[0], b1 = bull[1], l6 = lion[6], l7 = lion[7];
        const tDuel = Math.max(b0.atDuel, l6.atDuel, b1.atDuel, l7.atDuel) + 0.2;
        duelSteps(b0.S, b0.f, DUEL[0], true, tDuel, T_FOOT_FALL_B, 1.3, 0);
        duelSteps(l6.S, l6.f, DUEL[0], false, tDuel, T_FOOT_FALL_B + 0.9, 7.7, 0);
        duelSteps(b1.S, b1.f, DUEL[1], true, tDuel, T_FOOT_FALL_L + 0.9, 2.07, 0);
        duelSteps(l7.S, l7.f, DUEL[1], false, tDuel, T_FOOT_FALL_L, 8.7, 0);
        b0.ffall = T_FOOT_FALL_B; l7.ffall = T_FOOT_FALL_L;
        this.tDuel = tDuel;
      }

      // ================= falls, flights, chases and the ride home =================
      // the fallen: a fall step and then still until the mist takes them
      const fallFoot = (S, f, t0) => {
        const g1 = { m: 'fallFoot', t0 }, g2 = { m: 'fallFoot', t0, out: OUT_T }, still = KA.fall(9, KP.stand).pose;
        S.holdTo(t0 + 1.6, (s) => ({ pose: KA.fall(s, KP.stand).pose, tag: g1 }));
        S.holdTo(OUT_T + 1.5, (s, I) => ({ pose: still, tag: g2 }));
      };
      fallFoot(bull[0].S, bull[0].f, T_FOOT_FALL_B);
      fallFoot(lion[7].S, lion[7].f, T_FOOT_FALL_L);
      // mounted falls: the rider's own path in the world (update works it out from l.fall)
      for (const k of [LANE_FALL, MELEE_FALL]) {
        const l = lion[k];
        const g = { m: 'fallRide', fall: l.fall, out: OUT_T, lance: 'none', sword: 'hip' };
        l.S.holdTo(OUT_T + 1.5, (s) => ({ pose: P(KP.ride), tag: g }));
      }
      // the riderless horses trot to the meadow's edges and stand
      const OUTG = { out: OUT_T };
      {
        const l = lion[LANE_FALL], HS = l.HS, set = horseSet(l.h);
        HS.holdTo(121.0, (s, I) => ({ pose: HA.stand(I.t, l.h.seed) }));
        pushPath(HS, [[34.4, 20.0], [33.2, 12.4]], 5.2, set, { endYaw: 0.4, ra: 1.0, rb: 1.2 });
        const graze = (t) => { const p = HA.stand(t, l.h.seed); p.at0 += 0.55; p.hx += 0.35; return p; };
        HS.holdTo(OUT_T + 1.5, (s, I) => ({ pose: K.mix(HA.stand(I.t, l.h.seed), graze(I.t), smooth((s - 4) / 2)), tag: OUTG }));
        l.restHorse = [33.2, 12.4];
      }
      {
        const l = lion[MELEE_FALL], HS = l.HS, set = horseSet(l.h);
        HS.hold(1.3, (s, I) => ({ pose: HA.stand(I.t, l.h.seed) }));
        // away from the body (which lies on its north side): a slow turn to the south, then west to the meadow's edge
        pushPath(HS, [[HS.x + 1.4, HS.z + 2.4], [36.4, 36.6], [31.0, 35.6]], 6.0, set, { endYaw: -1.9, ra: 1.2, rb: 1.2, round: 1.6 });
        const graze = (t) => { const p = HA.stand(t, l.h.seed); p.at0 += 0.55; p.hx += 0.35; return p; };
        HS.holdTo(OUT_T + 1.5, (s, I) => ({ pose: K.mix(HA.stand(I.t, l.h.seed), graze(I.t), smooth((s - 4) / 2)), tag: OUTG }));
      }
      // the Lion riders who are left run for it: east, down the meadow's edge, past the camp and up the road over the
      // hill, then out of sight (hidden far off until the mist)
      const ROAD = [[49.6, 58], [48.2, 68], [56, 76.4], [70, 80], [100, 88], [140, 100], [184, 113]];
      const TAG_GONE = { m: 'gone' };
      for (const k of [0, 1, 3, 5]) {
        const l = lion[k], HS = l.HS, set = horseSet(l.h), sL = 4.1 + k * 0.53;
        const p0 = [HS.x, HS.z], east = [50.2, p0[1] + (k === 0 ? 3.0 : 1.2)];
        const pts = [[p0[0] - 1.2, p0[1] + 1.4], [lerp(p0[0], east[0], 0.6), p0[1] + 2.4], east].concat(ROAD);
        const plan = pathPlan(HS, pts, 13, { ra: 1.6, rb: 0.6, round: 2.5 });
        const tOut = HS.T + plan.at(118, 95.5);
        pushPath(HS, pts, plan.dur, set, { ra: 1.6, rb: 0.6, round: 2.5, tag: { out: tOut } });
        l.tGone = Math.max(HS.T + 0.1, tOut + 2);
        HS.holdTo(l.tGone, (s, I) => ({ pose: HA.stand(I.t, l.h.seed), tag: TAG_GONE }));
        l.S.holdTo(T_BREAK + 0.6, (s, I) => ({ pose: K.mix(kGuard(I.t, sL), P(O(KP.ride, { lean: 0.15 })), smooth(s / 0.6)), tag: TAG.rideSword }));
        l.S.holdTo(l.tGone, (s, I) => ({ pose: P(O(KP.ride, { lean: 0.18, hx: -0.05, af1: 0.7, e1: 0.6 })), tag: TAG.rideSword }));
      }
      // the Bulls go home: the north lanes straight away, the two southern riders after chasing the Lions to the
      // camp's edge and looping back; the foot knight who stands remounts at T2 and follows, the other's horse with him
      const HOME = [[44.6, 12.0], [42, -6]].concat(sally.slice(0, sally.length).reverse().slice(sally.length - 7 + 0).filter(() => false));
      const sallyBack = sally.slice().reverse();           // T2 → postern
      const iE = sallyBack.findIndex((p) => p[0] === 42 && p[1] === -6);
      const homeTail = sallyBack.slice(iE + 1).concat([[0, -42.4]]);     // [42,-28] ... [0,-46], into the courtyard
      void HOME;
      const homeRide = (b, pts, tDepMin) => {
        const HS = b.HS, set = horseSet(b.h), c = b.c;
        const spot = [SPOTX[c], SPOTZ];
        const all2 = pts.concat([[44.6, 12.0], [42.6, -6]]).concat(homeTail).concat([[SPOTX[c] * 0.4, -37.0], [spot[0], spot[1] - 3.2], spot]);
        let plan = pathPlan(HS, all2, HOME_V, { ra: 1.8, rb: 2.2, round: 3 });
        let tDep = homeT(c) - plan.at(0, -46);
        if (tDep < tDepMin) {
          // late: ride faster to keep the slot at the postern
          let lo = HOME_V, hi = 24;
          for (let i = 0; i < 40; i++) { const v = 0.5 * (lo + hi); plan = pathPlan(HS, all2, v, { ra: 1.8, rb: 2.2, round: 3 }); tDep = homeT(c) - plan.at(0, -46); if (tDep < tDepMin) lo = v; else hi = v; }
          if (tDep < tDepMin - 0.05) console.warn('people: Bull horse ' + c + ' cannot be home in time', tDep.toFixed(2), tDepMin.toFixed(2));
          b.homeV = 0.5 * (lo + hi);
        }
        HS.holdTo(Math.max(tDepMin, tDep), (s, I) => ({ pose: HA.stand(I.t, b.h.seed) }));
        pushPath(HS, all2, plan.dur, set, { ra: 1.8, rb: 2.2, round: 3, endYaw: 0 });
        b.tHome = HS.T;
        return tDep;
      };
      for (const k of [0, 1, 2, 3]) {
        const b = bull[colOf(k)];
        const p0 = [b.HS.x, b.HS.z];
        const tDep = homeRide(b, [[p0[0] + 0.4, p0[1] - 2.6], [lerp(p0[0], 44.6, 0.5), lerp(p0[1], 12, 0.5)]], b.HS.T);
        b.S.holdTo(tDep + 0.5, (s, I) => ({ pose: K.mix(kGuard(I.t, 1.3 + b.c * 0.77), P(O(KP.ride, { af1: 0.6, e1: 0.9 })), smooth(s / 1.0)), tag: TAG.rideSword }));
        b.homeDep = tDep;
      }
      // the chasers (lanes 4 and 5): south after the Lions to the camp's edge, round, and home
      for (const k of [5, 4]) {
        const b = bull[colOf(k)];
        const p0 = [b.HS.x, b.HS.z], lead = k === 5 ? 0 : 1.6;
        const loop = [[p0[0] + 0.6, p0[1] + 3], [47.0 - lead * 0.4, 47.5], [46.2 - lead, 54.6 - lead * 0.6], [43.2 - lead, 55.2 - lead], [41.0 - lead * 0.5, 51.0], [42.2, 42], [43.4, 30]];
        const tDep = homeRide(b, loop, T_BREAK + 0.9 + (k === 4 ? 0.6 : 0));
        b.S.holdTo(tDep + 0.5, (s, I) => ({ pose: K.mix(kGuard(I.t, 1.3 + b.c * 0.77), P(O(KP.ride, { af1: 1.0, e1: 0.5, lean: 0.12 })), smooth(s / 1.0)), tag: TAG.rideSword }));
        b.homeDep = tDep;
      }
      // the standing foot knight (c 1): backs off as his foe gives ground, walks to his horse, mounts, rides home
      {
        const b = bull[1], S = b.S, f = b.f, seed = 2.07;
        const hsH = hsAt(b.HS, T_BREAK), side = besideHorse(hsH);
        S.walk([[lerp(S.x, side.x, 0.5) + 0.8, lerp(S.z, side.z, 0.5)], [side.x, side.z]], 1.2, f, { endYaw: side.yaw, tag: TAG.footNone });
        S.hold(0.4, (s, I) => ({ pose: K.idle(I.t, seed, f.base), tag: TAG.footNone }));
        const tm = S.T;
        S.hold(1.4, (s) => ({ pose: mountPose(s / 1.4), tag: { m: 'mount', u: s / 1.4, horse: b.h, lance: 'none', sword: 'hip' } }));
        const tDep = homeRide(b, [[34.0, 41.2], [43.6, 38.6], [46.6, 30.0]], S.T + 0.3);
        S.holdTo(tDep + 0.5, (s, I) => ({ pose: kRide(I.t, seed, 0), tag: TAG.rideNone }));
        b.tMounted = tm + 1.4;
      }
      // the other's horse goes home riderless, behind the column
      {
        const b = bull[0];
        homeRide(b, [[27.4, 39.4], [34.0, 38.4], [43.2, 38.4], [46.4, 30.2]], b.HS.T);
      }
      // home: everyone at the morning place, facing the gate; the fallen Bull knight comes back on his horse under
      // the mist
      for (const b of bull) {
        b.HS.holdTo(180, (s, I) => ({ pose: HA.stand(I.t, b.h.seed) }));
        const seed = 1.3 + b.c * 0.77;
        if (b.c === 0) {
          const back = { m: 'ride', lance: 'none', sword: 'hip', in: IN_T };
          b.S.holdTo(IN_T - 1.2, (s, I) => ({ pose: P(KP.stand), tag: TAG_GONE }));
          b.S.holdTo(180, (s, I) => ({ pose: kRide(I.t, seed, 0), tag: back }));
        } else {
          b.S.holdTo(b.tHome + 0.5, (s, I) => ({ pose: kRide(I.t, seed, 0), tag: b.c < 2 ? TAG.rideNone : TAG.rideNone }));
          // the riders come home without their broken lances; a fresh one is in each hand by the morning (under the mist)
          b.S.holdTo(180, (s, I) => ({ pose: kRide(I.t, seed, 0.2 * Math.sin(I.t * 0.11 + seed)), tag: b.c < 2 ? TAG.rideNone : (I.ct > IN_T ? TAG.rideUp : TAG.rideNone) }));
        }
      }
      // the Lions: the lone foot knight backs off to the camp; under the mist everyone is back at the horse line
      {
        const l = lion[6], S = l.S, f = l.f, seed = 7.7;
        S.walk([[S.x + 0.9, S.z + 1.4], [S.x + 2.2, S.z + 2.0]], 0.7, f, { endYaw: PI - 0.9, base: () => GUARD_UP, tag: TAG.footSword });
        S.holdTo(135.2, (s, I) => ({ pose: addLook(kStandGuard(I.t, seed), S.x, S.z, S.yaw, DUEL[1][0], DUEL[1][1], 0.7), tag: TAG.footSword }));
        S.walk([[S.x + 1.0, S.z + 3.0], [31.2, 60.4], [l.morning.x, l.morning.z]], 1.15, f, { endYaw: PI, tag: TAG.footSword });
        S.holdTo(180, (s, I) => ({ pose: addLook(K.idle(I.t, seed, f.base), l.morning.x, l.morning.z, PI, 30, 30, 0.5), tag: TAG.footNone }));
      }
      {
        const l = lion[7], S = l.S, f = l.f, seed = 8.7;
        S.x = l.morning.x; S.z = l.morning.z; S.yaw = PI;
        const back = { m: 'foot', lance: 'none', sword: 'hip', in: IN_T };
        S.holdTo(180, (s, I) => ({ pose: addLook(K.idle(I.t, seed, f.base), l.morning.x, l.morning.z, PI, 24, 46, 0.5), tag: back }));
      }
      for (let k = 0; k < 6; k++) {
        const l = lion[k], HS = l.HS, S = l.S, seed = 4.1 + k * 0.53;
        HS.x = LIONX(k); HS.z = LIONZ; HS.yaw = LIONYAW;
        const backH = { in: IN_T }, back = { m: 'foot', lance: 'whole', sword: 'hip', in: IN_T };
        HS.holdTo(180, (s, I) => ({ pose: HA.stand(I.t, l.h.seed), tag: backH }));
        S.x = l.morning.x; S.z = l.morning.z; S.yaw = l.morning.yaw;
        S.holdTo(180, (s, I) => ({ pose: addLook(K.idle(I.t, seed, l.f.base), l.morning.x, l.morning.z, l.morning.yaw, 0, -20, 0.5), tag: back }));
      }
      for (const b of bull) all.push({ f: b.f, S: b.S, kind: 'bullKnight', knight: b, seed: 1.3 + b.c * 0.77 }, { f: b.h, S: b.HS, kind: 'horse', horse: b, seed: b.h.seed });
      for (const l of lion) { all.push({ f: l.f, S: l.S, kind: 'lionKnight', knight: l, seed: 4.1 + l.k * 0.53 }); if (l.h) all.push({ f: l.h, S: l.HS, kind: 'horse', horse: l, seed: l.h.seed }); }
      this.bull = bull; this.lion = lion;

      // ================= T1's crew =================
      {
        const fw = E1.face, w = E1.w;
        const [w1a, w1b] = t1Rel;
        const winds = ENG.t1Wind;
        const wheelSpot = [ENG.wheelL, ENG.wheelR];
        const dd = [Math.sin(fw), Math.cos(fw)], c1 = SG.t1;
        const wheelOut = wheelSpot.map((ws) => { let vx = ws[0] - c1[0], vz = ws[1] - c1[1]; const a = vx * dd[0] + vz * dd[1]; vx -= a * dd[0]; vz -= a * dd[1]; const L = hyp(vx, vz) || 1; return [ws[0] + vx / L * 2.0, ws[1] + vz / L * 2.0]; });
        const yWheel = (i) => ground(wheelSpot[i][0], wheelSpot[i][1]) + ENG.wheelFloor;
        const camp = [[-23.8, 58.2], [-15.2, 57.4], [-17.3, 58.6], [-20.5, 57.7], [-18.7, 56.5]];   // the camp's front, clear of the tents
        const look = (p, x, z, yaw, tx, tz, k) => addLook(p, x, z, yaw, tx, tz, k === undefined ? 0.8 : k);
        const breach = SG.breach.point;
        // the stone's flight: watch it go and land
        const watchShot = (p, s, t0, x, z, yaw, at) => { const k = win(s, t0, t0 + 3.4, 0.5); p.hx -= 0.35 * k * (1 - smooth((s - t0 - 0.8) / 1.4)); return look(p, x, z, yaw, at[0], at[2], k); };
        // E0, E1: into the wheels at dawn, tread while the arm comes down, out again after the second shot
        for (let i = 0; i < 2; i++) {
          const e = eng[i], f = e.f, seed = 11 + i * 1.7, o = wheelOut[i], ws = wheelSpot[i];
          const S = new K.Script(o[0], o[1], yawTo(o[0], o[1], ws[0], ws[1]), 'eng' + i);
          e.S = S; e.morning = { x: o[0], z: o[1], yaw: S.yaw };
          S.holdTo(3 + i * 0.6, (s, I) => ({ pose: K.idle(I.t, seed, f.base) }));
          S.walk([[lerp(o[0], ws[0], 0.6), lerp(o[1], ws[1], 0.6)], [ws[0], ws[1], yWheel(i)]], 0.8, f, { endYaw: fw });
          const inWheel = (fn) => (s, I) => O(fn(s, I), { y: yWheel(i) });
          const rest = (s, I) => { const p = K.idle(I.t, seed, O(f.base, { af0: 0.95, e0: 0.7, af1: 0.9, e1: 0.75, lean: 0.06 })); return { pose: p }; };
          const tread = (s, I) => ({ pose: EN.tread(f, I.t + i * 0.9) });
          for (let wi = 0; wi < winds.length; wi++) {
            S.holdTo(winds[wi][0], inWheel(rest));
            S.holdTo(winds[wi][1], inWheel(tread));
          }
          S.holdTo(T.breakAt + 0.2, inWheel(rest));
          S.holdTo(T.breakAt + 3.4, inWheel((s, I) => ({ pose: K.mix(cheer(I.t, f.base, seed), P(f.base), smooth((s - 2.4) / 0.8)) })));
          S.holdTo(63 + i, inWheel(rest));
          S.walk([[lerp(o[0], ws[0], 0.5), lerp(o[1], ws[1], 0.5)], o], 0.8, f, { endYaw: wrapA(fw + (i ? -0.6 : 0.6)) });
          S.holdTo(T.retreatCall + 0.8 + i * 0.4, (s, I) => ({ pose: look(K.idle(I.t, seed, f.base), o[0], o[1], S.yaw, 34, 24, smooth((I.ct - 112) / 3) * 0.9) }));
          e.campSpot = camp[i];
        }
        // E2: carries the stone from the pile, waits with it by the trough until the arm is down, lays it in the sling
        {
          const e = eng[2], f = e.f, seed = 14.5, pile = ENG.t1Pile, tr = ENG.t1Trough;
          const home = [lerp(tr[0], pile[0], 0.5) + 0.2, lerp(tr[1], pile[1], 0.5) + 1.6], S = new K.Script(home[0], home[1], yawTo(home[0], home[1], tr[0], tr[1]), 'eng2');
          e.S = S; e.morning = { x: home[0], z: home[1], yaw: S.yaw };
          const nearPile = [pile[0] + (home[0] - pile[0]) * 0.4, pile[1] + (home[1] - pile[1]) * 0.4];
          const nearTr = [tr[0] + (home[0] - tr[0]) / hyp(home[0] - tr[0], home[1] - tr[1]) * 0.95, tr[1] + (home[1] - tr[1]) / hyp(home[0] - tr[0], home[1] - tr[1]) * 0.95];
          const carryWalk = () => EN.poses.carry;
          const LAY = P(O(f.base, EN.poses.lay)), BEND = P(O(f.base, EN.poses.lay, { lean: 0.62, hx: -0.1 })), CARRY = P(O(f.base, EN.poses.carry));
          for (const rel of [w1a, w1b]) {
            const shot = T.treb.find((q) => q.release === rel);
            S.holdTo(rel - 13.5, (s, I) => ({ pose: look(K.idle(I.t, seed, f.base), S.x, S.z, S.yaw, breach[0], breach[2], 0.4) }));
            S.walk([nearPile], 0.9, f, { endYaw: yawTo(nearPile[0], nearPile[1], pile[0], pile[1]) });
            S.hold(1.3, (s) => ({ pose: K.mix(LAY, BEND, smooth(s / 1.3)) }));
            S.hold(0.9, () => ({ pose: CARRY }));
            S.walk([nearTr], 0.85, f, { endYaw: yawTo(nearTr[0], nearTr[1], tr[0], tr[1]), base: carryWalk });
            S.holdTo(t1Load[t1Rel.indexOf(rel)] - 0.8, (s, I) => { const p = P(O(f.base, EN.poses.carry)); p.lean += 0.015 * Math.sin(I.t * 1.6); return { pose: p }; });
            S.hold(1.5, () => ({ pose: LAY }));
            S.hold(0.8, () => ({ pose: P(O(f.base, { lean: 0.3, af0: 0.5, af1: 0.5, e0: 0.3, e1: 0.3 })) }));
            S.walk([home], 1.1, f, { endYaw: yawTo(home[0], home[1], tr[0], tr[1]) + 0.4 });
            S.holdTo(rel + 4.5, (s, I) => ({ pose: watchShot(K.idle(I.t, seed, f.base), I.ct, rel, home[0], home[1], S.yaw, shot.at) }));
          }
          S.holdTo(T.breakAt + 0.2, (s, I) => ({ pose: K.idle(I.t, seed, f.base) }));
          S.holdTo(T.breakAt + 3.4, (s, I) => ({ pose: K.mix(cheer(I.t, f.base, seed), P(f.base), smooth((s - 2.4) / 0.8)) }));
          S.holdTo(T.retreatCall + 0.6, (s, I) => ({ pose: look(K.idle(I.t, seed, f.base), S.x, S.z, S.yaw, 34, 24, smooth((I.ct - 112) / 3) * 0.9) }));
          e.campSpot = camp[2];
        }
        // E3: hauls the arm down on a rope, steadies the sling
        {
          const e = eng[3], f = e.f, seed = 16.1, ca = asXZ(SW.t1 && SW.t1.catchAt, E1.w(-9.3, 0));
          const lat = [Math.cos(fw), -Math.sin(fw)], rope = [ca[0] - lat[0] * 1.2, ca[1] - lat[1] * 1.2], stand = [ca[0] - lat[0] * 2.8, ca[1] - lat[1] * 2.8];
          const S = new K.Script(stand[0], stand[1], fw, 'eng3');
          e.S = S; e.morning = { x: stand[0], z: stand[1], yaw: fw };
          for (let wi = 0; wi < winds.length; wi++) {
            const rel = t1Rel[wi], shot = T.treb.find((q) => q.release === rel);
            S.holdTo(winds[wi][0] - 2.4, (s, I) => ({ pose: K.idle(I.t, seed, f.base) }));
            S.walk([rope], 0.8, f, { endYaw: fw });
            S.holdTo(winds[wi][1], (s, I) => ({ pose: EN.haul(f, I.t) }));
            S.hold(1.8, (s, I) => ({ pose: P(O(f.base, { lean: 0.42, hx: 0.2, af0: 0.85, af1: 0.85, e0: 0.4, e1: 0.4, k0: 0.2, k1: 0.2 })) }));
            S.walk([stand], 0.9, f, { endYaw: fw });
            S.holdTo(rel + 4.5, (s, I) => ({ pose: watchShot(K.idle(I.t, seed, f.base), I.ct, rel, stand[0], stand[1], fw, shot.at) }));
          }
          S.holdTo(T.breakAt + 0.3, (s, I) => ({ pose: K.idle(I.t, seed, f.base) }));
          S.holdTo(T.breakAt + 3.5, (s, I) => ({ pose: K.mix(cheer(I.t, f.base, seed), P(f.base), smooth((s - 2.4) / 0.8)) }));
          S.holdTo(T.retreatCall + 0.3, (s, I) => ({ pose: look(K.idle(I.t, seed, f.base), stand[0], stand[1], fw, 34, 24, smooth((I.ct - 112) / 3) * 0.9) }));
          e.campSpot = camp[3];
        }
        // E4: the trigger
        {
          const e = eng[4], f = e.f, seed = 17.9, tg = ENG.t1Trigger, axis = E1.w(-3.2, 0);
          const yawT = yawTo(tg[0], tg[1], axis[0], axis[1]);
          const S = new K.Script(tg[0], tg[1], yawT, 'eng4');
          e.S = S; e.morning = { x: tg[0], z: tg[1], yaw: yawT };
          const GRIP = O(f.base, EN.poses.haul, { lean: -0.05, hx: -0.1 });
          for (const rel of t1Rel) {
            const shot = T.treb.find((q) => q.release === rel);
            S.holdTo(rel - 2.4, (s, I) => ({ pose: look(K.idle(I.t, seed, f.base), tg[0], tg[1], yawT, breach[0], breach[2], 0.3) }));
            S.holdTo(rel - 0.15, (s, I) => { const p = P(GRIP); p.lean += 0.02 * Math.sin(I.t * 2); return { pose: p }; });
            S.hold(0.35, (s) => ({ pose: P(O(f.base, EN.poses.trigger)) }));
            S.holdTo(rel + 3.0, (s, I) => ({ pose: watchShot(P(O(f.base, EN.poses.trigger)), I.ct, rel, tg[0], tg[1], yawT, shot.at) }));
            S.holdTo(rel + 4.6, (s, I) => ({ pose: K.idle(I.t, seed, f.base) }));
          }
          S.holdTo(T.breakAt + 0.25, (s, I) => ({ pose: K.idle(I.t, seed, f.base) }));
          S.holdTo(T.breakAt + 3.45, (s, I) => ({ pose: K.mix(cheer(I.t, f.base, seed), P(f.base), smooth((s - 2.4) / 0.8)) }));
          S.holdTo(T.retreatCall + 1.0, (s, I) => ({ pose: look(K.idle(I.t, seed, f.base), tg[0], tg[1], yawT, 34, 24, smooth((I.ct - 112) / 3) * 0.9) }));
          e.campSpot = camp[4];
        }
        // all five: run to the camp at the retreat, stand there through the dusk, walk back in the dark
        // camp spots in the same west-to-east order as their places at the engine, so nobody's path crosses another's
        {
          const order = [0, 1, 2, 3, 4].sort((a, b) => eng[a].morning.x - eng[b].morning.x), spotsX = camp.slice().sort((a, b) => a[0] - b[0]);
          order.forEach((ei, r) => { eng[ei].campSpot = spotsX[r]; });
        }
        for (let i = 0; i < 5; i++) {
          const e = eng[i], S = e.S, f = e.f, seed = 11 + i * 1.7, cs = e.campSpot, m = e.morning;
          S.walk([[lerp(S.x, cs[0], 0.5) + (i - 2) * 0.6, lerp(S.z, cs[1], 0.5)], cs], 3.0, f.runner, { endYaw: PI + 0.3 * (i - 2) });
          S.holdTo(158 + i * 0.7, (s, I) => ({ pose: look(K.idle(I.t, seed, f.base), cs[0], cs[1], PI, -18, -12, 0.6) }));
          S.walk([[lerp(cs[0], m.x, 0.5) - (i - 2) * 0.5, lerp(cs[1], m.z, 0.5)], [m.x, m.z]], 1.0, f, { endYaw: m.yaw });
          S.holdTo(180, (s, I) => ({ pose: K.idle(I.t, seed, f.base) }));
        }
      }

      // ================= T2's crew =================
      // Two walk the capstan bars round with it (its angle from siegeworks when it publishes one), while the third
      // fetches a stone and lays it in the sling (SW t2.loads); one of the two pulls the trigger. They wind it again
      // (the second winding) and rest, until the Bull knights come down the meadow (107.8): then they run to the camp.
      {
        const fw = E2.face, cap = ENG.cap, R = ENG.capR, [rel] = t2Rel, shot = T.treb.find((q) => q.release === rel);
        const PUSH = { af0: 1.25, af1: 1.25, e0: 0.45, e1: 0.45, ao0: -0.05, ao1: -0.05, lean: 0.32, hx: -0.08 };
        const camp = [[13.6, 63.6], [17.2, 64.8], [20.6, 63.4]];
        const winds = ENG.t2Wind, loadT = pick(SW.t2, ['loads'], [rel - 2.5])[0];
        const capAt = (SW.t2 && SW.t2.capstanAngleAt) || ((ct) => { let a = 0; for (const [w0, w1] of winds) a += 1.5 * PI * smooth((ct - w0) / (w1 - w0)); return a; });
        // round the capstan with it: th = th0 + (its angle now - its angle at the start)
        const pushCap = (S, f, th0, w0, w1) => {
          const A0 = capAt(w0), sg = Math.sign(capAt(w1) - A0) || 1;
          return pushMove(S, w1 - w0, (s, out) => {
            const th = th0 + capAt(w0 + s) - A0;
            out[0] = cap[0] + R * Math.sin(th); out[1] = cap[1] + R * Math.cos(th);
            out[2] = sg > 0 ? Math.atan2(Math.cos(th), -Math.sin(th)) : Math.atan2(-Math.cos(th), Math.sin(th));
          }, footSet(f, PUSH, { vmax: 1.0 }));
        };
        const TH = [0, PI, PI / 2];
        for (let i = 0; i < 3; i++) {
          const e = eng[5 + i], f = e.f, seed = 21 + i * 1.3, th0 = TH[i];
          const sg0 = Math.sign(capAt(winds[0][1]) - capAt(winds[0][0])) || 1;
          const p0 = [cap[0] + R * Math.sin(th0), cap[1] + R * Math.cos(th0)];
          const yaw0 = sg0 > 0 ? Math.atan2(Math.cos(th0), -Math.sin(th0)) : Math.atan2(-Math.cos(th0), Math.sin(th0));
          const S = new K.Script(p0[0], p0[1], yaw0, 'eng' + (5 + i));
          e.S = S; e.morning = { x: p0[0], z: p0[1], yaw: yaw0 };
          const atBar = (s, I) => ({ pose: K.idle(I.t, seed, O(f.base, PUSH, { lean: 0.12 })) });
          const look = (s, I) => { const p = K.idle(I.t, seed, f.base); const k = win(I.ct, rel, rel + 3.6, 0.5); return { pose: addLook(p, S.x, S.z, S.yaw, shot.at[0], shot.at[2], k) }; };
          if (i < 2) {
            S.holdTo(winds[0][0], atBar);
            pushCap(S, f, th0, winds[0][0], winds[0][1]);
            const thEnd = th0 + capAt(winds[0][1]) - capAt(winds[0][0]), pBar = [S.x, S.z], yBar = S.yaw;
            if (i === 0) {
              // the trigger
              const tg = ENG.t2Trigger, axis = E2.w(-3.0, 0), yawT = yawTo(tg[0], tg[1], axis[0], axis[1]);
              S.walk([tg], 0.9, f, { endYaw: yawT });
              S.holdTo(rel - 0.15, (s, I) => ({ pose: P(O(f.base, EN.poses.haul, { lean: -0.05 })) }));
              S.hold(0.35, (s) => ({ pose: P(O(f.base, EN.poses.trigger)) }));
              S.holdTo(rel + 4.5, look);
              S.walk([pBar], 0.9, f, { endYaw: yBar });
            } else S.holdTo(rel + 4.5, (s, I) => O(look(s, I), { pose: O(look(s, I).pose, { af0: 1.0, af1: 1.0, e0: 0.5, e1: 0.5 }) }));
            if (winds[1]) {
              S.holdTo(winds[1][0], atBar);
              pushCap(S, f, thEnd, winds[1][0], winds[1][1]);
            }
          } else {
            // the loader: a stone from the pile, wait by the trough with it, into the sling at the load time, step back
            const pile = ENG.t2Pile, tr = ENG.t2Trough, nearPile = [lerp(p0[0], pile[0], 0.72), lerp(p0[1], pile[1], 0.72)];
            const nearTr = [tr[0] + (pile[0] - tr[0]) / hyp(pile[0] - tr[0], pile[1] - tr[1]) * 0.95, tr[1] + (pile[1] - tr[1]) / hyp(pile[0] - tr[0], pile[1] - tr[1]) * 0.95];
            S.holdTo(winds[0][0] - 2.6, atBar);
            S.walk([nearPile], 0.9, f, { endYaw: yawTo(nearPile[0], nearPile[1], pile[0], pile[1]) });
            S.holdTo(loadT - 6.2, (s, I) => ({ pose: addLook(K.idle(I.t, seed, f.base), nearPile[0], nearPile[1], S.yaw, cap[0], cap[1], 0.7) }));
            S.hold(1.0, (s) => ({ pose: P(O(f.base, EN.poses.lay, { lean: 0.6 })) }));
            S.hold(0.6, (s) => ({ pose: P(O(f.base, EN.poses.carry)) }));
            S.walk([[nearTr[0] + 0.9, lerp(nearPile[1], nearTr[1], 0.5)], nearTr], 0.8, f, { endYaw: yawTo(nearTr[0], nearTr[1], tr[0], tr[1]), base: () => EN.poses.carry });
            S.holdTo(loadT - 0.7, (s, I) => { const p = P(O(f.base, EN.poses.carry)); p.lean += 0.015 * Math.sin(I.t * 1.6); return { pose: p }; });
            S.hold(1.0, (s) => ({ pose: P(O(f.base, EN.poses.lay)) }));
            S.hold(0.5, (s) => ({ pose: P(O(f.base, { lean: 0.3, af0: 0.5, af1: 0.5 })) }));
            S.walk([[lerp(nearTr[0], pile[0], 0.6), lerp(nearTr[1], pile[1], 0.6)]], 1.0, f, { endYaw: fw });
            S.holdTo(rel + 4.5, look);
          }
          // rest where they are until the Bull knights come down the meadow
          const here = [S.x, S.z], hy = S.yaw;
          S.holdTo(T.lionMount - 0.6 + i * 0.25, (s, I) => ({ pose: addLook(K.idle(I.t, seed, f.base), here[0], here[1], hy, 40, 8, smooth((I.ct - 100) / 2) * 0.9) }));
          const cs = camp[i];
          S.walk([[lerp(here[0], cs[0], 0.5) - 0.8 + i * 0.6, lerp(here[1], cs[1], 0.5)], cs], 3.1, f.runner, { endYaw: -0.4 + i * 0.3 });
          S.holdTo(158 + i * 0.6, (s, I) => ({ pose: addLook(K.idle(I.t, seed, f.base), cs[0], cs[1], S.yaw, 24, 46, 0.7) }));
          S.walk([[lerp(cs[0], p0[0], 0.5) + 0.5, lerp(cs[1], p0[1], 0.5)], p0], 0.95, f, { endYaw: yaw0 });
          S.holdTo(180, atBar);
        }
      }

      // ================= the gunners =================
      {
        const shots = T.gunShots.filter((g) => g.side === 'lion');
        for (const g of gun) {
          const G = spots.LION_GUNS[g.gi], f = g.f, seed = 31 + g.gi;
          const SWG = (SW.lionGuns && SW.lionGuns[g.gi]) || {};
          const L = G.big ? 1.25 : 0.85, F = engFrame(G.x, G.z, G.face), fw = G.face;
          // his places: by the muzzle (to load and sponge), by the touch hole (to fire), a pile of balls by the muzzle,
          // and where he waits, behind the breech
          const muzzle = asXZ(SWG.loader, F.w(L + 0.35, 0.95)), touch = asXZ(SWG.gunner, F.w(-L + 0.25, 1.05)), pile = asXZ(SWG.balls, F.w(L - 0.2, 1.95));
          const ready = asXZ(SWG.ready, F.w(-L - 0.7, 1.5)), hole = F.w(-L + 0.35, 0), side = F.w(0, 1.2);
          const nearPile = [lerp(muzzle[0], pile[0], 0.55), lerp(muzzle[1], pile[1], 0.55)];
          const yawM = yawTo(muzzle[0], muzzle[1], ...F.w(L - 0.2, 0)), yawT = yawTo(touch[0], touch[1], hole[0], hole[1]);
          const S = new K.Script(ready[0], ready[1], fw, 'gunner' + g.gi);
          g.S = S; g.morning = { x: ready[0], z: ready[1], yaw: fw };
          const ts = shots.filter((q) => q.gun === g.gi).map((q) => q.t);
          const readyPose = (s, I) => ({ pose: addLook(K.idle(I.t, seed, O(f.base, GU.poses.ready)), S.x, S.z, S.yaw, -10, -11, 0.5) });
          const pumping = (base, dur) => (s) => { const p = P(O(f.base, base)); const k = Math.sin(s / dur * TAU * 2); p.lean += 0.1 * k; p.af0 += 0.08 * k; p.af1 += 0.08 * k; p.lf0 -= 0.06 * k; return { pose: p }; };
          const BEND = P(O(f.base, GU.poses.carry, { lean: 0.55, hx: 0.1, k0: 0.45, k1: 0.45 })), CARRY = P(O(f.base, GU.poses.carry));
          const IN = P(O(f.base, GU.poses.carry, { lean: 0.35, af0: 0.95, af1: 0.95, e0: 0.6, e1: 0.6 })), LETGO = P(O(f.base, { lean: 0.2, af0: 0.6, af1: 0.6, e0: 0.4, e1: 0.4 }));
          const TOUCH = P(O(f.base, GU.poses.touchOff));
          // a ball from the pile by the muzzle, into the bore, rammed home
          const load = (tRam) => {
            S.walk([nearPile], 1.0, f, { endYaw: yawTo(nearPile[0], nearPile[1], pile[0], pile[1]) });
            S.hold(0.9, (s) => ({ pose: K.mix(BEND, CARRY, smooth((s - 0.45) / 0.45)) }));
            S.walk([muzzle], 0.9, f, { endYaw: yawM, base: () => GU.poses.carry });
            S.hold(0.6, () => ({ pose: IN }));
            S.hold(0.35, () => ({ pose: LETGO }));
            S.hold(tRam, pumping(GU.poses.ram, tRam));
          };
          // round the gun's side to the touch hole, wait, touch off at t (the flash and the boom are the base's), turn
          // from the smoke
          const fire = (t) => {
            S.walk([side, touch], 1.25, f, { endYaw: yawT });
            S.holdTo(t - 0.75, (s, I) => ({ pose: K.idle(I.t, seed, O(f.base, { af0: 0.35, e0: 0.5 })) }));
            S.holdTo(t + 0.9, () => ({ pose: TOUCH }));
            S.hold(0.7, (s, I) => ({ pose: K.mix(TOUCH, K.idle(I.t, seed, O(f.base, { hy: -0.6 })), smooth(s / 0.7)) }));
          };
          const swab = (dur) => { S.walk([side, muzzle], 1.25, f, { endYaw: yawM }); S.hold(dur, pumping(GU.poses.sponge, dur)); };
          // the morning: ready by the gun; a look at the brazier and back
          S.holdTo(18 + g.gi, readyPose);
          S.walk([F.w(-L - 1.7, -0.6)], 0.8, f, { endYaw: fw + 2.4 });
          S.hold(3.0, (s, I) => ({ pose: K.idle(I.t, seed, O(f.base, { hx: 0.3, lean: 0.1 })) }));
          S.walk([ready], 0.8, f, { endYaw: fw });
          S.holdTo(ts[0] - 11.0, readyPose);
          load(1.6); fire(ts[0]);
          for (let i = 1; i < ts.length; i++) { swab(1.4); load(1.0); fire(ts[i]); }
          swab(2.4);
          if (ts.length === 1) load(1.4);
          S.walk([side, ready], 1.0, f, { endYaw: fw });
          S.holdTo(T.retreatCall + 1.2 + (g.gi - 3) * 0.5, readyPose);
          const cs = g.gi === 3 ? [-13.5, 55.5] : [-9.0, 56.2];
          S.walk([[lerp(S.x, cs[0], 0.5), lerp(S.z, cs[1], 0.5)], cs], 1.5, f, { endYaw: PI });
          S.holdTo(156.5 + (g.gi - 3), (s, I) => ({ pose: addLook(K.idle(I.t, seed, f.base), cs[0], cs[1], PI, -10, -11, 0.6) }));
          S.walk([[lerp(cs[0], ready[0], 0.5) + 0.4, lerp(cs[1], ready[1], 0.5)], ready], 1.2, f, { endYaw: fw });
          S.holdTo(180, readyPose);
          g.places = { muzzle, touch, pile, ready };
        }
      }

      // ================= the Lady of the Bull =================
      const LS = (CA && CA.lady) || { x: 0, y: SG.gatehouse.h, z: -7.35, face: 0 };
      {
        const f = lady.f, y = LS.y, seed = 3.3, x0 = LS.x, z0 = LS.z;
        const S = new K.Script(x0, z0, 0, 'lady');
        S.y = y; lady.S = S;
        const watch = (tx, tz, k) => (s, I) => ({ pose: addLook(LA.anim.watch(I.t, seed), x0, z0, 0, tx, tz, k === undefined ? 0.7 : k), y });
        const stand = (tx, tz, k) => (s, I) => ({ pose: addLook(LA.anim.stand(I.t, seed), S.x, S.z, S.yaw, tx, tz, k === undefined ? 0.7 : k), y });
        const t1 = SG.t1, t2 = SG.t2, B_ = SG.breach.point;
        S.holdTo(14, watch(0, 60, 0.3));
        S.holdTo(24, stand(t1[0], t1[1]));
        S.holdTo(31, (s, I) => ({ pose: startle(addLook(LA.anim.watch(I.t, seed), x0, z0, 0, -15, -3, smooth((I.ct - 26) / 1.5)), I.ct, 28.5), y }));
        S.walk([[x0 - 1.9 * 0.5, z0 - 0.15, y], [x0 - 1.9, z0, y]], 0.6, f, { endYaw: 0.25 });
        S.holdTo(41, (s, I) => ({ pose: addLook(LA.anim.stand(I.t, seed), S.x, S.z, S.yaw, -22, 30, 0.6), y }));
        S.holdTo(44.6, (s, I) => ({ pose: startle(addLook(LA.anim.stand(I.t, seed), S.x, S.z, S.yaw, 6.5, -11, smooth((I.ct - 41.2) / 1.2)), I.ct, 42.5), y }));
        S.walk([[x0 - 0.9, z0 - 0.15, y], [x0, z0, y]], 0.6, f, { endYaw: 0 });
        S.holdTo(56.5, watch(t2[0], t2[1], 0.5));
        // the stone strikes the south-west tower: she turns to it, a hand to her heart
        const HEART = { af1: 1.25, e1: 1.75, ao1: 0.05, at1: 0.9, hx: 0.05 };
        S.holdTo(63, (s, I) => { const p = LA.anim.stand(I.t, seed); mixKeys(p, P(O(LA.poses.stand, HEART)), win(I.ct, T.breakAt - 0.1, 62.5, 0.6), ARMS_HEAD); return { pose: addLook(p, x0, z0, 0, B_[0], B_[2], smooth((I.ct - 56.6) / 1.2) * (1 - smooth((I.ct - 61.5) / 1.4))), y }; });
        S.holdTo(86, watch(0, 30, 0.4));
        // the ram at the gate below: she looks down at it
        S.holdTo(95.6, (s, I) => { const p = LA.anim.stand(I.t, seed); p.hx += 0.38 * smooth((I.ct - 86) / 2); p.lean += 0.08 * smooth((I.ct - 86) / 2); return { pose: p, y }; });
        // the alarm: she turns to see the knights in the courtyard, then follows the sally round the east side
        S.walk([[x0 + 0.2, z0 - 0.6, y]], 0.5, f, { endYaw: PI });
        S.holdTo(101, stand(0, -40, 0.5));
        S.walk([[x0 + 0.1, z0 - 0.2, y], [x0, z0, y]], 0.5, f, { endYaw: 0.7 });
        S.holdTo(116, (s, I) => ({ pose: addLook(LA.anim.watch(I.t, seed), x0, z0, 0.7, 42, -10 + (I.ct - 104) * 4, 0.9), y }));
        S.holdTo(141.5, (s, I) => ({ pose: addLook(LA.anim.watch(I.t, seed), x0, z0, 0.7, 40, 32, 0.6), y }));
        // the triumph: arms raised, twice, between the trumpets
        const triumph = (s, I) => ({ pose: LA.anim.triumph(I.t, seed), y });
        S.holdTo(147.6, triumph);
        S.holdTo(149.2, stand(30, 40, 0.4));
        S.holdTo(155.0, triumph);
        S.walk([[x0, z0 - 0.4, y], [x0, z0, y]], 0.4, f, { endYaw: 0 });
        S.holdTo(180, (s, I) => ({ pose: LA.anim.stand(I.t, seed), y }));
        lady.spot = LS;
      }

      // ================= the trumpeter =================
      {
        const f = trump.f, seed = 5.1, y = (CA && CA.gatehouseTopY) || SG.gatehouse.h;
        const front = (CA && CA.crenels.find((c) => c.where === 'gatehouse' && Math.abs(c.x - 1.9) < 0.1 && c.face === 0)) || { x: 1.9, z: -7.35 };
        const back = (CA && CA.crenels.find((c) => c.where === 'gatehouse' && Math.abs(c.x - 2.1) < 0.1 && Math.abs(c.face) > 3)) || { x: 2.1, z: -12.45 };
        const fz = front.z - 0.1, bz = back.z + 0.15, yawF = 0.45;
        const S = new K.Script(front.x, fz, yawF, 'trumpeter');
        S.y = y; trump.S = S;
        const stand = (tx, tz, k) => (s, I) => ({ pose: addLook(TR.anim.stand(I.t, seed), S.x, S.z, S.yaw, tx, tz, k === undefined ? 0.5 : k), y });
        const sound = (dur) => (s) => ({ pose: TR.anim.sound(s / dur, seed), y });
        const B_ = SG.breach.point;
        S.holdTo(56.5, stand(0, 40, 0.3));
        S.holdTo(62, (s, I) => ({ pose: addLook(TR.anim.stand(I.t, seed), S.x, S.z, S.yaw, B_[0], B_[2], smooth((I.ct - 56.8) / 1.2)), y }));
        S.holdTo(92.0, stand(0, 2, 0.4));
        // to the north parapet, to sound the sally over the courtyard
        S.walk([[front.x + 0.15, lerp(fz, bz, 0.5), y], [back.x, bz, y]], 0.9, f, { endYaw: PI - 0.35 });
        const tSally = T.sallyCall;
        S.holdTo(tSally - 0.24 * 4.0 - 0.05, stand(0, -36, 0.6));
        S.hold(4.0, sound(4.0));
        S.holdTo(103.5, (s, I) => ({ pose: addLook(TR.anim.stand(I.t, seed), S.x, S.z, S.yaw, 0, -66 + (I.ct - 99) * 6, 0.8), y }));
        S.walk([[back.x - 0.1, lerp(bz, fz, 0.5), y], [front.x, fz, y]], 0.9, f, { endYaw: yawF + 0.2 });
        S.holdTo(142.0, (s, I) => ({ pose: addLook(TR.anim.stand(I.t, seed), S.x, S.z, S.yaw, 40, 30, 0.6), y }));
        for (const tc of [143, 148.5, 154]) {
          S.holdTo(tc - 0.96 - 0.02, (s, I) => ({ pose: K.mix(TR.anim.cheer(I.t, seed), TR.anim.stand(I.t, seed), smooth((s - 0.6) / 0.6)), y }));
          S.hold(4.0, sound(4.0));
        }
        S.holdTo(159.5, (s, I) => ({ pose: K.mix(TR.anim.cheer(I.t, seed), TR.anim.stand(I.t, seed), smooth((s - 1.0) / 0.8)), y }));
        S.holdTo(180, stand(0, 40, 0.2));
        trump.sx = front.x; trump.sz = fz; trump.y = y;
      }

      // ================= the damsel =================
      {
        const f = damsel.f, seed = 6.7, yW = DS.y, yS = yW + STEP, x0 = DS.x, z0 = DS.z + 0.06, zw = -12.45;
        const S = new K.Script(x0, z0, 0, 'damsel');
        S.y = yS; damsel.S = S;
        const at = (fn) => (s, I) => O(fn(s, I), { y: yS });
        const stand = (tx, tz, k) => at((s, I) => ({ pose: addLook(DA.anim.stand(I.t, seed), x0, z0, 0, tx, tz, k === undefined ? 0.6 : k) }));
        const carry = () => DA.poses.carry;
        const trip = (tStart) => {
          S.holdTo(tStart, stand(0, 40, 0.3));
          S.walk([[x0 + 0.15, zw + 0.05, yW], [8.7, zw, yW]], 0.85, f, { endYaw: PI / 2 + 0.3 });
          S.hold(1.3, (s) => ({ pose: K.mix(P(O(DA.poses.stand, { lean: 0.55, hx: 0.25, af0: 0.6, af1: 0.6, e0: 0.4, e1: 0.4 })), P(DA.poses.carry), smooth((s - 0.7) / 0.6)), y: yW }));
          S.walk([[7.8, zw + 0.1, yW], [6.9, -12.15, yW]], 0.7, f, { endYaw: -0.25, base: carry, tag: undefined });
          S.hold(1.2, (s) => ({ pose: K.mix(P(DA.poses.carry), P(O(DA.poses.stand, { lean: 0.5, hx: 0.3, af0: 0.7, af1: 0.7, e0: 0.5, e1: 0.5 })), smooth(s / 0.7)), y: yW }));
          S.walk([[x0 - 0.15, z0 - 0.1, yS], [x0, z0, yS]], 0.7, f, { endYaw: 0 });
        };
        trip(6.0);
        trip(15.5);
        S.holdTo(26.2, stand(0, 40, 0.3));
        S.holdTo(41.8, at((s, I) => ({ pose: addLook(DA.anim.stand(I.t, seed), x0, z0, 0, -15, -3, win(I.ct, 26.3, 31, 0.8)) })));
        // the T2 stone strikes the wall just below her: a start, then (at 45) the wipe, as at Dunbar
        S.holdTo(T.damselWipe, at((s, I) => ({ pose: startle(DA.anim.stand(I.t, seed), I.ct, 42.5) })));
        S.hold(5.2, at((s) => ({ pose: DA.anim.wipe(s / 5.2, seed) })));
        S.holdTo(56.5, stand(SG.t2[0], SG.t2[1], 0.5));
        S.holdTo(63, at((s, I) => ({ pose: addLook(DA.anim.stand(I.t, seed), x0, z0, 0, SG.breach.point[0], SG.breach.point[2], smooth((I.ct - 56.7) / 1.0) * (1 - smooth((I.ct - 61.8) / 1.2))) })));
        trip(70.0);
        S.holdTo(95.6, stand(0, 2, 0.6));
        S.holdTo(100, at((s, I) => ({ pose: addLook(DA.anim.stand(I.t, seed), x0, z0, 0, 0, -30, 0.7) })));
        S.holdTo(141.5, at((s, I) => ({ pose: addLook(DA.anim.stand(I.t, seed), x0, z0, 0, 40, -10 + Math.min(40, (I.ct - 100) * 3), 0.9) })));
        // the triumph: the towel waved high
        const flourish = (s, I) => { const p = P(DA.poses.flourish); p.ao1 += 0.35 * Math.sin(I.t * 7); p.e1 += 0.3 * Math.sin(I.t * 7 + 0.8); return p; };
        S.holdTo(147, at((s, I) => ({ pose: K.mix(DA.anim.stand(I.t, seed), flourish(s, I), win(s, 0, 5.5, 0.6)) })));
        S.holdTo(149, stand(30, 40, 0.4));
        S.holdTo(154.5, at((s, I) => ({ pose: K.mix(DA.anim.stand(I.t, seed), flourish(s, I), win(s, 0, 5.5, 0.6)) })));
        S.holdTo(180, stand(0, 40, 0.2));
        damsel.spot = { x: x0, z: z0, y: yS };
      }

      // ================= register everything =================
      for (const e of eng) all.push({ f: e.f, S: e.S, kind: 'engineer', seed: e.f.seed });
      for (const g of gun) all.push({ f: g.f, S: g.S, kind: 'gunner', seed: g.f.seed });
      all.push({ f: lady.f, S: lady.S, kind: 'lady', seed: 3.3 }, { f: damsel.f, S: damsel.S, kind: 'damsel', seed: 6.7 }, { f: trump.f, S: trump.S, kind: 'trumpeter', seed: 5.1 });
      for (const a of all) {
        if (Math.abs(a.S.T - 180) > 0.01) console.warn('people: ' + a.S.name + ' fills ' + a.S.T.toFixed(2) + ' s, not 180');
        a.tapAt = -1e9;
        a.shadow = ctx.blob(a.kind === 'horse' ? a.f.shadowR * 0.95 : a.f.shadowR || 0.3);
        a.head = new THREE.Vector3();
        a.I = { t: 0, ct: 0, n: 0 };
        a.isKnight = a.kind === 'bullKnight' || a.kind === 'lionKnight';
        if (a.kind === 'horse') a.f.__a = a;
      }
      // labels and taps
      const headOf = (a) => () => {
        const nd = a.f.head;
        nd.getWorldPosition(a.head);
        a.head.y += a.kind === 'horse' ? 0.2 : 0.18;
        return a.head;
      };
      for (const a of all) {
        const key = a.kind;
        ctx.tag(key, headOf(a), { onTap: (now) => {
          a.tapAt = now;
          if (a.kind === 'trumpeter') { const p = a.f.root.position; ctx.sound.play('trumpet', p.x, p.y + 1.6, p.z, { call: 'tap' }); }
        } });
      }
      this.lady = lady; this.damsel = damsel; this.trump = trump; this.eng = eng; this.gun = gun;
      this.tmpV = new THREE.Vector3();
      this.tmpQ = new THREE.Quaternion();
      this.mloc = { x: 0, y: 0, z: 0, yaw: 0 };
      this.mountLocal = mountLocal;
      this.rootParent = { bull: rigB.root, lion: rigL.root };
      this.ready = true;

      // ================= checks (window.__people) =================
      const self = this;
      window.__people = {
        self,
        state(name, t) { const a = all.find((q) => q.S.name === name); return a && a.S.sample(t, { t, ct: t, n: 0 }); },
        // every pair of figures on the ground that come closer than they should, over the cycle
        check(step) {
          step = step || 0.1;
          const out = [], worst = {};
          const R = (a) => (a.kind === 'horse' ? 0.75 : 0.32);
          for (let t = 0; t < 180; t += step) {
            const pts = [];
            for (const a of all) {
              const st = a.S.sample(t, { t, ct: t, n: 0 }), tg = st.tag || {};
              if (tg.m === 'ride' || tg.m === 'mount' || tg.m === 'gone' || st.hide) continue;
              if (a.f.root && (tg.out !== undefined && t > tg.out + 1.4)) continue;
              if (tg.in !== undefined && t < tg.in) continue;
              let x = st.x, z = st.z;
              if (tg.m === 'fallRide' || tg.m === 'fallFoot') {
                const fl = tg.fall || { x: st.x, z: st.z, yaw: st.yaw, yawEnd: st.yaw, v: 0 };
                const s2 = t - (tg.t0 !== undefined ? tg.t0 : fl.t0);
                if (s2 < 0) continue;
                const yawE = fl.yawEnd !== undefined ? fl.yawEnd : st.yaw;
                // the body lies from the feet back along -yaw: sample its middle
                const fx = tg.m === 'fallRide' ? fl.x + (fl.sx || 0) * 1.0 * smooth(s2 / 0.8) + Math.sin(fl.yaw) * fl.v * (1 - Math.exp(-2.2 * s2)) / 2.2 : st.x;
                const fz = tg.m === 'fallRide' ? fl.z + (fl.sz || 0) * 1.0 * smooth(s2 / 0.8) + Math.cos(fl.yaw) * fl.v * (1 - Math.exp(-2.2 * s2)) / 2.2 : st.z;
                x = fx - Math.sin(yawE) * 0.9; z = fz - Math.cos(yawE) * 0.9;
                pts.push({ a, x, z, r: 0.75, down: true });
                continue;
              }
              if (a.kind === 'horse') {
                // a horse as two circles along its body
                pts.push({ a, x: x + Math.sin(st.yaw) * 0.55, z: z + Math.cos(st.yaw) * 0.55, r: 0.6 }, { a, x: x - Math.sin(st.yaw) * 0.45, z: z - Math.cos(st.yaw) * 0.45, r: 0.6 });
              } else pts.push({ a, x, z, r: R(a) });
            }
            for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
              const p = pts[i], q = pts[j];
              if (p.a === q.a) continue;
              const d = hyp(p.x - q.x, p.z - q.z), lim = p.r + q.r;
              if (d < lim) {
                const key = p.a.S.name + ' / ' + q.a.S.name;
                const w = worst[key];
                if (!w || d - lim < w.over) worst[key] = { over: +(d - lim).toFixed(2), t: +t.toFixed(1), from: w ? w.from : +t.toFixed(1) };
              }
            }
          }
          for (const k in worst) out.push(k + ': ' + JSON.stringify(worst[k]));
          return out;
        },
      };
    },

    update(t, dt, ctx) {
      if (!this.ready) return;
      const ct = ctx.cycle.t, n = ctx.cycle.n, K = ctx.figureKit, M = window.Motion, P = K.P;
      const KA = window.CHARACTERS.bullKnight.anim, KP = window.CHARACTERS.bullKnight.poses, HA = window.CHARACTERS.horse.anim;
      const EN = window.CHARACTERS.engineer, GU = window.CHARACTERS.gunner, LA = window.CHARACTERS.lady, DA = window.CHARACTERS.damsel, TR = window.CHARACTERS.trumpeter;
      const LIE_PITCH = -(Math.PI / 2 - 0.04), RIDE_ROOT = window.CHARACTERS.bullKnight.ride.rootY;
      const ml = this.mloc, v = this.tmpV;
      // the horses first (the riders sit on them)
      for (let pass = 0; pass < 2; pass++) for (const a of this.all) {
        const isHorse = a.kind === 'horse';
        if ((pass === 0) !== isHorse) continue;
        const I = a.I; I.t = t; I.ct = ct; I.n = n;
        const st = a.S.sample(ct, I), tg = st.tag || {}, f = a.f;
        a.st = st;
        // a tap moment laid over the timeline
        const ts = t - a.tapAt;
        let scale = 1;
        if (tg.out !== undefined) scale *= 1 - smooth((ct - tg.out) / 1.4);
        if (tg.in !== undefined) scale *= ct < tg.in ? 0 : smooth((ct - tg.in) / 1.6);
        if (tg.m === 'gone') scale = 0;
        if (isHorse) {
          if (ts < 3.2) {
            const u = clamp(ts / 3.0, 0, 1);
            if ((st.v || 0) < 0.3) st.pose = HA.tap(u, a.seed, st.pose);
            else { const q = HA.toss(clamp(ts / 1.6, 0, 1), a.seed, st.pose); st.pose = q; }
          }
          f.set(st);
          a.v = st.v || 0;
        } else if (a.isKnight) {
          const kn = a.knight, mode = tg.m || 'foot';
          if (tg.lance) f.gear({ lance: tg.lance, sword: tg.sword });
          let pose = st.pose;
          // the salute: the left hand up to the visor (never when down)
          if (ts < 3.2 && mode !== 'fallFoot' && mode !== 'fallRide' && mode !== 'mount') pose = KA.salute(clamp(ts / 3.0, 0, 1), pose);
          const parentOf = kn.h ? kn.h : null;
          if (mode === 'ride') {
            const h = kn.h;
            if (f.root.parent !== h.seat) h.seat.add(f.root);
            f.root.position.set(0, RIDE_ROOT - 1.35, 0);
            f.root.rotation.set(0, 0, 0);
            f.root.scale.setScalar(1);
            // the faster the horse, the further forward he leans; and he rises a little in the stirrups
            const hv = h.__a ? h.__a.v : 0, g = smooth((hv - 3) / 9);
            pose = Object.assign({}, pose);
            pose.lean += 0.14 * g; pose.hx -= 0.1 * g;
            f.pose(f.follow(pose));
          } else if (mode === 'mount') {
            const h = tg.horse;
            if (f.root.parent !== h.root) h.root.add(f.root);
            this.mountLocal(tg.u, ml);
            f.root.position.set(ml.x, ml.y, ml.z);
            f.root.rotation.set(0, ml.yaw, 0);
            f.root.scale.setScalar(1);
            f.pose(f.follow(pose));
          } else if (mode === 'fallRide') {
            const fl = tg.fall, s = ct - fl.t0, home = this.rootParent[a.kind === 'bullKnight' ? 'bull' : 'lion'];
            if (f.root.parent !== home) home.add(f.root);
            const fa = KA.fall(Math.min(s, 9), KP.ride);
            const drift = fl.v * (1 - Math.exp(-2.2 * s)) / 2.2, sd = 1.0 * smooth(s / 0.8);
            const x = fl.x + Math.sin(fl.yaw) * drift + (fl.sx || 0) * sd, z = fl.z + Math.cos(fl.yaw) * drift + (fl.sz || 0) * sd;
            // (he drops off the saddle as he tips, accelerating to the ground in 0.45 s, never hanging in the air)
            const gy = ctx.surfaceY(x, z), drop = s < 0.45 ? 1 - (s / 0.45) * (s / 0.45) : 0;
            f.root.position.set(x, gy + RIDE_ROOT * drop + fa.lift * (1 - drop), z);
            f.root.rotation.set(fa.pitch, fl.yaw + (fl.yawEnd - fl.yaw) * smooth(s / 0.5), 0);
            f.root.scale.setScalar(1);
            f.pose(f.follow(fa.pose));
          } else {
            const home = this.rootParent[a.kind === 'bullKnight' ? 'bull' : 'lion'];
            if (f.root.parent !== home) home.add(f.root);
            if (mode === 'fallFoot') {
              const fa = KA.fall(Math.min(ct - tg.t0, 9), KP.stand);
              st.pitch = fa.pitch; st.lift = fa.lift;
            }
            st.pose = pose;
            f.set(st);
          }
          void parentOf;
          // eyes: blink; closed once down
          const down = mode === 'fallFoot' || mode === 'fallRide' ? smooth((ct - (tg.t0 !== undefined ? tg.t0 : tg.fall.t0) - 0.6) / 0.6) : 0;
          f.eyes.scale.y = Math.max(0.08, M.blink(t, a.seed) * (1 - down) + 0.08 * down);
        } else {
          // the crews, the gunners and the castle's people
          if (ts < 5) {
            let q = null, w = 0;
            if (a.kind === 'engineer') { q = EN.moment(f, ts); w = 1; }
            else if (a.kind === 'gunner') { q = GU.moment(f, ts); w = 1; }
            else if (a.kind === 'lady') { q = LA.anim.wave(clamp(ts / 3.5, 0, 1), a.seed, st.pose); w = 1; }
            else if (a.kind === 'trumpeter') { q = TR.anim.sound(clamp(ts / 4, 0, 1), a.seed, st.pose); w = 1; }
            else if (a.kind === 'damsel') { q = DA.anim.wipe(clamp(ts / 5, 0, 1), a.seed); w = 1; }
            if (q) {
              const keys = a.kind === 'damsel' || a.kind === 'lady' || a.kind === 'trumpeter' ? ['lean', 'twist', 'roll', 'hx', 'hy', 'hz', 'af0', 'af1', 'ao0', 'ao1', 'at0', 'at1', 'e0', 'e1']
                : ['hx', 'hy', 'hz', 'af0', 'af1', 'ao0', 'ao1', 'at0', 'at1', 'e0', 'e1'];
              const p = Object.assign({}, st.pose);
              for (const k of keys) p[k] = q[k];
              st.pose = p;
            }
          }
          f.set(st);
          f.eyes.scale.y = M.blink(t, a.seed);
        }
        if (scale < 1) f.root.scale.setScalar(Math.max(1e-4, scale * f.root.scale.x));
        // shadows: under each horse and each figure on its feet; a longer one under anyone lying down
        const mode = tg.m;
        if (scale < 0.02 || mode === 'ride' || mode === 'mount') a.shadow.hide();
        else {
          f.root.getWorldPosition(v);
          if (mode === 'fallFoot' || mode === 'fallRide') {
            const yaw = f.root.rotation.y, k = smooth((ct - (tg.t0 !== undefined ? tg.t0 : tg.fall.t0)) / 0.9);
            const x = v.x - Math.sin(yaw) * 0.85 * k, z = v.z - Math.cos(yaw) * 0.85 * k;
            a.shadow.set(x, ctx.surfaceY(x, z), z, (1 + 0.9 * k) * scale);
          } else {
            const gy = st.y !== undefined && st.y !== null ? st.y : ctx.surfaceY(v.x, v.z);
            a.shadow.set(v.x, gy, v.z, scale);
          }
        }
      }
    },
  });
})();
