import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "./api";

const PPMP_PROJECT_TYPES = ["Goods", "Infrastructure", "Consulting Services"];

const PPMP_PROCUREMENT_MODES = [
  "Competitive Bidding",
  "Limited Source Bidding",
  "Competitive Dialogue",
  "Unsolicited Offer with Bid Matching",
  "Direct Contracting",
  "Direct Acquisition",
  "Repeat Order",
  "Small Value Procurement",
  "Direct Sales",
  "Direct Procurement for Science, Technology and Innovation",
  "Negotiated Procurement",
];

const PPMP_NP_SUBTYPES = [
  "NP - Two Failed Biddings",
  "NP - Emergency Cases",
  "NP - Take-over of Contracts",
  "NP - Adjacent or Contiguous Projects",
  "NP - Agency-to-Agency",
  "NP - Highly Specialized Services",
  "NP - Lease of Real Property and Venue",
];

const PPMP_FUND_SOURCES = ["General Fund", "Trust Fund", "Trust Liabilities"];

const PPMP_SUPPORTING_DOCS = ["Market Scoping", "Technical Specification"];

const PPMP_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatMonthYear = (month, year) => {
  if (!month || !year) return "";
  return `${month} ${year}`;
};


const composeQuantitySize = (qty, unit, name) =>
  [qty, (unit || "").trim(), (name || "").trim()].filter(Boolean).join(" ").trim();

