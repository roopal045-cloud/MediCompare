/* =========================================================
   MediCompare — comparison.js
   ========================================================= */

Auth.requireAuth();

const params = new URLSearchParams(window.location.search);
const prescriptionId = params.get('id');

document.getElementById('back-link').href = prescriptionId ? `analysis.html?id=${prescriptionId}` : 'scan.html';

if (!prescriptionId) {
  document.getElementById('comparisons-mount').innerHTML =
    `<div class="card state-block"><h3>No prescription selected</h3><p>Go back and scan a prescription first.</p></div>`;
} else {
  loadComparisons();
}

async function loadComparisons() {
  try {
    const prescription = await apiRequest(`/api/prescriptions/${prescriptionId}`);
    document.getElementById('view-history-link').href = `history.html?patient_id=${prescription.patient_id}`;

    if (prescription.medicines.length === 0) {
      document.getElementById('comparisons-mount').innerHTML =
        `<div class="card state-block"><h3>No medicines to compare</h3><p>Go back and add at least one medicine.</p></div>`;
      return;
    }

    const results = [];
    for (const med of prescription.medicines) {
      try {
        const result = await apiRequest('/api/comparisons', {
          method: 'POST',
          body: { prescription_medicine_id: med.id },
        });
        results.push(result);
      } catch (err) {
        results.push({
          prescription_medicine_id: med.id,
          prescribed_name: med.medicine_name,
          match_status: 'unmatched',
          options: [],
          prescribed_price: null,
          lowest_generic_price: null,
          lowest_jan_aushadhi_price: null,
          potential_saving: 0,
        });
      }
    }

    renderSummary(results);
    renderComparisons(results);
  } catch (err) {
    document.getElementById('comparisons-mount').innerHTML =
      `<div class="card state-block"><h3>Couldn't load comparisons</h3><p>${err.message}</p></div>`;
  }
}

function renderSummary(results) {
  const matched = results.filter((r) => r.match_status === 'matched');
  const totalPrescribed = matched.reduce((sum, r) => sum + (r.prescribed_price || 0), 0);
  const totalSaving = matched.reduce((sum, r) => sum + (r.potential_saving || 0), 0);
  const totalLowest = totalPrescribed - totalSaving;

  const mount = document.getElementById('summary-mount');
  if (matched.length === 0) {
    mount.innerHTML = '';
    return;
  }

  mount.innerHTML = `
    <div class="savings-summary">
      <div>
        <div class="savings-summary-label">Total potential saving across this prescription</div>
        <div class="price price-xl">${formatCurrency(totalSaving)}</div>
      </div>
      <div class="savings-summary-breakdown">
        <div><span>Prescribed total</span><span class="price">${formatCurrency(totalPrescribed)}</span></div>
        <div><span>Lowest compared</span><span class="price">${formatCurrency(totalLowest)}</span></div>
      </div>
    </div>`;
}

function renderComparisons(results) {
  const mount = document.getElementById('comparisons-mount');
  mount.innerHTML = results.map((r) => comparisonBlockHtml(r)).join('');
}

