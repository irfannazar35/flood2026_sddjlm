const STORAGE_KEY = 'sdDssEntries';
const CSV_PATH = 'data/dams.csv';

const appConfig = window.SD_DSS_CONFIG || {};
const featureColumns = [
  ['Sr. No.', 'Sr.'],
  ['Name of Dam', 'Name of Dam'],
  ['District', 'District'],
  ['Tehsil', 'Tehsil'],
  ['Location', 'Location'],
  ['Type of Dam', 'Type'],
  ['Operational / Non-Operational', 'Status'],
  ['Height (ft)', 'Height (ft)'],
  ['Completion Cost (million)', 'Cost (M)'],
  ['Gross Storage Capacity (Aft)', 'Gross Storage (Aft)'],
  ['Live storage (Aft)', 'Live Storage (Aft)'],
  ['C.C.A. (Acres)', 'CCA (Acres)'],
  ['Capacity of Channel (Cfs)', 'Channel (Cfs)'],
  ['Length of Canal (ft)', 'Canal Length (ft)'],
  ['DSL (ft)', 'DSL'],
  ['NPL (ft)', 'NPL'],
  ['HFL (ft)', 'HFL'],
  ['River / Nullah', 'River / Nullah'],
  ['Year of Completion', 'Year'],
  ['Catchment Area (Sq. Km)', 'Catchment (Sq. Km)'],
  ['Decimal Latitude', 'Latitude'],
  ['Decimal Longitude', 'Longitude']
];

const state = {
  dams: [],
  entries: loadEntries(),
  reportRows: [],
  activeRange: 'today',
  sheetsUrl: normalizeScriptUrl(appConfig.sheetsWebAppUrl),
  requireBackend: appConfig.requireBackend !== false
};

const elements = {
  navButtons: document.querySelectorAll('.nav-btn'),
  rangeButtons: document.querySelectorAll('.range-btn'),
  pages: document.querySelectorAll('.page'),
  damSelect: document.getElementById('damSelect'),
  entryForm: document.getElementById('entryForm'),
  readingDate: document.getElementById('readingDate'),
  damCount: document.getElementById('damCount'),
  entryCount: document.getElementById('entryCount'),
  lastSync: document.getElementById('lastSync'),
  recentRows: document.getElementById('recentRows'),
  statusMsg: document.getElementById('statusMsg'),
  dashboardSource: document.getElementById('dashboardSource'),
  aboveNplCount: document.getElementById('aboveNplCount'),
  normalRangeCount: document.getElementById('normalRangeCount'),
  belowDslCount: document.getElementById('belowDslCount'),
  reportDate: document.getElementById('reportDate'),
  reportSummary: document.getElementById('reportSummary'),
  reportRows: document.getElementById('reportRows'),
  loadReportBtn: document.getElementById('loadReportBtn'),
  downloadReportCsvBtn: document.getElementById('downloadReportCsvBtn'),
  featureRows: document.getElementById('featureRows'),
  featureCount: document.getElementById('featureCount'),
  downloadFeaturesPdfBtn: document.getElementById('downloadFeaturesPdfBtn'),
  exportBtn: document.getElementById('exportBtn')
};

init();

async function init() {
  wireNavigation();
  wireRangeFilters();
  wireFeatureExport();
  wireDailyReport();
  setDefaultDate();
  wireForm();
  updateDashboardSource();
  renderEntries();
  renderFeatureMessage('Loading dam features...');

  try {
    state.dams = await fetchDams();
    populateDamSelect(state.dams);
    renderFeatures();
    renderDailyReport();
    elements.damCount.textContent = state.dams.length;
    elements.featureCount.textContent = state.dams.length;
    setStatus(`Loaded ${state.dams.length} dams from dataset`);
  } catch (error) {
    console.error(error);
    renderFeatureMessage('Unable to load dam features. Refresh the page after GitHub Pages finishes updating.');
    setStatus('Unable to load dam feature data.');
  }

  await setupBackend();
  await refreshSheetEntries();
  renderDailyReport();
}

