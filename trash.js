// Trash Bin archiving & restoration module for Tide ERP

function archiveToTrashBin(state, type, data, summary = '', currentUser = 'Administrator') {
  if (!Array.isArray(state.trashBin)) state.trashBin = [];
  const id = `TRASH-${Date.now().toString().slice(-6)}${String(state.trashBin.length + 1).padStart(2, '0')}`;
  state.trashBin.unshift({
    id,
    type,
    summary: summary || data?.name || data?.id || type,
    deletedAt: new Date().toISOString(),
    deletedBy: currentUser,
    data: structuredClone(data)
  });
}

function restoreFromTrash(state, trashId) {
  if (!Array.isArray(state.trashBin)) return { success: false, message: 'Trash bin is empty' };
  const index = state.trashBin.findIndex(item => item.id === trashId);
  if (index === -1) return { success: false, message: 'Trash record not found' };

  const item = state.trashBin[index];
  const { type, data } = item;

  try {
    switch (type) {
      case 'Product': {
        if (state.products.some(p => p.id === data.id)) {
          return { success: false, message: `Product SKU ${data.id} already exists in active inventory` };
        }
        state.products.unshift(data);
        if (!Array.isArray(state.stockMovements)) state.stockMovements = [];
        state.stockMovements.unshift({
          productId: data.id,
          date: new Date().toISOString().slice(0, 10),
          ref: `RESTORE-${data.id}`,
          type: 'Stock restore',
          reason: 'Restored from Trash bin',
          change: Number(data.stock) || 0
        });
        break;
      }

      case 'Sales order':
      case 'POS sale': {
        const order = data.order || data;
        if (state.orders.some(o => o.id === order.id)) {
          return { success: false, message: `Order ${order.id} is already in active orders` };
        }
        state.orders.unshift(order);
        if (data.invoice && !state.sales.some(s => s.id === data.invoice.id)) {
          state.sales.unshift(data.invoice);
        }
        if (Array.isArray(data.returns)) {
          for (const ret of data.returns) {
            if (!state.returns.some(r => r.id === ret.id)) state.returns.unshift(ret);
          }
        }
        if (Array.isArray(data.accountEntries)) {
          for (const entry of data.accountEntries) {
            if (!state.entries.some(e => e.id === entry.id)) state.entries.unshift(entry);
          }
        }
        break;
      }

      case 'Purchase order': {
        const purchase = data.purchase || data;
        if (state.purchases.some(p => p.id === purchase.id)) {
          return { success: false, message: `Purchase ${purchase.id} is already in active purchases` };
        }
        state.purchases.unshift(purchase);
        if (Array.isArray(data.returns)) {
          for (const ret of data.returns) {
            if (!state.purchaseReturns.some(r => r.id === ret.id)) state.purchaseReturns.unshift(ret);
          }
        }
        if (Array.isArray(data.accountEntries)) {
          for (const entry of data.accountEntries) {
            if (!state.entries.some(e => e.id === entry.id)) state.entries.unshift(entry);
          }
        }
        break;
      }

      case 'Customer account': {
        const customer = data.customer || data;
        if (state.customers.some(c => c.id === customer.id || c.name === customer.name)) {
          return { success: false, message: `Customer ${customer.name} already exists in active accounts` };
        }
        state.customers.unshift(customer);
        if (Array.isArray(data.orders)) {
          for (const o of data.orders) {
            if (!state.orders.some(ex => ex.id === o.id)) state.orders.unshift(o);
          }
        }
        if (Array.isArray(data.sales)) {
          for (const s of data.sales) {
            if (!state.sales.some(ex => ex.id === s.id)) state.sales.unshift(s);
          }
        }
        if (Array.isArray(data.accountEntries)) {
          for (const e of data.accountEntries) {
            if (!state.entries.some(ex => ex.id === e.id)) state.entries.unshift(e);
          }
        }
        break;
      }

      case 'Workspace user': {
        const user = data.user || data;
        if (state.users.some(u => u.id === user.id || (u.email && u.email === user.email))) {
          return { success: false, message: `User ${user.name} or email is already registered` };
        }
        state.users.unshift(user);
        break;
      }

      case 'Branch workspace': {
        const branch = data.branch;
        const workspace = data.workspace;
        if (state.branches.some(b => b.id === branch.id)) {
          return { success: false, message: `Branch ${branch.name} already exists` };
        }
        state.branches.push(branch);
        if (workspace) {
          state.branchData[branch.id] = workspace;
        }
        break;
      }

      default: {
        return { success: false, message: `Unsupported restore type: ${type}` };
      }
    }

    // Remove item from trash on success
    state.trashBin.splice(index, 1);
    return { success: true, message: `${item.summary} was successfully restored!` };
  } catch (err) {
    return { success: false, message: `Failed to restore: ${err.message}` };
  }
}
