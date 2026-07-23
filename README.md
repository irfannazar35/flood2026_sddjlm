# SD-DSS Phase 1

Static GitHub Pages front end for the Small Dam Decision Support System.

## Contents
- Dashboard page
- Data Entry page
- Salient Features tab for public small-dam reference data
- 16-dam dropdown loaded from bundled dam data and `data/dams.csv`
- Observer/session/reading fields
- Long-term Google Sheets storage through Apps Script backend
- Dashboard filters for Today, Past 7 Days, and All readings
- Operational water-level summary by DSL/NPL bands
- Public PDF export for salient dam features
- Local browser backup plus JSON export if backend submission fails

## Project structure
- `index.html` - GitHub Pages entry point
- `css/styles.css` - responsive dashboard, form, filter, and features-table styling
- `js/config.js` - central backend Web App URL used by all browsers
- `js/app.js` - navigation, bundled/CSV loading, backend sync, local backup, features table, PDF export, filters, and status summaries
- `data/dams.js` - bundled dam feature CSV for reliable public loading
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

The backend URL is configured once in `js/config.js`. It is not entered by each user and is not stored per browser. The public dashboard does not display a link to the Google Sheet, and the Apps Script response does not return the spreadsheet URL.

## Backend updates
When `google-apps-script/Code.gs` changes, paste the updated code into the Google Apps Script editor and create a new deployment version. GitHub commits do not automatically update an existing Apps Script deployment.

## Dashboard records
The dashboard reads from the central record backend without exposing a public link to the Sheet. It supports:
- Today
- Past 7 Days
- All
- Count of dams above NPL or with spillway discharge
- Count of dams between DSL and NPL
- Count of dams below DSL

The status summary uses the latest submitted reading per dam within the selected period.

## Salient features
The Salient Features tab reads the static public dam feature columns and excludes `CWL` because current water level is an operational reading, not a static feature. The **Download PDF** button opens a print-ready A3 landscape report that can be saved as PDF from the browser print dialog.