function wireNavigation() {
  elements.navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.page;
      elements.navButtons.forEach((item) => item.classList.toggle('active', item === button));
      elements.pages.forEach((page) => page.classList.toggle('active', page.id === `${target}Page`));
    });
  });
}

function wireRangeFilters() {
  elements.rangeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.activeRange = button.dataset.range;
      elements.rangeButtons.forEach((item) => item.classList.toggle('active', item === button));
      renderEntries();
    });
  });
}

function wireFeatureExport() {
  elements.downloadFeaturesPdfBtn.addEventListener('click', downloadFeaturesPdf);
}

function wireDailyReport() {
  elements.reportDate.valueAsDate = new Date();
  elements.loadReportBtn.addEventListener('click', renderDailyReport);
  elements.reportDate.addEventListener('change', renderDailyReport);
  elements.downloadReportCsvBtn.addEventListener('click', downloadReportCsv);
}

function setDefaultDate() {
  elements.readingDate.valueAsDate = new Date();
}

function wireForm() {
  elements.entryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = elements.entryForm.querySelector('button[type="submit"]');
    const entry = getFormEntry();

    if (state.requireBackend && !state.sheetsUrl) {
      setStatus('Backend is not configured yet. Add the Apps Script /exec URL in js/config.js.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    try {
      if (state.sheetsUrl) {
        await saveEntryToSheet(entry);
        setStatus('Entry submitted to the central record backend. Refreshing dashboard...');
        await refreshSheetEntries();
      } else {
        state.entries.unshift(entry);
        saveEntries(state.entries);
        renderEntries();
        renderDailyReport();
        setStatus('Entry saved locally because backend is disabled in config.');
      }

      elements.entryForm.reset();
      setDefaultDate();
    } catch (error) {
      console.error(error);
      state.entries.unshift(entry);
      saveEntries(state.entries);
      renderEntries();
      renderDailyReport();
      setStatus('Backend submit failed. Entry saved locally as backup.');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Save Entry';
    }
  });

  elements.exportBtn.addEventListener('click', exportEntries);
}

