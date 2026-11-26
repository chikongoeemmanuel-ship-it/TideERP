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
  apiKey: "AIzaSyDaFgbjKDUHGS4hbBTb4sjJ76nK24ozkls",
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
    btn.title = 'Cloud Sync: Live Connected (PC ⇄ Phone)';
    if (statusText) statusText.textContent = 'Multi-device Live';
    if (beacon) beacon.style.background = '#00a651';
  } else if (status === 'connecting') {
    if (target) target.style.color = '#f59e0b';
    btn.title = 'Cloud Sync: Connecting to Firebase...';
    if (statusText) statusText.textContent = 'Connecting...';
    if (beacon) beacon.style.background = '#f59e0b';
  } else {
    if (target) target.style.color = '#ef4444';
    btn.title = 'Cloud Sync: Disconnected (Tap to view)';
    if (statusText) statusText.textContent = 'Offline (local mode)';
    if (beacon) beacon.style.background = '#ef4444';
  }
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
      console.warn('Firebase SDK not loaded after retries; running in local storage mode.');
      updateCloudStatusUI('error');
    }
    return false;
  }
  const config = getStoredFirebaseConfig();
  if (!config || !config.projectId) {
    console.info('No Firebase cloud credentials configured; running in standalone local mode.');
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

    // Attach real-time Firestore listener
    if (cloudSyncUnsubscribe) {
      cloudSyncUnsubscribe();
      cloudSyncUnsubscribe = null;
    }

    cloudSyncUnsubscribe = firestoreDb
      .collection('tide_erp_workspaces')
      .doc(cloudSyncWorkspaceId)
      .onSnapshot((snapshot) => {
        updateCloudStatusUI('connected');
        if (!snapshot.exists) {
          // Cloud doc does not exist yet; populate cloud from this client
          if (typeof window.requestPushStateToCloud === 'function') {
            window.requestPushStateToCloud();
          }
          return;
        }
        const remote = snapshot.data();
        if (!remote || !remote.payload || Object.keys(remote.payload).length === 0) {
          if (typeof window.requestPushStateToCloud === 'function') {
            window.requestPushStateToCloud();
          }
          return;
        }

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
        updateCloudStatusUI('error', err);
      });

    console.info(`✓ Live cloud sync active for workspace: ${cloudSyncWorkspaceId}`);
    return true;
  } catch (err) {
    console.error('Failed to initialize live cloud sync:', err);
    cloudSyncActive = false;
    updateCloudStatusUI('error', err);
    return false;
  }
}

function mergeWorkspaceState(localState, remoteState) {
  if (!remoteState) return localState;
  if (!localState) return remoteState;

  const merged = { ...remoteState };

  // Products are managed exclusively in the dedicated Firestore 'products' collection.
  // Never resurrect or overwrite products from the old workspace document.
  merged.products = Array.isArray(localState.products) ? localState.products : [];

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
  (remoteState.customers || []).forEach(c => { if (c) customerMap.set(c.id || c.name, c); });
  (localState.customers || []).forEach(c => {
    if (c) {
      const key = c.id || c.name;
      if (!customerMap.has(key)) {
        customerMap.set(key, c);
      } else {
        const existing = customerMap.get(key);
        customerMap.set(key, { ...existing, ...c });
      }
    }
  });
  merged.customers = Array.from(customerMap.values());

  const supplierMap = new Map();
  (remoteState.suppliers || []).forEach(s => { if (s) supplierMap.set(s.id || s.name, s); });
  (localState.suppliers || []).forEach(s => {
    if (s) {
      const key = s.id || s.name;
      if (!supplierMap.has(key)) {
        supplierMap.set(key, s);
      } else {
        const existing = supplierMap.get(key);
        supplierMap.set(key, { ...existing, ...s });
      }
    }
  });
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
      delete cleanClone.products; // Stored separately in the dedicated 'products' Firestore collection

      await firestoreDb.collection('tide_erp_workspaces').doc(cloudSyncWorkspaceId).set({
        payload: cleanClone,
        updatedAtMs: lastCloudSaveTime,
        updatedAt: new Date().toISOString(),
        device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Phone' : 'PC'
      }, { merge: true });
      console.info(`✓ Cloud state synced successfully (workspace records)`);
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
