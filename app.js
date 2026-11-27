
const THEME_KEY = 'tide-erp-theme';
const AUTH_SESSION_KEY = 'tide-erp-auth-user';
const LOCK_STATE_KEY = 'tide-erp-session-locked';
const LAST_ACTIVITY_KEY = 'tide-erp-last-activity';
const DEFAULT_AUTO_LOCK_MINUTES = 20;
const ADMIN_LOGIN_EMAIL = 'chikongoeemmanuel@gmail.com';
const ADMIN_LOGIN_USERNAME = 'Admin';
const ADMIN_INITIAL_PASSWORD = 'Admin123';
function safeStorageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeStorageSet(key, value) { try { localStorage.setItem(key, value); } catch { } }
function safeStorageRemove(key) { try { localStorage.removeItem(key); } catch { } }
function safeSessionGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
function safeSessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch { } }
function safeSessionRemove(key) { try { sessionStorage.removeItem(key); } catch { } }

const initialState = {
  version: 3,
  companyName: 'My Company',
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
  expenses: [],
  entries: [],
  queue: [],
  stockMovements: [],
  users: [
    {
      id: 'USR-OWNER',
      name: 'Administrator',
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
  currentUserId: '',
  companyAdminId: '',
  currency: 'TZS',
  vatEnabled: true,
  vatRate: 18,
  autoLockMinutes: 20,
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
  activityLog: [],
  stocktakeDraft: null,
  stocktakes: [
    {
      id: 'STK-REC-101',
      date: '2026-11-21T10:30:00.000Z',
      dateStr: '2026-11-21',
      reason: 'Bi-weekly physical stock take audit',
      user: 'Administrator',
      totalProducts: 4,
      countedProducts: 4,
      matchedCount: 3,
      shortageCount: 1,
      surplusCount: 0,
      netQtyDelta: -2,
      netValueDelta: -7000,
      items: [
        { productId: 'PRD-1001', productName: 'Azam Wheat Flour 1kg', sku: 'PRD-1001', beforeStock: 45, countedStock: 45, delta: 0, expiryDate: '2027-04-15' },
        { productId: 'PRD-1002', productName: 'Kilombero Pure Rice 5kg', sku: 'PRD-1002', beforeStock: 30, countedStock: 28, delta: -2, expiryDate: '2027-08-20' },
        { productId: 'PRD-1003', productName: 'Korie Cooking Oil 1L', sku: 'PRD-1003', beforeStock: 50, countedStock: 50, delta: 0, expiryDate: '2027-11-10' },
        { productId: 'PRD-1004', productName: 'White Star Sugar 1kg', sku: 'PRD-1004', beforeStock: 60, countedStock: 60, delta: 0, expiryDate: '2027-05-30' }
      ]
    }
  ]
};

const branchCollections = [
  'products', 'customers', 'suppliers', 'orders', 'sales',
  'returns', 'purchaseReturns', 'purchases', 'expenses', 'entries', 'queue',
  'stockMovements', 'trashBin', 'stocktakeDraft', 'stocktakes'
];

let state = structuredClone(initialState);
let activeBranch = state.branches[0];
let page = 'home';
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
let reportActiveTab = 'overview';
let reportSearchQuery = '';
let reportPaymentDirectionFilter = '';
let reportPaymentMethodFilter = '';
let inventoryMovementTypeFilter = '';
let tableQuery = '';
let selectedProductIds = new Set();
let inventoryExpiryTab = 'attention';
let salesStatusFilter = '';
let salesPaymentFilter = '';
let salesDeliveryFilter = '';
let salesDateFrom = '';
let salesDateTo = '';
let purchaseStatusFilter = '';
let purchaseDateFrom = '';
let purchaseDateTo = '';
let expenseStatusFilter = '';
let expenseDateFrom = '';
let expenseDateTo = '';
let orderMenuPortal = null;
let pendingCompanyLogo = '';
let authErrorMessage = '';

function getProductExpiryInfo(product) {
  if (!product || !product.expiryDate) {
    return { status: 'none', label: 'No expiry', days: null, class: 'muted' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(product.expiryDate);
  exp.setHours(0, 0, 0, 0);
  if (isNaN(exp.getTime())) {
    return { status: 'none', label: 'Invalid date', days: null, class: 'muted' };
  }
  const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { status: 'expired', label: `Expired (${Math.abs(diffDays)}d ago)`, days: diffDays, class: 'expired' };
  } else if (diffDays === 0) {
    return { status: 'expiring-soon', label: 'Expires today', days: 0, class: 'expiring-soon' };
  } else if (diffDays <= 30) {
    return { status: 'expiring-soon', label: `Expires in ${diffDays}d`, days: diffDays, class: 'expiring-soon' };
  } else if (diffDays <= 90) {
    return { status: 'expiring-warning', label: `Expires in ${diffDays}d`, days: diffDays, class: 'expiring-warning' };
  } else {
    return { status: 'healthy', label: `Valid (${product.expiryDate})`, days: diffDays, class: 'healthy' };
  }
}

function parseCSVNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let s = String(val).trim();
  s = s.replace(/^["'\s]+|["'\s]+$/g, '');
  s = s.replace(/^[^\d.-]+/, '').replace(/[^\d.-]+$/, '').trim();
  s = s.replace(/(\d)\s+(\d)/g, '$1$2');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/^\d+(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',') && !s.includes('.')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1) {
      s = s.replace(/,/g, '');
    } else if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0] + '.' + parts[1];
    } else {
      s = s.replace(/,/g, '');
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseCSVDate(val) {
  if (!val) return '';
  const s = String(val).trim().replace(/^["']|["']$/g, '');
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const ymd = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function detectCSVDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function parseCSVLine(line, delimiter = ',') {
  if (delimiter === '\t') {
    return line.split('\t').map(c => c.trim().replace(/^"|"$/g, '').replaceAll('""', '"'));
  }
  const sep = delimiter === ';' ? ';' : ',';
  const regex = new RegExp(`${sep}(?=(?:[^"]*"[^"]*")*[^"]*$)`);
  return line.split(regex).map(c => c.trim().replace(/^"|"$/g, '').replaceAll('""', '"'));
}

function toBase64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function fromBase64(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
async function passwordDigest(password, salt) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure password storage is unavailable in this browser context. Open the app on localhost or HTTPS.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, key, 256);
  return toBase64(bits);
}
async function setUserPassword(user, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  user.passwordSalt = toBase64(salt);
  user.passwordHash = await passwordDigest(password, salt);
  user.passwordAlgorithm = 'PBKDF2-SHA256';
}
async function verifyUserPassword(user, password) {
  if (!user?.passwordHash || !user.passwordSalt) return false;
  const actual = fromBase64(await passwordDigest(password, fromBase64(user.passwordSalt)));
  const expected = fromBase64(user.passwordHash);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual[i] ^ expected[i];
  return mismatch === 0;
}
function normalizedLogin(value) { return String(value || '').trim().toLocaleLowerCase(); }
function credentialsAvailable(username, email, exceptId = '') {
  const wanted = new Set([normalizedLogin(username), normalizedLogin(email)].filter(Boolean));
  return !state.users.some(user => {
    if (user.id === exceptId) return false;
    return [normalizedLogin(user.username), normalizedLogin(user.email)].some(value => value && wanted.has(value));
  });
}

const userModuleChoices = [
  ['dashboard', 'Overview'],
  ['sales', 'Sales & Orders'],
  ['pos', 'Point of Sale'],
  ['inventory', 'Inventory'],
  ['purchases', 'Purchases'],
  ['expenses', 'Expenses'],
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
  'Administrator': userModuleChoices.map(m => m[0]),
  'Admin': userModuleChoices.map(m => m[0]),
  'Owner': userModuleChoices.map(m => m[0]),
  'Manager': ['dashboard', 'sales', 'pos', 'inventory', 'purchases', 'expenses', 'customers', 'suppliers', 'accounting', 'reports', 'branches'],
  'Salesman': ['dashboard', 'sales', 'pos', 'customers'],
  'Storekeeper': ['dashboard', 'inventory', 'purchases']
};

const userActionPermissions = [
  { module: 'dashboard', actions: [['view', 'View overview'], ['sales-performance', 'View sales performance'], ['business-performance', 'View business performance'], ['stock-alerts', 'View stock alerts']] },
  { module: 'sales', actions: [['view', 'View sales and orders'], ['create', 'Create sales orders'], ['edit', 'Edit sales orders'], ['delete', 'Delete sales orders'], ['payments', 'Record payments'], ['returns', 'Manage returns'], ['print', 'Print invoices'], ['export', 'Export sales']] },
  { module: 'pos', actions: [['open', 'Open POS'], ['draft', 'Save POS drafts'], ['finalize', 'Complete checkout'], ['payments', 'Record POS payments'], ['refunds', 'Process refunds']] },
  { module: 'inventory', actions: [['view', 'View products and stock'], ['add-products', 'Add products'], ['edit-products', 'Edit products'], ['delete-products', 'Delete products'], ['adjust-stock', 'Adjust stock'], ['stock-history', 'View stock history'], ['stocktake', 'Run stock take'], ['bulk-import', 'Import products in bulk'], ['export', 'Export products']] },
  { module: 'purchases', actions: [['view', 'View purchases'], ['create', 'Create purchase orders'], ['edit', 'Edit purchase orders'], ['delete', 'Delete purchases'], ['receive', 'Receive stock'], ['payments', 'Record supplier payments'], ['returns', 'Manage supplier returns'], ['invoices', 'Upload and view invoices']] },
  { module: 'expenses', actions: [['view', 'View expenses'], ['create', 'Record expenses'], ['edit', 'Edit expenses'], ['mark-paid', 'Mark expenses as paid'], ['delete', 'Delete expenses'], ['export', 'Export expenses']] },
  { module: 'customers', actions: [['view', 'View customers'], ['add', 'Add customers'], ['edit', 'Edit customers'], ['delete', 'Delete customers'], ['activate', 'Activate or deactivate customers'], ['account-view', 'View account history'], ['order-history', 'View customer past orders'], ['payments', 'Record customer payments'], ['export', 'Export customers']] },
  { module: 'suppliers', actions: [['view', 'View suppliers'], ['add', 'Add suppliers'], ['edit', 'Edit suppliers'], ['delete', 'Delete suppliers'], ['activate', 'Activate or deactivate suppliers'], ['account-view', 'View account history'], ['order-history', 'View supplier past purchase orders'], ['payments', 'Record supplier payments'], ['returns', 'Manage supplier returns'], ['payment-details', 'View payment details'], ['export', 'Export suppliers']] },
  { module: 'accounting', actions: [['view', 'View accounting and ledger'], ['record-payments', 'Record account payments'], ['manage-entries', 'Manage account entries'], ['export', 'Export ledger']] },
  { module: 'reports', actions: [['view', 'View reports'], ['export', 'Export reports']] },
  { module: 'settings', actions: [['view', 'View settings'], ['edit-company', 'Edit company details'], ['edit-logo', 'Change company logo'], ['manage-branches', 'Manage branches']] },
  { module: 'users', actions: [['view', 'View users'], ['add', 'Add users'], ['edit', 'Edit users'], ['change-roles', 'Change user roles'], ['manage-permissions', 'Manage permissions'], ['activate', 'Activate or deactivate users'], ['delete', 'Delete users']] },
  { module: 'branches', actions: [['view', 'View branches'], ['open', 'Open branch workspaces'], ['manage', 'Manage branches']] }
];

function isAdministratorUser(user) {
  if (!user || user.role === 'Guest' || !user.id || user.status === 'Inactive') return false;
  if (user.isBootstrap) return true;
  return Boolean(
    user.role === 'Owner / Administrator' ||
    user.role === 'Administrator' ||
    user.role === 'Admin' ||
    user.role === 'Owner'
  );
}

function rolePermissionMap(role, modules = userRoleDefaults[role] || []) {
  if (role === 'Owner / Administrator' || role === 'Administrator' || role === 'Admin' || role === 'Owner') {
    return Object.fromEntries(userActionPermissions.map(group => [group.module, group.actions.map(([action]) => action)]));
  }
  return Object.fromEntries(userActionPermissions.map(group => [group.module, modules.includes(group.module) ? group.actions.map(([action]) => action) : []]));
}

function effectiveUserPermissions(user = currentWorkspaceUser()) {
  if (!user || user.role === 'Guest' || !user.id || user.status === 'Inactive') return {};
  if (user.isBootstrap) return rolePermissionMap('Owner / Administrator');
  const stored = user.permissions && typeof user.permissions === 'object' ? user.permissions : {};
  const explicit = Object.keys(stored).some(module => module !== '*');
  const modules = Array.isArray(user.modules) ? user.modules : (userRoleDefaults[user.role] || []);
  const defaults = rolePermissionMap(user.role, modules);
  const result = {};
  for (const group of userActionPermissions) {
    const selected = Array.isArray(stored[group.module]) ? stored[group.module] : (explicit ? [] : defaults[group.module] || []);
    result[group.module] = selected.includes('*') ? group.actions.map(([action]) => action) : selected.filter(action => group.actions.some(([candidate]) => candidate === action));
  }
  return result;
}

function userHasPermission(module, action, user = currentWorkspaceUser()) {
  if (!user || user.role === 'Guest' || !user.id || user.status === 'Inactive') return false;
  if (user.isBootstrap) return true;
  return (effectiveUserPermissions(user)[module] || []).includes(action);
}

function canViewPage(module, user = currentWorkspaceUser()) {
  if (module === 'home') return true;
  if (!user || user.role === 'Guest' || !user.id || user.status === 'Inactive') return false;
  if (user.isBootstrap) return true;
  if (module === 'dashboard') return userHasPermission('dashboard', 'view', user);
  if (module === 'pos') return userHasPermission('pos', 'open', user) || userHasPermission('pos', 'view', user);
  if (module === 'products') return userHasPermission('inventory', 'view', user) || userHasPermission('inventory', 'add-products', user) || userHasPermission('inventory', 'edit-products', user);
  if (module === 'inventory') return userHasPermission('inventory', 'stocktake', user) || userHasPermission('inventory', 'adjust-stock', user) || userHasPermission('inventory', 'stock-history', user);
  if (module === 'expenses') return userHasPermission('expenses', 'view', user) || userHasPermission('expenses', 'create', user) || userHasPermission('accounting', 'view', user);
  return userHasPermission(module, 'view', user);
}

function canPerformAction(action, element = null) {
  if (['close-modal', 'view-attachment', 'delete-attachment', 'download-attachment', 'add-attachment', 'view-entry-attachments', 'lock-screen', 'unlock-switch-account'].includes(action)) return true;
  const user = currentWorkspaceUser();
  if (!state.currentUserId || !user || user.role === 'Guest' || !user.id || user.status === 'Inactive') return false;
  if (user.isBootstrap) return true;
  const type = element?.dataset?.partyType;
  const require = (module, permission) => userHasPermission(module, permission, user);
  switch (action) {
    case 'new-order': return require('sales', 'create');
    case 'edit-order': { const order = state.orders.find(item => item.id === element?.dataset?.id); return order?.source === 'POS' ? (require('pos', 'draft') || require('pos', 'finalize') || require('sales', 'edit')) : require('sales', 'edit'); }
    case 'finalize-order': { const order = state.orders.find(item => item.id === element?.dataset?.id); return order?.source === 'POS' ? require('pos', 'finalize') : require('sales', 'edit'); }
    case 'view-order': return require('sales', 'view');
    case 'print-order-invoice': return require('sales', 'print');
    case 'add-order-payment': return require('sales', 'payments');
    case 'manage-order-returns': return require('sales', 'returns');
    case 'manage-delivery-issues': return require('sales', 'view') || require('sales', 'edit');
    case 'toggle-discrepancy-status': case 'delete-discrepancy': return require('sales', 'edit');
    case 'delete-order': return user.isBootstrap || (isAdministratorUser(user) && require('sales', 'delete'));
    case 'view-customer-orders': return require('customers', 'order-history');
    case 'edit-party': return require(type === 'Supplier' ? 'suppliers' : 'customers', 'edit');
    case 'delete-party': return user.isBootstrap || (isAdministratorUser(user) && require(type === 'Supplier' ? 'suppliers' : 'customers', 'delete'));
    case 'toggle-party': return require(type === 'Supplier' ? 'suppliers' : 'customers', 'activate');
    case 'view-party-orders': return require(type === 'Supplier' ? 'suppliers' : 'customers', 'order-history');
    case 'add-cart': case 'cart-qty': case 'clear-cart': return require('pos', 'open');
    case 'save-pos-draft': case 'resume-pos': return require('pos', 'draft');
    case 'complete-pos': return require('pos', 'finalize');
    case 'new-product': return require('inventory', 'add-products');
    case 'edit-product': return require('inventory', 'edit-products');
    case 'delete-product': return require('inventory', 'delete-products');
    case 'bulk-delete-products': return require('inventory', 'delete-products');
    case 'adjust-stock': case 'bulk-stock-adjust': return require('inventory', 'adjust-stock');
    case 'bulk-stocktake': case 'open-stocktake': case 'finalize-stocktake': case 'resume-stocktake': case 'pause-stocktake': case 'discard-stocktake-draft': return require('inventory', 'stocktake');
    case 'view-stocktake-session': return require('inventory', 'view');
    case 'revoke-stocktake-session': case 'edit-stocktake-session': case 'delete-stocktake-session':
      return user.isBootstrap || (isAdministratorUser(user) && require('inventory', 'stocktake'));
    case 'revoke-stock-movement': case 'edit-stock-movement': case 'delete-stock-movement':
      return user.isBootstrap || (isAdministratorUser(user) && require('inventory', 'adjust-stock'));
    case 'export-stocktakes': case 'export-stock-movements': return require('inventory', 'export');
    case 'export-product-sales': case 'export-product-purchases': case 'export-payment-report': return require('reports', 'view');
    case 'view-product-sales-history': case 'view-product-purchase-history': return require('reports', 'view');
    case 'product-stock-history': return require('inventory', 'stock-history');
    case 'import-products': return require('inventory', 'bulk-import');
    case 'download-product-template': return require('inventory', 'export');
    case 'export-expiry-report': return require('inventory', 'export');
    case 'write-off-expired': return require('inventory', 'adjust-stock');
    case 'clearance-discount': case 'edit-expiry': return require('inventory', 'edit-products');
    case 'jump-to-expiry': case 'filter-expiry-tab': case 'set-report-tab': return true;
    case 'view-purchase': return require('purchases', 'view');
    case 'new-purchase': return require('purchases', 'create');
    case 'edit-purchase': return require('purchases', 'edit');
    case 'receive-purchase': return require('purchases', 'receive');
    case 'purchase-payment': return require('purchases', 'payments');
    case 'return-purchase': return require('purchases', 'returns');
    case 'delete-purchase': return user.isBootstrap || (isAdministratorUser(user) && require('purchases', 'delete'));
    case 'new-expense': return require('expenses', 'create') || require('accounting', 'manage-entries');
    case 'edit-expense': return require('expenses', 'edit') || require('accounting', 'manage-entries');
    case 'view-expense': return require('expenses', 'view') || require('accounting', 'view');
    case 'mark-expense-paid': return require('expenses', 'mark-paid') || require('expenses', 'edit') || require('accounting', 'record-payments');
    case 'delete-expense': return user.isBootstrap || (isAdministratorUser(user) && (require('expenses', 'delete') || require('accounting', 'manage-entries')));
    case 'export-expenses': return require('expenses', 'export') || require('accounting', 'export');
    case 'new-party': return require(type === 'Supplier' ? 'suppliers' : 'customers', 'add');
    case 'export-parties': return require(type === 'Supplier' ? 'suppliers' : 'customers', 'export');
    case 'record-payment': return page === 'accounting' ? require('accounting', 'record-payments') : type === 'Supplier' ? require('suppliers', 'payments') : type === 'Customer' ? require('customers', 'payments') : require('accounting', 'record-payments');
    case 'view-account-ledger': return require('accounting', 'view') || (type === 'Supplier' ? require('suppliers', 'account-view') : require('customers', 'account-view'));
    case 'reconcile-account': return require('accounting', 'manage-entries');
    case 'set-report-period': return require('reports', 'view');
    case 'export-financial-report': return require('reports', 'export');
    case 'export-sales': return page === 'reports' ? require('reports', 'export') : require('sales', 'export');
    case 'export-inventory': return page === 'reports' ? require('reports', 'export') : require('inventory', 'export');
    case 'export-ledger': return page === 'reports' ? require('reports', 'export') : require('accounting', 'export');
    case 'remove-company-logo': return require('settings', 'edit-logo');
    case 'clear-trash': case 'restore-trash': return user.isBootstrap || (isAdministratorUser(user) && require('settings', 'edit-company'));
    case 'new-user': return user.isBootstrap || (isAdministratorUser(user) && require('users', 'add'));
    case 'edit-user': return user.isBootstrap || (isAdministratorUser(user) && require('users', 'edit'));
    case 'set-user-credentials': return user.isBootstrap || (isAdministratorUser(user) && require('users', 'edit'));
    case 'edit-user-permissions': return user.isBootstrap || (isAdministratorUser(user) && require('users', 'manage-permissions'));
    case 'toggle-user': return require('users', 'activate');
    case 'delete-user': return user.isBootstrap || (isAdministratorUser(user) && require('users', 'delete'));
    case 'new-branch': return user.isBootstrap || (isAdministratorUser(user) && require('branches', 'manage'));
    case 'open-branch': return userCanManageAllBranches(user) && require('branches', 'open');
    case 'select-transaction-product': case 'remove-transaction-product': return element?.dataset?.kind === 'purchase' ? require('purchases', 'create') : require('sales', 'create');
    default: return true;
  }
}

const pageLabels = {
  home: 'Home', dashboard: 'Overview', sales: 'Sales', pos: 'Point of sale',
  products: 'Product Management', inventory: 'Inventory Management', purchases: 'Purchases', expenses: 'Expenses', customers: 'Customers',
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

function renderAuthGate(message = '', initialTab = 'login') {
  const isRegister = initialTab === 'register';
  const gate = document.getElementById('auth-gate');
  const shell = document.querySelector('.app-shell');
  if (!gate || !shell) return;
  shell.hidden = true;
  gate.hidden = false;
  gate.innerHTML = `
    <div class="auth-gate-container">
      <!-- Left Column: Living Accounting & Economics Observatory -->
      <section class="auth-hero-economic" aria-label="Tide ERP Financial Observatory">
        <div class="auth-hero-header">
          <div class="auth-hero-brand">
            <div class="hero-brand-mark">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36">
                <defs>
                  <linearGradient id="heroMarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0a1e36"/>
                    <stop offset="100%" stop-color="#163863"/>
                  </linearGradient>
                </defs>
                <rect width="64" height="64" rx="18" fill="url(#heroMarkGrad)"/>
                <rect width="60" height="60" x="2" y="2" rx="16" fill="none" stroke="#ff6a00" stroke-width="2.5" stroke-opacity="0.85"/>
                <path d="M37 12v12h12v9H37v12c0 4 2 6 6 6h6v9h-8c-10 0-15-5-15-15V33H18v-9h8V12z" fill="#ffffff"/>
              </svg>
            </div>
            <div>
              <span class="hero-brand-name">Tide <span class="hero-brand-accent">ERP</span></span>
              <span class="hero-brand-sub">Commercial &amp; Financial Workspace</span>
            </div>
          </div>
        </div>

        <div class="auth-hero-center">
          <div class="hero-caption">
            <h1 class="hero-headline">Live Accounting Engine.<br><span class="highlight-orange">Precision at Every Step.</span></h1>
            <p class="hero-subtext">Automated General Ledger, POS velocity, stock audits, and multi-branch intelligence tailored for high-growth enterprises in Tanzania.</p>
          </div>

          <!-- Live Economics & Accounting Stage -->
          <div class="economic-stage">
            <!-- Animated SVG Double-Entry Balance Scale -->
            <div class="accounting-scale-wrap">
              <div class="scale-equation-pill">
                <span class="eq-term green">ASSETS</span>
                <span class="eq-sym">=</span>
                <span class="eq-term blue">LIABILITIES</span>
                <span class="eq-sym">+</span>
                <span class="eq-term orange">EQUITY</span>
              </div>

              <svg class="scale-svg" viewBox="0 0 460 150" width="100%" height="150" aria-label="Double-entry balance scale">
                <defs>
                  <linearGradient id="goldBeam" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#f59e0b"/>
                    <stop offset="50%" stop-color="#fde047"/>
                    <stop offset="100%" stop-color="#f59e0b"/>
                  </linearGradient>
                  <linearGradient id="panGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#14345c" stop-opacity="0.95"/>
                    <stop offset="100%" stop-color="#08182b" stop-opacity="0.98"/>
                  </linearGradient>
                </defs>

                <!-- Base and Central Pedestal -->
                <path d="M 230 130 L 208 146 L 252 146 Z" fill="#1b395d" stroke="#335882" stroke-width="1.5"/>
                <line x1="230" y1="35" x2="230" y2="130" stroke="#335882" stroke-width="3.5" stroke-linecap="round"/>
                <circle cx="230" cy="35" r="7" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>

                <!-- Swaying Balance Beam -->
                <g class="scale-beam-group">
                  <rect x="65" y="32" width="330" height="6" rx="3" fill="url(#goldBeam)" stroke="#fbbf24" stroke-width="1"/>
                  <circle cx="65" cy="35" r="4.5" fill="#fde047" stroke="#d97706" stroke-width="1"/>
                  <circle cx="395" cy="35" r="4.5" fill="#fde047" stroke="#d97706" stroke-width="1"/>

                  <!-- Left Pan: Assets -->
                  <g class="left-pan-group">
                    <line x1="65" y1="35" x2="35" y2="95" stroke="#5d88b4" stroke-width="1.5" stroke-dasharray="3,2"/>
                    <line x1="65" y1="35" x2="95" y2="95" stroke="#5d88b4" stroke-width="1.5" stroke-dasharray="3,2"/>
                    <path d="M 25 95 Q 65 120 105 95 Z" fill="url(#panGlow)" stroke="#10b981" stroke-width="2"/>
                    <circle cx="65" cy="82" r="13" fill="#10b981" fill-opacity="0.25" stroke="#10b981" stroke-width="1.5"/>
                    <text x="65" y="86" text-anchor="middle" font-size="10" font-weight="800" fill="#34d399">TSh</text>
                    <text x="65" y="112" text-anchor="middle" font-size="9" font-weight="800" fill="#e2e8f0" letter-spacing="0.5">ASSETS</text>
                  </g>

                  <!-- Right Pan: Liabilities + Equity -->
                  <g class="right-pan-group">
                    <line x1="395" y1="35" x2="365" y2="95" stroke="#5d88b4" stroke-width="1.5" stroke-dasharray="3,2"/>
                    <line x1="395" y1="35" x2="425" y2="95" stroke="#5d88b4" stroke-width="1.5" stroke-dasharray="3,2"/>
                    <path d="M 355 95 Q 395 120 435 95 Z" fill="url(#panGlow)" stroke="#ff6a00" stroke-width="2"/>
                    <circle cx="395" cy="82" r="13" fill="#ff6a00" fill-opacity="0.25" stroke="#ff6a00" stroke-width="1.5"/>
                    <text x="395" y="86" text-anchor="middle" font-size="9" font-weight="800" fill="#fb923c">L+E</text>
                    <text x="395" y="112" text-anchor="middle" font-size="8.5" font-weight="800" fill="#e2e8f0" letter-spacing="0.5">LIAB + EQUITY</text>
                  </g>
                </g>
              </svg>
            </div>

            <!-- Dynamic Economic Metrics Card -->
            <div class="economic-live-card">
              <div class="live-card-header">
                <div class="live-card-title">
                  <span class="live-card-icon">📊</span>
                  <div>
                    <strong>Macro Cash Velocity &amp; Margins</strong>
                    <small>Continuous Double-Entry Reconciliation</small>
                  </div>
                </div>
                <div class="live-rate-tag">▲ +34.8% Margin</div>
              </div>

              <div class="live-bars-track">
                <div class="live-bar-col">
                  <div class="live-bar revenue-bar" style="--bar-h: 88%">
                    <span class="bar-val">88%</span>
                  </div>
                  <span class="bar-name">Revenue</span>
                </div>
                <div class="live-bar-col">
                  <div class="live-bar cogs-bar" style="--bar-h: 46%">
                    <span class="bar-val">46%</span>
                  </div>
                  <span class="bar-name">COGS</span>
                </div>
                <div class="live-bar-col">
                  <div class="live-bar margin-bar" style="--bar-h: 74%">
                    <span class="bar-val">74%</span>
                  </div>
                  <span class="bar-name">Margin</span>
                </div>
                <div class="live-bar-col">
                  <div class="live-bar cashflow-bar" style="--bar-h: 94%">
                    <span class="bar-val">94%</span>
                  </div>
                  <span class="bar-name">Cash Flow</span>
                </div>
              </div>

              <!-- Floating Economic Elements -->
              <div class="floating-badge badge-delta" title="Marginal Revenue Velocity">
                <span>Δ +18.4%</span>
              </div>
              <div class="floating-badge badge-sigma" title="Total General Ledger Sum">
                <span>Σ Balanced</span>
              </div>
              <div class="floating-badge badge-vat" title="TRA Tanzania 18% Standard VAT">
                <span>TRA 18%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="auth-hero-footer">
          <div class="economic-ticker">
            <div class="ticker-item"><span class="ticker-dot green"></span> General Ledger: <strong>100% Balanced</strong></div>
            <div class="ticker-sep">•</div>
            <div class="ticker-item"><span class="ticker-dot orange"></span> TRA Fiscalization: <strong>18% VAT Active</strong></div>
            <div class="ticker-sep">•</div>
            <div class="ticker-item"><span class="ticker-dot blue"></span> Currency: <strong>TSh (TZS)</strong></div>
            <div class="ticker-sep">•</div>
            <div class="ticker-item"><span class="ticker-dot purple"></span> Multi-Branch Sync: <strong>Connected</strong></div>
          </div>
        </div>
      </section>

      <!-- Right Column: Practical & Modern Sign-in & Register Panel -->
      <section class="auth-card-panel" aria-label="Authentication portal">
        <div class="auth-card-inner ${isRegister ? 'is-register' : ''}">
          <div class="auth-card-top">
            <div class="auth-mobile-header">
              <span class="brand-mark-sm">t</span>
              <strong>Tide ERP</strong>
            </div>

            <!-- Auth Mode Switcher Tabs -->
            <div class="auth-tabs" role="tablist" aria-label="Sign-in and Registration choices">
              <button type="button" class="auth-tab ${!isRegister ? 'active' : ''}" data-auth-tab="login" role="tab" aria-selected="${!isRegister}">
                <span>🔑 Sign In</span>
              </button>
              <button type="button" class="auth-tab ${isRegister ? 'active' : ''}" data-auth-tab="register" role="tab" aria-selected="${isRegister}">
                <span>🏢 Register Company</span>
              </button>
            </div>

            <h2 id="auth-form-title">${isRegister ? 'Register Company Workspace' : 'Sign in to Workspace'}</h2>
            <p id="auth-form-desc">${isRegister ? 'Create your enterprise workspace, primary branch, and administrator account.' : 'Access your commercial accounting ledger, point-of-sale terminals, and inventory controls.'}</p>
          </div>

          <!-- 1. SIGN IN FORM -->
          <form class="auth-form-modern" id="login-form" style="${isRegister ? 'display:none;' : ''}">
            <div class="form-group">
              <label for="login-identifier">Username or Email Address</label>
              <div class="input-wrap">
                <span class="input-icon">👤</span>
                <input name="login-identifier" id="login-identifier" type="text" autocomplete="username" placeholder="e.g. Admin or your@email.com" required ${!isRegister ? 'autofocus' : ''}>
              </div>
            </div>

            <div class="form-group">
              <label for="login-password">Password</label>
              <div class="input-wrap">
                <span class="input-icon">🔑</span>
                <input name="login-password" id="login-password" type="password" autocomplete="current-password" placeholder="••••••••" required>
                <button type="button" class="pwd-visibility-toggle" aria-label="Toggle password visibility" title="Show or hide password">👁</button>
              </div>
            </div>

            <button class="button primary login-submit-btn" type="submit">
              <span>Sign in to Workspace</span>
              <span class="btn-arrow">→</span>
            </button>

            <div class="auth-switch-prompt">
              <span>New to Tide ERP?</span>
              <button type="button" class="auth-switch-link" data-switch-auth="register">Create an account &amp; register company →</button>
            </div>
          </form>

          <!-- 2. REGISTER COMPANY & ACCOUNT FORM -->
          <form class="auth-form-modern" id="register-form" style="${!isRegister ? 'display:none;' : ''}">
            <div class="auth-section-divider">Company Profile</div>
            
            <div class="form-group">
              <label for="reg-company-name">Company / Business Name *</label>
              <div class="input-wrap">
                <span class="input-icon">🏢</span>
                <input name="reg-company-name" id="reg-company-name" type="text" placeholder="e.g. Serengeti General Supplies Ltd" required ${isRegister ? 'autofocus' : ''}>
              </div>
            </div>

            <div class="form-grid-2col">
              <div class="form-group">
                <label for="reg-currency">Base Currency</label>
                <div class="input-wrap">
                  <span class="input-icon">💱</span>
                  <select name="reg-currency" id="reg-currency">
                    <option value="TZS" selected>TZS - Tanzanian Shilling (TSh)</option>
                    <option value="USD">USD - US Dollar ($)</option>
                    <option value="KES">KES - Kenyan Shilling (KSh)</option>
                    <option value="UGX">UGX - Ugandan Shilling (USh)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="GBP">GBP - British Pound (£)</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="reg-branch-name">Primary Branch Name</label>
                <div class="input-wrap">
                  <span class="input-icon">📍</span>
                  <input name="reg-branch-name" id="reg-branch-name" type="text" value="Main branch" placeholder="e.g. Main branch or Kariakoo" required>
                </div>
              </div>
            </div>

            <div class="auth-section-divider">Administrator Account</div>

            <div class="form-group">
              <label for="reg-fullname">Your Full Name *</label>
              <div class="input-wrap">
                <span class="input-icon">👤</span>
                <input name="reg-fullname" id="reg-fullname" type="text" placeholder="e.g. Emmanuel Chikongo" required>
              </div>
            </div>

            <div class="form-grid-2col">
              <div class="form-group">
                <label for="reg-username">Choose Username *</label>
                <div class="input-wrap">
                  <span class="input-icon">🏷️</span>
                  <input name="reg-username" id="reg-username" type="text" autocomplete="username" placeholder="e.g. admin or emmanuel" required>
                </div>
              </div>

              <div class="form-group">
                <label for="reg-phone">Phone Number</label>
                <div class="input-wrap">
                  <span class="input-icon">📞</span>
                  <input name="reg-phone" id="reg-phone" type="tel" placeholder="e.g. 0754 123 456">
                </div>
              </div>
            </div>

            <div class="form-group">
              <label for="reg-email">Email Address *</label>
              <div class="input-wrap">
                <span class="input-icon">✉️</span>
                <input name="reg-email" id="reg-email" type="email" autocomplete="email" placeholder="e.g. emmanuel@company.co.tz" required>
              </div>
            </div>

            <div class="form-grid-2col">
              <div class="form-group">
                <label for="reg-password">Password (min 6 chars) *</label>
                <div class="input-wrap">
                  <span class="input-icon">🔑</span>
                  <input name="reg-password" id="reg-password" type="password" autocomplete="new-password" placeholder="••••••••" minlength="6" required>
                  <button type="button" class="pwd-visibility-toggle" aria-label="Toggle password visibility" title="Show or hide password">👁</button>
                </div>
              </div>

              <div class="form-group">
                <label for="reg-confirm-password">Confirm Password *</label>
                <div class="input-wrap">
                  <span class="input-icon">🔒</span>
                  <input name="reg-confirm-password" id="reg-confirm-password" type="password" autocomplete="new-password" placeholder="••••••••" minlength="6" required>
                  <button type="button" class="pwd-visibility-toggle" aria-label="Toggle password visibility" title="Show or hide password">👁</button>
                </div>
              </div>
            </div>

            <button class="button primary login-submit-btn" type="submit">
              <span>Create Account &amp; Register Company</span>
              <span class="btn-arrow">→</span>
            </button>

            <div class="auth-switch-prompt">
              <span>Already have an account?</span>
              <button type="button" class="auth-switch-link" data-switch-auth="login">Sign in here →</button>
            </div>
          </form>

          ${message ? `<div class="auth-error-banner" role="alert">⚠️ ${esc(message)}</div>` : ''}
        </div>
      </section>
    </div>
  `;
  if (isRegister) {
    gate.querySelector('input[name="reg-company-name"]')?.focus();
  } else {
    gate.querySelector('input[name="login-identifier"]')?.focus();
  }
}

let currentAuthTab = 'login';

function switchAuthTab(tab) {
  currentAuthTab = tab;
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const title = document.getElementById('auth-form-title');
  const desc = document.getElementById('auth-form-desc');
  const errorBanner = document.querySelector('.auth-error-banner');
  if (errorBanner) errorBanner.style.display = 'none';

  document.querySelectorAll('.auth-tab').forEach(b => {
    const active = b.dataset.authTab === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });

  const cardInner = document.querySelector('.auth-card-inner');

  if (tab === 'register') {
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'grid';
    if (title) title.textContent = 'Register Company Workspace';
    if (desc) desc.textContent = 'Create your enterprise workspace, primary branch, and administrator account.';
    if (cardInner) cardInner.classList.add('is-register');
    registerForm?.querySelector('input[name="reg-company-name"]')?.focus();
  } else {
    if (registerForm) registerForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'grid';
    if (title) title.textContent = 'Sign in to Workspace';
    if (desc) desc.textContent = 'Access your commercial accounting ledger, point-of-sale terminals, and inventory controls.';
    if (cardInner) cardInner.classList.remove('is-register');
    loginForm?.querySelector('input[name="login-identifier"]')?.focus();
  }
}

function createBlankWorkspaceState({ companyName, branchName = 'Main branch', currency = 'TZS', adminUser = null } = {}) {
  const mainBranch = { id: 'BR-MAIN', name: branchName || 'Main branch', status: 'Active' };
  return {
    version: 3,
    companyName: companyName || 'My Company',
    companyLogo: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: adminUser?.email || '',
    companyPaymentDetails: '',
    branch: mainBranch.name,
    activeBranchId: mainBranch.id,
    branches: [mainBranch],
    branchData: {},
    products: [],
    customers: [],
    suppliers: [],
    orders: [],
    sales: [],
    returns: [],
    purchaseReturns: [],
    purchases: [],
    expenses: [],
    entries: [],
    queue: [],
    stockMovements: [],
    users: adminUser ? [adminUser] : structuredClone(initialState.users),
    currentUserId: adminUser ? adminUser.id : '',
    companyAdminId: adminUser ? adminUser.id : '',
    currency: currency || 'TZS',
    vatEnabled: true,
    vatRate: 18,
    autoLockMinutes: 20,
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
    activityLog: [],
    stocktakeDraft: null,
    stocktakes: [],
    isRegistered: true
  };
}

function attachActiveWorkspaceStreams() {
  const wsId = typeof getActiveWorkspaceId === 'function' ? getActiveWorkspaceId() : 'ws_primary';
  const seedKey = wsId === 'ws_primary' ? 'tide_products_seeded_v2' : `tide_products_seeded_${wsId}`;

  if (typeof initCloudSync === 'function') {
    initCloudSync('tideerp_global_workspace', handleRemoteCloudSync);
  }

  if (typeof window.TideFirebase?.initFirebase === 'function') {
    window.TideFirebase.initFirebase().then(() => {
      if (typeof window.TideFirebase?.setWorkspace === 'function') {
        window.TideFirebase.setWorkspace(wsId);
      }
      window.TideFirebase.streamProducts((remoteProducts) => {
        if (!Array.isArray(remoteProducts)) return;
        const currentWs = typeof getActiveWorkspaceId === 'function' ? getActiveWorkspaceId() : 'ws_primary';
        if (currentWs !== wsId) return;
        if (typeof window.TideFirebase?.isBulkOpActive === 'function' && window.TideFirebase.isBulkOpActive()) return;

        // Only legacy primary workspace may do a one-time seed from local cache if cloud is empty.
        // Newly created isolated company workspaces always treat 0 products in cloud as authoritative.
        const isPrimary = wsId === 'ws_primary';
        const hasSeeded = !isPrimary || Boolean(localStorage.getItem(seedKey));
        if (isPrimary && remoteProducts.length === 0 && !hasSeeded && (state.products || []).length > 0) {
          localStorage.setItem(seedKey, 'true');
          window.TideFirebase.batchSyncProducts(state.products);
          return;
        }

        if (remoteProducts.length > 0) {
          if (isPrimary) localStorage.setItem(seedKey, 'true');
          state.products = remoteProducts;
          persistState(state, wsId);
          render();
        } else if (hasSeeded) {
          state.products = [];
          persistState(state, wsId);
          render();
        }
      });
    }).catch(err => console.warn('Product stream setup error:', err));
  }
}

async function handleRegister(form) {
  const companyName = (form.elements['reg-company-name']?.value || '').trim();
  const branchName = (form.elements['reg-branch-name']?.value || '').trim() || 'Main branch';
  const currency = form.elements['reg-currency']?.value || 'TZS';
  const fullName = (form.elements['reg-fullname']?.value || '').trim();
  const username = normalizedLogin(form.elements['reg-username']?.value || '');
  const email = normalizedLogin(form.elements['reg-email']?.value || '');
  const phone = (form.elements['reg-phone']?.value || '').trim();
  const password = form.elements['reg-password']?.value || '';
  const confirmPassword = form.elements['reg-confirm-password']?.value || '';

  if (!companyName) {
    renderAuthGate('Please enter your company or business name.', 'register');
    return;
  }
  if (!fullName) {
    renderAuthGate('Please enter your full name.', 'register');
    return;
  }
  if (!username) {
    renderAuthGate('Please choose a username.', 'register');
    return;
  }
  if (!password || password.length < 6) {
    renderAuthGate('Password must be at least 6 characters.', 'register');
    return;
  }
  if (password !== confirmPassword) {
    renderAuthGate('Passwords do not match. Please re-enter.', 'register');
    return;
  }

  // Check if username or email is already taken globally across all companies or locally
  const localTaken = (state.users || []).some(u =>
    (u.username && normalizedLogin(u.username) === username) ||
    (email && u.email && normalizedLogin(u.email) === email)
  );
  let globallyAvailable = true;
  if (typeof checkCredentialsAvailableGlobally === 'function') {
    try {
      globallyAvailable = await checkCredentialsAvailableGlobally(username, email);
    } catch {}
  }
  if (localTaken || !globallyAvailable) {
    renderAuthGate('An account with this username or email already exists. Please sign in or choose another.', 'register');
    return;
  }

  try {
    // 1. Create a brand-new, 100% isolated company workspace (ZERO data retained from any other company)
    const newWorkspaceId = typeof createNewWorkspaceId === 'function'
      ? createNewWorkspaceId(companyName)
      : `ws_${Date.now().toString(36)}`;
    const branchId = 'BR-MAIN';

    const adminUser = {
      id: `USR-OWNER-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      name: fullName,
      username,
      email,
      phone,
      role: 'Owner / Administrator',
      modules: ['*'],
      permissions: { '*': ['*'] },
      branchId,
      status: 'Active',
      isBootstrap: true,
      initialAdminLoginSeeded: true
    };
    await setUserPassword(adminUser, password);

    const freshState = createBlankWorkspaceState({
      companyName,
      branchName,
      currency,
      adminUser
    });

    // 2. Detach previous workspace streams & switch to the new isolated workspace
    if (typeof setActiveWorkspaceId === 'function') {
      setActiveWorkspaceId(newWorkspaceId);
    }
    state = freshState;
    activeBranch = state.branches[0];
    posCart = [];
    posDraftOrderId = '';
    posCustomer = 'Walk-in customer';
    posMethod = 'Cash';
    posCategory = '';
    tableQuery = '';
    selectedProductIds.clear();

    // 3. Persist isolated local store & seed clean empty modules + account directory in Firestore
    await persistState(state, newWorkspaceId);
    if (typeof window.TideFirebase?.initFirebase === 'function') {
      await window.TideFirebase.initFirebase();
      window.TideFirebase.setWorkspace?.(newWorkspaceId);
    }
    if (typeof registerAccountInDirectory === 'function') {
      await registerAccountInDirectory(adminUser, newWorkspaceId, companyName);
    }
    attachActiveWorkspaceStreams();
    if (typeof pushStateToCloud === 'function') {
      await pushStateToCloud(state, true, true);
    }

    // 4. Auto-login into the brand-new blank company workspace
    safeSessionSet(AUTH_SESSION_KEY, JSON.stringify({
      id: adminUser.id,
      passwordHash: adminUser.passwordHash,
      workspaceId: newWorkspaceId
    }));
    recordActivity('Company workspace registered', `${companyName} by ${fullName}`);
    saveState();

    authErrorMessage = '';
    page = 'home';
    history.replaceState({ erpPage: 'home' }, '', '#home');
    document.getElementById('auth-gate').hidden = true;
    document.querySelector('.app-shell').hidden = false;
    clearScreenLock();
    startAutoLockWatcher();
    render();
    toast(`🎉 Welcome to Tide ERP! Fresh company workspace "${companyName}" created.`);
  } catch (err) {
    renderAuthGate(err.message || 'Company registration could not be completed.', 'register');
  }
}

async function ensureAdministratorLogin() {
  const admin = state.users.find(user => user.isBootstrap) || state.users.find(user => isAdministratorUser(user));
  if (!admin) return false;
  if (!admin.username) admin.username = ADMIN_LOGIN_USERNAME;
  if (!admin.email) admin.email = ADMIN_LOGIN_EMAIL;
  if (admin.name === 'Amina Mwinyi' || admin.name === 'Amina' || /amina/i.test(admin.name || '')) admin.name = 'Administrator';
  if (!admin.initialAdminLoginSeeded || !admin.passwordHash || !admin.passwordSalt) {
    await setUserPassword(admin, ADMIN_INITIAL_PASSWORD);
    admin.initialAdminLoginSeeded = true;
  }
  return true;
}

async function handleLogin(form) {
  const identifier = normalizedLogin(form.elements['login-identifier'].value);
  const password = form.elements['login-password'].value;
  const currentWsId = typeof getActiveWorkspaceId === 'function' ? getActiveWorkspaceId() : 'ws_primary';

  // 1. Check global multi-tenant account directory first so any user can sign into
  //    their exact isolated company workspace from ANY device (PC or Phone)
  let targetWsId = currentWsId;
  let dirRecord = null;
  if (typeof lookupAccountInDirectory === 'function') {
    try {
      dirRecord = await lookupAccountInDirectory(identifier);
    } catch {}
  }

  if (dirRecord && dirRecord.workspaceId) {
    let dirValid = false;
    try {
      dirValid = Boolean(dirRecord.status !== 'Inactive' && await verifyUserPassword(dirRecord, password));
    } catch {}
    if (!dirValid) {
      renderAuthGate('The username/email or password is incorrect, or this account is inactive.');
      return;
    }

    targetWsId = dirRecord.workspaceId;
    if (targetWsId !== currentWsId) {
      // Switch cleanly into this user's isolated company workspace
      if (typeof setActiveWorkspaceId === 'function') {
        setActiveWorkspaceId(targetWsId);
      }
      const blankFallback = createBlankWorkspaceState({ companyName: dirRecord.companyName || 'My Company' });
      state = await loadPersistedState(blankFallback, targetWsId);
      state.currentUserId = '';
      try {
        if (typeof window.TideFirebase?.initFirebase === 'function') {
          await window.TideFirebase.initFirebase();
          window.TideFirebase.setWorkspace?.(targetWsId);
        }
        const [modRes, cloudProds] = await Promise.all([
          typeof hydrateFromCloud === 'function' ? hydrateFromCloud(state, blankFallback, true) : Promise.resolve(null),
          typeof window.TideFirebase?.getProducts === 'function' ? window.TideFirebase.getProducts(true) : Promise.resolve(null)
        ]);
        if (modRes?.hydrated && modRes.state) state = modRes.state;
        if (Array.isArray(cloudProds)) state.products = cloudProds;
      } catch (err) {
        console.warn('Tenant hydration on login fell back to local cache:', err);
      }
      activeBranch = state.branches.find(b => b.id === state.activeBranchId) || state.branches[0] || { id: 'BR-MAIN', name: 'Main branch' };
      state.activeBranchId = activeBranch.id;
      state.branch = activeBranch.name;
      attachActiveWorkspaceStreams();
    }
  }

  const user = (state.users || []).find(item => normalizedLogin(item.username) === identifier || normalizedLogin(item.email) === identifier);
  let valid = false;
  try { valid = Boolean(user && user.status !== 'Inactive' && await verifyUserPassword(user, password)); }
  catch (error) { renderAuthGate(error.message || 'Sign-in could not be completed.'); return; }
  if (!valid) { renderAuthGate('The username/email or password is incorrect, or this account is inactive.'); return; }

  state.currentUserId = user.id;
  state.posCart = [];
  posCart = [];
  posDraftOrderId = '';
  tableQuery = '';
  selectedProductIds.clear();
  if (!activateAssignedBranch(user)) {
    state.currentUserId = '';
    renderAuthGate('This account has no active assigned branch. Ask an administrator to assign it to an active branch.');
    return;
  }
  const activeWs = typeof getActiveWorkspaceId === 'function' ? getActiveWorkspaceId() : targetWsId;
  safeSessionSet(AUTH_SESSION_KEY, JSON.stringify({
    id: user.id,
    passwordHash: user.passwordHash,
    workspaceId: activeWs
  }));
  // Ensure this account is indexed in global directory for seamless cross-device login
  if (!dirRecord && typeof registerAccountInDirectory === 'function') {
    registerAccountInDirectory(user, activeWs, state.companyName).catch(() => {});
  }
  snapshotCurrentBranch();
  persistState(state, activeWs);
  authErrorMessage = '';
  page = 'home';
  history.replaceState({ erpPage: 'home' }, '', '#home');
  document.getElementById('auth-gate').hidden = true;
  document.querySelector('.app-shell').hidden = false;
  clearScreenLock();
  startAutoLockWatcher();
  render();
}

function logout() {
  stopAutoLockWatcher();
  clearScreenLock();
  safeSessionRemove(AUTH_SESSION_KEY);
  safeSessionRemove(LAST_ACTIVITY_KEY);
  state.currentUserId = '';
  state.posCart = [];
  posCart = [];
  posDraftOrderId = '';
  tableQuery = '';
  selectedProductIds.clear();
  page = 'home';
  persistState(state);
  document.getElementById('app-modal')?.close();
  renderAuthGate();
}

// =========================================================
// Automatic Inactivity Lock Timer (Default: 20 minutes)
// Persists lock across refresh and handles mobile sleep/wake
// =========================================================
let screenLocked = false;
let screenLockReason = 'inactivity';
let lastActivityAt = Date.now();
let lastActivityPersistAt = 0;
let autoLockIntervalId = null;
let autoLockListenersAttached = false;

function getAutoLockMinutes() {
  const raw = state?.autoLockMinutes;
  if (raw === 0) return 0;
  const num = Number(raw);
  if (Number.isFinite(num) && num >= 0) return num;
  return DEFAULT_AUTO_LOCK_MINUTES;
}

function isScreenLocked() {
  return Boolean(screenLocked);
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function hideAutoLockWarning() {
  const banner = document.getElementById('auto-lock-warning');
  if (banner) {
    banner.hidden = true;
    banner.textContent = '';
  }
}

function updateLockCountdownUI(remainingMs = null) {
  const btn = document.getElementById('lock-session-button');
  const label = document.getElementById('footer-lock-countdown');
  if (!btn || !label) return;
  const mins = getAutoLockMinutes();
  if (mins <= 0) {
    label.textContent = 'Lock';
    btn.classList.remove('is-warning');
    btn.title = 'Auto-lock disabled (click to lock screen now)';
    return;
  }
  const ms = remainingMs !== null ? remainingMs : Math.max(0, mins * 60 * 1000 - (Date.now() - lastActivityAt));
  label.textContent = formatCountdown(ms);
  const isWarning = ms <= 60000 && ms > 0;
  btn.classList.toggle('is-warning', isWarning);
  btn.title = `Auto-locks in ${formatCountdown(ms)} of inactivity (click to lock now)`;
}

function recordUserActivity() {
  if (screenLocked || !state?.currentUserId) return;
  const now = Date.now();
  if (now - lastActivityPersistAt < 1000) return; // Throttle to once per second
  lastActivityAt = now;
  lastActivityPersistAt = now;
  safeSessionSet(LAST_ACTIVITY_KEY, String(now));
  hideAutoLockWarning();
  updateLockCountdownUI(getAutoLockMinutes() * 60 * 1000);
}

function renderScreenLockOverlay(errorMsg = '') {
  const overlay = document.getElementById('screen-lock-overlay');
  if (!overlay) return;
  const user = currentWorkspaceUser();
  const displayName = user?.name || 'Administrator';
  const roleLabel = isAdministratorUser(user) ? 'Owner / Administrator' : (user?.role || 'User');
  const identifier = user?.email || user?.username || '';
  const mins = getAutoLockMinutes();
  const reasonText = screenLockReason === 'manual'
    ? 'Screen locked manually to protect your workspace.'
    : `Session automatically locked after ${mins || DEFAULT_AUTO_LOCK_MINUTES} minutes of inactivity.`;

  overlay.innerHTML = `
    <div class="screen-lock-card" role="dialog" aria-modal="true" aria-labelledby="screen-lock-title">
      <div class="screen-lock-head">
        <div class="screen-lock-badge" aria-hidden="true">🔒</div>
        <h2 id="screen-lock-title">Session Locked</h2>
        <p>${esc(reasonText)}<br><strong>${esc(state.companyName || 'My Company')}</strong> · ${esc(state.branch || 'Main branch')}</p>
      </div>
      <div class="screen-lock-user">
        <span class="screen-lock-avatar">${esc(shortName(displayName))}</span>
        <div class="screen-lock-user-meta">
          <strong>${esc(displayName)}</strong>
          <small>${esc(roleLabel)}${identifier ? ` · ${esc(identifier)}` : ''}</small>
        </div>
      </div>
      ${errorMsg ? `<div class="screen-lock-error" role="alert">${esc(errorMsg)}</div>` : ''}
      <form class="screen-lock-form" id="screen-lock-form" autocomplete="off">
        <div class="field">
          <label for="unlock-password">Enter your password to unlock</label>
          <div class="input-wrap">
            <input id="unlock-password" name="unlock-password" type="password" placeholder="Enter password" required autofocus>
            <button type="button" class="pwd-visibility-toggle" aria-label="Show password" title="Show password">👁</button>
          </div>
        </div>
        <div class="screen-lock-actions">
          <button type="submit" class="button primary">🔓 Unlock Session</button>
          <button type="button" class="button" data-action="unlock-switch-account">Switch Account / Sign Out</button>
        </div>
      </form>
    </div>
  `;
  overlay.hidden = false;
  setTimeout(() => document.getElementById('unlock-password')?.focus(), 40);
}

function lockScreen(reason = 'inactivity') {
  if (!state?.currentUserId) return;
  screenLocked = true;
  screenLockReason = reason;
  safeSessionSet(LOCK_STATE_KEY, JSON.stringify({
    locked: true,
    reason,
    lockedAt: Date.now(),
    userId: state.currentUserId
  }));
  hideAutoLockWarning();
  document.getElementById('app-modal')?.close();
  document.querySelector('.notifications-popover')?.remove();
  document.querySelector('.branch-popover')?.remove();
  const shell = document.querySelector('.app-shell');
  if (shell) {
    shell.classList.add('is-locked');
    shell.setAttribute('aria-hidden', 'true');
  }
  renderScreenLockOverlay();
}

function clearScreenLock() {
  screenLocked = false;
  safeSessionRemove(LOCK_STATE_KEY);
  hideAutoLockWarning();
  const overlay = document.getElementById('screen-lock-overlay');
  if (overlay) {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }
  const shell = document.querySelector('.app-shell');
  if (shell) {
    shell.classList.remove('is-locked');
    shell.removeAttribute('aria-hidden');
  }
}

async function handleUnlockSubmit(form) {
  const password = String(form.elements['unlock-password']?.value || '');
  const user = currentWorkspaceUser();
  if (!user || !user.id) {
    clearScreenLock();
    logout();
    return;
  }
  let valid = false;
  try {
    valid = Boolean(user.status !== 'Inactive' && await verifyUserPassword(user, password));
  } catch (err) {
    renderScreenLockOverlay(err.message || 'Could not verify password.');
    return;
  }
  if (!valid) {
    renderScreenLockOverlay('Incorrect password. Please try again.');
    return;
  }
  clearScreenLock();
  lastActivityAt = Date.now();
  lastActivityPersistAt = lastActivityAt;
  safeSessionSet(LAST_ACTIVITY_KEY, String(lastActivityAt));
  updateLockCountdownUI();
  toast('🔓 Session unlocked');
}

function tickAutoLockTimer() {
  if (!state?.currentUserId || screenLocked) return;
  const mins = getAutoLockMinutes();
  if (mins <= 0) {
    hideAutoLockWarning();
    updateLockCountdownUI();
    return;
  }
  const timeoutMs = mins * 60 * 1000;
  const elapsed = Date.now() - lastActivityAt;
  const remaining = timeoutMs - elapsed;

  if (remaining <= 0) {
    lockScreen('inactivity');
    return;
  }

  updateLockCountdownUI(remaining);

  const banner = document.getElementById('auto-lock-warning');
  if (banner) {
    if (remaining <= 60000) {
      const secs = Math.max(1, Math.ceil(remaining / 1000));
      banner.textContent = `⏳ Auto-locking in ${secs}s due to inactivity — tap or press any key to stay active`;
      banner.hidden = false;
    } else if (!banner.hidden) {
      banner.hidden = true;
    }
  }
}

function startAutoLockWatcher(preserveStoredTimestamp = false) {
  if (!preserveStoredTimestamp) {
    lastActivityAt = Date.now();
    lastActivityPersistAt = lastActivityAt;
    safeSessionSet(LAST_ACTIVITY_KEY, String(lastActivityAt));
  } else {
    const stored = Number(safeSessionGet(LAST_ACTIVITY_KEY) || 0);
    lastActivityAt = stored > 0 ? stored : Date.now();
  }

  if (!autoLockListenersAttached) {
    autoLockListenersAttached = true;
    const events = ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'scroll', 'input'];
    events.forEach(ev => window.addEventListener(ev, recordUserActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        tickAutoLockTimer();
      }
    });
    window.addEventListener('focus', tickAutoLockTimer);
  }

  if (autoLockIntervalId) clearInterval(autoLockIntervalId);
  autoLockIntervalId = setInterval(tickAutoLockTimer, 1000);
  tickAutoLockTimer();
}

function stopAutoLockWatcher() {
  if (autoLockIntervalId) {
    clearInterval(autoLockIntervalId);
    autoLockIntervalId = null;
  }
  hideAutoLockWarning();
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
  let region = document.getElementById('toast-region');
  const modal = document.getElementById('app-modal');
  if (modal?.open && !region?.showPopover) {
    let modalRegion = modal.querySelector('.toast-region');
    if (!modalRegion) {
      modalRegion = document.createElement('div');
      modalRegion.className = 'toast-region';
      modal.append(modalRegion);
    }
    region = modalRegion;
  }
  if (!region) return;
  try {
    if (region.showPopover && !region.matches(':popover-open')) {
      region.showPopover();
    }
  } catch { }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  region.append(el);
  setTimeout(() => {
    el.remove();
    try {
      if (region.children.length === 0 && region.hidePopover) {
        region.hidePopover();
      }
    } catch { }
  }, 3200);
}

function currentWorkspaceUser() {
  if (state.currentUserId) {
    const user = (state.users || []).find(u => u.id === state.currentUserId && u.status !== 'Inactive');
    if (user) return user;
  }
  return { id: '', name: 'Guest', role: 'Guest', modules: [], permissions: {}, status: 'Inactive' };
}

function isWorkspaceAdministrator() {
  return isAdministratorUser(currentWorkspaceUser());
}

function userCanManageAllBranches() {
  return isWorkspaceAdministrator() || userHasPermission('branches', 'open') || userHasPermission('branches', 'manage');
}

function canSwitchBranches() {
  if (isWorkspaceAdministrator()) return true;
  if (userCanManageAllBranches()) return true;
  if (canViewPage('branches')) return true;
  return accessibleBranches().length > 1;
}

function accessibleBranches() {
  if (userCanManageAllBranches()) return state.branches.filter(b => b.status !== 'Inactive');
  const assigned = state.branches.find(b => b.id === currentWorkspaceUser().branchId && b.status !== 'Inactive');
  return assigned ? [assigned] : [];
}

function activateAssignedBranch(user = currentWorkspaceUser()) {
  if (isAdministratorUser(user)) return true;
  const branch = state.branches.find(item => item.id === user?.branchId && item.status !== 'Inactive');
  if (!branch) return false;
  if (activeBranch?.id !== branch.id) {
    snapshotCurrentBranch();
    activeBranch = branch;
    const saved = state.branchData?.[branch.id] || {};
    branchCollections.forEach(key => {
      if (key === 'products') return; // Products are managed globally via Firestore 'products' collection
      state[key] = structuredClone(saved[key] !== undefined ? saved[key] : (key === 'stocktakeDraft' ? null : []));
    });
  }
  state.activeBranchId = branch.id;
  state.branch = branch.name;
  return true;
}

function snapshotCurrentBranch() {
  if (!activeBranch) return;
  const data = {};
  branchCollections.forEach(k => {
    data[k] = structuredClone(state[k] !== undefined ? state[k] : (k === 'stocktakeDraft' ? null : []));
  });
  if (!state.branchData) state.branchData = {};
  state.branchData[activeBranch.id] = data;
}

function syncProductToCloud(product) {
  if (!product || !product.id) return;
  if (typeof window.TideFirebase?.saveProduct === 'function') {
    window.TideFirebase.saveProduct(product);
  }
}

function syncProductsBatchToCloud(products) {
  if (!Array.isArray(products) || !products.length) return;
  if (typeof window.TideFirebase?.batchSyncProducts === 'function') {
    window.TideFirebase.batchSyncProducts(products);
  }
}

function saveState() {
  snapshotCurrentBranch();
  persistState(state);
  if (typeof pushStateToCloud === 'function') pushStateToCloud(state);
  updateConnection();
}

function updateConnection() {
  const offline = !navigator.onLine;
  if (!offline && state.queue.length > 0) {
    state.queue = [];
    persistState(state);
  }
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
  const prodNav = document.querySelector('.nav-item[data-page="products"]');
  if (prodNav) prodNav.hidden = !canViewPage('products');
  const invNav = document.querySelector('.nav-item[data-page="inventory"]');
  if (invNav) invNav.hidden = !canViewPage('inventory');
}

function refreshBranchSwitcher() {
  const button = document.getElementById('branch-switch-button');
  if (!button) return;
  const canSwitch = canSwitchBranches();
  button.hidden = !canSwitch;
  if (canSwitch) {
    const name = activeBranch?.name || state.branch || 'Main branch';
    button.title = `Active: ${name} (Click to switch branch)`;
    button.setAttribute('aria-label', `Switch branch, active: ${name}`);
    const footerLabel = document.getElementById('footer-branch-label');
    if (footerLabel) footerLabel.textContent = name;
  }
}

function canViewActivity() {
  const user = currentWorkspaceUser();
  if (!user || user.role === 'Guest' || !user.id || user.status === 'Inactive') return false;
  if (user.isBootstrap) return true;
  return userHasPermission('dashboard', 'business-performance', user) || userHasPermission('dashboard', 'stock-alerts', user);
}

function refreshActivityVisibility() {
  const button = document.getElementById('activity-button');
  if (button) {
    const allowed = canViewActivity();
    button.hidden = !allowed;
    button.style.display = allowed ? '' : 'none';
  }
}

function recordActivity(action, details, reference = '') {
  if (!Array.isArray(state.activityLog)) state.activityLog = [];
  const actor = currentWorkspaceUser();
  state.activityLog.unshift({ id: idFor('ACT', state.activityLog), date: new Date().toISOString(), actorId: actor.id || '', actor: actor.name || 'User', branchId: activeBranch?.id || '', action, details, reference });
  state.activityLog = state.activityLog.slice(0, 300);
}

function notificationItems() {
  const user = currentWorkspaceUser();
  const items = [];
  if (userHasPermission('dashboard', 'stock-alerts', user) || canViewPage('inventory', user) || canViewPage('products', user)) {
    const low = state.products.filter(product => product.status !== 'Draft' && Number(product.stock) <= Number(product.low));
    if (low.length) items.push({ icon: '▤', title: `${low.length} low-stock product${low.length === 1 ? '' : 's'}`, detail: low.slice(0, 3).map(product => `${product.name} (${product.stock} left)`).join(' · '), page: canViewPage('inventory', user) ? 'inventory' : 'products', tone: 'warning' });
  }
  if (canViewPage('sales', user) || canViewPage('accounting', user)) {
    const due = state.orders.filter(order => order.status !== 'Draft' && Number(order.total) > Number(order.paid || 0));
    const overdue = due.filter(order => String(order.due || order.date) < today());
    if (overdue.length) items.push({ icon: '◷', title: `${overdue.length} overdue customer balance${overdue.length === 1 ? '' : 's'}`, detail: `${money(overdue.reduce((sum, order) => sum + Math.max(0, order.total - (order.paid || 0)), 0))} outstanding`, page: canViewPage('sales', user) ? 'sales' : 'accounting', tone: 'danger' });
    else if (due.length) items.push({ icon: '◷', title: `${due.length} unpaid customer order${due.length === 1 ? '' : 's'}`, detail: `${money(due.reduce((sum, order) => sum + Math.max(0, order.total - (order.paid || 0)), 0))} outstanding`, page: canViewPage('sales', user) ? 'sales' : 'accounting', tone: 'warning' });
  }
  if (canViewPage('purchases', user)) {
    const pending = state.purchases.filter(purchase => purchase.status === 'Pending');
    if (pending.length) items.push({ icon: '⇩', title: `${pending.length} purchase order${pending.length === 1 ? '' : 's'} awaiting receipt`, detail: 'Receive items to update stock.', page: 'purchases', tone: 'info' });
    const payable = accountOutstandingTotal('Supplier');
    if (payable && (canViewPage('accounting', user) || canViewPage('suppliers', user))) items.push({ icon: '◈', title: 'Supplier balances outstanding', detail: `${money(payable)} payable`, page: canViewPage('accounting', user) ? 'accounting' : 'purchases', tone: 'warning' });
  }
  return items;
}

function refreshNotificationIndicator() {
  const button = document.getElementById('notifications-button');
  if (!button) return;
  const count = notificationItems().length;
  button.classList.toggle('has-notifications', count > 0);
  button.setAttribute('aria-label', count ? `Notifications, ${count} item${count === 1 ? '' : 's'}` : 'Notifications');
  let badge = button.querySelector('.notification-count');
  if (!badge) { badge = document.createElement('span'); badge.className = 'notification-count'; button.append(badge); }
  if (badge) badge.textContent = count ? String(count) : '';
}

function openNotificationsPanel() {
  const button = document.getElementById('notifications-button');
  if (!button) return;
  document.querySelector('.notifications-popover')?.remove();
  document.querySelector('.branch-popover')?.remove();
  const items = notificationItems();
  const panel = document.createElement('section'); panel.className = 'notifications-popover'; panel.setAttribute('aria-label', 'Notifications');
  panel.innerHTML = `<div class="topbar-popover-head"><div><strong>Notifications</strong><small>${items.length ? `${items.length} item${items.length === 1 ? '' : 's'} need attention` : 'You’re all caught up'}</small></div><button type="button" class="topbar-popover-close" aria-label="Close notifications">×</button></div>${items.length ? `<div class="notification-list">${items.map((item, index) => `<button type="button" class="notification-row notification-${item.tone}" data-notification-page="${esc(item.page)}"><span class="notification-row-icon">${item.icon}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><span class="notification-arrow">›</span></button>`).join('')}</div>` : '<div class="notification-empty"><span>✓</span><p>No current alerts.</p></div>'}`;
  document.body.append(panel);
  const rect = button.getBoundingClientRect();
  if (window.innerWidth <= 760) {
    Object.assign(panel.style, {
      top: `${Math.max(52, rect.bottom + 8)}px`,
      bottom: 'auto',
      left: '8px',
      right: '8px',
      width: 'auto'
    });
  } else {
    if (rect.top > window.innerHeight / 2) {
      Object.assign(panel.style, {
        bottom: `${Math.max(10, window.innerHeight - rect.top + 8)}px`,
        right: `${Math.max(8, window.innerWidth - rect.right)}px`,
        top: 'auto'
      });
    } else {
      Object.assign(panel.style, {
        top: `${Math.min(rect.bottom + 8, window.innerHeight - 80)}px`,
        right: `${Math.max(8, window.innerWidth - rect.right)}px`
      });
    }
  }
  panel.querySelector('.topbar-popover-close').addEventListener('click', () => panel.remove());
  panel.querySelectorAll('[data-notification-page]').forEach(item => item.addEventListener('click', () => { const target = item.dataset.notificationPage; panel.remove(); setPage(target); }));
}

function openBranchSwitcherPanel() {
  const button = document.getElementById('branch-switch-button');
  if (!button) return;
  document.querySelector('.branch-popover')?.remove();
  document.querySelector('.notifications-popover')?.remove();

  const branches = accessibleBranches();
  const canManage = isWorkspaceAdministrator() || userHasPermission('branches', 'manage');

  const panel = document.createElement('section');
  panel.className = 'branch-popover';
  panel.setAttribute('aria-label', 'Switch Branch');

  panel.innerHTML = `
    <div class="topbar-popover-head">
      <div>
        <strong>Switch Branch</strong>
        <small>Active: ${esc(activeBranch?.name || state.branch || 'Main branch')}</small>
      </div>
      <button type="button" class="topbar-popover-close" aria-label="Close branch switcher">×</button>
    </div>
    <div style="margin-top:10px">
      ${branches.length ? branches.map(b => {
    const isActive = b.id === (activeBranch?.id || state.activeBranchId);
    return `
          <button type="button" class="branch-option-row ${isActive ? 'active' : ''}" data-switch-branch-id="${esc(b.id)}">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:18px">🏢</span>
              <div style="display:grid;gap:2px">
                <strong style="font-size:12px;color:var(--ink)">${esc(b.name)}</strong>
                <small style="font-size:10px;color:var(--muted)">${esc(b.id)} · ${isActive ? 'Current workspace' : 'Click to switch'}</small>
              </div>
            </div>
            ${isActive ? '<span class="status-pill status-paid" style="font-size:10px;padding:2px 7px">✓ Active</span>' : '<span class="button small" style="font-size:10px;padding:2px 6px;pointer-events:none">Switch</span>'}
          </button>
        `;
  }).join('') : '<div class="notification-empty"><p>No accessible branches found.</p></div>'}
    </div>
    ${canManage ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:8px">
        <button type="button" class="text-link" data-branch-nav="branches" style="font-size:11px;font-weight:700">🏢 Manage branches ›</button>
        <button type="button" class="button small primary" data-branch-dialog="new-branch" style="font-size:10px;padding:4px 8px">＋ Add branch</button>
      </div>
    ` : ''}
  `;

  document.body.append(panel);
  const rect = button.getBoundingClientRect();
  const margin = 10;
  if (window.innerWidth <= 760) {
    const bottomOffset = Math.max(56, window.innerHeight - rect.top + 8);
    Object.assign(panel.style, {
      bottom: `${bottomOffset}px`,
      left: `${margin}px`,
      right: `${margin}px`,
      width: 'auto',
      top: 'auto',
      maxHeight: `${Math.max(180, rect.top - 20)}px`
    });
  } else {
    const panelWidth = panel.offsetWidth || 340;
    const clampedLeft = Math.max(margin, Math.min(rect.left, window.innerWidth - panelWidth - margin));
    if (rect.top > window.innerHeight / 2) {
      const bottomOffset = Math.max(margin, window.innerHeight - rect.top + 8);
      Object.assign(panel.style, {
        bottom: `${bottomOffset}px`,
        left: `${clampedLeft}px`,
        right: 'auto',
        top: 'auto',
        maxHeight: `${Math.max(200, rect.top - 20)}px`
      });
    } else {
      Object.assign(panel.style, {
        top: `${Math.min(rect.bottom + 8, window.innerHeight - 80)}px`,
        left: `${clampedLeft}px`,
        right: 'auto',
        bottom: 'auto'
      });
    }
  }

  panel.querySelector('.topbar-popover-close').addEventListener('click', () => panel.remove());

  panel.querySelectorAll('[data-switch-branch-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.switchBranchId;
      panel.remove();
      if (targetId !== activeBranch?.id) {
        switchBranch(targetId);
      }
    });
  });

  panel.querySelector('[data-branch-nav]')?.addEventListener('click', () => {
    panel.remove();
    setPage('branches');
  });

  panel.querySelector('[data-branch-dialog="new-branch"]')?.addEventListener('click', () => {
    panel.remove();
    openDialog('new-branch', 'Add branch', 'Create an independent workspace for another location.', inputField('branch-name', 'Branch name', 'e.g. Arusha branch', 'text', true));
  });
}

function recentActivityItems(limit = 100) {
  const saved = (state.activityLog || []).map(item => ({ id: item.id, date: item.date, actorId: item.actorId || '', actor: item.actor || 'User', branchId: item.branchId || '', action: item.action || 'Updated records', details: item.details || '', reference: item.reference || '' }));
  const fallback = [];
  for (const sale of state.sales) fallback.push({ id: `sale-${sale.id}`, date: sale.date, actor: '', branchId: activeBranch?.id || '', action: 'Sale recorded', details: `${sale.customer || 'Walk-in customer'} · ${money(sale.total || 0)}`, reference: sale.id });
  for (const purchase of state.purchases) fallback.push({ id: `purchase-${purchase.id}`, date: purchase.date, actor: '', branchId: activeBranch?.id || '', action: 'Purchase order recorded', details: `${purchase.supplier || 'Supplier'} · ${money(purchase.total || 0)}`, reference: purchase.id });
  for (const entry of state.entries) fallback.push({ id: `entry-${entry.id}`, date: entry.date, actor: '', branchId: activeBranch?.id || '', action: entry.sourceType?.includes('payment') ? 'Payment recorded' : 'Account entry recorded', details: `${entry.partyType || ''} · ${entry.party || ''} · ${money(entry.amount || 0)} · ${entry.memo || ''}`, reference: entry.id });
  for (const movement of state.stockMovements) fallback.push({ id: `stock-${movement.id}`, date: movement.date, actor: movement.user || '', branchId: activeBranch?.id || '', action: 'Stock updated', details: `${movement.product || movement.productId} · ${movement.delta > 0 ? '+' : ''}${movement.delta}`, reference: movement.id });
  const known = new Set(saved.map(item => item.reference).filter(Boolean));
  const combined = [...saved, ...fallback.filter(item => !known.has(item.reference))];
  return combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, limit);
}

function openUserActivityHistory(user) {
  if (!isWorkspaceAdministrator()) { toast('Only an Owner / Administrator can view user activity'); return; }
  if (!user) { toast('This user account could not be found'); return; }
  const items = recentActivityItems(300).filter(item => item.actorId === user.id || (!item.actorId && item.actor === user.name));
  const rows = items.map(item => {
    const timestamp = item.date && Number.isFinite(new Date(item.date).getTime()) ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.date)) : dateLabel(String(item.date || '').slice(0, 10));
    return `<div class="activity-entry"><span class="activity-entry-icon">◷</span><div><strong>${esc(item.action)}</strong><small>${esc(item.details)}${item.reference ? ` · ${esc(item.reference)}` : ''}</small></div><time>${esc(timestamp)}</time></div>`;
  }).join('');
  openModal(`${esc(user.name)} · Activity`, `${items.length} recorded action${items.length === 1 ? '' : 's'} in this workspace`, items.length ? `<div class="activity-list">${rows}</div>` : '<div class="notification-empty"><p>No activity has been recorded for this user yet.</p></div>', 'Close');
}

function openActivityHistory() {
  if (!canViewActivity()) { toast('You do not have permission to view the activity history'); return; }
  const items = recentActivityItems().filter(item => isWorkspaceAdministrator() || item.branchId === activeBranch?.id);
  const rows = items.map(item => `<div class="activity-entry"><span class="activity-entry-icon">◷</span><div><strong>${esc(item.action)}</strong><small>${esc(item.details)}${item.reference ? ` · ${esc(item.reference)}` : ''}</small>${item.actor ? `<small>By ${esc(item.actor)}</small>` : ''}</div><time>${dateLabel(String(item.date || '').slice(0, 10))}</time></div>`).join('');
  openModal('Activity history', `${items.length} recent item${items.length === 1 ? '' : 's'} · saved actions and transaction history`, items.length ? `<div class="activity-list">${rows}</div>` : '<div class="notification-empty"><p>No activity has been recorded yet.</p></div>', 'Close');
}

document.getElementById('notifications-button')?.addEventListener('click', event => {
  event.stopPropagation();
  if (document.querySelector('.notifications-popover')) document.querySelector('.notifications-popover').remove();
  else openNotificationsPanel();
});
document.getElementById('branch-switch-button')?.addEventListener('click', event => {
  event.stopPropagation();
  if (document.querySelector('.branch-popover')) document.querySelector('.branch-popover').remove();
  else openBranchSwitcherPanel();
});
document.getElementById('activity-button')?.addEventListener('click', openActivityHistory);
document.addEventListener('click', event => {
  if (!event.target.closest('.notifications-popover') && !event.target.closest('#notifications-button')) document.querySelector('.notifications-popover')?.remove();
  if (!event.target.closest('.branch-popover') && !event.target.closest('#branch-switch-button')) document.querySelector('.branch-popover')?.remove();
});

function syncBackButton() {
  const button = document.getElementById('back-button');
  if (button) {
    button.disabled = page === 'home';
    button.setAttribute('title', page === 'home' ? 'Already at Home Hub' : 'Back to Home Hub');
    button.setAttribute('aria-label', page === 'home' ? 'Already at Home Hub' : 'Back to Home Hub');
  }
}

function setPage(next) {
  if (!next) return;
  if (next === page) { render(); return; }
  if (!canViewPage(next)) { toast('Your account does not have access to that section'); return; }
  pageHistory.push(page);
  page = next;
  history.pushState({ erpPage: next }, '', `#${next}`);
  tableQuery = '';
  selectedProductIds.clear();
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === next));
  const sb = document.getElementById('sidebar');
  sb?.classList.remove('open', 'hover-expanded');
  document.getElementById('sidebar-backdrop')?.classList.remove('active');
  if (typeof updateSidebarUI === 'function') updateSidebarUI();
  render();
}

function refreshPermissionVisibility() {
  const user = currentWorkspaceUser();

  // 1. Sidebar Nav Items and Group Labels
  let workspaceVisibleCount = 0;
  let manageVisibleCount = 0;

  document.querySelectorAll('.primary-nav .nav-item[data-page]').forEach(nav => {
    const pageName = nav.dataset.page;
    const allowed = canViewPage(pageName, user);
    nav.hidden = !allowed;
    nav.style.display = allowed ? '' : 'none';

    const isManage = ['customers', 'suppliers', 'users', 'branches', 'accounting', 'reports', 'settings'].includes(pageName);
    if (allowed) {
      if (isManage) manageVisibleCount++;
      else workspaceVisibleCount++;
    }
  });

  const workspaceLabel = document.querySelector('.primary-nav .nav-label:not(.nav-label-spaced)');
  if (workspaceLabel) {
    workspaceLabel.hidden = workspaceVisibleCount === 0;
    workspaceLabel.style.display = workspaceVisibleCount === 0 ? 'none' : '';
  }
  const manageLabel = document.querySelector('.primary-nav .nav-label.nav-label-spaced');
  if (manageLabel) {
    manageLabel.hidden = manageVisibleCount === 0;
    manageLabel.style.display = manageVisibleCount === 0 ? 'none' : '';
  }

  // 2. Hide ANY element in the app linking to a restricted page
  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.classList.contains('topbar-brand') || el.dataset.page === 'home') return;
    const allowed = canViewPage(el.dataset.page, user);
    el.hidden = !allowed;
    el.style.display = allowed ? '' : 'none';
  });

  // 3. Hide ANY action button that the user cannot perform
  document.querySelectorAll('[data-action]').forEach(el => {
    const allowed = canPerformAction(el.dataset.action, el);
    el.hidden = !allowed;
    el.style.display = allowed ? '' : 'none';
  });
}

function navigateBack() {
  pageHistory.length = 0;
  if (page !== 'home') {
    setPage('home');
  }
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
  modal.classList.toggle('transaction-modal', /sales order|purchase order|pos sale|stock take|stocktake/i.test(title));
  form.querySelectorAll('[data-action]').forEach(button => { button.hidden = !canPerformAction(button.dataset.action, button); });
  modal.showModal();
}

/* =========================================================
   ATTACHMENTS SUBSYSTEM
   ========================================================= */

let currentDraftAttachments = [];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function findAttachmentById(attId) {
  if (!attId) return null;
  const inDraft = currentDraftAttachments.find(a => a.id === attId);
  if (inDraft) return { attachment: inDraft, source: 'draft' };
  for (const o of state.orders || []) {
    const found = (o.attachments || []).find(a => a.id === attId);
    if (found) return { attachment: found, record: o, recordType: 'order' };
  }
  for (const s of state.sales || []) {
    const found = (s.attachments || []).find(a => a.id === attId);
    if (found) return { attachment: found, record: s, recordType: 'order' };
  }
  for (const p of state.purchases || []) {
    const found = (p.attachments || []).find(a => a.id === attId);
    if (found) return { attachment: found, record: p, recordType: 'purchase' };
  }
  for (const e of state.entries || []) {
    const found = (e.attachments || []).find(a => a.id === attId);
    if (found) return { attachment: found, record: e, recordType: 'entry' };
  }
  for (const ex of state.expenses || []) {
    const found = (ex.attachments || []).find(a => a.id === attId);
    if (found) return { attachment: found, record: ex, recordType: 'expense' };
  }
  return null;
}

function renderAttachmentCards(attachments = [], options = {}) {
  if (!attachments || !attachments.length) return '';
  return attachments.map(att => {
    const isPdf = att.type === 'application/pdf' || (att.name || '').toLowerCase().endsWith('.pdf');
    const previewContent = isPdf
      ? `<div class="att-thumb-pdf"><span class="pdf-tag">PDF</span></div>`
      : `<img class="att-thumb-img" src="${att.data}" alt="${esc(att.name)}" loading="lazy">`;
    return `
      <div class="attachment-item-card" data-att-id="${esc(att.id)}">
        <div class="att-item-left" data-action="view-attachment" data-att-id="${esc(att.id)}" title="Click to view ${esc(att.name)}" role="button" tabindex="0">
          <div class="att-thumb">${previewContent}</div>
          <div class="att-details">
            <strong class="att-filename" title="${esc(att.name)}">${esc(att.name)}</strong>
            <span class="att-metadata">${formatBytes(att.size)} · ${dateLabel(att.date || att.uploadedAt)} · ${esc(att.uploadedBy || 'User')}</span>
          </div>
        </div>
        <div class="att-item-actions">
          <button type="button" class="icon-btn-ghost" data-action="view-attachment" data-att-id="${esc(att.id)}" title="Preview file" aria-label="Preview">👁️</button>
          <button type="button" class="icon-btn-ghost" data-action="download-attachment" data-att-id="${esc(att.id)}" title="Download file" aria-label="Download">⬇️</button>
          ${options.allowDelete ? `<button type="button" class="icon-btn-ghost is-danger" data-action="delete-attachment" data-att-id="${esc(att.id)}" data-record-id="${esc(options.recordId || '')}" data-scope="${esc(options.scope || '')}" title="Delete attachment" aria-label="Delete">✕</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderAttachmentUploader(existingAttachments = [], scope = 'general') {
  currentDraftAttachments = Array.isArray(existingAttachments) ? structuredClone(existingAttachments) : [];
  return `
    <div class="attachments-wrap" data-attachment-scope="${esc(scope)}">
      <div class="attachments-header">
        <div class="attachments-heading">
          <span class="att-clip-icon">📎</span>
          <div>
            <strong>Attachments</strong>
            <small>Attach photos, invoices, receipts, or PDF documents</small>
          </div>
        </div>
        <label class="button small secondary file-browse-btn" for="attachment-file-input">
          <span>＋ Browse files</span>
          <input type="file" id="attachment-file-input" multiple accept="image/*,.pdf,application/pdf" style="display:none">
        </label>
      </div>
      <div class="attachments-dropzone" id="attachments-dropzone" tabindex="0" role="button" aria-label="Drop files here or click to browse">
        <span class="drop-icon">📁</span>
        <div class="drop-prompt">
          <strong>Drag &amp; drop photos or PDFs here</strong>
          <small>Or click to browse from device (Max 8MB per file)</small>
        </div>
      </div>
      <div class="attachments-list ${!currentDraftAttachments.length ? 'is-empty' : ''}" id="attachments-list">
        ${renderAttachmentCards(currentDraftAttachments, { allowDelete: true })}
      </div>
    </div>
  `;
}

function renderAttachmentsGallery(attachments = [], { scope, recordId, canAdd = true }) {
  const count = (attachments || []).length;
  const cards = renderAttachmentCards(attachments, { allowDelete: true, recordId, scope });
  return `
    <div class="attachments-wrap attachments-gallery-wrap" data-gallery-scope="${esc(scope)}" data-record-id="${esc(recordId)}">
      <div class="attachments-header">
        <div class="attachments-heading">
          <span class="att-clip-icon">📎</span>
          <div>
            <strong>Attachments (${count})</strong>
            <small>View or upload photos, invoices, receipts, or PDF documents</small>
          </div>
        </div>
        ${canAdd ? `
          <label class="button small primary file-browse-btn" for="gallery-file-input-${esc(recordId)}">
            <span>＋ Add attachment</span>
            <input type="file" id="gallery-file-input-${esc(recordId)}" data-gallery-record-id="${esc(recordId)}" data-gallery-scope="${esc(scope)}" multiple accept="image/*,.pdf,application/pdf" style="display:none">
          </label>
        ` : ''}
      </div>
      <div class="attachments-list ${count === 0 ? 'is-empty' : ''}" id="gallery-attachments-list-${esc(recordId)}">
        ${cards || `<div class="attachments-empty-state"><span style="font-size:24px">📄</span><p>No documents attached to this record yet.</p><small>Click <strong>＋ Add attachment</strong> above to upload documents or photos.</small></div>`}
      </div>
    </div>
  `;
}

function openAttachmentViewer(att) {
  if (!att) { toast('Attachment not found'); return; }
  const isPdf = att.type === 'application/pdf' || (att.name || '').toLowerCase().endsWith('.pdf');
  let content = '';
  if (isPdf) {
    content = `
      <div class="attachment-preview-container pdf-container" style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface,#f1f5f9);padding:10px 14px;border-radius:8px">
          <span>📄 <strong>${esc(att.name)}</strong> (${formatBytes(att.size)})</span>
          <a class="button small primary" href="${att.data}" target="_blank" download="${esc(att.name)}">Open / Download PDF ↗</a>
        </div>
        <iframe src="${att.data}" style="width:100%;height:60vh;border-radius:8px;border:1px solid var(--line);background:#525659" title="PDF Document Viewer"></iframe>
      </div>
    `;
  } else {
    content = `
      <div class="attachment-preview-container image-container" style="text-align:center;padding:12px;background:rgba(0,0,0,0.03);border-radius:8px">
        <img src="${att.data}" alt="${esc(att.name)}" style="max-width:100%;max-height:65vh;object-fit:contain;border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,0.12)">
      </div>
    `;
  }
  const extra = `<button type="button" class="button" data-action="download-attachment" data-att-id="${esc(att.id)}">⬇️ Download (${formatBytes(att.size)})</button>`;
  openModal(`Preview: ${esc(att.name)}`, `${formatBytes(att.size)} · Uploaded ${dateLabel(att.date || att.uploadedAt)} by ${esc(att.uploadedBy || 'User')}`, content, 'Close', extra);
}

function downloadAttachment(att) {
  if (!att || !att.data) return;
  const a = document.createElement('a');
  a.href = att.data;
  a.download = att.name || 'attachment';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function handleFilesSelected(files, onFileLoaded) {
  if (!files || !files.length) return;
  const maxBytes = 8 * 1024 * 1024;
  Array.from(files).forEach(file => {
    if (file.size > maxBytes) {
      toast(`"${file.name}" exceeds 8MB maximum size`);
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      toast(`"${file.name}" is not a supported image or PDF file`);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const att = {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: file.name,
        type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        size: file.size,
        date: new Date().toISOString(),
        uploadedBy: currentWorkspaceUser()?.name || 'Administrator',
        data: e.target.result
      };
      onFileLoaded(att);
    };
    reader.readAsDataURL(file);
  });
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

function branchSelectField(name, label, selectedId = '', branches = state.branches.filter(branch => branch.status !== 'Inactive')) {
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" required>${branches.map(branch => `<option value="${esc(branch.id)}" ${branch.id === selectedId ? 'selected' : ''}>${esc(branch.name)}</option>`).join('')}</select></div>`;
}

// Home Quick-Actions Hub Page
function renderHome() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Dar_es_Salaam', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const greeting = hour >= 5 && hour < 12 ? 'GOOD MORNING' : hour >= 12 && hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const user = currentWorkspaceUser();
  const userName = (user.name && user.name !== 'Guest') ? user.name : 'Administrator';
  const firstName = userName.trim().split(/\s+/)[0] || 'Administrator';
  const userRole = isAdministratorUser(user) ? 'Administrator' : (user.role || 'User');
  const userDisplay = `${userName}-${userRole}`;
  const companyTitle = state.companyName || 'My Business';
  const activeBranchObj = activeBranch || (state.branches || []).find(b => b.id === state.activeBranchId) || (state.branches || [])[0];
  const branchTitle = activeBranchObj ? activeBranchObj.name : (state.branch || 'Main branch');
  const branchStatus = activeBranchObj && activeBranchObj.status === 'Inactive' ? 'Closed' : 'Active';

  const allHubActions = [
    { page: 'dashboard', icon: '◫', title: 'View Dashboard', desc: 'View Trends and Performance' },
    { page: 'pos', icon: '🛒', title: 'Make a Sale', desc: 'Process sales and Print Receipts' },
    { page: 'sales', icon: '↗', title: 'Sales & Orders', desc: 'Manage customer orders and invoices' },
    { page: 'products', icon: '📦', title: 'Product Management', desc: 'Catalog, pricing, SKU, barcodes, and expiry' },
    { page: 'inventory', icon: '▤', title: 'Inventory Management', desc: 'Physical counts, stock takes, and audit history' },
    { page: 'purchases', icon: '🚚', title: 'Purchases', desc: 'Manage supplier orders and restock' },
    { page: 'expenses', icon: '🧾', title: 'Expenses', desc: 'View, filter, settle, and track all business expenses' },
    { page: 'reports', icon: '📊', title: 'Reports', desc: 'Product reports, payments, and financial insights' },
    { page: 'accounting', icon: '◈', title: 'Accounting & Ledger', desc: 'Customer and supplier account balances' },
    { page: 'customers', icon: '💳', title: 'Customers', desc: 'Manage customers and receivables' },
    { page: 'branches', icon: '🏢', title: 'Branch Management', desc: 'Manage branches and locations' }
  ];

  // Only display actions authorized to the specific user
  const visibleActions = allHubActions.filter(item =>
    item.action ? canPerformAction(item.action) : canViewPage(item.page, user)
  );

  const canViewSales = canViewPage('sales', user);
  const canViewPurchases = canViewPage('purchases', user);
  const canViewExpenses = canViewPage('expenses', user);
  const canViewAccounting = canViewPage('accounting', user);
  const canViewReports = canViewPage('reports', user);
  const canViewFinances = canViewSales || canViewPurchases || canViewExpenses || canViewAccounting || canViewReports || user.isBootstrap;

  const todayStr = today();
  const allOrders = typeof salesOrderRows === 'function' ? salesOrderRows() : (state.sales || []);
  const todayOrders = allOrders.filter(r => (r.date || '').slice(0, 10) === todayStr && r.status !== 'Draft' && r.status !== 'Cancelled');
  const totalRevenueToday = todayOrders.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const orderCountToday = todayOrders.length;
  const avgSale = orderCountToday > 0 ? Math.round(totalRevenueToday / orderCountToday) : 0;

  const todayPurchases = (state.purchases || []).filter(p => (p.date || '').slice(0, 10) === todayStr && p.status !== 'Draft' && p.status !== 'Cancelled');
  const purchaseExpensesToday = todayPurchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const otherExpensesToday = (state.expenses || []).filter(e => (e.date || '').slice(0, 10) === todayStr).reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0);
  const totalExpensesToday = purchaseExpensesToday + otherExpensesToday;
  const expenseCountToday = todayPurchases.length + (state.expenses || []).filter(e => (e.date || '').slice(0, 10) === todayStr).length;

  const netToday = totalRevenueToday - totalExpensesToday;

  const unpaidOrders = allOrders.filter(r => r.status !== 'Draft' && r.status !== 'Cancelled' && (typeof orderPaymentStatus === 'function' ? orderPaymentStatus(r) !== 'Fully paid' : Number(r.paid || 0) < Number(r.total || 0)));
  const unpaidTotal = unpaidOrders.reduce((sum, r) => sum + Math.max(0, Number(r.total || 0) - Number(r.paid || 0)), 0);
  const unpaidCount = unpaidOrders.length;

  const todayUnpaidOrders = todayOrders.filter(r => (typeof orderPaymentStatus === 'function' ? orderPaymentStatus(r) !== 'Fully paid' : Number(r.paid || 0) < Number(r.total || 0)));
  const todayUnpaidTotal = todayUnpaidOrders.reduce((sum, r) => sum + Math.max(0, Number(r.total || 0) - Number(r.paid || 0)), 0);

  return `
    <div class="hub-container">
      <header class="hub-header">
        <span class="hub-kicker">${esc(greeting)}, ${esc(firstName.toUpperCase())}</span>
        <h1 class="hub-title">${esc(companyTitle)}</h1>
        <div class="hub-meta-row">
          <span class="hub-status-dot ${branchStatus === 'Closed' ? 'dot-closed' : ''}"></span>
          <span>${esc(branchTitle)} · ${esc(userDisplay)}</span>
          ${canViewPage('settings', user) ? `
            <span class="hub-status-divider">|</span>
            <button type="button" class="hub-edit-link" data-page="settings" title="Edit company and branch profile">✎ Edit profile</button>
          ` : ''}
        </div>
      </header>

      <section class="hub-actions-grid" aria-label="Quick Actions">
        ${visibleActions.length ? visibleActions.map(action => `
          <button type="button" class="hub-action-box ${action.fast ? 'hub-fast-action' : ''}" ${action.action ? `data-action="${esc(action.action)}"` : `data-page="${esc(action.page)}"`}>
            <div class="hub-box-icon">${action.icon}</div>
            <strong class="hub-box-title">${esc(action.title)}${action.fast ? '<span class="hub-fast-pill">Fast</span>' : ''}</strong>
            <span class="hub-box-desc">${esc(action.desc)}</span>
          </button>
        `).join('') : `
          <div class="hub-empty-actions inline-note">
            No quick actions are authorized for your account. Contact an administrator to assign module access.
          </div>
        `}
      </section>

      <!-- Bottom Detailed Financial Section (Only visible if user has financial viewing permissions) -->
      ${canViewFinances ? `
      <section class="hub-finance-section" aria-label="Daily Financial Summary">
        <div class="hub-finance-header">
          <div class="hub-finance-header-text">
            <h2 class="hub-finance-title">Today's Financial Summary</h2>
            <p class="hub-finance-subtitle">Comprehensive breakdown of daily revenue, expenses, net balance, and unpaid orders</p>
          </div>
          <div class="hub-finance-header-badges">
            <span class="hub-date-badge">📅 ${dateLabel(todayStr)}</span>
          </div>
        </div>

        <div class="hub-finance-cards-grid">
          ${canViewSales ? `
          <button type="button" class="hub-fin-card" data-page="sales" title="Click to open Sales & Orders">
            <div class="hub-fin-card-top">
              <span class="hub-fin-card-label">Total Revenue</span>
              <span class="hub-fin-pill pill-revenue">${orderCountToday} sale${orderCountToday === 1 ? '' : 's'}</span>
            </div>
            <strong class="hub-fin-card-value font-mono">${money(totalRevenueToday)}</strong>
            <span class="hub-fin-card-footer">Avg ${money(avgSale)} per sale</span>
          </button>
          ` : ''}

          ${(canViewExpenses || canViewPurchases || canViewAccounting) ? `
          <button type="button" class="hub-fin-card" data-page="${canViewExpenses ? 'expenses' : canViewPurchases ? 'purchases' : 'accounting'}" title="Click to open Expenses">
            <div class="hub-fin-card-top">
              <span class="hub-fin-card-label">Daily Expenses</span>
              <span class="hub-fin-pill pill-expense">${expenseCountToday} outflow${expenseCountToday === 1 ? '' : 's'}</span>
            </div>
            <strong class="hub-fin-card-value font-mono">${money(totalExpensesToday)}</strong>
            <span class="hub-fin-card-footer">Operating expenses & purchases</span>
          </button>
          ` : ''}

          ${canViewReports ? `
          <button type="button" class="hub-fin-card ${netToday >= 0 ? 'card-profit' : 'card-loss'}" data-page="reports" title="Click to open Reports">
            <div class="hub-fin-card-top">
              <span class="hub-fin-card-label">Net Daily Result (Revenue − Expenses)</span>
              <span class="hub-fin-pill ${netToday >= 0 ? 'pill-profit' : 'pill-loss'}">${netToday >= 0 ? 'Net Profit' : 'Deficit'}</span>
            </div>
            <strong class="hub-fin-card-value font-mono ${netToday >= 0 ? 'value-profit' : 'value-loss'}">${netToday < 0 ? '− ' : '+ '}${money(Math.abs(netToday))}</strong>
            <span class="hub-fin-card-footer">Daily revenue minus daily expenses</span>
          </button>
          ` : ''}

          ${canViewSales ? `
          <button type="button" class="hub-fin-card card-unpaid" data-page="sales" title="Click to view Unpaid Orders">
            <div class="hub-fin-card-top">
              <span class="hub-fin-card-label">Unpaid Sales Orders</span>
              <span class="hub-fin-pill pill-unpaid">${unpaidCount} unpaid</span>
            </div>
            <strong class="hub-fin-card-value font-mono value-unpaid">${money(unpaidTotal)}</strong>
            <span class="hub-fin-card-footer">${todayUnpaidOrders.length} from today (${money(todayUnpaidTotal)})</span>
          </button>
          ` : ''}
        </div>

        <div class="hub-table-wrapper">
          <table class="hub-finance-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th class="text-center">Transactions</th>
                <th class="text-right">Balance / Amount</th>
                <th class="text-right">Quick Link</th>
              </tr>
            </thead>
            <tbody>
              ${canViewSales ? `
              <tr>
                <td>
                  <div class="hub-table-cat">
                    <span class="hub-bullet bullet-revenue"></span>
                    <strong>Total Revenue of the Day</strong>
                  </div>
                </td>
                <td class="text-muted">Total customer sales and POS orders finalized today</td>
                <td class="text-center"><span class="badge">${orderCountToday} record${orderCountToday === 1 ? '' : 's'}</span></td>
                <td class="text-right font-mono text-positive">+${money(totalRevenueToday)}</td>
                <td class="text-right"><button type="button" class="hub-table-btn" data-page="sales">View Sales →</button></td>
              </tr>
              ` : ''}
              ${(canViewExpenses || canViewPurchases || canViewAccounting) ? `
              <tr>
                <td>
                  <div class="hub-table-cat">
                    <span class="hub-bullet bullet-expense"></span>
                    <strong>Expenses of the Day</strong>
                  </div>
                </td>
                <td class="text-muted">Operating expenses and supplier purchases logged today</td>
                <td class="text-center"><span class="badge">${expenseCountToday} record${expenseCountToday === 1 ? '' : 's'}</span></td>
                <td class="text-right font-mono text-expense">−${money(totalExpensesToday)}</td>
                <td class="text-right"><button type="button" class="hub-table-btn" data-page="${canViewExpenses ? 'expenses' : canViewPurchases ? 'purchases' : 'accounting'}">View Expenses →</button></td>
              </tr>
              ` : ''}
              ${canViewReports ? `
              <tr class="hub-table-row-highlight">
                <td>
                  <div class="hub-table-cat">
                    <span class="hub-bullet ${netToday >= 0 ? 'bullet-profit' : 'bullet-loss'}"></span>
                    <strong>Net Result (Revenue − Expenses)</strong>
                  </div>
                </td>
                <td class="text-muted">Net financial margin after subtracting daily expenses from daily revenue</td>
                <td class="text-center"><span class="badge ${netToday >= 0 ? 'badge-profit' : 'badge-loss'}">${netToday >= 0 ? 'Positive Margin' : 'Deficit'}</span></td>
                <td class="text-right font-mono ${netToday >= 0 ? 'text-positive' : 'text-danger'}"><strong>${netToday < 0 ? '− ' : '+ '}${money(Math.abs(netToday))}</strong></td>
                <td class="text-right"><button type="button" class="hub-table-btn" data-page="reports">View Reports →</button></td>
              </tr>
              ` : ''}
              ${canViewSales ? `
              <tr>
                <td>
                  <div class="hub-table-cat">
                    <span class="hub-bullet bullet-unpaid"></span>
                    <strong>Unpaid Sales Orders</strong>
                  </div>
                </td>
                <td class="text-muted">Total outstanding customer orders awaiting payment settlement</td>
                <td class="text-center"><span class="badge badge-warning">${unpaidCount} order${unpaidCount === 1 ? '' : 's'}</span></td>
                <td class="text-right font-mono text-warning"><strong>${money(unpaidTotal)}</strong></td>
                <td class="text-right"><button type="button" class="hub-table-btn" data-page="sales">Manage Orders →</button></td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </section>
      ` : ''}
    </div>
  `;
}

// Dashboard Page
function greetingTitle() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Dar_es_Salaam', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const greeting = hour >= 5 && hour < 12 ? 'GOOD MORNING' : hour >= 12 && hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const firstName = (currentWorkspaceUser().name || 'there').trim().split(/\s+/)[0] || 'there';
  return `${greeting}, ${firstName.toUpperCase()} 👋`;
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
  const user = currentWorkspaceUser();
  const canSales = canViewPage('sales', user);
  const canPOS = canViewPage('pos', user);
  const canInventory = canViewPage('inventory', user) || canViewPage('products', user);
  const canCustomers = canViewPage('customers', user);
  const canSuppliers = canViewPage('suppliers', user);
  const canExpenses = canViewPage('expenses', user);
  const canAccounting = canViewPage('accounting', user);
  const canReports = canViewPage('reports', user);

  const monthSales = dashboardSales().reduce((sum, s) => sum + s.total, 0);
  const receivable = accountOutstandingTotal('Customer');
  const payable = accountOutstandingTotal('Supplier');
  const low = state.products.filter(p => p.stock <= p.low).length;

  const metrics = [];
  if (canSales || canReports) {
    metrics.push(metric('Total sales', money(monthSales), '↗', `${dashboardRange} · across all channels`));
    metrics.push(metric('Orders', String(state.orders.length + state.sales.length), '▤', 'Orders & POS transactions'));
  }
  if (canCustomers || canAccounting) {
    metrics.push(metric('To collect', money(receivable), '◷', `${state.customers.filter(c => c.balance > 0).length} customers · outstanding`, 'down'));
  }
  if (canInventory) {
    metrics.push(metric('Stock alerts', String(low), '⚑', low ? `${low} products need attention` : 'All stock levels healthy', low ? 'down' : 'up'));
  }

  const quickActions = [];
  if (canPOS && canPerformAction('add-cart')) {
    quickActions.push(`<button class="quick-action" data-page="pos"><span class="quick-icon">▦</span><span class="quick-copy"><strong>Open point of sale</strong><small>Start a quick checkout</small></span><span class="quick-arrow">›</span></button>`);
  }
  if (canSales && canPerformAction('new-order')) {
    quickActions.push(`<button class="quick-action" data-action="new-order"><span class="quick-icon">↗</span><span class="quick-copy"><strong>Create sales order</strong><small>For a customer or business</small></span><span class="quick-arrow">›</span></button>`);
  }
  if (canInventory && canPerformAction('new-product')) {
    quickActions.push(`<button class="quick-action" data-action="new-product"><span class="quick-icon">＋</span><span class="quick-copy"><strong>Add a product</strong><small>Update your catalogue</small></span><span class="quick-arrow">›</span></button>`);
  }
  if ((canAccounting || canCustomers || canSuppliers) && canPerformAction('record-payment')) {
    quickActions.push(`<button class="quick-action" data-action="record-payment"><span class="quick-icon">◈</span><span class="quick-copy"><strong>Record a payment</strong><small>Customer or supplier account</small></span><span class="quick-arrow">›</span></button>`);
  }
  if ((canExpenses || canAccounting) && canPerformAction('new-expense')) {
    quickActions.push(`<button class="quick-action" data-action="new-expense"><span class="quick-icon">🧾</span><span class="quick-copy"><strong>Record an expense</strong><small>Log cost, payment &amp; receipt</small></span><span class="quick-arrow">›</span></button>`);
  }

  const notes = [];
  if ((canSuppliers || canAccounting) && payable > 0) notes.push(`${money(payable)} payable to suppliers`);
  if (canInventory) notes.push(`${low} low stock items`);

  return `
    ${heading(esc(greetingTitle()), 'Here’s what’s happening with your business today.', `
      <select class="select-control" id="dashboard-range">
        <option ${dashboardRange === 'This month' ? 'selected' : ''}>This month</option>
        <option ${dashboardRange === 'This week' ? 'selected' : ''}>This week</option>
        <option ${dashboardRange === 'Today' ? 'selected' : ''}>Today</option>
      </select>
      ${canPerformAction('new-expense') ? '<button class="button" data-action="new-expense"><span>＋</span> Record expense</button>' : ''}
      ${canPerformAction('new-order') ? '<button class="button primary" data-action="new-order"><span>＋</span> New sale</button>' : ''}
    `)}
    ${metrics.length ? `<section class="metric-grid">${metrics.join('')}</section>` : ''}
    ${(canSales || canReports) ? `
    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">Sales performance</h2><p class="panel-subtitle">Daily sales · ${esc(dashboardRange.toLowerCase())}</p></div><div class="legend"><span><i></i>Sales</span></div></div>
        ${barChart(dashboardRange)}
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">Sales by payment method</h2><p class="panel-subtitle">Share of transaction value · ${esc(dashboardRange.toLowerCase())}</p></div>${canReports ? '<button class="text-link" data-page="reports">Details</button>' : ''}</div>
        ${paymentMix(dashboardRange)}
      </article>
    </section>
    ` : ''}
    <section class="recent-grid">
      ${canSales ? recentSalesTable() : '<article class="table-panel"><div class="empty-state">No sales activity allowed for this account.</div></article>'}
      <aside class="quick-panel">
        <div class="panel-header"><div><h2 class="panel-title">Quick actions</h2><p class="panel-subtitle">Get the important things done</p></div></div>
        <div class="quick-list">
          ${quickActions.length ? quickActions.join('') : '<div class="empty-state" style="padding:16px">No quick actions authorized.</div>'}
        </div>
        ${notes.length ? `<div class="inline-note" style="margin-top:14px">${esc(notes.join(' · '))}</div>` : ''}
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
  recordActivity(existing ? 'POS draft updated' : 'POS draft saved', `${order.customer} · ${money(total)}`, draftId);
  saveState();
  toast(`Draft ${draftId} saved`);
  render();
}

function completePOS() {
  if (!posCart.length) return;
  const method = document.getElementById('pos-method')?.value || posMethod;
  const customer = document.getElementById('pos-customer')?.value || posCustomer;
  if (method.toLowerCase().includes('credit') && (!customer || customer === 'Walk-in customer')) {
    toast('Credit sales for due payment require a registered customer account');
    return;
  }
  const total = posCart.reduce((sum, line) => sum + line.qty * line.price, 0);
  const existing = state.orders.find(order => order.id === posDraftOrderId && order.source === 'POS' && order.status === 'Draft');
  const creditCustomer = state.customers.find(item => item.name === customer), creditLimit = Number(creditCustomer?.creditLimit) || 0;
  if (method === 'Credit' && creditLimit > 0 && (Number(creditCustomer.balance) || 0) + total > creditLimit) { toast(`Credit limit exceeded for ${customer}`); return; }

  for (const line of posCart) {
    const product = state.products.find(p => p.id === line.id);
    if (!product || product.stock < line.qty) {
      toast(`Insufficient stock for ${product?.name || 'an item'} (${product?.stock || 0} in stock)`);
      return;
    }
  }

  const saleId = existing?.id || idFor('POS', state.sales);
  const changedProducts = [];
  for (const line of posCart) {
    const product = state.products.find(p => p.id === line.id);
    if (product) {
      const before = product.stock;
      product.stock = Math.max(0, product.stock - line.qty);
      state.stockMovements.unshift({
        id: idFor('STK', state.stockMovements),
        productId: product.id,
        product: product.name,
        date: today(),
        before,
        after: product.stock,
        delta: product.stock - before,
        reason: `POS sale ${saleId}`,
        user: currentWorkspaceUser().name
      });
      changedProducts.push(product);
    }
  }

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
  recordActivity('POS sale completed', `${customer} · ${money(total)} · ${method}`, sale.id);
  posCart = [];
  posDraftOrderId = '';
  posCustomer = 'Walk-in customer';
  posMethod = 'Cash';
  posCategory = '';
  saveState();
  syncProductsBatchToCloud(changedProducts);
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
const salesPaymentMethods = [
  'Cash',
  'Credit (Due payment)',
  'Mobile payment (M-Pesa)',
  'Mobile payment (Tigo Pesa)',
  'Mobile payment (Airtel Money)',
  'Bank transfer',
  'Card'
];

function orderPaymentMethodLabel(order) {
  let m = order.paymentMethod || order.posMethod || '';
  if (!m && Number(order.paid || 0) === 0 && order.status !== 'Draft') {
    return 'Credit (Due payment)';
  }
  if (!m) m = 'Cash';
  const lower = String(m).toLowerCase();
  if (lower.includes('credit') || lower.includes('due') || lower.includes('on account')) {
    return 'Credit (Due payment)';
  }
  if (lower.includes('m-pesa') || lower.includes('mpesa')) return 'Mobile (M-Pesa)';
  if (lower.includes('tigo')) return 'Mobile (Tigo Pesa)';
  if (lower.includes('airtel')) return 'Mobile (Airtel)';
  if (lower.includes('mobile')) return 'Mobile payment';
  if (lower.includes('bank') || lower.includes('transfer')) return 'Bank transfer';
  if (lower.includes('card')) return 'Card';
  if (lower.includes('cash')) return 'Cash';
  return m;
}

function methodPillClass(order) {
  const m = orderPaymentMethodLabel(order).toLowerCase();
  if (m.includes('credit') || m.includes('due')) return 'status-method-credit';
  if (m.includes('mobile') || m.includes('m-pesa') || m.includes('tigo') || m.includes('airtel')) return 'status-method-mobile';
  if (m.includes('bank') || m.includes('transfer')) return 'status-method-bank';
  if (m.includes('card')) return 'status-method-card';
  return 'status-method-cash';
}

function salesOrderRows() {
  const linked = new Set(state.orders.map(o => o.invoiceId).filter(Boolean));
  const legacyPOS = state.sales.filter(s => s.channel === 'POS' && !linked.has(s.id) && !state.orders.some(o => o.id === s.id)).map(s => ({
    id: s.id, source: 'POS', customer: s.customer, date: s.date, due: s.date,
    total: s.total, items: s.items || [], status: 'Final',
    finalAt: s.date ? new Date(`${s.date}T12:00:00`).toISOString() : new Date().toISOString(),
    paid: s.status === 'Paid' ? s.total : 0, posMethod: s.method, paymentMethod: s.method, invoiceId: s.id,
    discrepancies: s.discrepancies || []
  }));
  return [...state.orders, ...legacyPOS];
}

function renderSales() {
  const allRows = salesOrderRows();
  const rows = allRows.filter(row => {
    if (salesStatusFilter && row.status !== salesStatusFilter) return false;
    if (!isWithinDateRange(row.date, salesDateFrom, salesDateTo)) return false;
    if (salesPaymentFilter) {
      const ps = orderPaymentStatus(row);
      if (salesPaymentFilter === 'paid' && ps !== 'Fully paid') return false;
      if (salesPaymentFilter === 'partial' && ps !== 'Partially paid') return false;
      if (salesPaymentFilter === 'unpaid' && ps !== 'Due') return false;
    }
    if (salesDeliveryFilter) {
      const hasIssues = Array.isArray(row.discrepancies) && row.discrepancies.length > 0;
      if (salesDeliveryFilter === 'issues' && !hasIssues) return false;
      if (salesDeliveryFilter === 'clean' && hasIssues) return false;
    }
    if (tableQuery && !`${row.id} ${row.customer} ${row.status} ${row.paymentMethod || row.posMethod || ''} ${orderPaymentMethodLabel(row)} ${row.source || 'Order'}`.toLowerCase().includes(tableQuery.toLowerCase())) return false;
    return true;
  });

  const todayStr = today();
  const dailySalesTotal = rows
    .filter(r => (r.date || '').slice(0, 10) === todayStr)
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
  const dailyExpenseTotal = (state.purchases || [])
    .filter(p => isWithinDateRange(p.date, salesDateFrom, salesDateTo) && (p.date || '').slice(0, 10) === todayStr)
    .reduce((sum, p) => sum + Number(p.total || 0), 0);

  const unpaidTotal = rows
    .filter(r => orderPaymentStatus(r) !== 'Fully paid' && r.status !== 'Draft')
    .reduce((sum, r) => sum + Math.max(0, Number(r.total || 0) - Number(r.paid || 0)), 0);

  const deliveryMistakesCount = rows.filter(r => Array.isArray(r.discrepancies) && r.discrepancies.length > 0).length;

  return `
    ${heading('Sales & orders', 'Manage customer orders, fulfillments, invoices, and payments.', `
      <button class="button" data-page="pos">▦ Point of sale</button>
      <button class="button primary" data-action="new-order">＋ Sales order</button>
    `)}

    <section class="filter-bar">
      <div class="filter-bar-inner">
        <label class="filter-label">Status
          <select class="select-control" id="sales-status">
            <option value="" ${salesStatusFilter === '' ? 'selected' : ''}>All statuses</option>
            <option value="Draft" ${salesStatusFilter === 'Draft' ? 'selected' : ''}>Draft</option>
            <option value="Final" ${salesStatusFilter === 'Final' ? 'selected' : ''}>Final</option>
            <option value="Edited" ${salesStatusFilter === 'Edited' ? 'selected' : ''}>Edited</option>
            <option value="Completed" ${salesStatusFilter === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </label>
        <label class="filter-label">Payment
          <select class="select-control" id="sales-payment">
            <option value="" ${salesPaymentFilter === '' ? 'selected' : ''}>All payments</option>
            <option value="paid" ${salesPaymentFilter === 'paid' ? 'selected' : ''}>Fully paid</option>
            <option value="partial" ${salesPaymentFilter === 'partial' ? 'selected' : ''}>Partially paid</option>
            <option value="unpaid" ${salesPaymentFilter === 'unpaid' ? 'selected' : ''}>Unpaid / Due</option>
          </select>
        </label>
        <label class="filter-label">Delivery
          <select class="select-control" id="sales-delivery">
            <option value="" ${salesDeliveryFilter === '' ? 'selected' : ''}>All deliveries</option>
            <option value="issues" ${salesDeliveryFilter === 'issues' ? 'selected' : ''}>With delivery mistakes</option>
            <option value="clean" ${salesDeliveryFilter === 'clean' ? 'selected' : ''}>No mistakes reported</option>
          </select>
        </label>
        ${dateRangeFilter('sales', salesDateFrom, salesDateTo)}
        ${salesStatusFilter || salesPaymentFilter || salesDeliveryFilter || salesDateFrom || salesDateTo ? `<button class="button small" data-action="clear-sales-filters">✕ Clear filters</button>` : ''}
      </div>
    </section>

    <section class="summary-strip">
      <div class="summary-mini"><small>Daily sales</small><strong>${money(dailySalesTotal)}</strong></div>
      <div class="summary-mini"><small>Daily expenses</small><strong>${money(dailyExpenseTotal)}</strong></div>
      <div class="summary-mini"><small>Unpaid invoices</small><strong>${money(unpaidTotal)}</strong></div>
      <div class="summary-mini ${deliveryMistakesCount > 0 ? 'summary-warning' : ''}"><small>Delivery mistakes</small><strong>${deliveryMistakesCount} order${deliveryMistakesCount === 1 ? '' : 's'}</strong></div>
    </section>

    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="table-search" placeholder="Search order ID, customer, status, payment method…" value="${esc(tableQuery)}"></label>
          <span class="muted" style="font-size:11px">${rows.length} of ${allRows.length} orders</span>
        </div>
        <div class="toolbar-right">
          <button class="button small" data-action="export-sales">↓ Export CSV</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order date</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Due amount</th>
              <th>Payment method</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
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
    const discrepancies = order.discrepancies || [];
    const hasDiscrepancies = discrepancies.length > 0;
    const unresolvedCount = discrepancies.filter(d => d.status !== 'Resolved').length;
    const method = orderPaymentMethodLabel(order);
    const total = Number(order.total || 0);
    const paid = Number(order.paid || 0);
    const dueAmount = Math.max(0, total - paid);
    const paymentStatus = orderPaymentStatus(order);

    let dueDisplay = '<span class="due-amount-cell is-paid">—</span>';
    if (paymentStatus === 'Partially paid' && dueAmount > 0) {
      dueDisplay = `<strong class="due-amount-cell is-partial" title="Total ${money(total)} · Paid ${money(paid)}">${money(dueAmount)}</strong>`;
    } else if (paymentStatus === 'Due' && dueAmount > 0) {
      dueDisplay = `<strong class="due-amount-cell is-due" title="Total ${money(total)} · Unpaid">${money(dueAmount)}</strong>`;
    } else if (dueAmount > 0 && !draft) {
      dueDisplay = `<strong class="due-amount-cell is-due">${money(dueAmount)}</strong>`;
    }

    return `
      <tr>
        <td><strong>${dateLabel(order.date)}</strong></td>
        <td>
          <strong>${esc(order.id)}</strong>
          <small class="row-source">${pos ? 'POS sale' : 'Sales order'}</small>
          ${Array.isArray(order.attachments) && order.attachments.length > 0 ? `<div style="margin-top:4px"><span class="status-pill status-attachment" title="${order.attachments.length} document(s) attached">📎 ${order.attachments.length} attachment${order.attachments.length > 1 ? 's' : ''}</span></div>` : ''}
          ${hasDiscrepancies ? `<div style="margin-top:4px"><span class="status-pill status-issue" title="${discrepancies.length} delivery mistake(s) reported">${unresolvedCount > 0 ? '⚠️' : '✓'} ${discrepancies.length} Delivery Mistake${discrepancies.length > 1 ? 's' : ''}${unresolvedCount > 0 ? ` (${unresolvedCount} open)` : ''}</span></div>` : ''}
        </td>
        <td>${esc(order.customer)}</td>
        <td><strong>${money(order.total)}</strong></td>
        <td>${dueDisplay}</td>
        <td><span class="status-pill ${methodPillClass(order)}">${esc(method)}</span></td>
        <td><span class="status-pill ${statusClass(order.status)}">${esc(order.status)}</span></td>
        <td><span class="status-pill ${orderPaymentClass(order)}">${paymentStatus}</span></td>
        <td>
          <details class="order-actions sales-order-actions">
            <summary aria-label="Actions for ${esc(order.id)}" title="Order actions">⋮</summary>
            <div class="order-actions-menu">
              ${draft && pos ? `<button data-action="resume-pos" data-id="${esc(order.id)}">Resume POS sale</button>` : ''}
              <button data-action="edit-order" data-id="${esc(order.id)}">Edit ${pos ? 'sale' : 'order'}</button>
              <button data-action="view-order" data-id="${esc(order.id)}">View ${pos ? 'sale' : 'order'}</button>
              <button data-action="manage-delivery-issues" data-id="${esc(order.id)}">⚠️ Delivery mistakes ${hasDiscrepancies ? `(${discrepancies.length})` : ''}</button>
              <button data-action="print-order-invoice" data-id="${esc(order.id)}" ${draft && pos ? 'disabled title="Complete the POS sale first"' : ''}>Print invoice</button>
              <button data-action="add-order-payment" data-id="${esc(order.id)}" ${draft ? 'disabled title="Save the order first"' : ''}>Add payment</button>
              <button data-action="manage-order-returns" data-id="${esc(order.id)}" ${draft ? 'disabled title="Save the order first"' : ''}>Manage returns</button>
              <span class="menu-divider"></span>
              <button class="danger-action" data-action="delete-order" data-id="${esc(order.id)}">Delete ${pos ? 'sale' : 'order'}${isWorkspaceAdministrator() && order.status !== 'Draft' ? ' · admin override' : ''}</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('') || emptyRow(9, 'No matching sales or orders');
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
    const changedProducts = [];
    for (const line of order.items || []) {
      const product = state.products.find(item => item.id === line.productId);
      if (!product) continue;
      const before = product.stock;
      product.stock -= Number(line.qty) || 0;
      state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId: product.id, product: product.name, date: order.date || today(), before, after: product.stock, delta: product.stock - before, reason: `Sales order ${order.id}`, user: currentWorkspaceUser().name });
      changedProducts.push(product);
    }
    order.status = 'Final';
    order.finalAt = new Date().toISOString();
    if (state.customers.some(customer => customer.name === order.customer)) {
      postAccountEntry({ partyType: 'Customer', party: order.customer, date: order.date, type: 'Debit', amount: order.total, memo: `Sales order · ${order.id}`, sourceType: 'order', sourceId: order.id });
      if ((order.paid || 0) > 0) postAccountEntry({ partyType: 'Customer', party: order.customer, date: order.date, type: 'Credit', amount: order.paid, memo: `Payment · ${order.paymentMethod || 'Cash'} · ${order.id}`, sourceType: 'order-payment', sourceId: order.id });
    }
    recordActivity('Sales order finalized', `${order.customer} · ${money(order.total)}`, order.id);
  } else if (order.status === 'Edited') {
    order.status = 'Final';
    order.finalAt = new Date().toISOString();
    recordActivity('Sales order finalized again', `${order.customer} · ${money(order.total)}`, order.id);
  }
  ensureOrderInvoice(order);
  saveState();
  if (typeof changedProducts !== 'undefined' && changedProducts.length) {
    syncProductsBatchToCloud(changedProducts);
  }
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
  const tax = calculateTaxBreakdown(order.total, state.vatEnabled !== false, state.vatRate || 18);
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
      <title>Tax Invoice ${esc(invoice.id)}</title>
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
          <h2 style="margin:0;color:#087f9d">TAX INVOICE</h2>
          <strong>${esc(invoice.id)}</strong><br>
          <small>Order ${esc(order.id)} · ${dateLabel(invoice.date)}</small><br>
          <small style="color:#526973">TRA Electronic Fiscal Receipt</small>
        </div>
      </header>
      <p style="margin-top:20px"><strong>Billed to:</strong> ${esc(order.customer)}</p>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${(order.discrepancies && order.discrepancies.length > 0) ? `
        <div style="margin-top:20px;padding:12px 14px;border:1.5px solid #dc2626;border-radius:6px;background:#fff5f5">
          <div style="font-size:11.5px;font-weight:800;color:#991b1b;margin-bottom:6px;display:flex;align-items:center;gap:6px">
            <span>⚠️ DELIVERY VERIFICATION & DISCREPANCY RECORD</span>
          </div>
          <table style="margin-top:6px;font-size:11px">
            <thead>
              <tr style="background:#fee2e2;color:#991b1b">
                <th style="padding:5px 6px">Mistake Type</th>
                <th style="padding:5px 6px">Item</th>
                <th style="padding:5px 6px">Ordered</th>
                <th style="padding:5px 6px">Delivered</th>
                <th style="padding:5px 6px">Shortage / Diff</th>
                <th style="padding:5px 6px">Status & Note</th>
              </tr>
            </thead>
            <tbody>
              ${order.discrepancies.map(d => `
                <tr>
                  <td style="padding:5px 6px;font-weight:bold;color:#b91c1c">${esc(d.typeLabel || d.type)}</td>
                  <td style="padding:5px 6px">${esc(d.productName || 'Item')}${d.substitutedProduct ? `<br><small style="color:#b91c1c">Sent instead: ${esc(d.substitutedProduct)}</small>` : ''}</td>
                  <td style="padding:5px 6px">${d.orderedQty ?? '-'}</td>
                  <td style="padding:5px 6px">${d.deliveredQty ?? '-'}</td>
                  <td style="padding:5px 6px;font-weight:bold;color:#b91c1c">${d.shortageQty ?? (d.orderedQty != null && d.deliveredQty != null ? (d.orderedQty - d.deliveredQty) : '-')}</td>
                  <td style="padding:5px 6px"><strong>${esc(d.status || 'Pending')}</strong>${d.note ? ` · ${esc(d.note)}` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      <div class="summary-grid">
        <section class="summary-column">
          <h2>Outstanding balances</h2>
          <div class="summary-row"><span>Previous outstanding balance</span><strong>${money(previousOutstanding)}</strong></div>
          <div class="summary-row"><span>Balance due on this invoice</span><strong>${money(balance)}</strong></div>
          <div class="summary-row total"><span>Total outstanding balance</span><strong>${money(totalOutstanding)}</strong></div>
        </section>
        <section class="summary-column">
          <h2>Invoice total</h2>
          <div class="summary-row"><span>Gross subtotal</span><strong>${money(subtotal)}</strong></div>
          ${order.discount ? `<div class="summary-row"><span>Discount</span><strong>− ${money(order.discount)}</strong></div>` : ''}
          ${order.additionalCharges ? `<div class="summary-row"><span>Additional charges</span><strong>${money(order.additionalCharges)}</strong></div>` : ''}
          ${tax.isEnabled && tax.vat > 0 ? `
            <div class="summary-row"><span>Taxable amount (Net)</span><strong>${money(tax.net)}</strong></div>
            <div class="summary-row"><span>VAT (${tax.vatRate}%)</span><strong>${money(tax.vat)}</strong></div>
          ` : ''}
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

// Stock Taking System (Multi-Product, Fast Operations, Expiry Date & Pause/Resume)
function renderStocktakeVariance(countedVal, currentStock, unit = '') {
  if (countedVal === '' || countedVal === null || countedVal === undefined || isNaN(Number(countedVal))) {
    return '<span class="muted" style="font-size:11px">Pending</span>';
  }
  const counted = Number(countedVal);
  const diff = counted - Number(currentStock || 0);
  if (diff === 0) {
    return '<span class="stocktake-var match">✓ 0 (Matched)</span>';
  }
  if (diff < 0) {
    return `<span class="stocktake-var shortage">▼ ${diff} ${unit} (Shortage)</span>`;
  }
  return `<span class="stocktake-var surplus">▲ +${diff} ${unit} (Surplus)</span>`;
}

function renderStocktakeExpiryBadge(dateStr) {
  if (!dateStr) return '<small class="muted" style="font-size:10px">No expiry set</small>';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  exp.setHours(0, 0, 0, 0);
  const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return `<small class="text-danger" style="font-weight:700;font-size:10px">⚠️ Expired (${Math.abs(diffDays)}d ago)</small>`;
  }
  if (diffDays <= 30) {
    return `<small style="color:#d97706;font-weight:700;font-size:10px">⚠️ Expiring in ${diffDays}d</small>`;
  }
  return `<small style="color:#16a34a;font-weight:600;font-size:10px">✓ Good (${diffDays}d left)</small>`;
}

function renderStocktakeRow(item) {
  const p = state.products.find(prod => prod.id === item.productId) || {
    id: item.productId,
    name: item.productName || item.productId,
    category: item.category || 'General',
    stock: item.currentStock || 0,
    unit: item.unit || 'Piece',
    expiryDate: item.expiryDate || ''
  };
  const curStock = Number(p.stock || 0);
  const countedVal = (item.countedStock !== null && item.countedStock !== undefined && item.countedStock !== '') ? item.countedStock : '';
  const itemExpiry = item.expiryDate !== undefined ? item.expiryDate : (p.expiryDate || '');

  return `
    <tr data-product-id="${esc(p.id)}" data-current-stock="${curStock}" data-product-unit="${esc(p.unit || '')}">
      <td>
        <strong style="display:block;font-size:13px">${esc(p.name)}</strong>
        <small class="row-source">${esc(p.id)} · ${esc(p.category)}</small>
      </td>
      <td>
        <span class="stocktake-current-badge">${curStock} ${esc(p.unit || '')}</span>
      </td>
      <td>
        <input type="number" step="any" min="0" class="stocktake-qty-input" data-id="${esc(p.id)}" value="${esc(countedVal)}" placeholder="${curStock}" autocomplete="off">
      </td>
      <td>
        <span class="stocktake-var-cell" data-id="${esc(p.id)}">${renderStocktakeVariance(countedVal, curStock, p.unit)}</span>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:3px">
          <input type="date" class="stocktake-exp-input" data-id="${esc(p.id)}" value="${esc(itemExpiry)}">
          <span class="stocktake-exp-status" data-id="${esc(p.id)}">${renderStocktakeExpiryBadge(itemExpiry)}</span>
        </div>
      </td>
      <td style="text-align:center">
        <button type="button" class="stocktake-del-btn" data-action="stocktake-remove-item" data-id="${esc(p.id)}" title="Remove from stock take">✕</button>
      </td>
    </tr>
  `;
}

function renderStocktakeBanner() {
  const draft = state.stocktakeDraft;
  if (!draft || !Array.isArray(draft.items) || !draft.items.length) return '';
  const totalItems = draft.items.length;
  const countedCount = draft.items.filter(item => item.countedStock !== '' && item.countedStock !== null && item.countedStock !== undefined).length;
  const timeStr = draft.updatedAt ? new Date(draft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return `
    <div class="stocktake-banner">
      <div class="stocktake-banner-info">
        <span class="stocktake-status-chip">⏸ In progress (paused)</span>
        <strong>Physical stock take session</strong>
        <span>${countedCount} of ${totalItems} products counted ${timeStr ? `· Last saved at ${timeStr}` : ''}</span>
      </div>
      <div class="stocktake-banner-actions">
        <button class="button primary small" data-action="open-stocktake">▶ Resume stock take</button>
        <button class="button small danger-action" data-action="discard-stocktake-draft">Discard draft</button>
      </div>
    </div>
  `;
}

function captureCurrentStocktakeDraft() {
  const rows = Array.from(document.querySelectorAll('#stocktake-table-body tr[data-product-id]'));
  const reason = document.getElementById('stocktake-reason')?.value || 'Physical stock take count';
  const items = rows.map(row => {
    const id = row.dataset.productId;
    const product = state.products.find(p => p.id === id);
    const qtyVal = row.querySelector('.stocktake-qty-input')?.value ?? '';
    const expVal = row.querySelector('.stocktake-exp-input')?.value ?? (product?.expiryDate || '');
    return {
      productId: id,
      productName: product?.name || id,
      sku: product?.id || '',
      category: product?.category || 'General',
      currentStock: product ? product.stock : Number(row.dataset.currentStock || 0),
      unit: product?.unit || row.dataset.productUnit || 'Piece',
      cost: product?.cost || 0,
      countedStock: qtyVal.trim(),
      expiryDate: expVal.trim(),
      initialExpiryDate: product?.expiryDate || ''
    };
  });

  return {
    id: state.stocktakeDraft?.id || ('STK-' + Date.now()),
    startedAt: state.stocktakeDraft?.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reason,
    items
  };
}

let stocktakeAutoSaveTimer = null;
function autoSaveStocktakeDraft() {
  clearTimeout(stocktakeAutoSaveTimer);
  stocktakeAutoSaveTimer = setTimeout(() => {
    const draft = captureCurrentStocktakeDraft();
    if (draft.items.length > 0) {
      state.stocktakeDraft = draft;
      saveState();
      const indicator = document.getElementById('stocktake-save-indicator');
      if (indicator) {
        indicator.textContent = `✓ Auto-saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        indicator.style.opacity = '1';
        setTimeout(() => { if (indicator) indicator.style.opacity = '0.7'; }, 2000);
      }
    }
  }, 350);
}

function updateStocktakeStats() {
  const rows = Array.from(document.querySelectorAll('#stocktake-table-body tr[data-product-id]'));
  let total = rows.length;
  let counted = 0;
  let netDelta = 0;

  for (const row of rows) {
    const cur = Number(row.dataset.currentStock || 0);
    const val = row.querySelector('.stocktake-qty-input')?.value.trim();
    if (val !== '' && !isNaN(Number(val))) {
      counted++;
      netDelta += (Number(val) - cur);
    }
  }

  const elTotal = document.getElementById('st-stat-total');
  const elCounted = document.getElementById('st-stat-counted');
  const elUncounted = document.getElementById('st-stat-uncounted');
  const elVariance = document.getElementById('st-stat-variance');

  if (elTotal) elTotal.textContent = total;
  if (elCounted) elCounted.textContent = counted;
  if (elUncounted) elUncounted.textContent = total - counted;
  if (elVariance) {
    elVariance.textContent = (netDelta > 0 ? `+${netDelta}` : String(netDelta)) + ' units';
    elVariance.style.color = netDelta === 0 ? '#16a34a' : (netDelta < 0 ? '#dc2626' : '#2563eb');
  }

  const emptyMsg = document.getElementById('stocktake-empty-row');
  if (emptyMsg) emptyMsg.style.display = total === 0 ? '' : 'none';
}

function pauseStocktakeSession() {
  const draft = captureCurrentStocktakeDraft();
  state.stocktakeDraft = draft;
  saveState();
  document.getElementById('app-modal')?.close();
  render();
  toast('Stock take paused! Your count progress is saved. You can take a break and resume anytime.');
}

function stocktakeAddSingleProduct(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existingRow = document.querySelector(`#stocktake-table-body tr[data-product-id="${esc(product.id)}"]`);
  if (existingRow) {
    const input = existingRow.querySelector('.stocktake-qty-input');
    input?.focus();
    input?.select();
    existingRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(`${product.name} is already in the count worksheet`);
    const searchRes = document.getElementById('stocktake-search-results');
    if (searchRes) searchRes.hidden = true;
    return;
  }

  const emptyRow = document.getElementById('stocktake-empty-row');
  if (emptyRow) emptyRow.style.display = 'none';

  const tbody = document.getElementById('stocktake-table-body');
  if (!tbody) return;

  const temp = document.createElement('tbody');
  temp.innerHTML = renderStocktakeRow({
    productId: product.id,
    productName: product.name,
    category: product.category,
    currentStock: product.stock,
    unit: product.unit,
    expiryDate: product.expiryDate || '',
    countedStock: ''
  });

  const newRow = temp.firstElementChild;
  tbody.appendChild(newRow);

  const searchInput = document.getElementById('stocktake-search-input');
  if (searchInput) searchInput.value = '';
  const searchRes = document.getElementById('stocktake-search-results');
  if (searchRes) searchRes.hidden = true;

  const input = newRow.querySelector('.stocktake-qty-input');
  input?.focus();
  newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  updateStocktakeStats();
  autoSaveStocktakeDraft();
}

function stocktakeAddAllActiveProducts() {
  const tbody = document.getElementById('stocktake-table-body');
  if (!tbody) return;
  const existingIds = new Set(Array.from(tbody.querySelectorAll('tr[data-product-id]')).map(r => r.dataset.productId));
  const activeProds = state.products.filter(p => p.status !== 'Draft' && !existingIds.has(p.id));

  if (!activeProds.length) {
    toast('All active products are already in the count sheet');
    return;
  }

  const emptyRow = document.getElementById('stocktake-empty-row');
  if (emptyRow) emptyRow.style.display = 'none';

  const html = activeProds.map(p => renderStocktakeRow({
    productId: p.id,
    productName: p.name,
    category: p.category,
    currentStock: p.stock,
    unit: p.unit,
    expiryDate: p.expiryDate || '',
    countedStock: ''
  })).join('');

  const temp = document.createElement('tbody');
  temp.innerHTML = html;
  while (temp.firstElementChild) {
    tbody.appendChild(temp.firstElementChild);
  }

  updateStocktakeStats();
  autoSaveStocktakeDraft();
  toast(`Added ${activeProds.length} active products to worksheet`);
}

function stocktakeAddCategory(cat) {
  if (!cat) return;
  const tbody = document.getElementById('stocktake-table-body');
  if (!tbody) return;
  const existingIds = new Set(Array.from(tbody.querySelectorAll('tr[data-product-id]')).map(r => r.dataset.productId));
  const prods = state.products.filter(p => p.category === cat && !existingIds.has(p.id));

  if (!prods.length) {
    toast(`All products from category "${cat}" are already in the worksheet`);
    return;
  }

  const emptyRow = document.getElementById('stocktake-empty-row');
  if (emptyRow) emptyRow.style.display = 'none';

  const html = prods.map(p => renderStocktakeRow({
    productId: p.id,
    productName: p.name,
    category: p.category,
    currentStock: p.stock,
    unit: p.unit,
    expiryDate: p.expiryDate || '',
    countedStock: ''
  })).join('');

  const temp = document.createElement('tbody');
  temp.innerHTML = html;
  while (temp.firstElementChild) {
    tbody.appendChild(temp.firstElementChild);
  }

  updateStocktakeStats();
  autoSaveStocktakeDraft();
  toast(`Added ${prods.length} products from ${cat}`);
}

function stocktakeFillCurrentStock() {
  const rows = Array.from(document.querySelectorAll('#stocktake-table-body tr[data-product-id]'));
  let count = 0;
  for (const row of rows) {
    const input = row.querySelector('.stocktake-qty-input');
    if (input && input.value.trim() === '') {
      input.value = row.dataset.currentStock || '0';
      const varCell = row.querySelector('.stocktake-var-cell');
      if (varCell) varCell.innerHTML = renderStocktakeVariance(input.value, Number(row.dataset.currentStock || 0), row.dataset.productUnit);
      count++;
    }
  }
  updateStocktakeStats();
  autoSaveStocktakeDraft();
  toast(`Filled ${count} uncounted products with current stock`);
}

function stocktakeClearAllCounts() {
  const rows = Array.from(document.querySelectorAll('#stocktake-table-body tr[data-product-id]'));
  for (const row of rows) {
    const input = row.querySelector('.stocktake-qty-input');
    if (input) input.value = '';
    const varCell = row.querySelector('.stocktake-var-cell');
    if (varCell) varCell.innerHTML = renderStocktakeVariance('', Number(row.dataset.currentStock || 0), row.dataset.productUnit);
  }
  updateStocktakeStats();
  autoSaveStocktakeDraft();
  toast('Cleared all counts');
}

function openStocktakeDialog() {
  if (!userHasPermission('inventory', 'stocktake')) {
    toast('You do not have permission to run stock take');
    return;
  }
  if (!state.products.length) {
    toast('Add products to Inventory before running a stock take');
    return;
  }

  const hasDraft = state.stocktakeDraft && Array.isArray(state.stocktakeDraft.items) && state.stocktakeDraft.items.length > 0;
  const draft = hasDraft ? state.stocktakeDraft : null;
  const items = draft ? draft.items : [];
  const reason = draft?.reason || 'Monthly physical stock take';

  const categories = Array.from(new Set(state.products.map(p => p.category).filter(Boolean))).sort();
  const categoryOptions = categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const activeProducts = state.products.filter(p => p.status !== 'Draft');

  const content = `
    <input type="hidden" name="dialog-kind" value="finalize-stocktake">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:12px;font-weight:700">Reason / Reference:
          <input id="stocktake-reason" name="stocktake-reason" value="${esc(reason)}" class="text-control" style="margin-left:6px;width:260px;display:inline-block;padding:6px 10px;font-size:12px">
        </label>
      </div>
      <div style="font-size:11px;color:var(--muted);transition:opacity 0.3s ease" id="stocktake-save-indicator">
        ${hasDraft ? `⏸ Resumed session (started ${new Date(draft.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'Physical counts directly replace current stock'}
      </div>
    </div>

    <div class="stocktake-toolbar">
      <div class="stocktake-search-wrap">
        <input type="text" id="stocktake-search-input" class="stocktake-search-input" placeholder="🔍 Search product name, SKU or scan barcode to add... (Press Enter to add)" autocomplete="off">
        <div id="stocktake-search-results" class="stocktake-search-results" hidden></div>
      </div>
      <button type="button" class="button small" data-action="stocktake-add-all" title="Add all active inventory products to this count sheet">＋ Add all active (${activeProducts.length})</button>
      <select id="stocktake-select-category" class="select-control small" style="max-width:180px">
        <option value="">＋ Add by category...</option>
        ${categoryOptions}
      </select>
      <button type="button" class="button small" data-action="stocktake-fill-current" title="Set uncounted fields to match their current stock">Fill with current</button>
      <button type="button" class="button small" data-action="stocktake-clear-all" title="Clear all counted inputs">Clear counts</button>
    </div>

    <div class="stocktake-stats-bar">
      <span>Products in sheet: <strong id="st-stat-total">${items.length}</strong></span>
      <span>•</span>
      <span>Counted: <strong id="st-stat-counted" style="color:#16a34a">0</strong></span>
      <span>•</span>
      <span>Remaining: <strong id="st-stat-uncounted" style="color:#d97706">0</strong></span>
      <span>•</span>
      <span>Net Variance: <strong id="st-stat-variance" style="font-weight:700">0 units</strong></span>
    </div>

    <div class="stocktake-table-wrap">
      <table class="stocktake-table">
        <thead>
          <tr>
            <th style="min-width:200px">Product</th>
            <th style="min-width:110px">Current Stock</th>
            <th style="min-width:140px">Physical Count (New stock)</th>
            <th style="min-width:130px">Variance</th>
            <th style="min-width:150px">Expiry Date</th>
            <th style="width:40px;text-align:center">✕</th>
          </tr>
        </thead>
        <tbody id="stocktake-table-body">
          ${items.map(renderStocktakeRow).join('')}
          <tr id="stocktake-empty-row" style="${items.length ? 'display:none' : ''}">
            <td colspan="6" style="text-align:center;padding:32px 16px;color:var(--muted)">
              <div style="font-size:24px;margin-bottom:6px">▤</div>
              <strong>No products added to this stock take worksheet yet</strong>
              <p style="margin:4px 0 10px;font-size:12px">Use the search box above or click "＋ Add all active" to quickly populate the list.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const extraAction = `
    <button type="button" class="button" data-action="pause-stocktake" title="Pause counting and save draft for a break">⏸ Pause & Save draft (Take a break)</button>
    ${hasDraft ? `<button type="button" class="button small danger-action" data-action="discard-stocktake-draft">Discard draft</button>` : ''}
  `;

  openModal(
    'Stock take',
    'Verify on-hand products and expiry dates. Physical counts will directly replace current stock.',
    content,
    '✓ Finalize & Apply Stock Count',
    extraAction
  );

  const form = document.getElementById('modal-content');
  if (form) form.dataset.dialogKind = 'finalize-stocktake';

  updateStocktakeStats();
}

function handleStocktakeSearch(term) {
  const query = String(term || '').trim().toLowerCase();
  const res = document.getElementById('stocktake-search-results');
  if (!res) return;

  if (!query) {
    res.hidden = true;
    res.innerHTML = '';
    return;
  }

  const existingIds = new Set(Array.from(document.querySelectorAll('#stocktake-table-body tr[data-product-id]')).map(r => r.dataset.productId));
  const matches = state.products.filter(p => {
    return `${p.id} ${p.name} ${p.category} ${p.batchNumber || ''}`.toLowerCase().includes(query);
  }).slice(0, 15);

  if (!matches.length) {
    res.hidden = false;
    res.innerHTML = '<div style="padding:10px 14px;color:var(--muted);font-size:12px">No matching products found</div>';
    return;
  }

  res.hidden = false;
  res.innerHTML = matches.map(p => {
    const alreadyAdded = existingIds.has(p.id);
    return `
      <div class="stocktake-search-item" data-action="stocktake-pick-product" data-id="${esc(p.id)}" style="${alreadyAdded ? 'opacity:0.6' : ''}">
        <div>
          <strong style="font-size:12px">${esc(p.name)}</strong>
          <small class="muted" style="display:block;font-size:10px">${esc(p.id)} · ${esc(p.category)} · Current: <b>${p.stock} ${esc(p.unit || '')}</b></small>
        </div>
        <button type="button" class="button small ${alreadyAdded ? '' : 'primary'}" style="font-size:10px;padding:3px 8px">
          ${alreadyAdded ? 'Added' : '＋ Add'}
        </button>
      </div>
    `;
  }).join('');
}

// Product Management
function renderProductManagement() {
  const rows = inventoryRowsFiltered();
  const selectedCount = selectedProductIds.size;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiredProducts = state.products.filter(p => {
    if (!p.expiryDate) return false;
    const exp = new Date(p.expiryDate);
    exp.setHours(0, 0, 0, 0);
    return exp < today;
  });

  const expiring30Products = state.products.filter(p => {
    if (!p.expiryDate) return false;
    const exp = new Date(p.expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diff = Math.round((exp - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30;
  });

  const allWithExpiry = state.products.filter(p => p.expiryDate);
  const expiryAlertsCount = expiredProducts.length + expiring30Products.length;

  return `
    ${heading('Product Management', 'Manage product catalog, pricing, cost, barcodes, batch expiration, and CSV bulk tools.', `
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
      <div class="summary-mini" style="cursor:pointer" data-action="jump-to-expiry" title="Jump to Product Expiration & Management">
        <small>Expiring / Expired</small>
        <strong style="color:${expiredProducts.length > 0 ? '#ef233c' : expiring30Products.length > 0 ? '#f57c00' : 'var(--ink)'}">
          ${expiryAlertsCount} alert${expiryAlertsCount !== 1 ? 's' : ''}
        </strong>
      </div>
    </section>
    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="table-search" placeholder="Search product name, SKU, category, batch…" value="${esc(tableQuery)}"></label>
          <select class="select-control" id="inventory-filter">
            <option value="">All products</option>
            <option value="low">Low stock</option>
            <option value="healthy">In stock</option>
            <option value="draft">Drafts</option>
            <option value="active">Active</option>
            <option value="expired">Expired (${expiredProducts.length})</option>
            <option value="expiring-soon">Expiring in ≤ 30 days (${expiring30Products.length})</option>
            <option value="has-expiry">All with expiry dates (${allWithExpiry.length})</option>
          </select>
        </div>
        <span class="muted" id="inventory-result-count" style="font-size:11px">${rows.length} of ${state.products.length} products</span>
        <div id="bulk-product-bar" class="bulk-action-bar" ${selectedCount > 0 ? 'style="display:flex"' : 'hidden style="display:none"'}>
          <span id="bulk-product-count" class="muted" style="font-size:11px">${selectedCount > 0 ? `${selectedCount} product${selectedCount !== 1 ? 's' : ''} selected` : ''}</span>
          <button class="button small danger-action" data-action="bulk-delete-products">Delete selected</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr><th style="width:36px"><input type="checkbox" id="select-all-products" title="Select all" style="cursor:pointer"></th><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody id="inventory-table-body">${inventoryRows(rows)}</tbody>
        </table>
      </div>
    </section>

    ${renderExpiryManagementSection()}
  `;
}

// Inventory Management
function renderInventoryManagement() {
  const stocktakes = Array.isArray(state.stocktakes) ? state.stocktakes : [];
  const movements = Array.isArray(state.stockMovements) ? state.stockMovements : [];
  const totalStockQty = state.products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const totalCostValue = state.products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.cost || 0), 0);
  const lowStockCount = state.products.filter(p => p.stock <= p.low && p.status !== 'Draft').length;
  const isAdmin = isWorkspaceAdministrator();

  const filteredMovements = movements.filter(m => {
    if (inventoryMovementTypeFilter && inventoryMovementTypeFilter !== '') {
      if (inventoryMovementTypeFilter === 'stocktake' && !m.id?.startsWith('STK') && !m.reason?.toLowerCase().includes('stock take')) return false;
      if (inventoryMovementTypeFilter === 'adjustment' && (m.id?.startsWith('STK') || m.reason?.toLowerCase().includes('stock take'))) return false;
    }
    if (tableQuery && !`${m.id} ${m.product} ${m.reason} ${m.user || ''}`.toLowerCase().includes(tableQuery.toLowerCase())) return false;
    return true;
  });

  return `
    ${heading('Inventory Management', 'Dedicated physical stock taking, stock count history, variance adjustments, and stock movement ledger.', `
      <button class="button ${state.stocktakeDraft?.items?.length ? 'primary' : ''}" data-action="open-stocktake">${state.stocktakeDraft?.items?.length ? '▶ Resume stock take' : '▤ New stock take'}</button>
      <button class="button" data-action="bulk-stock-adjust">± Adjust stock</button>
      <button class="button" data-action="export-stocktakes">↓ Export stock takes</button>
      <button class="button" data-action="export-stock-movements">↓ Export stock ledger</button>
    `)}

    ${renderStocktakeBanner()}

    <section class="summary-strip">
      <div class="summary-mini"><small>Total On-Hand Quantity</small><strong>${totalStockQty.toLocaleString()} units</strong></div>
      <div class="summary-mini"><small>Stock Valuation (at cost)</small><strong>${money(totalCostValue)}</strong></div>
      <div class="summary-mini"><small>Low stock items</small><strong style="color:${lowStockCount > 0 ? '#d97706' : 'var(--ink)'}">${lowStockCount}</strong></div>
      <div class="summary-mini"><small>Stock Takes Recorded</small><strong>${stocktakes.length} sessions</strong></div>
    </section>

    <!-- Stock Take Sessions & Historical Audit Ledger -->
    <section class="table-panel">
      <div class="table-heading" style="padding:16px 20px 8px">
        <div>
          <h2 style="font-size:15px;margin:0 0 4px">Physical Stock Take History &amp; Audits</h2>
          <p class="panel-subtitle" style="margin:0">Auditable permanent records of all past physical count sessions and reconciliation worksheets.</p>
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Session Ref</th>
              <th>Reason / Reference</th>
              <th>Counted</th>
              <th>Discrepancy Breakdown</th>
              <th>Net Quantity Delta</th>
              <th>Conducted By</th>
              <th>Status</th>
              <th>Worksheet &amp; Actions</th>
            </tr>
          </thead>
          <tbody>
            ${stocktakes.length ? stocktakes.map(st => {
    const netSign = st.netQtyDelta > 0 ? `+${st.netQtyDelta}` : `${st.netQtyDelta}`;
    const deltaClass = st.netQtyDelta === 0 ? 'stocktake-diff-pill match' : st.netQtyDelta > 0 ? 'stocktake-diff-pill surplus' : 'stocktake-diff-pill shortage';
    const isRevoked = st.status === 'Revoked';
    return `
                <tr class="${isRevoked ? 'row-revoked' : ''}">
                  <td><strong>${dateLabel(st.dateStr || st.date?.slice(0, 10))}</strong><br><small class="muted">${st.date ? new Date(st.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small></td>
                  <td>
                    <strong>${esc(st.id)}</strong>
                    ${st.editedAt ? `<br><small class="muted" title="Edited on ${dateLabel(st.editedAt.slice(0, 10))}">Edited</small>` : ''}
                  </td>
                  <td>${esc(st.reason || 'Physical count')}</td>
                  <td><strong>${st.countedProducts || st.items?.length || 0}</strong> products</td>
                  <td>
                    <span class="stocktake-diff-pill match" title="Perfect match">${st.matchedCount || 0} Match</span>
                    ${st.shortageCount ? `<span class="stocktake-diff-pill shortage" title="Missing stock">${st.shortageCount} Short</span>` : ''}
                    ${st.surplusCount ? `<span class="stocktake-diff-pill surplus" title="Excess stock">${st.surplusCount} Surplus</span>` : ''}
                  </td>
                  <td><span class="${deltaClass}">${netSign} units</span></td>
                  <td>${esc(st.user || 'Administrator')}</td>
                  <td>
                    ${isRevoked
        ? `<span class="stocktake-diff-pill shortage" title="Revoked on ${dateLabel(st.revokedAt?.slice(0, 10))}">Revoked</span>`
        : `<span class="stocktake-diff-pill match">Active</span>`}
                  </td>
                  <td>
                    <div style="display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap">
                      <button type="button" class="button small" data-action="view-stocktake-session" data-id="${esc(st.id)}" title="View worksheet">👁 Worksheet</button>
                      ${isAdmin ? `
                        <details class="order-actions stocktake-actions" style="display:inline-block">
                          <summary aria-label="Admin actions for ${esc(st.id)}" title="Admin options">⋮</summary>
                          <div class="order-actions-menu">
                            ${!isRevoked ? `<button type="button" data-action="edit-stocktake-session" data-id="${esc(st.id)}">✎ Edit session counts</button>` : ''}
                            ${!isRevoked ? `<button type="button" data-action="revoke-stocktake-session" data-id="${esc(st.id)}" class="danger-action" style="color:#ef4444">↺ Revoke &amp; Revert Stock</button>` : ''}
                            <span class="menu-divider"></span>
                            <button type="button" data-action="delete-stocktake-session" data-id="${esc(st.id)}" class="danger-action" style="color:#dc2626">🗑 Delete session</button>
                          </div>
                        </details>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
  }).join('') : emptyRow(9, 'No physical stock takes recorded yet. Click "New stock take" to conduct an audit.')}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Stock Movements & Adjustments Ledger -->
    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="table-search" placeholder="Search product, movement ref, reason…" value="${esc(tableQuery)}"></label>
          <select class="select-control" id="inventory-movement-filter">
            <option value="" ${!inventoryMovementTypeFilter ? 'selected' : ''}>All movement types</option>
            <option value="stocktake" ${inventoryMovementTypeFilter === 'stocktake' ? 'selected' : ''}>Stock takes only</option>
            <option value="adjustment" ${inventoryMovementTypeFilter === 'adjustment' ? 'selected' : ''}>Manual adjustments only</option>
          </select>
        </div>
        <span class="muted" style="font-size:11px">${filteredMovements.length} of ${movements.length} movements</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Movement ID</th>
              <th>Before</th>
              <th>After</th>
              <th>Variance</th>
              <th>Reason / Memo</th>
              <th>Auditor</th>
              <th>Status</th>
              ${isAdmin ? '<th>Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${filteredMovements.length ? filteredMovements.map(m => {
    const delta = Number(m.delta || (m.after - m.before) || 0);
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    const deltaClass = delta === 0 ? 'stocktake-diff-pill match' : delta > 0 ? 'stocktake-diff-pill surplus' : 'stocktake-diff-pill shortage';
    const isRevoked = m.status === 'Revoked';
    return `
                <tr class="${isRevoked ? 'row-revoked' : ''}">
                  <td><strong>${dateLabel(m.date)}</strong></td>
                  <td><strong>${esc(m.product || m.productId)}</strong></td>
                  <td><small>${esc(m.id)}</small></td>
                  <td>${m.before !== undefined ? m.before : '—'}</td>
                  <td><strong>${m.after !== undefined ? m.after : '—'}</strong></td>
                  <td><span class="${deltaClass}">${sign}</span></td>
                  <td>${esc(m.reason || 'Stock adjustment')}</td>
                  <td>${esc(m.user || '—')}</td>
                  <td>
                    ${isRevoked
        ? `<span class="stocktake-diff-pill shortage">Revoked</span>`
        : `<span class="stocktake-diff-pill match">Applied</span>`}
                  </td>
                  ${isAdmin ? `
                    <td>
                      <details class="order-actions movement-actions" style="display:inline-block">
                        <summary aria-label="Actions for movement ${esc(m.id)}" title="Movement options">⋮</summary>
                        <div class="order-actions-menu">
                          ${!isRevoked ? `<button type="button" data-action="edit-stock-movement" data-id="${esc(m.id)}">✎ Edit adjustment</button>` : ''}
                          ${!isRevoked && delta !== 0 ? `<button type="button" data-action="revoke-stock-movement" data-id="${esc(m.id)}" class="danger-action" style="color:#ef4444">↺ Revoke &amp; Revert Stock</button>` : ''}
                          <span class="menu-divider"></span>
                          <button type="button" data-action="delete-stock-movement" data-id="${esc(m.id)}" class="danger-action" style="color:#dc2626">🗑 Delete movement</button>
                        </div>
                      </details>
                    </td>
                  ` : ''}
                </tr>
              `;
  }).join('') : emptyRow(isAdmin ? 10 : 9, 'No stock movements recorded.')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderInventory() {
  return renderInventoryManagement();
}

function inventoryRowsFiltered() {
  const term = tableQuery.toLowerCase();
  const filter = document.getElementById('inventory-filter')?.value || '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return state.products.filter(p => {
    const matches = `${p.id} ${p.name} ${p.category} ${p.unit} ${p.batchNumber || ''} ${p.expiryDate || ''} ${p.status || 'Active'}`.toLowerCase().includes(term);
    if (!matches) return false;
    if (filter === 'low') return p.stock <= p.low && p.status !== 'Draft';
    if (filter === 'healthy') return p.stock > p.low && p.status !== 'Draft';
    if (filter === 'draft') return p.status === 'Draft';
    if (filter === 'active') return p.status !== 'Draft';
    if (filter === 'expired') {
      if (!p.expiryDate) return false;
      const exp = new Date(p.expiryDate);
      exp.setHours(0, 0, 0, 0);
      return exp < today;
    }
    if (filter === 'expiring-soon') {
      if (!p.expiryDate) return false;
      const exp = new Date(p.expiryDate);
      exp.setHours(0, 0, 0, 0);
      const diff = Math.round((exp - today) / (1000 * 60 * 60 * 24));
      return diff <= 30;
    }
    if (filter === 'has-expiry') {
      return Boolean(p.expiryDate);
    }
    return true;
  });
}

function inventoryRows(rows) {
  return sortProducts(rows).map(p => {
    const draft = p.status === 'Draft';
    const expiryInfo = getProductExpiryInfo(p);
    let expiryBadge = '';
    if (p.expiryDate) {
      if (expiryInfo.status === 'expired') {
        expiryBadge = `<div style="margin-top:3px"><span class="countdown-badge expired" title="Expired on ${esc(p.expiryDate)}">⚠ Expired ${Math.abs(expiryInfo.days)}d ago</span></div>`;
      } else if (expiryInfo.status === 'expiring-soon') {
        expiryBadge = `<div style="margin-top:3px"><span class="countdown-badge soon" title="Expires on ${esc(p.expiryDate)}">⌛ ${expiryInfo.label}</span></div>`;
      } else if (expiryInfo.status === 'expiring-warning') {
        expiryBadge = `<div style="margin-top:3px"><span class="countdown-badge warning" title="Expires on ${esc(p.expiryDate)}">${expiryInfo.label}</span></div>`;
      } else {
        expiryBadge = `<div style="margin-top:3px"><small class="muted" style="font-size:10px" title="Expiry date">Exp: ${esc(p.expiryDate)}</small></div>`;
      }
    }
    return `
      <tr>
        <td style="width:36px"><input type="checkbox" class="product-row-check" data-id="${esc(p.id)}" ${selectedProductIds.has(p.id) ? 'checked' : ''} style="cursor:pointer"></td>
        <td>
          <strong>${esc(p.name)}</strong>
          ${p.batchNumber ? `<br><span class="batch-tag">Batch: ${esc(p.batchNumber)}</span>` : ''}
        </td>
        <td>${esc(p.id)}</td>
        <td>${esc(p.category)}</td>
        <td>${money(p.price)}</td>
        <td>${money(p.cost)}</td>
        <td><strong>${p.stock} ${esc(p.unit)}</strong></td>
        <td>
          ${draft ? '<span class="status-pill draft">Draft</span>' : `<span class="status-pill ${p.stock <= p.low ? 'low' : 'paid'}">${p.stock <= p.low ? 'Low stock' : 'Active'}</span>`}
          ${expiryBadge}
        </td>
        <td>
          <details class="order-actions inventory-actions">
            <summary aria-label="Actions for ${esc(p.name)}" title="Product actions">⋮</summary>
            <div class="order-actions-menu inventory-actions-menu">
              <button data-action="edit-product" data-id="${esc(p.id)}">Edit product</button>
              <button data-action="edit-expiry" data-id="${esc(p.id)}">Edit expiry / batch</button>
              ${p.expiryDate && expiryInfo.status === 'expired' && p.stock > 0 ? `<button class="danger-action" data-action="write-off-expired" data-id="${esc(p.id)}">Write off expired</button>` : ''}
              ${p.expiryDate && (expiryInfo.status === 'expiring-soon' || expiryInfo.status === 'expiring-warning') ? `<button data-action="clearance-discount" data-id="${esc(p.id)}">Clearance discount</button>` : ''}
              <button data-action="adjust-stock" data-id="${esc(p.id)}">Adjust stock</button>
              <button data-action="product-stock-history" data-id="${esc(p.id)}">Stock history</button>
              <div class="menu-divider"></div>
              <button class="danger-action" data-action="delete-product" data-id="${esc(p.id)}">Delete product</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('') || emptyRow(9, 'No matching products');
}

function renderExpiryManagementSection() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allWithExpiry = state.products.filter(p => p.expiryDate);
  const expiredList = allWithExpiry.filter(p => {
    const exp = new Date(p.expiryDate);
    exp.setHours(0, 0, 0, 0);
    return exp < today;
  });
  const expiring30List = allWithExpiry.filter(p => {
    const exp = new Date(p.expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diff = Math.round((exp - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30;
  });
  const expiring90List = allWithExpiry.filter(p => {
    const exp = new Date(p.expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diff = Math.round((exp - today) / (1000 * 60 * 60 * 24));
    return diff > 30 && diff <= 90;
  });

  const expiredValue = expiredList.reduce((sum, p) => sum + (Number(p.stock) || 0) * (Number(p.cost) || 0), 0);
  const expiring30Value = expiring30List.reduce((sum, p) => sum + (Number(p.stock) || 0) * (Number(p.cost) || 0), 0);
  const expiring90Value = expiring90List.reduce((sum, p) => sum + (Number(p.stock) || 0) * (Number(p.cost) || 0), 0);

  let displayList = [];
  if (inventoryExpiryTab === 'expired') {
    displayList = expiredList;
  } else if (inventoryExpiryTab === 'soon') {
    displayList = expiring30List;
  } else if (inventoryExpiryTab === 'upcoming') {
    displayList = expiring90List;
  } else if (inventoryExpiryTab === 'all-tracked') {
    displayList = allWithExpiry;
  } else {
    displayList = allWithExpiry.filter(p => {
      const exp = new Date(p.expiryDate);
      exp.setHours(0, 0, 0, 0);
      const diff = Math.round((exp - today) / (1000 * 60 * 60 * 24));
      return diff <= 90;
    });
  }

  displayList.sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));

  const rows = displayList.map(p => {
    const info = getProductExpiryInfo(p);
    const totalCost = (Number(p.stock) || 0) * (Number(p.cost) || 0);
    const isExpired = info.status === 'expired';
    const isSoon = info.status === 'expiring-soon';
    return `
      <tr>
        <td>
          <strong>${esc(p.name)}</strong>
          <small class="muted" style="display:block;font-size:11px">${esc(p.id)} · ${esc(p.category)}</small>
        </td>
        <td>${p.batchNumber ? `<span class="batch-tag">${esc(p.batchNumber)}</span>` : '<span class="muted">—</span>'}</td>
        <td><strong>${p.stock} ${esc(p.unit)}</strong></td>
        <td>${money(totalCost)} <small class="muted" style="display:block;font-size:10px">@ ${money(p.cost)}</small></td>
        <td><strong>${esc(p.expiryDate)}</strong></td>
        <td>
          <span class="countdown-badge ${isExpired ? 'expired' : isSoon ? 'soon' : info.status === 'expiring-warning' ? 'warning' : 'good'}">
            ${isExpired ? `⚠ Expired ${Math.abs(info.days)}d ago` : info.label}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${isExpired && p.stock > 0 ? `<button class="button small danger-action" data-action="write-off-expired" data-id="${esc(p.id)}">Write off</button>` : ''}
            ${!isExpired && (isSoon || info.status === 'expiring-warning') ? `<button class="button small" data-action="clearance-discount" data-id="${esc(p.id)}" style="color:#0056cc;font-weight:900">Clearance %</button>` : ''}
            <button class="button small" data-action="edit-expiry" data-id="${esc(p.id)}">Update</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || emptyRow(7, 'No products found for this expiration filter.');

  return `
    <section class="panel expiry-management-panel" id="product-expiration-section">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <h2 class="panel-title">Product Expiration &amp; Management</h2>
          <p class="panel-subtitle">Monitor perishables, track upcoming shelf-life expiries, apply clearance pricing, or record write-offs.</p>
        </div>
        <div class="heading-actions">
          <button class="button" data-action="export-expiry-report">↓ Expiration CSV Report</button>
        </div>
      </div>

      <div class="expiry-stats-strip">
        <div class="expiry-stat-card danger" style="cursor:pointer" data-action="filter-expiry-tab" data-tab="expired">
          <small>Expired Stock</small>
          <strong>${expiredList.length} product${expiredList.length !== 1 ? 's' : ''}</strong>
          <span class="expiry-val">${money(expiredValue)} at risk</span>
        </div>
        <div class="expiry-stat-card warning" style="cursor:pointer" data-action="filter-expiry-tab" data-tab="soon">
          <small>Expiring in ≤ 30 Days</small>
          <strong>${expiring30List.length} product${expiring30List.length !== 1 ? 's' : ''}</strong>
          <span class="expiry-val">${money(expiring30Value)} value</span>
        </div>
        <div class="expiry-stat-card info" style="cursor:pointer" data-action="filter-expiry-tab" data-tab="upcoming">
          <small>Expiring in 31–90 Days</small>
          <strong>${expiring90List.length} product${expiring90List.length !== 1 ? 's' : ''}</strong>
          <span class="expiry-val">${money(expiring90Value)} value</span>
        </div>
        <div class="expiry-stat-card neutral" style="cursor:pointer" data-action="filter-expiry-tab" data-tab="all-tracked">
          <small>Total Perishables Tracked</small>
          <strong>${allWithExpiry.length} product${allWithExpiry.length !== 1 ? 's' : ''}</strong>
          <span class="expiry-val">With expiry date</span>
        </div>
      </div>

      <div class="expiry-filter-tabs">
        <button class="expiry-filter-btn ${inventoryExpiryTab === 'attention' ? 'active' : ''}" data-action="filter-expiry-tab" data-tab="attention">Action Required (${expiredList.length + expiring30List.length})</button>
        <button class="expiry-filter-btn ${inventoryExpiryTab === 'expired' ? 'active' : ''}" data-action="filter-expiry-tab" data-tab="expired">Expired (${expiredList.length})</button>
        <button class="expiry-filter-btn ${inventoryExpiryTab === 'soon' ? 'active' : ''}" data-action="filter-expiry-tab" data-tab="soon">Expiring in ≤ 30 Days (${expiring30List.length})</button>
        <button class="expiry-filter-btn ${inventoryExpiryTab === 'upcoming' ? 'active' : ''}" data-action="filter-expiry-tab" data-tab="upcoming">Expiring 31–90 Days (${expiring90List.length})</button>
        <button class="expiry-filter-btn ${inventoryExpiryTab === 'all-tracked' ? 'active' : ''}" data-action="filter-expiry-tab" data-tab="all-tracked">All Tracked (${allWithExpiry.length})</button>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch / Lot</th>
              <th>On-hand Stock</th>
              <th>At-Cost Value</th>
              <th>Expiry Date</th>
              <th>Status / Timeline</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function updateBulkProductBar() {
  const bar = document.getElementById('bulk-product-bar');
  const count = document.getElementById('bulk-product-count');
  if (!bar) return;
  const n = selectedProductIds.size;
  if (n === 0) {
    bar.hidden = true;
    bar.style.setProperty('display', 'none');
  } else {
    bar.hidden = false;
    bar.removeAttribute('hidden');
    bar.style.setProperty('display', 'flex');
  }
  if (count) count.textContent = `${n} product${n !== 1 ? 's' : ''} selected`;
  const allChecks = document.querySelectorAll('.product-row-check');
  const selectAll = document.getElementById('select-all-products');
  if (selectAll && allChecks.length) {
    const checkedCount = Array.from(allChecks).filter(cb => cb.checked).length;
    selectAll.checked = checkedCount > 0 && checkedCount === allChecks.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < allChecks.length;
  }
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
  document.getElementById('app-modal')?.close();
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
  if (typeof window.TideFirebase?.deleteProduct === 'function') {
    window.TideFirebase.deleteProduct(product);
  }
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
  removeAccountEntries(entry => directRefs.has(entry.sourceId) && ['order', 'order-payment', 'sales', 'sales-payment', 'purchase', 'purchase-payment'].includes(entry.sourceType));
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
        <td>
          <strong>${esc(p.id)}</strong>
          ${Array.isArray(p.attachments) && p.attachments.length > 0 ? `<div style="margin-top:4px"><span class="status-pill status-attachment" title="${p.attachments.length} document(s) attached">📎 ${p.attachments.length} attachment${p.attachments.length > 1 ? 's' : ''}</span></div>` : ''}
        </td>
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
              <button data-action="view-purchase" data-id="${esc(p.id)}">View purchase</button>
              <button data-action="edit-purchase" data-id="${esc(p.id)}">Edit purchase order</button>
              ${p.status === 'Pending' ? `<button data-action="receive-purchase" data-id="${esc(p.id)}">Receive stock</button>` : ''}
              ${p.status === 'Received' && (p.paid || 0) < net ? `<button data-action="purchase-payment" data-id="${esc(p.id)}">Add payment</button>` : ''}
              ${p.status === 'Received' ? `<button data-action="return-purchase" data-id="${esc(p.id)}">Supplier return</button>` : ''}
              <button class="danger-action" data-action="delete-purchase" data-id="${esc(p.id)}">Delete purchase${isWorkspaceAdministrator() && p.status === 'Received' ? ' · admin override' : ''}</button>
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

// Expenses Management
function renderExpenses() {
  const allExpenses = Array.isArray(state.expenses) ? state.expenses : [];
  const todayStr = today();
  const totalAmount = allExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const paidExpenses = allExpenses.filter(e => Boolean(e.paid));
  const unpaidExpenses = allExpenses.filter(e => !e.paid);
  const paidTotal = paidExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const unpaidTotal = unpaidExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const todayTotal = allExpenses.filter(e => (e.date || '').slice(0, 10) === todayStr).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const query = (tableQuery || '').trim().toLowerCase();
  const filtered = allExpenses.filter(e => {
    if (expenseStatusFilter === 'paid' && !e.paid) return false;
    if (expenseStatusFilter === 'unpaid' && e.paid) return false;
    if (!isWithinDateRange(e.date, expenseDateFrom, expenseDateTo)) return false;
    if (query) {
      const hay = `${e.id || ''} ${e.forWhom || ''} ${e.purpose || ''} ${e.notes || ''} ${e.paymentMethod || ''}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const filteredTotal = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const rows = filtered.map(e => {
    const isPaid = Boolean(e.paid);
    const attCount = Array.isArray(e.attachments) ? e.attachments.length : 0;
    return `
      <tr>
        <td>
          <strong>${esc(e.id)}</strong>
          ${attCount > 0 ? `<div style="margin-top:4px"><span class="status-pill status-attachment" title="${attCount} receipt/document(s) attached">📎 ${attCount} attachment${attCount > 1 ? 's' : ''}</span></div>` : ''}
        </td>
        <td>${dateLabel(e.date)}</td>
        <td><strong>${esc(e.forWhom || '—')}</strong></td>
        <td>
          <strong>${esc(e.purpose || '—')}</strong>
          ${e.notes ? `<div class="muted" style="font-size:11.5px;margin-top:2px;max-width:280px;white-space:normal">${esc(e.notes)}</div>` : ''}
        </td>
        <td><strong>${money(e.amount)}</strong></td>
        <td>
          <span class="status-pill ${isPaid ? 'paid' : 'pending'}">${isPaid ? 'Paid' : 'Unpaid'}</span>
          ${isPaid && e.paymentDate ? `<div class="muted" style="font-size:11px;margin-top:3px">${dateLabel(e.paymentDate)}${e.paymentMethod ? ` · ${esc(e.paymentMethod)}` : ''}</div>` : ''}
        </td>
        <td>
          <details class="order-actions expense-actions">
            <summary aria-label="Actions for ${esc(e.id)}">⋮</summary>
            <div class="order-actions-menu">
              <button data-action="view-expense" data-id="${esc(e.id)}">View details &amp; attachments</button>
              ${!isPaid ? `<button data-action="mark-expense-paid" data-id="${esc(e.id)}">Mark as paid</button>` : ''}
              <button data-action="edit-expense" data-id="${esc(e.id)}">Edit expense</button>
              <div class="menu-divider"></div>
              <button class="danger-action" data-action="delete-expense" data-id="${esc(e.id)}">Delete expense</button>
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('') || emptyRow(7, 'No expenses recorded yet — click "＋ Record expense" to log one quickly');

  return `
    ${heading('Expenses', 'Fast business expense entry, payment tracking, notes, and receipt attachments.', `
      <button class="button" data-action="export-expenses">↓ Export CSV</button>
      <button class="button primary" data-action="new-expense">＋ Record expense</button>
    `)}
    <section class="summary-strip">
      <div class="summary-mini"><small>Total Expenses (${allExpenses.length})</small><strong>${money(totalAmount)}</strong></div>
      <div class="summary-mini"><small>Paid (${paidExpenses.length})</small><strong style="color:#00a651">${money(paidTotal)}</strong></div>
      <div class="summary-mini"><small>Unpaid / Pending (${unpaidExpenses.length})</small><strong style="color:${unpaidTotal > 0 ? '#ef233c' : 'var(--ink)'}">${money(unpaidTotal)}</strong></div>
      <div class="summary-mini"><small>Today's Expenses</small><strong>${money(todayTotal)}</strong></div>
    </section>
    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="table-search" placeholder="Search payee, purpose, notes, or ID…" value="${esc(tableQuery)}"></label>
          <select class="select-control" id="expense-status">
            <option value="" ${expenseStatusFilter === '' ? 'selected' : ''}>All statuses</option>
            <option value="paid" ${expenseStatusFilter === 'paid' ? 'selected' : ''}>Paid</option>
            <option value="unpaid" ${expenseStatusFilter === 'unpaid' ? 'selected' : ''}>Unpaid</option>
          </select>
          ${dateRangeFilter('expense', expenseDateFrom, expenseDateTo)}
        </div>
        <span class="muted" style="font-size:11px">${filtered.length} of ${allExpenses.length} expenses · <strong>${money(filteredTotal)}</strong></span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>For Whom</th>
              <th>Purpose &amp; Notes</th>
              <th>Amount</th>
              <th>Payment Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
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
      ${isSupplier ? '' : `<td>${Number(item.creditLimit) > 0 ? money(item.creditLimit) : '—'}</td>`}
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
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Account Name</th><th>Phone / Contact</th><th>Email</th>${isSupplier ? '' : '<th>Credit limit</th>'}<th>Balance</th><th>Payment status</th><th>Account status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
  `;
}

// Users Page
function renderUsers() {
  const visibleUsers = state.users.filter(u => isWorkspaceAdministrator() || u.branchId === activeBranch?.id);
  const rows = visibleUsers.map(user => {
    const isRoot = Boolean(user.isBootstrap);
    const permissions = effectiveUserPermissions(user);
    const granted = userActionPermissions.filter(group => (permissions[group.module] || []).includes('view')).map(group => pageLabels[group.module] || group.module);
    const accessLabel = isRoot ? 'Root Administrator (Universal Access)' : granted.length ? granted.join(', ') : 'No sections enabled';
    return `
      <tr>
        <td><strong>${esc(user.name)}</strong><small>${esc(user.id)}</small></td>
        <td>${esc(user.email || '—')}<small>@${esc(user.username || 'credentials needed')}</small><small>${esc(user.phone || '')}</small></td>
        <td><strong>${esc(user.role)}</strong></td>
        <td>${esc(state.branches.find(branch => branch.id === user.branchId)?.name || 'Unassigned')}</td>
        <td class="user-access-summary">${esc(accessLabel)}<small>${isRoot ? 'Permissions are always enabled for the root Owner / Administrator' : `${Object.values(permissions).reduce((sum, actions) => sum + actions.length, 0)} actions granted`}</small></td>
        <td><span class="status-pill ${user.status === 'Active' ? 'paid' : 'pending'}">${esc(user.status || 'Active')}</span></td>
        <td>
          <details class="order-actions user-actions">
            <summary aria-label="Actions for ${esc(user.name)}">•••</summary>
            <div class="order-actions-menu user-actions-menu">
              ${isWorkspaceAdministrator() ? `<button data-action="edit-user" data-id="${esc(user.id)}">Edit user</button>` : ''}
              ${isWorkspaceAdministrator() ? `<button data-action="set-user-credentials" data-id="${esc(user.id)}">Set password & credentials</button>` : ''}
              ${isWorkspaceAdministrator() ? `<button data-action="view-user-activity" data-id="${esc(user.id)}">View activity</button>` : ''}
              ${!isRoot && isWorkspaceAdministrator() ? `<button data-action="edit-user-permissions" data-id="${esc(user.id)}">Permissions</button>` : ''}
              ${!user.isBootstrap && canPerformAction('toggle-user') ? `<button data-action="toggle-user" data-id="${esc(user.id)}">${user.status === 'Active' ? 'Deactivate' : 'Activate'}</button>` : ''}
              ${!user.isBootstrap && isWorkspaceAdministrator() ? `<button class="danger-action" data-action="delete-user" data-id="${esc(user.id)}">Delete user</button>` : ''}
            </div>
          </details>
        </td>
      </tr>
    `;
  }).join('') || emptyRow(7, 'No users added yet');

  return `
    ${heading('Users', 'Manage workspace team members, roles, and access credentials.', `
      ${canPerformAction('new-user') ? '<button class="button primary" data-action="new-user">＋ Add user</button>' : ''}
    `)}
    <section class="table-panel">
      <div class="table-scroll"><table class="data-table"><thead><tr><th>User</th><th>Email / Phone</th><th>Role</th><th>Branch</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
  `;
}

function openUserPermissionsForm(user) {
  if (!isWorkspaceAdministrator()) { toast('Only an Owner / Administrator can override user permissions'); return; }
  if (!user || user.isBootstrap) { toast('The root Owner / Administrator always has full access'); return; }
  const selected = effectiveUserPermissions(user);
  const groups = userActionPermissions.map(group => {
    const granted = selected[group.module] || [];
    const all = group.actions.length > 0 && granted.length === group.actions.length;
    return `<fieldset class="user-permission-group"><legend><label class="user-permission"><input type="checkbox" data-permission-module="${esc(group.module)}" ${all ? 'checked' : ''}><span>${esc(pageLabels[group.module] || group.module)} · enable all</span></label></legend><div class="user-subpermission-grid">${group.actions.map(([action, label]) => `<label class="user-subpermission"><input type="checkbox" name="user-permission" value="${esc(group.module)}|${esc(action)}" ${granted.includes(action) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;
  }).join('');
  openDialog('edit-user-permissions', `Access for ${esc(user.name)}`, 'Choose exactly which sections and actions this user can access. Owner / Administrator accounts always retain full access.', `<div class="inline-note user-permission-note">Role: <strong>${esc(user.role)}</strong>. These choices apply only to this user and can be changed again at any time.</div><div class="user-permission-grid">${groups}</div>`, 'Save permissions');
  const form = document.getElementById('modal-content'); form.dataset.recordId = user.id;
  form.querySelectorAll('[data-permission-module]').forEach(parent => {
    const children = [...parent.closest('fieldset').querySelectorAll('input[name="user-permission"]')];
    const checked = children.filter(child => child.checked).length;
    parent.indeterminate = checked > 0 && checked < children.length;
  });
}

function openUserCredentialsForm(user) {
  if (!user) return;
  openDialog('set-user-credentials', 'Set login credentials', `Assign a full name, username, email, and password for ${esc(user.name)}.`, `<div class="form-grid">${inputField('credential-name', 'Full name', 'e.g. John Doe', 'text', true, user.name || '')}${inputField('credential-username', 'Username', 'e.g. chiko', 'text', true, user.username || '')}${inputField('credential-email', 'Email', 'name@example.com', 'email', true, user.email || '')}${inputField('credential-password', user.passwordHash ? 'New password' : 'Initial password', user.passwordHash ? 'Leave blank to keep current password' : 'At least 8 characters', 'password', !user.passwordHash)}${inputField('credential-password-confirm', 'Confirm password', 'Re-enter password', 'password', !user.passwordHash)}</div>`, 'Save credentials');
  document.getElementById('modal-content').dataset.recordId = user.id;
}

function openUserEditForm(user) {
  if (!user || !isWorkspaceAdministrator()) return;
  const roles = ['Salesman', 'Storekeeper', 'Manager', 'Owner / Administrator'];
  openDialog('edit-user', `Edit ${esc(user.name)}`, 'Update this user’s profile, assigned branch, role, and login credentials. Leave the password blank to keep the current password.', `<div class="form-grid">${inputField('edit-user-name', 'Full name', '', 'text', true, user.name || '')}${inputField('edit-user-username', 'Username', 'Choose a unique username', 'text', true, user.username || '')}${inputField('edit-user-email', 'Email', 'name@example.com', 'email', true, user.email || '')}${inputField('edit-user-phone', 'Phone', '', 'tel', false, user.phone || '')}${branchSelectField('edit-user-branch', 'Assigned branch', user.branchId)}${inputField('edit-user-password', 'New password', 'Leave blank to keep current password', 'password')}${inputField('edit-user-password-confirm', 'Confirm new password', 'Re-enter new password', 'password')}${selectField('edit-user-role', 'Role', roles, user.role || 'Salesman')}</div>`, 'Save user');
  document.getElementById('modal-content').dataset.recordId = user.id;
}

function openOwnCredentialsForm() {
  const user = currentWorkspaceUser();
  openModal('My account', 'Update your personal name and credentials for your signed-in account.', `<input type="hidden" name="dialog-kind" value="own-credentials"><div class="form-grid">${inputField('own-name', 'Your full name', 'e.g. Emmanuel', 'text', true, user.name || '')}${inputField('own-current-password', 'Current password (required only if changing password)', '', 'password', false)}${inputField('own-username', 'Username', '', 'text', true, user.username || '')}${inputField('own-email', 'Email', '', 'email', true, user.email || '')}${inputField('own-new-password', 'New password', 'Leave blank to keep current password', 'password')}${inputField('own-new-password-confirm', 'Confirm new password', '', 'password')}</div>`, 'Save changes', '<button type="button" class="button" data-action="logout">Sign out</button>');
  document.getElementById('modal-content').dataset.dialogKind = 'own-credentials';
}

// Branches Page
function renderBranches() {
  const admin = isWorkspaceAdministrator();
  const allowed = new Set(accessibleBranches().map(b => b.id));
  const cards = state.branches.filter(b => b.status !== 'Inactive' && allowed.has(b.id)).map(b => {
    const active = b.id === activeBranch.id;
    return `
      <article class="branch-card">
        <div class="branch-card-top"><span class="branch-symbol">▦</span><span class="status-pill ${active ? 'paid' : 'pending'}">${active ? 'Current' : 'Active'}</span></div>
        <h2>${esc(b.name)}</h2>
        <p>${esc(b.id)}</p>
        <div class="branch-actions">
          ${active ? '<button class="button" disabled>Current workspace</button>' : `<button class="button primary" data-action="open-branch" data-id="${esc(b.id)}">Open workspace</button>`}
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
  const receivables = accountOutstandingTotal('Customer');
  const payables = accountOutstandingTotal('Supplier');
  const renderAccounts = (partyType, accounts) => accounts.length ? accounts.map(account => {
    const balance = Number(account.balance) || 0;
    const amount = partyType === 'Customer' ? Math.abs(balance) : Math.abs(balance);
    const label = partyType === 'Customer' ? (balance < 0 ? 'Customer credit' : 'Receivable') : (balance < 0 ? 'Payable' : 'Supplier credit');
    const status = balance === 0 ? 'Settled' : partyType === 'Customer' ? (balance > 0 ? 'Receivable' : 'Credit balance') : (balance < 0 ? 'Payable' : 'Credit balance');
    return `<article class="accounting-account-card"><div class="accounting-account-head"><div><span class="eyebrow">${esc(partyType)} account</span><h3>${esc(account.name)}</h3><small>${esc(account.id)}${account.phone ? ` · ${esc(account.phone)}` : ''}</small></div><span class="status-pill ${balance === 0 ? 'paid' : 'pending'}">${status}</span></div><div class="accounting-account-balance"><small>${label}</small><strong>${money(amount)}</strong></div><div class="accounting-account-actions"><button class="button small" data-action="view-account-ledger" data-party-type="${partyType}" data-party-name="${esc(account.name)}">View transactions</button><button class="button small" data-action="record-payment" data-party-type="${partyType}" data-party-name="${esc(account.name)}">Add payment</button><button class="button small" data-action="reconcile-account" data-party-type="${partyType}" data-party-name="${esc(account.name)}">Reconcile</button></div></article>`;
  }).join('') : `<div class="inline-note">No ${partyType.toLowerCase()} accounts yet.</div>`;

  return `
    ${heading('Accounting & Ledger', 'Manage each customer and supplier account separately, review its activity, record payments, or reconcile its balance.', `<button class="button" data-action="export-ledger">↓ Export Ledger CSV</button>`)}
    <section class="summary-strip"><div class="summary-mini"><small>Customer receivables</small><strong>${money(receivables)}</strong></div><div class="summary-mini"><small>Supplier payables</small><strong>${money(payables)}</strong></div><div class="summary-mini"><small>Ledger entries</small><strong>${state.entries.length}</strong></div></section>
    <section class="accounting-account-section"><div class="panel-header"><div><h2 class="panel-title">Customer accounts</h2><p class="panel-subtitle">Receivables, customer payments, and individual account histories.</p></div></div><div class="accounting-account-grid">${renderAccounts('Customer', state.customers)}</div></section>
    <section class="accounting-account-section"><div class="panel-header"><div><h2 class="panel-title">Supplier accounts</h2><p class="panel-subtitle">Payables, supplier payments, and individual account histories.</p></div></div><div class="accounting-account-grid">${renderAccounts('Supplier', state.suppliers)}</div></section>
  `;
}

const reportColors = ['#087f9d', '#ff8c42', '#8b5cf6', '#20a779', '#e34f7a', '#e8b323', '#3b82f6', '#17b8a6'];

function reportDateRange(period = reportPeriod) {
  const end = today(), cursor = new Date(`${end}T12:00:00Z`);
  let startDate, endDate, label;
  if (period === 'weekly') {
    const mondayOffset = (cursor.getUTCDay() + 6) % 7;
    startDate = new Date(cursor); startDate.setUTCDate(cursor.getUTCDate() - mondayOffset);
    endDate = new Date(startDate); endDate.setUTCDate(startDate.getUTCDate() + 6);
    label = 'Weekly report';
  } else if (period === 'annual') {
    startDate = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1, 12)); endDate = new Date(Date.UTC(cursor.getUTCFullYear(), 11, 31, 12));
    label = `Annual report · ${cursor.getUTCFullYear()}`;
  } else {
    startDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1, 12)); endDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 12));
    label = 'Monthly report';
  }
  const iso = date => date.toISOString().slice(0, 10);
  return { start: iso(startDate), end: iso(endDate), label };
}

function reportPeriodData() {
  const range = reportDateRange();
  const sales = state.sales.filter(sale => sale.date >= range.start && sale.date <= range.end);
  const purchases = state.purchases.filter(purchase => purchase.date >= range.start && purchase.date <= range.end);
  const salesTotal = sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const purchaseTotal = purchases.reduce((sum, purchase) => sum + (Number(purchase.total) || 0), 0);
  const paymentSources = new Set(['account-payment', 'order-payment', 'sales-payment', 'purchase-payment']);
  const periodPayments = state.entries.filter(entry => paymentSources.has(entry.sourceType) && entry.date >= range.start && entry.date <= range.end);
  const customerReceipts = periodPayments.filter(entry => entry.partyType === 'Customer' && entry.type === 'Credit');
  const supplierPayments = periodPayments.filter(entry => entry.partyType === 'Supplier' && entry.type === 'Debit');
  const collected = customerReceipts.length ? customerReceipts.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0) : sales.reduce((sum, sale) => sum + (Number.isFinite(Number(sale.paid)) ? Number(sale.paid) : (sale.status === 'Paid' ? Number(sale.total) || 0 : 0)), 0);
  const supplierPaid = supplierPayments.length ? supplierPayments.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0) : purchases.reduce((sum, purchase) => sum + (Number(purchase.paid) || 0), 0);
  const hasTransactionHistory = state.sales.length > 0 || state.purchases.length > 0;
  const netCollected = hasTransactionHistory ? collected - supplierPaid : 0;
  let cogsTotal = 0;
  for (const sale of sales) {
    for (const item of sale.items || []) {
      const prod = state.products.find(p => p.id === item.productId);
      const unitCost = Number(prod?.cost) || 0;
      cogsTotal += (Number(item.qty) || 0) * unitCost;
    }
  }
  const grossProfit = salesTotal - cogsTotal;
  return { ...range, sales, purchases, salesTotal, purchaseTotal, collected, supplierPaid, netCollected, cogsTotal, grossProfit };
}

function reportBuckets(data) {
  if (reportPeriod === 'weekly') {
    const start = new Date(`${data.start}T12:00:00Z`);
    return Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return { key: date.toISOString().slice(0, 10), label: new Intl.DateTimeFormat('en-TZ', { weekday: 'short', timeZone: 'Africa/Dar_es_Salaam' }).format(date) } });
  }
  if (reportPeriod === 'annual') return Array.from({ length: 12 }, (_, month) => ({ key: String(month + 1).padStart(2, '0'), label: new Intl.DateTimeFormat('en-TZ', { month: 'short', timeZone: 'Africa/Dar_es_Salaam' }).format(new Date(Date.UTC(2025, month, 15, 12))) }));
  return Array.from({ length: 5 }, (_, week) => ({ key: String(week), label: `Week ${week + 1}` }));
}

function renderFinancialBarChart(data) {
  const buckets = reportBuckets(data), values = buckets.map(bucket => {
    const getIndex = date => reportPeriod === 'weekly' ? date : reportPeriod === 'annual' ? date.slice(5, 7) : String(Math.floor((Number(date.slice(8, 10)) - 1) / 7));
    return { ...bucket, sales: data.sales.filter(sale => getIndex(sale.date) === bucket.key).reduce((sum, sale) => sum + (Number(sale.total) || 0), 0), purchases: data.purchases.filter(purchase => getIndex(purchase.date) === bucket.key).reduce((sum, purchase) => sum + (Number(purchase.total) || 0), 0) };
  });
  const max = Math.max(1, ...values.flatMap(item => [item.sales, item.purchases]));
  const ceiling = Math.ceil(max / 1000) * 1000 || 1000, plotTop = 22, plotBottom = 204, plotHeight = plotBottom - plotTop, left = 58, width = 650, gap = width / values.length, barWidth = Math.min(22, gap * .27);
  const guides = [0, .25, .5, .75, 1].map(f => { const y = plotBottom - plotHeight * f; return `<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" class="report-gridline"/><text x="${left - 8}" y="${y + 4}" text-anchor="end" class="report-axis-label">${Math.round(ceiling * f / 1000)}k</text>` }).join('');
  const bars = values.map((item, index) => { const center = left + gap * index + gap / 2, salesHeight = item.sales / max * plotHeight, purchaseHeight = item.purchases / max * plotHeight; return `<rect x="${center - barWidth - 2}" y="${plotBottom - salesHeight}" width="${barWidth}" height="${Math.max(item.sales ? 2 : 0, salesHeight)}" rx="4" fill="#087f9d"><title>${esc(item.label)} sales · ${money(item.sales)}</title></rect><rect x="${center + 2}" y="${plotBottom - purchaseHeight}" width="${barWidth}" height="${Math.max(item.purchases ? 2 : 0, purchaseHeight)}" rx="4" fill="#ff8c42"><title>${esc(item.label)} purchases · ${money(item.purchases)}</title></rect><text x="${center}" y="228" text-anchor="middle" class="report-axis-label">${esc(item.label)}</text>` }).join('');
  return `<div class="report-chart-scroll"><svg class="financial-bar-chart" viewBox="0 0 740 245" role="img" aria-label="Sales and purchases comparison">${guides}${bars}</svg></div>`;
}

function reportPieCard(title, subtitle, entries, centerLabel) {
  const sorted = entries.filter(([, amount]) => Number(amount) > 0).sort((a, b) => b[1] - a[1]);
  const shown = sorted.slice(0, 6), other = sorted.slice(6).reduce((sum, item) => sum + item[1], 0);
  if (other > 0) shown.push(['Other', other]);
  const total = shown.reduce((sum, item) => sum + item[1], 0);
  let angle = 0;
  const stops = shown.map(([name, amount], index) => { const start = angle; angle += amount / Math.max(total, 1) * 100; return `${reportColors[index % reportColors.length]} ${start}% ${angle}%` }).join(',');
  const legend = shown.map(([name, amount], index) => `<div class="report-pie-legend-item"><i style="--slice-color:${reportColors[index % reportColors.length]}"></i><span>${esc(name)}</span><strong>${money(amount)}</strong></div>`).join('') || '<div class="muted">No transactions in this period</div>';
  const compactTotal = new Intl.NumberFormat('en-TZ', { notation: 'compact', maximumFractionDigits: 1 }).format(total);
  return `<article class="report-pie-card"><div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><div class="report-pie-layout"><div class="report-pie" style="background:conic-gradient(${stops || '#e7edf0 0 100%'})"><div><strong>${esc(compactTotal)}</strong><small>${esc(centerLabel)}</small></div></div><div class="report-pie-legend">${legend}</div></div></article>`;
}

function viewStocktakeSession(sessionId) {
  const st = (state.stocktakes || []).find(s => s.id === sessionId);
  if (!st) { toast('Stock take worksheet record not found'); return; }

  const items = st.items || [];
  const isRevoked = st.status === 'Revoked';
  const isAdmin = isWorkspaceAdministrator();

  const modalContent = `
    <div style="margin-bottom:16px">
      ${isRevoked ? `
        <div style="margin-bottom:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 14px;border-radius:6px;font-size:12px">
          ⚠️ <strong>REVOKED:</strong> This stock take was revoked by an Administrator${st.revokedAt ? ` on ${dateLabel(st.revokedAt.slice(0, 10))}` : ''}. Its stock adjustments were reversed back to their initial balances.
        </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:gap:8px">
        <div>
          <h2 style="margin:0 0 4px;font-size:18px">Stock Take Worksheet · ${esc(st.id)}</h2>
          <p class="muted" style="margin:0;font-size:12px">
            Audited on <strong>${dateLabel(st.dateStr || st.date?.slice(0, 10))}</strong> at ${st.date ? new Date(st.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} · Auditor: <strong>${esc(st.user || 'Administrator')}</strong>
          </p>
          <p style="margin:4px 0 0;font-size:12px"><strong>Reason:</strong> ${esc(st.reason || 'Physical count')}</p>
          ${st.editedAt ? `<p style="margin:2px 0 0;font-size:11px;color:var(--muted)">✎ Last corrected on ${dateLabel(st.editedAt.slice(0, 10))} by ${esc(st.editedBy || 'Administrator')}</p>` : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${isRevoked ? `<span class="stocktake-diff-pill shortage">REVOKED</span>` : `<span class="stocktake-diff-pill match">ACTIVE</span>`}
          <span class="stocktake-diff-pill match">${st.matchedCount || 0} Match</span>
          <span class="stocktake-diff-pill shortage">${st.shortageCount || 0} Shortage</span>
          <span class="stocktake-diff-pill surplus">${st.surplusCount || 0} Surplus</span>
        </div>
      </div>
    </div>

    <div class="summary-strip" style="margin-bottom:16px">
      <div class="summary-mini"><small>Products Audited</small><strong>${items.length}</strong></div>
      <div class="summary-mini"><small>Net Quantity Delta</small><strong>${st.netQtyDelta > 0 ? `+${st.netQtyDelta}` : st.netQtyDelta} units</strong></div>
      <div class="summary-mini"><small>Net Cost Impact</small><strong>${money(st.netValueDelta || 0)}</strong></div>
    </div>

    <div class="table-scroll" style="max-height:360px">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Before Stock</th>
            <th>Counted Stock</th>
            <th>Variance</th>
            <th>Cost Impact</th>
            <th>Expiry Date</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
    const delta = Number(item.delta || 0);
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    const deltaClass = delta === 0 ? 'stocktake-diff-pill match' : delta > 0 ? 'stocktake-diff-pill surplus' : 'stocktake-diff-pill shortage';
    return `
              <tr>
                <td><strong>${esc(item.productName)}</strong></td>
                <td><small>${esc(item.sku || '—')}</small></td>
                <td>${item.beforeStock}</td>
                <td><strong>${item.countedStock}</strong></td>
                <td><span class="${deltaClass}">${sign}</span></td>
                <td>${item.costImpact ? money(item.costImpact) : '—'}</td>
                <td>${item.expiryDate ? `<small>${esc(item.expiryDate)}</small>` : '<span class="muted">—</span>'}</td>
              </tr>
            `;
  }).join('')}
        </tbody>
      </table>
    </div>

    <div class="modal-actions" style="margin-top:16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" class="button" onclick="window.print()">🖨 Print Worksheet</button>
        ${isAdmin && !isRevoked ? `<button type="button" class="button" data-action="edit-stocktake-session" data-id="${esc(st.id)}">✎ Edit counts</button>` : ''}
        ${isAdmin && !isRevoked ? `<button type="button" class="button danger-action" data-action="revoke-stocktake-session" data-id="${esc(st.id)}" style="color:#ef4444">↺ Revoke &amp; Revert Stock</button>` : ''}
        ${isAdmin ? `<button type="button" class="button danger-action" data-action="delete-stocktake-session" data-id="${esc(st.id)}" style="color:#dc2626">🗑 Delete session</button>` : ''}
      </div>
      <button type="button" class="button primary" onclick="document.getElementById('app-modal')?.close()">Close</button>
    </div>
  `;

  const modal = document.getElementById('app-modal');
  const form = document.getElementById('modal-content');
  if (modal && form) {
    form.innerHTML = modalContent;
    delete form.dataset.dialogKind;
    modal.showModal();
  }
}

function openEditStocktakeModal(sessionId) {
  if (!isWorkspaceAdministrator()) {
    toast('Administrator privileges required');
    return;
  }
  const st = (state.stocktakes || []).find(s => s.id === sessionId);
  if (!st) { toast('Stock take record not found'); return; }
  if (st.status === 'Revoked') { toast('Revoked stock takes cannot be edited'); return; }

  const items = st.items || [];
  const modalContent = `
    <input type="hidden" name="dialog-kind" value="save-edit-stocktake">
    <div style="margin-bottom:14px">
      <h2 style="margin:0 0 4px;font-size:18px">Edit Stock Take Session · ${esc(st.id)}</h2>
      <p class="panel-subtitle" style="margin:0;font-size:12px">Correct counted physical quantities or reasons. Changing quantities will update the current stock accordingly.</p>
    </div>

    <div style="margin-bottom:12px">
      <label class="field-label" style="font-size:12px;font-weight:700">Reason / Reference note:
        <input id="st-edit-reason" name="st-edit-reason" value="${esc(st.reason || '')}" class="text-control" style="margin-top:4px;width:100%" required>
      </label>
    </div>

    <div class="table-scroll" style="max-height:360px">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Initial Stock</th>
            <th>Counted Physical Stock</th>
            <th>Expiry Date</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td><strong>${esc(item.productName)}</strong></td>
              <td><small>${esc(item.sku || '—')}</small></td>
              <td>${item.beforeStock}</td>
              <td style="width:140px">
                <input type="number" min="0" step="1" class="text-control st-edit-count" data-product-id="${esc(item.productId)}" value="${item.countedStock}" style="width:100px;font-weight:700;padding:4px 8px" required>
              </td>
              <td style="width:160px">
                <input type="date" class="text-control st-edit-exp" data-product-id="${esc(item.productId)}" value="${esc(item.expiryDate || '')}" style="width:140px;padding:4px 8px">
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="modal-actions" style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px">
      <button type="button" class="button" onclick="document.getElementById('app-modal')?.close()">Cancel</button>
      <button type="submit" class="button primary">Save Corrections</button>
    </div>
  `;

  const modal = document.getElementById('app-modal');
  const form = document.getElementById('modal-content');
  if (modal && form) {
    form.innerHTML = modalContent;
    form.dataset.dialogKind = 'save-edit-stocktake';
    form.dataset.recordId = st.id;
    modal.showModal();
  }
}

function openEditStockMovementModal(movementId) {
  if (!isWorkspaceAdministrator()) {
    toast('Administrator privileges required');
    return;
  }
  const m = (state.stockMovements || []).find(item => item.id === movementId);
  if (!m) { toast('Stock movement record not found'); return; }
  if (m.status === 'Revoked') { toast('Revoked adjustments cannot be edited'); return; }

  const modalContent = `
    <input type="hidden" name="dialog-kind" value="save-edit-stock-movement">
    <div style="margin-bottom:14px">
      <h2 style="margin:0 0 4px;font-size:18px">Edit Stock Adjustment · ${esc(m.id)}</h2>
      <p class="panel-subtitle" style="margin:0;font-size:12px">Correct the quantity change or memo. Adjusting the delta will apply the difference to the product's on-hand stock.</p>
    </div>

    <div class="form-grid">
      <div class="field full">
        <label>Product</label>
        <input class="text-control" value="${esc(m.product || m.productId)} (${esc(m.productId || '')})" readonly disabled>
      </div>
      <div class="field">
        <label>Stock before adjustment</label>
        <input class="text-control" value="${m.before !== undefined ? m.before : '—'}" readonly disabled>
      </div>
      <div class="field">
        <label for="edit-movement-delta">Quantity delta (+ or −)</label>
        <input type="number" id="edit-movement-delta" name="edit-movement-delta" value="${m.delta || 0}" class="text-control" required>
      </div>
      <div class="field full">
        <label for="edit-movement-reason">Reason / Memo</label>
        <input type="text" id="edit-movement-reason" name="edit-movement-reason" value="${esc(m.reason || '')}" class="text-control" required>
      </div>
    </div>

    <div class="modal-actions" style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px">
      <button type="button" class="button" onclick="document.getElementById('app-modal')?.close()">Cancel</button>
      <button type="submit" class="button primary">Save Adjustment</button>
    </div>
  `;

  const modal = document.getElementById('app-modal');
  const form = document.getElementById('modal-content');
  if (modal && form) {
    form.innerHTML = modalContent;
    form.dataset.dialogKind = 'save-edit-stock-movement';
    form.dataset.recordId = m.id;
    modal.showModal();
  }
}

function viewProductSalesHistory(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) { toast('Product not found'); return; }

  const allOrders = typeof salesOrderRows === 'function' ? salesOrderRows() : (state.orders || []);
  const validOrders = allOrders.filter(o => o.status !== 'Draft' && o.status !== 'Cancelled');

  const lines = [];
  for (const order of validOrders) {
    const match = (order.items || []).find(line => line.productId === product.id || line.product === product.name);
    if (match) {
      lines.push({
        orderId: order.id,
        date: order.date,
        customer: order.customer,
        qty: Number(match.qty || 0),
        unitPrice: Number(match.unitPrice || product.price || 0),
        total: Number(match.qty || 0) * Number(match.unitPrice || product.price || 0),
        source: order.source || 'Order',
        paymentStatus: typeof orderPaymentStatus === 'function' ? orderPaymentStatus(order) : 'Paid',
        orderStatus: order.status
      });
    }
  }

  const totalUnits = lines.reduce((sum, l) => sum + l.qty, 0);
  const totalRev = lines.reduce((sum, l) => sum + l.total, 0);

  const modalContent = `
    <div style="margin-bottom:16px">
      <h2 style="margin:0 0 4px;font-size:18px">Sales History: ${esc(product.name)}</h2>
      <p class="muted" style="margin:0;font-size:12px">
        SKU: <strong>${esc(product.sku || product.id)}</strong> · Category: <strong>${esc(product.category || 'General')}</strong> · Current In-Stock: <strong>${product.stock} units</strong>
      </p>
    </div>

    <div class="summary-strip" style="margin-bottom:16px">
      <div class="summary-mini"><small>Total Units Sold</small><strong>${totalUnits.toLocaleString()} units</strong></div>
      <div class="summary-mini"><small>Total Revenue</small><strong>${money(totalRev)}</strong></div>
      <div class="summary-mini"><small>Orders Count</small><strong>${lines.length} orders</strong></div>
    </div>

    <div class="table-scroll" style="max-height:360px">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Order Ref</th>
            <th>Customer</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Line Total</th>
            <th>Payment Status</th>
          </tr>
        </thead>
        <tbody>
          ${lines.length ? lines.map(line => `
            <tr>
              <td><strong>${dateLabel(line.date)}</strong></td>
              <td><strong>${esc(line.orderId)}</strong><br><small class="muted">${esc(line.source)}</small></td>
              <td>${esc(line.customer)}</td>
              <td><strong>${line.qty}</strong></td>
              <td>${money(line.unitPrice)}</td>
              <td><strong>${money(line.total)}</strong></td>
              <td><span class="status-pill status-ready">${esc(line.paymentStatus)}</span></td>
            </tr>
          `).join('') : emptyRow(7, 'No sales orders found for this product.')}
        </tbody>
      </table>
    </div>

    <div class="modal-actions" style="margin-top:16px;display:flex;justify-content:flex-end">
      <button type="button" class="button primary" onclick="document.getElementById('app-modal')?.close()">Close</button>
    </div>
  `;

  const modal = document.getElementById('app-modal');
  const form = document.getElementById('modal-content');
  if (modal && form) {
    form.innerHTML = modalContent;
    delete form.dataset.dialogKind;
    modal.showModal();
  }
}

function viewProductPurchaseHistory(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) { toast('Product not found'); return; }

  const purchases = (state.purchases || []).filter(p => p.status !== 'Draft' && p.status !== 'Cancelled');
  const lines = [];

  for (const po of purchases) {
    const match = (po.lines || po.items || []).find(l => l.productId === product.id || l.product === product.name);
    if (match) {
      lines.push({
        poId: po.id,
        date: po.date,
        supplier: po.supplier,
        qty: Number(match.qty || 0),
        unitCost: Number(match.unitCost || product.cost || 0),
        total: Number(match.qty || 0) * Number(match.unitCost || product.cost || 0),
        status: po.status
      });
    }
  }

  const totalUnits = lines.reduce((sum, l) => sum + l.qty, 0);
  const totalSpend = lines.reduce((sum, l) => sum + l.total, 0);

  const modalContent = `
    <div style="margin-bottom:16px">
      <h2 style="margin:0 0 4px;font-size:18px">Purchase Restock History: ${esc(product.name)}</h2>
      <p class="muted" style="margin:0;font-size:12px">
        SKU: <strong>${esc(product.sku || product.id)}</strong> · Current In-Stock: <strong>${product.stock} units</strong>
      </p>
    </div>

    <div class="summary-strip" style="margin-bottom:16px">
      <div class="summary-mini"><small>Total Units Restocked</small><strong>${totalUnits.toLocaleString()} units</strong></div>
      <div class="summary-mini"><small>Total Spend</small><strong>${money(totalSpend)}</strong></div>
      <div class="summary-mini"><small>Restock Orders</small><strong>${lines.length}</strong></div>
    </div>

    <div class="table-scroll" style="max-height:360px">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>PO Number</th>
            <th>Supplier</th>
            <th>Quantity Ordered</th>
            <th>Unit Cost</th>
            <th>Total Cost</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${lines.length ? lines.map(line => `
            <tr>
              <td><strong>${dateLabel(line.date)}</strong></td>
              <td><strong>${esc(line.poId)}</strong></td>
              <td><strong>${esc(line.supplier)}</strong></td>
              <td><strong>${line.qty}</strong></td>
              <td>${money(line.unitCost)}</td>
              <td><strong>${money(line.total)}</strong></td>
              <td><span class="status-pill status-ready">${esc(line.status)}</span></td>
            </tr>
          `).join('') : emptyRow(7, 'No purchase orders found for this product.')}
        </tbody>
      </table>
    </div>

    <div class="modal-actions" style="margin-top:16px;display:flex;justify-content:flex-end">
      <button type="button" class="button primary" onclick="document.getElementById('app-modal')?.close()">Close</button>
    </div>
  `;

  const modal = document.getElementById('app-modal');
  const form = document.getElementById('modal-content');
  if (modal && form) {
    form.innerHTML = modalContent;
    delete form.dataset.dialogKind;
    modal.showModal();
  }
}

function extractPaymentMethodFromMemo(memo = '') {
  const m = String(memo).toLowerCase();
  if (m.includes('m-pesa') || m.includes('mpesa')) return 'Mobile (M-Pesa)';
  if (m.includes('tigo')) return 'Mobile (Tigo Pesa)';
  if (m.includes('airtel')) return 'Mobile (Airtel)';
  if (m.includes('mobile')) return 'Mobile money';
  if (m.includes('bank') || m.includes('transfer')) return 'Bank transfer';
  if (m.includes('cheque') || m.includes('check')) return 'Cheque';
  if (m.includes('card')) return 'Card';
  if (m.includes('cash')) return 'Cash';
  return 'Cash';
}

function collectAllPaymentRecords() {
  const records = [];
  const entries = Array.isArray(state.entries) ? state.entries : [];

  // From ledger entries
  for (const e of entries) {
    if (e.sourceType === 'order-payment' || (e.partyType === 'Customer' && e.type === 'Credit' && Number(e.amount) > 0)) {
      records.push({
        id: e.id,
        date: e.date,
        direction: 'INFLOW',
        partyType: 'Customer',
        party: e.party,
        amount: Number(e.amount) || 0,
        method: extractPaymentMethodFromMemo(e.memo) || 'Cash',
        sourceType: e.sourceType || 'Customer payment',
        sourceId: e.sourceId || e.id,
        memo: e.memo || 'Customer payment received'
      });
    } else if (e.sourceType === 'purchase-payment' || (e.partyType === 'Supplier' && e.type === 'Debit' && Number(e.amount) > 0)) {
      records.push({
        id: e.id,
        date: e.date,
        direction: 'OUTFLOW',
        partyType: 'Supplier',
        party: e.party,
        amount: Number(e.amount) || 0,
        method: extractPaymentMethodFromMemo(e.memo) || 'Cash',
        sourceType: e.sourceType || 'Supplier payment',
        sourceId: e.sourceId || e.id,
        memo: e.memo || 'Payment made to supplier'
      });
    }
  }

  // Also include direct POS cash/mobile sales if not in entries
  const existingSourceIds = new Set(records.map(r => r.sourceId));
  const allOrders = typeof salesOrderRows === 'function' ? salesOrderRows() : (state.orders || []);
  for (const o of allOrders) {
    if (o.status !== 'Draft' && o.status !== 'Cancelled' && Number(o.paid || 0) > 0 && !existingSourceIds.has(o.id) && !existingSourceIds.has(o.invoiceId)) {
      records.push({
        id: `PAY-${o.id}`,
        date: (o.date || '').slice(0, 10),
        direction: 'INFLOW',
        partyType: 'Customer',
        party: o.customer || 'Walk-in customer',
        amount: Number(o.paid || o.total || 0),
        method: orderPaymentMethodLabel(o) || 'Cash',
        sourceType: o.source === 'POS' ? 'POS sale' : 'Sales order',
        sourceId: o.id,
        memo: `Direct payment collected for ${o.id}`
      });
    }
  }

  // Also include paid operating expenses as OUTFLOW records
  for (const ex of state.expenses || []) {
    if (ex && ex.paid && Number(ex.amount) > 0) {
      records.push({
        id: ex.id,
        date: (ex.paymentDate || ex.date || '').slice(0, 10),
        direction: 'OUTFLOW',
        partyType: 'Expense',
        party: ex.forWhom || 'General Expense',
        amount: Number(ex.amount) || 0,
        method: ex.paymentMethod || 'Cash',
        sourceType: 'Operating expense',
        sourceId: ex.id,
        memo: `${ex.purpose || 'Expense'}${ex.notes ? ` · ${ex.notes}` : ''}`
      });
    }
  }

  return records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function renderProductSalesReport() {
  const allOrders = typeof salesOrderRows === 'function' ? salesOrderRows() : (state.orders || []);
  const validOrders = allOrders.filter(o => o.status !== 'Draft' && o.status !== 'Cancelled');

  const productStats = state.products.map(product => {
    let unitsSold = 0;
    let revenue = 0;
    let orderCount = 0;
    for (const order of validOrders) {
      const items = order.items || [];
      const matchLines = items.filter(line => line.productId === product.id || line.product === product.name);
      if (matchLines.length > 0) {
        orderCount++;
        for (const line of matchLines) {
          const qty = Number(line.qty || 0);
          const price = Number(line.unitPrice || product.price || 0);
          unitsSold += qty;
          revenue += qty * price;
        }
      }
    }
    const cogs = unitsSold * Number(product.cost || 0);
    const grossProfit = revenue - cogs;
    const margin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0.0';
    const avgPrice = unitsSold > 0 ? Math.round(revenue / unitsSold) : product.price;

    return {
      product,
      unitsSold,
      revenue,
      cogs,
      grossProfit,
      margin,
      avgPrice,
      orderCount
    };
  });

  const query = reportSearchQuery.toLowerCase();
  const filtered = productStats.filter(stat => {
    if (query && !`${stat.product.id} ${stat.product.name} ${stat.product.category || ''} ${stat.product.sku || ''}`.toLowerCase().includes(query)) return false;
    return true;
  });

  const totalUnits = productStats.reduce((sum, s) => sum + s.unitsSold, 0);
  const totalRevenue = productStats.reduce((sum, s) => sum + s.revenue, 0);
  const totalProfit = productStats.reduce((sum, s) => sum + s.grossProfit, 0);
  const activeSellers = productStats.filter(s => s.unitsSold > 0).length;

  return `
    <section class="summary-strip">
      <div class="summary-mini"><small>Total Units Sold</small><strong>${totalUnits.toLocaleString()} units</strong></div>
      <div class="summary-mini"><small>Total Product Revenue</small><strong>${money(totalRevenue)}</strong></div>
      <div class="summary-mini"><small>Total Gross Profit</small><strong style="color:#16a34a">${money(totalProfit)}</strong></div>
      <div class="summary-mini"><small>Products with Sales</small><strong>${activeSellers} of ${state.products.length}</strong></div>
    </section>

    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="report-search" placeholder="Search product name, SKU, category…" value="${esc(reportSearchQuery)}"></label>
        </div>
        <span class="muted" style="font-size:11px">${filtered.length} of ${productStats.length} products</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>In Stock</th>
              <th>Units Sold</th>
              <th>Avg Sell Price</th>
              <th>Total Revenue</th>
              <th>COGS</th>
              <th>Gross Profit</th>
              <th>Margin</th>
              <th>Drilldown</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length ? filtered.map(stat => `
              <tr>
                <td><strong>${esc(stat.product.name)}</strong><br><small class="muted">SKU: ${esc(stat.product.sku || stat.product.id)}</small></td>
                <td><small>${esc(stat.product.category || 'General')}</small></td>
                <td><strong>${stat.product.stock}</strong></td>
                <td><strong style="color:${stat.unitsSold > 0 ? '#16a34a' : 'inherit'}">${stat.unitsSold.toLocaleString()}</strong></td>
                <td>${money(stat.avgPrice)}</td>
                <td><strong>${money(stat.revenue)}</strong></td>
                <td>${money(stat.cogs)}</td>
                <td><strong style="color:${stat.grossProfit >= 0 ? '#16a34a' : '#ef233c'}">${money(stat.grossProfit)}</strong></td>
                <td><span class="stocktake-diff-pill ${Number(stat.margin) >= 20 ? 'match' : Number(stat.margin) > 0 ? 'surplus' : 'shortage'}">${stat.margin}%</span></td>
                <td>
                  <button type="button" class="button small" data-action="view-product-sales-history" data-id="${esc(stat.product.id)}">
                    📋 Orders (${stat.orderCount})
                  </button>
                </td>
              </tr>
            `).join('') : emptyRow(10, 'No products found matching search.')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderProductPurchasesReport() {
  const purchases = (state.purchases || []).filter(p => p.status !== 'Draft' && p.status !== 'Cancelled');

  const productStats = state.products.map(product => {
    let unitsPurchased = 0;
    let spend = 0;
    let poCount = 0;
    const suppliers = new Set();

    for (const po of purchases) {
      const lines = po.lines || po.items || [];
      const matchLines = lines.filter(line => line.productId === product.id || line.product === product.name);
      if (matchLines.length > 0) {
        poCount++;
        if (po.supplier) suppliers.add(po.supplier);
        for (const line of matchLines) {
          const qty = Number(line.qty || 0);
          const cost = Number(line.unitCost || product.cost || 0);
          unitsPurchased += qty;
          spend += qty * cost;
        }
      }
    }
    const avgCost = unitsPurchased > 0 ? Math.round(spend / unitsPurchased) : product.cost;

    return {
      product,
      unitsPurchased,
      spend,
      poCount,
      suppliers: [...suppliers],
      avgCost
    };
  });

  const query = reportSearchQuery.toLowerCase();
  const filtered = productStats.filter(stat => {
    if (query && !`${stat.product.id} ${stat.product.name} ${stat.suppliers.join(' ')} ${stat.product.category || ''}`.toLowerCase().includes(query)) return false;
    return true;
  });

  const totalRestocked = productStats.reduce((sum, s) => sum + s.unitsPurchased, 0);
  const totalSpend = productStats.reduce((sum, s) => sum + s.spend, 0);
  const activeRestocked = productStats.filter(s => s.unitsPurchased > 0).length;

  return `
    <section class="summary-strip">
      <div class="summary-mini"><small>Total Units Restocked</small><strong>${totalRestocked.toLocaleString()} units</strong></div>
      <div class="summary-mini"><small>Total Restock Spend</small><strong>${money(totalSpend)}</strong></div>
      <div class="summary-mini"><small>Products Restocked</small><strong>${activeRestocked} of ${state.products.length}</strong></div>
      <div class="summary-mini"><small>Total Purchase Orders</small><strong>${purchases.length}</strong></div>
    </section>

    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="report-search" placeholder="Search product name, SKU, supplier…" value="${esc(reportSearchQuery)}"></label>
        </div>
        <span class="muted" style="font-size:11px">${filtered.length} of ${productStats.length} products</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Current Stock</th>
              <th>Units Purchased</th>
              <th>Avg Purchase Cost</th>
              <th>Total Spend</th>
              <th>Suppliers</th>
              <th>Drilldown</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length ? filtered.map(stat => `
              <tr>
                <td><strong>${esc(stat.product.name)}</strong><br><small class="muted">SKU: ${esc(stat.product.sku || stat.product.id)}</small></td>
                <td><strong>${stat.product.stock}</strong></td>
                <td><strong style="color:${stat.unitsPurchased > 0 ? '#0077f6' : 'inherit'}">${stat.unitsPurchased.toLocaleString()}</strong></td>
                <td>${money(stat.avgCost)}</td>
                <td><strong>${money(stat.spend)}</strong></td>
                <td>${stat.suppliers.length ? stat.suppliers.map(s => `<span class="status-pill status-ready" style="font-size:10px">${esc(s)}</span>`).join(' ') : '<span class="muted">—</span>'}</td>
                <td>
                  <button type="button" class="button small" data-action="view-product-purchase-history" data-id="${esc(stat.product.id)}">
                    📦 Orders (${stat.poCount})
                  </button>
                </td>
              </tr>
            `).join('') : emptyRow(7, 'No products found matching search.')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPaymentReport() {
  const records = collectAllPaymentRecords();
  const query = reportSearchQuery.toLowerCase();

  const filtered = records.filter(r => {
    if (reportPaymentDirectionFilter === 'inflow' && r.direction !== 'INFLOW') return false;
    if (reportPaymentDirectionFilter === 'outflow' && r.direction !== 'OUTFLOW') return false;
    if (reportPaymentMethodFilter && !r.method.toLowerCase().includes(reportPaymentMethodFilter.toLowerCase())) return false;
    if (query && !`${r.party} ${r.sourceId} ${r.memo} ${r.method}`.toLowerCase().includes(query)) return false;
    return true;
  });

  const totalInflows = records.filter(r => r.direction === 'INFLOW').reduce((sum, r) => sum + r.amount, 0);
  const totalOutflows = records.filter(r => r.direction === 'OUTFLOW').reduce((sum, r) => sum + r.amount, 0);
  const netCash = totalInflows - totalOutflows;

  return `
    <section class="summary-strip">
      <div class="summary-mini"><small>Total Inflows (Received from Customers)</small><strong style="color:#16a34a">${money(totalInflows)}</strong></div>
      <div class="summary-mini"><small>Total Outflows (Paid to Suppliers)</small><strong style="color:#ef233c">${money(totalOutflows)}</strong></div>
      <div class="summary-mini"><small>Net Cash Movement</small><strong style="color:${netCash >= 0 ? '#16a34a' : '#ef233c'}">${netCash < 0 ? '− ' : ''}${money(Math.abs(netCash))}</strong></div>
      <div class="summary-mini"><small>Total Transactions</small><strong>${records.length}</strong></div>
    </section>

    <section class="table-panel">
      <div class="toolbar">
        <div class="toolbar-left">
          <label class="search-box"><input id="report-search" placeholder="Search customer, supplier, reference, memo…" value="${esc(reportSearchQuery)}"></label>
          <select class="select-control" id="report-payment-direction">
            <option value="" ${!reportPaymentDirectionFilter ? 'selected' : ''}>All Payments (In &amp; Out)</option>
            <option value="inflow" ${reportPaymentDirectionFilter === 'inflow' ? 'selected' : ''}>↓ Received from Customers</option>
            <option value="outflow" ${reportPaymentDirectionFilter === 'outflow' ? 'selected' : ''}>↑ Paid to Suppliers</option>
          </select>
          <select class="select-control" id="report-payment-method">
            <option value="" ${!reportPaymentMethodFilter ? 'selected' : ''}>All Methods</option>
            <option value="cash" ${reportPaymentMethodFilter === 'cash' ? 'selected' : ''}>Cash</option>
            <option value="mobile" ${reportPaymentMethodFilter === 'mobile' ? 'selected' : ''}>Mobile Money</option>
            <option value="bank" ${reportPaymentMethodFilter === 'bank' ? 'selected' : ''}>Bank Transfer</option>
            <option value="card" ${reportPaymentMethodFilter === 'card' ? 'selected' : ''}>Card</option>
          </select>
        </div>
        <span class="muted" style="font-size:11px">${filtered.length} of ${records.length} payments</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Direction</th>
              <th>Party ("Made to" / "Received from")</th>
              <th>Amount</th>
              <th>Payment Method</th>
              <th>Reference / Source</th>
              <th>Memo / Notes</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length ? filtered.map(r => {
    const isInflow = r.direction === 'INFLOW';
    return `
                <tr>
                  <td><strong>${dateLabel(r.date)}</strong></td>
                  <td>
                    <span class="stocktake-diff-pill ${isInflow ? 'match' : 'shortage'}">
                      ${isInflow ? '↓ Received' : '↑ Paid out'}
                    </span>
                  </td>
                  <td>
                    <strong>${esc(r.party)}</strong>
                    <br><small class="muted">${isInflow ? 'Customer (Received from)' : 'Supplier (Paid to)'}</small>
                  </td>
                  <td>
                    <strong style="color:${isInflow ? '#16a34a' : '#ef233c'}">
                      ${isInflow ? '+' : '−'} ${money(r.amount)}
                    </strong>
                  </td>
                  <td><span class="status-pill status-ready">${esc(r.method)}</span></td>
                  <td><strong>${esc(r.sourceId)}</strong><br><small class="muted">${esc(r.sourceType)}</small></td>
                  <td><small>${esc(r.memo)}</small></td>
                </tr>
              `;
  }).join('') : emptyRow(7, 'No payment records found matching criteria.')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderReports() {
  const tabs = [
    { id: 'overview', icon: '📊', label: 'Financial Overview' },
    { id: 'product-sales', icon: '📦', label: 'Product Sales Report' },
    { id: 'product-purchases', icon: '🚚', label: 'Product Purchases Report' },
    { id: 'payments', icon: '💳', label: 'Payment Reports' }
  ];

  const navHtml = `
    <div class="report-nav-tabs">
      ${tabs.map(t => `
        <button type="button" class="report-nav-tab ${reportActiveTab === t.id ? 'active' : ''}" data-action="set-report-tab" data-tab="${t.id}">
          <span>${t.icon}</span> ${t.label}
        </button>
      `).join('')}
    </div>
  `;

  if (reportActiveTab === 'product-sales') {
    return `
      ${heading('Reports', 'Detailed sales, purchases, and payments reporting.', `
        <button class="button" data-action="export-product-sales">↓ Export Sales CSV</button>
      `)}
      ${navHtml}
      ${renderProductSalesReport()}
    `;
  }

  if (reportActiveTab === 'product-purchases') {
    return `
      ${heading('Reports', 'Detailed sales, purchases, and payments reporting.', `
        <button class="button" data-action="export-product-purchases">↓ Export Purchases CSV</button>
      `)}
      ${navHtml}
      ${renderProductPurchasesReport()}
    `;
  }

  if (reportActiveTab === 'payments') {
    return `
      ${heading('Reports', 'Detailed sales, purchases, and payments reporting.', `
        <button class="button" data-action="export-payment-report">↓ Export Payments CSV</button>
      `)}
      ${navHtml}
      ${renderPaymentReport()}
    `;
  }

  // Default: Overview
  const data = reportPeriodData();
  const paymentGroups = new Map();
  data.sales.forEach(sale => { const method = sale.method || 'Other'; paymentGroups.set(method, (paymentGroups.get(method) || 0) + (Number(sale.total) || 0)); });
  const revenueMix = [['Sales revenue', data.salesTotal], ['Purchase orders', data.purchaseTotal]];
  const receivable = accountOutstandingTotal('Customer');
  const payable = accountOutstandingTotal('Supplier');
  const periodLabel = reportPeriod === 'weekly' ? 'Weekly' : reportPeriod === 'annual' ? 'Annual' : 'Monthly';

  return `
    ${heading('Financial Reports', 'Visual financial summaries with weekly, monthly, and annual reporting periods.', `<button class="button" data-action="export-financial-report">↓ Export ${periodLabel.toLowerCase()} report</button>`)}
    ${navHtml}
    <div class="report-period-toolbar"><div><span class="report-period-label">Report period</span><div class="report-period-tabs">${[['weekly', 'Weekly'], ['monthly', 'Monthly'], ['annual', 'Annual']].map(([key, label]) => `<button type="button" class="report-period-tab ${reportPeriod === key ? 'active' : ''}" data-action="set-report-period" data-period="${key}">${label}</button>`).join('')}</div></div><p>${esc(data.label)} · ${dateLabel(data.start)} – ${dateLabel(data.end)}</p></div>
    <section class="metric-grid report-metrics">${metric('Sales revenue', money(data.salesTotal), '↗', `${periodLabel} · ${data.sales.length} transactions`)}${metric('Purchases', money(data.purchaseTotal), '▤', `${periodLabel} · ${data.purchases.length} orders`)}${metric('Net cash movement', `${data.netCollected < 0 ? '− ' : ''}${money(data.netCollected)}`, '⇄', `Collected less paid · ${periodLabel}`, data.netCollected < 0 ? 'down' : 'up')}${metric('Open receivables', money(receivable), '◷', 'All customer accounts')}</section>
    <section class="panel financial-chart-panel"><div class="panel-header"><div><h2 class="panel-title">Sales and purchases</h2><p class="panel-subtitle">${esc(periodLabel)} comparison by ${reportPeriod === 'weekly' ? 'day' : reportPeriod === 'annual' ? 'month' : 'week'}.</p></div><div class="report-chart-legend"><span><i style="background:#087f9d"></i>Sales</span><span><i style="background:#ff8c42"></i>Purchases</span></div></div>${renderFinancialBarChart(data)}</section>
    <section class="report-pie-grid">${reportPieCard('Sales by payment method', `${periodLabel} sales value`, [...paymentGroups], 'Sales')}${reportPieCard('Revenue and purchases', `${periodLabel} transaction mix`, revenueMix, 'Total value')}</section>
    <section class="table-panel financial-summary-table"><div class="table-heading"><div><h2>Financial summary</h2><p class="panel-subtitle">${esc(data.label)} and current account balances.</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Measure</th><th>Amount</th><th>Basis</th></tr></thead><tbody><tr><td><strong>Sales revenue</strong></td><td>${money(data.salesTotal)}</td><td>${periodLabel} transactions</td></tr><tr><td><strong>Cost of goods sold (COGS)</strong></td><td>${money(data.cogsTotal)}</td><td>${periodLabel} inventory cost</td></tr><tr><td><strong>Gross profit</strong></td><td>${money(data.grossProfit)}</td><td>Revenue less COGS</td></tr><tr><td><strong>Customer payments collected</strong></td><td>${money(data.collected)}</td><td>${periodLabel} receipts</td></tr><tr><td><strong>Purchases ordered</strong></td><td>${money(data.purchaseTotal)}</td><td>${periodLabel} purchase orders</td></tr><tr><td><strong>Supplier payments made</strong></td><td>${money(data.supplierPaid)}</td><td>${periodLabel} payments</td></tr><tr><td><strong>Supplier payables</strong></td><td>${money(payable)}</td><td>Current balance</td></tr></tbody></table></div></section>
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
            <div class="field full"><label for="company-name">Business name</label><input id="company-name" name="company-name" value="${esc(state.companyName || '')}" placeholder="e.g. My Company" required></div>
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

        <div class="settings-section">
          <h2>Security &amp; Auto-Lock Timer</h2>
          <div class="form-grid">
            <div class="field">
              <label for="setting-autolock-minutes">Automatically lock screen after inactivity</label>
              <select id="setting-autolock-minutes" name="setting-autolock-minutes">
                ${[5, 10, 15, 20, 30, 60, 0].map(m => {
                  const cur = getAutoLockMinutes();
                  const label = m === 0 ? 'Disabled (Never auto-lock)' : m === 20 ? '20 minutes (Recommended)' : `${m} minutes`;
                  return `<option value="${m}" ${cur === m ? 'selected' : ''}>${label}</option>`;
                }).join('')}
              </select>
              <small class="field-hint">Protects your workspace when unattended on PC or mobile. Your open screen and POS cart are preserved until you unlock.</small>
            </div>
            <div class="field" style="display:flex;align-items:flex-end">
              <button type="button" class="button" data-action="lock-screen">🔒 Lock Screen Now</button>
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
  const autoLockField = form.querySelector('[name="setting-autolock-minutes"]');
  if (autoLockField) {
    const parsedLock = Number(autoLockField.value);
    state.autoLockMinutes = Number.isFinite(parsedLock) && parsedLock >= 0 ? parsedLock : DEFAULT_AUTO_LOCK_MINUTES;
    lastActivityAt = Date.now();
    safeSessionSet(LAST_ACTIVITY_KEY, String(lastActivityAt));
    updateLockCountdownUI();
  }
  saveState();
  refreshCompanyLogo();
  render();
  toast('Company settings and tax preferences saved');
}

// Master Render Function
function render() {
  if (!state.currentUserId) { renderAuthGate(authErrorMessage); return; }
  ageFinalOrders();
  reconcileCustomerAccountPayments();

  const content = document.getElementById('page-content');
  const user = currentWorkspaceUser();
  if (!user.isBootstrap && !canViewPage(page, user)) {
    const fallback = Object.keys(pageLabels).find(candidate => canViewPage(candidate, user));
    if (fallback) { page = fallback; history.replaceState({ erpPage: page }, '', `#${page}`); }
    else { content.innerHTML = '<section class="panel access-denied-panel"><h2>No sections are enabled for your account</h2><p>Ask an Owner / Administrator to grant access.</p></section>'; refreshCompanyLogo(); refreshUserProfile(); refreshPermissionVisibility(); refreshActivityVisibility(); refreshBranchNav(); refreshBranchSwitcher(); refreshNotificationIndicator(); updateConnection(); syncBackButton(); return; }
  }
  const crumb = document.getElementById('crumb-current');
  if (crumb) crumb.textContent = pageLabels[page] || 'Home';
  document.body.classList.toggle('page-is-home', page === 'home');

  try {
    const pageRenderers = {
      home: renderHome,
      dashboard: renderDashboard,
      sales: renderSales,
      pos: renderPOS,
      products: renderProductManagement,
      inventory: renderInventoryManagement,
      purchases: renderPurchases,
      expenses: renderExpenses,
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
  refreshBranchSwitcher();
  refreshNotificationIndicator();
  updateConnection();
  syncBackButton();
}

// Action Dispatcher
function openDialog(kind, title, subtitle, content, confirmLabel = 'Save') {
  openModal(title, subtitle, `<input type="hidden" name="dialog-kind" value="${esc(kind)}">${content}`, confirmLabel);
  document.getElementById('modal-content').dataset.dialogKind = kind;
}

function handleRemoteCloudSync(remoteFields, deviceName, changedModules = []) {
  if (!remoteFields || typeof remoteFields !== 'object') return;
  const curId = state.currentUserId;
  const curBranchId = state.activeBranchId;
  const curProducts = Array.isArray(state.products) ? state.products : [];

  const updated = { ...state };
  for (const [key, value] of Object.entries(remoteFields)) {
    if (key === 'products' || key === 'currentUserId') continue;
    updated[key] = value;
  }

  const sanitized = sanitizeState(updated, initialState);
  sanitized.products = curProducts; // Products stay synchronized via the dedicated 'products' collection
  sanitized.currentUserId = curId;

  // Keep this device on its active branch if it still exists
  if (curBranchId && (sanitized.branches || []).some(b => b.id === curBranchId)) {
    sanitized.activeBranchId = curBranchId;
    activeBranch = sanitized.branches.find(b => b.id === curBranchId) || activeBranch;
    sanitized.branch = activeBranch?.name || sanitized.branch;
  } else if (sanitized.branches?.length) {
    activeBranch = sanitized.branches[0];
    sanitized.activeBranchId = activeBranch.id;
    sanitized.branch = activeBranch.name;
  }

  state = sanitized;
  persistState(state);
  refreshBranchSwitcher();
  refreshNotificationIndicator();
  updateConnection();
  render();

  const label = changedModules.length ? changedModules.join(', ').replace(/_/g, ' ') : 'ERP data';
  toast(`☁️ Live update from ${deviceName || 'another device'} (${label})`);
}

function openCloudSyncDialog() {
  const currentConfig = typeof getStoredFirebaseConfig === 'function' ? getStoredFirebaseConfig() : null;
  const configJson = currentConfig ? JSON.stringify(currentConfig, null, 2) : '';
  const content = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="inline-note" style="line-height:1.45;font-size:11.5px">
        <strong>Automatic Multi-Device Synchronization (PC ⇄ Phone)</strong><br>
        Connect your free Google Firebase Firestore database below so changes made on your PC (new products, sales, purchases, payments) are automatically visible on your phone in real time.
      </div>
      <div class="field">
        <label for="firebase-config-text">Firebase Web Configuration</label>
        <textarea id="firebase-config-text" name="firebase-config-text" rows="7" style="font-family:monospace;font-size:10.5px" placeholder='{\n  "apiKey": "AIzaSy...",\n  "authDomain": "myproject.firebaseapp.com",\n  "projectId": "myproject",\n  "storageBucket": "myproject.appspot.com",\n  "messagingSenderId": "...",\n  "appId": "..."\n}'>${esc(configJson)}</textarea>
        <small class="field-hint">Copy from Firebase Console: <strong>Project Settings > General > Your apps (Web) > firebaseConfig</strong></small>
      </div>
      <div class="field">
        <label for="firebase-workspace-id">Shared Sync Channel (Company ID)</label>
        <input type="text" id="firebase-workspace-id" name="firebase-workspace-id" value="${esc(state.companyName ? state.companyName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() : 'main-workspace')}" placeholder="e.g. my_company">
        <small class="field-hint">Must be identical on both PC and phone to connect to the same workspace.</small>
      </div>
    </div>
  `;
  openDialog('cloud-sync', 'Connect Live Cloud Database', 'Real-time multi-device sync with Google Firebase.', content, 'Save & Connect Cloud');
}

function openProductForm(product = null) {
  const p = product || { name: '', id: '', category: 'General', price: 0, cost: 0, stock: 0, low: 5, unit: 'Piece', status: 'Active', expiryDate: '', batchNumber: '' };
  const content = `<div class="form-grid">
    ${inputField('product-name', 'Product name', 'e.g. Maize flour', 'text', true, p.name)}
    ${inputField('product-sku', 'SKU / code', 'Leave blank to generate', 'text', false, p.id)}
    ${inputField('product-category', 'Category', 'e.g. Grocery', 'text', true, p.category)}
    ${inputField('product-price', 'Selling price (TZS)', '', 'number', true, p.price)}
    ${inputField('product-cost', 'Unit cost (TZS)', '', 'number', true, p.cost)}
    ${inputField('product-stock', 'Opening stock', '', 'number', true, p.stock)}
    ${inputField('product-low', 'Low stock alert at', '', 'number', false, p.low)}
    ${selectField('product-unit', 'Unit', state.measurementUnits, p.unit)}
    ${inputField('product-expiry', 'Expiry date (optional)', '', 'date', false, p.expiryDate || '')}
    ${inputField('product-batch', 'Batch / Lot # (optional)', 'e.g. BATCH-2026-01', 'text', false, p.batchNumber || '')}
  </div>`;
  openDialog(product ? 'edit-product' : 'new-product', product ? 'Edit product' : 'Add a product', 'Set the product details, price, on-hand quantity, and shelf-life.', content, product ? 'Save changes' : 'Add product');
  document.getElementById('modal-content').dataset.recordId = product?.id || '';
}

function openPartyForm(type, existing = null) {
  const label = type === 'Supplier' ? 'supplier' : 'customer';
  const fields = `${inputField('party-name', 'Name', '', 'text', true, existing?.name || '')}${inputField('party-phone', 'Phone number', '', 'tel', false, existing?.phone || '')}${inputField('party-email', 'Email address', '', 'email', false, existing?.email || '')}${inputField('party-terms', 'Payment terms', 'e.g. 14 days', 'text', false, existing?.terms || 'Due on receipt')}${type === 'Customer' ? inputField('party-credit-limit', 'Credit limit (TZS)', '0', 'number', false, existing?.creditLimit || 0) : ''}`;
  openDialog(existing ? 'edit-party' : 'new-party', `${existing ? 'Edit' : 'Add'} ${label}`, `${existing ? 'Update' : 'Create'} a ${label} account for sales and payments.`, `<input type="hidden" name="party-type" value="${type}"><div class="form-grid">${fields}</div>`);
  if (existing) document.getElementById('modal-content').dataset.partyName = existing.name;
}

function openCustomerOrderHistory(name) {
  if (!userHasPermission('customers', 'order-history')) { toast('You do not have permission to view customer order history'); return; }
  const orders = state.orders.filter(order => order.customer === name && order.status !== 'Draft').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const rows = orders.map(order => `<tr><td><strong>${esc(order.id)}</strong></td><td>${dateLabel(order.date)}</td><td>${money(order.total)}</td><td>${esc(order.status)}</td><td>${orderPaymentStatus(order)}</td></tr>`).join('') || emptyRow(5, 'No past orders for this customer');
  openModal(`${esc(name)} · Past orders`, `${orders.length} saved order${orders.length === 1 ? '' : 's'}`, `<div class="table-scroll"><table class="data-table"><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>${rows}</tbody></table></div>`, 'Close');
}

function openSupplierOrderHistory(name) {
  if (!userHasPermission('suppliers', 'order-history')) { toast('You do not have permission to view supplier purchase history'); return; }
  const purchases = state.purchases.filter(purchase => purchase.supplier === name).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const rows = purchases.map(purchase => `<tr><td><strong>${esc(purchase.id)}</strong></td><td>${dateLabel(purchase.date)}</td><td>${money(purchase.total)}</td><td>${purchase.paid >= purchase.total ? 'Paid' : purchase.paid > 0 ? 'Part paid' : 'Due'}</td><td>${esc(purchase.status || 'Pending')}</td></tr>`).join('') || emptyRow(5, 'No past purchase orders for this supplier');
  openModal(`${esc(name)} · Past purchase orders`, `${purchases.length} saved purchase order${purchases.length === 1 ? '' : 's'}`, `<div class="table-scroll"><table class="data-table"><thead><tr><th>Purchase order</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`, 'Close');
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
    : `${selectField('payment-party-type', 'Account type', ['Customer', 'Supplier'], partyType || 'Customer')}${selectField('payment-party', 'Account', partyOptions, partyName || partyOptions[0])}`;
  const content = `${accountFields}<div class="form-grid">${inputField('payment-amount', 'Amount (TZS)', '', 'number', true)}${selectField('payment-method', 'Method', ['Cash', 'M-Pesa', 'Bank transfer', 'Card'])}${inputField('payment-date', 'Date', '', 'date', true, today())}${inputField('payment-memo', 'Note', 'Optional reference')}</div>${renderAttachmentUploader([], 'record-payment')}`;
  openDialog('record-payment', 'Record payment', 'Record money received from a customer or paid to a supplier.', content);
}

function openAccountLedger(partyType, partyName) {
  const account = (partyType === 'Supplier' ? state.suppliers : state.customers).find(item => item.name === partyName);
  if (!account) return;
  const entries = state.entries.filter(entry => entry.partyType === partyType && entry.party === partyName).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const rows = entries.map(entry => {
    const hasAtts = Array.isArray(entry.attachments) && entry.attachments.length > 0;
    const attBtn = hasAtts ? ` <button type="button" class="status-pill status-attachment" data-action="view-entry-attachments" data-id="${esc(entry.id)}" style="cursor:pointer;margin-left:6px" title="View ${entry.attachments.length} attachment(s)">📎 ${entry.attachments.length}</button>` : '';
    return `<tr><td>${dateLabel(entry.date)}</td><td><span class="ledger-direction ${String(entry.type).toLowerCase()}">${esc(entry.type)}</span></td><td><strong>${money(entry.amount)}</strong></td><td>${esc(entry.memo || '—')}${attBtn}</td><td><small>${esc(entry.id)}</small></td></tr>`;
  }).join('') || emptyRow(5, 'No transactions recorded for this account yet');
  const signed = Number(account.balance) || 0, amount = Math.abs(signed), label = partyType === 'Customer' ? (signed < 0 ? 'Customer credit' : 'Receivable') : (signed < 0 ? 'Payable' : 'Supplier credit');
  openModal(`${esc(partyName)} · ${partyType} ledger`, `${esc(account.id)} · ${entries.length} transaction${entries.length === 1 ? '' : 's'}`, `<div class="account-balance-card"><small>Current ${label.toLowerCase()}</small><strong>${money(amount)}</strong><span>${esc(account.phone || account.email || 'Account balance')}</span></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>Memo</th><th>Reference</th></tr></thead><tbody>${rows}</tbody></table></div>`, `Close`, `<button type="button" class="button" data-action="record-payment" data-party-type="${esc(partyType)}" data-party-name="${esc(partyName)}">Add payment</button><button type="button" class="button" data-action="reconcile-account" data-party-type="${esc(partyType)}" data-party-name="${esc(partyName)}">Reconcile</button>`);
}

function openAccountReconcile(partyType, partyName) {
  const account = (partyType === 'Supplier' ? state.suppliers : state.customers).find(item => item.name === partyName);
  if (!account) return;
  const current = partyType === 'Customer' ? Math.max(0, Number(account.balance) || 0) : Math.max(0, -(Number(account.balance) || 0));
  const label = partyType === 'Customer' ? 'Expected receivable balance' : 'Expected supplier payable';
  openDialog('account-reconcile', `Reconcile ${partyName}`, `Enter the balance confirmed for this ${partyType.toLowerCase()} account. The difference will be recorded only on this account.`, `${inputField('reconcile-balance', `${label} (TZS)`, '', 'number', true, current)}${inputField('reconcile-date', 'Reconciliation date', '', 'date', true, today())}${inputField('reconcile-note', 'Reference / note', 'e.g. Statement closing balance')}`, 'Reconcile account');
  const form = document.getElementById('modal-content'); form.dataset.partyType = partyType; form.dataset.partyName = partyName;
}

function openOrderForm(existing = null) {
  const products = activeProducts();
  if (!products.length && !existing) { toast('Add an active product to Inventory before creating a sales order'); return; }
  const names = [...new Set([...state.customers.filter(c => c.status !== 'Inactive').map(c => c.name), ...(existing?.customer ? [existing.customer] : [])])];
  const initialMethod = existing?.paymentMethod || existing?.posMethod || 'Cash';
  const content = `<div class="form-grid">${selectField('order-customer', 'Customer', ['Walk-in customer', ...names], existing?.customer || 'Walk-in customer')}${inputField('order-date', 'Order date', '', 'date', true, existing?.date || today())}${selectField('order-method', 'Payment method', salesPaymentMethods, initialMethod)}</div><div class="transaction-lines" id="order-product-lines"></div>${transactionProductPicker('order')}${transactionPaymentSummary('order')}${renderAttachmentUploader(existing?.attachments || [], 'order')}`;
  openDialog(existing ? 'edit-order' : 'new-order', existing ? `${existing.source === 'POS' ? 'Edit POS sale' : 'Edit sales order'}` : 'Create sales order', existing ? `Update ${esc(existing.id)}. Finalized sales update inventory and the customer account.` : 'Choose the customer, order date, and payment method, then search to add products. The order will be saved as a draft.', content, existing ? 'Save changes' : 'Save draft');
  const form = document.getElementById('modal-content');
  if (existing) {
    form.dataset.recordId = existing.id;
    document.getElementById('order-discount').value = existing.discount || 0;
    document.getElementById('order-additional').value = existing.additionalCharges || 0;
    document.getElementById('order-paid').value = existing.paid || 0;
    const methodEl = document.getElementById('order-method');
    if (methodEl) methodEl.value = initialMethod;
    seedTransactionLineValues('order', existing.items || [], 'unitPrice');
  }
}

function openPurchaseForm(existing = null) {
  const products = activeProducts();
  const activeSuppliers = state.suppliers.filter(supplier => supplier.status !== 'Inactive');
  if ((!products.length || !activeSuppliers.length) && !existing) { toast('Add an active product and supplier before creating a purchase order'); return; }
  const supplierNames = [...new Set([...activeSuppliers.map(p => p.name), ...(existing?.supplier ? [existing.supplier] : [])])];
  const content = `<div class="form-grid">${selectField('purchase-supplier', 'Supplier', supplierNames, existing?.supplier || supplierNames[0])}${inputField('purchase-date', 'Order date', '', 'date', true, existing?.date || today())}</div><div class="transaction-lines" id="purchase-product-lines"></div>${transactionProductPicker('purchase')}${transactionPaymentSummary('purchase')}${renderAttachmentUploader(existing?.attachments || [], 'purchase')}`;
  openDialog(existing ? 'edit-purchase' : 'new-purchase', 'Purchase order', existing ? `Update ${esc(existing.id)}. Received purchases adjust stock and the supplier account.` : 'Choose the supplier and date, then search to add as many products as needed. Receive the order to update stock.', content, existing ? 'Save changes' : 'Save purchase order');
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

function openExpenseForm(existing = null) {
  const isPaid = existing ? Boolean(existing.paid) : true;
  const expDate = existing?.date || today();
  const payDate = existing?.paymentDate || (isPaid ? expDate : today());
  const payMethod = existing?.paymentMethod || 'Cash';

  const pastPayees = [...new Set([
    ...(state.expenses || []).map(e => e.forWhom).filter(Boolean),
    ...(state.suppliers || []).map(s => s.name).filter(Boolean),
    ...(state.users || []).map(u => u.name).filter(Boolean)
  ])];
  const commonPurposes = [...new Set([
    'Rent', 'Electricity & Utilities', 'Transport & Fuel', 'Staff Allowance / Meals',
    'Maintenance & Repairs', 'Internet & Airtime', 'Office Supplies', 'Delivery & Logistics',
    'Taxes & Licenses', 'Cleaning & Security', 'Marketing', 'Miscellaneous',
    ...(state.expenses || []).map(e => e.purpose).filter(Boolean)
  ])];

  const payeeListHtml = `<datalist id="expense-payee-list">${pastPayees.map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  const purposeListHtml = `<datalist id="expense-purpose-list">${commonPurposes.map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;

  const content = `
    ${payeeListHtml}${purposeListHtml}
    <div class="form-grid">
      <div class="field">
        <label for="expense-date">Expense Date *</label>
        <input id="expense-date" name="expense-date" type="date" value="${esc(expDate)}" required>
      </div>
      <div class="field">
        <label for="expense-amount">Amount (${esc(state.currency || 'TZS')}) *</label>
        <input id="expense-amount" name="expense-amount" type="number" min="1" step="any" placeholder="e.g. 50000" value="${existing ? esc(existing.amount) : ''}" required>
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <label for="expense-for-whom">Expense For Whom *</label>
        <input id="expense-for-whom" name="expense-for-whom" type="text" list="expense-payee-list" placeholder="e.g. TANESCO, Juma Driver, Landlord" value="${esc(existing?.forWhom || '')}" required autocomplete="off">
      </div>
      <div class="field">
        <label for="expense-purpose">For What Purpose *</label>
        <input id="expense-purpose" name="expense-purpose" type="text" list="expense-purpose-list" placeholder="e.g. Electricity bill, Fuel, Rent" value="${esc(existing?.purpose || '')}" required autocomplete="off">
      </div>
    </div>
    <div class="field">
      <label for="expense-notes">Expense Notes (optional)</label>
      <textarea id="expense-notes" name="expense-notes" rows="2" placeholder="Add receipt number, extra context, or remarks…">${esc(existing?.notes || '')}</textarea>
    </div>
    <div class="expense-paid-card">
      <label class="expense-paid-toggle" for="expense-paid-checkbox">
        <input id="expense-paid-checkbox" name="expense-paid" type="checkbox" ${isPaid ? 'checked' : ''}>
        <span>This expense has been paid</span>
      </label>
      <div class="expense-payment-fields" id="expense-payment-fields" ${isPaid ? '' : 'hidden'}>
        <div class="field">
          <label for="expense-payment-date">Date of Payment *</label>
          <input id="expense-payment-date" name="expense-payment-date" type="date" value="${esc(payDate)}" ${isPaid ? 'required' : ''}>
        </div>
        ${selectField('expense-payment-method', 'Payment Method', ['Cash', 'M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Bank transfer', 'Card', 'Cheque'], payMethod)}
      </div>
    </div>
    ${renderAttachmentUploader(existing?.attachments || [], 'expense')}
  `;

  openDialog(
    'save-expense',
    existing ? `Edit Expense · ${existing.id}` : 'Record Expense (Fast Entry)',
    existing ? 'Update expense details, payment status, or receipt attachments.' : 'Log business expenses quickly with optional receipt or document attachments.',
    content,
    existing ? 'Save Changes' : 'Save Expense'
  );
  const form = document.getElementById('modal-content');
  if (form) {
    if (existing) form.dataset.recordId = existing.id;
    else delete form.dataset.recordId;
  }
  setTimeout(() => document.getElementById('expense-for-whom')?.focus(), 40);
}

function openExpenseDetail(expense) {
  if (!expense) return;
  const isPaid = Boolean(expense.paid);
  const attsHTML = renderAttachmentsGallery(expense.attachments || [], { scope: 'expense', recordId: expense.id, canAdd: true });
  const content = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:var(--bg-subtle, #f8fafc);padding:12px 14px;border-radius:10px;border:1px solid var(--line, #e2e8f0);display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px">
        <div><small class="muted" style="display:block">Expense Date</small><strong>${dateLabel(expense.date)}</strong></div>
        <div><small class="muted" style="display:block">Amount</small><strong style="font-size:15px">${money(expense.amount)}</strong></div>
        <div><small class="muted" style="display:block">Expense For Whom</small><strong>${esc(expense.forWhom || '—')}</strong></div>
        <div><small class="muted" style="display:block">Purpose</small><strong>${esc(expense.purpose || '—')}</strong></div>
        <div><small class="muted" style="display:block">Payment Status</small><span class="status-pill ${isPaid ? 'paid' : 'pending'}">${isPaid ? 'Paid' : 'Unpaid'}</span></div>
        <div><small class="muted" style="display:block">Date of Payment</small><strong>${isPaid && expense.paymentDate ? `${dateLabel(expense.paymentDate)}${expense.paymentMethod ? ` (${esc(expense.paymentMethod)})` : ''}` : 'Not paid yet'}</strong></div>
      </div>
      ${expense.notes ? `
      <div style="background:var(--bg-subtle, #f8fafc);padding:10px 14px;border-radius:8px;border:1px solid var(--line, #e2e8f0)">
        <small class="muted" style="display:block;margin-bottom:4px">Expense Notes</small>
        <p style="margin:0;font-size:13px;white-space:pre-wrap">${esc(expense.notes)}</p>
      </div>` : ''}
      ${attsHTML}
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px">
        ${!isPaid ? `<button type="button" class="button primary" data-action="mark-expense-paid" data-id="${esc(expense.id)}">✓ Mark as Paid</button>` : ''}
        <button type="button" class="button" data-action="edit-expense" data-id="${esc(expense.id)}">✎ Edit Expense</button>
      </div>
    </div>
  `;
  openModal(`Expense Details · ${esc(expense.id)}`, `${esc(expense.forWhom || '')} · ${esc(expense.purpose || '')}`, content, 'Close');
}

function openMarkExpensePaidDialog(expense) {
  if (!expense) return;
  const content = `
    <div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;background:var(--bg-subtle, #f8fafc);border:1px solid var(--line, #e2e8f0);font-size:12.5px">
      <strong>${esc(expense.forWhom)}</strong> — ${esc(expense.purpose)} · <strong>${money(expense.amount)}</strong>
    </div>
    <div class="form-grid">
      <div class="field">
        <label for="mark-expense-payment-date">Date of Payment *</label>
        <input id="mark-expense-payment-date" name="mark-expense-payment-date" type="date" value="${esc(today())}" required>
      </div>
      ${selectField('mark-expense-payment-method', 'Payment Method', ['Cash', 'M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Bank transfer', 'Card', 'Cheque'], expense.paymentMethod || 'Cash')}
    </div>
    ${renderAttachmentUploader(expense.attachments || [], 'expense')}
  `;
  openDialog('mark-expense-paid', `Mark Expense Paid · ${expense.id}`, 'Confirm the date of payment and optionally attach a payment receipt.', content, 'Confirm Paid');
  const form = document.getElementById('modal-content');
  if (form) form.dataset.recordId = expense.id;
}

function transactionProductPicker(kind) {
  return `<div class="transaction-product-search"><div class="field"><label for="${kind}-product-search">＋ Add products</label><input id="${kind}-product-search" type="search" autocomplete="off" placeholder="Type a product name, SKU, or category to search and add…" data-transaction-search="${kind}"></div><div class="transaction-suggestions" id="${kind}-product-suggestions" hidden></div></div>`;
}

function transactionPaymentSummary(kind) {
  const purchaseMethodField = kind === 'purchase' ? selectField('purchase-method', 'Payment method', ['Cash', 'M-Pesa', 'Bank transfer', 'Card'], 'Cash') : '';
  return `<section class="transaction-summary" data-transaction-summary="${kind}"><h3>Payment summary</h3><div class="transaction-summary-row"><span>Products subtotal</span><strong data-summary-subtotal>${money(0)}</strong></div><div class="form-grid transaction-adjustments">${inputField(`${kind}-discount`, 'Discount (fixed amount)', '0', 'number', false, 0)}${inputField(`${kind}-additional`, 'Additional charges (shipping, etc.)', '0', 'number', false, 0)}${inputField(`${kind}-paid`, 'Amount paid', '0', 'number', false, 0)}${purchaseMethodField}<div class="field"><label>Payment status</label><div class="transaction-status" data-summary-status>Due</div></div></div><div class="transaction-summary-row"><span>Discount</span><strong data-summary-discount>${money(0)}</strong></div><div class="transaction-summary-row"><span>Additional charges</span><strong data-summary-additional>${money(0)}</strong></div><div class="transaction-summary-row transaction-total"><span>Total to pay</span><strong data-summary-total>${money(0)}</strong></div><div class="transaction-summary-row"><span>Amount paid</span><strong data-summary-paid>${money(0)}</strong></div><div class="transaction-summary-row"><span>Balance due</span><strong data-summary-balance>${money(0)}</strong></div></section>`;
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
    row.innerHTML = `<div class="transaction-product-copy"><strong>${esc(product.name)}</strong><small>${esc(product.id)} · Current ${kind === 'order' ? 'price' : 'cost'} ${money(price)} · Stock ${Number(product.stock) || 0} ${esc(product.unit || '')}</small></div><label class="transaction-number"><span>Qty</span><input type="number" min="1" step="1" value="${initialQty}" data-line-qty aria-label="${esc(product.name)} quantity"></label><label class="transaction-number"><span>${kind === 'order' ? 'Unit price' : 'Unit cost'}</span><input type="number" min="0" step="any" value="${initialPrice}" data-line-price aria-label="${esc(product.name)} unit ${kind === 'order' ? 'price' : 'cost'}"></label><strong class="transaction-line-total" data-line-total>${money(initialQty * initialPrice)}</strong><button type="button" class="transaction-remove" data-action="remove-transaction-product" aria-label="Remove ${esc(product.name)}">×</button>`;
    host.append(row);
    if (kind !== 'order') {
      [...host.querySelectorAll('.transaction-product-line')].sort((a, b) => compareProductNames(a.querySelector('.transaction-product-copy strong').textContent, b.querySelector('.transaction-product-copy strong').textContent)).forEach(line => host.append(line));
    }
  }
  const search = document.getElementById(`${kind}-product-search`), suggestions = document.getElementById(`${kind}-product-suggestions`);
  if (search) { search.value = ''; search.focus(); }
  if (suggestions) { suggestions.hidden = true; suggestions.innerHTML = ''; }
  host.scrollTop = host.scrollHeight;
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
  target.innerHTML = matches.length ? matches.map(product => `<button type="button" class="transaction-suggestion" data-action="select-transaction-product" data-kind="${kind}" data-id="${esc(product.id)}"><span><strong>${esc(product.name)}</strong><small>${esc(product.id)} · ${esc(product.category)} · Stock ${Number(product.stock) || 0}</small></span><b>${money(kind === 'order' ? product.price : product.cost)}</b></button>`).join('') : '<div class="transaction-empty">No matching products</div>';
  target.hidden = false;
}

function openOrderPayment(id) {
  const order = state.orders.find(o => o.id === id); if (!order) return;
  openDialog('order-payment', 'Add customer payment', `Record a payment for ${esc(order.id)}.`, `${inputField('order-payment-amount', 'Amount (TZS)', '', 'number', true, Math.max(0, order.total - (order.paid || 0)))}${selectField('order-payment-method', 'Method', ['Cash', 'M-Pesa', 'Bank transfer', 'Card'])}${renderAttachmentUploader([], 'order-payment')}`, 'Record payment');
  document.getElementById('modal-content').dataset.recordId = id;
}

function openOrderReturn(id) {
  const order = state.orders.find(o => o.id === id); if (!order) return;
  const lines = (order.items || []).map(l => { const p = state.products.find(x => x.id === l.productId); return p ? `${p.id} · ${p.name}` : l.productId; });
  openDialog('order-return', 'Manage return', `Record returned items for ${esc(order.id)}.`, `${selectField('return-product', 'Product', lines)}${inputField('return-qty', 'Quantity returned', '', 'number', true, 1)}${inputField('return-reason', 'Reason', 'Optional note')}<div class="field"><label><input type="checkbox" name="return-restock" checked> Restock returned items</label></div>`, 'Save return');
  document.getElementById('modal-content').dataset.recordId = id;
}

function openOrderDiscrepancies(id) {
  let order = state.orders.find(o => o.id === id);
  if (!order) {
    const sale = state.sales.find(s => s.id === id || s.orderId === id);
    if (sale) {
      order = state.orders.find(o => o.id === sale.orderId || o.invoiceId === sale.id) || sale;
    }
  }
  if (!order) return;

  const discrepancies = order.discrepancies || [];
  const items = order.items || [];

  const productOptions = [
    `<option value="">-- Select affected product from order --</option>`,
    ...items.map(l => {
      const p = state.products.find(x => x.id === l.productId);
      const name = p?.name || l.product || l.productName || l.productId;
      return `<option value="${esc(l.productId)}" data-name="${esc(name)}" data-qty="${l.qty}">${esc(name)} (Ordered: ${l.qty})</option>`;
    }),
    `<option value="__general__" data-name="General Delivery Issue" data-qty="1">General Delivery / Entire Order</option>`
  ].join('');

  let existingList = '';
  if (discrepancies.length > 0) {
    existingList = `
      <div style="margin-bottom:18px">
        <div style="font-size:13px;font-weight:800;color:#0a1e36;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
          <span>⚠️ Logged Delivery Mistakes (${discrepancies.length})</span>
          <span style="font-size:11px;font-weight:600;color:#64748b">${discrepancies.filter(d => d.status !== 'Resolved').length} open action(s)</span>
        </div>
        <div style="display:grid;gap:8px">
          ${discrepancies.map(d => `
            <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:10px 12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="flex:1;min-width:210px">
                <div style="font-weight:700;color:#9a3412;margin-bottom:3px">
                  ${esc(d.typeLabel || d.type)}: ${esc(d.productName || 'Order item')}
                </div>
                <div style="color:#64748b;font-size:11px">
                  ${d.orderedQty != null && d.deliveredQty != null ? `Ordered: <strong>${d.orderedQty}</strong> | Delivered: <strong>${d.deliveredQty}</strong> | Discrepancy: <strong style="color:#b91c1c">${d.shortageQty ?? (d.orderedQty - d.deliveredQty)}</strong>` : ''}
                  ${d.substitutedProduct ? ` · Sent instead: <strong>${esc(d.substitutedProduct)}</strong>` : ''}
                  ${d.note ? `<br>Note: ${esc(d.note)}` : ''}
                  <div style="font-size:10px;color:#94a3b8;margin-top:2px">Reported by ${esc(d.reportedBy || 'Staff')} on ${dateLabel(d.reportedAt || today())}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="status-pill ${d.status === 'Resolved' ? 'status-paid' : 'status-issue'}" style="font-size:10px">${esc(d.status || 'Action Required')}</span>
                <button type="button" class="button small" data-action="toggle-discrepancy-status" data-id="${esc(order.id)}" data-disc-id="${esc(d.id)}" style="font-size:10.5px;padding:3px 7px" title="Toggle status">
                  ${d.status === 'Resolved' ? 'Reopen' : '✓ Mark resolved'}
                </button>
                <button type="button" class="button small danger-action" data-action="delete-discrepancy" data-id="${esc(order.id)}" data-disc-id="${esc(d.id)}" style="font-size:10.5px;padding:3px 7px" title="Delete record">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
    `;
  }

  const formFields = `
    ${existingList}
    <div style="font-size:13px;font-weight:800;color:#0a1e36;margin-bottom:10px">
      ＋ Record New Delivery Mistake / Discrepancy
    </div>
    <div class="field">
      <label for="disc-product">Product from this order</label>
      <select id="disc-product" name="disc-product" class="select-control" required style="width:100%">
        ${productOptions}
      </select>
    </div>
    <div class="field">
      <label for="disc-type">What mistake happened?</label>
      <select id="disc-type" name="disc-type" class="select-control" required style="width:100%">
        <option value="missing">1. Forgotten / Missing from Delivery (Product left behind)</option>
        <option value="wrong-qty">2. Wrong Quantity Delivered (Mismatch between ordered & delivered)</option>
        <option value="wrong-product">3. Wrong Product Sent Instead (Item substitution / incorrect SKU)</option>
        <option value="damaged">4. Damaged or Defective on Delivery</option>
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field">
        <label for="disc-ordered-qty">Ordered quantity</label>
        <input type="number" id="disc-ordered-qty" name="disc-ordered-qty" class="input-control" min="0" value="1" required>
      </div>
      <div class="field">
        <label for="disc-delivered-qty">Actual delivered quantity</label>
        <input type="number" id="disc-delivered-qty" name="disc-delivered-qty" class="input-control" min="0" value="0" required>
      </div>
    </div>
    <div class="field" id="disc-sub-field">
      <label for="disc-substituted">Wrong product sent instead (optional)</label>
      <input type="text" id="disc-substituted" name="disc-substituted" class="input-control" placeholder="e.g. Sent 2L Cooking Oil instead of 1L Olive Oil">
    </div>
    <div class="field">
      <label for="disc-status">Resolution / Action required</label>
      <select id="disc-status" name="disc-status" class="select-control" style="width:100%">
        <option value="Action Required">Action Required (Pending investigation / driver return)</option>
        <option value="Replacement Scheduled">Replacement Scheduled (Deliver missing / correct item)</option>
        <option value="Credit / Refund Due">Credit / Refund Due to Customer</option>
        <option value="Resolved">Resolved (Customer received or accepted adjustment)</option>
      </select>
    </div>
    <div class="field">
      <label for="disc-note">Driver / Delivery note</label>
      <input type="text" id="disc-note" name="disc-note" class="input-control" placeholder="e.g. Customer noted box was missing at drop-off; driver acknowledged">
    </div>
  `;

  openDialog('save-order-discrepancy', 'Delivery Mistakes & Discrepancies', `Order ${esc(order.id)} · ${esc(order.customer)}`, formFields, 'Save mistake record');
  document.getElementById('modal-content').dataset.recordId = order.id;

  setTimeout(() => {
    const prodSelect = document.getElementById('disc-product');
    const orderedQtyInput = document.getElementById('disc-ordered-qty');
    const deliveredQtyInput = document.getElementById('disc-delivered-qty');
    const typeSelect = document.getElementById('disc-type');

    if (prodSelect && orderedQtyInput) {
      prodSelect.addEventListener('change', () => {
        const opt = prodSelect.selectedOptions[0];
        if (opt && opt.dataset.qty) {
          orderedQtyInput.value = opt.dataset.qty;
          if (typeSelect && typeSelect.value === 'missing') {
            deliveredQtyInput.value = '0';
          } else {
            deliveredQtyInput.value = opt.dataset.qty;
          }
        }
      });
    }

    if (typeSelect && deliveredQtyInput) {
      typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'missing') {
          deliveredQtyInput.value = '0';
        }
      });
    }
  }, 20);
}

function openPurchaseReturn(id) {
  const purchase = state.purchases.find(p => p.id === id); if (!purchase) return;
  const lines = (purchase.lines || []).map(l => { const p = state.products.find(x => x.id === l.productId); return p ? `${p.id} · ${p.name}` : l.productId; });
  openDialog('purchase-return', 'Supplier return', `Record returned items to ${esc(purchase.supplier)} for ${esc(purchase.id)}.`, `${selectField('purchase-return-product', 'Product', lines)}${inputField('purchase-return-qty', 'Quantity returned', '', 'number', true, 1)}${inputField('purchase-return-reason', 'Reason', 'Optional note')}`, 'Record return');
  document.getElementById('modal-content').dataset.recordId = id;
}

function switchBranch(id) {
  const branch = state.branches.find(b => b.id === id && b.status !== 'Inactive'); if (!branch) return;
  if (!accessibleBranches().some(item => item.id === branch.id)) { toast('You can only open your assigned branch workspace'); return; }
  if (branch.id === activeBranch.id) return;
  snapshotCurrentBranch(); activeBranch = branch;
  const saved = state.branchData?.[id] || {};
  branchCollections.forEach(key => {
    if (key === 'products') return; // Products are managed globally via Firestore 'products' collection
    state[key] = structuredClone(saved[key] !== undefined ? saved[key] : (key === 'stocktakeDraft' ? null : []));
  });
  state.activeBranchId = branch.id; state.branch = branch.name; saveState();
  if (!canViewPage(page)) page = 'dashboard';
  pageHistory.length = 0; history.pushState({ erpPage: page }, '', `#${page}`); render(); toast(`Switched to ${branch.name}`);
}

async function handleDialogSubmit(form) {
  const data = new FormData(form);
  const kind = form.dataset.dialogKind;
  const val = key => String(data.get(key) || '').trim();

  if (kind === 'cloud-sync') {
    const rawConfig = form.elements['firebase-config-text']?.value?.trim();
    const wsId = form.elements['firebase-workspace-id']?.value?.trim() || 'main-workspace';
    if (!rawConfig) {
      toast('Please paste your Firebase configuration');
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(rawConfig);
    } catch {
      try {
        parsed = (new Function(`return ${rawConfig}`))();
      } catch (err) {
        toast('Invalid format. Please paste a valid Firebase configuration object.');
        return;
      }
    }
    if (!parsed || !parsed.projectId) {
      toast('Configuration must include at least "projectId" and "apiKey"');
      return;
    }
    saveStoredFirebaseConfig(parsed);
    const ok = initCloudSync(wsId, handleRemoteCloudSync);
    if (ok) {
      pushStateToCloud(state);
      toast('⚡ Live Cloud Sync Connected! Syncing across devices...');
      closeModal();
      render();
    } else {
      toast('Could not connect to Firebase with provided credentials');
    }
    return;
  }

  if (kind === 'save-order-discrepancy') {
    const orderId = form.dataset.recordId;
    let order = state.orders.find(o => o.id === orderId);
    let sale = state.sales.find(s => s.id === orderId || s.orderId === orderId);
    if (!order && sale) {
      order = state.orders.find(o => o.id === sale.orderId || o.invoiceId === sale.id) || sale;
    }
    if (!order) return;

    const prodId = val('disc-product');
    const type = val('disc-type');
    const orderedQty = Math.max(0, Number(val('disc-ordered-qty')) || 0);
    const deliveredQty = Math.max(0, Number(val('disc-delivered-qty')) || 0);
    const shortageQty = Math.max(0, orderedQty - deliveredQty);
    const substitutedProduct = val('disc-substituted');
    const status = val('disc-status') || 'Action Required';
    const note = val('disc-note');

    let prodName = 'Order item';
    if (prodId === '__general__') {
      prodName = 'General Delivery Issue';
    } else {
      const item = (order.items || []).find(l => l.productId === prodId);
      const prod = state.products.find(p => p.id === prodId);
      prodName = prod?.name || item?.product || item?.productName || prodId || 'Product';
    }

    const typeLabels = {
      'missing': 'Forgotten / Missing Item',
      'wrong-qty': 'Wrong Quantity Delivered',
      'wrong-product': 'Wrong Product Sent',
      'damaged': 'Damaged on Delivery'
    };

    if (!Array.isArray(order.discrepancies)) order.discrepancies = [];

    const newDisc = {
      id: idFor('DISC', order.discrepancies),
      type,
      typeLabel: typeLabels[type] || 'Delivery Discrepancy',
      productId: prodId,
      productName: prodName,
      orderedQty,
      deliveredQty,
      shortageQty,
      substitutedProduct,
      status,
      note,
      reportedAt: today(),
      reportedBy: currentWorkspaceUser().name || 'Staff'
    };

    order.discrepancies.unshift(newDisc);

    // Sync to linked invoice if exists
    if (sale && sale !== order) {
      sale.discrepancies = order.discrepancies;
    }
    if (order.invoiceId) {
      const inv = state.sales.find(s => s.id === order.invoiceId);
      if (inv) inv.discrepancies = order.discrepancies;
    }

    recordActivity('Delivery mistake recorded', `${newDisc.typeLabel} on order ${order.id} (${prodName})`, order.id);
    saveState();
    document.getElementById('app-modal').close();
    render();
    toast(`Delivery mistake logged for order ${order.id}`);
    return;
  }

  if (kind === 'new-product' || kind === 'edit-product') {
    const id = kind === 'edit-product' ? form.dataset.recordId : (val('product-sku') || idFor('SKU', state.products));
    const product = {
      id,
      name: val('product-name'),
      category: val('product-category') || 'General',
      price: Number(val('product-price')) || 0,
      cost: Number(val('product-cost')) || 0,
      stock: Math.max(0, Number(val('product-stock')) || 0),
      low: Math.max(0, Number(val('product-low')) || 0),
      unit: val('product-unit') || 'Piece',
      status: 'Active',
      expiryDate: val('product-expiry') || '',
      batchNumber: val('product-batch') || ''
    };
    const old = state.products.find(p => p.id === id);
    if (old) Object.assign(old, product); else state.products.unshift(product);
    if (!state.productCategories.includes(product.category)) state.productCategories.push(product.category);
    recordActivity(old ? 'Product updated' : 'Product added', product.name, product.id);
    saveState();
    if (typeof window.TideFirebase?.saveProduct === 'function') {
      window.TideFirebase.saveProduct(product);
    }
    document.getElementById('app-modal').close(); render(); toast(old ? 'Product updated' : 'Product added'); return;
  }
  if (kind === 'confirm-write-off') {
    const product = state.products.find(p => p.id === form.dataset.recordId);
    if (!product) return;
    const qty = Math.min(product.stock, Math.max(1, Number(val('writeoff-qty')) || product.stock));
    const reason = val('writeoff-reason') || 'Expired stock disposal';
    const before = product.stock;
    product.stock = Math.max(0, product.stock - qty);
    state.stockMovements.unshift({
      date: new Date().toISOString(),
      productId: product.id,
      reason: `Write-off: ${reason} (Expired ${product.expiryDate || 'N/A'}${product.batchNumber ? ' · Lot ' + product.batchNumber : ''})`,
      before,
      after: product.stock,
      delta: -qty,
      user: currentWorkspaceUser().name || 'Administrator'
    });
    recordActivity('Expired stock written off', `${qty} ${product.unit} of ${product.name}`, product.id);
    saveState();
    syncProductToCloud(product);
    document.getElementById('app-modal').close();
    render();
    toast(`${qty} ${product.unit} of ${product.name} written off`);
    return;
  }
  if (kind === 'confirm-clearance-discount') {
    const product = state.products.find(p => p.id === form.dataset.recordId);
    if (!product) return;
    const newPrice = Math.max(0, Number(val('clearance-price')) || 0);
    const oldPrice = product.price;
    product.price = newPrice;
    recordActivity('Clearance discount applied', `${product.name} discounted from ${money(oldPrice)} to ${money(newPrice)}`, product.id);
    saveState();
    syncProductToCloud(product);
    document.getElementById('app-modal').close();
    render();
    toast(`Selling price for ${product.name} updated to ${money(newPrice)}`);
    return;
  }
  if (kind === 'update-product-expiry') {
    const product = state.products.find(p => p.id === form.dataset.recordId);
    if (!product) return;
    product.expiryDate = val('edit-expiry-date') || '';
    product.batchNumber = val('edit-expiry-batch') || '';
    recordActivity('Product expiry updated', `${product.name} · Expiry: ${product.expiryDate || 'None'} · Batch: ${product.batchNumber || 'None'}`, product.id);
    saveState();
    syncProductToCloud(product);
    document.getElementById('app-modal').close();
    render();
    toast(`Expiry details updated for ${product.name}`);
    return;
  }
  if (kind === 'new-party' || kind === 'edit-party') {
    const editing = kind === 'edit-party', type = val('party-type'), list = type === 'Supplier' ? state.suppliers : state.customers;
    const existing = editing ? list.find(item => item.name === form.dataset.partyName) : null;
    if (editing && !existing) { toast(`${type} account could not be found`); return; }
    if (list.some(p => p.id !== existing?.id && p.name.toLowerCase() === val('party-name').toLowerCase())) { toast('That account already exists'); return; }
    const record = { id: existing?.id || idFor(type === 'Supplier' ? 'SUP' : 'CUS', list), name: val('party-name'), phone: val('party-phone'), email: val('party-email'), terms: val('party-terms') || 'Due on receipt', balance: existing?.balance || 0, status: existing?.status || 'Active' };
    if (type === 'Customer') record.creditLimit = Math.max(0, Number(val('party-credit-limit')) || 0);
    if (existing) { const previousName = existing.name; Object.assign(existing, record); if (previousName !== record.name) { if (type === 'Customer') { state.orders.forEach(order => { if (order.customer === previousName) order.customer = record.name; }); state.sales.forEach(sale => { if (sale.customer === previousName) sale.customer = record.name; }); } else state.purchases.forEach(purchase => { if (purchase.supplier === previousName) purchase.supplier = record.name; }); state.entries.forEach(entry => { if (entry.partyType === type && entry.party === previousName) entry.party = record.name; }); } } else list.unshift(record);
    recordActivity(`${type} ${editing ? 'updated' : 'added'}`, val('party-name'), record.id);
    saveState();
    if (typeof pushStateToCloud === 'function') pushStateToCloud(state, true);
    document.getElementById('app-modal').close(); render(); toast(`${type} ${editing ? 'updated' : 'added'}`); return;
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
    if (method.toLowerCase().includes('credit') && (!customer || customer === 'Walk-in customer')) {
      toast('Credit sales for due payment require a registered customer account');
      return;
    }
    const creditCustomer = state.customers.find(item => item.name === customer), creditLimit = Number(creditCustomer?.creditLimit) || 0;
    if (creditLimit > 0) { const previousDue = editing && order.customer === customer ? Math.max(0, (Number(order.total) || 0) - (Number(order.paid) || 0)) : 0; const newDue = Math.max(0, totals.total - totals.paid), projectedBalance = (Number(creditCustomer.balance) || 0) - previousDue + newDue; if (newDue > previousDue && projectedBalance > creditLimit) { toast(`Credit limit exceeded for ${customer} · available ${money(Math.max(0, creditLimit - (Number(creditCustomer.balance) || 0) + previousDue))}`); return; } }
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
    Object.assign(updated, { customer, date, due: date, subtotal: totals.subtotal, discount: totals.discount, additionalCharges: totals.additional, total: totals.total, paid: totals.paid, paymentMethod: method, items, attachments: structuredClone(currentDraftAttachments) });
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
      removeAccountEntries(entry => ['order', 'order-payment', 'sales', 'sales-payment'].includes(entry.sourceType) && [updated.id, updated.invoiceId].includes(entry.sourceId));
      if (state.customers.some(item => item.name === customer)) {
        const pos = updated.source === 'POS';
        postAccountEntry({ partyType: 'Customer', party: customer, date, type: 'Debit', amount: updated.total, memo: `${pos ? 'POS sale' : 'Sales order'} · ${updated.id}`, sourceType: pos ? 'sales' : 'order', sourceId: updated.id, relatedId: updated.invoiceId || updated.id });
        const directPaid = Math.max(0, updated.paid - allocated);
        if (directPaid > 0) postAccountEntry({ partyType: 'Customer', party: customer, date, type: 'Credit', amount: directPaid, memo: `Payment · ${method} · ${updated.id}`, sourceType: pos ? 'sales-payment' : 'order-payment', sourceId: updated.id, relatedId: updated.invoiceId || updated.id });
      }
      Object.assign(invoice, { customer, date, total: updated.total, paid: updated.paid, method, status: orderPaymentStatus(updated), items: updated.items, discount: updated.discount, additionalCharges: updated.additionalCharges });
    } else if (!editing) state.orders.unshift(updated);
    recordActivity(editing ? 'Sale/order updated' : 'Sales order created', `${customer} · ${money(totals.total)}`, updated.id);
    saveState(); document.getElementById('app-modal').close(); setPage('sales'); toast(editing ? (wasInvoicedOrder ? 'Order updated · status is Edited until the invoice is printed again' : 'Sale updated') : 'Sales order saved as a draft'); return;
  }
  if (kind === 'record-payment') {
    const type = val('payment-party-type'), name = val('payment-party'), amount = Number(val('payment-amount')) || 0;
    if (!(amount > 0)) { toast('Enter an amount greater than zero'); return; }
    const entry = postAccountEntry({ partyType: type, party: name, date: val('payment-date') || today(), type: type === 'Customer' ? 'Credit' : 'Debit', amount, memo: `${val('payment-method')} payment${val('payment-memo') ? ` · ${val('payment-memo')}` : ''}`, sourceType: 'account-payment' });
    if (currentDraftAttachments && currentDraftAttachments.length) entry.attachments = structuredClone(currentDraftAttachments);
    recordActivity('Account payment recorded', `${type} · ${name} · ${money(amount)}`);
    saveState(); document.getElementById('app-modal').close(); render(); toast('Payment recorded'); return;
  }
  if (kind === 'account-reconcile') {
    const partyType = form.dataset.partyType, partyName = form.dataset.partyName;
    const account = (partyType === 'Supplier' ? state.suppliers : state.customers).find(item => item.name === partyName);
    const expected = Number(val('reconcile-balance'));
    if (!account || !Number.isFinite(expected) || expected < 0) { toast('Enter a valid non-negative account balance'); return; }
    const desiredSigned = partyType === 'Customer' ? expected : -expected;
    const difference = desiredSigned - (Number(account.balance) || 0);
    if (Math.abs(difference) < 0.005) { document.getElementById('app-modal').close(); toast('This account is already reconciled to that balance'); return; }
    postAccountEntry({ partyType, party: partyName, date: val('reconcile-date') || today(), type: difference > 0 ? 'Debit' : 'Credit', amount: Math.abs(difference), memo: `Balance reconciliation${val('reconcile-note') ? ` · ${val('reconcile-note')}` : ''}`, sourceType: 'reconciliation', sourceId: account.id, relatedId: account.id });
    recordActivity(`${partyType} account reconciled`, `${partyName} · ${money(expected)}`, account.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast(`${partyType} account reconciled`); return;
  }
  if (kind === 'adjust-stock') {
    const product = state.products.find(p => p.id === form.dataset.recordId); if (!product) return;
    const before = product.stock, next = Math.max(0, Number(val('stock-new-quantity')) || 0); product.stock = next;
    state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId: product.id, product: product.name, date: today(), before, after: next, delta: next - before, reason: val('stock-reason') || 'Manual adjustment', user: currentWorkspaceUser().name });
    recordActivity('Stock adjusted', `${product.name} · ${before} → ${next}`, product.id);
    saveState();
    syncProductToCloud(product);
    document.getElementById('app-modal').close(); render(); toast('Stock adjusted'); return;
  }
  if (kind === 'finalize-stocktake') {
    const reason = val('stocktake-reason') || 'Physical stock take count';
    const rows = Array.from(document.querySelectorAll('#stocktake-table-body tr[data-product-id]'));
    if (!rows.length) {
      toast('Add at least one product to the stock take sheet');
      return;
    }

    const updates = [];
    for (const row of rows) {
      const productId = row.dataset.productId;
      const product = state.products.find(p => p.id === productId);
      if (!product) continue;
      const qtyInput = row.querySelector('.stocktake-qty-input');
      const expInput = row.querySelector('.stocktake-exp-input');
      const rawCount = qtyInput?.value.trim();
      if (rawCount === '' || isNaN(Number(rawCount))) continue;
      const newStock = Math.max(0, Number(rawCount));
      const newExpiry = expInput ? expInput.value.trim() : (product.expiryDate || '');
      updates.push({ product, newStock, newExpiry, before: product.stock, oldExpiry: product.expiryDate || '' });
    }

    if (!updates.length) {
      toast('Enter a physical count for at least one product to apply stock take');
      return;
    }

    let appliedChanges = 0;
    const now = today();
    for (const u of updates) {
      const p = u.product;
      const before = u.before;
      const next = u.newStock;
      p.stock = next;
      if (u.newExpiry !== u.oldExpiry) {
        p.expiryDate = u.newExpiry;
      }
      appliedChanges++;
      if (next !== before) {
        state.stockMovements.unshift({
          id: idFor('STK', state.stockMovements),
          productId: p.id,
          product: p.name,
          date: now,
          before,
          after: next,
          delta: next - before,
          reason,
          user: currentWorkspaceUser().name
        });
      }
    }

    if (!Array.isArray(state.stocktakes)) state.stocktakes = [];
    const sessionId = idFor('STK-REC', state.stocktakes);
    const sessionItems = updates.map(u => ({
      productId: u.product.id,
      productName: u.product.name,
      sku: u.product.sku || u.product.id,
      beforeStock: u.before,
      countedStock: u.newStock,
      delta: u.newStock - u.before,
      costImpact: (u.newStock - u.before) * Number(u.product.cost || 0),
      expiryDate: u.newExpiry
    }));
    const totalCounted = sessionItems.length;
    const matched = sessionItems.filter(i => i.delta === 0).length;
    const shortages = sessionItems.filter(i => i.delta < 0).length;
    const surpluses = sessionItems.filter(i => i.delta > 0).length;
    const netQtyDelta = sessionItems.reduce((sum, i) => sum + i.delta, 0);
    const netValueDelta = sessionItems.reduce((sum, i) => sum + i.costImpact, 0);

    state.stocktakes.unshift({
      id: sessionId,
      date: new Date().toISOString(),
      dateStr: now,
      reason,
      user: currentWorkspaceUser().name || 'Administrator',
      totalProducts: totalCounted,
      countedProducts: totalCounted,
      matchedCount: matched,
      shortageCount: shortages,
      surplusCount: surpluses,
      netQtyDelta,
      netValueDelta,
      items: sessionItems
    });

    state.stocktakeDraft = null;
    recordActivity('Stock take finalized', `${appliedChanges} product quantities directly updated · ${reason}`, 'STOCKTAKE');
    saveState();
    document.getElementById('app-modal')?.close();
    render();
    toast(`Stock take applied! Directly updated stock for ${appliedChanges} products.`);
    return;
  }
  if (kind === 'bulk-adjust-stock') {
    const productId = val('bulk-product').split(' · ')[0], product = state.products.find(p => p.id === productId);
    if (!product) { toast('Choose an available product'); return; }
    const before = product.stock, next = Math.max(0, Number(val('bulk-quantity')) || 0); product.stock = next;
    state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId, product: product.name, date: today(), before, after: next, delta: next - before, reason: val('stock-reason') || 'Stock take / adjustment', user: currentWorkspaceUser().name });
    recordActivity('Stock count / adjustment saved', `${product.name} · ${before} → ${next}`, product.id);
    saveState();
    syncProductToCloud(product);
    document.getElementById('app-modal').close(); render(); toast('Stock count saved'); return;
  }
  if (kind === 'save-edit-stocktake') {
    if (!isWorkspaceAdministrator()) { toast('Administrator privileges required'); return; }
    const st = (state.stocktakes || []).find(s => s.id === form.dataset.recordId);
    if (!st) { toast('Stock take record not found'); return; }
    const newReason = val('st-edit-reason') || st.reason;
    const countInputs = document.querySelectorAll('.st-edit-count');
    let modifiedProducts = 0;

    for (const input of countInputs) {
      const prodId = input.dataset.productId;
      const item = (st.items || []).find(i => i.productId === prodId);
      if (!item) continue;

      const oldCount = Number(item.countedStock);
      const newCount = Math.max(0, Number(input.value || 0));
      const expInput = document.querySelector(`.st-edit-exp[data-product-id="${prodId}"]`);
      const newExpiry = expInput ? expInput.value.trim() : (item.expiryDate || '');
      const countDiff = newCount - oldCount;

      const p = state.products.find(prod => prod.id === prodId);
      if (countDiff !== 0) {
        if (p) {
          const before = p.stock;
          p.stock = Math.max(0, p.stock + countDiff);
          state.stockMovements.unshift({
            id: idFor('STK', state.stockMovements),
            productId: p.id,
            product: p.name,
            date: today(),
            before,
            after: p.stock,
            delta: countDiff,
            reason: `Stock take correction (${st.id})`,
            user: currentWorkspaceUser().name
          });
        }
        modifiedProducts++;
      }

      item.countedStock = newCount;
      item.delta = newCount - item.beforeStock;
      item.costImpact = item.delta * Number(p?.cost || 0);
      item.expiryDate = newExpiry;
      if (p && newExpiry !== (p.expiryDate || '')) p.expiryDate = newExpiry;
    }

    st.matchedCount = st.items.filter(i => i.delta === 0).length;
    st.shortageCount = st.items.filter(i => i.delta < 0).length;
    st.surplusCount = st.items.filter(i => i.delta > 0).length;
    st.netQtyDelta = st.items.reduce((sum, i) => sum + i.delta, 0);
    st.netValueDelta = st.items.reduce((sum, i) => sum + i.costImpact, 0);
    st.reason = newReason;
    st.editedAt = new Date().toISOString();
    st.editedBy = currentWorkspaceUser().name;

    recordActivity('Stock take edited', `Corrected counts in session ${st.id} (${modifiedProducts} products updated)`, st.id);
    saveState();
    document.getElementById('app-modal')?.close();
    render();
    toast(`Stock take session ${st.id} updated!`);
    return;
  }
  if (kind === 'save-edit-stock-movement') {
    if (!isWorkspaceAdministrator()) { toast('Administrator privileges required'); return; }
    const m = (state.stockMovements || []).find(item => item.id === form.dataset.recordId);
    if (!m) { toast('Stock adjustment not found'); return; }

    const newDelta = Number(val('edit-movement-delta')) || 0;
    const newReason = val('edit-movement-reason') || m.reason;
    const diff = newDelta - Number(m.delta || 0);

    if (diff !== 0) {
      const p = state.products.find(prod => prod.id === m.productId || prod.name === m.product);
      if (p) {
        p.stock = Math.max(0, p.stock + diff);
      }
    }

    m.delta = newDelta;
    m.after = (m.before !== undefined ? m.before : 0) + newDelta;
    m.reason = newReason;
    m.editedAt = new Date().toISOString();
    m.editedBy = currentWorkspaceUser().name;

    recordActivity('Stock adjustment edited', `Updated adjustment ${m.id} (${m.product})`, m.id);
    saveState();
    document.getElementById('app-modal')?.close();
    render();
    toast(`Stock adjustment ${m.id} updated!`);
    return;
  }
  if (kind === 'new-purchase' || kind === 'edit-purchase') {
    const editing = kind === 'edit-purchase';
    const purchase = editing ? state.purchases.find(item => item.id === form.dataset.recordId) : null;
    if (editing && !purchase) { toast('This purchase order could not be found'); return; }
    const totals = transactionLineTotals('purchase');
    const lines = totals.lines.map(row => { const product = state.products.find(p => p.id === row.dataset.productId); return { productId: row.dataset.productId, product: product?.name || row.dataset.productId, qty: Number(row.querySelector('[data-line-qty]').value) || 0, unitCost: Number(row.querySelector('[data-line-price]').value) || 0 }; });
    if (!lines.length || lines.some(line => line.qty <= 0)) { toast('Search for and add at least one product with a valid quantity'); return; }
    if (totals.discount > totals.subtotal) { toast('Discount cannot be greater than the products subtotal'); return; }
    if (totals.paid > totals.total) { toast('Amount paid cannot be greater than the order total'); return; }
    const supplier = val('purchase-supplier'), date = val('purchase-date') || today(), method = val('purchase-method') || 'Cash';
    const received = editing && purchase.status === 'Received';
    const hasReturns = editing && ((Number(purchase.returned) || 0) > 0 || (state.purchaseReturns || []).some(record => record.purchaseId === purchase.id || record.purchaseOrderId === purchase.id));
    if (received && hasReturns) { toast('This purchase has returns recorded, so its original items cannot be edited'); return; }
    const oldQuantities = new Map(); if (received) (purchase.lines || []).forEach(line => oldQuantities.set(line.productId, (oldQuantities.get(line.productId) || 0) + (Number(line.qty) || 0)));
    const newQuantities = new Map(); lines.forEach(line => newQuantities.set(line.productId, (newQuantities.get(line.productId) || 0) + line.qty));
    if (received) for (const productId of new Set([...oldQuantities.keys(), ...newQuantities.keys()])) { const product = state.products.find(item => item.id === productId); if (!product) { toast('A product on this purchase no longer exists'); return; } if (product.stock + (newQuantities.get(productId) || 0) - (oldQuantities.get(productId) || 0) < 0) { toast(`Cannot reduce ${product.name}; some received stock has already been sold or used`); return; } }
    const updated = purchase || { id: idFor('PO', state.purchases), status: 'Pending' };
    Object.assign(updated, { supplier, date, lines, subtotal: totals.subtotal, discount: totals.discount, additionalCharges: totals.additional, total: totals.total, paid: totals.paid, paymentMethod: method, attachments: structuredClone(currentDraftAttachments) });
    if (received) for (const productId of new Set([...oldQuantities.keys(), ...newQuantities.keys()])) { const product = state.products.find(item => item.id === productId), before = product.stock, delta = (newQuantities.get(productId) || 0) - (oldQuantities.get(productId) || 0); if (!delta) continue; product.stock += delta; state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId, product: product.name, date, before, after: product.stock, delta, reason: `Edited received purchase ${updated.id}`, user: currentWorkspaceUser().name }); }
    removeAccountEntries(entry => ['purchase', 'purchase-payment'].includes(entry.sourceType) && entry.sourceId === updated.id);
    postAccountEntry({ partyType: 'Supplier', party: supplier, date, type: 'Credit', amount: updated.total, memo: `Purchase order · ${updated.id}`, sourceType: 'purchase', sourceId: updated.id });
    if (updated.paid > 0) postAccountEntry({ partyType: 'Supplier', party: supplier, date, type: 'Debit', amount: updated.paid, memo: `Payment · ${method} · ${updated.id}`, sourceType: 'purchase-payment', sourceId: updated.id });
    if (!editing) state.purchases.unshift(updated);
    recordActivity(editing ? 'Purchase order updated' : 'Purchase order created', `${supplier} · ${money(totals.total)}`, updated.id);
    saveState(); document.getElementById('app-modal').close(); setPage('purchases'); toast(editing ? 'Purchase order updated' : 'Purchase order saved'); return;
  }
  if (kind === 'purchase-payment') {
    const purchase = state.purchases.find(p => p.id === form.dataset.recordId), amount = Number(val('purchase-payment-amount')) || 0;
    if (!purchase || amount <= 0) { toast('Enter a payment amount greater than zero'); return; }
    const applied = Math.min(amount, Math.max(0, purchase.total - (purchase.returned || 0) - (purchase.paid || 0)));
    if (!applied) { toast('This purchase has no balance due'); return; }
    purchase.paid = (purchase.paid || 0) + applied;
    const entry = postAccountEntry({ partyType: 'Supplier', party: purchase.supplier, date: today(), type: 'Debit', amount: applied, memo: `Payment · ${val('purchase-payment-method')} · ${purchase.id}`, sourceType: 'purchase-payment', sourceId: purchase.id });
    if (currentDraftAttachments && currentDraftAttachments.length) {
      entry.attachments = structuredClone(currentDraftAttachments);
      purchase.attachments = purchase.attachments || [];
      purchase.attachments.push(...structuredClone(currentDraftAttachments));
    }
    recordActivity('Supplier payment recorded', `${purchase.supplier} · ${money(applied)}`, purchase.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast('Supplier payment recorded'); return;
  }
  if (kind === 'purchase-return') {
    const purchase = state.purchases.find(p => p.id === form.dataset.recordId);
    if (!purchase) { toast('Purchase order not found'); return; }
    const productId = val('purchase-return-product').split(' · ')[0];
    const line = purchase.lines?.find(l => l.productId === productId);
    const qty = Math.max(1, Number(val('purchase-return-qty')) || 1);
    if (!line || qty > line.qty) { toast('Return quantity must be within the received quantity'); return; }
    const product = state.products.find(p => p.id === productId);
    if (product) {
      const before = product.stock;
      product.stock = Math.max(0, product.stock - qty);
      state.stockMovements.unshift({
        id: idFor('STK', state.stockMovements),
        productId: product.id,
        product: product.name,
        date: today(),
        before,
        after: product.stock,
        delta: product.stock - before,
        reason: `Supplier return ${purchase.id}`,
        user: currentWorkspaceUser().name
      });
    }
    const unitCost = Number(line.unitCost) || Number(product?.cost) || 0;
    const returnAmount = qty * unitCost;
    if (!Array.isArray(state.purchaseReturns)) state.purchaseReturns = [];
    state.purchaseReturns.unshift({
      id: idFor('PRET', state.purchaseReturns),
      purchaseId: purchase.id,
      purchaseOrderId: purchase.id,
      supplier: purchase.supplier,
      productId,
      product: product?.name || productId,
      qty,
      amount: returnAmount,
      date: today(),
      reason: val('purchase-return-reason')
    });
    purchase.returned = (Number(purchase.returned) || 0) + returnAmount;
    postAccountEntry({
      partyType: 'Supplier',
      party: purchase.supplier,
      date: today(),
      type: 'Debit',
      amount: returnAmount,
      memo: `Supplier return · ${purchase.id}`,
      sourceType: 'purchase-return',
      sourceId: purchase.id
    });
    recordActivity('Supplier return recorded', `${purchase.supplier} · ${product?.name || productId} · ${qty}`, purchase.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast('Supplier return recorded'); return;
  }
  if (kind === 'order-payment') {
    const order = state.orders.find(o => o.id === form.dataset.recordId), amount = Number(val('order-payment-amount')) || 0;
    if (!order || amount <= 0) { toast('Enter a payment amount greater than zero'); return; }
    const applied = Math.min(amount, Math.max(0, order.total - (order.paid || 0))); order.paid = (order.paid || 0) + applied;
    const invoice = ensureOrderInvoice(order); invoice.paid = order.paid; invoice.method = val('order-payment-method') || 'Cash'; invoice.status = orderPaymentStatus(order) === 'Fully paid' ? 'Paid' : 'Pending';
    const entry = state.customers.some(c => c.name === order.customer) ? postAccountEntry({ partyType: 'Customer', party: order.customer, type: 'Credit', amount: applied, memo: `Payment · ${invoice.method} · ${order.id}`, sourceType: 'order-payment', sourceId: order.id }) : null;
    if (currentDraftAttachments && currentDraftAttachments.length) {
      if (entry) entry.attachments = structuredClone(currentDraftAttachments);
      order.attachments = order.attachments || [];
      order.attachments.push(...structuredClone(currentDraftAttachments));
    }
    recordActivity('Customer payment recorded', `${order.customer} · ${money(applied)}`, order.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast('Customer payment recorded'); return;
  }
  if (kind === 'order-return') {
    const order = state.orders.find(o => o.id === form.dataset.recordId), productId = val('return-product').split(' · ')[0], line = order?.items?.find(i => i.productId === productId), qty = Math.max(1, Number(val('return-qty')) || 1);
    if (!order || !line || qty > line.qty) { toast('Return quantity must be within the original sale quantity'); return; }
    const product = state.products.find(p => p.id === productId);
    const restock = Boolean(data.get('return-restock'));
    if (restock && product) {
      const before = product.stock;
      product.stock += qty;
      state.stockMovements.unshift({
        id: idFor('STK', state.stockMovements),
        productId: product.id,
        product: product.name,
        date: today(),
        before,
        after: product.stock,
        delta: qty,
        reason: `Sales return ${order.id}`,
        user: currentWorkspaceUser().name
      });
    }
    const unitPrice = line.unitPrice ?? product?.price ?? 0;
    const returnAmount = qty * unitPrice;
    const retRecord = {
      id: idFor('RET', state.returns),
      saleId: order.invoiceId || order.id,
      customer: order.customer,
      product: product?.name || productId,
      productId,
      qty,
      amount: returnAmount,
      date: today(),
      reason: val('return-reason'),
      restocked: restock
    };
    state.returns.unshift(retRecord);
    if (order.customer !== 'Walk-in customer' && state.customers.some(c => c.name === order.customer)) {
      postAccountEntry({
        partyType: 'Customer',
        party: order.customer,
        date: today(),
        type: 'Credit',
        amount: returnAmount,
        memo: `Return credit · ${retRecord.id} · ${order.id}`,
        sourceType: 'sales-return',
        sourceId: retRecord.id,
        relatedId: order.id
      });
    }
    recordActivity('Sales return recorded', `${order.customer} · ${product?.name || productId} · ${qty}`, order.id);
    saveState();
    if (restock && product) syncProductToCloud(product);
    document.getElementById('app-modal').close(); render(); toast('Return recorded and balance adjusted'); return;
  }
  if (kind === 'new-user') {
    if (!canPerformAction('new-user')) { toast('You do not have permission to add users'); return; }
    const name = val('user-name'); if (!name) { toast('Enter the user name'); return; }
    const username = val('user-username'), email = val('user-email'), password = String(data.get('user-password') || ''), passwordConfirm = String(data.get('user-password-confirm') || '');
    if (!username || !email || !credentialsAvailable(username, email)) { toast('Choose a username and email that are unique to this user'); return; }
    if (password.length < 8 || password !== passwordConfirm) { toast(password.length < 8 ? 'Passwords must be at least 8 characters' : 'Passwords do not match'); return; }
    const role = val('user-role') || 'Salesman';
    if (role === 'Owner / Administrator' && !isWorkspaceAdministrator()) { toast('Only an Owner / Administrator can assign the administrator role'); return; }
    const modules = userRoleDefaults[role] || userRoleDefaults.Salesman;
    const branchId = val('user-branch');
    if (!accessibleBranches().some(branch => branch.id === branchId)) { toast('Assign this user to a branch you are allowed to manage'); return; }
    const user = { id: idFor('USR', state.users), name, username, email, phone: val('user-phone'), role, modules: [...modules], permissions: rolePermissionMap(role, modules), branchId, status: 'Active' };
    await setUserPassword(user, password);
    state.users.push(user);
    if (typeof registerAccountInDirectory === 'function') {
      registerAccountInDirectory(user, getActiveWorkspaceId(), state.companyName).catch(() => {});
    }
    recordActivity('User added', `${name} · ${role}`);
    saveState(); document.getElementById('app-modal').close(); render(); toast('User added'); return;
  }
  if (kind === 'edit-user') {
    if (!isWorkspaceAdministrator()) { toast('Only an Owner / Administrator can edit user accounts'); return; }
    const user = state.users.find(item => item.id === form.dataset.recordId);
    if (!user) { toast('This user account could not be found'); return; }
    const previousUser = { username: user.username, email: user.email };
    const name = val('edit-user-name'), username = val('edit-user-username'), email = val('edit-user-email'), phone = val('edit-user-phone'), role = val('edit-user-role'), branchId = val('edit-user-branch');
    const password = String(data.get('edit-user-password') || ''), passwordConfirm = String(data.get('edit-user-password-confirm') || '');
    if (!name) { toast('Enter the user name'); return; }
    if (!username || !email || !credentialsAvailable(username, email, user.id)) { toast('Choose a username and email that are unique to this user'); return; }
    if (!accessibleBranches().some(branch => branch.id === branchId)) { toast('Choose an active branch'); return; }
    if (password && (password.length < 8 || password !== passwordConfirm)) { toast(password.length < 8 ? 'Passwords must be at least 8 characters' : 'Passwords do not match'); return; }
    if (user.isBootstrap && role !== 'Owner / Administrator') { toast('The primary workspace owner must keep the Owner / Administrator role'); return; }
    if (role === 'Owner / Administrator' && !isWorkspaceAdministrator()) { toast('Only an Owner / Administrator can assign the administrator role'); return; }
    const roleChanged = user.role !== role;
    Object.assign(user, { name, username, email, phone, role, branchId });
    if (roleChanged) { const modules = userRoleDefaults[role] || userRoleDefaults.Salesman; user.modules = [...modules]; user.permissions = rolePermissionMap(role, modules); }
    if (password) await setUserPassword(user, password);
    if (typeof registerAccountInDirectory === 'function') {
      registerAccountInDirectory(user, getActiveWorkspaceId(), state.companyName, previousUser).catch(() => {});
    }
    if (state.currentUserId === user.id) {
      if (!activateAssignedBranch(user)) { toast('This account must remain assigned to an active branch'); return; }
      safeSessionSet(AUTH_SESSION_KEY, JSON.stringify({ id: user.id, passwordHash: user.passwordHash, workspaceId: getActiveWorkspaceId() }));
    }
    recordActivity('User account updated', `${name} · ${role}`, user.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast(`User ${name} updated`); return;
  }
  if (kind === 'edit-user-permissions') {
    if (!isWorkspaceAdministrator()) { toast('Only an Owner / Administrator can override user permissions'); return; }
    const user = state.users.find(item => item.id === form.dataset.recordId);
    if (!user || user.isBootstrap) { toast('The root Owner / Administrator always has full access'); return; }
    const permissions = Object.fromEntries(userActionPermissions.map(group => [group.module, []]));
    for (const choice of data.getAll('user-permission')) { const [module, permission] = String(choice).split('|'); if (permissions[module] && !permissions[module].includes(permission)) permissions[module].push(permission); }
    user.permissions = permissions;
    user.modules = userActionPermissions.filter(group => permissions[group.module].length > 0).map(group => group.module);
    recordActivity('User permissions updated', user.name, user.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast(`Permissions updated for ${user.name}`); return;
  }
  if (kind === 'set-user-credentials') {
    if (!isWorkspaceAdministrator()) { toast('Only an Owner / Administrator can set user login credentials'); return; }
    const user = state.users.find(item => item.id === form.dataset.recordId), name = val('credential-name'), username = val('credential-username'), email = val('credential-email'), password = String(data.get('credential-password') || ''), passwordConfirm = String(data.get('credential-password-confirm') || '');
    if (!user) { toast('This user account could not be found'); return; }
    const previousUser = { username: user.username, email: user.email };
    if (!name) { toast('Enter the user full name'); return; }
    if (!credentialsAvailable(username, email, user.id)) { toast('That username or email is already assigned to another user'); return; }
    if (password || !user.passwordHash) {
      if (password.length < 8 || password !== passwordConfirm) { toast(password.length < 8 ? 'Passwords must be at least 8 characters' : 'Passwords do not match'); return; }
      await setUserPassword(user, password);
    }
    Object.assign(user, { name, username, email });
    if (typeof registerAccountInDirectory === 'function') {
      registerAccountInDirectory(user, getActiveWorkspaceId(), state.companyName, previousUser).catch(() => {});
    }
    if (state.currentUserId === user.id) {
      safeSessionSet(AUTH_SESSION_KEY, JSON.stringify({ id: user.id, passwordHash: user.passwordHash, workspaceId: getActiveWorkspaceId() }));
    }
    saveState(); document.getElementById('app-modal').close(); render(); toast(`Login credentials saved for ${user.name}`); return;
  }
  if (kind === 'own-credentials') {
    const user = currentWorkspaceUser(), name = val('own-name'), username = val('own-username'), email = val('own-email'), currentPassword = String(data.get('own-current-password') || ''), newPassword = String(data.get('own-new-password') || ''), newPasswordConfirm = String(data.get('own-new-password-confirm') || '');
    const previousUser = { username: user.username, email: user.email };
    if (!name) { toast('Enter your full name'); return; }
    if (!credentialsAvailable(username, email, user.id)) { toast('That username or email is already assigned to another user'); return; }
    if (newPassword) {
      if (user.passwordHash && !await verifyUserPassword(user, currentPassword)) { toast('Current password is incorrect'); return; }
      if (newPassword.length < 8 || newPassword !== newPasswordConfirm) { toast(newPassword.length < 8 ? 'New passwords must be at least 8 characters' : 'New passwords do not match'); return; }
      await setUserPassword(user, newPassword);
    }
    Object.assign(user, { name, username, email });
    if (typeof registerAccountInDirectory === 'function') {
      registerAccountInDirectory(user, getActiveWorkspaceId(), state.companyName, previousUser).catch(() => {});
    }
    safeSessionSet(AUTH_SESSION_KEY, JSON.stringify({ id: user.id, passwordHash: user.passwordHash, workspaceId: getActiveWorkspaceId() }));
    recordActivity('Account profile and credentials updated', user.name, user.id);
    saveState(); document.getElementById('app-modal').close(); render(); toast('Account profile updated'); return;
  }
  if (kind === 'new-branch') {
    const name = val('branch-name'); if (!name) { toast('Enter a branch name'); return; }
    const branch = { id: idFor('BR', state.branches), name, status: 'Active' }; state.branches.push(branch); state.branchData[branch.id] = Object.fromEntries(branchCollections.map(k => [k, []]));
    saveState(); document.getElementById('app-modal').close(); render(); toast('Branch added'); return;
  }
  if (kind === 'save-expense') {
    const date = val('expense-date') || today();
    const forWhom = val('expense-for-whom');
    const purpose = val('expense-purpose');
    const notes = val('expense-notes');
    const amount = Number(val('expense-amount')) || 0;
    const paid = Boolean(data.get('expense-paid'));
    const paymentDate = paid ? (val('expense-payment-date') || today()) : '';
    const paymentMethod = paid ? (val('expense-payment-method') || 'Cash') : '';

    if (!forWhom) { toast('Enter who the expense is for'); return; }
    if (!purpose) { toast('Enter the purpose of the expense'); return; }
    if (amount <= 0) { toast('Enter a valid expense amount greater than 0'); return; }

    if (!Array.isArray(state.expenses)) state.expenses = [];
    const existingId = form.dataset.recordId;
    const existing = existingId ? state.expenses.find(e => e.id === existingId) : null;
    const attachments = structuredClone(currentDraftAttachments || []);

    if (existing) {
      Object.assign(existing, {
        date, forWhom, purpose, notes, amount, paid, paymentDate, paymentMethod, attachments,
        updatedAt: new Date().toISOString()
      });
      recordActivity('Expense updated', `${forWhom} · ${purpose} · ${money(amount)}`, existing.id);
    } else {
      const expense = {
        id: idFor('EXP', state.expenses),
        date,
        forWhom,
        purpose,
        notes,
        amount,
        paid,
        paymentDate,
        paymentMethod,
        attachments,
        createdBy: currentWorkspaceUser().name,
        createdAt: new Date().toISOString()
      };
      state.expenses.unshift(expense);
      recordActivity('Expense recorded', `${forWhom} · ${purpose} · ${money(amount)} (${paid ? 'Paid' : 'Unpaid'})`, expense.id);
    }

    currentDraftAttachments = [];
    saveState();
    document.getElementById('app-modal')?.close();
    render();
    toast(existing ? 'Expense updated' : `✓ Expense recorded (${money(amount)})`);
    return;
  }
  if (kind === 'mark-expense-paid') {
    const expense = (state.expenses || []).find(e => e.id === form.dataset.recordId);
    if (!expense) return;
    expense.paid = true;
    expense.paymentDate = val('mark-expense-payment-date') || today();
    expense.paymentMethod = val('mark-expense-payment-method') || 'Cash';
    expense.attachments = structuredClone(currentDraftAttachments || []);
    expense.updatedAt = new Date().toISOString();
    currentDraftAttachments = [];
    recordActivity('Expense marked paid', `${expense.forWhom} · ${expense.purpose} · ${money(expense.amount)} on ${expense.paymentDate}`, expense.id);
    saveState();
    document.getElementById('app-modal')?.close();
    render();
    toast(`✓ Expense ${expense.id} marked as paid`);
    return;
  }
  toast('This form is not available yet');
}

function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  const type = button.dataset.partyType;

  if (!canPerformAction(action, button)) { toast('Your account does not have permission to perform that action'); return; }
  if (button.dataset.deleteMode) {
    document.getElementById('app-modal')?.close();
  }

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
      else if (kind === 'expense') { expenseDateFrom = from; expenseDateTo = to; }
      closeDateFilterPortal();
      button.closest('details')?.removeAttribute('open');
      render();
      break;
    }
    case 'clear-sales-filters':
      salesStatusFilter = ''; salesPaymentFilter = ''; salesDeliveryFilter = ''; salesDateFrom = ''; salesDateTo = '';
      render();
      break;
    case 'new-product': openProductForm(); break;
    case 'edit-product': openProductForm(state.products.find(p => p.id === id)); break;
    case 'new-expense': openExpenseForm(); break;
    case 'edit-expense': {
      const exp = (state.expenses || []).find(e => e.id === id);
      if (exp) openExpenseForm(exp);
      break;
    }
    case 'view-expense': {
      const exp = (state.expenses || []).find(e => e.id === id);
      if (exp) openExpenseDetail(exp);
      break;
    }
    case 'mark-expense-paid': {
      const exp = (state.expenses || []).find(e => e.id === id);
      if (exp) openMarkExpensePaidDialog(exp);
      break;
    }
    case 'delete-expense': {
      const exp = (state.expenses || []).find(e => e.id === id);
      if (!exp) break;
      if (!button.dataset.deleteMode) {
        openDeleteChoice(button, `Delete expense ${exp.id}?`, `${exp.forWhom} — ${exp.purpose} (${money(exp.amount)}). Move to Trash or permanently erase it.`, 'Move to Trash', 'Erase permanently');
        break;
      }
      if (button.dataset.deleteMode === 'keep-history' && typeof archiveToTrashBin === 'function') {
        archiveToTrashBin(state, 'Expense', { expense: exp }, exp.id, currentWorkspaceUser().name);
      }
      state.expenses = (state.expenses || []).filter(e => e.id !== id);
      recordActivity('Expense deleted', `${exp.forWhom} · ${exp.purpose} · ${money(exp.amount)}`, id);
      saveState();
      render();
      toast(button.dataset.deleteMode === 'keep-history' ? 'Expense moved to Trash' : 'Expense permanently deleted');
      break;
    }
    case 'export-expenses': {
      const list = Array.isArray(state.expenses) ? state.expenses : [];
      downloadCSV(`tide-expenses-${today()}.csv`, [
        ['Reference', 'Date', 'For Whom', 'Purpose', 'Notes', 'Amount', 'Status', 'Payment Date', 'Payment Method', 'Attachments', 'Recorded By'],
        ...list.map(e => [
          e.id, e.date || '', e.forWhom || '', e.purpose || '', e.notes || '',
          Number(e.amount) || 0, e.paid ? 'Paid' : 'Unpaid', e.paymentDate || '',
          e.paymentMethod || '', (e.attachments || []).length, e.createdBy || ''
        ])
      ]);
      toast('Expenses exported to CSV');
      break;
    }
    case 'new-party': openPartyForm(type || 'Customer'); break;
    case 'edit-party': { const partyType = type === 'Supplier' ? 'Supplier' : 'Customer', list = partyType === 'Supplier' ? state.suppliers : state.customers, party = list.find(item => item.name === button.dataset.partyName); if (party) openPartyForm(partyType, party); break; }
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
    case 'view-party-orders': openPartyOrderHistory(type, button.dataset.partyName); break;
    case 'toggle-party': {
      const partyType = type === 'Supplier' ? 'Supplier' : 'Customer', list = partyType === 'Supplier' ? state.suppliers : state.customers, party = list.find(item => item.name === button.dataset.partyName);
      if (!party) break;
      if (!userHasPermission(partyType === 'Supplier' ? 'suppliers' : 'customers', 'activate')) { toast(`You do not have permission to activate or deactivate ${partyType.toLowerCase()} accounts`); break; }
      party.status = party.status === 'Inactive' ? 'Active' : 'Inactive';
      recordActivity(`${partyType} ${party.status === 'Active' ? 'activated' : 'deactivated'}`, party.name, party.id);
      saveState(); render(); toast(`${partyType} ${party.name} ${party.status === 'Active' ? 'activated' : 'deactivated'}`); break;
    }
    case 'new-order': openOrderForm(); break;
    case 'edit-order': { const order = state.orders.find(item => item.id === id); if (order) openOrderForm(order); break; }
    case 'record-payment': if (document.getElementById('app-modal')?.open) document.getElementById('app-modal').close(); openPaymentForm(type || '', button.dataset.partyName || ''); break;
    case 'reconcile-account': if (document.getElementById('app-modal')?.open) document.getElementById('app-modal').close(); openAccountReconcile(type, button.dataset.partyName || ''); break;
    case 'view-account-ledger': if (document.getElementById('app-modal')?.open) document.getElementById('app-modal').close(); openAccountLedger(type, button.dataset.partyName || ''); break;
    case 'new-purchase': openPurchaseForm(); break;
    case 'edit-purchase': { const purchase = state.purchases.find(item => item.id === id); if (purchase) openPurchaseForm(purchase); break; }
    case 'select-transaction-product': addTransactionProduct(button.dataset.kind, button.dataset.id); break;
    case 'remove-transaction-product': {
      const host = button.closest('.transaction-product-line')?.parentElement;
      const kind = host?.id === 'order-product-lines' ? 'order' : 'purchase';
      button.closest('.transaction-product-line')?.remove();
      if (host && !host.querySelector('.transaction-product-line')) host.innerHTML = '<div class="transaction-empty">Search and select products to add them to this order.</div>';
      updateTransactionLines(kind); break;
    }
    case 'purchase-payment': {
      const purchase = state.purchases.find(p => p.id === id); if (!purchase) break;
      openDialog('purchase-payment', 'Add supplier payment', `Record a payment for ${esc(purchase.id)} to ${esc(purchase.supplier)}.`, `${inputField('purchase-payment-amount', 'Amount (TZS)', '', 'number', true, Math.max(0, purchase.total - (purchase.paid || 0) - (purchase.returned || 0)))}${selectField('purchase-payment-method', 'Method', ['Cash', 'M-Pesa', 'Bank transfer', 'Card'])}${renderAttachmentUploader([], 'purchase-payment')}`, 'Record payment');
      document.getElementById('modal-content').dataset.recordId = id; break;
    }
    case 'view-purchase': {
      const purchase = state.purchases.find(p => p.id === id);
      if (!purchase) break;
      const net = Math.max(0, purchase.total - (purchase.returned || 0));
      const due = Math.max(0, net - (purchase.paid || 0));
      const paymentStatus = (purchase.paid || 0) >= net ? 'Fully paid' : purchase.paid ? 'Partially paid' : 'Due';
      const lines = (purchase.lines || []).map(l => {
        const p = state.products.find(x => x.id === l.productId);
        const prodName = p?.name || l.product || l.productId;
        return `<tr>
          <td><strong>${esc(prodName)}</strong></td>
          <td>${l.qty}</td>
          <td>${money(l.unitCost ?? p?.cost ?? 0)}</td>
          <td>${money(l.qty * (l.unitCost ?? p?.cost ?? 0))}</td>
        </tr>`;
      }).join('') || emptyRow(4, 'No line items');

      const attsHTML = renderAttachmentsGallery(purchase.attachments || [], { scope: 'purchase', recordId: purchase.id, canAdd: true });

      openModal('Purchase order details', `${esc(purchase.id)} · ${esc(purchase.supplier)} · ${esc(purchase.status)}`,
        `<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Unit cost</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:8px">
          <p style="margin:0"><strong>Total ${money(purchase.total)} · Paid ${money(purchase.paid || 0)}${due > 0 ? ` · <span style="color:${paymentStatus === 'Partially paid' ? '#d97706' : '#dc2626'}">Due ${money(due)}</span>` : ''} · ${paymentStatus}</strong> · Method: <span class="status-pill status-paid" style="font-size:11px;padding:2px 8px">${esc(purchase.paymentMethod || 'Cash')}</span></p>
          ${purchase.status === 'Pending' ? `<button class="button small primary" data-action="receive-purchase" data-id="${esc(purchase.id)}">Receive stock</button>` : ''}
        </div>
        <div style="margin-top:16px">${attsHTML}</div>`,
        'Close'
      );
      break;
    }
    case 'return-purchase': openPurchaseReturn(id); break;
    case 'new-user':
      openDialog('new-user', 'Add user', 'Create the user profile, assigned branch, and personal login together.', `<div class="form-grid">${inputField('user-name', 'Full name', '', 'text', true)}${branchSelectField('user-branch', 'Assigned branch', activeBranch.id, accessibleBranches())}${inputField('user-username', 'Username', 'Choose a unique username', 'text', true)}${inputField('user-email', 'Email', 'name@example.com', 'email', true)}${inputField('user-phone', 'Phone', '', 'tel')}${inputField('user-password', 'Password', 'At least 8 characters', 'password', true)}${inputField('user-password-confirm', 'Confirm password', 'Re-enter password', 'password', true)}${selectField('user-role', 'Role', ['Salesman', 'Storekeeper', 'Manager', 'Owner / Administrator'], 'Salesman')}</div>`, 'Create account'); break;
    case 'edit-user': { const user = state.users.find(item => item.id === id); openUserEditForm(user); break; }
    case 'view-user-activity': { const user = state.users.find(item => item.id === id); openUserActivityHistory(user); break; }
    case 'set-user-credentials': { const user = state.users.find(item => item.id === id); openUserCredentialsForm(user); break; }
    case 'my-account': openOwnCredentialsForm(); break;
    case 'logout': logout(); break;
    case 'lock-screen': lockScreen('manual'); break;
    case 'unlock-switch-account': clearScreenLock(); logout(); break;
    case 'edit-user-permissions': { const user = state.users.find(item => item.id === id); openUserPermissionsForm(user); break; }
    case 'toggle-user': {
      const user = state.users.find(u => u.id === id); if (!user || user.isBootstrap) { toast('The owner account cannot be deactivated'); break; }
      user.status = user.status === 'Active' ? 'Inactive' : 'Active';
      if (typeof registerAccountInDirectory === 'function') registerAccountInDirectory(user, getActiveWorkspaceId(), state.companyName).catch(() => {});
      recordActivity(`User ${user.status.toLowerCase()}`, user.name, user.id); saveState(); render(); toast(`User ${user.status.toLowerCase()}`); break;
    }
    case 'delete-user': {
      if (!isWorkspaceAdministrator()) { toast('Only an Owner / Administrator can permanently delete users'); break; }
      const user = state.users.find(item => item.id === id);
      if (!user || user.isBootstrap || isAdministratorUser(user)) { toast('Owner / Administrator accounts cannot be deleted'); break; }
      if (!button.dataset.deleteMode) { openDeleteChoice(button, `Delete user ${user.name}?`, 'Keep the user’s activity and stock history, or erase the user account and its audit trail.', 'Delete user, keep records', 'Erase user and audit trail'); break; }
      state.users = state.users.filter(item => item.id !== user.id);
      if (typeof removeAccountFromDirectory === 'function') removeAccountFromDirectory(user).catch(() => {});
      if (state.currentUserId === user.id) {
        const builtInOwner = state.users.find(item => item.isBootstrap && item.status === 'Active');
        const nextAdmin = state.users.find(item => item.role === 'Owner / Administrator' && item.status === 'Active');
        const nextActive = state.users.find(item => item.status === 'Active');
        state.currentUserId = (builtInOwner || nextAdmin || nextActive)?.id || '';
        if (state.currentUserId) { const nextUser = state.users.find(item => item.id === state.currentUserId); safeSessionSet(AUTH_SESSION_KEY, JSON.stringify({ id: nextUser.id, passwordHash: nextUser.passwordHash })); } else safeSessionRemove(AUTH_SESSION_KEY);
      }
      if (button.dataset.deleteMode === 'erase-all') {
        state.activityLog = (state.activityLog || []).filter(item => item.actor !== user.name);
        (state.stockMovements || []).forEach(m => { if (m.user === user.name) m.user = `${user.name} (deleted)`; });
      } else recordActivity('User deleted', `${user.name} · existing records retained`, user.id);
      saveState(); render(); toast(button.dataset.deleteMode === 'erase-all' ? `User ${user.name} and audit trail erased` : `User ${user.name} deleted; existing records were kept`); break;
    }
    case 'new-branch': openDialog('new-branch', 'Add branch', 'Create an independent workspace for another location.', inputField('branch-name', 'Branch name', 'e.g. Arusha branch', 'text', true)); break;
    case 'finalize-order': {
      const order = state.orders.find(o => o.id === id); if (!order || order.status !== 'Draft') break;
      if (finalizeSalesOrder(order)) toast('Order finalized and invoice created');
      break;
    }
    case 'view-order': {
      const order = salesOrderRows().find(o => o.id === id); if (!order) break;
      const discrepancies = order.discrepancies || [];
      const lines = (order.items || []).map(l => {
        const p = state.products.find(x => x.id === l.productId);
        const prodName = p?.name || l.product || l.productName || l.productId;
        const lineIssues = discrepancies.filter(d => d.productId === l.productId || d.productName === prodName);
        const issueBadges = lineIssues.map(d => `<div class="line-issue-tag">⚠️ ${esc(d.typeLabel || d.type)}: ${esc(d.note || d.status)}</div>`).join('');
        return `<tr>
          <td>
            <strong>${esc(prodName)}</strong>
            ${issueBadges}
          </td>
          <td>${l.qty}</td>
          <td>${money(l.unitPrice ?? p?.price ?? 0)}</td>
          <td>${money(l.qty * (l.unitPrice ?? p?.price ?? 0))}</td>
        </tr>`;
      }).join('');

      let issuesBox = '';
      if (discrepancies.length > 0) {
        const issueItems = discrepancies.map(d => `
          <div style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.08);display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <strong>${esc(d.typeLabel || d.type)}</strong>: ${esc(d.productName || 'Order item')}
              <div style="font-size:11.5px;color:#64748b;margin-top:2px">
                ${d.orderedQty != null && d.deliveredQty != null ? `Ordered: <strong>${d.orderedQty}</strong> · Delivered: <strong>${d.deliveredQty}</strong> · Discrepancy: <strong style="color:#b91c1c">${d.shortageQty ?? (d.orderedQty - d.deliveredQty)}</strong>` : ''}
                ${d.substitutedProduct ? ` · Sent instead: <em>${esc(d.substitutedProduct)}</em>` : ''}
                ${d.note ? ` · Note: "${esc(d.note)}"` : ''}
              </div>
            </div>
            <span class="status-pill ${d.status === 'Resolved' ? 'status-paid' : 'status-issue'}" style="white-space:nowrap;font-size:11px">${esc(d.status || 'Action Required')}</span>
          </div>
        `).join('');
        issuesBox = `
          <div class="order-issues-box">
            <div class="order-issues-head">
              <span>⚠️ Reported Delivery Mistakes (${discrepancies.length})</span>
              <button class="button small" data-action="manage-delivery-issues" data-id="${esc(order.id)}" style="font-size:11px;padding:3px 8px">Manage mistakes</button>
            </div>
            ${issueItems}
          </div>
        `;
      }

      const orderDue = Math.max(0, Number(order.total || 0) - Number(order.paid || 0));
      const orderPayStatus = orderPaymentStatus(order);
      const attsHTML = renderAttachmentsGallery(order.attachments || [], { scope: 'order', recordId: order.id, canAdd: true });
      openModal('Order details', `${esc(order.id)} · ${esc(order.customer)} · ${esc(order.status)}`,
        `${issuesBox}
        <div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:8px">
          <p style="margin:0"><strong>Total ${money(order.total)} · Paid ${money(order.paid || 0)}${orderDue > 0 ? ` · <span style="color:${orderPayStatus === 'Partially paid' ? '#d97706' : '#dc2626'}">Due ${money(orderDue)}</span>` : ''} · ${orderPayStatus}</strong> · Method: <span class="status-pill ${methodPillClass(order)}" style="font-size:11px;padding:2px 8px">${esc(orderPaymentMethodLabel(order))}</span></p>
          <button class="button small" data-action="manage-delivery-issues" data-id="${esc(order.id)}">⚠️ Highlight / Manage Delivery Mistakes</button>
        </div>
        <div style="margin-top:16px">${attsHTML}</div>`,
        'Close'
      );
      break;
    }
    case 'view-attachment': {
      const attId = button.dataset.attId;
      if (!attId) break;
      const found = findAttachmentById(attId);
      if (found) openAttachmentViewer(found.attachment || found);
      else toast('Attachment not found');
      break;
    }
    case 'download-attachment': {
      const attId = button.dataset.attId;
      if (!attId) break;
      const found = findAttachmentById(attId);
      const att = found?.attachment || found;
      if (att) {
        downloadAttachment(att);
        toast(`Downloading ${att.name}`);
      } else toast('Attachment not found');
      break;
    }
    case 'delete-attachment': {
      const attId = button.dataset.attId;
      const recordId = button.dataset.recordId;
      const scope = button.dataset.scope;
      if (!attId) break;
      const draftIdx = currentDraftAttachments.findIndex(a => a.id === attId);
      if (draftIdx >= 0) {
        const removed = currentDraftAttachments.splice(draftIdx, 1)[0];
        const list = document.getElementById('attachments-list');
        if (list) {
          list.classList.toggle('is-empty', !currentDraftAttachments.length);
          list.innerHTML = renderAttachmentCards(currentDraftAttachments, { allowDelete: true });
        }
        toast(`Removed ${removed.name}`);
        break;
      }
      if (recordId && scope) {
        let target = null;
        if (scope === 'order') target = state.orders.find(o => o.id === recordId) || state.sales.find(s => s.id === recordId);
        else if (scope === 'purchase') target = state.purchases.find(p => p.id === recordId);
        else if (scope === 'entry') target = state.entries.find(e => e.id === recordId);
        else if (scope === 'expense') target = (state.expenses || []).find(e => e.id === recordId);
        if (target && Array.isArray(target.attachments)) {
          const idx = target.attachments.findIndex(a => a.id === attId);
          if (idx >= 0) {
            const removed = target.attachments.splice(idx, 1)[0];
            saveState();
            recordActivity('Attachment removed', `${removed.name} · ${target.id}`, target.id);
            const list = document.getElementById(`gallery-attachments-list-${recordId}`);
            if (list) {
              list.classList.toggle('is-empty', !target.attachments.length);
              list.innerHTML = renderAttachmentCards(target.attachments, { allowDelete: true, recordId, scope }) ||
                `<div class="attachments-empty-state"><span style="font-size:24px">📄</span><p>No documents attached to this record yet.</p></div>`;
            }
            toast(`Removed ${removed.name}`);
          }
        }
      }
      break;
    }
    case 'view-entry-attachments': {
      const entryId = button.dataset.id;
      const entry = state.entries.find(e => e.id === entryId);
      if (!entry) break;
      openModal(`Receipts & Payment Slips · ${esc(entry.id)}`, `${esc(entry.partyType)} · ${esc(entry.party)} · ${money(entry.amount)}`,
        `<div style="margin-bottom:12px;background:var(--surface,#f1f5f9);padding:10px 14px;border-radius:8px">
           <p style="margin:0 0 4px"><strong>Date:</strong> ${dateLabel(entry.date)} · <strong>Direction:</strong> ${esc(entry.type)} · <strong>Amount:</strong> ${money(entry.amount)}</p>
           <p style="margin:0;font-size:12px;color:var(--muted)"><strong>Note:</strong> ${esc(entry.memo || '—')}</p>
         </div>
         ${renderAttachmentsGallery(entry.attachments || [], { scope: 'entry', recordId: entry.id, canAdd: true })}`,
        'Close'
      );
      break;
    }
    case 'manage-delivery-issues': {
      openOrderDiscrepancies(id);
      break;
    }
    case 'toggle-discrepancy-status': {
      const orderId = button.dataset.id;
      const discId = button.dataset.discId;
      let order = state.orders.find(o => o.id === orderId);
      if (!order) {
        const sale = state.sales.find(s => s.id === orderId || s.orderId === orderId);
        if (sale) order = state.orders.find(o => o.id === sale.orderId || o.invoiceId === sale.id) || sale;
      }
      if (!order || !Array.isArray(order.discrepancies)) break;
      const disc = order.discrepancies.find(d => d.id === discId);
      if (!disc) break;
      disc.status = (disc.status === 'Resolved') ? 'Action Required' : 'Resolved';

      if (order.invoiceId) {
        const inv = state.sales.find(s => s.id === order.invoiceId);
        if (inv) inv.discrepancies = order.discrepancies;
      }
      recordActivity('Delivery mistake status updated', `${disc.typeLabel} on ${order.id} marked ${disc.status}`, order.id);
      saveState();
      openOrderDiscrepancies(order.id);
      toast(`Status updated to "${disc.status}"`);
      break;
    }
    case 'delete-discrepancy': {
      const orderId = button.dataset.id;
      const discId = button.dataset.discId;
      let order = state.orders.find(o => o.id === orderId);
      if (!order) {
        const sale = state.sales.find(s => s.id === orderId || s.orderId === orderId);
        if (sale) order = state.orders.find(o => o.id === sale.orderId || o.invoiceId === sale.id) || sale;
      }
      if (!order || !Array.isArray(order.discrepancies)) break;
      order.discrepancies = order.discrepancies.filter(d => d.id !== discId);
      if (order.invoiceId) {
        const inv = state.sales.find(s => s.id === order.invoiceId);
        if (inv) inv.discrepancies = order.discrepancies;
      }
      recordActivity('Delivery mistake removed', `Discrepancy ${discId} removed from ${order.id}`, order.id);
      saveState();
      openOrderDiscrepancies(order.id);
      toast('Delivery mistake record removed');
      break;
    }
    case 'add-order-payment': openOrderPayment(id); break;
    case 'manage-order-returns': openOrderReturn(id); break;
    case 'delete-order': {
      const order = state.orders.find(o => o.id === id); if (!order) break;
      const adminOverride = isWorkspaceAdministrator() && order.status !== 'Draft';
      if (order.status !== 'Draft' && !adminOverride) { toast('Only the Owner / Administrator can override deletion of a finalized order'); break; }
      if (!button.dataset.deleteMode) { openDeleteChoice(button, `Delete sales order ${id}?`, adminOverride ? 'Choose whether to move the order bundle to Trash or permanently erase its invoice, account entries, returns, and stock impact.' : 'Choose whether to move the draft to Trash or permanently erase it.', 'Move bundle to Trash', 'Erase everything'); break; }
      const invoice = state.sales.find(sale => sale.id === order.invoiceId || sale.orderId === order.id);
      const returns = state.returns.filter(record => record.saleId === (order.invoiceId || order.id));
      const entryMatches = entry => ['order', 'order-payment', 'sales', 'sales-payment'].includes(entry.sourceType) && [order.id, order.invoiceId].includes(entry.sourceId);
      const accountEntries = state.entries.filter(entryMatches);
      if (button.dataset.deleteMode === 'keep-history') archiveToTrashBin(state, order.source === 'POS' ? 'POS sale' : 'Sales order', { order, invoice, returns, accountEntries }, order.id, currentWorkspaceUser().name);
      if (adminOverride) {
        const restocked = new Map(); for (const ret of returns) if (ret.restocked) restocked.set(ret.productId, (restocked.get(ret.productId) || 0) + (Number(ret.qty) || 0));
        for (const line of order.items || []) { const product = state.products.find(p => p.id === line.productId); if (!product) continue; const qty = Math.max(0, (Number(line.qty) || 0) - (restocked.get(line.productId) || 0)); if (!qty) continue; const before = product.stock; product.stock += qty; state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId: product.id, product: product.name, date: today(), before, after: product.stock, delta: qty, reason: `Admin deleted sale ${id}`, user: currentWorkspaceUser().name }); }
        state.sales = state.sales.filter(sale => sale.id !== invoice?.id && sale.orderId !== order.id);
        for (const entry of state.entries) if (entry.sourceType === 'account-payment' && Array.isArray(entry.allocations)) entry.allocations = entry.allocations.filter(allocation => allocation.orderId !== order.id);
      }
      removeAccountEntries(entryMatches); state.returns = state.returns.filter(record => !returns.some(ret => ret.id === record.id));
      if (!adminOverride && invoice) state.sales = state.sales.filter(sale => sale.id !== invoice.id);
      state.orders = state.orders.filter(o => o.id !== id); recordActivity(adminOverride ? 'Finalized sales order deleted by administrator' : 'Draft sales order deleted', id, id); saveState(); render(); toast(button.dataset.deleteMode === 'keep-history' ? 'Order bundle moved to Trash' : adminOverride ? 'Finalized order and linked records erased' : 'Draft order permanently erased'); break;
    }
    case 'receive-purchase': {
      const purchase = state.purchases.find(p => p.id === id); if (!purchase || purchase.status !== 'Pending') break;
      const changedProducts = [];
      for (const line of purchase.lines || []) {
        const product = state.products.find(p => p.id === line.productId);
        if (product) {
          const before = product.stock;
          const qty = Number(line.qty) || 0;
          product.stock += qty;
          const unitCost = Number(line.unitCost) || 0;
          if (unitCost > 0 && product.stock > 0) {
            const oldVal = before * (Number(product.cost) || 0);
            const newVal = qty * unitCost;
            product.cost = Math.round((oldVal + newVal) / product.stock);
          }
          state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId: product.id, product: product.name, date: today(), before, after: product.stock, delta: product.stock - before, reason: `Received ${purchase.id}`, user: currentWorkspaceUser().name });
          changedProducts.push(product);
        }
      }
      purchase.status = 'Received';
      const existingCredit = (state.entries || []).find(e => e.sourceType === 'purchase' && e.sourceId === purchase.id && e.type === 'Credit');
      if (!existingCredit) {
        postAccountEntry({ partyType: 'Supplier', party: purchase.supplier, date: today(), type: 'Credit', amount: purchase.total, memo: `Received purchase · ${purchase.id}`, sourceType: 'purchase', sourceId: purchase.id });
      }
      recordActivity('Purchase order received', `${purchase.supplier} · ${purchase.lines.length} product lines`, purchase.id);
      saveState();
      if (changedProducts.length) syncProductsBatchToCloud(changedProducts);
      render(); toast('Purchase received, stock & cost updated'); break;
    }
    case 'delete-purchase': {
      const purchase = state.purchases.find(p => p.id === id); if (!purchase) break;
      const adminOverride = isWorkspaceAdministrator() && purchase.status === 'Received';
      if (purchase.status === 'Received' && !adminOverride) { toast('Only the Owner / Administrator can override deletion of a received purchase'); break; }
      if (!button.dataset.deleteMode) { openDeleteChoice(button, `Delete purchase ${id}?`, adminOverride ? 'Choose whether to move the purchase bundle to Trash or permanently erase its account entries, returns, and stock impact.' : 'Choose whether to move the purchase to Trash or permanently erase its account entries.', 'Move bundle to Trash', 'Erase everything'); break; }
      const returns = (state.purchaseReturns || []).filter(record => record.purchaseId === id || record.purchaseOrderId === id);
      const accountEntries = state.entries.filter(entry => ['purchase', 'purchase-payment'].includes(entry.sourceType) && entry.sourceId === id);
      if (button.dataset.deleteMode === 'keep-history') archiveToTrashBin(state, 'Purchase order', { purchase, returns, accountEntries }, id, currentWorkspaceUser().name);
      if (adminOverride) {
        const returnedByProduct = new Map(); for (const ret of returns) returnedByProduct.set(ret.productId, (returnedByProduct.get(ret.productId) || 0) + (Number(ret.qty) || 0));
        for (const line of purchase.lines || []) { const product = state.products.find(p => p.id === line.productId); if (!product) continue; const before = product.stock, qty = Math.max(0, (Number(line.qty) || 0) - (returnedByProduct.get(line.productId) || 0)); if (!qty) continue; product.stock = Math.max(0, product.stock - qty); state.stockMovements.unshift({ id: idFor('STK', state.stockMovements), productId: product.id, product: product.name, date: today(), before, after: product.stock, delta: product.stock - before, reason: `Admin deleted received purchase ${id}`, user: currentWorkspaceUser().name }); }
      }
      removeAccountEntries(entry => ['purchase', 'purchase-payment'].includes(entry.sourceType) && entry.sourceId === id); state.purchaseReturns = (state.purchaseReturns || []).filter(record => !returns.some(ret => ret.id === record.id));
      state.purchases = state.purchases.filter(p => p.id !== id); recordActivity(adminOverride ? 'Received purchase deleted by administrator' : 'Purchase order deleted', id, id); saveState(); render(); toast(button.dataset.deleteMode === 'keep-history' ? 'Purchase bundle moved to Trash' : adminOverride ? 'Received purchase and linked records erased' : 'Purchase order permanently erased'); break;
    }
    case 'export-parties': {
      const list = type === 'Supplier' ? state.suppliers : state.customers;
      downloadCSV(type === 'Supplier' ? 'tide-suppliers.csv' : 'tide-customers.csv', type === 'Supplier' ? [['Name', 'Phone', 'Email', 'Terms', 'Balance', 'Status'], ...list.map(p => [p.name, p.phone, p.email, p.terms, p.balance, p.status])] : [['Name', 'Phone', 'Email', 'Terms', 'Credit limit', 'Balance', 'Status'], ...list.map(p => [p.name, p.phone, p.email, p.terms, p.creditLimit || 0, p.balance, p.status])]); break;
    }
    case 'download-product-template':
      downloadCSV('tide-product-template.csv', [
        ['SKU', 'Name', 'Category', 'Selling Price', 'Unit Cost', 'Stock', 'Low stock', 'Unit', 'Expiry Date', 'Batch'],
        ['SKU-1001', 'Maize Flour 1kg', 'Food & Grains', '2500', '1800', '50', '10', 'Piece', '2026-12-31', 'BATCH-001'],
        ['SKU-1002', 'Fresh Whole Milk 500ml', 'Dairy', '1500', '1100', '35', '5', 'Piece', '2026-11-25', 'LOT-DAIRY-02']
      ]);
      toast('Product template downloaded with pricing and expiration sample rows');
      break;
    case 'remove-company-logo': state.companyLogo = ''; saveState(); render(); toast('Company logo removed'); break;
    case 'product-stock-history': {
      const product = state.products.find(p => p.id === id); if (!product) break;
      const rows = state.stockMovements.filter(m => m.productId === id).map(m => `<tr><td>${dateLabel(m.date)}</td><td>${esc(m.reason)}</td><td>${m.before}</td><td>${m.after}</td><td>${m.delta > 0 ? '+' : ''}${m.delta}</td></tr>`).join('') || emptyRow(5, 'No stock movements recorded');
      openModal('Stock history', product.name, `<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Reason</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table></div>`, 'Close'); break;
    }
    case 'adjust-stock': {
      const product = state.products.find(p => p.id === id); if (!product) break;
      openDialog('adjust-stock', 'Adjust stock', `Set the new on-hand quantity for ${esc(product.name)}.`, `${inputField('stock-new-quantity', 'New quantity', '', 'number', true, product.stock)}${inputField('stock-reason', 'Reason', 'e.g. Count correction')}`, 'Save adjustment');
      document.getElementById('modal-content').dataset.recordId = id; break;
    }
    case 'bulk-stock-adjust': {
      if (!state.products.length) { toast('Add products to Inventory before adjusting stock'); break; }
      const options = state.products.map(p => `${p.id} · ${p.name}`);
      openDialog('bulk-adjust-stock', 'Bulk stock adjustment', 'Select a product and enter its verified on-hand count.', `${selectField('bulk-product', 'Product', options)}${inputField('bulk-quantity', 'Counted / new quantity', '', 'number', true)}${inputField('stock-reason', 'Reason', 'e.g. Damaged goods correction')}`, 'Save stock'); break;
    }
    case 'bulk-stocktake':
    case 'open-stocktake':
    case 'resume-stocktake': {
      openStocktakeDialog();
      break;
    }
    case 'pause-stocktake': {
      pauseStocktakeSession();
      break;
    }
    case 'discard-stocktake-draft': {
      if (confirm('Discard in-progress stock take draft? Unapplied physical counts will be erased.')) {
        state.stocktakeDraft = null;
        saveState();
        render();
        document.getElementById('app-modal')?.close();
        toast('Stock take draft discarded');
      }
      break;
    }
    case 'stocktake-remove-item': {
      const row = button.closest('tr[data-product-id]');
      if (row) {
        row.remove();
        updateStocktakeStats();
        autoSaveStocktakeDraft();
      }
      break;
    }
    case 'stocktake-add-all': {
      stocktakeAddAllActiveProducts();
      break;
    }
    case 'stocktake-fill-current': {
      stocktakeFillCurrentStock();
      break;
    }
    case 'stocktake-clear-all': {
      stocktakeClearAllCounts();
      break;
    }
    case 'stocktake-pick-product': {
      stocktakeAddSingleProduct(button.dataset.id || button.closest('[data-id]')?.dataset.id);
      break;
    }
    case 'set-report-tab': {
      reportActiveTab = button.dataset.tab || 'overview';
      render();
      break;
    }
    case 'view-stocktake-session': {
      viewStocktakeSession(button.dataset.id || id);
      break;
    }
    case 'edit-stocktake-session': {
      openEditStocktakeModal(button.dataset.id || id);
      break;
    }
    case 'revoke-stocktake-session': {
      if (!isWorkspaceAdministrator()) { toast('Administrator privileges required'); break; }
      const sessionRef = button.dataset.id || id;
      const st = (state.stocktakes || []).find(s => s.id === sessionRef);
      if (!st) { toast('Stock take record not found'); break; }
      if (st.status === 'Revoked') { toast('This stock take session has already been revoked'); break; }
      if (!confirm(`Are you sure you want to REVOKE stock take session ${st.id}?\n\nThis will reverse all physical count adjustments back to their initial balances and record compensating adjustment entries.`)) break;

      for (const item of st.items || []) {
        const delta = Number(item.delta || 0);
        if (delta !== 0) {
          const p = state.products.find(prod => prod.id === item.productId);
          if (p) {
            const before = p.stock;
            p.stock = Math.max(0, p.stock - delta);
            state.stockMovements.unshift({
              id: idFor('STK', state.stockMovements),
              productId: p.id,
              product: p.name,
              date: today(),
              before,
              after: p.stock,
              delta: -delta,
              reason: `Revoked stock take session ${st.id}`,
              user: currentWorkspaceUser().name
            });
          }
        }
      }

      st.status = 'Revoked';
      st.revokedAt = new Date().toISOString();
      st.revokedBy = currentWorkspaceUser().name;

      recordActivity('Stock take revoked', `Revoked all quantity adjustments for session ${st.id}`, st.id);
      saveState();
      document.getElementById('app-modal')?.close();
      render();
      toast(`Stock take session ${st.id} revoked and stock reversed!`);
      break;
    }
    case 'delete-stocktake-session': {
      if (!isWorkspaceAdministrator()) { toast('Administrator privileges required'); break; }
      const sessionRef = button.dataset.id || id;
      const st = (state.stocktakes || []).find(s => s.id === sessionRef);
      if (!st) { toast('Stock take record not found'); break; }
      if (!confirm(`Permanently delete stock take audit session ${st.id}?`)) break;

      let revertStock = false;
      if (st.status !== 'Revoked') {
        revertStock = confirm(`Revert product stock quantities back to their pre-audit balances?\n\nOK = Revert stock balances\nCancel = Keep stock as is and delete record only`);
      }

      if (revertStock) {
        for (const item of st.items || []) {
          const delta = Number(item.delta || 0);
          if (delta !== 0) {
            const p = state.products.find(prod => prod.id === item.productId);
            if (p) p.stock = Math.max(0, p.stock - delta);
          }
        }
      }

      archiveToTrashBin(state, 'Stock take', st, `Stock take ${st.id} (${st.reason})`, currentWorkspaceUser().name);
      state.stocktakes = state.stocktakes.filter(s => s.id !== st.id);
      recordActivity('Stock take deleted', `Deleted session ${st.id}${revertStock ? ' (stock reverted)' : ''}`, st.id);
      saveState();
      document.getElementById('app-modal')?.close();
      render();
      toast(`Stock take session ${st.id} deleted (archived to Trash)`);
      break;
    }
    case 'edit-stock-movement': {
      openEditStockMovementModal(button.dataset.id || id);
      break;
    }
    case 'revoke-stock-movement': {
      if (!isWorkspaceAdministrator()) { toast('Administrator privileges required'); break; }
      const moveId = button.dataset.id || id;
      const m = (state.stockMovements || []).find(item => item.id === moveId);
      if (!m) { toast('Stock movement record not found'); break; }
      if (m.status === 'Revoked') { toast('This adjustment has already been revoked'); break; }
      const delta = Number(m.delta || 0);
      if (delta === 0) { toast('This movement has no quantity variance to reverse'); break; }
      if (!confirm(`Revoke stock adjustment ${m.id} for ${m.product}?\n\nThis will reverse the ${delta > 0 ? '+' : ''}${delta} stock change.`)) break;

      const p = state.products.find(prod => prod.id === m.productId || prod.name === m.product);
      if (p) {
        const before = p.stock;
        p.stock = Math.max(0, p.stock - delta);
        state.stockMovements.unshift({
          id: idFor('STK', state.stockMovements),
          productId: p.id,
          product: p.name,
          date: today(),
          before,
          after: p.stock,
          delta: -delta,
          reason: `Revocation of ${m.id} (${m.reason || 'adjustment'})`,
          user: currentWorkspaceUser().name
        });
      }

      m.status = 'Revoked';
      m.revokedAt = new Date().toISOString();
      m.revokedBy = currentWorkspaceUser().name;

      recordActivity('Stock adjustment revoked', `Revoked adjustment ${m.id} for ${m.product}`, m.id);
      saveState();
      render();
      toast(`Adjustment ${m.id} revoked and stock reversed!`);
      break;
    }
    case 'delete-stock-movement': {
      if (!isWorkspaceAdministrator()) { toast('Administrator privileges required'); break; }
      const moveId = button.dataset.id || id;
      const m = (state.stockMovements || []).find(item => item.id === moveId);
      if (!m) { toast('Stock movement record not found'); break; }
      if (!confirm(`Delete adjustment record ${m.id}?`)) break;

      let revertStock = false;
      if (m.status !== 'Revoked' && Number(m.delta || 0) !== 0) {
        revertStock = confirm(`Revert the ${Number(m.delta) > 0 ? '+' : ''}${m.delta} stock quantity change for ${m.product}?\n\nOK = Revert stock\nCancel = Keep stock as is and delete record only`);
      }

      if (revertStock) {
        const p = state.products.find(prod => prod.id === m.productId || prod.name === m.product);
        if (p) p.stock = Math.max(0, p.stock - Number(m.delta || 0));
      }

      archiveToTrashBin(state, 'Stock movement', m, `Adjustment ${m.id} (${m.product})`, currentWorkspaceUser().name);
      state.stockMovements = state.stockMovements.filter(item => item.id !== m.id);
      recordActivity('Stock movement deleted', `Deleted adjustment ${m.id}${revertStock ? ' (stock reverted)' : ''}`, m.id);
      saveState();
      render();
      toast(`Adjustment record ${m.id} deleted (archived to Trash)`);
      break;
    }
    case 'view-product-sales-history': {
      viewProductSalesHistory(button.dataset.id || id);
      break;
    }
    case 'view-product-purchase-history': {
      viewProductPurchaseHistory(button.dataset.id || id);
      break;
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
      const period = button.dataset.period;
      if (['weekly', 'monthly', 'annual'].includes(period)) { reportPeriod = period; render(); }
      break;
    }
    case 'delete-product': deleteProduct(id, button); break;
    case 'bulk-delete-products': {
      if (!canPerformAction('delete-product')) { toast('You do not have permission to delete products'); break; }
      const ids = [...selectedProductIds];
      if (!ids.length) break;
      if (!button.dataset.deleteMode) {
        openDeleteChoice(button, `Delete ${ids.length} product${ids.length !== 1 ? 's' : ''}?`,
          'Keep sales and purchase history linked to these products, or permanently erase all linked transactions.',
          'Delete products, keep history', 'Erase related transactions');
        break;
      }
      const bulkMode = button.dataset.deleteMode;
      const idSet = new Set(ids);
      const nameById = new Map();
      const toDelete = [];
      for (const p of state.products) {
        if (idSet.has(p.id)) {
          nameById.set(p.id, p.name);
          toDelete.push(p);
        }
      }
      if (!toDelete.length) { selectedProductIds.clear(); render(); break; }

      if (bulkMode === 'erase-all') {
        for (const pid of idSet) eraseProductHistory(pid);
      }
      for (const record of [...state.orders, ...state.sales]) {
        for (const line of record.items || []) {
          if (idSet.has(line.productId) && !line.product && !line.productName) {
            line.product = nameById.get(line.productId) || line.productId;
          }
        }
      }
      for (const purchase of state.purchases) {
        for (const line of purchase.lines || []) {
          if (idSet.has(line.productId) && !line.product && !line.productName) {
            line.product = nameById.get(line.productId) || line.productId;
          }
        }
      }
      if (bulkMode === 'erase-all') {
        state.activityLog = (state.activityLog || []).filter(item => !idSet.has(item.reference));
      }

      // Remove all selected products in a single O(N) pass
      state.products = state.products.filter(p => !idSet.has(p.id));
      recordActivity('Bulk product delete', `${toDelete.length} product${toDelete.length !== 1 ? 's' : ''} removed`);
      selectedProductIds.clear();
      saveState();
      render();

      if (typeof window.TideFirebase?.batchDeleteProducts === 'function') {
        toast(`Deleting ${toDelete.length} product${toDelete.length !== 1 ? 's' : ''} from cloud...`);
        window.TideFirebase.batchDeleteProducts(toDelete, (done, total) => {
          if (total > 450 && done < total) {
            toast(`Deleting products from cloud: ${done} / ${total}...`);
          }
        }).then(res => {
          if (res.failed > 0) {
            toast(`Deleted ${res.deleted}/${res.total} products (${res.failed} failed)`);
          } else {
            toast(bulkMode === 'erase-all'
              ? `✓ ${res.deleted} product${res.deleted !== 1 ? 's' : ''} and related transactions erased across all devices`
              : `✓ ${res.deleted} product${res.deleted !== 1 ? 's' : ''} deleted across all devices; history retained`);
          }
        }).catch(err => {
          console.error('Bulk cloud product delete error:', err);
          toast('Products removed locally; cloud delete will retry when online');
        });
      } else {
        toast(bulkMode === 'erase-all' ? `${toDelete.length} product${toDelete.length !== 1 ? 's' : ''} and related transactions erased` : `${toDelete.length} product${toDelete.length !== 1 ? 's' : ''} deleted; history retained`);
      }
      break;
    }
    case 'open-branch': switchBranch(id); break;
    case 'print-order-invoice': {
      const order = state.orders.find(o => o.id === id) || state.sales.find(s => s.id === id);
      if (order) printOrderInvoice(order);
      break;
    }
    case 'close-modal': currentDraftAttachments = []; document.getElementById('app-modal')?.close(); break;
    case 'export-sales':
      downloadCSV('tide-sales.csv', [
        ['Date', 'Order', 'Customer', 'Total', 'Due amount', 'Payment method', 'Status', 'Payment'],
        ...salesOrderRows().map(r => {
          const due = Math.max(0, Number(r.total || 0) - Number(r.paid || 0));
          const ps = orderPaymentStatus(r);
          const exportDue = (ps === 'Due' || ps === 'Partially paid' || (due > 0 && r.status !== 'Draft')) ? due : 0;
          return [r.date, r.id, r.customer, r.total, exportDue, orderPaymentMethodLabel(r), r.status, ps];
        })
      ]);
      break;
    case 'export-financial-report': {
      const report = reportPeriodData();
      const receivables = accountOutstandingTotal('Customer');
      const payables = accountOutstandingTotal('Supplier');
      const methodTotals = new Map(); report.sales.forEach(sale => { const method = sale.method || 'Other'; methodTotals.set(method, (methodTotals.get(method) || 0) + (Number(sale.total) || 0)); });
      downloadCSV(`tide-financial-${reportPeriod}-${today()}.csv`, [['Report', report.label], ['From', report.start], ['To', report.end], [], ['Measure', 'Amount TZS'], ['Sales revenue', report.salesTotal], ['Customer payments collected', report.collected], ['Purchases ordered', report.purchaseTotal], ['Supplier payments made', report.supplierPaid], ['Net cash movement', report.netCollected], ['Customer receivables', receivables], ['Supplier payables', payables], [], ['Sales by payment method', 'Amount TZS'], ...Array.from(methodTotals)]);
      break;
    }
    case 'export-inventory':
      downloadCSV('tide-inventory.csv', [
        ['SKU', 'Product', 'Category', 'Price TZS', 'Cost TZS', 'Stock', 'Low stock alert', 'Unit', 'Expiry Date', 'Batch / Lot #', 'Status'],
        ...sortProducts(state.products).map(p => [p.id, p.name, p.category, p.price, p.cost, p.stock, p.low, p.unit, p.expiryDate || '', p.batchNumber || '', p.status || 'Active'])
      ]);
      break;
    case 'export-stocktakes': {
      const stocktakes = Array.isArray(state.stocktakes) ? state.stocktakes : [];
      downloadCSV(`tide-stocktakes-${today()}.csv`, [
        ['Session ID', 'Date', 'Auditor', 'Reason', 'Products Counted', 'Matches', 'Shortages', 'Surpluses', 'Net Quantity Delta', 'Net Cost Impact TZS'],
        ...stocktakes.map(s => [
          s.id,
          s.dateStr || s.date?.slice(0, 10),
          s.user || 'Administrator',
          s.reason || '',
          s.countedProducts || s.items?.length || 0,
          s.matchedCount || 0,
          s.shortageCount || 0,
          s.surplusCount || 0,
          s.netQtyDelta || 0,
          s.netValueDelta || 0
        ])
      ]);
      toast('Stock take audit sessions exported to CSV');
      break;
    }
    case 'export-full-backup': {
      const backupData = JSON.stringify(state, null, 2);
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tide-erp-backup-${today()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Full workspace backup downloaded successfully');
      break;
    }
    case 'trigger-restore-backup': {
      document.getElementById('restore-backup-file')?.click();
      break;
    }
    case 'open-cloud-sync-dialog': openCloudSyncDialog(); break;
    case 'force-cloud-sync': {
      toast('Refreshing entire ERP from cloud database...');
      (async () => {
        try {
          if (typeof window.TideFirebase?.initFirebase === 'function') {
            await window.TideFirebase.initFirebase();
          }
          const [cloudModRes, cloudProds] = await Promise.all([
            typeof pullFullCloudState === 'function' ? pullFullCloudState(state, initialState) : Promise.resolve(null),
            typeof window.TideFirebase?.getProducts === 'function' ? window.TideFirebase.getProducts(true) : Promise.resolve(null)
          ]);

          if (cloudModRes?.hydrated && cloudModRes.state) {
            const curId = state.currentUserId;
            state = cloudModRes.state;
            state.currentUserId = curId;
            activeBranch = state.branches.find(b => b.id === state.activeBranchId) || state.branches[0] || activeBranch;
            state.activeBranchId = activeBranch.id;
            state.branch = activeBranch.name;
          }
          if (Array.isArray(cloudProds)) {
            state.products = cloudProds;
          }
          persistState(state);
          if (typeof initCloudSync === 'function') {
            initCloudSync('tideerp_global_workspace', handleRemoteCloudSync);
          }
          refreshBranchSwitcher();
          refreshNotificationIndicator();
          updateConnection();
          render();
          toast(`✓ Entire ERP synced (${state.products.length} products, ${state.customers.length} customers, ${state.sales.length} sales)`);
        } catch (err) {
          console.warn('Manual full ERP sync failed:', err);
          toast('Could not reach cloud — using local offline cache');
        }
      })();
      break;
    }
    case 'force-reload-app': {
      forceReloadApp();
      break;
    }
    case 'disconnect-cloud-sync': {
      if (!confirm('Disconnect live cloud sync? App will switch back to local offline mode.')) break;
      saveStoredFirebaseConfig(null);
      toast('Cloud sync disconnected. App is in local mode.');
      render();
      break;
    }
    case 'export-stock-movements': {
      const movements = Array.isArray(state.stockMovements) ? state.stockMovements : [];
      downloadCSV(`tide-stock-movements-${today()}.csv`, [
        ['Date', 'Product', 'Product ID', 'Movement ID', 'Before Stock', 'After Stock', 'Quantity Delta', 'Reason', 'Auditor'],
        ...movements.map(m => [
          m.date,
          m.product || '',
          m.productId || '',
          m.id || '',
          m.before !== undefined ? m.before : '',
          m.after !== undefined ? m.after : '',
          m.delta !== undefined ? m.delta : '',
          m.reason || '',
          m.user || ''
        ])
      ]);
      toast('Stock movements ledger exported to CSV');
      break;
    }
    case 'export-product-sales': {
      const allOrders = typeof salesOrderRows === 'function' ? salesOrderRows() : (state.orders || []);
      const validOrders = allOrders.filter(o => o.status !== 'Draft' && o.status !== 'Cancelled');
      const rows = state.products.map(p => {
        let sold = 0, rev = 0;
        for (const o of validOrders) {
          for (const line of o.items || []) {
            if (line.productId === p.id || line.product === p.name) {
              const q = Number(line.qty || 0);
              sold += q;
              rev += q * Number(line.unitPrice || p.price || 0);
            }
          }
        }
        const cogs = sold * Number(p.cost || 0);
        const profit = rev - cogs;
        const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0.0';
        const avg = sold > 0 ? Math.round(rev / sold) : p.price;
        return [p.id, p.name, p.sku || p.id, p.category || '', p.stock, sold, avg, rev, cogs, profit, `${margin}%`];
      });
      downloadCSV(`tide-product-sales-report-${today()}.csv`, [
        ['Product ID', 'Product Name', 'SKU', 'Category', 'Current Stock', 'Units Sold', 'Avg Selling Price TZS', 'Total Revenue TZS', 'COGS TZS', 'Gross Profit TZS', 'Margin %'],
        ...rows
      ]);
      toast('Product sales report exported to CSV');
      break;
    }
    case 'export-product-purchases': {
      const purchases = (state.purchases || []).filter(p => p.status !== 'Draft' && p.status !== 'Cancelled');
      const rows = state.products.map(p => {
        let bought = 0, spend = 0;
        const sups = new Set();
        for (const po of purchases) {
          for (const line of po.lines || po.items || []) {
            if (line.productId === p.id || line.product === p.name) {
              const q = Number(line.qty || 0);
              spend += q * Number(line.unitCost || p.cost || 0);
              bought += q;
              if (po.supplier) sups.add(po.supplier);
            }
          }
        }
        const avg = bought > 0 ? Math.round(spend / bought) : p.cost;
        return [p.id, p.name, p.sku || p.id, p.category || '', p.stock, bought, avg, spend, [...sups].join('; ')];
      });
      downloadCSV(`tide-product-purchases-report-${today()}.csv`, [
        ['Product ID', 'Product Name', 'SKU', 'Category', 'Current Stock', 'Units Restocked', 'Avg Purchase Cost TZS', 'Total Spend TZS', 'Suppliers'],
        ...rows
      ]);
      toast('Product purchases report exported to CSV');
      break;
    }
    case 'export-payment-report': {
      const records = collectAllPaymentRecords();
      downloadCSV(`tide-payment-report-${today()}.csv`, [
        ['Date', 'Direction', 'Party Type', 'Party ("Made to" / "Received from")', 'Amount TZS', 'Payment Method', 'Reference ID', 'Memo / Notes'],
        ...records.map(r => [
          r.date,
          r.direction === 'INFLOW' ? 'Inflow (Received)' : 'Outflow (Paid out)',
          r.partyType,
          r.party,
          r.amount,
          r.method,
          r.sourceId,
          r.memo
        ])
      ]);
      toast('Payment report exported to CSV');
      break;
    }
    case 'export-expiry-report': {
      const expiringList = state.products.filter(p => p.expiryDate).sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
      downloadCSV('tide-product-expiry-report.csv', [
        ['SKU', 'Product', 'Category', 'Batch #', 'Stock', 'Unit', 'Unit Cost TZS', 'Total Cost Value TZS', 'Selling Price TZS', 'Expiry Date', 'Days Status', 'Status'],
        ...expiringList.map(p => {
          const info = getProductExpiryInfo(p);
          const totalCost = (Number(p.stock) || 0) * (Number(p.cost) || 0);
          return [p.id, p.name, p.category, p.batchNumber || '', p.stock, p.unit, p.cost, totalCost, p.price, p.expiryDate, info.label, info.status.toUpperCase()];
        })
      ]);
      toast('Product expiration report downloaded');
      break;
    }
    case 'jump-to-expiry': {
      const el = document.getElementById('product-expiration-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      break;
    }
    case 'filter-expiry-tab': {
      inventoryExpiryTab = button.dataset.tab || 'attention';
      render();
      const el = document.getElementById('product-expiration-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      break;
    }
    case 'write-off-expired': {
      const product = state.products.find(p => p.id === id);
      if (!product) break;
      if (!product.stock || product.stock <= 0) {
        toast(`${product.name} currently has 0 on-hand stock`);
        break;
      }
      openDialog('confirm-write-off', `Write off expired stock: ${product.name}`,
        'Record an inventory loss and write off remaining stock for this expired product.',
        `<div class="form-grid">
          <div class="field"><label>Product</label><strong>${esc(product.name)} (${esc(product.id)})</strong></div>
          <div class="field"><label>Batch / Lot #</label><span>${esc(product.batchNumber || 'None')}</span></div>
          <div class="field"><label>Expiry Date</label><span style="color:#ef233c;font-weight:900">${esc(product.expiryDate)}</span></div>
          <div class="field"><label>Quantity to write off</label><input type="number" name="writeoff-qty" value="${product.stock}" min="1" max="${product.stock}" class="text-input" required></div>
          <div class="field full"><label>Reason / Disposal method</label><input type="text" name="writeoff-reason" value="Expired stock disposal" class="text-input" required></div>
        </div>`,
        'Confirm write-off'
      );
      document.getElementById('modal-content').dataset.recordId = product.id;
      break;
    }
    case 'clearance-discount': {
      const product = state.products.find(p => p.id === id);
      if (!product) break;
      const p10 = Math.round(product.price * 0.9);
      const p20 = Math.round(product.price * 0.8);
      const p30 = Math.round(product.price * 0.7);
      const p50 = Math.round(product.price * 0.5);
      openDialog('confirm-clearance-discount', `Clearance discount: ${product.name}`,
        `Reduce selling price to clear expiring inventory before ${product.expiryDate || 'expiry'}.`,
        `<div class="form-grid">
          <div class="field"><label>Current Selling Price</label><strong>${money(product.price)}</strong></div>
          <div class="field"><label>Unit Cost (Floor)</label><span>${money(product.cost)}</span></div>
          <div class="field full">
            <label>Suggested clearance discounts</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">
              <button type="button" class="button small" onclick="document.getElementById('clearance-price-input').value='${p10}'">10% off (${money(p10)})</button>
              <button type="button" class="button small" onclick="document.getElementById('clearance-price-input').value='${p20}'">20% off (${money(p20)})</button>
              <button type="button" class="button small" onclick="document.getElementById('clearance-price-input').value='${p30}'">30% off (${money(p30)})</button>
              <button type="button" class="button small danger-action" onclick="document.getElementById('clearance-price-input').value='${p50}'">50% off (${money(p50)})</button>
            </div>
          </div>
          <div class="field full"><label>New Selling Price (TZS)</label><input type="number" id="clearance-price-input" name="clearance-price" value="${p20}" min="0" class="text-input" required></div>
        </div>`,
        'Apply discount'
      );
      document.getElementById('modal-content').dataset.recordId = product.id;
      break;
    }
    case 'edit-expiry': {
      const product = state.products.find(p => p.id === id);
      if (!product) break;
      openDialog('update-product-expiry', `Update Expiry & Batch: ${product.name}`,
        'Set or update expiration date and batch/lot identifier.',
        `<div class="form-grid">
          ${inputField('edit-expiry-date', 'Expiration date', '', 'date', false, product.expiryDate || '')}
          ${inputField('edit-expiry-batch', 'Batch / Lot #', 'e.g. B-2026-001', 'text', false, product.batchNumber || '')}
        </div>`,
        'Save expiry details'
      );
      document.getElementById('modal-content').dataset.recordId = product.id;
      break;
    }
    case 'export-ledger':
      downloadCSV('tide-ledger.csv', [['Reference', 'Type', 'Party', 'Date', 'Entry', 'Amount TZS', 'Memo'], ...state.entries.map(e => [e.id, e.partyType, e.party, e.date, e.type, e.amount, e.memo])]);
      break;
    default:
      console.log('Action triggered:', action);
  }
}

function downloadCSV(filename, rows) {
  const sanitizeCell = (v) => {
    let str = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replaceAll('"', '""')}"`;
  };
  const csv = rows.map(r => r.map(sanitizeCell).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('CSV download ready');
}

async function importProductsCSV(csv) {
  const rows = csv.split(/\r?\n/).filter(line => line.trim());
  if (rows.length < 2) { toast('CSV has no product rows'); return; }
  const delimiter = detectCSVDelimiter(rows[0]);
  const rawHeaders = parseCSVLine(rows[0], delimiter);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const findCol = (...aliases) => {
    let idx = headers.findIndex(h => aliases.includes(h));
    if (idx !== -1) return idx;
    idx = headers.findIndex(h => aliases.some(a => h.includes(a)));
    return idx;
  };

  const nameIdx = findCol('name', 'product', 'productname', 'item', 'itemname', 'description', 'title');
  const skuIdx = findCol('sku', 'code', 'id', 'productcode', 'itemcode', 'barcode');
  const catIdx = findCol('category', 'group', 'type', 'department');
  const priceIdx = findCol('price', 'sellingprice', 'selling', 'saleprice', 'salesprice', 'retailprice', 'unitprice', 'retail', 'rate');
  const costIdx = findCol('cost', 'unitcost', 'costprice', 'buyprice', 'buyingprice', 'purchaseprice', 'purchasecost', 'buying');
  const stockIdx = findCol('stock', 'quantity', 'qty', 'openingstock', 'onhand', 'inventory', 'balance');
  const lowIdx = findCol('lowstock', 'reorderlevel', 'reorder', 'minstock', 'alert', 'low');
  const unitIdx = findCol('unit', 'measurementunit', 'uom', 'measure');
  const expiryIdx = findCol('expirydate', 'expiry', 'expirationdate', 'expiration', 'expires', 'bestbefore', 'useby', 'exp');
  const batchIdx = findCol('batchnumber', 'batch', 'batchno', 'lot', 'lotnumber', 'lotno');

  // O(1) lookup maps so importing thousands of products is instantaneous
  const bySku = new Map();
  const byName = new Map();
  const usedSkus = new Set();
  for (const p of state.products) {
    if (p?.id) {
      bySku.set(String(p.id).trim(), p);
      usedSkus.add(String(p.id).trim());
    }
    if (p?.name) {
      byName.set(String(p.name).trim().toLowerCase(), p);
    }
  }
  const categorySet = new Set(state.productCategories || []);
  const branchCode = (activeBranch?.id || 'BR-MAIN').replace(/[^A-Za-z0-9]/g, '').slice(-6);
  const tsPrefix = String(Date.now()).slice(-6);
  let autoSeq = 1;
  const nextUniqueSku = () => {
    let candidate;
    do {
      candidate = `SKU-${branchCode}-${tsPrefix}${String(autoSeq++).padStart(4, '0')}`;
    } while (usedSkus.has(candidate));
    usedSkus.add(candidate);
    return candidate;
  };

  let added = 0;
  let updated = 0;
  const newlyAdded = [];
  const touchedMap = new Map();

  for (const rowText of rows.slice(1)) {
    const row = parseCSVLine(rowText, delimiter);
    const name = (nameIdx !== -1 ? row[nameIdx] : '')?.trim() || '';
    if (!name) continue;

    const rawSku = (skuIdx !== -1 && row[skuIdx]) ? row[skuIdx].trim() : '';
    const existing = rawSku
      ? bySku.get(rawSku)
      : byName.get(name.toLowerCase());

    const sku = existing ? existing.id : (rawSku || nextUniqueSku());
    usedSkus.add(sku);

    const category = (catIdx !== -1 && row[catIdx]) ? row[catIdx].trim() : 'General';
    const price = priceIdx !== -1 ? parseCSVNumber(row[priceIdx]) : 0;
    const cost = costIdx !== -1 ? parseCSVNumber(row[costIdx]) : 0;
    const stock = stockIdx !== -1 ? Math.max(0, parseCSVNumber(row[stockIdx])) : 0;
    const low = lowIdx !== -1 ? Math.max(0, parseCSVNumber(row[lowIdx])) : 5;
    const unit = (unitIdx !== -1 && row[unitIdx]) ? row[unitIdx].trim() : 'Piece';
    const expiryDate = expiryIdx !== -1 ? parseCSVDate(row[expiryIdx]) : '';
    const batchNumber = (batchIdx !== -1 && row[batchIdx]) ? row[batchIdx].trim() : '';

    const product = {
      id: sku,
      name,
      category,
      price,
      cost,
      stock,
      low,
      unit,
      status: 'Active',
      expiryDate,
      batchNumber
    };

    if (existing) {
      Object.assign(existing, product);
      touchedMap.set(existing.id, existing);
      updated++;
    } else {
      newlyAdded.push(product);
      bySku.set(product.id, product);
      byName.set(name.toLowerCase(), product);
      touchedMap.set(product.id, product);
      added++;
    }
    if (!categorySet.has(category)) {
      categorySet.add(category);
      state.productCategories.push(category);
    }
  }

  if (newlyAdded.length) {
    state.products = [...newlyAdded.reverse(), ...state.products];
  }

  const touchedProducts = Array.from(touchedMap.values());
  saveState();
  render();

  if (!touchedProducts.length) {
    toast('No valid product rows found in CSV');
    return;
  }

  if (typeof window.TideFirebase?.batchSyncProducts === 'function') {
    toast(`Uploading all ${touchedProducts.length} products to cloud...`);
    try {
      const res = await window.TideFirebase.batchSyncProducts(touchedProducts, (done, total) => {
        if (total > 450 && done < total) {
          toast(`Uploading products to cloud: ${done} / ${total}...`);
        }
      });
      if (res.failed > 0) {
        toast(`Uploaded ${res.synced}/${res.total} products (${res.failed} failed)`);
      } else {
        toast(`✓ All ${res.synced} products uploaded (${added} added, ${updated} updated) — live across all devices!`);
      }
    } catch (err) {
      console.error('CSV cloud batch upload error:', err);
      toast(`${added} added, ${updated} updated locally; cloud sync will retry automatically`);
    }
  } else {
    toast(`${added} added, ${updated} updated with verified pricing & stock`);
  }
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
window.addEventListener('scroll', () => {
  if (dateFilterPortal) positionDateFilterPortal();
}, { passive: true });
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
  if (rect.bottom < -50 || rect.top > window.innerHeight + 50) { closeOrderActionsPortal(); return; }
  orderActionsPortal.style.width = 'max-content';
  orderActionsPortal.style.minWidth = '210px';
  orderActionsPortal.style.maxWidth = 'min(320px, calc(100vw - 20px))';
  const width = Math.min(orderActionsPortal.offsetWidth || 220, window.innerWidth - 16);
  const height = Math.min(orderActionsPortal.scrollHeight, window.innerHeight - 16);
  let left = rect.right - width;
  if (left < 8) left = rect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  let top = rect.bottom + 4;
  if (top + height > window.innerHeight - 8 && rect.top - height - 4 >= 8) top = rect.top - height - 4;
  top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
  Object.assign(orderActionsPortal.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${window.innerHeight - 16}px`,
    zIndex: '10000'
  });
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
  const summary = event.target.closest('.order-actions > summary');
  if (summary) {
    event.preventDefault();
    event.stopPropagation();
    const details = summary.closest('details');
    if (orderActionsAnchor === details) closeOrderActionsPortal(); else openOrderActionsPortal(details);
    return;
  }
  if (orderActionsPortal && !event.target.closest('.order-actions-portal')) closeOrderActionsPortal();
}, true);
document.addEventListener('click', event => {
  if (event.target.closest('.order-actions-portal [data-action]')) setTimeout(closeOrderActionsPortal, 25);
}, true);
window.addEventListener('scroll', () => {
  if (orderActionsPortal) positionOrderActionsPortal();
}, { passive: true });
window.addEventListener('resize', positionOrderActionsPortal);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeOrderActionsPortal(); });

// Global Event Listeners
document.addEventListener('click', event => {
  const toggleBtn = event.target.closest('#toggle-password-btn, .pwd-visibility-toggle');
  if (toggleBtn) {
    const wrap = toggleBtn.closest('.input-wrap');
    const pwdInput = wrap?.querySelector('input') || document.getElementById('login-password');
    if (pwdInput) {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      toggleBtn.textContent = isPwd ? '🙈' : '👁';
      toggleBtn.setAttribute('title', isPwd ? 'Hide password' : 'Show password');
    }
    return;
  }
  const tabBtn = event.target.closest('[data-auth-tab], [data-switch-auth]');
  if (tabBtn) {
    const targetTab = tabBtn.dataset.authTab || tabBtn.dataset.switchAuth;
    if (targetTab && typeof switchAuthTab === 'function') switchAuthTab(targetTab);
    return;
  }
  if (!event.target.closest('.stocktake-search-wrap')) {
    const sr = document.getElementById('stocktake-search-results');
    if (sr) sr.hidden = true;
  }
  const nav = event.target.closest('[data-page]');
  if (nav) {
    event.preventDefault();
    setPage(nav.dataset.page);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (action) handleAction(action);
});

document.addEventListener('change', event => {
  if (event.target.id === 'attachment-file-input') {
    const files = event.target.files;
    handleFilesSelected(files, att => {
      currentDraftAttachments.push(att);
      const list = document.getElementById('attachments-list');
      if (list) {
        list.classList.remove('is-empty');
        list.innerHTML = renderAttachmentCards(currentDraftAttachments, { allowDelete: true });
      }
    });
    event.target.value = '';
  } else if (event.target.dataset.galleryRecordId) {
    const recordId = event.target.dataset.galleryRecordId;
    const scope = event.target.dataset.galleryScope;
    const files = event.target.files;
    handleFilesSelected(files, att => {
      let targetRecord = null;
      if (scope === 'order') {
        targetRecord = state.orders.find(o => o.id === recordId) || state.sales.find(s => s.id === recordId);
      } else if (scope === 'purchase') {
        targetRecord = state.purchases.find(p => p.id === recordId);
      } else if (scope === 'entry') {
        targetRecord = state.entries.find(e => e.id === recordId);
      } else if (scope === 'expense') {
        targetRecord = (state.expenses || []).find(e => e.id === recordId);
      }
      if (targetRecord) {
        targetRecord.attachments = targetRecord.attachments || [];
        targetRecord.attachments.push(att);
        saveState();
        recordActivity('Attachment added', `${att.name} · ${targetRecord.id}`, targetRecord.id);
        const list = document.getElementById(`gallery-attachments-list-${recordId}`);
        if (list) {
          list.classList.remove('is-empty');
          list.innerHTML = renderAttachmentCards(targetRecord.attachments, { allowDelete: true, recordId, scope });
        }
        toast(`Attached "${att.name}"`);
      }
    });
    event.target.value = '';
  }
});

document.addEventListener('dragover', event => {
  const dropzone = event.target.closest('#attachments-dropzone');
  if (dropzone) {
    event.preventDefault();
    dropzone.classList.add('dragover');
  }
});

document.addEventListener('dragleave', event => {
  const dropzone = event.target.closest('#attachments-dropzone');
  if (dropzone) dropzone.classList.remove('dragover');
});

document.addEventListener('drop', event => {
  const dropzone = event.target.closest('#attachments-dropzone');
  if (dropzone) {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      handleFilesSelected(files, att => {
        currentDraftAttachments.push(att);
        const list = document.getElementById('attachments-list');
        if (list) {
          list.classList.remove('is-empty');
          list.innerHTML = renderAttachmentCards(currentDraftAttachments, { allowDelete: true });
        }
      });
    }
  }
});

document.addEventListener('click', event => {
  const dropzone = event.target.closest('#attachments-dropzone');
  if (dropzone && !event.target.closest('input[type="file"]') && !event.target.closest('button') && !event.target.closest('label')) {
    const input = dropzone.parentElement?.querySelector('#attachment-file-input');
    if (input) input.click();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    const nav = event.target.closest('[data-page]');
    if (nav && nav.tagName !== 'BUTTON' && nav.tagName !== 'A' && nav.tagName !== 'INPUT' && nav.tagName !== 'TEXTAREA') {
      event.preventDefault();
      setPage(nav.dataset.page);
    }
  }
});

window.addEventListener('popstate', event => {
  const targetPage = event.state?.erpPage || (location.hash ? location.hash.replace(/^#/, '') : 'home');
  if (targetPage && pageLabels[targetPage] && targetPage !== page) {
    if (canViewPage(targetPage)) {
      page = targetPage;
      tableQuery = '';
      selectedProductIds.clear();
      document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
      render();
    }
  }
});

document.addEventListener('submit', event => {
  if (event.target.id === 'login-form') {
    event.preventDefault();
    handleLogin(event.target);
  } else if (event.target.id === 'register-form') {
    event.preventDefault();
    handleRegister(event.target);
  } else if (event.target.id === 'screen-lock-form') {
    event.preventDefault();
    handleUnlockSubmit(event.target);
  } else if (event.target.id === 'company-settings-form') {
    event.preventDefault();
    if (!isWorkspaceAdministrator() && !userHasPermission('settings', 'edit-company')) { toast('You do not have permission to change company settings'); return; }
    saveCompanySettings(event.target);
  } else if (event.target.id === 'modal-content' && event.target.dataset.dialogKind) {
    event.preventDefault();
    const submitButton = event.submitter;
    if (submitButton?.disabled) return;
    if (submitButton) submitButton.disabled = true;
    Promise.resolve(handleDialogSubmit(event.target))
      .catch(error => toast(error.message || 'The requested change could not be saved'))
      .finally(() => { if (submitButton?.isConnected) submitButton.disabled = false; });
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
    const input = document.getElementById('table-search');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
  if (event.target.id === 'report-search') {
    reportSearchQuery = event.target.value;
    render();
    const input = document.getElementById('report-search');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
  if (event.target.id === 'pos-search') {
    const term = event.target.value.toLowerCase();
    document.getElementById('pos-products').innerHTML = productCards(
      activeProducts().filter(p => (!posCategory || p.category === posCategory) && `${p.name} ${p.category} ${p.id}`.toLowerCase().includes(term))
    );
    refreshPermissionVisibility();
  }
  if (event.target.classList.contains('stocktake-qty-input')) {
    const row = event.target.closest('tr[data-product-id]');
    if (row) {
      const cur = Number(row.dataset.currentStock || 0);
      const unit = row.dataset.productUnit || '';
      const varCell = row.querySelector('.stocktake-var-cell');
      if (varCell) varCell.innerHTML = renderStocktakeVariance(event.target.value, cur, unit);
      updateStocktakeStats();
      autoSaveStocktakeDraft();
    }
  }
  if (event.target.classList.contains('stocktake-exp-input')) {
    const row = event.target.closest('tr[data-product-id]');
    if (row) {
      const statusCell = row.querySelector('.stocktake-exp-status');
      if (statusCell) statusCell.innerHTML = renderStocktakeExpiryBadge(event.target.value.trim());
      autoSaveStocktakeDraft();
    }
  }
  if (event.target.id === 'stocktake-search-input') {
    handleStocktakeSearch(event.target.value);
  }
  if (event.target.id === 'stocktake-reason') {
    autoSaveStocktakeDraft();
  }
});

document.addEventListener('change', event => {
  if (event.target.id === 'select-all-products') {
    const checks = document.querySelectorAll('.product-row-check');
    checks.forEach(cb => {
      selectedProductIds[event.target.checked ? 'add' : 'delete'](cb.dataset.id);
      cb.checked = event.target.checked;
    });
    updateBulkProductBar();
  }
  if (event.target.classList.contains('product-row-check')) {
    selectedProductIds[event.target.checked ? 'add' : 'delete'](event.target.dataset.id);
    updateBulkProductBar();
  }
  if (event.target.id === 'sales-status') { salesStatusFilter = event.target.value; render(); }
  if (event.target.id === 'sales-payment') { salesPaymentFilter = event.target.value; render(); }
  if (event.target.id === 'sales-delivery') { salesDeliveryFilter = event.target.value; render(); }
  if (event.target.id === 'purchase-status') { purchaseStatusFilter = event.target.value; render(); }
  if (event.target.id === 'expense-status') { expenseStatusFilter = event.target.value; render(); }
  if (event.target.id === 'expense-paid-checkbox') {
    const fields = document.getElementById('expense-payment-fields');
    const payDateInput = document.getElementById('expense-payment-date');
    const checked = event.target.checked;
    if (fields) fields.hidden = !checked;
    if (payDateInput) {
      payDateInput.required = checked;
      if (checked && !payDateInput.value) payDateInput.value = document.getElementById('expense-date')?.value || today();
    }
  }
  if (event.target.id === 'report-payment-direction') { reportPaymentDirectionFilter = event.target.value; render(); }
  if (event.target.id === 'report-payment-method') { reportPaymentMethodFilter = event.target.value; render(); }
  if (event.target.id === 'inventory-movement-filter') { inventoryMovementTypeFilter = event.target.value; render(); }
  if (event.target.matches('[data-permission-module]')) {
    const group = event.target.closest('fieldset');
    group?.querySelectorAll('input[name="user-permission"]').forEach(input => { input.checked = event.target.checked; });
    event.target.indeterminate = false;
  }
  if (event.target.matches('input[name="user-permission"]')) {
    const group = event.target.closest('fieldset'), parent = group?.querySelector('[data-permission-module]');
    const children = [...(group?.querySelectorAll('input[name="user-permission"]') || [])], checked = children.filter(input => input.checked).length;
    if (parent) { parent.checked = checked === children.length; parent.indeterminate = checked > 0 && checked < children.length; }
  }
  if (event.target.id === 'pos-category') {
    posCategory = event.target.value;
    render();
  }
  if (event.target.id === 'pos-customer') posCustomer = event.target.value;
  if (event.target.id === 'pos-method') posMethod = event.target.value;
  if (event.target.id === 'order-method') {
    const chosenMethod = event.target.value || '';
    if (chosenMethod.toLowerCase().includes('credit')) {
      const paidInput = document.getElementById('order-paid');
      if (paidInput) {
        paidInput.value = '0';
        transactionLineTotals('order');
      }
    }
  }
  if (event.target.id === 'dashboard-range') {
    dashboardRange = event.target.value;
    render();
  }
  if (event.target.id === 'product-csv-file' && event.target.files?.[0]) {
    const reader = new FileReader(); reader.onload = () => importProductsCSV(String(reader.result || '')); reader.readAsText(event.target.files[0]); event.target.value = '';
  }
  if (event.target.id === 'restore-backup-file' && event.target.files?.[0]) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const backup = JSON.parse(text);
        if (!backup || typeof backup !== 'object' || !Array.isArray(backup.products)) {
          toast('Invalid backup file. Must be a Tide ERP .json backup.');
          return;
        }
        if (!confirm(`Restore backup "${file.name}"? This will sync ${backup.products.length} products and all workspace records to this device.`)) return;
        Object.assign(state, backup);
        await saveState();
        toast('Backup restored successfully! Refreshing...');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        toast('Failed to restore backup: ' + (err.message || 'Corrupt file'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
  if (event.target.id === 'stocktake-select-category') {
    const cat = event.target.value;
    if (cat) {
      stocktakeAddCategory(cat);
      event.target.value = '';
    }
  }
});

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

async function forceReloadApp() {
  toast('Updating app and clearing mobile cache...');
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) await reg.unregister();
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) await caches.delete(key);
    }
  } catch { }
  setTimeout(() => {
    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now() + window.location.hash;
  }, 350);
}

function openCloudStatusModal() {
  const connected = typeof isCloudSyncConnected === 'function' && isCloudSyncConnected();
  const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Phone' : 'PC';
  const prodCount = state?.products?.length || 0;
  const custCount = state?.customers?.length || 0;
  const suppCount = state?.suppliers?.length || 0;
  const saleCount = (state?.orders?.length || 0) + (state?.sales?.filter(s => !state.orders?.some(o => o.id === s.orderId || o.invoiceId === s.id))?.length || 0);
  const purchCount = state?.purchases?.length || 0;
  const expCount = state?.expenses?.length || 0;
  const userCount = state?.users?.length || 0;

  const content = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:${connected ? 'rgba(0,166,81,0.08)' : 'rgba(239,68,68,0.08)'};border-radius:10px;border:1px solid ${connected ? '#00a651' : '#ef4444'}">
        <div>
          <strong style="display:block;font-size:13px;color:${connected ? '#00a651' : '#ef4444'}">${connected ? '● Unified Cloud ERP Active (Dual Mode)' : '○ Offline Mode (Local IndexedDB Cache)'}</strong>
          <small class="muted">Device: <strong>${deviceType}</strong> · Shared Database: <strong>Google Firebase (tideerp)</strong></small>
        </div>
      </div>
      <div style="background:var(--bg-subtle, rgba(0,0,0,0.04));padding:10px;border-radius:8px;font-size:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><small class="muted" style="display:block">Products</small><strong>${prodCount}</strong></div>
        <div><small class="muted" style="display:block">Customers</small><strong>${custCount}</strong></div>
        <div><small class="muted" style="display:block">Suppliers</small><strong>${suppCount}</strong></div>
        <div><small class="muted" style="display:block">Sales/Orders</small><strong>${saleCount}</strong></div>
        <div><small class="muted" style="display:block">Purchases</small><strong>${purchCount}</strong></div>
        <div><small class="muted" style="display:block">Expenses</small><strong>${expCount}</strong></div>
        <div><small class="muted" style="display:block">Users</small><strong>${userCount}</strong></div>
      </div>
      <div style="font-size:12px;line-height:1.45">
        ${connected
      ? `✓ <strong>Whole ERP Unified:</strong> Products, customers, suppliers, sales, POS, purchases, accounting, inventory logs, users, branches &amp; settings all run on one shared cloud database — with automatic offline caching.`
      : `⚠️ <strong>Offline Mode:</strong> Changes are safely saved locally on this ${deviceType} and will automatically sync across all devices as soon as internet reconnects.`}
      </div>
      <div style="display:flex;gap:8px;flex-direction:column;margin-top:4px">
        <button type="button" class="button primary" data-action="force-cloud-sync" style="width:100%">⚡ Refresh Entire ERP from Cloud</button>
        <button type="button" class="button" data-action="force-reload-app" style="width:100%">🔄 Clear Cache &amp; Reload Latest App Version</button>
      </div>
    </div>
  `;
  openDialog('cloud-status', 'Unified Cloud ERP Status', 'One live database across PC, Phone & Tablets (with offline support).', content, 'Close');
}

document.getElementById('cloud-sync-button')?.addEventListener('click', openCloudStatusModal);

document.getElementById('back-button')?.addEventListener('click', navigateBack);

window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);

// Keyboard shortcuts: / for POS search, Ctrl+K for general search
document.addEventListener('keydown', event => {
  if (isScreenLocked()) return;
  if (event.target.id === 'stocktake-search-input' && event.key === 'Enter') {
    event.preventDefault();
    const firstItem = document.querySelector('#stocktake-search-results .stocktake-search-item');
    if (firstItem) {
      stocktakeAddSingleProduct(firstItem.dataset.id);
    }
    return;
  }
  if (event.target.classList.contains('stocktake-qty-input') && event.key === 'Enter') {
    event.preventDefault();
    const inputs = Array.from(document.querySelectorAll('.stocktake-qty-input'));
    const idx = inputs.indexOf(event.target);
    if (idx !== -1 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
      inputs[idx + 1].select();
    }
    return;
  }
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (page !== 'inventory') setPage('inventory');
    setTimeout(() => document.getElementById('table-search')?.focus(), 0);
  } else if (event.altKey && event.key.toLowerCase() === 'e' && !typing) {
    event.preventDefault();
    if (canPerformAction('new-expense')) openExpenseForm();
  } else if (event.key === '/' && !typing) {
    event.preventDefault();
    if (page === 'pos') document.getElementById('pos-search')?.focus();
    else {
      setPage('inventory');
      setTimeout(() => document.getElementById('table-search')?.focus(), 0);
    }
  }
});

// Sidebar Controller:
// - PC (Desktop > 760px): Automatic hover-based collapse/extend (no toggle button)
// - Phone (Mobile <= 760px): Button-driven toggle drawer with backdrop
const sidebar = document.getElementById('sidebar');
const sidebarToggleButton = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const sidebarHoverZone = document.getElementById('sidebar-hover-zone');
let sidebarHoverTimer = 0;

function isDesktopSidebar() {
  return window.innerWidth > 760;
}

function updateSidebarUI() {
  if (!sidebar) return;
  if (isDesktopSidebar()) {
    // Desktop: completely closed off-screen by default, auto-slides out only on hover
    sidebar.classList.remove('open', 'collapsed');
    sidebarBackdrop?.classList.remove('active');
    if (sidebarToggleButton) {
      sidebarToggleButton.hidden = true;
    }
  } else {
    // Mobile: drawer driven by sidebarToggleButton
    sidebar.classList.remove('collapsed', 'hover-expanded');
    const isOpen = sidebar.classList.contains('open');
    sidebarBackdrop?.classList.toggle('active', isOpen);
    if (sidebarToggleButton) {
      sidebarToggleButton.hidden = false;
      const label = isOpen ? 'Close navigation' : 'Open navigation';
      sidebarToggleButton.setAttribute('aria-label', label);
      sidebarToggleButton.setAttribute('title', label);
      sidebarToggleButton.textContent = isOpen ? '×' : '☰';
    }
  }
}

// Automatic hover expansion for desktop
function handleDesktopEnter() {
  if (!isDesktopSidebar() || !sidebar) return;
  clearTimeout(sidebarHoverTimer);
  sidebar.classList.add('hover-expanded');
}

function handleDesktopLeave() {
  if (!isDesktopSidebar() || !sidebar) return;
  clearTimeout(sidebarHoverTimer);
  sidebarHoverTimer = setTimeout(() => {
    sidebar.classList.remove('hover-expanded');
  }, 160);
}

sidebar?.addEventListener('mouseenter', handleDesktopEnter);
sidebar?.addEventListener('mouseleave', handleDesktopLeave);
sidebarHoverZone?.addEventListener('mouseenter', handleDesktopEnter);
sidebarHoverZone?.addEventListener('mouseleave', handleDesktopLeave);

// Proximity detection: moving cursor to left edge (<= 18px) automatically slides open sidebar on desktop
document.addEventListener('pointermove', event => {
  if (!isDesktopSidebar() || !sidebar) return;
  if (event.clientX <= 18) {
    handleDesktopEnter();
  }
}, { passive: true });

// Mobile toggle button and backdrop interactions
function toggleMobileSidebar() {
  if (!sidebar || isDesktopSidebar()) return;
  sidebar.classList.toggle('open');
  updateSidebarUI();
}

function closeMobileSidebar() {
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    updateSidebarUI();
  }
}

sidebarToggleButton?.addEventListener('click', event => {
  event.stopPropagation();
  toggleMobileSidebar();
});

sidebarBackdrop?.addEventListener('click', closeMobileSidebar);

document.addEventListener('click', event => {
  if (!isDesktopSidebar() && sidebar?.classList.contains('open')) {
    if (!sidebar.contains(event.target) && !sidebarToggleButton?.contains(event.target)) {
      closeMobileSidebar();
    }
  }
});

sidebar?.addEventListener('click', event => {
  if (event.target.closest('.nav-item') || event.target.closest('[data-page]')) {
    if (isDesktopSidebar()) {
      sidebar.classList.remove('hover-expanded');
    } else {
      closeMobileSidebar();
    }
  }
});

window.addEventListener('resize', updateSidebarUI);
updateSidebarUI();
// App Initialization (Multi-Tenant Dual Mode: Cloud-First Unified ERP + Isolated Offline Cache)
async function initApp() {
  applyTheme(safeStorageGet(THEME_KEY) === 'dark' ? 'dark' : 'light');

  // 0. Resolve active tenant workspace from saved session (or last active workspace) BEFORE loading data
  let savedSession = null;
  try { savedSession = JSON.parse(safeSessionGet(AUTH_SESSION_KEY) || 'null'); } catch { }
  const bootWorkspaceId = savedSession?.workspaceId || (typeof getActiveWorkspaceId === 'function' ? getActiveWorkspaceId() : 'ws_primary');
  if (typeof setActiveWorkspaceId === 'function') {
    setActiveWorkspaceId(bootWorkspaceId);
  }
  const bootTemplate = bootWorkspaceId === 'ws_primary' ? initialState : createBlankWorkspaceState();

  // 1. Load isolated local IndexedDB cache first (enables instant offline dual-mode operation)
  state = await loadPersistedState(bootTemplate, bootWorkspaceId);
  state.currentUserId = '';

  // 2. Cloud-First Hydration BEFORE any startup saveState() so refreshing ANY device
  //    immediately gets the complete live ERP for THIS company only (Timeout-guarded for offline mode)
  try {
    const cloudBoot = (async () => {
      if (typeof window.TideFirebase?.initFirebase === 'function') {
        await window.TideFirebase.initFirebase();
        window.TideFirebase.setWorkspace?.(bootWorkspaceId);
      }
      const [modResult, cloudProducts] = await Promise.all([
        typeof hydrateFromCloud === 'function' ? hydrateFromCloud(state, bootTemplate, true) : Promise.resolve(null),
        typeof window.TideFirebase?.getProducts === 'function' ? window.TideFirebase.getProducts(true) : Promise.resolve(null)
      ]);
      if (modResult?.hydrated && modResult.state) {
        state = modResult.state;
      }
      if (Array.isArray(cloudProducts)) {
        const isPrimary = bootWorkspaceId === 'ws_primary';
        const seedKey = isPrimary ? 'tide_products_seeded_v2' : `tide_products_seeded_${bootWorkspaceId}`;
        const hasSeeded = !isPrimary || Boolean(localStorage.getItem(seedKey));
        if (cloudProducts.length > 0) {
          if (isPrimary) localStorage.setItem(seedKey, 'true');
          state.products = cloudProducts;
        } else if (hasSeeded) {
          state.products = [];
        }
      }
      await persistState(state, bootWorkspaceId);
    })();
    const timeoutGuard = new Promise(resolve => setTimeout(resolve, 6500));
    await Promise.race([cloudBoot, timeoutGuard]);
  } catch (err) {
    console.warn('Cloud boot hydration skipped (running from local offline cache):', err);
  }

  activeBranch = state.branches.find(b => b.id === state.activeBranchId) || state.branches[0] || { id: 'BR-MAIN', name: 'Main branch' };
  state.activeBranchId = activeBranch.id;
  state.branch = activeBranch.name;
  state.users.forEach(user => {
    if (!user.branchId) user.branchId = activeBranch.id;
    if (user.isBootstrap && !user.role) {
      user.role = 'Owner / Administrator';
      user.modules = ['*'];
      user.permissions = { '*': ['*'] };
    }
  });
  if (!state.companyName || state.companyName === 'Kipepeo Traders' || /kipepeo/i.test(state.companyName)) {
    state.companyName = 'My Company';
  }

  // 3. Attach Real-Time Multi-Device Listeners strictly scoped to this company workspace
  window.requestPushStateToCloud = () => {
    if (typeof pushStateToCloud === 'function' && state) pushStateToCloud(state);
  };

  attachActiveWorkspaceStreams();

  // Keep global login directory up to date for this workspace's users
  if (typeof syncWorkspaceUsersToDirectory === 'function') {
    syncWorkspaceUsersToDirectory(state.users, bootWorkspaceId, state.companyName).catch(() => {});
  }

  // Auto-reconcile with cloud whenever a device comes back online
  window.addEventListener('online', async () => {
    try {
      if (typeof pushStateToCloud === 'function') await pushStateToCloud(state, true);
      if (typeof pullFullCloudState === 'function') {
        const res = await pullFullCloudState(state, initialState);
        if (res?.hydrated && res.state) {
          const curId = state.currentUserId;
          const curProds = state.products;
          state = res.state;
          state.currentUserId = curId;
          state.products = curProds;
          persistState(state);
          render();
        }
      }
    } catch {}
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => { });
  }

  const todayLabel = document.getElementById('today-label');
  if (todayLabel) {
    todayLabel.textContent = new Intl.DateTimeFormat('en-TZ', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      timeZone: 'Africa/Dar_es_Salaam'
    }).format(new Date());
  }
  try {
    const hasAdmin = await ensureAdministratorLogin();
    if (!hasAdmin) { renderAuthGate('No administrator account is configured.'); return; }
    // Persist locally during boot without triggering an unnecessary cloud overwrite
    snapshotCurrentBranch();
    persistState(state);
  } catch (error) {
    renderAuthGate(error.message || 'Secure sign-in could not be initialized.');
    return;
  }
  let session = null;
  try { session = JSON.parse(safeSessionGet(AUTH_SESSION_KEY) || 'null'); } catch { }
  const signedInUser = state.users.find(user => user.id === session?.id && user.passwordHash === session?.passwordHash && user.status !== 'Inactive');
  if (signedInUser) {
    state.currentUserId = signedInUser.id;
    if (!activateAssignedBranch(signedInUser)) {
      state.currentUserId = ''; safeSessionRemove(AUTH_SESSION_KEY);
      renderAuthGate('This account has no active assigned branch. Ask an administrator to assign it to an active branch.');
      return;
    }
    snapshotCurrentBranch();
    persistState(state);
    const hash = (location.hash || '').replace(/^#/, '');
    page = hash && pageLabels[hash] ? hash : 'home';
    document.getElementById('auth-gate').hidden = true;
    document.querySelector('.app-shell').hidden = false;
    render();
    let savedLock = null;
    try { savedLock = JSON.parse(safeSessionGet(LOCK_STATE_KEY) || 'null'); } catch {}
    if (savedLock?.locked && savedLock.userId === signedInUser.id) {
      startAutoLockWatcher(true);
      lockScreen(savedLock.reason || 'inactivity');
    } else {
      startAutoLockWatcher(true);
    }
  } else {
    stopAutoLockWatcher();
    clearScreenLock();
    safeSessionRemove(AUTH_SESSION_KEY);
    state.currentUserId = '';
    persistState(state);
    renderAuthGate();
  }
}

// Start app
initApp();
