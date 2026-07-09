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
  var itemsByKind = readAllItems(ss);
  var signatory = readSignatory(ss);
  var total = recalcTotalBudget_(ss);
  header.total_estimated_budget = total;

  return {
    office: office,
    header: header,
    items_cse: itemsByKind.cse,
    items_non_cse: itemsByKind.non_cse,
    signatory: signatory,
    can_edit: canEndUserEdit(header),
    lock_reason: getEditLockReason(header),
    project_types: CONFIG.PROJECT_TYPES,
    procurement_modes: CONFIG.PROCUREMENT_MODES,
    fund_sources: CONFIG.FUND_SOURCES
  };
}

function _tabForKind(isCse) {
  return isCse ? CONFIG.TABS.ITEMS_CSE : CONFIG.TABS.ITEMS_NONCSE;
}

function _itemRow(item) {
  return [
    item.description || '',
    item.project_type || '',
    item.quantity_size || '',
    item.procurement_mode || '',
    item.pre_proc_conf ? 'Yes' : 'No',
    item.proc_start || '',
    item.proc_end || '',
    item.delivery_period || '',
    item.fund_source || '',
    Number(item.estimated_budget) || 0,
    item.supporting_docs || '',
    item.remarks || ''
  ];
}

function addItem(item) {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  assertEditable(header);

  var isCse = !!item.is_cse;
  var sheet = ss.getSheetByName(_tabForKind(isCse));
  var nextRow = Math.max(sheet.getLastRow(), 1) + 1;
  var rowId = nextRow - 1;

  var rowData = [rowId].concat(_itemRow(item)).concat(['FALSE']);
  sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

  var total = recalcTotalBudget_(ss);
  updateSubmissionStatus(office.office_code, { total_estimated_budget: total });
  return getDashboardData();
}

function updateItem(rowId, item) {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  assertEditable(header);

  var isCse = !!item.is_cse;
  var sheet = ss.getSheetByName(_tabForKind(isCse));
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === Number(rowId)) {
      sheet.getRange(i + 1, 2, 1, 12).setValues([_itemRow(item)]);
      break;
    }
  }

  var total = recalcTotalBudget_(ss);
  updateSubmissionStatus(office.office_code, { total_estimated_budget: total });
  return getDashboardData();
}

function deleteItem(rowId, isCse) {
  var office = getOfficeForCurrentUser();
  var ss = openOfficeSpreadsheet(office.office_code);
  var header = readHeader(ss);
  assertEditable(header);

  var sheet = ss.getSheetByName(_tabForKind(!!isCse));
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

  var all = readAllItems(ss);
  if (all.cse.length === 0 && all.non_cse.length === 0) {
    throw new Error('Add at least one CSE or non-CSE line item before submitting.');
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
