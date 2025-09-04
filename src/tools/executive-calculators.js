"use strict";

// Simple deterministic calculators for executive domains

function toNumber(x) {
  if (x == null) return NaN;
  if (typeof x === 'number') return x;
  const s = String(x).trim().toLowerCase().replace(/[,\s]/g, '');
  // 250k, 1.2m, 3b
  const m = s.match(/^([+-]?[0-9]*\.?[0-9]+)(k|m|b)?$/);
  if (m) {
    const n = parseFloat(m[1]);
    const mul = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1;
    return n * mul;
  }
  return Number(s);
}

function toPercent(x) {
  if (x == null) return NaN;
  if (typeof x === 'number') return x > 1 ? x / 100 : x;
  const s = String(x).trim().toLowerCase();
  if (s.endsWith('%')) return parseFloat(s) / 100;
  const n = toNumber(s);
  return n > 1 ? n / 100 : n;
}

function toYears(x) {
  if (x == null) return NaN;
  if (typeof x === 'number') return x;
  const s = String(x).toLowerCase();
  const m = s.match(/([0-9]*\.?[0-9]+)/);
  return m ? parseFloat(m[1]) : Number(s);
}

// Risk-adjusted investment analysis
// EV = amount * [ p*(1+upside)^years + (1-p)*(1-downside)^years ]
function analyzeInvestment(params) {
  const amount = toNumber(params.amount ?? params.investment ?? params.principal);
  const upside = toPercent(params.upside ?? params.return ?? params.gain);
  const downside = toPercent(params.downside ?? params.loss ?? 0);
  const years = toYears(params.years ?? params.horizon ?? 1);
  let probability = params.probability != null ? toPercent(params.probability) : 0.5;
  if (Number.isNaN(probability)) probability = 0.5;

  if ([amount, upside, years].some(Number.isNaN)) {
    return { success: false, error: 'Missing or invalid parameters', required: ['amount', 'upside', 'years'], received: params };
  }

  const upValue = amount * Math.pow(1 + upside, years);
  const downValue = amount * Math.pow(1 - downside, years);
  const expected = probability * upValue + (1 - probability) * downValue;
  const absGain = expected - amount;
  const roiPct = amount > 0 ? (absGain / amount) * 100 : 0;

  return {
    success: true,
    domain: 'INVESTMENT',
    inputs: { amount, upside, downside, years, probability },
    results: {
      upValue,
      downValue,
      expected,
      absoluteGain: absGain,
      roiPercent: roiPct
    },
    explanation: `Expected value after ${years} year(s): ${expected.toFixed(2)} (ROI ${roiPct.toFixed(2)}%). ` +
      `Upside path: ${(upValue).toFixed(2)}, Downside path: ${(downValue).toFixed(2)} with p=${(probability*100).toFixed(0)}%.`
  };
}

module.exports = { analyzeInvestment };
// VENDOR DISCOUNT: savings and effective rate (optional period → annualized)
function analyzeVendorDiscount(params) {
  const amount = toNumber(params.amount ?? params.invoice ?? params.invoice_amount ?? params.principal);
  const discount = toPercent(params.discount ?? params.discount_offered ?? params.rate);
  const days = Number(params.days ?? params.payment_terms_days ?? params.term_days);

  if (Number.isNaN(amount) || Number.isNaN(discount)) {
    return { success: false, error: 'Missing or invalid parameters', required: ['amount', 'discount'], received: params };
  }
  const savings = amount * discount;
  const pay = amount - savings;
  let annualized = null;
  if (!Number.isNaN(days) && days > 0) {
    // Simple approximation: discount over days scaled to 365
    annualized = (discount / (1 - discount)) * (365 / days) * 100; // percent
  }
  return {
    success: true,
    domain: 'VENDOR_DISCOUNT',
    inputs: { amount, discount, days: Number.isNaN(days) ? undefined : days },
    results: { savings, discountedPrice: pay, effectiveAnnualRatePercent: annualized },
    explanation: annualized != null
      ? `Effective annualized rate ≈ ${annualized.toFixed(2)}% assuming early payment by ${days} day(s).`
      : 'Early payment savings computed.'
  };
}

// SAAS BREAKEVEN: months to recover CAC considering churn (simple model)
function analyzeSaasBreakeven(params) {
  const cac = toNumber(params.customer_acquisition_cost ?? params.cac ?? params.cost);
  const mrr = toNumber(params.monthly_recurring_revenue ?? params.mrr ?? params.revenue);
  const churn = toPercent(params.churn_rate ?? params.churn ?? 0);
  const margin = toPercent(params.gross_margin ?? params.margin ?? 1);
  if ([cac, mrr].some(Number.isNaN)) {
    return { success: false, error: 'Missing or invalid parameters', required: ['customer acquisition cost', 'monthly recurring revenue'], received: params };
  }
  const contribution = mrr * margin * (1 - churn);
  if (contribution <= 0) {
    return { success: false, error: 'Non-positive contribution margin after churn; cannot reach breakeven with given inputs' };
  }
  const months = cac / contribution;
  return {
    success: true,
    domain: 'SAAS_BREAKEVEN',
    inputs: { cac, mrr, churn, margin },
    results: { monthsToRecoverCAC: months },
    explanation: `Approximate payback period using contribution = MRR × margin × (1 − churn).`
  };
}

