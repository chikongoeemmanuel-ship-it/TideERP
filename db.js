// IndexedDB + Unified Real-Time Cloud Storage Engine for Tide ERP
// Dual functionality:
//   1. Instant local offline persistence via IndexedDB (works seamlessly with zero internet)
//   2. Unified multi-device real-time cloud database via modular Firebase Firestore documents
//      so ALL ERP data (products, customers, suppliers, sales, orders, purchases, accounting,
//      inventory movements, stocktakes, users, branches, settings, trash, logs) stays live
//      and identical across PC, phone, and tablets automatically.

const DB_NAME = 'TideERP_Storage';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';
const STATE_DOC_ID = 'current_state';
const LEGACY_STORAGE_KEY = 'tide-erp-demo-v1';
const DEFAULT_WORKSPACE_ID = 'ws_primary';
const ACTIVE_WORKSPACE_KEY = 'tide-erp-active-workspace';
const TENANTS_COLLECTION = 'tide_erp_tenants';
const ACCOUNTS_DIRECTORY_COLLECTION = 'tide_erp_accounts';

let dbInstance = null;
let activeTenantWorkspaceId = (() => {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY) || DEFAULT_WORKSPACE_ID;
  } catch {
    return DEFAULT_WORKSPACE_ID;
  }
})();

function getActiveWorkspaceId() {
  return activeTenantWorkspaceId || DEFAULT_WORKSPACE_ID;
}

