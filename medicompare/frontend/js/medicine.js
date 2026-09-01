/* =========================================================
   MediCompare — medicine.js
   ========================================================= */

const params = new URLSearchParams(window.location.search);
const medicineId = params.get('id');

if (!medicineId) {
  document.getElementById('medicine-mount').innerHTML =
    `<div class="card state-block"><h3>No medicine selected</h3><p>Go back and search for a medicine.</p></div>`;
} else {
  loadMedicine();
}

async function loadMedicine() {
  try {
    const [medicine, alternatives] = await Promise.all([
      apiRequest(`/api/medicines/${medicineId}`, { auth: false }),
      apiRequest(`/api/medicines/${medicineId}/alternatives`, { auth: false }),
    ]);
    render(medicine, alternatives);
  } catch (err) {
    document.getElementById('medicine-mount').innerHTML =
      `<div class="card state-block"><h3>Couldn't load this medicine</h3><p>${err.message}</p></div>`;
  }
}

function render(m, alternatives) {
  document.title = `${m.brand_name} — MediCompare`;

  const cheaperAlts = alternatives
    .filter((a) => a.price < m.price)
    .sort((a, b) => a.price - b.price);

  document.getElementById('medicine-mount').innerHTML = `
    <div class="medicine-hero">
      <div>
        <span class="eyebrow">${escapeHtml(m.medicine_category || 'Medicine')}</span>
        <h1>${escapeHtml(m.brand_name)}</h1>
        <div class="medicine-hero-meta">${escapeHtml(m.active_ingredient)} · ${escapeHtml(m.strength)} · ${escapeHtml(m.dosage_form)}</div>
      </div>
      <div class="medicine-hero-price">
        <span class="price price-lg">${formatCurrency(m.price)}</span>
        <span class="field-hint">${escapeHtml(m.pack_size || '')} · ${escapeHtml(m.source)}</span>
      </div>
    </div>

    <div class="medicine-detail-grid">
      <div>
        <div class="card info-block">
          <h4>💊 Why is this medicine used?</h4>
          <p>${escapeHtml(m.common_uses || 'Use information is not available for this medicine in our demo catalogue.')}</p>
        </div>

        <div class="card info-block">
          <h4>⚙️ How does it work?</h4>
          <p>${howItWorksText(m)}</p>
        </div>

        <div class="card info-block">
          <h4>⚠ Common side effects</h4>
          <p>${escapeHtml(m.common_side_effects || 'Side effect information is not available for this medicine in our demo catalogue.')}</p>
        </div>

        <div class="card info-block">
          <h4>🛡 Important precautions</h4>
          <p>${escapeHtml(m.warnings || 'No specific precautions listed. Always follow your doctor\'s instructions.')}</p>
        </div>

        <div class="card info-block">
          <h4>🚑 When should I contact a doctor?</h4>
          <p>Contact your doctor or seek urgent care if you notice a severe allergic reaction (swelling, difficulty
             breathing, rash), symptoms that worsen instead of improve, or any effect that concerns you. Never start,
             stop, or switch a medicine without your doctor's or pharmacist's guidance.</p>
        </div>

        <div class="disclaimer">
          <span style="font-size:1.2rem;">ⓘ</span>
          <div>This information is educational only and does not replace advice from a qualified healthcare
          professional. Do not start, stop, or substitute medicines without consulting your doctor or pharmacist.</div>
        </div>
      </div>

      <div>
        <div class="card side-card">
          <h4>At a glance</h4>
          <div class="side-stat"><span>Manufacturer</span><span>${escapeHtml(m.manufacturer || '—')}</span></div>
          <div class="side-stat"><span>Pack size</span><span>${escapeHtml(m.pack_size || '—')}</span></div>
          <div class="side-stat"><span>MRP</span><span>${formatCurrency(m.mrp)}</span></div>
          <div class="side-stat"><span>Generic available</span><span>${m.generic_available ? 'Yes' : 'No'}</span></div>
          <div class="side-stat"><span>Jan Aushadhi</span><span>${m.jan_aushadhi_available ? `Yes · ${formatCurrency(m.jan_aushadhi_price)}` : 'Not listed'}</span></div>
        </div>

        <div class="card side-card">
          <h4>Same-composition alternatives</h4>
          ${cheaperAlts.length === 0 ? `<p class="field-hint">No lower-priced same-composition alternatives found in our demo catalogue.</p>` : `
            <div class="alternatives-list">
              ${cheaperAlts.slice(0, 5).map((a) => `
                <a href="medicine.html?id=${a.id}" class="alt-row" style="text-decoration:none; color:inherit;">
                  <div class="alt-row-info">
                    <strong>${escapeHtml(a.brand_name)}</strong>
                    <span>${escapeHtml(a.manufacturer || '')}${a.jan_aushadhi_available ? ' · Jan Aushadhi' : ''}</span>
                  </div>
                  <span class="price">${formatCurrency(a.price)}</span>
                </a>`).join('')}
            </div>`}
        </div>

        <a href="search.html" class="btn btn-outline btn-block">Back to search</a>
      </div>
    </div>
  `;
}

function howItWorksText(m) {
  const category = (m.medicine_category || '').toLowerCase();
  if (category.includes('ppi') || category.includes('antacid')) {
    return 'It reduces the amount of acid your stomach produces, which helps relieve discomfort and allows the stomach lining to heal.';
  }
  if (category.includes('antibiotic')) {
    return 'It works by stopping the growth of bacteria causing your infection. It only works on bacterial infections, not viral ones like the common cold.';
  }
  if (category.includes('anti-emetic')) {
    return 'It blocks signals in the body that trigger the feeling of nausea and the urge to vomit.';
  }
  if (category.includes('analgesic') || category.includes('antipyretic')) {
    return 'It works on the body\'s pain and temperature-control signals to relieve pain and reduce fever.';
  }
  if (category.includes('diabetic')) {
    return 'It helps your body respond better to insulin and reduces the amount of sugar your liver releases into the blood.';
  }
  if (category.includes('statin') || category.includes('lipid')) {
    return 'It reduces the amount of cholesterol your liver produces, helping lower cholesterol levels in the blood over time.';
  }
  if (category.includes('hypertensive')) {
    return 'It relaxes and widens blood vessels, making it easier for the heart to pump blood and lowering blood pressure.';
  }
  if (category.includes('allergic')) {
    return 'It blocks histamine, a chemical your body releases during an allergic reaction, easing symptoms like itching and sneezing.';
  }
  return 'Detailed mechanism information is not available for this medicine in our demo catalogue. Ask your pharmacist for specifics.';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