function Dashboard({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [ppmps, setPpmps] = useState([]);
  const [selectedPpmp, setSelectedPpmp] = useState(null);
  const notificationTimerRef = useRef(null);

  // End-User state
  const [newPpmpTitle, setNewPpmpTitle] = useState("");
  const [newPpmpYear, setNewPpmpYear] = useState(new Date().getFullYear() + 1);
  const [newPpmpType, setNewPpmpType] = useState("Indicative");
  const [newPpmpIsCse, setNewPpmpIsCse] = useState(false);

  // Item description autocomplete (backed by /api/offices/item-catalog).
  const [itemCatalog, setItemCatalog] = useState([]);
  const [descSuggestions, setDescSuggestions] = useState([]);
  const [descOpen, setDescOpen] = useState(false);
  const [descHighlight, setDescHighlight] = useState(-1);

  // Item Form state (NGPA columns)
  const [itemDesc, setItemDesc] = useState("");
  const [itemCat, setItemCat] = useState("");
  const [itemIsCse, setItemIsCse] = useState(false);
  const [itemQty, setItemQty] = useState(1);
  const [itemUnit, setItemUnit] = useState("pc");
  const [itemCost, setItemCost] = useState(0.0);
  const [itemProjectType, setItemProjectType] = useState(PPMP_PROJECT_TYPES[0]);
  const [itemProcMode, setItemProcMode] = useState(PPMP_PROCUREMENT_MODES[0]);
  const [itemNpSubtype, setItemNpSubtype] = useState(PPMP_NP_SUBTYPES[0]);
  const [itemPreProc, setItemPreProc] = useState(false);
  const [itemStartMonth, setItemStartMonth] = useState("");
  const [itemStartYear, setItemStartYear] = useState("");
  const [itemEndMonth, setItemEndMonth] = useState("");
  const [itemEndYear, setItemEndYear] = useState("");
  const [itemDeliveryMonth, setItemDeliveryMonth] = useState("");
  const [itemDeliveryYear, setItemDeliveryYear] = useState("");
  const [itemFundSource, setItemFundSource] = useState(PPMP_FUND_SOURCES[0]);
  const [itemSupportingDocs, setItemSupportingDocs] = useState(PPMP_SUPPORTING_DOCS[0]);
  const [itemRemarks, setItemRemarks] = useState("");

  const ppmpYearOptions = (() => {
    const base =
      Number(selectedPpmp?.ppmp?.fiscal_year) ||
      Number(newPpmpYear) ||
      new Date().getFullYear() + 1;
    return [base - 1, base, base + 1, base + 2];
  })();

  // Budget Office state
  const [pendingPpmps, setPendingPpmps] = useState([]);
  const [indicativePpmps, setIndicativePpmps] = useState([]);
  const [postingPpmps, setPostingPpmps] = useState([]);
  const [finalPpmps, setFinalPpmps] = useState([]);
  const [auditDetails, setAuditDetails] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviseModalOpen, setReviseModalOpen] = useState(false);

  // BAC Admin state
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficeCode, setNewOfficeCode] = useState("");
  const [newOfficeBudget, setNewOfficeBudget] = useState(0);
  const [editingOfficeId, setEditingOfficeId] = useState(null);
  const [offices, setOffices] = useState([]);
  const [allPpmps, setAllPpmps] = useState([]);
  const [allPpmpsLoading, setAllPpmpsLoading] = useState(false);
  const [allPpmpsStatusFilter, setAllPpmpsStatusFilter] = useState("Approved");
  const [downloadingPpmpId, setDownloadingPpmpId] = useState(null);
  const [consolidationYear, setConsolidationYear] = useState(new Date().getFullYear() + 1);
  const [dbmClassification, setDbmClassification] = useState([]);
  // CSE-APP / nonCSE-APP workspace
  const [approvedAppPpmps, setApprovedAppPpmps] = useState([]);
  const [kindAppPayload, setKindAppPayload] = useState({ app: null, rows: [] });
  const [appWorkspaceLoading, setAppWorkspaceLoading] = useState(false);
  const [appFormPage, setAppFormPage] = useState(1);
  const [appNgpaPreviewOpen, setAppNgpaPreviewOpen] = useState(false);
  const APP_FORM_PAGE_SIZE = 10;

  // DBM Classification form state
  const [newDbmCode, setNewDbmCode] = useState("");
  const [newDbmProjectTitle, setNewDbmProjectTitle] = useState("");
  const [newDbmClassification, setNewDbmClassification] = useState("");
  const [newDbmDescription, setNewDbmDescription] = useState("");

  // BAC APP signatory (shared CSE + nonCSE footer)
  const [appSigPreparedBy, setAppSigPreparedBy] = useState("");
  const [appSigPreparedDesig, setAppSigPreparedDesig] = useState("");
  const [appSigRecommendedBy, setAppSigRecommendedBy] = useState("");
  const [appSigRecommendedDesig, setAppSigRecommendedDesig] = useState("");
  const [appSigApprovedBy, setAppSigApprovedBy] = useState("");
  const [appSigApprovedDesig, setAppSigApprovedDesig] = useState("");
  const [appSignatoryLoaded, setAppSignatoryLoaded] = useState(false);

  // End-user Excel upload
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  // Registration state
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("end_user");
  const [newUserOfficeId, setNewUserOfficeId] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [newUserActive, setNewUserActive] = useState(true);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [revealedUserPasswords, setRevealedUserPasswords] = useState({});
  const [passwordRevealModal, setPasswordRevealModal] = useState({
    open: false,
    userId: null,
    username: "",
  });
  const [adminRevealPassword, setAdminRevealPassword] = useState("");
  const [adminRevealBusy, setAdminRevealBusy] = useState(false);
  const [adminRevealError, setAdminRevealError] = useState("");
  const [showAdminRevealPassword, setShowAdminRevealPassword] = useState(false);

  const [notification, setNotification] = useState({ message: "", type: "" });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "primary", // "primary" | "danger"
    onConfirm: null,
  });

  const showNotification = (message, type = "success") => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setNotification({ message, type });
    notificationTimerRef.current = setTimeout(() => {
      setNotification({ message: "", type: "" });
      notificationTimerRef.current = null;
    }, 4500);
  };

  const dismissNotification = () => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
    setNotification({ message: "", type: "" });
  };

  const showConfirm = ({
    title = "Please confirm",
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "primary",
    onConfirm,
  }) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      confirmLabel,
      cancelLabel,
      variant,
      onConfirm,
    });
  };

  const closeConfirm = () =>
    setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null }));

  const handleConfirmClick = () => {
    const cb = confirmDialog.onConfirm;
    closeConfirm();
    if (typeof cb === "function") cb();
  };

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = () => {
    if (user.role === "end_user") {
      fetchOfficePpmps();
      fetchOffices();
      return;
    }
    if (user.role === "budget_office") {
      fetchPendingPpmps();
      fetchOffices();
      return;
    }
    if (user.role === "bac_admin") {
      fetchOffices();
      fetchPendingPpmps();
      fetchPostingPpmps();
    }
  };

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "dashboard") {
      fetchPostingPpmps();
      fetchOffices();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "consolidated_apps") {
      fetchApps();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "all_ppmps") {
      fetchAllPpmps();
    }
  }, [activeTab, user.role, consolidationYear]);

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "offices") {
      fetchUsers();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (user.role === "budget_office" && activeTab === "indicative") {
      fetchPostingPpmps();
      fetchOffices();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (user.role === "budget_office" && activeTab === "final") {
      fetchFinalPpmps();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "audit") {
      fetchPendingPpmps();
      fetchIndicativePpmps();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "dbm") {
      fetchDbmClassification();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (
      user.role === "bac_admin" &&
      (activeTab === "cse_app" || activeTab === "noncse_app")
    ) {
      loadAppWorkspace(activeTab === "cse_app" ? "cse" : "noncse");
      fetchAppSignatory();
    }
    setAppNgpaPreviewOpen(false);
  }, [activeTab, user.role, consolidationYear]);

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "app_signatory") {
      fetchAppSignatory();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (user.role === "end_user" && selectedPpmp) {
      fetchItemCatalog();
    }
  }, [user.role, selectedPpmp]);

  useEffect(() => {
    if (itemCatalog.length === 0) return;
    setItemIsCse(Boolean(catalogMatchFor(itemDesc)));
  }, [itemCatalog, itemDesc]);

  // --- API FETCHERS ---

  const fetchOfficePpmps = async () => {
    try {
      const res = await apiFetch("/api/offices/ppmps", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPpmps(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingPpmps = async () => {
    try {
      const res = await apiFetch("/api/budget/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPpmps(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIndicativePpmps = async () => {
    try {
      const url = user.role === "budget_office"
        ? "/api/budget/indicative"
        : "/api/budget/indicative/pending";
      const res = await apiFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIndicativePpmps(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPostingPpmps = async () => {
    try {
      const res = await apiFetch("/api/budget/ppmps/posting", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPostingPpmps(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllPpmps = async () => {
    setAllPpmpsLoading(true);
    try {
      const res = await apiFetch(
        `/api/bac/ppmps?fiscal_year=${consolidationYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setAllPpmps(Array.isArray(data) ? data : []);
      } else {
        setAllPpmps([]);
        showNotification("Failed to load PPMPs", "danger");
      }
    } catch (err) {
      console.error(err);
      setAllPpmps([]);
      showNotification("Failed to load PPMPs", "danger");
    } finally {
      setAllPpmpsLoading(false);
    }
  };

  const fetchFinalPpmps = async () => {
    try {
      const res = await apiFetch("/api/budget/final", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFinalPpmps(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchApps = async () => {
    try {
      const res = await apiFetch("/api/bac/apps", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApps(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOffices = async () => {
    try {
      const res = await apiFetch("/api/offices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOffices(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch("/api/auth/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRegisteredUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDbmClassification = async () => {
    try {
      const res = await apiFetch("/api/dbm/classifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDbmClassification(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDbmClassification = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/dbm/classifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: newDbmCode,
          project_title: newDbmProjectTitle,
          classification: newDbmClassification,
          description: newDbmDescription,
        }),
      });
      if (res.ok) {
        showNotification("DBM classification added successfully!");
        setNewDbmCode("");
        setNewDbmProjectTitle("");
        setNewDbmClassification("");
        setNewDbmDescription("");
        fetchDbmClassification();
      } else {
        const errData = await res.json();
        showNotification(errData.detail || "Failed to add DBM classification", "danger");
      }
    } catch (err) {
      showNotification("Failed to add DBM classification", "danger");
      console.error(err);
    }
  };

  const getOfficeLabel = (officeId) => {
    if (!officeId) return "—";
    const office = offices.find((o) => o.id === officeId);
    return office ? `${office.name} (${office.code})` : `Office #${officeId}`;
  };

  const handleSelectPpmp = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/offices/ppmps/${ppmpId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPpmp(data);
        if (user.role === "end_user") {
          setItemIsCse(false);
        }
        if (user.role === "budget_office" || user.role === "bac_admin") {
          loadAudit(ppmpId);
        }
        return;
      }

      let detail = `Failed to open PPMP preview (HTTP ${res.status})`;
      try {
        const errBody = await res.json();
        if (errBody?.detail) detail = errBody.detail;
      } catch (_) {
        // ignore JSON parse errors
      }
      showNotification(detail, "danger");
    } catch (err) {
      console.error(err);
      showNotification("Failed to open PPMP preview. Check that the backend is running.", "danger");
    }
  };

  const fetchItemCatalog = async () => {
    if (itemCatalog.length > 0) return;
    try {
      const res = await apiFetch("/api/offices/item-catalog", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.items)) setItemCatalog(data.items);
    } catch (err) {
      // Non-fatal: description just falls back to plain input.
    }
  };

  const computeDescSuggestions = (query) => {
    const q = (query || "").trim().toLowerCase();
    if (!q || itemCatalog.length === 0) return [];
    const matches = itemCatalog.filter((it) =>
      (it.description || "").toLowerCase().includes(q)
    );
    matches.sort((a, b) => {
      const aStarts = (a.description || "").toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = (b.description || "").toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return (a.description || "").localeCompare(b.description || "");
    });
    return matches.slice(0, 10);
  };

  const catalogMatchFor = (value) => {
    const target = (value || "").trim().toLowerCase();
    if (!target) return null;
    return itemCatalog.find(
      (it) => (it.description || "").trim().toLowerCase() === target
    ) || null;
  };

  const handleItemDescChange = (value) => {
    setItemDesc(value);
    const next = computeDescSuggestions(value);
    setDescSuggestions(next);
    setDescOpen(next.length > 0);
    setDescHighlight(next.length > 0 ? 0 : -1);
    // A typed item counts as CSE only when it exactly matches a catalog entry;
    // anything else is nonCSE per PS-DBM APP-CSE 2027 rules.
    setItemIsCse(Boolean(catalogMatchFor(value)));
  };

  const handleItemDescKeyDown = (e) => {
    if (!descOpen || descSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDescHighlight((idx) => (idx + 1) % descSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDescHighlight((idx) =>
        idx <= 0 ? descSuggestions.length - 1 : idx - 1
      );
    } else if (e.key === "Enter") {
      if (descHighlight >= 0 && descHighlight < descSuggestions.length) {
        e.preventDefault();
        pickCatalogItem(descSuggestions[descHighlight]);
      }
    } else if (e.key === "Escape") {
      setDescOpen(false);
    }
  };

  const pickCatalogItem = (entry) => {
    if (!entry) return;
    setItemDesc(entry.description || "");
    if (entry.category) setItemCat(entry.category);
    if (entry.unit_of_measure) setItemUnit(entry.unit_of_measure);
    setItemIsCse(!!entry.is_cse);
    setDescOpen(false);
    setDescHighlight(-1);
  };

  const loadAudit = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/budget/ppmps/${ppmpId}/audit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditDetails(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadPpmp = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      showNotification("Choose an Excel PPMP file to upload", "danger");
      return;
    }
    const userOffice = offices.find((o) => o.id === user.office_id);
    if (userOffice?.code) {
      const expectedStem = `${String(userOffice.code).trim()} (IND PPMP)`;
      const actualStem = String(uploadFile.name || "")
        .replace(/\.(xlsx|xls|xlsm)$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (actualStem.toLowerCase() !== expectedStem.toLowerCase()) {
        const ext = (uploadFile.name.match(/\.(xlsx|xls|xlsm)$/i) || [".xlsx"])[0];
        showNotification(`Filename must be "${expectedStem}${ext}"`, "danger");
        return;
      }
    }
    setUploadBusy(true);
    try {
      const form = new FormData();
      form.append("file", uploadFile);

      const res = await apiFetch("/api/offices/ppmps/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        const drive = data.drive_sync;
        if (drive && drive.ok === false) {
          showNotification(
            `PPMP saved locally (${data.item_count || 0} items), but Drive upload failed: ${
              drive.error || "unknown error"
            }. Submit it when ready.`,
            "danger"
          );
        } else {
          showNotification(
            `PPMP uploaded (${data.item_count || 0} items)${
              drive && drive.ok ? " and synced to Google Drive" : ""
            }. Submit it when ready.`
          );
        }
        setUploadFile(null);
        fetchOfficePpmps();
      } else {
        let detail = "Failed to upload PPMP";
        try {
          const err = await res.json();
          if (typeof err.detail === "string") detail = err.detail;
          else if (typeof err.message === "string") detail = err.message;
        } catch (_) {
          detail = `Failed to upload PPMP (HTTP ${res.status})`;
        }
        showNotification(detail, "danger");
      }
    } catch (err) {
      showNotification(
        err?.message
          ? `Failed to upload PPMP: ${err.message}`
          : "Failed to upload PPMP. Check that the Laravel backend is running.",
        "danger"
      );
    } finally {
      setUploadBusy(false);
    }
  };

  const fetchAppSignatory = async () => {
    try {
      const res = await apiFetch("/api/bac/app-signatory", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAppSigPreparedBy(data.prepared_by || "");
        setAppSigPreparedDesig(data.prepared_by_designation || "");
        setAppSigRecommendedBy(data.recommended_by || "");
        setAppSigRecommendedDesig(data.recommended_by_designation || "");
        setAppSigApprovedBy(data.approved_by_name || "");
        setAppSigApprovedDesig(data.approved_by_designation || "");
        setAppSignatoryLoaded(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAppSignatory = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/bac/app-signatory", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prepared_by: appSigPreparedBy,
          prepared_by_designation: appSigPreparedDesig,
          recommended_by: appSigRecommendedBy,
          recommended_by_designation: appSigRecommendedDesig,
          approved_by_name: appSigApprovedBy,
          approved_by_designation: appSigApprovedDesig,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const sig = data.signatory || data;
        setAppSigPreparedBy(sig.prepared_by || "");
        setAppSigPreparedDesig(sig.prepared_by_designation || "");
        setAppSigRecommendedBy(sig.recommended_by || "");
        setAppSigRecommendedDesig(sig.recommended_by_designation || "");
        setAppSigApprovedBy(sig.approved_by_name || "");
        setAppSigApprovedDesig(sig.approved_by_designation || "");
        showNotification("APP signatory updated successfully!");
      } else {
        let detail = "Failed to update APP signatory";
        try {
          const err = await res.json();
          detail = err.detail || detail;
        } catch (_) {
          /* ignore */
        }
        showNotification(detail, "danger");
      }
    } catch (err) {
      showNotification("Failed to update APP signatory", "danger");
    }
  };

  const handleCreatePpmp = async (e) => {
    e.preventDefault();
    showNotification("Upload an Excel PPMP file instead of creating a blank plan", "danger");
  };

  const handleAddPpmpItem = async (e) => {
    e.preventDefault();
    if (!selectedPpmp) return;

    const normalizedDesc = (itemDesc || "").trim().toLowerCase();
    if (!normalizedDesc) {
      showNotification("Item description is required", "danger");
      return;
    }

    const alreadyOnPpmp = (selectedPpmp.items || []).some(
      (it) => (it.description || "").trim().toLowerCase() === normalizedDesc
    );
    if (alreadyOnPpmp) {
      showNotification(
        "This item is already on the PPMP. Duplicate items are not allowed.",
        "danger"
      );
      return;
    }

    const qty = parseInt(itemQty, 10) || 0;
    const unit = (itemUnit || "").trim();
    const name = itemDesc.trim();
    const quantitySize = composeQuantitySize(qty, unit, name);
    const procurementMode =
      itemProcMode === "Negotiated Procurement" ? itemNpSubtype : itemProcMode;

    try {
      const res = await apiFetch(`/api/offices/ppmps/${selectedPpmp.ppmp.id}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: name,
          category: (itemCat || "").trim(),
          is_cse: itemIsCse,
          quantity: qty,
          unit_of_measure: unit,
          unit_cost: parseFloat(itemCost),
          procurement_mode: procurementMode,
          project_type: itemProjectType,
          quantity_size: quantitySize,
          pre_proc_conf: itemPreProc,
          proc_start: formatMonthYear(itemStartMonth, itemStartYear),
          proc_end: formatMonthYear(itemEndMonth, itemEndYear),
          delivery_period: formatMonthYear(itemDeliveryMonth, itemDeliveryYear),
          fund_source: itemFundSource,
          supporting_docs: itemSupportingDocs,
          remarks: itemRemarks || null,
          q1_qty: 0,
          q2_qty: 0,
          q3_qty: 0,
          q4_qty: 0,
        }),
      });
      if (res.ok) {
        showNotification("Item added to PPMP!");
        setItemDesc("");
        setItemCat("");
        setDescSuggestions([]);
        setDescOpen(false);
        setDescHighlight(-1);
        setItemQty(1);
        setItemUnit("pc");
        setItemCost(0.0);
        setItemProjectType(PPMP_PROJECT_TYPES[0]);
        setItemProcMode(PPMP_PROCUREMENT_MODES[0]);
        setItemNpSubtype(PPMP_NP_SUBTYPES[0]);
        setItemPreProc(false);
        setItemStartMonth("");
        setItemStartYear("");
        setItemEndMonth("");
        setItemEndYear("");
        setItemDeliveryMonth("");
        setItemDeliveryYear("");
        setItemFundSource(PPMP_FUND_SOURCES[0]);
        setItemSupportingDocs(PPMP_SUPPORTING_DOCS[0]);
        setItemRemarks("");
        setItemIsCse(false);
        handleSelectPpmp(selectedPpmp.ppmp.id);
      } else {
        const errData = await res.json();
        showNotification(errData.detail || "Failed to add item", "danger");
      }
    } catch (err) {
      showNotification("Failed to add item", "danger");
    }
  };

  const handleDeletePpmpItem = async (itemId) => {
    if (!selectedPpmp) return;
    try {
      const res = await apiFetch(`/api/offices/ppmps/${selectedPpmp.ppmp.id}/items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("Item deleted");
        handleSelectPpmp(selectedPpmp.ppmp.id);
      }
    } catch (err) {
      showNotification("Failed to delete item", "danger");
    }
  };

  const handleSubmitPpmp = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/offices/ppmps/${ppmpId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("PPMP submitted for Budget review & locked!");
        setSelectedPpmp(null);
        fetchOfficePpmps();
      }
    } catch (err) {
      showNotification("Failed to submit PPMP", "danger");
    }
  };

  const performDeletePpmp = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/offices/ppmps/${ppmpId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("PPMP deleted successfully");
        if (selectedPpmp && selectedPpmp.ppmp.id === ppmpId) {
          setSelectedPpmp(null);
        }
        fetchOfficePpmps();
      } else {
        const err = await res.json().catch(() => ({ detail: "Delete failed" }));
        showNotification(err.detail || "Failed to delete PPMP", "danger");
      }
    } catch (err) {
      showNotification("Failed to delete PPMP", "danger");
    }
  };

  const handleDeletePpmp = (ppmpId, title) => {
    showConfirm({
      title: "Delete PPMP",
      message: `Are you sure you want to delete the PPMP "${title}"? This action cannot be undone and all line items will be removed.`,
      confirmLabel: "Delete PPMP",
      cancelLabel: "Cancel",
      variant: "danger",
      onConfirm: () => performDeletePpmp(ppmpId),
    });
  };

  const downloadPpmpById = async (ppmpId, title, fiscalYear) => {
    if (!ppmpId) return;
    setDownloadingPpmpId(ppmpId);
    try {
      const res = await apiFetch(`/api/offices/ppmps/${ppmpId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Export failed" }));
        showNotification(err.detail || "PPMP export failed", "danger");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeTitle = (title || "PPMP").replace(/[^A-Za-z0-9_-]+/g, "_");
      a.href = url;
      a.download = `NGPA_PPMP_${safeTitle}_FY${fiscalYear || ""}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification("PPMP download started");
    } catch (err) {
      showNotification("Failed to download PPMP", "danger");
    } finally {
      setDownloadingPpmpId(null);
    }
  };

  const handleDownloadPpmpXlsx = async () => {
    if (!selectedPpmp) return;
    await downloadPpmpById(
      selectedPpmp.ppmp.id,
      selectedPpmp.ppmp.title,
      selectedPpmp.ppmp.fiscal_year
    );
  };

  const closeBudgetReview = () => {
    setSelectedPpmp(null);
    setAuditDetails(null);
    setRemarks("");
    setReviseModalOpen(false);
  };

  const handleReviewAction = async (ppmpId, action, reviewRemarks = remarks) => {
    if (action === "return" && !String(reviewRemarks || "").trim()) {
      showNotification("Add remarks explaining why the PPMP needs revision.", "danger");
      return;
    }

    setReviewBusy(true);
    try {
      const res = await apiFetch(`/api/budget/ppmps/${ppmpId}/review?action=${action}&remarks=${encodeURIComponent(reviewRemarks || "")}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const actionLabel = action === "approve" ? "verified" : "returned for revision";
        showNotification(`PPMP successfully ${actionLabel}!`);
        setSelectedPpmp(null);
        setAuditDetails(null);
        setRemarks("");
        setReviseModalOpen(false);
        fetchPendingPpmps();
        fetchPostingPpmps();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.detail || "Error completing review", "danger");
      }
    } catch (err) {
      showNotification("Error completing review", "danger");
    } finally {
      setReviewBusy(false);
    }
  };

  const handlePostPpmp = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/budget/ppmps/${ppmpId}/post`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const folder = data?.drive?.drive_folder || "Drive";
        showNotification(data.message || `PPMP posted to BAC (${folder})`);
        fetchPostingPpmps();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.detail || "Failed to post PPMP", "danger");
      }
    } catch (err) {
      showNotification("Failed to post PPMP", "danger");
    }
  };

  const handleUnpostPpmp = async (ppmpId) => {
    const unpostRemarks = window.prompt(
      "Remarks for the end user (why revision is needed):",
      "Unposted by Budget Office — please revise and resubmit."
    );
    if (unpostRemarks === null) return;
    try {
      const q = encodeURIComponent(unpostRemarks.trim());
      const res = await apiFetch(`/api/budget/ppmps/${ppmpId}/unpost?remarks=${q}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("PPMP unposted — returned to end user for revision");
        fetchPostingPpmps();
        fetchPendingPpmps();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.detail || "Failed to unpost PPMP", "danger");
      }
    } catch (err) {
      showNotification("Failed to unpost PPMP", "danger");
    }
  };

  const handlePostIndicativePpmp = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/budget/indicative/ppmps/${ppmpId}/post`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("Indicative PPMP posted successfully!");
        fetchIndicativePpmps();
      }
    } catch (err) {
      showNotification("Failed to post indicative PPMP", "danger");
    }
  };

  const handleUnpostIndicativePpmp = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/budget/indicative/ppmps/${ppmpId}/unpost`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("Indicative PPMP unposted successfully!");
        fetchIndicativePpmps();
      }
    } catch (err) {
      showNotification("Failed to unpost indicative PPMP", "danger");
    }
  };

  const handleApproveIndicativePpmp = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/bac/indicative/ppmps/${ppmpId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("Indicative PPMP approved successfully!");
        fetchIndicativePpmps();
      }
    } catch (err) {
      showNotification("Failed to approve indicative PPMP", "danger");
    }
  };

  const handleRejectIndicativePpmp = async (ppmpId) => {
    try {
      const res = await apiFetch(`/api/bac/indicative/ppmps/${ppmpId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification("Indicative PPMP rejected successfully!");
        fetchIndicativePpmps();
      }
    } catch (err) {
      showNotification("Failed to reject indicative PPMP", "danger");
    }
  };

  const resetOfficeForm = () => {
    setNewOfficeName("");
    setNewOfficeCode("");
    setNewOfficeBudget(0);
  };

  const handleSaveOffice = async (e) => {
    e.preventDefault();
    const payload = {
      name: newOfficeName.trim(),
      code: newOfficeCode.trim(),
      budget_allocation: parseFloat(newOfficeBudget) || 0,
    };
    try {
      const res = await apiFetch("/api/bac/offices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const drive = data.drive_folders;
        const msg =
          typeof data.message === "string"
            ? data.message
            : "Office saved. Past PPMPs for this code remain available.";
        if (drive && drive.ok === false) {
          showNotification(msg, "danger");
        } else {
          showNotification(msg);
        }
        resetOfficeForm();
        fetchOffices();
      } else {
        const detail =
          typeof data.detail === "string" ? data.detail : "Failed to create office";
        showNotification(detail, "danger");
      }
    } catch (err) {
      showNotification("Failed to create office", "danger");
    }
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setNewUsername("");
    setNewEmail("");
    setNewPassword("");
    setConfirmPassword("");
    setNewUserRole("end_user");
    setNewUserOfficeId("");
    setNewUserActive(true);
    setNewOfficeName("");
    setNewOfficeCode("");
    setNewOfficeBudget(0);
  };

  const handleEditUser = (u) => {
    setEditingUserId(u.id);
    setNewUsername(u.username || "");
    setNewEmail(u.email || "");
    setNewPassword("");
    setConfirmPassword("");
    setNewUserRole(u.role || "end_user");
    setNewUserOfficeId(u.office_id ? String(u.office_id) : "");
    setNewUserActive(u.is_active !== false);
    const office = offices.find((item) => item.id === u.office_id);
    setNewOfficeName(office?.name || "");
    setNewOfficeCode(office?.code || "");
    setNewOfficeBudget(office?.budget_allocation || 0);
  };

  const openPasswordRevealModal = (u) => {
    setPasswordRevealModal({
      open: true,
      userId: u.id,
      username: u.username || "",
    });
    setAdminRevealPassword("");
    setAdminRevealError("");
    setShowAdminRevealPassword(false);
  };

  const closePasswordRevealModal = () => {
    setPasswordRevealModal({ open: false, userId: null, username: "" });
    setAdminRevealPassword("");
    setAdminRevealError("");
    setAdminRevealBusy(false);
    setShowAdminRevealPassword(false);
  };

  const hideRevealedUserPassword = (userId) => {
    setRevealedUserPasswords((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const submitAdminPasswordReveal = async (e) => {
    e?.preventDefault?.();
    const userId = passwordRevealModal.userId;
    if (!userId) return;
    const adminPwd = adminRevealPassword.trim();
    if (!adminPwd) {
      setAdminRevealError("Enter your administrator password");
      return;
    }
    setAdminRevealBusy(true);
    setAdminRevealError("");
    try {
      const res = await apiFetch(`/api/auth/users/${userId}/reveal-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: adminPwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.password) {
        setRevealedUserPasswords((prev) => ({
          ...prev,
          [userId]: data.password,
        }));
        closePasswordRevealModal();
      } else {
        setAdminRevealError(
          typeof data.detail === "string"
            ? data.detail
            : "Could not reveal password"
        );
      }
    } catch (_) {
      setAdminRevealError("Could not reveal password");
    } finally {
      setAdminRevealBusy(false);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const isEdit = !!editingUserId;

    if (!isEdit || newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        showNotification("Passwords do not match", "danger");
        return;
      }
      if (!isEdit && !newPassword) {
        showNotification("Password is required", "danger");
        return;
      }
    }

    if (newUserRole === "end_user") {
      const officeName = newOfficeName.trim();
      const officeCode = newOfficeCode.trim();
      if (!officeName || !officeCode) {
        showNotification("Please enter both the end-user office name and code", "danger");
        return;
      }
    }

    try {
      let res;
      if (isEdit) {
        const body = {
          username: newUsername.trim(),
          email: newEmail.trim(),
          role: newUserRole,
          office_id: newUserRole === "end_user" && newUserOfficeId ? parseInt(newUserOfficeId, 10) : null,
          is_active: newUserActive,
        };
        if (newUserRole === "end_user") {
          body.office_name = newOfficeName.trim();
          body.office_code = newOfficeCode.trim().toUpperCase();
        }
        if (newPassword) body.password = newPassword;
        res = await apiFetch(`/api/auth/users/${editingUserId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      } else {
        res = await apiFetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            username: newUsername.trim(),
            email: newEmail.trim(),
            hashed_password: newPassword,
            role: newUserRole,
            office_id: newUserRole === "end_user" && newUserOfficeId ? parseInt(newUserOfficeId, 10) : null,
            office_name: newUserRole === "end_user" ? newOfficeName.trim() : undefined,
            office_code: newUserRole === "end_user" ? newOfficeCode.trim().toUpperCase() : undefined,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showNotification(isEdit ? "User updated successfully!" : "User registered successfully!");
        resetUserForm();
        fetchUsers();
        fetchOffices();
      } else {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : isEdit
              ? "Failed to update user"
              : "Registration failed";
        showNotification(detail, "danger");
      }
    } catch (err) {
      showNotification("Network error. Make sure the Laravel backend is running.", "danger");
    }
  };

  const performDeleteUser = async (userId) => {
    try {
      const res = await apiFetch(`/api/auth/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showNotification(
          typeof data.message === "string"
            ? data.message
            : "User account deleted. PPMPs were kept."
        );
        if (editingUserId === userId) resetUserForm();
        fetchUsers();
      } else {
        showNotification(
          typeof data.detail === "string" ? data.detail : "Failed to delete user",
          "danger"
        );
      }
    } catch (err) {
      showNotification("Failed to delete user", "danger");
    }
  };

  const handleDeleteUser = (u) => {
    if (u.id === user.id) {
      showNotification("You cannot delete your own account", "danger");
      return;
    }
    showConfirm({
      title: "Delete User Account",
      message: `Delete the login account for "${u.username}"?\n\nThis removes only the user account. Office PPMP records and local template files will remain in the system. Creating a new user for the same office will still show past PPMPs.`,
      confirmLabel: "Delete Account",
      cancelLabel: "Cancel",
      variant: "danger",
      onConfirm: () => performDeleteUser(u.id),
    });
  };

  const loadAppWorkspace = async (kind, { autoConsolidate = true } = {}) => {
    setAppWorkspaceLoading(true);
    setAppFormPage(1);
    try {
      const ppmpsRes = await apiFetch(
        `/api/bac/ppmps/approved?fiscal_year=${consolidationYear}&kind=${kind}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      let approvedList = [];
      if (ppmpsRes.ok) {
        const payload = await ppmpsRes.json();
        approvedList = Array.isArray(payload) ? payload : [];
        setApprovedAppPpmps(approvedList);
      } else {
        setApprovedAppPpmps([]);
      }

      if (autoConsolidate && approvedList.length > 0) {
        const consolidateRes = await apiFetch(
          `/api/bac/consolidate/${consolidationYear}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!consolidateRes.ok) {
          const errBody = await consolidateRes.json().catch(() => ({}));
          showNotification(
            errBody.detail || "Could not auto-consolidate verified PPMPs",
            "danger"
          );
        }
      }

      const appRes = await apiFetch(
        `/api/bac/apps/by-year/${consolidationYear}?kind=${kind}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (appRes.ok) {
        setKindAppPayload(await appRes.json());
      } else {
        setKindAppPayload({ app: null, rows: [] });
      }
    } catch (err) {
      setApprovedAppPpmps([]);
      setKindAppPayload({ app: null, rows: [] });
      showNotification("Failed to load APP workspace", "danger");
    } finally {
      setAppWorkspaceLoading(false);
    }
  };

  const handleConsolidate = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const kind =
      activeTab === "cse_app"
        ? "cse"
        : activeTab === "noncse_app"
          ? "noncse"
          : null;
    try {
      const res = await apiFetch(`/api/bac/consolidate/${consolidationYear}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(
          `APP for FY ${consolidationYear} updated from verified PPMPs.`
        );
        fetchApps();
        if (kind) {
          loadAppWorkspace(kind, { autoConsolidate: false });
        }
      } else {
        showNotification(data.detail || "Consolidation failed", "danger");
      }
    } catch (err) {
      showNotification("Failed to consolidate", "danger");
    }
  };

  const handleExportApp = async (fiscalYear, kind) => {
    const labels = { cse: "CSE APP", noncse: "Non-CSE APP", combined: "Combined APP" };
    try {
      const res = await apiFetch(`/api/bac/apps/${fiscalYear}/export/${kind}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Export failed" }));
        showNotification(err.detail || `${labels[kind]} export failed`, "danger");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `APP-${kind === "noncse" ? "nonCSE" : kind.toUpperCase()}-FY${fiscalYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification(`${labels[kind]} download started`);
    } catch (err) {
      showNotification(`Failed to download ${labels[kind]}`, "danger");
    }
  };

  const handleSelectApp = async (appId) => {
    try {
      const res = await apiFetch(`/api/bac/apps/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedApp(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatRole = (role) => {
    const labels = {
      bac_admin: "BAC Administrator",
      budget_office: "Budget Office",
      end_user: "End User",
    };
    return labels[role] || role.replace(/_/g, " ");
  };

  const pageTitles = {
    dashboard: "Dashboard",
    all_ppmps: "All PPMPs",
    indicative: "Post to BAC",
    final: "Final PPMP",
    cse_app: "CSE Annual Procurement Plan",
    noncse_app: "nonCSE Annual Procurement Plan",
    consolidated_apps: "Consolidated APPs",
    app_signatory: "APP Signatory",
    offices: "Users & Offices",
    users: "Manage Users",
    dbm: "DBM Classification",
    audit: "Pending PPMP Review",
  };

  const renderPpmpTypeBadge = (isCse) => (
    <span className={`ppmp-type-badge ${isCse ? "cse" : "noncse"}`}>
      {isCse ? "CSE" : "nonCSE"}
    </span>
  );

  const ngpaQuantitySize = (item) => {
    if (item.quantity_size) return item.quantity_size;
    return composeQuantitySize(
      item.quantity,
      item.unit_of_measure,
      item.description
    );
  };

  const ngpaTitleCategory = (item) =>
    (item?.category || "").trim() || item?.description || "";

  const ngpaYesNo = (value) => {
    if (value === null || value === undefined) return "";
    return value ? "Yes" : "No";
  };

  const ngpaMoney = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const renderNgpaPpmpForm = (payload) => {
    const { ppmp, items = [], office } = payload || {};
    if (!ppmp) return null;

    const officeName = office?.name || "";
    // Approved PPMPs display the FINAL marker; every other status (Draft,
    // Returned, Pending Budget Review) shows INDICATIVE, matching the Excel.
    const isFinal = (ppmp.status || "").toLowerCase() === "approved";
    const totalBudget = items.reduce(
      (sum, it) => sum + Number(it.estimated_budget || 0),
      0
    );

    // The master template reserves 5 pre-formatted item rows; pad the on-screen
    // form to the same minimum so an empty PPMP still looks like the printed form.
    const MIN_ROWS = 5;
    const paddedCount = Math.max(items.length, MIN_ROWS);
    const paddedItems = Array.from({ length: paddedCount }, (_, idx) => items[idx] || null);

    return (
      <div className="ngpa-ppmp-form" role="document" aria-label="NGPA PPMP Form">
        <div className="ngpa-ppmp-form__header">
          <div className="ngpa-ppmp-form__letterhead">[Agency Letterhead with Logo]</div>
          <div className="ngpa-ppmp-form__doc-title">
            PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. ___
          </div>
          <div className="ngpa-ppmp-form__type-row">
            <span className={`ngpa-ppmp-form__type-mark${!isFinal ? " is-active" : ""}`}>
              <span className="ngpa-ppmp-form__type-check" aria-hidden="true">
                {!isFinal ? "\u2713" : ""}
              </span>
              INDICATIVE
            </span>
            <span className={`ngpa-ppmp-form__type-mark${isFinal ? " is-active" : ""}`}>
              <span className="ngpa-ppmp-form__type-check" aria-hidden="true">
                {isFinal ? "\u2713" : ""}
              </span>
              FINAL
            </span>
          </div>
          <div className="ngpa-ppmp-form__meta">
            <div><strong>Fiscal Year :</strong> {ppmp.fiscal_year}</div>
            <div>
              <strong>End-User or Implementing Unit:</strong> {officeName || "\u2014"}
            </div>
          </div>
        </div>

        <div className="ngpa-ppmp-form__table-wrapper">
          <table className="ngpa-ppmp-table">
            <colgroup>
              <col style={{ minWidth: 220 }} />
              <col style={{ minWidth: 140 }} />
              <col style={{ minWidth: 160 }} />
              <col style={{ minWidth: 170 }} />
              <col style={{ minWidth: 120 }} />
              <col style={{ minWidth: 110 }} />
              <col style={{ minWidth: 110 }} />
              <col style={{ minWidth: 150 }} />
              <col style={{ minWidth: 140 }} />
              <col style={{ minWidth: 140 }} />
              <col style={{ minWidth: 170 }} />
              <col style={{ minWidth: 200 }} />
              <col style={{ minWidth: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={5} className="ngpa-ppmp-table__group">
                  PROCUREMENT PROJECT DETAILS
                </th>
                <th colSpan={3} className="ngpa-ppmp-table__group">
                  PROJECTED TIMELINE (Month Year)
                </th>
                <th colSpan={2} className="ngpa-ppmp-table__group">
                  FUNDING DETAILS
                </th>
                <th rowSpan={2} className="ngpa-ppmp-table__group ngpa-ppmp-table__group--vertical">
                  ATTACHED SUPPORTING DOCUMENTS
                </th>
                <th rowSpan={2} className="ngpa-ppmp-table__group ngpa-ppmp-table__group--vertical">
                  REMARKS
                </th>
                <th rowSpan={2} className="ngpa-ppmp-table__group ngpa-ppmp-table__group--vertical">
                  PPMP Type (CSE / NONCSE)
                </th>
              </tr>
              <tr>
                <th>Title / Category of Items</th>
                <th>Type of the Project to be Procured (Goods / Infrastructure / Consulting Services)</th>
                <th>Items (Quantity, Unit, Name)</th>
                <th>Recommended Mode of Procurement</th>
                <th>Pre-Procurement Conference (Yes/No)</th>
                <th>Start of Procurement Activity</th>
                <th>End of Procurement Activity</th>
                <th>Expected Delivery / Implementation Period</th>
                <th>Source of Funds</th>
                <th>Estimated Budget / Authorized Budgetary Allocation (PhP)</th>
              </tr>
              <tr className="ngpa-ppmp-table__col-numbers">
                {Array.from({ length: 13 }, (_, i) => (
                  <th key={i}>Column {i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paddedItems.map((item, idx) => (
                <tr key={item ? item.id : `blank-${idx}`}>
                  <td>{item ? ngpaTitleCategory(item) : ""}</td>
                  <td>{item?.project_type || ""}</td>
                  <td>{item ? ngpaQuantitySize(item) : ""}</td>
                  <td>{item?.procurement_mode || ""}</td>
                  <td className="ngpa-ppmp-table__center">
                    {item ? ngpaYesNo(item.pre_proc_conf) : ""}
                  </td>
                  <td className="ngpa-ppmp-table__center">{item?.proc_start || ""}</td>
                  <td className="ngpa-ppmp-table__center">{item?.proc_end || ""}</td>
                  <td className="ngpa-ppmp-table__center">{item?.delivery_period || ""}</td>
                  <td>{item?.fund_source || ""}</td>
                  <td className="ngpa-ppmp-table__amount">
                    {item ? ngpaMoney(item.estimated_budget) : ""}
                  </td>
                  <td>{item?.supporting_docs || ""}</td>
                  <td>{item?.remarks || ""}</td>
                  <td className="ngpa-ppmp-table__center">
                    {item ? (item.is_cse ? "CSE" : "NONCSE") : ""}
                  </td>
                </tr>
              ))}
              <tr className="ngpa-ppmp-table__total">
                <td colSpan={8}></td>
                <td className="ngpa-ppmp-table__total-label">TOTAL BUDGET:</td>
                <td className="ngpa-ppmp-table__amount ngpa-ppmp-table__total-value">
                  {ngpaMoney(totalBudget)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ngpa-ppmp-form__signatories">
          <div className="ngpa-ppmp-form__sig-block">
            <div className="ngpa-ppmp-form__sig-role">Prepared by:</div>
            <div className="ngpa-ppmp-form__sig-name">
              {office?.prepared_by || ""}
            </div>
            <div className="ngpa-ppmp-form__sig-line">Signature over Printed Name</div>
            <div className="ngpa-ppmp-form__sig-designation">
              {office?.prepared_by_designation || ""}
            </div>
            <div className="ngpa-ppmp-form__sig-caption">Position/Designation</div>
            <div className="ngpa-ppmp-form__sig-unit">{officeName}</div>
            <div className="ngpa-ppmp-form__sig-caption">[End-User or Implementing Unit]</div>
            <div className="ngpa-ppmp-form__sig-date">Date : _________________</div>
          </div>
          <div className="ngpa-ppmp-form__sig-block">
            <div className="ngpa-ppmp-form__sig-role">Submitted by:</div>
            <div className="ngpa-ppmp-form__sig-name">
              {office?.submitted_by || ""}
            </div>
            <div className="ngpa-ppmp-form__sig-line">Signature over Printed Name</div>
            <div className="ngpa-ppmp-form__sig-designation">
              {office?.submitted_by_designation || ""}
            </div>
            <div className="ngpa-ppmp-form__sig-caption">Position/Designation</div>
            <div className="ngpa-ppmp-form__sig-unit">
              {officeName ? `Head of ${officeName}` : ""}
            </div>
            <div className="ngpa-ppmp-form__sig-caption">
              [Head of the End-User or Implementing Unit]
            </div>
            <div className="ngpa-ppmp-form__sig-date">Date : ____________</div>
          </div>
        </div>
      </div>
    );
  };

  const renderNgpaCseAppForm = (
    rows,
    fiscalYear,
    grandTotal = null,
    isFinal = false
  ) => {
    // Layout mirrors templates/NGPA_CSE-APP.xlsx — APP sheet Guide columns 1–12.
    // FINAL only when every active office has submitted a CSE PPMP file.
    const list = rows || [];
    const total =
      grandTotal == null
        ? list.reduce((sum, r) => sum + Number(r.total_estimated_budget || 0), 0)
        : Number(grandTotal || 0);
    const padded = Array.from(
      { length: Math.max(list.length, 6) },
      (_, i) => list[i] || null
    );

    return (
      <div className="ngpa-app-form ngpa-app-form--cse" role="document" aria-label="CSE APP Form">
        <div className="ngpa-app-form__header">
          <div className="ngpa-app-form__letterhead">Ormoc City Government</div>
          <div className="ngpa-app-form__doc-title">
            ANNUAL PROCUREMENT PLAN FOR FY {fiscalYear}
          </div>
          <div className="ngpa-app-form__type-row">
            <span className={`ngpa-app-form__type-mark${!isFinal ? " is-active" : ""}`}>
              <span className="ngpa-app-form__type-check" aria-hidden="true">
                {!isFinal ? "\u2713" : ""}
              </span>
              INDICATIVE
            </span>
            <span className={`ngpa-app-form__type-mark${isFinal ? " is-active" : ""}`}>
              <span className="ngpa-app-form__type-check" aria-hidden="true">
                {isFinal ? "\u2713" : ""}
              </span>
              FINAL
            </span>
            <span className="ngpa-app-form__type-mark">
              UPDATED [Version No. _____]
            </span>
          </div>
        </div>
        <div className="ngpa-app-form__table-wrapper">
          <table className="ngpa-app-table ngpa-app-table--cse">
            <thead>
              <tr>
                <th colSpan={6} className="ngpa-app-table__group">
                  PROCUREMENT PROJECT DETAILS
                </th>
                <th colSpan={2} className="ngpa-app-table__group">
                  PROJECTED TIMELINE (MM/YYYY)
                </th>
                <th colSpan={2} className="ngpa-app-table__group">
                  FUNDING DETAILS
                </th>
                <th rowSpan={2} className="ngpa-app-table__group">
                  PROCUREMENT STRATEGY OR TOOLS
                  <span className="ngpa-app-table__col-no">Column 11</span>
                </th>
                <th rowSpan={2} className="ngpa-app-table__group">
                  REMARKS
                  <span className="ngpa-app-table__th-note">
                    (Other relevant descriptions of the procurement project, if applicable)
                  </span>
                  <span className="ngpa-app-table__col-no">Column 12</span>
                </th>
              </tr>
              <tr>
                <th>
                  Project Title
                  <span className="ngpa-app-table__col-no">Column 1</span>
                </th>
                <th>
                  End-User or Implementing Unit
                  <span className="ngpa-app-table__col-no">Column 2</span>
                </th>
                <th>
                  General Description of the Project
                  <span className="ngpa-app-table__col-no">Column 3</span>
                </th>
                <th>
                  Mode of Procurement
                  <span className="ngpa-app-table__col-no">Column 4</span>
                </th>
                <th>
                  To be covered by an Early Procurement Activity? (Yes/No)
                  <span className="ngpa-app-table__col-no">Column 5</span>
                </th>
                <th>
                  Criteria for Bid Evaluation
                  <span className="ngpa-app-table__th-note">
                    (Including Sustainability and Domestic Preference)
                  </span>
                  <span className="ngpa-app-table__col-no">Column 6</span>
                </th>
                <th>
                  Start of Procurement Activity
                  <span className="ngpa-app-table__col-no">Column 7</span>
                </th>
                <th>
                  End of Procurement Activity
                  <span className="ngpa-app-table__col-no">Column 8</span>
                </th>
                <th>
                  Source of Fund
                  <span className="ngpa-app-table__col-no">Column 9</span>
                </th>
                <th>
                  Estimated Budget / Approved Budget for the Contract (PhP)
                  <span className="ngpa-app-table__col-no">Column 10</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="ngpa-app-table__section">
                <td colSpan={12}>
                  Common Use Supplies and Equipment (CSE) to be purchased from
                  PS-DBM (kindly indicate the summary/total amounts only)
                </td>
              </tr>
              {padded.map((row, idx) => {
                const title = row?.description || "";
                const qty = row?.quantity_size || "";
                const projectDesc = row?.category || title;
                const remarks = row?.delivery_period || qty || "";
                return (
                  <tr key={row ? row.id : `cse-blank-${idx}`}>
                    <td>{title}</td>
                    <td>{row?.end_user_offices || ""}</td>
                    <td>{row ? projectDesc : ""}</td>
                    <td>{row?.procurement_mode || ""}</td>
                    <td className="ngpa-app-table__center">
                      {row ? ngpaYesNo(row.pre_proc_conf) : ""}
                    </td>
                    <td></td>
                    <td className="ngpa-app-table__center">{row?.proc_start || ""}</td>
                    <td className="ngpa-app-table__center">{row?.proc_end || ""}</td>
                    <td>{row?.fund_source || ""}</td>
                    <td className="ngpa-app-table__amount">
                      {row ? ngpaMoney(row.total_estimated_budget) : ""}
                    </td>
                    <td></td>
                    <td>{row ? remarks : ""}</td>
                  </tr>
                );
              })}
              <tr className="ngpa-app-table__total">
                <td colSpan={9} className="ngpa-app-table__total-label">
                  Total Amount of CSEs to be purchased from PS-DBM:
                </td>
                <td className="ngpa-app-table__amount ngpa-app-table__total-value">
                  {ngpaMoney(total)}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr className="ngpa-app-table__total">
                <td colSpan={9} className="ngpa-app-table__total-label">
                  Total Amount of Estimated Budget:
                </td>
                <td className="ngpa-app-table__amount ngpa-app-table__total-value">
                  {ngpaMoney(total)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ngpa-app-form__signatories">
          <div className="ngpa-app-form__sig-block">
            <div className="ngpa-app-form__sig-role">Prepared by:</div>
            <div className="ngpa-app-form__sig-line">
              {appSigPreparedBy || "Signature over Printed Name"}
            </div>
            <div className="ngpa-app-form__sig-caption">
              {appSigPreparedDesig || "Position/Designation"}
            </div>
            <div className="ngpa-app-form__sig-unit">
              Bids and Awards Committee Secretariat
            </div>
            <div className="ngpa-app-form__sig-date">Date : _________________</div>
          </div>
          <div className="ngpa-app-form__sig-block">
            <div className="ngpa-app-form__sig-role">Recommended by:</div>
            <div className="ngpa-app-form__sig-authority">
              By the Authority of the Bids and Awards Committee:
            </div>
            <div className="ngpa-app-form__sig-line">
              {appSigRecommendedBy || "Signature over Printed Name"}
            </div>
            <div className="ngpa-app-form__sig-caption">
              {appSigRecommendedDesig || "Position/Designation"}
            </div>
            <div className="ngpa-app-form__sig-unit">
              Bids and Awards Committee Chairperson
            </div>
            <div className="ngpa-app-form__sig-date">Date : _________________</div>
          </div>
          <div className="ngpa-app-form__sig-block">
            <div className="ngpa-app-form__sig-role">Approved by:</div>
            <div className="ngpa-app-form__sig-line">
              {appSigApprovedBy || "Signature over Printed Name"}
            </div>
            <div className="ngpa-app-form__sig-caption">
              {appSigApprovedDesig || "Position/Designation"}
            </div>
            <div className="ngpa-app-form__sig-unit">Head of the Procuring Entity</div>
            <div className="ngpa-app-form__sig-date">Date : _________________</div>
          </div>
        </div>
      </div>
    );
  };

  const renderNgpaNonCseAppForm = (rows, fiscalYear, grandTotal = null) => {
    // Layout mirrors templates/NGPA_nonCSE-APP.xlsx (app sheet + how_to_fill_out guide).
    const list = rows || [];
    const total =
      grandTotal == null
        ? list.reduce((sum, r) => sum + Number(r.total_estimated_budget || 0), 0)
        : Number(grandTotal || 0);
    const padded = Array.from(
      { length: Math.max(list.length, 6) },
      (_, i) => list[i] || null
    );

    return (
      <div className="ngpa-app-form ngpa-app-form--noncse" role="document" aria-label="nonCSE APP Form">
        <div className="ngpa-app-form__header">
          <div className="ngpa-app-form__doc-title">
            (Ormoc City Government) Annual Procurement Plan for FY {fiscalYear}
          </div>
        </div>
        <div className="ngpa-app-form__table-wrapper">
          <table className="ngpa-app-table ngpa-app-table--noncse">
            <thead>
              <tr>
                <th rowSpan={2}>
                  Code (PAP)
                  <span className="ngpa-app-table__th-note">
                    PAP Code / internal numbering system
                  </span>
                </th>
                <th rowSpan={2}>
                  Procurement Project
                  <span className="ngpa-app-table__th-note">
                    Align with budget documents
                  </span>
                </th>
                <th rowSpan={2}>
                  PMO/End-User
                  <span className="ngpa-app-table__th-note">
                    Implementing / utilizing unit
                  </span>
                </th>
                <th rowSpan={2}>
                  Is this an Early Procurement Activity? (Yes/No)
                </th>
                <th rowSpan={2}>Mode of Procurement</th>
                <th colSpan={4} className="ngpa-app-table__group">
                  Schedule for Each Procurement Activity
                </th>
                <th rowSpan={2}>
                  Source of Funds
                  <span className="ngpa-app-table__th-note">
                    If Others, specify under Remarks
                  </span>
                </th>
                <th colSpan={3} className="ngpa-app-table__group">
                  Estimated Budget (PhP)
                </th>
                <th rowSpan={2}>
                  Remarks
                  <span className="ngpa-app-table__th-note">
                    (brief description of Project)
                  </span>
                </th>
              </tr>
              <tr>
                <th>Advertisement/Posting of IB/REI</th>
                <th>Submission/Opening of Bids</th>
                <th>Notice of Award</th>
                <th>Contract Signing</th>
                <th>Total</th>
                <th>MOOE</th>
                <th>CO</th>
              </tr>
            </thead>
            <tbody>
              {padded.map((row, idx) => {
                // Export places the consolidated amount under MOOE; CO left blank;
                // Total mirrors MOOE + CO (same as template formula).
                const amount = row ? Number(row.total_estimated_budget || 0) : null;
                return (
                  <tr key={row ? row.id : `noncse-blank-${idx}`}>
                    <td>{row?.project_type || ""}</td>
                    <td>{row?.description || ""}</td>
                    <td>{row?.end_user_offices || ""}</td>
                    <td className="ngpa-app-table__center">
                      {row ? ngpaYesNo(row.pre_proc_conf) : ""}
                    </td>
                    <td>{row?.procurement_mode || ""}</td>
                    <td className="ngpa-app-table__center">{row?.proc_start || ""}</td>
                    <td className="ngpa-app-table__center">{row?.proc_start || ""}</td>
                    <td className="ngpa-app-table__center">{row?.proc_end || ""}</td>
                    <td className="ngpa-app-table__center">
                      {row?.delivery_period || ""}
                    </td>
                    <td>{row?.fund_source || ""}</td>
                    <td className="ngpa-app-table__amount">
                      {amount == null ? "" : ngpaMoney(amount)}
                    </td>
                    <td className="ngpa-app-table__amount">
                      {amount == null ? "" : ngpaMoney(amount)}
                    </td>
                    <td className="ngpa-app-table__amount"></td>
                    <td>{row?.quantity_size || ""}</td>
                  </tr>
                );
              })}
              <tr className="ngpa-app-table__total">
                <td className="ngpa-app-table__total-label">Total</td>
                <td colSpan={9}></td>
                <td className="ngpa-app-table__amount ngpa-app-table__total-value">
                  {ngpaMoney(total)}
                </td>
                <td className="ngpa-app-table__amount ngpa-app-table__total-value">
                  {ngpaMoney(total)}
                </td>
                <td className="ngpa-app-table__amount ngpa-app-table__total-value">
                  {ngpaMoney(0)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ngpa-app-form__signatories">
          <div className="ngpa-app-form__sig-block">
            <div className="ngpa-app-form__sig-role">Prepared by:</div>
            <div className="ngpa-app-form__sig-line">
              {appSigPreparedBy || "Signature over Printed Name"}
            </div>
            {appSigPreparedDesig ? (
              <div className="ngpa-app-form__sig-caption">{appSigPreparedDesig}</div>
            ) : null}
            <div className="ngpa-app-form__sig-unit">
              Bids and Awards Committee Secretariat
            </div>
          </div>
          <div className="ngpa-app-form__sig-block">
            <div className="ngpa-app-form__sig-role">Recommended by:</div>
            <div className="ngpa-app-form__sig-line">
              {appSigRecommendedBy || "Signature over Printed Name"}
            </div>
            {appSigRecommendedDesig ? (
              <div className="ngpa-app-form__sig-caption">{appSigRecommendedDesig}</div>
            ) : null}
            <div className="ngpa-app-form__sig-unit">Bids and Awards Committee</div>
          </div>
          <div className="ngpa-app-form__sig-block">
            <div className="ngpa-app-form__sig-role">Approved by:</div>
            <div className="ngpa-app-form__sig-line">
              {appSigApprovedBy || "Signature over Printed Name"}
            </div>
            {appSigApprovedDesig ? (
              <div className="ngpa-app-form__sig-caption">{appSigApprovedDesig}</div>
            ) : null}
            <div className="ngpa-app-form__sig-unit">Head of the Procuring Entity</div>
          </div>
        </div>
      </div>
    );
  };

  const renderAppWorkspace = (kind) => {
    const isCse = kind === "cse";
    const label = isCse ? "CSE" : "nonCSE";
    const rows = kindAppPayload.rows || [];
    const sourceTotal = approvedAppPpmps.reduce(
      (sum, p) => sum + Number(p.total_estimated_budget || 0),
      0
    );
    const isStaleApp = !appWorkspaceLoading && rows.length > 0 && approvedAppPpmps.length === 0;

    const totalPages = Math.max(1, Math.ceil(rows.length / APP_FORM_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, appFormPage), totalPages);
    const pageStart = (safePage - 1) * APP_FORM_PAGE_SIZE;
    const pageRows = rows.slice(pageStart, pageStart + APP_FORM_PAGE_SIZE);
    const pageEnd = pageStart + pageRows.length;
    const grandTotal = rows.reduce(
      (sum, r) => sum + Number(r.total_estimated_budget || 0),
      0
    );

    // FINAL only when every active office has a verified CSE PPMP for this FY.
    const fyNum = Number(consolidationYear);
    const submittedCodes = new Set(
      (approvedAppPpmps || [])
        .filter((p) => {
          if (p.fiscal_year == null || p.fiscal_year === "") return true;
          return Number(p.fiscal_year) === fyNum;
        })
        .map((p) => String(p.office_code || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const activeOffices = (offices || []).filter((o) => o.is_active !== false);
    const submittedOfficeCount = activeOffices.filter((o) =>
      submittedCodes.has(String(o.code || "").trim().toLowerCase())
    ).length;
    const isFinalApp =
      isCse &&
      activeOffices.length > 0 &&
      activeOffices.every((o) =>
        submittedCodes.has(String(o.code || "").trim().toLowerCase())
      );

    return (
      <div className="app-workspace">
        <div className="app-workspace-toolbar">
          <div className="app-workspace-toolbar__meta">
            <label className="form-label" htmlFor={`fy-${kind}`}>Fiscal Year</label>
            <input
              id={`fy-${kind}`}
              type="number"
              className="form-input app-workspace-fy"
              value={consolidationYear}
              onChange={(e) => {
                const next = Number(e.target.value);
                setConsolidationYear(Number.isFinite(next) ? next : e.target.value);
                setAppFormPage(1);
              }}
            />
          </div>
          <div className="app-workspace-toolbar__actions">
            <button type="button" className="btn" onClick={handleConsolidate} disabled={appWorkspaceLoading}>
              <i className="fas fa-layer-group" aria-hidden="true"></i>
              {isStaleApp ? "Clear / Rebuild APP" : "Run Consolidation"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleExportApp(consolidationYear, kind)}
              disabled={!kindAppPayload.app || rows.length === 0}
            >
              <i className="fas fa-file-excel" aria-hidden="true"></i>
              Download {label} Excel
            </button>
          </div>
        </div>

        {isStaleApp && (
          <div className="alert alert-danger app-workspace-stale" role="status">
            The {label} NGPA form still has consolidated rows, but there are no
            verified {label} PPMPs for FY {consolidationYear}. This APP may be out
            of date. Click <strong>Clear / Rebuild APP</strong> after verified
            PPMPs are available.
          </div>
        )}

        <section className="dashboard-card app-workspace-source">
          <div className="app-workspace-section-head">
            <h2 className="card-title">Verified PPMPs ({label})</h2>
            <span className="app-workspace-stat">
              {approvedAppPpmps.length} office PPMP(s) · ₱{ngpaMoney(sourceTotal)}
            </span>
          </div>
          <p className="page-subtitle" style={{ marginBottom: "0.75rem" }}>
            Budget-verified (Approved) office PPMPs with {label} items for FY{" "}
            {consolidationYear}. Opening this page consolidates them into the{" "}
            {label} APP form below.
          </p>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Office</th>
                  <th>Title</th>
                  <th>Items</th>
                  <th>Total Budget</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appWorkspaceLoading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      Loading…
                    </td>
                  </tr>
                ) : approvedAppPpmps.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      No verified {label} PPMPs for FY {consolidationYear}.
                    </td>
                  </tr>
                ) : (
                  approvedAppPpmps.map((p) => (
                    <tr key={p.id}>
                      <td>{p.office_name || p.office_code || "—"}</td>
                      <td>{p.title}</td>
                      <td>{p.item_count}</td>
                      <td>₱{ngpaMoney(p.total_estimated_budget)}</td>
                      <td>
                        <span className="badge badge-success">{p.status || "Verified"}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-card app-workspace-form-card">
          <div className="app-workspace-section-head">
            <h2 className="card-title">{label} APP — NGPA Form</h2>
            <div className="app-workspace-section-head__aside">
              <span className="app-workspace-stat">
                {rows.length} consolidated row(s)
                {!kindAppPayload.app ? " · Not consolidated yet" : ""}
                {isStaleApp ? " · Stale" : ""}
                {rows.length > 0
                  ? ` · Page ${safePage} of ${totalPages}`
                  : ""}
                {isCse
                  ? ` · ${submittedOfficeCount}/${activeOffices.length} offices submitted · ${
                      isFinalApp ? "FINAL" : "INDICATIVE"
                    }`
                  : ""}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAppNgpaPreviewOpen(true)}
                disabled={rows.length === 0}
              >
                <i className="fas fa-eye" aria-hidden="true"></i>
                Preview
              </button>
            </div>
          </div>
          {isCse
            ? renderNgpaCseAppForm(
                pageRows,
                consolidationYear,
                grandTotal,
                isFinalApp
              )
            : renderNgpaNonCseAppForm(pageRows, consolidationYear, grandTotal)}

          {rows.length > APP_FORM_PAGE_SIZE && (
            <div className="app-form-pagination" role="navigation" aria-label="APP form pages">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={safePage <= 1}
                onClick={() => setAppFormPage((p) => Math.max(1, p - 1))}
              >
                <i className="fas fa-chevron-left" aria-hidden="true"></i>
                Previous
              </button>
              <span className="app-form-pagination__status">
                Showing {pageStart + 1}–{pageEnd} of {rows.length} rows
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={safePage >= totalPages}
                onClick={() => setAppFormPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <i className="fas fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          )}
        </section>

        {appNgpaPreviewOpen && (
          <div
            className="ppmp-fullscreen app-ngpa-preview"
            role="dialog"
            aria-modal="true"
            aria-label={`${label} APP NGPA Form Preview`}
          >
            <header className="ppmp-fullscreen-header">
              <button
                type="button"
                className="btn btn-secondary ppmp-fullscreen-back"
                onClick={() => setAppNgpaPreviewOpen(false)}
              >
                <i className="fas fa-arrow-left" aria-hidden="true"></i>
                Close Preview
              </button>
              <div className="ppmp-fullscreen-title">
                <h1>{label} APP — NGPA Form</h1>
                <div className="ppmp-fullscreen-meta">
                  <span className="ppmp-fullscreen-year">
                    Fiscal Year {consolidationYear}
                  </span>
                  <span className="app-workspace-stat">
                    {rows.length} consolidated row(s)
                  </span>
                </div>
              </div>
              <div className="ppmp-fullscreen-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => window.print()}
                >
                  <i className="fas fa-print" aria-hidden="true"></i>
                  Print
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleExportApp(consolidationYear, kind)}
                  disabled={!kindAppPayload.app || rows.length === 0}
                >
                  <i className="fas fa-file-excel" aria-hidden="true"></i>
                  Download Excel
                </button>
              </div>
            </header>
            <div className="ppmp-fullscreen-body app-ngpa-preview__body">
              {isCse
                ? renderNgpaCseAppForm(
                    rows,
                    consolidationYear,
                    grandTotal,
                    isFinalApp
                  )
                : renderNgpaNonCseAppForm(rows, consolidationYear, grandTotal)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const activeOffices = (offices || []).filter((office) => office.is_active !== false);
  const verifiedOfficeIds = new Set(
    (postingPpmps || [])
      .map((ppmp) => ppmp.office_id)
      .filter((value) => value != null && value !== "")
      .map((value) => String(value))
  );
  const verifiedOfficeCount = activeOffices.filter((office) =>
    verifiedOfficeIds.has(String(office.id))
  ).length;
  const verifiedProgress = activeOffices.length
    ? Math.round((verifiedOfficeCount / activeOffices.length) * 100)
    : 0;
  const allOfficesVerified = activeOffices.length > 0 && verifiedOfficeCount >= activeOffices.length;

  const closeEndUserPreview = () => {
    setSelectedPpmp(null);
    setActiveTab("dashboard");
  };

  const closeBacPpmpPreview = () => {
    setSelectedPpmp(null);
    setAuditDetails(null);
    setActiveTab("all_ppmps");
  };

  const showReadonlyPpmpPreview =
    !!selectedPpmp &&
    (user.role === "end_user" ||
      (user.role === "bac_admin" && activeTab === "all_ppmps"));

  // Dedicated preview page (replaces dashboard — view only)
  if (showReadonlyPpmpPreview) {
    const previewBackLabel =
      user.role === "bac_admin" ? "Back to All PPMPs" : "Back to Dashboard";
    const previewOfficeName =
      selectedPpmp.office?.name ||
      selectedPpmp.office?.code ||
      getOfficeLabel(selectedPpmp.ppmp.office_id) ||
      "";
    return (
      <div className="ppmp-preview-page" aria-label="PPMP preview (view only)">
        <header className="ppmp-preview-page__header">
          <button
            type="button"
            className="btn btn-secondary ppmp-preview-page__back"
            onClick={user.role === "bac_admin" ? closeBacPpmpPreview : closeEndUserPreview}
          >
            <i className="fas fa-arrow-left" aria-hidden="true"></i>
            {previewBackLabel}
          </button>
          <div className="ppmp-preview-page__title">
            <h1>{selectedPpmp.ppmp.title}</h1>
            <div className="ppmp-preview-page__meta">
              <span className="badge badge-secondary">View only</span>
              <span
                className={`badge ${
                  selectedPpmp.ppmp.status === "Approved"
                    ? "badge-success"
                    : selectedPpmp.ppmp.status === "Pending Budget Review"
                      ? "badge-warning"
                      : selectedPpmp.ppmp.status === "Returned"
                        ? "badge-danger"
                        : "badge-secondary"
                }`}
              >
                {selectedPpmp.ppmp.status}
              </span>
              <span className="ppmp-preview-page__year">
                Fiscal Year {selectedPpmp.ppmp.fiscal_year}
              </span>
              {user.role === "bac_admin" && previewOfficeName && (
                <span>{previewOfficeName}</span>
              )}
            </div>
          </div>
          <div className="ppmp-preview-page__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.print()}
            >
              <i className="fas fa-print" aria-hidden="true"></i>
              Print
            </button>
            <button type="button" className="btn" onClick={handleDownloadPpmpXlsx}>
              <i className="fas fa-file-excel" aria-hidden="true"></i>
              Download Excel
            </button>
          </div>
        </header>

        <main className="ppmp-preview-page__body">
          {selectedPpmp.ppmp.status === "Returned" && selectedPpmp.ppmp.remarks && (
            <div
              className="dashboard-card"
              style={{
                backgroundColor: "var(--neuro-bg)",
                borderLeft: "4px solid var(--danger-color)",
                marginBottom: "24px",
                padding: "1.25rem",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <h3
                style={{
                  color: "var(--danger-color)",
                  fontSize: "0.95rem",
                  fontWeight: "700",
                  marginBottom: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <i className="fas fa-exclamation-triangle"></i>
                Revision Required
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                <strong>Budget Office Remarks:</strong>
              </p>
              <div
                style={{
                  fontSize: "0.875rem",
                  lineHeight: "1.6",
                  color: "var(--text-primary)",
                  background: "var(--neuro-bg)",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid transparent",
                  boxShadow: "var(--shadow-inset)",
                  fontStyle: "italic",
                }}
              >
                "{selectedPpmp.ppmp.remarks}"
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1rem" }}>
                Budget returned or unposted this plan. Upload a revised Excel PPMP from the Dashboard, then submit again for validation.
              </p>
            </div>
          )}

          <div className="ppmp-fullscreen-columns ppmp-fullscreen-columns--readonly">
            {renderNgpaPpmpForm(selectedPpmp)}
          </div>
        </main>

        {notification.message && (
          <div
            className={`notification-toast alert alert-${notification.type}`}
            role="status"
            aria-live="polite"
          >
            <div className="notification-toast-body">
              <i
                className={`fas ${
                  notification.type === "danger" ? "fa-exclamation-circle" : "fa-check-circle"
                }`}
                aria-hidden="true"
              ></i>
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              className="notification-toast-close"
              onClick={dismissNotification}
              aria-label="Dismiss notification"
            >
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src={`${import.meta.env.BASE_URL}Ormoc_City.png`} alt="Ormoc City" />
          </div>
          <h2 className="sidebar-title">APP CONSOLIDATION SYSTEM</h2>
          <p className="sidebar-subtitle">RA 12009 COMPLIANCE MODULE</p>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Navigation</div>
            <button
              type="button"
              className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => { setActiveTab("dashboard"); setSelectedPpmp(null); setSelectedApp(null); }}
            >
              <i className="fas fa-th-large" aria-hidden="true"></i>
              Dashboard
            </button>
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "all_ppmps" ? "active" : ""}`}
                onClick={() => { setActiveTab("all_ppmps"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-file-excel" aria-hidden="true"></i>
                All PPMPs
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "consolidated_apps" ? "active" : ""}`}
                onClick={() => { setActiveTab("consolidated_apps"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-layer-group" aria-hidden="true"></i>
                Consolidated APPs
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "cse_app" ? "active" : ""}`}
                onClick={() => { setActiveTab("cse_app"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-boxes" aria-hidden="true"></i>
                CSE-APP
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "noncse_app" ? "active" : ""}`}
                onClick={() => { setActiveTab("noncse_app"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-clipboard-list" aria-hidden="true"></i>
                nonCSE-APP
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "app_signatory" ? "active" : ""}`}
                onClick={() => { setActiveTab("app_signatory"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-signature" aria-hidden="true"></i>
                Signatory
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "offices" ? "active" : ""}`}
                onClick={() => { setActiveTab("offices"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-building" aria-hidden="true"></i>
                Users & Offices
              </button>
            )}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="user-avatar-small">{user.username.charAt(0).toUpperCase()}</div>
            <div>
              <div className="user-name">{user.username}</div>
              <div className="user-role">{formatRole(user.role)}</div>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={onLogout}>
            <i className="fas fa-sign-out-alt" aria-hidden="true"></i>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">{pageTitles[activeTab] || "Dashboard"}</h1>
          <p className="page-subtitle">Ormoc City Government PPMP-APP Consolidation System</p>
        </div>

        <div className="workspace">

          {activeTab === "dashboard" && (
            <div>
              {/* --- END-USER VIEW --- */}
              {user.role === "end_user" && (() => {
                const hasReturnedPpmp = ppmps.some((p) => p.status === "Returned");
                const canUpload =
                  ppmps.length === 0 ||
                  ppmps.some((p) => p.status === "Draft" || p.status === "Returned");
                const uploadLockedByPending = !canUpload && ppmps.some((p) => p.status === "Pending Budget Review");
                const uploadLockMessage = uploadLockedByPending
                  ? "Upload is unavailable while your PPMP is Pending Budget Review. You can upload again if Budget returns it for revision."
                  : "Upload is unavailable because your PPMP has been Approved / validated. No further action is needed.";

                return (
                <div className="end-user-dashboard">
                  <div className={`dashboard-card end-user-upload-card${canUpload ? "" : " is-locked"}`}>
                    {!canUpload && (
                      <div className="end-user-upload-lock" role="status" aria-live="polite">
                        <div className="end-user-upload-lock__message">
                          <i className={`fas ${uploadLockedByPending ? "fa-hourglass-half" : "fa-lock"}`} aria-hidden="true"></i>
                          <p>{uploadLockMessage}</p>
                        </div>
                      </div>
                    )}
                    <h2 className="card-title">
                      {hasReturnedPpmp ? "Upload Revised PPMP Excel" : "Upload PPMP Excel"}
                    </h2>
                    <div style={{
                      backgroundColor: "var(--neuro-bg)",
                      border: "1px solid transparent",
                      borderLeft: `4px solid ${hasReturnedPpmp ? "var(--danger-color)" : "var(--primary-color)"}`,
                      borderRadius: "12px",
                      padding: "12px",
                      marginBottom: "10px",
                      fontSize: "13px",
                      boxShadow: "var(--shadow-inset)",
                      color: "var(--text-secondary)"
                    }}>
                      {(() => {
                        const userOffice = offices.find((o) => o.id === user.office_id);
                        const expectedUploadName = userOffice?.code
                          ? `${String(userOffice.code).trim()} (IND PPMP).xlsx`
                          : "OFFICE_CODE (IND PPMP).xlsx";
                        return hasReturnedPpmp ? (
                          <>
                            <strong>Revision required:</strong> Budget returned your PPMP.
                            Upload a revised NGPA Excel named <strong>{expectedUploadName}</strong>{" "}
                            (Column 13 must be CSE or NONCSE per item) to replace the Returned plan,
                            then submit again for review.
                          </>
                        ) : (
                          <>
                            <strong>Note:</strong> Filename must be{" "}
                            <strong>{expectedUploadName}</strong>. Include{" "}
                            <strong>Column 13</strong> with CSE or NONCSE for each item.
                            Uploads create or replace a <strong>Draft</strong> for the same fiscal year.
                            Use <strong>Preview</strong> anytime for a view-only form (no editing).
                          </>
                        );
                      })()}
                    </div>
                    <form
                      onSubmit={canUpload ? handleUploadPpmp : (e) => e.preventDefault()}
                      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                      aria-disabled={!canUpload}
                    >
                      <input
                        type="file"
                        className="form-input"
                        accept=".xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        required
                        disabled={!canUpload || uploadBusy}
                      />
                      <button type="submit" className="btn" disabled={!canUpload || uploadBusy}>
                        {uploadBusy ? "Uploading…" : hasReturnedPpmp ? "Upload Revised PPMP" : "Upload PPMP"}
                      </button>
                    </form>
                  </div>

                  <div className="dashboard-card">
                    <h2 className="card-title">My Office PPMPs</h2>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Year</th>
                          <th>Status</th>
                          <th>Remarks</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ppmps.length === 0 ? (
                          <tr>
                            <td colSpan="5">No PPMPs uploaded yet.</td>
                          </tr>
                        ) : (
                          ppmps.map((p) => (
                            <tr key={p.id}>
                              <td>{p.title}</td>
                              <td>{p.fiscal_year}</td>
                              <td>
                                <span className={`badge ${p.status === "Approved" ? "badge-success" : p.status === "Pending Budget Review" ? "badge-warning" : p.status === "Returned" ? "badge-danger" : "badge-secondary"}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td>
                                {p.status === "Returned" && p.remarks ? (
                                  <div style={{ fontSize: "12px", color: "#d32f2f" }}>
                                    <strong>Remarks:</strong> {p.remarks}
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>—</span>
                                )}
                              </td>
                              <td>
                                <div className="ppmp-row-actions">
                                  <button
                                    type="button"
                                    className="btn"
                                    onClick={() => handleSelectPpmp(p.id)}
                                    title="View-only NGPA PPMP preview"
                                  >
                                    Preview
                                  </button>
                                  {(p.status === "Draft" || p.status === "Returned") && (
                                    <button
                                      type="button"
                                      className="btn btn-success btn-sm"
                                      onClick={() => handleSubmitPpmp(p.id)}
                                    >
                                      Submit
                                    </button>
                                  )}
                                  {p.status === "Draft" && (
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => handleDeletePpmp(p.id, p.title)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                  {p.status === "Pending Budget Review" && (
                                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                      Awaiting Budget
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })()}

              {/* --- BUDGET OFFICE PPMP AUDIT (Dashboard) --- */}
              {user.role === "budget_office" && (
                <div className="dashboard-card budget-pending-card">
                  <div className="card-title-bar">
                    <div>
                      <h2 className="card-title">Pending PPMPs for Audit</h2>
                      <p className="page-subtitle">
                        Select Preview to open the full fitted review page, then verify the PPMP or return it for revision.
                      </p>
                    </div>
                    <span className="badge badge-warning">
                      {pendingPpmps.length} awaiting review
                    </span>
                  </div>
                  <div className="table-wrapper">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Office</th>
                          <th>Title</th>
                          <th>Year</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPpmps.length === 0 ? (
                          <tr>
                            <td colSpan="4">No pending PPMPs for review.</td>
                          </tr>
                        ) : (
                          pendingPpmps.map((p) => (
                            <tr key={p.id}>
                              <td>{getOfficeLabel(p.office_id)}</td>
                              <td>{p.title}</td>
                              <td>{p.fiscal_year}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleSelectPpmp(p.id)}
                                >
                                  <i className="fas fa-expand-arrows-alt" aria-hidden="true"></i>
                                  Preview
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- BAC ADMIN VIEW --- */}
              {user.role === "bac_admin" && (
                <div className="dashboard-card">
                  <div className="card-title-bar" style={{ marginBottom: "1rem" }}>
                    <div>
                      <h2 className="card-title">Verified PPMPs</h2>
                      <p className="page-subtitle">
                        Track which registered offices have submitted verified PPMPs for consolidation.
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <span className="badge badge-success">
                        {verifiedOfficeCount}/{activeOffices.length} offices verified
                      </span>
                      <button type="button" className="btn" onClick={() => handleConsolidate()} disabled={!allOfficesVerified}>
                        Run Consolidation
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", fontSize: "0.92rem" }}>
                      <strong>Submission progress</strong>
                      <span>{verifiedProgress}%</span>
                    </div>
                    <div style={{ width: "100%", height: "10px", background: "#e8eef3", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${verifiedProgress}%`, height: "100%", background: verifiedProgress === 100 ? "#2e7d32" : "#2563eb", transition: "width 0.3s ease" }} />
                    </div>
                  </div>

                  {allOfficesVerified ? (
                    <div className="page-subtitle" style={{ marginBottom: "1rem" }}>
                      All registered offices have verified PPMPs for FY {consolidationYear}.
                    </div>
                  ) : (
                    <div className="page-subtitle" style={{ marginBottom: "1rem" }}>
                      Waiting for {activeOffices.length - verifiedOfficeCount} more office{activeOffices.length - verifiedOfficeCount === 1 ? "" : "s"} to submit verified PPMPs before consolidation can proceed.
                    </div>
                  )}

                  <div className="table-wrapper">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Office</th>
                          <th>Title</th>
                          <th>Year</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {postingPpmps.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                              No verified PPMPs have been captured yet.
                            </td>
                          </tr>
                        ) : (
                          postingPpmps.map((ppmp) => (
                            <tr key={ppmp.id}>
                              <td>{ppmp.office_name || getOfficeLabel(ppmp.office_id)}</td>
                              <td>{ppmp.title}</td>
                              <td>{ppmp.fiscal_year}</td>
                              <td>
                                <span className="badge badge-success">Verified</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
          {activeTab === "all_ppmps" && user.role === "bac_admin" && (() => {
            const filteredAllPpmps = allPpmpsStatusFilter === "all"
              ? allPpmps
              : allPpmps.filter((p) => (p.status || "Draft") === allPpmpsStatusFilter);
            const filterEmptyLabel =
              allPpmpsStatusFilter === "Approved"
                ? "No verified PPMPs ready to download for FY " + consolidationYear + "."
                : allPpmpsStatusFilter === "all"
                  ? "No PPMPs found for FY " + consolidationYear + "."
                  : `No PPMPs with status "${allPpmpsStatusFilter}" for FY ${consolidationYear}.`;
            return (
            <div className="dashboard-card">
              <div className="card-title-bar" style={{ marginBottom: "1rem" }}>
                <div>
                  <h2 className="card-title">All PPMPs</h2>
                  <p className="page-subtitle">
                    View and download office PPMPs for FY {consolidationYear}.
                    {allPpmpsStatusFilter === "Approved"
                      ? " Showing verified (Approved) PPMPs ready to download."
                      : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem" }}>
                    <span>Status</span>
                    <select
                      className="form-input"
                      value={allPpmpsStatusFilter}
                      onChange={(e) => setAllPpmpsStatusFilter(e.target.value)}
                      style={{ minWidth: "200px" }}
                    >
                      <option value="all">All</option>
                      <option value="Approved">Verified (Approved)</option>
                      <option value="Pending Budget Review">Pending Budget Review</option>
                      <option value="Draft">Draft</option>
                      <option value="Returned">Returned</option>
                    </select>
                  </label>
                  <span className="badge badge-secondary">
                    {filteredAllPpmps.length} PPMP{filteredAllPpmps.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    onClick={fetchAllPpmps}
                    disabled={allPpmpsLoading}
                  >
                    <i className="fas fa-sync-alt" aria-hidden="true"></i>
                    {allPpmpsLoading ? " Loading..." : " Refresh"}
                  </button>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Office</th>
                      <th>Title</th>
                      <th>Year</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPpmpsLoading ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          Loading PPMPs...
                        </td>
                      </tr>
                    ) : filteredAllPpmps.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          {filterEmptyLabel}
                        </td>
                      </tr>
                    ) : (
                      filteredAllPpmps.map((ppmp) => (
                        <tr key={ppmp.id}>
                          <td>{ppmp.office_name || getOfficeLabel(ppmp.office_id)}</td>
                          <td>{ppmp.title}</td>
                          <td>{ppmp.fiscal_year}</td>
                          <td>
                            <span
                              className={`badge ${
                                ppmp.status === "Approved"
                                  ? "badge-success"
                                  : ppmp.status === "Pending Budget Review"
                                    ? "badge-warning"
                                    : ppmp.status === "Returned"
                                      ? "badge-danger"
                                      : "badge-secondary"
                              }`}
                            >
                              {ppmp.status === "Approved" ? "Verified" : (ppmp.status || "Draft")}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => handleSelectPpmp(ppmp.id)}
                              >
                                <i className="fas fa-expand-arrows-alt" aria-hidden="true"></i>
                                Preview
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={downloadingPpmpId === ppmp.id}
                                onClick={() =>
                                  downloadPpmpById(ppmp.id, ppmp.title, ppmp.fiscal_year)
                                }
                              >
                                <i className="fas fa-download" aria-hidden="true"></i>
                                {downloadingPpmpId === ppmp.id ? " Downloading..." : " Download"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })()}
          {(activeTab === "cse_app" || activeTab === "noncse_app") &&
            user.role === "bac_admin" &&
            renderAppWorkspace(activeTab === "cse_app" ? "cse" : "noncse")}
          {activeTab === "consolidated_apps" && user.role === "bac_admin" && (
            <div className="grid-2">
              <div className="dashboard-card">
                <h2 className="card-title">Consolidated APPs</h2>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Fiscal Year</th>
                      <th>Type</th>
                      <th>Created At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((a) => (
                      <tr key={a.id}>
                        <td>{a.title}</td>
                        <td>{a.fiscal_year}</td>
                        <td>{a.app_type || "Combined"}</td>
                        <td>{new Date(a.created_at + "Z").toLocaleDateString()}</td>
                        <td>
                          <button className="btn" onClick={() => handleSelectApp(a.id)}>View Rows</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                {selectedApp ? (
                  <div className="dashboard-card">
                    <h2 className="card-title">{selectedApp.app.title} Details</h2>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "8px 0 16px 0" }}>
                      <button className="btn" onClick={() => handleExportApp(selectedApp.app.fiscal_year, "cse")}>
                        Download CSE APP (.xlsx)
                      </button>
                      <button className="btn" onClick={() => handleExportApp(selectedApp.app.fiscal_year, "noncse")}>
                        Download Non-CSE APP (.xlsx)
                      </button>
                      <button className="btn" onClick={() => handleExportApp(selectedApp.app.fiscal_year, "combined")}>
                        Download Combined APP (.xlsx)
                      </button>
                    </div>
                    <div className="table-wrapper">
                      <table className="custom-table" style={{ fontSize: "11px" }}>
                        <thead>
                          <tr>
                            <th>Kind</th>
                            <th>Description</th>
                            <th>Type</th>
                            <th>Qty/Size</th>
                            <th>Mode</th>
                            <th>Fund Source</th>
                            <th>Timeline (Start→End)</th>
                            <th>Est. Budget</th>
                            <th>End-User Offices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedApp.rows.map((row) => (
                            <tr key={row.id}>
                              <td>{row.is_cse ? "CSE" : "Non-CSE"}</td>
                              <td>{row.description}</td>
                              <td>{row.project_type || "—"}</td>
                              <td>{row.quantity_size || "—"}</td>
                              <td>{row.procurement_mode}</td>
                              <td>{row.fund_source || "—"}</td>
                              <td>{(row.proc_start || "—") + " → " + (row.proc_end || "—")}</td>
                              <td>₱{Number(row.total_estimated_budget || 0).toLocaleString()}</td>
                              <td>{row.end_user_offices || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="dashboard-card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    Select an APP from the left list to view consolidated procurement rows.
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === "audit" && user.role === "bac_admin" && (
            <div className="grid-2-wide">
              <div className="dashboard-card">
                <h2 className="card-title">Pending PPMPs for Audit</h2>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Office</th>
                      <th>Title</th>
                      <th>Year</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPpmps.length === 0 ? (
                      <tr>
                        <td colSpan="4">No pending PPMPs for review.</td>
                      </tr>
                    ) : (
                      pendingPpmps.map((p) => (
                        <tr key={p.id}>
                          <td>{getOfficeLabel(p.office_id)}</td>
                          <td>{p.title}</td>
                          <td>{p.fiscal_year}</td>
                          <td>
                            <button className="btn" onClick={() => handleSelectPpmp(p.id)}>Preview</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                {selectedPpmp && auditDetails ? (
                  <div className="dashboard-card">
                    <h2 className="card-title">Audit Workspace: {selectedPpmp.ppmp.title}</h2>

                    <div style={{ marginBottom: "1.5rem" }}>
                      <h3 style={{ margin: 0, fontSize: "1rem" }}>PPMP Preview</h3>
                      <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        Review the full PPMP content before continuing with the audit workflow.
                      </p>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "16px", padding: "1rem", background: "white", overflow: "hidden" }}>
                      {renderNgpaPpmpForm(selectedPpmp)}
                    </div>
                  </div>
                ) : (
                  <div className="dashboard-card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    Select a PPMP to review budget details.
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === "indicative" && user.role === "budget_office" && (
            <div className="dashboard-card">
              <h2 className="card-title">Post to BAC</h2>
              <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
                After you validate a PPMP (CSE or nonCSE), post it here so BAC can consolidate into the APP.
                Posted files are stored on Drive <strong>CSE-PPMP</strong> or <strong>nonCSE-PPMP</strong> (per office)
                for file-based consolidation. Unposting removes the Drive copy and returns the plan to the end user for revision.
              </p>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Office</th>
                    <th>Title</th>
                    <th>Year</th>
                    <th>Validation</th>
                    <th>Posting</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {postingPpmps.length === 0 ? (
                    <tr>
                      <td colSpan="6">No validated PPMPs ready to post. Approve pending plans from the Dashboard first.</td>
                    </tr>
                  ) : (
                    postingPpmps.map((p) => (
                      <tr key={p.id}>
                        <td>{p.office_name || getOfficeLabel(p.office_id)}</td>
                        <td>{p.title}</td>
                        <td>{p.fiscal_year}</td>
                        <td>
                          <span className="badge badge-success">{p.status}</span>
                        </td>
                        <td>
                          <span className={`badge ${p.posting_status === "Posted" ? "badge-warning" : "badge-secondary"}`}>
                            {p.posting_status || "Draft"}
                          </span>
                        </td>
                        <td>
                          {(p.posting_status || "Draft") === "Draft" && (
                            <button className="btn" onClick={() => handlePostPpmp(p.id)}>Post</button>
                          )}
                          {p.posting_status === "Posted" && (
                            <button className="btn btn-danger" onClick={() => handleUnpostPpmp(p.id)}>Unpost</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === "final" && user.role === "budget_office" && (
            <div className="dashboard-card">
              <h2 className="card-title">Final PPMP</h2>
              <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
                End users who have submitted or had their Final PPMP approved (RA 12009 Phase 4).
                Supplemental revisions (v2+) appear as separate entries.
              </p>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Office</th>
                    <th>Fiscal Year</th>
                    <th>Version</th>
                    <th>Approval Status</th>
                    <th>Submitted</th>
                    <th>Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {finalPpmps.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        No Final PPMP submissions yet. End users will submit Final PPMPs after budget approval (Phase 4).
                      </td>
                    </tr>
                  ) : (
                    finalPpmps.map((p) => (
                      <tr key={p.id}>
                        <td>{p.office_name}</td>
                        <td>{p.fiscal_year}</td>
                        <td>
                          <span className={`badge ${p.is_supplemental ? "badge-warning" : "badge-secondary"}`}>
                            {p.is_supplemental ? `Supplemental v${p.version}` : "Original"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${p.approval_status === "Approved" ? "badge-success" : p.approval_status === "Submitted" ? "badge-warning" : "badge-secondary"}`}>
                            {p.approval_status}
                          </span>
                        </td>
                        <td>{p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : "—"}</td>
                        <td>{p.approved_at ? new Date(p.approved_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
{activeTab === "app_signatory" && user.role === "bac_admin" && (
            <div className="signatory-section">
              <div className="signatory-section-header">
                <h2 className="signatory-section-title">APP Signatory Information</h2>
                <p className="signatory-section-subtitle">
                  Names and designations applied to both CSE and nonCSE Annual Procurement Plan footers (preview and Excel export)
                </p>
              </div>

              <form onSubmit={handleUpdateAppSignatory} className="signatory-form">
                <div className="signatory-form-grid-horizontal">
                  <div className="signatory-section-group">
                    <h3 className="signatory-section-group-title">Prepared by (BAC Secretariat)</h3>
                    <div className="form-group">
                      <label className="form-label" htmlFor="appSigPreparedBy">Name</label>
                      <input
                        id="appSigPreparedBy"
                        className="form-input"
                        value={appSigPreparedBy}
                        onChange={(e) => setAppSigPreparedBy(e.target.value)}
                        placeholder="Printed name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="appSigPreparedDesig">Position / Designation</label>
                      <input
                        id="appSigPreparedDesig"
                        className="form-input"
                        value={appSigPreparedDesig}
                        onChange={(e) => setAppSigPreparedDesig(e.target.value)}
                        placeholder="e.g. Head, BAC Secretariat"
                      />
                    </div>
                  </div>

                  <div className="signatory-section-group">
                    <h3 className="signatory-section-group-title">Recommended by (BAC Chairperson)</h3>
                    <div className="form-group">
                      <label className="form-label" htmlFor="appSigRecommendedBy">Name</label>
                      <input
                        id="appSigRecommendedBy"
                        className="form-input"
                        value={appSigRecommendedBy}
                        onChange={(e) => setAppSigRecommendedBy(e.target.value)}
                        placeholder="Printed name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="appSigRecommendedDesig">Position / Designation</label>
                      <input
                        id="appSigRecommendedDesig"
                        className="form-input"
                        value={appSigRecommendedDesig}
                        onChange={(e) => setAppSigRecommendedDesig(e.target.value)}
                        placeholder="e.g. BAC Chairperson"
                      />
                    </div>
                  </div>

                  <div className="signatory-section-group">
                    <h3 className="signatory-section-group-title">Approved by (Head of the Procuring Entity)</h3>
                    <div className="form-group">
                      <label className="form-label" htmlFor="appSigApprovedBy">Name</label>
                      <input
                        id="appSigApprovedBy"
                        className="form-input"
                        value={appSigApprovedBy}
                        onChange={(e) => setAppSigApprovedBy(e.target.value)}
                        placeholder="Printed name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="appSigApprovedDesig">Position / Designation</label>
                      <input
                        id="appSigApprovedDesig"
                        className="form-input"
                        value={appSigApprovedDesig}
                        onChange={(e) => setAppSigApprovedDesig(e.target.value)}
                        placeholder="e.g. City Mayor"
                      />
                    </div>
                  </div>

                  <div className="signatory-section-group">
                    <div className="signatory-submit-row">
                      <button type="submit" className="btn signatory-submit-btn">
                        <i className="fas fa-save" aria-hidden="true"></i>
                        {appSignatoryLoaded ? "Update APP Signatory" : "Save APP Signatory"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}

          {activeTab === "offices" && user.role === "bac_admin" && (
            <div className="grid-2-wide">
              <div className="dashboard-card">
                <h2 className="card-title">Register End User</h2>
                <form onSubmit={handleSaveUser} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Username"
                    className="form-input"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toUpperCase())}
                    style={{ textTransform: "uppercase" }}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="form-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder={editingUserId ? "New Password (leave blank to keep)" : "Password"}
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required={!editingUserId}
                  />
                  <input
                    type="password"
                    placeholder={editingUserId ? "Confirm New Password" : "Confirm Password"}
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!editingUserId}
                  />
                  <select
                    className="form-input"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                  >
                    <option value="end_user">End-User (Office Representative)</option>
                    <option value="budget_office">Budget Office Officer</option>
                    <option value="bac_admin">BAC Secretariat / Admin</option>
                  </select>
                  {newUserRole === "end_user" && (
                    <>
                      <input
                        type="text"
                        placeholder="Office / End-User Name"
                        className="form-input"
                        value={newOfficeName}
                        onChange={(e) => setNewOfficeName(e.target.value)}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Office Code (e.g. CMO, CHO, GSO)"
                        className="form-input"
                        value={newOfficeCode}
                        onChange={(e) => setNewOfficeCode(e.target.value.toUpperCase())}
                        style={{ textTransform: "uppercase" }}
                        required
                      />
                    </>
                  )}
                  {editingUserId && (
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={newUserActive}
                        onChange={(e) => setNewUserActive(e.target.checked)}
                      />
                      Active account
                    </label>
                  )}
                  <div className="ppmp-row-actions">
                    <button type="submit" className="btn">
                      {editingUserId ? "Update User" : "Register User"}
                    </button>
                    {editingUserId && (
                      <button type="button" className="btn btn-secondary" onClick={resetUserForm}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="dashboard-card">
                <h2 className="card-title">Registered Users</h2>
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Password</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Office</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registeredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="8">No users registered yet.</td>
                        </tr>
                      ) : (
                        registeredUsers.map((u) => (
                          <tr key={u.id}>
                            <td>{u.username}</td>
                            <td>
                              {u.role === "end_user" || u.role === "budget_office" ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    minWidth: "120px",
                                  }}
                                >
                                  <code
                                    style={{
                                      userSelect: revealedUserPasswords[u.id] ? "all" : "none",
                                      letterSpacing: revealedUserPasswords[u.id] ? "normal" : "0.12em",
                                    }}
                                  >
                                    {revealedUserPasswords[u.id] || "••••••••"}
                                  </code>
                                  <button
                                    type="button"
                                    className="password-toggle-btn"
                                    style={{ position: "static", padding: "4px" }}
                                    onClick={() => {
                                      if (revealedUserPasswords[u.id]) {
                                        hideRevealedUserPassword(u.id);
                                      } else {
                                        openPasswordRevealModal(u);
                                      }
                                    }}
                                    aria-label={
                                      revealedUserPasswords[u.id]
                                        ? "Hide password"
                                        : "Show password"
                                    }
                                    title={
                                      revealedUserPasswords[u.id]
                                        ? "Hide password"
                                        : "Enter administrator password to view"
                                    }
                                  >
                                    {revealedUserPasswords[u.id] ? (
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                      </svg>
                                    ) : (
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ opacity: 0.55 }}>—</span>
                              )}
                            </td>
                            <td>{u.email}</td>
                            <td>{formatRole(u.role)}</td>
                            <td>{getOfficeLabel(u.office_id)}</td>
                            <td>
                              <span className={`badge ${u.is_active ? "badge-success" : "badge-secondary"}`}>
                                {u.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
                            <td>
                              <div className="ppmp-row-actions">
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleEditUser(u)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={u.id === user.id}
                                  title={u.id === user.id ? "You cannot delete your own account" : "Delete user"}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {activeTab === "dbm" && user.role === "bac_admin" && (
            <div className="dashboard-card">
              <h2 className="card-title">DBM Classification</h2>

              {/* Add DBM Classification Form */}
              <div className="dashboard-card" style={{ marginBottom: "20px" }}>
                <h3 className="card-title">Add New DBM Classification</h3>
                <form onSubmit={handleAddDbmClassification} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Code (e.g., 101)"
                    className="form-input"
                    value={newDbmCode}
                    onChange={(e) => setNewDbmCode(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Project Title"
                    className="form-input"
                    value={newDbmProjectTitle}
                    onChange={(e) => setNewDbmProjectTitle(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Classification"
                    className="form-input"
                    value={newDbmClassification}
                    onChange={(e) => setNewDbmClassification(e.target.value)}
                    required
                  />

                  <button type="submit" className="btn">Add Classification</button>
                </form>
              </div>

              {/* DBM Classification Table */}
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Project Title</th>
                      <th>Classification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbmClassification.length === 0 ? (
                      <tr>
                        <td colSpan="4">No DBM classifications found.</td>
                      </tr>
                    ) : (
                      dbmClassification.map((c) => (
                        <tr key={c.id}>
                          <td>{c.code}</td>
                          <td>{c.project_title}</td>
                          <td>{c.classification}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === "audit" && user.role === "bac_admin" && (
            <div className="dashboard-card" style={{ marginTop: "1.5rem" }}>
              <h2 className="card-title">Pending Indicative PPMPs for Approval</h2>
              <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
                Review and approve indicative PPMPs posted by budget office
              </p>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Office</th>
                    <th>Title</th>
                    <th>Year</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {indicativePpmps.length === 0 ? (
                    <tr>
                      <td colSpan="5">No indicative PPMPs pending approval.</td>
                    </tr>
                  ) : (
                    indicativePpmps.map((p) => (
                      <tr key={p.id}>
                        <td>{getOfficeLabel(p.office_id)}</td>
                        <td>{p.title}</td>
                        <td>{p.fiscal_year}</td>
                        <td>
                          <span className="badge badge-warning">Posted</span>
                        </td>
                        <td>
                          <button className="btn btn-success" onClick={() => handleApproveIndicativePpmp(p.id)}>Approve</button>
                          <button className="btn btn-danger" style={{ marginLeft: "10px" }} onClick={() => handleRejectIndicativePpmp(p.id)}>Reject</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

{activeTab === "audit" && user.role === "bac_admin" && (
          <footer className="workspace-footer">
            <div className="workspace-footer-inner">
              <h2 className="workspace-footer-title">RA 12009 Approval Guidelines</h2>
              <div className="workspace-footer-content">
                <h3>Review Checklist</h3>
                <ul>
                  <li><strong>Market Scoping:</strong> Verify market research documentation is complete</li>
                  <li><strong>Budget Alignment:</strong> Confirm total requested amount is within office allocation</li>
                  <li><strong>Life-Cycle Costing:</strong> Check if operating/maintenance costs are included</li>
                  <li><strong>Digital Compliance:</strong> Ensure all required electronic forms are submitted</li>
                </ul>
                <p className="workspace-footer-note">
                  <i className="fas fa-info-circle" aria-hidden="true"></i>
                  Approved PPMPs will be available for consolidation in the APP process
                </p>
              </div>
            </div>
          </footer>
        )}
      </main>

      {/* --- BUDGET OFFICE FULL-SCREEN PPMP REVIEW --- */}
      {user.role === "budget_office" && activeTab === "dashboard" && selectedPpmp && auditDetails && (
        <div
          className="ppmp-fullscreen budget-review-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-review-title"
        >
          <header className="ppmp-fullscreen-header">
            <button
              type="button"
              className="btn btn-secondary ppmp-fullscreen-back"
              onClick={closeBudgetReview}
            >
              <i className="fas fa-arrow-left" aria-hidden="true"></i>
              Back to Pending PPMPs
            </button>

            <div className="ppmp-fullscreen-title">
              <span className="budget-review-eyebrow">Budget Office Review</span>
              <h1 id="budget-review-title">{selectedPpmp.ppmp.title}</h1>
              <div className="ppmp-fullscreen-meta">
                <span className={`badge ${selectedPpmp.ppmp.status === "Approved" ? "badge-success" : "badge-warning"}`}>
                  {selectedPpmp.ppmp.status}
                </span>
                {renderPpmpTypeBadge(selectedPpmp.ppmp.is_cse)}
                <span className="ppmp-fullscreen-year">
                  Fiscal Year {selectedPpmp.ppmp.fiscal_year}
                </span>
                <span>{auditDetails.office_name}</span>
              </div>
            </div>

            <div className="ppmp-fullscreen-actions" aria-label="PPMP review actions">
              <button
                type="button"
                className="btn btn-success"
                onClick={() => handleReviewAction(selectedPpmp.ppmp.id, "approve")}
                disabled={reviewBusy}
              >
                <i className="fas fa-check" aria-hidden="true"></i>
                {reviewBusy ? "Saving…" : "Verified"}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setRemarks("");
                  setReviseModalOpen(true);
                }}
                disabled={reviewBusy}
              >
                <i className="fas fa-undo" aria-hidden="true"></i>
                Revise
              </button>
            </div>
          </header>

          <div className="ppmp-fullscreen-body">
            <div className="budget-review-intro">
              <div>
                <h2>PPMP Preview</h2>
                <p>Review the full plan before marking it as verified or returned for revision.</p>
              </div>
            </div>

            <div className="budget-review-form-frame">
              {renderNgpaPpmpForm(selectedPpmp)}
            </div>
          </div>
        </div>
      )}

      {notification.message && (
        <div
          className={`notification-toast alert alert-${notification.type}`}
          role="status"
          aria-live="polite"
        >
          <div className="notification-toast-body">
            <i
              className={`fas ${
                notification.type === "danger" ? "fa-exclamation-circle" : "fa-check-circle"
              }`}
              aria-hidden="true"
            ></i>
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            className="notification-toast-close"
            onClick={dismissNotification}
            aria-label="Dismiss notification"
          >
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {confirmDialog.open && (
        <div
          className="confirm-modal-overlay"
          role="presentation"
          onClick={closeConfirm}
        >
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-header">
              <h2 id="confirm-modal-title" className="confirm-modal-title">
                {confirmDialog.title}
              </h2>
              <button
                type="button"
                className="confirm-modal-close"
                onClick={closeConfirm}
                aria-label="Close"
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <p className="confirm-modal-message">{confirmDialog.message}</p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeConfirm}
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                type="button"
                className={`btn ${
                  confirmDialog.variant === "danger" ? "btn-danger" : "btn-success"
                }`}
                onClick={handleConfirmClick}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviseModalOpen && (
        <div
          className="confirm-modal-overlay"
          role="presentation"
          onClick={() => { setReviseModalOpen(false); setRemarks(""); }}
        >
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="revise-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-header">
              <h2 id="revise-modal-title" className="confirm-modal-title">
                Revise PPMP
              </h2>
              <button
                type="button"
                className="confirm-modal-close"
                onClick={() => { setReviseModalOpen(false); setRemarks(""); }}
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <p className="confirm-modal-message">
              Please provide remarks explaining why this PPMP needs revision for the end user.
            </p>
            <textarea
              className="form-input"
              placeholder="Enter revision remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{ minHeight: "110px", marginBottom: "1rem", fontSize: "0.9rem" }}
            />
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setReviseModalOpen(false); setRemarks(""); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleReviewAction(selectedPpmp.ppmp.id, "return")}
                disabled={reviewBusy}
              >
                Confirm Revise
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordRevealModal.open && (
        <div
          className="confirm-modal-overlay"
          role="presentation"
          onClick={closePasswordRevealModal}
        >
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-reveal-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-header">
              <h2 id="password-reveal-modal-title" className="confirm-modal-title">
                Administrator verification
              </h2>
              <button
                type="button"
                className="confirm-modal-close"
                onClick={closePasswordRevealModal}
                aria-label="Close"
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <p className="confirm-modal-message">
              Enter your bacadmin password to view the login password for{" "}
              <strong>{passwordRevealModal.username}</strong>.
            </p>
            <form onSubmit={submitAdminPasswordReveal}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label className="form-label" htmlFor="admin-reveal-password">
                  Administrator password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="admin-reveal-password"
                    type={showAdminRevealPassword ? "text" : "password"}
                    className="form-input"
                    value={adminRevealPassword}
                    onChange={(e) => {
                      setAdminRevealPassword(e.target.value);
                      if (adminRevealError) setAdminRevealError("");
                    }}
                    placeholder="Your bacadmin password"
                    autoComplete="current-password"
                    autoFocus
                    disabled={adminRevealBusy}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowAdminRevealPassword((prev) => !prev)}
                    aria-label={
                      showAdminRevealPassword
                        ? "Hide administrator password"
                        : "Show administrator password"
                    }
                    tabIndex={-1}
                  >
                    {showAdminRevealPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {adminRevealError && (
                  <p style={{ color: "var(--danger, #b91c1c)", marginTop: "8px", fontSize: "0.9rem" }}>
                    {adminRevealError}
                  </p>
                )}
              </div>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closePasswordRevealModal}
                  disabled={adminRevealBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={adminRevealBusy}
                >
                  {adminRevealBusy ? "Verifying…" : "Reveal password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
  