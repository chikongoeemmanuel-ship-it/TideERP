# Tide ERP demo

Tide ERP is a standalone, responsive front-end prototype with sample data. It has no external packages or build step.

## Open the demo

You can open `index.html` directly in Chrome or run `serve.ps1` in PowerShell and visit [http://127.0.0.1:8765](http://127.0.0.1:8765). The direct file version now loads its scripts without ES modules; browser storage can be limited for file URLs, so the local HTTP version is preferred for persistent data and the installable PWA shell. Stop the local server with Ctrl+C.

The demo saves changes in the current browser profile. POS transactions can be entered while offline, but this prototype has no remote service to synchronize with. It does not include production authentication, multi-user/branch data isolation, live payment processing, or Tanzania tax/e-invoice provider connections.

## Vercel preview

This is a static site with no package installation or build step. To create a Vercel preview, import the repository and select the **Other** framework preset. Use the repository root as the project root, leave the install and build commands empty, and set the output directory to `.`. Vercel will serve `index.html` and the accompanying static assets directly.

The sign-in screen is a local app feature, not production authentication. User accounts and business data are stored in each browser's IndexedDB and do not synchronize between users or devices. Before using a public deployment for real business data or multiple users, the app needs a shared backend and server-enforced authentication and permissions.

## Included workflows

- Dashboard with date range, sales charts, alerts, and quick actions
- POS checkout, product search, and local offline transaction storage
- Multi-product sales orders with fixed-amount discounts, fulfillment, invoicing, returns, and optional stock restocking
- Product catalogue, stock levels, and low-stock indicators
- Supplier purchase orders and receiving
- Customer and supplier balances, credits, debits, and recorded payments
- Accounting activity and CSV exports for sales, stock, accounts, and ledger entries
