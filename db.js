// IndexedDB storage engine for Tide ERP
// Provides high-capacity asynchronous persistence and automatic migration from localStorage.

const DB_NAME = 'TideERP_Storage';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';
const STATE_DOC_ID = 'current_state';
const LEGACY_STORAGE_KEY = 'tide-erp-demo-v1';

let dbInstance = null;

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

async function loadPersistedState(initialState) {
  try {
    const db = await openDatabase();
    if (db) {
      const stateFromDB = await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get(STATE_DOC_ID);
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

  // Fallback: check localStorage for legacy state and migrate
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed && typeof parsed === 'object') {
        const migrated = sanitizeState(parsed, initialState);
        // Persist migrated state to IndexedDB asynchronously
        persistState(migrated).catch(() => { });
        return migrated;
      }
    }
  } catch (err) {
    console.warn('Error checking legacy localStorage:', err);
  }

  return structuredClone(initialState);
}

async function persistState(state) {
  if (!state) return;

  // 1. Persist to IndexedDB
  let savedInIndexedDB = false;
  try {
    const db = await openDatabase();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ id: STATE_DOC_ID, data: state, updatedAt: new Date().toISOString() });
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
      savedInIndexedDB = true;
    }
  } catch (err) {
    console.error('IndexedDB write failure:', err);
  }

  // file:// origins can block IndexedDB in some browsers; preserve data in local storage when possible.
  if (!savedInIndexedDB) {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Fallback browser storage could not save the full workspace:', err);
    }
  }

  // 2. Keep a lightweight fallback in localStorage (avoiding large image data overflows)
  try {
    const lightweight = {
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
    'returns', 'purchaseReturns', 'purchases', 'entries', 'queue',
    'stockMovements', 'users', 'productCategories', 'measurementUnits',
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
  for (const u of clean.users) {
    if (u.name === 'Amina Mwinyi' || u.name === 'Amina' || /amina/i.test(u.name || '')) {
      u.name = 'Administrator';
    }
  }
  for (const p of clean.products) {
    if (typeof p.expiryDate !== 'string') p.expiryDate = '';
    if (typeof p.batchNumber !== 'string') p.batchNumber = '';
  }
  if (!clean.companyName || clean.companyName === 'Kipepeo Traders' || /kipepeo/i.test(clean.companyName || '')) {
    clean.companyName = 'My Company';
  }
  if (!clean.currency) clean.currency = 'TZS';
  if (typeof clean.vatEnabled !== 'boolean') clean.vatEnabled = true;
  if (typeof clean.vatRate !== 'number') clean.vatRate = 18;
  return clean;
}

// =========================================================
// Real-Time Cloud Sync Engine (Firebase Firestore)
// Automatically synchronizes state across PC, phone, & devices
// =========================================================
const FIREBASE_CONFIG_STORAGE_KEY = 'tide-firebase-config';
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDafgbjKDUHGS4hbBTb4sjJ76nK24ozkls",
  authDomain: "tideerp.firebaseapp.com",
  projectId: "tideerp",
  storageBucket: "tideerp.firebasestorage.app",
  messagingSenderId: "519899083425",
  appId: "1:519899083425:web:a91554721d225a731476e0",
  measurementId: "G-DMRTQPN22Z"
};

let firestoreDb = null;
let cloudSyncActive = false;
let cloudSyncWorkspaceId = 'tideerp_global_workspace';
let cloudSyncUnsubscribe = null;
let lastCloudSaveTime = 0;
let isReceivingCloudBroadcast = false;

function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return DEFAULT_FIREBASE_CONFIG;
}

