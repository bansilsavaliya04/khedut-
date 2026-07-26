let allProducts = [];
let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
let selectedProduct = {};
let directOrders = [];
let standardOrderCount = 0;
let bulkOrderCount = 0;
let bookingRates = {};

const e = FC.escapeHtml;

function productCard(product, { wishlistMode = false } = {}) {
  return `
    <article class="product-card" onclick="openProduct('${product._id}')">
      ${FC.productVisual(product)}
      <div class="product-name">${e(product.name)}</div>
      <div class="product-category">${e(FC.statusLabel(product.category))} • ${e(product.location)}</div>
      <div class="product-price">${FC.money(product.price)}/${e(product.unit)}</div>
      <div class="product-qty">Available: ${Number(product.quantity)} ${e(product.unit)}</div>
      <div class="product-meta">⭐ ${Number(product.rating || 0).toFixed(1)} • ${e(FC.statusLabel(product.qualityGrade || 'standard'))}</div>
      <div class="product-farmer">👨‍🌾 ${e(product.farmer?.name || 'Farmer')}</div>
      <div class="product-actions">
        ${wishlistMode
          ? `<button class="btn-delete" onclick="event.stopPropagation();removeFromWishlist('${product._id}')">Remove</button>`
          : `<button class="btn-edit" onclick="event.stopPropagation();openProduct('${product._id}')">View</button>
             <button class="btn-secondary compact-btn" onclick="event.stopPropagation();addToWishlistById('${product._id}')">❤️ Save</button>
             <button class="btn-primary compact-btn" onclick="event.stopPropagation();openChat(${FC.inlineArg(product.farmer?._id || '')},${FC.inlineArg(product.farmer?.name || 'Farmer')})">💬 Chat</button>`}
      </div>
    </article>`;
}

async function loadAllProducts() {
  const marketplace = document.getElementById('marketplaceProducts');
  try {
    allProducts = await FC.request('/products', { auth: false });
    renderMarketplace(allProducts);
    renderFeaturedProducts(allProducts);
    document.getElementById('totalProducts').textContent = allProducts.length;
    populateBulkProductSuggestions();
    wishlist = wishlist.map(saved => allProducts.find(p => p._id === saved._id) || saved);
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
  } catch (error) {
    if (marketplace) marketplace.innerHTML = `<div class="bulk-error">${e(error.message)}</div>`;
  }
}

function renderMarketplace(products) {
  const grid = document.getElementById('marketplaceProducts');
  if (!products.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🌾</div><p>No matching products available.</p></div>';
    return;
  }
  grid.innerHTML = products.map(product => productCard(product)).join('');
}

function renderFeaturedProducts(products) {
  const grid = document.getElementById('featuredProducts');
  grid.innerHTML = products.length
    ? products.slice(0, 4).map(product => productCard(product)).join('')
    : '<div class="empty-state"><p>No products available yet.</p></div>';
}

function filterProducts() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const quality = document.getElementById('qualityFilter').value;
  const sort = document.getElementById('sortFilter').value;

  const filtered = allProducts.filter(product => {
    const haystack = `${product.name} ${product.description} ${product.location} ${product.farmer?.name || ''}`.toLowerCase();
    return (!search || haystack.includes(search)) &&
      (!category || product.category === category) &&
      (!quality || product.qualityGrade === quality);
  });

  filtered.sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price;
    if (sort === 'price_desc') return b.price - a.price;
    if (sort === 'quantity_desc') return b.quantity - a.quantity;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  renderMarketplace(filtered);
}

function openProduct(id) {
  const product = allProducts.find(item => item._id === id);
  if (!product) return;
  selectedProduct = product;
  document.getElementById('modalProductName').textContent = product.name;
  document.getElementById('modalProductVisual').innerHTML = FC.productVisual(product, 'product-detail-visual');
  document.getElementById('modalProductPrice').textContent = `${FC.money(product.price)}/${product.unit}`;
  document.getElementById('modalProductDesc').textContent = product.description;
  document.getElementById('modalLocation').textContent = product.location;
  document.getElementById('modalQuantity').textContent = `${product.quantity} ${product.unit} available`;
  document.getElementById('modalFarmer').textContent = product.farmer?.name || 'Farmer';
  document.getElementById('modalQuality').textContent = `${FC.statusLabel(product.qualityGrade || 'standard')} • ${FC.statusLabel(product.farmingMethod || 'conventional')}`;
  document.getElementById('productModal').classList.add('open');
}

