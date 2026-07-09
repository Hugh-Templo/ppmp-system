function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

function getOfficeForCurrentUser() {
  var email = getCurrentUserEmail().toLowerCase();
  if (!email) throw new Error('Unable to identify user. Please sign in with the Google account assigned to your office.');

  var registry = SpreadsheetApp.openById(CONFIG.OFFICE_REGISTRY_ID);
  var sheet = registry.getSheetByName('Offices') || registry.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var codeIdx = headers.indexOf('office_code');
  var nameIdx = headers.indexOf('office_name');
  var emailIdx = headers.indexOf('contact_email');
  var budgetIdx = headers.indexOf('budget_allocation');

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailIdx] || '').toLowerCase().trim();
    if (rowEmail === email) {
      return {
        office_code: String(data[i][codeIdx]),
        office_name: String(data[i][nameIdx]),
        contact_email: rowEmail,
        budget_allocation: budgetIdx >= 0 ? Number(data[i][budgetIdx]) || 0 : 0
      };
    }
  }
  throw new Error('No office assigned to ' + email + '. Contact BAC admin.');
}
