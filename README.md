# Varun S. Venkatesh — Personal Research Website

Live at: **https://varunsrinivas10.github.io**

---

## File structure

```
├── index.html                 ← shell only, never edit
├── README.md
└── assets/
    ├── css/
    │   └── style.css          ← all visual styles
    ├── js/
    │   ├── data.js            ← YOUR CONTENT — edit this
    │   ├── graph.js           ← canvas graph engine (do not edit)
    │   └── ui.js              ← right-panel logic (do not edit)
    ├── img/
    │   └── profile.jpg        ← optional, add your photo here
    └── cv.pdf                 ← drop your CV here
```

---

## How to update content

**Everything you need to edit lives in `assets/js/data.js`.**

### Change your bio / links
Edit the `PROFILE` object at the top of `data.js`.

### Add a publication
Find the right subsection inside `CONTENT.research.subsections` and add an item:
```js
{
  id:    'rn4',                         // unique id, no spaces
  tag:   'Journal · 2026',
  title: 'Your Paper Title Here',
  sub:   'Authors — Journal Name',
  detail: {
    authors: 'V.S. Venkatesh, ...',
    venue:   'Nature Materials, 2026',
    body:    'Your abstract or description here.',
    links:   [{ label: 'DOI', href: 'https://doi.org/...' }],
  },
},
```

### Add a graph node
Add a leaf label to the matching array in `GRAPH.leaves`:
```js
r_nn: ['GNN\nPaper', 'Feature\nEngineering', 'Graph\nTracking', 'New\nPaper'],
```
Keep labels short — they render inside small circles.

### Add a new main section
1. Add a node to `GRAPH.main`
2. Add sub-nodes to `GRAPH.sub`
3. Add leaf labels to `GRAPH.leaves`
4. Add content to `CONTENT`

---

## Deploy to GitHub Pages

1. Create a GitHub repo (any name)
2. Push all files preserving the folder structure
3. Go to **Settings → Pages → Branch: main → Save**
4. Your site is live at `https://yourusername.github.io/repo-name`

For a clean URL (`https://yourusername.github.io`), name the repo exactly `yourusername.github.io`.

---

## Add your CV

Drop your CV PDF at `assets/cv.pdf` — the download link in the CV section points there automatically.
