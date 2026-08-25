/**
 * Map PPMP PROJECTED TIMELINE (Month Year) + quantity into APP-CSE month/quarter buckets.
 * Mirrors laravel-backend/app/Services/CseQtyHelper.php for CSE-APP preview.
 */

const MONTH_NAMES = {
  1: ["january", "jan"],
  2: ["february", "feb"],
  3: ["march", "mar"],
  4: ["april", "apr"],
  5: ["may"],
  6: ["june", "jun"],
  7: ["july", "jul"],
  8: ["august", "aug"],
  9: ["september", "sep", "sept"],
  10: ["october", "oct"],
  11: ["november", "nov"],
  12: ["december", "dec"],
};

const MONTH_KEYS = [
  null,
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function parseTimelineMonth(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;

  let m = text.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const month = Number(m[1]);
    return month >= 1 && month <= 12 ? month : null;
  }
  m = text.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (m) {
    const month = Number(m[2]);
    return month >= 1 && month <= 12 ? month : null;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20000 && serial < 60000) {
      const unix = Math.floor((serial - 25569) * 86400) * 1000;
      const month = new Date(unix).getUTCMonth() + 1;
      return month >= 1 && month <= 12 ? month : null;
    }
  }

  const lower = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [num, names] of Object.entries(MONTH_NAMES)) {
    for (const name of names) {
      if (new RegExp(`\\b${name}\\b`).test(lower)) {
        return Number(num);
      }
    }
  }

  return null;
}

export function monthToQuarter(month) {
  if (!month || month < 1 || month > 12) return 0;
  return Math.ceil(month / 3);
}

export function parsePpmpQuantity(item) {
  const qty = item?.quantity;
  if (qty != null && qty !== "" && Number(qty) > 0) {
    return Number(qty);
  }
  const text = String(item?.quantity_size || "").trim();
  if (!text) return 0;
  const m = text.match(/^\s*(\d+)\b/);
  return m ? Number(m[1]) : 0;
}

export function timelineMonthFromItem(item) {
  const candidates = [
    item?.proc_start,
    item?.delivery_period,
    item?.proc_end,
  ];
  for (const value of candidates) {
    for (const token of String(value || "").split(/\s*,\s*/)) {
      const month = parseTimelineMonth(token);
      if (month != null) return month;
    }
  }
  return null;
}

/** Empty month qty object keyed jan…dec. */
export function emptyMonthQty() {
  return {
    jan: 0,
    feb: 0,
    mar: 0,
    apr: 0,
    may: 0,
    jun: 0,
    jul: 0,
    aug: 0,
    sep: 0,
    oct: 0,
    nov: 0,
    dec: 0,
  };
}

/**
 * Place consolidated q1–q4 into the first month of each quarter
 * (Jan/Apr/Jul/Oct) for preview when only quarter totals are stored.
 */
export function monthQtyFromQuarters(row) {
  const months = emptyMonthQty();
  months.jan = Number(row?.q1_qty || 0);
  months.apr = Number(row?.q2_qty || 0);
  months.jul = Number(row?.q3_qty || 0);
  months.oct = Number(row?.q4_qty || 0);
  return months;
}

export function quartersFromMonthQty(months) {
  return {
    q1: Number(months.jan || 0) + Number(months.feb || 0) + Number(months.mar || 0),
    q2: Number(months.apr || 0) + Number(months.may || 0) + Number(months.jun || 0),
    q3: Number(months.jul || 0) + Number(months.aug || 0) + Number(months.sep || 0),
    q4: Number(months.oct || 0) + Number(months.nov || 0) + Number(months.dec || 0),
  };
}

export function addItemToMonthQty(months, item) {
  const qty = parsePpmpQuantity(item);
  const month = timelineMonthFromItem(item);
  if (!month || qty <= 0) return 0;
  const key = MONTH_KEYS[month];
  if (!key) return 0;
  months[key] = Number(months[key] || 0) + qty;
  return qty;
}
