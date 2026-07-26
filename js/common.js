(() => {
  const API_URL = '/api';

  function getToken() {
    return localStorage.getItem('token') || '';
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  function saveSession(token, user) {
    if (token) localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async function request(path, options = {}) {
    const { auth = true, body, headers = {}, ...fetchOptions } = options;
    const requestHeaders = { ...headers };

    if (body !== undefined && !(body instanceof FormData)) {
      requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else if (body instanceof FormData) {
      fetchOptions.body = body;
    }

    if (auth && getToken()) {
      requestHeaders.Authorization = `Bearer ${getToken()}`;
    }

    let response;
    try {
      response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers: requestHeaders });
    } catch (error) {
      const networkError = new Error('Cannot connect to the server. Run npm start and try again.');
      networkError.cause = error;
      throw networkError;
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text();

    if (response.status === 401 && auth) {
      clearSession();
      if (!location.pathname.endsWith('/login.html')) {
        location.href = '/pages/login.html';
      }
    }

    if (!response.ok) {
      const error = new Error(data?.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Safely embeds a string as a JavaScript argument inside an HTML attribute.
  function inlineArg(value) {
    const literal = JSON.stringify(String(value ?? ''))
      .replaceAll('<', '\\u003c')
      .replaceAll('>', '\\u003e')
      .replaceAll('&', '\\u0026')
      .replaceAll("'", '\\u0027');
    return escapeHtml(literal);
  }

  function money(value) {
    const number = Number(value || 0);
    return `₹${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  function date(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-IN');
  }

  function statusLabel(value) {
    return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const categoryEmoji = {
    vegetables: '🥬', fruits: '🍎', grains: '🌾', dairy: '🥛', organic: '🌿', other: '📦'
  };

  function productVisual(product, className = 'product-visual') {
    const image = Array.isArray(product?.images) && product.images[0] ? product.images[0] : '';
    if (image) {
      return `<div class="${className}"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name || 'Crop photo')}" loading="lazy"></div>`;
    }
    return `<div class="${className} product-visual-emoji">${categoryEmoji[product?.category] || '📦'}</div>`;
  }

  async function imageFileToDataUrl(file, { maxSize = 900, quality = 0.82 } = {}) {
    if (!file) return '';
    if (!file.type.startsWith('image/')) throw new Error('Please select an image file');
    if (file.size > 8 * 1024 * 1024) throw new Error('Image must be smaller than 8 MB');

    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Unable to read image'));
      reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = source;
    });

    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function toast(message, type = 'info') {
    let container = document.getElementById('fcToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'fcToastContainer';
      container.className = 'fc-toast-container';
      document.body.appendChild(container);
    }

    const item = document.createElement('div');
    item.className = `fc-toast fc-toast-${type}`;
    item.textContent = message;
    container.appendChild(item);
    requestAnimationFrame(() => item.classList.add('show'));
    setTimeout(() => {
      item.classList.remove('show');
      setTimeout(() => item.remove(), 250);
    }, 3200);
  }

  function setButtonLoading(button, loading, loadingText = 'Please wait...') {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }

  window.FC = {
    API_URL,
    request,
    getToken,
    getUser,
    saveSession,
    clearSession,
    escapeHtml,
    inlineArg,
    money,
    date,
    statusLabel,
    categoryEmoji,
    productVisual,
    imageFileToDataUrl,
    toast,
    setButtonLoading
  };
})();
