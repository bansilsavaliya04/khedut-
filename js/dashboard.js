const dashboardUser = FC.getUser();
const dashboardToken = FC.getToken();
const expectedRole = document.body.dataset.role;

if (!dashboardToken || !dashboardUser.role) {
  window.location.href = 'login.html';
} else if (expectedRole && dashboardUser.role !== expectedRole) {
  const correctPage = dashboardUser.role === 'admin'
    ? 'admin-dashboard.html'
    : dashboardUser.role === 'farmer'
      ? 'farmer-dashboard.html'
      : 'buyer-dashboard.html';
  window.location.href = correctPage;
}

function updateProfileUI(user) {
  const initial = (user.name || 'U')[0].toUpperCase();
  const values = {
    userName: user.name || 'User',
    userAvatar: initial,
    profileName: user.name || 'User',
    profileEmail: user.email || '',
    profileAvatar: initial,
    profileLocation: user.location ? `📍 ${user.location}` : '📍 Location not added',
    profilePhone: user.phone ? `📱 ${user.phone}` : '📱 Phone not added'
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  const nameInput = document.getElementById('profileNameInput');
  const phoneInput = document.getElementById('profilePhoneInput');
  const locationInput = document.getElementById('profileLocationInput');
  const languageInput = document.getElementById('profileLanguageInput');
  if (nameInput) nameInput.value = user.name || '';
  if (phoneInput) phoneInput.value = user.phone || '';
  if (locationInput) locationInput.value = user.location || '';
  if (languageInput) languageInput.value = user.language || 'gu';
}

async function loadCurrentProfile() {
  try {
    const user = await FC.request('/auth/me');
    FC.saveSession(null, user);
    updateProfileUI(user);
  } catch (error) {
    console.error(error);
  }
}

async function saveProfile(event) {
  event?.preventDefault();
  const button = document.getElementById('saveProfileBtn');
  FC.setButtonLoading(button, true, 'Saving...');
  try {
    const data = await FC.request('/auth/me', {
      method: 'PATCH',
      body: {
        name: document.getElementById('profileNameInput').value.trim(),
        phone: document.getElementById('profilePhoneInput').value.trim(),
        location: document.getElementById('profileLocationInput').value.trim(),
        language: document.getElementById('profileLanguageInput').value
      }
    });
    FC.saveSession(null, data.user);
    updateProfileUI(data.user);
    FC.toast(data.message, 'success');
  } catch (error) {
    FC.toast(error.message, 'error');
  } finally {
    FC.setButtonLoading(button, false);
  }
}

async function changePassword(event) {
  event?.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmNewPassword = document.getElementById('confirmNewPassword').value;
  if (newPassword !== confirmNewPassword) {
    FC.toast('New passwords do not match', 'error');
    return;
  }

  const button = document.getElementById('changePasswordBtn');
  FC.setButtonLoading(button, true, 'Changing...');
  try {
    const data = await FC.request('/auth/me/password', {
      method: 'PATCH',
      body: { currentPassword, newPassword }
    });
    document.getElementById('passwordForm').reset();
    FC.toast(data.message, 'success');
  } catch (error) {
    FC.toast(error.message, 'error');
  } finally {
    FC.setButtonLoading(button, false);
  }
}

function showSection(id) {
  const target = document.getElementById(`sec-${id}`);
  if (!target) return;

  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('onclick')?.includes(`'${id}'`)) item.classList.add('active');
  });

  const titles = {
    overview: 'Overview', marketplace: 'Marketplace', products: 'My Products', orders: 'Orders',
    wishlist: 'Wishlist', chat: 'Messages', analytics: 'Analytics', profile: 'Profile',
    users: 'Manage Users', bookings: 'Equipment Bookings', settings: 'Settings'
  };
  const title = document.getElementById('pageTitle');
  if (title) title.textContent = titles[id] || FC.statusLabel(id);

  if (window.innerWidth <= 768) document.getElementById('sidebar')?.classList.remove('open');
  history.replaceState(null, '', `#${id}`);
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

function openAddProduct() {
  document.getElementById('addProductModal')?.classList.add('open');
}

function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('open'));
}

function logout() {
  FC.clearSession();
  window.location.href = 'login.html';
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const button = document.getElementById('themeToggle');
  if (button) button.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
}

document.addEventListener('click', event => {
  const sidebar = document.getElementById('sidebar');
  const menuButton = document.querySelector('.menu-btn');
  if (window.innerWidth <= 768 && sidebar?.classList.contains('open') &&
      !sidebar.contains(event.target) && !menuButton?.contains(event.target)) {
    sidebar.classList.remove('open');
  }

  if (event.target.classList.contains('modal-overlay')) closeModal();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    const button = document.getElementById('themeToggle');
    if (button) button.textContent = '☀️ Light Mode';
  }

  updateProfileUI(dashboardUser);
  loadCurrentProfile();
  document.getElementById('profileForm')?.addEventListener('submit', saveProfile);
  document.getElementById('passwordForm')?.addEventListener('submit', changePassword);

  const initialSection = location.hash.slice(1);
  if (initialSection && document.getElementById(`sec-${initialSection}`)) showSection(initialSection);
});
