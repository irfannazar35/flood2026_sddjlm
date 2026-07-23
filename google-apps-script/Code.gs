const SHEET_NAME = 'Readings';
const SPREADSHEET_NAME = 'SD-DSS Daily Readings';
const HEADERS = [
  'Timestamp',
  'Reading Date',
  'Dam',
  'District',
  'Observer',
  'Session',
  'Water Level (ft)',
  'Spillway Gauge (ft)',
  'Spillway Discharge (cusecs)',
  'Rainfall (mm)',
  'Remarks',
  'Entry ID'
];

function doGet(e) {
  const action = String((e.parameter && e.parameter.action) || 'list');
  const callback = String((e.parameter && e.parameter.callback) || '');

  let payload;
  if (action === 'setup') {
    payload = setupSheet_();
  } else {
    payload = listReadings_();
  }

  return jsonp_(payload, callback);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const sheet = getReadingsSheet_();

    sheet.appendRow([
      body.createdAt || new Date().toISOString(),
      body.readingDate || '',
      body.dam || '',
      body.district || '',
      body.observer || '',
      body.session || '',
      numberOrBlank_(body.waterLevelFt),
      numberOrBlank_(body.spillwayGaugeFt),
      numberOrBlank_(body.spillwayDischargeCusecs),
      numberOrBlank_(body.rainfallMm),
      body.remarks || '',
      body.id || Utilities.getUuid()
    ]);

    return json_({ ok: true, spreadsheetUrl: getSpreadsheet_().getUrl() });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function setupSheet_() {
  const spreadsheet = getSpreadsheet_();
  getReadingsSheet_();
  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: SHEET_NAME
  };
}

function listReadings_() {
  const spreadsheet = getSpreadsheet_();
  const sheet = getReadingsSheet_();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== ''));

  return {
    ok: true,
    spreadsheetUrl: spreadsheet.getUrl(),
    entries: rows.map((row) => ({
      createdAt: toIso_(row[0]),
      readingDate: toDateOnly_(row[1]),
      dam: row[2],
      district: row[3],
      observer: row[4],
      session: row[5],
      waterLevelFt: Number(row[6]) || 0,
      spillwayGaugeFt: Number(row[7]) || 0,
      spillwayDischargeCusecs: Number(row[8]) || 0,
      rainfallMm: Number(row[9]) || 0,
      remarks: row[10],
      id: row[11]
    })).reverse()
  };
}

function getSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty('SPREADSHEET_ID');

  if (savedId) {
    return SpreadsheetApp.openById(savedId);
  }

  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  return spreadsheet;
}

function getReadingsSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function numberOrBlank_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function toIso_(value) {
  return value instanceof Date ? value.toISOString() : String(value || '');
}

function toDateOnly_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '').slice(0, 10);
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(payload, callback) {
  const safeCallback = callback && callback.replace(/[^a-zA-Z0-9_.$]/g, '');
  const body = safeCallback
    ? `${safeCallback}(${JSON.stringify(payload)});`
    : JSON.stringify(payload);

  return ContentService
    .createTextOutput(body)
    .setMimeType(safeCallback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
