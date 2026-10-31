
const THEME_KEY = 'tide-erp-theme';
const AUTH_SESSION_KEY = 'tide-erp-auth-user';
function safeStorageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeStorageSet(key, value) { try { localStorage.setItem(key, value); } catch {} }
function safeStorageRemove(key) { try { localStorage.removeItem(key); } catch {} }

const initialState = {
  version: 3,
  companyName: 'Kipepeo Traders',
  companyLogo: '',
  companyAddress: 'Dar es Salaam, Tanzania',
  companyPhone: '',
  companyEmail: '',
  companyPaymentDetails: '',
  branch: 'Main branch',
  activeBranchId: 'BR-MAIN',
  branches: [{ id: 'BR-MAIN', name: 'Main branch', status: 'Active' }],
  branchData: {},
  products: [],
  customers: [],
  suppliers: [],
  orders: [],
  sales: [],
  returns: [],
  purchaseReturns: [],
  purchases: [],
  entries: [],
  queue: [],
  stockMovements: [],
  users: [
    {
      id: 'USR-OWNER',
      name: 'Amina Mwinyi',
      username: '',
      email: '',
      phone: '',
      role: 'Owner / Administrator',
      modules: ['*'],
      permissions: { '*': ['*'] },
      branchId: 'BR-MAIN',
      status: 'Active',
      isBootstrap: true
    }
  ],
  currentUserId: 'USR-OWNER',
  companyAdminId: '',
  currency: 'TZS',
  vatEnabled: true,
  vatRate: 18,
  productCategories: ['General'],
  measurementUnits: ['Piece', 'Pack', 'Box', 'Kg', 'Litre'],
  productPackages: ['Single', 'Pack', 'Box', 'Carton'],
  notificationSettings: {
    enabled: true,
    lowStock: true,
    newSales: true,
    duePayments: true,
    syncFailures: true
  },
  trashBin: [],
  activityLog: []
};

const branchCollections = [
  'products', 'customers', 'suppliers', 'orders', 'sales',
  'returns', 'purchaseReturns', 'purchases', 'entries', 'queue',
  'stockMovements', 'trashBin'
];

let state = structuredClone(initialState);
let activeBranch = state.branches[0];
let page = 'dashboard';
const pageHistory = [];
if (!history.state?.erpPage) {
  history.replaceState({ erpPage: page }, '', `${location.pathname}${location.search}#${page}`);
}

let posCart = [];
let posDraftOrderId = '';
let posCustomer = 'Walk-in customer';
let posMethod = 'Cash';
let posCategory = '';
let deferredInstall = null;
let dashboardRange = 'This month';
let reportPeriod = 'monthly';
let tableQuery = '';
let salesStatusFilter = '';
let salesDateFrom = '';
let salesDateTo = '';
let purchaseStatusFilter = '';
let purchaseDateFrom = '';
let purchaseDateTo = '';
let orderMenuPortal = null;
let pendingCompanyLogo = '';

const userModuleChoices = [
  ['dashboard', 'Overview'],
  ['sales', 'Sales & Orders'],
  ['pos', 'Point of Sale'],
  ['inventory', 'Inventory'],
  ['purchases', 'Purchases'],
  ['customers', 'Customers'],
  ['suppliers', 'Suppliers'],
  ['accounting', 'Accounting'],
  ['reports', 'Reports'],
  ['settings', 'Settings'],
  ['users', 'Users'],
  ['branches', 'Branches']
];

const userRoleDefaults = {
  'Owner / Administrator': userModuleChoices.map(m => m[0]),
  'Manager': ['dashboard', 'sales', 'pos', 'inventory', 'purchases', 'customers', 'suppliers', 'accounting', 'reports', 'branches'],
  'Salesman': ['dashboard', 'sales', 'pos', 'customers'],
  'Storekeeper': ['dashboard', 'inventory', 'purchases']
};

const userActionPermissions = [
  { module: 'dashboard', actions: [['view', 'View overview'], ['sales-performance', 'View sales performance'], ['business-performance', 'View business performance'], ['stock-alerts', 'View stock alerts']] },
  { module: 'sales', actions: [['view', 'View sales and orders'], ['create', 'Create sales orders'], ['edit', 'Edit sales orders'], ['delete', 'Delete sales orders'], ['payments', 'Record payments'], ['returns', 'Manage returns'], ['print', 'Print invoices'], ['export', 'Export sales']] },
  { module: 'pos', actions: [['open', 'Open POS'], ['draft', 'Save POS drafts'], ['finalize', 'Complete checkout'], ['payments', 'Record POS payments'], ['refunds', 'Process refunds']] },
  { module: 'inventory', actions: [['view', 'View products and stock'], ['add-products', 'Add products'], ['edit-products', 'Edit products'], ['delete-products', 'Delete products'], ['adjust-stock', 'Adjust stock'], ['stock-history', 'View stock history'], ['stocktake', 'Run stock take'], ['bulk-import', 'Import products in bulk'], ['export', 'Export products']] },
  { module: 'purchases', actions: [['view', 'View purchases'], ['create', 'Create purchase orders'], ['edit', 'Edit purchase orders'], ['delete', 'Delete purchases'], ['receive', 'Receive stock'], ['payments', 'Record supplier payments'], ['returns', 'Manage supplier returns'], ['invoices', 'Upload and view invoices']] },
  { module: 'customers', actions: [['view', 'View customers'], ['add', 'Add customers'], ['edit', 'Edit customers'], ['delete', 'Delete customers'], ['activate', 'Activate or deactivate customers'], ['account-view', 'View account history'], ['order-history', 'View customer past orders'], ['payments', 'Record customer payments'], ['export', 'Export customers']] },
  { module: 'suppliers', actions: [['view', 'View suppliers'], ['add', 'Add suppliers'], ['edit', 'Edit suppliers'], ['delete', 'Delete suppliers'], ['activate', 'Activate or deactivate suppliers'], ['account-view', 'View account history'], ['order-history', 'View supplier past purchase orders'], ['payments', 'Record supplier payments'], ['returns', 'Manage supplier returns'], ['payment-details', 'View payment details'], ['export', 'Export suppliers']] },
  { module: 'accounting', actions: [['view', 'View accounting and ledger'], ['record-payments', 'Record account payments'], ['manage-entries', 'Manage account entries'], ['export', 'Export ledger']] },
  { module: 'reports', actions: [['view', 'View reports'], ['export', 'Export reports']] },
  { module: 'settings', actions: [['view', 'View settings'], ['edit-company', 'Edit company details'], ['edit-logo', 'Change company logo'], ['manage-branches', 'Manage branches']] },
  { module: 'users', actions: [['view', 'View users'], ['add', 'Add users'], ['edit', 'Edit users'], ['change-roles', 'Change user roles'], ['manage-permissions', 'Manage permissions'], ['activate', 'Activate or deactivate users'], ['delete', 'Delete users']] },
  { module: 'branches', actions: [['view', 'View branches'], ['open', 'Open branch workspaces'], ['manage', 'Manage branches']] }
];

function isAdministratorUser(user) { return user?.role === 'Owner / Administrator'; }

function rolePermissionMap(role, modules = userRoleDefaults[role] || []) {
  if (role === 'Owner / Administrator') return Object.fromEntries(userActionPermissions.map(group => [group.module, group.actions.map(([action]) => action)]));
  return Object.fromEntries(userActionPermissions.map(group => [group.module, modules.includes(group.module) ? group.actions.map(([action]) => action) : []]));
}

function effectiveUserPermissions(user = currentWorkspaceUser()) {
  if (!user) return {};
  if (isAdministratorUser(user)) return rolePermissionMap('Owner / Administrator');
  const stored=user.permissions&&typeof user.permissions==='object'?user.permissions:{};
  const explicit=Object.keys(stored).some(module=>module!=='*');
  const modules=Array.isArray(user.modules)?user.modules:(userRoleDefaults[user.role]||[]);
  const defaults=rolePermissionMap(user.role,modules),result={};
  for(const group of userActionPermissions){
    const selected=Array.isArray(stored[group.module])?stored[group.module]:(explicit?[]:defaults[group.module]||[]);
    result[group.module]=selected.includes('*')?group.actions.map(([action])=>action):selected.filter(action=>group.actions.some(([candidate])=>candidate===action));
  }
  return result;
}

function userHasPermission(module,action,user=currentWorkspaceUser()) {
  if(isAdministratorUser(user))return true;
  return (effectiveUserPermissions(user)[module]||[]).includes(action);
}

function canViewPage(module,user=currentWorkspaceUser()) { return userHasPermission(module,'view',user); }

function canPerformAction(action,element=null) {
  if(isWorkspaceAdministrator())return true;
  const type=element?.dataset?.partyType;
  const require=(module,permission)=>userHasPermission(module,permission);
  switch(action){
    case 'new-order':return require('sales','create');
    case 'edit-order':{const order=state.orders.find(item=>item.id===element?.dataset?.id);return order?.source==='POS'?(require('pos','draft')||require('pos','finalize')||require('sales','edit')):require('sales','edit');}
    case 'finalize-order':{const order=state.orders.find(item=>item.id===element?.dataset?.id);return order?.source==='POS'?require('pos','finalize'):require('sales','edit');}
    case 'view-order':return require('sales','view');
    case 'print-order-invoice':return require('sales','print');
    case 'add-order-payment':return require('sales','payments');
    case 'manage-order-returns':return require('sales','returns');
    case 'delete-order':return require('sales','delete');
    case 'view-customer-orders':return require('customers','order-history');
    case 'edit-party':return require(type==='Supplier'?'suppliers':'customers','edit');
    case 'delete-party':return isWorkspaceAdministrator();
    case 'toggle-party':return require(type==='Supplier'?'suppliers':'customers','activate');
    case 'view-party-orders':return require(type==='Supplier'?'suppliers':'customers','order-history');
    case 'add-cart':case 'cart-qty':case 'clear-cart':return require('pos','open');
    case 'save-pos-draft':case 'resume-pos':return require('pos','draft');
    case 'complete-pos':return require('pos','finalize');
    case 'new-product':return require('inventory','add-products');
    case 'edit-product':return require('inventory','edit-products');
    case 'delete-product':return require('inventory','delete-products');
    case 'adjust-stock':case 'bulk-stock-adjust':return require('inventory','adjust-stock');
    case 'bulk-stocktake':return require('inventory','stocktake');
    case 'product-stock-history':return require('inventory','stock-history');
    case 'import-products':return require('inventory','bulk-import');
    case 'download-product-template':return require('inventory','export');
    case 'new-purchase':return require('purchases','create');
    case 'edit-purchase':return require('purchases','edit');
    case 'receive-purchase':return require('purchases','receive');
    case 'purchase-payment':return require('purchases','payments');
    case 'delete-purchase':return require('purchases','delete');
    case 'new-party':return require(type==='Supplier'?'suppliers':'customers','add');
    case 'export-parties':return require(type==='Supplier'?'suppliers':'customers','export');
    case 'record-payment':return page==='accounting'?require('accounting','record-payments'):type==='Supplier'?require('suppliers','payments'):type==='Customer'?require('customers','payments'):require('accounting','record-payments');
    case 'view-account-ledger':return require('accounting','view')||(type==='Supplier'?require('suppliers','account-view'):require('customers','account-view'));
    case 'reconcile-account':return require('accounting','manage-entries');
    case 'set-report-period':return require('reports','view');
    case 'export-financial-report':return require('reports','export');
    case 'export-sales':return page==='reports'?require('reports','export'):require('sales','export');
    case 'export-inventory':return page==='reports'?require('reports','export'):require('inventory','export');
    case 'export-ledger':return page==='reports'?require('reports','export'):require('accounting','export');
    case 'remove-company-logo':return require('settings','edit-logo');
    case 'clear-trash':case 'restore-trash':return require('settings','edit-company');
    case 'new-user':return require('users','add');
    case 'edit-user-permissions':return isWorkspaceAdministrator()&&require('users','manage-permissions');
    case 'toggle-user':return require('users','activate');
    case 'delete-user':return isWorkspaceAdministrator()&&require('users','delete');
    case 'new-branch':return require('branches','manage')||require('settings','manage-branches');
    case 'open-branch':return require('branches','open');
    case 'select-transaction-product':case 'remove-transaction-product':return element?.dataset?.kind==='purchase'?require('purchases','create'):require('sales','create');
    default:return true;
  }
}

const pageLabels = {
  dashboard: 'Overview', sales: 'Sales', pos: 'Point of sale',
  inventory: 'Inventory', purchases: 'Purchases', customers: 'Customers',
  suppliers: 'Suppliers', users: 'Users', branches: 'Branches',
  accounting: 'Accounting', reports: 'Reports', settings: 'Settings'
};

// Date & Time (East Africa Time)
function branchDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

function today() {
  const p = branchDateParts();
  return `${p.year}-${p.month}-${p.day}`;
}

function dateLabel(value) {
  const date = new Date(String(value || today()) + 'T12:00:00Z');
  return new Intl.DateTimeFormat('en-TZ', {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Africa/Dar_es_Salaam'
  }).format(date);
}

function dateRangeFilter(kind, from, to) {
  const label = from && to ? `${dateLabel(from)} – ${dateLabel(to)}` : from ? `From ${dateLabel(from)}` : to ? `Until ${dateLabel(to)}` : 'Date range';
  return `<details class="date-filter"><summary class="button small">▦ ${esc(label)}</summary><div class="date-filter-popover"><strong>Filter by date</strong><label>From<input type="date" id="${kind}-date-from" value="${esc(from)}"></label><label>To<input type="date" id="${kind}-date-to" value="${esc(to)}"></label><div class="date-filter-actions"><button class="button small" data-action="clear-date-range" data-filter-kind="${kind}">Clear</button><button class="button small primary" data-action="apply-date-range" data-filter-kind="${kind}">Apply</button></div></div></details>`;
}

function isWithinDateRange(value, from, to) {
  const date = String(value || '').slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

function money(value) {
  const currency = state.currency || 'TZS';
  try {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.abs(value));
  } catch {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(Math.abs(value));
  }
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shortName(name = '') {
  return name.split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
}

function statusClass(value) {
  return String(value).toLowerCase().replace(/\s/g, '-');
}

function idFor(prefix, list = []) {
  const branchCode = (activeBranch?.id || 'BR-MAIN').replace(/[^A-Za-z0-9]/g, '').slice(-6);
  return `${prefix}-${branchCode}-${String(Date.now()).slice(-6)}${String(list.length + 1).padStart(2, '0')}`;
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.getElementById('toast-region').append(el);
  setTimeout(() => el.remove(), 3200);
}

function currentWorkspaceUser() {
  return state.users.find(u => u.id === state.currentUserId && u.status === 'Active') ||
         state.users.find(u => u.role === 'Owner / Administrator' && u.status === 'Active') ||
         state.users.find(u => u.status === 'Active') ||
         { name: 'Amina Mwinyi', role: 'Owner / Administrator' };
}

function isWorkspaceAdministrator() {
  return currentWorkspaceUser().role === 'Owner / Administrator';
}

function userCanManageAllBranches() {
  const user = currentWorkspaceUser();
  return user.role === 'Owner / Administrator' || (user.role === 'Manager' && user.crossBranchApproved === true);
}

function accessibleBranches() {
  if (userCanManageAllBranches()) return state.branches.filter(b => b.status !== 'Inactive');
  const assigned = state.branches.find(b => b.id === currentWorkspaceUser().branchId && b.status !== 'Inactive');
  return assigned ? [assigned] : [activeBranch];
}

function snapshotCurrentBranch() {
  if (!activeBranch) return;
  const data = {};
  branchCollections.forEach(k => {
    data[k] = structuredClone(state[k] || []);
  });
  if (!state.branchData) state.branchData = {};
  state.branchData[activeBranch.id] = data;
}

function saveState() {
  snapshotCurrentBranch();
  persistState(state);
  updateConnection();
}

function updateConnection() {
  const offline = !navigator.onLine;
  const dot = document.getElementById('connection-dot');
  const label = document.getElementById('connection-label');
  if (dot) dot.classList.toggle('offline', offline || state.queue.length > 0);
  if (label) {
    label.textContent = state.queue.length
      ? `${state.queue.length} offline sale${state.queue.length === 1 ? '' : 's'} waiting to sync`
      : 'Saved in IndexedDB';
  }
  const count = document.getElementById('order-count');
  if (count) count.textContent = state.orders.filter(o => o.status === 'Draft' || o.status === 'Final').length;
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const button = document.getElementById('theme-toggle');
  if (button) {
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#292b2e' : '#0082cf');
  safeStorageSet(THEME_KEY, dark ? 'dark' : 'light');
}

function refreshUserProfile() {
  const user = currentWorkspaceUser();
  const initials = shortName(user.name || 'User');
  document.querySelectorAll('.profile-button .profile-avatar').forEach(n => n.textContent = initials);
  document.querySelectorAll('.profile-copy strong').forEach(n => n.textContent = user.name || 'User');
  document.querySelectorAll('.profile-copy small').forEach(n => n.textContent = user.role || 'User');
  const avatar = document.querySelector('.topbar-avatar');
  if (avatar) avatar.textContent = initials;
}

function refreshCompanyLogo() {
  const host = document.getElementById('workspace-switch');
  if (!host) return;
  const name = state.companyName || 'Your company';
  host.title = name;
  host.setAttribute('aria-label', name);
  host.innerHTML = `${state.companyLogo
    ? `<img class="company-logo" src="${esc(state.companyLogo)}" alt="">`
    : `<span class="workspace-avatar">${esc(shortName(name) || 'C')}</span>`}
    <span class="workspace-copy"><strong>${esc(name)}</strong><small>${esc(state.branch || 'Main branch')}</small></span>`;
}

function refreshBranchNav() {
  const nav = document.querySelector('.nav-item[data-page="branches"]');
  if (nav) nav.hidden = !canViewPage('branches');
}

function canViewActivity() {
  return userHasPermission('dashboard','business-performance')||userHasPermission('dashboard','stock-alerts');
}

function refreshActivityVisibility() {
  const button = document.getElementById('activity-button');
  if (button) button.hidden = !canViewActivity();
}

function recordActivity(action, details, reference = '') {
  if (!Array.isArray(state.activityLog)) state.activityLog=[];
  state.activityLog.unshift({id:idFor('ACT',state.activityLog),date:new Date().toISOString(),actor:currentWorkspaceUser().name||'User',action,details,reference});
  state.activityLog=state.activityLog.slice(0,300);
}

function notificationItems() {
  const items=[];
  if(userHasPermission('dashboard','stock-alerts')||canViewPage('inventory')){
    const low=state.products.filter(product=>product.status!=='Draft'&&Number(product.stock)<=Number(product.low));
    if(low.length)items.push({icon:'▤',title:`${low.length} low-stock product${low.length===1?'':'s'}`,detail:low.slice(0,3).map(product=>`${product.name} (${product.stock} left)`).join(' · '),page:'inventory',tone:'warning'});
  }
  if(canViewPage('sales')||canViewPage('accounting')){
    const due=state.orders.filter(order=>order.status!=='Draft'&&Number(order.total)>Number(order.paid||0));
    const overdue=due.filter(order=>String(order.due||order.date)<today());
    if(overdue.length)items.push({icon:'◷',title:`${overdue.length} overdue customer balance${overdue.length===1?'':'s'}`,detail:`${money(overdue.reduce((sum,order)=>sum+Math.max(0,order.total-(order.paid||0)),0))} outstanding`,page:'sales',tone:'danger'});
    else if(due.length)items.push({icon:'◷',title:`${due.length} unpaid customer order${due.length===1?'':'s'}`,detail:`${money(due.reduce((sum,order)=>sum+Math.max(0,order.total-(order.paid||0)),0))} outstanding`,page:'sales',tone:'warning'});
  }
  if(canViewPage('purchases')){
    const pending=state.purchases.filter(purchase=>purchase.status==='Pending');
    if(pending.length)items.push({icon:'⇩',title:`${pending.length} purchase order${pending.length===1?'':'s'} awaiting receipt`,detail:'Receive items to update stock.',page:'purchases',tone:'info'});
    const payable=accountOutstandingTotal('Supplier');
    if(payable)items.push({icon:'◈',title:'Supplier balances outstanding',detail:`${money(payable)} payable`,page:canViewPage('accounting')?'accounting':'purchases',tone:'warning'});
  }
  return items;
}

function refreshNotificationIndicator() {
  const button=document.getElementById('notifications-button');
  if(!button)return;
  const count=notificationItems().length;
  button.classList.toggle('has-notifications',count>0);
  button.setAttribute('aria-label',count?`Notifications, ${count} item${count===1?'':'s'}`:'Notifications');
  let badge=button.querySelector('.notification-count');
  if(!badge){badge=document.createElement('span');badge.className='notification-count';button.append(badge);}
  if(badge)badge.textContent=count?String(count):'';
}

function openNotificationsPanel() {
  const button=document.getElementById('notifications-button');
  if(!button)return;
  document.querySelector('.notifications-popover')?.remove();
  const items=notificationItems();
  const panel=document.createElement('section');panel.className='notifications-popover';panel.setAttribute('aria-label','Notifications');
  panel.innerHTML=`<div class="topbar-popover-head"><div><strong>Notifications</strong><small>${items.length?`${items.length} item${items.length===1?'':'s'} need attention`:'You’re all caught up'}</small></div><button type="button" class="topbar-popover-close" aria-label="Close notifications">×</button></div>${items.length?`<div class="notification-list">${items.map((item,index)=>`<button type="button" class="notification-row notification-${item.tone}" data-notification-page="${esc(item.page)}"><span class="notification-row-icon">${item.icon}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><span class="notification-arrow">›</span></button>`).join('')}</div>`:'<div class="notification-empty"><span>✓</span><p>No current alerts.</p></div>'}`;
  document.body.append(panel);
  const rect=button.getBoundingClientRect();
  Object.assign(panel.style,{top:`${Math.min(rect.bottom+8,window.innerHeight-80)}px`,right:`${Math.max(8,window.innerWidth-rect.right)}px`});
  panel.querySelector('.topbar-popover-close').addEventListener('click',()=>panel.remove());
  panel.querySelectorAll('[data-notification-page]').forEach(item=>item.addEventListener('click',()=>{const target=item.dataset.notificationPage;panel.remove();setPage(target);}));
}

function recentActivityItems() {
  const saved=(state.activityLog||[]).map(item=>({id:item.id,date:item.date,actor:item.actor||'User',action:item.action||'Updated records',details:item.details||'',reference:item.reference||''}));
  const fallback=[];
  for(const sale of state.sales)fallback.push({id:`sale-${sale.id}`,date:sale.date,actor:'',action:'Sale recorded',details:`${sale.customer||'Walk-in customer'} · ${money(sale.total||0)}`,reference:sale.id});
  for(const purchase of state.purchases)fallback.push({id:`purchase-${purchase.id}`,date:purchase.date,actor:'',action:'Purchase order recorded',details:`${purchase.supplier||'Supplier'} · ${money(purchase.total||0)}`,reference:purchase.id});
  for(const entry of state.entries)fallback.push({id:`entry-${entry.id}`,date:entry.date,actor:'',action:entry.sourceType?.includes('payment')?'Payment recorded':'Account entry recorded',details:`${entry.partyType||''} · ${entry.party||''} · ${money(entry.amount||0)} · ${entry.memo||''}`,reference:entry.id});
  for(const movement of state.stockMovements)fallback.push({id:`stock-${movement.id}`,date:movement.date,actor:movement.user||'',action:'Stock updated',details:`${movement.product||movement.productId} · ${movement.delta>0?'+':''}${movement.delta}`,reference:movement.id});
  const known=new Set(saved.map(item=>item.reference).filter(Boolean));
  const combined=[...saved,...fallback.filter(item=>!known.has(item.reference))];
  return combined.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,100);
}

function openActivityHistory() {
  if(!canViewActivity()){toast('You do not have permission to view the activity history');return;}
  const items=recentActivityItems();
  const rows=items.map(item=>`<div class="activity-entry"><span class="activity-entry-icon">◷</span><div><strong>${esc(item.action)}</strong><small>${esc(item.details)}${item.reference?` · ${esc(item.reference)}`:''}</small>${item.actor?`<small>By ${esc(item.actor)}</small>`:''}</div><time>${dateLabel(String(item.date||'').slice(0,10))}</time></div>`).join('');
  openModal('Activity history',`${items.length} recent item${items.length===1?'':'s'} · saved actions and transaction history`,items.length?`<div class="activity-list">${rows}</div>`:'<div class="notification-empty"><p>No activity has been recorded yet.</p></div>','Close');
}

document.getElementById('notifications-button')?.addEventListener('click',event=>{
  event.stopPropagation();
  if(document.querySelector('.notifications-popover'))document.querySelector('.notifications-popover').remove();
  else openNotificationsPanel();
});
document.getElementById('activity-button')?.addEventListener('click',openActivityHistory);
document.addEventListener('click',event=>{
  if(!event.target.closest('.notifications-popover')&&!event.target.closest('#notifications-button'))document.querySelector('.notifications-popover')?.remove();
});

function syncBackButton() {
  const button = document.getElementById('back-button');
  if (button) button.disabled = pageHistory.length === 0;
}

function setPage(next) {
  if (!next) return;
  if (next === page) { render(); return; }
  if (!canViewPage(next)) { toast('Your account does not have access to that section'); return; }
  pageHistory.push(page);
  page = next;
  history.pushState({ erpPage: next }, '', `#${next}`);
  tableQuery = '';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === next));
  document.getElementById('sidebar')?.classList.remove('open');
  render();
}

