/**
 * Tide ERP — East Africa Localization (English / Kiswahili)
 * Lightweight, lossless runtime translator with localStorage persistence.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TideI18n = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LANG_KEY = 'tide-erp-lang';

  const NAV_LABELS = {
    en: {
      home: 'Home',
      dashboard: 'Overview',
      sales: 'Sales',
      pos: 'Point of sale',
      products: 'Products',
      inventory: 'Inventory',
      purchases: 'Purchases',
      expenses: 'Expenses',
      customers: 'Customers',
      suppliers: 'Suppliers',
      users: 'Users',
      branches: 'Branches',
      accounting: 'Accounting',
      reports: 'Reports',
      settings: 'Settings'
    },
    sw: {
      home: 'Nyumbani',
      dashboard: 'Muhtasari',
      sales: 'Mauzo',
      pos: 'Mauzo (POS)',
      products: 'Bidhaa',
      inventory: 'Ghala / Stoo',
      purchases: 'Manunuzi',
      expenses: 'Matumizi',
      customers: 'Wateja',
      suppliers: 'Wasambazaji',
      users: 'Watumiaji',
      branches: 'Matawi',
      accounting: 'Uhasibu',
      reports: 'Ripoti',
      settings: 'Mipangilio'
    }
  };

  const PAGE_TITLES = {
    en: {
      home: 'Home',
      dashboard: 'Overview',
      sales: 'Sales & orders',
      pos: 'Point of sale',
      products: 'Product Management',
      inventory: 'Inventory Management',
      purchases: 'Purchases',
      expenses: 'Expenses',
      customers: 'Customers',
      suppliers: 'Suppliers',
      users: 'Users',
      branches: 'Branches',
      accounting: 'Accounting & Ledger',
      reports: 'Reports',
      settings: 'Settings'
    },
    sw: {
      home: 'Nyumbani',
      dashboard: 'Muhtasari',
      sales: 'Mauzo na Oda',
      pos: 'Mauzo ya Papo Hapo (POS)',
      products: 'Usimamizi wa Bidhaa',
      inventory: 'Usimamizi wa Ghala / Stoo',
      purchases: 'Manunuzi',
      expenses: 'Matumizi',
      customers: 'Wateja',
      suppliers: 'Wasambazaji',
      users: 'Watumiaji',
      branches: 'Matawi',
      accounting: 'Uhasibu na Leja',
      reports: 'Ripoti za Biashara',
      settings: 'Mipangilio'
    }
  };

  // Exact-phrase lookup for common UI controls, headings, and receipts
  const PHRASES_SW = {
    'WORKSPACE': 'OFISI',
    'MANAGE': 'USIMAMIZI',
    'Back': 'Rudi',
    'Cloud Sync': 'Usawazishaji',
    'Multi-device Live': 'Mtandao Hai',
    'All changes saved': 'Mabadiliko yamehifadhiwa',
    'Saved in IndexedDB': 'Imehifadhiwa Ndani',
    'Home': 'Nyumbani',
    'Overview': 'Muhtasari',
    'Sales': 'Mauzo',
    'Sales & orders': 'Mauzo na Oda',
    'Point of sale': 'Mauzo ya Papo Hapo (POS)',
    'Product Management': 'Usimamizi wa Bidhaa',
    'Inventory Management': 'Usimamizi wa Ghala / Stoo',
    'Purchases': 'Manunuzi',
    'Expenses': 'Matumizi',
    'Customers': 'Wateja',
    'Suppliers': 'Wasambazaji',
    'Users': 'Watumiaji',
    'Branches': 'Matawi',
    'Accounting': 'Uhasibu',
    'Accounting & Ledger': 'Uhasibu na Leja',
    'Reports': 'Ripoti',
    'Settings': 'Mipangilio',
    'Good morning': 'Habari za asubuhi',
    'Good afternoon': 'Habari za mchana',
    'Good evening': 'Habari za jioni',
    'Current sale': 'Mauzo ya Sasa',
    'Save draft': 'Hifadhi Rasimu',
    'Clear cart': 'Futa Kikapu',
    'Customer': 'Mteja',
    'Payment method': 'Njia ya Malipo',
    'All categories': 'Kategoria Zote',
    'Online': 'Mtandaoni',
    'Offline ready': 'Tayari Nje ya Mtandao',
    '📷 Scan': '📷 Skani',
    '⇄ Transfer stock': '⇄ Hamisha Stoo',
    '🧾 Receipt (58/80mm)': '🧾 Risiti (58/80mm)',
    '🧾 Print last receipt': '🧾 Chapisha Risiti ya Mwisho',
    '＋ Sales order': '＋ Oda ya Mauzo',
    '＋ Add product': '＋ Ongeza Bidhaa',
    '＋ Add branch': '＋ Ongeza Tawi',
    '＋ Add user': '＋ Ongeza Mtumiaji',
    '＋ Record expense': '＋ Rekodi Matumizi',
    '＋ New purchase': '＋ Manunuzi Mapya',
    '＋ Add customer': '＋ Ongeza Mteja',
    '＋ Add supplier': '＋ Ongeza Msambazaji',
    '▦ New stock take': '▦ Hesabu Mpya ya Stoo',
    '▤ New stock take': '▤ Hesabu Mpya ya Stoo',
    '▶ Resume stock take': '▶ Endelea Kuhesabu Stoo',
    '± Adjust stock': '± Rekebisha Stoo',
    '↓ Export CSV': '↓ Pakua CSV',
    '↑ Upload CSV': '↑ Pakia CSV',
    'Save settings': 'Hifadhi Mipangilio',
    '🔑 Sign In': '🔑 Ingia',
    '🏢 Register Company': '🏢 Sajili Kampuni',
    'Sign in to Workspace': 'Ingia Kazini',
    'Register Company Workspace': 'Sajili Kampuni Yako',
    'Username or Email Address': 'Jina la Mtumiaji au Barua Pepe',
    'Password': 'Nenosiri',
    'New to Tide ERP?': 'Mgeni kwenye Tide ERP?',
    'Notice Board': 'Ubao wa Matangazo',
    'Inter-Branch Stock Transfers': 'Uhamisho wa Bidhaa Kati ya Matawi',
    'Total Revenue': 'Mapato Yote',
    'Daily Expenses': 'Matumizi ya Leo',
    'Unpaid Sales Orders': 'Oda Zisizolipwa',
    'Total Products': 'Jumla ya Bidhaa',
    'Low stock items': 'Bidhaa Zinazokaribia Kuisha',
    'Physical Stock Take History & Audits': 'Historia ya Kuhesabu Stoo',
    'View Dashboard': 'Tazama Muhtasari',
    'Make a Sale': 'Fanya Mauzo (POS)',
    'Sales & Orders': 'Mauzo na Oda',
    'Branch Management': 'Usimamizi wa Matawi',
    "Today's Financial Summary": 'Muhtasari wa Fedha Leo'
  };

  const RECEIPT_STRINGS = {
    en: {
      receiptTitle: 'SALES RECEIPT',
      receiptNo: 'Receipt #',
      date: 'Date',
      branch: 'Branch',
      cashier: 'Cashier',
      customer: 'Customer',
      item: 'Item',
      qty: 'Qty',
      total: 'Total',
      subtotal: 'Subtotal',
      discount: 'Discount',
      extra: 'Extra charges',
      netTaxable: 'Taxable (Net)',
      vat: 'VAT',
      grandTotal: 'TOTAL',
      paid: 'Paid',
      balance: 'Balance due',
      method: 'Payment',
      status: 'Status',
      payDetails: 'Payment details',
      thanks: 'Thank you for your business! / Asante kwa kununua nasi!'
    },
    sw: {
      receiptTitle: 'RISITI YA MAUZO',
      receiptNo: 'Namba ya Risiti',
      date: 'Tarehe',
      branch: 'Tawi',
      cashier: 'Mhudumu',
      customer: 'Mteja',
      item: 'Bidhaa',
      qty: 'Idadi',
      total: 'Jumla',
      subtotal: 'Jumla Ndogo',
      discount: 'Punguzo',
      extra: 'Gharama za Ziada',
      netTaxable: 'Kiasi bila VAT',
      vat: 'VAT',
      grandTotal: 'JUMLA KUU',
      paid: 'Imelipwa',
      balance: 'Salio (Deni)',
      method: 'Njia ya Malipo',
      status: 'Hali',
      payDetails: 'Maelezo ya Malipo',
      thanks: 'Asante kwa kununua nasi! / Thank you for your business!'
    }
  };

  let currentLang = (() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      return saved === 'sw' ? 'sw' : 'en';
    } catch {
      return 'en';
    }
  })();

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    const next = lang === 'sw' ? 'sw' : 'en';
    currentLang = next;
    try { localStorage.setItem(LANG_KEY, next); } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
      document.documentElement.dataset.lang = next;
    }
    return currentLang;
  }

  function toggleLang() {
    return setLang(currentLang === 'sw' ? 'en' : 'sw');
  }

  function t(key, fallback = '') {
    if (currentLang === 'sw') {
      if (PHRASES_SW[key]) return PHRASES_SW[key];
      if (NAV_LABELS.sw[key]) return NAV_LABELS.sw[key];
      if (PAGE_TITLES.sw[key]) return PAGE_TITLES.sw[key];
    } else {
      if (NAV_LABELS.en[key]) return NAV_LABELS.en[key];
      if (PAGE_TITLES.en[key]) return PAGE_TITLES.en[key];
    }
    return fallback || key;
  }

  function getReceiptStrings() {
    return RECEIPT_STRINGS[currentLang] || RECEIPT_STRINGS.en;
  }

  function translateTextElement(el, lang) {
    if (!el) return;
    if (el.dataset.i18nOrig === undefined) {
      el.dataset.i18nOrig = el.textContent.trim();
    }
    const orig = el.dataset.i18nOrig;
    if (lang === 'sw') {
      if (PHRASES_SW[orig]) {
        el.textContent = PHRASES_SW[orig];
      } else if (/^GOOD (MORNING|AFTERNOON|EVENING),/i.test(orig)) {
        const isUpper = orig === orig.toUpperCase();
        const translated = orig
          .replace(/^GOOD MORNING,/i, isUpper ? 'HABARI ZA ASUBUHI,' : 'Habari za asubuhi,')
          .replace(/^GOOD AFTERNOON,/i, isUpper ? 'HABARI ZA MCHANA,' : 'Habari za mchana,')
          .replace(/^GOOD EVENING,/i, isUpper ? 'HABARI ZA JIONI,' : 'Habari za jioni,');
        el.textContent = translated;
      } else if (/^Complete sale · /i.test(orig)) {
        el.textContent = orig.replace(/^Complete sale · /i, 'Kamilisha mauzo · ');
      }
    } else {
      if (el.textContent.trim() !== orig) {
        el.textContent = orig;
      }
    }
  }

  function applyDomTranslations(root = document, activePage = '') {
    if (typeof document === 'undefined' || !root) return;
    const lang = currentLang;
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;

    // Update topbar language toggle button
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.textContent = lang === 'sw' ? 'SW' : 'EN';
      langBtn.dataset.lang = lang;
      const tip = lang === 'sw' ? 'Lugha: Kiswahili (Bofya kubadili kwenda English)' : 'Language: English (Click to switch to Kiswahili)';
      langBtn.setAttribute('title', tip);
      langBtn.setAttribute('aria-label', tip);
    }

    // Sidebar nav items (preserve icon + badge children)
    document.querySelectorAll('.primary-nav .nav-item[data-page]').forEach(btn => {
      const p = btn.dataset.page;
      const label = (NAV_LABELS[lang] && NAV_LABELS[lang][p]) || (NAV_LABELS.en[p]);
      if (!label) return;
      for (const node of Array.from(btn.childNodes)) {
        if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim()) {
          node.nodeValue = label + (btn.querySelector('.nav-count') ? ' ' : '');
          break;
        }
      }
    });

    // Sidebar section labels & topbar/footer static strings
    document.querySelectorAll('.nav-label, #back-button span, #cloud-sync-button .footer-btn-text, #footer-sync-status-text').forEach(el => {
      translateTextElement(el, lang);
    });

    // Topbar breadcrumb
    const crumb = document.getElementById('crumb-current');
    if (crumb) {
      if (activePage && PAGE_TITLES[lang]?.[activePage]) {
        crumb.textContent = PAGE_TITLES[lang][activePage];
      } else {
        translateTextElement(crumb, lang);
      }
    }

    // Translate matching headings, buttons, labels inside the target root
    const scope = root === document ? (document.getElementById('page-content') || document.body) : root;
    if (scope) {
      scope.querySelectorAll('.page-heading h1, .panel-title, .heading-actions .button, .cart-panel .button, .toolbar .button, .hub-kicker, .hub-box-title, .hub-finance-title, .hub-welcome-title, .hub-greeting, .hub-fin-card-label, .summary-mini small, .auth-tab span, #auth-form-title, .login-submit-btn span:first-child, .auth-switch-prompt span').forEach(el => {
        if (el.children.length === 0) {
          translateTextElement(el, lang);
        }
      });
      scope.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (!el.dataset.i18nOrig) el.dataset.i18nOrig = el.textContent;
        el.textContent = lang === 'sw' ? (PHRASES_SW[key] || t(key, el.dataset.i18nOrig)) : el.dataset.i18nOrig;
      });
    }
  }

  return {
    LANG_KEY,
    getLang,
    setLang,
    toggleLang,
    t,
    getReceiptStrings,
    applyDomTranslations,
    NAV_LABELS,
    PAGE_TITLES
  };
}));
