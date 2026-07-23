# Google Apps Script Backend

This folder contains the backend for long-term SD-DSS reading storage.

## Deploy
1. Go to https://script.google.com/.
2. Create a new project.
3. Paste `Code.gs` into the project editor.
4. Deploy as a Web App.
5. Use these settings:
   - Execute as: Me
   - Who has access: Anyone
6. Copy the Web App URL ending in `/exec`.
7. Paste that URL into the SD-DSS app Settings page.
8. Click **Create / Test Sheet**.

The script creates a Google Sheet named `SD-DSS Daily Readings` automatically on first setup or first submitted reading.

## Stored columns
- Timestamp
- Reading Date
- Dam
- District
- Observer
- Session
- Water Level (ft)
- Spillway Gauge (ft)
- Spillway Discharge (cusecs)
- Rainfall (mm)
- Remarks
- Entry ID
