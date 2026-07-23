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
  avgWaterLevel: document.getElementById('avgWaterLevel'),
  avgDischarge: document.getElementById('avgDischarge'),
  avgRainfall: document.getElementById('avgRainfall'),
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
  setDefaultDate();
  wireForm();
  updateDashboardSource();
  renderEntries();
  renderFeatureMessage('Loading dam features...');

  try {
    state.dams = await fetchDams();
    populateDamSelect(state.dams);
    renderFeatures();
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
        setStatus('Entry submitted to the central Google Sheet. Refreshing dashboard...');
        await refreshSheetEntries();
      } else {
        state.entries.unshift(entry);
        saveEntries(state.entries);
        renderEntries();
        setStatus('Entry saved locally because backend is disabled in config.');
      }

      elements.entryForm.reset();
      setDefaultDate();
    } catch (error) {
      console.error(error);
      state.entries.unshift(entry);
      saveEntries(state.entries);
      renderEntries();
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
      npl: row['NPL (ft)'],
      hfl: row['HFL (ft)'],
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
    return;
  }

  try {
    const result = await requestJsonp('list');
    if (!result.ok) throw new Error(result.error || 'Unable to read sheet');
    state.entries = result.entries || [];
    saveEntries(state.entries);
    updateDashboardSource(result.spreadsheetUrl);
    renderEntries();
    setStatus('Dashboard loaded from the central Google Sheet.');
  } catch (error) {
    console.error(error);
    updateDashboardSource();
    renderEntries();
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
  const sevenDayEntries = filterEntries(state.entries, '7days');

  elements.entryCount.textContent = filteredEntries.length;
  elements.lastSync.textContent = state.entries[0] ? formatDateTime(state.entries[0].createdAt) : '-';
  elements.avgWaterLevel.textContent = average(sevenDayEntries, 'waterLevelFt');
  elements.avgDischarge.textContent = average(sevenDayEntries, 'spillwayDischargeCusecs');
  elements.avgRainfall.textContent = average(sevenDayEntries, 'rainfallMm');

  if (!filteredEntries.length) {
    elements.recentRows.innerHTML = '<tr><td colspan="8">No readings found for this period.</td></tr>';
    return;
  }

  elements.recentRows.innerHTML = filteredEntries.slice(0, 50).map((entry) => `
    <tr>
      <td>${escapeHtml(entry.readingDate)}</td>
      <td>${escapeHtml(entry.dam)}</td>
      <td>${escapeHtml(entry.observer)}</td>
      <td>${escapeHtml(entry.session)}</td>
      <td>${formatNumber(entry.waterLevelFt)}</td>
      <td>${formatNumber(entry.spillwayGaugeFt)}</td>
      <td>${formatNumber(entry.spillwayDischargeCusecs)}</td>
      <td>${formatNumber(entry.rainfallMm)}</td>
    </tr>
  `).join('');
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

function average(entries, key) {
  const values = entries.map((entry) => Number(entry[key])).filter((value) => Number.isFinite(value));
  if (!values.length) return '-';
  return formatNumber(values.reduce((sum, value) => sum + value, 0) / values.length);
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

function normalizeScriptUrl(value) {
  return String(value || '').trim();
}

function updateDashboardSource(sheetUrl) {
  if (sheetUrl) {
    elements.dashboardSource.innerHTML = `Source: <a href="${sheetUrl}" target="_blank" rel="noopener">Central Google Sheet</a>`;
  } else if (state.sheetsUrl) {
    elements.dashboardSource.textContent = 'Source: central backend configured';
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
  const number = Number(value);
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
