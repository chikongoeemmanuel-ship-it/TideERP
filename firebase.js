/**
 * Tide ERP - Firebase Firestore Client Service
 * Project: tideerp
 * Provides unified real-time synchronization for products (with safe doc IDs,
 * chunked batch upload, chunked batch delete, and offline persistence).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TideFirebase = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FALLBACK_CONFIG = {
    apiKey: "AIzaSyDaFgbjKDUHGS4hbBTb4sjJ76nK24ozkls",
    authDomain: "tideerp.firebaseapp.com",
    projectId: "tideerp",
    storageBucket: "tideerp.firebasestorage.app",
    messagingSenderId: "519899083425",
    appId: "1:519899083425:web:a91554721d225a731476e0",
    measurementId: "G-DMRTQPN22Z"
  };

  let firebaseApp = null;
  let firestoreDb = null;
  let persistenceAttempted = false;
  let productsUnsubscribe = null;
  let activeConfig = null;
  let bulkMutationCount = 0;
  let pendingStreamCallback = null;
  let pendingStreamProducts = null;
  let pendingStreamSnapshot = null;
  let productBatchQueue = Promise.resolve();

  /**
   * Convert any SKU / product ID into a valid Firestore document ID
   * (Firestore doc IDs cannot contain '/' or be '.' or '..').
   */
  function toDocId(rawId) {
    let s = String(rawId ?? '').trim();
    if (!s || s === '.' || s === '..') {
      s = 'prod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }
    s = s.replace(/\//g, '__SL__');
    if (s.length > 300) s = s.slice(0, 300);
    return s;
  }

  function resolveProductDocId(productOrId) {
    if (productOrId && typeof productOrId === 'object') {
      if (productOrId._docId && !String(productOrId._docId).includes('/')) {
        return String(productOrId._docId);
      }
      return toDocId(productOrId.id);
    }
    return toDocId(productOrId);
  }

  function isBulkOpActive() {
    return bulkMutationCount > 0;
  }

  function beginBulkOp() {
    bulkMutationCount++;
  }

  function endBulkOp() {
    bulkMutationCount = Math.max(0, bulkMutationCount - 1);
    if (bulkMutationCount === 0 && pendingStreamProducts && typeof pendingStreamCallback === 'function') {
      const prods = pendingStreamProducts;
      const snap = pendingStreamSnapshot;
      pendingStreamProducts = null;
      pendingStreamSnapshot = null;
      try {
        pendingStreamCallback(prods, snap);
      } catch (err) {
        console.warn('Deferred product stream callback error:', err);
      }
    }
  }

  function enqueueProductBatch(taskFn) {
    const next = productBatchQueue.then(taskFn, taskFn);
    productBatchQueue = next.catch(() => {});
    return next;
  }

  async function commitBatchWithRetry(batchBuilder, maxRetries = 3) {
    let lastErr = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const batch = batchBuilder();
        await batch.commit();
        return true;
      } catch (err) {
        lastErr = err;
        console.warn(`Firestore batch attempt ${attempt}/${maxRetries} failed:`, err);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
    }
    throw lastErr;
  }

  /**
   * Fetch Firebase credentials from Vercel Serverless Function `/api/config`
   * or fall back to window.__FIREBASE_CONFIG__ / localStorage / default
   */
  async function loadConfig() {
    if (activeConfig) return activeConfig;

    if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.projectId) {
      activeConfig = window.__FIREBASE_CONFIG__;
      return activeConfig;
    }

    try {
      if (typeof fetch === 'function' && location.protocol !== 'file:') {
        const res = await fetch('/api/config', { cache: 'no-cache' });
        if (res.ok) {
          const cfg = await res.json();
          if (cfg && cfg.projectId && cfg.apiKey) {
            activeConfig = cfg;
            return activeConfig;
          }
        }
      }
    } catch (e) {
      console.info('Config API unavailable; using standard client credentials.');
    }

    try {
      const stored = localStorage.getItem('tide-firebase-config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.projectId) {
          activeConfig = parsed;
          return activeConfig;
        }
      }
    } catch {}

    activeConfig = FALLBACK_CONFIG;
    return activeConfig;
  }

  /**
   * Initialize Firebase Web SDK and Firestore instance (with offline persistence)
   */
  let initPromise = null;
  async function initFirebase(customConfig) {
    if (firestoreDb) return firestoreDb;
    if (initPromise && !customConfig) return initPromise;

    initPromise = (async () => {
      let retries = 0;
      while ((typeof window === 'undefined' || !window.firebase) && retries < 30) {
        retries++;
        await new Promise(r => setTimeout(r, 350));
      }

      if (typeof window === 'undefined' || !window.firebase) {
        console.warn('Firebase SDK not loaded on window after retries');
        return null;
      }

      const config = customConfig || await loadConfig();
      if (!config || !config.projectId) {
        console.warn('Firebase config missing projectId');
        return null;
      }

      try {
        if (!window.firebase.apps.length) {
          firebaseApp = window.firebase.initializeApp(config);
        } else {
          firebaseApp = window.firebase.app();
        }
        firestoreDb = window.firebase.firestore();
        if (!persistenceAttempted) {
          persistenceAttempted = true;
          firestoreDb.enablePersistence({ synchronizeTabs: true }).catch(() => {
            // Safe to ignore in private browsing or older browsers
          });
        }
        console.info('✓ Firebase Firestore initialized under project: ' + config.projectId);
        return firestoreDb;
      } catch (err) {
        console.error('Failed to initialize Firebase:', err);
        return null;
      }
    })();

    const db = await initPromise;
    if (!db) initPromise = null;
    return db;
  }

  function getDb() {
    if (firestoreDb) return firestoreDb;
    if (typeof window !== 'undefined' && window.firebase && window.firebase.apps.length) {
      firestoreDb = window.firebase.firestore();
      return firestoreDb;
    }
    return null;
  }

  function normalizeProductForCloud(product) {
    const idStr = String(product.id ?? '').trim();
    const docId = resolveProductDocId(product);
    return {
      docId,
      data: {
        id: idStr || docId,
        name: String(product.name || '').trim(),
        category: String(product.category || 'General').trim(),
        price: Number(product.price) || 0,
        cost: Number(product.cost) || 0,
        stock: Math.max(0, Number(product.stock) || 0),
        low: Math.max(0, Number(product.low) || 0),
        unit: String(product.unit || 'Piece').trim(),
        status: String(product.status || 'Active'),
        expiryDate: String(product.expiryDate || ''),
        batchNumber: String(product.batchNumber || ''),
        updatedAt: new Date().toISOString(),
        updatedAtMs: Date.now()
      }
    };
  }

  // =========================================================================
  // CRUD Operations on the "products" Firestore Collection
  // =========================================================================

  async function saveProduct(product) {
    let db = getDb();
    if (!db) db = await initFirebase();
    if (!db || !product || !product.id) return false;

    try {
      const { docId, data } = normalizeProductForCloud(product);
      product._docId = docId;
      await db.collection('products').doc(docId).set(data, { merge: true });
      return true;
    } catch (err) {
      console.error(`Failed to save product ${product?.id} to Firestore:`, err);
      return false;
    }
  }

  async function updateProduct(productId, updates) {
    let db = getDb();
    if (!db) db = await initFirebase();
    if (!db || !productId || !updates) return false;

    try {
      const docId = resolveProductDocId(productId);
      const cleanUpdates = {
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedAtMs: Date.now()
      };
      await db.collection('products').doc(docId).set(cleanUpdates, { merge: true });
      return true;
    } catch (err) {
      console.error(`Failed to update product ${productId} in Firestore:`, err);
      return false;
    }
  }

  async function deleteProduct(productOrId) {
    let db = getDb();
    if (!db) db = await initFirebase();
    if (!db || !productOrId) return false;

    try {
      const docId = resolveProductDocId(productOrId);
      await db.collection('products').doc(docId).delete();
      return true;
    } catch (err) {
      console.error(`Failed to delete product ${productOrId?.id || productOrId} from Firestore:`, err);
      return false;
    }
  }

  /**
   * Fetch all products once from the "products" collection (preferring fresh server data)
   */
  async function getProducts(preferServer = false) {
    let db = getDb();
    if (!db) db = await initFirebase();
    if (!db) return null;

    try {
      let snapshot;
      if (preferServer) {
        try {
          snapshot = await db.collection('products').get({ source: 'server' });
        } catch {
          snapshot = await db.collection('products').get();
        }
      } else {
        snapshot = await db.collection('products').get();
      }
      const products = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data) {
          products.push({ ...data, id: data.id || doc.id, _docId: doc.id });
        }
      });
      return products;
    } catch (err) {
      console.error('Failed to get products from Firestore:', err);
      return null;
    }
  }

  /**
   * Stream products in real-time using onSnapshot listener on the "products" collection
   */
  function streamProducts(onUpdate, onError) {
    const db = getDb();
    if (!db) return null;

    if (productsUnsubscribe) {
      productsUnsubscribe();
      productsUnsubscribe = null;
    }
    pendingStreamCallback = onUpdate;

    try {
      productsUnsubscribe = db.collection('products').onSnapshot(
        snapshot => {
          const products = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data) {
              products.push({ ...data, id: data.id || doc.id, _docId: doc.id });
            }
          });
          if (bulkMutationCount > 0) {
            // Defer partial intermediate snapshots while a multi-chunk upload/delete is committing
            pendingStreamProducts = products;
            pendingStreamSnapshot = snapshot;
            return;
          }
          if (typeof onUpdate === 'function') {
            onUpdate(products, snapshot);
          }
        },
        err => {
          console.warn('Real-time products listener error:', err);
          if (typeof onError === 'function') onError(err);
        }
      );
      console.info('✓ Real-time products collection stream active');
      return productsUnsubscribe;
    } catch (err) {
      console.error('Failed to attach products onSnapshot listener:', err);
      return null;
    }
  }

  /**
   * Batch upload/sync ANY number of products into Firestore "products" collection.
   * Deduplicates by safe doc ID, chunks into batches of 450, retries failed chunks,
   * locks streamProducts mid-upload so partial batches never overwrite local state.
   */
  async function batchSyncProducts(productsArray, onProgress) {
    if (!Array.isArray(productsArray) || !productsArray.length) {
      return { synced: 0, total: 0, failed: 0 };
    }

    return enqueueProductBatch(async () => {
      let db = getDb();
      if (!db) db = await initFirebase();
      if (!db) return { synced: 0, total: productsArray.length, failed: productsArray.length };

      // Deduplicate by Firestore docId (last item wins)
      const uniqueMap = new Map();
      for (const p of productsArray) {
        if (!p || (!p.id && !p.name)) continue;
        const normalized = normalizeProductForCloud(p);
        p._docId = normalized.docId;
        uniqueMap.set(normalized.docId, normalized);
      }

      const items = Array.from(uniqueMap.values());
      const total = items.length;
      const BATCH_SIZE = 450; // Safely under Firestore's 500 writes/batch limit
      let synced = 0;
      let failed = 0;

      beginBulkOp();
      try {
        for (let i = 0; i < total; i += BATCH_SIZE) {
          const chunk = items.slice(i, i + BATCH_SIZE);
          try {
            await commitBatchWithRetry(() => {
              const batch = db.batch();
              for (const item of chunk) {
                const ref = db.collection('products').doc(item.docId);
                batch.set(ref, item.data, { merge: true });
              }
              return batch;
            }, 3);
            synced += chunk.length;
          } catch (chunkErr) {
            console.error(`Batch upload chunk ${i}-${i + chunk.length} failed; falling back to per-item save:`, chunkErr);
            for (const item of chunk) {
              try {
                await db.collection('products').doc(item.docId).set(item.data, { merge: true });
                synced++;
              } catch (itemErr) {
                failed++;
                console.error(`Failed saving product ${item.docId}:`, itemErr);
              }
            }
          }
          if (typeof onProgress === 'function') {
            try { onProgress(synced, total, failed); } catch {}
          }
        }
        console.info(`✓ Batch synced ${synced}/${total} products to Firestore (failed: ${failed})`);
        return { synced, total, failed };
      } finally {
        endBulkOp();
      }
    });
  }

  /**
   * Batch delete ANY number of products from Firestore "products" collection at once.
   * Uses Firestore WriteBatch (450 deletes per commit) and locks streamProducts mid-delete
   * so deleted items never bounce back one-by-one.
   */
  async function batchDeleteProducts(productsOrIds, onProgress) {
    if (!Array.isArray(productsOrIds) || !productsOrIds.length) {
      return { deleted: 0, total: 0, failed: 0 };
    }

    return enqueueProductBatch(async () => {
      let db = getDb();
      if (!db) db = await initFirebase();
      if (!db) return { deleted: 0, total: productsOrIds.length, failed: productsOrIds.length };

      const docIdSet = new Set();
      for (const item of productsOrIds) {
        if (!item) continue;
        const docId = resolveProductDocId(item);
        if (docId) docIdSet.add(docId);
      }

      const docIds = Array.from(docIdSet);
      const total = docIds.length;
      const BATCH_SIZE = 450;
      let deleted = 0;
      let failed = 0;

      beginBulkOp();
      try {
        for (let i = 0; i < total; i += BATCH_SIZE) {
          const chunk = docIds.slice(i, i + BATCH_SIZE);
          try {
            await commitBatchWithRetry(() => {
              const batch = db.batch();
              for (const docId of chunk) {
                batch.delete(db.collection('products').doc(docId));
              }
              return batch;
            }, 3);
            deleted += chunk.length;
          } catch (chunkErr) {
            console.error(`Batch delete chunk ${i}-${i + chunk.length} failed; falling back to per-item delete:`, chunkErr);
            for (const docId of chunk) {
              try {
                await db.collection('products').doc(docId).delete();
                deleted++;
              } catch (itemErr) {
                failed++;
                console.error(`Failed deleting product ${docId}:`, itemErr);
              }
            }
          }
          if (typeof onProgress === 'function') {
            try { onProgress(deleted, total, failed); } catch {}
          }
        }
        console.info(`✓ Batch deleted ${deleted}/${total} products from Firestore (failed: ${failed})`);
        return { deleted, total, failed };
      } finally {
        endBulkOp();
      }
    });
  }

  return {
    initFirebase,
    loadConfig,
    getDb,
    toDocId,
    isBulkOpActive,
    saveProduct,
    createProduct: saveProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    streamProducts,
    batchSyncProducts,
    batchDeleteProducts,
    FALLBACK_CONFIG
  };
}));
