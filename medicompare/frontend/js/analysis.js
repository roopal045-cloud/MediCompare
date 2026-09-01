/* =========================================================
   MediCompare — analysis.js
   ========================================================= */

Auth.requireAuth();

const params = new URLSearchParams(window.location.search);
const prescriptionId = params.get('id');
let prescriptionData = null;

document.getElementById('back-link').href = 'scan.html';

if (!prescriptionId) {
  document.getElementById('medicines-mount').innerHTML =
    `<div class="card state-block"><h3>No prescription selected</h3><p>Go back and scan a prescription first.</p></div>`;
} else {
  loadPrescription();
}

async function loadPrescription() {
  try {
    prescriptionData = await apiRequest(`/api/prescriptions/${prescriptionId}`);
    renderMedicines();
    document.getElementById('show-add-form').style.display = 'block';
    if (prescriptionData.is_demo) document.getElementById('demo-flag').style.display = 'inline-flex';
  } catch (err) {
    document.getElementById('medicines-mount').innerHTML =
      `<div class="card state-block"><h3>Couldn't load this prescription</h3><p>${err.message}</p></div>`;
  }
}

function renderMedicines() {
  const mount = document.getElementById('medicines-mount');
  const meds = prescriptionData.medicines;

  if (meds.length === 0) {
    mount.innerHTML = `
      <div class="card state-block">
        <h3>No medicines detected</h3>
        <p>Add medicines manually below, or try scanning again with a clearer image.</p>
      </div>`;
    return;
  }

  mount.innerHTML = meds.map((m) => medicineCardHtml(m)).join('');

  meds.forEach((m) => {
    const editBtn = document.getElementById(`edit-btn-${m.id}`);
    const cancelBtn = document.getElementById(`cancel-btn-${m.id}`);
    const form = document.getElementById(`edit-form-${m.id}`);
    if (editBtn) editBtn.addEventListener('click', () => form.classList.toggle('open'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => form.classList.remove('open'));

    const saveForm = document.getElementById(`save-form-${m.id}`);
    if (saveForm) {
      saveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveMedicineEdit(m.id);
      });
    }
  });
}

function medicineCardHtml(m) {
  const isLow = m.confidence < 0.7 && !m.is_verified;
  const cardClass = isLow ? 'low-confidence' : (m.is_verified ? 'verified' : '');
  const badgeClass = m.added_manually ? 'badge-high' : confidenceBadgeClass(m.confidence);
  const badgeText = m.added_manually ? 'Added manually' : confidenceLabel(m.confidence);

  return `
    <div class="card medicine-card ${cardClass}" id="card-${m.id}">
      <div class="medicine-card-head">
        <div>
          <h3>${escapeHtml(m.medicine_name)}</h3>
          <span class="medicine-salt">${escapeHtml(m.salt || 'Salt not specified')} ${m.strength ? '· ' + escapeHtml(m.strength) : ''}</span>
        </div>
        <span class="badge ${badgeClass}"><span class="badge-dot"></span>${badgeText}</span>
      </div>

      <div class="medicine-fields">
        <div>
          <div class="medicine-field-label">Dosage</div>
          <div class="medicine-field-value">${escapeHtml(m.dosage || '—')}</div>
        </div>
        <div>
          <div class="medicine-field-label">Duration</div>
          <div class="medicine-field-value">${escapeHtml(m.duration || '—')}</div>
        </div>
      </div>

      <div class="medicine-card-foot">
        <span class="field-hint">${m.is_verified ? '✓ Verified' : 'Not yet verified'}</span>
        <button class="btn btn-outline btn-sm" id="edit-btn-${m.id}" type="button">Edit</button>
      </div>

      <form class="edit-form" id="edit-form-${m.id}">
        <hr class="perforated-divider" style="margin: var(--space-4) 0;">
        <div class="medicine-fields">
          <div class="field"><label>Medicine name</label><input type="text" id="field-name-${m.id}" value="${escapeAttr(m.medicine_name)}"></div>
          <div class="field"><label>Salt / active ingredient</label><input type="text" id="field-salt-${m.id}" value="${escapeAttr(m.salt || '')}"></div>
          <div class="field"><label>Strength</label><input type="text" id="field-strength-${m.id}" value="${escapeAttr(m.strength || '')}"></div>
          <div class="field"><label>Duration</label><input type="text" id="field-duration-${m.id}" value="${escapeAttr(m.duration || '')}"></div>
        </div>
        <div class="field"><label>Dosage</label><input type="text" id="field-dosage-${m.id}" value="${escapeAttr(m.dosage || '')}"></div>
        <div class="flex gap-3">
          <button type="submit" class="btn btn-primary btn-sm">Save changes</button>
          <button type="button" class="btn btn-ghost btn-sm" id="cancel-btn-${m.id}">Cancel</button>
        </div>
      </form>
    </div>`;
}

async function saveMedicineEdit(medicineId) {
  try {
    const payload = {
      medicine_name: document.getElementById(`field-name-${medicineId}`).value.trim(),
      salt: document.getElementById(`field-salt-${medicineId}`).value.trim(),
      strength: document.getElementById(`field-strength-${medicineId}`).value.trim(),
      dosage: document.getElementById(`field-dosage-${medicineId}`).value.trim(),
      duration: document.getElementById(`field-duration-${medicineId}`).value.trim(),
    };
    await apiRequest(`/api/prescriptions/${prescriptionId}/medicines/${medicineId}`, {
      method: 'PUT',
      body: payload,
    });
    showToast('Medicine updated.', 'success');
    await loadPrescription();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---------- Add medicine manually ---------- */

const showAddFormBtn = document.getElementById('show-add-form');
const addFormCard = document.getElementById('add-medicine-form-card');
showAddFormBtn.addEventListener('click', () => {
  addFormCard.style.display = 'block';
  showAddFormBtn.style.display = 'none';
});
document.getElementById('cancel-add-medicine').addEventListener('click', () => {
  addFormCard.style.display = 'none';
  showAddFormBtn.style.display = 'block';
});

document.getElementById('add-medicine-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = {
      medicine_name: document.getElementById('new-medicine-name').value.trim(),
      salt: document.getElementById('new-medicine-salt').value.trim(),
      strength: document.getElementById('new-medicine-strength').value.trim(),
      dosage: document.getElementById('new-medicine-dosage').value.trim(),
      duration: document.getElementById('new-medicine-duration').value.trim(),
    };
    if (!payload.medicine_name) {
      showToast('Please enter a medicine name.', 'error');
      return;
    }
    await apiRequest(`/api/prescriptions/${prescriptionId}/medicines`, {
      method: 'POST',
      body: payload,
    });
    showToast('Medicine added.', 'success');
    document.getElementById('add-medicine-form').reset();
    addFormCard.style.display = 'none';
    showAddFormBtn.style.display = 'block';
    await loadPrescription();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ---------- Verify & continue ---------- */

document.getElementById('verify-continue-btn').addEventListener('click', async () => {
  const btn = document.getElementById('verify-continue-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await apiRequest(`/api/prescriptions/${prescriptionId}/verify`, { method: 'POST' });
    window.location.href = `comparison.html?id=${prescriptionId}`;
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Verify & continue';
  }
});

/* ---------- Helpers ---------- */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;');
}