function openDirectOrderModal() {
  if (!selectedProduct._id) return;
  closeModal();
  document.getElementById('directOrderSummary').textContent = `${selectedProduct.name} — ${FC.money(selectedProduct.price)}/${selectedProduct.unit}; ${selectedProduct.quantity} available`;
  document.getElementById('directOrderQuantity').value = 1;
  document.getElementById('directOrderQuantity').max = selectedProduct.quantity;
  document.getElementById('directOrderMessage').value = '';
  updateDirectOrderTotal();
  document.getElementById('directOrderModal').classList.add('open');
}

function openOrderModal(id) {
  const product = allProducts.find(item => item._id === id);
  if (product) selectedProduct = product;
  openDirectOrderModal();
}

function updateDirectOrderTotal() {
  const quantity = Number(document.getElementById('directOrderQuantity')?.value || 0);
  document.getElementById('directOrderTotal').textContent = `Estimated total: ${FC.money(quantity * Number(selectedProduct.price || 0))}`;
}

async function createOrder(quantityFromLegacy) {
  const quantity = Number(quantityFromLegacy || document.getElementById('directOrderQuantity').value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > selectedProduct.quantity) {
    FC.toast('Enter a valid quantity within available stock', 'error');
    return;
  }
  const button = document.getElementById('directOrderSubmitBtn');
  FC.setButtonLoading(button, true, 'Placing...');
  try {
    const data = await FC.request('/orders', {
      method: 'POST',
      body: {
        productId: selectedProduct._id,
        quantity,
        message: document.getElementById('directOrderMessage')?.value.trim() || ''
      }
    });
    FC.toast(data.message, 'success');
    closeModal();
    await Promise.all([loadBuyerOrders(), loadAllProducts()]);
    showSection('orders');
  } catch (error) {
    FC.toast(error.message, 'error');
  } finally {
    FC.setButtonLoading(button, false);
  }
}

function addToWishlistById(id) {
  const product = allProducts.find(item => item._id === id);
  if (product) selectedProduct = product;
  addToWishlist();
}

function addToWishlist() {
  if (!selectedProduct._id) return;
  if (wishlist.some(item => item._id === selectedProduct._id)) {
    FC.toast('Already in wishlist');
    return;
  }
  wishlist.push(selectedProduct);
  localStorage.setItem('wishlist', JSON.stringify(wishlist));
  updateWishlistCount();
  renderWishlist();
  FC.toast('Added to wishlist', 'success');
}

function updateWishlistCount() {
  const count = document.getElementById('totalWishlist');
  if (count) count.textContent = wishlist.length;
}

function renderWishlist() {
  const grid = document.getElementById('wishlistGrid');
  grid.innerHTML = wishlist.length
    ? wishlist.map(product => productCard(product, { wishlistMode: true })).join('')
    : '<div class="empty-state"><div class="empty-icon">❤️</div><p>No saved products.</p><button class="btn-primary" onclick="showSection(\'marketplace\')">Browse Products</button></div>';
}

function removeFromWishlist(id) {
  wishlist = wishlist.filter(item => item._id !== id);
  localStorage.setItem('wishlist', JSON.stringify(wishlist));
  updateWishlistCount();
  renderWishlist();
}

async function loadBuyerOrders() {
  try {
    directOrders = await FC.request('/orders/buyer');
    standardOrderCount = directOrders.length;
    updateCombinedOrderCount();
    renderBuyerOrders(directOrders);
  } catch (error) {
    document.getElementById('ordersList').innerHTML = `<div class="bulk-error">${e(error.message)}</div>`;
  }
}

