let farmerProducts = [];
let farmerDirectOrderCount = 0;
let farmerBulkOrderCount = 0;
let addImageData = '';
let editImageData = '';
const e = FC.escapeHtml;

function renderFarmerProductCard(product) {
  return `<article class="product-card">${FC.productVisual(product)}<div class="product-name">${e(product.name)}</div><div class="product-category">${e(FC.statusLabel(product.category))} • ${e(product.location)}</div><div class="product-price">${FC.money(product.price)}/${e(product.unit)}</div><div class="product-qty">Available: ${Number(product.quantity)} ${e(product.unit)}</div><div class="product-meta">${e(FC.statusLabel(product.qualityGrade || 'standard'))} • ${e(FC.statusLabel(product.farmingMethod || 'conventional'))}</div><div class="product-actions"><button class="btn-edit" onclick="editProduct('${product._id}')">✏️ Edit</button><button class="btn-delete" onclick="deleteProduct('${product._id}')">🗑️ Delete</button></div></article>`;
}

async function loadFarmerProducts() {
  try {
    farmerProducts = await FC.request('/products/farmer');
    document.getElementById('totalProducts').textContent = farmerProducts.length;
    document.getElementById('productsGrid').innerHTML = farmerProducts.length ? farmerProducts.map(renderFarmerProductCard).join('') : '<div class="empty-state"><div class="empty-icon">🌱</div><p>No products yet.</p><button class="btn-primary" onclick="openAddProduct()">Add First Product</button></div>';
    document.getElementById('recentProducts').innerHTML = farmerProducts.length ? farmerProducts.slice(0,3).map(product => `<div class="order-card">${FC.productVisual(product, 'recent-product-visual')}<div style="flex:1"><strong>${e(product.name)}</strong><div class="product-meta">${e(product.location)} • ${Number(product.quantity)} ${e(product.unit)}</div></div><strong>${FC.money(product.price)}/${e(product.unit)}</strong></div>`).join('') : '<div class="empty-state"><p>Add your first crop listing with a real photo.</p></div>';
  } catch (error) {
    document.getElementById('productsGrid').innerHTML = `<div class="bulk-error">${e(error.message)}</div>`;
  }
}

async function previewProductImage(inputId, previewId) {
  const input = document.getElementById(inputId), preview = document.getElementById(previewId);
  try {
    const data = await FC.imageFileToDataUrl(input.files[0]);
    if (inputId.startsWith('edit')) editImageData = data; else addImageData = data;
    preview.innerHTML = `<img src="${data}" alt="Crop preview">`;
  } catch (error) {
    input.value = '';
    FC.toast(error.message, 'error');
  }
}

function productFormPayload(edit = false) {
  const prefix = edit ? 'editProd' : 'prod';
  return {
    name: document.getElementById(`${prefix}Name`).value.trim(),
    description: document.getElementById(`${prefix}Desc`).value.trim(),
    category: document.getElementById(`${prefix}Category`).value,
    unit: document.getElementById(`${prefix}Unit`).value,
    price: Number(document.getElementById(`${prefix}Price`).value),
    quantity: Number(document.getElementById(`${prefix}Quantity`).value),
    location: document.getElementById(`${prefix}Location`).value.trim(),
    qualityGrade: document.getElementById(`${prefix}Quality`).value,
    farmingMethod: document.getElementById(`${prefix}Method`).value,
    harvestDate: document.getElementById(`${prefix}HarvestDate`).value || undefined,
    images: [(edit ? editImageData : addImageData)].filter(Boolean)
  };
}

function validateProductPayload(payload) {
  if (!payload.name || !payload.description || !payload.location || !Number.isFinite(payload.price) || payload.price <= 0 || !Number.isFinite(payload.quantity) || payload.quantity < 0) {
    FC.toast('Complete product name, description, price, quantity and location', 'error');
    return false;
  }
  return true;
}

async function addProduct() {
  const payload = productFormPayload(false);
  if (!validateProductPayload(payload)) return;
  const button = document.getElementById('addProductBtn'); FC.setButtonLoading(button, true, 'Adding...');
  try {
    await FC.request('/products', { method: 'POST', body: payload });
    FC.toast('Product added successfully', 'success'); closeModal(); clearAddProductForm(); loadFarmerProducts(); loadFarmerStats();
  } catch (error) { FC.toast(error.message, 'error'); } finally { FC.setButtonLoading(button, false); }
}

