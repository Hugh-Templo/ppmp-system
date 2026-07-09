/**
 * Creates the per-office spreadsheet template with 4 tabs.
 */
function createOfficeSpreadsheet(officeCode, officeName, fiscalYear, budgetAllocation) {
  var title = officeCode + '_Indicative_PPMP_' + fiscalYear;
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
  setupItemsTab_(ss);
  setupSignatoryTab_(ss);
  setupAuditTab_(ss);

  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === 'Sheet1' && ss.getSheets().length > 4) {
      ss.deleteSheet(sheets[i]);
      break;
    }
  }

  return ss;
}

function setupHeaderTab_(ss, officeCode, officeName, fiscalYear, budgetAllocation) {
  var sheet = ss.getSheets()[0].setName(CONFIG.TABS.HEADER);
  var headers = [
    'office_code', 'office_name', 'fiscal_year', 'title', 'type',
    'status', 'posting_status', 'budget_allocation', 'total_estimated_budget',
    'remarks', 'is_editable', 'edit_lock_reason',
    'submitted_at', 'reviewed_at', 'posted_at', 'spreadsheet_id'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.getRange(2, 1, 2, headers.length).setValues([[
    officeCode, officeName, fiscalYear, 'Indicative PPMP ' + fiscalYear, 'Indicative',
    'Draft', 'Draft', budgetAllocation, 0, '', true, '', '', '', '', ss.getId()
  ]]);
  sheet.setFrozenRows(1);
}

function setupItemsTab_(ss) {
  var sheet = ss.insertSheet(CONFIG.TABS.ITEMS);
  var headers = [
    'row_id', 'description', 'category', 'is_cse', 'quantity',
    'unit_of_measure', 'unit_cost', 'estimated_budget', 'procurement_mode',
    'q1_qty', 'q2_qty', 'q3_qty', 'q4_qty', 'locked'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function setupSignatoryTab_(ss) {
  var sheet = ss.insertSheet(CONFIG.TABS.SIGNATORY);
  var labels = [
    ['Field', 'Value'],
    ['submitted_by', ''],
    ['submitted_by_designation', ''],
    ['prepared_by', ''],
    ['prepared_by_designation', ''],
    ['aip_reference', ''],
    ['responsibility_center_no', ''],
    ['office_code_from_pr', '']
  ];
  sheet.getRange(1, 1, labels.length, 2).setValues(labels);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
}

function setupAuditTab_(ss) {
  var sheet = ss.insertSheet(CONFIG.TABS.AUDIT);
  var headers = ['timestamp', 'actor_email', 'action', 'old_status', 'new_status', 'remarks'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}
