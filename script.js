const API_BASE = '/api';

let token = sessionStorage.getItem('logbook_token') || null;
let records = [];
let currentPage = 1;
let totalPages = 1;
let totalCount = 0;
const pageSize = 15;
let searchTerm = '';
let searchDebounceTimer = null;

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
  searchInput: document.getElementById('searchInput'),
  pagination: document.getElementById('pagination'),
  storageWarning: document.getElementById('storageWarning'),
  storageWidget: document.getElementById('storageWidget'),
  storageBarFill: document.getElementById('storageBarFill'),
  storageWidgetKb: document.getElementById('storageWidgetKb'),
  storageWidgetPercent: document.getElementById('storageWidgetPercent'),
  storageWidgetLimit: document.getElementById('storageWidgetLimit'),
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
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAmount(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toDatetimeInputValue(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toEditDatetimeValue(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return toDatetimeInputValue(d);
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

function renderStorageWarning(storage) {
  // Hide old banner always — we use the widget instead
  els.storageWarning.classList.add('hidden');

  if (!storage || !storage.limitBytes) {
    els.storageWidget.classList.add('hidden');
    return;
  }

  const percent = storage.percent;
  const usedKb = (storage.bytes / 1024).toFixed(1);
  const limitKb = (storage.limitBytes / 1024).toFixed(0);
  const remainKb = ((storage.limitBytes - storage.bytes) / 1024).toFixed(1);
  const limitMb = Math.round(storage.limitBytes / (1024 * 1024));

  // Show widget
  els.storageWidget.classList.remove('hidden');

  // Bar fill + color
  els.storageBarFill.style.width = `${Math.min(percent, 100).toFixed(1)}%`;
  els.storageBarFill.classList.remove('warn', 'danger');
  if (percent >= 90) els.storageBarFill.classList.add('danger');
  else if (percent >= 75) els.storageBarFill.classList.add('warn');

  // Labels
  els.storageWidgetKb.textContent = `${usedKb} KB used`;
  els.storageWidgetPercent.textContent = `${percent.toFixed(1)}%`;
  els.storageWidgetLimit.textContent = `${remainKb} KB left`;
}

async function fetchRecords() {
  setStatus('Loading entries…');
  try {
    const params = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) });
    if (searchTerm) params.set('search', searchTerm);

    const res = await fetch(`${API_BASE}/records?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load entries');

    records = data.records;
    currentPage = data.pagination.page;
    totalPages = data.pagination.totalPages;
    totalCount = data.pagination.total;

    renderTable();
    renderPagination();
    renderStorageWarning(data.storage);
    setStatus('');
  } catch (err) {
    setStatus(`Could not load entries: ${err.message}`, true);
  }
}

function renderTable() {
  els.tableBody.innerHTML = '';

  if (!records.length) {
    els.emptyState.textContent = searchTerm
      ? 'No entries match your search.'
      : 'No entries yet. The page is blank, waiting for the first record.';
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');

  records.forEach((r) => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="cell-date cell-mono">${formatDate(r.log_date)}</td>
      <td class="cell-name">${escapeHtml(r.name)}</td>
      <td class="cell-mono">${escapeHtml(r.control_no)}</td>
      <td>${escapeHtml(r.course)}</td>
      <td>${escapeHtml(r.documents_released)}</td>
      <td>${escapeHtml(r.purpose)}</td>
      <td class="cell-mono">${escapeHtml(r.receipt_no)}</td>
      <td class="cell-amount">${formatAmount(r.amount)}</td>
      ${isAdmin() ? `
      <td class="cell-actions">
        <button class="btn-icon edit-btn" title="Edit entry" aria-label="Edit entry">&#9998;</button>
        <button class="btn-icon delete-btn" title="Delete entry" aria-label="Delete entry">&#128465;</button>
      </td>` : ''}
    `;
    els.tableBody.appendChild(tr);
  });
}

function getPageNumbers(current, total) {
  const delta = 1;
  const range = [];
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    range.push(i);
  }
  if (range[0] > 1) {
    if (range[0] > 2) range.unshift('...');
    range.unshift(1);
  }
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) range.push('...');
    range.push(total);
  }
  return range;
}

function goToPage(p) {
  if (p < 1 || p > totalPages || p === currentPage) return;
  currentPage = p;
  fetchRecords();
}

