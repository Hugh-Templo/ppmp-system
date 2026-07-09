function openSpreadsheetById(spreadsheetId) {
  return SpreadsheetApp.openById(spreadsheetId);
}

function readHeader(ss) {
  var sheet = ss.getSheetByName(CONFIG.TABS.HEADER);
  var row = sheet.getRange(2, 1, 2, 16).getValues()[0];
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

function readItems(ss) {
  var sheet = ss.getSheetByName(CONFIG.TABS.ITEMS);
  var data = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    items.push({
      row_id: data[i][0] || i,
      description: String(data[i][1]),
      category: String(data[i][2]),
      is_cse: data[i][3] === true || String(data[i][3]).toUpperCase() === 'TRUE',
      quantity: Number(data[i][4]) || 0,
      unit_of_measure: String(data[i][5]),
      unit_cost: Number(data[i][6]) || 0,
      estimated_budget: Number(data[i][7]) || 0,
      procurement_mode: String(data[i][8]),
      q1_qty: Number(data[i][9]) || 0,
      q2_qty: Number(data[i][10]) || 0,
      q3_qty: Number(data[i][11]) || 0,
      q4_qty: Number(data[i][12]) || 0
    });
  }
  return items;
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

function logAudit(ss, action, oldStatus, newStatus, remarks) {
  var sheet = ss.getSheetByName(CONFIG.TABS.AUDIT);
  sheet.appendRow([new Date(), getCurrentUserEmail(), action, oldStatus, newStatus, remarks || '']);
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

function listAllSubmissions() {
  var ss = SpreadsheetApp.openById(CONFIG.SUBMISSION_STATUS_ID);
  var sheet = ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var total = Number(data[i][6]) || 0;
    results.push({
      office_code: String(data[i][0]),
      office_name: String(data[i][1]),
      fiscal_year: Number(data[i][2]),
      spreadsheet_id: String(data[i][3]),
      status: String(data[i][4]),
      posting_status: String(data[i][5]),
      total_estimated_budget: total,
      submitted_at: data[i][7] ? String(data[i][7]) : '',
      reviewed_at: data[i][8] ? String(data[i][8]) : '',
      posted_at: data[i][9] ? String(data[i][9]) : '',
      remarks: String(data[i][10] || '')
    });
  }
  return results;
}

function getOfficePpmpDetail(officeCode) {
  var submissions = listAllSubmissions();
  var sub = submissions.filter(function(s) { return s.office_code === officeCode; })[0];
  if (!sub) throw new Error('Office not found: ' + officeCode);

  var ss = openSpreadsheetById(sub.spreadsheet_id);
  var header = readHeader(ss);
  var items = readItems(ss);
  var signatory = readSignatory(ss);
  var utilization = header.budget_allocation > 0
    ? (header.total_estimated_budget / header.budget_allocation * 100) : 0;

  return {
    submission: sub,
    header: header,
    items: items,
    signatory: signatory,
    audit: {
      total: header.total_estimated_budget,
      allocation: header.budget_allocation,
      utilization_pct: utilization,
      over_budget: header.total_estimated_budget > header.budget_allocation
    }
  };
}
