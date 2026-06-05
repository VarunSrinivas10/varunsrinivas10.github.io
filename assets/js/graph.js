// ═══════════════════════════════════════════════════════════════
//  graph.js  —  Canvas rendering engine. Do not edit unless you
//               want to change how the graph looks or animates.
//               All content lives in data.js.
// ═══════════════════════════════════════════════════════════════

const GraphEngine = (() => {

  // ── Internal state ──────────────────────────────────────────
  let canvas, ctx, dpr;
  let W = 0, H = 0;
  let animT = 0;
  let hovId = null;

  // Animated camera
  let cam  = { x: 0, y: 0, z: 1 };
  let camT = { x: 0, y: 0, z: 1 };

  // App state (set by ui.js)
  let appState = 'home';   // 'home' | mainId
  let subState = null;     // subId with leaves expanded

  // World nodes (built once from GRAPH data)
  let nodes = [];

  // Animation progress maps
  let mainProg   = {};  // mainId  → 0..1
  let subProgMap = {};  // subId   → 0..1

  // Hover spring scales
  let hovS = {};

  // Particles & ripples
  let particles = [];
  let ripples   = [];

  // Per-node wobble phase offsets
  let wobble = {};

  // Geometry constants
  const MAIN_SPOKE = 160;
  const SUB_SPOKE  = 90;
  const LEAF_SPOKE = 58;

  // ── Coord transforms ────────────────────────────────────────
  function ts(wx, wy) {
    return { sx: W/2 + (wx - cam.x)*cam.z, sy: H/2 + (wy - cam.y)*cam.z };
  }

  // ── World-building ───────────────────────────────────────────
  function buildWorld() {
    nodes = [];
    nodes.push({
      id: 'hub', x: 0, y: 0, r: 44, type: 'hub',
      label: GRAPH.hub.label, fullLabel: GRAPH.hub.fullLabel,
      color: GRAPH.hub.color, glow: GRAPH.hub.glow,
    });

    for (const mn of GRAPH.main) {
      const rad = mn.angle * Math.PI / 180;
      const x = Math.cos(rad) * MAIN_SPOKE;
      const y = Math.sin(rad) * MAIN_SPOKE;
      nodes.push({ id: mn.id, x, y, r: 36, type: 'main', label: mn.label, color: mn.color, glow: mn.glow, angle: mn.angle });
      if (!(mn.id in mainProg)) mainProg[mn.id] = 0;

      const subs = GRAPH.sub[mn.id] || [];
      const sc = subs.length;
      const spread = Math.PI * 0.65;
      subs.forEach((s, si) => {
        const t  = sc === 1 ? 0 : (si / (sc - 1) - 0.5);
        const a  = rad + t * spread;
        const sx = x + Math.cos(a) * SUB_SPOKE;
        const sy = y + Math.sin(a) * SUB_SPOKE;
        nodes.push({ id: s.id, parentId: mn.id, x: sx, y: sy, r: 26, type: 'sub', label: s.label, color: s.color, glow: s.glow, idx: si });
        if (!(s.id in subProgMap)) subProgMap[s.id] = 0;

        const leaves = GRAPH.leaves[s.id] || [];
        const lc = leaves.length;
        const lspread = Math.PI * 0.55;
        leaves.forEach((ll, li) => {
          const lt = lc === 1 ? 0 : (li / (lc - 1) - 0.5);
          const la = a + lt * lspread;
          const lx = sx + Math.cos(la) * LEAF_SPOKE;
          const ly = sy + Math.sin(la) * LEAF_SPOKE;
          nodes.push({
            id: s.id + '_l' + li, parentId: s.id, grandParentId: mn.id,
            x: lx, y: ly, r: 18, type: 'leaf',
            label: ll, color: s.color, glow: s.glow, idx: li,
          });
        });
      });
    }
  }

  // ── Draw primitives ──────────────────────────────────────────
  function drawGlowCircle(sx, sy, r, fill, glowColor, glowR) {
    if (glowColor) {
      const g = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, glowR);
      g.addColorStop(0, glowColor + '55');
      g.addColorStop(1, glowColor + '00');
      ctx.beginPath(); ctx.arc(sx, sy, glowR, 0, Math.PI*2);
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
    ctx.fillStyle = fill; ctx.fill();
  }

  function drawRing(sx, sy, r, color, lw, alpha, dash) {
    ctx.save(); ctx.globalAlpha = alpha ?? 1;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  function drawCurve(ax, ay, bx, by, color, alpha, lw, dash) {
    ctx.save(); ctx.globalAlpha = alpha ?? 1;
    ctx.beginPath(); ctx.moveTo(ax, ay);
    const mx = (ax+bx)/2, my = (ay+by)/2;
    const px = mx + (ay-by)*0.15, py = my + (bx-ax)*0.15;
    ctx.quadraticCurveTo(px, py, bx, by);
    ctx.strokeStyle = color; ctx.lineWidth = lw ?? 1;
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = -animT * 0.018; }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  function drawLabel(sx, sy, text, size, color, weight) {
    const lines = typeof text === 'string' ? text.split('\n') : text;
    ctx.save();
    ctx.font = `${weight ?? 400} ${size}px 'Inter', sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lh = size * 1.25;
    const oy = -(lines.length - 1) * lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, sx, sy + oy + i*lh));
    ctx.restore();
  }

  function drawSerifLabel(sx, sy, text, size, color) {
    const lines = typeof text === 'string' ? text.split('\n') : text;
    ctx.save();
    ctx.font = `${size}px 'Playfair Display', serif`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lh = size * 1.3;
    const oy = -(lines.length - 1) * lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, sx, sy + oy + i*lh));
    ctx.restore();
  }

  function spawnParticles(ax, ay, bx, by, color, n) {
    for (let i = 0; i < (n ?? 2); i++) {
      const t = Math.random();
      particles.push({
        x: ax + (bx-ax)*t, y: ay + (by-ay)*t,
        vx: (bx-ax)*0.003*(0.5+Math.random()),
        vy: (by-ay)*0.003*(0.5+Math.random()),
        r: 1.5 + Math.random()*1.5,
        color, alpha: 0.8,
      });
    }
  }

  function getWob(id) {
    if (!wobble[id]) wobble[id] = Math.random() * Math.PI * 2;
    return Math.sin(animT * 0.04 + wobble[id]) * 1.5;
  }

  function getHS(id) { return hovS[id] ?? 1; }

  // ── Main render loop ─────────────────────────────────────────
  function loop() {
    requestAnimationFrame(loop);
    animT++;

    // Resize
    const pw = canvas.parentElement.clientWidth;
    const ph = canvas.parentElement.clientHeight;
    if (W !== pw || H !== ph) {
      W = pw; H = ph;
      canvas.width  = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
    }

    // Lerp camera
    cam.x += (camT.x - cam.x) * 0.07;
    cam.y += (camT.y - cam.y) * 0.07;
    cam.z += (camT.z - cam.z) * 0.07;

    // Lerp sub progress
    for (const mn of GRAPH.main) {
      const want = appState === mn.id ? 1 : 0;
      mainProg[mn.id] = (mainProg[mn.id] || 0) + (want - (mainProg[mn.id] || 0)) * 0.09;
    }
    for (const mn of GRAPH.main) {
      for (const s of (GRAPH.sub[mn.id] || [])) {
        const want = (appState === mn.id && subState === s.id) ? 1 : 0;
        subProgMap[s.id] = (subProgMap[s.id] || 0) + (want - (subProgMap[s.id] || 0)) * 0.09;
      }
    }

    ctx.clearRect(0, 0, W, H);

    // Star field
    ctx.save();
    for (let i = 0; i < 60; i++) {
      const hsh = (i * 137.5) % 360;
      const px  = ((i * 73.1) % W + W) % W;
      const py  = ((i * 53.7) % H + H) % H;
      const pr  = 0.6 + ((i * 31) % 10) * 0.15;
      const pa  = 0.15 + 0.1 * Math.sin(animT * 0.02 + i);
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2);
      ctx.fillStyle = `hsla(${hsh},40%,70%,${pa})`; ctx.fill();
    }
    ctx.restore();

    // Grid
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.025)'; ctx.lineWidth = 0.5;
    const gs = 60 * cam.z;
    const ox = ((W/2 - cam.x*cam.z) % gs + gs) % gs;
    const oy = ((H/2 - cam.y*cam.z) % gs + gs) % gs;
    for (let x = ox-gs; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = oy-gs; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    // Ripples
    ripples = ripples.filter(r => r.a > 0.02);
    for (const r of ripples) {
      drawRing(r.x, r.y, r.r, r.color, 1.2, r.a);
      r.r += 2.5; r.a *= 0.88;
    }

    // Particles
    particles = particles.filter(p => p.alpha > 0.05);
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = p.alpha;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.color; ctx.fill(); ctx.restore();
      p.x += p.vx; p.y += p.vy; p.alpha *= 0.93; p.r *= 0.97;
    }

    // Hub → main edges
    const hub = nodes.find(n => n.id === 'hub');
    const { sx: hsx, sy: hsy } = ts(hub.x, hub.y);
    for (const mn of GRAPH.main) {
      const m = nodes.find(n => n.id === mn.id);
      const { sx: msx, sy: msy } = ts(m.x, m.y);
      const active     = appState === mn.id;
      const fade       = appState !== 'home' && !active;
      const hovE       = hovId === mn.id;
      if (active && animT % 12 === 0) spawnParticles(hsx, hsy, msx, msy, mn.glow, 1);
      drawCurve(hsx, hsy, msx, msy,
        active ? mn.glow : hovE ? mn.glow + '88' : 'rgba(255,255,255,.08)',
        fade ? 0.05 : active ? 0.6 : hovE ? 0.4 : 0.2,
        active ? 1.8 : 0.8,
        active ? [6,4] : null
      );
    }

    // Sub → leaf edges + leaf nodes
    for (const mn of GRAPH.main) {
      const mp = mainProg[mn.id] || 0; if (mp < 0.01) continue;
      const m  = nodes.find(n => n.id === mn.id);
      const subs = nodes.filter(n => n.parentId === mn.id && n.type === 'sub');
      const { sx: msx, sy: msy } = ts(m.x, m.y);
      for (const s of subs) {
        const sp = subProgMap[s.id] || 0; if (sp < 0.01) continue;
        const { sx: tsx, sy: tsy } = ts(s.x, s.y);
        const ssx = msx + (tsx - msx) * mp;
        const ssy = msy + (tsy - msy) * mp;
        const leaves = nodes.filter(n => n.parentId === s.id && n.type === 'leaf');
        for (const lf of leaves) {
          const { sx: ltx, sy: lty } = ts(lf.x, lf.y);
          const lsx = ssx + (ltx - ssx) * sp;
          const lsy = ssy + (lty - ssy) * sp;
          drawCurve(ssx, ssy, lsx, lsy, s.glow + '66', sp * 0.4, 0.7, [3,4]);
          const lhov = hovId === lf.id;
          const lr   = lf.r * cam.z * getHS(lf.id);
          ctx.save(); ctx.globalAlpha = sp * 0.95;
          if (lhov) { ctx.shadowColor = s.glow; ctx.shadowBlur = 14; }
          drawGlowCircle(lsx, lsy, lr, lhov ? s.color : '#1a1f2e', lhov ? s.glow : null, lr * 2.2);
          drawRing(lsx, lsy, lr, s.color + '88', 0.8);
          ctx.restore();
          if (sp > 0.6) {
            ctx.save(); ctx.globalAlpha = (sp - 0.6) / 0.4;
            const fs = Math.min(Math.max(6.5, lr * 0.44), lr * 0.42);
            drawLabel(lsx, lsy, lf.label, fs, lhov ? '#fff' : 'rgba(255,255,255,.7)', '500');
            ctx.restore();
          }
        }
      }
    }

    // Main → sub edges + sub nodes
    for (const mn of GRAPH.main) {
      const mp = mainProg[mn.id] || 0; if (mp < 0.01) continue;
      const m  = nodes.find(n => n.id === mn.id);
      const { sx: msx, sy: msy } = ts(m.x, m.y);
      const subs = nodes.filter(n => n.parentId === mn.id && n.type === 'sub');
      for (const s of subs) {
        const { sx: tsx, sy: tsy } = ts(s.x, s.y);
        const ssx   = msx + (tsx - msx) * mp;
        const ssy   = msy + (tsy - msy) * mp;
        const shov  = hovId === s.id;
        const sAct  = subState === s.id;
        if (sAct && animT % 18 === 0) spawnParticles(msx, msy, ssx, ssy, s.glow, 1);
        drawCurve(msx, msy, ssx, ssy,
          sAct ? s.glow : shov ? s.glow + 'aa' : 'rgba(255,255,255,.12)',
          mp * (sAct ? 0.6 : shov ? 0.4 : 0.2), 0.9,
          sAct ? [5,4] : null
        );
        const sr = s.r * cam.z * getHS(s.id);
        ctx.save(); ctx.globalAlpha = Math.min(1, mp * 1.3);
        if (shov || sAct) { ctx.shadowColor = s.glow; ctx.shadowBlur = sAct ? 22 : 14; }
        drawGlowCircle(ssx, ssy, sr, sAct ? s.color : '#151a28', sAct || shov ? s.glow : null, sr * 2.4);
        drawRing(ssx, ssy, sr, s.color + (sAct ? 'ff' : '88'), sAct ? 1.5 : 0.8);
        ctx.restore();
        if (mp > 0.4) {
          const fs = Math.min(Math.max(7.5, sr * 0.38), sr * 0.36);
          ctx.save(); ctx.globalAlpha = (mp - 0.4) / 0.6;
          drawLabel(ssx, ssy, s.label, fs, sAct || shov ? '#fff' : 'rgba(255,255,255,.75)', '500');
          ctx.restore();
        }
      }
    }

    // Main nodes
    for (const mn of GRAPH.main) {
      const m      = nodes.find(n => n.id === mn.id);
      const active = appState === mn.id;
      const fade   = appState !== 'home' && !active;
      const mhov   = hovId === mn.id;
      const r      = m.r * cam.z * getHS(mn.id);
      const wob    = getWob(mn.id);
      const { sx, sy } = ts(m.x, m.y);
      const asx = sx, asy = sy + wob;
      ctx.save(); ctx.globalAlpha = fade ? 0.12 : 1;
      if (mhov || active) { ctx.shadowColor = mn.glow; ctx.shadowBlur = active ? 28 : 16; }
      if (active) {
        const pulse = 0.5 + 0.5 * Math.sin(animT * 0.06);
        drawRing(asx, asy, r + 6 + 4*pulse, mn.glow, 1, 0.15 + 0.1*pulse);
      }
      drawGlowCircle(asx, asy, r, active ? mn.color : '#151a28', mhov || active ? mn.glow : null, r * 2.5);
      drawRing(asx, asy, r, mn.color + (active ? 'ff' : 'bb'), active ? 2 : 1);
      ctx.restore();
      if (!fade || active) {
        const fs = Math.min(Math.max(9, r * 0.33), r * 0.3);
        ctx.save(); ctx.globalAlpha = fade ? 0.12 : 1;
        drawLabel(asx, asy, mn.label, fs, active || mhov ? '#fff' : 'rgba(255,255,255,.8)', '500');
        ctx.restore();
      }
    }

    // Hub
    {
      const wob = getWob('hub') * 0.5;
      const { sx, sy } = ts(hub.x, hub.y);
      const hhov  = hovId === 'hub';
      const r     = hub.r * cam.z * getHS('hub');
      const pulse = 0.5 + 0.5 * Math.sin(animT * 0.03);
      ctx.save();
      drawRing(sx, sy + wob, r + 14 + 6*pulse, '#e8a020', 0.8, 0.06 + 0.04*pulse);
      drawRing(sx, sy + wob, r + 8, '#e8a020', 0.8, 0.12 + 0.04*pulse);
      ctx.shadowColor = '#f0c060'; ctx.shadowBlur = hhov ? 30 : 18;
      drawGlowCircle(sx, sy + wob, r, '#1a1500', '#f0c060', r * 2.8);
      drawRing(sx, sy + wob, r, '#e8a020', 2);
      ctx.restore();
      const fs = Math.min(Math.max(10, r * 0.38), r * 0.34);
      drawSerifLabel(sx, sy + wob, hub.fullLabel || hub.label, fs, '#e8a020');
    }

    // Hover springs
    const allIds = [
      'hub',
      ...GRAPH.main.map(m => m.id),
      ...GRAPH.main.flatMap(mn => (GRAPH.sub[mn.id] || []).map(s => s.id)),
      ...GRAPH.main.flatMap(mn =>
        (GRAPH.sub[mn.id] || []).flatMap(s =>
          (GRAPH.leaves[s.id] || []).map((_, i) => s.id + '_l' + i)
        )
      ),
    ];
    for (const id of allIds) {
      const want = hovId === id ? 1.14 : 1;
      hovS[id] = (hovS[id] || 1) + (want - (hovS[id] || 1)) * 0.13;
    }
  }

  // ── Hit testing ──────────────────────────────────────────────
  function hitTest(mx, my) {
    // Leaves first
    for (const mn of GRAPH.main) {
      const mp = mainProg[mn.id] || 0; if (mp < 0.2) continue;
      const m  = nodes.find(n => n.id === mn.id);
      const { sx: msx, sy: msy } = ts(m.x, m.y);
      for (const s of (GRAPH.sub[mn.id] || [])) {
        const sp = subProgMap[s.id] || 0; if (sp < 0.2) continue;
        const sn = nodes.find(n => n.id === s.id);
        const { sx: tsx, sy: tsy } = ts(sn.x, sn.y);
        const ssx = msx + (tsx - msx) * mp;
        const ssy = msy + (tsy - msy) * mp;
        for (const lf of nodes.filter(n => n.parentId === s.id && n.type === 'leaf')) {
          const { sx: ltx, sy: lty } = ts(lf.x, lf.y);
          const lsx = ssx + (ltx - ssx) * sp;
          const lsy = ssy + (lty - ssy) * sp;
          if (Math.hypot(mx - lsx, my - lsy) < lf.r * cam.z + 6) return lf;
        }
      }
    }
    // Subs
    for (const mn of GRAPH.main) {
      const mp = mainProg[mn.id] || 0; if (mp < 0.2) continue;
      const m  = nodes.find(n => n.id === mn.id);
      const { sx: msx, sy: msy } = ts(m.x, m.y);
      for (const s of nodes.filter(n => n.parentId === mn.id && n.type === 'sub')) {
        const { sx: tsx, sy: tsy } = ts(s.x, s.y);
        const ssx = msx + (tsx - msx) * mp;
        const ssy = msy + (tsy - msy) * mp;
        if (Math.hypot(mx - ssx, my - ssy) < s.r * cam.z + 6) return s;
      }
    }
    // Main
    for (const mn of GRAPH.main) {
      const m = nodes.find(n => n.id === mn.id);
      const { sx, sy } = ts(m.x, m.y);
      if (Math.hypot(mx - sx, my - sy) < m.r * cam.z + 6) return m;
    }
    // Hub
    const hub = nodes.find(n => n.id === 'hub');
    const { sx, sy } = ts(hub.x, hub.y);
    if (Math.hypot(mx - sx, my - sy) < hub.r * cam.z + 6) return hub;
    return null;
  }

  // ── Camera helpers ───────────────────────────────────────────
  function setCamHome() {
    camT = { x: 0, y: 0, z: Math.min(W, H) / 480 };
  }

  function setCamOnMain(mnId) {
    const m = nodes.find(n => n.id === mnId);
    camT = { x: m.x, y: m.y, z: Math.min(W, H) / 260 };
  }

  // ── Public API (called by ui.js) ─────────────────────────────
  return {

    init(canvasEl) {
      canvas = canvasEl;
      ctx    = canvas.getContext('2d');
      dpr    = window.devicePixelRatio || 1;
      W = canvas.parentElement.clientWidth;
      H = canvas.parentElement.clientHeight;
      canvas.width  = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
      buildWorld();
      setCamHome();
      cam = { ...camT };
      loop();
    },

    setHome() {
      appState = 'home'; subState = null;
      setCamHome();
    },

    setSection(id) {
      appState = id; subState = null;
      setCamOnMain(id);
    },

    setSubState(id) {
      subState = id;
    },

    clearSubState() {
      subState = null;
    },

    spawnRipple(mx, my, color) {
      ripples.push({ x: mx, y: my, r: 4, a: 0.7, color: color || '#e8a020' });
    },

    onMouseMove(mx, my) {
      const n = hitTest(mx, my);
      hovId = n ? n.id : null;
      return n;
    },

    onMouseLeave() { hovId = null; },

    onClick(mx, my) {
      return hitTest(mx, my);
    },
  };
})();