function clearAddProductForm() {
  ['prodName','prodDesc','prodPrice','prodQuantity','prodLocation','prodHarvestDate','prodImage'].forEach(id => document.getElementById(id).value = '');
  addImageData = '';
  document.getElementById('prodImagePreview').innerHTML = '<span>📷 Camera or gallery photo</span>';
}

function editProduct(id) {
  const product = farmerProducts.find(item => item._id === id);
  if (!product) return;
  document.getElementById('editProdId').value = product._id;
  document.getElementById('editProdName').value = product.name;
  document.getElementById('editProdDesc').value = product.description;
  document.getElementById('editProdCategory').value = product.category;
  document.getElementById('editProdUnit').value = product.unit;
  document.getElementById('editProdPrice').value = product.price;
  document.getElementById('editProdQuantity').value = product.quantity;
  document.getElementById('editProdLocation').value = product.location;
  document.getElementById('editProdQuality').value = product.qualityGrade || 'standard';
  document.getElementById('editProdMethod').value = product.farmingMethod || 'conventional';
  document.getElementById('editProdHarvestDate').value = product.harvestDate ? String(product.harvestDate).slice(0,10) : '';
  editImageData = product.images?.[0] || '';
  document.getElementById('editProdImagePreview').innerHTML = editImageData ? `<img src="${e(editImageData)}" alt="Crop preview">` : '<span>📷 Add a crop photo</span>';
  document.getElementById('editProductModal').classList.add('open');
}

