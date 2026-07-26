const adminState = {
  users: [], products: [], directOrders: [], bulkOrders: [], bookings: [],
  directStats: {}, bulkStats: {}
};

const currentAdmin = FC.getUser();

function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${FC.escapeHtml(text)}</p></div>`;
}

function roleIcon(role) {
  return role === 'admin' ? '👑' : role === 'farmer' ? '👨‍🌾' : '🛒';
}

function statusClass(status) {
  return `status-${String(status || 'pending').replaceAll(' ', '_')}`;
}

function userId(user) {
  return String(user.id || user._id || '');
}

async function refreshAdminData() {
  const results = await Promise.allSettled([
    loadAllUsers(), loadAllProductsAdmin(), loadOrderData(), loadAdminBookings()
  ]);
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length) FC.toast(`${failed.length} section(s) could not be refreshed`, 'error');
  updateOverviewAndAnalytics();
}

async function loadAllUsers() {
  try {
    adminState.users = await FC.request('/auth/users');
    applyUserFilters();
    renderRecentUsers();
    updateOverviewAndAnalytics();
  } catch (error) {
    document.getElementById('usersTable').innerHTML = emptyState('⚠️', error.message);
    throw error;
  }
}

function applyUserFilters() {
  const query = document.getElementById('userSearch')?.value.trim().toLowerCase() || '';
  const role = document.getElementById('userRoleFilter')?.value || 'all';
  const filtered = adminState.users.filter(user => {
    const searchable = `${user.name} ${user.email} ${user.location || ''}`.toLowerCase();
    return (!query || searchable.includes(query)) && (role === 'all' || user.role === role);
  });
  renderUsers(filtered);
}

function renderUsers(users) {
  const container = document.getElementById('usersTable');
  if (!users.length) {
    container.innerHTML = emptyState('👥', 'No matching users found');
    return;
  }

  container.innerHTML = `<div class="table-wrap"><table class="admin-table">
    <thead><tr><th>User</th><th>Contact</th><th>Role</th><th>Location</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>${users.map(user => {
      const id = userId(user);
      const isSelf = id === String(currentAdmin.id || currentAdmin._id || '');
      return `<tr>
        <td><div class="user-cell"><span class="mini-avatar">${FC.escapeHtml((user.name || 'U')[0].toUpperCase())}</span><div><strong>${FC.escapeHtml(user.name)}</strong><small>${user.isVerified ? '✓ Verified' : 'Standard account'}</small></div></div></td>
        <td><strong>${FC.escapeHtml(user.email)}</strong><small>${FC.escapeHtml(user.phone || 'No phone')}</small></td>
        <td><select class="role-select" aria-label="Change role for ${FC.escapeHtml(user.name)}" onchange="changeUserRole('${id}', this.value)" ${isSelf ? 'disabled title="You cannot change your own role here"' : ''}>
          ${['buyer','farmer','admin'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${roleIcon(role)} ${FC.statusLabel(role)}</option>`).join('')}
        </select></td>
        <td>${FC.escapeHtml(user.location || '—')}</td>
        <td>${FC.date(user.createdAt)}</td>
        <td><button class="btn-delete compact-btn" type="button" onclick="deleteUser('${id}')" ${isSelf ? 'disabled title="You cannot delete yourself"' : ''}>🗑 Delete</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function renderRecentUsers() {
  const container = document.getElementById('recentUsers');
  const recent = adminState.users.slice(0, 5);
  if (!recent.length) {
    container.innerHTML = emptyState('👥', 'No users yet');
    return;
  }
  container.innerHTML = recent.map(user => `<article class="order-card recent-user-card">
    <span class="mini-avatar">${FC.escapeHtml((user.name || 'U')[0].toUpperCase())}</span>
    <div class="grow"><strong>${FC.escapeHtml(user.name)}</strong><small>${FC.escapeHtml(user.email)}</small></div>
    <span class="order-status ${user.role === 'admin' ? 'status-pending' : user.role === 'farmer' ? 'status-confirmed' : 'status-delivered'}">${roleIcon(user.role)} ${FC.statusLabel(user.role)}</span>
  </article>`).join('');
}

function openCreateUser(role = 'buyer') {
  document.getElementById('createUserForm')?.reset();
  document.getElementById('newUserRole').value = role;
  document.getElementById('createUserModal')?.classList.add('open');
}

async function createUser(event) {
  event.preventDefault();
  const button = document.getElementById('createUserBtn');
  FC.setButtonLoading(button, true, 'Creating...');
  try {
    const result = await FC.request('/auth/users', {
      method: 'POST',
      body: {
        name: document.getElementById('newUserName').value.trim(),
        email: document.getElementById('newUserEmail').value.trim(),
        password: document.getElementById('newUserPassword').value,
        role: document.getElementById('newUserRole').value,
        phone: document.getElementById('newUserPhone').value.trim(),
        location: document.getElementById('newUserLocation').value.trim()
      }
    });
    closeModal();
    FC.toast(result.message, 'success');
    await loadAllUsers();
  } catch (error) {
    FC.toast(error.message, 'error');
  } finally {
    FC.setButtonLoading(button, false);
  }
}

async function changeUserRole(id, role) {
  if (!confirm(`Change this account to ${role}? The user will receive the new permissions at their next request.`)) {
    await loadAllUsers();
    return;
  }
  try {
    const result = await FC.request(`/auth/users/${id}/role`, { method: 'PATCH', body: { role } });
    FC.toast(result.message, 'success');
    await loadAllUsers();
  } catch (error) {
    FC.toast(error.message, 'error');
    await loadAllUsers();
  }
}

async function deleteUser(id) {
  if (!confirm('Delete this account permanently? Products and order history may still refer to it.')) return;
  try {
    const result = await FC.request(`/auth/users/${id}`, { method: 'DELETE' });
    FC.toast(result.message, 'success');
    await loadAllUsers();
  } catch (error) {
    FC.toast(error.message, 'error');
  }
}

async function loadAllProductsAdmin() {
  try {
    adminState.products = await FC.request('/products/admin/all');
    applyProductFilters();
    updateOverviewAndAnalytics();
  } catch (error) {
    document.getElementById('adminProductsGrid').innerHTML = emptyState('⚠️', error.message);
    throw error;
  }
}

function applyProductFilters() {
  const query = document.getElementById('adminProductSearch')?.value.trim().toLowerCase() || '';
  const availability = document.getElementById('adminProductAvailability')?.value || 'all';
  const products = adminState.products.filter(product => {
    const searchable = `${product.name} ${product.category} ${product.location} ${product.farmer?.name || ''}`.toLowerCase();
    const availabilityMatch = availability === 'all' ||
      (availability === 'available' && product.isAvailable) ||
      (availability === 'unavailable' && !product.isAvailable);
    return (!query || searchable.includes(query)) && availabilityMatch;
  });
  renderAdminProducts(products);
}

function renderAdminProducts(products) {
  const grid = document.getElementById('adminProductsGrid');
  if (!products.length) {
    grid.innerHTML = emptyState('🌱', 'No matching products found');
    return;
  }
  grid.innerHTML = products.map(product => `<article class="product-card admin-product-card">
    ${FC.productVisual(product)}
    <div class="product-card-body">
      <div class="product-card-heading"><div><div class="product-name">${FC.escapeHtml(product.name)}</div><div class="product-category">${FC.escapeHtml(FC.statusLabel(product.category))} • ${FC.escapeHtml(product.location)}</div></div><span class="order-status ${product.isAvailable ? 'status-confirmed' : 'status-cancelled'}">${product.isAvailable ? 'Available' : 'Out of stock'}</span></div>
      <div class="product-price">${FC.money(product.price)}/${FC.escapeHtml(product.unit)}</div>
      <div class="product-meta"><span>Stock: ${Number(product.quantity).toLocaleString('en-IN')} ${FC.escapeHtml(product.unit)}</span><span>Quality: ${FC.escapeHtml(FC.statusLabel(product.qualityGrade))}</span></div>
      <small>👨‍🌾 ${FC.escapeHtml(product.farmer?.name || 'Unknown farmer')} • ⭐ ${Number(product.rating || 0).toFixed(1)}</small>
      <button class="btn-delete full-width-btn" type="button" onclick="deleteProductAdmin('${product._id}')">🗑 Delete Listing</button>
    </div>
  </article>`).join('');
}

async function deleteProductAdmin(id) {
  if (!confirm('Delete this product listing? Active orders will block deletion.')) return;
  try {
    const result = await FC.request(`/products/${id}`, { method: 'DELETE' });
    FC.toast(result.message, 'success');
    await loadAllProductsAdmin();
  } catch (error) {
    FC.toast(error.message, 'error');
  }
}

async function loadOrderData() {
  await Promise.allSettled([loadAdminOrders(), loadAdminBulkOrders(), loadAdminOrderStats()]);
  updateOverviewAndAnalytics();
}

async function loadAdminOrders() {
  try {
    adminState.directOrders = await FC.request('/orders/admin/orders');
    renderAdminOrders();
  } catch (error) {
    document.getElementById('adminOrdersList').innerHTML = emptyState('⚠️', error.message);
    throw error;
  }
}

function renderAdminOrders() {
  const container = document.getElementById('adminOrdersList');
  if (!adminState.directOrders.length) {
    container.innerHTML = emptyState('📦', 'No direct orders found');
    return;
  }
  container.innerHTML = adminState.directOrders.map(order => `<article class="order-box">
    <div class="bulk-card-top"><div><span class="order-code">DIRECT • ${FC.date(order.createdAt)}</span><h3>${FC.escapeHtml(order.productName)}</h3></div><span class="bulk-status ${statusClass(order.status)}">${FC.statusLabel(order.status)}</span></div>
    <div class="order-detail-grid"><span><strong>Buyer</strong>${FC.escapeHtml(order.buyerName)}</span><span><strong>Farmer</strong>${FC.escapeHtml(order.farmerName)}</span><span><strong>Quantity</strong>${Number(order.quantity).toLocaleString('en-IN')} ${FC.escapeHtml(order.unit || '')}</span><span><strong>Total</strong>${FC.money(order.totalAmount)}</span></div>
    ${!['delivered','cancelled','rejected'].includes(order.status) ? `<div class="order-actions"><button class="btn-delete" type="button" onclick="adminCancelOrder('${order._id}')">Cancel Order</button></div>` : ''}
  </article>`).join('');
}

async function adminCancelOrder(id) {
  if (!confirm('Cancel this direct order and release any reserved stock?')) return;
  try {
    const result = await FC.request(`/orders/admin/${id}/cancel`, { method: 'PATCH' });
    FC.toast(result.message, 'success');
    await loadOrderData();
    await loadAllProductsAdmin();
  } catch (error) {
    FC.toast(error.message, 'error');
  }
}

async function loadAdminBulkOrders() {
  try {
    adminState.bulkOrders = await FC.request('/bulk-orders/admin');
    renderAdminBulkOrders();
  } catch (error) {
    document.getElementById('adminBulkOrdersList').innerHTML = emptyState('⚠️', error.message);
    throw error;
  }
}

function renderAdminBulkOrders() {
  const container = document.getElementById('adminBulkOrdersList');
  if (!adminState.bulkOrders.length) {
    container.innerHTML = emptyState('🤝', 'No multi-farmer orders found');
    return;
  }
  container.innerHTML = adminState.bulkOrders.map(order => {
    const allocated = Number(order.allocatedQuantity || 0);
    const delivered = Number(order.deliveredQuantity || 0);
    const requested = Number(order.requestedQuantity || 0);
    const percent = requested ? Math.min(100, Math.round((allocated / requested) * 100)) : 0;
    return `<article class="order-box bulk-order-card">
      <div class="bulk-card-top"><div><span class="order-code">${FC.escapeHtml(order.orderCode)}</span><h3>${FC.escapeHtml(order.productName)} • ${requested.toLocaleString('en-IN')} ${FC.escapeHtml(order.unit)}</h3><p>Buyer: ${FC.escapeHtml(order.buyerName)} • Delivery: ${FC.escapeHtml(order.deliveryLocation)}</p></div><span class="bulk-status ${statusClass(order.status)}">${FC.statusLabel(order.status)}</span></div>
      <div class="fulfillment-metrics"><span><strong>${requested.toLocaleString('en-IN')}</strong>Requested</span><span><strong>${allocated.toLocaleString('en-IN')}</strong>Allocated</span><span><strong>${delivered.toLocaleString('en-IN')}</strong>Delivered</span><span><strong>${FC.money(order.totalAmount)}</strong>Order value</span></div>
      <div class="fulfillment-progress"><span style="width:${percent}%"></span></div><p class="progress-caption">${percent}% allocated across ${new Set((order.allocations || []).filter(a => !['rejected','cancelled'].includes(a.status)).map(a => String(a.farmerId))).size} farmer(s)</p>
      <div class="allocation-list">${(order.allocations || []).map(allocation => `<div class="allocation-chip"><div><strong>${FC.escapeHtml(allocation.farmerName)}</strong><span>${Number(allocation.quantity).toLocaleString('en-IN')} ${FC.escapeHtml(order.unit)} × ${FC.money(allocation.pricePerUnit)}</span></div><span class="allocation-status ${statusClass(allocation.status)}">${FC.statusLabel(allocation.status)}</span></div>`).join('') || '<small>No allocations yet</small>'}</div>
      <div class="order-actions">
        ${!['delivered','cancelled'].includes(order.status) && allocated < requested ? `<button class="btn-secondary" type="button" onclick="reallocateBulkOrder('${order._id}')">Find More Farmers</button>` : ''}
        ${!['delivered','cancelled'].includes(order.status) ? `<button class="btn-delete" type="button" onclick="adminCancelBulkOrder('${order._id}')">Admin Cancel</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

async function reallocateBulkOrder(id) {
  try {
    const result = await FC.request(`/bulk-orders/${id}/reallocate`, { method: 'POST' });
    FC.toast(result.message, 'success');
    await loadAdminBulkOrders();
  } catch (error) {
    FC.toast(error.message, 'error');
  }
}

async function adminCancelBulkOrder(id) {
  if (!confirm('Cancel this entire bulk order? Pending/accepted stock will be released where applicable.')) return;
  try {
    const result = await FC.request(`/bulk-orders/${id}/admin-cancel`, { method: 'PATCH' });
    FC.toast(result.message, 'success');
    await loadAdminBulkOrders();
    await loadAllProductsAdmin();
  } catch (error) {
    FC.toast(error.message, 'error');
  }
}

async function loadAdminOrderStats() {
  try {
    const [directStats, bulkStats] = await Promise.all([
      FC.request('/orders/admin/stats'), FC.request('/bulk-orders/admin/stats')
    ]);
    adminState.directStats = directStats;
    adminState.bulkStats = bulkStats;
  } catch (error) {
    console.error(error);
  }
}

async function loadAdminBookings() {
  try {
    adminState.bookings = await FC.request('/bookings/admin');
    renderAdminBookings();
    updateOverviewAndAnalytics();
  } catch (error) {
    document.getElementById('adminBookingsList').innerHTML = emptyState('⚠️', error.message);
    throw error;
  }
}

function renderAdminBookings() {
  const container = document.getElementById('adminBookingsList');
  if (!adminState.bookings.length) {
    container.innerHTML = emptyState('🚜', 'No equipment bookings found');
    return;
  }
  container.innerHTML = adminState.bookings.map(booking => `<article class="order-box">
    <div class="bulk-card-top"><div><span class="order-code">${FC.date(booking.createdAt)}</span><h3>${FC.escapeHtml(booking.serviceName)}</h3><p>${FC.escapeHtml(booking.buyerName)} • ${FC.escapeHtml(booking.location)}</p></div><span class="bulk-status ${statusClass(booking.status)}">${FC.statusLabel(booking.status)}</span></div>
    <div class="order-detail-grid"><span><strong>Schedule</strong>${FC.escapeHtml(booking.date)} at ${FC.escapeHtml(booking.time)}</span><span><strong>Duration</strong>${booking.hours} hour(s)</span><span><strong>Area</strong>${booking.area || 0} acre(s)</span><span><strong>Estimated cost</strong>${FC.money(booking.totalCost)}</span></div>
    ${booking.note ? `<p><strong>Note:</strong> ${FC.escapeHtml(booking.note)}</p>` : ''}
    <div class="order-actions"><select class="role-select" aria-label="Update booking status" onchange="updateBookingStatus('${booking._id}', this.value)">
      ${['pending','confirmed','completed','cancelled'].map(status => `<option value="${status}" ${booking.status === status ? 'selected' : ''}>${FC.statusLabel(status)}</option>`).join('')}
    </select></div>
  </article>`).join('');
}

async function updateBookingStatus(id, status) {
  try {
    const result = await FC.request(`/bookings/${id}/status`, { method: 'PATCH', body: { status } });
    FC.toast(result.message, 'success');
    await loadAdminBookings();
  } catch (error) {
    FC.toast(error.message, 'error');
    await loadAdminBookings();
  }
}

function updateOverviewAndAnalytics() {
  const users = adminState.users;
  const farmers = users.filter(user => user.role === 'farmer').length;
  const buyers = users.filter(user => user.role === 'buyer').length;
  const admins = users.filter(user => user.role === 'admin').length;
  const directCount = adminState.directStats.totalOrders ?? adminState.directOrders.length;
  const bulkCount = adminState.bulkStats.totalBulkOrders ?? adminState.bulkOrders.length;
  const bookingCount = adminState.bookings.length;
  const revenue = Number(adminState.directStats.totalRevenue || 0) + Number(adminState.bulkStats.grossValue || 0);

  const values = {
    totalUsers: users.length, totalFarmers: farmers, totalBuyers: buyers, totalAdmins: admins,
    totalProducts: adminState.products.length, totalOrders: directCount + bulkCount,
    analyticsOrders: directCount, analyticsBulkOrders: bulkCount,
    analyticsRevenue: FC.money(revenue), analyticsBookings: bookingCount
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  const activeProducts = adminState.products.filter(product => product.isAvailable).length;
  const pendingDirect = adminState.directOrders.filter(order => order.status === 'pending').length;
  const incompleteBulk = adminState.bulkOrders.filter(order => !['delivered','cancelled'].includes(order.status)).length;
  const pendingBookings = adminState.bookings.filter(booking => booking.status === 'pending').length;

  const snapshot = document.getElementById('operationsSnapshot');
  if (snapshot) snapshot.innerHTML = `
    <div class="analytics-row"><span>Active crop listings</span><strong>${activeProducts}/${adminState.products.length}</strong></div>
    <div class="analytics-row"><span>Pending direct orders</span><strong>${pendingDirect}</strong></div>
    <div class="analytics-row"><span>Bulk orders needing attention</span><strong>${incompleteBulk}</strong></div>
    <div class="analytics-row"><span>Pending equipment requests</span><strong>${pendingBookings}</strong></div>`;

  const breakdown = document.getElementById('analyticsBreakdown');
  if (breakdown) {
    const deliveredDirect = Number(adminState.directStats.deliveredOrders || 0);
    const deliveredBulk = Number(adminState.bulkStats.fullyDelivered || 0);
    const completedBookings = adminState.bookings.filter(booking => booking.status === 'completed').length;
    breakdown.innerHTML = `
      <h3>Completion Breakdown</h3>
      ${analyticsBar('Direct orders delivered', deliveredDirect, directCount)}
      ${analyticsBar('Bulk orders fully delivered', deliveredBulk, bulkCount)}
      ${analyticsBar('Equipment bookings completed', completedBookings, bookingCount)}
      ${analyticsBar('Products currently available', activeProducts, adminState.products.length)}`;
  }
}

function analyticsBar(label, value, total) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return `<div class="analytics-bar-row"><div><span>${FC.escapeHtml(label)}</span><strong>${value}/${total}</strong></div><div class="analytics-track"><span style="width:${percent}%"></span></div></div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createUserForm')?.addEventListener('submit', createUser);
  refreshAdminData();
});
