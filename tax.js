// Tanzania Tax & VAT Utility Module (Standard 18% VAT)

const DEFAULT_VAT_RATE = 18;

/**
 * Calculates Net, VAT, and Gross amounts for VAT-inclusive prices.
 * In Tanzania, retail prices typically include 18% VAT.
 */
function calculateTaxBreakdown(grossTotal, isEnabled = true, rate = DEFAULT_VAT_RATE) {
  const total = Number(grossTotal) || 0;
  if (!isEnabled || rate <= 0) {
    return {
      gross: total,
      net: total,
      vat: 0,
      vatRate: 0,
      isEnabled: false
    };
  }

  const factor = 1 + (rate / 100);
  const net = Math.round(total / factor);
  const vat = total - net;

  return {
    gross: total,
    net,
    vat,
    vatRate: rate,
    isEnabled: true
  };
}

/**
 * Renders the formatted tax breakdown block for Cart / Order summaries
 */
function renderTaxSummaryHTML(taxBreakdown, formatMoney) {
  if (!taxBreakdown.isEnabled || taxBreakdown.vat <= 0) {
    return `
      <div class="cart-total"><span>Subtotal (Net)</span><span>${formatMoney(taxBreakdown.gross)}</span></div>
      <div class="cart-total"><span>VAT</span><span>Exempt / None</span></div>
      <div class="cart-total grand"><span>Total due</span><span>${formatMoney(taxBreakdown.gross)}</span></div>
    `;
  }

  return `
    <div class="cart-total"><span>Taxable amount (Net)</span><span>${formatMoney(taxBreakdown.net)}</span></div>
    <div class="cart-total"><span>VAT (${taxBreakdown.vatRate}%)</span><span>${formatMoney(taxBreakdown.vat)}</span></div>
    <div class="cart-total grand"><span>Total due (Incl. VAT)</span><span>${formatMoney(taxBreakdown.gross)}</span></div>
  `;
}
