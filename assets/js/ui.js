// ═══════════════════════════════════════════════════════════════
//  ui.js  —  Right-panel rendering and event wiring.
//            Reads PROFILE, GRAPH, CONTENT from data.js.
//            Calls GraphEngine from graph.js.
// ═══════════════════════════════════════════════════════════════

const UI = (() => {

  let openDetId      = null;
  let currentSection = 'home';
  let currentSub     = null;

  // ── Tiny helpers ─────────────────────────────────────────────
  function q(sel) { return document.querySelector(sel); }

  function scrollTo(id, delay) {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, delay || 0);
  }

  // ── Show / hide views ────────────────────────────────────────
  function showHome() {
    q('#view-home').style.display    = 'block';
    q('#view-section').style.display = 'none';
    q('#view-section').innerHTML     = '';
    q('#back-btn').classList.remove('vis');
    q('#graph-label').classList.remove('vis');
    openDetId = null;
  }

  // Render a section. If scrollTargetId is provided, scroll there
  // after render instead of resetting to top.
  function showSection(id, scrollTargetId) {
    q('#view-home').style.display    = 'none';
    q('#view-section').style.display = 'block';
    q('#back-btn').classList.add('vis');
    const mn = GRAPH.main.find(m => m.id === id);
    q('#graph-label').textContent = (mn?.label || id).replace('\n', ' ');
    q('#graph-label').classList.add('vis');

    // Only reset scroll when navigating to a fresh section top-level
    if (!scrollTargetId) q('#content-side').scrollTop = 0;

    renderSection(id);
    openDetId = null;

    if (scrollTargetId) scrollTo(scrollTargetId, 80);
  }

  // ── Home ─────────────────────────────────────────────────────
  function renderHome() {
    const p = PROFILE;
    const [n1, n2] = p.name.split('\n');

    const photoHtml = p.photo
      ? `<img src="${p.photo}" alt="${n1} ${n2||''}" class="h-photo"/>`
      : '';

    const links = p.links.map(l =>
      `<a class="h-link" href="${l.href}"${l.external ? ' target="_blank" rel="noopener"' : ''}>${l.label}</a>`
    ).join('');

    const navBtns = GRAPH.main.map(mn =>
      `<button class="nav-btn" onclick="UI.activateSection('${mn.id}')">${mn.label.replace('\n',' ')}</button>`
    ).join('');

    q('#view-home').innerHTML = `
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
  function renderSection(id) {
    const sec = CONTENT[id];
    const vs  = q('#view-section');
    if (!sec) {
      vs.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding-top:2rem">Coming soon.</p>';
      return;
    }

    const back = `<button class="s-back" onclick="UI.goHome()">
      <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>All sections
    </button>`;

    let h = `${back}
      <p class="s-eyebrow">${sec.eyebrow}</p>
      <h2 class="s-title">${sec.title}</h2>
      <p class="s-sub">${sec.sub}</p>`;

    if      (id === 'research') h += renderResearch(sec);
    else if (id === 'cv')       h += renderCV(sec);
    else if (id === 'media')    h += renderMedia(sec);

    vs.innerHTML = h;
  }

  // ── Research ─────────────────────────────────────────────────
  function renderResearch(sec) {
    return sec.subsections.map(ss => `
      <div class="divider"></div>
      <p class="s-eyebrow" style="color:var(--blue)" id="rs_${ss.id}">${ss.tag}</p>
      <p class="subsec-head">${ss.title}</p>
      <p class="subsec-sub">${ss.sub}</p>
      ${ss.items.map(it => `
        <div class="icard" id="card_${it.id}" onclick="UI.toggleDetail('${it.id}','research')">
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
  function renderCV(sec) {
    const facts = sec.facts.map(f =>
      `<div class="fact-card"><p class="fk">${f.k}</p><p class="fv">${f.v.replace('\n','<br/>')}</p></div>`
    ).join('');

    // Each cvSection gets an anchor id: cv_edu, cv_pubs, cv_teach, cv_skills,
    // cv_posters, cv_awards, cv_grants — matching the sub-node ids in data.js
    const cvSecs = sec.cvSections.map(s => `
      <p class="cv-head" id="${s.anchorId || ''}">${s.head}</p>
      ${s.items.map(it => `
        <div class="cv-row">
          <span class="cv-yr">${it.year || ''}</span>
          <div class="cv-d"><strong>${it.title}</strong><span>${it.sub}</span></div>
        </div>
      `).join('')}
    `).join('');

    const pdf = sec.cvPdfPath
      ? `<hr class="divider"/><p style="font-size:.78rem;color:var(--muted)"><a href="${sec.cvPdfPath}" style="color:var(--blue)">Download full CV (PDF) →</a></p>`
      : '';

    return `<div id="cv_edu"></div><div class="fact-grid">${facts}</div>${cvSecs}${pdf}`;
  }

  // ── Media ────────────────────────────────────────────────────
  function renderMedia(sec) {
    const rows = (items, tag) => items.map(it =>
      `<div class="mrow">
        <p class="mrow-tag">${tag}</p>
        <p class="mrow-title">${it.title}</p>
        <p class="mrow-sub">${it.sub}</p>
      </div>`
    ).join('');

    return `
      <p class="cv-head" id="m_notes">Notes</p>
      ${rows(sec.notes, 'Note')}
      <p class="cv-head" id="m_videos">Videos worth watching</p>
      ${rows(sec.videos, 'YouTube')}
      <p class="cv-head" id="m_books">Books</p>
      ${rows(sec.books, 'Book')}
    `;
  }

  // ── Detail cards (Research) ───────────────────────────────────
  function getAllResearchItems() {
    return (CONTENT.research?.subsections || []).flatMap(s => s.items);
  }

  // ── Sub/leaf scroll resolution ────────────────────────────────
  // Returns the DOM element id to scroll to for a given sub-node click.
  // For research: the subsection eyebrow. For cv/media: the anchor id
  // which matches sub-node ids directly (cv_edu, m_notes, etc.)
  function anchorForSub(parentId, subId) {
    if (parentId === 'research') {
      const ss = CONTENT.research?.subsections?.find(s => s.id === subId);
      return ss ? 'rs_' + ss.id : null;
    }
    // cv and media sub-node ids are used directly as anchor ids
    return subId;
  }

  // Returns anchor id for a leaf click (grandParent = main section id)
  function anchorForLeaf(grandParentId, parentId) {
    if (grandParentId === 'research') return 'rs_' + parentId;
    return parentId; // cv_edu, cv_pubs, m_notes, etc. — same as sub id
  }

  // ── Canvas event wiring ───────────────────────────────────────
  function wireCanvas(canvasEl) {
    const tt = q('#tooltip');

    canvasEl.addEventListener('mousemove', e => {
      const r  = canvasEl.getBoundingClientRect();
      const n  = GraphEngine.onMouseMove(e.clientX - r.left, e.clientY - r.top);
      canvasEl.style.cursor = n ? 'pointer' : 'default';
      if (n && (n.type === 'leaf' || n.type === 'sub')) {
        tt.textContent   = n.label.replace('\n', ' · ');
        tt.style.left    = (e.clientX + 16) + 'px';
        tt.style.top     = (e.clientY - 10) + 'px';
        tt.style.opacity = '1';
      } else {
        tt.style.opacity = '0';
      }
    });

    canvasEl.addEventListener('mouseleave', () => {
      GraphEngine.onMouseLeave();
      canvasEl.style.cursor = 'default';
      tt.style.opacity = '0';
    });

    canvasEl.addEventListener('click', e => {
      const r  = canvasEl.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const n  = GraphEngine.onClick(mx, my);
      GraphEngine.spawnRipple(mx, my, n?.glow || n?.color || '#e8a020');

      if (!n || n.type === 'hub') { UI.goHome(); return; }

      if (n.type === 'main') {
        if (currentSection === n.id) UI.goHome();
        else UI.activateSection(n.id);
        return;
      }

      if (n.type === 'sub') {
        const wasActive = currentSub === n.id;
        currentSub = wasActive ? null : n.id;
        if (wasActive) {
          GraphEngine.clearSubState();
        } else {
          GraphEngine.setSubState(n.id);
          const anchor = anchorForSub(n.parentId, n.id);
          // If we're already on the right section, just scroll.
          // Otherwise switch section and then scroll.
          if (currentSection === n.parentId) {
            if (anchor) scrollTo(anchor, 60);
          } else {
            UI.activateSectionAt(n.parentId, anchor);
          }
        }
        return;
      }

      if (n.type === 'leaf') {
        GraphEngine.setSubState(n.parentId);
        currentSub = n.parentId;
        const anchor = anchorForLeaf(n.grandParentId, n.parentId);

        if (currentSection === n.grandParentId) {
          // Section already shown — scroll and open detail if research
          if (n.grandParentId === 'research') {
            const ss = CONTENT.research?.subsections?.find(s => s.id === n.parentId);
            if (ss?.items?.[n.idx]) UI.toggleDetail(ss.items[n.idx].id, 'research');
          } else {
            if (anchor) scrollTo(anchor, 60);
          }
        } else {
          if (n.grandParentId === 'research') {
            UI.activateSectionAt(n.grandParentId, null);
            setTimeout(() => {
              const ss = CONTENT.research?.subsections?.find(s => s.id === n.parentId);
              if (ss?.items?.[n.idx]) UI.toggleDetail(ss.items[n.idx].id, 'research');
            }, 180);
          } else {
            UI.activateSectionAt(n.grandParentId, anchor);
          }
        }
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────
  return {

    init() {
      renderHome();
      const canvasEl = q('#graph-canvas');
      GraphEngine.init(canvasEl);
      wireCanvas(canvasEl);
      q('#back-btn').addEventListener('click', () => UI.goHome());
    },

    goHome() {
      currentSection = 'home'; currentSub = null;
      GraphEngine.setHome(); GraphEngine.clearSubState();
      showHome();
    },

    // Activate section, scroll to top
    activateSection(id) {
      currentSection = id;
      GraphEngine.setSection(id);
      showSection(id, null);
    },

    // Activate section and scroll to a specific anchor inside it
    activateSectionAt(id, anchorId) {
      currentSection = id;
      GraphEngine.setSection(id);
      showSection(id, anchorId);
    },

    toggleDetail(itemId) {
      const det  = document.getElementById('det_' + itemId);
      const card = document.getElementById('card_' + itemId);
      if (!det) return;

      if (openDetId === itemId) {
        det.style.display = 'none';
        if (card) card.classList.remove('active');
        openDetId = null;
        return;
      }
      if (openDetId) {
        const pd = document.getElementById('det_' + openDetId);
        const pc = document.getElementById('card_' + openDetId);
        if (pd) pd.style.display = 'none';
        if (pc) pc.classList.remove('active');
      }
      openDetId = itemId;
      if (card) card.classList.add('active');

      const item = getAllResearchItems().find(i => i.id === itemId);
      if (!item?.detail) return;
      const d = item.detail;
      const links = d.links?.length
        ? `<div class="det-links">${d.links.map(l => `<a class="det-link" href="${l.href}" target="_blank">${l.label}</a>`).join('')}</div>`
        : '';

      det.innerHTML = `<div class="detbox">
        <p class="det-title">${item.title}</p>
        ${d.authors ? `<p class="det-authors">${d.authors}</p>` : ''}
        ${d.venue   ? `<p class="det-venue">${d.venue}</p>`     : ''}
        <p class="det-body">${d.body}</p>
        ${links}
      </div>`;
      det.style.display = 'block';
      setTimeout(() => det.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    },
  };
})();