// FINANCE: compound interest
function analyzeFinanceCompound(params) {
  const principal = toNumber(params.principal ?? params.amount);
  const rate = toPercent(params.rate ?? params.apr);
  const years = toYears(params.years ?? params.term);
  const n = Number(params.compounding ?? params.n ?? 1);
  if ([principal, rate, years].some(Number.isNaN)) {
    return { success: false, error: 'Missing or invalid parameters', required: ['principal', 'rate', 'years'], received: params };
  }
  const fv = principal * Math.pow(1 + rate / (n || 1), (n || 1) * years);
  return {
    success: true,
    domain: 'FINANCE',
    inputs: { principal, rate, years, compounding: n || 1 },
    results: { futureValue: fv },
    explanation: `FV = P × (1 + r/${n||1})^(${(n||1)}×${years}).`
  };
}

module.exports.analyzeVendorDiscount = analyzeVendorDiscount;
module.exports.analyzeSaasBreakeven = analyzeSaasBreakeven;
module.exports.analyzeFinanceCompound = analyzeFinanceCompound;
// DEPRECIATION calculator (Companies Act style inputs)
function daysBetween(d1, d2) {
  try {
    const a = new Date(d1);
    const b = new Date(d2);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    const ms = b.getTime() - a.getTime();
    return Math.max(0, Math.floor(ms / 86400000) + 1);
  } catch { return null; }
}

function analyzeDepreciation(params) {
  const cost = toNumber(params.cost ?? params.amount ?? params.purchase_cost ?? params.asset_cost ?? params.principal);
  const methodRaw = String(params.method ?? params.depreciation_method ?? '').toLowerCase();
  const method = /wdv|written/.test(methodRaw) ? 'WDV' : 'SLM';
  const residual = params.residual_value != null ? toNumber(params.residual_value) : (params.salvage != null ? toNumber(params.salvage) : null);
  const residualPct = params.residual_percent != null ? toPercent(params.residual_percent) : null;
  const lifeYears = params.useful_life_years != null ? Number(params.useful_life_years) : (params.useful_life != null ? Number(params.useful_life) : null);
  const ratePct = params.rate != null ? toPercent(params.rate) : null;
  const dateReady = params.date_ready || params.ready_date || params.put_to_use || params.capitalized_on;
  const yearEnd = params.year_end || params.reporting_date || params.fy_end || params.year_close;
  const yearDays = Number(params.year_length_days || 365);

  if (Number.isNaN(cost)) {
    return { success: false, error: 'Missing or invalid cost' };
  }

  // Determine residual absolute amount
  const residualDefaultPct = 0.05; // 5% default often used under Schedule II unless estimate differs
  const residualAmount = residual != null
    ? toNumber(residual)
    : (residualPct != null ? cost * residualPct : cost * residualDefaultPct);

  // Pro‑rata factor for first period
  let prorataFactor = 1;
  let prorataDays = null;
  if (dateReady && yearEnd) {
    const d = daysBetween(dateReady, yearEnd);
    if (d != null && d > 0) { prorataDays = d; prorataFactor = Math.min(1, d / (yearDays > 0 ? yearDays : 365)); }
  }

  let results = {};
  if (method === 'SLM') {
    if (lifeYears == null || !(lifeYears > 0)) {
      return { success: false, error: 'SLM requires useful_life_years > 0' };
    }
    const depreciableBase = Math.max(0, cost - residualAmount);
    const annual = depreciableBase / lifeYears;
    const firstPeriod = annual * prorataFactor;
    const accumulated = firstPeriod; // first year only
    const closingCarryingAmount = Math.max(residualAmount, cost - accumulated);
    results = { method: 'SLM', annualDepreciation: annual, firstPeriodDepreciation: firstPeriod, prorataDays, prorataFactor, accumulatedDepreciation: accumulated, closingCarryingAmount };
  } else { // WDV
    // Use provided rate if given; else derive from life if available
    let r = ratePct;
    if (r == null) {
      if (lifeYears != null && lifeYears > 0) {
        // r = 1 - (residual/cost)^(1/years)
        const ratio = residualAmount > 0 && cost > 0 ? residualAmount / cost : 0.05;
        r = 1 - Math.pow(ratio, 1 / lifeYears);
      } else {
        // conservative fallback 10%
        r = 0.10;
      }
    }
    const annual = cost * r;
    const firstPeriod = annual * prorataFactor;
    const closingCarryingAmount = Math.max(residualAmount, cost - firstPeriod);
    results = { method: 'WDV', ratePercent: r * 100, firstPeriodDepreciation: firstPeriod, prorataDays, prorataFactor, closingCarryingAmount };
  }

  return {
    success: true,
    domain: 'DEPRECIATION',
    inputs: {
      cost,
      method,
      useful_life_years: lifeYears ?? undefined,
      residual_value: residualAmount,
      rate_percent: results.ratePercent ?? (results.annualDepreciation ? ((results.annualDepreciation / cost) * 100) : undefined),
      date_ready: dateReady || undefined,
      year_end: yearEnd || undefined,
      prorataDays: results.prorataDays || undefined,
      prorataFactor: results.prorataFactor || undefined
    },
    results: {
      annualDepreciation: results.annualDepreciation ?? undefined,
      firstPeriodDepreciation: results.firstPeriodDepreciation,
      accumulatedDepreciation: results.accumulatedDepreciation ?? results.firstPeriodDepreciation,
      closingCarryingAmount: results.closingCarryingAmount,
      ratePercent: results.ratePercent ?? undefined
    },
    explanation: method === 'SLM'
      ? `SLM: Annual depreciation = (Cost − Residual)/Useful life. First-period pro‑rata factor ${prorataFactor.toFixed(3)} applied.`
      : `WDV: Annual depreciation at rate ≈ ${((results.ratePercent)||0).toFixed(2)}%. First-period pro‑rata factor ${prorataFactor.toFixed(3)} applied.`
  };
}

module.exports.analyzeDepreciation = analyzeDepreciation;
