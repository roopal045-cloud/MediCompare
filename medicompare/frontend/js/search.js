/* =========================================================
   MediCompare — search.js
   ========================================================= */

let debounceTimer = null;

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const filterGeneric = document.getElementById('filter-generic');
const filterJA = document.getElementById('filter-ja');
const filterPrice = document.getElementById('filter-price');
const filterPriceValue = document.getElementById('filter-price-value');

function updatePriceLabel() {
  const val = Number(filterPrice.value);
  filterPriceValue.textContent = val >= 250 ? '₹250+' : `Up to ₹${val}`;
}

filterPrice.addEventListener('input', () => { updatePriceLabel(); scheduleSearch(); });
filterGeneric.addEventListener('change', runSearch);
filterJA.addEventListener('change', runSearch);
searchBtn.addEventListener('click', runSearch);
searchInput.addEventListener('input', scheduleSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

document.getElementById('reset-filters').addEventListener('click', () => {
  searchInput.value = '';
  filterGeneric.checked = false;
  filterJA.checked = false;
  filterPrice.value = 250;
  updatePriceLabel();
  runSearch();
});

function scheduleSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, 350);
}

async function runSearch() {
  const grid = document.getElementById('results-grid');
  const countEl = document.getElementById('results-count');
  grid.innerHTML = `<div class="state-block" style="grid-column: 1 / -1;"><div class="spinner"></div>Searching…</div>`;

  const q = searchInput.value.trim();
  const maxPrice = Number(filterPrice.value);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (maxPrice < 250) params.set('max_price', maxPrice);
  if (filterGeneric.checked) params.set('generic_only', 'true');
  if (filterJA.checked) params.set('jan_aushadhi_only', 'true');

  try {
    const results = await apiRequest(`/api/medicines/search?${params.toString()}`, { auth: false });
    countEl.textContent = `${results.length} medicine${results.length === 1 ? '' : 's'} found`;

    if (results.length === 0) {
      grid.innerHTML = `
        <div class="state-block" style="grid-column: 1 / -1;">
          <h3>No medicines found</h3>
          <p>Try a different search term, or reset your filters.</p>
        </div>`;
      return;
    }

    grid.innerHTML = results.map((m) => resultCardHtml(m)).join('');
  } catch (err) {
    grid.innerHTML = `<div class="state-block" style="grid-column: 1 / -1;"><h3>Search failed</h3><p>${err.message}</p></div>`;
  }
}

function resultCardHtml(m) {
  const tags = [];
  if (m.generic_available) tags.push('<span class="badge badge-high">Generic</span>');
  if (m.jan_aushadhi_available) tags.push('<span class="badge badge-medium">Jan Aushadhi</span>');

  return `
    <a class="card card-hover result-card" href="medicine.html?id=${m.id}">
      <div class="result-card-head">
        <div>
          <h4>${escapeHtml(m.brand_name)}</h4>
          <div class="result-card-meta">${escapeHtml(m.active_ingredient)} · ${escapeHtml(m.strength)} · ${escapeHtml(m.dosage_form)}</div>
        </div>
      </div>
      <div class="result-card-foot">
        <div class="result-tags">${tags.join('')}</div>
        <span class="price price-lg">${formatCurrency(m.price)}</span>
      </div>
    </a>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

updatePriceLabel();
runSearch();
