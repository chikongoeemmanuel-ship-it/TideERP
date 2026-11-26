/**
 * Tide ERP - Firebase Firestore Client Service
 * Project: tideerp
 * Provides real-time synchronization for products, customers, and workspace records.
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

  // Fallback credentials used if environment variables or API config cannot be fetched
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
  let productsUnsubscribe = null;
  let activeConfig = null;
  let isSyncing = false;

  /**
   * Fetch Firebase credentials from Vercel Serverless Function `/api/config`
   * or fall back to window.__FIREBASE_CONFIG__ / localStorage / default
   */
  async function loadConfig() {
    if (activeConfig) return activeConfig;

    // 1. Check window.__FIREBASE_CONFIG__ (if injected via build or head)
    if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.projectId) {
      activeConfig = window.__FIREBASE_CONFIG__;
      return activeConfig;
    }

    // 2. Fetch from Vercel Serverless Function /api/config
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

    // 3. Check localStorage
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
   * Initialize Firebase Web SDK and Firestore instance
   */
  let initRetryCount = 0;
  async function initFirebase(customConfig) {
    if (firestoreDb) return firestoreDb;

    // Retry loop on slow mobile network connections waiting for Google CDN scripts
    while ((typeof window === 'undefined' || !window.firebase) && initRetryCount < 30) {
      initRetryCount++;
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
      console.info('✓ Firebase Firestore initialized under project: ' + config.projectId);
      return firestoreDb;
    } catch (err) {
      console.error('Failed to initialize Firebase:', err);
      return null;
    }
  }

  function getDb() {
    if (firestoreDb) return firestoreDb;
    if (typeof window !== 'undefined' && window.firebase && window.firebase.apps.length) {
      firestoreDb = window.firebase.firestore();
      return firestoreDb;
    }
    return null;
  }

  // =========================================================================
  // CRUD Operations on the "products" Firestore Collection
  // =========================================================================

  /**
   * Save or update a product document in Firestore
   * Collection: "products", Document ID: product.id (SKU)
   */
  async function saveProduct(product) {
    const db = getDb();
    if (!db || !product || !product.id) return false;

    try {
      const clean = {
        id: String(product.id),
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
      };

      await db.collection('products').doc(clean.id).set(clean, { merge: true });
      console.info(`✓ Product ${clean.id} (${clean.name}) saved to Firestore`);
      return true;
    } catch (err) {
      console.error(`Failed to save product ${product?.id} to Firestore:`, err);
      return false;
    }
  }

  /**
   * Update specific fields of a product document in Firestore
   */
  async function updateProduct(productId, updates) {
    const db = getDb();
    if (!db || !productId || !updates) return false;

    try {
      const cleanUpdates = {
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedAtMs: Date.now()
      };
      await db.collection('products').doc(String(productId)).update(cleanUpdates);
      console.info(`✓ Product ${productId} updated in Firestore`);
      return true;
    } catch (err) {
      console.error(`Failed to update product ${productId} in Firestore:`, err);
      return false;
    }
  }

  /**
   * Delete a product document from the "products" collection in Firestore
   */
  async function deleteProduct(productId) {
    const db = getDb();
    if (!db || !productId) return false;

    try {
      await db.collection('products').doc(String(productId)).delete();
      console.info(`✓ Product ${productId} deleted from Firestore`);
      return true;
    } catch (err) {
      console.error(`Failed to delete product ${productId} from Firestore:`, err);
      return false;
    }
  }

  /**
   * Fetch all products once from the "products" collection
   */
  async function getProducts() {
    let db = getDb();
    if (!db) {
      db = await initFirebase();
    }
    if (!db) return [];

    try {
      const snapshot = await db.collection('products').get();
      const products = [];
      snapshot.forEach(doc => {
        products.push(doc.data());
      });
      return products;
    } catch (err) {
      console.error('Failed to get products from Firestore:', err);
      return [];
    }
  }

  /**
   * Stream products in real-time using onSnapshot listener on the "products" collection
   * Automatically notifies onUpdate whenever products are added, modified, or removed across devices
   */
  function streamProducts(onUpdate, onError) {
    const db = getDb();
    if (!db) return null;

    if (productsUnsubscribe) {
      productsUnsubscribe();
      productsUnsubscribe = null;
    }

    try {
      productsUnsubscribe = db.collection('products').onSnapshot(
        snapshot => {
          const products = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.id) {
              products.push(data);
            }
          });
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
   * Batch sync an array of products into the Firestore "products" collection
   * Splits into batches of 400 (under Firestore's 500-op limit per batch)
   */
  async function batchSyncProducts(productsArray) {
    const db = getDb();
    if (!db || !Array.isArray(productsArray) || !productsArray.length) return 0;
    if (isSyncing) return 0;
    isSyncing = true;

    try {
      const BATCH_SIZE = 400;
      let totalSynced = 0;

      for (let i = 0; i < productsArray.length; i += BATCH_SIZE) {
        const chunk = productsArray.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const p of chunk) {
          if (!p || !p.id) continue;
          const ref = db.collection('products').doc(String(p.id));
          const clean = {
            id: String(p.id),
            name: String(p.name || '').trim(),
            category: String(p.category || 'General').trim(),
            price: Number(p.price) || 0,
            cost: Number(p.cost) || 0,
            stock: Math.max(0, Number(p.stock) || 0),
            low: Math.max(0, Number(p.low) || 0),
            unit: String(p.unit || 'Piece').trim(),
            status: String(p.status || 'Active'),
            expiryDate: String(p.expiryDate || ''),
            batchNumber: String(p.batchNumber || '')
          };
          batch.set(ref, clean, { merge: true });
          totalSynced++;
        }

        await batch.commit();
      }
      console.info(`✓ Batch synced ${totalSynced} products to Firestore "products" collection`);
      return totalSynced;
    } catch (err) {
      console.error('Failed to batch sync products to Firestore:', err);
      return 0;
    } finally {
      isSyncing = false;
    }
  }

  return {
    initFirebase,
    loadConfig,
    getDb,
    saveProduct,
    createProduct: saveProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    streamProducts,
    batchSyncProducts,
    FALLBACK_CONFIG
  };
}));
