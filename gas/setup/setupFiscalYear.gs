/**
 * Provisions office spreadsheets for a fiscal year.
 */
function setupFiscalYear(fiscalYear) {
  fiscalYear = fiscalYear || CONFIG.FISCAL_YEAR;
  verifySetupConfig_();

  var registry;
  try {
    registry = SpreadsheetApp.openById(CONFIG.OFFICE_REGISTRY_ID);
  } catch (err) {
    throw new Error(
      'Cannot open Office_Registry spreadsheet (OFFICE_REGISTRY_ID=' + CONFIG.OFFICE_REGISTRY_ID + '). ' +
      'Use the ID from the sheet URL (.../spreadsheets/d/THIS_PART/edit), not a folder ID. ' +
      'Make sure you are signed in as the BAC account that owns the file. Original: ' + err
    );
  }

  var officesSheet = registry.getSheetByName('Offices') || registry.getSheets()[0];
  var data = officesSheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var codeIdx = indexOfHeader_(headers, ['office_code', 'Shortcut / Code', 'code']);
  var nameIdx = indexOfHeader_(headers, ['office_name', 'Full Office Name', 'office name', 'name']);
  var budgetIdx = indexOfHeader_(headers, ['budget_allocation', 'budget']);
  var emailIdx = indexOfHeader_(headers, ['contact_email', 'email']);

  if (codeIdx < 0 || nameIdx < 0) {
    throw new Error(
      'Office_Registry row 1 must include office_code (or "Shortcut / Code") and ' +
      'office_name (or "Full Office Name"). contact_email is optional and may be left blank.'
    );
  }

  var submissionSs;
  try {
    submissionSs = getOrCreateSubmissionStatus_(fiscalYear);
  } catch (err) {
    throw new Error(
      'Failed to create/open Submission_Status for FY ' + fiscalYear + '. ' +
      'Check MASTER_FOLDER_ID points to PPMP_Indicative folder (not a sheet). Original: ' + err
    );
  }
  var statusSheet = submissionSs.getSheets()[0];

  for (var i = 1; i < data.length; i++) {
    var officeCode = String(data[i][codeIdx]).trim();
    var officeName = String(data[i][nameIdx]).trim();
    if (!officeCode) continue;

    var budget = budgetIdx >= 0 ? Number(data[i][budgetIdx]) || 0 : 0;
    var contactEmail = emailIdx >= 0 ? String(data[i][emailIdx] || '').trim() : '';
    // contact_email may be blank until BAC assigns Gmail per office; skip Drive sharing then.

    var ss;
    try {
      ss = createOfficeSpreadsheet(officeCode, officeName, fiscalYear, budget);
    } catch (err) {
      throw new Error(
        'Failed creating spreadsheet for office ' + officeCode + ' (' + officeName + '). Original: ' + err
      );
    }

    if (contactEmail) {
      try {
        DriveApp.getFileById(ss.getId()).addViewer(contactEmail);
      } catch (err) {
        Logger.log('Could not share ' + officeCode + ' with ' + contactEmail + ': ' + err);
      }
    }

    statusSheet.appendRow([
      officeCode, officeName, fiscalYear, ss.getId(),
      'Draft', 'Draft', 0, '', '', '', ''
    ]);
    Logger.log('Created: ' + officeCode + ' → ' + ss.getId());
  }
  Logger.log('Setup complete for FY ' + fiscalYear);
}

/**
 * Run this first (before setupFiscalYear) to validate Config.gs IDs.
 * View results: Executions log, or Run → verifySetupConfig.
 */
function verifySetupConfig() {
  verifySetupConfig_();
}

function verifySetupConfig_() {
  if (!CONFIG.MASTER_FOLDER_ID || CONFIG.MASTER_FOLDER_ID.indexOf('REPLACE') === 0) {
    throw new Error('Set MASTER_FOLDER_ID in Config.gs to your PPMP_Indicative Drive folder ID.');
  }
  if (!CONFIG.OFFICE_REGISTRY_ID || CONFIG.OFFICE_REGISTRY_ID.indexOf('REPLACE') === 0) {
    throw new Error('Set OFFICE_REGISTRY_ID in Config.gs to your Office_Registry spreadsheet ID.');
  }
  if (CONFIG.MASTER_FOLDER_ID === CONFIG.OFFICE_REGISTRY_ID) {
    throw new Error('MASTER_FOLDER_ID and OFFICE_REGISTRY_ID must be different (folder vs spreadsheet).');
  }

  try {
    var folder = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);
    Logger.log('OK MASTER_FOLDER_ID → folder: ' + folder.getName());
  } catch (err) {
    throw new Error(
      'MASTER_FOLDER_ID is not a valid folder (or no access): ' + CONFIG.MASTER_FOLDER_ID + '. ' +
      'Use the ID from drive.google.com/.../folders/THIS_PART. Error: ' + err
    );
  }

  try {
    var registry = SpreadsheetApp.openById(CONFIG.OFFICE_REGISTRY_ID);
    Logger.log('OK OFFICE_REGISTRY_ID → spreadsheet: ' + registry.getName());
    var sheet = registry.getSheetByName('Offices') || registry.getSheets()[0];
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function(h) { return String(h || '').trim(); });
    Logger.log('OK Registry headers: ' + headers.join(', '));
    if (indexOfHeader_(headers, ['office_code', 'Shortcut / Code', 'code']) < 0 ||
        indexOfHeader_(headers, ['office_name', 'Full Office Name', 'office name', 'name']) < 0) {
      throw new Error('Row 1 must include office_code and office_name (contact_email optional).');
    }
  } catch (err) {
    throw new Error(
      'OFFICE_REGISTRY_ID is not a readable spreadsheet: ' + CONFIG.OFFICE_REGISTRY_ID + '. ' +
      'If this ID matches your folder, you swapped folder and sheet IDs. Error: ' + err
    );
  }
}

function getOrCreateSubmissionStatus_(fiscalYear) {
  var masterFolder = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);
  var masterSub = masterFolder.getFoldersByName('_Master');
  var masterSubFolder = masterSub.hasNext() ? masterSub.next() : masterFolder.createFolder('_Master');

  var fileName = 'Submission_Status_' + fiscalYear;
  var existing = masterSubFolder.getFilesByName(fileName);
  if (existing.hasNext()) {
    var file = existing.next();
    if (file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
      throw new Error(fileName + ' exists in _Master but is not a Google Sheet. Delete or rename it.');
    }
    return SpreadsheetApp.openById(file.getId());
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

/** Match first present column name (case-insensitive). Returns -1 if none found. */
function indexOfHeader_(headers, candidates) {
  var lower = headers.map(function(h) { return String(h).toLowerCase(); });
  for (var c = 0; c < candidates.length; c++) {
    var idx = lower.indexOf(String(candidates[c]).toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}
