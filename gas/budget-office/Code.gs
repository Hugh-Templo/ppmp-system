function doGet() {
  return HtmlService.createTemplateFromFile('BudgetOffice')
    .evaluate()
    .setTitle('Indicative PPMP — Budget Office')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAuditDashboard() {
  requireBudgetOffice();
  var submissions = listAllSubmissions();
  var pending = submissions.filter(function(s) { return s.status === 'Pending Budget Review'; }).length;
  var approved = submissions.filter(function(s) { return s.status === 'Approved'; }).length;
  var returned = submissions.filter(function(s) { return s.status === 'Returned'; }).length;
  var posted = submissions.filter(function(s) { return s.posting_status === 'Posted'; }).length;

  return {
    summary: { total: submissions.length, pending: pending, approved: approved, returned: returned, posted: posted },
    submissions: submissions
  };
}

function getPpmpDetail(officeCode) {
  requireBudgetOffice();
  return getOfficePpmpDetail(officeCode);
}

function returnForRevision(officeCode, remarks) {
  requireBudgetOffice();
  if (!remarks || !remarks.trim()) throw new Error('Remarks are required when returning for revision.');

  var detail = getOfficePpmpDetail(officeCode);
  if (detail.header.status === 'Approved') throw new Error('Cannot return an approved PPMP.');

  var ss = openSpreadsheetById(detail.submission.spreadsheet_id);
  var headerSheet = ss.getSheetByName(CONFIG.TABS.HEADER);
  var oldStatus = detail.header.status;
  headerSheet.getRange(2, 6).setValue('Returned');
  headerSheet.getRange(2, 10).setValue(remarks);
  headerSheet.getRange(2, 14).setValue(new Date());

  var header = readHeader(ss);
  header.status = 'Returned';
  updateHeaderEditState_(headerSheet, header);
  applySheetProtection(ss, false);
  logAudit(ss, 'RETURN_FOR_REVISION', oldStatus, 'Returned', remarks);

  updateSubmissionStatus(officeCode, {
    status: 'Returned',
    reviewed_at: new Date(),
    remarks: remarks
  });

  return getOfficePpmpDetail(officeCode);
}

function approvePpmp(officeCode) {
  requireBudgetOffice();
  var detail = getOfficePpmpDetail(officeCode);
  if (detail.header.status !== 'Pending Budget Review' && detail.header.status !== 'Returned') {
    throw new Error('Only submitted PPMPs can be approved.');
  }

  var ss = openSpreadsheetById(detail.submission.spreadsheet_id);
  var headerSheet = ss.getSheetByName(CONFIG.TABS.HEADER);
  var oldStatus = detail.header.status;
  headerSheet.getRange(2, 6).setValue('Approved');
  headerSheet.getRange(2, 14).setValue(new Date());

  var header = readHeader(ss);
  header.status = 'Approved';
  updateHeaderEditState_(headerSheet, header);
  applySheetProtection(ss, true);
  logAudit(ss, 'APPROVE', oldStatus, 'Approved', '');

  updateSubmissionStatus(officeCode, {
    status: 'Approved',
    reviewed_at: new Date()
  });

  return getOfficePpmpDetail(officeCode);
}

function postIndicative(officeCode) {
  requireBudgetOffice();
  var detail = getOfficePpmpDetail(officeCode);
  if (detail.header.status !== 'Approved') {
    throw new Error('Only approved PPMPs can be posted to BAC.');
  }
  if (detail.header.posting_status === 'Posted') {
    throw new Error('PPMP is already posted.');
  }

  var ss = openSpreadsheetById(detail.submission.spreadsheet_id);
  var headerSheet = ss.getSheetByName(CONFIG.TABS.HEADER);
  var oldPosting = detail.header.posting_status;
  headerSheet.getRange(2, 7).setValue('Posted');
  headerSheet.getRange(2, 15).setValue(new Date());
  logAudit(ss, 'POST', oldPosting, 'Posted', '');

  updateSubmissionStatus(officeCode, {
    posting_status: 'Posted',
    posted_at: new Date()
  });

  return getOfficePpmpDetail(officeCode);
}

function unpostIndicative(officeCode) {
  requireBudgetOffice();
  var detail = getOfficePpmpDetail(officeCode);
  if (detail.header.posting_status !== 'Posted') {
    throw new Error('Only posted PPMPs can be unposted.');
  }

  var ss = openSpreadsheetById(detail.submission.spreadsheet_id);
  var headerSheet = ss.getSheetByName(CONFIG.TABS.HEADER);
  var oldPosting = detail.header.posting_status;
  headerSheet.getRange(2, 7).setValue('Draft');
  headerSheet.getRange(2, 15).setValue('');
  logAudit(ss, 'UNPOST', oldPosting, 'Draft', '');

  updateSubmissionStatus(officeCode, {
    posting_status: 'Draft',
    posted_at: ''
  });

  // Unpost does NOT unlock Approved PPMPs — permanent lock remains
  return getOfficePpmpDetail(officeCode);
}