async function saveEditProduct() {
  const payload = productFormPayload(true);
  if (!validateProductPayload(payload)) return;
  const button = document.getElementById('editProductBtn'); FC.setButtonLoading(button, true, 'Saving...');
  try {
    await FC.request(`/products/${document.getElementById('editProdId').value}`, { method: 'PUT', body: payload });
    FC.toast('Product updated', 'success'); closeModal(); loadFarmerProducts(); loadFarmerStats();
  } catch (error) { FC.toast(error.message, 'error'); } finally { FC.setButtonLoading(button, false); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? Products with active orders cannot be deleted.')) return;
  try { const data = await FC.request(`/products/${id}`, { method: 'DELETE' }); FC.toast(data.message, 'success'); loadFarmerProducts(); }
  catch (error) { FC.toast(error.message, 'error'); }
}

async function generateDescription(edit = false) {
  const prefix = edit ? 'editProd' : 'prod';
  const name = document.getElementById(`${prefix}Name`).value.trim(), quantity = Number(document.getElementById(`${prefix}Quantity`).value);
  if (!name || !quantity) { FC.toast('Enter product name and quantity first', 'error'); return; }
  try {
    const data = await FC.request('/ai/generate-description', { method: 'POST', body: { name, category: document.getElementById(`${prefix}Category`).value, quantity, quality: document.getElementById(`${prefix}Quality`).value, location: document.getElementById(`${prefix}Location`).value.trim(), language: FC.getUser().language || 'en' } });
    document.getElementById(`${prefix}Desc`).value = data.description;
  } catch (error) { FC.toast(error.message, 'error'); }
}

async function suggestPrice(edit = false) {
  const prefix = edit ? 'editProd' : 'prod';
  try {
    const data = await FC.request('/ai/suggest-price', { method: 'POST', body: { category: document.getElementById(`${prefix}Category`).value, qualityGrade: document.getElementById(`${prefix}Quality`).value } });
    document.getElementById(`${prefix}Price`).value = data.suggestedPrice;
    FC.toast(`${data.reason} Range: ${FC.money(data.minPrice)}–${FC.money(data.maxPrice)}`);
  } catch (error) { FC.toast(error.message, 'error'); }
}

async function loadFarmerOrders() {
  try { const orders = await FC.request('/orders/farmer'); farmerDirectOrderCount = orders.length; updateFarmerOrderCount(); renderOrders(orders); }
  catch (error) { document.getElementById('ordersList').innerHTML = `<div class="bulk-error">${e(error.message)}</div>`; }
}
function renderOrders(orders) {
  const container = document.getElementById('ordersList');
  container.innerHTML = orders.length ? orders.map(order => `<article class="order-box"><div class="bulk-card-top"><div><h3>${e(order.productName)}</h3><p>Buyer: <strong>${e(order.buyerName)}</strong></p></div><span class="bulk-status status-${e(order.status)}">${e(FC.statusLabel(order.status))}</span></div><div class="fulfillment-metrics"><span>${order.quantity} ${e(order.unit || '')}</span><span>${FC.money(order.totalAmount)}</span><span>${FC.date(order.createdAt)}</span></div>${order.message ? `<p>📝 ${e(order.message)}</p>` : ''}<div class="order-actions"><button class="btn-secondary" onclick="openFarmerChat(${FC.inlineArg(order.buyerId)},${FC.inlineArg(order.buyerName)})">💬 Chat</button>${order.status === 'pending' ? `<button class="accept-btn" onclick="acceptOrder('${order._id}')">Accept</button><button class="reject-btn" onclick="rejectOrder('${order._id}')">Reject</button>` : ''}${order.status === 'accepted' ? `<button class="accept-btn" onclick="deliverOrder('${order._id}')">Mark Delivered</button>` : ''}</div></article>`).join('') : '<div class="empty-state"><p>No direct orders.</p></div>';
}
async function orderAction(id, action) { try { const data = await FC.request(`/orders/${id}/${action}`, { method: 'PATCH' }); FC.toast(data.message, 'success'); await Promise.all([loadFarmerOrders(), loadFarmerProducts(), loadFarmerStats()]); } catch (error) { FC.toast(error.message, 'error'); } }
function acceptOrder(id){ orderAction(id,'accept'); }
function rejectOrder(id){ if(confirm('Reject this order and release reserved stock?')) orderAction(id,'reject'); }
function deliverOrder(id){ orderAction(id,'deliver'); }

function updateFarmerOrderCount() { document.getElementById('totalOrders').textContent = farmerDirectOrderCount + farmerBulkOrderCount; }
async function loadFarmerBulkOrders() {
  try { const allocations = await FC.request('/bulk-orders/farmer'); farmerBulkOrderCount = allocations.length; updateFarmerOrderCount(); renderFarmerBulkOrders(allocations); }
  catch (error) { document.getElementById('farmerBulkOrdersList').innerHTML = `<div class="bulk-error">${e(error.message)}</div>`; }
}
function renderFarmerBulkOrders(allocations) {
  const container = document.getElementById('farmerBulkOrdersList');
  container.innerHTML = allocations.length ? allocations.map(item => `<article class="order-box farmer-allocation-card"><div class="bulk-card-top"><div><span class="order-code">${e(item.orderCode)}</span><h3>${e(item.productName)}</h3><p>Buyer: <strong>${e(item.buyerName)}</strong></p></div><span class="bulk-status status-${e(item.status)}">${e(FC.statusLabel(item.status))}</span></div><div class="allocation-highlight"><span>Your allocated quantity</span><strong>${item.quantity} ${e(item.unit)}</strong></div><div class="fulfillment-metrics"><span>${FC.money(item.pricePerUnit)}/${e(item.unit)}</span><span>${FC.money(item.totalAmount)} total</span><span>📍 ${e(item.deliveryLocation)}</span><span>Parent: ${e(FC.statusLabel(item.parentStatus))}</span></div><div class="order-actions"><button class="btn-secondary" onclick="openFarmerChat(${FC.inlineArg(item.buyerId || '')},${FC.inlineArg(item.buyerName)})">💬 Chat</button>${item.status === 'pending' ? `<button class="accept-btn" onclick="acceptBulkAllocation('${item.allocationId}')">Accept Share</button><button class="reject-btn" onclick="rejectBulkAllocation('${item.allocationId}')">Reject Share</button>` : ''}${item.status === 'accepted' ? `<button class="accept-btn" onclick="deliverBulkAllocation('${item.allocationId}')">Mark Delivered</button>` : ''}</div></article>`).join('') : '<div class="empty-state"><p>No shared allocations.</p></div>';
}
async function bulkAction(id, action) { try { const data = await FC.request(`/bulk-orders/allocations/${id}/${action}`, { method: 'PATCH' }); FC.toast(data.message, 'success'); await Promise.all([loadFarmerBulkOrders(), loadFarmerProducts(), loadFarmerStats()]); } catch (error) { FC.toast(error.message, 'error'); } }
function acceptBulkAllocation(id){ bulkAction(id,'accept'); }
function rejectBulkAllocation(id){ if(confirm('Reject this share? The stock will be released and another farmer will be searched.')) bulkAction(id,'reject'); }
function deliverBulkAllocation(id){ bulkAction(id,'deliver'); }

async function loadFarmerStats() {
  try {
    const stats = await FC.request('/orders/farmer/stats');
    document.getElementById('totalRevenue').textContent = FC.money(stats.revenue); document.getElementById('avgRating').textContent = stats.averageRating;
    document.getElementById('analyticsActiveProducts').textContent = stats.activeProducts; document.getElementById('analyticsPending').textContent = stats.pendingOrders; document.getElementById('analyticsDelivered').textContent = stats.deliveredOrders; document.getElementById('analyticsStock').textContent = stats.totalStock;
    const total = Math.max(1, stats.totalOrders); document.getElementById('farmerAnalyticsBars').innerHTML = [['Pending',stats.pendingOrders],['Accepted',stats.acceptedOrders],['Delivered',stats.deliveredOrders],['Rejected',stats.rejectedOrders]].map(([label,value]) => `<div class="analytics-row"><span>${label}</span><div class="analytics-track"><span style="width:${Math.round(value/total*100)}%"></span></div><strong>${value}</strong></div>`).join('');
  } catch (error) { console.error(error); }
}
function loadFarmerAnalytics(){ return loadFarmerStats(); }

async function loadFarmerChatContacts() {
  try { const contacts = await FC.request('/chat/contacts'); document.getElementById('farmerChatContactSelect').innerHTML = '<option value="">Select a buyer</option>' + contacts.map(c => `<option value="${c.id}">${e(c.name)} — ${e(c.location || c.role)}</option>`).join(''); }
  catch (error) { console.error(error); }
}
function selectFarmerChatContact(id) { document.getElementById('farmerChatUserId').value = id; const option = document.getElementById('farmerChatContactSelect').selectedOptions[0]; document.getElementById('farmerChatTitle').textContent = id ? `💬 Chat with ${option.textContent.split(' — ')[0]}` : '💬 Chat'; loadFarmerMessages(); }
function openFarmerChat(id,name='Buyer') { if(!id){FC.toast('Buyer contact unavailable','error');return;} showSection('chat'); document.getElementById('farmerChatUserId').value=id; document.getElementById('farmerChatTitle').textContent=`💬 Chat with ${name}`; const select=document.getElementById('farmerChatContactSelect'); if(![...select.options].some(o=>o.value===id)) select.add(new Option(name,id)); select.value=id; loadFarmerMessages(); }
async function sendFarmerMessage() { const receiverId=document.getElementById('farmerChatUserId').value,message=document.getElementById('farmerChatInput').value.trim(); if(!receiverId||!message){FC.toast('Select a buyer and enter a message','error');return;} try{await FC.request('/chat/send',{method:'POST',body:{receiverId,message,originalLanguage:FC.getUser().language||'en'}});document.getElementById('farmerChatInput').value='';loadFarmerMessages();}catch(error){FC.toast(error.message,'error');} }
async function loadFarmerMessages() { const id=document.getElementById('farmerChatUserId').value,container=document.getElementById('farmerChatMessages'); if(!id){container.innerHTML='<div class="empty-state"><p>Select a buyer.</p></div>';return;} try{const messages=await FC.request(`/chat/${id}`),myId=String(FC.getUser().id);container.innerHTML=messages.length?messages.map(m=>`<div class="chat-bubble ${String(m.senderId)===myId?'sent':'received'}"><p>${e(m.originalMessage)}</p><small>${new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div>`).join(''):'<div class="empty-state"><p>No messages yet.</p></div>';container.scrollTop=container.scrollHeight;}catch(error){container.innerHTML=`<div class="bulk-error">${e(error.message)}</div>`;} }

const farmerBaseShowSection = window.showSection;
window.showSection = function farmerShowSection(id){ farmerBaseShowSection(id); if(id==='chat') loadFarmerChatContacts(); if(id==='analytics') loadFarmerStats(); };

document.addEventListener('DOMContentLoaded',()=>{ const user=FC.getUser();document.getElementById('prodLocation').value=user.location||'';loadFarmerProducts();loadFarmerOrders();loadFarmerBulkOrders();loadFarmerStats();loadFarmerChatContacts();document.getElementById('farmerChatInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();sendFarmerMessage();}}); });
