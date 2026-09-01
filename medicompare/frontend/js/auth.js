/* =========================================================
   MediCompare — auth.js
   Handles the login and register forms.
   ========================================================= */

function showFormError(message) {
  const el = document.getElementById('form-error');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
}

function clearFormError() {
  const el = document.getElementById('form-error');
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
}

function redirectAfterAuth(user) {
  window.location.href = user.role === 'caregiver' ? 'caregiver-dashboard.html' : 'dashboard.html';
}

/* ---------- Login ---------- */

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormError();
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      Auth.setSession(data.access_token, data.user);
      showToast('Welcome back!', 'success');
      redirectAfterAuth(data.user);
    } catch (err) {
      showFormError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });
}

/* ---------- Register ---------- */

const registerForm = document.getElementById('register-form');
if (registerForm) {
  const patientRadio = document.getElementById('role-patient');
  const caregiverRadio = document.getElementById('role-caregiver');
  const patientLabel = document.getElementById('label-patient');
  const caregiverLabel = document.getElementById('label-caregiver');

  function syncRoleLabels() {
    patientLabel.classList.toggle('active', patientRadio.checked);
    caregiverLabel.classList.toggle('active', caregiverRadio.checked);
  }
  patientRadio.addEventListener('change', syncRoleLabels);
  caregiverRadio.addEventListener('change', syncRoleLabels);

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormError();
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    try {
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const role = document.querySelector('input[name="role"]:checked').value;

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: { name, email, password, role },
        auth: false,
      });
      Auth.setSession(data.access_token, data.user);
      showToast('Account created!', 'success');
      redirectAfterAuth(data.user);
    } catch (err) {
      showFormError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });
}