async function fetchDams() {
  let csvText = window.SD_DSS_DAMS_CSV;

  if (!csvText) {
    const response = await fetch(CSV_PATH, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load ${CSV_PATH}: ${response.status}`);
    }
    csvText = await response.text();
  }

  return parseCsv(csvText)
    .filter((row) => row['Name of Dam'])
    .map((row) => ({
      ...row,
      id: row['Sr. No.'],
      name: row['Name of Dam'].trim(),
      district: row.District,
      tehsil: row.Tehsil,
      status: row['Operational / Non-Operational'],
      dsl: parseNumber(row['DSL (ft)']),
      npl: parseNumber(row['NPL (ft)']),
      hfl: parseNumber(row['HFL (ft)']),
      latitude: row['Decimal Latitude'],
      longitude: row['Decimal Longitude']
    }));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift().map(normalizeHeader);
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function normalizeHeader(header) {
  return String(header).replace(/\s+/g, ' ').trim();
}

function populateDamSelect(dams) {
  elements.damSelect.innerHTML = '<option value="">Select dam</option>';
  dams.forEach((dam) => {
    const option = document.createElement('option');
    option.value = dam.name;
    option.textContent = `${dam.name} - ${dam.district}`;
    elements.damSelect.append(option);
  });
}

function renderFeatures() {
  if (!state.dams.length) {
    renderFeatureMessage('No dam features loaded.');
    return;
  }

  elements.featureRows.innerHTML = state.dams.map((dam) => `
    <tr>
      ${featureColumns.map(([key]) => `<td>${escapeHtml(dam[key] || '-')}</td>`).join('')}
    </tr>
  `).join('');
}

function renderFeatureMessage(message) {
  elements.featureRows.innerHTML = `<tr><td colspan="${featureColumns.length}">${escapeHtml(message)}</td></tr>`;
}

function getFormEntry() {
  const selectedDam = state.dams.find((dam) => dam.name === elements.damSelect.value) || {};
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    readingDate: document.getElementById('readingDate').value,
    dam: elements.damSelect.value,
    district: selectedDam.district || '',
    observer: document.getElementById('observerSelect').value,
    session: document.getElementById('sessionSelect').value,
    waterLevelFt: Number(document.getElementById('waterLevel').value),
    spillwayGaugeFt: Number(document.getElementById('spillGauge').value),
    spillwayDischargeCusecs: Number(document.getElementById('spillDischarge').value),
    rainfallMm: Number(document.getElementById('rainfall').value),
    remarks: document.getElementById('remarks').value.trim()
  };
}

async function setupBackend() {
  if (!state.sheetsUrl) return;

  try {
    const result = await requestJsonp('setup');
    if (!result.ok) throw new Error(result.error || 'Setup failed');
    updateDashboardSource(result.spreadsheetUrl);
  } catch (error) {
    console.error(error);
    setStatus('Backend setup check failed. Existing local backup is shown until the backend responds.');
  }
}

async function saveEntryToSheet(entry) {
  await fetch(state.sheetsUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(entry)
  });
}

async function refreshSheetEntries() {
  if (!state.sheetsUrl) {
    updateDashboardSource();
    renderEntries();
    renderDailyReport();
    return;
  }

  try {
    const result = await requestJsonp('list');
    if (!result.ok) throw new Error(result.error || 'Unable to read records');
    state.entries = result.entries || [];
    saveEntries(state.entries);
    updateDashboardSource(result.spreadsheetUrl);
    renderEntries();
    renderDailyReport();
    setStatus('Dashboard loaded from central records.');
  } catch (error) {
    console.error(error);
    updateDashboardSource();
    renderEntries();
    renderDailyReport();
    setStatus('Using local backup. Backend read is not connected yet.');
  }
}

function requestJsonp(action) {
  return new Promise((resolve, reject) => {
    const callbackName = `sdDssCallback_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const script = document.createElement('script');
    const separator = state.sheetsUrl.includes('?') ? '&' : '?';
    const timeout = window.setTimeout(() => cleanup(new Error('Request timed out')), 15000);

    window[callbackName] = (payload) => cleanup(null, payload);
    script.onerror = () => cleanup(new Error('Backend request failed'));
    script.src = `${state.sheetsUrl}${separator}action=${encodeURIComponent(action)}&callback=${callbackName}`;
    document.body.append(script);

    function cleanup(error, payload) {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (error) reject(error);
      else resolve(payload);
    }
  });
}

function renderEntries() {
  const filteredEntries = filterEntries(state.entries, state.activeRange);
  const statusSummary = summarizeWaterLevels(filteredEntries);

  elements.entryCount.textContent = filteredEntries.length;
  elements.lastSync.textContent = state.entries[0] ? formatDateTime(state.entries[0].createdAt) : '-';
  elements.aboveNplCount.textContent = statusSummary.aboveNpl;
  elements.normalRangeCount.textContent = statusSummary.normalRange;
  elements.belowDslCount.textContent = statusSummary.belowDsl;

  if (!filteredEntries.length) {
    elements.recentRows.innerHTML = '<tr><td colspan="9">No readings found for this period.</td></tr>';
    return;
  }

  elements.recentRows.innerHTML = filteredEntries.slice(0, 50).map((entry) => {
    const dam = findDamForEntry(entry);
    const status = classifyEntryLevel(entry, dam);
    return `
      <tr>
        <td>${escapeHtml(entry.readingDate)}</td>
        <td>${escapeHtml(entry.dam)}</td>
        <td>${escapeHtml(entry.observer)}</td>
        <td>${escapeHtml(entry.session)}</td>
        <td>${formatNumber(entry.waterLevelFt)}</td>
        <td>${formatNumber(dam && dam.dsl)}</td>
        <td>${formatNumber(dam && dam.npl)}</td>
        <td>${formatNumber(entry.spillwayDischargeCusecs)}</td>
        <td>${escapeHtml(status.label)}</td>
      </tr>
    `;
  }).join('');
}