function refreshPermissionVisibility() {
  document.querySelectorAll('.nav-item[data-page]').forEach(nav=>{
    const allowed=canViewPage(nav.dataset.page);
    nav.hidden=!allowed;
  });
  document.querySelectorAll('#page-content [data-action]').forEach(button=>{
    button.hidden=!canPerformAction(button.dataset.action,button);
  });
}

function navigateBack() {
  if (!pageHistory.length) return;
  let previous=pageHistory.pop();
  while(previous&&!canViewPage(previous)&&pageHistory.length)previous=pageHistory.pop();
  if(!previous||!canViewPage(previous)){previous=Object.keys(pageLabels).find(candidate=>canViewPage(candidate));}
  if(!previous)return;
  page = previous;
  history.pushState({ erpPage: page }, '', `#${page}`);
  tableQuery = '';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  render();
}

// Accounting & Entries
function entryBalanceDelta(partyType, type, amount) {
  return partyType === 'Supplier' ? (type === 'Credit' ? -amount : amount) : (type === 'Debit' ? amount : -amount);
}

function accountOutstandingTotal(partyType) {
  const isSupplier = partyType === 'Supplier';
  const accounts = isSupplier ? state.suppliers : state.customers;
  const knownNames = new Set(accounts.map(account => account.name));
  const retainedBalances = new Map();
  for (const entry of state.entries) {
    if (entry.partyType !== partyType || knownNames.has(entry.party)) continue;
    retainedBalances.set(entry.party, (retainedBalances.get(entry.party) || 0) + entryBalanceDelta(partyType, entry.type, Number(entry.amount) || 0));
  }
  const activeTotal = accounts.reduce((sum, account) => sum + Math.max(0, isSupplier ? -(Number(account.balance) || 0) : (Number(account.balance) || 0)), 0);
  const retainedTotal = [...retainedBalances.values()].reduce((sum, balance) => sum + Math.max(0, isSupplier ? -balance : balance), 0);
  return activeTotal + retainedTotal;
}

function postAccountEntry({ partyType, party, date = today(), type, amount, memo, sourceType = '', sourceId = '', relatedId = '' }) {
  const account = (partyType === 'Supplier' ? state.suppliers : state.customers).find(item => item.name === party);
  if (account) account.balance += entryBalanceDelta(partyType, type, amount);
  const entry = { id: idFor('TX', state.entries), partyType, party, date, type, amount, memo, sourceType, sourceId, relatedId };
  state.entries.unshift(entry);
  return entry;
}

function adjustAccountEntry(entry, newAmount) {
  if (!entry) return;
  const delta = newAmount - entry.amount;
  const account = (entry.partyType === 'Supplier' ? state.suppliers : state.customers).find(item => item.name === entry.party);
  if (account) account.balance += entryBalanceDelta(entry.partyType, entry.type, delta);
  entry.amount = newAmount;
}

function removeAccountEntries(predicate) {
  const removed = state.entries.filter(predicate);
  for (const entry of removed) adjustAccountEntry(entry, 0);
  state.entries = state.entries.filter(entry => !predicate(entry));
}

function permanentlyDeleteParty(type, name) {
  const isSupplier = type === 'Supplier';
  const list = isSupplier ? state.suppliers : state.customers;
  const account = list.find(item => item.name === name);
  if (!account) return null;
  list.splice(list.indexOf(account), 1);
  recordActivity(`${type} profile permanently deleted`, `${name} · linked transaction history retained`);
  return true;
}

function erasePartyHistory(type, name) {
  if (type === 'Customer') {
    const directSales = state.sales.filter(sale => sale.customer === name);
    const orderIds = new Set([...state.orders.filter(order => order.customer === name).map(order => order.id), ...directSales.map(sale => sale.orderId).filter(Boolean)]);
    const sales = state.sales.filter(sale => sale.customer === name || orderIds.has(sale.orderId) || orderIds.has(sale.id));
    const saleIds = new Set(sales.map(sale => sale.id));
    const returns = (state.returns || []).filter(record => orderIds.has(record.saleId) || saleIds.has(record.saleId));
    const orders = state.orders.filter(order => orderIds.has(order.id));
    for (const order of orders) {
      const restocked = new Map();
      for (const ret of returns) if (ret.restocked && [order.id, order.invoiceId].includes(ret.saleId)) restocked.set(ret.productId, (restocked.get(ret.productId) || 0) + (Number(ret.qty) || 0));
      for (const line of order.items || []) {
        const product = state.products.find(item => item.id === line.productId);
        const qty = Math.max(0, (Number(line.qty) || 0) - (restocked.get(line.productId) || 0));
        if (product && qty) product.stock += qty;
      }
    }
    for (const sale of sales.filter(item => !orderIds.has(item.orderId) && !orderIds.has(item.id))) for (const line of sale.items || []) {
      const product = state.products.find(item => item.id === line.productId);
      if (product) product.stock += Number(line.qty) || 0;
    }
    state.orders = state.orders.filter(order => !orderIds.has(order.id));
    state.sales = state.sales.filter(sale => !sales.includes(sale));
    state.returns = (state.returns || []).filter(record => !returns.includes(record));
    for (const entry of state.entries) if (Array.isArray(entry.allocations)) entry.allocations = entry.allocations.filter(item => !orderIds.has(item.orderId));
    state.entries = state.entries.filter(entry => entry.partyType !== type || entry.party !== name);
    const removedIds = new Set([...orderIds, ...saleIds]);
    state.stockMovements = state.stockMovements.filter(move => ![...removedIds].some(ref => String(move.reason || '').includes(ref)));
  } else {
    const purchases = state.purchases.filter(purchase => purchase.supplier === name);
    const purchaseIds = new Set(purchases.map(purchase => purchase.id));
    const returns = (state.purchaseReturns || []).filter(record => purchaseIds.has(record.purchaseId) || purchaseIds.has(record.purchaseOrderId));
    for (const purchase of purchases) if (purchase.status === 'Received') {
      const returned = new Map();
      for (const ret of returns) if (ret.purchaseId === purchase.id || ret.purchaseOrderId === purchase.id) returned.set(ret.productId, (returned.get(ret.productId) || 0) + (Number(ret.qty) || 0));
      for (const line of purchase.lines || []) {
        const product = state.products.find(item => item.id === line.productId);
        if (!product) continue;
        product.stock = Math.max(0, product.stock - Math.max(0, (Number(line.qty) || 0) - (returned.get(line.productId) || 0)));
      }
    }
    state.purchases = state.purchases.filter(purchase => !purchaseIds.has(purchase.id));
    state.purchaseReturns = (state.purchaseReturns || []).filter(record => !returns.includes(record));
    state.entries = state.entries.filter(entry => entry.partyType !== type || entry.party !== name);
    state.stockMovements = state.stockMovements.filter(move => ![...purchaseIds].some(ref => String(move.reason || '').includes(ref)));
  }
  state.activityLog = (state.activityLog || []).filter(item => !String(item.details || '').includes(name));
}

function allocateCustomerAccountPayment(entry) {
  if (entry.paymentProcessed || entry.partyType !== 'Customer' || entry.type !== 'Credit') return false;
  let remaining = entry.amount;
  const allocations = [];
  const invoices = state.orders.filter(order => order.customer === entry.party && order.status !== 'Draft' && Number(order.total) > Number(order.paid || 0))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  for (const order of invoices) {
    if (remaining <= 0) break;
    const due = Math.max(0, order.total - (order.paid || 0));
    const amount = Math.min(due, remaining);
    if (!amount) continue;
    order.paid = (order.paid || 0) + amount;
    remaining -= amount;
    allocations.push({ orderId: order.id, amount });
    const invoice = state.sales.find(sale => sale.id === order.invoiceId);
    if (invoice) {
      invoice.paid = order.paid;
      invoice.status = orderPaymentStatus(order);
    }
  }
  entry.allocations = allocations;
  entry.overpayment = remaining;
  entry.paymentProcessed = true;
  if (allocations.length) entry.memo += ` · applied to ${allocations.map(a => a.orderId).join(', ')}`;
  if (remaining > 0) entry.memo += ` · customer credit ${money(remaining)}`;
  return true;
}

function reconcileCustomerAccountPayments() {
  let changed = false;
  for (const entry of state.entries) {
    if (entry.sourceType === 'account-payment' && !entry.paymentProcessed) {
      changed = allocateCustomerAccountPayment(entry) || changed;
    }
  }
  return changed;
}

function orderPaymentStatus(order) {
  const paid = order.paid || 0;
  if (order.status === 'Draft' && paid <= 0) return 'Not invoiced';
  return order.total <= 0 || paid >= order.total ? 'Fully paid' : paid <= 0 ? 'Due' : 'Partially paid';
}

function orderPaymentClass(order) {
  const status = orderPaymentStatus(order);
  return status === 'Fully paid' ? 'paid' : status === 'Due' || status === 'Partially paid' ? 'pending' : '';
}

function ageFinalOrders() {
  let changed = false;
  const now = Date.now();
  for (const order of state.orders) {
    if (order.status === 'Final' && order.finalAt && now - Date.parse(order.finalAt) >= 14 * 24 * 60 * 60 * 1000) {
      order.status = 'Completed';
      order.completedAt = new Date().toISOString();
      changed = true;
    }
  }
  return changed;
}

function heading(title, subtitle, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${esc(state.companyName || 'Your company')} · ${esc(state.branch)}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function openModal(title, subtitle, content, confirmLabel = 'Save', extraAction = '') {
  const modal = document.getElementById('app-modal');
  const form = document.getElementById('modal-content');
  if (!modal || !form) return;
  delete form.dataset.dialogKind;
  delete form.dataset.recordId;
  form.innerHTML = `
    <div class="modal-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button type="button" class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button></div>
    ${content}
    <div class="modal-actions">${extraAction}<button type="button" class="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">${confirmLabel}</button></div>
  `;
  modal.classList.toggle('transaction-modal', /sales order|purchase order|pos sale/i.test(title));
  form.querySelectorAll('[data-action]').forEach(button=>{button.hidden=!canPerformAction(button.dataset.action,button);});
  modal.showModal();
}

function openDeleteChoice(button, title, details, keepLabel = 'Delete, keep records', eraseLabel = 'Delete everything') {
  const modal = document.getElementById('app-modal');
  const form = document.getElementById('modal-content');
  if (!modal || !form) return;
  const attrs = ['data-action', 'data-id', 'data-party-type', 'data-party-name'];
  const copied = attrs.filter(name => button.hasAttribute(name)).map(name => `${name}="${esc(button.getAttribute(name))}"`).join(' ');
  delete form.dataset.dialogKind;
  delete form.dataset.recordId;
  form.innerHTML = `<div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(details)}</p></div><button type="button" class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button></div><div class="delete-choice-note">Choose whether the related records stay available or are permanently erased. This cannot be undone.</div><div class="modal-actions"><button type="button" class="button" data-action="close-modal">Cancel</button><button type="button" class="button" ${copied} data-delete-mode="keep-history">${esc(keepLabel)}</button><button type="button" class="button danger-action" ${copied} data-delete-mode="erase-all">${esc(eraseLabel)}</button></div>`;
  modal.showModal();
}

function inputField(name, label, placeholder = '', type = 'text', required = false, value = '') {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" placeholder="${placeholder}" value="${esc(value)}" ${required ? 'required' : ''}></div>`;
}

function selectField(name, label, options = [], selected = '') {
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${options.map(opt => `<option ${opt === selected ? 'selected' : ''}>${esc(opt)}</option>`).join('')}</select></div>`;
}

// Dashboard Page
function greetingTitle() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Dar_es_Salaam', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (currentWorkspaceUser().name || 'there').trim().split(/\s+/)[0] || 'there';
  return `${greeting}, ${firstName} 👋`;
}

function metric(label, value, icon, foot, trend = 'up') {
  return `<article class="metric-card"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot"><span class="${trend}">${foot.split(' · ')[0]}</span> · ${foot.split(' · ')[1] || ''}</div></article>`;
}

function dashboardSales(range = dashboardRange) {
  const end = today();
  const count = range === 'Today' ? 1 : range === 'This week' ? 7 : 30;
  const startDate = new Date(end + 'T12:00:00Z');
  startDate.setUTCDate(startDate.getUTCDate() - count + 1);
  const start = startDate.toISOString().slice(0, 10);
  return state.sales.filter(s => s.date >= start && s.date <= end);
}

function barChart(range = dashboardRange) {
  const count = range === 'Today' ? 1 : range === 'This week' ? 7 : 30;
  const end = today();
  const endDate = new Date(end + 'T12:00:00Z');
  const days = Array.from({ length: count }, (_, i) => {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - (count - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      date: key,
      label: count > 7 ? String(Number(key.slice(8))) : new Intl.DateTimeFormat('en-TZ', { day: 'numeric', month: 'short', timeZone: 'Africa/Dar_es_Salaam' }).format(d),
      value: state.sales.filter(s => s.date === key).reduce((sum, s) => sum + s.total, 0)
    };
  });
  const max = Math.max(1, ...days.map(d => d.value));
  const ceiling = Math.ceil(max / 50000) * 50000 || 50000;
  const width = Math.min(32, 550 / count * .55);
  const gap = 550 / count;
  const bars = days.map((d, i) => {
    const x = 56 + i * gap + Math.max(0, (gap - width) / 2);
    const h = Math.max(d.value ? 4 : 0, d.value / ceiling * 140);
    const show = count <= 7 || i % 5 === 0 || i === count - 1;
    return `<rect class="chart-bar ${i % 2 ? 'alt' : ''}" x="${x}" y="${166 - h}" width="${width}" height="${h}" rx="4"><title>${esc(d.label)} · ${money(d.value)}</title></rect>${show ? `<text class="chart-label" x="${x - 3}" y="190">${esc(d.label)}</text>` : ''}`;
  }).join('');
  return `<div class="chart-area"><svg viewBox="0 0 620 210" preserveAspectRatio="none" role="img" aria-label="Daily sales"><line class="chart-gridline" x1="55" y1="22" x2="610" y2="22"/><line class="chart-gridline" x1="55" y1="70" x2="610" y2="70"/><line class="chart-gridline" x1="55" y1="118" x2="610" y2="118"/><line class="chart-gridline" x1="55" y1="166" x2="610" y2="166"/><text class="chart-label" x="2" y="25">${Math.round(ceiling / 1000)}k</text><text class="chart-label" x="2" y="73">${Math.round(ceiling * .67 / 1000)}k</text><text class="chart-label" x="2" y="121">${Math.round(ceiling * .34 / 1000)}k</text><text class="chart-label" x="25" y="169">0</text>${bars}</svg></div>`;
}

function paymentMix(range = dashboardRange) {
  const colors = ['#087f9d', '#53b8b8', '#a9dfe0', '#dce8eb', '#c5aa7a'];
  const groups = new Map();
  for (const sale of dashboardSales(range)) {
    const key = sale.method || 'Other';
    groups.set(key, (groups.get(key) || 0) + sale.total);
  }
  const entries = [...groups].filter(([, a]) => a > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = entries.reduce((s, x) => s + x[1], 0);
  let pos = 0;
  const stops = entries.map(([, amt], i) => {
    const start = pos;
    pos += amt / Math.max(1, total) * 100;
    return `${colors[i]} ${start}% ${pos}%`;
  }).join(',');
  const legend = entries.map(([name, amt], i) => `<div><i style="background:${colors[i]}"></i><span>${esc(name)}</span><strong>${Math.round(amt / Math.max(1, total) * 100)}%</strong></div>`).join('');
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops || '#edf2f4 0 100%'});"><div class="donut-center"><strong>${money(total).replace('TZS', '')}</strong><small>sales total</small></div></div><div class="donut-legend">${legend || '<div class="muted">No sales yet</div>'}</div></div>`;
}

function recentSalesTable(rows = state.sales.slice(0, 5)) {
  return `<div class="table-panel"><div class="table-heading"><h2>Recent transactions</h2><button class="text-link" data-page="sales">View all sales →</button></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Reference</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows.map(s => `<tr><td><strong>${esc(s.id)}</strong></td><td>${esc(s.customer)}</td><td>${dateLabel(s.date)}</td><td><strong>${money(s.total)}</strong></td><td><span class="status-pill ${statusClass(s.status)}">${esc(s.status)}</span></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderDashboard() {
  const monthSales = dashboardSales().reduce((sum, s) => sum + s.total, 0);
  const receivable = accountOutstandingTotal('Customer');
  const payable = accountOutstandingTotal('Supplier');
  const low = state.products.filter(p => p.stock <= p.low).length;
  return `
    ${heading(esc(greetingTitle()), 'Here’s what’s happening with your business today.', `
      <select class="select-control" id="dashboard-range">
        <option ${dashboardRange === 'This month' ? 'selected' : ''}>This month</option>
        <option ${dashboardRange === 'This week' ? 'selected' : ''}>This week</option>
        <option ${dashboardRange === 'Today' ? 'selected' : ''}>Today</option>
      </select>
      <button class="button primary" data-action="new-order"><span>＋</span> New sale</button>
    `)}
    <section class="metric-grid">
      ${metric('Total sales', money(monthSales), '↗', `${dashboardRange} · across all channels`)}
      ${metric('Orders', String(state.orders.length + state.sales.length), '▤', 'Orders & POS transactions')}
      ${metric('To collect', money(receivable), '◷', `${state.customers.filter(c => c.balance > 0).length} customers · outstanding`, 'down')}
      ${metric('Stock alerts', String(low), '⚑', low ? `${low} products need attention` : 'All stock levels healthy', low ? 'down' : 'up')}
    </section>
    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">Sales performance</h2><p class="panel-subtitle">Daily sales · ${esc(dashboardRange.toLowerCase())}</p></div><div class="legend"><span><i></i>Sales</span></div></div>
        ${barChart(dashboardRange)}
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">Sales by payment method</h2><p class="panel-subtitle">Share of transaction value · ${esc(dashboardRange.toLowerCase())}</p></div><button class="text-link" data-page="reports">Details</button></div>
        ${paymentMix(dashboardRange)}
      </article>
    </section>
    <section class="recent-grid">
      ${recentSalesTable()}
      <aside class="quick-panel">
        <div class="panel-header"><div><h2 class="panel-title">Quick actions</h2><p class="panel-subtitle">Get the important things done</p></div></div>
        <div class="quick-list">
          <button class="quick-action" data-page="pos"><span class="quick-icon">▦</span><span class="quick-copy"><strong>Open point of sale</strong><small>Start a quick checkout</small></span><span class="quick-arrow">›</span></button>
          <button class="quick-action" data-action="new-order"><span class="quick-icon">↗</span><span class="quick-copy"><strong>Create sales order</strong><small>For a customer or business</small></span><span class="quick-arrow">›</span></button>
          <button class="quick-action" data-action="new-product"><span class="quick-icon">＋</span><span class="quick-copy"><strong>Add a product</strong><small>Update your catalogue</small></span><span class="quick-arrow">›</span></button>
          <button class="quick-action" data-action="record-payment"><span class="quick-icon">◈</span><span class="quick-copy"><strong>Record a payment</strong><small>Customer or supplier account</small></span><span class="quick-arrow">›</span></button>
        </div>
        <div class="inline-note" style="margin-top:14px">${money(payable)} payable to suppliers · ${low} low stock items</div>
      </aside>
    </section>
  `;
}

// Point of Sale (POS)
function compareProductNames(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'en', { sensitivity: 'base', numeric: true });
}

function sortProducts(products) {
  return [...products].sort((a, b) => compareProductNames(a.name, b.name) || compareProductNames(a.id, b.id));
}

function activeProducts() {
  return sortProducts(state.products.filter(p => p.status !== 'Draft'));
}

function productCards(products) {
  return products.map(p => `
    <button class="product-card" data-action="add-cart" data-id="${esc(p.id)}">
      <span class="product-swatch">${esc(p.name.slice(0, 1))}</span>
      <strong>${esc(p.name)}</strong>
      <small>${p.stock} ${esc(p.unit)} in stock</small>
      <span class="product-price">${money(p.price)}<span style="color:#a1adb2">＋</span></span>
    </button>
  `).join('') || `<div class="empty-state">No matching products.</div>`;
}

function cartLines() {
  return posCart.map(line => `
    <div class="cart-line">
      <span class="quick-icon">${esc(line.name.slice(0, 1))}</span>
      <span class="cart-line-copy"><strong>${esc(line.name)}</strong><small>${money(line.price)} each</small></span>
      <span class="qty-control">
        <button data-action="cart-qty" data-id="${esc(line.id)}" data-delta="-1">−</button>
        ${line.qty}
        <button data-action="cart-qty" data-id="${esc(line.id)}" data-delta="1">＋</button>
      </span>
    </div>
  `).join('') || `<div class="empty-state" style="padding:23px">Add a product to begin checkout.</div>`;
}