function renderBuyerOrders(orders) {
  const container = document.getElementById('ordersList');
  if (!orders.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No direct orders yet.</p></div>';
    return;
  }
  container.innerHTML = orders.map(order => `
    <article class="order-box">
      <div class="bulk-card-top"><div><h3>${e(order.productName)}</h3><p>Farmer: <strong>${e(order.farmerName)}</strong></p></div><span class="bulk-status status-${e(order.status)}">${e(FC.statusLabel(order.status))}</span></div>
      <div class="fulfillment-metrics"><span>${order.quantity} ${e(order.unit || '')}</span><span>${FC.money(order.pricePerUnit)} / ${e(order.unit || 'unit')}</span><span>Total ${FC.money(order.totalAmount)}</span><span>${FC.date(order.createdAt)}</span></div>
      <div class="order-actions">
        <button class="btn-secondary" onclick="openChat(${FC.inlineArg(order.farmerId)},${FC.inlineArg(order.farmerName)})">💬 Chat</button>
        ${order.status === 'pending' ? `<button class="reject-btn" onclick="cancelOrder('${order._id}')">Cancel</button>` : ''}
        ${order.status === 'delivered' ? `<button class="btn-primary" onclick="openReview('${order.productId}')">⭐ Review</button>` : ''}
      </div>
    </article>`).join('');
}

async function cancelOrder(orderId) {
  if (!confirm('Cancel this pending order?')) return;
  try {
    const data = await FC.request(`/orders/${orderId}/cancel`, { method: 'PATCH' });
    FC.toast(data.message, 'success');
    await Promise.all([loadBuyerOrders(), loadAllProducts()]);
  } catch (error) {
    FC.toast(error.message, 'error');
  }
}

function openReview(productId) {
  document.getElementById('reviewProductId').value = productId;
  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewModal').classList.add('open');
}

async function submitReview() {
  try {
    const data = await FC.request(`/products/${document.getElementById('reviewProductId').value}/reviews`, {
      method: 'POST',
      body: { rating: Number(document.getElementById('reviewRating').value), comment: document.getElementById('reviewComment').value.trim() }
    });
    FC.toast(data.message, 'success');
    closeModal();
    loadAllProducts();
  } catch (error) {
    FC.toast(error.message, 'error');
  }
}

function updateCombinedOrderCount() {
  const element = document.getElementById('totalOrders');
  if (element) element.textContent = standardOrderCount + bulkOrderCount;
}

