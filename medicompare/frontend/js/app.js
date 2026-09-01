/* =========================================================
   MediCompare — app.js
   Shared API client, auth/session helpers, and small UI
   utilities (toasts, nav rendering) used across every page.
   ========================================================= */

const API_BASE = 'http://localhost:8000';

const Auth = {
  getToken() { return localStorage.getItem('mc_token'); },
  getUser() {
    const raw = localStorage.getItem('mc_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem('mc_token', token);
    localStorage.setItem('mc_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('mc_token');
    localStorage.removeItem('mc_user');
  },
  isLoggedIn() { return !!this.getToken(); },
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
    }
  },
};

async function apiRequest(path, { method = 'GET', body = null, isForm = false, auth = true } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (auth && Auth.getToken()) headers['Authorization'] = `Bearer ${Auth.getToken()}`;

  const opts = { method, headers };
  if (body) opts.body = isForm ? body : JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (err) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    const detail = (data && data.detail) ? data.detail : `Request failed (${res.status})`;
    if (res.status === 401 && auth) {
      Auth.clearSession();
      window.location.href = 'login.html';
    }
    throw new Error(typeof detail === 'string' ? detail : 'Something went wrong.');
  }
  return data;
}

/* ---------- Toasts ---------- */

function ensureToastContainer() {
  let el = document.querySelector('.toast-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, type = 'default') {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

/* ---------- Nav rendering ---------- */

function renderNav(activePage = '') {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  const user = Auth.getUser();
  const loggedIn = Auth.isLoggedIn();
  const dashboardHref = user && user.role === 'caregiver' ? 'caregiver-dashboard.html' : 'dashboard.html';

  mount.innerHTML = `
    <div class="nav">
      <a class="brand" href="index.html">
        <span class="brand-mark">M+</span>
        MediCompare
      </a>
      <ul class="nav-links" id="nav-links">
        <li><a href="index.html#how-it-works">How it works</a></li>
        <li><a href="search.html">Search medicines</a></li>
        ${loggedIn ? `<li><a href="${dashboardHref}">Dashboard</a></li>` : ''}
        ${loggedIn ? `<li><a href="history.html">History</a></li>` : ''}
      </ul>
      <div class="nav-actions">
        ${loggedIn
          ? `<span class="field-hint" style="margin-right:4px;">Hi, ${user.name.split(' ')[0]}</span>
             <button class="btn btn-outline btn-sm" id="logout-btn">Log out</button>`
          : `<a class="btn btn-ghost btn-sm" href="login.html">Log in</a>
             <a class="btn btn-primary btn-sm" href="register.html">Get started</a>`
        }
        <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false">☰</button>
      </div>
    </div>
  `;

  const toggleBtn = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('nav-links-open');
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.clearSession();
      window.location.href = 'index.html';
    });
  }
}

function renderFooter() {
  const mount = document.getElementById('site-footer');
  if (!mount) return;
  const year = new Date().getFullYear();
  mount.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="brand" href="index.html" style="margin-bottom:12px;">
            <span class="brand-mark">M+</span> MediCompare
          </a>
          <p style="max-width:320px;">Understand your prescription, compare verified same-composition options, and see potential savings — without changing your doctor's prescription.</p>
        </div>
        <div>
          <h4>Product</h4>
          <ul>
            <li><a href="scan.html">Scan prescription</a></li>
            <li><a href="search.html">Search medicines</a></li>
            <li><a href="index.html#how-it-works">How it works</a></li>
          </ul>
        </div>
        <div>
          <h4>Account</h4>
          <ul>
            <li><a href="login.html">Log in</a></li>
            <li><a href="register.html">Register</a></li>
            <li><a href="history.html">Savings history</a></li>
          </ul>
        </div>
        <div>
          <h4>Safety</h4>
          <ul>
            <li><a href="index.html#safety">Our disclaimer</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} MediCompare. Prototype for demonstration purposes.</span>
        <span>Not a substitute for professional medical advice.</span>
      </div>
    </div>
  `;
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return `₹${Number(value).toFixed(2).replace(/\.00$/, '')}`;
}

function confidenceBadgeClass(confidence) {
  if (confidence >= 0.85) return 'badge-high';
  if (confidence >= 0.7) return 'badge-medium';
  return 'badge-low';
}

function confidenceLabel(confidence) {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.85) return `${pct}% · High confidence`;
  if (confidence >= 0.7) return `${pct}% · Medium confidence`;
  return `${pct}% · Low confidence — please check`;
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  renderFooter();
});