function renderPOS() {
  const total = posCart.reduce((sum, line) => sum + line.qty * line.price, 0);
  const taxBreakdown = calculateTaxBreakdown(total, state.vatEnabled !== false, state.vatRate || 18);

  return `
    ${heading('Point of sale', posDraftOrderId ? `Editing saved draft ${esc(posDraftOrderId)} · ${esc(state.branch)}` : `Fast checkout · ${esc(state.branch)}`, `
      <span class="status-pill ${navigator.onLine ? 'paid' : 'pending'}">${navigator.onLine ? 'Online' : 'Offline ready'}</span>
      <button class="button" data-action="save-pos-draft" ${posCart.length ? '' : 'disabled'}>Save draft</button>
      <button class="button" data-page="sales">Sales &amp; orders</button>
      <button class="button" data-action="clear-cart">Clear cart</button>
    `)}
    <section class="pos-layout">
      <article class="table-panel">
        <div class="toolbar">
          <div class="toolbar-left">
            <label class="search-box"><input id="pos-search" placeholder="Find a product… (/ to search)" aria-label="Search POS products"></label>
            <select class="select-control" id="pos-category">
              <option value="">All categories</option>
              ${[...new Set(activeProducts().map(p => p.category))].map(c => `<option ${posCategory === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="toolbar-right">
            <span class="muted" style="font-size:10px">${activeProducts().length} active products</span>
          </div>
        </div>
        <div class="product-grid" id="pos-products">
          ${productCards(activeProducts().filter(p => !posCategory || p.category === posCategory))}
        </div>
      </article>
      <aside class="cart-panel panel">
        <div class="panel-header">
          <div><h2 class="panel-title">Current sale</h2><p class="panel-subtitle">${posCart.length} items · ${posDraftOrderId ? 'draft saved locally' : ''}</p></div>
          <span class="quick-icon">▦</span>
        </div>
        <div class="field" style="margin-top:15px">
          <label>Customer</label>
          <select id="pos-customer">
            <option ${posCustomer === 'Walk-in customer' ? 'selected' : ''}>Walk-in customer</option>
            ${state.customers.filter(c => c.status !== 'Inactive' || c.name === state.orders.find(o => o.id === posDraftOrderId)?.customer).map(c => `<option ${posCustomer === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="cart-list" id="pos-cart">${cartLines()}</div>
        ${renderTaxSummaryHTML(taxBreakdown, money)}
        <div class="field">
          <label>Payment method</label>
          <select id="pos-method">
            ${['Cash', 'M-Pesa', 'Bank transfer', 'Card', 'Credit'].map(method => `<option ${posMethod === method ? 'selected' : ''}>${method}</option>`).join('')}
          </select>
        </div>
        <button class="button primary" data-action="complete-pos" ${posCart.length ? '' : 'disabled'}>Complete sale · ${money(total)}</button>
        <p class="panel-subtitle" style="text-align:center;line-height:1.5;margin-top:10px">Changes saved automatically in IndexedDB storage.</p>
      </aside>
    </section>
  `;
}

function addToCart(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  const line = posCart.find(l => l.id === id);
  if (line) line.qty++;
  else posCart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
  render();
}

function savePOSDraft() {
  if (!posCart.length) return;
  const total = posCart.reduce((sum, line) => sum + line.qty * line.price, 0);
  const draftId = posDraftOrderId || idFor('POS-DRAFT', state.orders);
  const items = posCart.map(l => ({ productId: l.id, product: l.name, qty: l.qty, unitPrice: l.price }));
  const existing = state.orders.find(o => o.id === draftId);
  const order = {
    ...(existing || {}),
    id: draftId,
    source: 'POS',
    customer: posCustomer,
    date: today(),
    due: today(),
    subtotal: total,
    discount: 0,
    total,
    status: 'Draft',
    paid: 0,
    posMethod,
    items
  };
  if (existing) {
    state.orders = state.orders.map(o => o.id === draftId ? order : o);
  } else {
    state.orders.unshift(order);
  }
  posDraftOrderId = draftId;
  recordActivity(existing?'POS draft updated':'POS draft saved',`${order.customer} · ${money(total)}`,draftId);
  saveState();
  toast(`Draft ${draftId} saved`);
  render();
}

function completePOS() {
  if (!posCart.length) return;
  const method = document.getElementById('pos-method')?.value || posMethod;
  const customer = document.getElementById('pos-customer')?.value || posCustomer;
  const total = posCart.reduce((sum, line) => sum + line.qty * line.price, 0);
  const existing = state.orders.find(order => order.id === posDraftOrderId && order.source === 'POS' && order.status === 'Draft');
  const creditCustomer=state.customers.find(item=>item.name===customer),creditLimit=Number(creditCustomer?.creditLimit)||0;
  if(method==='Credit'&&creditLimit>0&&(Number(creditCustomer.balance)||0)+total>creditLimit){toast(`Credit limit exceeded for ${customer}`);return;}

  for (const line of posCart) {
    const product = state.products.find(p => p.id === line.id);
    if (product) product.stock = Math.max(0, product.stock - line.qty);
  }

  const saleId = existing?.id || idFor('POS', state.sales);
  const items = posCart.map(l => ({ productId: l.id, product: l.name, qty: l.qty, unitPrice: l.price }));
  const sale = {
    id: saleId, orderId: saleId, customer, date: today(),
    total, method, status: method === 'Credit' ? 'Pending' : 'Paid',
    channel: 'POS', items
  };
  state.sales.unshift(sale);

  const order = {
    ...(existing || {}),
    id: saleId, source: 'POS', customer, date: today(), due: today(),
    subtotal: total, discount: 0, total, status: 'Final',
    finalAt: new Date().toISOString(), paid: method === 'Credit' ? 0 : total,
    posMethod: method, invoiceId: sale.id, items
  };

  if (existing) state.orders = state.orders.map(item => item.id === existing.id ? order : item);
  else state.orders.unshift(order);

  if (customer !== 'Walk-in customer' && state.customers.some(item => item.name === customer)) {
    postAccountEntry({ partyType: 'Customer', party: customer, type: 'Debit', amount: total, memo: `POS sale ${sale.id}`, sourceType: 'sales', sourceId: sale.id, relatedId: sale.id });
    if (method !== 'Credit') {
      postAccountEntry({ partyType: 'Customer', party: customer, type: 'Credit', amount: total, memo: `Payment · ${method} · ${sale.id}`, sourceType: 'sales-payment', sourceId: sale.id, relatedId: sale.id });
    }
  }

  if (!navigator.onLine) state.queue.push(sale.id);
  recordActivity('POS sale completed',`${customer} · ${money(total)} · ${method}`,sale.id);
  posCart = [];
  posDraftOrderId = '';
  posCustomer = 'Walk-in customer';
  posMethod = 'Cash';
  posCategory = '';
  saveState();
  toast(`Sale ${sale.id} completed successfully`);
  render();
}

function resumePOSDraft(id) {
  const draft = state.orders.find(order => order.id === id && order.source === 'POS' && order.status === 'Draft');
  if (!draft) return;
  posDraftOrderId = id;
  posCustomer = draft.customer || 'Walk-in customer';
  posMethod = draft.posMethod || 'Cash';
  posCart = (draft.items || []).map(line => {
    const product = state.products.find(p => p.id === line.productId);
    return product ? { id: product.id, name: product.name, price: line.unitPrice ?? product.price, qty: line.qty } : null;
  }).filter(Boolean);
  posCategory = '';
  setPage('pos');
}

// Sales Orders & Invoice Printing
function salesOrderRows() {
  const linked = new Set(state.orders.map(o => o.invoiceId).filter(Boolean));
  const legacyPOS = state.sales.filter(s => s.channel === 'POS' && !linked.has(s.id) && !state.orders.some(o => o.id === s.id)).map(s => ({
    id: s.id, source: 'POS', customer: s.customer, date: s.date, due: s.date,
    total: s.total, items: s.items || [], status: 'Final',
    finalAt: s.date ? new Date(`${s.date}T12:00:00`).toISOString() : new Date().toISOString(),
    paid: s.status === 'Paid' ? s.total : 0, posMethod: s.method, invoiceId: s.id
  }));
  return [...state.orders, ...legacyPOS];
}

function renderSales() {
  const rows = salesOrderRows().filter(row => (!salesStatusFilter || row.status === salesStatusFilter) && isWithinDateRange(row.date, salesDateFrom, salesDateTo) && `${row.id} ${row.customer} ${row.status} ${row.source || 'Order'}`.toLowerCase().includes(tableQuery.toLowerCase()));
  return `
    ${heading('Sales & orders', 'Manage customer orders, fulfillments, invoices, and payments.', `
      <button class="button" data-page="pos">▦ Point of sale</button>
      <button class="button primary" data-action="new-order">＋ Sales order</button>
    `)}
    <section class="summary-strip">
      <div class="summary-mini"><small>Open orders</small><strong>${state.orders.filter(o => o.status === 'Draft' || o.status === 'Final').length}</strong></div>
      <div class="summary-mini"><small>Unpaid invoices</small><strong>${money(state.sales.filter(s => s.status === 'Pending').reduce((sum, s) => sum + s.total, 0))}</strong></div>
      <div class="summary-mini"><small>Sales this month</small><strong>${money(state.sales.reduce((sum, s) => sum + s.total, 0))}</strong></div>
    </section>
    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="table-search" placeholder="Search orders or customers…" value="${esc(tableQuery)}"></label>
          <select class="select-control" id="sales-status">
            <option value="" ${salesStatusFilter === '' ? 'selected' : ''}>All statuses</option>
            <option ${salesStatusFilter === 'Draft' ? 'selected' : ''}>Draft</option>
            <option ${salesStatusFilter === 'Final' ? 'selected' : ''}>Final</option>
            <option ${salesStatusFilter === 'Edited' ? 'selected' : ''}>Edited</option>
            <option ${salesStatusFilter === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
          ${dateRangeFilter('sales', salesDateFrom, salesDateTo)}
        </div>
        <div class="toolbar-right">
          <button class="button small" data-action="export-sales">↓ Export CSV</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Order date</th><th>Due date</th><th>Total</th><th>Status</th><th>Payment</th><th>Actions</th></tr>
          </thead>
          <tbody id="sales-table-body">${salesRows(rows)}</tbody>
        </table>
      </div>
    </section>
  `;
}

function salesRows(rows) {
  return rows.map(order => {
    const pos = order.source === 'POS';
    const draft = order.status === 'Draft';
    return `
      <tr>
        <td><strong>${esc(order.id)}</strong><small class="row-source">${pos ? 'POS sale' : 'Sales order'}</small></td>
        <td>${esc(order.customer)}</td>
        <td>${dateLabel(order.date)}</td>
        <td>${dateLabel(order.due || order.date)}</td>
        <td><strong>${money(order.total)}</strong></td>
        <td><span class="status-pill ${statusClass(order.status)}">${esc(order.status)}</span></td>
        <td><span class="status-pill ${orderPaymentClass(order)}">${orderPaymentStatus(order)}</span></td>
        <td>
          <details class="order-actions sales-order-actions">
            <summary aria-label="Actions for ${esc(order.id)}" title="Order actions">⋮</summary>
            <div class="order-actions-menu">
              ${draft && pos ? `<button data-action="resume-pos" data-id="${esc(order.id)}">Resume POS sale</button>` : ''}
              <button data-action="edit-order" data-id="${esc(order.id)}">Edit ${pos ? 'sale' : 'order'}</button>
              <button data-action="view-order" data-id="${esc(order.id)}">View ${pos ? 'sale' : 'order'}</button>
              <button data-action="print-order-invoice" data-id="${esc(order.id)}" ${draft && pos ? 'disabled title="Complete the POS sale first"' : ''}>Print invoice</button>
              <button data-action="add-order-payment" data-id="${esc(order.id)}" ${draft ? 'disabled title="Save the order first"' : ''}>Add payment</button>
              <button data-action="manage-order-returns" data-id="${esc(order.id)}" ${draft ? 'disabled title="Save the order first"' : ''}>Manage returns</button>
              <span class="menu-divider"></span>
              <button class="danger-action" data-action="delete-order" data-id="${esc(order.id)}">Delete ${pos ? 'sale' : 'order'}${isWorkspaceAdministrator()&&order.status!=='Draft'?' · admin override':''}</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('') || emptyRow(8, 'No matching sales or orders');
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="empty-state">${msg}</td></tr>`;
}

function ensureOrderInvoice(order) {
  let invoice = state.sales.find(s => s.id === order.invoiceId || s.orderId === order.id);
  if (!invoice) {
    invoice = {
      id: idFor('INV', state.sales),
      orderId: order.id,
      customer: order.customer,
      date: order.date,
      total: order.total,
      paid: order.paid || 0,
      method: order.paymentMethod || order.posMethod || 'Cash',
      channel: order.source === 'POS' ? 'POS' : 'Order',
      status: orderPaymentStatus(order) === 'Fully paid' ? 'Paid' : 'Pending',
      items: order.items || []
    };
    order.invoiceId = invoice.id;
    state.sales.unshift(invoice);
  } else {
    Object.assign(invoice, {
      orderId: order.id,
      customer: order.customer,
      date: order.date,
      total: order.total,
      paid: order.paid || 0,
      method: order.paymentMethod || order.posMethod || 'Cash',
      channel: order.source === 'POS' ? 'POS' : 'Order',
      status: orderPaymentStatus(order) === 'Fully paid' ? 'Paid' : 'Pending',
      items: order.items || [],
      discount: order.discount || 0,
      additionalCharges: order.additionalCharges || 0
    });
  }
  return invoice;
}

function finalizeSalesOrder(order) {
  if (!order || order.source === 'POS') return false;
  const wasDraft = order.status === 'Draft';
  if (wasDraft) {
    for (const line of order.items || []) {
      const product = state.products.find(item => item.id === line.productId);
      if (!product || product.stock < line.qty) {
        toast(`Not enough stock for ${product?.name || 'an item'}`);
        return false;
      }
    }
    for (const line of order.items || []) {
      const product = state.products.find(item => item.id === line.productId);
      const before = product.stock;
      product.stock -= Number(line.qty) || 0;
      state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId: product.id, product: product.name, date: order.date || today(), before, after: product.stock, delta: product.stock - before, reason: `Sales order ${order.id}`, user: currentWorkspaceUser().name });
    }
    order.status = 'Final';
    order.finalAt = new Date().toISOString();
    if (state.customers.some(customer => customer.name === order.customer)) {
      postAccountEntry({ partyType:'Customer', party:order.customer, date:order.date, type:'Debit', amount:order.total, memo:`Sales order · ${order.id}`, sourceType:'order', sourceId:order.id });
      if ((order.paid || 0) > 0) postAccountEntry({ partyType:'Customer', party:order.customer, date:order.date, type:'Credit', amount:order.paid, memo:`Payment · ${order.paymentMethod || 'Cash'} · ${order.id}`, sourceType:'order-payment', sourceId:order.id });
    }
    recordActivity('Sales order finalized', `${order.customer} · ${money(order.total)}`, order.id);
  } else if (order.status === 'Edited') {
    order.status = 'Final';
    order.finalAt = new Date().toISOString();
    recordActivity('Sales order finalized again', `${order.customer} · ${money(order.total)}`, order.id);
  }
  ensureOrderInvoice(order);
  saveState();
  render();
  return true;
}

function printOrderInvoice(order) {
  if (order.status === 'Draft' && order.source === 'POS') {
    toast('Complete the POS sale before printing its invoice');
    return;
  }
  const popup = window.open('', '_blank', 'width=800,height=750');
  if (!popup) {
    toast('Allow pop-ups to print the invoice');
    return;
  }
  if ((order.status === 'Draft' || order.status === 'Edited') && !finalizeSalesOrder(order)) {
    popup.close();
    return;
  }
  const invoice = ensureOrderInvoice(order);
  const rows = (order.items || []).slice().sort((a, b) => {
    const productA = state.products.find(p => p.id === a.productId)?.name || a.product || a.productName || a.productId || 'Product';
    const productB = state.products.find(p => p.id === b.productId)?.name || b.product || b.productName || b.productId || 'Product';
    return compareProductNames(productA, productB) || compareProductNames(a.productId, b.productId);
  }).map(line => {
    const product = state.products.find(p => p.id === line.productId);
    const price = line.unitPrice ?? product?.price ?? 0;
    return `<tr><td>${esc(product?.name || line.product || line.productName || line.productId || 'Product')}</td><td>${line.qty}</td><td>${money(price)}</td><td>${money(price * line.qty)}</td></tr>`;
  }).join('');
  const subtotal = order.subtotal ?? (order.total + (order.discount || 0));
  const paid = Math.max(0, Number(order.paid) || 0);
  const balance = Math.max(0, order.total - paid);
  const priorOrderBalance = state.orders
    .filter(other => other.id !== order.id && other.customer === order.customer && other.status !== 'Draft')
    .reduce((sum, other) => sum + Math.max(0, Number(other.total) - (Number(other.paid) || 0)), 0);
  const customerAccount = state.customers.find(customer => customer.name === order.customer);
  const priorAccountBalance = customerAccount ? Math.max(0, (Number(customerAccount.balance) || 0) - balance) : 0;
  const previousOutstanding = Math.max(priorOrderBalance, priorAccountBalance);
  const totalOutstanding = previousOutstanding + balance;
  const contacts = [state.companyPhone, state.companyEmail].filter(Boolean).map(esc).join(' · ');
  const paymentDetails = String(state.companyPaymentDetails || '').trim();
  const paymentDetailsMarkup = paymentDetails.split(/\r?\n/).map(item => item.trim()).filter(Boolean).map(item => `<div>${esc(item)}</div>`).join('');

  popup.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${esc(invoice.id)}</title>
      <style>
        body{font:14px Arial,sans-serif;color:#172f3b;padding:36px;max-width:820px;margin:auto}
        header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid #087f9d;padding-bottom:20px}
        .company{display:grid;gap:7px;max-width:60%}.company-logo{display:block;max-width:240px;max-height:110px;object-fit:contain;object-position:left center;margin-bottom:4px}
        h1{color:#087f9d;font-size:22px;margin:0}
        .company small{font-size:12px;color:#526973;line-height:1.5}
        table{width:100%;border-collapse:collapse;margin-top:24px}
        th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #dde6e9}
        th{background:#f4f7f8;font-size:12px;color:#526973}
        .summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0 22px}
        .summary-column{min-width:0;padding:4px 0;line-height:1.3}
        .summary-column h2{font-size:11px;color:#087f9d;margin:0 0 4px}
        .summary-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px;padding:2px 0;font-size:10px}
        .summary-row span{color:#526973}.summary-row strong{text-align:right;white-space:nowrap;font-size:10px}
        .summary-row.total{margin-top:5px;padding-top:2px;font-size:11px;font-weight:700}
        .summary-row.total strong{font-size:11px}
        .summary-row.emphasis{font-weight:700}
        .payment-details{margin-top:24px;padding-top:4px;line-height:1.45}
        .payment-details h2{font-size:13px;color:#087f9d;margin:0 0 8px}.payment-detail-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:5px 18px;font-size:11px;color:#526973}
        @media(max-width:620px){.summary-grid{grid-template-columns:1fr;gap:10px}}
        @media print{body{padding:0}}
      </style>
    </head>
    <body>
      <header>
        <div class="company">
          ${state.companyLogo ? `<img class="company-logo" src="${esc(state.companyLogo)}" alt="${esc(state.companyName || 'Company')} logo">` : ''}
          <h1>${esc(state.companyName || 'Your company')}</h1>
          ${state.companyAddress ? `<small>${esc(state.companyAddress)}</small>` : ''}
          ${contacts ? `<small>${contacts}</small>` : ''}
        </div>
        <div style="text-align:right">
          <h2 style="margin:0;color:#087f9d">INVOICE</h2>
          <strong>${esc(invoice.id)}</strong><br>
          <small>Order ${esc(order.id)} · ${dateLabel(invoice.date)}</small>
        </div>
      </header>
      <p style="margin-top:20px"><strong>Billed to:</strong> ${esc(order.customer)}</p>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary-grid">
        <section class="summary-column">
          <h2>Outstanding balances</h2>
          <div class="summary-row"><span>Previous outstanding balance</span><strong>${money(previousOutstanding)}</strong></div>
          <div class="summary-row"><span>Balance due on this invoice</span><strong>${money(balance)}</strong></div>
          <div class="summary-row total"><span>Total outstanding balance</span><strong>${money(totalOutstanding)}</strong></div>
        </section>
        <section class="summary-column">
          <h2>Invoice total</h2>
          <div class="summary-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
          ${order.discount ? `<div class="summary-row"><span>Discount</span><strong>− ${money(order.discount)}</strong></div>` : ''}
          ${order.additionalCharges ? `<div class="summary-row"><span>Additional charges</span><strong>${money(order.additionalCharges)}</strong></div>` : ''}
          <div class="summary-row total"><span>Total amount to be paid</span><strong>${money(order.total)}</strong></div>
          <div class="summary-row emphasis"><span>Amount paid</span><strong>${money(paid)}</strong></div>
        </section>
      </div>
      ${paymentDetailsMarkup ? `<footer class="payment-details"><h2>Payment details</h2><div class="payment-detail-items">${paymentDetailsMarkup}</div></footer>` : ''}
    </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 250);
}

// Inventory
function renderInventory() {
  const rows = inventoryRowsFiltered();
  return `
    ${heading('Inventory', 'Manage product details, save drafts, and track stock movements.', `
      <button class="button" data-action="export-inventory">↓ Export CSV</button>
      <button class="button" data-action="import-products">↑ Upload CSV</button>
      <button class="button" data-action="download-product-template">↓ CSV template</button>
      <button class="button primary" data-action="new-product">＋ Add product</button>
    `)}
    <input id="product-csv-file" type="file" accept=".csv,text/csv" hidden>
    <section class="summary-strip">
      <div class="summary-mini"><small>Total Products</small><strong>${state.products.length}</strong></div>
      <div class="summary-mini"><small>Stock Value (at cost)</small><strong>${money(state.products.reduce((sum, p) => sum + p.stock * p.cost, 0))}</strong></div>
      <div class="summary-mini"><small>Low stock items</small><strong>${state.products.filter(p => p.stock <= p.low && p.status !== 'Draft').length}</strong></div>
    </section>
    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="table-search" placeholder="Search product name, SKU, or category…" value="${esc(tableQuery)}"></label>
          <select class="select-control" id="inventory-filter">
            <option value="">All products</option>
            <option value="low">Low stock</option>
            <option value="healthy">In stock</option>
            <option value="draft">Drafts</option>
            <option value="active">Active</option>
          </select>
        </div>
        <span class="muted" id="inventory-result-count" style="font-size:11px">${rows.length} of ${state.products.length} products</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody id="inventory-table-body">${inventoryRows(rows)}</tbody>
        </table>
      </div>
    </section>
    <section class="panel stock-control-panel">
      <div class="panel-header"><div><h2 class="panel-title">Stock control</h2><p class="panel-subtitle">Count physical quantities or perform bulk adjustments.</p></div></div>
      <div class="stock-control-actions">
        <button class="stock-control-card" data-action="bulk-stocktake"><span class="quick-icon">▤</span><span><strong>Stock take</strong><small>Enter physical counts and record variances</small></span><b>›</b></button>
        <button class="stock-control-card" data-action="bulk-stock-adjust"><span class="quick-icon">±</span><span><strong>Bulk adjustment</strong><small>Set updated stock quantities for multiple products</small></span><b>›</b></button>
      </div>
    </section>
  `;
}

function inventoryRowsFiltered() {
  const term = tableQuery.toLowerCase();
  const filter = document.getElementById('inventory-filter')?.value || '';
  return state.products.filter(p => {
    const matches = `${p.id} ${p.name} ${p.category} ${p.unit} ${p.status || 'Active'}`.toLowerCase().includes(term);
    if (!matches) return false;
    if (filter === 'low') return p.stock <= p.low && p.status !== 'Draft';
    if (filter === 'healthy') return p.stock > p.low && p.status !== 'Draft';
    if (filter === 'draft') return p.status === 'Draft';
    if (filter === 'active') return p.status !== 'Draft';
    return true;
  });
}

function inventoryRows(rows) {
  return sortProducts(rows).map(p => {
    const draft = p.status === 'Draft';
    return `
      <tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.id)}</td>
        <td>${esc(p.category)}</td>
        <td>${money(p.price)}</td>
        <td>${money(p.cost)}</td>
        <td><strong>${p.stock} ${esc(p.unit)}</strong></td>
        <td>${draft ? '<span class="status-pill draft">Draft</span>' : `<span class="status-pill ${p.stock <= p.low ? 'low' : 'paid'}">${p.stock <= p.low ? 'Low stock' : 'Active'}</span>`}</td>
        <td>
          <details class="order-actions inventory-actions">
            <summary aria-label="Actions for ${esc(p.name)}" title="Product actions">⋮</summary>
            <div class="order-actions-menu inventory-actions-menu">
              <button data-action="edit-product" data-id="${esc(p.id)}">Edit product</button>
              <button data-action="adjust-stock" data-id="${esc(p.id)}">Adjust stock</button>
              <button data-action="product-stock-history" data-id="${esc(p.id)}">Stock history</button>
              <div class="menu-divider"></div>
              <button class="danger-action" data-action="delete-product" data-id="${esc(p.id)}">Delete product</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('') || emptyRow(8, 'No matching products');
}

function deleteProduct(id, button = null) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  if (!button?.dataset?.deleteMode) {
    if (button) {
      const orders = state.orders.filter(order => (order.items || []).some(line => line.productId === id)).length;
      const sales = state.sales.filter(sale => (sale.items || []).some(line => line.productId === id)).length;
      const purchases = state.purchases.filter(purchase => (purchase.lines || []).some(line => line.productId === id)).length;
      openDeleteChoice(button, `Delete product ${product.name}?`, `Keep its history (${orders} sales orders, ${sales} sales records, ${purchases} purchase orders), or permanently erase every linked transaction and its account impact.`, 'Delete product, keep history', 'Erase related transactions');
    }
    return;
  }
  const mode = button.dataset.deleteMode;
  if (mode === 'erase-all') eraseProductHistory(id);
  for (const record of [...state.orders, ...state.sales]) {
    for (const line of record.items || []) {
      if (line.productId === id && !line.product && !line.productName) line.product = product.name;
    }
  }
  for (const purchase of state.purchases) {
    for (const line of purchase.lines || []) {
      if (line.productId === id && !line.product && !line.productName) line.product = product.name;
    }
  }
  state.products = state.products.filter(p => p.id !== id);
  if (mode === 'erase-all') state.activityLog = (state.activityLog || []).filter(item => item.reference !== id && !String(item.details || '').includes(product.name));
  recordActivity('Product deleted', mode === 'erase-all' ? `${product.name} · related records erased` : `${product.name} · previous records retained`, id);
  saveState();
  render();
  toast(mode === 'erase-all' ? 'Product and related transactions permanently erased' : 'Product deleted from the catalog; previous records were kept');
}

function eraseProductHistory(productId) {
  const orders = state.orders.filter(order => (order.items || []).some(line => line.productId === productId));
  const orderIds = new Set(orders.map(order => order.id));
  const sales = state.sales.filter(sale => (sale.items || []).some(line => line.productId === productId) || orderIds.has(sale.orderId) || orders.some(order => order.invoiceId === sale.id));
  const saleIds = new Set(sales.map(sale => sale.id));
  const saleReturns = (state.returns || []).filter(record => orderIds.has(record.saleId) || saleIds.has(record.saleId));
  for (const order of orders) {
    const restocked = new Map();
    for (const ret of saleReturns) if (ret.restocked && [order.id, order.invoiceId].includes(ret.saleId)) restocked.set(ret.productId, (restocked.get(ret.productId) || 0) + (Number(ret.qty) || 0));
    for (const line of order.items || []) {
      const product = state.products.find(item => item.id === line.productId);
      const qty = Math.max(0, (Number(line.qty) || 0) - (restocked.get(line.productId) || 0));
      if (product && qty) product.stock += qty;
    }
  }
  for (const sale of sales.filter(item => !orderIds.has(item.orderId) && !orderIds.has(item.id))) for (const line of sale.items || []) {
    const product = state.products.find(item => item.id === line.productId);
    if (product) product.stock += Number(line.qty) || 0;
  }
  const purchases = state.purchases.filter(purchase => (purchase.lines || []).some(line => line.productId === productId));
  const purchaseIds = new Set(purchases.map(purchase => purchase.id));
  const purchaseReturns = (state.purchaseReturns || []).filter(record => purchaseIds.has(record.purchaseId) || purchaseIds.has(record.purchaseOrderId));
  for (const purchase of purchases) if (purchase.status === 'Received') {
    const returned = new Map();
    for (const ret of purchaseReturns) if (ret.purchaseId === purchase.id || ret.purchaseOrderId === purchase.id) returned.set(ret.productId, (returned.get(ret.productId) || 0) + (Number(ret.qty) || 0));
    for (const line of purchase.lines || []) {
      const product = state.products.find(item => item.id === line.productId);
      const qty = Math.max(0, (Number(line.qty) || 0) - (returned.get(line.productId) || 0));
      if (product && qty) product.stock = Math.max(0, product.stock - qty);
    }
  }
  const removedOrderIds = new Set([...orderIds, ...sales.map(sale => sale.orderId).filter(Boolean)]);
  const removedSaleIds = new Set([...saleIds, ...orders.map(order => order.invoiceId).filter(Boolean)]);
  state.orders = state.orders.filter(order => !orderIds.has(order.id));
  state.sales = state.sales.filter(sale => !sales.includes(sale));
  state.returns = (state.returns || []).filter(record => !saleReturns.includes(record));
  state.purchases = state.purchases.filter(purchase => !purchaseIds.has(purchase.id));
  state.purchaseReturns = (state.purchaseReturns || []).filter(record => !purchaseReturns.includes(record));
  const directRefs = new Set([...removedOrderIds, ...removedSaleIds, ...purchaseIds]);
  removeAccountEntries(entry => directRefs.has(entry.sourceId) && ['order','order-payment','sales','sales-payment','purchase','purchase-payment'].includes(entry.sourceType));
  state.entries = state.entries.filter(entry => {
    if (entry.sourceType === 'account-payment' && Array.isArray(entry.allocations)) {
      const removedAmount = entry.allocations.filter(allocation => removedOrderIds.has(allocation.orderId)).reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0);
      if (removedAmount) { adjustAccountEntry(entry, Math.max(0, Number(entry.amount) - removedAmount)); entry.allocations = entry.allocations.filter(allocation => !removedOrderIds.has(allocation.orderId)); }
    }
    return true;
  });
  const refs = new Set([...directRefs, ...removedSaleIds]);
  state.stockMovements = state.stockMovements.filter(move => ![...refs].some(ref => String(move.reason || '').includes(ref)));
}

// Purchases
function renderPurchases() {
  const due = state.purchases.filter(p => p.status !== 'Draft').reduce((sum, p) => sum + Math.max(0, p.total - (p.paid || 0) - (p.returned || 0)), 0);
  const rows = state.purchases.filter(p => (!purchaseStatusFilter || p.status === purchaseStatusFilter) && isWithinDateRange(p.date, purchaseDateFrom, purchaseDateTo)).map(p => {
    const net = Math.max(0, p.total - (p.returned || 0));
    const paymentStatus = (p.paid || 0) >= net ? 'Fully paid' : p.paid ? 'Partially paid' : 'Due';
    const status = p.status === 'Pending' ? 'Final' : p.status;
    return `
      <tr>
        <td><strong>${esc(p.id)}</strong></td>
        <td>${esc(p.supplier)}</td>
        <td>${dateLabel(p.date)}</td>
        <td>${(p.lines || []).reduce((sum, l) => sum + l.qty, 0)} units</td>
        <td><strong>${money(p.total)}</strong></td>
        <td><span class="status-pill ${statusClass(paymentStatus)}">${paymentStatus}</span></td>
        <td><span class="status-pill ${statusClass(status)}">${esc(status)}</span></td>
        <td>
          <details class="order-actions purchase-actions">
            <summary aria-label="Actions for ${esc(p.id)}">⋮</summary>
            <div class="order-actions-menu">
              <button data-action="edit-purchase" data-id="${esc(p.id)}">Edit purchase order</button>
              ${p.status === 'Pending' ? `<button data-action="receive-purchase" data-id="${esc(p.id)}">Receive stock</button>` : ''}
              ${p.status === 'Received' && (p.paid || 0) < net ? `<button data-action="purchase-payment" data-id="${esc(p.id)}">Add payment</button>` : ''}
              <button class="danger-action" data-action="delete-purchase" data-id="${esc(p.id)}">Delete purchase${isWorkspaceAdministrator()&&p.status==='Received'?' · admin override':''}</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('') || emptyRow(8, 'No purchase orders yet');

  return `
    ${heading('Purchases', 'Create supplier orders, receive stock, and track supplier bills.', `
      <button class="button primary" data-action="new-purchase">＋ Purchase order</button>
    `)}
    <section class="summary-strip">
      <div class="summary-mini"><small>Open purchases</small><strong>${state.purchases.filter(p => p.status === 'Pending').length}</strong></div>
      <div class="summary-mini"><small>Supplier debt due</small><strong>${money(due)}</strong></div>
      <div class="summary-mini"><small>Received</small><strong>${state.purchases.filter(p => p.status === 'Received').length}</strong></div>
    </section>
    <section class="table-panel">
      <div class="toolbar"><div class="toolbar-left"><h2>Purchase orders</h2><select class="select-control" id="purchase-status"><option value="" ${purchaseStatusFilter === '' ? 'selected' : ''}>All statuses</option><option value="Draft" ${purchaseStatusFilter === 'Draft' ? 'selected' : ''}>Draft</option><option value="Pending" ${purchaseStatusFilter === 'Pending' ? 'selected' : ''}>Final</option><option value="Received" ${purchaseStatusFilter === 'Received' ? 'selected' : ''}>Received</option></select>${dateRangeFilter('purchase', purchaseDateFrom, purchaseDateTo)}</div></div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Reference</th><th>Supplier</th><th>Date</th><th>Units</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
  `;
}

// Customers & Suppliers
function renderParties(type) {
  const isSupplier = type === 'suppliers';
  const list = isSupplier ? state.suppliers : state.customers;
  const label = isSupplier ? 'Suppliers' : 'Customers';
  const balanceLabel = isSupplier ? 'Total Payables' : 'Total Receivables';
  const totalBalance = list.reduce((s, item) => s + Math.max(0, isSupplier ? -item.balance : item.balance), 0);
  const partyType = isSupplier ? 'Supplier' : 'Customer';

  const rows = list.map(item => {
    const balance = Number(item.balance) || 0;
    const outstanding = isSupplier ? balance < 0 : balance > 0;
    const overpaid = isSupplier ? balance > 0 : balance < 0;
    const paymentStatus = outstanding ? 'Outstanding' : overpaid ? 'Overpaid / credit' : 'Settled';
    const paymentClass = outstanding ? 'pending' : 'paid';
    const canEdit = userHasPermission(isSupplier ? 'suppliers' : 'customers', 'edit');
    const canHistory = userHasPermission(isSupplier ? 'suppliers' : 'customers', 'order-history');
    const canActivate = userHasPermission(isSupplier ? 'suppliers' : 'customers', 'activate');
    return `
    <tr>
      <td><strong>${esc(item.name)}</strong><small>${esc(item.id)}</small></td>
      <td>${esc(item.phone || item.contactPerson || '—')}</td>
      <td>${esc(item.email || '—')}</td>
      ${isSupplier ? '' : `<td>${Number(item.creditLimit)>0?money(item.creditLimit):'—'}</td>`}
      <td>
        <strong>${money(Math.abs(balance))}</strong>
      </td>
      <td><span class="status-pill ${paymentClass}">${paymentStatus}</span></td>
      <td><span class="status-pill ${item.status === 'Inactive' ? 'critical' : 'paid'}">${esc(item.status || 'Active')}</span></td>
      <td>
        <details class="order-actions party-actions">
          <summary aria-label="Actions for ${esc(item.name)}" title="Account actions">⋮</summary>
          <div class="order-actions-menu party-actions-menu">
            ${canEdit ? `<button data-action="edit-party" data-party-type="${partyType}" data-party-name="${esc(item.name)}">Edit</button>` : ''}
            ${canHistory ? `<button data-action="view-party-orders" data-party-type="${partyType}" data-party-name="${esc(item.name)}">Past ${isSupplier ? 'purchase orders' : 'orders'}</button>` : ''}
            <button data-action="record-payment" data-party-type="${partyType}" data-party-name="${esc(item.name)}">Record payment</button>
            ${canActivate ? `<button data-action="toggle-party" data-party-type="${partyType}" data-party-name="${esc(item.name)}">${item.status === 'Inactive' ? 'Activate' : 'Deactivate'}</button>` : ''}
            ${isWorkspaceAdministrator() ? `<span class="menu-divider"></span><button class="danger-action" data-action="delete-party" data-party-type="${partyType}" data-party-name="${esc(item.name)}">Delete permanently</button>` : ''}
          </div>
        </details>
      </td>
    </tr>
    `;
  }).join('') || emptyRow(isSupplier ? 7 : 8, `No ${label.toLowerCase()} yet`);

  return `
    ${heading(label, `Manage ${label.toLowerCase()} and view outstanding ledger balances.`, `
      <button class="button" data-action="export-parties" data-party-type="${isSupplier ? 'Supplier' : 'Customer'}">↓ Export CSV</button>
      <button class="button primary" data-action="new-party" data-party-type="${isSupplier ? 'Supplier' : 'Customer'}">＋ Add ${isSupplier ? 'supplier' : 'customer'}</button>
    `)}
    <section class="summary-strip">
      <div class="summary-mini"><small>Total ${label}</small><strong>${list.length}</strong></div>
      <div class="summary-mini"><small>${balanceLabel}</small><strong>${money(totalBalance)}</strong></div>
      <div class="summary-mini"><small>Active accounts</small><strong>${list.filter(i => i.status !== 'Inactive').length}</strong></div>
    </section>
    <section class="table-panel">
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Account Name</th><th>Phone / Contact</th><th>Email</th>${isSupplier?'':'<th>Credit limit</th>'}<th>Balance</th><th>Payment status</th><th>Account status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
  `;
}

// Users Page
function renderUsers() {
  const visibleUsers = state.users.filter(u => !u.isBootstrap);
  const rows = visibleUsers.map(user => {
    const full = user.role === 'Owner / Administrator';
    const permissions=effectiveUserPermissions(user);
    const granted=userActionPermissions.filter(group=>(permissions[group.module]||[]).includes('view')).map(group=>pageLabels[group.module]||group.module);
    const accessLabel=full?'Administrator override':granted.length?granted.join(', '):'No sections enabled';
    return `
      <tr>
        <td><strong>${esc(user.name)}</strong><small>${esc(user.id)}</small></td>
        <td>${esc(user.email || '—')}<small>${esc(user.phone || '')}</small></td>
        <td><strong>${esc(user.role)}</strong></td>
        <td class="user-access-summary">${esc(accessLabel)}<small>${full?'Permissions are always enabled for the Owner / Administrator':`${Object.values(permissions).reduce((sum,actions)=>sum+actions.length,0)} actions granted`}</small></td>
        <td><span class="status-pill ${user.status === 'Active' ? 'paid' : 'pending'}">${esc(user.status || 'Active')}</span></td>
        <td>
          ${!full&&isWorkspaceAdministrator()?`<button class="button small" data-action="edit-user-permissions" data-id="${esc(user.id)}">Permissions</button>`:''}
          ${!user.isBootstrap&&canPerformAction('toggle-user')?`<button class="button small" data-action="toggle-user" data-id="${esc(user.id)}">${user.status === 'Active' ? 'Deactivate' : 'Activate'}</button>`:''}
          ${!full&&!user.isBootstrap&&isWorkspaceAdministrator()?`<button class="button small danger-action" data-action="delete-user" data-id="${esc(user.id)}">Delete user</button>`:''}
        </td>
      </tr>
    `;
  }).join('') || emptyRow(6, 'No users added yet');

  return `
    ${heading('Users', 'Manage workspace team members, roles, and access credentials.', `
      ${canPerformAction('new-user')?'<button class="button primary" data-action="new-user">＋ Add user</button>':''}
    `)}
    <section class="table-panel">
      <div class="table-scroll"><table class="data-table"><thead><tr><th>User</th><th>Email / Phone</th><th>Role</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
  `;
}

function openUserPermissionsForm(user) {
  if(!isWorkspaceAdministrator()){toast('Only an Owner / Administrator can override user permissions');return;}
  if(!user||isAdministratorUser(user)){toast('The Owner / Administrator always has full access');return;}
  const selected=effectiveUserPermissions(user);
  const groups=userActionPermissions.map(group=>{
    const granted=selected[group.module]||[];
    const all=group.actions.length>0&&granted.length===group.actions.length;
    return `<fieldset class="user-permission-group"><legend><label class="user-permission"><input type="checkbox" data-permission-module="${esc(group.module)}" ${all?'checked':''}><span>${esc(pageLabels[group.module]||group.module)} · enable all</span></label></legend><div class="user-subpermission-grid">${group.actions.map(([action,label])=>`<label class="user-subpermission"><input type="checkbox" name="user-permission" value="${esc(group.module)}|${esc(action)}" ${granted.includes(action)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;
  }).join('');
  openDialog('edit-user-permissions',`Access for ${esc(user.name)}`,'Choose exactly which sections and actions this user can access. Owner / Administrator accounts always retain full access.',`<div class="inline-note user-permission-note">Role: <strong>${esc(user.role)}</strong>. These choices apply only to this user and can be changed again at any time.</div><div class="user-permission-grid">${groups}</div>`,'Save permissions');
  const form=document.getElementById('modal-content');form.dataset.recordId=user.id;
  form.querySelectorAll('[data-permission-module]').forEach(parent=>{
    const children=[...parent.closest('fieldset').querySelectorAll('input[name="user-permission"]')];
    const checked=children.filter(child=>child.checked).length;
    parent.indeterminate=checked>0&&checked<children.length;
  });
}

// Branches Page
function renderBranches() {
  const admin = isWorkspaceAdministrator();
  const allowed = new Set(accessibleBranches().map(b => b.id));
  const cards = state.branches.filter(b => b.status !== 'Inactive').map(b => {
    const active = b.id === activeBranch.id;
    return `
      <article class="branch-card">
        <div class="branch-card-top"><span class="branch-symbol">▦</span><span class="status-pill ${active ? 'paid' : 'pending'}">${active ? 'Current' : 'Active'}</span></div>
        <h2>${esc(b.name)}</h2>
        <p>${esc(b.id)}</p>
        <div class="branch-actions">
          ${allowed.has(b.id) ? (active ? '<button class="button" disabled>Current workspace</button>' : `<button class="button primary" data-action="open-branch" data-id="${esc(b.id)}">Open workspace</button>`) : '<span class="muted">Access restricted</span>'}
        </div>
      </article>
    `;
  }).join('');

  return `
    ${heading('Branches', 'Independent workspaces and isolated records for each location.', admin ? '<button class="button primary" data-action="new-branch">＋ Add branch</button>' : '')}
    <div class="inline-note branch-access-note">${userCanManageAllBranches() ? 'You can access all business branch workspaces.' : 'You are restricted to your assigned home branch.'}</div>
    <section class="branch-grid">${cards}</section>
  `;
}

// Accounting & Reports Page
function renderAccounting() {
  const receivables=accountOutstandingTotal('Customer');
  const payables=accountOutstandingTotal('Supplier');
  const renderAccounts=(partyType,accounts)=>accounts.length?accounts.map(account=>{
    const balance=Number(account.balance)||0;
    const amount=partyType==='Customer'?Math.abs(balance):Math.abs(balance);
    const label=partyType==='Customer'?(balance<0?'Customer credit':'Receivable'):(balance<0?'Payable':'Supplier credit');
    const status=balance===0?'Settled':partyType==='Customer'?(balance>0?'Receivable':'Credit balance'):(balance<0?'Payable':'Credit balance');
    return `<article class="accounting-account-card"><div class="accounting-account-head"><div><span class="eyebrow">${esc(partyType)} account</span><h3>${esc(account.name)}</h3><small>${esc(account.id)}${account.phone?` · ${esc(account.phone)}`:''}</small></div><span class="status-pill ${balance===0?'paid':'pending'}">${status}</span></div><div class="accounting-account-balance"><small>${label}</small><strong>${money(amount)}</strong></div><div class="accounting-account-actions"><button class="button small" data-action="view-account-ledger" data-party-type="${partyType}" data-party-name="${esc(account.name)}">View transactions</button><button class="button small" data-action="record-payment" data-party-type="${partyType}" data-party-name="${esc(account.name)}">Add payment</button><button class="button small" data-action="reconcile-account" data-party-type="${partyType}" data-party-name="${esc(account.name)}">Reconcile</button></div></article>`;
  }).join(''):`<div class="inline-note">No ${partyType.toLowerCase()} accounts yet.</div>`;

  return `
    ${heading('Accounting & Ledger', 'Manage each customer and supplier account separately, review its activity, record payments, or reconcile its balance.', `<button class="button" data-action="export-ledger">↓ Export Ledger CSV</button>`)}
    <section class="summary-strip"><div class="summary-mini"><small>Customer receivables</small><strong>${money(receivables)}</strong></div><div class="summary-mini"><small>Supplier payables</small><strong>${money(payables)}</strong></div><div class="summary-mini"><small>Ledger entries</small><strong>${state.entries.length}</strong></div></section>
    <section class="accounting-account-section"><div class="panel-header"><div><h2 class="panel-title">Customer accounts</h2><p class="panel-subtitle">Receivables, customer payments, and individual account histories.</p></div></div><div class="accounting-account-grid">${renderAccounts('Customer',state.customers)}</div></section>
    <section class="accounting-account-section"><div class="panel-header"><div><h2 class="panel-title">Supplier accounts</h2><p class="panel-subtitle">Payables, supplier payments, and individual account histories.</p></div></div><div class="accounting-account-grid">${renderAccounts('Supplier',state.suppliers)}</div></section>
  `;
}

const reportColors = ['#087f9d','#ff8c42','#8b5cf6','#20a779','#e34f7a','#e8b323','#3b82f6','#17b8a6'];

function reportDateRange(period = reportPeriod) {
  const end = today(), cursor = new Date(`${end}T12:00:00Z`);
  let startDate, endDate, label;
  if (period === 'weekly') {
    const mondayOffset=(cursor.getUTCDay()+6)%7;
    startDate=new Date(cursor);startDate.setUTCDate(cursor.getUTCDate()-mondayOffset);
    endDate=new Date(startDate);endDate.setUTCDate(startDate.getUTCDate()+6);
    label='Weekly report';
  } else if (period === 'annual') {
    startDate=new Date(Date.UTC(cursor.getUTCFullYear(),0,1,12));endDate=new Date(Date.UTC(cursor.getUTCFullYear(),11,31,12));
    label=`Annual report · ${cursor.getUTCFullYear()}`;
  } else {
    startDate=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth(),1,12));endDate=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,0,12));
    label='Monthly report';
  }
  const iso=date=>date.toISOString().slice(0,10);
  return { start:iso(startDate), end:iso(endDate), label };
}

function reportPeriodData() {
  const range=reportDateRange();
  const sales=state.sales.filter(sale=>sale.date>=range.start&&sale.date<=range.end);
  const purchases=state.purchases.filter(purchase=>purchase.date>=range.start&&purchase.date<=range.end);
  const salesTotal=sales.reduce((sum,sale)=>sum+(Number(sale.total)||0),0);
  const purchaseTotal=purchases.reduce((sum,purchase)=>sum+(Number(purchase.total)||0),0);
  const paymentSources=new Set(['account-payment','order-payment','sales-payment','purchase-payment']);
  const periodPayments=state.entries.filter(entry=>paymentSources.has(entry.sourceType)&&entry.date>=range.start&&entry.date<=range.end);
  const customerReceipts=periodPayments.filter(entry=>entry.partyType==='Customer'&&entry.type==='Credit');
  const supplierPayments=periodPayments.filter(entry=>entry.partyType==='Supplier'&&entry.type==='Debit');
  const collected=customerReceipts.length?customerReceipts.reduce((sum,entry)=>sum+(Number(entry.amount)||0),0):sales.reduce((sum,sale)=>sum+(Number.isFinite(Number(sale.paid))?Number(sale.paid):(sale.status==='Paid'?Number(sale.total)||0:0)),0);
  const supplierPaid=supplierPayments.length?supplierPayments.reduce((sum,entry)=>sum+(Number(entry.amount)||0),0):purchases.reduce((sum,purchase)=>sum+(Number(purchase.paid)||0),0);
  const hasTransactionHistory=state.sales.length>0||state.purchases.length>0;
  const netCollected=hasTransactionHistory?collected-supplierPaid:0;
  return {...range,sales,purchases,salesTotal,purchaseTotal,collected,supplierPaid,netCollected};
}

function reportBuckets(data) {
  if(reportPeriod==='weekly'){
    const start=new Date(`${data.start}T12:00:00Z`);
    return Array.from({length:7},(_,index)=>{const date=new Date(start);date.setUTCDate(start.getUTCDate()+index);return {key:date.toISOString().slice(0,10),label:new Intl.DateTimeFormat('en-TZ',{weekday:'short',timeZone:'Africa/Dar_es_Salaam'}).format(date)}});
  }
  if(reportPeriod==='annual')return Array.from({length:12},(_,month)=>({key:String(month+1).padStart(2,'0'),label:new Intl.DateTimeFormat('en-TZ',{month:'short',timeZone:'Africa/Dar_es_Salaam'}).format(new Date(Date.UTC(2025,month,15,12)))}));
  return Array.from({length:5},(_,week)=>({key:String(week),label:`Week ${week+1}`}));
}

function renderFinancialBarChart(data) {
  const buckets=reportBuckets(data),values=buckets.map(bucket=>{
    const getIndex=date=>reportPeriod==='weekly'?date:reportPeriod==='annual'?date.slice(5,7):String(Math.floor((Number(date.slice(8,10))-1)/7));
    return {...bucket,sales:data.sales.filter(sale=>getIndex(sale.date)===bucket.key).reduce((sum,sale)=>sum+(Number(sale.total)||0),0),purchases:data.purchases.filter(purchase=>getIndex(purchase.date)===bucket.key).reduce((sum,purchase)=>sum+(Number(purchase.total)||0),0)};
  });
  const max=Math.max(1,...values.flatMap(item=>[item.sales,item.purchases]));
  const ceiling=Math.ceil(max/1000)*1000||1000,plotTop=22,plotBottom=204,plotHeight=plotBottom-plotTop,left=58,width=650,gap=width/values.length,barWidth=Math.min(22,gap*.27);
  const guides=[0,.25,.5,.75,1].map(f=>{const y=plotBottom-plotHeight*f;return `<line x1="${left}" y1="${y}" x2="${left+width}" y2="${y}" class="report-gridline"/><text x="${left-8}" y="${y+4}" text-anchor="end" class="report-axis-label">${Math.round(ceiling*f/1000)}k</text>`}).join('');
  const bars=values.map((item,index)=>{const center=left+gap*index+gap/2,salesHeight=item.sales/max*plotHeight,purchaseHeight=item.purchases/max*plotHeight;return `<rect x="${center-barWidth-2}" y="${plotBottom-salesHeight}" width="${barWidth}" height="${Math.max(item.sales?2:0,salesHeight)}" rx="4" fill="#087f9d"><title>${esc(item.label)} sales · ${money(item.sales)}</title></rect><rect x="${center+2}" y="${plotBottom-purchaseHeight}" width="${barWidth}" height="${Math.max(item.purchases?2:0,purchaseHeight)}" rx="4" fill="#ff8c42"><title>${esc(item.label)} purchases · ${money(item.purchases)}</title></rect><text x="${center}" y="228" text-anchor="middle" class="report-axis-label">${esc(item.label)}</text>`}).join('');
  return `<div class="report-chart-scroll"><svg class="financial-bar-chart" viewBox="0 0 740 245" role="img" aria-label="Sales and purchases comparison">${guides}${bars}</svg></div>`;
}

function reportPieCard(title,subtitle,entries,centerLabel) {
  const sorted=entries.filter(([,amount])=>Number(amount)>0).sort((a,b)=>b[1]-a[1]);
  const shown=sorted.slice(0,6),other=sorted.slice(6).reduce((sum,item)=>sum+item[1],0);
  if(other>0)shown.push(['Other',other]);
  const total=shown.reduce((sum,item)=>sum+item[1],0);
  let angle=0;
  const stops=shown.map(([name,amount],index)=>{const start=angle;angle+=amount/Math.max(total,1)*100;return `${reportColors[index%reportColors.length]} ${start}% ${angle}%`}).join(',');
  const legend=shown.map(([name,amount],index)=>`<div class="report-pie-legend-item"><i style="--slice-color:${reportColors[index%reportColors.length]}"></i><span>${esc(name)}</span><strong>${money(amount)}</strong></div>`).join('')||'<div class="muted">No transactions in this period</div>';
  const compactTotal=new Intl.NumberFormat('en-TZ',{notation:'compact',maximumFractionDigits:1}).format(total);
  return `<article class="report-pie-card"><div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><div class="report-pie-layout"><div class="report-pie" style="background:conic-gradient(${stops||'#e7edf0 0 100%'})"><div><strong>${esc(compactTotal)}</strong><small>${esc(centerLabel)}</small></div></div><div class="report-pie-legend">${legend}</div></div></article>`;
}

function renderReports() {
  const data=reportPeriodData();
  const paymentGroups=new Map();
  data.sales.forEach(sale=>{const method=sale.method||'Other';paymentGroups.set(method,(paymentGroups.get(method)||0)+(Number(sale.total)||0))});
  const revenueMix=[['Sales revenue',data.salesTotal],['Purchase orders',data.purchaseTotal]];
  const receivable=accountOutstandingTotal('Customer');
  const payable=accountOutstandingTotal('Supplier');
  const periodLabel=reportPeriod==='weekly'?'Weekly':reportPeriod==='annual'?'Annual':'Monthly';
  return `
    ${heading('Financial Reports','Visual financial summaries with weekly, monthly, and annual reporting periods.',`<button class="button" data-action="export-financial-report">↓ Export ${periodLabel.toLowerCase()} report</button>`)}
    <div class="report-period-toolbar"><div><span class="report-period-label">Report period</span><div class="report-period-tabs">${[['weekly','Weekly'],['monthly','Monthly'],['annual','Annual']].map(([key,label])=>`<button type="button" class="report-period-tab ${reportPeriod===key?'active':''}" data-action="set-report-period" data-period="${key}">${label}</button>`).join('')}</div></div><p>${esc(data.label)} · ${dateLabel(data.start)} – ${dateLabel(data.end)}</p></div>
    <section class="metric-grid report-metrics">${metric('Sales revenue',money(data.salesTotal),'↗',`${periodLabel} · ${data.sales.length} transactions`)}${metric('Purchases',money(data.purchaseTotal),'▤',`${periodLabel} · ${data.purchases.length} orders`)}${metric('Net cash movement',`${data.netCollected<0?'− ':''}${money(data.netCollected)}`,'⇄',`Collected less paid · ${periodLabel}`,data.netCollected<0?'down':'up')}${metric('Open receivables',money(receivable),'◷','All customer accounts')}</section>
    <section class="panel financial-chart-panel"><div class="panel-header"><div><h2 class="panel-title">Sales and purchases</h2><p class="panel-subtitle">${esc(periodLabel)} comparison by ${reportPeriod==='weekly'?'day':reportPeriod==='annual'?'month':'week'}.</p></div><div class="report-chart-legend"><span><i style="background:#087f9d"></i>Sales</span><span><i style="background:#ff8c42"></i>Purchases</span></div></div>${renderFinancialBarChart(data)}</section>
    <section class="report-pie-grid">${reportPieCard('Sales by payment method',`${periodLabel} sales value`,[...paymentGroups],'Sales')}${reportPieCard('Revenue and purchases',`${periodLabel} transaction mix`,revenueMix,'Total value')}</section>
    <section class="table-panel financial-summary-table"><div class="table-heading"><div><h2>Financial summary</h2><p class="panel-subtitle">${esc(data.label)} and current account balances.</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Measure</th><th>Amount</th><th>Basis</th></tr></thead><tbody><tr><td><strong>Sales revenue</strong></td><td>${money(data.salesTotal)}</td><td>${periodLabel} transactions</td></tr><tr><td><strong>Customer payments collected</strong></td><td>${money(data.collected)}</td><td>${periodLabel} receipts</td></tr><tr><td><strong>Purchases ordered</strong></td><td>${money(data.purchaseTotal)}</td><td>${periodLabel} purchase orders</td></tr><tr><td><strong>Supplier payments made</strong></td><td>${money(data.supplierPaid)}</td><td>${periodLabel} payments</td></tr><tr><td><strong>Supplier payables</strong></td><td>${money(payable)}</td><td>Current balance</td></tr></tbody></table></div></section>
    <div class="report-cards"><article class="report-card"><h3>Inventory Valuation</h3><p>Current on-hand stock valuation at cost.</p><button class="button" data-action="export-inventory">Export Inventory CSV</button></article><article class="report-card"><h3>General Activity Ledger</h3><p>Complete customer and supplier account transactions.</p><button class="button" data-action="export-ledger">Export Ledger CSV</button></article></div>
  `;
}

// Settings Page (Company branding, VAT 18%, Trash bin with RESTORE)
function renderSettings() {
  pendingCompanyLogo = state.companyLogo || '';
  const trash = state.trashBin || [];
  const trashRows = trash.map(item => `
    <tr>
      <td><strong>${esc(item.type)}</strong><small>${esc(item.id)}</small></td>
      <td>${esc(item.summary)}</td>
      <td>${dateLabel(item.deletedAt?.slice(0, 10))}</td>
      <td>${esc(item.deletedBy || '—')}</td>
      <td><details><summary>View data</summary><pre class="trash-record">${esc(JSON.stringify(item.data, null, 2))}</pre></details></td>
      <td><button type="button" class="button small restore-action" data-action="restore-trash" data-id="${esc(item.id)}" title="Restore to active records">↺ Restore</button></td>
    </tr>
  `).join('') || emptyRow(6, 'Trash bin is empty');

  return `
    ${heading('Settings', 'Configure company identity, invoice payment details, tax defaults, and trash recovery.')}
    <section class="panel company-settings">
      <form id="company-settings-form">
        <div class="settings-section">
          <h2>Company Identity</h2>
          <div class="form-grid">
            <div class="field full"><label for="company-name">Business name</label><input id="company-name" name="company-name" value="${esc(state.companyName || 'Kipepeo Traders')}" required></div>
            <div class="field"><label for="company-phone">Phone number</label><input id="company-phone" name="company-phone" value="${esc(state.companyPhone || '')}" placeholder="+255 …"></div>
            <div class="field"><label for="company-email">Company email</label><input id="company-email" name="company-email" type="email" value="${esc(state.companyEmail || '')}"></div>
            <div class="field full"><label for="company-address">Physical address</label><input id="company-address" name="company-address" value="${esc(state.companyAddress || 'Dar es Salaam, Tanzania')}"></div>
            <div class="field full">
              <label for="company-logo-file">Company logo</label>
              <input id="company-logo-file" name="company-logo-file" type="file" accept="image/png,image/jpeg,image/webp">
              <small class="field-hint">Upload a logo file. It scales responsively in the sidebar and prints larger on invoices.</small>
              <div class="company-logo-preview" id="company-logo-preview">${state.companyLogo ? `<img src="${esc(state.companyLogo)}" alt="Logo preview">` : '<span>No logo uploaded</span>'}</div>
              <button type="button" class="button small" data-action="remove-company-logo">Remove logo</button>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h2>Invoice payment details</h2>
          ${isWorkspaceAdministrator()
            ? `<div class="field"><label for="company-payment-details">Details to print at the bottom of invoices</label><textarea id="company-payment-details" name="company-payment-details" rows="5" placeholder="Bank name and account, mobile money provider and number, payment reference, or other instructions">${esc(state.companyPaymentDetails || '')}</textarea><small class="field-hint">Enter the ways customers can pay. Line breaks are preserved on printed invoices.</small></div>`
            : `<p class="field-hint">${state.companyPaymentDetails ? esc(state.companyPaymentDetails).replace(/\n/g, '<br>') : 'Payment details have not been set by an administrator.'}</p>`}
        </div>

        <div class="settings-section">
          <h2>Tanzania Tax &amp; VAT (18%)</h2>
          <div class="form-grid">
            <div class="field">
              <label><input type="checkbox" name="setting-vat-enabled" ${state.vatEnabled !== false ? 'checked' : ''}> Enable standard 18% VAT</label>
              <small class="field-hint">Calculates standard 18% VAT included in sales totals and displays tax breakdown on receipts.</small>
            </div>
            <div class="field">
              <label for="setting-vat-rate">VAT Rate (%)</label>
              <input id="setting-vat-rate" name="setting-vat-rate" type="number" min="0" max="100" value="${state.vatRate || 18}">
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="button primary" type="submit">Save settings</button>
        </div>
      </form>
    </section>

    <section class="table-panel trash-panel" style="margin-top:20px">
      <div class="table-heading">
        <div><h2>Trash bin (Soft Deletes &amp; Recovery)</h2><p class="panel-subtitle">Restore accidentally deleted items directly back into active workflows.</p></div>
        ${isWorkspaceAdministrator() ? '<button class="button danger-action" data-action="clear-trash">Clear trash bin</button>' : ''}
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Record Type</th><th>Summary</th><th>Deleted Date</th><th>Deleted By</th><th>Stored Data</th><th>Actions</th></tr></thead>
          <tbody>${trashRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function saveCompanySettings(form) {
  const name = form.querySelector('[name="company-name"]').value.trim();
  if (!name) { toast('Enter a business name'); return; }
  state.companyName = name;
  state.companyPhone = form.querySelector('[name="company-phone"]')?.value.trim() || '';
  state.companyEmail = form.querySelector('[name="company-email"]')?.value.trim() || '';
  state.companyAddress = form.querySelector('[name="company-address"]')?.value.trim() || '';
  const paymentDetailsField = form.querySelector('[name="company-payment-details"]');
  if (isWorkspaceAdministrator() && paymentDetailsField) state.companyPaymentDetails = paymentDetailsField.value.trim();
  state.vatEnabled = form.querySelector('[name="setting-vat-enabled"]')?.checked ?? true;
  state.vatRate = Number(form.querySelector('[name="setting-vat-rate"]')?.value) || 18;
  saveState();
  refreshCompanyLogo();
  render();
  toast('Company settings and tax preferences saved');
}

// Master Render Function
function render() {
  ageFinalOrders();
  reconcileCustomerAccountPayments();

  const content = document.getElementById('page-content');
  if (!isWorkspaceAdministrator() && !canViewPage(page)) {
    const fallback=Object.keys(pageLabels).find(candidate=>canViewPage(candidate));
    if(fallback){page=fallback;history.replaceState({erpPage:page},'',`#${page}`);}
    else {content.innerHTML='<section class="panel access-denied-panel"><h2>No sections are enabled for your account</h2><p>Ask an Owner / Administrator to grant access.</p></section>';refreshCompanyLogo();refreshUserProfile();refreshPermissionVisibility();refreshActivityVisibility();refreshNotificationIndicator();updateConnection();syncBackButton();return;}
  }
  const crumb = document.getElementById('crumb-current');
  if (crumb) crumb.textContent = pageLabels[page] || 'Overview';

  try {
    const pageRenderers = {
      dashboard: renderDashboard,
      sales: renderSales,
      pos: renderPOS,
      inventory: renderInventory,
      purchases: renderPurchases,
      customers: () => renderParties('customers'),
      suppliers: () => renderParties('suppliers'),
      users: renderUsers,
      branches: renderBranches,
      accounting: renderAccounting,
      reports: renderReports,
      settings: renderSettings
    };
    content.innerHTML = (pageRenderers[page] || renderDashboard)();
  } catch (err) {
    console.error('Render error:', err);
    content.innerHTML = `<section class="panel" style="padding:24px"><h2>Error loading page</h2><p>${esc(err.message)}</p><button class="button primary" onclick="location.reload()">Reload</button></section>`;
  }

  refreshCompanyLogo();
  refreshUserProfile();
  refreshPermissionVisibility();
  refreshActivityVisibility();
  refreshBranchNav();
  refreshNotificationIndicator();
  updateConnection();
  syncBackButton();
}

// Action Dispatcher
function openDialog(kind, title, subtitle, content, confirmLabel = 'Save') {
  openModal(title, subtitle, `<input type="hidden" name="dialog-kind" value="${esc(kind)}">${content}`, confirmLabel);
  document.getElementById('modal-content').dataset.dialogKind = kind;
}

function openProductForm(product = null) {
  const p = product || { name: '', id: '', category: 'General', price: 0, cost: 0, stock: 0, low: 5, unit: 'Piece', status: 'Active' };
  const content = `<div class="form-grid">${inputField('product-name','Product name','e.g. Maize flour','text',true,p.name)}${inputField('product-sku','SKU / code','Leave blank to generate','text',false,p.id)}${inputField('product-category','Category','e.g. Grocery','text',true,p.category)}${inputField('product-price','Selling price (TZS)','','number',true,p.price)}${inputField('product-cost','Unit cost (TZS)','','number',true,p.cost)}${inputField('product-stock','Opening stock','','number',true,p.stock)}${inputField('product-low','Low stock alert at','','number',false,p.low)}${selectField('product-unit','Unit',state.measurementUnits,p.unit)}</div>`;
  openDialog(product ? 'edit-product' : 'new-product', product ? 'Edit product' : 'Add a product', 'Set the product details, price, and on-hand quantity.', content, product ? 'Save changes' : 'Add product');
  document.getElementById('modal-content').dataset.recordId = product?.id || '';
}

function openPartyForm(type, existing = null) {
  const label = type === 'Supplier' ? 'supplier' : 'customer';
  const fields = `${inputField('party-name','Name','', 'text',true,existing?.name||'')}${inputField('party-phone','Phone number','','tel',false,existing?.phone||'')}${inputField('party-email','Email address','','email',false,existing?.email||'')}${inputField('party-terms','Payment terms','e.g. 14 days','text',false,existing?.terms||'Due on receipt')}${type==='Customer'?inputField('party-credit-limit','Credit limit (TZS)','0','number',false,existing?.creditLimit||0):''}`;
  openDialog(existing ? 'edit-party' : 'new-party', `${existing?'Edit':'Add'} ${label}`, `${existing?'Update':'Create'} a ${label} account for sales and payments.`, `<input type="hidden" name="party-type" value="${type}"><div class="form-grid">${fields}</div>`);
  if (existing) document.getElementById('modal-content').dataset.partyName = existing.name;
}

function openCustomerOrderHistory(name) {
  if (!userHasPermission('customers','order-history')) { toast('You do not have permission to view customer order history'); return; }
  const orders=state.orders.filter(order=>order.customer===name&&order.status!=='Draft').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const rows=orders.map(order=>`<tr><td><strong>${esc(order.id)}</strong></td><td>${dateLabel(order.date)}</td><td>${money(order.total)}</td><td>${esc(order.status)}</td><td>${orderPaymentStatus(order)}</td></tr>`).join('')||emptyRow(5,'No past orders for this customer');
  openModal(`${esc(name)} · Past orders`,`${orders.length} saved order${orders.length===1?'':'s'}`,`<div class="table-scroll"><table class="data-table"><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>${rows}</tbody></table></div>`,'Close');
}

function openSupplierOrderHistory(name) {
  if (!userHasPermission('suppliers','order-history')) { toast('You do not have permission to view supplier purchase history'); return; }
  const purchases=state.purchases.filter(purchase=>purchase.supplier===name).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const rows=purchases.map(purchase=>`<tr><td><strong>${esc(purchase.id)}</strong></td><td>${dateLabel(purchase.date)}</td><td>${money(purchase.total)}</td><td>${purchase.paid>=purchase.total?'Paid':purchase.paid>0?'Part paid':'Due'}</td><td>${esc(purchase.status||'Pending')}</td></tr>`).join('')||emptyRow(5,'No past purchase orders for this supplier');
  openModal(`${esc(name)} · Past purchase orders`,`${purchases.length} saved purchase order${purchases.length===1?'':'s'}`,`<div class="table-scroll"><table class="data-table"><thead><tr><th>Purchase order</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`,'Close');
}

function openPartyOrderHistory(type, name) {
  if (type === 'Supplier') openSupplierOrderHistory(name);
  else openCustomerOrderHistory(name);
}

function openPaymentForm(partyType = '', partyName = '') {
  const names = (partyType === 'Supplier' ? state.suppliers : state.customers).map(p => p.name);
  const partyOptions = names.length ? names : ['Walk-in customer'];
  const accountIsFixed = Boolean(partyType && partyName);
  const accountFields = accountIsFixed
    ? `<input type="hidden" name="payment-party-type" value="${esc(partyType)}"><input type="hidden" name="payment-party" value="${esc(partyName)}"><div class="field full"><label>Payment account</label><div class="accounting-fixed-account">${esc(partyType)} · ${esc(partyName)}</div></div>`
    : `${selectField('payment-party-type','Account type',['Customer','Supplier'],partyType || 'Customer')}${selectField('payment-party','Account',partyOptions,partyName || partyOptions[0])}`;
  const content = `${accountFields}<div class="form-grid">${inputField('payment-amount','Amount (TZS)','','number',true)}${selectField('payment-method','Method',['Cash','M-Pesa','Bank transfer','Card'])}${inputField('payment-date','Date','', 'date',true,today())}${inputField('payment-memo','Note','Optional reference')}</div>`;
  openDialog('record-payment','Record payment','Record money received from a customer or paid to a supplier.',content);
}

function openAccountLedger(partyType, partyName) {
  const account=(partyType==='Supplier'?state.suppliers:state.customers).find(item=>item.name===partyName);
  if(!account)return;
  const entries=state.entries.filter(entry=>entry.partyType===partyType&&entry.party===partyName).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const rows=entries.map(entry=>`<tr><td>${dateLabel(entry.date)}</td><td><span class="ledger-direction ${String(entry.type).toLowerCase()}">${esc(entry.type)}</span></td><td><strong>${money(entry.amount)}</strong></td><td>${esc(entry.memo||'—')}</td><td><small>${esc(entry.id)}</small></td></tr>`).join('')||emptyRow(5,'No transactions recorded for this account yet');
  const signed=Number(account.balance)||0,amount=Math.abs(signed),label=partyType==='Customer'?(signed<0?'Customer credit':'Receivable'):(signed<0?'Payable':'Supplier credit');
  openModal(`${esc(partyName)} · ${partyType} ledger`,`${esc(account.id)} · ${entries.length} transaction${entries.length===1?'':'s'}`,`<div class="account-balance-card"><small>Current ${label.toLowerCase()}</small><strong>${money(amount)}</strong><span>${esc(account.phone||account.email||'Account balance')}</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>Memo</th><th>Reference</th></tr></thead><tbody>${rows}</tbody></table></div>`,`Close`,`<button type="button" class="button" data-action="record-payment" data-party-type="${esc(partyType)}" data-party-name="${esc(partyName)}">Add payment</button><button type="button" class="button" data-action="reconcile-account" data-party-type="${esc(partyType)}" data-party-name="${esc(partyName)}">Reconcile</button>`);
}

function openAccountReconcile(partyType, partyName) {
  const account=(partyType==='Supplier'?state.suppliers:state.customers).find(item=>item.name===partyName);
  if(!account)return;
  const current=partyType==='Customer'?Math.max(0,Number(account.balance)||0):Math.max(0,-(Number(account.balance)||0));
  const label=partyType==='Customer'?'Expected receivable balance':'Expected supplier payable';
  openDialog('account-reconcile',`Reconcile ${partyName}`,`Enter the balance confirmed for this ${partyType.toLowerCase()} account. The difference will be recorded only on this account.`,`${inputField('reconcile-balance',`${label} (TZS)`,'','number',true,current)}${inputField('reconcile-date','Reconciliation date','','date',true,today())}${inputField('reconcile-note','Reference / note','e.g. Statement closing balance')}`,'Reconcile account');
  const form=document.getElementById('modal-content');form.dataset.partyType=partyType;form.dataset.partyName=partyName;
}

function openOrderForm(existing = null) {
  const products = activeProducts();
  if (!products.length && !existing) { toast('Add an active product to Inventory before creating a sales order'); return; }
  const names = [...new Set([...state.customers.filter(c => c.status !== 'Inactive').map(c => c.name), ...(existing?.customer ? [existing.customer] : [])])];
  const content = `<div class="form-grid">${selectField('order-customer','Customer',['Walk-in customer',...names],existing?.customer || 'Walk-in customer')}${inputField('order-date','Order date','', 'date',true,existing?.date || today())}${inputField('order-due','Due date','', 'date',false,existing?.due || today())}</div>${transactionProductPicker('order')}<div class="transaction-lines" id="order-product-lines"><div class="transaction-empty">Search and select products to add them to this order.</div></div>${transactionPaymentSummary('order')}`;
  openDialog(existing ? 'edit-order' : 'new-order',existing ? `${existing.source === 'POS' ? 'Edit POS sale' : 'Edit sales order'}` : 'Create sales order',existing ? `Update ${esc(existing.id)}. Finalized sales update inventory and the customer account.` : 'Choose the customer and date, then search to add as many products as needed. The order will be saved as a draft.',content,existing ? 'Save changes' : 'Save draft');
  const form = document.getElementById('modal-content');
  if (existing) {
    form.dataset.recordId = existing.id;
    document.getElementById('order-discount').value = existing.discount || 0;
    document.getElementById('order-additional').value = existing.additionalCharges || 0;
    document.getElementById('order-paid').value = existing.paid || 0;
    document.getElementById('order-method').value = existing.paymentMethod || existing.posMethod || 'Cash';
    seedTransactionLineValues('order', existing.items || [], 'unitPrice');
  }
}

function openPurchaseForm(existing = null) {
  const products = activeProducts();
  const activeSuppliers = state.suppliers.filter(supplier => supplier.status !== 'Inactive');
  if ((!products.length || !activeSuppliers.length) && !existing) { toast('Add an active product and supplier before creating a purchase order'); return; }
  const supplierNames = [...new Set([...activeSuppliers.map(p => p.name), ...(existing?.supplier ? [existing.supplier] : [])])];
  const content = `<div class="form-grid">${selectField('purchase-supplier','Supplier',supplierNames,existing?.supplier || supplierNames[0])}${inputField('purchase-date','Order date','','date',true,existing?.date || today())}</div>${transactionProductPicker('purchase')}<div class="transaction-lines" id="purchase-product-lines"><div class="transaction-empty">Search and select products to add them to this order.</div></div>${transactionPaymentSummary('purchase')}`;
  openDialog(existing ? 'edit-purchase' : 'new-purchase','Purchase order',existing ? `Update ${esc(existing.id)}. Received purchases adjust stock and the supplier account.` : 'Choose the supplier and date, then search to add as many products as needed. Receive the order to update stock.',content,existing ? 'Save changes' : 'Save purchase order');
  const form = document.getElementById('modal-content');
  if (existing) {
    form.dataset.recordId = existing.id;
    document.getElementById('purchase-discount').value = existing.discount || 0;
    document.getElementById('purchase-additional').value = existing.additionalCharges || 0;
    document.getElementById('purchase-paid').value = existing.paid || 0;
    document.getElementById('purchase-method').value = existing.paymentMethod || 'Cash';
    seedTransactionLineValues('purchase', existing.lines || [], 'unitCost');
  }
}

function transactionProductPicker(kind) {
  return `<div class="transaction-product-search"><div class="field"><label for="${kind}-product-search">Search products</label><input id="${kind}-product-search" type="search" autocomplete="off" placeholder="Type a product name, SKU, or category…" data-transaction-search="${kind}"></div><div class="transaction-suggestions" id="${kind}-product-suggestions" hidden></div></div>`;
}

function transactionPaymentSummary(kind) {
  const methods = kind === 'order' ? ['Cash','M-Pesa','Bank transfer','Card','Credit'] : ['Cash','M-Pesa','Bank transfer','Card'];
  return `<section class="transaction-summary" data-transaction-summary="${kind}"><h3>Payment summary</h3><div class="transaction-summary-row"><span>Products subtotal</span><strong data-summary-subtotal>${money(0)}</strong></div><div class="form-grid transaction-adjustments">${inputField(`${kind}-discount`,'Discount (fixed amount)','0','number',false,0)}${inputField(`${kind}-additional`,'Additional charges (shipping, etc.)','0','number',false,0)}${inputField(`${kind}-paid`,'Amount paid','0','number',false,0)}${selectField(`${kind}-method`,'Payment method',methods,'Cash')}<div class="field"><label>Payment status</label><div class="transaction-status" data-summary-status>Due</div></div></div><div class="transaction-summary-row"><span>Discount</span><strong data-summary-discount>${money(0)}</strong></div><div class="transaction-summary-row"><span>Additional charges</span><strong data-summary-additional>${money(0)}</strong></div><div class="transaction-summary-row transaction-total"><span>Total to pay</span><strong data-summary-total>${money(0)}</strong></div><div class="transaction-summary-row"><span>Amount paid</span><strong data-summary-paid>${money(0)}</strong></div><div class="transaction-summary-row"><span>Balance due</span><strong data-summary-balance>${money(0)}</strong></div></section>`;
}

function transactionLineTotals(kind) {
  const host = document.getElementById(`${kind}-product-lines`);
  const lines = [...(host?.querySelectorAll('.transaction-product-line') || [])];
  const subtotal = lines.reduce((sum, row) => sum + (Number(row.querySelector('[data-line-qty]')?.value) || 0) * (Number(row.querySelector('[data-line-price]')?.value) || 0), 0);
  const discountInput = document.getElementById(`${kind}-discount`), extraInput = document.getElementById(`${kind}-additional`), paidInput = document.getElementById(`${kind}-paid`);
  const discount = Math.max(0, Number(discountInput?.value) || 0), additional = Math.max(0, Number(extraInput?.value) || 0);
  const total = Math.max(0, subtotal - discount + additional), paid = Math.max(0, Number(paidInput?.value) || 0), balance = Math.max(0, total - paid);
  const summary = document.querySelector(`[data-transaction-summary="${kind}"]`);
  if (!summary) return { lines, subtotal, discount, additional, total, paid, balance };
  summary.querySelector('[data-summary-subtotal]').textContent = money(subtotal);
  summary.querySelector('[data-summary-discount]').textContent = `− ${money(discount)}`;
  summary.querySelector('[data-summary-additional]').textContent = money(additional);
  summary.querySelector('[data-summary-total]').textContent = money(total);
  summary.querySelector('[data-summary-paid]').textContent = money(paid);
  summary.querySelector('[data-summary-balance]').textContent = money(balance);
  summary.querySelector('[data-summary-status]').textContent = total <= 0 || paid >= total ? 'Fully paid' : paid > 0 ? 'Partially paid' : 'Due';
  return { lines, subtotal, discount, additional, total, paid, balance };
}

function addTransactionProduct(kind, productId, line = null) {
  const product = state.products.find(item => item.id === productId);
  const host = document.getElementById(`${kind}-product-lines`);
  if (!product || !host) return;
  // Sales orders preserve each selection as its own line in the order entered.
  // Purchase orders retain their existing behavior of combining repeated products.
  const existing = kind === 'order' ? null : host.querySelector(`[data-product-id="${CSS.escape(productId)}"]`);
  if (existing) {
    const qty = existing.querySelector('[data-line-qty]'); qty.value = (Number(qty.value) || 0) + 1;
  } else {
    if (host.querySelector('.transaction-empty')) host.innerHTML = '';
    const price = kind === 'order' ? Number(product.price) || 0 : Number(product.cost) || 0;
    const row = document.createElement('div'); row.className = 'transaction-product-line'; row.dataset.productId = product.id;
    const initialQty = Number(line?.qty) > 0 ? Number(line.qty) : 1;
    const linePrice = line?.[kind === 'order' ? 'unitPrice' : 'unitCost'];
    const initialPrice = Number.isFinite(Number(linePrice)) ? Number(linePrice) : price;
    row.innerHTML = `<div class="transaction-product-copy"><strong>${esc(product.name)}</strong><small>${esc(product.id)} · Current ${kind === 'order' ? 'price' : 'cost'} ${money(price)} · Stock ${Number(product.stock)||0} ${esc(product.unit||'')}</small></div><label class="transaction-number"><span>Qty</span><input type="number" min="1" step="1" value="${initialQty}" data-line-qty aria-label="${esc(product.name)} quantity"></label><label class="transaction-number"><span>${kind === 'order' ? 'Unit price' : 'Unit cost'}</span><input type="number" min="0" step="any" value="${initialPrice}" data-line-price aria-label="${esc(product.name)} unit ${kind === 'order' ? 'price' : 'cost'}"></label><strong class="transaction-line-total" data-line-total>${money(initialQty * initialPrice)}</strong><button type="button" class="transaction-remove" data-action="remove-transaction-product" aria-label="Remove ${esc(product.name)}">×</button>`;
    host.append(row);
    if (kind !== 'order') {
      [...host.querySelectorAll('.transaction-product-line')].sort((a,b)=>compareProductNames(a.querySelector('.transaction-product-copy strong').textContent,b.querySelector('.transaction-product-copy strong').textContent)).forEach(line=>host.append(line));
    }
  }
  const search = document.getElementById(`${kind}-product-search`), suggestions = document.getElementById(`${kind}-product-suggestions`);
  if (search) search.value = ''; if (suggestions) { suggestions.hidden = true; suggestions.innerHTML = ''; }
  updateTransactionLines(kind);
}

function updateTransactionLines(kind) {
  document.querySelectorAll(`#${kind}-product-lines .transaction-product-line`).forEach(row => {
    const qty = Number(row.querySelector('[data-line-qty]')?.value) || 0, price = Number(row.querySelector('[data-line-price]')?.value) || 0;
    row.querySelector('[data-line-total]').textContent = money(qty * price);
  });
  transactionLineTotals(kind);
}

function seedTransactionLineValues(kind, items, priceKey) {
  if (kind === 'order') {
    for (const item of items) addTransactionProduct(kind, item.productId, item);
    updateTransactionLines(kind);
    return;
  }
  const grouped = new Map();
  for (const item of items) {
    const entry = grouped.get(item.productId) || { qty: 0, value: 0 };
    const qty = Number(item.qty) || 0;
    entry.qty += qty;
    entry.value += qty * (Number(item[priceKey]) || 0);
    grouped.set(item.productId, entry);
  }
  for (const [productId, entry] of grouped) {
    addTransactionProduct(kind, productId);
    const row = document.querySelector(`#${kind}-product-lines [data-product-id="${CSS.escape(productId)}"]`);
    if (!row) continue;
    row.querySelector('[data-line-qty]').value = entry.qty;
    row.querySelector('[data-line-price]').value = entry.qty ? entry.value / entry.qty : 0;
  }
  updateTransactionLines(kind);
}

function renderTransactionSuggestions(kind, term) {
  const target = document.getElementById(`${kind}-product-suggestions`); if (!target) return;
  const query = term.trim().toLocaleLowerCase();
  if (!query) { target.hidden = true; target.innerHTML = ''; return; }
  const matches = activeProducts().filter(product => `${product.name} ${product.id} ${product.category}`.toLocaleLowerCase().includes(query)).slice(0, 8);
  target.innerHTML = matches.length ? matches.map(product => `<button type="button" class="transaction-suggestion" data-action="select-transaction-product" data-kind="${kind}" data-id="${esc(product.id)}"><span><strong>${esc(product.name)}</strong><small>${esc(product.id)} · ${esc(product.category)} · Stock ${Number(product.stock)||0}</small></span><b>${money(kind === 'order' ? product.price : product.cost)}</b></button>`).join('') : '<div class="transaction-empty">No matching products</div>';
  target.hidden = false;
}

function openOrderPayment(id) {
  const order=state.orders.find(o=>o.id===id);if(!order)return;
  openDialog('order-payment','Add customer payment',`Record a payment for ${esc(order.id)}.`,`${inputField('order-payment-amount','Amount (TZS)','','number',true,Math.max(0,order.total-(order.paid||0)))}${selectField('order-payment-method','Method',['Cash','M-Pesa','Bank transfer','Card'])}`,'Record payment');
  document.getElementById('modal-content').dataset.recordId=id;
}

function openOrderReturn(id) {
  const order=state.orders.find(o=>o.id===id);if(!order)return;
  const lines=(order.items||[]).map(l=>{const p=state.products.find(x=>x.id===l.productId);return p?`${p.id} · ${p.name}`:l.productId;});
  openDialog('order-return','Manage return',`Record returned items for ${esc(order.id)}.`,`${selectField('return-product','Product',lines)}${inputField('return-qty','Quantity returned','','number',true,1)}${inputField('return-reason','Reason','Optional note')}<div class="field"><label><input type="checkbox" name="return-restock" checked> Restock returned items</label></div>`,'Save return');
  document.getElementById('modal-content').dataset.recordId=id;
}

function switchBranch(id) {
  const branch=state.branches.find(b=>b.id===id);if(!branch||branch.id===activeBranch.id)return;
  snapshotCurrentBranch();activeBranch=branch;
  const saved=state.branchData?.[id]||{};
  branchCollections.forEach(key=>{state[key]=structuredClone(saved[key]||[]);});
  state.activeBranchId=branch.id;state.branch=branch.name;saveState();page='dashboard';pageHistory.length=0;history.pushState({erpPage:page},'',`#${page}`);render();toast(`Opened ${branch.name}`);
}

function handleDialogSubmit(form) {
  const data = new FormData(form);
  const kind = form.dataset.dialogKind;
  const val = key => String(data.get(key) || '').trim();
  if (kind === 'new-product' || kind === 'edit-product') {
    const id = kind === 'edit-product' ? form.dataset.recordId : (val('product-sku') || idFor('SKU', state.products));
    const product = { id, name: val('product-name'), category: val('product-category') || 'General', price: Number(val('product-price')) || 0, cost: Number(val('product-cost')) || 0, stock: Math.max(0, Number(val('product-stock')) || 0), low: Math.max(0, Number(val('product-low')) || 0), unit: val('product-unit') || 'Piece', status: 'Active' };
    const old = state.products.find(p => p.id === id);
    if (old) Object.assign(old, product); else state.products.unshift(product);
    if (!state.productCategories.includes(product.category)) state.productCategories.push(product.category);
    recordActivity(old?'Product updated':'Product added',product.name,product.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast(old ? 'Product updated' : 'Product added'); return;
  }
  if (kind === 'new-party' || kind === 'edit-party') {
    const editing=kind==='edit-party', type = val('party-type'), list = type === 'Supplier' ? state.suppliers : state.customers;
    const existing=editing?list.find(item=>item.name===form.dataset.partyName):null;
    if(editing&&!existing){toast(`${type} account could not be found`);return;}
    if (list.some(p => p.id !== existing?.id && p.name.toLowerCase() === val('party-name').toLowerCase())) { toast('That account already exists'); return; }
    const record={id:existing?.id||idFor(type === 'Supplier' ? 'SUP' : 'CUS', list),name:val('party-name'),phone:val('party-phone'),email:val('party-email'),terms:val('party-terms')||'Due on receipt',balance:existing?.balance||0,status:existing?.status||'Active'};
    if(type==='Customer')record.creditLimit=Math.max(0,Number(val('party-credit-limit'))||0);
    if(existing){const previousName=existing.name;Object.assign(existing,record);if(previousName!==record.name){if(type==='Customer'){state.orders.forEach(order=>{if(order.customer===previousName)order.customer=record.name;});state.sales.forEach(sale=>{if(sale.customer===previousName)sale.customer=record.name;});}else state.purchases.forEach(purchase=>{if(purchase.supplier===previousName)purchase.supplier=record.name;});state.entries.forEach(entry=>{if(entry.partyType===type&&entry.party===previousName)entry.party=record.name;});}}else list.unshift(record);
    recordActivity(`${type} ${editing?'updated':'added'}`,val('party-name'),record.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast(`${type} ${editing?'updated':'added'}`); return;
  }
  if (kind === 'new-order' || kind === 'edit-order') {
    const editing = kind === 'edit-order';
    const order = editing ? state.orders.find(item => item.id === form.dataset.recordId) : null;
    if (editing && !order) { toast('This sales order could not be found'); return; }
    const totals = transactionLineTotals('order');
    const items = totals.lines.map(row => { const productId = row.dataset.productId, product = state.products.find(item => item.id === productId); return { productId, product: product?.name || productId, qty: Number(row.querySelector('[data-line-qty]').value) || 0, unitPrice: Number(row.querySelector('[data-line-price]').value) || 0 }; });
    if (!items.length || items.some(line => line.qty <= 0)) { toast('Search for and add at least one product with a valid quantity'); return; }
    if (totals.discount > totals.subtotal) { toast('Discount cannot be greater than the products subtotal'); return; }
    if (totals.paid > totals.total) { toast('Amount paid cannot be greater than the order total'); return; }
    const customer = val('order-customer'), date = val('order-date') || today(), method = val('order-method') || 'Cash';
    const creditCustomer=state.customers.find(item=>item.name===customer),creditLimit=Number(creditCustomer?.creditLimit)||0;
    if(creditLimit>0){const previousDue=editing&&order.customer===customer?Math.max(0,(Number(order.total)||0)-(Number(order.paid)||0)):0;const newDue=Math.max(0,totals.total-totals.paid),projectedBalance=(Number(creditCustomer.balance)||0)-previousDue+newDue;if(newDue>previousDue&&projectedBalance>creditLimit){toast(`Credit limit exceeded for ${customer} · available ${money(Math.max(0,creditLimit-(Number(creditCustomer.balance)||0)+previousDue))}`);return;}}
    const wasInvoicedOrder = editing && ['Final', 'Edited', 'Completed'].includes(order.status);
    const finalized = wasInvoicedOrder;
    const hasReturns = editing && state.returns.some(record => record.saleId === (order.invoiceId || order.id));
    if (finalized && hasReturns) { toast('This sale has returns recorded, so its original items cannot be edited'); return; }
    const allocated = editing ? state.entries.filter(entry => entry.sourceType === 'account-payment' && entry.partyType === 'Customer').reduce((sum, entry) => sum + (entry.allocations || []).filter(allocation => allocation.orderId === order.id).reduce((part, allocation) => part + (Number(allocation.amount) || 0), 0), 0) : 0;
    if (finalized && allocated > 0 && (customer !== order.customer || totals.paid < allocated)) { toast('This order has account payments allocated to it. Keep the same customer and paid amount at least as high as those allocations.'); return; }
    const oldQuantities = new Map();
    if (finalized) (order.items || []).forEach(line => oldQuantities.set(line.productId, (oldQuantities.get(line.productId) || 0) + (Number(line.qty) || 0)));
    const newQuantities = new Map();
    items.forEach(line => newQuantities.set(line.productId, (newQuantities.get(line.productId) || 0) + line.qty));
    if (finalized) {
      for (const productId of new Set([...oldQuantities.keys(), ...newQuantities.keys()])) {
        const product = state.products.find(item => item.id === productId);
        if (!product) { toast('A product on this sale no longer exists'); return; }
        const availableAfterEdit = product.stock + (oldQuantities.get(productId) || 0) - (newQuantities.get(productId) || 0);
        if (availableAfterEdit < 0) { toast(`Not enough stock to increase ${product.name} on this sale`); return; }
      }
    }
    const updated = order || { id: idFor('ORD', state.orders), source: 'Order', status: 'Draft' };
    Object.assign(updated, { customer, date, due: val('order-due') || date, subtotal: totals.subtotal, discount: totals.discount, additionalCharges: totals.additional, total: totals.total, paid: totals.paid, paymentMethod: method, items });
    if (wasInvoicedOrder) updated.status = 'Edited';
    if (updated.source === 'POS') updated.posMethod = method;
    if (finalized) {
      for (const productId of new Set([...oldQuantities.keys(), ...newQuantities.keys()])) {
        const product = state.products.find(item => item.id === productId);
        const before = product.stock, delta = (oldQuantities.get(productId) || 0) - (newQuantities.get(productId) || 0);
        if (!delta) continue;
        product.stock += delta;
        state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId, product: product.name, date, before, after: product.stock, delta, reason: `Edited sale ${updated.id}`, user: currentWorkspaceUser().name });
      }
      const invoice = ensureOrderInvoice(updated);
      removeAccountEntries(entry => ['order','order-payment','sales','sales-payment'].includes(entry.sourceType) && [updated.id, updated.invoiceId].includes(entry.sourceId));
      if (state.customers.some(item => item.name === customer)) {
        const pos = updated.source === 'POS';
        postAccountEntry({ partyType:'Customer', party:customer, date, type:'Debit', amount:updated.total, memo:`${pos ? 'POS sale' : 'Sales order'} · ${updated.id}`, sourceType:pos ? 'sales' : 'order', sourceId:updated.id, relatedId:updated.invoiceId || updated.id });
        const directPaid = Math.max(0, updated.paid - allocated);
        if (directPaid > 0) postAccountEntry({ partyType:'Customer', party:customer, date, type:'Credit', amount:directPaid, memo:`Payment · ${method} · ${updated.id}`, sourceType:pos ? 'sales-payment' : 'order-payment', sourceId:updated.id, relatedId:updated.invoiceId || updated.id });
      }
      Object.assign(invoice, { customer, date, total:updated.total, paid:updated.paid, method, status:orderPaymentStatus(updated), items:updated.items, discount:updated.discount, additionalCharges:updated.additionalCharges });
    } else if (!editing) state.orders.unshift(updated);
    recordActivity(editing?'Sale/order updated':'Sales order created',`${customer} · ${money(totals.total)}`,updated.id);
    saveState(); document.getElementById('app-modal').close(); setPage('sales'); toast(editing ? (wasInvoicedOrder ? 'Order updated · status is Edited until the invoice is printed again' : 'Sale updated') : 'Sales order saved as a draft'); return;
  }
  if (kind === 'record-payment') {
    const type = val('payment-party-type'), name = val('payment-party'), amount = Number(val('payment-amount')) || 0;
    if (!(amount > 0)) { toast('Enter an amount greater than zero'); return; }
    postAccountEntry({ partyType: type, party: name, date: val('payment-date') || today(), type: type === 'Customer' ? 'Credit' : 'Debit', amount, memo: `${val('payment-method')} payment${val('payment-memo') ? ` · ${val('payment-memo')}` : ''}`, sourceType: 'account-payment' });
    recordActivity('Account payment recorded',`${type} · ${name} · ${money(amount)}`);
    saveState(); document.getElementById('app-modal').close(); render(); toast('Payment recorded'); return;
  }
  if (kind === 'account-reconcile') {
    const partyType=form.dataset.partyType,partyName=form.dataset.partyName;
    const account=(partyType==='Supplier'?state.suppliers:state.customers).find(item=>item.name===partyName);
    const expected=Number(val('reconcile-balance'));
    if(!account||!Number.isFinite(expected)||expected<0){toast('Enter a valid non-negative account balance');return;}
    const desiredSigned=partyType==='Customer'?expected:-expected;
    const difference=desiredSigned-(Number(account.balance)||0);
    if(Math.abs(difference)<0.005){document.getElementById('app-modal').close();toast('This account is already reconciled to that balance');return;}
    postAccountEntry({partyType,party:partyName,date:val('reconcile-date')||today(),type:difference>0?'Debit':'Credit',amount:Math.abs(difference),memo:`Balance reconciliation${val('reconcile-note')?` · ${val('reconcile-note')}`:''}`,sourceType:'reconciliation',sourceId:account.id,relatedId:account.id});
    recordActivity(`${partyType} account reconciled`,`${partyName} · ${money(expected)}`,account.id);
    saveState();document.getElementById('app-modal').close();render();toast(`${partyType} account reconciled`);return;
  }
  if (kind === 'adjust-stock') {
    const product = state.products.find(p => p.id === form.dataset.recordId); if (!product) return;
    const before = product.stock, next = Math.max(0, Number(val('stock-new-quantity')) || 0); product.stock = next;
    state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId: product.id, product: product.name, date: today(), before, after: next, delta: next-before, reason: val('stock-reason') || 'Manual adjustment', user: currentWorkspaceUser().name });
    recordActivity('Stock adjusted',`${product.name} · ${before} → ${next}`,product.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast('Stock adjusted'); return;
  }
  if (kind === 'bulk-adjust-stock') {
    const productId=val('bulk-product').split(' · ')[0],product=state.products.find(p=>p.id===productId);
    if(!product){toast('Choose an available product');return;}
    const before=product.stock,next=Math.max(0,Number(val('bulk-quantity'))||0);product.stock=next;
    state.stockMovements.unshift({id:idFor('STK',state.stockMovements),productId,product:product.name,date:today(),before,after:next,delta:next-before,reason:val('stock-reason')||'Stock take / adjustment',user:currentWorkspaceUser().name});
    recordActivity('Stock count / adjustment saved',`${product.name} · ${before} → ${next}`,product.id);
    saveState();document.getElementById('app-modal').close();render();toast('Stock count saved');return;
  }
  if (kind === 'new-purchase' || kind === 'edit-purchase') {
    const editing=kind==='edit-purchase';
    const purchase=editing?state.purchases.find(item=>item.id===form.dataset.recordId):null;
    if(editing&&!purchase){toast('This purchase order could not be found');return;}
    const totals=transactionLineTotals('purchase');
    const lines=totals.lines.map(row=>{const product=state.products.find(p=>p.id===row.dataset.productId);return {productId:row.dataset.productId,product:product?.name||row.dataset.productId,qty:Number(row.querySelector('[data-line-qty]').value)||0,unitCost:Number(row.querySelector('[data-line-price]').value)||0};});
    if(!lines.length||lines.some(line=>line.qty<=0)){toast('Search for and add at least one product with a valid quantity');return;}
    if(totals.discount>totals.subtotal){toast('Discount cannot be greater than the products subtotal');return;}
    if(totals.paid>totals.total){toast('Amount paid cannot be greater than the order total');return;}
    const supplier=val('purchase-supplier'),date=val('purchase-date')||today(),method=val('purchase-method')||'Cash';
    const received=editing&&purchase.status==='Received';
    const hasReturns=editing&&((Number(purchase.returned)||0)>0||(state.purchaseReturns||[]).some(record=>record.purchaseId===purchase.id||record.purchaseOrderId===purchase.id));
    if(received&&hasReturns){toast('This purchase has returns recorded, so its original items cannot be edited');return;}
    const oldQuantities=new Map();if(received)(purchase.lines||[]).forEach(line=>oldQuantities.set(line.productId,(oldQuantities.get(line.productId)||0)+(Number(line.qty)||0)));
    const newQuantities=new Map();lines.forEach(line=>newQuantities.set(line.productId,(newQuantities.get(line.productId)||0)+line.qty));
    if(received)for(const productId of new Set([...oldQuantities.keys(),...newQuantities.keys()])){const product=state.products.find(item=>item.id===productId);if(!product){toast('A product on this purchase no longer exists');return;}if(product.stock+(newQuantities.get(productId)||0)-(oldQuantities.get(productId)||0)<0){toast(`Cannot reduce ${product.name}; some received stock has already been sold or used`);return;}}
    const updated=purchase||{id:idFor('PO',state.purchases),status:'Pending'};
    Object.assign(updated,{supplier,date,lines,subtotal:totals.subtotal,discount:totals.discount,additionalCharges:totals.additional,total:totals.total,paid:totals.paid,paymentMethod:method});
    if(received)for(const productId of new Set([...oldQuantities.keys(),...newQuantities.keys()])){const product=state.products.find(item=>item.id===productId),before=product.stock,delta=(newQuantities.get(productId)||0)-(oldQuantities.get(productId)||0);if(!delta)continue;product.stock+=delta;state.stockMovements.unshift({id:idFor('STK',state.stockMovements),productId,product:product.name,date,before,after:product.stock,delta,reason:`Edited received purchase ${updated.id}`,user:currentWorkspaceUser().name});}
    removeAccountEntries(entry=>['purchase','purchase-payment'].includes(entry.sourceType)&&entry.sourceId===updated.id);
    postAccountEntry({partyType:'Supplier',party:supplier,date,type:'Credit',amount:updated.total,memo:`Purchase order · ${updated.id}`,sourceType:'purchase',sourceId:updated.id});
    if(updated.paid>0)postAccountEntry({partyType:'Supplier',party:supplier,date,type:'Debit',amount:updated.paid,memo:`Payment · ${method} · ${updated.id}`,sourceType:'purchase-payment',sourceId:updated.id});
    if(!editing)state.purchases.unshift(updated);
    recordActivity(editing?'Purchase order updated':'Purchase order created',`${supplier} · ${money(totals.total)}`,updated.id);
    saveState();document.getElementById('app-modal').close();setPage('purchases');toast(editing?'Purchase order updated':'Purchase order saved');return;
  }
  if (kind === 'purchase-payment') {
    const purchase=state.purchases.find(p=>p.id===form.dataset.recordId),amount=Number(val('purchase-payment-amount'))||0;
    if(!purchase||amount<=0){toast('Enter a payment amount greater than zero');return;}
    const applied=Math.min(amount,Math.max(0,purchase.total-(purchase.returned||0)-(purchase.paid||0)));
    if(!applied){toast('This purchase has no balance due');return;}
    purchase.paid=(purchase.paid||0)+applied;
    postAccountEntry({partyType:'Supplier',party:purchase.supplier,date:today(),type:'Debit',amount:applied,memo:`Payment · ${val('purchase-payment-method')} · ${purchase.id}`,sourceType:'purchase-payment',sourceId:purchase.id});
    recordActivity('Supplier payment recorded',`${purchase.supplier} · ${money(applied)}`,purchase.id);
    saveState();document.getElementById('app-modal').close();render();toast('Supplier payment recorded');return;
  }
  if (kind === 'order-payment') {
    const order=state.orders.find(o=>o.id===form.dataset.recordId),amount=Number(val('order-payment-amount'))||0;
    if(!order||amount<=0){toast('Enter a payment amount greater than zero');return;}
    const applied=Math.min(amount,Math.max(0,order.total-(order.paid||0)));order.paid=(order.paid||0)+applied;
    const invoice=ensureOrderInvoice(order);invoice.paid=order.paid;invoice.method=val('order-payment-method')||'Cash';invoice.status=orderPaymentStatus(order)==='Fully paid'?'Paid':'Pending';
    if(state.customers.some(c=>c.name===order.customer))postAccountEntry({partyType:'Customer',party:order.customer,type:'Credit',amount:applied,memo:`Payment · ${invoice.method} · ${order.id}`,sourceType:'order-payment',sourceId:order.id});
    recordActivity('Customer payment recorded',`${order.customer} · ${money(applied)}`,order.id);
    saveState();document.getElementById('app-modal').close();render();toast('Customer payment recorded');return;
  }
  if (kind === 'order-return') {
    const order=state.orders.find(o=>o.id===form.dataset.recordId),productId=val('return-product').split(' · ')[0],line=order?.items?.find(i=>i.productId===productId),qty=Math.max(1,Number(val('return-qty'))||1);
    if(!order||!line||qty>line.qty){toast('Return quantity must be within the original sale quantity');return;}
    const product=state.products.find(p=>p.id===productId);if(data.get('return-restock')&&product)product.stock+=qty;
    state.returns.unshift({id:idFor('RET',state.returns),saleId:order.invoiceId||order.id,customer:order.customer,product:product?.name||productId,productId,qty,date:today(),reason:val('return-reason'),restocked:Boolean(data.get('return-restock'))});
    recordActivity('Sales return recorded',`${order.customer} · ${product?.name||productId} · ${qty}`,order.id);
    saveState();document.getElementById('app-modal').close();render();toast('Return recorded');return;
  }
  if (kind === 'new-user') {
    if(!canPerformAction('new-user')){toast('You do not have permission to add users');return;}
    const name=val('user-name');if(!name){toast('Enter the user name');return;}
    const role=val('user-role')||'Salesman';
    if(role==='Owner / Administrator'&&!isWorkspaceAdministrator()){toast('Only an Owner / Administrator can assign the administrator role');return;}
    const modules=userRoleDefaults[role]||userRoleDefaults.Salesman;
    state.users.push({id:idFor('USR',state.users),name,email:val('user-email'),phone:val('user-phone'),role,modules:[...modules],permissions:rolePermissionMap(role,modules),branchId:activeBranch.id,status:'Active'});
    recordActivity('User added',`${name} · ${role}`);
    saveState();document.getElementById('app-modal').close();render();toast('User added');return;
  }
  if(kind==='edit-user-permissions'){
    if(!isWorkspaceAdministrator()){toast('Only an Owner / Administrator can override user permissions');return;}
    const user=state.users.find(item=>item.id===form.dataset.recordId);
    if(!user||isAdministratorUser(user)){toast('The Owner / Administrator always has full access');return;}
    const permissions=Object.fromEntries(userActionPermissions.map(group=>[group.module,[]]));
    for(const choice of data.getAll('user-permission')){const [module,permission]=String(choice).split('|');if(permissions[module]&&!permissions[module].includes(permission))permissions[module].push(permission);}
    user.permissions=permissions;
    user.modules=userActionPermissions.filter(group=>permissions[group.module].length>0).map(group=>group.module);
    recordActivity('User permissions updated',user.name,user.id);
    saveState();document.getElementById('app-modal').close();render();toast(`Permissions updated for ${user.name}`);return;
  }
  if (kind === 'new-branch') {
    const name=val('branch-name');if(!name){toast('Enter a branch name');return;}
    const branch={id:idFor('BR',state.branches),name,status:'Active'};state.branches.push(branch);state.branchData[branch.id]=Object.fromEntries(branchCollections.map(k=>[k,[]]));
    saveState();document.getElementById('app-modal').close();render();toast('Branch added');return;
  }
  toast('This form is not available yet');
}

function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  const type = button.dataset.partyType;

  if(!canPerformAction(action,button)){toast('Your account does not have permission to perform that action');return;}

  switch (action) {
    case 'apply-date-range':
    case 'clear-date-range': {
      const kind = button.dataset.filterKind;
      const isSales = kind === 'sales';
      const fromInput = document.getElementById(`${kind}-date-from`);
      const toInput = document.getElementById(`${kind}-date-to`);
      const from = action === 'clear-date-range' ? '' : fromInput?.value || '';
      const to = action === 'clear-date-range' ? '' : toInput?.value || '';
      if (from && to && from > to) { toast('The start date must be before the end date'); break; }
      if (isSales) { salesDateFrom = from; salesDateTo = to; }
      else if (kind === 'purchase') { purchaseDateFrom = from; purchaseDateTo = to; }
      closeDateFilterPortal();
      button.closest('details')?.removeAttribute('open');
      render();
      break;
    }
    case 'new-product': openProductForm(); break;
    case 'edit-product': openProductForm(state.products.find(p => p.id === id)); break;
    case 'new-party': openPartyForm(type || 'Customer'); break;
    case 'edit-party': { const partyType=type==='Supplier'?'Supplier':'Customer',list=partyType==='Supplier'?state.suppliers:state.customers,party=list.find(item=>item.name===button.dataset.partyName); if(party)openPartyForm(partyType,party); break; }
    case 'delete-party': {
      if (!isWorkspaceAdministrator()) { toast('Only the Owner / Administrator can permanently delete customer or supplier accounts'); break; }
      const partyType = type === 'Supplier' ? 'Supplier' : 'Customer', partyName = button.dataset.partyName;
      const partyList = partyType === 'Supplier' ? state.suppliers : state.customers;
      if (!partyList.some(item => item.name === partyName)) { toast(`${partyType} account could not be found`); break; }
      const directSales = partyType === 'Customer' ? state.sales.filter(item => item.customer === partyName) : [];
      const directSaleOrderIds = new Set(directSales.map(item => item.orderId).filter(Boolean));
      const linkedOrders = partyType === 'Customer' ? state.orders.filter(item => item.customer === partyName || directSaleOrderIds.has(item.id)) : [];
      const orderIds = new Set(linkedOrders.map(item => item.id));
      const invoiceIds = new Set(linkedOrders.map(item => item.invoiceId).filter(Boolean));
      const linkedSales = partyType === 'Customer' ? state.sales.filter(item => item.customer === partyName || orderIds.has(item.orderId) || invoiceIds.has(item.id)) : [];
      const linkedPurchases = partyType === 'Supplier' ? state.purchases.filter(item => item.supplier === partyName) : [];
      const linkedReturns = partyType === 'Customer'
        ? (state.returns || []).filter(item => orderIds.has(item.saleId) || linkedSales.some(sale => sale.id === item.saleId))
        : (state.purchaseReturns || []).filter(item => linkedPurchases.some(purchase => purchase.id === item.purchaseId || purchase.id === item.purchaseOrderId));
      const linkedLedger = state.entries.filter(item => item.partyType === partyType && item.party === partyName).length;
      const details = partyType === 'Customer'
        ? `${linkedOrders.length} sales orders, ${linkedSales.length} invoices, ${linkedReturns.length} returns and ${linkedLedger} account entries`
        : `${linkedPurchases.length} purchase orders, ${linkedReturns.length} returns and ${linkedLedger} account entries`;
      if (!button.dataset.deleteMode) { openDeleteChoice(button, `Delete ${partyType.toLowerCase()} ${partyName}?`, `Keep ${details} in history, or permanently erase them with the profile.`, 'Delete profile, keep history', 'Erase profile and history'); break; }
      if (button.dataset.deleteMode === 'erase-all') erasePartyHistory(partyType, partyName);
      permanentlyDeleteParty(partyType, partyName);
      saveState(); render(); toast(button.dataset.deleteMode === 'erase-all' ? `${partyType} profile and linked records permanently erased` : `${partyType} profile deleted; linked transaction history retained`); break;
    }
    case 'view-customer-orders': openCustomerOrderHistory(button.dataset.partyName); break;
    case 'view-party-orders': openPartyOrderHistory(type,button.dataset.partyName); break;
    case 'toggle-party': {
      const partyType=type==='Supplier'?'Supplier':'Customer',list=partyType==='Supplier'?state.suppliers:state.customers,party=list.find(item=>item.name===button.dataset.partyName);
      if(!party)break;
      if(!userHasPermission(partyType==='Supplier'?'suppliers':'customers','activate')){toast(`You do not have permission to activate or deactivate ${partyType.toLowerCase()} accounts`);break;}
      party.status=party.status==='Inactive'?'Active':'Inactive';
      recordActivity(`${partyType} ${party.status==='Active'?'activated':'deactivated'}`,party.name,party.id);
      saveState();render();toast(`${partyType} ${party.name} ${party.status==='Active'?'activated':'deactivated'}`);break;
    }
    case 'new-order': openOrderForm(); break;
    case 'edit-order': { const order=state.orders.find(item=>item.id===id); if(order)openOrderForm(order); break; }
    case 'record-payment': if(document.getElementById('app-modal')?.open)document.getElementById('app-modal').close();openPaymentForm(type || '', button.dataset.partyName || ''); break;
    case 'reconcile-account': if(document.getElementById('app-modal')?.open)document.getElementById('app-modal').close();openAccountReconcile(type,button.dataset.partyName||''); break;
    case 'view-account-ledger': if(document.getElementById('app-modal')?.open)document.getElementById('app-modal').close();openAccountLedger(type,button.dataset.partyName||''); break;
    case 'new-purchase': openPurchaseForm(); break;
    case 'edit-purchase': { const purchase=state.purchases.find(item=>item.id===id); if(purchase)openPurchaseForm(purchase); break; }
    case 'select-transaction-product': addTransactionProduct(button.dataset.kind, button.dataset.id); break;
    case 'remove-transaction-product': {
      const host = button.closest('.transaction-product-line')?.parentElement;
      const kind = host?.id === 'order-product-lines' ? 'order' : 'purchase';
      button.closest('.transaction-product-line')?.remove();
      if (host && !host.querySelector('.transaction-product-line')) host.innerHTML = '<div class="transaction-empty">Search and select products to add them to this order.</div>';
      updateTransactionLines(kind); break;
    }
    case 'purchase-payment': {
      const purchase=state.purchases.find(p=>p.id===id);if(!purchase)break;
      openDialog('purchase-payment','Add supplier payment',`Record a payment for ${esc(purchase.id)} to ${esc(purchase.supplier)}.`,`${inputField('purchase-payment-amount','Amount (TZS)','','number',true,Math.max(0,purchase.total-(purchase.paid||0)-(purchase.returned||0)))}${selectField('purchase-payment-method','Method',['Cash','M-Pesa','Bank transfer','Card'])}`,'Record payment');
      document.getElementById('modal-content').dataset.recordId=id;break;
    }
    case 'new-user':
      openDialog('new-user','Add user','Add a team member to this workspace.',`<div class="form-grid">${inputField('user-name','Full name','', 'text',true)}${inputField('user-email','Email','', 'email')}${inputField('user-phone','Phone','', 'tel')}${selectField('user-role','Role',['Salesman','Storekeeper','Manager','Owner / Administrator'],'Salesman')}</div>`);break;
    case 'edit-user-permissions': { const user=state.users.find(item=>item.id===id);openUserPermissionsForm(user);break; }
    case 'toggle-user': {
      const user=state.users.find(u=>u.id===id);if(!user||user.isBootstrap){toast('The owner account cannot be deactivated');break;}
      user.status=user.status==='Active'?'Inactive':'Active';recordActivity(`User ${user.status.toLowerCase()}`,user.name,user.id);saveState();render();toast(`User ${user.status.toLowerCase()}`);break;
    }
    case 'delete-user': {
      if(!isWorkspaceAdministrator()){toast('Only an Owner / Administrator can permanently delete users');break;}
      const user=state.users.find(item=>item.id===id);
      if(!user||user.isBootstrap||isAdministratorUser(user)){toast('Owner / Administrator accounts cannot be deleted');break;}
      if(!button.dataset.deleteMode){openDeleteChoice(button,`Delete user ${user.name}?`,'Keep the user’s activity and stock history, or erase the user account and its audit trail.','Delete user, keep records','Erase user and audit trail');break;}
      state.users=state.users.filter(item=>item.id!==user.id);
      if(state.currentUserId===user.id){
        const builtInOwner=state.users.find(item=>item.isBootstrap&&item.status==='Active');
        const nextAdmin=state.users.find(item=>item.role==='Owner / Administrator'&&item.status==='Active');
        const nextActive=state.users.find(item=>item.status==='Active');
        state.currentUserId=(builtInOwner||nextAdmin||nextActive)?.id||'';
        if(state.currentUserId)safeStorageSet(AUTH_SESSION_KEY,state.currentUserId);else safeStorageRemove(AUTH_SESSION_KEY);
      }
      if(button.dataset.deleteMode==='erase-all'){
        state.activityLog=(state.activityLog||[]).filter(item=>item.actor!==user.name);
        state.stockMovements=state.stockMovements.filter(item=>item.user!==user.name);
      }else recordActivity('User deleted',`${user.name} · existing records retained`,user.id);
      saveState();render();toast(button.dataset.deleteMode==='erase-all'?`User ${user.name} and audit trail erased`:`User ${user.name} deleted; existing records were kept`);break;
    }
    case 'new-branch': openDialog('new-branch','Add branch','Create an independent workspace for another location.',inputField('branch-name','Branch name','e.g. Arusha branch','text',true));break;
    case 'finalize-order': {
      const order=state.orders.find(o=>o.id===id);if(!order||order.status!=='Draft')break;
      if (finalizeSalesOrder(order)) toast('Order finalized and invoice created');
      break;
    }
    case 'view-order': {
      const order=salesOrderRows().find(o=>o.id===id);if(!order)break;
      const lines=(order.items||[]).map(l=>{const p=state.products.find(x=>x.id===l.productId);return `<tr><td>${esc(p?.name||l.product||l.productName||l.productId)}</td><td>${l.qty}</td><td>${money(l.unitPrice??p?.price??0)}</td><td>${money(l.qty*(l.unitPrice??p?.price??0))}</td></tr>`}).join('');
      openModal('Order details',`${esc(order.id)} · ${esc(order.customer)} · ${esc(order.status)}`,`<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table></div><p><strong>Total ${money(order.total)} · Paid ${money(order.paid||0)} · ${orderPaymentStatus(order)}</strong></p>`,'Close');break;
    }
    case 'add-order-payment': openOrderPayment(id);break;
    case 'manage-order-returns': openOrderReturn(id);break;
    case 'delete-order': {
      const order=state.orders.find(o=>o.id===id);if(!order)break;
      const adminOverride=isWorkspaceAdministrator()&&order.status!=='Draft';
      if(order.status!=='Draft'&&!adminOverride){toast('Only the Owner / Administrator can override deletion of a finalized order');break;}
      if(!button.dataset.deleteMode){openDeleteChoice(button,`Delete sales order ${id}?`,adminOverride?'Choose whether to move the order bundle to Trash or permanently erase its invoice, account entries, returns, and stock impact.':'Choose whether to move the draft to Trash or permanently erase it.','Move bundle to Trash','Erase everything');break;}
      const invoice=state.sales.find(sale=>sale.id===order.invoiceId||sale.orderId===order.id);
      const returns=state.returns.filter(record=>record.saleId===(order.invoiceId||order.id));
      const entryMatches=entry=>['order','order-payment','sales','sales-payment'].includes(entry.sourceType)&&[order.id,order.invoiceId].includes(entry.sourceId);
      const accountEntries=state.entries.filter(entryMatches);
      if(button.dataset.deleteMode==='keep-history')archiveToTrashBin(state,order.source==='POS'?'POS sale':'Sales order',{order,invoice,returns,accountEntries},order.id,currentWorkspaceUser().name);
      if(adminOverride){
        const restocked=new Map();for(const ret of returns)if(ret.restocked)restocked.set(ret.productId,(restocked.get(ret.productId)||0)+(Number(ret.qty)||0));
        for(const line of order.items||[]){const product=state.products.find(p=>p.id===line.productId);if(!product)continue;const qty=Math.max(0,(Number(line.qty)||0)-(restocked.get(line.productId)||0));if(!qty)continue;const before=product.stock;product.stock+=qty;state.stockMovements.unshift({id:idFor('STK',state.stockMovements),productId:product.id,product:product.name,date:today(),before,after:product.stock,delta:qty,reason:`Admin deleted sale ${id}`,user:currentWorkspaceUser().name});}
        state.sales=state.sales.filter(sale=>sale.id!==invoice?.id&&sale.orderId!==order.id);
        for(const entry of state.entries)if(entry.sourceType==='account-payment'&&Array.isArray(entry.allocations))entry.allocations=entry.allocations.filter(allocation=>allocation.orderId!==order.id);
      }
      removeAccountEntries(entryMatches);state.returns=state.returns.filter(record=>!returns.some(ret=>ret.id===record.id));
      if(!adminOverride&&invoice)state.sales=state.sales.filter(sale=>sale.id!==invoice.id);
      state.orders=state.orders.filter(o=>o.id!==id);recordActivity(adminOverride?'Finalized sales order deleted by administrator':'Draft sales order deleted',id,id);saveState();render();toast(button.dataset.deleteMode==='keep-history'?'Order bundle moved to Trash':adminOverride?'Finalized order and linked records erased':'Draft order permanently erased');break;
    }
    case 'receive-purchase': {
      const purchase=state.purchases.find(p=>p.id===id);if(!purchase||purchase.status!=='Pending')break;
      for(const line of purchase.lines||[]){const product=state.products.find(p=>p.id===line.productId);if(product){const before=product.stock;product.stock+=Number(line.qty)||0;state.stockMovements.unshift({id:idFor('STK',state.stockMovements),productId:product.id,product:product.name,date:today(),before,after:product.stock,delta:product.stock-before,reason:`Received ${purchase.id}`,user:currentWorkspaceUser().name});}}
      purchase.status='Received';recordActivity('Purchase order received',`${purchase.supplier} · ${purchase.lines.length} product lines`,purchase.id);saveState();render();toast('Purchase received and stock updated');break;
    }
    case 'delete-purchase': {
      const purchase=state.purchases.find(p=>p.id===id);if(!purchase)break;
      const adminOverride=isWorkspaceAdministrator()&&purchase.status==='Received';
      if(purchase.status==='Received'&&!adminOverride){toast('Only the Owner / Administrator can override deletion of a received purchase');break;}
      if(!button.dataset.deleteMode){openDeleteChoice(button,`Delete purchase ${id}?`,adminOverride?'Choose whether to move the purchase bundle to Trash or permanently erase its account entries, returns, and stock impact.':'Choose whether to move the purchase to Trash or permanently erase its account entries.','Move bundle to Trash','Erase everything');break;}
      const returns=(state.purchaseReturns||[]).filter(record=>record.purchaseId===id||record.purchaseOrderId===id);
      const accountEntries=state.entries.filter(entry=>['purchase','purchase-payment'].includes(entry.sourceType)&&entry.sourceId===id);
      if(button.dataset.deleteMode==='keep-history')archiveToTrashBin(state,'Purchase order',{purchase,returns,accountEntries},id,currentWorkspaceUser().name);
      if(adminOverride){
        const returnedByProduct=new Map();for(const ret of returns)returnedByProduct.set(ret.productId,(returnedByProduct.get(ret.productId)||0)+(Number(ret.qty)||0));
        for(const line of purchase.lines||[]){const product=state.products.find(p=>p.id===line.productId);if(!product)continue;const before=product.stock,qty=Math.max(0,(Number(line.qty)||0)-(returnedByProduct.get(line.productId)||0));if(!qty)continue;product.stock=Math.max(0,product.stock-qty);state.stockMovements.unshift({id:idFor('STK',state.stockMovements),productId:product.id,product:product.name,date:today(),before,after:product.stock,delta:product.stock-before,reason:`Admin deleted received purchase ${id}`,user:currentWorkspaceUser().name});}
      }
      removeAccountEntries(entry=>['purchase','purchase-payment'].includes(entry.sourceType)&&entry.sourceId===id);state.purchaseReturns=(state.purchaseReturns||[]).filter(record=>!returns.some(ret=>ret.id===record.id));
      state.purchases=state.purchases.filter(p=>p.id!==id);recordActivity(adminOverride?'Received purchase deleted by administrator':'Purchase order deleted',id,id);saveState();render();toast(button.dataset.deleteMode==='keep-history'?'Purchase bundle moved to Trash':adminOverride?'Received purchase and linked records erased':'Purchase order permanently erased');break;
    }
    case 'export-parties': {
      const list=type==='Supplier'?state.suppliers:state.customers;
      downloadCSV(type==='Supplier'?'tide-suppliers.csv':'tide-customers.csv',type==='Supplier'?[['Name','Phone','Email','Terms','Balance','Status'],...list.map(p=>[p.name,p.phone,p.email,p.terms,p.balance,p.status])]:[['Name','Phone','Email','Terms','Credit limit','Balance','Status'],...list.map(p=>[p.name,p.phone,p.email,p.terms,p.creditLimit||0,p.balance,p.status])]);break;
    }
    case 'download-product-template': downloadCSV('tide-product-template.csv',[['SKU','Name','Category','Price','Cost','Stock','Low stock','Unit']]);break;
    case 'remove-company-logo': state.companyLogo='';saveState();render();toast('Company logo removed');break;
    case 'product-stock-history': {
      const product=state.products.find(p=>p.id===id);if(!product)break;
      const rows=state.stockMovements.filter(m=>m.productId===id).map(m=>`<tr><td>${dateLabel(m.date)}</td><td>${esc(m.reason)}</td><td>${m.before}</td><td>${m.after}</td><td>${m.delta>0?'+':''}${m.delta}</td></tr>`).join('')||emptyRow(5,'No stock movements recorded');
      openModal('Stock history',product.name,`<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Reason</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table></div>`,'Close');break;
    }
    case 'adjust-stock': {
      const product = state.products.find(p => p.id === id); if (!product) break;
      openDialog('adjust-stock','Adjust stock',`Set the new on-hand quantity for ${esc(product.name)}.`,`${inputField('stock-new-quantity','New quantity','','number',true,product.stock)}${inputField('stock-reason','Reason','e.g. Count correction')}`,'Save adjustment');
      document.getElementById('modal-content').dataset.recordId = id; break;
    }
    case 'bulk-stock-adjust':
    case 'bulk-stocktake': {
      if(!state.products.length){toast('Add products to Inventory before adjusting stock');break;}
      const options=state.products.map(p=>`${p.id} · ${p.name}`);
      openDialog('bulk-adjust-stock',action==='bulk-stocktake'?'Stock take':'Bulk stock adjustment','Select a product and enter its verified on-hand count.',`${selectField('bulk-product','Product',options)}${inputField('bulk-quantity','Counted / new quantity','','number',true)}${inputField('stock-reason','Reason',action==='bulk-stocktake'?'e.g. Monthly stock take':'e.g. Damaged goods correction')}`,'Save stock');break;
    }
    case 'import-products': document.getElementById('product-csv-file')?.click(); break;
    case 'restore-trash': {
      const archived = state.trashBin.find(item => item.id === id);
      const res = restoreFromTrash(state, id);
      if (res.success) {
        for (const entry of archived?.data?.accountEntries || []) {
          const account = (entry.partyType === 'Supplier' ? state.suppliers : state.customers).find(item => item.name === entry.party);
          if (account) account.balance += entryBalanceDelta(entry.partyType, entry.type, Number(entry.amount) || 0);
        }
        if (archived?.type === 'Sales order' || archived?.type === 'POS sale') {
          const order = archived.data.order || archived.data;
          const restocked = new Map();
          for (const ret of archived.data.returns || []) if (ret.restocked) restocked.set(ret.productId, (restocked.get(ret.productId) || 0) + (Number(ret.qty) || 0));
          for (const line of order.items || []) {
            const product = state.products.find(item => item.id === line.productId);
            if (product) product.stock = Math.max(0, product.stock - Math.max(0, (Number(line.qty) || 0) - (restocked.get(line.productId) || 0)));
          }
        } else if (archived?.type === 'Purchase order') {
          const purchase = archived.data.purchase || archived.data;
          if (purchase.status === 'Received') for (const line of purchase.lines || []) {
            const product = state.products.find(item => item.id === line.productId);
            if (product) product.stock += Number(line.qty) || 0;
          }
        }
        saveState();
        render();
        toast(res.message);
      } else {
        toast(res.message);
      }
      break;
    }
    case 'clear-trash': {
      if (!isWorkspaceAdministrator()) { toast('Admin rights required to empty trash'); return; }
      if (!confirm('Permanently remove all items in the Trash bin?')) return;
      state.trashBin = [];
      saveState();
      render();
      toast('Trash bin permanently cleared');
      break;
    }
    case 'add-cart': addToCart(id); break;
    case 'cart-qty': {
      const line = posCart.find(x => x.id === id);
      if (line) {
        line.qty += Number(button.dataset.delta);
        if (line.qty <= 0) posCart = posCart.filter(x => x.id !== id);
        render();
      }
      break;
    }
    case 'clear-cart':
      posCart = []; posDraftOrderId = ''; posCustomer = 'Walk-in customer'; posMethod = 'Cash'; render();
      break;
    case 'complete-pos': completePOS(); break;
    case 'save-pos-draft': savePOSDraft(); break;
    case 'resume-pos': resumePOSDraft(id); break;
    case 'set-report-period': {
      const period=button.dataset.period;
      if(['weekly','monthly','annual'].includes(period)){reportPeriod=period;render();}
      break;
    }
    case 'delete-product': deleteProduct(id, button); break;
    case 'open-branch': switchBranch(id); break;
    case 'print-order-invoice': {
      const order = state.orders.find(o => o.id === id) || state.sales.find(s => s.id === id);
      if (order) printOrderInvoice(order);
      break;
    }
    case 'close-modal': document.getElementById('app-modal')?.close(); break;
    case 'export-sales':
      downloadCSV('tide-sales.csv', [['Reference', 'Customer', 'Date', 'Method', 'Amount', 'Status'], ...state.sales.map(s => [s.id, s.customer, s.date, s.method, s.total, s.status])]);
      break;
    case 'export-financial-report': {
      const report=reportPeriodData();
      const receivables=accountOutstandingTotal('Customer');
      const payables=accountOutstandingTotal('Supplier');
      const methodTotals=new Map();report.sales.forEach(sale=>{const method=sale.method||'Other';methodTotals.set(method,(methodTotals.get(method)||0)+(Number(sale.total)||0));});
      downloadCSV(`tide-financial-${reportPeriod}-${today()}.csv`,[['Report',report.label],['From',report.start],['To',report.end],[],['Measure','Amount TZS'],['Sales revenue',report.salesTotal],['Customer payments collected',report.collected],['Purchases ordered',report.purchaseTotal],['Supplier payments made',report.supplierPaid],['Net cash movement',report.netCollected],['Customer receivables',receivables],['Supplier payables',payables],[],['Sales by payment method','Amount TZS'],...Array.from(methodTotals)]);
      break;
    }
    case 'export-inventory':
      downloadCSV('tide-inventory.csv', [['SKU', 'Product', 'Category', 'Price TZS', 'Cost TZS', 'Stock', 'Unit'], ...sortProducts(state.products).map(p => [p.id, p.name, p.category, p.price, p.cost, p.stock, p.unit])]);
      break;
    case 'export-ledger':
      downloadCSV('tide-ledger.csv', [['Reference', 'Type', 'Party', 'Date', 'Entry', 'Amount TZS', 'Memo'], ...state.entries.map(e => [e.id, e.partyType, e.party, e.date, e.type, e.amount, e.memo])]);
      break;
    default:
      console.log('Action triggered:', action);
  }
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('CSV download ready');
}

function importProductsCSV(csv) {
  const rows=csv.split(/\r?\n/).filter(line=>line.trim());if(rows.length<2){toast('CSV has no product rows');return;}
  const parse=line=>line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(cell=>cell.trim().replace(/^"|"$/g,'').replaceAll('""','"'));
  const headers=parse(rows[0]).map(h=>h.toLowerCase().replace(/[ _-]/g,''));
  const index=(...names)=>headers.findIndex(h=>names.includes(h));
  let added=0;
  for(const rowText of rows.slice(1)){
    const row=parse(rowText),name=row[index('name','product','productname')]||'';if(!name)continue;
    const sku=row[index('sku','code','id')]||idFor('SKU',state.products);
    const product={id:sku,name,category:row[index('category')]||'General',price:Number(row[index('price','sellingprice')])||0,cost:Number(row[index('cost','unitcost')])||0,stock:Math.max(0,Number(row[index('stock','quantity')])||0),low:Math.max(0,Number(row[index('lowstock','reorderlevel')])||0),unit:row[index('unit','measurementunit')]||'Piece',status:'Active'};
    const existing=state.products.find(p=>p.id===sku);if(existing)Object.assign(existing,product);else{state.products.unshift(product);added++;}
  }
  saveState();render();toast(`${added} product${added===1?'':'s'} imported`);
}

// Keep table action menus outside the scroll-clipped table.
let orderActionsPortal = null;
let orderActionsAnchor = null;
let dateFilterPortal = null;
let dateFilterAnchor = null;
function closeDateFilterPortal() {
  dateFilterPortal?.remove();
  dateFilterPortal = null;
  dateFilterAnchor = null;
}
function positionDateFilterPortal() {
  if (!dateFilterPortal || !dateFilterAnchor?.isConnected) { closeDateFilterPortal(); return; }
  const rect = dateFilterAnchor.getBoundingClientRect();
  const width = Math.min(250, window.innerWidth - 24);
  const height = dateFilterPortal.getBoundingClientRect().height;
  let left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 8 && rect.top - height - 6 >= 8) top = rect.top - height - 6;
  top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
  Object.assign(dateFilterPortal.style, { left: `${left}px`, top: `${top}px`, width: `${width}px` });
}
function openDateFilterPortal(details) {
  closeDateFilterPortal();
  const popover = details.querySelector('.date-filter-popover');
  if (!popover) return;
  dateFilterAnchor = details.querySelector('summary');
  dateFilterPortal = document.createElement('div');
  dateFilterPortal.className = 'date-filter-popover date-filter-portal';
  dateFilterPortal.innerHTML = popover.innerHTML;
  document.body.append(dateFilterPortal);
  positionDateFilterPortal();
}
document.addEventListener('click', event => {
  const summary = event.target.closest('.date-filter > summary');
  if (summary) {
    event.preventDefault();
    const details = summary.closest('details');
    if (dateFilterAnchor === summary) closeDateFilterPortal(); else openDateFilterPortal(details);
    return;
  }
  if (dateFilterPortal && !event.target.closest('.date-filter-portal')) closeDateFilterPortal();
}, true);
window.addEventListener('scroll', positionDateFilterPortal, true);
window.addEventListener('resize', positionDateFilterPortal);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDateFilterPortal(); });

