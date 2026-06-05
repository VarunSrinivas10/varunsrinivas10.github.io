// ═══════════════════════════════════════════════════════════════
//  graph.js  —  Canvas engine with Dijkstra traversal animation
// ═══════════════════════════════════════════════════════════════

var GraphEngine = (() => {

  let canvas, ctx, dpr;
  let W = 0, H = 0;
  let animT = 0;
  let hovId = null;

  // Camera
  let cam  = { x:0, y:0, z:1 };
  let camT = { x:0, y:0, z:1 };

  // App state
  let appState   = 'home';   // 'home' | mainId
  // Progress: main node sub-nodes visible
  let mainProg   = {};       // mainId → 0..1
  // Hover springs
  let hovS       = {};
  // Ripples & particles
  let ripples    = [];
  let particles  = [];
  // Wobble phases
  let wobble     = {};

  // ── Dijkstra animation state ─────────────────────────────────
  let dijkState = null;
  // dijkState = {
  //   phase: 'traversing' | 'zooming',
  //   targetId: string,
  //   path: [nodeId, ...],       // ordered path hub→…→target
  //   litEdges: Set<string>,     // "a|b" keys of edges that are lit
  //   visitedOrder: [nodeId…],   // order nodes were "settled"
  //   progress: 0..1,            // overall animation progress
  //   dummyAlpha: 1,             // fades from 1→0 during zoom phase
  //   edgeAlphas: {},            // edgeKey → 0..1 glow
  // }

  // ── World nodes ──────────────────────────────────────────────
  let nodes      = [];   // hub + main + sub (no leaves)
  let dummyNodes = [];   // background dummy nodes
  let dummyEdges = [];   // edges among dummy+real nodes

  const MAIN_SPOKE = 170;
  const SUB_SPOKE  = 95;
  const DUMMY_COUNT = 50;

  // ── Coord transforms ─────────────────────────────────────────
  function ts(wx, wy) {
    return { sx: W/2 + (wx - cam.x)*cam.z,
             sy: H/2 + (wy - cam.y)*cam.z };
  }

  // ── Build world ──────────────────────────────────────────────
  function buildWorld() {
    nodes = [];

    // Hub
    nodes.push({ id:'hub', x:0, y:0, r:44, type:'hub',
      label: GRAPH.hub.label, fullLabel: GRAPH.hub.fullLabel,
      color: GRAPH.hub.color, glow: GRAPH.hub.glow });

    // Main + sub nodes (2 levels only)
    for (const mn of GRAPH.main) {
      const rad = mn.angle * Math.PI / 180;
      const x = Math.cos(rad) * MAIN_SPOKE;
      const y = Math.sin(rad) * MAIN_SPOKE;
      nodes.push({ id:mn.id, x, y, r:38, type:'main',
        label:mn.label, color:mn.color, glow:mn.glow, angle:mn.angle });
      if (!(mn.id in mainProg)) mainProg[mn.id] = 0;

      const subs = GRAPH.sub[mn.id] || [];
      const sc = subs.length;
      const spread = Math.PI * 0.65;
      subs.forEach((s, si) => {
        const t  = sc === 1 ? 0 : (si/(sc-1) - 0.5);
        const a  = rad + t * spread;
        const sx = x + Math.cos(a) * SUB_SPOKE;
        const sy = y + Math.sin(a) * SUB_SPOKE;
        nodes.push({ id:s.id, parentId:mn.id, x:sx, y:sy, r:28, type:'sub',
          label:s.label, color:s.color, glow:s.glow, idx:si });
        if (!(s.id in mainProg)) mainProg[s.id] = 0;
      });
    }
  }

  // Build dummy background graph (run after first resize so W/H are known)
  function buildDummyGraph() {
    dummyNodes = [];
    dummyEdges = [];

    const spread = 340; // world-space radius to scatter within
    const rng = (a, b) => a + Math.random()*(b-a);

    // Place dummy nodes avoiding the real hub area
    for (let i = 0; i < DUMMY_COUNT; i++) {
      let x, y, tries = 0;
      do {
        const angle = rng(0, Math.PI*2);
        const dist  = rng(60, spread);
        x = Math.cos(angle)*dist;
        y = Math.sin(angle)*dist;
        tries++;
      } while (tries < 30 && Math.hypot(x,y) < 55);
      dummyNodes.push({
        id: 'd' + i, x, y, r: rng(5, 12),
        phase: rng(0, Math.PI*2),       // for gentle float
        vx: rng(-0.06, 0.06),
        vy: rng(-0.06, 0.06),
        alpha: rng(0.25, 0.55),
      });
    }

    // Connect each dummy to 2-3 nearest dummies (sparse Delaunay-ish)
    const all = [...dummyNodes];
    all.forEach((a, i) => {
      const dists = all
        .map((b, j) => ({ j, d: Math.hypot(a.x-b.x, a.y-b.y) }))
        .filter(x => x.j !== i)
        .sort((p,q) => p.d - q.d);
      const k = 2 + Math.floor(Math.random()*2);
      dists.slice(0, k).forEach(({ j }) => {
        const key = [i,j].sort().join('|');
        if (!dummyEdges.find(e => e.key === key))
          dummyEdges.push({ key, a: i, b: j });
      });
    });

    // Also connect some dummy nodes to the real hub and main nodes
    const realAnchors = [nodes.find(n=>n.id==='hub'), ...GRAPH.main.map(mn=>nodes.find(n=>n.id===mn.id))];
    dummyNodes.forEach((d, i) => {
      const nearest = realAnchors
        .map(r => ({ r, dist: Math.hypot(d.x-r.x, d.y-r.y) }))
        .sort((a,b) => a.dist - b.dist)[0];
      if (nearest && nearest.dist < 200 && Math.random() < 0.4) {
        dummyEdges.push({ key:'r'+i, a:i, b:-1, realId: nearest.r.id });
      }
    });
  }

  // ── Dijkstra on the real graph ───────────────────────────────
  // Build adjacency: hub connects to each main; each main connects to its subs
  function buildAdjacency() {
    const adj = {};
    const addEdge = (a, b, w) => {
      if (!adj[a]) adj[a] = [];
      if (!adj[b]) adj[b] = [];
      adj[a].push({ to:b, w });
      adj[b].push({ to:a, w });
    };
    for (const mn of GRAPH.main) {
      const mNode = nodes.find(n=>n.id===mn.id);
      const hub   = nodes.find(n=>n.id==='hub');
      addEdge('hub', mn.id, Math.hypot(mNode.x-hub.x, mNode.y-hub.y));
      for (const s of (GRAPH.sub[mn.id]||[])) {
        const sNode = nodes.find(n=>n.id===s.id);
        addEdge(mn.id, s.id, Math.hypot(sNode.x-mNode.x, sNode.y-mNode.y));
      }
    }
    return adj;
  }

  function dijkstra(startId, endId) {
    const adj  = buildAdjacency();
    const dist = {}, prev = {}, visited = new Set();
    for (const n of nodes) { dist[n.id] = Infinity; prev[n.id] = null; }
    dist[startId] = 0;
    const pq = [{ id:startId, d:0 }];
    const settledOrder = [];

    while (pq.length) {
      pq.sort((a,b)=>a.d-b.d);
      const { id } = pq.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      settledOrder.push(id);
      if (id === endId) break;
      for (const { to, w } of (adj[id]||[])) {
        const nd = dist[id] + w;
        if (nd < dist[to]) {
          dist[to] = nd;
          prev[to] = id;
          pq.push({ id:to, d:nd });
        }
      }
    }

    // Reconstruct path
    const path = [];
    let cur = endId;
    while (cur) { path.unshift(cur); cur = prev[cur]; }
    return { path, settledOrder };
  }

  // ── Start Dijkstra animation toward a main node ──────────────
  function startDijkstra(targetId) {
    const { path, settledOrder } = dijkstra('hub', targetId);
    dijkState = {
      phase:        'traversing',
      targetId,
      path,
      settledOrder,
      progress:     0,
      dummyAlpha:   1,
      edgeAlphas:   {},
      litEdges:     new Set(),
      nodeGlow:     {},  // nodeId → 0..1
    };
  }

  // ── Draw helpers ─────────────────────────────────────────────
  function drawGlow(sx, sy, r, fill, glowColor, glowR) {
    if (glowColor) {
      const g = ctx.createRadialGradient(sx,sy,r*0.3,sx,sy,glowR);
      g.addColorStop(0, glowColor+'55');
      g.addColorStop(1, glowColor+'00');
      ctx.beginPath(); ctx.arc(sx,sy,glowR,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.fillStyle=fill; ctx.fill();
  }

  function drawRing(sx,sy,r,color,lw,alpha,dash) {
    ctx.save(); ctx.globalAlpha=alpha??1;
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.strokeStyle=color; ctx.lineWidth=lw;
    if(dash)ctx.setLineDash(dash);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  function drawCurve(ax,ay,bx,by,color,alpha,lw,dash) {
    ctx.save(); ctx.globalAlpha=alpha??1;
    ctx.beginPath(); ctx.moveTo(ax,ay);
    const mx=(ax+bx)/2, my=(ay+by)/2;
    ctx.quadraticCurveTo(mx+(ay-by)*0.12, my+(bx-ax)*0.12, bx,by);
    ctx.strokeStyle=color; ctx.lineWidth=lw??1;
    if(dash){ctx.setLineDash(dash);ctx.lineDashOffset=-animT*0.018;}
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  function drawLabel(sx,sy,text,size,color,weight) {
    const lines=(typeof text==='string'?text.split('\n'):text);
    ctx.save();
    ctx.font=`${weight??400} ${size}px 'Inter',sans-serif`;
    ctx.fillStyle=color; ctx.textAlign='center'; ctx.textBaseline='middle';
    const lh=size*1.25, oy=-(lines.length-1)*lh/2;
    lines.forEach((l,i)=>ctx.fillText(l,sx,sy+oy+i*lh));
    ctx.restore();
  }

  function drawSerifLabel(sx,sy,text,size,color) {
    const lines=(typeof text==='string'?text.split('\n'):text);
    ctx.save();
    ctx.font=`${size}px 'Playfair Display',serif`;
    ctx.fillStyle=color; ctx.textAlign='center'; ctx.textBaseline='middle';
    const lh=size*1.3, oy=-(lines.length-1)*lh/2;
    lines.forEach((l,i)=>ctx.fillText(l,sx,sy+oy+i*lh));
    ctx.restore();
  }

  function spawnParticles(ax,ay,bx,by,color) {
    for(let i=0;i<2;i++){
      const t=Math.random();
      particles.push({x:ax+(bx-ax)*t,y:ay+(by-ay)*t,
        vx:(bx-ax)*0.003*(0.5+Math.random()),
        vy:(by-ay)*0.003*(0.5+Math.random()),
        r:1.5+Math.random()*1.5, color, alpha:0.8});
    }
  }

  function getWob(id) {
    if(!wobble[id]) wobble[id]=Math.random()*Math.PI*2;
    return Math.sin(animT*0.04+wobble[id])*1.4;
  }
  function getHS(id){ return hovS[id]??1; }

  // ── Dijkstra animation tick ───────────────────────────────────
  function tickDijkstra() {
    if (!dijkState) return;
    const ds = dijkState;

    if (ds.phase === 'traversing') {
      ds.progress = Math.min(1, ds.progress + 0.018);

      // Settle nodes in order based on progress
      const totalNodes = ds.settledOrder.length;
      const settledCount = Math.floor(ds.progress * totalNodes * 1.2);
      for (let i = 0; i < Math.min(settledCount, totalNodes); i++) {
        const nid = ds.settledOrder[i];
        if (!(nid in ds.nodeGlow)) ds.nodeGlow[nid] = 0;
        ds.nodeGlow[nid] = Math.min(1, (ds.nodeGlow[nid]||0) + 0.08);
      }

      // Light up path edges progressively
      const pathProgress = ds.progress;
      const pathLen = ds.path.length - 1;
      const litCount = Math.ceil(pathProgress * (pathLen + 1));
      for (let i = 0; i < Math.min(litCount, pathLen); i++) {
        const key = [ds.path[i], ds.path[i+1]].sort().join('|');
        ds.litEdges.add(key);
        if (!(key in ds.edgeAlphas)) ds.edgeAlphas[key] = 0;
        ds.edgeAlphas[key] = Math.min(1, (ds.edgeAlphas[key]||0) + 0.06);
      }

      // Phase complete → switch to zooming
      if (ds.progress >= 1) {
        ds.phase = 'zooming';
        ds.progress = 0;
        // Trigger actual section activate (ui.js will be called via callback)
        if (ds.onComplete) ds.onComplete(ds.targetId);
      }
    }

    if (ds.phase === 'zooming') {
      ds.progress = Math.min(1, ds.progress + 0.025);
      ds.dummyAlpha = Math.max(0, 1 - ds.progress * 2);
      if (ds.progress >= 1) {
        dijkState = null; // animation done
      }
    }
  }

  // ── Main render loop ─────────────────────────────────────────
  function loop() {
    requestAnimationFrame(loop);
    animT++;

    const pw=canvas.parentElement.clientWidth, ph=canvas.parentElement.clientHeight;
    if(W!==pw||H!==ph){
      W=pw; H=ph;
      canvas.width=W*dpr; canvas.height=H*dpr;
      canvas.style.width=W+'px'; canvas.style.height=H+'px';
      ctx.scale(dpr,dpr);
      if(dummyNodes.length===0) buildDummyGraph();
    }

    cam.x+=(camT.x-cam.x)*0.07;
    cam.y+=(camT.y-cam.y)*0.07;
    cam.z+=(camT.z-cam.z)*0.07;

    // Sub-node progress
    for (const mn of GRAPH.main) {
      const want = appState===mn.id?1:0;
      mainProg[mn.id]=(mainProg[mn.id]||0)+(want-(mainProg[mn.id]||0))*0.09;
      for (const s of (GRAPH.sub[mn.id]||[])) {
        mainProg[s.id]=(mainProg[s.id]||0)+(want-(mainProg[s.id]||0))*0.09;
      }
    }

    tickDijkstra();

    ctx.clearRect(0,0,W,H);

    // ── Star field ──
    ctx.save();
    for(let i=0;i<60;i++){
      const px2=((i*73.1)%W+W)%W, py2=((i*53.7)%H+H)%H;
      const pa=0.12+0.08*Math.sin(animT*0.02+i);
      ctx.beginPath(); ctx.arc(px2,py2,0.7+((i*31)%10)*0.12,0,Math.PI*2);
      ctx.fillStyle=`hsla(${(i*137.5)%360},35%,70%,${pa})`; ctx.fill();
    }
    ctx.restore();

    // ── Animated grid ──
    ctx.save(); ctx.strokeStyle='rgba(255,255,255,.022)'; ctx.lineWidth=0.5;
    const gs=60*cam.z;
    const ox=((W/2-cam.x*cam.z)%gs+gs)%gs;
    const oy=((H/2-cam.y*cam.z)%gs+gs)%gs;
    for(let x=ox-gs;x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=oy-gs;y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.restore();

    const dAlpha = dijkState ? dijkState.dummyAlpha : (appState==='home'?1:0.18);

    // ── Dummy edges ──
    if(dAlpha>0.01) {
      ctx.save(); ctx.globalAlpha=dAlpha*0.22;
      for(const e of dummyEdges){
        let ax,ay,bx,by;
        if(e.b>=0){
          ax=dummyNodes[e.a].x; ay=dummyNodes[e.a].y;
          bx=dummyNodes[e.b].x; by=dummyNodes[e.b].y;
        } else {
          const rn=nodes.find(n=>n.id===e.realId);
          if(!rn) continue;
          ax=dummyNodes[e.a].x; ay=dummyNodes[e.a].y;
          bx=rn.x; by=rn.y;
        }
        const {sx:ax2,sy:ay2}=ts(ax,ay);
        const {sx:bx2,sy:by2}=ts(bx,by);
        ctx.beginPath(); ctx.moveTo(ax2,ay2); ctx.lineTo(bx2,by2);
        ctx.strokeStyle='rgba(180,200,255,1)'; ctx.lineWidth=0.5; ctx.stroke();
      }
      ctx.restore();
    }

    // ── Dummy nodes (gently floating) ──
    if(dAlpha>0.01){
      for(const d of dummyNodes){
        // gentle float in world space (tiny drift)
        d.x += d.vx*0.3; d.y += d.vy*0.3;
        if(Math.abs(d.x)>360||Math.abs(d.y)>360){d.vx*=-1;d.vy*=-1;}
        const {sx,sy}=ts(d.x,d.y);
        const pulse=0.5+0.5*Math.sin(animT*0.03+d.phase);
        ctx.save(); ctx.globalAlpha=dAlpha*(d.alpha*0.6+0.2*pulse);
        ctx.beginPath(); ctx.arc(sx,sy,d.r*cam.z,0,Math.PI*2);
        ctx.fillStyle='#1e2535'; ctx.fill();
        ctx.strokeStyle='rgba(120,160,220,0.5)'; ctx.lineWidth=0.8; ctx.stroke();
        ctx.restore();
      }
    }

    // ── Dijkstra lit edges (drawn over dummy layer) ──
    if(dijkState){
      const ds=dijkState;
      // Draw ALL adjacency edges dimly so the graph structure is visible
      const hub=nodes.find(n=>n.id==='hub');
      for(const mn of GRAPH.main){
        const m=nodes.find(n=>n.id===mn.id);
        const {sx:ax2,sy:ay2}=ts(hub.x,hub.y);
        const {sx:bx2,sy:by2}=ts(m.x,m.y);
        const key=[hub.id,mn.id].sort().join('|');
        const lit=ds.litEdges.has(key);
        const ea=ds.edgeAlphas[key]||0;
        // dim unlit
        if(!lit) drawCurve(ax2,ay2,bx2,by2,'rgba(255,255,255,.08)',0.6,0.6,null);
        // bright if lit
        if(ea>0) {
          ctx.save();
          ctx.shadowColor=mn.glow; ctx.shadowBlur=12;
          drawCurve(ax2,ay2,bx2,by2,mn.glow,ea,2.5,[6,4]);
          ctx.restore();
          if(animT%8===0) spawnParticles(ax2,ay2,bx2,by2,mn.glow);
        }
        for(const s of (GRAPH.sub[mn.id]||[])){
          const sn=nodes.find(n=>n.id===s.id);
          const {sx:sx2,sy:sy2}=ts(sn.x,sn.y);
          const sk=[mn.id,s.id].sort().join('|');
          const slit=ds.litEdges.has(sk);
          const sea=ds.edgeAlphas[sk]||0;
          if(!slit) drawCurve(bx2,by2,sx2,sy2,'rgba(255,255,255,.06)',0.4,0.5,null);
          if(sea>0){
            ctx.save(); ctx.shadowColor=s.glow; ctx.shadowBlur=10;
            drawCurve(bx2,by2,sx2,sy2,s.glow,sea,2,[5,4]);
            ctx.restore();
          }
        }
      }

      // Draw all real nodes with glow based on settlement
      for(const n of nodes){
        if(n.type==='hub') continue;
        const {sx,sy}=ts(n.x,n.y);
        const ng=ds.nodeGlow[n.id]||0;
        if(ng>0){
          ctx.save(); ctx.shadowColor=n.glow||n.color; ctx.shadowBlur=16*ng;
          ctx.globalAlpha=ng;
          drawGlow(sx,sy,n.r*cam.z,n.color,n.glow,n.r*cam.z*2.2);
          drawRing(sx,sy,n.r*cam.z,n.glow,1.5,ng);
          ctx.restore();
        } else {
          ctx.save(); ctx.globalAlpha=0.35;
          ctx.beginPath(); ctx.arc(sx,sy,n.r*cam.z,0,Math.PI*2);
          ctx.fillStyle='#151a28'; ctx.fill();
          ctx.strokeStyle=n.color+'66'; ctx.lineWidth=1; ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ── Normal rendering (no Dijkstra active) ────────────────────
    if(!dijkState){

      // Ripples
      ripples=ripples.filter(r=>r.a>0.02);
      for(const r of ripples){
        drawRing(r.x,r.y,r.r,r.color,1.2,r.a);
        r.r+=2.5; r.a*=0.88;
      }

      // Particles
      particles=particles.filter(p=>p.alpha>0.05);
      for(const p of particles){
        ctx.save(); ctx.globalAlpha=p.alpha;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=p.color; ctx.fill(); ctx.restore();
        p.x+=p.vx; p.y+=p.vy; p.alpha*=0.93; p.r*=0.97;
      }

      // Hub→main edges
      const hub=nodes.find(n=>n.id==='hub');
      const {sx:hsx,sy:hsy}=ts(hub.x,hub.y);
      for(const mn of GRAPH.main){
        const m=nodes.find(n=>n.id===mn.id);
        const {sx:msx,sy:msy}=ts(m.x,m.y);
        const active=appState===mn.id;
        const fade=appState!=='home'&&!active;
        const hovE=hovId===mn.id;
        if(active&&animT%12===0) spawnParticles(hsx,hsy,msx,msy,mn.glow);
        drawCurve(hsx,hsy,msx,msy,
          active?mn.glow:hovE?mn.glow+'88':'rgba(255,255,255,.09)',
          fade?0.05:active?0.65:hovE?0.4:0.22,
          active?1.8:0.8, active?[6,4]:null);
      }

      // Main→sub edges + sub nodes
      for(const mn of GRAPH.main){
        const mp=mainProg[mn.id]||0; if(mp<0.01) continue;
        const m=nodes.find(n=>n.id===mn.id);
        const {sx:msx,sy:msy}=ts(m.x,m.y);
        const subs=nodes.filter(n=>n.parentId===mn.id&&n.type==='sub');
        for(const s of subs){
          const sp=mainProg[s.id]||0;
          const {sx:tsx,sy:tsy}=ts(s.x,s.y);
          const ssx=msx+(tsx-msx)*mp, ssy=msy+(tsy-msy)*mp;
          const shov=hovId===s.id;
          if(sp>0.01&&animT%22===0) spawnParticles(msx,msy,ssx,ssy,s.glow);
          drawCurve(msx,msy,ssx,ssy,
            shov?s.glow+'cc':'rgba(255,255,255,.1)',
            mp*(shov?0.6:0.25),0.9,shov?[5,4]:null);
          const sr=s.r*cam.z*(hovS[s.id]||1);
          ctx.save(); ctx.globalAlpha=Math.min(1,mp*1.4);
          if(shov){ctx.shadowColor=s.glow; ctx.shadowBlur=14;}
          drawGlow(ssx,ssy,sr,shov?s.color:'#151a28',shov?s.glow:null,sr*2.2);
          drawRing(ssx,ssy,sr,s.color+'88',1);
          ctx.restore();
          if(mp>0.45){
            const fs=Math.min(Math.max(8,sr*0.38),sr*0.36);
            ctx.save(); ctx.globalAlpha=(mp-0.45)/0.55;
            drawLabel(ssx,ssy,s.label,fs,shov?'#fff':'rgba(255,255,255,.8)','500');
            ctx.restore();
          }
        }
      }

      // Main nodes
      for(const mn of GRAPH.main){
        const m=nodes.find(n=>n.id===mn.id);
        const active=appState===mn.id;
        const fade=appState!=='home'&&!active;
        const mhov=hovId===mn.id;
        const r=m.r*cam.z*(hovS[mn.id]||1);
        const wob=getWob(mn.id);
        const {sx,sy}=ts(m.x,m.y);
        const asx=sx, asy=sy+wob;
        ctx.save(); ctx.globalAlpha=fade?0.1:1;
        if(mhov||active){ctx.shadowColor=mn.glow;ctx.shadowBlur=active?28:14;}
        if(active){
          const pulse=0.5+0.5*Math.sin(animT*0.06);
          drawRing(asx,asy,r+6+4*pulse,mn.glow,1,0.15+0.1*pulse);
        }
        drawGlow(asx,asy,r,active?mn.color:'#151a28',mhov||active?mn.glow:null,r*2.5);
        drawRing(asx,asy,r,mn.color+(active?'ff':'bb'),active?2:1);
        ctx.restore();
        if(!fade||active){
          const fs=Math.min(Math.max(9,r*0.32),r*0.30);
          ctx.save(); ctx.globalAlpha=fade?0.1:1;
          drawLabel(asx,asy,mn.label,fs,active||mhov?'#fff':'rgba(255,255,255,.82)','500');
          ctx.restore();
        }
      }
    }

    // ── Hub (always drawn) ───────────────────────────────────────
    {
      const hub=nodes.find(n=>n.id==='hub');
      const wob=getWob('hub')*0.4;
      const {sx,sy}=ts(hub.x,hub.y);
      const hhov=hovId==='hub';
      const r=hub.r*cam.z*(hovS['hub']||1);
      const pulse=0.5+0.5*Math.sin(animT*0.03);
      ctx.save();
      drawRing(sx,sy+wob,r+14+6*pulse,'#e8a020',0.8,0.06+0.04*pulse);
      drawRing(sx,sy+wob,r+8,'#e8a020',0.8,0.12+0.04*pulse);
      ctx.shadowColor='#f0c060'; ctx.shadowBlur=hhov?30:18;
      drawGlow(sx,sy+wob,r,'#1a1500','#f0c060',r*2.8);
      drawRing(sx,sy+wob,r,'#e8a020',2);
      ctx.restore();
      const fs=Math.min(Math.max(10,r*0.36),r*0.32);
      drawSerifLabel(sx,sy+wob,hub.fullLabel||hub.label,fs,'#e8a020');
    }

    // Hover springs
    const allIds=['hub',...GRAPH.main.map(m=>m.id),
      ...GRAPH.main.flatMap(mn=>(GRAPH.sub[mn.id]||[]).map(s=>s.id))];
    for(const id of allIds){
      const want=hovId===id?1.12:1;
      hovS[id]=(hovS[id]||1)+(want-(hovS[id]||1))*0.13;
    }
  }

  // ── Hit testing ──────────────────────────────────────────────
  function hitTest(mx,my){
    // Sub nodes (only when expanded)
    for(const mn of GRAPH.main){
      const mp=mainProg[mn.id]||0; if(mp<0.15) continue;
      const m=nodes.find(n=>n.id===mn.id);
      const {sx:msx,sy:msy}=ts(m.x,m.y);
      for(const s of nodes.filter(n=>n.parentId===mn.id&&n.type==='sub')){
        const {sx:tsx,sy:tsy}=ts(s.x,s.y);
        const ssx=msx+(tsx-msx)*mp, ssy=msy+(tsy-msy)*mp;
        if(Math.hypot(mx-ssx,my-ssy)<s.r*cam.z+6) return s;
      }
    }
    // Main nodes
    for(const mn of GRAPH.main){
      const m=nodes.find(n=>n.id===mn.id);
      const {sx,sy}=ts(m.x,m.y);
      if(Math.hypot(mx-sx,my-sy)<m.r*cam.z+6) return m;
    }
    // Hub
    const hub=nodes.find(n=>n.id==='hub');
    const {sx,sy}=ts(hub.x,hub.y);
    if(Math.hypot(mx-sx,my-sy)<hub.r*cam.z+6) return hub;
    return null;
  }

  // ── Camera ───────────────────────────────────────────────────
  function setCamHome(){
    camT={x:0,y:0,z:Math.min(W,H)/480};
  }
  function setCamOnMain(mnId){
    const m=nodes.find(n=>n.id===mnId);
    camT={x:m.x,y:m.y,z:Math.min(W,H)/260};
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    init(canvasEl){
      canvas=canvasEl; ctx=canvas.getContext('2d');
      dpr=window.devicePixelRatio||1;
      W=canvas.parentElement.clientWidth; H=canvas.parentElement.clientHeight;
      canvas.width=W*dpr; canvas.height=H*dpr;
      canvas.style.width=W+'px'; canvas.style.height=H+'px';
      ctx.scale(dpr,dpr);
      buildWorld();
      setCamHome(); cam={...camT};
      loop();
    },
    setHome(){ appState='home'; dijkState=null; setCamHome(); },
    setSection(id){ appState=id; setCamOnMain(id); },
    clearSubState(){},
    setSubState(){},

    // Trigger Dijkstra animation; onComplete(targetId) called when traversal done
    animateTo(targetId, onComplete){
      dijkState=null;
      startDijkstra(targetId);
      dijkState.onComplete = (id) => {
        setCamOnMain(id);
        if(onComplete) onComplete(id);
      };
    },

    spawnRipple(mx,my,color){
      ripples.push({x:mx,y:my,r:4,a:0.7,color:color||'#e8a020'});
    },
    onMouseMove(mx,my){
      if(dijkState) return null;
      const n=hitTest(mx,my); hovId=n?n.id:null; return n;
    },
    onMouseLeave(){ hovId=null; },
    onClick(mx,my){
      if(dijkState) return null;
      return hitTest(mx,my);
    },
  };
})();
