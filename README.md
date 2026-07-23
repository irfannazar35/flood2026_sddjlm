# SD-DSS Phase 1

Static GitHub Pages front end for the Small Dam Decision Support System.

## Contents
- Dashboard page
- Data Entry page
- 16-dam dropdown loaded from `data/dams.csv`
- Observer/session/reading fields
- Long-term Google Sheets storage through Apps Script
- Dashboard filters for Today, Past 7 Days, and All readings
- 7-day average water level, discharge, and rainfall KPIs
- Local browser backup plus JSON export

## Project structure
- `index.html` - GitHub Pages entry point
- `css/styles.css` - responsive dashboard, form, and filter styling
- `js/config.js` - optional default Apps Script Web App URL
- `js/app.js` - navigation, CSV loading, Google Sheets sync, local backup, filters, averages, and JSON export
- `data/dams.csv` - 16-dam reference dataset
- `google-apps-script/Code.gs` - Google Sheets backend script

## GitHub Pages setup
1. Keep `index.html` at the repository root.
2. Keep assets in the `css`, `js`, and `data` folders.
3. Enable GitHub Pages from the `main` branch.

## Google Sheets setup
1. Open [Google Apps Script](https://script.google.com/).
2. Create a new project.
3. Paste the full contents of `google-apps-script/Code.gs` into the editor.
4. Click **Deploy** > **New deployment**.
5. Select **Web app**.
6. Set **Execute as** to **Me**.
7. Set **Who has access** to **Anyone**.
8. Deploy and copy the Web App URL ending in `/exec`.
9. Open the SD-DSS app, go to **Settings**, paste the URL, and click **Create / Test Sheet**.

The first setup/test call creates a Google Sheet named `SD-DSS Daily Readings` in the deploying Google account. Every submitted reading is appended as a new row.

## Optional shared default URL
After the Web App URL works, paste it into `js/config.js` as `sheetsWebAppUrl` and commit it. Then all users of the GitHub Pages app will use the same Google Sheet without entering the URL themselves.
