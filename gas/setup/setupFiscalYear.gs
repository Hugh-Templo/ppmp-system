/**
 * Provisions office spreadsheets for a fiscal year.
 */
function setupFiscalYear(fiscalYear) {
  fiscalYear = fiscalYear || CONFIG.FISCAL_YEAR;
  var registry = SpreadsheetApp.openById(CONFIG.OFFICE_REGISTRY_ID);
  var officesSheet = registry.getSheetByName('Offices') || registry.getSheets()[0];
  var data = officesSheet.getDataRange().getValues();
  var headers = data[0];
  var codeIdx = headers.indexOf('office_code');
  var nameIdx = headers.indexOf('office_name');
  var budgetIdx = headers.indexOf('budget_allocation');

  if (codeIdx < 0 || nameIdx < 0) {
    throw new Error('Office_Registry must have office_code and office_name columns');
  }

  var submissionSs = getOrCreateSubmissionStatus_(fiscalYear);
  var statusSheet = submissionSs.getSheets()[0];

  for (var i = 1; i < data.length; i++) {
    var officeCode = String(data[i][codeIdx]).trim();
    var officeName = String(data[i][nameIdx]).trim();
    if (!officeCode) continue;

    var budget = budgetIdx >= 0 ? Number(data[i][budgetIdx]) || 0 : 0;
    var ss = createOfficeSpreadsheet(officeCode, officeName, fiscalYear, budget);

    statusSheet.appendRow([
      officeCode, officeName, fiscalYear, ss.getId(),
      'Draft', 'Draft', 0, '', '', '', ''
    ]);
    Logger.log('Created: ' + officeCode + ' → ' + ss.getId());
  }
  Logger.log('Setup complete for FY ' + fiscalYear);
}

function getOrCreateSubmissionStatus_(fiscalYear) {
  var masterFolder = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);
  var masterSub = masterFolder.getFoldersByName('_Master');
  var masterSubFolder = masterSub.hasNext() ? masterSub.next() : masterFolder.createFolder('_Master');

  var fileName = 'Submission_Status_' + fiscalYear;
  var existing = masterSubFolder.getFilesByName(fileName);
  if (existing.hasNext()) {
    return SpreadsheetApp.open(existing.next());
  }

  var ss = SpreadsheetApp.create(fileName);
  var file = DriveApp.getFileById(ss.getId());
  masterSubFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  var sheet = ss.getSheets()[0];
  sheet.setName('Submission_Status');
  var headers = [
    'office_code', 'office_name', 'fiscal_year', 'spreadsheet_id',
    'status', 'posting_status', 'total_estimated_budget',
    'submitted_at', 'reviewed_at', 'posted_at', 'remarks'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  return ss;
}
