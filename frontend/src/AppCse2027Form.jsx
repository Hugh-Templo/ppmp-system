import React, { useMemo } from "react";
import catalogData from "./data/appCse2027Catalog.json";
import {
  emptyMonthQty,
  monthQtyFromQuarters,
  quartersFromMonthQty,
} from "./cseQtyHelpers";

const INTRODUCTION =
  "This form contains the common-use supplies and equipment (CSE) being carried by the Procurement Service – Department of Budget and Management (PS-DBM) that shall be purchased by government agencies. Consistent with the guidelines in DBM Circulars, GPPB Resolutions, and Republic Act No. 12009 or the New Government Procurement Act (NGPA), the APP-CSE shall serve as the agency’s annual procurement request for all its CSE requirements. Only agencies with uploaded APP-CSE in the Modernized Philippine Government Electronic Procurement System (mPhilGEPS) will be able to purchase CSE from the PS-DBM. Note that the items listed on this form have been arranged in accordance with the United Nations Standard Products and Services Code (UNSPSC)";

const REMINDERS = [
  "The APP-CSE form must be accomplished using Microsoft Excel format. The APP-CSE shall be deemed incorrect or invalid if the form used is other than the prescribed format which is downloadable from the mPhilGEPS and Downloads page of PS-DBM website (www.ps-philgeps.gov.ph).",
  "All information must be provided accurately.",
  'Kindly refer to the CSE catalogue on the PS-DBM website (www.ps-philgeps.gov.ph) under the "What We Sell" tab for the detailed technical specifications and sample photo of the items.',
  "Do not delete, add, or revise any items or rows on this form, otherwise the form will be deemed invalid.",
  "For items not included on the list of PART II, a separate form with the file name APP-CSE 2027 Form - Other Items, can be fill-out through this link: https://forms.gle/TTh7U282G72P1ArE9",
  "Once signed and approved by the Property/Supply Officer, Accountant/Budget Officer, and Head of the Agency/Office, kindly upload the soft copy of the APP-CSE in Microsoft Excel format as well as the original signed copy in Portable Document Format (PDF) to the agency's mPhilGEPS account on or before the prescribed period or deadline. Any APP-CSE form that is unsigned or has incomplete signature shall be deemed invalid.",
  "Should there be changes in the agency’s CSE requirements, the agency may edit their uploaded APP-CSE directly on their mPhilGEPS account. However, the agency must ensure that a signed and approved copy of the supplemental APP-CSE form is available. Note that all CSE requirements in excess of the quantities indicated in the original APP-CSE form will not be served if not covered by a supplemental APP-CSE.",
  "Please be advised that modifications of product codes may be implemented in the system without prior notification. Should such changes occur, it will be necessary for agencies with CSE requirements to edit and submit a Supplemental APP-CSE on their mPhilGEPS account.",
  "For further assistance or clarification, agencies may contact the Marketing and Sales Division of PS-DBM through its mobile numbers 0918-2954426, 0962-8255199, 0931-1037867, 0931-1037869, or email psclient@ps-philgeps.gov.ph or visit the PS-DBM website (www.ps-philgeps.gov.ph) for the guide on how to fill-out the APP-CSE.",
];

const NOTE =
  "Note: The APP-CSE for FY 2027 must be submitted on or before 31 August 2026.";

const PART_II_NOTE =
  "Consistent with Section 4.4 of Circular Letter No. 2011-6 and 2011-6, all agencies and concerned units are enjoined to include in the APP-CSE all supplies, commodities or materials and equipment which are consumed and needed in their day-to-day operations. This shall be one of the bases for the PS-DBM in expanding the Electronic Catalogue to include other products commonly purchased by government entities.";

