// ═══════════════════════════════════════════════════════════════
//  data.js  —  EDIT THIS FILE TO UPDATE YOUR SITE
// ═══════════════════════════════════════════════════════════════

const PROFILE = {
  eyebrow: 'Materials Science · University of Michigan',
  name:    'Varun S.\nVenkatesh',
  role:    'PhD Candidate · Shahani Lab · Ann Arbor, MI',
  bio:     'I study how <strong>grain boundaries</strong> move, vanish, and transform in three dimensions — combining synchrotron diffraction contrast tomography with <strong>graph neural networks</strong> to turn polycrystalline microstructures into learnable graphs. My work lives at the intersection of experiment, computation, and materials theory.',
  // Set to your photo path e.g. 'assets/img/profile.jpg', or null to hide
  photo: 'assets/img/profile.jpg',
  links: [
    { label: 'varunsv@umich.edu', href: 'mailto:varunsv@umich.edu' },
    { label: 'Google Scholar',    href: 'https://scholar.google.com', external: true },
    { label: 'GitHub',            href: 'https://github.com',         external: true },
    { label: 'ORCID',             href: 'https://orcid.org',          external: true },
    { label: 'LinkedIn',          href: 'https://linkedin.com',       external: true },
  ],
};

// ── GRAPH STRUCTURE ─────────────────────────────────────────────
// Sub-node ids MUST match the anchor ids used in renderCV / renderMedia.
// For CV:   cv_edu, cv_pubs, cv_teach, cv_skills, cv_posters, cv_awards, cv_grants
// For Media: m_notes, m_videos, m_books

const GRAPH = {
  hub: { label: 'VSV', fullLabel: 'Varun\nVenkatesh', color: '#e8a020', glow: '#f0c060' },

  main: [
    { id: 'research', label: 'Research',         angle: 270, color: '#3a6ea8', glow: '#5a90cc' },
    { id: 'cv',       label: 'CV',               angle: 30,  color: '#2a7a6a', glow: '#4aaa8a' },
    { id: 'media',    label: 'Media &\nReading', angle: 150, color: '#8a3a4a', glow: '#c05a6a' },
  ],

  sub: {
    research: [
      { id: 'r_theory', label: 'Theory &\nKinetics',  color: '#5a3a7a', glow: '#8a6ab0' },
      { id: 'r_algo',   label: 'Algorithm\nDev',       color: '#3a6ea8', glow: '#5a90cc' },
      { id: 'r_nn',     label: 'Neural\nNetworks',     color: '#2a7a6a', glow: '#4aaa8a' },
    ],
    cv: [
      { id: 'cv_edu',     label: 'Education',    color: '#2a7a6a', glow: '#4aaa8a' },
      { id: 'cv_pubs',    label: 'Publications', color: '#3a6ea8', glow: '#5a90cc' },
      { id: 'cv_posters', label: 'Posters &\nTalks',   color: '#5a3a7a', glow: '#8a6ab0' },
      { id: 'cv_awards',  label: 'Awards &\nGrants',   color: '#8a5a2a', glow: '#c08a4a' },
    ],
    media: [
      { id: 'm_notes',  label: 'Notes',  color: '#8a3a4a', glow: '#c05a6a' },
      { id: 'm_videos', label: 'Videos', color: '#5a3a7a', glow: '#8a6ab0' },
      { id: 'm_books',  label: 'Books',  color: '#3a6a3a', glow: '#5aaa5a' },
    ],
  },

  leaves: {
    r_theory:  ['GB Kinetics\nDerivation', 'Kelvin Cell\nGeometry', 'Triple-Line\nDrag'],
    r_algo:    ['PolyProc\nPipeline',      'MATLAB\nViz',           'DCT\nRecon.'],
    r_nn:      ['GNN\nPaper',              'Feature\nEngineering',  'Graph\nTracking'],
    cv_edu:    ['PhD\n2021–now',           'BS\n2017–21'],
    cv_pubs:   ['IOP\n2025',              'Acta\n2025',             'RexGG\n2025'],
    cv_posters:['RexGG\n2025',            'Add\nTalk'],
    cv_awards: ['Add\nAward',             'Add\nGrant'],
    m_notes:   ['GB in 3D',              'GNNs for\nMicro',        'Kruskal-\nWallis'],
    m_videos:  ['3Blue1Brown',           'Veritasium',             'MIT OCW'],
    m_books:   ['Craft of\nResearch',    'Thinking\nFast & Slow',  'Structure\nof Science'],
  },
};

// ── SECTION CONTENT ─────────────────────────────────────────────

