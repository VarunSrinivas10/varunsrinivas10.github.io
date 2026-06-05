// ═══════════════════════════════════════════════════════════════
//  ui.js  —  Right-panel rendering and event wiring.
//            Reads PROFILE, GRAPH, CONTENT from data.js.
//            Calls GraphEngine from graph.js.
// ═══════════════════════════════════════════════════════════════

const UI = (() => {

  let openDetId = null;

  // ── Helpers ──────────────────────────────────────────────────
  function q(sel) { return document.querySelector(sel); }

  function showHome() {
    q('#view-home').style.display = 'block';
    q('#view-section').style.display = 'none';
    q('#view-section').innerHTML = '';
    q('#back-btn').classList.remove('vis');
    q('#graph-label').classList.remove('vis');
    openDetId = null;
  }

  function showSection(id) {
    q('#view-home').style.display = 'none';
    q('#view-section').style.display = 'block';
    q('#content-side').scrollTop = 0;
    q('#back-btn').classList.add('vis');
    const mn = GRAPH.main.find(m => m.id === id);
    q('#graph-label').textContent = (mn?.label || id).replace('\n', ' ');
    q('#graph-label').classList.add('vis');
    renderSection(id);
    openDetId = null;
  }

  // ── Home view ────────────────────────────────────────────────
  function renderHome() {
    const p = PROFILE;
    const nameLines = p.name.split('\n');
    const namePart1 = nameLines[0];
    const namePart2 = nameLines[1] || '';

    const links = p.links.map(l =>
      `<a class="h-link" href="${l.href}"${l.external ? ' target="_blank" rel="noopener"' : ''}>${l.label}</a>`
    ).join('');

    const navBtns = GRAPH.main.map(mn =>
      `<button class="nav-btn" onclick="UI.activateSection('${mn.id}')">${mn.label.replace('\n',' ')}</button>`
    ).join('');

    q('#view-home').innerHTML = `
      <p class="h-eyebrow">${p.eyebrow}</p>
      <h1 class="h-name">${namePart1}<br/><span>${namePart2}</span></h1>
      <p class="h-role">${p.role}</p>
      <p class="h-bio">${p.bio}</p>
      <div class="h-links">${links}</div>
      <p class="h-hint">Explore the graph — or jump to a section:</p>
      ${navBtns}
    `;
  }

  // ── Section renderers ────────────────────────────────────────
  function renderSection(id) {
    const sec = CONTENT[id];
    const vs  = q('#view-section');
    if (!sec) { vs.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding-top:2rem">Coming soon.</p>'; return; }

    const backBtn = `<button class="s-back" onclick="UI.goHome()">
      <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>All sections
    </button>`;

    let h = `${backBtn}
      <p class="s-eyebrow">${sec.eyebrow}</p>
      <h2 class="s-title">${sec.title}</h2>
      <p class="s-sub">${sec.sub}</p>`;

    if      (id === 'research') h += renderResearch(sec);
    else if (id === 'cv')       h += renderCV(sec);
    else if (id === 'media')    h += renderMedia(sec);

    vs.innerHTML = h;
  }

  function renderResearch(sec) {
    return sec.subsections.map(ss => `
      <div class="divider"></div>
      <p class="s-eyebrow" style="color:var(--blue)">${ss.tag}</p>
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

  function renderCV(sec) {
    const facts = sec.facts.map(f =>
      `<div class="fact-card"><p class="fk">${f.k}</p><p class="fv">${f.v.replace('\n','<br/>')}</p></div>`
    ).join('');

    const cvSecs = sec.cvSections.map(s => `
      <p class="cv-head">${s.head}</p>
      ${s.items.map(it => `
        <div class="cv-row">
          <span class="cv-yr"></span>
          <div class="cv-d"><strong>${it.title}</strong><span>${it.sub}</span></div>
        </div>
      `).join('')}
    `).join('');

    const pdf = sec.cvPdfPath
      ? `<hr class="divider"/><p style="font-size:.78rem;color:var(--muted)"><a href="${sec.cvPdfPath}" style="color:var(--blue)">Download full CV (PDF) →</a></p>`
      : '';

    return `<div class="fact-grid">${facts}</div>${cvSecs}${pdf}`;
  }

  function renderMedia(sec) {
    const rows = (items, tag) => items.map(it =>
      `<div class="mrow">
        <p class="mrow-tag">${tag}</p>
        <p class="mrow-title">${it.title}</p>
        <p class="mrow-sub">${it.sub}</p>
      </div>`
    ).join('');

    return `
      <p class="cv-head">Notes</p>
      ${rows(sec.notes, 'Note')}
      <p class="cv-head">Videos worth watching</p>
      ${rows(sec.videos, 'YouTube')}
      <p class="cv-head">Books</p>
      ${rows(sec.books, 'Book')}
    `;
  }

  // ── Detail expansion ─────────────────────────────────────────
  function getAllResearchItems() {
    return (CONTENT.research?.subsections || []).flatMap(s => s.items);
  }

  // ── Mouse event wiring ───────────────────────────────────────
  function wireCanvas(canvasEl) {
    const tt = q('#tooltip');

    canvasEl.addEventListener('mousemove', e => {
      const r  = canvasEl.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const n  = GraphEngine.onMouseMove(mx, my);
      canvasEl.style.cursor = n ? 'pointer' : 'default';
      if (n && (n.type === 'leaf' || n.type === 'sub')) {
        tt.textContent    = n.label.replace('\n', ' · ');
        tt.style.left     = (e.clientX + 16) + 'px';
        tt.style.top      = (e.clientY - 10) + 'px';
        tt.style.opacity  = '1';
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
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const n  = GraphEngine.onClick(mx, my);
      GraphEngine.spawnRipple(mx, my, n?.glow || n?.color || '#e8a020');

      if (!n)               { UI.goHome(); return; }
      if (n.type === 'hub') { UI.goHome(); return; }

      if (n.type === 'main') {
        if (currentSection === n.id) UI.goHome();
        else UI.activateSection(n.id);
        return;
      }

      if (n.type === 'sub') {
        const wasActive = currentSubState === n.id;
        currentSubState = wasActive ? null : n.id;
        if (wasActive) { GraphEngine.clearSubState(); }
        else {
          GraphEngine.setSubState(n.id);
          UI.activateSection(n.parentId);
          // scroll to subsection
          setTimeout(() => {
            const sec = CONTENT[n.parentId];
            if (sec?.subsections) {
              const ss = sec.subsections.find(s => s.id === n.id);
              if (ss?.items?.length) {
                const el = document.getElementById('card_' + ss.items[0].id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }
          }, 120);
        }
        return;
      }

      if (n.type === 'leaf') {
        GraphEngine.setSubState(n.parentId);
        currentSubState = n.parentId;
        UI.activateSection(n.grandParentId);
        setTimeout(() => {
          const sec = CONTENT[n.grandParentId];
          if (sec?.subsections) {
            const ss = sec.subsections.find(s => s.id === n.parentId);
            if (ss?.items?.[n.idx]) {
              UI.toggleDetail(ss.items[n.idx].id, n.grandParentId);
            }
          }
        }, 150);
      }
    });
  }

  // ── State tracking ───────────────────────────────────────────
  let currentSection  = 'home';
  let currentSubState = null;

  // ── Public API ───────────────────────────────────────────────
  return {

    init() {
      renderHome();
      const canvasEl = q('#graph-canvas');
      GraphEngine.init(canvasEl);
      wireCanvas(canvasEl);
      q('#back-btn').addEventListener('click', () => UI.goHome());
    },

    goHome() {
      currentSection = 'home'; currentSubState = null;
      GraphEngine.setHome();
      GraphEngine.clearSubState();
      showHome();
    },

    activateSection(id) {
      currentSection = id;
      GraphEngine.setSection(id);
      showSection(id);
    },

    toggleDetail(itemId, secId) {
      const det  = document.getElementById('det_' + itemId);
      const card = document.getElementById('card_' + itemId);
      if (!det) return;

      if (openDetId === itemId) {
        det.style.display = 'none';
        if (card) card.classList.remove('active');
        openDetId = null;
        return;
      }

      // Close previous
      if (openDetId) {
        const pd = document.getElementById('det_' + openDetId);
        const pc = document.getElementById('card_' + openDetId);
        if (pd) pd.style.display = 'none';
        if (pc) pc.classList.remove('active');
      }
      openDetId = itemId;
      if (card) card.classList.add('active');

      // Find item
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
