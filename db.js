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

  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed && typeof parsed === 'object') {
        const migrated = sanitizeState(parsed, initialState);
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

  if (!savedInIndexedDB) {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Fallback browser storage could not save the full workspace:', err);
    }
  }

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
    'returns', 'purchaseReturns', 'purchases', 'expenses', 'entries', 'queue',
    'stockMovements', 'stocktakes', 'users', 'productCategories', 'measurementUnits',
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
const LEGACY_WORKSPACES_COLLECTION = 'tide_erp_workspaces';
const CLIENT_SESSION_ID = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);

// Every non-product field of the ERP mapped to its own clean Firestore document
const ERP_MODULE_DEFS = {
  core: [
    'version', 'companyName', 'companyAddress', 'companyPhone', 'companyEmail',
    'companyPaymentDetails', 'companyAdminId', 'currency', 'vatEnabled', 'vatRate',
    'branches', 'users', 'productCategories', 'measurementUnits', 'productPackages',
    'notificationSettings', 'branch', 'activeBranchId'
  ],
  assets: ['companyLogo'],
  parties: ['customers', 'suppliers'],
  sales: ['orders', 'sales', 'returns'],
  purchases: ['purchases', 'purchaseReturns'],
  expenses: ['expenses'],
  accounting: ['entries'],
  inventory_logs: ['stockMovements', 'stocktakes', 'stocktakeDraft'],
  system_logs: ['activityLog', 'trashBin', 'queue'],
  branch_data: ['branchData']
};

let firestoreDb = null;
let cloudSyncActive = false;
let cloudHydrated = false;
let cloudSyncWorkspaceId = 'tideerp_global_workspace';
let cloudSyncUnsubscribe = null;
let isReceivingCloudBroadcast = false;
let lastSyncedModuleHashes = {};

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
    let snap;
    if (preferServer) {
      try {
        snap = await db.collection(MODULES_COLLECTION).get({ source: 'server' });
      } catch {
        snap = await db.collection(MODULES_COLLECTION).get();
      }
    } else {
      snap = await db.collection(MODULES_COLLECTION).get();
    }

    // Case 1: Unified modular ERP data exists in cloud — use as authoritative truth
    if (snap && !snap.empty) {
      const merged = structuredClone(localState || initialState);
      const moduleHashes = {};

      snap.forEach(doc => {
        const modName = doc.id;
        if (!ERP_MODULE_DEFS[modName]) return;
        const docData = doc.data();
        if (!docData || !docData.data || typeof docData.data !== 'object') return;
        for (const [k, v] of Object.entries(docData.data)) {
          if (k === 'products' || k === 'currentUserId') continue;
          if (k === 'branchData') {
            merged.branchData = stripProductsFromBranchData(v);
          } else {
            merged[k] = v;
          }
        }
        try {
          moduleHashes[modName] = JSON.stringify(docData.data);
        } catch {}
      });

      const clean = sanitizeState(merged, initialState);
      clean.products = Array.isArray(localState?.products) ? localState.products : [];
      clean.currentUserId = localState?.currentUserId || '';

      // Preserve this device's active branch if it still exists
      if (localState?.activeBranchId && (clean.branches || []).some(b => b.id === localState.activeBranchId)) {
        clean.activeBranchId = localState.activeBranchId;
        const b = clean.branches.find(x => x.id === localState.activeBranchId);
        if (b) clean.branch = b.name;
      }

      lastSyncedModuleHashes = { ...lastSyncedModuleHashes, ...moduleHashes };
      cloudHydrated = true;
      cloudSyncActive = true;
      updateCloudStatusUI('connected');
      console.info(`✓ Hydrated entire ERP from cloud (${snap.size} modules)`);
      return { hydrated: true, state: clean, source: 'cloud-modules' };
    }

    // Case 2: First-time migration from legacy `tide_erp_workspaces` document
    let baseState = structuredClone(localState || initialState);
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

    // Real-time listener on ALL ERP modules in `tide_erp_modules`
    cloudSyncUnsubscribe = firestoreDb
      .collection(MODULES_COLLECTION)
      .onSnapshot((snapshot) => {
        updateCloudStatusUI('connected');
        if (snapshot.empty) return;

        // Ignore local optimistic echoes originating from this exact browser tab
        if (snapshot.metadata && snapshot.metadata.hasPendingWrites) return;

        const changedFields = {};
        const changedModules = [];
        let latestDevice = 'another device';

        snapshot.forEach((doc) => {
          const modName = doc.id;
          if (!ERP_MODULE_DEFS[modName]) return;
          const remote = doc.data();
          if (!remote || !remote.data || typeof remote.data !== 'object') return;

          // Skip our own session's echoes
          if (remote.updatedBy === CLIENT_SESSION_ID) {
            try { lastSyncedModuleHashes[modName] = JSON.stringify(remote.data); } catch {}
            return;
          }

          let remoteHash = '';
          try { remoteHash = JSON.stringify(remote.data); } catch { return; }

          if (remoteHash === lastSyncedModuleHashes[modName]) {
            return; // Identical to what we already have
          }

          lastSyncedModuleHashes[modName] = remoteHash;
          changedModules.push(modName);
          if (remote.device) latestDevice = remote.device;

          for (const [k, v] of Object.entries(remote.data)) {
            if (k === 'products' || k === 'currentUserId') continue;
            if (k === 'branchData') {
              changedFields.branchData = stripProductsFromBranchData(v);
            } else {
              changedFields[k] = v;
            }
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
          setTimeout(() => { isReceivingCloudBroadcast = false; }, 350);
        }
      }, (err) => {
        console.warn('Real-time ERP modules listener error:', err);
        updateCloudStatusUI('error', err);
      });

    console.info(`✓ Live unified ERP stream active across all ${Object.keys(ERP_MODULE_DEFS).length} modules`);
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
  if (!cloudSyncActive || !firestoreDb || isReceivingCloudBroadcast || !state) return;
  if (!cloudHydrated && !forceAll) return; // Never overwrite cloud before initial hydration!

  const doPush = async () => {
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
        dirtyModules.push({ modName, data, hash });
      }

      if (dirtyModules.length === 0) return;

      const batch = firestoreDb.batch();
      for (const item of dirtyModules) {
        const ref = firestoreDb.collection(MODULES_COLLECTION).doc(item.modName);
        batch.set(ref, {
          data: item.data,
          updatedAtMs: nowMs,
          updatedAt: nowIso,
          updatedBy: CLIENT_SESSION_ID,
          device
        }); // Full replace per module so deleted items stay deleted!
        lastSyncedModuleHashes[item.modName] = item.hash;
      }

      await batch.commit();
      console.info(`✓ Synced ${dirtyModules.length} ERP module(s) to cloud: ${dirtyModules.map(m => m.modName).join(', ')}`);
    } catch (err) {
      console.warn('Live cloud ERP push failed (changes remain safely cached in IndexedDB):', err);
    }
  };

  if (cloudSaveDebounce) clearTimeout(cloudSaveDebounce);
  if (immediate) {
    await doPush();
  } else {
    cloudSaveDebounce = setTimeout(doPush, 350);
  }
}
