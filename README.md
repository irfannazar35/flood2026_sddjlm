# SD-DSS Phase 1

Static GitHub Pages front end for the Small Dam Decision Support System.

## Contents
- Dashboard page
- Data Entry page
- 16-dam dropdown loaded from `data/dams.csv`
- Observer/session/reading fields
- Local demo storage using `localStorage`
- Export to JSON for later Google Sheets integration

## GitHub Pages setup
1. Push this folder to your repository.
2. Ensure `index.html` is at the repository root.
3. Enable GitHub Pages from the main branch.

## Google Sheets integration
Replace the local save path with a POST request to an Apps Script Web App or the Google Sheets API when ready.