function saveStoredFirebaseConfig(config) {
  if (!config) {
    localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    cloudSyncActive = false;
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

function initCloudSync(workspaceId, onRemoteUpdate) {
  if (typeof window === 'undefined' || !window.firebase) {
    console.info('Firebase SDK not loaded or offline; running in local storage mode.');
    return false;
  }
  const config = getStoredFirebaseConfig();
  if (!config || !config.projectId) {
    console.info('No Firebase cloud credentials configured; running in standalone local mode.');
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    firestoreDb = firebase.firestore();
    cloudSyncWorkspaceId = (workspaceId || 'tideerp_global_workspace').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    cloudSyncActive = true;

    // Attach real-time Firestore listener
    if (cloudSyncUnsubscribe) {
      cloudSyncUnsubscribe();
      cloudSyncUnsubscribe = null;
    }

    cloudSyncUnsubscribe = firestoreDb
      .collection('tide_erp_workspaces')
      .doc(cloudSyncWorkspaceId)
      .onSnapshot((snapshot) => {
        if (!snapshot.exists) {
          // Cloud doc does not exist yet; populate cloud from this client
          if (typeof window.requestPushStateToCloud === 'function') {
            window.requestPushStateToCloud();
          }
          return;
        }
        const remote = snapshot.data();
        if (!remote || !remote.payload) return;

        // Skip echo updates originated from this exact client push
        const remoteTime = remote.updatedAtMs || 0;
        if (remoteTime && remoteTime <= lastCloudSaveTime) return;

        isReceivingCloudBroadcast = true;
        try {
          if (typeof onRemoteUpdate === 'function') {
            onRemoteUpdate(remote.payload, remote.device || 'remote');
          }
        } finally {
          setTimeout(() => { isReceivingCloudBroadcast = false; }, 400);
        }
      }, (err) => {
        console.warn('Real-time cloud sync listener encountered an error:', err);
      });

    console.info(`✓ Live cloud sync active for workspace: ${cloudSyncWorkspaceId}`);
    return true;
  } catch (err) {
    console.error('Failed to initialize live cloud sync:', err);
    cloudSyncActive = false;
    return false;
  }
}

function mergeWorkspaceState(localState, remoteState) {
  if (!remoteState) return localState;
  if (!localState) return remoteState;

  const merged = { ...remoteState };

  // 1. Merge products: Union by ID (SKU), local edits take priority if local has items
  const productMap = new Map();
  (remoteState.products || []).forEach(p => {
    if (p && p.id) productMap.set(p.id, p);
  });
  (localState.products || []).forEach(p => {
    if (p && p.id) {
      if (!productMap.has(p.id)) {
        productMap.set(p.id, p);
      } else {
        const existing = productMap.get(p.id);
        productMap.set(p.id, { ...existing, ...p });
      }
    }
  });
  merged.products = Array.from(productMap.values());

  // 2. Merge sales & orders: Union by ID
  const salesMap = new Map();
  (remoteState.sales || []).forEach(s => { if (s && s.id) salesMap.set(s.id, s); });
  (localState.sales || []).forEach(s => { if (s && s.id) salesMap.set(s.id, s); });
  merged.sales = Array.from(salesMap.values());

  const ordersMap = new Map();
  (remoteState.orders || []).forEach(o => { if (o && o.id) ordersMap.set(o.id, o); });
  (localState.orders || []).forEach(o => { if (o && o.id) ordersMap.set(o.id, o); });
  merged.orders = Array.from(ordersMap.values());

  // 3. Merge purchases: Union by ID
  const purchasesMap = new Map();
  (remoteState.purchases || []).forEach(p => { if (p && p.id) purchasesMap.set(p.id, p); });
  (localState.purchases || []).forEach(p => { if (p && p.id) purchasesMap.set(p.id, p); });
  merged.purchases = Array.from(purchasesMap.values());

  // 4. Merge customers and suppliers
  const customerMap = new Map();
  (remoteState.customers || []).forEach(c => { if (c && c.name) customerMap.set(c.name, c); });
  (localState.customers || []).forEach(c => { if (c && c.name) customerMap.set(c.name, c); });
  merged.customers = Array.from(customerMap.values());

  const supplierMap = new Map();
  (remoteState.suppliers || []).forEach(s => { if (s && s.name) supplierMap.set(s.name, s); });
  (localState.suppliers || []).forEach(s => { if (s && s.name) supplierMap.set(s.name, s); });
  merged.suppliers = Array.from(supplierMap.values());

  // 5. Preserve local session and active branch
  merged.currentUserId = localState.currentUserId;
  merged.activeBranchId = localState.activeBranchId || remoteState.activeBranchId;
  merged.branch = localState.branch || remoteState.branch;

  return merged;
}

let cloudSaveDebounce = null;
async function pushStateToCloud(state, immediate = false) {
  if (!cloudSyncActive || !firestoreDb || isReceivingCloudBroadcast || !state) return;

  const doPush = async () => {
    try {
      lastCloudSaveTime = Date.now();
      const cleanClone = JSON.parse(JSON.stringify(state));
      delete cleanClone.currentUserId;

      await firestoreDb.collection('tide_erp_workspaces').doc(cloudSyncWorkspaceId).set({
        payload: cleanClone,
        updatedAtMs: lastCloudSaveTime,
        updatedAt: new Date().toISOString(),
        device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Phone' : 'PC'
      }, { merge: true });
      console.info(`✓ Cloud state synced successfully (${cleanClone.products?.length || 0} products)`);
    } catch (err) {
      console.warn('Live cloud sync push failed:', err);
    }
  };

  if (cloudSaveDebounce) clearTimeout(cloudSaveDebounce);
  if (immediate) {
    await doPush();
  } else {
    cloudSaveDebounce = setTimeout(doPush, 500);
  }
}
