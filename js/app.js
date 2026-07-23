const STORAGE_KEY = 'sdDssEntries';
const CSV_PATH = 'data/dams.csv';

const state = {
  dams: [],
  entries: loadEntries()
};

const elements = {
  navButtons: document.querySelectorAll('.nav-btn'),
  pages: document.querySelectorAll('.page'),
  damSelect: document.getElementById('damSelect'),
  entryForm: document.getElementById('entryForm'),
  readingDate: document.getElementById('readingDate'),
  damCount: document.getElementById('damCount'),
  entryCount: document.getElementById('entryCount'),
  lastSync: document.getElementById('lastSync'),
  recentRows: document.getElementById('recentRows'),
  statusMsg: document.getElementById('statusMsg'),
  exportBtn: document.getElementById('exportBtn')
};

init();

async function init() {
  wireNavigation();
  setDefaultDate();
  wireForm();
  renderEntries();

  try {
    state.dams = await fetchDams();
    populateDamSelect(state.dams);
    elements.damCount.textContent = state.dams.length;
    setStatus(`Loaded ${state.dams.length} dams from CSV`);
  } catch (error) {
    console.error(error);
    setStatus('Unable to load data/dams.csv. Check GitHub Pages file paths.');
  }
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

function setDefaultDate() {
  elements.readingDate.valueAsDate = new Date();
}

function wireForm() {
  elements.entryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const entry = getFormEntry();
    state.entries.unshift(entry);
    saveEntries(state.entries);
    renderEntries();
    elements.entryForm.reset();
    setDefaultDate();
    setStatus('Entry saved locally. Export JSON when ready to submit.');
  });

  elements.exportBtn.addEventListener('click', exportEntries);
}

async function fetchDams() {
  const response = await fetch(CSV_PATH, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${CSV_PATH}: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText)
    .filter((row) => row['Name of Dam'])
    .map((row) => ({
      id: row['Sr. No.'],
      name: row['Name of Dam'].trim(),
      district: row.District,
      tehsil: row.Tehsil,
      status: row['Operational / Non-Operational'],
      npl: row['NPL\n(ft)'],
      hfl: row['HFL\n(ft)'],
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

  const headers = rows.shift().map((header) => header.trim());
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
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

function renderEntries() {
  elements.entryCount.textContent = state.entries.length;
  elements.lastSync.textContent = state.entries[0] ? formatDateTime(state.entries[0].createdAt) : '-';

  if (!state.entries.length) {
    elements.recentRows.innerHTML = '<tr><td colspan="8">No saved entries yet.</td></tr>';
    return;
  }

  elements.recentRows.innerHTML = state.entries.slice(0, 10).map((entry) => `
    <tr>
      <td>${escapeHtml(entry.readingDate)}</td>
      <td>${escapeHtml(entry.dam)}</td>
      <td>${escapeHtml(entry.observer)}</td>
      <td>${escapeHtml(entry.session)}</td>
      <td>${entry.waterLevelFt}</td>
      <td>${entry.spillwayGaugeFt}</td>
      <td>${entry.spillwayDischargeCusecs}</td>
      <td>${entry.rainfallMm}</td>
    </tr>
  `).join('');
}

function exportEntries() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'SD-DSS Phase 1 local export',
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
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