function renderPagination() {
  els.pagination.innerHTML = '';
  if (totalCount === 0) return;

  const info = document.createElement('span');
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  info.textContent = `Showing ${start}–${end} of ${totalCount} entries`;
  els.pagination.appendChild(info);

  if (totalPages > 1) {
    const pagesWrap = document.createElement('div');
    pagesWrap.className = 'pagination-pages';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = '‹ Prev';
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    pagesWrap.appendChild(prevBtn);

    getPageNumbers(currentPage, totalPages).forEach((p) => {
      if (p === '...') {
        const span = document.createElement('span');
        span.className = 'page-ellipsis';
        span.textContent = '…';
        pagesWrap.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = String(p);
        btn.addEventListener('click', () => goToPage(p));
        pagesWrap.appendChild(btn);
      }
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = 'Next ›';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
    pagesWrap.appendChild(nextBtn);

    els.pagination.appendChild(pagesWrap);
  }
}

function startEdit(tr, id) {
  const record = records.find((r) => String(r.id) === String(id));
  if (!record) return;

  tr.innerHTML = `
    <td><input type="datetime-local" class="edit-date" value="${toEditDatetimeValue(record.log_date)}"></td>
    <td><input type="text" class="edit-name" value="${escapeAttr(record.name)}"></td>
    <td><input type="text" class="edit-control" value="${escapeAttr(record.control_no)}"></td>
    <td><input type="text" class="edit-course" value="${escapeAttr(record.course)}"></td>
    <td><input type="text" class="edit-released" value="${escapeAttr(record.documents_released)}"></td>
    <td><input type="text" class="edit-purpose" value="${escapeAttr(record.purpose)}"></td>
    <td><input type="text" class="edit-receipt" value="${escapeAttr(record.receipt_no)}"></td>
    <td><input type="number" step="0.01" min="0" class="edit-amount" value="${escapeAttr(record.amount)}"></td>
    <td class="cell-actions">
      <button class="btn-icon save-btn" title="Save changes" aria-label="Save changes">&#10003;</button>
      <button class="btn-icon cancel-btn" title="Cancel" aria-label="Cancel">&#10005;</button>
    </td>
  `;
  tr.querySelector('.save-btn').addEventListener('click', () => saveEdit(tr, id));
  tr.querySelector('.cancel-btn').addEventListener('click', () => renderTable());
}

function collectFields(scope) {
  const get = (cls) => scope.querySelector(cls);
  return {
    log_date: get('.edit-date, #newDate')?.value,
    name: get('.edit-name, #newName')?.value.trim(),
    control_no: get('.edit-control, #newControlNo')?.value.trim(),
    course: get('.edit-course, #newCourse')?.value.trim(),
    documents_released: get('.edit-released, #newDocumentsReleased')?.value.trim(),
    purpose: get('.edit-purpose, #newPurpose')?.value.trim(),
    receipt_no: get('.edit-receipt, #newReceiptNo')?.value.trim(),
    amount: get('.edit-amount, #newAmount')?.value,
  };
}

function fieldsAreValid(f) {
  if (!f.log_date || !f.name || !f.control_no || !f.course || !f.documents_released || !f.purpose || !f.receipt_no) {
    return 'All fields are required.';
  }
  const amount = Number(f.amount);
  if (f.amount === '' || f.amount === undefined || Number.isNaN(amount) || amount < 0) {
    return 'Amount must be a valid number (0 or more).';
  }
  return null;
}

async function saveEdit(tr, id) {
  const fields = collectFields(tr);
  const error = fieldsAreValid(fields);
  if (error) {
    setStatus(error, true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/records?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...fields, amount: Number(fields.amount) }),
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

// --- Export to Excel (exports ALL matching records, not just the current page) ---
els.exportBtn.addEventListener('click', async () => {
  setStatus('Preparing export…');
  try {
    const params = new URLSearchParams({ page: '1', pageSize: '2000' });
    if (searchTerm) params.set('search', searchTerm);

    const res = await fetch(`${API_BASE}/records?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load records for export');

    if (!data.records.length) {
      setStatus('Nothing to export yet.', true);
      return;
    }

    const rows = data.records.map((r) => ({
      'Date & Time': formatDate(r.log_date),
      Name: r.name,
      'Control Number': r.control_no,
      Course: r.course,
      'Documents Released': r.documents_released,
      Purpose: r.purpose,
      'Receipt Number': r.receipt_no,
      Amount: Number(r.amount),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 18 },
      { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Logbook');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `logbook-export-${stamp}.xlsx`);
    setStatus('Excel file downloaded.');
  } catch (err) {
    setStatus(`Could not export: ${err.message}`, true);
  }
});

// --- Search ---
els.searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchTerm = els.searchInput.value.trim();
    currentPage = 1;
    fetchRecords();
  }, 350);
});

// --- Add entry ---
els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fields = collectFields(els.addForm);
  const error = fieldsAreValid(fields);
  if (error) {
    setStatus(error, true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...fields, amount: Number(fields.amount) }),
    });
    const data = await res.json();
    if (res.status === 401) return forceLogout('Session expired. Please log in again.');
    if (!res.ok) throw new Error(data.error || 'Failed to add entry');

    els.addForm.reset();
    els.newDate.value = toDatetimeInputValue();
    setStatus('Entry added.');
    currentPage = 1; // newest entries sort first, so jump back to page 1
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
els.newDate.value = toDatetimeInputValue();
updateModeUI();
fetchRecords();
