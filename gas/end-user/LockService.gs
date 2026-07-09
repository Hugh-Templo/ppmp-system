var LOCK_REASONS = {
  SUBMITTED: 'Submitted — awaiting budget office review',
  APPROVED: 'Approved — PPMP is finalized and cannot be edited',
  APPROVED_POSTED: 'Approved and posted — cannot be edited'
};

function canEndUserEdit(header) {
  if (!header) return false;
  if (header.status === 'Approved') return false;
  if (header.status === 'Pending Budget Review') return false;
  return header.status === 'Draft' || header.status === 'Returned';
}

function getEditLockReason(header) {
  if (!header) return 'PPMP not found';
  if (header.status === 'Approved') {
    return header.posting_status === 'Posted' ? LOCK_REASONS.APPROVED_POSTED : LOCK_REASONS.APPROVED;
  }
  if (header.status === 'Pending Budget Review') return LOCK_REASONS.SUBMITTED;
  return '';
}

function assertEditable(header) {
  if (!canEndUserEdit(header)) {
    throw new Error(header.edit_lock_reason || getEditLockReason(header) || 'PPMP is locked and cannot be edited.');
  }
}

function applySheetProtection(ss, lock) {
  var protectedTabs = [
    ss.getSheetByName(CONFIG.TABS.ITEMS_CSE),
    ss.getSheetByName(CONFIG.TABS.ITEMS_NONCSE),
    ss.getSheetByName(CONFIG.TABS.SIGNATORY)
  ];

  protectedTabs.forEach(function(sheet) {
    if (!sheet) return;
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function(p) { p.remove(); });
    if (lock) {
      var protection = sheet.protect().setDescription('PPMP locked');
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
    }
  });

  [CONFIG.TABS.ITEMS_CSE, CONFIG.TABS.ITEMS_NONCSE].forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var lastRow = Math.max(sheet.getLastRow(), 1);
    if (lastRow > 1) {
      // 'locked' is column N (14)
      sheet.getRange(2, 14, lastRow - 1, 1).setValue(lock);
    }
  });
}

function updateHeaderEditState_(headerSheet, header) {
  var editable = canEndUserEdit(header);
  var reason = editable ? '' : getEditLockReason(header);
  headerSheet.getRange(2, 11).setValue(editable);
  headerSheet.getRange(2, 12).setValue(reason);
}
