/* =========================================================
   MediCompare — dashboard.js
   Powers both dashboard.html (patient) and
   caregiver-dashboard.html (caregiver + multi-patient).
   ========================================================= */

Auth.requireAuth();

const currentUser = Auth.getUser();

function setStat(index, value, label) {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  const card = grid.children[index];
  if (!card) return;
  card.querySelector('.stat-value').textContent = value;
}

async function loadPatientDashboard() {
  const heading = document.getElementById('welcome-heading');
  if (heading) heading.textContent = `Welcome back, ${currentUser.name.split(' ')[0]}`;

  try {
    const patients = await apiRequest('/api/patients');
    const patient = patients[0];
    if (!patient) {
      document.getElementById('recent-prescriptions').innerHTML =
        `<div class="state-block"><h3>No profile found</h3><p>Something went wrong setting up your profile.</p></div>`;
      return;
    }

    const [prescriptions, savings] = await Promise.all([
      apiRequest(`/api/prescriptions?patient_id=${patient.id}`),
      apiRequest(`/api/savings-history?patient_id=${patient.id}`),
    ]);

    renderStatsAndList(prescriptions, savings, 'recent-prescriptions');
  } catch (err) {
    showToast(err.message, 'error');
    document.getElementById('recent-prescriptions').innerHTML =
      `<div class="state-block"><h3>Couldn't load your dashboard</h3><p>${err.message}</p></div>`;
  }
}

function renderStatsAndList(prescriptions, savings, listElId) {
  const medicinesCompared = prescriptions.reduce((sum, p) => sum + p.medicines.length, 0);
  const pendingVerification = prescriptions.reduce(
    (sum, p) => sum + p.medicines.filter((m) => !m.is_verified).length, 0
  );
  const totalSavings = savings.reduce((sum, s) => sum + s.potential_saving, 0);

  setStat(0, prescriptions.length);
  setStat(1, medicinesCompared);
  setStat(2, formatCurrency(totalSavings));
  setStat(3, pendingVerification);

  const listEl = document.getElementById(listElId);
  if (!listEl) return;

  if (prescriptions.length === 0) {
    listEl.innerHTML = `
      <div class="state-block">
        <h3>No prescriptions yet</h3>
        <p>Scan your first prescription to see extracted medicines and price comparisons.</p>
        <a href="scan.html" class="btn btn-primary" style="margin-top:12px;">Scan prescription</a>
      </div>`;
    return;
  }

  listEl.innerHTML = prescriptions.slice(0, 6).map((p) => {
    const date = new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const statusBadge = p.status === 'verified'
      ? '<span class="badge badge-high">Verified</span>'
      : p.status === 'error'
        ? '<span class="badge badge-low">Error</span>'
        : '<span class="badge badge-medium">Needs review</span>';
    return `
      <div class="list-row">
        <div class="list-row-main">
          <strong>${p.medicines.length} medicine${p.medicines.length === 1 ? '' : 's'} detected${p.is_demo ? ' · Demo' : ''}</strong>
          <span>${date}</span>
        </div>
        <div class="flex items-center gap-3">
          ${statusBadge}
          <a href="analysis.html?id=${p.id}" class="btn btn-outline btn-sm">View</a>
        </div>
      </div>`;
  }).join('');
}

/* ---------- Caregiver dashboard ---------- */

