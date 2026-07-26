function toggleNav() {
  document.getElementById('navLinks')?.classList.toggle('open');
}

document.addEventListener('click', event => {
  const navLinks = document.getElementById('navLinks');
  const hamburger = document.querySelector('.hamburger');
  if (navLinks && !navLinks.contains(event.target) && !hamburger?.contains(event.target)) {
    navLinks.classList.remove('open');
  }
});

async function loadFeaturedProducts() {
  const grid = document.getElementById('homeProducts');
  if (!grid) return;
  try {
    const products = await FC.request('/products', { auth: false });
    if (!products.length) {
      grid.innerHTML = `<div class="loading-state">No products yet! <a href="pages/register.html" style="color:var(--green-dark);font-weight:700">Be the first farmer to list →</a></div>`;
      return;
    }
    grid.innerHTML = products.slice(0, 8).map(product => `<article class="product-card" tabindex="0" role="link" onclick="window.location.href='pages/register.html'" onkeydown="if(event.key==='Enter')window.location.href='pages/register.html'">
      ${FC.productVisual(product)}
      <div class="product-card-body">
        <div class="product-name">${FC.escapeHtml(product.name)}</div>
        <div class="product-category">${FC.escapeHtml(FC.statusLabel(product.category))} • ${FC.escapeHtml(product.location)}</div>
        <div class="product-price">${FC.money(product.price)}/${FC.escapeHtml(product.unit)}</div>
        <div class="product-farmer">👨‍🌾 ${FC.escapeHtml(product.farmer?.name || 'Farmer')} • ⭐ ${Number(product.rating || 0).toFixed(1)}</div>
      </div>
    </article>`).join('');
  } catch (error) {
    grid.innerHTML = `<div class="loading-state">${FC.escapeHtml(error.message)}</div>`;
  }
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (event) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

const homeUser = FC.getUser();
if (FC.getToken() && homeUser.role) {
  const navButtons = document.querySelector('.nav-btns');
  if (navButtons) navButtons.innerHTML = `<a href="pages/${FC.escapeHtml(homeUser.role)}-dashboard.html" class="btn-solid-nav">My Dashboard →</a>`;
}

loadFeaturedProducts();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.error));
}
