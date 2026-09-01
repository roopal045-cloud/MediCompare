/* =========================================================
   MediCompare — history.js
   ========================================================= */

Auth.requireAuth();

const currentUser = Auth.getUser();
const urlParams = new URLSearchParams(window.location.search);
let activePatientId = urlParams.get('patient_id');

init();

async function init() {
  try {
    const patients = await apiRequest('/api/patients');

    if (currentUser.role === 'caregiver' && patients.length > 1) {
      renderPatientSwitcher(patients);
    }

    if (!activePatientId && currentUser.role === 'patient' && patients[0]) {
      activePatientId = patients[0].id;
    }

    await loadHistory(activePatientId, patients);
  } catch (err) {
    document.getElementById('history-mount').innerHTML =
      `<div class="state-block"><h3>Couldn't load history</h3><p>${err.message}</p></div>`;
  }
}

function renderPatientSwitcher(patients) {
  const mount = document.getElementById('patient-switcher-mount');
  mount.innerHTML = `
    <select id="patient-switcher" class="field" style="min-width:220px; padding:10px 14px; border:1.5px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface);">
      <option value="">All patients</option>
      ${patients.map((p) => `<option value="${p.id}" ${String(p.id) === activePatientId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
    </select>`;
  document.getElementById('patient-switcher').addEventListener('change', (e) => {
    activePatientId = e.target.value || null;
    loadHistory(activePatientId, patients);
  });
}

async function loadHistory(patientId, allPatients) {
  const mount = document.getElementById('history-mount');
  mount.innerHTML = `<div class="state-block"><div class="spinner"></div>Loading history…</div>`;

  try {
    let records;
    const patientNameMap = {};
    allPatients.forEach((p) => { patientNameMap[p.id] = p.name; });

    if (patientId) {
      records = await apiRequest(`/api/savings-history?patient_id=${patientId}`);
      const patient = allPatients.find((p) => String(p.id) === String(patientId));
      document.getElementById('history-subhead').textContent = patient
        ? `Savings history for ${patient.name}.`
        : 'Every prescription compared, and what it could have saved.';
    } else {
      records = [];
      for (const p of allPatients) {
        const patientRecords = await apiRequest(`/api/savings-history?patient_id=${p.id}`);
        records = records.concat(patientRecords);
      }
      document.getElementById('history-subhead').textContent = 'Savings history across all patients you manage.';
    }

    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderStats(records);
    renderList(records, patientNameMap, !patientId);
  } catch (err) {
    mount.innerHTML = `<div class="state-block"><h3>Couldn't load history</h3><p>${err.message}</p></div>`;
  }
}

function renderStats(records) {
  const grid = document.getElementById('stats-grid');
  const total = records.reduce((sum, r) => sum + r.potential_saving, 0);
  const avg = records.length ? total / records.length : 0;
  grid.children[0].querySelector('.stat-value').textContent = records.length;
  grid.children[1].querySelector('.stat-value').textContent = formatCurrency(total);
  grid.children[2].querySelector('.stat-value').textContent = formatCurrency(avg);
}

function renderList(records, patientNameMap, showPatientName) {
  const mount = document.getElementById('history-mount');

  if (records.length === 0) {
    mount.innerHTML = `
      <div class="state-block">
        <h3>No savings history yet</h3>
        <p>Scan and compare a prescription to start building your savings history.</p>
        <a href="scan.html" class="btn btn-primary" style="margin-top:12px;">Scan prescription</a>
      </div>`;
    return;
  }

  mount.innerHTML = records.map((r) => {
    const date = new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const patientLabel = showPatientName && patientNameMap[r.patient_id] ? `${patientNameMap[r.patient_id]} — ` : '';
    return `
      <div class="list-row">
        <div class="list-row-main">
          <strong>${patientLabel}Prescription — ${date}</strong>
          <span>Original estimated cost ${formatCurrency(r.original_estimated_cost)} → Lowest compared cost ${formatCurrency(r.lowest_compared_cost)}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="price" style="color:var(--color-accent-dark)">Saved ${formatCurrency(r.potential_saving)}</span>
          <a href="comparison.html?id=${r.prescription_id}" class="btn btn-outline btn-sm">Review</a>
        </div>
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
