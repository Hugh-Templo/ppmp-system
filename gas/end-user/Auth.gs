function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

function getOfficeForCurrentUser() {
  var email = getCurrentUserEmail().toLowerCase();
  if (!email) throw new Error('Unable to identify user. Please sign in with the Google account assigned to your office.');

  var registry = SpreadsheetApp.openById(CONFIG.OFFICE_REGISTRY_ID);
  var sheet = registry.getSheetByName('Offices') || registry.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var codeIdx = indexOfHeader_(headers, ['office_code', 'Shortcut / Code', 'code']);
  var nameIdx = indexOfHeader_(headers, ['office_name', 'Full Office Name', 'office name', 'name']);
  var emailIdx = indexOfHeader_(headers, ['contact_email', 'email']);
  var budgetIdx = indexOfHeader_(headers, ['budget_allocation', 'budget']);

  if (codeIdx < 0 || nameIdx < 0) {
    throw new Error('Office_Registry is missing office_code / office_name columns.');
  }

  for (var i = 1; i < data.length; i++) {
    var rowEmail = emailIdx >= 0 ? String(data[i][emailIdx] || '').toLowerCase().trim() : '';
    if (rowEmail && rowEmail === email) {
      return {
        office_code: String(data[i][codeIdx]),
        office_name: String(data[i][nameIdx]),
        contact_email: rowEmail,
        budget_allocation: budgetIdx >= 0 ? Number(data[i][budgetIdx]) || 0 : 0
      };
    }
  }
  throw new Error(
    'No office assigned to ' + email + '. ' +
    'If contact_email is still blank in Office_Registry, BAC must add your Gmail to your office row first.'
  );
}

function indexOfHeader_(headers, candidates) {
  var lower = headers.map(function(h) { return String(h).toLowerCase(); });
  for (var c = 0; c < candidates.length; c++) {
    var idx = lower.indexOf(String(candidates[c]).toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}
