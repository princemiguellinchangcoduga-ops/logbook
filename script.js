const API_BASE = '/api';

let token = sessionStorage.getItem('logbook_token') || null;
let records = [];

const els = {
  modeBadge: document.getElementById('modeBadge'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  exportBtn: document.getElementById('exportBtn'),
  addSection: document.getElementById('addSection'),
  addForm: document.getElementById('addForm'),
  tableBody: document.getElementById('tableBody'),
  actionsHeader: document.querySelector('.col-actions'),
  loginModal: document.getElementById('loginModal'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  emptyState: document.getElementById('emptyState'),
  statusMsg: document.getElementById('statusMsg'),
  newDate: document.getElementById('newDate'),
};

function isAdmin() {
  return !!token;
}

function setStatus(msg, isError) {
  els.statusMsg.textContent = msg || '';
  els.statusMsg.classList.toggle('error', !!isError);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function toInputDate(value) {
  // value may already be an ISO date or a full timestamp; normalize to YYYY-MM-DD
  return String(value).slice(0, 10);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str ?? '').toString().replace(/"/g, '&quot;');
}

function updateModeUI() {
  if (isAdmin()) {
    els.modeBadge.textContent = 'Admin Mode';
    els.modeBadge.classList.add('admin');
    els.loginBtn.classList.add('hidden');
    els.logoutBtn.classList.remove('hidden');
    els.exportBtn.classList.remove('hidden');
    els.addSection.classList.remove('hidden');
    els.actionsHeader.classList.remove('hidden');
  } else {
    els.modeBadge.textContent = 'View Only';
    els.modeBadge.classList.remove('admin');
    els.loginBtn.classList.remove('hidden');
    els.logoutBtn.classList.add('hidden');
    els.exportBtn.classList.add('hidden');
    els.addSection.classList.add('hidden');
    els.actionsHeader.classList.add('hidden');
  }
  renderTable();
}

function forceLogout(message) {
  token = null;
  sessionStorage.removeItem('logbook_token');
  updateModeUI();
  if (message) setStatus(message, true);
}

async function fetchRecords() {
  setStatus('Loading entries…');
  try {
    const res = await fetch(`${API_BASE}/records`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load entries');
    records = data.records;
    renderTable();
    setStatus('');
  } catch (err) {
    setStatus(`Could not load entries: ${err.message}`, true);
  }
}

function renderTable() {
  els.tableBody.innerHTML = '';

  if (!records.length) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');

  records.forEach((r) => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="cell-date">${formatDate(r.log_date)}</td>
      <td class="cell-transaction">${escapeHtml(r.transaction)}</td>
      <td class="cell-filer">${escapeHtml(r.filed_by)}</td>
      ${isAdmin() ? `
      <td class="cell-actions">
        <button class="btn-icon edit-btn" title="Edit entry" aria-label="Edit entry">&#9998;</button>
        <button class="btn-icon delete-btn" title="Delete entry" aria-label="Delete entry">&#128465;</button>
      </td>` : ''}
    `;
    els.tableBody.appendChild(tr);
  });
}

function startEdit(tr, id) {
  const record = records.find((r) => String(r.id) === String(id));
  if (!record) return;

  tr.innerHTML = `
    <td><input type="date" class="edit-date" value="${toInputDate(record.log_date)}"></td>
    <td><input type="text" class="edit-transaction" value="${escapeAttr(record.transaction)}"></td>
    <td><input type="text" class="edit-filer" value="${escapeAttr(record.filed_by)}"></td>
    <td class="cell-actions">
      <button class="btn-icon save-btn" title="Save changes" aria-label="Save changes">&#10003;</button>
      <button class="btn-icon cancel-btn" title="Cancel" aria-label="Cancel">&#10005;</button>
    </td>
  `;
  tr.querySelector('.save-btn').addEventListener('click', () => saveEdit(tr, id));
  tr.querySelector('.cancel-btn').addEventListener('click', () => renderTable());
}

async function saveEdit(tr, id) {
  const log_date = tr.querySelector('.edit-date').value;
  const transaction = tr.querySelector('.edit-transaction').value.trim();
  const filed_by = tr.querySelector('.edit-filer').value.trim();
  if (!log_date || !transaction || !filed_by) {
    setStatus('All fields are required to save an entry.', true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/records?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ log_date, transaction, filed_by }),
    });
    const data = await res.json();
    if (res.status === 401) return forceLogout('Session expired. Please log in again.');
    if (!res.ok) throw new Error(data.error || 'Failed to update entry');
    setStatus('Entry updated.');
    await fetchRecords();
  } catch (err) {
    setStatus(`Could not save entry: ${err.message}`, true);
  }
}

async function deleteRecord(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  try {
    const res = await fetch(`${API_BASE}/records?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.status === 401) return forceLogout('Session expired. Please log in again.');
    if (!res.ok) throw new Error(data.error || 'Failed to delete entry');
    setStatus('Entry deleted.');
    await fetchRecords();
  } catch (err) {
    setStatus(`Could not delete entry: ${err.message}`, true);
  }
}

// --- Login modal ---
els.loginBtn.addEventListener('click', () => {
  els.loginError.textContent = '';
  els.loginModal.classList.remove('hidden');
  document.getElementById('username').focus();
});

els.closeModalBtn.addEventListener('click', () => els.loginModal.classList.add('hidden'));

els.loginModal.addEventListener('click', (e) => {
  if (e.target === els.loginModal) els.loginModal.classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') els.loginModal.classList.add('hidden');
});

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    token = data.token;
    sessionStorage.setItem('logbook_token', token);
    els.loginModal.classList.add('hidden');
    els.loginForm.reset();
    updateModeUI();
    setStatus('Logged in as admin.');
  } catch (err) {
    els.loginError.textContent = err.message;
  }
});

els.logoutBtn.addEventListener('click', () => {
  forceLogout();
  setStatus('Logged out.');
});

els.exportBtn.addEventListener('click', () => {
  if (!records.length) {
    setStatus('Nothing to export yet — the log is empty.', true);
    return;
  }
  const rows = records.map((r) => ({
    Date: formatDate(r.log_date),
    Transaction: r.transaction,
    'Filed By': r.filed_by,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 14 }, { wch: 50 }, { wch: 20 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Logbook');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `logbook-export-${stamp}.xlsx`);
  setStatus('Excel file downloaded.');
});

// --- Add entry ---
els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const log_date = els.newDate.value;
  const transaction = document.getElementById('newTransaction').value.trim();
  const filed_by = document.getElementById('newFiledBy').value.trim();

  if (!log_date || !transaction || !filed_by) {
    setStatus('All fields are required to add an entry.', true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ log_date, transaction, filed_by }),
    });
    const data = await res.json();
    if (res.status === 401) return forceLogout('Session expired. Please log in again.');
    if (!res.ok) throw new Error(data.error || 'Failed to add entry');

    els.addForm.reset();
    els.newDate.value = new Date().toISOString().slice(0, 10);
    setStatus('Entry added.');
    await fetchRecords();
  } catch (err) {
    setStatus(`Could not add entry: ${err.message}`, true);
  }
});

// --- Edit / delete via event delegation ---
els.tableBody.addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.dataset.id;

  if (e.target.classList.contains('delete-btn')) {
    deleteRecord(id);
  } else if (e.target.classList.contains('edit-btn')) {
    startEdit(tr, id);
  }
});

// --- Init ---
els.newDate.value = new Date().toISOString().slice(0, 10);
updateModeUI();
fetchRecords();
