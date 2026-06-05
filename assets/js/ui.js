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

    // id map so sub/leaf node clicks can scroll to the right section
    const headIds = { Publications: 'cvhead_pubs', Teaching: 'cvhead_teach', Skills: 'cvhead_skills' };
    const cvSecs = sec.cvSections.map(s => `
      <p class="cv-head" id="${headIds[s.head] || 'cvhead_' + s.head.toLowerCase()}">${s.head}</p>
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

    // Education anchor sits above the fact-grid (cv_edu sub-node scrolls here)
    return `<div id="cvhead_edu"></div><div class="fact-grid">${facts}</div>${cvSecs}${pdf}`;
  }

  function renderMedia(sec) {
    const rows = (items, tag) => items.map(it =>
      `<div class="mrow">
        <p class="mrow-tag">${tag}</p>
        <p class="mrow-title">${it.title}</p>
        <p class="mrow-sub">${it.sub}</p>
      </div>`
    ).join('');

    // anchor ids match the mediaMap in scrollToSubNode / scrollToLeafNode
    return `
      <p class="cv-head" id="media_notes">Notes</p>
      ${rows(sec.notes, 'Note')}
      <p class="cv-head" id="media_videos">Videos worth watching</p>
      ${rows(sec.videos, 'YouTube')}
      <p class="cv-head" id="media_books">Books</p>
      ${rows(sec.books, 'Book')}
    `;
  }

  // ── Detail expansion ─────────────────────────────────────────
  function getAllResearchItems() {
    return (CONTENT.research?.subsections || []).flatMap(s => s.items);
  }

  // ── Scroll helpers (sub and leaf clicks for all sections) ────

  // Maps sub-node id → the anchor element id to scroll to on the right panel
  function scrollToSubNode(parentId, subId) {
    // Research: scroll to first card of that subsection
    if (parentId === 'research') {
      const sec = CONTENT.research;
      const ss  = sec?.subsections?.find(s => s.id === subId);
      const el  = ss?.items?.length ? document.getElementById('card_' + ss.items[0].id) : null;
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    // CV: scroll to the matching cv-head by data attribute
    if (parentId === 'cv') {
      const headMap = { cv_edu: 'edu', cv_pubs: 'pubs', cv_teach: 'teach', cv_skills: 'skills' };
      const el = document.getElementById('cvhead_' + (headMap[subId] || subId));
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    // Media: scroll to the matching media section head
    if (parentId === 'media') {
      const mediaMap = { m_notes: 'media_notes', m_videos: 'media_videos', m_books: 'media_books' };
      const el = document.getElementById(mediaMap[subId]);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
  }

  // Maps leaf click → scroll + optional detail open
  function scrollToLeafNode(grandParentId, parentId, leafIdx) {
    if (grandParentId === 'research') {
      const sec = CONTENT.research;
      const ss  = sec?.subsections?.find(s => s.id === parentId);
      if (ss?.items?.[leafIdx]) {
        UI.toggleDetail(ss.items[leafIdx].id, grandParentId);
      }
      return;
    }
    if (grandParentId === 'cv') {
      const headMap = { cv_edu: 'edu', cv_pubs: 'pubs', cv_teach: 'teach', cv_skills: 'skills' };
      const el = document.getElementById('cvhead_' + (headMap[parentId] || parentId));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (grandParentId === 'media') {
      const mediaMap = { m_notes: 'media_notes', m_videos: 'media_videos', m_books: 'media_books' };
      const el = document.getElementById(mediaMap[parentId]);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
          setTimeout(() => scrollToSubNode(n.parentId, n.id), 120);
        }
        return;
      }

      if (n.type === 'leaf') {
        GraphEngine.setSubState(n.parentId);
        currentSubState = n.parentId;
        UI.activateSection(n.grandParentId);
        setTimeout(() => scrollToLeafNode(n.grandParentId, n.parentId, n.idx), 150);
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
