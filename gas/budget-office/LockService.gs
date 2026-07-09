function canEndUserEdit(header) {
  if (!header) return false;
  if (header.status === 'Approved') return false;
  if (header.status === 'Pending Budget Review') return false;
  return header.status === 'Draft' || header.status === 'Returned';
}

function getEditLockReason(header) {
  if (!header) return '';
  if (header.status === 'Approved') return 'Approved — PPMP is finalized and cannot be edited';
  if (header.status === 'Pending Budget Review') return 'Submitted — awaiting budget office review';
  return '';
}

function applySheetProtection(ss, lock) {
  var tabs = [
    ss.getSheetByName(CONFIG.TABS.ITEMS_CSE),
    ss.getSheetByName(CONFIG.TABS.ITEMS_NONCSE),
    ss.getSheetByName(CONFIG.TABS.SIGNATORY)
  ];
  tabs.forEach(function(sheet) {
    if (!sheet) return;
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function(p) { p.remove(); });
    if (lock) {
      var protection = sheet.protect().setDescription('PPMP locked');
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
    }
  });

  [CONFIG.TABS.ITEMS_CSE, CONFIG.TABS.ITEMS_NONCSE].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 14, sheet.getLastRow() - 1, 1).setValue(lock);
    }
  });
}

function updateHeaderEditState_(headerSheet, header) {
  var editable = canEndUserEdit(header);
  headerSheet.getRange(2, 11).setValue(editable);
  headerSheet.getRange(2, 12).setValue(editable ? '' : getEditLockReason(header));
}
