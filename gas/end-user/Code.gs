function doGet() {
  return HtmlService.createTemplateFromFile('EndUser')
    .evaluate()
    .setTitle('Indicative PPMP — End User')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDashboardData() {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  var items = readItems(ss);
  var signatory = readSignatory(ss);
  var total = recalcTotalBudget_(ss);
  header.total_estimated_budget = total;

  return {
    office: office,
    header: header,
    items: items,
    signatory: signatory,
    can_edit: canEndUserEdit(header),
    lock_reason: getEditLockReason(header),
    categories: CONFIG.CATEGORIES,
    procurement_modes: CONFIG.PROCUREMENT_MODES
  };
}

function addItem(item) {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  assertEditable(header);

  var sheet = ss.getSheetByName(CONFIG.TABS.ITEMS);
  var nextRow = Math.max(sheet.getLastRow(), 1) + 1;
  var rowId = nextRow - 1;
  var qty = Number(item.quantity) || 0;
  var unitCost = Number(item.unit_cost) || 0;
  var estimated = qty * unitCost;

  sheet.getRange(nextRow, 1, 1, 14).setValues([[
    rowId,
    item.description,
    item.category || CONFIG.CATEGORIES[0],
    item.is_cse ? 'TRUE' : 'FALSE',
    qty,
    item.unit_of_measure || 'pc',
    unitCost,
    estimated,
    item.procurement_mode || CONFIG.PROCUREMENT_MODES[0],
    Number(item.q1_qty) || 0,
    Number(item.q2_qty) || 0,
    Number(item.q3_qty) || 0,
    Number(item.q4_qty) || 0,
    'FALSE'
  ]]);

  var total = recalcTotalBudget_(ss);
  updateSubmissionStatus(office.office_code, { total_estimated_budget: total });
  return getDashboardData();
}

function updateItem(rowId, item) {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  assertEditable(header);

  var sheet = ss.getSheetByName(CONFIG.TABS.ITEMS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === Number(rowId)) {
      var qty = Number(item.quantity) || 0;
      var unitCost = Number(item.unit_cost) || 0;
      sheet.getRange(i + 1, 2, 1, 12).setValues([[
        item.description,
        item.category,
        item.is_cse ? 'TRUE' : 'FALSE',
        qty,
        item.unit_of_measure,
        unitCost,
        qty * unitCost,
        item.procurement_mode,
        Number(item.q1_qty) || 0,
        Number(item.q2_qty) || 0,
        Number(item.q3_qty) || 0,
        Number(item.q4_qty) || 0
      ]]);
      break;
    }
  }

  var total = recalcTotalBudget_(ss);
  updateSubmissionStatus(office.office_code, { total_estimated_budget: total });
  return getDashboardData();
}

function deleteItem(rowId) {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  assertEditable(header);

  var sheet = ss.getSheetByName(CONFIG.TABS.ITEMS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === Number(rowId)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }

  var total = recalcTotalBudget_(ss);
  updateSubmissionStatus(office.office_code, { total_estimated_budget: total });
  return getDashboardData();
}

function saveSignatory(signatory) {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  assertEditable(header);
  writeSignatory(ss, signatory);
  return getDashboardData();
}

function submitPpmp() {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  assertEditable(header);

  if (readItems(ss).length === 0) {
    throw new Error('Add at least one line item before submitting.');
  }

  var oldStatus = setHeaderStatus(ss, office.office_code, 'Pending Budget Review');
  var headerSheet = ss.getSheetByName(CONFIG.TABS.HEADER);
  headerSheet.getRange(2, 13).setValue(new Date());
  applySheetProtection(ss, true);
  logAudit(ss, 'SUBMIT', oldStatus, 'Pending Budget Review', '');

  var total = recalcTotalBudget_(ss);
  updateSubmissionStatus(office.office_code, {
    status: 'Pending Budget Review',
    total_estimated_budget: total,
    submitted_at: new Date()
  });

  return getDashboardData();
}
