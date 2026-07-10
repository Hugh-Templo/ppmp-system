/**
 * Creates the per-office spreadsheet template aligned with NGPA_PPMP.xlsx.
 *
 * Tabs (in order):
 *   1. PPMP_Header       — office, status, totals, locks
 *   2. Items_CSE         — structured 14 columns for CSE items (web app writes here)
 *   3. Items_nonCSE      — structured 14 columns for non-CSE items
 *   4. PPMP_CSE_Form     — printable NGPA_PPMP layout, formulas from Items_CSE
 *   5. PPMP_nonCSE_Form  — printable NGPA_PPMP layout, formulas from Items_nonCSE
 *   6. Signatory
 *   7. Audit_Log
 */
function createOfficeSpreadsheet(
  officeCode,
  officeName,
  fiscalYear,
  budgetAllocation,
) {
  var title = officeCode + "_Indicative_PPMP_" + fiscalYear;
  var ss = SpreadsheetApp.create(title);
  var file = DriveApp.getFileById(ss.getId());

  var masterFolder = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);
  var yearFolderName = String(fiscalYear);
  var yearFolders = masterFolder.getFoldersByName(yearFolderName);
  var yearFolder = yearFolders.hasNext()
    ? yearFolders.next()
    : masterFolder.createFolder(yearFolderName);
  yearFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  setupHeaderTab_(ss, officeCode, officeName, fiscalYear, budgetAllocation);
  setupItemsTab_(ss, CONFIG.TABS.ITEMS_CSE);
  setupItemsTab_(ss, CONFIG.TABS.ITEMS_NONCSE);
  setupFormTab_(
    ss,
    CONFIG.TABS.FORM_CSE,
    CONFIG.TABS.ITEMS_CSE,
    officeName,
    fiscalYear,
    "CSE",
  );
  setupFormTab_(
    ss,
    CONFIG.TABS.FORM_NONCSE,
    CONFIG.TABS.ITEMS_NONCSE,
    officeName,
    fiscalYear,
    "Non-CSE",
  );
  setupSignatoryTab_(ss);
  setupAuditTab_(ss);

  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === "Sheet1" && ss.getSheets().length > 7) {
      ss.deleteSheet(sheets[i]);
      break;
    }
  }

  return ss;
}

function setupHeaderTab_(
  ss,
  officeCode,
  officeName,
  fiscalYear,
  budgetAllocation,
) {
  var sheet = ss.getSheets()[0].setName(CONFIG.TABS.HEADER);
  var headers = [
    "office_code",
    "office_name",
    "fiscal_year",
    "title",
    "type",
    "status",
    "posting_status",
    "budget_allocation",
    "total_estimated_budget",
    "remarks",
    "is_editable",
    "edit_lock_reason",
    "submitted_at",
    "reviewed_at",
    "posted_at",
    "spreadsheet_id",
  ];
  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold");
  sheet
    .getRange(2, 1, 1, headers.length)
    .setValues([
      [
        officeCode,
        officeName,
        fiscalYear,
        "Indicative PPMP " + fiscalYear,
        "Indicative",
        "Draft",
        "Draft",
        budgetAllocation,
        0,
        "",
        true,
        "",
        "",
        "",
        "",
        ss.getId(),
      ],
    ]);
  sheet.setFrozenRows(1);
}

/**
 * Structured items tab (14 columns matching NGPA_PPMP layout).
 */
function setupItemsTab_(ss, tabName) {
  var sheet = ss.insertSheet(tabName);
  var headers = [
    "row_id", // A
    "description", // B - NGPA Col 1
    "project_type", // C - NGPA Col 2
    "quantity_size", // D - NGPA Col 3
    "procurement_mode", // E - NGPA Col 4
    "pre_proc_conf", // F - NGPA Col 5
    "proc_start", // G - NGPA Col 6 (MM/YYYY)
    "proc_end", // H - NGPA Col 7
    "delivery_period", // I - NGPA Col 8
    "fund_source", // J - NGPA Col 9
    "estimated_budget", // K - NGPA Col 10
    "supporting_docs", // L - NGPA Col 11
    "remarks", // M - NGPA Col 12
    "locked", // N
  ];
  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold");
  sheet.setFrozenRows(1);
}

/**
 * Printable NGPA_PPMP-style form tab.
 * Uses ARRAYFORMULA to mirror rows from the structured items tab so end users
 * never edit this tab directly; it stays in sync automatically.
 */
function setupFormTab_(ss, formTab, itemsTab, officeName, fiscalYear, kind) {
  var sheet = ss.insertSheet(formTab);

  sheet.getRange("A1").setValue("[Agency Letterhead / Logo]");
  sheet
    .getRange("A2")
    .setValue("PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) — " + kind)
    .setFontWeight("bold")
    .setFontSize(12);
  sheet.getRange("A3").setValue("INDICATIVE");
  sheet.getRange("A4").setValue("Fiscal Year: " + fiscalYear);
  sheet.getRange("A5").setValue("End-User / Implementing Unit: " + officeName);

  var headers = [
    "General Description and Objective",
    "Type of Project",
    "Quantity and Size",
    "Recommended Mode of Procurement",
    "Pre-Procurement Conference (Yes/No)",
    "Start of Procurement Activity (MM/YYYY)",
    "End of Procurement Activity (MM/YYYY)",
    "Expected Delivery / Implementation Period",
    "Source of Funds",
    "Estimated Budget / ABC (PhP)",
    "Attached Supporting Documents",
    "Remarks",
  ];
  sheet
    .getRange(7, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold")
    .setWrap(true)
    .setBackground("#e8f5e9");
  sheet.setFrozenRows(7);

  // ARRAYFORMULA pulls description...remarks (columns B..M of items tab) into columns A..L here,
  // for every row where description is non-empty.
  var formula =
    "=IFERROR(FILTER(" + itemsTab + "!B2:M, " + itemsTab + '!B2:B<>""), "")';
  sheet.getRange("A8").setFormula(formula);

  // Numeric format for estimated_budget column (col J = 10th)
  sheet.getRange(8, 10, 500, 1).setNumberFormat("#,##0.00");

  var widths = [280, 160, 200, 200, 120, 140, 140, 180, 180, 140, 200, 240];
  for (var i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i]);
  }
}

function setupSignatoryTab_(ss) {
  var sheet = ss.insertSheet(CONFIG.TABS.SIGNATORY);
  var labels = [
    ["Field", "Value"],
    ["submitted_by", ""],
    ["submitted_by_designation", ""],
    ["prepared_by", ""],
    ["prepared_by_designation", ""],
    ["aip_reference", ""],
    ["responsibility_center_no", ""],
    ["office_code_from_pr", ""],
  ];
  sheet.getRange(1, 1, labels.length, 2).setValues(labels);
  sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
}

function setupAuditTab_(ss) {
  var sheet = ss.insertSheet(CONFIG.TABS.AUDIT);
  var headers = [
    "timestamp",
    "actor_email",
    "action",
    "old_status",
    "new_status",
    "remarks",
  ];
  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold");
  sheet.setFrozenRows(1);
}
