/**
 * Tide ERP — Comprehensive East Africa Localization Engine (English / Kiswahili)
 * Full-page lossless runtime translator covering navigation, headings, cards,
 * tables, filters, buttons, dropdowns, placeholders, modals, receipts, and dynamic labels.
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
  const ORIG_TEXT = new WeakMap();
  const ORIG_PLACEHOLDER = new WeakMap();
  const ORIG_TITLE = new WeakMap();

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

  // Comprehensive exact phrase dictionary (English -> Kiswahili)
  const PHRASES_SW = {
    // Shell, Sidebar, Topbar, Footer
    'WORKSPACE': 'OFISI',
    'MANAGE': 'USIMAMIZI',
    'Back': 'Rudi',
    'Cloud Sync': 'Usawazishaji',
    'Multi-device Live': 'Mtandao Hai',
    'All changes saved': 'Mabadiliko yamehifadhiwa',
    'Saved in IndexedDB': 'Imehifadhiwa Ndani',
    'Main branch': 'Tawi Kuu',
    'Lock': 'Funga',
    'Home': 'Nyumbani',
    'Overview': 'Muhtasari',
    'Sales': 'Mauzo',
    'Sales & orders': 'Mauzo na Oda',
    'Sales & Orders': 'Mauzo na Oda',
    'Point of sale': 'Mauzo ya Papo Hapo (POS)',
    'Point of Sale': 'Mauzo ya Papo Hapo (POS)',
    'Products': 'Bidhaa',
    'Product Management': 'Usimamizi wa Bidhaa',
    'Inventory': 'Ghala / Stoo',
    'Inventory Management': 'Usimamizi wa Ghala / Stoo',
    'Purchases': 'Manunuzi',
    'Expenses': 'Matumizi',
    'Customers': 'Wateja',
    'Suppliers': 'Wasambazaji',
    'Users': 'Watumiaji',
    'Branches': 'Matawi',
    'Branch Management': 'Usimamizi wa Matawi',
    'Accounting': 'Uhasibu',
    'Accounting & Ledger': 'Uhasibu na Leja',
    'Reports': 'Ripoti',
    'Financial Reports': 'Ripoti za Fedha',
    'Settings': 'Mipangilio',

    // Page Subtitles
    'Manage customer orders, fulfillments, invoices, and payments.': 'Simamia oda za wateja, uwasilishaji, ankara, na malipo.',
    'Manage product catalog, pricing, cost, barcodes, custom price lists, batch expiration, and CSV bulk tools.': 'Simamia orodha ya bidhaa, bei, gharama, misimbopau, orodha za bei, tarehe za mwisho wa matumizi, na CSV.',
    'Dedicated physical stock taking, stock count history, inter-branch stock transfers, and stock movement ledger.': 'Hesabu ya stoo ya moja kwa moja, historia ya hesabu, uhamisho wa bidhaa kati ya matawi, na leja ya stoo.',
    'Create supplier orders, receive stock, and track supplier bills.': 'Unda oda za wasambazaji, pokea mzigo, na fuatilia bili za wasambazaji.',
    'Fast business expense entry, payment tracking, notes, and receipt attachments.': 'Rekodi matumizi ya biashara kwa haraka, fuatilia malipo, maelezo, na viambatisho vya risiti.',
    'Manage each customer and supplier account separately, review its activity, record payments, or reconcile its balance.': 'Simamia akaunti ya kila mteja na msambazaji kando, kagua miamala, rekodi malipo, au sawazisha salio.',
    'Detailed sales, purchases, and payments reporting.': 'Ripoti za kina za mauzo, manunuzi, na malipo.',
    'Visual financial summaries with weekly, monthly, and annual reporting periods.': 'Muhtasari wa kifedha wa kila wiki, kila mwezi, na kila mwaka.',
    'Configure company identity, invoice payment details, tax defaults, and trash recovery.': 'Sanidi taarifa za kampuni, maelezo ya malipo ya ankara, kodi, na urejeshaji wa taka.',
    'Manage workspace team members, roles, and access credentials.': 'Simamia wafanyakazi, majukumu yao, na taarifa za kuingia.',
    'Independent workspaces and isolated records for each location.': 'Ofisi zinazojitegemea na kumbukumbu zilizotengwa kwa kila tawi.',
    'You can access all business branch workspaces.': 'Unaweza kufikia matawi yote ya biashara.',
    'You are restricted to your assigned home branch.': 'Una ruhusa kwenye tawi lako ulilopangiwa pekee.',

    // Home Hub
    'View Dashboard': 'Tazama Muhtasari',
    'View Trends and Performance': 'Tazama mwenendo na utendaji wa biashara',
    'Make a Sale': 'Fanya Mauzo (POS)',
    'Process sales and Print Receipts': 'Fanya mauzo haraka na chapisha risiti',
    'Manage customer orders and invoices': 'Simamia oda za wateja na ankara',
    'Catalog, pricing, SKU, barcodes, and expiry': 'Orodha ya bidhaa, bei, SKU, misimbopau na mwisho wa matumizi',
    'Physical counts, stock takes, and audit history': 'Hesabu ya stoo na historia ya ukaguzi',
    'Manage supplier orders and restock': 'Simamia oda za wasambazaji na kuongeza stoo',
    'View, filter, settle, and track all business expenses': 'Tazama, chuja, lipa, na fuatilia matumizi yote ya biashara',
    'Product reports, payments, and financial insights': 'Ripoti za bidhaa, malipo, na uchambuzi wa fedha',
    'Customer and supplier account balances': 'Salio za akaunti za wateja na wasambazaji',
    'Manage customers and receivables': 'Simamia wateja na madai',
    'Manage branches and locations': 'Simamia matawi na maeneo ya biashara',
    '✎ Edit profile': '✎ Hariri wasifu',
    "Today's Financial Summary": 'Muhtasari wa Fedha Leo',
    'Comprehensive breakdown of daily revenue, expenses, net balance, and unpaid orders': 'Mchanganuo kamili wa mapato ya leo, matumizi, salio halisi, na oda zisizolipwa',
    'Total Revenue': 'Mapato Yote',
    'Daily Expenses': 'Matumizi ya Leo',
    'Net Daily Result (Revenue − Expenses)': 'Matokeo Halisi ya Leo (Mapato − Matumizi)',
    'Unpaid Sales Orders': 'Oda za Mauzo Zisizolipwa',
    'Operating expenses & purchases': 'Matumizi ya uendeshaji na manunuzi',
    'Daily revenue minus daily expenses': 'Mapato ya leo ukiondoa matumizi ya leo',
    'Net Profit': 'Faida Halisi',
    'Deficit': 'Nakisi',
    'Total Revenue of the Day': 'Jumla ya Mapato ya Siku',
    'Total customer sales and POS orders finalized today': 'Jumla ya mauzo ya wateja na POS yaliyokamilika leo',
    'Expenses of the Day': 'Matumizi ya Siku',
    'Operating expenses and supplier purchases logged today': 'Matumizi ya uendeshaji na manunuzi ya wasambazaji yaliyorekodiwa leo',
    'Net Result (Revenue − Expenses)': 'Matokeo Halisi (Mapato − Matumizi)',
    'Net financial margin after subtracting daily expenses from daily revenue': 'Salio halisi baada ya kutoa matumizi ya siku kwenye mapato ya siku',
    'Total outstanding customer orders awaiting payment settlement': 'Jumla ya oda za wateja zinazosubiri malipo',
    'Positive Margin': 'Faida Chanya',
    'View Sales →': 'Tazama Mauzo →',
    'View Expenses →': 'Tazama Matumizi →',
    'View Reports →': 'Tazama Ripoti →',
    'Manage Orders →': 'Simamia Oda →',
    'View all sales →': 'Tazama mauzo yote →',

    // Dashboard
    'Quick actions': 'Vitendo vya Haraka',
    'Get the important things done': 'Kamilisha mambo muhimu haraka',
    'Sales performance': 'Utendaji wa Mauzo',
    'Recent transactions': 'Miamala ya Hivi Karibuni',
    'Notice Board': 'Ubao wa Matangazo',
    'Stock alerts': 'Tahadhari za Stoo',
    'Today': 'Leo',
    'This week': 'Wiki hii',
    'This month': 'Mwezi huu',
    'Weekly': 'Kila Wiki',
    'Monthly': 'Kila Mwezi',
    'Annual': 'Kila Mwaka',
    'Report period': 'Kipindi cha Ripoti',

    // POS
    'Current sale': 'Mauzo ya Sasa',
    'Save draft': 'Hifadhi Rasimu',
    'Clear cart': 'Futa Kikapu',
    'Customer': 'Mteja',
    'Walk-in customer': 'Mteja wa Kupita',
    'Payment method': 'Njia ya Malipo',
    'All categories': 'Kategoria Zote',
    'All Categories': 'Kategoria Zote',
    'Online': 'Mtandaoni',
    'Offline ready': 'Tayari Nje ya Mtandao',
    'Add a product to begin checkout.': 'Ongeza bidhaa ili kuanza mauzo.',
    'Changes saved automatically in IndexedDB storage.': 'Mabadiliko yanahifadhiwa kiotomatiki kwenye kifaa chako.',
    '📷 Scan': '📷 Skani',
    '🧾 Print last receipt': '🧾 Chapisha Risiti ya Mwisho',
    'Last sale:': 'Mauzo ya mwisho:',
    'Subtotal': 'Jumla Ndogo',
    'Taxable (Net)': 'Kiasi bila VAT',
    'Net (Excl. VAT)': 'Kiasi bila VAT',
    'VAT (18%)': 'VAT (18%)',
    'Total': 'Jumla',

    // Common Buttons & Actions
    '＋ Sales order': '＋ Oda ya Mauzo',
    '＋ Add product': '＋ Ongeza Bidhaa',
    '＋ Add branch': '＋ Ongeza Tawi',
    '＋ Add user': '＋ Ongeza Mtumiaji',
    '＋ Record expense': '＋ Rekodi Matumizi',
    '＋ Purchase order': '＋ Oda ya Manunuzi',
    '＋ New purchase': '＋ Manunuzi Mapya',
    '＋ Add customer': '＋ Ongeza Mteja',
    '＋ Add supplier': '＋ Ongeza Msambazaji',
    '＋ Add products': '＋ Ongeza Bidhaa',
    '▦ Point of sale': '▦ Mauzo (POS)',
    '▦ New stock take': '▦ Hesabu Mpya ya Stoo',
    '▤ New stock take': '▤ Hesabu Mpya ya Stoo',
    '▶ Resume stock take': '▶ Endelea Kuhesabu Stoo',
    '± Adjust stock': '± Rekebisha Stoo',
    '⇄ Transfer stock': '⇄ Hamisha Stoo',
    '🏷 Price list': '🏷 Orodha ya Bei',
    '🏷 Add to Price List': '🏷 Ongeza Kwenye Orodha ya Bei',
    '↓ Export CSV': '↓ Pakua CSV',
    '↑ Upload CSV': '↑ Pakia CSV',
    '↓ CSV template': '↓ Kiolezo cha CSV',
    '↓ Export stock takes': '↓ Pakua Hesabu za Stoo',
    '↓ Export stock ledger': '↓ Pakua Leja ya Stoo',
    '↓ Export Ledger CSV': '↓ Pakua Leja CSV',
    '↓ Export Sales CSV': '↓ Pakua Mauzo CSV',
    '↓ Export Purchases CSV': '↓ Pakua Manunuzi CSV',
    '↓ Export Payments CSV': '↓ Pakua Malipo CSV',
    '↓ Expiration CSV Report': '↓ Ripoti ya Mwisho wa Matumizi CSV',
    'Export Inventory CSV': 'Pakua Stoo CSV',
    'Export Ledger CSV': 'Pakua Leja CSV',
    '🖨 Print / Save PDF': '🖨 Chapisha / Hifadhi PDF',
    '🖨 Print / Save as PDF': '🖨 Chapisha / Hifadhi kama PDF',
    '🖨 Print Worksheet': '🖨 Chapisha Karatasi ya Hesabu',
    '🖨 Print': '🖨 Chapisha',
    '↓ Download CSV': '↓ Pakua CSV',
    '↓ Download HTML Catalog': '↓ Pakua Katalogi (HTML)',
    '★ Pick 10 Samples': '★ Chagua Sampuli 10',
    '★ Pick 25 Samples': '★ Chagua Sampuli 25',
    'Select Shown': 'Chagua Zinazoonekana',
    'Clear Samples': 'Futa Sampuli',
    '✕ Clear filters': '✕ Futa Vichujio',
    '← Prev': '← Iliyopita',
    'Next →': 'Inayofuata →',
    'Save': 'Hifadhi',
    'Save changes': 'Hifadhi Mabadiliko',
    'Save settings': 'Hifadhi Mipangilio',
    'Cancel': 'Ghairi',
    'Close': 'Funga',
    'Apply': 'Tekeleza',
    'Clear': 'Futa',
    'Update': 'Sasisha',
    'Edit': 'Hariri',
    'Delete': 'Futa',
    'Details': 'Maelezo',
    'Reload': 'Pakia Upya',
    'Withdraw': 'Ondoa',
    'Write off': 'Futa Hasara',
    'Write off expired': 'Futa Zilizopitwa na Muda',
    'Clearance %': 'Punguzo %',
    'Clearance discount': 'Punguzo la Kuondoa Stoo',
    'Add payment': 'Ongeza Malipo',
    'Record payment': 'Rekodi Malipo',
    'Manage returns': 'Simamia Marejesho',
    'Print invoice': 'Chapisha Ankara',
    'Resume POS sale': 'Endelea na Mauzo ya POS',
    'Edit order': 'Hariri Oda',
    'View order': 'Tazama Oda',
    'Edit sale': 'Hariri Mauzo',
    'View sale': 'Tazama Mauzo',
    'Delete order': 'Futa Oda',
    'Delete sale': 'Futa Mauzo',
    'Edit product': 'Hariri Bidhaa',
    'Edit expiry / batch': 'Hariri Mwisho wa Matumizi / Kundi',
    'Adjust stock': 'Rekebisha Stoo',
    'Stock history': 'Historia ya Stoo',
    'Delete product': 'Futa Bidhaa',
    'Delete selected': 'Futa Zilizochaguliwa',
    'Edit purchase order': 'Hariri Oda ya Manunuzi',
    'View purchase': 'Tazama Manunuzi',
    'Receive stock': 'Pokea Mzigo',
    'Supplier return': 'Rejesha kwa Msambazaji',
    'Edit expense': 'Hariri Matumizi',
    'Edit Expense': 'Hariri Matumizi',
    'Mark as paid': 'Weka Imelipwa',
    '✓ Mark as Paid': '✓ Weka Imelipwa',
    'Delete expense': 'Futa Matumizi',
    'View details & attachments': 'Tazama Maelezo na Viambatisho',
    'View transactions': 'Tazama Miamala',
    'Reconcile': 'Sawazisha',
    'Edit user': 'Hariri Mtumiaji',
    'Set password & credentials': 'Weka Nenosiri na Taarifa',
    'View activity': 'Tazama Shughuli',
    'Permissions': 'Ruhusa',
    'Deactivate': 'Zima Akaunti',
    'Activate': 'Washa Akaunti',
    'Delete user': 'Futa Mtumiaji',
    'Current workspace': 'Tawi la Sasa',
    'Open workspace': 'Fungua Tawi',
    '🏢 Manage branches ›': '🏢 Simamia matawi ›',
    'Sign out': 'Ondoka',
    'Switch Account / Sign Out': 'Badili Akaunti / Ondoka',
    '🔒 Lock Screen Now': '🔒 Funga Skrini Sasa',
    '🔓 Unlock Session': '🔓 Fungua Kipindi',
    '👁 Worksheet': '👁 Karatasi',
    '✎ Edit session counts': '✎ Hariri Hesabu',
    '↺ Revoke & Revert Stock': '↺ Batilisha na Rejesha Stoo',
    '🗑 Delete session': '🗑 Futa Kikao',
    '✎ Edit adjustment': '✎ Hariri Marekebisho',
    '🗑 Delete movement': '🗑 Futa Muamala',
    '↺ Restore': '↺ Rejesha',
    'Clear trash bin': 'Safisha Kikapu cha Taka',
    'Remove logo': 'Ondoa Nembo',
    '🔊 Test': '🔊 Jaribu',
    '↺ Reset to Default Colors (Dark Blue & Orange)': '↺ Rejesha Rangi za Awali (Bluu na Chungwa)',
    '⚡ Refresh Entire ERP from Cloud': '⚡ Sasisha Mfumo Mzima Kutoka Wingu',
    '🔄 Clear Cache & Reload Latest App Version': '🔄 Futa Kache na Pakia Toleo Jipya',
    'Fill with current': 'Jaza za Sasa',
    'Clear counts': 'Futa Hesabu',
    'Discard draft': 'Futa Rasimu',
    '⏸ Pause & Save draft (Take a break)': '⏸ Sitisha na Hifadhi Rasimu',
    '✓ Approve & Publish': '✓ Idhinisha na Chapisha',
    '✕ Reject': '✕ Kataa',
    'Delete permanently': 'Futa Kabisa',
    'Confirm stock transfer': 'Thibitisha Uhamisho wa Stoo',
    'Lookup / Add': 'Tafuta / Ongeza',

    // Table Power Bar
    'Sort: Default': 'Panga: Kawaida',
    'Group: None': 'Kundi: Hakuna',
    'Columns': 'Safu',
    'Columns:': 'Safu:',
    '↺ Reset': '↺ Rejesha',
    '✓ Show All': '✓ Onyesha Zote',
    '✓ Apply Columns': '✓ Tekeleza Safu',
    '↺ Reset Default Order & Names': '↺ Rejesha Mpangilio wa Awali',

    // Filters, Statuses, & Payment Methods
    'Status': 'Hali',
    'Payment': 'Malipo',
    'Delivery': 'Uwasilishaji',
    'Date range': 'Muda wa tarehe',
    'Filter by date': 'Chuja kwa tarehe',
    'From': 'Kuanzia',
    'To': 'Hadi',
    'All statuses': 'Hali zote',
    'All payments': 'Malipo yote',
    'All deliveries': 'Uwasilishaji wote',
    'All products': 'Bidhaa zote',
    'All movement types': 'Aina zote za miamala',
    'All Methods': 'Njia Zote',
    'All Payments (In & Out)': 'Malipo Yote (Ndani na Nje)',
    '↓ Received from Customers': '↓ Yaliyopokelewa Kutoka kwa Wateja',
    '↑ Paid out (Suppliers & Expenses)': '↑ Yaliyolipwa (Wasambazaji na Matumizi)',
    'Stock takes only': 'Hesabu za stoo pekee',
    'Manual adjustments only': 'Marekebisho ya mkono pekee',
    'Low stock': 'Stoo ndogo',
    'In stock': 'Ipo stoo',
    'Out of stock': 'Imeisha stoo',
    'Draft': 'Rasimu',
    'Drafts': 'Rasimu',
    'Active': 'Hai',
    'Inactive': 'Imezimwa',
    'Final': 'Imekamilika',
    'Edited': 'Imehaririwa',
    'Completed': 'Imekamilika',
    'Pending': 'Inasubiri',
    'Received': 'Imepokelewa',
    'Applied': 'Imetekelezwa',
    'Revoked': 'Imebatilishwa',
    'Paid': 'Imelipwa',
    'Unpaid': 'Haijalipwa',
    'Unpaid / Due': 'Haijalipwa / Deni',
    'Fully paid': 'Imelipwa kamili',
    'Partially paid': 'Imelipwa kiasi',
    'Due': 'Inadaiwa',
    'Not invoiced': 'Haijatolewa ankara',
    'Settled': 'Imelipwa yote',
    'Receivable': 'Madai',
    'Payable': 'Deni',
    'Credit balance': 'Salio la ziada',
    'Current': 'Ya Sasa',
    'With delivery mistakes': 'Zenye makosa ya uwasilishaji',
    'No mistakes reported': 'Hakuna makosa yaliyoripotiwa',
    'Cash': 'Taslimu',
    'Mobile Money': 'Malipo ya Simu',
    'Bank Transfer': 'Uhamisho wa Benki',
    'Bank transfer': 'Uhamisho wa Benki',
    'Card': 'Kadi',
    'Credit': 'Mkopo',
    'Credit (Due payment)': 'Mkopo (Malipo baadaye)',
    'Mobile (M-Pesa)': 'Simu (M-Pesa)',
    'Mobile (Tigo Pesa)': 'Simu (Tigo Pesa)',
    'Mobile (Airtel)': 'Simu (Airtel)',
    'POS sale': 'Mauzo ya POS',
    'Sales order': 'Oda ya Mauzo',

    // Section & Panel Headings
    'Custom Price List & Catalog Builder': 'Kijenzi cha Orodha ya Bei na Katalogi',
    'Customize titles, select sample products, apply wholesale discounts or per-item price overrides, choose columns, and download as PDF, CSV, or shareable HTML.': 'Binafsisha vichwa, chagua sampuli za bidhaa, weka punguzo la jumla au bei maalum kwa kila bidhaa, chagua safu, na pakua kama PDF, CSV, au HTML.',
    'Sample Products Picker': 'Kichaguzi cha Sampuli za Bidhaa',
    'Tick individual products below or pick quick samples across categories.': 'Tiki bidhaa mojamoja hapa chini au chagua sampuli haraka kutoka kategoria mbalimbali.',
    'Edits here only affect your downloaded price list — master catalog prices remain unchanged.': 'Marekebisho hapa yanaathiri orodha ya bei utakayopakua pekee — bei kuu za mfumo hazitabadilika.',
    'Product Expiration & Management': 'Usimamizi wa Mwisho wa Matumizi ya Bidhaa',
    'Monitor perishables, track upcoming shelf-life expiries, apply clearance pricing, or record write-offs.': 'Fuatilia bidhaa zinazoharibika, tarehe za mwisho wa matumizi, weka punguzo, au rekodi hasara.',
    'Physical Stock Take History & Audits': 'Historia na Ukaguzi wa Hesabu za Stoo',
    'Auditable permanent records of all past physical count sessions and reconciliation worksheets.': 'Kumbukumbu za kudumu za ukaguzi wa vikao vyote vya kuhesabu stoo vilivyopita.',
    'Inter-Branch Stock Transfers': 'Uhamisho wa Bidhaa Kati ya Matawi',
    'Company-wide log of stock moved between branches with real-time Firestore sync.': 'Rekodi ya kampuni nzima ya bidhaa zilizohamishwa kati ya matawi kwa usawazishaji wa moja kwa moja.',
    'Customer accounts': 'Akaunti za Wateja',
    'Receivables, customer payments, and individual account histories.': 'Madai, malipo ya wateja, na historia ya kila akaunti.',
    'Supplier accounts': 'Akaunti za Wasambazaji',
    'Payables, supplier payments, and individual account histories.': 'Madeni, malipo ya wasambazaji, na historia ya kila akaunti.',
    'Financial Overview': 'Muhtasari wa Fedha',
    'Product Sales Report': 'Ripoti ya Mauzo ya Bidhaa',
    'Product Purchases Report': 'Ripoti ya Manunuzi ya Bidhaa',
    'Payment Reports': 'Ripoti za Malipo',
    'Sales and purchases': 'Mauzo na Manunuzi',
    'Sales by payment method': 'Mauzo kwa Njia ya Malipo',
    'Revenue, purchases & expenses': 'Mapato, Manunuzi na Matumizi',
    'Financial summary': 'Muhtasari wa Kifedha',
    'Inventory Valuation': 'Thamani ya Stoo',
    'Current on-hand stock valuation at cost.': 'Thamani ya sasa ya bidhaa zilizopo stoo kwa gharama ya manunuzi.',
    'General Activity Ledger': 'Leja Kuu ya Miamala',
    'Complete customer and supplier account transactions.': 'Miamala kamili ya akaunti za wateja na wasambazaji.',
    'Company Identity': 'Utambulisho wa Kampuni',
    'Invoice payment details': 'Maelezo ya Malipo ya Ankara',
    'Tanzania Tax & VAT (18%)': 'Kodi ya Tanzania na VAT (18%)',
    'Security & Auto-Lock Timer': 'Usalama na Kufunga Kiotomatiki',
    'Brand Theme Colors': 'Rangi za Mandhari ya Chapa',
    'Notification Sound Alerts': 'Tahadhari za Sauti',
    'Trash bin (Soft Deletes & Recovery)': 'Kikapu cha Taka (Urejeshaji wa Kumbukumbu)',
    'Restore accidentally deleted items directly back into active workflows.': 'Rejesha rekodi zilizofutwa kimakosa moja kwa moja kwenye mfumo.',
    'Purchase orders': 'Oda za Manunuzi',
    'Session Locked': 'Kipindi Kimefungwa',

    // Summary Strip & Financial Summary Rows
    'Daily sales': 'Mauzo ya leo',
    'Daily expenses': 'Matumizi ya leo',
    'Unpaid invoices': 'Ankara zisizolipwa',
    'Delivery mistakes': 'Makosa ya uwasilishaji',
    'Total Products': 'Jumla ya Bidhaa',
    'Stock Value (at cost)': 'Thamani ya Stoo (gharama)',
    'Stock Valuation (at cost)': 'Thamani ya Stoo (gharama)',
    'Low stock items': 'Bidhaa zenye stoo ndogo',
    'Expiring / Expired': 'Zinazoisha / Zilizopitwa',
    'Total On-Hand Quantity': 'Jumla ya Bidhaa Stoo',
    'Stock Takes Recorded': 'Hesabu za Stoo',
    'Open purchases': 'Manunuzi Wazi',
    'Supplier debt due': 'Deni la Wasambazaji',
    'Customer receivables': 'Madai kwa Wateja',
    'Supplier payables': 'Madeni ya Wasambazaji',
    'Ledger entries': 'Rekodi za Leja',
    'Active accounts': 'Akaunti Hai',
    "Today's Expenses": 'Matumizi ya Leo',
    'Sales revenue': 'Mapato ya Mauzo',
    'Cost of goods sold (COGS)': 'Gharama ya Bidhaa Zilizouzwa (COGS)',
    'Gross profit': 'Faida Ghafi',
    'Operating expenses': 'Matumizi ya Uendeshaji',
    'Net profit': 'Faida Halisi',
    'Customer payments collected': 'Malipo ya Wateja Yaliyokusanywa',
    'Purchases ordered': 'Oda za Manunuzi',
    'Supplier payments made': 'Malipo kwa Wasambazaji',
    'Operating expenses paid': 'Matumizi ya Uendeshaji Yaliyolipwa',
    'Net cash movement': 'Mzunguko Halisi wa Fedha',
    'Net Cash Movement': 'Mzunguko Halisi wa Fedha',
    'Total Units Sold': 'Jumla ya Bidhaa Zilizouzwa',
    'Total Product Revenue': 'Mapato Yote ya Bidhaa',
    'Total Gross Profit': 'Jumla ya Faida Ghafi',
    'Products with Sales': 'Bidhaa Zenye Mauzo',
    'Total Units Restocked': 'Jumla ya Bidhaa Zilizonunuliwa',
    'Total Restock Spend': 'Gharama Yote ya Manunuzi',
    'Products Restocked': 'Bidhaa Zilizoongezwa Stoo',
    'Total Purchase Orders': 'Jumla ya Oda za Manunuzi',
    'Total Inflows (Received from Customers)': 'Mapato Yote (Kutoka kwa Wateja)',
    'Total Outflows (Suppliers & Expenses)': 'Malipo Yote (Wasambazaji na Matumizi)',
    'Total Transactions': 'Jumla ya Miamala',
    'Total Spend': 'Jumla ya Matumizi',

    // Table Headers
    'Order date': 'Tarehe ya Oda',
    'Order': 'Oda',
    'Due amount': 'Kiasi Kinachodaiwa',
    'Actions': 'Vitendo',
    'Product': 'Bidhaa',
    'SKU': 'SKU',
    'Category': 'Kategoria',
    'Price': 'Bei',
    'Cost': 'Gharama',
    'Stock': 'Stoo',
    'Date': 'Tarehe',
    'Session Ref': 'Rejea ya Kikao',
    'Reason / Reference': 'Sababu / Rejea',
    'Counted': 'Zilizohisabiwa',
    'Discrepancy Breakdown': 'Mchanganuo wa Tofauti',
    'Net Quantity Delta': 'Tofauti Halisi ya Idadi',
    'Conducted By': 'Aliyefanya',
    'Worksheet & Actions': 'Karatasi na Vitendo',
    'Transfer Ref': 'Rejea ya Uhamisho',
    'Route': 'Njia (Tawi → Tawi)',
    'Quantity': 'Idadi',
    'Note': 'Maelezo',
    'Movement ID': 'Namba ya Muamala',
    'Before': 'Kabla',
    'After': 'Baada',
    'Variance': 'Tofauti',
    'Reason / Memo': 'Sababu / Kumbukumbu',
    'Auditor': 'Mkaguzi',
    'Pick': 'Chagua',
    'Catalog Price': 'Bei Kuu',
    'Batch / Lot': 'Kundi / Batch',
    'On-hand Stock': 'Stoo Iliyopo',
    'At-Cost Value': 'Thamani (Gharama)',
    'Expiry Date': 'Tarehe ya Mwisho',
    'Status / Timeline': 'Hali / Muda',
    'Purchase order': 'Oda ya Manunuzi',
    'Supplier': 'Msambazaji',
    'Payment status': 'Hali ya Malipo',
    'For Whom': 'Kwa Ajili ya Nani',
    'Purpose & Notes': 'Madhumuni na Maelezo',
    'Amount': 'Kiasi',
    'Account Name': 'Jina la Akaunti',
    'Phone / Contact': 'Simu / Mawasiliano',
    'Email': 'Barua Pepe',
    'Balance': 'Salio',
    'Credit limit': 'Kikomo cha Mkopo',
    'Account status': 'Hali ya Akaunti',
    'User': 'Mtumiaji',
    'Email / Phone': 'Barua Pepe / Simu',
    'Role': 'Jukumu',
    'Branch': 'Tawi',
    'Access': 'Ruhusa',
    'Measure': 'Kipimo',
    'Basis': 'Msingi',
    'In Stock': 'Ipo Stoo',
    'Units Sold': 'Zilizouzwa',
    'Avg Sell Price': 'Wastani wa Bei',
    'Total Revenue': 'Mapato Yote',
    'COGS': 'COGS',
    'Gross Profit': 'Faida Ghafi',
    'Margin': 'Asilimia ya Faida',
    'Drilldown': 'Undani',
    'Current Stock': 'Stoo ya Sasa',
    'Units Purchased': 'Zilizonunuliwa',
    'Avg Purchase Cost': 'Wastani wa Gharama',
    'Direction': 'Mwelekeo',
    'Party ("Made to" / "Received from")': 'Mhusika (Aliyelipwa / Aliyelipa)',
    'Reference / Source': 'Rejea / Chanzo',
    'Memo / Notes': 'Maelezo',
    'Record Type': 'Aina ya Rekodi',
    'Summary': 'Muhtasari',
    'Deleted Date': 'Tarehe ya Kufutwa',
    'Deleted By': 'Aliyefuta',
    'Stored Data': 'Data Iliyohifadhiwa',
    'Description': 'Maelezo',
    'Transactions': 'Miamala',
    'Balance / Amount': 'Salio / Kiasi',
    'Quick Link': 'Kiungo cha Haraka',
    'Qty': 'Idadi',
    'Unit price': 'Bei ya Kimoja',
    'Unit Price': 'Bei ya Kimoja',
    'Unit cost': 'Gharama ya Kimoja',
    'Unit Cost': 'Gharama ya Kimoja',
    'Entry': 'Muamala',
    'Memo': 'Maelezo',
    'Reference': 'Rejea',

    // Form Labels (Price List, Settings, Transfers, Auth, Scanner)
    'Price List Title': 'Kichwa cha Orodha ya Bei',
    'Subtitle / Validity / Terms': 'Maelezo Mafupi / Muda wa Uhalali / Masharti',
    'Products to Include': 'Bidhaa za Kujumuisha',
    'Category Filter': 'Chuja kwa Kategoria',
    'Sort Order': 'Mpangilio',
    'Global Price Adjustment (%)': 'Marekebisho ya Bei kwa Jumla (%)',
    'Round Adjusted Prices': 'Kadiria Bei Zilizorekebishwa',
    'Specific Category': 'Kategoria Maalum',
    'Category → Name (A–Z)': 'Kategoria → Jina (A–Z)',
    'Product Name (A–Z)': 'Jina la Bidhaa (A–Z)',
    'Product Name (Z–A)': 'Jina la Bidhaa (Z–A)',
    'Price (Low → High)': 'Bei (Chini → Juu)',
    'Price (High → Low)': 'Bei (Juu → Chini)',
    'Exact (No rounding)': 'Kamili (Bila kukadiria)',
    'Nearest 100': 'Karibu na 100',
    'Nearest 500': 'Karibu na 500',
    'Nearest 1,000': 'Karibu na 1,000',
    'Standard Price': 'Bei Kuu',
    'Availability': 'Upatikanaji',
    'Expiry / Batch': 'Mwisho / Kundi',
    'Layout:': 'Muonekano:',
    'Logo & Brand Colors': 'Nembo na Rangi za Chapa',
    'Contacts & Payment Info': 'Mawasiliano na Maelezo ya Malipo',
    'Group by Category': 'Panga kwa Kategoria',
    'Business name': 'Jina la Biashara',
    'Phone number': 'Namba ya Simu',
    'Company email': 'Barua Pepe ya Kampuni',
    'Physical address': 'Anwani ya Mahali',
    'Company logo': 'Nembo ya Kampuni',
    'Details to print at the bottom of invoices': 'Maelezo yatakayochapishwa chini ya ankara',
    'Enable standard 18% VAT': 'Washa VAT ya kawaida ya 18%',
    'VAT Rate (%)': 'Kiwango cha VAT (%)',
    'Thermal POS Receipt Paper Size': 'Ukubwa wa Karatasi ya Risiti ya POS',
    '80mm Standard Thermal (Recommended)': '80mm Kawaida (Inapendekezwa)',
    '58mm Compact Mobile / Bluetooth Printer': '58mm Ndogo (Printa ya Simu / Bluetooth)',
    'Automatically lock screen after inactivity': 'Funga skrini kiotomatiki baada ya kutotumika',
    'Primary Color': 'Rangi Kuu',
    'Secondary Color': 'Rangi ya Pili',
    'Enable notification sounds': 'Washa sauti za tahadhari',
    'Out of stock products': 'Bidhaa zilizoisha stoo',
    'Expired products': 'Bidhaa zilizopitwa na muda',
    'Alert Sound Tone': 'Sauti ya Tahadhari',
    'Soft Chime (Default)': 'Kengele Laini (Chaguo-msingi)',
    'Crisp Bell': 'Kengele Safi',
    'Double Alert (Urgent)': 'Tahadhari Mbili (Haraka)',
    'Gentle Pulse': 'Mlio Mpole',
    'Destination branch': 'Tawi Lengwa',
    'Product to transfer': 'Bidhaa ya Kuhamisha',
    'Quantity to transfer': 'Idadi ya Kuhamisha',
    'Transfer note / reference': 'Maelezo / Rejea ya Uhamisho',
    'Transferring from:': 'Inahamishwa kutoka:',
    'USB Scanner / Manual Barcode or SKU': 'Kiskani cha USB / Andika Msimbopau au SKU',
    '📷 Barcode Scanner': '📷 Kiskani cha Msimbopau',
    'Point your phone/webcam at a product barcode or scan with a USB/Bluetooth barcode scanner to add straight to the POS cart.': 'Elekeza kamera ya simu/kompyuta kwenye msimbopau wa bidhaa au tumia kiskani cha USB/Bluetooth kuongeza moja kwa moja kwenye kikapu cha POS.',
    'Point your phone/webcam at a barcode or scan with a USB scanner to find the product immediately.': 'Elekeza kamera kwenye msimbopau au tumia kiskani cha USB kupata bidhaa mara moja.',
    'Initializing camera… You can also scan directly with any USB/Bluetooth barcode scanner below.': 'Inaanzisha kamera… Unaweza pia kuskani moja kwa moja na kiskani cha USB/Bluetooth hapa chini.',
    'Camera unavailable in this browser — use a USB/Bluetooth scanner or type the barcode/SKU below.': 'Kamera haipatikani kwenye kivinjari hiki — tumia kiskani cha USB/Bluetooth au andika SKU hapa chini.',
    'Camera permission declined or no camera found — use a USB/Bluetooth barcode scanner or type SKU below.': 'Ruhusa ya kamera imekataliwa au hakuna kamera — tumia kiskani cha USB/Bluetooth au andika SKU hapa chini.',
    '⇄ Transfer Stock Between Branches': '⇄ Hamisha Stoo Kati ya Matawi',
    'Deducts stock from the current branch and immediately adds it to the destination branch in cloud storage.': 'Hupunguza stoo kutoka tawi hili na kuiongeza mara moja kwenye tawi lengwa mtandaoni.',
    'Order details': 'Maelezo ya Oda',
    'Purchase order details': 'Maelezo ya Oda ya Manunuzi',

    // Hints & Empty States
    'Upload a logo file. It scales responsively in the sidebar and prints larger on invoices.': 'Pakia nembo ya kampuni. Inaonekana pembeni na kuchapishwa vizuri kwenye ankara.',
    'Enter the ways customers can pay. Line breaks are preserved on printed invoices.': 'Weka njia ambazo wateja wanaweza kulipa. Mistari inahifadhiwa kwenye ankara zilizochapishwa.',
    'Calculates standard 18% VAT included in sales totals and displays tax breakdown on receipts.': 'Huhesabu VAT ya kawaida ya 18% iliyojumuishwa kwenye jumla ya mauzo na kuonyesha mchanganuo kwenye risiti.',
    'Controls receipt layout width when printing POS & sales thermal receipts.': 'Hudhibiti upana wa karatasi wakati wa kuchapisha risiti za POS na mauzo.',
    'Protects your workspace when unattended on PC or mobile. Your open screen and POS cart are preserved until you unlock.': 'Hulinda mfumo wako unapouacha bila mtu kwenye kompyuta au simu. Skrini yako na kikapu cha POS huhifadhiwa.',
    'Play an audible alert when products run out of stock or expire.': 'Piga sauti ya tahadhari bidhaa zinapoisha stoo au kupitwa na muda.',
    'Trash bin is empty': 'Kikapu cha taka ni kitupu',
    'No matching sales or orders': 'Hakuna mauzo au oda zinazolingana',
    'No matching products': 'Hakuna bidhaa zinazolingana',
    'No stock movements recorded.': 'Hakuna miamala ya stoo iliyorekodiwa.',
    'No inter-branch stock transfers recorded yet. Click "Transfer stock" to move inventory between branches.': 'Hakuna uhamisho wa bidhaa kati ya matawi bado. Bofya "Hamisha Stoo" kuhamisha bidhaa.',
    'No physical stock takes recorded yet. Click "New stock take" to conduct an audit.': 'Hakuna hesabu ya stoo iliyorekodiwa bado. Bofya "Hesabu Mpya ya Stoo" kuanza ukaguzi.',
    'No products found matching search.': 'Hakuna bidhaa zilizopatikana kwa utafutaji huo.',
    'No payment records found matching criteria.': 'Hakuna rekodi za malipo zinazolingana.',
    'No products found for this expiration filter.': 'Hakuna bidhaa za kichujio hiki cha mwisho wa matumizi.',
    'No customer accounts yet.': 'Hakuna akaunti za wateja bado.',
    'No supplier accounts yet.': 'Hakuna akaunti za wasambazaji bado.',
    'No users added yet': 'Hakuna watumiaji walioongezwa bado',
    'No logo uploaded': 'Hakuna nembo iliyopakiwa',

    // Auth Gate & Lock Screen
    '🔑 Sign In': '🔑 Ingia',
    '🏢 Register Company': '🏢 Sajili Kampuni',
    'Sign in to Workspace': 'Ingia Kazini',
    'Register Company Workspace': 'Sajili Ofisi ya Kampuni',
    'Access your commercial accounting ledger, point-of-sale terminals, and inventory controls.': 'Fikia leja yako ya uhasibu, mauzo ya POS, na usimamizi wa stoo.',
    'Create your enterprise workspace, primary branch, and administrator account.': 'Unda ofisi ya kampuni yako, tawi kuu, na akaunti ya msimamizi.',
    'Username or Email Address': 'Jina la Mtumiaji au Barua Pepe',
    'Password': 'Nenosiri',
    'New to Tide ERP?': 'Mgeni kwenye Tide ERP?',
    'Create an account & register company →': 'Fungua akaunti na sajili kampuni →',
    'Already have an account?': 'Tayari una akaunti?',
    'Sign in here →': 'Ingia hapa →',
    'Company / Business Name *': 'Jina la Kampuni / Biashara *',
    'Primary Branch Name': 'Jina la Tawi Kuu',
    'Base Currency': 'Sarafu Kuu',
    'Your Full Name *': 'Jina Lako Kamili *',
    'Choose Username *': 'Chagua Jina la Mtumiaji *',
    'Email Address *': 'Barua Pepe *',
    'Phone Number': 'Namba ya Simu',
    'Password (min 6 chars) *': 'Nenosiri (angalau herufi 6) *',
    'Confirm Password *': 'Thibitisha Nenosiri *',
    'Enter your password to unlock': 'Ingiza nenosiri lako kufungua',
    'Commercial & Financial Workspace': 'Mfumo wa Biashara na Fedha',

    // Placeholders
    'Find product or scan barcode… (/ to search)': 'Tafuta bidhaa au skani msimbopau… (/ kutafuta)',
    'Search product name, SKU, category, batch…': 'Tafuta jina la bidhaa, SKU, kategoria, kundi…',
    'Search order ID, customer, status, payment method…': 'Tafuta namba ya oda, mteja, hali, njia ya malipo…',
    'Search product, movement ref, reason…': 'Tafuta bidhaa, rejea ya muamala, sababu…',
    'Search products to pick samples or override price…': 'Tafuta bidhaa kuchagua sampuli au kubadili bei…',
    'Search product name, SKU, category…': 'Tafuta jina la bidhaa, SKU, kategoria…',
    'Search product name, SKU, supplier…': 'Tafuta jina la bidhaa, SKU, msambazaji…',
    'Search customer, supplier, expense, reference, memo…': 'Tafuta mteja, msambazaji, matumizi, rejea, maelezo…',
    'Search payee, purpose, notes, or ID…': 'Tafuta mlipwaji, madhumuni, maelezo, au namba…',
    'Scan barcode or type SKU and press Enter': 'Skani msimbopau au andika SKU kisha bonyeza Enter',
    'Enter password': 'Ingiza nenosiri',
    'e.g. Wholesale Price List': 'mf. Orodha ya Bei ya Jumla',
    'e.g. Valid until 31 Dec 2026 · VAT Included': 'mf. Halali hadi 31 Des 2026 · VAT Imejumuishwa',
    '0 (e.g. -10 for 10% off)': '0 (mf. -10 kwa punguzo la 10%)'
  };

  // Dynamic pattern translators (English -> Kiswahili)
  const PATTERNS_SW = [
    [/^GOOD MORNING,\s*(.+)$/i, (_, name) => `HABARI ZA ASUBUHI, ${name}`],
    [/^GOOD AFTERNOON,\s*(.+)$/i, (_, name) => `HABARI ZA MCHANA, ${name}`],
    [/^GOOD EVENING,\s*(.+)$/i, (_, name) => `HABARI ZA JIONI, ${name}`],
    [/^Complete sale · (.+)$/i, (_, amt) => `Kamilisha mauzo · ${amt}`],
    [/^🧾 Receipt \((.+)\)$/i, (_, w) => `🧾 Risiti (${w})`],
    [/^(\d+)\s+active products?$/i, (_, n) => `Bidhaa hai ${n}`],
    [/^(\d+)\s+items?\s*·\s*(.*)$/i, (_, n, rest) => `Bidhaa ${n}${rest ? ` · ${rest}` : ''}`],
    [/^(\d+)\s+sales?$/i, (_, n) => `Mauzo ${n}`],
    [/^(\d+)\s+outflows?$/i, (_, n) => `Malipo ${n}`],
    [/^(\d+)\s+unpaid$/i, (_, n) => `${n} hazijalipwa`],
    [/^(\d+)\s+orders?$/i, (_, n) => `Oda ${n}`],
    [/^(\d+)\s+records?$/i, (_, n) => `Rekodi ${n}`],
    [/^(\d+)\s+alerts?$/i, (_, n) => `Tahadhari ${n}`],
    [/^(\d+)\s+sessions?$/i, (_, n) => `Vikao ${n}`],
    [/^(\d+)\s+products? ready$/i, (_, n) => `Bidhaa ${n} tayari`],
    [/^(\d+)\s+products? selected$/i, (_, n) => `Bidhaa ${n} zimechaguliwa`],
    [/^Avg (.+) per sale$/i, (_, amt) => `Wastani ${amt} kwa mauzo`],
    [/^(\d+)\s+from today \((.+)\)$/i, (_, n, amt) => `${n} za leo (${amt})`],
    [/^(\d+)\s+of\s+(\d+)\s+orders$/i, (_, a, b) => `Oda ${a} kati ya ${b}`],
    [/^(\d+)\s+of\s+(\d+)\s+products$/i, (_, a, b) => `Bidhaa ${a} kati ya ${b}`],
    [/^(\d+)\s+of\s+(\d+)\s+movements$/i, (_, a, b) => `Miamala ${a} kati ya ${b}`],
    [/^(\d+)\s+of\s+(\d+)\s+payments$/i, (_, a, b) => `Malipo ${a} kati ya ${b}`],
    [/^Showing\s+([\d–-]+)\s+of\s+(\d+)\s*\((\d+)\s+total\)$/i, (_, r, f, t) => `Inaonyesha ${r} kati ya ${f} (jumla ${t})`],
    [/^Page\s+(\d+)\s+of\s+(\d+)$/i, (_, a, b) => `Ukurasa ${a} kati ya ${b}`],
    [/^All \((\d+)\)$/i, (_, n) => `Zote (${n})`],
    [/^All Active Products \((\d+)\)$/i, (_, n) => `Bidhaa Zote Hai (${n})`],
    [/^In-Stock Products Only \((\d+)\)$/i, (_, n) => `Bidhaa Zilizopo Stoo Tu (${n})`],
    [/^Custom Sample Selection \((\d+)\s+picked\)$/i, (_, n) => `Sampuli Zilizochaguliwa (${n})`],
    [/^☑ Use Table Selection \((\d+)\)$/i, (_, n) => `☑ Tumia Zilizochaguliwa (${n})`],
    [/^↺ Reset (\d+) Overrides?$/i, (_, n) => `↺ Rejesha Bei Maalum ${n}`],
    [/^Expired \((\d+)\)$/i, (_, n) => `Zilizopitwa na Muda (${n})`],
    [/^Expiring in ≤ 30 days \((\d+)\)$/i, (_, n) => `Zinaisha ndani ya siku 30 (${n})`],
    [/^All with expiry dates \((\d+)\)$/i, (_, n) => `Zote zenye tarehe ya mwisho (${n})`],
    [/^Expires in (\d+)d$/i, (_, d) => `Inaisha baada ya siku ${d}`],
    [/^Expired \((\d+)d ago\)$/i, (_, d) => `Imeisha (siku ${d} zilizopita)`],
    [/^⚠ Expired (\d+)d ago$/i, (_, d) => `⚠ Imeisha siku ${d} zilizopita`],
    [/^⌛ Expires in (\d+)d$/i, (_, d) => `⌛ Inaisha baada ya siku ${d}`],
    [/^Price List Price \((.+)\)$/i, (_, cur) => `Bei ya Orodha (${cur})`],
    [/^Paid \((\d+)\)$/i, (_, n) => `Zilizolipwa (${n})`],
    [/^Unpaid \/ Pending \((\d+)\)$/i, (_, n) => `Hazijalipwa / Zinasubiri (${n})`],
    [/^Total Expenses \((\d+)\)$/i, (_, n) => `Matumizi Yote (${n})`],
    [/^↓ Export (weekly|monthly|annual) report$/i, (_, p) => `↓ Pakua ripoti ya ${p === 'weekly' ? 'wiki' : p === 'annual' ? 'mwaka' : 'mwezi'}`],
    [/^(\d+)\s+units$/i, (_, n) => `Vipande ${n}`],
    [/^Per page:$/i, () => 'Kwa ukurasa:'],
    [/^Showing$/i, () => 'Inaonyesha'],
    [/^Ready to export$/i, () => 'Tayari kupakua'],
    [/^Columns:$/i, () => 'Safu:'],
    [/^20 minutes \(Recommended\)$/i, () => 'Dakika 20 (Inapendekezwa)'],
    [/^Disabled \(Never auto-lock\)$/i, () => 'Imezimwa (Usifunge kiotomatiki)'],
    [/^(\d+)\s+minutes$/i, (_, m) => `Dakika ${m}`]
  ];

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

  function translateString(raw) {
    if (!raw || currentLang !== 'sw') return raw;
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (!trimmed) return raw;

    let translated = PHRASES_SW[trimmed];
    if (!translated) {
      for (const [regex, replacer] of PATTERNS_SW) {
        if (regex.test(trimmed)) {
          translated = trimmed.replace(regex, replacer);
          break;
        }
      }
    }
    if (!translated || translated === trimmed) return raw;
    // Preserve leading/trailing single space around inline icons/badges
    const lead = /^\s/.test(raw) ? ' ' : '';
    const trail = /\s$/.test(raw) ? ' ' : '';
    return lead + translated + trail;
  }

  function t(key, fallback = '') {
    if (currentLang === 'sw') {
      if (PHRASES_SW[key]) return PHRASES_SW[key];
      if (NAV_LABELS.sw[key]) return NAV_LABELS.sw[key];
      if (PAGE_TITLES.sw[key]) return PAGE_TITLES.sw[key];
      const byPattern = translateString(key);
      if (byPattern !== key) return byPattern;
    } else {
      if (NAV_LABELS.en[key]) return NAV_LABELS.en[key];
      if (PAGE_TITLES.en[key]) return PAGE_TITLES.en[key];
    }
    return fallback || key;
  }

  function getReceiptStrings() {
    return RECEIPT_STRINGS[currentLang] || RECEIPT_STRINGS.en;
  }

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'PRE', 'CODE', 'SVG']);

  function isSkippedElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.dataset?.noI18n === 'true') return true;
    if (el.classList?.contains('trash-record') || el.classList?.contains('font-mono')) {
      // Allow font-mono only when it's not a pure number/countdown
      if (el.id === 'footer-lock-countdown') return true;
    }
    return false;
  }

  function processTextNode(node, lang) {
    if (!node || !node.nodeValue || !node.nodeValue.trim()) return;
    const parent = node.parentElement;
    if (!parent || isSkippedElement(parent)) return;
    // Skip sidebar nav text nodes (handled explicitly by NAV_LABELS so icons/counts stay exact)
    if (parent.classList.contains('nav-item') && parent.dataset.page) return;
    // Skip the language toggle button itself
    if (parent.id === 'lang-toggle') return;

    if (!ORIG_TEXT.has(node)) {
      ORIG_TEXT.set(node, node.nodeValue);
    }
    const orig = ORIG_TEXT.get(node);
    if (lang === 'sw') {
      const next = translateString(orig);
      if (next !== node.nodeValue) node.nodeValue = next;
    } else {
      if (node.nodeValue !== orig) node.nodeValue = orig;
    }
  }

  function processAttributes(el, lang) {
    if (!el || el.nodeType !== 1 || isSkippedElement(el)) return;
    if (el.hasAttribute('placeholder')) {
      if (!ORIG_PLACEHOLDER.has(el)) ORIG_PLACEHOLDER.set(el, el.getAttribute('placeholder'));
      const orig = ORIG_PLACEHOLDER.get(el);
      const next = lang === 'sw' ? translateString(orig) : orig;
      if (el.getAttribute('placeholder') !== next) el.setAttribute('placeholder', next);
    }
    if (el.id !== 'lang-toggle' && el.hasAttribute('title')) {
      if (!ORIG_TITLE.has(el)) ORIG_TITLE.set(el, el.getAttribute('title'));
      const orig = ORIG_TITLE.get(el);
      const next = lang === 'sw' ? translateString(orig) : orig;
      if (el.getAttribute('title') !== next) el.setAttribute('title', next);
    }
  }

  function applyDomTranslations(root = document, activePage = '') {
    if (typeof document === 'undefined' || !root) return;
    const lang = currentLang;
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;

    // 1. Update topbar language toggle button
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.textContent = lang === 'sw' ? 'SW' : 'EN';
      langBtn.dataset.lang = lang;
      const tip = lang === 'sw'
        ? 'Lugha: Kiswahili (Bofya kubadili kwenda English)'
        : 'Language: English (Click to switch to Kiswahili)';
      langBtn.setAttribute('title', tip);
      langBtn.setAttribute('aria-label', tip);
    }

    // 2. Sidebar nav items (preserve icon + badge children)
    document.querySelectorAll('.primary-nav .nav-item[data-page]').forEach(btn => {
      const p = btn.dataset.page;
      const label = (NAV_LABELS[lang] && NAV_LABELS[lang][p]) || NAV_LABELS.en[p];
      if (!label) return;
      for (const node of Array.from(btn.childNodes)) {
        if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim()) {
          node.nodeValue = label + (btn.querySelector('.nav-count') ? ' ' : '');
          break;
        }
      }
    });

    // 3. Topbar breadcrumb
    const crumb = document.getElementById('crumb-current');
    if (crumb && activePage && PAGE_TITLES[lang]?.[activePage]) {
      crumb.textContent = PAGE_TITLES[lang][activePage];
    }

    // 4. Full lossless DOM walk across the target root (or document.body)
    const walkRoot = root === document ? document.body : root;
    if (!walkRoot) return;

    const walker = document.createTreeWalker(
      walkRoot,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (node.nodeType === 1) {
            return isSkippedElement(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === 3) {
        processTextNode(current, lang);
      } else if (current.nodeType === 1) {
        processAttributes(current, lang);
      }
      current = walker.nextNode();
    }
  }

  return {
    LANG_KEY,
    getLang,
    setLang,
    toggleLang,
    t,
    translateString,
    getReceiptStrings,
    applyDomTranslations,
    NAV_LABELS,
    PAGE_TITLES
  };
}));
