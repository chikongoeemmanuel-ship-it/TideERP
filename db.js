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