function renderDailyReport() {
  const reportDate = elements.reportDate.value;
  if (!reportDate || !state.dams.length) {
    state.reportRows = [];
    elements.reportRows.innerHTML = '<tr><td colspan="9">Select a date and fetch report data.</td></tr>';
    elements.reportSummary.textContent = 'Select a date to prepare the daily report';
    return;
  }

  state.reportRows = buildDailyReportRows(reportDate);
  const withReadings = state.reportRows.filter((row) => row.currentWaterLevel !== '').length;
  elements.reportSummary.textContent = `${withReadings} of ${state.dams.length} dams have readings for ${reportDate}`;

  elements.reportRows.innerHTML = state.reportRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.dam)}</td>
      <td>${escapeHtml(row.district)}</td>
      <td>${formatNumber(row.dsl)}</td>
      <td>${formatNumber(row.npl)}</td>
      <td>${formatNumber(row.hfl)}</td>
      <td>${formatNumber(row.currentWaterLevel)}</td>
      <td>${formatNumber(row.spillwayGauge)}</td>
      <td>${formatNumber(row.spillwayDischarge)}</td>
      <td>${escapeHtml(row.status)}</td>
    </tr>
  `).join('');
}

function buildDailyReportRows(reportDate) {
  const dayEntries = state.entries.filter((entry) => String(entry.readingDate || '').slice(0, 10) === reportDate);
  const latest = new Map();
  dayEntries.forEach((entry) => {
    const damName = normalizeName(entry.dam);
    const current = latest.get(damName);
    if (!current || entrySortTime(entry) > entrySortTime(current)) latest.set(damName, entry);
  });

  return state.dams.map((dam) => {
    const entry = latest.get(normalizeName(dam.name));
    const status = entry ? classifyEntryLevel(entry, dam).label : 'No reading';
    return {
      dam: dam.name,
      district: dam.district,
      dsl: dam.dsl,
      npl: dam.npl,
      hfl: dam.hfl,
      currentWaterLevel: entry ? entry.waterLevelFt : '',
      spillwayGauge: entry ? entry.spillwayGaugeFt : '',
      spillwayDischarge: entry ? entry.spillwayDischargeCusecs : '',
      status
    };
  });
}

function downloadReportCsv() {
  if (!state.reportRows.length) renderDailyReport();
  if (!state.reportRows.length) {
    setStatus('Select a date before downloading the daily report.');
    return;
  }

  const reportDate = elements.reportDate.value || new Date().toISOString().slice(0, 10);
  const headers = ['Dam', 'District', 'DSL', 'NPL', 'HFL', 'Current Water Level', 'Spillway Gauge', 'Spillway Discharge', 'Status'];
  const lines = [headers, ...state.reportRows.map((row) => [
    row.dam,
    row.district,
    row.dsl,
    row.npl,
    row.hfl,
    row.currentWaterLevel,
    row.spillwayGauge,
    row.spillwayDischarge,
    row.status
  ])];
  const csv = lines.map((line) => line.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sd-dss-daily-report-${reportDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus('Daily report CSV prepared.');
}

function summarizeWaterLevels(entries) {
  const latestEntries = latestEntryPerDam(entries);
  return latestEntries.reduce((summary, entry) => {
    const status = classifyEntryLevel(entry, findDamForEntry(entry));
    if (status.key === 'aboveNpl') summary.aboveNpl += 1;
    if (status.key === 'normalRange') summary.normalRange += 1;
    if (status.key === 'belowDsl') summary.belowDsl += 1;
    return summary;
  }, { aboveNpl: 0, normalRange: 0, belowDsl: 0 });
}

function latestEntryPerDam(entries) {
  const latest = new Map();
  entries.forEach((entry) => {
    const damName = normalizeName(entry.dam);
    if (!damName) return;
    const current = latest.get(damName);
    if (!current || entrySortTime(entry) > entrySortTime(current)) {
      latest.set(damName, entry);
    }
  });
  return Array.from(latest.values());
}

function classifyEntryLevel(entry, dam) {
  const waterLevel = parseNumber(entry.waterLevelFt);
  const discharge = parseNumber(entry.spillwayDischargeCusecs);
  const dsl = dam ? parseNumber(dam.dsl) : NaN;
  const npl = dam ? parseNumber(dam.npl) : NaN;

  if (!Number.isFinite(waterLevel) || !Number.isFinite(dsl) || !Number.isFinite(npl)) {
    return { key: 'unknown', label: 'Reference missing' };
  }

  if (waterLevel >= npl || discharge > 0) {
    return { key: 'aboveNpl', label: 'Above NPL / Spillway Active' };
  }

  if (waterLevel >= dsl && waterLevel < npl) {
    return { key: 'normalRange', label: 'Between DSL and NPL' };
  }

  return { key: 'belowDsl', label: 'Below DSL' };
}

function findDamForEntry(entry) {
  const damName = normalizeName(entry.dam);
  return state.dams.find((dam) => normalizeName(dam.name) === damName);
}

function entrySortTime(entry) {
  const created = new Date(entry.createdAt).getTime();
  if (Number.isFinite(created)) return created;
  const reading = new Date(`${String(entry.readingDate || '').slice(0, 10)}T00:00:00`).getTime();
  return Number.isFinite(reading) ? reading : 0;
}

function filterEntries(entries, range) {
  if (range === 'all') return entries;

  const today = startOfDay(new Date());
  const minimumDate = new Date(today);
  if (range === '7days') minimumDate.setDate(today.getDate() - 6);

  return entries.filter((entry) => {
    const readingDate = parseReadingDate(entry.readingDate);
    if (!readingDate) return false;
    const day = startOfDay(readingDate);
    if (range === 'today') return day.getTime() === today.getTime();
    return day >= minimumDate && day <= today;
  });
}

function downloadFeaturesPdf() {
  if (!state.dams.length) {
    setStatus('Dam features are still loading. Try again in a moment.');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    setStatus('Allow pop-ups to generate the salient features PDF.');
    return;
  }

  const title = 'Salient Features of Small Dams';
  const generatedAt = new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  const headerCells = featureColumns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('');
  const bodyRows = state.dams.map((dam) => `
    <tr>${featureColumns.map(([key]) => `<td>${escapeHtml(dam[key] || '-')}</td>`).join('')}</tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { size: A3 landscape; margin: 10mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #18323f; }
        h1 { margin: 0 0 4px; font-size: 20px; }
        p { margin: 0 0 12px; color: #60707b; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #b8c8d0; padding: 4px; text-align: left; vertical-align: top; font-size: 7px; line-height: 1.2; word-break: break-word; }
        th { background: #e8eff3; color: #0b4f6c; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>Punjab Irrigation Department - Generated ${generatedAt}</p>
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <script>window.onload = () => { window.print(); };</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function exportEntries() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: state.sheetsUrl ? 'SD-DSS backend export cache' : 'SD-DSS local backup export',
    entries: state.entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sd-dss-entries-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus('JSON export prepared.');
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function normalizeScriptUrl(value) {
  return String(value || '').trim();
}

function updateDashboardSource() {
  if (state.sheetsUrl) {
    elements.dashboardSource.textContent = 'Source: central records backend connected';
  } else {
    elements.dashboardSource.textContent = 'Source: backend URL missing in js/config.js';
  }
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function setStatus(message) {
  elements.statusMsg.textContent = message;
}

function parseReadingDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNumber(value) {
  const number = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : NaN;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatNumber(value) {
  const number = parseNumber(value);
  if (!Number.isFinite(number)) return '-';
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(number);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}
