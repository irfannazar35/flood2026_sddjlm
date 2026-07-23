# SD-DSS Phase 1

Static GitHub Pages front end for the Small Dam Decision Support System.

## Contents
- Dashboard page
- Data Entry page
- 16-dam dropdown loaded from `data/dams.csv`
- Observer/session/reading fields
- Local demo storage using `localStorage`
- Export to JSON for later Google Sheets integration

## Project structure
- `index.html` - GitHub Pages entry point
- `css/styles.css` - responsive dashboard and form styling
- `js/app.js` - navigation, CSV loading, local save, table refresh, and JSON export
- `data/dams.csv` - 16-dam reference dataset

## GitHub Pages setup
1. Keep `index.html` at the repository root.
2. Keep assets in the `css`, `js`, and `data` folders.
3. Enable GitHub Pages from the `main` branch.

## Google Sheets integration
Replace the local save path with a POST request to an Apps Script Web App or the Google Sheets API when ready.