const MONTH_COLS = [
  { key: "jan", label: "Jan", quarter: "q1" },
  { key: "feb", label: "Feb", quarter: "q1" },
  { key: "mar", label: "Mar", quarter: "q1" },
  { key: "q1", label: "Q1", isTotal: true },
  { key: "q1Amt", label: "Q1 AMOUNT", isAmount: true },
  { key: "apr", label: "April", quarter: "q2" },
  { key: "may", label: "May", quarter: "q2" },
  { key: "jun", label: "June", quarter: "q2" },
  { key: "q2", label: "Q2", isTotal: true },
  { key: "q2Amt", label: "Q2 AMOUNT", isAmount: true },
  { key: "jul", label: "July", quarter: "q3" },
  { key: "aug", label: "Aug", quarter: "q3" },
  { key: "sep", label: "Sept", quarter: "q3" },
  { key: "q3", label: "Q3", isTotal: true },
  { key: "q3Amt", label: "Q3 AMOUNT", isAmount: true },
  { key: "oct", label: "Oct", quarter: "q4" },
  { key: "nov", label: "Nov", quarter: "q4" },
  { key: "dec", label: "Dec", quarter: "q4" },
  { key: "q4", label: "Q4", isTotal: true },
  { key: "q4Amt", label: "Q4 AMOUNT", isAmount: true },
];

