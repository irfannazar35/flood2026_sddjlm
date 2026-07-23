# SD-DSS Phase 1

Static GitHub Pages front end for the Small Dam Decision Support System.

## Contents
- Dashboard page
- Data Entry page
- 16-dam dropdown loaded from `data/dams.csv`
- Observer/session/reading fields
- Long-term Google Sheets storage through Apps Script backend
- Dashboard filters for Today, Past 7 Days, and All readings
- 7-day average water level, discharge, and rainfall KPIs
- Local browser backup plus JSON export if backend submission fails

## Project structure
- `index.html` - GitHub Pages entry point
- `css/styles.css` - responsive dashboard, form, and filter styling
- `js/config.js` - central backend Web App URL used by all browsers
- `js/app.js` - navigation, CSV loading, backend sync, local backup, filters, averages, and JSON export
- `data/dams.csv` - 16-dam reference dataset
- `google-apps-script/Code.gs` - Google Sheets backend script

## GitHub Pages setup
1. Keep `index.html` at the repository root.
2. Keep assets in the `css`, `js`, and `data` folders.
3. Enable GitHub Pages from the `main` branch.

## Long-term storage architecture
GitHub Pages is a static host, so browser JavaScript cannot safely write records directly into a repo file. A repo-write token in frontend code would be public and unsafe.

This app therefore uses a backend endpoint:

`Save Entry` -> Google Apps Script Web App -> Google Sheet row

The backend URL is configured once in `js/config.js`. It is not entered by each user and is not stored per browser.

## Google Sheets backend setup
1. Open [Google Apps Script](https://script.google.com/).
2. Create a new project.
3. Paste the full contents of `google-apps-script/Code.gs` into the editor.
4. Click **Deploy** > **New deployment**.
5. Select **Web app**.
6. Set **Execute as** to **Me**.
7. Set **Who has access** to **Anyone**.
8. Deploy and copy the Web App URL ending in `/exec`.
9. Paste that URL into `js/config.js` as `sheetsWebAppUrl`.
10. Commit the `js/config.js` change.

After that, every browser and device using the GitHub Pages app writes to the same Google Sheet named `SD-DSS Daily Readings`.

## Dashboard records
The dashboard reads from the central Google Sheet and supports:
- Today
- Past 7 Days
- All
- 7-day average water level
- 7-day average discharge
- 7-day average rainfall