async function loadCaregiverDashboard() {
  const heading = document.getElementById('welcome-heading');
  if (heading) heading.textContent = `Welcome back, ${currentUser.name.split(' ')[0]}`;

  try {
    const patients = await apiRequest('/api/patients');
    renderPatientsGrid(patients);

    let allPrescriptions = [];
    let allSavings = [];
    for (const patient of patients) {
      const [prescriptions, savings] = await Promise.all([
        apiRequest(`/api/prescriptions?patient_id=${patient.id}`),
        apiRequest(`/api/savings-history?patient_id=${patient.id}`),
      ]);
      allPrescriptions = allPrescriptions.concat(prescriptions);
      allSavings = allSavings.concat(savings.map((s) => ({ ...s, patientName: patient.name })));
    }

    setStat(0, patients.length);
    setStat(1, allPrescriptions.length);
    setStat(2, formatCurrency(allSavings.reduce((sum, s) => sum + s.potential_saving, 0)));
    setStat(3, allPrescriptions.reduce((sum, p) => sum + p.medicines.filter((m) => !m.is_verified).length, 0));

    renderCaregiverSavings(allSavings);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPatientsGrid(patients) {
  const grid = document.getElementById('patients-grid');
  if (!grid) return;

  const cards = patients.map((p) => {
    const initials = p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div class="card patient-card">
        <div class="patient-card-head">
          <span class="patient-avatar">${initials}</span>
          <div>
            <h4>${p.name}</h4>
            <span>${p.relationship_label || 'Patient'}${p.age ? ` · ${p.age} yrs` : ''}</span>
          </div>
        </div>
        <div class="patient-card-actions">
          <a href="scan.html?patient_id=${p.id}" class="btn btn-accent btn-sm">Scan prescription</a>
          <a href="history.html?patient_id=${p.id}" class="btn btn-outline btn-sm">View history</a>
        </div>
      </div>`;
  }).join('');

  grid.innerHTML = cards + `
    <button class="card add-patient-card" id="open-add-patient">
      <span style="font-size:1.6rem;">+</span>
      <span>Add patient profile</span>
    </button>`;

  const openBtn = document.getElementById('open-add-patient');
  if (openBtn) openBtn.addEventListener('click', () => toggleModal(true));
}

function renderCaregiverSavings(savingsList) {
  const container = document.getElementById('recent-savings');
  if (!container) return;

  if (savingsList.length === 0) {
    container.innerHTML = `
      <div class="state-block">
        <h3>No savings recorded yet</h3>
        <p>Scan a prescription for one of your patients to start comparing prices.</p>
      </div>`;
    return;
  }

  savingsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  container.innerHTML = savingsList.slice(0, 8).map((s) => {
    const date = new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <div class="list-row">
        <div class="list-row-main">
          <strong>${s.patientName} — Prescription #${s.prescription_id}</strong>
          <span>${date} · Original ${formatCurrency(s.original_estimated_cost)} → Lowest ${formatCurrency(s.lowest_compared_cost)}</span>
        </div>
        <span class="price" style="color:var(--color-accent-dark)">Saved ${formatCurrency(s.potential_saving)}</span>
      </div>`;
  }).join('');
}

function toggleModal(open) {
  const modal = document.getElementById('add-patient-modal');
  if (!modal) return;
  modal.classList.toggle('open', open);
}

const closeModalBtn = document.getElementById('close-modal-btn');
if (closeModalBtn) closeModalBtn.addEventListener('click', () => toggleModal(false));

const addPatientModal = document.getElementById('add-patient-modal');
if (addPatientModal) {
  addPatientModal.addEventListener('click', (e) => {
    if (e.target === addPatientModal) toggleModal(false);
  });
}

const addPatientForm = document.getElementById('add-patient-form');
if (addPatientForm) {
  addPatientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = addPatientForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const name = document.getElementById('patient-name').value.trim();
      const age = document.getElementById('patient-age').value;
      const relationship_label = document.getElementById('patient-relationship').value;
      await apiRequest('/api/patients', {
        method: 'POST',
        body: { name, age: age ? Number(age) : null, relationship_label },
      });
      showToast('Patient profile added.', 'success');
      toggleModal(false);
      addPatientForm.reset();
      loadCaregiverDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------- Entry point ---------- */

if (document.getElementById('patients-grid')) {
  loadCaregiverDashboard();
} else if (document.getElementById('recent-prescriptions')) {
  loadPatientDashboard();
}