function closeOrderActionsPortal() {
  orderActionsPortal?.remove();
  orderActionsPortal = null;
  orderActionsAnchor = null;
}
function positionOrderActionsPortal() {
  if (!orderActionsPortal || !orderActionsAnchor?.isConnected) { closeOrderActionsPortal(); return; }
  const anchor = orderActionsAnchor.querySelector('summary');
  if (!anchor) { closeOrderActionsPortal(); return; }
  const rect = anchor.getBoundingClientRect();
  const width = orderActionsAnchor.classList.contains('purchase-actions') ? 220 : orderActionsAnchor.classList.contains('party-actions') ? 210 : 190;
  const height = Math.min(orderActionsPortal.scrollHeight, window.innerHeight - 16);
  let left = rect.right - width;
  if (left < 8) left = rect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  let top = rect.bottom + 4;
  if (top + height > window.innerHeight - 8 && rect.top - height - 4 >= 8) top = rect.top - height - 4;
  top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
  Object.assign(orderActionsPortal.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, maxHeight: `${window.innerHeight - 16}px` });
}
function openOrderActionsPortal(details) {
  closeOrderActionsPortal();
  const menu = details.querySelector('.order-actions-menu');
  if (!menu) return;
  orderActionsAnchor = details;
  orderActionsPortal = document.createElement('div');
  orderActionsPortal.className = 'order-actions-portal order-actions-menu';
  orderActionsPortal.setAttribute('role', 'menu');
  orderActionsPortal.innerHTML = menu.innerHTML;
  document.body.append(orderActionsPortal);
  positionOrderActionsPortal();
}
document.addEventListener('click', event => {
  const summary = event.target.closest('.sales-order-actions > summary, .purchase-actions > summary, .party-actions > summary');
  if (summary) {
    event.preventDefault();
    const details = summary.closest('details');
    if (orderActionsAnchor === details) closeOrderActionsPortal(); else openOrderActionsPortal(details);
    return;
  }
  if (orderActionsPortal && !event.target.closest('.order-actions-portal')) closeOrderActionsPortal();
}, true);
document.addEventListener('click', event => {
  if (event.target.closest('.order-actions-portal [data-action]')) closeOrderActionsPortal();
}, true);
window.addEventListener('scroll', positionOrderActionsPortal, true);
window.addEventListener('resize', positionOrderActionsPortal);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeOrderActionsPortal(); });