export function normalizeCseKey(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function qtyCell(value) {
  const n = Number(value || 0);
  return n ? n.toLocaleString() : "";
}

function matchCatalogItem(row, items, descIndex, codeIndex, rowIndex) {
  // Prefer stable keys from buildCsePreviewRows (catalog_row / code).
  const catalogRow = Number(row?.catalog_row || 0);
  if (catalogRow > 0 && rowIndex.has(catalogRow)) {
    return rowIndex.get(catalogRow);
  }

  const codeKey = normalizeCseKey(row?.code);
  if (codeKey && codeIndex.get(codeKey)?.length === 1) {
    return codeIndex.get(codeKey)[0];
  }

  const descKey = normalizeCseKey(row?.description);
  if (!descKey) return null;
  if (descIndex.get(descKey)?.length === 1) return descIndex.get(descKey)[0];
  if (codeIndex.get(descKey)?.length === 1) return codeIndex.get(descKey)[0];

  const hits = [];
  for (const item of items) {
    if (item.descKey === descKey || item.codeKey === descKey) {
      hits.push(item);
      continue;
    }
    if (
      item.descKey &&
      (descKey.includes(item.descKey) || item.descKey.includes(descKey))
    ) {
      hits.push(item);
    }
  }
  return hits.length === 1 ? hits[0] : null;
}

function buildFilledCatalog(rows) {
  const entries = catalogData.entries || [];
  const items = entries
    .filter((e) => e.type === "item")
    .map((e) => ({
      ...e,
      descKey: normalizeCseKey(e.description),
      codeKey: normalizeCseKey(e.code),
    }));
  const descIndex = new Map();
  const codeIndex = new Map();
  const rowIndex = new Map();
  items.forEach((item) => {
    rowIndex.set(Number(item.row), item);
    if (!descIndex.has(item.descKey)) descIndex.set(item.descKey, []);
    descIndex.get(item.descKey).push(item);
    if (!codeIndex.has(item.codeKey)) codeIndex.set(item.codeKey, []);
    codeIndex.get(item.codeKey).push(item);
  });

  const qtyByRow = new Map();

  (rows || []).forEach((row) => {
    const match = matchCatalogItem(row, items, descIndex, codeIndex, rowIndex);
    // Stock APP-CSE catalog only — skip anything that is not a catalog item.
    if (!match) return;

    // Preview uses consolidated q1–q4 (placed in Jan/Apr/Jul/Oct for display).
    // Excel export writes true monthly cells on the full template copy.
    const months = monthQtyFromQuarters(row);
    const qty = quartersFromMonthQty(months);
    const prev = qtyByRow.get(match.row) || {
      item: match,
      months: emptyMonthQty(),
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0,
      budget: 0,
      unitCost: null,
      offices: new Set(),
    };
    Object.keys(months).forEach((k) => {
      prev.months[k] = Number(prev.months[k] || 0) + Number(months[k] || 0);
    });
    prev.q1 += qty.q1;
    prev.q2 += qty.q2;
    prev.q3 += qty.q3;
    prev.q4 += qty.q4;
    prev.budget += Number(row.total_estimated_budget || 0);
    if (prev.unitCost == null && row.unit_cost) prev.unitCost = Number(row.unit_cost);
    if (row.end_user_offices) {
      String(row.end_user_offices)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((office) => prev.offices.add(office));
    }
    qtyByRow.set(match.row, prev);
  });

  const displayEntries = [];
  let pendingPart = null;
  let pendingCategory = null;

  const flushItem = (entry, filled) => {
    if (pendingPart) {
      displayEntries.push(pendingPart);
      pendingPart = null;
    }
    if (pendingCategory) {
      displayEntries.push(pendingCategory);
      pendingCategory = null;
    }
    const unitPrice = filled.item.unit_price || filled.unitCost || 0;
    const m = filled.months || emptyMonthQty();
    const q1 = filled.q1;
    const q2 = filled.q2;
    const q3 = filled.q3;
    const q4 = filled.q4;
    const yearQty = q1 + q2 + q3 + q4;
    const yearAmt = yearQty * unitPrice || filled.budget || 0;
    displayEntries.push({
      type: "item",
      ...entry,
      jan: m.jan,
      feb: m.feb,
      mar: m.mar,
      apr: m.apr,
      may: m.may,
      jun: m.jun,
      jul: m.jul,
      aug: m.aug,
      sep: m.sep,
      oct: m.oct,
      nov: m.nov,
      dec: m.dec,
      q1,
      q2,
      q3,
      q4,
      q1Amt: q1 * unitPrice,
      q2Amt: q2 * unitPrice,
      q3Amt: q3 * unitPrice,
      q4Amt: q4 * unitPrice,
      yearQty,
      unitPrice,
      yearAmt,
      offices: Array.from(filled.offices),
      filled: true,
    });
  };

  // On-screen: filled catalog items only (empty SKUs stay in the Excel download).
  entries.forEach((entry) => {
    if (entry.type === "part") {
      pendingPart = entry;
      pendingCategory = null;
      return;
    }
    if (entry.type === "category") {
      pendingCategory = entry;
      return;
    }
    const filled = qtyByRow.get(entry.row);
    const filledQty = filled ? filled.q1 + filled.q2 + filled.q3 + filled.q4 : 0;
    if (filled && (filledQty > 0 || filled.budget > 0)) {
      flushItem(entry, filled);
    }
  });

  const partITotal = displayEntries
    .filter((e) => e.type === "item" && e.part === "I")
    .reduce((sum, e) => sum + e.yearAmt, 0);
  const partIITotal = displayEntries
    .filter((e) => e.type === "item" && e.part === "II")
    .reduce((sum, e) => sum + e.yearAmt, 0);

  return {
    displayEntries,
    partITotal,
    partIITotal,
    filledCount: displayEntries.filter((e) => e.type === "item").length,
  };
}

function TotalsBlock({ partLabel, total }) {
  const priceChanges = total * 0.1;
  const grand = total + priceChanges;
  return (
    <>
      <tr className="app-cse-2027__part-row">
        <td colSpan={27}>{partLabel}</td>
      </tr>
      <tr className="app-cse-2027__total-row">
        <td colSpan={3}>A. TOTAL</td>
        <td colSpan={21}></td>
        <td className="app-cse-2027__amount" colSpan={3}>
          {money(total)}
        </td>
      </tr>
      <tr className="app-cse-2027__total-row">
        <td colSpan={3}>B. ADDITIONAL PROVISION FOR PRICE CHANGES (10% of TOTAL)</td>
        <td colSpan={21}></td>
        <td className="app-cse-2027__amount" colSpan={3}>
          {money(priceChanges)}
        </td>
      </tr>
      <tr className="app-cse-2027__total-row">
        <td colSpan={3}>C. ADDITIONAL PROVISION FOR TRANSPORT AND FREIGHT COST (If Applicable)</td>
        <td colSpan={21}></td>
        <td className="app-cse-2027__amount" colSpan={3}>
          {money(0)}
        </td>
      </tr>
      <tr className="app-cse-2027__total-row">
        <td colSpan={3}>D. GRAND TOTAL (A + B+ C)</td>
        <td colSpan={21}></td>
        <td className="app-cse-2027__amount" colSpan={3}>
          {money(grand)}
        </td>
      </tr>
      <tr className="app-cse-2027__total-row">
        <td colSpan={3}>E. APPROVED BUDGET BY THE AGENCY HEAD In Figures and Words:</td>
        <td colSpan={24}></td>
      </tr>
    </>
  );
}

export default function AppCse2027Form({
  rows = [],
  fiscalYear,
  preparedBy = "",
  preparedDesig = "",
  certifiedBy = "",
  certifiedDesig = "",
  approvedBy = "",
  approvedDesig = "",
}) {
  const view = useMemo(() => buildFilledCatalog(rows), [rows]);
  const {
    displayEntries,
    partITotal,
    partIITotal,
    filledCount,
  } = view;

  return (
    <div className="app-cse-2027" role="document" aria-label="APP-CSE 2027 Form">
      <div className="app-cse-2027__banner">APP-CSE 2027 FORM</div>
      <h1 className="app-cse-2027__title">
        ANNUAL PROCUREMENT PLAN - COMMOM-USE SUPPLIES AND EQUIPMENT (APP-CSE){" "}
        {fiscalYear || 2027} FORM
      </h1>

      <section className="app-cse-2027__intro">
        <h2>Introduction:</h2>
        <p>{INTRODUCTION}</p>
      </section>

      <section className="app-cse-2027__reminders">
        <h2>Reminders:</h2>
        <ol>
          {REMINDERS.map((text, idx) => (
            <li key={idx}>{text}</li>
          ))}
        </ol>
      </section>

      <p className="app-cse-2027__note">{NOTE}</p>

      <div className="app-cse-2027__agency">
        <div>
          <span>Department/Bureau/Office:</span>
          <strong>Ormoc City Government</strong>
        </div>
        <div>
          <span>Agency Code/UACS:</span>
          <strong></strong>
        </div>
        <div>
          <span>Contact Person:</span>
          <strong>{preparedBy}</strong>
        </div>
        <div>
          <span>Region:</span>
          <strong>VIII</strong>
        </div>
        <div>
          <span>Organization Type:</span>
          <strong>LGU</strong>
        </div>
        <div>
          <span>Position:</span>
          <strong>{preparedDesig}</strong>
        </div>
        <div>
          <span>Address:</span>
          <strong>Ormoc City, Leyte</strong>
        </div>
        <div>
          <span>E-mail:</span>
          <strong></strong>
        </div>
        <div>
          <span>Telephone/Mobile Nos:</span>
          <strong></strong>
        </div>
      </div>

      <div className="app-cse-2027__table-wrap">
        <table className="app-cse-2027-table">
          <thead>
            <tr>
              <th rowSpan={2} colSpan={3} className="app-cse-2027-table__head">
                Item &amp; Specifications
              </th>
              <th rowSpan={2} className="app-cse-2027-table__head">
                Unit of Measure
              </th>
              <th colSpan={20} className="app-cse-2027-table__head">
                Monthly Quantity Requirement
              </th>
              <th rowSpan={2} className="app-cse-2027-table__head">
                Total Quantity for the year
              </th>
              <th rowSpan={2} className="app-cse-2027-table__head">
                Unit Price as of April 27, 2026
              </th>
              <th rowSpan={2} className="app-cse-2027-table__head">
                Total Amount for the year
              </th>
            </tr>
            <tr>
              {MONTH_COLS.map((col) => (
                <th
                  key={col.key}
                  className={
                    col.isTotal || col.isAmount
                      ? "app-cse-2027-table__head"
                      : "app-cse-2027-table__month"
                  }
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayEntries.length === 0 ? (
              <tr>
                <td colSpan={27} className="app-cse-2027__empty">
                  No CSE catalog quantities to show yet. Verify CSE PPMPs with
                  Budget so item quantities can fill this APP-CSE form.
                </td>
              </tr>
            ) : null}

            {displayEntries.map((entry, idx) => {
              if (entry.type === "part") {
                return (
                  <tr key={`part-${entry.row}-${idx}`} className="app-cse-2027__part-row">
                    <td colSpan={27}>{entry.label}</td>
                  </tr>
                );
              }
              if (entry.type === "category") {
                return (
                  <tr key={`cat-${entry.row}-${idx}`} className="app-cse-2027__cat-row">
                    <td colSpan={27}>{entry.label}</td>
                  </tr>
                );
              }
              return (
                <tr key={`item-${entry.row}`} className="app-cse-2027__item-row">
                  <td className="app-cse-2027__center">{entry.no}</td>
                  <td>{entry.code}</td>
                  <td>
                    {entry.description}
                    {entry.offices?.length ? (
                      <span className="app-cse-2027__offices">
                        {entry.offices.join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="app-cse-2027__center">{entry.uom}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.jan)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.feb)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.mar)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.q1)}</td>
                  <td className="app-cse-2027__amount">{entry.q1 ? money(entry.q1Amt) : ""}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.apr)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.may)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.jun)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.q2)}</td>
                  <td className="app-cse-2027__amount">{entry.q2 ? money(entry.q2Amt) : ""}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.jul)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.aug)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.sep)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.q3)}</td>
                  <td className="app-cse-2027__amount">{entry.q3 ? money(entry.q3Amt) : ""}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.oct)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.nov)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.dec)}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.q4)}</td>
                  <td className="app-cse-2027__amount">{entry.q4 ? money(entry.q4Amt) : ""}</td>
                  <td className="app-cse-2027__center">{qtyCell(entry.yearQty)}</td>
                  <td className="app-cse-2027__amount">{money(entry.unitPrice)}</td>
                  <td className="app-cse-2027__amount">{money(entry.yearAmt)}</td>
                </tr>
              );
            })}

            {filledCount > 0 ? (
              <>
                <TotalsBlock
                  partLabel="PART I. AVAILABLE AT PS-DBM (MAIN WAREHOUSE AND DEPOTS)"
                  total={partITotal}
                />
                <tr className="app-cse-2027__part-row">
                  <td colSpan={27}>
                    PART II. OTHER ITEMS NOT AVAILABLE AT PS-DBM BUT ARE REGULARLY
                    PURCHASED FROM OTHER SOURCES
                  </td>
                </tr>
                <tr className="app-cse-2027__part-row app-cse-2027__part-note">
                  <td colSpan={27}>{PART_II_NOTE}</td>
                </tr>
                <TotalsBlock
                  partLabel="PART II. OTHER ITEMS NOT AVAILABLE AT PS-DBM BUT ARE REGULARLY PURCHASED FROM OTHER SOURCES"
                  total={partIITotal}
                />
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="app-cse-2027__warrant">
        We hereby warrant that the total amount reflected in this Annual
        Procurement Plan to procure the listed common-use supplies, materials,
        and equipment has been included in or is within our approved budget for
        the year.
      </p>

      <div className="app-cse-2027__signatories">
        <div>
          <div className="app-cse-2027__sig-role">Prepared by:</div>
          <div className="app-cse-2027__sig-line">
            {preparedBy || "Signature over Printed Name"}
          </div>
          <div className="app-cse-2027__sig-caption">
            {preparedDesig || "Property/Supply Officer"}
          </div>
          <div className="app-cse-2027__sig-date">Date Prepared: _________________</div>
        </div>
        <div>
          <div className="app-cse-2027__sig-role">
            Certified Funds Available / Certified Appropriate Funds Available:
          </div>
          <div className="app-cse-2027__sig-line">
            {certifiedBy || "Signature over Printed Name"}
          </div>
          <div className="app-cse-2027__sig-caption">
            {certifiedDesig || "Accountant / Budget Officer"}
          </div>
        </div>
        <div>
          <div className="app-cse-2027__sig-role">Approved by:</div>
          <div className="app-cse-2027__sig-line">
            {approvedBy || "Signature over Printed Name"}
          </div>
          <div className="app-cse-2027__sig-caption">
            {approvedDesig || "Head of Office/Agency"}
          </div>
        </div>
      </div>
    </div>
  );
}