function comparisonBlockHtml(r) {
  if (r.match_status !== 'matched') {
    return `
      <div class="card medicine-comparison-block">
        <div class="mc-head"><div><h3>${escapeHtml(r.prescribed_name)}</h3></div></div>
        <div class="unmatched-block">
          <p>We couldn't find a verified catalogue match for this medicine yet, so no comparison is available.</p>
          <span class="field-hint">You can still discuss generic options with your pharmacist directly.</span>
        </div>
      </div>`;
  }

  const prescribedOpt = r.options.find((o) => o.type === 'Prescribed');
  const genericOpts = r.options.filter((o) => o.type === 'Generic');
  const jaOpts = r.options.filter((o) => o.type === 'Jan Aushadhi');
  const bestGeneric = genericOpts.length ? genericOpts.reduce((a, b) => (a.price < b.price ? a : b)) : null;
  const bestJA = jaOpts.length ? jaOpts.reduce((a, b) => (a.price < b.price ? a : b)) : null;

  const maxPrice = Math.max(r.prescribed_price || 0, 1);

  const ladderRow = (label, price, colorVar) => {
    const width = price ? Math.max(6, Math.round((price / maxPrice) * 100)) : 0;
    return `
      <div class="ladder-row">
        <span class="ladder-label">${label}</span>
        <span class="ladder-track"><span class="ladder-fill" style="width:${width}%; background:${colorVar}"></span></span>
        <span class="price">${price !== null && price !== undefined ? formatCurrency(price) : '—'}</span>
      </div>`;
  };

  const optionCard = (opt, typeClass, tagText) => {
    if (!opt) return '';
    const isBest = tagText ? `<span class="option-save-tag">${tagText}</span>` : '';
    return `
      <div class="option-card ${typeClass}">
        ${isBest}
        <div class="option-type-label">${opt.type}</div>
        <div class="option-brand">${escapeHtml(opt.brand)}</div>
        <div class="option-meta">${escapeHtml(opt.manufacturer || '')} · ${escapeHtml(opt.pack_size || '')}</div>
        <div class="price">${formatCurrency(opt.price)}</div>
      </div>`;
  };

  const savingTag = r.potential_saving > 0 ? `Save ${formatCurrency(r.potential_saving)}` : null;

  const tableRows = r.options.map((o) => `
    <tr>
      <td data-label="Option">${o.type}</td>
      <td data-label="Brand">${escapeHtml(o.brand)}</td>
      <td data-label="Salt">${escapeHtml(o.salt)}</td>
      <td data-label="Strength">${escapeHtml(o.strength)}</td>
      <td data-label="Manufacturer">${escapeHtml(o.manufacturer || '—')}</td>
      <td data-label="Pack size">${escapeHtml(o.pack_size || '—')}</td>
      <td data-label="Price" class="price">${formatCurrency(o.price)}</td>
      <td data-label="Source"><span class="field-hint">${escapeHtml(o.source)}</span></td>
    </tr>`).join('');

  return `
    <div class="card medicine-comparison-block">
      <div class="mc-head">
        <div>
          <h3>${escapeHtml(r.prescribed_name)}</h3>
          <span class="mc-sub">Same composition matches only — active ingredient, strength & dosage form</span>
        </div>
        ${r.potential_saving > 0 ? `<span class="badge badge-medium"><span class="badge-dot"></span>Save ${formatCurrency(r.potential_saving)}</span>` : `<span class="badge badge-neutral">Already lowest priced</span>`}
      </div>

      <div class="ladder-demo" style="padding:0; margin-bottom: var(--space-5);">
        ${ladderRow('Prescribed', r.prescribed_price, 'var(--color-ink-faint)')}
        ${r.lowest_generic_price !== null ? ladderRow('Generic', r.lowest_generic_price, 'var(--color-primary)') : ''}
        ${r.lowest_jan_aushadhi_price !== null ? ladderRow('Jan Aushadhi', r.lowest_jan_aushadhi_price, 'var(--color-accent)') : ''}
      </div>

      <div class="comparison-columns">
        ${optionCard(prescribedOpt, 'type-prescribed', null)}
        ${optionCard(bestGeneric, 'type-generic', bestGeneric && bestGeneric.price < (r.prescribed_price || 0) ? `Save ${formatCurrency(r.prescribed_price - bestGeneric.price)}` : null)}
        ${optionCard(bestJA, 'type-jan-aushadhi', bestJA && bestJA.price < (r.prescribed_price || 0) ? `Save ${formatCurrency(r.prescribed_price - bestJA.price)}` : null)}
      </div>

      <details>
        <summary class="field-hint" style="cursor:pointer; margin-bottom: var(--space-3);">View all ${r.options.length} options in detail</summary>
        <div class="comparison-table-wrap">
          <table class="comparison-table responsive-table">
            <thead>
              <tr><th>Option</th><th>Brand</th><th>Salt</th><th>Strength</th><th>Manufacturer</th><th>Pack size</th><th>Price</th><th>Source</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </details>

      <div class="substitution-note">
        Same active ingredient, strength, and dosage form as prescribed. Please confirm any switch with your doctor or pharmacist.
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