const CONTENT = {

  // ── RESEARCH ────────────────────────────────────────────────
  research: {
    eyebrow: 'Research',
    title:   'Research Projects',
    sub:     'Three interconnected themes: building theory, developing algorithms, and deploying neural networks on polycrystalline microstructures.',
    subsections: [
      {
        id: 'r_theory', tag: 'Theory & Kinetics',
        title: 'Grain Boundary Kinetics', sub: 'Analytical derivations for 3D grain boundary motion',
        items: [
          { id: 'rt1', tag: 'Derivation',
            title: 'Grain Boundary Kinetics (3D Kelvin Cell)',
            sub:   'Extension of Mattissen et al. (2005) to 3D',
            detail: { authors: null, venue: 'Ongoing analytical work',
              body: 'Extension of the Mattissen et al. (2005) framework to 3D using Kelvin cell geometry. Derives corrected grain boundary velocity accounting for triple-line drag and quadruple node drag. V_corr = V_free · √3 K_TL / (√3 K_TL + 2), subject to a self-consistency condition.',
              links: [] } },
        ],
      },
      {
        id: 'r_algo', tag: 'Algorithm Development',
        title: 'Computational Methods', sub: 'Pipelines for microstructural feature extraction and 3D visualization',
        items: [
          { id: 'ra1', tag: 'Pipeline',
            title: 'MoO₃/Fe₂O₃ 3D Visualization Pipeline',
            sub:   'MATLAB — synchrotron tomography registration and rendering',
            detail: { authors: null, venue: 'Ongoing · Synchrotron tomography',
              body: 'MATLAB pipeline for co-registering pre- and post-reaction synchrotron tomography datasets via log-polar FFT and phase correlation. Isosurface rendering with custom RGB colors: MoO₃ [172 221 233]/255, Fe₂O₃ [219 107 134]/255, product phase [247 169 85]/255. Custom depth-sorting and slab volume renders with glass transparency.',
              links: [] } },
          { id: 'ra2', tag: 'Reconstruction',
            title: 'Al–Al₃Ni Nanotomography (FXI beamline, NSLS-II)',
            sub:   'Prior-constrained silhouette carving for eutectic microstructures',
            detail: { authors: null, venue: 'NSLS-II · FXI beamline',
              body: 'Prior-constrained silhouette carving for 3D reconstruction of Al–Al₃Ni eutectic microstructures. Targets quantitative characterization of lamellar phase morphology in directionally solidified samples.',
              links: [] } },
        ],
      },
      {
        id: 'r_nn', tag: 'Neural Networks',
        title: 'Machine Learning on Grain Boundary Graphs', sub: 'GNNs and statistical feature selection for GB kinetics',
        items: [
          { id: 'rn1', tag: 'Journal · 2025 (submitted)',
            title: 'GNN Classification of Grain Boundary Kinetic Outcomes',
            sub:   'V.S. Venkatesh, Y. Zhang, A.J. Shahani — Acta Materialia',
            detail: { authors: 'V.S. Venkatesh, Y. Zhang, A.J. Shahani', venue: 'Acta Materialia, 2025 (submitted)',
              body: 'Edge-centric message-passing GNN on 3-hop grain boundary subgraphs. No node attributes — all information lives on edges. AdamW with cosine decay, early stopping on macro-F1. Labels: persist (0), appear (1), disappear (2).',
              links: [{ label: 'Preprint', href: '#' }, { label: 'Code', href: '#' }] } },
          { id: 'rn2', tag: 'Conference · 2025 (in press)',
            title: 'Feature Engineering of Grain Boundary Descriptors',
            sub:   'V.S. Venkatesh, Y. Zhang, A.J. Shahani — IOP Conference Series',
            detail: { authors: 'V.S. Venkatesh, Y. Zhang, A.J. Shahani', venue: 'IOP Conference Series: MSE, 2025 (in press)',
              body: 'Two-stage statistical framework: Pearson correlation then Kruskal-Wallis testing. Final 8 descriptors: triple-line count, quadruple junction count, Coxeter residual, GB area, perimeter, misorientation angle, CSL flag, curvature spread.',
              links: [{ label: 'DOI', href: '#' }] } },
          { id: 'rn3', tag: 'Poster · 2025',
            title: 'Graph-Based Tracking of Grain Boundary Networks via DCT',
            sub:   'V.S. Venkatesh, Z. Croft, K. Thornton, A.J. Shahani — RexGG 2025',
            detail: { authors: 'V.S. Venkatesh, Z. Croft, K. Thornton, A.J. Shahani', venue: 'Recrystallization and Grain Growth Conference, 2025',
              body: 'Graph-based pipeline for tracking grain boundary networks through 4D synchrotron DCT. Shows GB graph evolution during recrystallization and introduces the featurization pipeline for querying graphs across time steps.',
              links: [{ label: 'Abstract', href: '#' }] } },
        ],
      },
    ],
  },

  // ── CV ────────────────────────────────────────────────────────
  cv: {
    eyebrow: 'Curriculum Vitae',
    title:   'CV',
    sub:     'Education, publications, presentations, teaching, awards, and skills.',
    facts: [
      { k: 'PhD',     v: 'MSE · University of Michigan\n2021 – present' },
      { k: 'Advisor', v: 'Prof. Ashwin J. Shahani\nShahani Lab' },
      { k: 'BS',      v: 'MSE · University of Michigan\n2017 – 2021' },
      { k: 'Contact', v: 'varunsv@umich.edu' },
    ],
    // anchorId must match the sub-node id in GRAPH.sub.cv for scroll to work
    cvSections: [
      {
        head: 'Publications', anchorId: 'cv_pubs',
        items: [
          { year: '2025', title: 'GNN Classification of GB Kinetic Outcomes',   sub: 'Acta Materialia (submitted) · V.S. Venkatesh, Y. Zhang, A.J. Shahani' },
          { year: '2025', title: 'Feature Engineering of GB Descriptors',       sub: 'IOP Conference Series (in press) · V.S. Venkatesh, Y. Zhang, A.J. Shahani' },
        ],
      },
      {
        head: 'Posters & Presentations', anchorId: 'cv_posters',
        items: [
          { year: '2025', title: 'Graph-Based Tracking of Grain Boundary Networks', sub: 'Poster — Recrystallization and Grain Growth Conference (RexGG 2025)' },
          { year: '',     title: 'Add your talks and presentations here',            sub: 'Conference name · Location · Year' },
        ],
      },
      {
        head: 'Awards & Grants', anchorId: 'cv_awards',
        items: [
          { year: '',     title: 'Add your fellowships and awards here', sub: 'Awarding body · Year' },
          { year: '',     title: 'Add your grants and funding here',     sub: 'Funding agency · Amount · Year' },
        ],
      },
      {
        head: 'Teaching', anchorId: 'cv_teach',
        items: [
          { year: '',     title: 'Graduate Student Instructor',          sub: 'Add your course and term — Dept. of MSE, University of Michigan' },
          { year: '',     title: 'Course Assistant',                     sub: 'Add your course and term' },
        ],
      },
      {
        head: 'Skills', anchorId: 'cv_skills',
        items: [
          { year: '',     title: 'Python',  sub: 'PyTorch Geometric, NumPy, scikit-learn, matplotlib, SciPy' },
          { year: '',     title: 'MATLAB',  sub: 'Image processing, 3D visualization, MTEX, PolyProc' },
          { year: '',     title: 'Methods', sub: 'Synchrotron DCT, EBSD, 3D tomographic reconstruction, GNN' },
          { year: '',     title: 'Software',sub: 'DREAM.3D, ImageJ/Fiji, COMSOL, Zotero' },
        ],
      },
    ],
    cvPdfPath: 'assets/cv.pdf',
  },

  // ── MEDIA ─────────────────────────────────────────────────────
  media: {
    eyebrow: 'Media & Reading',
    title:   'Notes, Videos & Books',
    sub:     'Short writing, channels worth watching, and books that shaped how I think.',
    notes: [
      { title: 'What does a grain boundary look like in 3D?',    sub: 'How synchrotron DCT reconstructs grain boundaries and what we can extract from them.' },
      { title: 'Why graph neural networks for microstructure?',  sub: 'Treating polycrystals as graphs rather than images — and what edge-centric message passing gains you.' },
      { title: 'A note on Kruskal-Wallis for feature selection', sub: 'When Pearson correlation alone is not enough.' },
    ],
    videos: [
      { title: '3Blue1Brown',        sub: 'Exceptional mathematical intuition — linear algebra and neural network series especially.' },
      { title: 'Veritasium',         sub: 'Physics and engineering storytelling at its best.' },
      { title: 'MIT OpenCourseWare', sub: '3.012 Fundamentals of Materials Science for depth on thermodynamics and structure.' },
    ],
    books: [
      { title: 'The Craft of Research',                   sub: 'Wayne Booth et al. — the best book on how to think about and write research.' },
      { title: 'Thinking, Fast and Slow',                 sub: 'Kahneman — essential reading on how we reason and where we go wrong.' },
      { title: 'The Structure of Scientific Revolutions', sub: 'Kuhn — still the most honest account of how science actually progresses.' },
    ],
  },
};
