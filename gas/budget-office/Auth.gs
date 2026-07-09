var BUDGET_OFFICE_EMAILS = [
  'budget.ormoc@gmail.com'
  // Add other budget office Gmail accounts here
];

function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

function requireBudgetOffice() {
  var email = getCurrentUserEmail().toLowerCase();
  if (!email) throw new Error('Unable to identify user.');
  var allowed = BUDGET_OFFICE_EMAILS.map(function(e) { return e.toLowerCase(); });
  if (allowed.indexOf(email) < 0) {
    throw new Error('Unauthorized. Only Budget Office staff can access this app.');
  }
  return email;
}
