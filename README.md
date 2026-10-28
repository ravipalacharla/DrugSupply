# Drug Supply Optimization – Kit Flow

**Live:** https://ravipalacharla.github.io/DrugSupply/

An animated chart showing how clinical trial kits flow from **depots** to their **outcome** (Dispensed, Returned, Expired at Site, Damaged), played back month by month. Pick a single depot to also see the **countries** it supplies.

- Plain HTML, CSS and JavaScript with D3 v7. No build step and no backend.
- It is a static site: copy the files to any web host and it works.
- The chart is based on the animated Sankey in *Fullstack Data Visualization with D3* (Amelia Wattenberger).

---

## 1. Run it locally

Browsers block a page from reading a CSV when you open it straight from disk (`file://`), so the page needs a small local web server:

```bash
cd ~/Documents/D3JSVisuals/DrugSupply
python3 -m http.server 8000
```

Open **http://localhost:8000**, and press `Ctrl+C` in the terminal to stop the server.

You can also right-click `index.html` in VS Code and choose **Open with Live Server**.

---

## 2. Files

| File | What it does | Do you edit it? |
|---|---|---|
| `index.html` | Page layout: header, toolbar (depot, show countries, play button, month slider), chart area | Titles and labels |
| `css/styles.css` | All styling (fonts, colours, toolbar, chart bands and dots) | Look and feel |
| `js/app.js` | Loads the CSV, depot filter, country checkbox, playback controls, depot colours | Rarely |
| `js/sankeyChart.js` | The chart and the playback clock | Settings at the top (see section 4) |
| `lib/d3.v7.min.js` | D3 library v7.9.0, stored locally | No |
| `data/kit_flow.csv` | **The data the chart shows** | **Yes, this is what you update** |
| `data/make_sample_data.py` | Generates the anonymised sample CSV | Only for new sample data |
| `reference/` | Original materialDashboard code and an earlier draft | No (not deployed) |
| `PROJECT_PLAN.md` | Project history and decisions | No (not deployed) |

---

## 3. Updating the data

The page reads **one file: `data/kit_flow.csv`**. To show different data, replace that file, keeping the same columns, and reload the page. No code changes are needed.

### Format

```csv
Month,Depot,Country,Outcome,Qty
2025-03,Depot A - Central EU,Germany,Dispensed,42
2025-03,Depot A - Central EU,Germany,Expired at Site,3
2025-03,Depot A - Central EU,,Expired at Depot,5
```

| Column | Rules |
|---|---|
| `Month` | `YYYY-MM`, for example `2025-03`. Each distinct month becomes one step of the playback and the slider. |
| `Depot` | Any name. Each distinct name becomes one depot row. Depots are listed alphabetically, so a prefix like "Depot A - …" controls the order. |
| `Country` | The country the kits went to. Leave it **blank** for `Expired at Depot` rows. It is only used when "Show countries" is on. |
| `Outcome` | Exactly one of: `Dispensed`, `Returned`, `Expired at Site`, `Damaged`, `Expired at Depot` (spelling and capitals must match). |
| `Qty` | Whole number of kits. |

You need one row per month + depot + country + outcome. Rows with zero quantity can be left out.

### Things to know

- **Misspelled outcomes are silently ignored.** A row with `Expired at site` (lower-case s) won't show up. To add or rename outcomes, edit the `OUTCOMES` list at the top of `js/sankeyChart.js`. The labels on the chart come from that list.
- **`Expired at Depot` is special.** It isn't drawn as a flow. It appears as the "Expired at depot: N" text under each depot, building up month by month.
- **Size limits:** the layout reads well with up to about **8 depots** and about **12 countries per depot**. Beyond that the bands start to overlap, and the height in `sankeyChart.js` (500px, or 600px with countries) would need increasing.
- **Real study data:** once the CSV is on a public website, anyone can download it. Use anonymised or aggregated data unless the site is access-controlled.
- **Browser caching:** after uploading a new CSV, press `Ctrl+F5` to bypass the cache if the page still shows the old data.

### Getting data from a database

The CSV is a simple aggregate. A query that groups shipments by month, depot, country and outcome and sums the kit quantity, exported as CSV with these five column names, is all that's needed. To regenerate the sample data instead, run `python data/make_sample_data.py`.

---

## 4. Settings you can change

At the top of `js/sankeyChart.js`:

| Setting | Default | Effect |
|---|---|---|
| `KITS_PER_DOT` | `10` | Kits per dot. Raise it for large volumes so there are fewer dots. Also update the "Each dot is up to 10 kits" note in `index.html`. |
| `MONTH_DURATION` | `1500` | Milliseconds per month of playback. Higher is slower. |
| `OUTCOMES` | Dispensed, Returned, Expired at Site, Damaged | The outcomes shown on the right, in order from top to bottom. |
| `MIN_WIDTH` | `700` | Below this width the chart scrolls sideways inside its box (phones). |

The depot colours (teal `#12CBC4` to magenta `#B53471`) are set in `js/app.js`. The page title is in `index.html` (`<title>` and `<h2>`).

---

## 5. Dependencies

| Dependency | Needed for | Notes |
|---|---|---|
| **D3 v7.9.0** | Everything | Included in `lib/`, so there is **no internet or CDN dependency**. |
| **A web server** of any kind | Serving the files | Static hosting is enough. No PHP, Node, Python or database is needed on the server. |
| **A modern browser** | Viewing | Current Chrome, Edge, Firefox or Safari. Internet Explorer won't work. |
| Python 3 | Only for local testing and `make_sample_data.py` | Not needed on the website. |

There are no API keys, logins, cookies or tracking.

---

## 6. Deploying

### What to upload

```
index.html
css/styles.css
js/app.js
js/sankeyChart.js
lib/d3.v7.min.js
data/kit_flow.csv
```

That's about 330 KB in total. **Don't upload** `reference/`, `data/make_sample_data.py`, `PROJECT_PLAN.md` or this README.

Keep the folder structure as it is. All paths are relative, so it works in the site root or in any subfolder, for example `yoursite.com/drug-supply/`.

### Where to host

| Option | How |
|---|---|
| **Your own website** (cPanel, FTP, WordPress host) | Upload the files above into a folder such as `public_html/drug-supply/` with the host's file manager or an FTP client (e.g. FileZilla). Open `yoursite.com/drug-supply/`. |
| **GitHub Pages** (free) | Push the files to a GitHub repository, then go to Settings → Pages → deploy from branch. |
| **Netlify** (free tier) | Drag the folder onto app.netlify.com/drop. |
| **Azure Static Web Apps / AWS S3 / Google Cloud Storage** | Create a static website bucket or app and upload the files. No server configuration is needed. |

### Showing it inside another page

```html
<iframe src="https://yoursite.com/drug-supply/" width="100%" height="760" style="border:0"></iframe>
```

### After deploying, check that:

- the page loads with no "Could not load data" message
- the depot dropdown lists your depots and playback starts
- picking a depot shows "Show countries", and the country view works

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Could not load data/kit_flow.csv" | You opened the page from disk, or the CSV is missing or has a different name. Use a web server and check `data/kit_flow.csv` exists. |
| A depot or outcome is missing | Check the spelling in the CSV. Outcomes must exactly match the `OUTCOMES` list. |
| The chart shows old data after an update | Browser cache. Press `Ctrl+F5`. |
| Bands overlap | Too many depots or countries for the fixed height. Increase `height` in `js/sankeyChart.js`. |
