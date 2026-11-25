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
        persistState(migrated).catch(() => {});
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
let firestoreDb = null;
let cloudSyncActive = false;
let cloudSyncWorkspaceId = 'main-workspace';
let cloudSyncUnsubscribe = null;
let lastCloudSaveTime = 0;
let isReceivingCloudBroadcast = false;

function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
    cloudSyncWorkspaceId = (workspaceId || 'main-workspace').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
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
        if (!snapshot.exists) return;
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

let cloudSaveDebounce = null;
function pushStateToCloud(state) {
  if (!cloudSyncActive || !firestoreDb || isReceivingCloudBroadcast || !state) return;

  if (cloudSaveDebounce) clearTimeout(cloudSaveDebounce);
  cloudSaveDebounce = setTimeout(async () => {
    try {
      lastCloudSaveTime = Date.now();
      // Clean serializable clone
      const cleanClone = JSON.parse(JSON.stringify(state));
      // Delete temporary runtime flags
      delete cleanClone.currentUserId;

      await firestoreDb.collection('tide_erp_workspaces').doc(cloudSyncWorkspaceId).set({
        payload: cleanClone,
        updatedAtMs: lastCloudSaveTime,
        updatedAt: new Date().toISOString(),
        device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Phone' : 'PC'
      }, { merge: true });
    } catch (err) {
      console.warn('Live cloud sync push failed:', err);
    }
  }, 1200);
}