// Global Event Listeners
document.addEventListener('click', event => {
  const nav = event.target.closest('[data-page]');
  if (nav) { setPage(nav.dataset.page); return; }
  const action = event.target.closest('[data-action]');
  if (action) handleAction(action);
});

document.addEventListener('submit', event => {
  if (event.target.id === 'company-settings-form') {
    event.preventDefault();
    if(!isWorkspaceAdministrator()&&!userHasPermission('settings','edit-company')){toast('You do not have permission to change company settings');return;}
    saveCompanySettings(event.target);
  } else if (event.target.id === 'modal-content' && event.target.dataset.dialogKind) {
    event.preventDefault();
    handleDialogSubmit(event.target);
  }
});

document.addEventListener('input', event => {
  const searchKind = event.target.dataset.transactionSearch;
  if (searchKind) renderTransactionSuggestions(searchKind, event.target.value);
  const lineHost = event.target.closest('#order-product-lines, #purchase-product-lines');
  if (lineHost) updateTransactionLines(lineHost.id.startsWith('order-') ? 'order' : 'purchase');
  const summary = event.target.closest('[data-transaction-summary]');
  if (summary) transactionLineTotals(summary.dataset.transactionSummary);
  if (event.target.id === 'table-search') {
    tableQuery = event.target.value;
    render();
  }
  if (event.target.id === 'pos-search') {
    const term = event.target.value.toLowerCase();
    document.getElementById('pos-products').innerHTML = productCards(
      activeProducts().filter(p => (!posCategory || p.category === posCategory) && `${p.name} ${p.category} ${p.id}`.toLowerCase().includes(term))
    );
    refreshPermissionVisibility();
  }
});

