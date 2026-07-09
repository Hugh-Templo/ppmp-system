var BUDGET_OFFICE_EMAILS = [
  'budget@ormoccity.gov.ph'
  // Add more budget office staff emails here
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
