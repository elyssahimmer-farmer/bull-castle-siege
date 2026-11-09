// armies.js: the massed soldiers of the siege (DESIGN §6, §9; decisions 5, 8, 12, 14, 15; research §4c, §4d, §6c, §6e).
// Everyone is a token from the approved characters (CHARACTERS.siegeSoldier, token: true), on three rigs (three draws):
//   Lion archers (16): muster behind the gun line at dawn, walk out through the gaps between the guns to the pavises
//     12-27, plant a sheaf of arrows, then shoot at every Lion volley (SIEGE.times.volleys: nock, draw high, loose exactly
//     at the volley's t) and crouch behind the pavises as the Bull arrows land; at the retreat call they run.
//   Bull archers (12) on the south curtain and the two south corner towers: duck as the Lion arrows land, rise, nock,
//     draw level and loose at every Bull volley; the two on the south-west tower's breaking parapet step back before the
//     stone hits (58) and move to the merlons that are left; they cheer 142-158.
//   Lion spearmen (12): stand by the camp, march out as a shield wall 97-121, brace with spears levelled, raise them as
//     the Bulls close, and push (shuffling steps, heaving) until 138; five fall over stiffly like toy soldiers.
//   Bull spearmen (10): wait in the courtyard by the postern, run out of it behind the knights at 101.2, round the north
//     and east sides along SIEGE.sally (a fast run: the way is 150 m) and lock shields with the Lions (~127); three fall.
//     At 138 they chase west along the gap between the walls and south through the pavises, stop, walk back and cheer.
//   Gunners: three Lion tokens at the guns people.js doesn't man (ctx.people.lionGuns if it says, else 2 and 4 are
//     its), five Bull tokens at spots.BULL_GUNS; each rams, touches off at its SIEGE.times.gunShots time, flinches, sponges.
//   The ram crew (6) go in under the shed's eaves at the Lion trumpet, push it along SIEGE.ramPath 68-88, swing the log
//     on every blow 88.6-98.6, flinch at the roof stones, and bolt out of the back at 99.2, running to the camp unhurt.
//   The retreat (138-): every Lion still standing runs along a five-lane corridor past the camp's front, up through its
//     east side and along the road toward the south-east hill; a scheduler spaces the runners in each lane. They stop on
//     the road by 163.5, go into the night mist (hidden from 164.4) and are at their morning places by 172.
//   The fallen lie on their backs, shields over their chests, eyes closed, until the full mist (165-169).
// Gunners and the ram crew are soldier tokens in other colours (gunner.js and engineer.js have no token build): the
// spear token without its shield, its spear as the rammer-sponge, recoloured to gunner.js's blue and buff (Lion) or red
// and white (Bull) with the helmet in a cap colour; the ram crew are Lion spear tokens with empty hands.
// Every figure is driven by a FigureKit.Script that fills the cycle exactly (0 = 180). Published for the other files:
// ctx.armies = { lionLoose, bullLoose (bow positions at the loose), ramDist(t), lionGunsManned, wall, posts, corridor }.
// Tags: lionArchers, bullArchers, lionSpears, bullSpears, gunner. Taps: an archer plants a sheaf of arrows; a spearman
// lifts his shield in a cheer (only while he is idle; otherwise the label shows and nothing moves).
(function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const SM = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const hsh = (a, b) => { const h = Math.sin(a * 127.1 + (b || 0) * 311.7 + 0.37) * 43758.5453; return h - Math.floor(h); };
  const win = (s, a, b, e) => SM((s - a) / e) * (1 - SM((s - (b - e)) / e));

  // ---------- polylines [[x, z], ...] ----------
  const plen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
  // round every inner corner with a short curve (cut at most `cut` metres back along each side)
  function round(pts, cut) {
    if (pts.length < 3) return pts.map((q) => q.slice());
    const out = [pts[0].slice()];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const c1 = Math.min(cut, l1 * 0.45), c2 = Math.min(cut, l2 * 0.45);
      const p = [b[0] + (a[0] - b[0]) * c1 / l1, b[1] + (a[1] - b[1]) * c1 / l1], q = [b[0] + (c[0] - b[0]) * c2 / l2, b[1] + (c[1] - b[1]) * c2 / l2];
      for (let k = 0; k <= 4; k++) { const u = k / 4, v = 1 - u; out.push([v * v * p[0] + 2 * u * v * b[0] + u * u * q[0], v * v * p[1] + 2 * u * v * b[1] + u * u * q[1]]); }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }
  // a parallel line `o` metres to the left of travel (the left of a walker facing along it)
  function offset(pts, o) {
    return pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      return [q[0] + dz / L * o, q[1] - dx / L * o];
    });
  }
  // the first `len` metres of a polyline
  function cutTo(pts, len) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l >= len) { out.push([a[0] + (b[0] - a[0]) * len / l, a[1] + (b[1] - a[1]) * len / l]); return out; }
      out.push(b); len -= l;
    }
    return out;
  }
  const yawTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);

  window.Scene.register({
    name: 'armies',
    init(ctx) {
      const K = ctx.figureKit, B = ctx.Blocky, kit = ctx.kit, CH = window.CHARACTERS || {}, SS = CH.siegeSoldier;
      if (!SS) { console.warn('armies: no siegeSoldier character'); return; }
      const S0 = ctx.SIEGE, T = S0.times, spots = ctx.spots, sY = ctx.surfaceY;
      const P = K.P, mix = K.mix, AR = SS.poses.archer, SP = SS.poses.spear;
      const figs = [];
      this.figs = figs;
      this.I = { t: 0, ct: 0, n: 0 };

      // ---------- the ram's way (siegeworks.js moves the shed; this is where its centre is, metres along ramPath) ----------
      const RAM = T.ram, ramL = S0.lengths.ramPath, RAMV = ramL / (RAM.arrive - RAM.leave - 2.4);
      const ramDistOwn = (t) => {
        const s = t - RAM.leave, D = RAM.arrive - RAM.leave;
        if (s <= 0) return 0;
        if (s >= D) return ramL;
        if (s < 2.4) return 0.5 * RAMV * s * s / 2.4;
        if (s > D - 2.4) { const r = D - s; return ramL - 0.5 * RAMV * r * r / 2.4; }
        return RAMV * (s - 1.2);
      };
      const ramDist = (t) => (ctx.siege && ctx.siege.ram && typeof ctx.siege.ram.dist === 'function' ? ctx.siege.ram.dist(t) : ramDistOwn(t));
      const ramAt = { x: 0, z: 0, yaw: 0 };
      const ramPos = (t) => ctx.routeAt(S0.ramPath, ramDist(t), ramAt);

      // ---------- figures ----------
      const rigL = kit.makeRig(), rigB = kit.makeRig(), rigS = kit.makeRig();
      const mkSoldier = (rig, side, role, v) => SS.make(ctx, B, kit, rig, { side, role, v, token: true });
      // a worker token: the spear token without its shield; recoloured for a gunner (its spear the rammer-sponge) or
      // left as a Lion soldier with empty hands (the ram crew)
      const GUNC = {
        lion: { top: 0xc9b282, apron: 0x7a5232, sleeve: 0x2f4f9a, cap: 0x23396e, capRim: 0x1c2e58, hose: 0x5e5048, pole: 0x9a7a52, sponge: 0xe4dac2 },
        bull: { top: 0xefe9dc, apron: 0xefe9dc, sleeve: 0xb5322a, cap: 0x9a2a24, capRim: 0x7a201c, hose: 0x6e5a44, pole: 0x9a7a52, sponge: 0xe4dac2 },
      };
      function mkWorker(rig, side, kind, v) {
        const f = mkSoldier(rig, side, 'spear', v);
        const pcs = rig.pieces, a = f.range[0];
        let si = -1;
        for (let i = a; i < pcs.length; i++) if (pcs[i].color.getHex() === SS.COL.spear) { si = i; break; }
        if (si >= 0) {
          // the shield is everything after the spear's shaft and head
          pcs.splice(si + 2, pcs.length - (si + 2));
          if (kind === 'crew') pcs.splice(si, 2);
          f.range[1] = pcs.length;
        }
        if (kind === 'gunner') {
          const G = GUNC[side];
          for (let i = a; i < pcs.length; i++) {
            const pc = pcs[i], h = pc.color.getHex();
            if (h === SS.COL.mail) pc.color.setHex(pc.nd === f.torso ? G.top : pc.nd === f.skirt ? G.apron : G.sleeve);
            else if (h === SS.COL.steel) pc.color.setHex(pc.nd === f.head ? G.cap : G.sponge);
            else if (h === SS.COL.steelShade) pc.color.setHex(G.capRim);
            else if (h === SS.COL.spear) pc.color.setHex(G.pole);
            else if (h === SS.COL.wraps) pc.color.setHex(G.hose);
          }
        }
        return f;
      }
      // a sheaf of arrows stuck in the ground: five shafts and a ring of fletchings (a pivot of its own, moved and
      // scaled each frame)
      function sheafProp(rig, seed) {
        const nd = rig.node(null, 0, 0, 0), V = (x, y, z) => new THREE.Vector3(x, y, z);
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26 + seed, r = 0.035, tx = Math.cos(a) * 0.1, tz = Math.sin(a) * 0.1;
          rig.limb(nd, V(Math.cos(a) * r, -0.04, Math.sin(a) * r), V(tx, 0.62, tz), 0.012, 0.012, SS.COL.shaft, 3, true);
        }
        rig.piece(nd, new THREE.CylinderGeometry(0.13, 0.09, 0.13, 5, 1, true), SS.COL.fletch, 0, 0.56, 0);
        return nd;
      }

      // ---------- shared poses ----------
      const PZ = (f, o, o2) => P(Object.assign({}, f.base, o || {}, o2 || {}));
      const idle = (f, t, o) => K.idle(t, f.seed, o ? Object.assign({}, f.base, o) : f.base);
      const look = (p, x, z, yaw, tx, tz, k) => { p.hy += (k === undefined ? 0.8 : k) * K.lookYaw(x, z, yaw, tx, tz, 1.1); return p; };
      const at = (y, o) => { o.y = y; return o; };
      // out of breath after the run: hands on the knees, the back heaving
      const blown = (f, t, i) => PZ(f, { lean: 0.5, af0: 0.55, af1: 0.55, e0: 0.25, e1: 0.25, ao0: 0.2, ao1: 0.2, k0: 0.3, k1: 0.3, hx: -0.3, y: 0.012 * Math.sin(t * 6 + i) });

      // a record per figure: f, its Script, a shadow, what it is, when it's busy (no tap moment), and its extras
      function rec(f, S, o) {
        const g = Object.assign({ f, S, busy: [], hidden: false, tapAt: -99, y: null }, o);
        g.shadow = ctx.blob(f.shadowR * 0.95);
        figs.push(g);
        return g;
      }
      const busyAt = (g, ct) => { for (const [a, b] of g.busy) if (ct >= a && ct <= b) return true; return false; };

      // ===================================================================================================================
      // THE RETREAT CORRIDOR: past the camp's front, up through its east side and along the road toward the hill, in five
      // lanes (metres to the left of travel). Each runner joins a lane from where he is; the scheduler at the end spaces
      // the runners in each lane at least GAP seconds apart and cuts every run short of the night mist.
      const COR = round([[0.6, 26], [1.8, 38], [5.5, 48.5], [12, 53.5], [19, 57.4], [21.6, 64], [23.4, 70], [30, 72.8], [44, 74.6], [70, 80.6], [96, 87.2]], 3.2);
      const RUN = 3.3, GAP = 0.8, HIDE0 = T.mistFull[0] + 0.4, STOP = T.mistFull[0] - 0.5;
      const runner = (f, stride, extra) => ({ stride, gait: (ph, amt) => f.gait(ph, amt, Object.assign({ run: 1 }, extra || {})) });
      const retreat = [], later = [];
      let lionGone = T.retreatCall + 1;

      // ===================================================================================================================
      // LION ARCHERS
      const pav = spots.PAVISES;
      const LA_SLOT = [[0, 0], [1, -1], [1, 1], [2, -1], [2, 1], [3, -1], [3, 1], [4, -0.55], [5, 0.55], [6, -1], [6, 1], [7, -1], [7, 1], [8, -1], [8, 1], [9, 0]];
      const LA_MUSTER = [[-20.2, 35.4], [-18.4, 36.4], [-19.6, 37.9],
        [-12.2, 33.8], [-10.4, 34.6], [-8.6, 33.8], [-11.4, 36.0], [-9.4, 36.4],
        [6.2, 33.4], [7.6, 35.2], [9.2, 33.6], [10.8, 35.4], [12.4, 33.4], [14.0, 35.2], [15.6, 33.4], [17.4, 35.0]];
      const GAP_A = -18.75, GAP_B = -10.25;
      const lionVolleys = T.volleys.filter((v) => v.side === 'lion').map((v) => v.t);
      const bullVolleys = T.volleys.filter((v) => v.side === 'bull').map((v) => v.t);
      const lionLoose = [];
      LA_SLOT.forEach(([pi, sd], i) => {
        const p = pav[pi], x = p.x + sd * 0.55, z = p.z + 1.15, face = p.face;
        const f = mkSoldier(rigL, 'lion', 'archer', i % 4);
        const sheaf = sheafProp(rigL, i * 0.7);
        const [mx, mz] = LA_MUSTER[i], myaw = PI + 0.3 * (hsh(i, 2) - 0.5);
        const S = new K.Script(mx, mz, myaw, 'lionArcher' + i);
        // walking out: single file through the gaps in the gun line (gap A for the three westmost, gap B for the next
        // five), straight for the eight east of the way
        let path, start;
        if (i < 3) { start = 11.0 + 0.8 * i; path = [[GAP_A, 32.8], [GAP_A, 28.6], [x, z + 2.4], [x, z]]; }
        else if (i < 8) { start = 11.0 + 0.8 * (i - 3); path = [[GAP_B, 32.4], [GAP_B, 28.6], [x, z + 2.4], [x, z]]; }
        else { start = 12.0 + 0.5 * hsh(i, 5); path = [[x, z + 2.4], [x, z]]; }
        const busy = [];
        S.holdTo(start, (s, I) => ({ pose: idle(f, I.t) }));
        const w0 = S.T;
        S.walk(path, i < 8 ? 1.65 : 1.5, f, { endYaw: face });
        busy.push([w0 - 0.3, S.T]);
        S.hold(0.3, (s, I) => ({ pose: idle(f, I.t) }));
        // plant the sheaf: a hand to the bag, then bend and push it into the ground at the front foot
        const plantT = S.T;
        S.hold(2.2, (s) => {
          const reach = PZ(f, { af1: -0.35, e1: 0.7, ao1: 0.3, hx: 0.15, hy: -0.3 }), bend = PZ(f, AR.plant);
          const p2 = s < 0.6 ? mix(PZ(f), reach, SM(s / 0.5)) : s < 1.4 ? mix(reach, bend, SM((s - 0.6) / 0.6)) : mix(bend, PZ(f), SM((s - 1.5) / 0.7));
          return { pose: p2 };
        });
        busy.push([plantT, S.T]);
        // the volleys: nock, draw high, loose at exactly t; crouch behind the pavise as the Bull arrows land
        const shoot = (s) => {
          const u = s - 1.4, nock = PZ(f, AR.nock), draw = PZ(f, AR.drawHigh), loose = PZ(f, AR.looseHigh);
          if (u < -0.75) return { pose: nock };
          if (u < 0) return { pose: mix(nock, draw, SM((u + 0.75) / 0.55)) };
          if (u < 0.5) return { pose: mix(draw, loose, SM(u / 0.07)) };
          return { pose: mix(loose, PZ(f), SM((u - 0.5) / 0.85)) };
        };
        lionVolleys.forEach((L, k) => {
          if (k > 0) {
            S.holdTo(L - 2.7, (s, I) => ({ pose: idle(f, I.t) }));
            S.hold(1.3, (s, I) => ({ pose: PZ(f, AR.duck, { hy: 0.1 * Math.sin(I.t * 0.9 + i) }) }));
            busy.push([L - 2.9, L - 1.4]);
          } else S.holdTo(L - 1.4, (s, I) => ({ pose: idle(f, I.t) }));
          S.hold(2.8, shoot);
          busy.push([L - 1.6, L + 1.5]);
        });
        lionLoose.push([x, p.y + 1.95, z - 0.45]);
        // after the volleys: watching the ram go by and the fight in the meadow; at the retreat call, off east behind
        // the pavises (the west half) or south (the east half) into the corridor
        const t0 = T.retreatCall + 0.25 + (i < 8 ? 0.1 * (7 - i) : 0.15 + 0.45 * (i - 8));
        const hideAt = HIDE0 + 0.12 * i;
        retreat.push({ S, f, t0, lane: i < 8 ? (i % 2 ? -2.5 : -1.25) : (i < 12 ? 0 : 1.25),
          head: i < 8 ? [[x + 0.6, z + 2.4], [-1.4, z + 3.6]] : [[x - 0.2, z + 2.6]],
          wait: (s, I) => {
            const p2 = idle(f, I.t);
            if (I.ct < T.ram.cave + 2) { const r = ramPos(I.ct); look(p2, x, z, face, r.x, r.z, 0.7); }
            else if (I.ct > 103) look(p2, x, z, face, 30, 16, 0.8);
            return { pose: p2 };
          },
          after: () => {
            S.holdTo(hideAt, (s, I) => ({ pose: mix(blown(f, I.t, i), idle(f, I.t), SM((s - 3) / 2)) }));
            S.x = mx; S.z = mz; S.yaw = myaw;
            S.holdTo(171 + 0.1 * i, () => ({ hide: true, pose: PZ(f) }));
            S.holdTo(180, (s, I) => ({ pose: idle(f, I.t) }));
          } });
        busy.push([T.retreatCall - 0.5, 180]);
        const g = rec(f, S, { kind: 'lionArcher', tag: 'lionArchers', busy, sheaf, plantT, hideAt });
        g.sheafAt = (ct) => (ct > plantT + 1.25 && ct < hideAt ? 1 : 0);
        g.handSheaf = (ct) => (ct > plantT + 0.35 && ct < plantT + 1.3 ? 1 : 0);
        g.sheafPos = [x + Math.sin(face) * 0.5 + Math.cos(face) * 0.12, z + Math.cos(face) * 0.5 - Math.sin(face) * 0.12];
      });

      // ===================================================================================================================
      // BULL ARCHERS on the south curtain (wall-walk y 10) and the south corner towers (y 14)
      const CW = S0.curtain.h, TW = S0.towerH, wz = S0.curtain.zS - 0.25;
      const towerPt = (c, r, a) => [c[0] + Math.sin(a) * r, c[1] + Math.cos(a) * r];
      const SW = S0.towers.SW, SE = S0.towers.SE;
      const BA = [
        // the west stretch of the curtain: three archers at its crenels either side of Bull gun 1 (x -11.5); the fourth
        // stands on the far, north-west side of the south-west tower, clear of the breach
        { p: [-13.0, wz], y: CW, yaw: 0 }, { p: towerPt(SW, 3.4, -2.45), y: TW, yaw: -0.9 }, { p: [-9.4, wz], y: CW, yaw: 0 }, { p: [-7.3, wz], y: CW, yaw: 0 },
        // (the east stretch of the curtain is the damsel's, with her stones, and Bull gun 4's: these two stand on the
        // south-east tower's east side instead, looking out over the meadow)
        { p: towerPt(SE, 3.4, 1.65), y: TW, yaw: 0.45 }, { p: towerPt(SE, 3.4, 2.3), y: TW, yaw: 0.85 },
        { p: towerPt(SE, 3.4, -0.3), y: TW, yaw: -0.18 }, { p: towerPt(SE, 3.4, 0.35), y: TW, yaw: 0.2 }, { p: towerPt(SE, 3.4, 1.0), y: TW, yaw: 0.6 },
        // the south-west tower: two on the parapet that breaks (they step back, then move round), one on its west side
        // (they leave the parapet before the stone, skipping the 55.8 volley, for the tower's far side, 5 to 7 m from the
        // burst; once the dust has settled they go round to the merlons that are left, one after the other)
        { p: towerPt(SW, 3.4, -0.45), y: TW, yaw: -0.27, breach: towerPt(SW, 3.4, -1.0), back: towerPt(SW, 2.6, -2.2), byaw: -0.6, go: 59.6 },
        { p: towerPt(SW, 3.4, 0.2), y: TW, yaw: 0.12, breach: towerPt(SW, 3.4, -1.75), back: towerPt(SW, 2.6, PI), byaw: -1.05, go: 62.0 },
        { p: towerPt(SW, 3.4, -1.35), y: TW, yaw: -0.81 },
      ];
      const bullLoose = [];
      const cheerWins = [[142.3, 145.8], [146.4, 149.8], [150.4, 153.8], [154.4, 157.6]];
      // cheering: an archer lifts his bow high; anyone with a spear or a pole lifts the other arm (or his shield) high and
      // pumps the spear upright, its arm kept low (a raised spear arm would level the spear)
      const cheerPose = (f, t, i, kind) => {
        const pump = Math.sin(t * 5.2 + i * 1.7);
        if (kind === 'archer') return PZ(f, AR.cheer, { af0: AR.cheer.af0 + 0.18 * pump, af1: AR.cheer.af1 + 0.2 * pump, e1: AR.cheer.e1 + 0.15 * pump, y: 0.03 * Math.max(0, pump), lean: -0.06 });
        return PZ(f, { af0: 2.4 + 0.15 * pump, e0: 0.45, at0: 0.25, ao0: 0.32, af1: 0.5 + 0.12 * pump, e1: 0.9 - 0.2 * pump, ao1: 0.15, hx: -0.3, lean: -0.06, y: 0.03 * Math.max(0, pump) });
      };
      BA.forEach((d, i) => {
        const f = mkSoldier(rigB, 'bull', 'archer', (i + 1) % 4), [x0, z0] = d.p, y = d.y;
        const S = new K.Script(x0, z0, d.yaw, 'bullArcher' + i);
        const busy = [];
        const sid = i * 0.37;
        const lookField = (p2, x, z, yaw, ct) => {
          if (ct > 86 && ct < 101) look(p2, x, z, yaw, 0, 2, 0.5);
          else if (ct > 101 && ct < 140) look(p2, x, z, yaw, 30, 14, 0.8);
          return p2;
        };
        const idleW = (x, z, yaw) => (s, I) => at(y, { pose: lookField(idle(f, I.t), x, z, yaw, I.ct) });
        // shooting from the wall: up from the crouch, nock, draw level, loose at exactly B
        const shootB = (s) => {
          const u = s - 1.6, nock = PZ(f, AR.nock), draw = PZ(f, AR.drawLevel), loose = PZ(f, AR.looseLevel);
          let p2;
          if (u < -0.8) p2 = nock;
          else if (u < 0) p2 = mix(nock, draw, SM((u + 0.8) / 0.6));
          else if (u < 0.5) p2 = mix(draw, loose, SM(u / 0.07));
          else p2 = mix(loose, PZ(f), SM((u - 0.5) / 0.7));
          return at(y, { pose: p2 });
        };
        let cx = x0, cz = z0, cyaw = d.yaw;
        lionVolleys.forEach((L, k) => {
          const Bt = bullVolleys[k];
          if (d.breach && L === 59) {
            // after the breach: round to the merlons that are left, crouching as the next arrows come
            S.holdTo(d.go, idleW(cx, cz, cyaw));
            const w0 = S.T;
            S.walk([[d.breach[0], d.breach[1], y]], 1.5, f, { endYaw: d.byaw });
            cx = d.breach[0]; cz = d.breach[1]; cyaw = d.byaw;
            busy.push([w0, S.T]);
            S.holdTo(Math.max(S.T + 0.6, L + 2.2), () => at(y, { pose: PZ(f, AR.duck) }));
          } else {
            // duck as the Lion arrows come (they land at L + 1.4)
            S.holdTo(L + 0.5, idleW(cx, cz, cyaw));
            S.hold(1.7, (s, I) => at(y, { pose: PZ(f, AR.duck, { hy: 0.15 * Math.sin(I.t * 1.1 + sid) }) }));
            busy.push([L + 0.3, L + 2.2]);
          }
          if (Bt === undefined) return;
          // (the two who had to move off the broken parapet are still finding their feet for the volley after it)
          if (d.breach && Bt > 62 && Bt < 63) return;
          S.holdTo(Bt - 1.6, idleW(cx, cz, cyaw));
          // the stone at 58: the two on the parapet that breaks leave it before the 55.8 volley, hurrying to the far
          // side of the tower, and cower there as it bursts
          if (d.breach && Bt > 55 && Bt < 56) {
            const w0 = S.T, byaw = yawTo(d.back[0], d.back[1], S0.breach.point[0], S0.breach.point[2]);
            S.walk([[d.back[0], d.back[1], y]], 2.2, f, { endYaw: byaw });
            busy.push([w0, 61.5]);
            S.holdTo(T.breakAt - 0.1, idleW(d.back[0], d.back[1], byaw));
            S.hold(1.6, (s) => at(y, { pose: mix(PZ(f, AR.duck, { af1: 1.9, e1: 1.8, ao1: 0.5, hx: 0.3 }), PZ(f), SM((s - 1.0) / 0.6)) }));
            cx = d.back[0]; cz = d.back[1]; cyaw = byaw;
            return;
          }
          S.hold(2.9, shootB);
          busy.push([Bt - 1.7, Bt + 1.3]);
          if (k === 0) bullLoose.push([x0 + Math.sin(d.yaw) * 0.5, y + 1.6, z0 + Math.cos(d.yaw) * 0.5]);
        });
        // after the arrows: watching the ram, the sally and the fight; then the cheering
        S.holdTo(cheerWins[0][0] + 0.2 * hsh(i, 3), idleW(cx, cz, cyaw));
        cheerWins.forEach(([a, b], k) => {
          if ((i + k) % 4 === 3) return;     // everyone rests one cheer in four
          S.holdTo(Math.max(S.T, a + 0.25 * hsh(i, k)), idleW(cx, cz, cyaw));
          S.holdTo(b - 0.2 * hsh(k, i), (s, I) => at(y, { pose: cheerPose(f, I.t, i, 'archer') }));
        });
        busy.push([142, 158]);
        // the night: watching from the walls; the two from the broken parapet go back to their places once it's mended
        if (d.breach) {
          S.holdTo(173.6 + 0.6 * (i - 9), idleW(cx, cz, cyaw));
          const w0 = S.T;
          S.walk([[(cx + x0) / 2 + 0.6, (cz + z0) / 2 - 0.9, y], [x0, z0, y]], 1.3, f, { endYaw: d.yaw });
          busy.push([w0, S.T]);
          cx = x0; cz = z0; cyaw = d.yaw;
        }
        S.holdTo(180, idleW(cx, cz, cyaw));
        rec(f, S, { kind: 'bullArcher', tag: 'bullArchers', busy, y });
      });

      // ===================================================================================================================
      // THE SHIELD WALLS: the Lion wall faces north at z 12.6 (front) and 14.2 (second rank); the Bull wall faces south at
      // 11.4 and 9.8. Between them the push: c(t) moves both lines together in shuffling steps (+z: the Lions give ground).
      const WX = 25.75, LZ1 = 12.6, LZ2 = 14.2, BZ1 = 11.4, BZ2 = 9.8, SPC = 1.25;
      // The Bull spearmen's run (worked out first: the walls lock when the last of them arrives). Two files, five rows;
      // the front rank is the left-hand file all the way round (south in the courtyard, west on the postern bridge,
      // south at the end), and each file's leader goes to the far (west) end of its rank.
      const SALLY_TO = S0.sally.slice(0, 8);        // the postern ... (42, -6)
      const BSTART = 104.4, BSPEED = 7.2;          // (out once the last of the knights' horses is into the postern, 104.0)
      const bullRun = [];
      for (let i = 0; i < 10; i++) {
        const file = i < 5 ? 0 : 1, row = i % 5, lat = file ? -0.62 : 0.62;
        const sl = { x: WX + (row - 2) * SPC + file * SPC / 2, z: file ? BZ2 : BZ1 };
        const line = offset(round([[0, -42.6]].concat(SALLY_TO, [[39.4, 3.2], [35.4, 6.6], [31.5, 7.4]]), 2.6), lat);
        const mx = 3.4 + row * 1.25 + file * 0.5, mz = -39.1 - file * 1.5 + (row % 2) * 0.3, myaw = -PI / 2 - 0.3 + 0.4 * hsh(i, 2);
        const court = file ? [[2.4, -41.3], [0.56, -42.4]] : [[2.0, -39.9], [-0.56, -41.9]];
        const lz = line[line.length - 1][1];
        // each file turns off its own running line straight into its place (the leaders the farthest), so nobody
        // crosses the other rank
        const path = court.concat(line.slice(1), [[sl.x + 0.35, lz], [sl.x, sl.z]]);
        const go = BSTART + row * 0.25 + file * 0.1;
        bullRun.push({ file, row, lat, sl, mx, mz, myaw, path, go, len: plen([[mx, mz]].concat(path)) });
      }
      // both files of a row take the same time (the inside of the turns is shorter), at the front rank's pace
      for (const b of bullRun) {
        const front = bullRun[b.row], dur = front.len / BSPEED;
        b.go = front.go + (b.file ? 0.1 : 0);
        b.speed = b.len / dur; b.arrive = b.go + 0.6 + dur;
      }
      const CONTACT = Math.max(...bullRun.map((b) => b.arrive)) + 0.2, SPEARS_UP = Math.min(...bullRun.map((b) => b.arrive)) - 4.0;
      const PUSH = [];   // [time, dz] steps of the contact line
      { const seq = [0.2, 0.15, -0.13, 0.16, 0.12, -0.11, 0.14, 0.1, -0.1, 0.1];
        seq.forEach((dz, k) => PUSH.push([CONTACT + 0.5 + k * 0.95 + 0.2 * Math.sin(k * 2.1), dz])); }
      const pushC = (ct) => { let c = 0; for (const [t0, dz] of PUSH) c += dz * SM((ct - t0) / 0.42); return c; };
      // the leg lifted in a shuffling step (which leg alternates), 0..1
      const shuffle = (ct, i) => {
        for (let k = 0; k < PUSH.length; k++) { const u = (ct - PUSH[k][0] - 0.03 * (i % 4)) / 0.42; if (u > 0 && u < 1) return [Math.sin(u * PI), (k + i) % 2, Math.sign(PUSH[k][1])]; }
        return null;
      };
      const heave = (ct, i) => 0.5 + 0.5 * Math.sin((ct - CONTACT) * 2.6 + i * 0.7);
      // the falls: Lion indices 0-5 front, 6-11 second; Bull indices 0-4 front, 5-9 second. Only the men at the ends of
      // the walls fall, and each turns a quarter as he staggers and topples outward, off the end of his line (OUT: -1
      // west, +1 east), so every fallen man lies clear of the ranks (never under anyone's feet) and the middle of both
      // walls stays open for the Lions' retreat and the Bulls' chase.
      const F0 = CONTACT + 1.5;
      const LS_FALL = { 0: F0, 5: F0 + 1.5, 6: F0 + 3.0, 11: F0 + 4.5 };
      const LS_OUT = { 0: -1, 6: -1, 5: 1, 11: 1 };
      const LS_STEPUP = {};
      const BS_FALL = { 5: F0 + 0.7, 9: F0 + 3.6 };      // the Bulls' rear-rank end men, so no two bodies lie within 1.8 m
      const BS_OUT = { 5: -1, 9: 1 };
      // the turn that makes a man facing `yaw` fall with his body toward the west (out -1) or the east (+1)
      const outBias = (yaw, out) => Math.atan2(Math.sin(-out * PI / 2 - yaw), Math.cos(-out * PI / 2 - yaw));
      const posts = { lion: [], bull: [] };

      // braced and pushing, as a function of the cycle time: shield square, leaning in, the spear upright in the right
      // hand once the walls touch (never pointed at anyone), the legs shuffling as the line gives or gains ground
      function wallPose(f, ct, i, side, levelled) {
        const h = heave(ct, i), lean = side === 'lion' ? -1 : 1;
        const p = mix(PZ(f, SP.brace), PZ(f, SP.push), ct < CONTACT ? 0 : 0.35 + 0.5 * h);
        if (!levelled) { p.af1 = 0.42; p.e1 = 0.95; p.ao1 = 0.1; p.at1 = 0; }
        const sh = shuffle(ct, i);
        if (sh) {
          const [k, leg, dir] = sh, gaining = dir * lean > 0, key = leg ? 1 : 0;
          p['k' + key] += 0.7 * k; p['lf' + key] += (gaining ? 0.25 : -0.2) * k;
        }
        return p;
      }
      // the toy-soldier fall: a stagger back, then over stiffly on the back, the shield over the chest; then still
      const LIE = (() => { const o = Object.assign({}, SP.lie); delete o.pitch; delete o.lift; return o; })();
      function fallSteps(S, f, tf, x, z, yaw, hideAt, ybias) {
        // the stagger goes the way he'll fall: back from where he ends up facing
        const back = [-Math.sin(yaw + ybias) * 0.5, -Math.cos(yaw + ybias) * 0.5];
        S.hold(0.7, (s) => {
          const k = SM(s / 0.7), st = Math.sin(k * PI);
          return { x: x + back[0] * k, z: z + back[1] * k, yaw: yaw + ybias * k,
            pose: PZ(f, { lean: -0.2 * k, af0: 0.5 + 0.4 * st, e0: 1.3, at0: 1.0, af1: 0.6 + 0.5 * st, e1: 0.5, ao1: 0.4 * st, lf0: -0.25 * st, k0: 0.4 * st, lf1: 0.1 * st, hx: -0.25 * k }) };
        });
        const fx = x + back[0], fz = z + back[1], fyaw = yaw + ybias;
        S.hold(1.25, (s) => { const q = SS.fall(s / 1.25); return { x: fx, z: fz, yaw: fyaw, pitch: q.pitch, lift: q.lift, pose: PZ(f, LIE) }; });
        S.holdTo(hideAt, () => { const q = SS.fall(1); return { x: fx, z: fz, yaw: fyaw, pitch: q.pitch, lift: q.lift, pose: PZ(f, LIE) }; });
        return { fx, fz, fyaw, lieAt: tf + 1.7 };
      }

      // ===================================================================================================================
      // LION SPEARMEN: the formation marches out of the camp to the wall line, along a path west of the knights' lines
      const LFORM = round([[12, 50.2], [13.6, 40], [19.4, 30], [WX, 23.5], [WX, LZ1]], 3.5);
      const lionSpearSlots = [];
      for (let k = 0; k < 6; k++) lionSpearSlots.push({ lat: (k - 2.5) * SPC, row: 0 });
      for (let k = 0; k < 6; k++) lionSpearSlots.push({ lat: (k - 2.5) * SPC - SPC / 2, row: 1 });
      const LMARCH = 97.6, LSPEED_T = 23.5;
      lionSpearSlots.forEach((sl, i) => {
        const f = mkSoldier(rigS, 'lion', 'spear', (i + 2) % 4);
        // facing north, left of travel is west: lateral `lat` (east positive) is offset -lat
        const line = offset(LFORM, -sl.lat);
        const end = line[line.length - 1], st0 = line[0], back = sl.row ? LZ2 - LZ1 : 0;
        const pts = line.slice(1).map((q) => q.slice());
        pts[pts.length - 1] = [end[0], end[1] + back];
        const start = [st0[0], st0[1] + back];
        // morning: standing about by the camp's front in a loose crowd, a little apart from where they'll form up
        const mx = start[0] + sl.lat * 0.6 + (hsh(i, 1) - 0.5) * 0.5, mz = start[1] + 2.2 + sl.row * 0.4 + (hsh(i, 4) - 0.5) * 0.5;
        const myaw = PI + (hsh(i, 6) - 0.5) * 1.6;
        const S = new K.Script(mx, mz, myaw, 'lionSpear' + i);
        const busy = [[LMARCH - 2.6, 180]];
        S.holdTo(LMARCH - 2.4 + 0.25 * hsh(i, 2), (s, I) => {
          const p2 = idle(f, I.t);
          if (I.ct > 66 && I.ct < 70) look(p2, mx, mz, myaw, 0, 66, 0.6);
          if (I.ct > 94 && I.ct < 99) look(p2, mx, mz, myaw, 0, -30, 0.6);
          return { pose: p2 };
        });
        S.walk([start], 1.3, f, { endYaw: PI });
        S.holdTo(LMARCH + 1.4, () => ({ pose: PZ(f, SP.march) }));
        S.walk(pts, plen([start].concat(pts)) / LSPEED_T, f, { endYaw: PI, base: () => SP.march });
        const sx = pts[pts.length - 1][0], sz = pts[pts.length - 1][1];
        // braced, spears levelled at the empty field, until the Bulls come near; then spears up and the push
        const wallHold = (zb) => (s, I) => ({ x: sx, z: zb + pushC(I.ct), yaw: PI, pose: wallPose(f, I.ct, i, 'lion', I.ct < SPEARS_UP) });
        let zb = sz;
        const tf = LS_FALL[i], up = LS_STEPUP[i];
        if (up) {
          S.holdTo(up, wallHold(zb));
          const z0 = zb;
          S.hold(0.9, (s, I) => { const k = SM(s / 0.9), p2 = wallPose(f, I.ct, i, 'lion', false); p2.lf0 += 0.3 * Math.sin(k * PI); p2.k0 += 0.5 * Math.sin(k * PI);
            return { x: sx, z: z0 - (LZ2 - LZ1) * k + pushC(I.ct), yaw: PI, pose: p2 }; });
          zb -= LZ2 - LZ1;
        }
        if (tf) {
          S.holdTo(tf, wallHold(zb));
          const hideAt = 165 + 0.4 * i, r = fallSteps(S, f, tf, sx, zb + pushC(tf), PI, hideAt, outBias(PI, LS_OUT[i]));
          posts.lion.push({ i, fallen: true, x: r.fx, z: r.fz });
          S.x = mx; S.z = mz; S.yaw = myaw;
          S.holdTo(172 + 0.1 * i, () => ({ hide: true, pose: PZ(f) }));
          S.holdTo(180, (s, I) => ({ pose: idle(f, I.t) }));
          rec(f, S, { kind: 'lionSpear', tag: 'lionSpears', busy, lieAt: r.lieAt, hideAt });
          return;
        }
        posts.lion.push({ i, x: sx, z: zb });
        // the break: turn and run, between the fallen beside them, south-west past the archers and into the corridor
        const t0 = T.retreatCall + 0.1 + 0.15 * (i % 6) + (sl.row ? 0.5 : 0), z1 = zb + pushC(t0);
        const hideAt = HIDE0 + 2 + 0.12 * i;
        retreat.push({ S, f, t0, lane: 2.5, wait: wallHold(zb), spear: true,
          head: [[sx, z1 + 2.8], [lerp(sx, 20.5, 0.5), 22], [18.6, 30], [13, 42]],
          after: () => {
            S.holdTo(hideAt, (s, I) => ({ pose: mix(blown(f, I.t, i), idle(f, I.t), SM((s - 3) / 2)) }));
            S.x = mx; S.z = mz; S.yaw = myaw;
            S.holdTo(172 + 0.1 * i, () => ({ hide: true, pose: PZ(f) }));
            S.holdTo(180, (s, I) => ({ pose: idle(f, I.t) }));
          } });
        rec(f, S, { kind: 'lionSpear', tag: 'lionSpears', busy, hideAt });
      });

      // ===================================================================================================================
      // BULL SPEARMEN: out of the postern behind the knights, a fast run round the north and east along SIEGE.sally,
      // then west along the moat's south bank to their places facing the Lion wall
      const survivors = bullRun.map((b, i) => i).filter((i) => !BS_FALL[i]).sort((a, b) => (bullRun[a].file - bullRun[b].file) || (bullRun[a].sl.x - bullRun[b].sl.x));   // front rank first
      bullRun.forEach((b, i) => {
        const f = mkSoldier(rigS, 'bull', 'spear', (i + 3) % 4);
        const { sl, mx, mz, myaw, path, go, arrive, file, row } = b;
        const S = new K.Script(mx, mz, myaw, 'bullSpear' + i);
        const busy = [[go - 1, 160], [168, 180]];
        S.holdTo(go - 0.6, (s, I) => {
          const p2 = idle(f, I.t);
          if (I.ct > 96 && I.ct < 101) look(p2, mx, mz, myaw, 0, -46, 0.7);
          return { pose: p2 };
        });
        S.hold(0.6, () => ({ pose: PZ(f, SP.march, { lean: 0.15 }) }));
        S.walk(path, b.speed, runner(f, 1.49, { af1: 0.4, e1: 1.0 }), { endYaw: 0 });
        // shields up and spears raised (never pointed at anyone) as they lock with the Lions
        const tf = BS_FALL[i];
        const wallHold = (s, I) => ({ x: sl.x, z: sl.z + pushC(I.ct), yaw: 0, pose: wallPose(f, I.ct, i, 'bull', false) });
        // home at night: in through the postern under its vault, to the morning places in the courtyard (the far ones
        // first)
        const home = () => {
          const k = (4 - row) * 2 + file, ex = 0.6 * (file ? 1 : -1);
          S.x = mx; S.z = mz; S.yaw = myaw;
          S.holdTo(167.8 + 0.55 * k, () => ({ hide: true, pose: PZ(f) }));
          S.x = ex; S.z = -47.5; S.yaw = PI;
          S.walk([[ex, -42.4], [mx, mz]], 1.5, f, { endYaw: myaw });
          S.holdTo(180, (s, I) => ({ pose: idle(f, I.t) }));
        };
        if (tf) {
          S.holdTo(tf, wallHold);
          const hideAt = 165.2 + 0.3 * i, r = fallSteps(S, f, tf, sl.x, sl.z + pushC(tf), 0, hideAt, outBias(0, BS_OUT[i]));
          posts.bull.push({ i, fallen: true, x: r.fx, z: r.fz });
          home();
          rec(f, S, { kind: 'bullSpear', tag: 'bullSpears', busy, lieAt: r.lieAt, hideAt, arrive });
          return;
        }
        // the chase, one after another from the west end: forward into the gap between the walls, west along it (clear
        // of the fallen on both sides), south through the pavises and on toward the camp
        const ord = survivors.indexOf(i), hideAt = HIDE0 + 0.7 + 0.15 * i;
        posts.bull.push({ i, x: sl.x, z: sl.z });
        later.push(() => {
        const chase0 = lionGone + 0.6 + 0.45 * ord;
        S.holdTo(chase0, wallHold);
        const zl = 12.0 + pushC(chase0) * 0.5, cx = clamp(sl.x, 24.4 + 0.25 * (ord % 3), 27.0 - 0.25 * (ord % 3));
        const chaseEnd = [21.2 + ord * 0.9, 34 - ord * 0.8];
        const cheerAt = [14.5 + ord * 1.4, 22.6 + (ord % 2) * 1.3];
        // forward into the gap, then south through the middle of the Lions' emptied places (the fallen lie off both ends)
        S.walk([[sl.x, zl], [cx, 13.6], [cx, 17.6], [17.8, 21.5], chaseEnd], 3.6, runner(f, 1.1, { af1: 0.4, e1: 1.0 }), { endYaw: 0.3 });
        S.hold(2.6, (s, I) => ({ pose: cheerPose(f, I.t, i, 'spear') }));
        // walk back and cheer toward the castle
        S.walk([cheerAt], 1.25, f, { endYaw: PI });
        cheerWins.forEach(([a, bb], k) => {
          if (bb < S.T + 0.5 || (i + k) % 3 === 2) return;
          S.holdTo(Math.max(S.T, a + 0.3 * hsh(i, k)), (s, I) => ({ pose: idle(f, I.t) }));
          S.holdTo(bb - 0.2 * hsh(k, i), (s, I) => ({ pose: cheerPose(f, I.t, i, 'spear') }));
        });
        S.holdTo(hideAt, (s, I) => ({ pose: idle(f, I.t) }));
        home();
        });
        busy.push([140, 158.5]);
        rec(f, S, { kind: 'bullSpear', tag: 'bullSpears', busy, arrive, hideAt });
      });

      // ===================================================================================================================
      // GUNNERS: tokens at the Lion guns people.js doesn't man, and at all five Bull guns
      const manned = (ctx.people && ctx.people.lionGuns) || [2, 4];
      const lionGunsMine = [0, 1, 2, 3, 4].filter((k) => !manned.includes(k));
      const GL = { big: 3.6, small: 2.2 };
      const gunPose = {
        ram: (f, s) => PZ(f, { af1: 1.45 + 0.18 * Math.sin(s * 3.2), e1: 0.9 - 0.4 * Math.sin(s * 3.2), ao1: 0.15, af0: 1.1, e0: 0.9, at0: 0.4, ao0: -0.05, lean: 0.18 + 0.1 * Math.sin(s * 3.2) }),
        sponge: (f, s) => PZ(f, { af1: 1.45 + 0.14 * Math.sin(s * 4.1), e1: 0.85 - 0.3 * Math.sin(s * 4.1), ao1: 0.15 + 0.1 * Math.sin(s * 8.2), af0: 1.1, e0: 0.9, at0: 0.4, lean: 0.16, twist: 0.12 * Math.sin(s * 8.2) }),
        touch: (f, k) => PZ(f, { af0: 0.3 + 0.75 * k, e0: 0.5, ao0: 0.05 - 0.15 * k, lean: 0.28 * k, hx: 0.25 * k, af1: 0.25, e1: 0.5 }),
        // (the pole arm stays low, so the pole stays upright: a raised pole arm levels it)
        flinch: (f, s) => PZ(f, { af0: 2.1, e0: 2.4, ao0: 0.5, af1: 0.3, e1: 0.9, ao1: 0.25, lean: -0.14 + 0.06 * Math.sin(s * 3), twist: 0.25, hy: 0.6, hx: 0.25, k0: 0.25, k1: 0.25 }),
      };
      function gunnerScript(f, side, i, G, shots, wall, W) {
        const fwd = [Math.sin(G.face), Math.cos(G.face)], right = [-Math.cos(G.face), Math.sin(G.face)];
        const len = wall ? 1.2 : G.big ? GL.big : GL.small;
        // standing beside the breech (field) or just behind the gun (walls); loading in front of the muzzle (field) or
        // over the gun (walls). In the field, the working places siegeworks.js publishes for its own gun (W: by the touch
        // hole, and the loader's place by the muzzle behind the shutter), the same ones people.js's gunners use.
        const ready = wall ? [G.x - fwd[0] * 0.8, G.z - fwd[1] * 0.8] : W ? [W.gunner.x, W.gunner.z] : [G.x + right[0] * 1.05 - fwd[0] * len * 0.3, G.z + right[1] * 1.05 - fwd[1] * len * 0.3];
        const muzzle = W ? [W.muzzle.x, W.muzzle.z] : [G.x + fwd[0] * len / 2, G.z + fwd[1] * len / 2];
        const load = wall ? ready : W ? [W.loader.x, W.loader.z] : [muzzle[0] + fwd[0] * 1.0 + right[0] * 0.8, muzzle[1] + fwd[1] * 1.0 + right[1] * 0.8];
        const loadYaw = wall ? G.face : yawTo(load[0], load[1], muzzle[0], muzzle[1]);
        const Yo = (o) => { if (wall) o.y = G.y; return o; };
        const S = new K.Script(ready[0], ready[1], G.face, side + 'Gunner' + i);
        const busy = [];
        const stand = (s, I) => Yo({ pose: idle(f, I.t) });
        const goTo = (p, yaw) => {
          if (wall) { S.hold(0.6, (s, I) => Yo({ yaw, pose: idle(f, I.t) })); return; }
          S.walk([p], 1.2, f, { endYaw: yaw });
        };
        for (const Tt of shots) {
          S.holdTo(Tt - 13.5, stand);
          busy.push([Tt - 13.6, Tt + 11]);
          goTo(load, loadYaw);
          S.holdTo(Tt - 7.0, (s) => Yo({ yaw: loadYaw, pose: gunPose.ram(f, s) }));
          goTo(ready, G.face);
          S.holdTo(Tt - 1.0, (s, I) => Yo({ pose: look(idle(f, I.t), ready[0], ready[1], G.face, G.x + fwd[0] * 30, G.z + fwd[1] * 30, 0.3) }));
          S.hold(1.0, (s) => Yo({ pose: gunPose.touch(f, SM(s / 0.8)) }));
          S.hold(1.5, (s) => Yo({ pose: gunPose.flinch(f, s) }));
          S.hold(1.2, (s, I) => Yo({ pose: idle(f, I.t) }));
          goTo(load, loadYaw);
          S.hold(4.5, (s) => Yo({ yaw: loadYaw, pose: gunPose.sponge(f, s) }));
          goTo(ready, G.face);
        }
        return { S, busy, ready, Yo, stand };
      }
      const gunTag = { lion: 'gunner', bull: 'bullGunner' };   // labels.js keys
      lionGunsMine.forEach((gi, i) => {
        const G = spots.LION_GUNS[gi], f = mkWorker(rigL, 'lion', 'gunner', 1 + 2 * (i % 2));
        const shots = T.gunShots.filter((s) => s.side === 'lion' && s.gun === gi).map((s) => s.t);
        const { S, busy, ready } = gunnerScript(f, 'lion', i, G, shots, false, ctx.siege && ctx.siege.lionGuns && ctx.siege.lionGuns[gi]);
        // the retreat: they stay by their guns a moment, then run south past the trebuchet and east along the camp's
        // front into the corridor
        const hideAt = HIDE0 + 3 + 0.3 * i;
        retreat.push({ S, f, t0: T.retreatCall + 3.5 + 0.8 * i, lane: -2.5,
          head: [[ready[0] + 0.5, 50.5 - 1.1 * i], [-2, 51.6 - 1.1 * i]],
          wait: (s, I) => ({ pose: look(idle(f, I.t), ready[0], ready[1], G.face, 30, 18, 0.8) }),
          after: () => {
            S.holdTo(hideAt, (s, I) => ({ pose: mix(blown(f, I.t, i), idle(f, I.t), SM((s - 3) / 2)) }));
            S.x = ready[0]; S.z = ready[1]; S.yaw = G.face;
            S.holdTo(172.5 + 0.2 * i, () => ({ hide: true, pose: PZ(f) }));
            S.holdTo(180, (s, I) => ({ pose: idle(f, I.t) }));
          } });
        busy.push([T.retreatCall, 180]);
        rec(f, S, { kind: 'gunner', tag: 'gunner', side: 'lion', busy, hideAt });
      });
      spots.BULL_GUNS.forEach((G, gi) => {
        const f = mkWorker(rigB, 'bull', 'gunner', 1 + 2 * (gi % 2));
        const shots = T.gunShots.filter((s) => s.side === 'bull' && s.gun === gi).map((s) => s.t);
        const { S, busy, Yo, stand } = gunnerScript(f, 'bull', gi, G, shots, true);
        S.holdTo(cheerWins[0][0] + 0.3, stand);
        cheerWins.forEach(([a, b], k) => {
          if ((gi + k) % 3 === 2) return;
          S.holdTo(Math.max(S.T, a + 0.3 * hsh(gi, k)), stand);
          S.holdTo(b - 0.25, (s, I) => Yo({ pose: cheerPose(f, I.t, gi + 20, 'gunner') }));
        });
        busy.push([142, 158]);
        S.holdTo(180, stand);
        rec(f, S, { kind: 'gunner', tag: 'gunner', side: 'bull', busy, y: G.y });
      });

      // ===================================================================================================================
      // THE RAM CREW: beside the shed in the camp at dawn, in under its eaves at the trumpet, pushing it to the barbican
      // gate, swinging the log, then out of the back and away to the camp
      const CREW = [[0.72, -1.5], [-0.72, -1.5], [0.72, 0.05], [-0.72, 0.05], [0.72, 1.6], [-0.72, 1.6]];   // [left, forward] in the shed
      const ram0 = ctx.routeAt(S0.ramPath, 0, {}), ramEnd = ctx.routeAt(S0.ramPath, ramL, {});
      const inShed = (t, lx, lz, out) => {
        const r = ramPos(t), c = Math.cos(r.yaw), s = Math.sin(r.yaw);
        out[0] = r.x + s * lz + c * lx; out[1] = r.z + c * lz - s * lx; out[2] = r.yaw;
        return out;
      };
      const tmp3 = [0, 0, 0];
      const RAMSTRIDE = 0.93;
      // where they get their breath back in the camp: each file's first man out goes to the outermost place
      const REST = { w: [[-2.8, 56.4], [-1.5, 57.3], [-0.2, 56.4]], e: [[4.4, 56.4], [3.1, 57.3], [1.8, 56.4]] };
      CREW.forEach(([lx, lz], i) => {
        const f = mkWorker(rigL, 'lion', 'crew', i % 4);
        const side = lx > 0 ? 1 : -1;
        // dawn: along the shed's flanks, out from under its eaves
        const sx0 = ram0.x + Math.cos(ram0.yaw) * (lx + side * 1.55), sz0 = ram0.z - Math.sin(ram0.yaw) * (lx + side * 1.55) + Math.cos(ram0.yaw) * lz;
        const dyaw = ram0.yaw + PI + (hsh(i, 1) - 0.5) * 1.2;
        const S = new K.Script(sx0, sz0, dyaw, 'ramCrew' + i);
        const into = T.lionTrumpet - 0.1 + 0.1 * i;
        S.holdTo(into, (s, I) => ({ pose: look(idle(f, I.t), sx0, sz0, dyaw, 0, 66, (I.ct > 65.8 && I.ct < 67) ? 0.6 : 0) }));
        inShed(RAM.leave, lx, lz, tmp3);
        S.walk([[tmp3[0], tmp3[1]]], 1.1, f, { endYaw: tmp3[2], base: () => ({ lean: 0.25, hx: 0.2 }) });
        S.holdTo(RAM.leave, () => ({ pose: PZ(f, { af0: 1.2, af1: 1.2, e0: 0.5, e1: 0.5, ao0: 0.12, ao1: 0.12, lean: 0.3, lf0: 0.3, lf1: -0.25 }) }));
        // pushing: the shed's own motion, the legs from its speed
        S.holdTo(RAM.arrive, (s, I) => {
          const ct = I.ct, d = ramDist(ct), v = (ramDist(ct + 0.05) - ramDist(ct - 0.05)) / 0.1;
          inShed(ct, lx, lz, tmp3);
          const amt = Math.sqrt(clamp(v / 3, 0, 1));
          const p2 = f.gait(d / RAMSTRIDE * TAU + i * 0.9, amt, { run: 1, af0: 1.2, af1: 1.2, e0: 0.55, e1: 0.55, ao0: 0.12, ao1: 0.12, lean: 0.12 });
          return { x: tmp3[0], z: tmp3[1], yaw: tmp3[2], pose: p2 };
        });
        // the swing: back, then through to the blow; a flinch at each stone on the roof
        const ex = ramEnd.x + Math.sin(ramEnd.yaw) * lz + Math.cos(ramEnd.yaw) * lx, ez = ramEnd.z + Math.cos(ramEnd.yaw) * lz - Math.sin(ramEnd.yaw) * lx;
        S.holdTo(RAM.blows[RAM.blows.length - 1] + 0.6, (s, I) => {
          const ct = I.ct;
          let u = ((ct - RAM.blows[0]) % 2 + 2) % 2 / 2;
          if (ct < RAM.blows[0]) u = 0.5 + 0.5 * (ct - RAM.arrive) / (RAM.blows[0] - RAM.arrive);
          const back = u < 0.62 ? SM(u / 0.45) : 1 - Math.pow((u - 0.62) / 0.38, 1.6);
          const p2 = PZ(f, { af0: 0.9 + 0.5 * (1 - back), af1: 0.9 + 0.5 * (1 - back), e0: 0.4 + 0.5 * back, e1: 0.4 + 0.5 * back, ao0: 0.1, ao1: 0.1,
            lean: 0.3 - 0.4 * back, lf0: 0.35 - 0.3 * back, lf1: -0.3 + 0.3 * back, k0: 0.2, k1: 0.15 + 0.2 * back, hx: 0.1 });
          for (const rs of RAM.roofStones) { const w = win(ct - rs, 0, 0.9, 0.25); if (w > 0) { p2.hx += 0.4 * w; p2.k0 += 0.5 * w; p2.k1 += 0.5 * w; p2.lean += 0.15 * w; } }
          return { x: ex, z: ez, yaw: ramEnd.yaw, pose: p2 };
        });
        // out of the back before the roof goes (the rear pair first), over the bridge, up the trodden way to the camp
        const rank = lz < -1 ? 0 : lz < 1 ? 1 : 2, bolt = 99.2 + 0.4 * rank;
        S.holdTo(bolt, () => ({ x: ex, z: ez, yaw: ramEnd.yaw, pose: PZ(f, { hx: -0.2, hy: side * 0.6, lean: 0.1, af0: 0.5, af1: 0.5, e0: 0.6, e1: 0.6 }) }));
        const wx = Math.sign(ex), rest = REST[wx < 0 ? 'w' : 'e'][rank];
        S.walk([[ex, ramEnd.z + 3.8], [wx * 0.9, 7.5], [1 + wx * 1.0, 22], [2 + wx * 1.0, 40], [lerp(2 + wx, rest[0], 0.6), rest[1] - 3], rest], RUN, runner(f, 1.0), { endYaw: PI });
        const rest0 = S.T;
        S.hold(4.5, (s, I) => ({ pose: mix(blown(f, I.t, i), idle(f, I.t), SM((s - 3.4) / 1.1)) }));
        const hideAt = HIDE0 + 1 + 0.2 * i;
        retreat.push({ S, f, t0: T.retreatCall + 0.4 + 0.5 * [3, 4, 2, 1, 5, 0][i], lane: wx < 0 ? -2.5 : -1.25,
          head: [[rest[0] + 1.2, rest[1] - 1.6]],
          wait: (s, I) => ({ pose: look(idle(f, I.t), rest[0], rest[1], PI, 30, 20, 0.7) }),
          after: () => {
            S.holdTo(hideAt, (s, I) => ({ pose: mix(blown(f, I.t, i), idle(f, I.t), SM((s - 3) / 2)) }));
            S.x = sx0; S.z = sz0; S.yaw = dyaw;
            S.holdTo(172 + 0.2 * i, () => ({ hide: true, pose: PZ(f) }));
            S.holdTo(180, (s, I) => ({ pose: idle(f, I.t) }));
          } });
        rec(f, S, { kind: 'ramCrew', tag: 'lionSpears', crew: true, busy: [[0, 180]], hideAt, rest0 });
      });

      // ===================================================================================================================
      // RUN THE RETREAT: each runner's way (where he is → his head points → his lane from the nearest point on), spaced
      // at least GAP seconds from the one ahead in the same lane, and cut short so every run ends by STOP
      {
        const lanes = {};
        const laneLine = (o) => lanes[o] || (lanes[o] = offset(COR, o));
        const cum = (L) => { const c = [0]; for (let i = 1; i < L.length; i++) c.push(c[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1])); return c; };
        for (const r of retreat) {
          const L = laneLine(r.lane), last = r.head[r.head.length - 1];
          let bi = 0, bd = 1e9;
          for (let i = 0; i < L.length; i++) { const d = Math.hypot(L[i][0] - last[0], L[i][1] - last[1]); if (d < bd) { bd = d; bi = i; } }
          r.entry = bi;
          r.sEntry = cum(L)[bi];
          r.approach = plen([[r.S.x, r.S.z]].concat(r.head, [L[bi]]));
        }
        // the time each would pass the lane's farthest entry point, in order; push the later ones back to keep the gap
        for (const o of Object.keys(lanes)) {
          const rs = retreat.filter((r) => String(r.lane) === o);
          const sMax = Math.max(...rs.map((r) => r.sEntry));
          const when = (r) => r.t0 + 0.4 + (r.approach + sMax - r.sEntry) / RUN;
          rs.sort((a, b) => when(a) - when(b));
          for (let k = 1; k < rs.length; k++) { const d = when(rs[k - 1]) + GAP - when(rs[k]); if (d > 0) rs[k].t0 += d; }
        }
        for (const r of retreat) {
          const L = laneLine(r.lane);
          r.S.holdTo(r.t0, r.wait);
          const pts = [[r.S.x, r.S.z]].concat(r.head, L.slice(r.entry));
          const way = cutTo(pts, Math.max(4, (STOP - r.t0) * RUN - 1));
          r.S.walk(way.slice(1), RUN, runner(r.f, 1.0), {});
          r.after();
          if (r.spear) lionGone = Math.max(lionGone, r.t0 + 0.6);
        }
      }
      for (const fn of later) fn();

      // ---------- bake: one skinned mesh per rig ----------
      for (const rig of [rigL, rigB, rigS]) B.finish(rig, ctx.root);
      this.tris = rigL.tris + rigB.tris + rigS.tris;
      for (const g of figs) { g.f.floor = sY; g.seed = g.f.seed; if (Math.abs(g.S.T - 180) > 0.01) console.error('armies: ' + g.S.name + ' ends at ' + g.S.T.toFixed(2)); }

      // ---------- labels and tap moments ----------
      const tagPos = (g) => () => (g.hidden || g.lying ? null : g.f.headTop());
      for (const g of figs) {
        if (g.crew) { ctx.tag('ramCrew', tagPos(g)); continue; }
        const o = { onTap: (now) => {
          if (g.kind !== 'lionArcher' && g.kind !== 'lionSpear' && g.kind !== 'bullSpear') return;
          const ct = ctx.cycle.t, dur = g.kind === 'lionArcher' ? 5.6 : 3.2;
          for (let s = 0; s <= dur; s += 0.4) if (busyAt(g, (ct + s) % 180)) return;
          g.tapAt = now;
        } };
        ctx.tag(g.kind === 'gunner' ? gunTag[g.side] : g.tag, tagPos(g), o);
      }

      ctx.armies = { lionLoose, bullLoose, ramDist, lionGunsManned: manned, wall: { x: WX, lion: [LZ1, LZ2], bull: [BZ1, BZ2], contact: CONTACT }, posts, corridor: COR };
      this.SS = SS;
      window.__armies = this;
    },

    update(t, dt, ctx) {
      if (!this.figs) return;
      const ct = ctx.cycle.t, I = this.I, K = ctx.figureKit;
      I.t = t; I.ct = ct; I.n = ctx.cycle.n;
      for (let gi = 0; gi < this.figs.length; gi++) {
        const g = this.figs[gi], f = g.f;
        const st = g.S.sample(ct, I);
        if (st.hide) {
          if (!g.hidden) { f.set(st); g.shadow.hide(); g.hidden = true; if (g.sheaf) g.sheaf.scale.setScalar(1e-4); }
          continue;
        }
        g.hidden = false;
        g.lying = st.pitch < -0.6;
        // a tapped moment, laid over the timeline and blended in and out
        const tk = t - g.tapAt;
        let handSheaf = g.handSheaf ? g.handSheaf(ct) : 0, tapPlant = 0;
        if (tk >= 0 && tk < 6) {
          if (g.kind === 'lionArcher') {
            // a sheaf from the bag, pushed into the ground by the front foot; a look at the walls; then back in the bag
            const w = win(tk, 0, 5.6, 0.6), b = f.base, AR = this.SS.poses.archer;
            const reach = K.P(Object.assign({}, b, { af1: -0.35, e1: 0.7, ao1: 0.3, hx: 0.15, hy: -0.3 })), bend = K.P(Object.assign({}, b, AR.plant)), up = K.P(b);
            const p = tk < 0.9 ? reach : tk < 2.0 ? K.mix(reach, bend, SM((tk - 0.9) / 0.6)) : tk < 3.4 ? K.mix(bend, up, SM((tk - 2.0) / 0.6)) : tk < 4.6 ? K.mix(up, bend, SM((tk - 3.4) / 0.6)) : K.mix(bend, reach, SM((tk - 4.6) / 0.5));
            st.pose = K.mix(st.pose, p, w);
            handSheaf = (tk > 0.5 && tk < 1.75) || (tk > 4.1 && tk < 5.3) ? 1 : 0;
            tapPlant = tk >= 1.75 && tk <= 4.1 ? 1 : 0;
          } else {
            // the shield lifted high and the spear up, a cheer
            const w = win(tk, 0, 3.2, 0.6), s = Math.sin(tk * 6);
            const p = K.P(Object.assign({}, f.base, { af0: 2.35 + 0.15 * s, e0: 0.5, at0: 0.25, ao0: 0.3, af1: 0.5 + 0.12 * s, e1: 0.9 - 0.2 * s, ao1: 0.15, hx: -0.3, lean: -0.06, y: 0.03 * Math.max(0, s) }));
            st.pose = K.mix(st.pose, p, w);
          }
        }
        if (g.handSheaf) st.pose.sheaf = handSheaf;
        if (g.y !== null && st.y === undefined) st.y = g.y;
        f.set(st);
        f.eyes.scale.y = g.lying ? 0.1 : window.Motion.blink(t, g.seed);
        const p = f.root.position;
        if (g.lying) g.shadow.set(p.x - Math.sin(st.yaw) * 0.8, ctx.surfaceY(p.x, p.z), p.z - Math.cos(st.yaw) * 0.8, 1.5);
        else g.shadow.set(p.x, st.y !== undefined && st.y !== null ? st.y : ctx.surfaceY(p.x, p.z), p.z);
        if (g.sheaf) {
          let k = g.sheafAt(ct), sx = g.sheafPos[0], sz = g.sheafPos[1];
          if (tapPlant && !k) { k = 1; const a = st.yaw; sx = p.x + Math.sin(a) * 0.5 + Math.cos(a) * 0.12; sz = p.z + Math.cos(a) * 0.5 - Math.sin(a) * 0.12; }
          if (k) { g.sheaf.position.set(sx, ctx.groundY(sx, sz), sz); g.sheaf.scale.setScalar(1); } else g.sheaf.scale.setScalar(1e-4);
        }
      }
    },
  });
})();
