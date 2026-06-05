// ═══════════════════════════════════════════════════════════════
//  graph.js — Dijkstra through a real graph of 150+ nodes.
//  Hub and main nodes are NOT directly connected — the shortest
//  path must route through dummy nodes, making Dijkstra meaningful.
// ═══════════════════════════════════════════════════════════════

var GraphEngine = (function() {

  var canvas, ctx, dpr;
  var W=0, H=0, animT=0, hovId=null;
  var cam={x:0,y:0,z:1}, camT={x:0,y:0,z:1};
  var appState='home', mainProg={}, hovS={};
  var ripples=[], particles=[], wobble={};
  var allNodes=[], allEdges=[];
  var DS=null; // Dijkstra animation state

  // ── Geometry ──────────────────────────────────────────────────
  // Hub at (0,0). Main nodes pushed FAR out (~420px).
  // Dummy nodes fill the middle zone (60-360px).
  // No direct hub→main edges — path MUST go through dummies.
  var MAIN_R   = 420;   // main node distance from hub
  var SUB_R    = 110;   // sub nodes orbit their main node
  var DUMMY_N  = 150;   // number of background nodes
  var INNER_R  = 60;    // min dummy distance from hub
  var OUTER_R  = 390;   // max dummy distance (just inside main nodes)
  var K_NEAR   = 4;     // dummy connects to K nearest dummies

  // ── Utility ───────────────────────────────────────────────────
  function rng(a,b){return a+Math.random()*(b-a);}
  function dist2(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}

  function nodeById(id){
    for(var i=0;i<allNodes.length;i++) if(allNodes[i].id===id) return allNodes[i];
    return null;
  }

  // ── World build ───────────────────────────────────────────────
  function buildWorld(){
    allNodes=[]; allEdges=[]; mainProg={};

    // Hub
    allNodes.push({id:'hub',x:0,y:0,r:44,type:'hub',
      label:GRAPH.hub.label,fullLabel:GRAPH.hub.fullLabel,
      color:GRAPH.hub.color,glow:GRAPH.hub.glow});

    // Main nodes — pushed far out
    GRAPH.main.forEach(function(mn){
      var rad=mn.angle*Math.PI/180;
      var x=Math.cos(rad)*MAIN_R, y=Math.sin(rad)*MAIN_R;
      allNodes.push({id:mn.id,x:x,y:y,r:42,type:'main',
        label:mn.label,color:mn.color,glow:mn.glow,angle:mn.angle});
      mainProg[mn.id]=0;

      // Sub nodes
      var subs=GRAPH.sub[mn.id]||[];
      subs.forEach(function(s,si){
        var t=subs.length===1?0:(si/(subs.length-1)-0.5);
        var a=rad+t*Math.PI*0.6;
        var sx=x+Math.cos(a)*SUB_R, sy=y+Math.sin(a)*SUB_R;
        allNodes.push({id:s.id,parentId:mn.id,x:sx,y:sy,r:30,type:'sub',
          label:s.label,color:s.color,glow:s.glow,idx:si});
        mainProg[s.id]=0;
      });
    });

    // Dummy nodes — fill the middle zone between hub and main nodes
    // Also scatter a few beyond main nodes for visual depth
    var placed=0, attempts=0;
    while(placed<DUMMY_N && attempts<DUMMY_N*20){
      attempts++;
      var angle=rng(0,Math.PI*2);
      // Bias toward the middle zone where Dijkstra paths will run
      var r = Math.random()<0.85 ? rng(INNER_R,OUTER_R) : rng(OUTER_R,OUTER_R+120);
      var x=Math.cos(angle)*r, y=Math.sin(angle)*r;
      // Reject if too close to a real node
      var tooClose=false;
      allNodes.forEach(function(n){
        if(n.type!=='dummy'&&dist2({x:x,y:y},n)<50) tooClose=true;
      });
      if(!tooClose){
        allNodes.push({id:'d'+placed,x:x,y:y,r:rng(5,13),type:'dummy',
          phase:rng(0,Math.PI*2),vx:rng(-0.04,0.04),vy:rng(-0.04,0.04),
          alpha:rng(0.28,0.62),color:'#3a5a8a'});
        placed++;
      }
    }

    buildEdges();
  }

  function buildEdges(){
    allEdges=[];
    var edgeSet={};

    function addEdge(aId,bId,w){
      var key=[aId,bId].sort().join('|');
      if(edgeSet[key]) return;
      edgeSet[key]=true;
      var a=nodeById(aId), b=nodeById(bId);
      if(!a||!b) return;
      var weight=w||dist2(a,b);
      allEdges.push({a:aId,b:bId,key:key,w:weight});
    }

    // Sub nodes connect to their parent main node directly
    GRAPH.main.forEach(function(mn){
      (GRAPH.sub[mn.id]||[]).forEach(function(s){ addEdge(mn.id,s.id); });
    });

    // NO direct hub→main edges (that's the whole point!)

    // Hub connects only to nearby dummies
    var dummies=allNodes.filter(function(n){return n.type==='dummy';});
    var hubNeighbors=dummies
      .map(function(d){return{id:d.id,dist:dist2({x:0,y:0},d)};})
      .sort(function(a,b){return a.dist-b.dist;})
      .slice(0,8); // hub touches 8 nearest dummies
    hubNeighbors.forEach(function(nb){ addEdge('hub',nb.id); });

    // Main nodes connect only to nearby dummies
    GRAPH.main.forEach(function(mn){
      var m=nodeById(mn.id);
      var near=dummies
        .map(function(d){return{id:d.id,dist:dist2(m,d)};})
        .sort(function(a,b){return a.dist-b.dist;})
        .slice(0,8);
      near.forEach(function(nb){ addEdge(mn.id,nb.id); });
    });

    // Dummy-to-dummy: K nearest neighbors — forms the routing fabric
    dummies.forEach(function(d){
      var near=dummies
        .filter(function(o){return o.id!==d.id;})
        .map(function(o){return{id:o.id,dist:dist2(d,o)};})
        .sort(function(a,b){return a.dist-b.dist;})
        .slice(0,K_NEAR);
      near.forEach(function(nb){ addEdge(d.id,nb.id); });
    });

    // Verify connectivity: if hub can't reach a main node, add a bridge
    GRAPH.main.forEach(function(mn){
      var reachable=canReach('hub',mn.id);
      if(!reachable){
        // Find the closest dummy to this main node and force a connection
        var m=nodeById(mn.id);
        var closest=dummies
          .map(function(d){return{id:d.id,dist:dist2(m,d)};})
          .sort(function(a,b){return a.dist-b.dist;})[0];
        if(closest) addEdge(mn.id,closest.id);
      }
    });
  }

  function canReach(startId,endId){
    var adj={};
    allEdges.forEach(function(e){
      if(!adj[e.a])adj[e.a]=[];
      if(!adj[e.b])adj[e.b]=[];
      adj[e.a].push(e.b); adj[e.b].push(e.a);
    });
    var visited={}, queue=[startId];
    visited[startId]=true;
    while(queue.length){
      var cur=queue.shift();
      if(cur===endId) return true;
      (adj[cur]||[]).forEach(function(nb){
        if(!visited[nb]){visited[nb]=true;queue.push(nb);}
      });
    }
    return false;
  }

  // ── Dijkstra ──────────────────────────────────────────────────
  function dijkstra(startId,endId){
    var adj={};
    allEdges.forEach(function(e){
      if(!adj[e.a])adj[e.a]=[];
      if(!adj[e.b])adj[e.b]=[];
      adj[e.a].push({to:e.b,w:e.w});
      adj[e.b].push({to:e.a,w:e.w});
    });
    var dist={},prev={},visited={};
    allNodes.forEach(function(n){dist[n.id]=Infinity;prev[n.id]=null;});
    dist[startId]=0;
    var pq=[{id:startId,d:0}],settled=[];
    while(pq.length){
      pq.sort(function(a,b){return a.d-b.d;});
      var cur=pq.shift();
      if(visited[cur.id]) continue;
      visited[cur.id]=true; settled.push(cur.id);
      if(cur.id===endId) break;
      (adj[cur.id]||[]).forEach(function(nb){
        var nd=dist[cur.id]+nb.w;
        if(nd<dist[nb.to]){dist[nb.to]=nd;prev[nb.to]=cur.id;pq.push({id:nb.to,d:nd});}
      });
    }
    var path=[],c=endId;
    while(c){path.unshift(c);c=prev[c];}
    return{path:path,settled:settled};
  }

  function startDijkstra(targetId,onComplete){
    var result=dijkstra('hub',targetId);
    var pathKeys=new Set();
    for(var i=0;i<result.path.length-1;i++)
      pathKeys.add([result.path[i],result.path[i+1]].sort().join('|'));
    DS={
      phase:'scanning', targetId:targetId,
      settled:result.settled, path:result.path, pathKeys:pathKeys,
      edgeGlow:{}, nodeGlow:{},
      scanIdx:0, pathIdx:0,
      holdStart:null, zoomProg:0, dummyAlpha:1,
      onComplete:onComplete,
    };
  }

  // ── Animation tick ────────────────────────────────────────────
  function tickDS(){
    if(!DS) return;

    if(DS.phase==='scanning'){
      // Reveal settled nodes fast (5 per frame)
      for(var k=0;k<5;k++){
        if(DS.scanIdx>=DS.settled.length){DS.phase='pathing';DS.pathIdx=0;return;}
        DS.nodeGlow[DS.settled[DS.scanIdx++]]=0;
      }
      // Ramp glow for all settled so far
      for(var i=0;i<DS.scanIdx;i++){
        var nid=DS.settled[i];
        DS.nodeGlow[nid]=Math.min(0.5,(DS.nodeGlow[nid]||0)+0.05);
      }
      // Dim-light edges between settled nodes
      allEdges.forEach(function(e){
        if(DS.nodeGlow[e.a]>0&&DS.nodeGlow[e.b]>0)
          DS.edgeGlow[e.key]=Math.min(0.3,(DS.edgeGlow[e.key]||0)+0.04);
      });
    }

    if(DS.phase==='pathing'){
      // One path node/edge per 8 frames — slow and dramatic
      if(animT%8===0){
        if(DS.pathIdx<DS.path.length){
          var nid=DS.path[DS.pathIdx];
          DS.nodeGlow[nid]=1.0;
          if(DS.pathIdx>0){
            var pk=[DS.path[DS.pathIdx-1],nid].sort().join('|');
            DS.edgeGlow[pk]=1.0;
          }
          DS.pathIdx++;
        } else {
          if(!DS.holdStart) DS.holdStart=animT;
          if(animT-DS.holdStart>40){
            DS.phase='zooming';
            if(DS.onComplete) DS.onComplete(DS.targetId);
          }
        }
      }
    }

    if(DS.phase==='zooming'){
      DS.zoomProg=Math.min(1,DS.zoomProg+0.025);
      DS.dummyAlpha=Math.max(0,1-DS.zoomProg*2);
      if(DS.zoomProg>=1) DS=null;
    }
  }

  // ── Draw helpers ─────────────────────────────────────────────
  function ts(wx,wy){return{sx:W/2+(wx-cam.x)*cam.z,sy:H/2+(wy-cam.y)*cam.z};}

  function circ(sx,sy,r,fill,stroke,sw){
    ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw||1;ctx.stroke();}
  }

  function glowCirc(sx,sy,r,fill,gc,gr){
    if(gc){
      var g=ctx.createRadialGradient(sx,sy,r*0.2,sx,sy,gr);
      g.addColorStop(0,gc+'60');g.addColorStop(1,gc+'00');
      ctx.beginPath();ctx.arc(sx,sy,gr,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    }
    circ(sx,sy,r,fill);
  }

  function ring(sx,sy,r,color,lw,alpha){
    ctx.save();ctx.globalAlpha=alpha!=null?alpha:1;
    ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke();
    ctx.restore();
  }

  function ln(ax,ay,bx,by,color,alpha,lw,dash){
    ctx.save();ctx.globalAlpha=alpha!=null?alpha:1;
    ctx.beginPath();ctx.moveTo(ax,ay);
    var mx=(ax+bx)/2,my=(ay+by)/2;
    ctx.quadraticCurveTo(mx+(ay-by)*0.08,my+(bx-ax)*0.08,bx,by);
    ctx.strokeStyle=color;ctx.lineWidth=lw||1;
    if(dash){ctx.setLineDash(dash);ctx.lineDashOffset=-animT*0.015;}
    ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
  }

  function lbl(sx,sy,text,size,color,weight){
    var lines=text.split('\n');
    ctx.save();
    ctx.font=(weight||'400')+' '+size+'px \'Inter\',sans-serif';
    ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
    var lh=size*1.25,oy=-(lines.length-1)*lh/2;
    lines.forEach(function(l,i){ctx.fillText(l,sx,sy+oy+i*lh);});
    ctx.restore();
  }

  function serifLbl(sx,sy,text,size,color){
    var lines=text.split('\n');
    ctx.save();
    ctx.font=size+'px \'Playfair Display\',serif';
    ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
    var lh=size*1.3,oy=-(lines.length-1)*lh/2;
    lines.forEach(function(l,i){ctx.fillText(l,sx,sy+oy+i*lh);});
    ctx.restore();
  }

  function getWob(id){
    if(!wobble[id]) wobble[id]=Math.random()*Math.PI*2;
    return Math.sin(animT*0.04+wobble[id])*1.5;
  }

  function spawnParticle(ax,ay,bx,by,color){
    var t=Math.random();
    particles.push({x:ax+(bx-ax)*t,y:ay+(by-ay)*t,
      vx:(bx-ax)*0.004*(0.4+Math.random()),vy:(by-ay)*0.004*(0.4+Math.random()),
      r:1.5+Math.random()*2,color:color,alpha:0.85});
  }

  // ── Main render loop ─────────────────────────────────────────
  function loop(){
    requestAnimationFrame(loop);
    animT++;
    var pw=canvas.parentElement.clientWidth,ph=canvas.parentElement.clientHeight;
    if(W!==pw||H!==ph){
      W=pw;H=ph;
      canvas.width=W*dpr;canvas.height=H*dpr;
      canvas.style.width=W+'px';canvas.style.height=H+'px';
      ctx.scale(dpr,dpr);
      if(allNodes.length===0) buildWorld();
    }
    cam.x+=(camT.x-cam.x)*0.07;
    cam.y+=(camT.y-cam.y)*0.07;
    cam.z+=(camT.z-cam.z)*0.07;

    GRAPH.main.forEach(function(mn){
      var want=appState===mn.id?1:0;
      mainProg[mn.id]=(mainProg[mn.id]||0)+(want-mainProg[mn.id])*0.09;
      (GRAPH.sub[mn.id]||[]).forEach(function(s){
        mainProg[s.id]=(mainProg[s.id]||0)+(want-mainProg[s.id])*0.09;
      });
    });

    tickDS();
    ctx.clearRect(0,0,W,H);

    // Starfield
    ctx.save();
    for(var i=0;i<80;i++){
      var px=((i*73.1)%W+W)%W,py=((i*53.7)%H+H)%H;
      var pa=0.08+0.06*Math.sin(animT*0.02+i);
      ctx.beginPath();ctx.arc(px,py,0.6+((i*31)%10)*0.1,0,Math.PI*2);
      ctx.fillStyle='hsla('+((i*137.5)%360)+',30%,75%,'+pa+')';ctx.fill();
    }
    ctx.restore();

    // Grid
    ctx.save();ctx.strokeStyle='rgba(255,255,255,.018)';ctx.lineWidth=0.5;
    var gs=60*cam.z;
    var ox=((W/2-cam.x*cam.z)%gs+gs)%gs,oy=((H/2-cam.y*cam.z)%gs+gs)%gs;
    for(var x=ox-gs;x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(var y=oy-gs;y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.restore();

    var dAlpha=DS?DS.dummyAlpha:(appState==='home'?1:0.15);

    // ── Drift dummies ─────────────────────────────────────────
    allNodes.forEach(function(n){
      if(n.type!=='dummy') return;
      n.x+=n.vx*0.2; n.y+=n.vy*0.2;
      var r2=Math.hypot(n.x,n.y);
      if(r2>OUTER_R+130||r2<INNER_R-20){n.vx*=-1;n.vy*=-1;}
    });

    // ── Draw ALL edges ────────────────────────────────────────
    allEdges.forEach(function(e){
      var an=nodeById(e.a),bn=nodeById(e.b);
      if(!an||!bn) return;
      var pa=ts(an.x,an.y),pb=ts(bn.x,bn.y);
      var isDummy=an.type==='dummy'||bn.type==='dummy';

      if(DS){
        var glow=DS.edgeGlow[e.key]||0;
        var isPath=DS.pathKeys.has(e.key);
        if(isPath&&glow>0){
          // Shortest path: gold, glowing, thick
          ctx.save();ctx.shadowColor='#f0c060';ctx.shadowBlur=18;
          ln(pa.sx,pa.sy,pb.sx,pb.sy,'#f0c060',glow,3+glow*2,[7,4]);
          ctx.restore();
          if(animT%5===0&&glow>0.7) spawnParticle(pa.sx,pa.sy,pb.sx,pb.sy,'#f0c060');
        } else if(glow>0){
          // Visited, not shortest path: dim teal
          ln(pa.sx,pa.sy,pb.sx,pb.sy,'#3a9a7a',glow*0.5,0.8);
        } else {
          // Unvisited
          ln(pa.sx,pa.sy,pb.sx,pb.sy,'rgba(255,255,255,.05)',isDummy?dAlpha*0.1:0.07,0.5);
        }
      } else {
        // Normal state
        var baseA=isDummy?dAlpha*0.16:0.2;
        if(appState!=='home'&&!isDummy){
          var aMain=GRAPH.main.some(function(mn){return mn.id===an.id||mn.id===bn.id;});
          baseA=aMain?0.06:0.1;
        }
        ln(pa.sx,pa.sy,pb.sx,pb.sy,'rgba(150,190,255,1)',baseA,0.6);
      }
    });

    // ── Draw dummy nodes ──────────────────────────────────────
    if(dAlpha>0.01){
      allNodes.forEach(function(n){
        if(n.type!=='dummy') return;
        var p=ts(n.x,n.y);
        var dr=n.r*cam.z;
        var pulse=0.5+0.5*Math.sin(animT*0.025+n.phase);
        var glow=DS?(DS.nodeGlow[n.id]||0):0;
        var isOnPath=DS&&DS.path&&DS.path.indexOf(n.id)>=0;

        ctx.save();
        ctx.globalAlpha=dAlpha*(n.alpha*0.55+0.18*pulse);
        if(glow>0){
          ctx.shadowColor=isOnPath?'#f0c060':'#3a9a7a';
          ctx.shadowBlur=isOnPath?14*glow:8*glow;
          ctx.globalAlpha=Math.min(1,dAlpha*(n.alpha+glow*0.8));
          circ(p.sx,p.sy,dr*(1+glow*0.3),isOnPath?'#c09020':'#2a7a5a');
        } else {
          circ(p.sx,p.sy,dr,'#1a2035','rgba(100,150,220,0.5)',0.8);
        }
        ctx.restore();
      });
    }

    // ── Draw sub nodes ────────────────────────────────────────
    GRAPH.main.forEach(function(mn){
      var mp=mainProg[mn.id]||0; if(mp<0.01) return;
      var m=nodeById(mn.id), mp2=ts(m.x,m.y);
      allNodes.filter(function(n){return n.parentId===mn.id;}).forEach(function(s){
        var p=ts(s.x,s.y);
        var ssx=mp2.sx+(p.sx-mp2.sx)*mp,ssy=mp2.sy+(p.sy-mp2.sy)*mp;
        var shov=hovId===s.id;
        var sr=s.r*cam.z*(hovS[s.id]||1);
        ctx.save();ctx.globalAlpha=Math.min(1,mp*1.4);
        if(shov){ctx.shadowColor=s.glow;ctx.shadowBlur=14;}
        glowCirc(ssx,ssy,sr,shov?s.color:'#151a28',shov?s.glow:null,sr*2.2);
        circ(ssx,ssy,sr,null,s.color+'88',1);
        ctx.restore();
        if(mp>0.45){
          var sfs=Math.min(Math.max(8,sr*0.36),sr*0.34);
          ctx.save();ctx.globalAlpha=(mp-0.45)/0.55;
          lbl(ssx,ssy,s.label,sfs,shov?'#fff':'rgba(255,255,255,.82)','500');
          ctx.restore();
        }
      });
    });

    // ── Draw main nodes ───────────────────────────────────────
    GRAPH.main.forEach(function(mn){
      var m=nodeById(mn.id);
      var active=appState===mn.id;
      var fade=appState!=='home'&&!active;
      var mhov=hovId===mn.id;
      var mr=m.r*cam.z*(hovS[mn.id]||1);
      var wy=getWob(mn.id);
      var p=ts(m.x,m.y);
      var sx=p.sx,sy=p.sy+wy;
      var dsGlow=DS?(DS.nodeGlow[mn.id]||0):0;
      var onPath=DS&&DS.path&&DS.path.indexOf(mn.id)>=0;

      ctx.save();ctx.globalAlpha=DS?(fade?0.25:1):(fade?0.08:1);
      if(onPath&&dsGlow>0){
        ctx.shadowColor='#f0c060';ctx.shadowBlur=28*dsGlow;
      } else if(mhov||active){
        ctx.shadowColor=mn.glow;ctx.shadowBlur=active?28:14;
      }
      if(active){
        var pls=0.5+0.5*Math.sin(animT*0.06);
        ring(sx,sy,mr+7+5*pls,mn.glow,1.2,0.18+0.1*pls);
      }
      glowCirc(sx,sy,mr,active?mn.color:(mhov?mn.color+'dd':'#151a28'),
        (mhov||active||dsGlow>0.4)?mn.glow:null,mr*2.5);
      circ(sx,sy,mr,null,
        onPath&&dsGlow>0.5?'#f0c060':(mn.color+(active?'ff':'cc')),
        active?2.5:1.8);
      ctx.restore();

      if(!fade||active){
        var fs=Math.min(Math.max(9,mr*0.28),mr*0.26);
        ctx.save();ctx.globalAlpha=DS&&!onPath&&dsGlow<0.3?0.25:(fade?0.08:1);
        lbl(sx,sy,mn.label,fs,active||mhov||dsGlow>0.6?'#fff':'rgba(255,255,255,.85)','500');
        ctx.restore();
      }
    });

    // ── Hub ───────────────────────────────────────────────────
    (function(){
      var hub=nodeById('hub');
      var p=ts(hub.x,hub.y);
      var wy=getWob('hub')*0.5;
      var sx=p.sx,sy=p.sy+wy;
      var hr=hub.r*cam.z*(hovS['hub']||1);
      var pls=0.5+0.5*Math.sin(animT*0.03);
      var hg=DS?(DS.nodeGlow['hub']||0):0;
      ctx.save();
      ring(sx,sy,hr+16+7*pls,'#e8a020',0.8,0.05+0.04*pls);
      ring(sx,sy,hr+9,'#e8a020',0.8,0.11+0.04*pls);
      ctx.shadowColor=hg>0?'#f0c060':'#e8a020';
      ctx.shadowBlur=hovId==='hub'?32:(hg>0?28:20);
      glowCirc(sx,sy,hr,'#1a1500','#f0c060',hr*3);
      circ(sx,sy,hr,null,hg>0?'#f0c060':'#e8a020',2.5);
      ctx.restore();
      var hfs=Math.min(Math.max(10,hr*0.33),hr*0.30);
      serifLbl(sx,sy,hub.fullLabel||hub.label,hfs,'#e8a020');
    })();

    // Ripples
    ripples=ripples.filter(function(r){return r.a>0.02;});
    ripples.forEach(function(r){
      ring(r.x,r.y,r.r,r.color,1.2,r.a);r.r+=2.5;r.a*=0.88;
    });

    // Particles
    particles=particles.filter(function(p){return p.alpha>0.05;});
    particles.forEach(function(p){
      ctx.save();ctx.globalAlpha=p.alpha;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.color;ctx.fill();ctx.restore();
      p.x+=p.vx;p.y+=p.vy;p.alpha*=0.93;p.r*=0.96;
    });

    // Active edge particles (non-DS)
    if(!DS&&appState!=='home'){
      GRAPH.main.forEach(function(mn){
        if(appState!==mn.id) return;
        // spark along path edges
        if(animT%8===0){
          var m=nodeById(mn.id);
          var pm=ts(m.x,m.y),ph=ts(0,0);
          spawnParticle(ph.sx,ph.sy,pm.sx,pm.sy,mn.glow);
        }
      });
    }

    // Hover springs
    allNodes.forEach(function(n){
      var want=hovId===n.id?1.13:1;
      hovS[n.id]=(hovS[n.id]||1)+(want-(hovS[n.id]||1))*0.13;
    });
  }

  // ── Hit testing ───────────────────────────────────────────────
  function hitTest(mx,my){
    if(DS) return null;
    // Sub nodes
    var hit=null;
    GRAPH.main.forEach(function(mn){
      var mp=mainProg[mn.id]||0;if(mp<0.15)return;
      var m=nodeById(mn.id),mp2=ts(m.x,m.y);
      allNodes.filter(function(n){return n.parentId===mn.id;}).forEach(function(s){
        var p=ts(s.x,s.y);
        var ssx=mp2.sx+(p.sx-mp2.sx)*mp,ssy=mp2.sy+(p.sy-mp2.sy)*mp;
        if(Math.hypot(mx-ssx,my-ssy)<s.r*cam.z+6)hit=s;
      });
    });
    if(hit) return hit;
    // Main nodes
    for(var i=0;i<GRAPH.main.length;i++){
      var m=nodeById(GRAPH.main[i].id),p=ts(m.x,m.y);
      if(Math.hypot(mx-p.sx,my-p.sy)<m.r*cam.z+8)return m;
    }
    // Hub
    var hub=nodeById('hub'),hp=ts(hub.x,hub.y);
    if(Math.hypot(mx-hp.sx,my-hp.sy)<hub.r*cam.z+8)return hub;
    return null;
  }

  // ── Camera ────────────────────────────────────────────────────
  function setCamHome(){camT={x:0,y:0,z:Math.min(W,H)/900};}
  function setCamOnMain(id){
    var m=nodeById(id);
    camT={x:m.x,y:m.y,z:Math.min(W,H)/320};
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    init:function(canvasEl){
      canvas=canvasEl;ctx=canvas.getContext('2d');
      dpr=window.devicePixelRatio||1;
      W=canvas.parentElement.clientWidth;H=canvas.parentElement.clientHeight;
      canvas.width=W*dpr;canvas.height=H*dpr;
      canvas.style.width=W+'px';canvas.style.height=H+'px';
      ctx.scale(dpr,dpr);
      buildWorld();setCamHome();cam={x:camT.x,y:camT.y,z:camT.z};
      loop();
    },
    setHome:function(){appState='home';DS=null;setCamHome();},
    setSection:function(id){appState=id;setCamOnMain(id);},
    clearSubState:function(){},setSubState:function(){},
    animateTo:function(targetId,onComplete){
      DS=null;
      startDijkstra(targetId,function(id){
        setCamOnMain(id);
        if(onComplete)onComplete(id);
      });
    },
    spawnRipple:function(mx,my,color){ripples.push({x:mx,y:my,r:4,a:0.7,color:color||'#e8a020'});},
    onMouseMove:function(mx,my){if(DS)return null;var n=hitTest(mx,my);hovId=n?n.id:null;return n;},
    onMouseLeave:function(){hovId=null;},
    onClick:function(mx,my){if(DS)return null;return hitTest(mx,my);},
  };
}());
