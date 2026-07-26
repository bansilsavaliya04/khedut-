let selectedRole = 'buyer';
let adminSetupStatus = { adminExists: false, setupEnabled: false };

function selectRole(role, element) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(button => button.classList.remove('active'));
  element?.classList.add('active');

  const setupGroup = document.getElementById('adminSetupGroup');
  const setupHelp = document.getElementById('adminSetupHelp');
  if (setupGroup) setupGroup.hidden = role !== 'admin';

  if (role === 'admin' && setupHelp) {
    if (adminSetupStatus.adminExists) {
      setupHelp.textContent = 'The first admin already exists. Login as an admin and create another admin from Manage Users.';
      setupHelp.className = 'field-help warning';
    } else if (!adminSetupStatus.setupEnabled) {
      setupHelp.textContent = 'Add ADMIN_SETUP_KEY in backend/.env, restart the server, then enter that key here.';
      setupHelp.className = 'field-help warning';
    } else {
      setupHelp.textContent = 'Enter the one-time ADMIN_SETUP_KEY from backend/.env. This only creates the first admin.';
      setupHelp.className = 'field-help';
    }
  }
}

function showError(message) {
  const error = document.getElementById('errorMsg');
  const success = document.getElementById('successMsg');
  if (error) {
    error.textContent = message;
    error.style.display = 'block';
  }
  if (success) success.style.display = 'none';
}

function showSuccess(message) {
  const error = document.getElementById('errorMsg');
  const success = document.getElementById('successMsg');
  if (success) {
    success.textContent = message;
    success.style.display = 'block';
  }
  if (error) error.style.display = 'none';
}

function redirectForRole(role) {
  const page = role === 'farmer'
    ? 'farmer-dashboard.html'
    : role === 'admin'
      ? 'admin-dashboard.html'
      : 'buyer-dashboard.html';
  window.location.href = page;
}

async function handleLogin(event) {
  event?.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const button = document.querySelector('.btn-auth');

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  FC.setButtonLoading(button, true, 'Logging in...');
  try {
    const data = await FC.request('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password }
    });
    FC.saveSession(data.token, data.user);
    showSuccess('Login successful! Redirecting...');
    setTimeout(() => redirectForRole(data.user.role), 450);
  } catch (error) {
    showError(error.message);
  } finally {
    FC.setButtonLoading(button, false);
  }
}

async function handleRegister(event) {
  event?.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const location = document.getElementById('location').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const setupKey = document.getElementById('adminSetupKey')?.value || '';
  const button = document.querySelector('.btn-auth');

  if (!name || !email || !password || !confirmPassword) {
    showError('Please complete all required fields.');
    return;
  }
  if (password !== confirmPassword) {
    showError('Passwords do not match.');
    return;
  }
  if (password.length < 6) {
    showError('Password must contain at least 6 characters.');
    return;
  }
  if (selectedRole === 'admin') {
    if (adminSetupStatus.adminExists) {
      showError('An admin already exists. Additional admins must be created from the admin dashboard.');
      return;
    }
    if (!setupKey) {
      showError('Enter the admin setup key from backend/.env.');
      return;
    }
  }

  FC.setButtonLoading(button, true, 'Creating account...');
  try {
    const endpoint = selectedRole === 'admin' ? '/auth/admin/setup' : '/auth/register';
    const data = await FC.request(endpoint, {
      method: 'POST',
      auth: false,
      body: {
        name,
        email,
        phone,
        location,
        password,
        role: selectedRole,
        setupKey
      }
    });

    FC.saveSession(data.token, data.user);
    showSuccess(data.message || 'Account created successfully!');
    setTimeout(() => redirectForRole(data.user.role), 450);
  } catch (error) {
    showError(error.message);
    if (selectedRole === 'admin') await loadAdminSetupStatus();
  } finally {
    FC.setButtonLoading(button, false);
  }
}

async function loadAdminSetupStatus() {
  const adminButton = document.querySelector('[data-role="admin"]');
  try {
    adminSetupStatus = await FC.request('/auth/admin/setup-status', { auth: false });
    if (adminButton) {
      adminButton.classList.toggle('role-disabled', adminSetupStatus.adminExists || !adminSetupStatus.setupEnabled);
      adminButton.title = adminSetupStatus.adminExists
        ? 'Additional admins are created from the admin dashboard'
        : adminSetupStatus.setupEnabled
          ? 'Create the first administrator'
          : 'ADMIN_SETUP_KEY is not configured';
    }
  } catch {
    adminSetupStatus = { adminExists: false, setupEnabled: false };
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = FC.getUser();
  if (FC.getToken() && user.role) {
    redirectForRole(user.role);
    return;
  }

  if (document.getElementById('registerForm')) {
    await loadAdminSetupStatus();
    const requestedRole = new URLSearchParams(window.location.search).get('role');
    if (['buyer', 'farmer', 'admin'].includes(requestedRole)) {
      const button = document.querySelector(`[data-role="${requestedRole}"]`);
      selectRole(requestedRole, button);
    }
  }
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
});
