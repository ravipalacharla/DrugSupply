# Drug Supply Kit Flow – Project Plan

## Goal

A single web page that shows how clinical trial kits flow from **depots to their final outcome**, played back **month by month**. It uses the animated chart from the original `materialDashboard`, with its look kept, and anonymised sample data. It is built so it can be uploaded to a website as plain static files.

The chart is based on the animated "Sankey" from *Fullstack Data Visualization with D3* (Amelia Wattenberger).

## Scope (done)

1. The original **Depot → Outcome** animated chart (`reference/sankeyChart.js`), ported to D3 v7 with the same look.
2. **Monthly playback:**
   - Dots are released month by month, and the ending bars and per-depot values build up as they arrive.
   - Controls: one small button (pause / play / replay), a month slider and the current month.
   - Filtering, switching view or resizing carries on from the same point.
3. **Country view:** Depot → Countries → Outcomes, from a "Show countries" checkbox that appears only when a single depot is selected.
4. **Expired at depot** shown under each depot, building up by month. Those kits never ship, so they don't flow.
5. **Depot filter** in the chart toolbar (All or one depot).

Page title: "Drug Supply Optimization". The summary tiles were removed after review.

**Out of scope:** real study data, a backend or database, a build step.

## Data (anonymised sample)

One CSV file, `data/kit_flow.csv`, created once by `data/make_sample_data.py`.

| Column | Example | Notes |
|---|---|---|
| Month | 2025-03 | YYYY-MM |
| Depot | Depot A - Central EU | Invented names |
| Country | Germany | Blank for `Expired at Depot` |
| Outcome | Dispensed | Dispensed, Returned, Expired at Site, Damaged, Expired at Depot |
| Qty | 42 | Kit count |

The sample has 5 depots, 11 countries and 12 months (4,621 kits).

## How it is built

**Tech:** plain HTML, CSS and JavaScript with **D3 v7** (`lib/d3.v7.min.js`, stored locally). It has no jQuery, Bootstrap, CDN or build step.

```
DrugSupply/
├── index.html            header, chart card with toolbar (depot, view, playback)
├── css/styles.css        page look from materialDashboard, chart look from Sankey.html
├── js/app.js             load CSV, depot/view state, playback controls, colours
├── js/sankeyChart.js     the animated chart + playback clock
├── lib/d3.v7.min.js
├── data/                 kit_flow.csv + make_sample_data.py
├── reference/            original code + earlier 3-column draft (not deployed)
└── PROJECT_PLAN.md
```

**Kept from the original:**
- the layout: wide translucent bands, 500px height
- the teal-to-magenta depot colours
- dots that switch lanes in the middle
- stacked ending bars that fill as dots arrive
- coloured per-depot values under each outcome

**Changed from the original:**
- D3 v7, with a small built-in tooltip instead of d3-tip
- depots and names come from the data instead of being hardcoded
- a playback clock (1.5 s per month) instead of releasing one dot per frame
- one timer that stops when playback ends
- no `debugger`
- no zero-value dots
- the first depot and outcome are at the top
- the right margin grows with the number of depots
- on phones the chart scrolls sideways inside its box

**Country view:** the same style split into two stages. Bands are narrower (about 38px, so 11 countries fit), the chart is 600px tall, and bands are drawn only for depot–country and country–outcome pairs that exist in the data.

## How to run

```bash
cd C:\prj\DrugSupply
python -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` by double-clicking won't work, because browsers block CSV loading from `file://`.

## Ready to upload

Upload `index.html`, `css/`, `js/`, `lib/` and `data/kit_flow.csv`. Leave out `reference/`, `data/make_sample_data.py` and this plan.
