// ═══════════════════════════════════════════════════════════════
//  ui.js — Right-panel rendering, YouTube thumbnails, image galleries
// ═══════════════════════════════════════════════════════════════

var UI = (() => {

  let openDetId      = null;
  let currentSection = 'home';

  function q(sel){ return document.querySelector(sel); }

  function scrollTo(id, delay){
    setTimeout(()=>{
      const el=document.getElementById(id);
      if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    }, delay||0);
  }

  // ── Show / hide ──────────────────────────────────────────────
  function showHome(){
    q('#view-home').style.display='block';
    q('#view-section').style.display='none';
    q('#view-section').innerHTML='';
    q('#back-btn').classList.remove('vis');
    q('#graph-label').classList.remove('vis');
    openDetId=null;
  }

  function showSection(id, scrollTargetId){
    q('#view-home').style.display='none';
    q('#view-section').style.display='block';
    q('#back-btn').classList.add('vis');
    const mn=GRAPH.main.find(m=>m.id===id);
    q('#graph-label').textContent=(mn?.label||id).replace('\n',' ');
    q('#graph-label').classList.add('vis');
    if(!scrollTargetId) q('#content-side').scrollTop=0;
    renderSection(id);
    openDetId=null;
    if(scrollTargetId) scrollTo(scrollTargetId, 80);
  }

  // ── Home ─────────────────────────────────────────────────────
  function renderHome(){
    const p=PROFILE;
    const [n1,n2]=p.name.split('\n');
    const photoHtml=p.photo
      ?`<img src="${p.photo}" alt="${n1}" class="h-photo" onerror="this.style.display='none'"/>`
      :'';
    const links=p.links.map(l=>
      `<a class="h-link" href="${l.href}"${l.external?' target="_blank" rel="noopener"':''}>${l.label}</a>`
    ).join('');
    const navBtns=GRAPH.main.map(mn=>
      `<button class="nav-btn" onclick="UI.activateSection('${mn.id}')">${mn.label.replace('\n',' ')}</button>`
    ).join('');
    q('#view-home').innerHTML=`
      ${photoHtml}
      <p class="h-eyebrow">${p.eyebrow}</p>
      <h1 class="h-name">${n1}<br/><span>${n2||''}</span></h1>
      <p class="h-role">${p.role}</p>
      <p class="h-bio">${p.bio}</p>
      <div class="h-links">${links}</div>
      <p class="h-hint">Explore the graph — or jump to a section:</p>
      ${navBtns}
    `;
  }

  // ── Section router ───────────────────────────────────────────
  function renderSection(id){
    const sec=CONTENT[id];
    const vs=q('#view-section');
    if(!sec){vs.innerHTML='<p style="color:var(--muted);padding-top:2rem;font-size:.85rem">Coming soon.</p>';return;}
    const back=`<button class="s-back" onclick="UI.goHome()">
      <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>All sections
    </button>`;
    let h=`${back}
      <p class="s-eyebrow">${sec.eyebrow}</p>
      <h2 class="s-title">${sec.title}</h2>
      <p class="s-sub">${sec.sub}</p>`;
    if     (id==='research') h+=renderResearch(sec);
    else if(id==='cv')       h+=renderCV(sec);
    else if(id==='media')    h+=renderMedia(sec);
    vs.innerHTML=h;
  }

  // ── Research ─────────────────────────────────────────────────
  function renderResearch(sec){
    return sec.subsections.map(ss=>`
      <div class="divider"></div>
      <p class="s-eyebrow" style="color:var(--blue)" id="rs_${ss.id}">${ss.tag}</p>
      <p class="subsec-head">${ss.title}</p>
      <p class="subsec-sub">${ss.sub}</p>
      ${ss.items.map(it=>`
        <div class="icard" id="card_${it.id}" onclick="UI.toggleDetail('${it.id}')">
          <p class="ic-tag">${it.tag}</p>
          <p class="ic-title">${it.title}</p>
          <p class="ic-sub">${it.sub}</p>
          <span class="ic-arr">›</span>
        </div>
        <div id="det_${it.id}" style="display:none"></div>
      `).join('')}
    `).join('');
  }

  // ── CV ───────────────────────────────────────────────────────
  function renderCV(sec){
    const facts=sec.facts.map(f=>
      `<div class="fact-card"><p class="fk">${f.k}</p><p class="fv">${f.v.replace('\n','<br/>')}</p></div>`
    ).join('');
    const cvSecs=sec.cvSections.map(s=>`
      <p class="cv-head" id="${s.anchorId||''}">${s.head}</p>
      ${s.items.map(it=>`
        <div class="cv-row">
          <span class="cv-yr">${it.year||''}</span>
          <div class="cv-d"><strong>${it.title}</strong><span>${it.sub}</span></div>
        </div>
      `).join('')}
    `).join('');
    const pdf=sec.cvPdfPath
      ?`<hr class="divider"/><p style="font-size:.78rem;color:var(--muted)"><a href="${sec.cvPdfPath}" style="color:var(--blue)">Download full CV (PDF) →</a></p>`:'';
    return `<div id="cv_edu"></div><div class="fact-grid">${facts}</div>${cvSecs}${pdf}`;
  }

  // ── Media ────────────────────────────────────────────────────
  function renderMedia(sec){
    const notes=sec.notes.map(it=>
      `<div class="mrow"><p class="mrow-tag">Note</p><p class="mrow-title">${it.title}</p><p class="mrow-sub">${it.sub}</p></div>`
    ).join('');

    // YouTube thumbnails: extract video id and show thumbnail image
    const videos=sec.videos.map(it=>{
      const ytId=extractYouTubeId(it.url||'');
      const thumb=ytId
        ?`<a href="${it.url}" target="_blank" rel="noopener" class="yt-thumb-wrap">
            <img src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg" alt="${it.title}" class="yt-thumb" loading="lazy"/>
            <span class="yt-play">▶</span>
          </a>`
        :'';
      return `<div class="yt-card">
        ${thumb}
        <div class="yt-info">
          <p class="mrow-tag">YouTube</p>
          <p class="mrow-title">${it.title}</p>
          <p class="mrow-sub">${it.sub}</p>
          ${it.url?`<a href="${it.url}" target="_blank" rel="noopener" class="det-link" style="margin-top:.5rem;display:inline-block">Watch →</a>`:''}
        </div>
      </div>`;
    }).join('');

    const books=sec.books.map(it=>
      `<div class="mrow"><p class="mrow-tag">Book</p><p class="mrow-title">${it.title}</p><p class="mrow-sub">${it.sub}</p></div>`
    ).join('');

    return `
      <p class="cv-head" id="m_notes">Notes</p>${notes}
      <p class="cv-head" id="m_videos">Videos worth watching</p>
      <div class="yt-grid">${videos}</div>
      <p class="cv-head" id="m_books">Books</p>${books}
    `;
  }

  function extractYouTubeId(url){
    if(!url) return null;
    const m=url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m?m[1]:null;
  }

  // ── Detail expansion (Research) ──────────────────────────────
  function getAllResearchItems(){
    return (CONTENT.research?.subsections||[]).flatMap(s=>s.items);
  }

  // ── Scroll anchor resolution ─────────────────────────────────
  // Sub-node id IS the anchor id for cv/media; for research use rs_ prefix
  function anchorForSub(parentId, subId){
    if(parentId==='research'){
      const ss=CONTENT.research?.subsections?.find(s=>s.id===subId);
      return ss?'rs_'+ss.id:null;
    }
    return subId; // cv_edu, cv_pubs, m_notes, etc.
  }

  function anchorForLeaf(grandParentId, parentId){
    if(grandParentId==='research') return 'rs_'+parentId;
    return parentId;
  }

  // ── Canvas event wiring ───────────────────────────────────────
  function wireCanvas(canvasEl){
    const tt=q('#tooltip');

    canvasEl.addEventListener('mousemove',e=>{
      const r=canvasEl.getBoundingClientRect();
      const n=GraphEngine.onMouseMove(e.clientX-r.left,e.clientY-r.top);
      canvasEl.style.cursor=n?'pointer':'default';
      if(n&&n.type==='sub'){
        tt.textContent=n.label.replace('\n',' · ');
        tt.style.left=(e.clientX+16)+'px'; tt.style.top=(e.clientY-10)+'px';
        tt.style.opacity='1';
      } else tt.style.opacity='0';
    });

    canvasEl.addEventListener('mouseleave',()=>{
      GraphEngine.onMouseLeave();
      canvasEl.style.cursor='default';
      tt.style.opacity='0';
    });

    canvasEl.addEventListener('click',e=>{
      const r=canvasEl.getBoundingClientRect();
      const mx=e.clientX-r.left, my=e.clientY-r.top;
      const n=GraphEngine.onClick(mx,my);
      if(!n) { UI.goHome(); return; }
      GraphEngine.spawnRipple(mx,my,n?.glow||n?.color||'#e8a020');
      if(n.type==='hub'){ UI.goHome(); return; }

      if(n.type==='main'){
        if(currentSection===n.id){ UI.goHome(); return; }
        // Dijkstra animation then activate
        GraphEngine.animateTo(n.id, (id)=>{ UI.activateSection(id); });
        return;
      }

      if(n.type==='sub'){
        const anchor=anchorForSub(n.parentId,n.id);
        if(currentSection===n.parentId){
          if(anchor) scrollTo(anchor,60);
        } else {
          GraphEngine.animateTo(n.parentId,(id)=>{ UI.activateSectionAt(id,anchor); });
        }
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    init(){
      renderHome();
      const canvasEl=q('#graph-canvas');
      GraphEngine.init(canvasEl);
      wireCanvas(canvasEl);
      q('#back-btn').addEventListener('click',()=>UI.goHome());
    },

    goHome(){
      currentSection='home';
      GraphEngine.setHome();
      showHome();
    },

    activateSection(id){
      currentSection=id;
      GraphEngine.setSection(id);
      showSection(id,null);
    },

    activateSectionAt(id,anchorId){
      currentSection=id;
      GraphEngine.setSection(id);
      showSection(id,anchorId);
    },

    toggleDetail(itemId){
      const det=document.getElementById('det_'+itemId);
      const card=document.getElementById('card_'+itemId);
      if(!det) return;
      if(openDetId===itemId){
        det.style.display='none';
        if(card) card.classList.remove('active');
        openDetId=null; return;
      }
      if(openDetId){
        const pd=document.getElementById('det_'+openDetId);
        const pc=document.getElementById('card_'+openDetId);
        if(pd) pd.style.display='none'; if(pc) pc.classList.remove('active');
      }
      openDetId=itemId;
      if(card) card.classList.add('active');
      const item=getAllResearchItems().find(i=>i.id===itemId);
      if(!item?.detail) return;
      const d=item.detail;

      // Image gallery
      const gallery=d.images?.length
        ?`<div class="img-gallery">${d.images.map(src=>
            `<img src="${src}" class="gallery-img" loading="lazy" onerror="this.style.display='none'"/>`
          ).join('')}</div>`:'';

      const links=d.links?.length
        ?`<div class="det-links">${d.links.map(l=>`<a class="det-link" href="${l.href}" target="_blank">${l.label}</a>`).join('')}</div>`:'';

      det.innerHTML=`<div class="detbox">
        <p class="det-title">${item.title}</p>
        ${d.authors?`<p class="det-authors">${d.authors}</p>`:''}
        ${d.venue?`<p class="det-venue">${d.venue}</p>`:''}
        <p class="det-body">${d.body}</p>
        ${gallery}
        ${links}
      </div>`;
      det.style.display='block';
      setTimeout(()=>det.scrollIntoView({behavior:'smooth',block:'nearest'}),60);
    },
  };
})();