function localDocKeyForWorkspace(wsId = activeTenantWorkspaceId) {
  const clean = String(wsId || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
  return clean === DEFAULT_WORKSPACE_ID ? STATE_DOC_ID : `workspace_${clean}`;
}

function createNewWorkspaceId(companyName = '') {
  const slug = String(companyName || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18) || 'company';
  return `ws_${slug}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported in this browser environment; falling back to memory/local.');
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };
    request.onerror = (event) => {
      console.error('Failed to open IndexedDB:', event.target.error);
      resolve(null);
    };
  });
}

async function loadPersistedState(initialState, wsId = activeTenantWorkspaceId) {
  const docKey = localDocKeyForWorkspace(wsId);
  try {
    const db = await openDatabase();
    if (db) {
      const stateFromDB = await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get(docKey);
          getReq.onsuccess = () => resolve(getReq.result?.data || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (stateFromDB && typeof stateFromDB === 'object') {
        return sanitizeState(stateFromDB, initialState);
      }
    }
  } catch (err) {
    console.warn('Error reading from IndexedDB, checking legacy storage:', err);
  }

  // Only check legacy single-tenant localStorage for the original primary workspace
  if (docKey === STATE_DOC_ID) {
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed && typeof parsed === 'object') {
          const migrated = sanitizeState(parsed, initialState);
          persistState(migrated, wsId).catch(() => { });
          return migrated;
        }
      }
    } catch (err) {
      console.warn('Error checking legacy localStorage:', err);
    }
  }

  return structuredClone(initialState);
}

async function persistState(state, wsId = activeTenantWorkspaceId) {
  if (!state) return;
  const docKey = localDocKeyForWorkspace(wsId);

  let savedInIndexedDB = false;
  try {
    const db = await openDatabase();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ id: docKey, data: state, updatedAt: new Date().toISOString() });
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
      savedInIndexedDB = true;
    }
  } catch (err) {
    console.error('IndexedDB write failure:', err);
  }

  if (!savedInIndexedDB && docKey === STATE_DOC_ID) {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Fallback browser storage could not save the full workspace:', err);
    }
  }

  try {
    const lightweight = {
      workspaceId: wsId || DEFAULT_WORKSPACE_ID,
      version: state.version,
      companyName: state.companyName,
      branch: state.branch,
      activeBranchId: state.activeBranchId,
      currentUserId: state.currentUserId,
      currency: state.currency
    };
    localStorage.setItem('tide-erp-meta', JSON.stringify(lightweight));
  } catch {
    // Ignore quota issues on meta fallback
  }
}

function sanitizeState(restored, initialState) {
  const clean = { ...structuredClone(initialState), ...restored };
  const arrayKeys = [
    'products', 'customers', 'suppliers', 'orders', 'sales',
    'returns', 'purchaseReturns', 'purchases', 'expenses', 'entries', 'queue',
    'stockMovements', 'stocktakes', 'stockTransfers', 'notices', 'users', 'productCategories', 'measurementUnits',
    'productPackages', 'trashBin', 'activityLog', 'branches'
  ];
  for (const key of arrayKeys) {
    if (!Array.isArray(clean[key])) clean[key] = [];
  }
  if (!clean.branchData || typeof clean.branchData !== 'object') {
    clean.branchData = {};
  }
  if (!clean.users.length) {
    clean.users = structuredClone(initialState.users);
  }
  for (const p of clean.products) {
    if (typeof p.expiryDate !== 'string') p.expiryDate = '';
    if (typeof p.batchNumber !== 'string') p.batchNumber = '';
  }
  if (!clean.companyName || !String(clean.companyName).trim()) {
    clean.companyName = 'My Company';
  }
  if (!clean.currency) clean.currency = 'TZS';
  if (typeof clean.vatEnabled !== 'boolean') clean.vatEnabled = true;
  if (typeof clean.vatRate !== 'number') clean.vatRate = 18;
  clean.receiptWidth = clean.receiptWidth === '58mm' ? '58mm' : '80mm';
  if (typeof clean.autoLockMinutes !== 'number' || !Number.isFinite(clean.autoLockMinutes) || clean.autoLockMinutes < 0) {
    clean.autoLockMinutes = 20;
  }
  if (!clean.themeColors || typeof clean.themeColors !== 'object') {
    clean.themeColors = { primary: '#0a1e36', secondary: '#ff6a00' };
  } else {
    if (!/^#[0-9a-fA-F]{6}$/.test(clean.themeColors.primary || '')) clean.themeColors.primary = '#0a1e36';
    if (!/^#[0-9a-fA-F]{6}$/.test(clean.themeColors.secondary || '')) clean.themeColors.secondary = '#ff6a00';
  }
  if (!clean.notificationSound || typeof clean.notificationSound !== 'object') {
    clean.notificationSound = { enabled: true, tone: 'chime', volume: 0.65, onOutOfStock: true, onExpired: true };
  } else {
    clean.notificationSound = {
      enabled: clean.notificationSound.enabled !== false,
      tone: clean.notificationSound.tone || 'chime',
      volume: Number.isFinite(Number(clean.notificationSound.volume)) ? Number(clean.notificationSound.volume) : 0.65,
      onOutOfStock: clean.notificationSound.onOutOfStock !== false,
      onExpired: clean.notificationSound.onExpired !== false
    };
  }
  return clean;
}

// =========================================================
// Unified Whole-ERP Real-Time Cloud Engine (Firebase Firestore)
// Splits ERP into modular documents in `tide_erp_modules` so:
//   - NEVER hits Firestore's 1 MB single-document limit
//   - Products are stored exclusively in `products` collection
//   - Dirty-checking writes ONLY changed modules (super fast)
//   - Cloud-first hydration on boot/refresh prevents stale overwrites
//   - Deletions propagate cleanly across all devices without resurrection
// =========================================================
const FIREBASE_CONFIG_STORAGE_KEY = 'tide-firebase-config';
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDaFgbjKDUHGS4hbBTb4sjJ76nK24ozkls",
  authDomain: "tideerp.firebaseapp.com",
  projectId: "tideerp",
  storageBucket: "tideerp.firebasestorage.app",
  messagingSenderId: "519899083425",
  appId: "1:519899083425:web:a91554721d225a731476e0",
  measurementId: "G-DMRTQPN22Z"
};

const MODULES_COLLECTION = 'tide_erp_modules';
const PRIMARY_BRANCHES_COLLECTION = 'tide_erp_branches';
const DEFAULT_BRANCH_ID = 'BR-MAIN';
const LEGACY_WORKSPACES_COLLECTION = 'tide_erp_workspaces';
const CLIENT_SESSION_ID = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);

// Shared company-wide modules (synced at workspace level across all branches)
// Note: `branch` and `activeBranchId` are intentionally device-local so switching branches
// on one device never hijacks another device's active branch!
const SHARED_MODULE_DEFS = {
  core: [
    'version', 'companyName', 'companyAddress', 'companyPhone', 'companyEmail',
    'companyPaymentDetails', 'companyAdminId', 'currency', 'vatEnabled', 'vatRate',
    'receiptWidth', 'branches', 'users', 'productCategories', 'measurementUnits', 'productPackages',
    'notificationSettings', 'autoLockMinutes', 'themeColors', 'notificationSound'
  ],
  assets: ['companyLogo'],
  notices: ['notices'],
  transfers: ['stockTransfers'],
  system_logs: ['activityLog']
};

// Branch-isolated modules (stored per-branch in Firestore; BR-MAIN keeps root module paths
// for 100% backwards compatibility while every secondary branch has its own subcollection)
const BRANCH_MODULE_DEFS = {
  parties: ['customers', 'suppliers'],
  sales: ['orders', 'sales', 'returns'],
  purchases: ['purchases', 'purchaseReturns'],
  expenses: ['expenses'],
  accounting: ['entries'],
  inventory_logs: ['stockMovements', 'stocktakes', 'stocktakeDraft'],
  branch_trash: ['trashBin', 'queue']
};

const ERP_MODULE_DEFS = { ...SHARED_MODULE_DEFS, ...BRANCH_MODULE_DEFS };

let firestoreDb = null;
let cloudSyncActive = false;
let cloudHydrated = false;
let cloudSyncWorkspaceId = 'tideerp_global_workspace';
let cloudSyncUnsubscribe = null;
let branchSyncUnsubscribe = null;
let isReceivingCloudBroadcast = false;
let broadcastGuardTimer = null;
let pendingCloudPush = null;
let lastSyncedModuleHashes = {};
let activeTenantBranchId = (() => {
  try {
    return localStorage.getItem(`tide-erp-active-branch_${activeTenantWorkspaceId}`) || DEFAULT_BRANCH_ID;
  } catch {
    return DEFAULT_BRANCH_ID;
  }
})();

function getActiveBranchId(wsId = activeTenantWorkspaceId) {
  if (wsId === activeTenantWorkspaceId && activeTenantBranchId) {
    return activeTenantBranchId;
  }
  try {
    return localStorage.getItem(`tide-erp-active-branch_${wsId || DEFAULT_WORKSPACE_ID}`) || DEFAULT_BRANCH_ID;
  } catch {
    return DEFAULT_BRANCH_ID;
  }
}

function modulesCollectionRef(db, wsId = activeTenantWorkspaceId) {
  const cleanWs = String(wsId || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
  if (cleanWs === DEFAULT_WORKSPACE_ID) {
    return db.collection(MODULES_COLLECTION);
  }
  return db.collection(TENANTS_COLLECTION).doc(cleanWs).collection('modules');
}

function branchModulesCollectionRef(db, wsId = activeTenantWorkspaceId, branchId = activeTenantBranchId) {
  const cleanWs = String(wsId || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
  const cleanBranch = String(branchId || DEFAULT_BRANCH_ID).trim() || DEFAULT_BRANCH_ID;
  if (cleanBranch === DEFAULT_BRANCH_ID) {
    return modulesCollectionRef(db, cleanWs);
  }
  if (cleanWs === DEFAULT_WORKSPACE_ID) {
    return db.collection(PRIMARY_BRANCHES_COLLECTION).doc(cleanBranch).collection('modules');
  }
  return db.collection(TENANTS_COLLECTION).doc(cleanWs).collection('branches').doc(cleanBranch).collection('modules');
}

function setActiveBranchId(branchId, wsId = activeTenantWorkspaceId) {
  const nextBranch = String(branchId || DEFAULT_BRANCH_ID).trim() || DEFAULT_BRANCH_ID;
  const targetWs = String(wsId || activeTenantWorkspaceId || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
  const changed = nextBranch !== activeTenantBranchId;
  if (changed) {
    if (branchSyncUnsubscribe) {
      try { branchSyncUnsubscribe(); } catch {}
      branchSyncUnsubscribe = null;
    }
    if (cloudSaveDebounce) {
      clearTimeout(cloudSaveDebounce);
      cloudSaveDebounce = null;
    }
    pendingCloudPush = null;
    activeTenantBranchId = nextBranch;
    // Clear only branch-scoped hashes so switching branches re-hydrates cleanly
    for (const modName of Object.keys(BRANCH_MODULE_DEFS)) {
      delete lastSyncedModuleHashes[modName];
    }
    cloudHydrated = false;
  }
  try { localStorage.setItem(`tide-erp-active-branch_${targetWs}`, nextBranch); } catch {}
  if (typeof window !== 'undefined' && typeof window.TideFirebase?.setBranch === 'function') {
    window.TideFirebase.setBranch(nextBranch);
  }
  return nextBranch;
}

function setActiveWorkspaceId(workspaceId) {
  const nextWs = String(workspaceId || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
  if (cloudSyncUnsubscribe) {
    try { cloudSyncUnsubscribe(); } catch {}
    cloudSyncUnsubscribe = null;
  }
  if (branchSyncUnsubscribe) {
    try { branchSyncUnsubscribe(); } catch {}
    branchSyncUnsubscribe = null;
  }
  if (cloudSaveDebounce) {
    clearTimeout(cloudSaveDebounce);
    cloudSaveDebounce = null;
  }
  if (broadcastGuardTimer) {
    clearTimeout(broadcastGuardTimer);
    broadcastGuardTimer = null;
  }
  isReceivingCloudBroadcast = false;
  pendingCloudPush = null;
  activeTenantWorkspaceId = nextWs;
  activeTenantBranchId = getActiveBranchId(nextWs);
  lastSyncedModuleHashes = {};
  cloudHydrated = false;
  try { localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextWs); } catch {}
  if (typeof window !== 'undefined' && typeof window.TideFirebase?.setWorkspace === 'function') {
    window.TideFirebase.setWorkspace(nextWs);
    window.TideFirebase.setBranch?.(activeTenantBranchId);
  }
  return nextWs;
}

function encodeAccountKey(prefix, rawVal) {
  const norm = String(rawVal || '').trim().toLowerCase();
  if (!norm) return '';
  return `${prefix}_${norm.replace(/[^a-z0-9._-]/g, c => '_x' + c.charCodeAt(0).toString(16) + '_')}`.slice(0, 220);
}

/**
 * Look up a user account across ALL registered companies in Firestore `tide_erp_accounts`
 * so logging in from ANY device routes directly to the user's own isolated company workspace.
 */
async function lookupAccountInDirectory(identifier) {
  const norm = String(identifier || '').trim().toLowerCase();
  if (!norm) return null;
  const db = await ensureFirestoreReady();
  if (!db) return null;

  const keys = [
    encodeAccountKey('user', norm),
    encodeAccountKey('email', norm)
  ].filter(Boolean);

  for (const docId of keys) {
    try {
      let snap;
      try {
        snap = await db.collection(ACCOUNTS_DIRECTORY_COLLECTION).doc(docId).get({ source: 'server' });
      } catch {
        snap = await db.collection(ACCOUNTS_DIRECTORY_COLLECTION).doc(docId).get();
      }
      if (snap && snap.exists) {
        return snap.data();
      }
    } catch {}
  }
  return null;
}

/**
 * Check if a username or email is already claimed by another user/company globally.
 */
async function checkCredentialsAvailableGlobally(username, email, exceptUserId = '', exceptWorkspaceId = '') {
  const db = await ensureFirestoreReady();
  if (!db) return true; // Offline fallback allows local check to decide

  const checks = [];
  if (username) checks.push(encodeAccountKey('user', username));
  if (email) checks.push(encodeAccountKey('email', email));

  for (const docId of checks.filter(Boolean)) {
    try {
      let snap;
      try {
        snap = await db.collection(ACCOUNTS_DIRECTORY_COLLECTION).doc(docId).get({ source: 'server' });
      } catch {
        snap = await db.collection(ACCOUNTS_DIRECTORY_COLLECTION).doc(docId).get();
      }
      if (snap && snap.exists) {
        const rec = snap.data();
        if (rec && !(rec.userId === exceptUserId && rec.workspaceId === exceptWorkspaceId)) {
          return false;
        }
      }
    } catch {}
  }
  return true;
}

/**
 * Register or update a user's login entry in `tide_erp_accounts` directory.
 */
async function registerAccountInDirectory(user, workspaceId = activeTenantWorkspaceId, companyName = '', previousUser = null) {
  if (!user) return false;
  const db = await ensureFirestoreReady();
  if (!db) return false;

  try {
    const targetWs = String(workspaceId || DEFAULT_WORKSPACE_ID);
    const targetUid = String(user.id || '');
    // Defense-in-depth: refuse to overwrite any directory entry owned by a DIFFERENT tenant/user!
    const available = await checkCredentialsAvailableGlobally(user.username, user.email, targetUid, targetWs);
    if (!available) {
      console.warn(`Blocked cross-tenant directory overwrite for ${user.username || user.email} (ws=${targetWs})`);
      return false;
    }

    const batch = db.batch();
    const col = db.collection(ACCOUNTS_DIRECTORY_COLLECTION);

    // Clean up old keys ONLY if they actually belong to this same (workspaceId, userId)
    if (previousUser) {
      const safeDeleteOldKey = async (docId) => {
        if (!docId) return;
        try {
          const snap = await col.doc(docId).get({ source: 'server' }).catch(() => col.doc(docId).get());
          if (snap && snap.exists) {
            const rec = snap.data();
            if (rec && rec.workspaceId === targetWs && rec.userId === targetUid) {
              batch.delete(col.doc(docId));
            }
          }
        } catch {}
      };
      if (previousUser.username && String(previousUser.username).toLowerCase() !== String(user.username || '').toLowerCase()) {
        await safeDeleteOldKey(encodeAccountKey('user', previousUser.username));
      }
      if (previousUser.email && String(previousUser.email).toLowerCase() !== String(user.email || '').toLowerCase()) {
        await safeDeleteOldKey(encodeAccountKey('email', previousUser.email));
      }
    }

    const payload = {
      workspaceId: targetWs,
      companyName: String(companyName || ''),
      userId: targetUid,
      name: String(user.name || ''),
      username: String(user.username || '').trim().toLowerCase(),
      email: String(user.email || '').trim().toLowerCase(),
      passwordHash: String(user.passwordHash || ''),
      passwordSalt: String(user.passwordSalt || ''),
      status: String(user.status || 'Active'),
      updatedAtMs: Date.now()
    };

    const userKey = encodeAccountKey('user', user.username);
    const emailKey = encodeAccountKey('email', user.email);
    if (userKey) batch.set(col.doc(userKey), payload);
    if (emailKey) batch.set(col.doc(emailKey), payload);

    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Account directory registration failed:', err);
    return false;
  }
}

async function removeAccountFromDirectory(user) {
  if (!user) return false;
  const db = await ensureFirestoreReady();
  if (!db) return false;

  try {
    const batch = db.batch();
    const col = db.collection(ACCOUNTS_DIRECTORY_COLLECTION);
    const userKey = encodeAccountKey('user', user.username);
    const emailKey = encodeAccountKey('email', user.email);
    if (userKey) batch.delete(col.doc(userKey));
    if (emailKey) batch.delete(col.doc(emailKey));
    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Account directory removal failed:', err);
    return false;
  }
}

async function syncWorkspaceUsersToDirectory(users = [], workspaceId = activeTenantWorkspaceId, companyName = '') {
  if (!Array.isArray(users) || !users.length) return;
  const db = await ensureFirestoreReady();
  if (!db) return;
  try {
    const batch = db.batch();
    const col = db.collection(ACCOUNTS_DIRECTORY_COLLECTION);
    let ops = 0;
    for (const u of users) {
      if (!u || (!u.username && !u.email) || !u.passwordHash) continue;
      const payload = {
        workspaceId: String(workspaceId || DEFAULT_WORKSPACE_ID),
        companyName: String(companyName || ''),
        userId: String(u.id || ''),
        name: String(u.name || ''),
        username: String(u.username || '').trim().toLowerCase(),
        email: String(u.email || '').trim().toLowerCase(),
        passwordHash: String(u.passwordHash || ''),
        passwordSalt: String(u.passwordSalt || ''),
        status: String(u.status || 'Active'),
        updatedAtMs: Date.now()
      };
      const userKey = encodeAccountKey('user', u.username);
      const emailKey = encodeAccountKey('email', u.email);
      if (userKey) { batch.set(col.doc(userKey), payload); ops++; }
      if (emailKey) { batch.set(col.doc(emailKey), payload); ops++; }
    }
    if (ops > 0) await batch.commit();
  } catch (err) {
    console.warn('Workspace directory sync skipped:', err);
  }
}

function getDeviceLabel() {
  return /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent || '') ? 'Phone' : 'PC';
}

function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.apiKey && parsed.apiKey.includes('Dafgbj')) {
        parsed.apiKey = DEFAULT_FIREBASE_CONFIG.apiKey;
        localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch { }
  return DEFAULT_FIREBASE_CONFIG;
}

function saveStoredFirebaseConfig(config) {
  if (!config) {
    localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    cloudSyncActive = false;
    cloudHydrated = false;
    if (cloudSyncUnsubscribe) {
      cloudSyncUnsubscribe();
      cloudSyncUnsubscribe = null;
    }
  } else {
    const parsed = typeof config === 'string' ? JSON.parse(config) : config;
    localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(parsed));
  }
}

function isCloudSyncConnected() {
  return cloudSyncActive && !!firestoreDb;
}

function isCloudHydrated() {
  return cloudHydrated;
}

function updateCloudStatusUI(status, info) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('cloud-sync-button');
  const indicator = document.getElementById('cloud-sync-indicator');
  const statusText = document.getElementById('footer-sync-status-text');
  const beacon = document.querySelector('.footer-live-beacon');
  const target = indicator || btn;
  if (!btn) return;
  if (status === 'connected') {
    if (target) target.style.color = '#00a651';
    btn.title = 'Cloud Database: Live Across All Devices (PC ⇄ Phone)';
    if (statusText) statusText.textContent = 'All Devices Live';
    if (beacon) beacon.style.background = '#00a651';
  } else if (status === 'connecting') {
    if (target) target.style.color = '#f59e0b';
    btn.title = 'Cloud Database: Connecting to Firebase...';
    if (statusText) statusText.textContent = 'Connecting...';
    if (beacon) beacon.style.background = '#f59e0b';
  } else {
    if (target) target.style.color = '#ef4444';
    btn.title = 'Offline Mode: Saved Locally (Syncs automatically when online)';
    if (statusText) statusText.textContent = 'Offline (local cache)';
    if (beacon) beacon.style.background = '#ef4444';
  }
}

/**
 * Strip `products` from every branch snapshot inside `branchData`
 * so products NEVER bloat the workspace/branch module documents.
 */
function stripProductsFromBranchData(branchData) {
  if (!branchData || typeof branchData !== 'object') return {};
  const clean = {};
  for (const [bId, bPayload] of Object.entries(branchData)) {
    if (!bPayload || typeof bPayload !== 'object') continue;
    const copy = { ...bPayload };
    delete copy.products;
    clean[bId] = copy;
  }
  return clean;
}

/**
 * Extract clean JSON-safe data for one ERP module
 */
function extractModulePayload(state, moduleName) {
  const keys = ERP_MODULE_DEFS[moduleName] || [];
  const data = {};
  for (const key of keys) {
    if (state[key] === undefined) continue;
    if (key === 'branchData') {
      data.branchData = stripProductsFromBranchData(state.branchData);
    } else {
      data[key] = state[key];
    }
  }
  let serialized = JSON.stringify(data);

  // Safety guard: keep every module well below Firestore's 1 MB document limit
  if (serialized.length > 850000) {
    if (moduleName === 'system_logs' && Array.isArray(data.activityLog)) {
      data.activityLog = data.activityLog.slice(0, 300);
      if (Array.isArray(data.trashBin) && data.trashBin.length > 50) {
        data.trashBin = data.trashBin.slice(0, 50);
      }
      serialized = JSON.stringify(data);
    } else if (moduleName === 'inventory_logs' && Array.isArray(data.stockMovements)) {
      data.stockMovements = data.stockMovements.slice(0, 1500);
      serialized = JSON.stringify(data);
    }
  }

  return {
    data: JSON.parse(serialized),
    hash: serialized
  };
}

async function ensureFirestoreReady() {
  if (firestoreDb) return firestoreDb;
  if (typeof window !== 'undefined' && window.TideFirebase?.initFirebase) {
    const db = await window.TideFirebase.initFirebase();
    if (db) {
      firestoreDb = db;
      cloudSyncActive = true;
      return firestoreDb;
    }
  }

  let retries = 0;
  while ((typeof window === 'undefined' || !window.firebase) && retries < 25) {
    retries++;
    await new Promise(r => setTimeout(r, 350));
  }
  if (typeof window === 'undefined' || !window.firebase) return null;

  const config = getStoredFirebaseConfig();
  if (!config || !config.projectId) return null;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    firestoreDb = firebase.firestore();
    cloudSyncActive = true;
    return firestoreDb;
  } catch (err) {
    console.error('Failed to initialize Firestore in db.js:', err);
    return null;
  }
}

/**
 * Cloud-First Hydration on App Boot or Refresh:
 * Reads ALL ERP modules from Firestore `tide_erp_modules` BEFORE any local writes
 * can push back to cloud. Guarantees any device gets the full live ERP on refresh.
 * Automatically migrates legacy `tide_erp_workspaces` data on first run.
 */
async function hydrateFromCloud(localState, initialState, preferServer = true) {
  updateCloudStatusUI('connecting');
  const db = await ensureFirestoreReady();
  if (!db) {
    updateCloudStatusUI('error');
    return { hydrated: false, state: localState, source: 'offline' };
  }

  try {
    const wsId = activeTenantWorkspaceId;
    const branchId = activeTenantBranchId || DEFAULT_BRANCH_ID;
    const isMainBranch = branchId === DEFAULT_BRANCH_ID;

    const sharedCol = modulesCollectionRef(db, wsId);
    const branchCol = branchModulesCollectionRef(db, wsId, branchId);

    const fetchCol = async (col) => {
      if (preferServer) {
        try { return await col.get({ source: 'server' }); } catch { return await col.get(); }
      }
      return await col.get();
    };

    const [sharedSnap, branchSnap] = isMainBranch
      ? [await fetchCol(sharedCol), null]
      : await Promise.all([fetchCol(sharedCol), fetchCol(branchCol)]);

    // Abort if workspace or branch changed while request was in flight
    if (wsId !== activeTenantWorkspaceId || branchId !== (activeTenantBranchId || DEFAULT_BRANCH_ID)) {
      return { hydrated: false, state: localState, source: 'stale-switch' };
    }

    // Case 1: Unified modular ERP data exists in cloud — use as authoritative truth
    if (sharedSnap && !sharedSnap.empty) {
      const merged = structuredClone(localState || initialState);
      const moduleHashes = {};
      let legacyBranchDataDoc = null;
      let legacySystemTrash = null;
      let hasBranchTrashDoc = false;

      sharedSnap.forEach(doc => {
        const modName = doc.id;
        const docData = doc.data();
        if (!docData || !docData.data || typeof docData.data !== 'object') return;

        if (modName === 'branch_data' && docData.data.branchData) {
          legacyBranchDataDoc = stripProductsFromBranchData(docData.data.branchData);
          return;
        }

        // Apply shared workspace modules always; apply branch modules from sharedSnap ONLY for BR-MAIN
        const isShared = Boolean(SHARED_MODULE_DEFS[modName]);
        const isBranch = Boolean(BRANCH_MODULE_DEFS[modName]);
        if (!isShared && !(isMainBranch && isBranch)) return;

        if (modName === 'system_logs' && isMainBranch) {
          if (Array.isArray(docData.data.trashBin) || Array.isArray(docData.data.queue)) {
            legacySystemTrash = {
              trashBin: Array.isArray(docData.data.trashBin) ? docData.data.trashBin : [],
              queue: Array.isArray(docData.data.queue) ? docData.data.queue : []
            };
          }
        }
        if (modName === 'branch_trash' && isMainBranch) {
          hasBranchTrashDoc = true;
        }

        for (const [k, v] of Object.entries(docData.data)) {
          if (k === 'products' || k === 'currentUserId' || k === 'branch' || k === 'activeBranchId') continue;
          if (!isMainBranch && (k === 'trashBin' || k === 'queue')) continue;
          merged[k] = v;
        }
        try {
          moduleHashes[modName] = JSON.stringify(docData.data);
        } catch {}
      });

      if (isMainBranch && !hasBranchTrashDoc && legacySystemTrash) {
        merged.trashBin = legacySystemTrash.trashBin;
        merged.queue = legacySystemTrash.queue;
      }

      // Secondary branch isolation: read strictly from branches/{branchId}/modules!
      if (!isMainBranch) {
        const branchFieldKeys = Object.values(BRANCH_MODULE_DEFS).flat();
        if (branchSnap && !branchSnap.empty) {
          // Reset branch fields to clean defaults first so BR-MAIN fields can NEVER bleed in
          for (const k of branchFieldKeys) {
            merged[k] = k === 'stocktakeDraft' ? null : [];
          }
          branchSnap.forEach(doc => {
            const modName = doc.id;
            if (!BRANCH_MODULE_DEFS[modName]) return;
            const docData = doc.data();
            if (!docData || !docData.data || typeof docData.data !== 'object') return;
            for (const [k, v] of Object.entries(docData.data)) {
              if (k === 'products' || k === 'currentUserId') continue;
              merged[k] = v;
            }
            try {
              moduleHashes[modName] = JSON.stringify(docData.data);
            } catch {}
          });
        } else {
          // Brand-new or pre-migration secondary branch: load legacy branchData[branchId] if any, else blank!
          const legacySlice = legacyBranchDataDoc?.[branchId] || localState?.branchData?.[branchId] || null;
          for (const k of branchFieldKeys) {
            if (legacySlice && legacySlice[k] !== undefined) {
              merged[k] = structuredClone(legacySlice[k]);
            } else {
              merged[k] = k === 'stocktakeDraft' ? null : [];
            }
          }
        }
      }

      const clean = sanitizeState(merged, initialState);
      clean.products = Array.isArray(localState?.products) ? localState.products : [];
      clean.currentUserId = localState?.currentUserId || '';

      // Preserve this device's active branch if it still exists
      const resolvedBranch = (clean.branches || []).find(b => b.id === branchId && b.status !== 'Inactive')
        || (clean.branches || []).find(b => b.status !== 'Inactive')
        || clean.branches?.[0];
      if (resolvedBranch) {
        clean.activeBranchId = resolvedBranch.id;
        clean.branch = resolvedBranch.name;
      }

      lastSyncedModuleHashes = { ...lastSyncedModuleHashes, ...moduleHashes };
      cloudHydrated = true;
      cloudSyncActive = true;
      updateCloudStatusUI('connected');
      console.info(`✓ Hydrated ERP from cloud (ws=${wsId}, branch=${branchId}, shared=${sharedSnap.size}${branchSnap ? `, branchDocs=${branchSnap.size}` : ''})`);
      return { hydrated: true, state: clean, source: 'cloud-modules' };
    }

    // Case 2: First-time migration from legacy `tide_erp_workspaces` document (ONLY for primary workspace!)
    let baseState = structuredClone(localState || initialState);
    if (activeTenantWorkspaceId === DEFAULT_WORKSPACE_ID) {
      try {
        const legacyDoc = await db.collection(LEGACY_WORKSPACES_COLLECTION).doc(cloudSyncWorkspaceId).get();
        if (legacyDoc.exists) {
          const legacyPayload = legacyDoc.data()?.payload;
          if (legacyPayload && typeof legacyPayload === 'object') {
            baseState = mergeLegacyForMigration(baseState, legacyPayload);
            console.info('✓ Migrated legacy workspace data into modular cloud ERP');
          }
        }
      } catch (migErr) {
        console.warn('Legacy migration check skipped:', migErr);
      }
    }

    const cleanSeed = sanitizeState(baseState, initialState);
    cleanSeed.products = Array.isArray(localState?.products) ? localState.products : [];
    cleanSeed.currentUserId = localState?.currentUserId || '';

    cloudHydrated = true;
    cloudSyncActive = true;
    updateCloudStatusUI('connected');

    // Seed all modular docs to Firestore once
    await pushStateToCloud(cleanSeed, true, true);

    return { hydrated: true, state: cleanSeed, source: 'migrated-seed' };
  } catch (err) {
    console.warn('Cloud hydration failed (continuing with local IndexedDB cache):', err);
    updateCloudStatusUI('error', err);
    return { hydrated: false, state: localState, source: 'offline-fallback' };
  }
}

/**
 * One-time non-destructive merge used ONLY when migrating from old single-doc workspace
 * to the new `tide_erp_modules` collection so zero prior records are lost.
 */
function mergeLegacyForMigration(localState, legacyPayload) {
  const merged = { ...legacyPayload, ...localState };
  const unionById = (a = [], b = [], fallbackKey = 'id') => {
    const map = new Map();
    for (const item of a) {
      if (item && (item[fallbackKey] || item.name)) map.set(item[fallbackKey] || item.name, item);
    }
    for (const item of b) {
      if (item && (item[fallbackKey] || item.name)) {
        const k = item[fallbackKey] || item.name;
        map.set(k, map.has(k) ? { ...map.get(k), ...item } : item);
      }
    }
    return Array.from(map.values());
  };
  merged.customers = unionById(legacyPayload.customers, localState.customers);
  merged.suppliers = unionById(legacyPayload.suppliers, localState.suppliers);
  merged.sales = unionById(legacyPayload.sales, localState.sales);
  merged.orders = unionById(legacyPayload.orders, localState.orders);
  merged.purchases = unionById(legacyPayload.purchases, localState.purchases);
  merged.expenses = unionById(legacyPayload.expenses, localState.expenses);
  merged.entries = unionById(legacyPayload.entries, localState.entries);
  merged.returns = unionById(legacyPayload.returns, localState.returns);
  merged.purchaseReturns = unionById(legacyPayload.purchaseReturns, localState.purchaseReturns);
  merged.stockMovements = unionById(legacyPayload.stockMovements, localState.stockMovements);
  merged.stocktakes = unionById(legacyPayload.stocktakes, localState.stocktakes);
  if (Array.isArray(legacyPayload.users) && legacyPayload.users.length > (localState.users?.length || 0)) {
    merged.users = legacyPayload.users;
  }
  if (Array.isArray(legacyPayload.branches) && legacyPayload.branches.length > (localState.branches?.length || 0)) {
    merged.branches = legacyPayload.branches;
  }
  merged.branchData = stripProductsFromBranchData(localState.branchData || legacyPayload.branchData || {});
  delete merged.products;
  return merged;
}

/**
 * Explicit Pull from Cloud Server (for Refresh / Sync button)
 */
async function pullFullCloudState(localState, initialState) {
  return hydrateFromCloud(localState, initialState, true);
}

let cloudInitRetries = 0;
function initCloudSync(workspaceId, onRemoteUpdate) {
  if (typeof window === 'undefined') return false;
  if (!window.firebase) {
    updateCloudStatusUI('connecting');
    if (cloudInitRetries < 25) {
      cloudInitRetries++;
      setTimeout(() => initCloudSync(workspaceId, onRemoteUpdate), 400);
    } else {
      console.warn('Firebase SDK not loaded after retries; running in local offline mode.');
      updateCloudStatusUI('error');
    }
    return false;
  }

  const config = getStoredFirebaseConfig();
  if (!config || !config.projectId) {
    updateCloudStatusUI('error');
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    firestoreDb = firebase.firestore();
    cloudSyncWorkspaceId = (workspaceId || 'tideerp_global_workspace').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    cloudSyncActive = true;
    updateCloudStatusUI('connected');

    if (cloudSyncUnsubscribe) {
      cloudSyncUnsubscribe();
      cloudSyncUnsubscribe = null;
    }
    if (branchSyncUnsubscribe) {
      branchSyncUnsubscribe();
      branchSyncUnsubscribe = null;
    }

    const boundWsId = activeTenantWorkspaceId;
    const boundBranchId = activeTenantBranchId || DEFAULT_BRANCH_ID;
    const isMainBranch = boundBranchId === DEFAULT_BRANCH_ID;

    const handleSnapshot = (snapshot, allowedDefs) => {
      if (boundWsId !== activeTenantWorkspaceId || boundBranchId !== (activeTenantBranchId || DEFAULT_BRANCH_ID)) return;
      updateCloudStatusUI('connected');
      if (snapshot.empty) return;
      if (snapshot.metadata && snapshot.metadata.hasPendingWrites) return;

      const changedFields = {};
      const changedModules = [];
      let latestDevice = 'another device';

      snapshot.forEach((doc) => {
        const modName = doc.id;
        if (!allowedDefs[modName]) return;
        const remote = doc.data();
        if (!remote || !remote.data || typeof remote.data !== 'object') return;

        if (remote.updatedBy === CLIENT_SESSION_ID) {
          try { lastSyncedModuleHashes[modName] = JSON.stringify(remote.data); } catch {}
          return;
        }

        let remoteHash = '';
        try { remoteHash = JSON.stringify(remote.data); } catch { return; }

        if (remoteHash === lastSyncedModuleHashes[modName]) {
          return;
        }

        lastSyncedModuleHashes[modName] = remoteHash;
        changedModules.push(modName);
        if (remote.device) latestDevice = remote.device;

        for (const [k, v] of Object.entries(remote.data)) {
          if (k === 'products' || k === 'currentUserId' || k === 'branch' || k === 'activeBranchId' || k === 'branchData') continue;
          if (!isMainBranch && modName === 'system_logs' && (k === 'trashBin' || k === 'queue')) continue;
          changedFields[k] = v;
        }
      });

      if (changedModules.length === 0) return;

      cloudHydrated = true;
      isReceivingCloudBroadcast = true;
      try {
        if (typeof onRemoteUpdate === 'function') {
          onRemoteUpdate(changedFields, latestDevice, changedModules);
        }
      } finally {
        if (broadcastGuardTimer) clearTimeout(broadcastGuardTimer);
        broadcastGuardTimer = setTimeout(() => {
          broadcastGuardTimer = null;
          isReceivingCloudBroadcast = false;
          if (pendingCloudPush && boundWsId === activeTenantWorkspaceId && boundBranchId === (activeTenantBranchId || DEFAULT_BRANCH_ID)) {
            const queued = pendingCloudPush;
            pendingCloudPush = null;
            pushStateToCloud(queued.state, queued.immediate, queued.forceAll);
          } else {
            pendingCloudPush = null;
          }
        }, 80);
      }
    };

    // 1. Listener on shared workspace modules (and BR-MAIN branch modules when on BR-MAIN)
    const sharedAllowed = isMainBranch ? ERP_MODULE_DEFS : SHARED_MODULE_DEFS;
    cloudSyncUnsubscribe = modulesCollectionRef(firestoreDb, boundWsId)
      .onSnapshot(
        (snapshot) => handleSnapshot(snapshot, sharedAllowed),
        (err) => {
          console.warn('Real-time shared ERP modules listener error:', err);
          updateCloudStatusUI('error', err);
        }
      );

    // 2. For secondary branches, attach dedicated isolated listener on branches/{branchId}/modules
    if (!isMainBranch) {
      branchSyncUnsubscribe = branchModulesCollectionRef(firestoreDb, boundWsId, boundBranchId)
        .onSnapshot(
          (snapshot) => handleSnapshot(snapshot, BRANCH_MODULE_DEFS),
          (err) => {
            console.warn(`Real-time branch (${boundBranchId}) modules listener error:`, err);
            updateCloudStatusUI('error', err);
          }
        );
    }

    console.info(`✓ Live isolated ERP stream active (ws=${boundWsId}, branch=${boundBranchId})`);
    return true;
  } catch (err) {
    console.error('Failed to initialize unified ERP cloud sync:', err);
    cloudSyncActive = false;
    updateCloudStatusUI('error', err);
    return false;
  }
}

// Keep legacy helper exported for backwards compatibility if referenced anywhere
function mergeWorkspaceState(localState, remoteState) {
  if (!remoteState) return localState;
  if (!localState) return remoteState;
  const merged = { ...localState, ...remoteState };
  merged.products = Array.isArray(localState.products) ? localState.products : [];
  merged.currentUserId = localState.currentUserId;
  return merged;
}

let cloudSaveDebounce = null;
async function pushStateToCloud(state, immediate = false, forceAll = false) {
  if (!cloudSyncActive || !firestoreDb || !state) return;
  if (!cloudHydrated && !forceAll) return; // Never overwrite cloud before initial hydration!
  if (isReceivingCloudBroadcast) {
    // Queue local edits instead of dropping them during an incoming cloud broadcast
    pendingCloudPush = {
      state,
      immediate: Boolean(immediate || pendingCloudPush?.immediate),
      forceAll: Boolean(forceAll || pendingCloudPush?.forceAll)
    };
    return;
  }

  const doPush = async () => {
    const pushWsId = activeTenantWorkspaceId;
    const pushBranchId = activeTenantBranchId || DEFAULT_BRANCH_ID;
    try {
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const device = getDeviceLabel();
      const dirtyModules = [];

      for (const modName of Object.keys(ERP_MODULE_DEFS)) {
        const { data, hash } = extractModulePayload(state, modName);
        if (!forceAll && lastSyncedModuleHashes[modName] === hash) {
          continue; // Unchanged module — skip write!
        }
        // Guard Firestore 1 MB hard limit per document
        if (hash.length > 980000) {
          console.warn(`Skipping oversized module '${modName}' (${hash.length} bytes)`);
          continue;
        }
        const isBranchScoped = Boolean(BRANCH_MODULE_DEFS[modName]);
        dirtyModules.push({ modName, data, hash, isBranchScoped });
      }

      if (dirtyModules.length === 0) return;

      const batch = firestoreDb.batch();
      const sharedCol = modulesCollectionRef(firestoreDb, pushWsId);
      const branchCol = branchModulesCollectionRef(firestoreDb, pushWsId, pushBranchId);
      for (const item of dirtyModules) {
        const ref = (item.isBranchScoped ? branchCol : sharedCol).doc(item.modName);
        batch.set(ref, {
          data: item.data,
          updatedAtMs: nowMs,
          updatedAt: nowIso,
          updatedBy: CLIENT_SESSION_ID,
          branchId: item.isBranchScoped ? pushBranchId : 'SHARED',
          device
        }); // Full replace per module so deleted items stay deleted!
      }

      await batch.commit();
      if (pushWsId === activeTenantWorkspaceId && pushBranchId === (activeTenantBranchId || DEFAULT_BRANCH_ID)) {
        for (const item of dirtyModules) {
          lastSyncedModuleHashes[item.modName] = item.hash;
        }
        if (forceAll) cloudHydrated = true;
      }
      console.info(`✓ Synced ${dirtyModules.length} ERP module(s) for ${pushWsId}/${pushBranchId}: ${dirtyModules.map(m => m.modName).join(', ')}`);
    } catch (err) {
      console.warn('Live cloud ERP push failed (changes remain safely cached in IndexedDB and will retry):', err);
    }
  };

  if (cloudSaveDebounce) clearTimeout(cloudSaveDebounce);
  if (immediate) {
    await doPush();
  } else {
    cloudSaveDebounce = setTimeout(doPush, 350);
  }
}

/**
 * Append an incoming stock movement directly into a destination branch's Firestore
 * `inventory_logs` module so inter-branch transfers leave an audit trail on both ends.
 */
async function appendBranchStockMovement(destBranchId, movement, wsId = activeTenantWorkspaceId) {
  if (!destBranchId || !movement) return false;
  const db = await ensureFirestoreReady();
  if (!db) return false;
  try {
    const ref = branchModulesCollectionRef(db, wsId, destBranchId).doc('inventory_logs');
    let snap = null;
    try {
      snap = await ref.get({ source: 'server' });
    } catch {
      snap = await ref.get();
    }
    const existingData = (snap && snap.exists && snap.data()?.data) ? snap.data().data : {};
    const prevMovements = Array.isArray(existingData.stockMovements) ? existingData.stockMovements : [];
    const nextMovements = [movement, ...prevMovements.filter(m => m && m.id !== movement.id)];
    const nowMs = Date.now();
    await ref.set({
      data: {
        stockMovements: nextMovements,
        stocktakes: Array.isArray(existingData.stocktakes) ? existingData.stocktakes : [],
        stocktakeDraft: existingData.stocktakeDraft !== undefined ? existingData.stocktakeDraft : null
      },
      updatedAtMs: nowMs,
      updatedAt: new Date(nowMs).toISOString(),
      updatedBy: CLIENT_SESSION_ID,
      branchId: destBranchId,
      device: getDeviceLabel()
    });
    return true;
  } catch (err) {
    console.warn(`Failed to append stock movement to branch ${destBranchId}:`, err);
    return false;
  }
}