function populateBulkProductSuggestions() {
  const list = document.getElementById('bulkProductSuggestions');
  const seen = new Set();
  list.innerHTML = allProducts.filter(product => {
    const key = `${product.name.toLowerCase()}|${product.category}|${product.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(product => `<option value="${e(product.name)}">${e(product.category)} • ${e(product.unit)}</option>`).join('');
}

function syncBulkProductDefaults() {
  const name = document.getElementById('bulkProductName').value.trim().toLowerCase();
  const product = allProducts.find(item => item.name.toLowerCase() === name);
  if (!product) return;
  document.getElementById('bulkCategory').value = product.category;
  document.getElementById('bulkUnit').value = product.unit;
  document.getElementById('bulkQuality').value = product.qualityGrade || 'standard';
}

function openBulkOrderModal() {
  const user = FC.getUser();
  if (!document.getElementById('bulkDeliveryLocation').value) document.getElementById('bulkDeliveryLocation').value = user.location || '';
  const date = document.getElementById('bulkRequiredBy');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  date.min = tomorrow.toISOString().slice(0, 10);
  document.getElementById('bulkPreviewResult').innerHTML = '';
  document.getElementById('bulkOrderModal').classList.add('open');
}

function getBulkOrderPayload() {
  return {
    productName: document.getElementById('bulkProductName').value.trim(),
    category: document.getElementById('bulkCategory').value,
    unit: document.getElementById('bulkUnit').value,
    quantity: Number(document.getElementById('bulkQuantity').value),
    maxPricePerUnit: Number(document.getElementById('bulkMaxPrice').value) || undefined,
    deliveryLocation: document.getElementById('bulkDeliveryLocation').value.trim(),
    requiredBy: document.getElementById('bulkRequiredBy').value || undefined,
    qualityGrade: document.getElementById('bulkQuality').value,
    message: document.getElementById('bulkMessage').value.trim()
  };
}

function validateBulkPayload(payload) {
  if (!payload.productName || !payload.deliveryLocation || !Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    FC.toast('Enter product, quantity and delivery location', 'error');
    return false;
  }
  return true;
}

async function previewBulkOrder() {
  const payload = getBulkOrderPayload();
  if (!validateBulkPayload(payload)) return;
  const result = document.getElementById('bulkPreviewResult');
  result.innerHTML = '<div class="bulk-loading">Calculating farmer split...</div>';
  try {
    const data = await FC.request('/bulk-orders/preview', { method: 'POST', body: payload });
    result.innerHTML = `
      <div class="preview-summary ${data.canFullyFulfill ? 'success' : 'warning'}"><strong>${data.canFullyFulfill ? '✅ Full quantity available' : '⚠️ Partial availability'}</strong><span>${data.availableQuantity}/${data.requestedQuantity} ${e(payload.unit)} from ${data.farmerCount} farmer(s)</span></div>
      ${data.proposedAllocations.map(a => `<div class="preview-allocation-row"><span>👨‍🌾 ${e(a.farmerName)} (${e(a.farmerLocation || '')})</span><strong>${a.quantity} ${e(payload.unit)} × ${FC.money(a.pricePerUnit)}</strong></div>`).join('') || '<p>No matching stock.</p>'}
      ${data.remainingQuantity > 0 ? `<p class="remaining-warning">Remaining unfilled: ${data.remainingQuantity} ${e(payload.unit)}</p>` : ''}`;
  } catch (error) {
    result.innerHTML = `<div class="bulk-error">${e(error.message)}</div>`;
  }
}

async function createBulkOrder() {
  const payload = getBulkOrderPayload();
  if (!validateBulkPayload(payload)) return;
  const button = document.getElementById('bulkCreateBtn');
  FC.setButtonLoading(button, true, 'Placing...');
  try {
    const data = await FC.request('/bulk-orders', { method: 'POST', body: payload });
    FC.toast(data.message, 'success');
    closeModal();
    clearBulkOrderForm();
    await Promise.all([loadBuyerBulkOrders(), loadAllProducts()]);
    showSection('orders');
  } catch (error) {
    FC.toast(error.message, 'error');
  } finally {
    FC.setButtonLoading(button, false);
  }
}

function clearBulkOrderForm() {
  ['bulkProductName','bulkQuantity','bulkMaxPrice','bulkRequiredBy','bulkMessage'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('bulkPreviewResult').innerHTML = '';
}

async function loadBuyerBulkOrders() {
  try {
    const orders = await FC.request('/bulk-orders/buyer');
    bulkOrderCount = orders.length;
    updateCombinedOrderCount();
    renderBuyerBulkOrders(orders);
  } catch (error) {
    document.getElementById('bulkOrdersList').innerHTML = `<div class="bulk-error">${e(error.message)}</div>`;
  }
}

function renderBuyerBulkOrders(orders) {
  const container = document.getElementById('bulkOrdersList');
  if (!orders.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🤝</div><p>No multi-farmer orders yet.</p></div>';
    return;
  }
  container.innerHTML = orders.map(order => {
    const allocated = Number(order.allocatedQuantity || 0), accepted = Number(order.acceptedQuantity || 0), delivered = Number(order.deliveredQuantity || 0), requested = Number(order.requestedQuantity || 0);
    const progress = requested ? Math.min(100, Math.round(allocated / requested * 100)) : 0;
    const canCancel = !order.allocations.some(a => ['accepted','delivered'].includes(a.status)) && order.status !== 'cancelled';
    const canReallocate = allocated < requested && !['cancelled','delivered'].includes(order.status);
    return `<article class="order-box bulk-order-card"><div class="bulk-card-top"><div><span class="order-code">${e(order.orderCode)}</span><h3>${e(order.productName)}</h3><p>${requested} ${e(order.unit)} • ${e(order.deliveryLocation)}</p></div><span class="bulk-status status-${e(order.status)}">${e(FC.statusLabel(order.status))}</span></div>
      <div class="fulfillment-metrics"><span><strong>${allocated}</strong> allocated</span><span><strong>${accepted}</strong> confirmed</span><span><strong>${delivered}</strong> delivered</span><span><strong>${order.allocations.length}</strong> allocations</span></div><div class="fulfillment-progress"><span style="width:${progress}%"></span></div>
      <div class="allocation-list">${order.allocations.map(a => `<div class="allocation-chip status-${e(a.status)}"><div><strong>👨‍🌾 ${e(a.farmerName)}</strong><span>${a.quantity} ${e(order.unit)} at ${FC.money(a.pricePerUnit)}</span></div><span class="allocation-status">${e(FC.statusLabel(a.status))}</span></div>`).join('')}</div>
      <div class="bulk-order-footer"><strong>Estimated: ${FC.money(order.totalAmount)}</strong><div class="order-actions">${canReallocate ? `<button class="btn-secondary" onclick="reallocateBulkOrder('${order._id}')">Find More Farmers</button>` : ''}${canCancel ? `<button class="reject-btn" onclick="cancelBulkOrder('${order._id}')">Cancel</button>` : ''}</div></div></article>`;
  }).join('');
}

async function reallocateBulkOrder(id) {
  try { const data = await FC.request(`/bulk-orders/${id}/reallocate`, { method: 'POST' }); FC.toast(data.message, 'success'); await Promise.all([loadBuyerBulkOrders(), loadAllProducts()]); }
  catch (error) { FC.toast(error.message, 'error'); }
}
async function cancelBulkOrder(id) {
  if (!confirm('Cancel and release all pending reserved stock?')) return;
  try { const data = await FC.request(`/bulk-orders/${id}/cancel`, { method: 'PATCH' }); FC.toast(data.message, 'success'); await Promise.all([loadBuyerBulkOrders(), loadAllProducts()]); }
  catch (error) { FC.toast(error.message, 'error'); }
}

async function loadBookingRates() {
  try { bookingRates = await FC.request('/bookings/rates', { auth: false }); updateBookingEstimate(); } catch (error) { console.error(error); }
}
function updateBookingEstimate() {
  const service = document.getElementById('bookingService')?.value || 'tractor';
  const hours = Number(document.getElementById('bookingHours')?.value || 0);
  const rate = Number(bookingRates[service] || 0);
  const estimate = document.getElementById('bookingEstimate');
  if (estimate) estimate.textContent = `Rate ${FC.money(rate)}/hour • Estimated total: ${FC.money(rate * hours)}`;
}
async function createBooking(event) {
  event.preventDefault();
  const button = document.getElementById('bookingSubmitBtn'); FC.setButtonLoading(button, true, 'Booking...');
  try {
    const data = await FC.request('/bookings', { method: 'POST', body: {
      serviceType: document.getElementById('bookingService').value, date: document.getElementById('bookingDate').value,
      time: document.getElementById('bookingTime').value, hours: Number(document.getElementById('bookingHours').value),
      area: document.getElementById('bookingArea').value, location: document.getElementById('bookingLocation').value.trim(), note: document.getElementById('bookingNote').value.trim()
    }});
    FC.toast(data.message, 'success'); document.getElementById('bookingForm').reset(); document.getElementById('bookingHours').value = 2; updateBookingEstimate(); loadBookings();
  } catch (error) { FC.toast(error.message, 'error'); } finally { FC.setButtonLoading(button, false); }
}
async function loadBookings() {
  try { const bookings = await FC.request('/bookings/mine'); document.getElementById('totalBookings').textContent = bookings.length; renderBookings(bookings); }
  catch (error) { document.getElementById('bookingsList').innerHTML = `<div class="bulk-error">${e(error.message)}</div>`; }
}
function renderBookings(bookings) {
  const container = document.getElementById('bookingsList');
  container.innerHTML = bookings.length ? bookings.map(b => `<article class="order-box"><div class="bulk-card-top"><div><h3>🚜 ${e(b.serviceName)}</h3><p>${e(b.date)} at ${e(b.time)} • ${b.hours} hour(s)</p></div><span class="bulk-status status-${e(b.status)}">${e(FC.statusLabel(b.status))}</span></div><p>📍 ${e(b.location)}</p><p>Estimated: <strong>${FC.money(b.totalCost)}</strong></p>${['pending','confirmed'].includes(b.status) ? `<button class="reject-btn" onclick="cancelBooking('${b._id}')">Cancel Booking</button>` : ''}</article>`).join('') : '<div class="empty-state"><p>No equipment bookings.</p></div>';
}
async function cancelBooking(id) { if (!confirm('Cancel this booking?')) return; try { const data = await FC.request(`/bookings/${id}/cancel`, { method: 'PATCH' }); FC.toast(data.message, 'success'); loadBookings(); } catch (error) { FC.toast(error.message, 'error'); } }

async function loadChatContacts() {
  try {
    const contacts = await FC.request('/chat/contacts');
    const select = document.getElementById('chatContactSelect');
    select.innerHTML = '<option value="">Select a farmer</option>' + contacts.map(c => `<option value="${c.id}">${e(c.name)} — ${e(c.location || c.role)}</option>`).join('');
  } catch (error) { console.error(error); }
}
function selectChatContact(id) {
  document.getElementById('chatUserId').value = id;
  const option = document.getElementById('chatContactSelect').selectedOptions[0];
  document.getElementById('chatTitle').textContent = id ? `💬 Chat with ${option.textContent.split(' — ')[0]}` : '💬 Chat';
  loadMessages();
}
function openChat(farmerId, farmerName = 'Farmer') {
  if (!farmerId) { FC.toast('Farmer contact unavailable', 'error'); return; }
  showSection('chat');
  document.getElementById('chatUserId').value = farmerId;
  document.getElementById('chatTitle').textContent = `💬 Chat with ${farmerName || 'Farmer'}`;
  const select = document.getElementById('chatContactSelect');
  if (![...select.options].some(option => option.value === farmerId)) select.add(new Option(farmerName || 'Farmer', farmerId));
  select.value = farmerId;
  loadMessages();
}
async function sendMessage() {
  const receiverId = document.getElementById('chatUserId').value, message = document.getElementById('chatInput').value.trim();
  if (!receiverId || !message) { FC.toast('Select a farmer and enter a message', 'error'); return; }
  try { await FC.request('/chat/send', { method: 'POST', body: { receiverId, message, originalLanguage: FC.getUser().language || localStorage.getItem('farmconnect-language') || 'en' } }); document.getElementById('chatInput').value = ''; loadMessages(); }
  catch (error) { FC.toast(error.message, 'error'); }
}
async function loadMessages() {
  const otherId = document.getElementById('chatUserId').value, container = document.getElementById('chatMessages');
  if (!otherId) { container.innerHTML = '<div class="empty-state"><p>Select a farmer to start chatting.</p></div>'; return; }
  try {
    const messages = await FC.request(`/chat/${otherId}`), myId = String(FC.getUser().id);
    container.innerHTML = messages.length ? messages.map(m => `<div class="chat-bubble ${String(m.senderId) === myId ? 'sent' : 'received'}"><p>${e(m.originalMessage)}</p><small>${new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>`).join('') : '<div class="empty-state"><p>No messages yet.</p></div>';
    container.scrollTop = container.scrollHeight;
  } catch (error) { container.innerHTML = `<div class="bulk-error">${e(error.message)}</div>`; }
}

const baseShowSection = window.showSection;
window.showSection = function buyerShowSection(id) {
  baseShowSection(id);
  if (id === 'wishlist') renderWishlist();
  if (id === 'chat') loadChatContacts();
  if (id === 'bookings') loadBookings();
};

document.addEventListener('DOMContentLoaded', () => {
  loadAllProducts(); updateWishlistCount(); renderWishlist(); loadBuyerOrders(); loadBuyerBulkOrders(); loadBookingRates(); loadBookings(); loadChatContacts();
  document.getElementById('bookingForm').addEventListener('submit', createBooking);
  document.getElementById('chatInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); sendMessage(); } });
  const date = document.getElementById('bookingDate'); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); date.min = tomorrow.toISOString().slice(0,10);
  const user = FC.getUser(); document.getElementById('bookingLocation').value = user.location || '';
});