document.addEventListener('change', event => {
  if (event.target.id === 'sales-status') { salesStatusFilter = event.target.value; render(); }
  if (event.target.id === 'purchase-status') { purchaseStatusFilter = event.target.value; render(); }
  if(event.target.matches('[data-permission-module]')){
    const group=event.target.closest('fieldset');
    group?.querySelectorAll('input[name="user-permission"]').forEach(input=>{input.checked=event.target.checked;});
    event.target.indeterminate=false;
  }
  if(event.target.matches('input[name="user-permission"]')){
    const group=event.target.closest('fieldset'),parent=group?.querySelector('[data-permission-module]');
    const children=[...(group?.querySelectorAll('input[name="user-permission"]')||[])],checked=children.filter(input=>input.checked).length;
    if(parent){parent.checked=checked===children.length;parent.indeterminate=checked>0&&checked<children.length;}
  }
  if (event.target.id === 'pos-category') {
    posCategory = event.target.value;
    render();
  }
  if (event.target.id === 'pos-customer') posCustomer = event.target.value;
  if (event.target.id === 'pos-method') posMethod = event.target.value;
  if (event.target.id === 'dashboard-range') {
    dashboardRange = event.target.value;
    render();
  }
  if (event.target.id === 'product-csv-file' && event.target.files?.[0]) {
    const reader=new FileReader();reader.onload=()=>importProductsCSV(String(reader.result||''));reader.readAsText(event.target.files[0]);event.target.value='';
  }
});

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

