function getOfficeSpreadsheetId(officeCode) {
  var ss = SpreadsheetApp.openById(CONFIG.SUBMISSION_STATUS_ID);
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === officeCode && Number(data[i][2]) === CONFIG.FISCAL_YEAR) {
      return String(data[i][3]);
    }
  }
  throw new Error('No PPMP spreadsheet found for ' + officeCode + ' FY ' + CONFIG.FISCAL_YEAR);
}

function openOfficeSpreadsheet(officeCode) {
  return SpreadsheetApp.openById(getOfficeSpreadsheetId(officeCode));
}

function readHeader(ss) {
  var sheet = ss.getSheetByName(CONFIG.TABS.HEADER);
  var row = sheet.getRange(2, 1, 1, 16).getValues()[0];
  return {
    office_code: String(row[0]),
    office_name: String(row[1]),
    fiscal_year: Number(row[2]),
    title: String(row[3]),
    type: String(row[4]),
    status: String(row[5]),
    posting_status: String(row[6]),
    budget_allocation: Number(row[7]) || 0,
    total_estimated_budget: Number(row[8]) || 0,
    remarks: String(row[9] || ''),
    is_editable: row[10] === true || row[10] === 'TRUE',
    edit_lock_reason: String(row[11] || ''),
    submitted_at: row[12] ? String(row[12]) : '',
    reviewed_at: row[13] ? String(row[13]) : '',
    posted_at: row[14] ? String(row[14]) : '',
    spreadsheet_id: String(row[15] || ss.getId())
  };
}

/**
 * Returns items from either Items_CSE or Items_nonCSE.
 * Columns follow the 14-column NGPA-aligned layout in SheetTemplate.gs.
 */
function readItems(ss, isCse) {
  var tabName = isCse ? CONFIG.TABS.ITEMS_CSE : CONFIG.TABS.ITEMS_NONCSE;
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    items.push({
      row_id: data[i][0] || i,
      description: String(data[i][1]),
      project_type: String(data[i][2] || ''),
      quantity_size: String(data[i][3] || ''),
      procurement_mode: String(data[i][4] || ''),
      pre_proc_conf: data[i][5] === true || String(data[i][5]).toUpperCase() === 'TRUE' || String(data[i][5]).toUpperCase() === 'YES',
      proc_start: String(data[i][6] || ''),
      proc_end: String(data[i][7] || ''),
      delivery_period: String(data[i][8] || ''),
      fund_source: String(data[i][9] || ''),
      estimated_budget: Number(data[i][10]) || 0,
      supporting_docs: String(data[i][11] || ''),
      remarks: String(data[i][12] || ''),
      locked: data[i][13] === true || String(data[i][13]).toUpperCase() === 'TRUE',
      is_cse: !!isCse
    });
  }
  return items;
}

function readAllItems(ss) {
  return {
    cse: readItems(ss, true),
    non_cse: readItems(ss, false)
  };
}

function readSignatory(ss) {
  var sheet = ss.getSheetByName(CONFIG.TABS.SIGNATORY);
  var data = sheet.getDataRange().getValues();
  var result = {};
  for (var i = 1; i < data.length; i++) {
    result[String(data[i][0])] = String(data[i][1] || '');
  }
  return result;
}

function writeSignatory(ss, signatory) {
  var sheet = ss.getSheetByName(CONFIG.TABS.SIGNATORY);
  var fields = [
    'submitted_by', 'submitted_by_designation', 'prepared_by',
    'prepared_by_designation', 'aip_reference', 'responsibility_center_no', 'office_code_from_pr'
  ];
  fields.forEach(function(field, idx) {
    if (signatory[field] !== undefined) {
      sheet.getRange(idx + 2, 2).setValue(signatory[field]);
    }
  });
}

function recalcTotalBudget_(ss) {
  var all = readAllItems(ss);
  var total = 0;
  ['cse', 'non_cse'].forEach(function(k) {
    all[k].forEach(function(item) { total += (item.estimated_budget || 0); });
  });
  ss.getSheetByName(CONFIG.TABS.HEADER).getRange(2, 9).setValue(total);
  return total;
}

function logAudit(ss, action, oldStatus, newStatus, remarks) {
  var sheet = ss.getSheetByName(CONFIG.TABS.AUDIT);
  sheet.appendRow([
    new Date(), getCurrentUserEmail(), action, oldStatus, newStatus, remarks || ''
  ]);
}

function updateSubmissionStatus(officeCode, fields) {
  var ss = SpreadsheetApp.openById(CONFIG.SUBMISSION_STATUS_ID);
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === officeCode && Number(data[i][2]) === CONFIG.FISCAL_YEAR) {
      if (fields.status !== undefined) sheet.getRange(i + 1, 5).setValue(fields.status);
      if (fields.posting_status !== undefined) sheet.getRange(i + 1, 6).setValue(fields.posting_status);
      if (fields.total_estimated_budget !== undefined) sheet.getRange(i + 1, 7).setValue(fields.total_estimated_budget);
      if (fields.submitted_at !== undefined) sheet.getRange(i + 1, 8).setValue(fields.submitted_at);
      if (fields.reviewed_at !== undefined) sheet.getRange(i + 1, 9).setValue(fields.reviewed_at);
      if (fields.posted_at !== undefined) sheet.getRange(i + 1, 10).setValue(fields.posted_at);
      if (fields.remarks !== undefined) sheet.getRange(i + 1, 11).setValue(fields.remarks);
      return;
    }
  }
}

function setHeaderStatus(ss, officeCode, newStatus, remarks) {
  var headerSheet = ss.getSheetByName(CONFIG.TABS.HEADER);
  var header = readHeader(ss);
  var oldStatus = header.status;
  headerSheet.getRange(2, 6).setValue(newStatus);
  if (remarks !== undefined) headerSheet.getRange(2, 10).setValue(remarks);
  header.status = newStatus;
  if (remarks !== undefined) header.remarks = remarks;
  updateHeaderEditState_(headerSheet, header);
  return oldStatus;
}