document.getElementById('back-button')?.addEventListener('click', navigateBack);

window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);

// Keyboard shortcuts: / for POS search, Ctrl+K for general search
document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (page !== 'inventory') setPage('inventory');
    setTimeout(() => document.getElementById('table-search')?.focus(), 0);
  } else if (event.key === '/' && !typing) {
    event.preventDefault();
    if (page === 'pos') document.getElementById('pos-search')?.focus();
    else {
      setPage('inventory');
      setTimeout(() => document.getElementById('table-search')?.focus(), 0);
    }
  }
});

const sidebar = document.getElementById('sidebar');
const sidebarToggleButton = document.getElementById('sidebar-toggle');
const sidebarHoverZone = document.getElementById('sidebar-hover-zone');
let sidebarCloseTimer = 0;
const isDesktopSidebar = () => window.innerWidth > 760;
if (sidebar) {
  sidebar.classList.remove('hover-expanded', 'open');
  if (isDesktopSidebar()) sidebar.classList.add('collapsed');
  else sidebar.classList.remove('collapsed');
}

function updateSidebarToggleLabel() {
  if (!sidebarToggleButton) return;
  const open = sidebar?.classList.contains('open') || sidebar?.classList.contains('pinned-open') || false;
  const label = open ? 'Close navigation' : sidebar?.classList.contains('hover-expanded') ? 'Keep navigation open' : 'Open navigation';
  sidebarToggleButton.setAttribute('aria-label', label);
  sidebarToggleButton.setAttribute('title', label);
  sidebarToggleButton.textContent = open ? '×' : '☰';
}
function expandSidebarForPointer() {
  window.clearTimeout(sidebarCloseTimer);
  if (isDesktopSidebar() && sidebar?.classList.contains('collapsed')) sidebar.classList.add('hover-expanded');
  updateSidebarToggleLabel();
}
function scheduleSidebarCollapse() {
  window.clearTimeout(sidebarCloseTimer);
  sidebarCloseTimer = window.setTimeout(() => {
    if (isDesktopSidebar() && sidebar?.classList.contains('collapsed') && !sidebar.classList.contains('pinned-open') && !sidebar.matches(':hover') && !sidebar.contains(document.activeElement)) {
      sidebar.classList.remove('hover-expanded');
      updateSidebarToggleLabel();
    }
  }, 1000);
}
sidebarToggleButton?.addEventListener('click', () => {
  if (isDesktopSidebar()) {
    if (sidebar?.classList.contains('pinned-open')) {
      sidebar.classList.remove('pinned-open', 'hover-expanded');
    } else if (sidebar?.classList.contains('collapsed')) {
      sidebar.classList.add('pinned-open', 'hover-expanded');
    } else {
      sidebar?.classList.add('collapsed');
    }
  } else {
    sidebar?.classList.toggle('open');
  }
  updateSidebarToggleLabel();
});
sidebar?.addEventListener('pointerenter', expandSidebarForPointer);
sidebar?.addEventListener('pointerleave', scheduleSidebarCollapse);
sidebar?.addEventListener('focusin', expandSidebarForPointer);
sidebar?.addEventListener('focusout', scheduleSidebarCollapse);
sidebarHoverZone?.addEventListener('pointerenter', expandSidebarForPointer);
sidebarHoverZone?.addEventListener('pointerleave', scheduleSidebarCollapse);
document.addEventListener('click', event => {
  const clickedOutside = !sidebar?.contains(event.target) && !sidebarToggleButton?.contains(event.target) && !sidebarHoverZone?.contains(event.target);
  if (!clickedOutside) return;
  if (isDesktopSidebar() && sidebar?.classList.contains('hover-expanded') && !sidebar.classList.contains('pinned-open')) {
    window.clearTimeout(sidebarCloseTimer);
    sidebar.classList.remove('hover-expanded');
  }
  if (window.innerWidth <= 760 && sidebar?.classList.contains('open')) {
    sidebar.classList.remove('open');
    updateSidebarToggleLabel();
  }
});
updateSidebarToggleLabel();
window.addEventListener('resize', () => {
  window.clearTimeout(sidebarCloseTimer);
  if (!sidebar) return;
  sidebar.classList.remove('hover-expanded', 'pinned-open', 'open');
  if (isDesktopSidebar()) sidebar.classList.add('collapsed');
  else sidebar.classList.remove('collapsed');
  updateSidebarToggleLabel();
});
// App Initialization
async function initApp() {
  applyTheme(safeStorageGet(THEME_KEY) === 'dark' ? 'dark' : 'light');

  // Load from IndexedDB (or seamlessly migrate from localStorage)
  state = await loadPersistedState(initialState);
  activeBranch = state.branches.find(b => b.id === state.activeBranchId) || state.branches[0] || { id: 'BR-MAIN', name: 'Main branch' };
  state.activeBranchId = activeBranch.id;
  state.branch = activeBranch.name;

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const todayLabel = document.getElementById('today-label');
  if (todayLabel) {
    todayLabel.textContent = new Intl.DateTimeFormat('en-TZ', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      timeZone: 'Africa/Dar_es_Salaam'
    }).format(new Date());
  }

  render();
}

// Start app
initApp();
