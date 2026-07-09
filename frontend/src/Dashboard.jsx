import React, { useState, useEffect } from "react";

function Dashboard({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [ppmps, setPpmps] = useState([]);
  const [selectedPpmp, setSelectedPpmp] = useState(null);

  // End-User state
  const [newPpmpTitle, setNewPpmpTitle] = useState("");
  const [newPpmpYear, setNewPpmpYear] = useState(new Date().getFullYear() + 1);
  const [newPpmpType, setNewPpmpType] = useState("Indicative");

  // Item Form state
  const [itemDesc, setItemDesc] = useState("");
  const [itemCat, setItemCat] = useState("Office Supplies");
  const [itemIsCse, setItemIsCse] = useState(false);
  const [itemQty, setItemQty] = useState(1);
  const [itemUnit, setItemUnit] = useState("pc");
  const [itemCost, setItemCost] = useState(0.0);
  const [itemProcMode, setItemProcMode] = useState("Shopping");
  const [q1, setQ1] = useState(0);
  const [q2, setQ2] = useState(0);
  const [q3, setQ3] = useState(0);
  const [q4, setQ4] = useState(0);

  // Budget Office state
  const [pendingPpmps, setPendingPpmps] = useState([]);
  const [indicativePpmps, setIndicativePpmps] = useState([]);
  const [auditDetails, setAuditDetails] = useState(null);
  const [remarks, setRemarks] = useState("");

  // BAC Admin state
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [newOfficeCode, setNewOfficeCode] = useState("");
  const [newOfficeBudget, setNewOfficeBudget] = useState(0);
  const [offices, setOffices] = useState([]);
  const [consolidationYear, setConsolidationYear] = useState(new Date().getFullYear() + 1);
  const [dbmClassification, setDbmClassification] = useState([]);

  // DBM Classification form state
  const [newDbmCode, setNewDbmCode] = useState("");
  const [newDbmProjectTitle, setNewDbmProjectTitle] = useState("");
  const [newDbmClassification, setNewDbmClassification] = useState("");
  const [newDbmDescription, setNewDbmDescription] = useState("");

  // Signatory state
  const [submittedBy, setSubmittedBy] = useState("");
  const [submittedByDesignation, setSubmittedByDesignation] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [preparedByDesignation, setPreparedByDesignation] = useState("");
  const [aipReference, setAipReference] = useState("");
  const [responsibilityCenterNo, setResponsibilityCenterNo] = useState("");
  const [officeCodeFromPR, setOfficeCodeFromPR] = useState("");

  // Budget Allocation state (for end users)
  const [userBudgetAllocation, setUserBudgetAllocation] = useState(0);
  const [userOfficeBudget, setUserOfficeBudget] = useState(0);

  // Registration state
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("end_user");
  const [newUserOfficeId, setNewUserOfficeId] = useState("");
  const [registeredUsers, setRegisteredUsers] = useState([]);

  const [notification, setNotification] = useState({ message: "", type: "" });

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: "", type: "" }), 5000);
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = () => {
    if (user.role === "end_user") {
      fetchOfficePpmps();
    } else if (user.role === "budget_office") {
      fetchPendingPpmps();
      fetchIndicativePpmps();
      fetchOffices();
    } else if (user.role === "bac_admin") {
      fetchApps();
      fetchOffices();
      fetchUsers();
      fetchDbmClassification();
      fetchPendingPpmps();
      fetchIndicativePpmps();
    }
  };

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "users") {
      fetchUsers();
    }
  }, [activeTab, user.role]);

  useEffect(() => {
    if (user.role === "budget_office" && activeTab === "indicative") {
      fetchIndicativePpmps();
      fetchOffices();
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
    if (user.role === "end_user" && activeTab === "budget_allocation") {
      fetchUserOfficeBudget();
    }
  }, [activeTab, user.role]);

  // --- API FETCHERS ---

  const fetchOfficePpmps = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/offices/ppmps", {
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
      const res = await fetch("http://localhost:8000/api/budget/pending", {
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
        ? "http://localhost:8000/api/budget/indicative"
        : "http://localhost:8000/api/budget/indicative/pending";
      const res = await fetch(url, {
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

  const fetchApps = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/bac/apps", {
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
      const res = await fetch("http://localhost:8000/api/offices", {
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
      const res = await fetch("http://localhost:8000/api/auth/users", {
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
      const res = await fetch("http://localhost:8000/api/dbm/classifications", {
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
      const res = await fetch("http://localhost:8000/api/dbm/classifications", {
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
      const res = await fetch(`http://localhost:8000/api/offices/ppmps/${ppmpId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPpmp(data);
        if (user.role === "budget_office" || user.role === "bac_admin") {
          loadAudit(ppmpId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAudit = async (ppmpId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/budget/ppmps/${ppmpId}/audit`, {
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

  const handleCreatePpmp = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/offices/ppmps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newPpmpTitle,
          fiscal_year: newPpmpYear,
          type: newPpmpType,
          office_id: user.office_id,
        }),
      });
      if (res.ok) {
        showNotification("PPMP created successfully!");
        setNewPpmpTitle("");
        fetchOfficePpmps();
      }
    } catch (err) {
      showNotification("Failed to create PPMP", "danger");
    }
  };

  const handleAddPpmpItem = async (e) => {
    e.preventDefault();
    if (!selectedPpmp) return;
    try {
      const res = await fetch(`http://localhost:8000/api/offices/ppmps/${selectedPpmp.ppmp.id}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: itemDesc,
          category: itemCat,
          is_cse: itemIsCse,
          quantity: parseInt(itemQty),
          unit_of_measure: itemUnit,
          unit_cost: parseFloat(itemCost),
          procurement_mode: itemProcMode,
          q1_qty: parseInt(q1),
          q2_qty: parseInt(q2),
          q3_qty: parseInt(q3),
          q4_qty: parseInt(q4),
        }),
      });
      if (res.ok) {
        showNotification("Item added to PPMP!");
        setItemDesc("");
        setItemQty(1);
        setItemCost(0.0);
        setQ1(0); setQ2(0); setQ3(0); setQ4(0);
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
      const res = await fetch(`http://localhost:8000/api/offices/ppmps/${selectedPpmp.ppmp.id}/items/${itemId}`, {
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
      const res = await fetch(`http://localhost:8000/api/offices/ppmps/${ppmpId}/submit`, {
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

  const handleReviewAction = async (ppmpId, action) => {
    try {
      const res = await fetch(`http://localhost:8000/api/budget/ppmps/${ppmpId}/review?action=${action}&remarks=${remarks}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification(`PPMP successfully ${action}d!`);
        setSelectedPpmp(null);
        setAuditDetails(null);
        setRemarks("");
        fetchPendingPpmps();
      }
    } catch (err) {
      showNotification("Error completing review", "danger");
    }
  };

  const handlePostIndicativePpmp = async (ppmpId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/budget/indicative/ppmps/${ppmpId}/post`, {
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
      const res = await fetch(`http://localhost:8000/api/budget/indicative/ppmps/${ppmpId}/unpost`, {
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
      const res = await fetch(`http://localhost:8000/api/bac/indicative/ppmps/${ppmpId}/approve`, {
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
      const res = await fetch(`http://localhost:8000/api/bac/indicative/ppmps/${ppmpId}/reject`, {
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

  const handleCreateOffice = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/bac/offices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newOfficeName,
          code: newOfficeCode,
          budget_allocation: parseFloat(newOfficeBudget),
        }),
      });
      if (res.ok) {
        showNotification("Office created successfully");
        setNewOfficeName("");
        setNewOfficeCode("");
        setNewOfficeBudget(0);
        fetchOffices();
      }
    } catch (err) {
      showNotification("Failed to create office", "danger");
    }
  };

  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showNotification("Passwords do not match", "danger");
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          hashed_password: newPassword,
          role: newUserRole,
          office_id: newUserRole === "end_user" ? parseInt(newUserOfficeId) : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showNotification("User registered successfully!");
        setNewUsername("");
        setNewEmail("");
        setNewPassword("");
        setConfirmPassword("");
        setNewUserRole("end_user");
        setNewUserOfficeId("");
        fetchUsers();
      } else {
        showNotification(data.detail || "Registration failed", "danger");
      }
    } catch (err) {
      showNotification("Network error. Make sure the FastAPI backend is running.", "danger");
    }
  };

  const handleConsolidate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:8000/api/bac/consolidate/${consolidationYear}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(`APP Consolidated successfully for FY ${consolidationYear}!`);
        fetchApps();
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
      const res = await fetch(`http://localhost:8000/api/bac/apps/${fiscalYear}/export/${kind}`, {
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
      const res = await fetch(`http://localhost:8000/api/bac/apps/${appId}`, {
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
    indicative: "Indicative PPMP Management",
    offices: "Manage Offices",
    users: "Manage Users",
    dbm: "DBM Classification",
    audit: "Pending PPMP Review",
    budget_allocation: "Budget Allocation",
  };
  const handleUpdateSignatory = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/api/offices/signatory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          submitted_by: submittedBy,
          submitted_by_designation: submittedByDesignation,
          prepared_by: preparedBy,
          prepared_by_designation: preparedByDesignation,
          aip_reference: aipReference,
          responsibility_center_no: responsibilityCenterNo,
          office_code_from_pr: officeCodeFromPR,
          office_id: user.office_id,
        }),
      });
      if (res.ok) {
        showNotification("Signatory information updated successfully!");
      } else {
        showNotification("Failed to update signatory information", "danger");
      }
    } catch (err) {
      showNotification("Network error occurred", "danger");
    }
  };

  // --- BUDGET ALLOCATION FUNCTIONS FOR END USERS ---
  const fetchUserOfficeBudget = async () => {
    if (!user.office_id) {
      showNotification("User is not assigned to any office", "danger");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/offices/budget/${user.office_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserOfficeBudget(data.budget_allocation);
      } else {
        const errData = await res.json();
        showNotification(errData.detail || "Failed to fetch budget allocation", "danger");
      }
    } catch (err) {
      showNotification("Network error fetching budget allocation", "danger");
    }
  };

  const handleUpdateBudgetAllocation = async (e) => {
    e.preventDefault();
    if (!user.office_id) {
      showNotification("User is not assigned to any office", "danger");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/offices/budget/${user.office_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          budget_allocation: parseFloat(userBudgetAllocation),
        }),
      });
      if (res.ok) {
        showNotification("Budget allocation updated successfully!");
        setUserBudgetAllocation(0);
        fetchUserOfficeBudget();
        fetchOffices(); // Refresh offices list for other roles
      } else {
        const errData = await res.json();
        showNotification(errData.detail || "Failed to update budget allocation", "danger");
      }
    } catch (err) {
      showNotification("Failed to update budget allocation", "danger");
    }
  };
  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/Ormoc_City.png" alt="Ormoc City" />
          </div>
          <h2 className="sidebar-title">PPMP System</h2>
          <p className="sidebar-subtitle">RA 12009 Consolidation</p>
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
            {user.role === "budget_office" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "indicative" ? "active" : ""}`}
                onClick={() => { setActiveTab("indicative"); setSelectedPpmp(null); setAuditDetails(null); }}
              >
                <i className="fas fa-file-invoice" aria-hidden="true"></i>
                Indicative PPMP
              </button>
            )}
            {user.role === "end_user" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "view_ppmps" ? "active" : ""}`}
                onClick={() => { setActiveTab("view_ppmps"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-th-large" aria-hidden="true"></i>
                View PPMPs
              </button>
            )}
{user.role === "end_user" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "signatory" ? "active" : ""}`}
                onClick={() => { setActiveTab("signatory"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-th-large" aria-hidden="true"></i>
                Signatory
              </button>
            )}
            {user.role === "end_user" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "budget_allocation" ? "active" : ""}`}
                onClick={() => { setActiveTab("budget_allocation"); setSelectedPpmp(null); setSelectedApp(null); }}
              >
                <i className="fas fa-wallet" aria-hidden="true"></i>
                Budget Allocation
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "offices" ? "active" : ""}`}
                onClick={() => { setActiveTab("offices"); }}
              >
                <i className="fas fa-building" aria-hidden="true"></i>
                Manage Offices
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "users" ? "active" : ""}`}
                onClick={() => { setActiveTab("users"); }}
              >
                <i className="fas fa-users" aria-hidden="true"></i>
                Manage Users
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "dbm" ? "active" : ""}`}
                onClick={() => { setActiveTab("dbm"); }}
              >
                <i className="fas fa-file-alt" aria-hidden="true"></i>
                DBM Classification
              </button>
            )}
            {user.role === "bac_admin" && (
              <button
                type="button"
                className={`nav-link ${activeTab === "audit" ? "active" : ""}`}
                onClick={() => { setActiveTab("audit"); setSelectedPpmp(null); setAuditDetails(null); }}
              >
                <i className="fas fa-clipboard-check" aria-hidden="true"></i>
                Pending PPMP Review
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

        {notification.message && (
          <div className={`alert alert-${notification.type}`}>
            {notification.message}
          </div>
        )}

        <div className="workspace">

          {activeTab === "dashboard" && (
            <div>
              {/* --- END-USER VIEW --- */}
              {user.role === "end_user" && (
                <div className="grid-2">
                  <div>
                    <div className="dashboard-card">
                      <h2 className="card-title">Create PPMP</h2>
                      <div style={{ 
                        backgroundColor: "#e8f4fd", 
                        border: "1px solid #2196f3", 
                        borderRadius: "6px", 
                        padding: "12px", 
                        marginBottom: "10px",
                        fontSize: "13px"
                      }}>
                        <strong>Note:</strong> All PPMPs created at this stage are <strong>Indicative</strong> (pre-budget approval). 
                        The "Final" status will be applied automatically after budget approval and consolidation, 
                        in accordance with RA 12009 process flow.
                      </div>
                      <form onSubmit={handleCreatePpmp} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="PPMP Title (e.g., Office Supplies 2027)"
                          value={newPpmpTitle}
                          onChange={(e) => setNewPpmpTitle(e.target.value)}
                          required
                        />
                        <input
                          type="hidden"
                          value={newPpmpType}
                        />
                        <div className="form-input" style={{ backgroundColor: "#f5f5f5", color: "#666", cursor: "not-allowed" }}>
                          Indicative PPMP (pre-budget approval)
                        </div>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Fiscal Year"
                          value={newPpmpYear}
                          onChange={(e) => setNewPpmpYear(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn">Create PPMP</button>
                      </form>
                    </div>
```

                    <div className="dashboard-card" style={{ marginTop: "20px" }}>
                      <h2 className="card-title">My Office PPMPs</h2>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Year</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ppmps.length === 0 ? (
                            <tr>
                              <td colSpan="5">No PPMPs created yet.</td>
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
                                  {p.status === "Returned" && p.remarks && (
                                    <div style={{ fontSize: "12px", color: "#d32f2f", marginTop: "5px" }}>
                                      <strong>Remarks:</strong> {p.remarks}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <button className="btn" onClick={() => handleSelectPpmp(p.id)}>View/Edit</button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* PPMP Items Workspace */}
                  <div>
                    {selectedPpmp ? (
                      <div className="dashboard-card">
                        <h2 className="card-title">{selectedPpmp.ppmp.title} Items ({selectedPpmp.ppmp.status})</h2>

                        {/* Submit PPMP if in Draft or Returned */}
                        {(selectedPpmp.ppmp.status === "Draft" || selectedPpmp.ppmp.status === "Returned") && (
                          <button
                            className="btn btn-success"
                            style={{ marginBottom: "15px", width: "100%" }}
                            onClick={() => handleSubmitPpmp(selectedPpmp.ppmp.id)}
                          >
                            Submit to Budget Office
                          </button>
                        )}

                        {/* Display remarks if PPMP was returned for revision */}
                        {selectedPpmp.ppmp.status === "Returned" && selectedPpmp.ppmp.remarks && (
                          <div className="dashboard-card" style={{ 
                            backgroundColor: "#fffafa", 
                            borderLeft: "4px solid var(--danger-color)", 
                            marginTop: "20px",
                            marginBottom: "24px",
                            padding: "1.25rem",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                          }}>
                            <h3 style={{ color: "#b91c1c", fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "8px" }}>
                              <i className="fas fa-exclamation-triangle"></i>
                              Revision Required
                            </h3>
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                              <strong>Budget Office Remarks:</strong>
                            </p>
                            <div style={{ fontSize: "0.875rem", lineHeight: "1.6", color: "var(--text-primary)", background: "#ffffff", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)", fontStyle: "italic" }}>
                              "{selectedPpmp.ppmp.remarks}"
                            </div>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1rem" }}>
                              Please address the feedback above and resubmit for approval.
                            </p>
                          </div>
                        )}

                        <table className="custom-table" style={{ fontSize: "12px" }}>
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Qty</th>
                              <th>Unit</th>
                              <th>Cost</th>
                              <th>Subtotal</th>
                              <th>Mode</th>
                              <th>Q1/Q2/Q3/Q4</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPpmp.items.length === 0 ? (
                              <tr>
                                <td colSpan="8">No items added yet.</td>
                              </tr>
                            ) : (
                              selectedPpmp.items.map((item) => (
                                <tr key={item.id}>
                                  <td>{item.description}</td>
                                  <td>{item.quantity}</td>
                                  <td>{item.unit_of_measure}</td>
                                  <td>₱{item.unit_cost.toLocaleString()}</td>
                                  <td>₱{item.estimated_budget.toLocaleString()}</td>
                                  <td>{item.procurement_mode}</td>
                                  <td>{item.q1_qty}/{item.q2_qty}/{item.q3_qty}/{item.q4_qty}</td>
                                  <td>
                                    {selectedPpmp.ppmp.status !== "Approved" && selectedPpmp.ppmp.status !== "Pending Budget Review" && (
                                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeletePpmpItem(item.id)}>Remove</button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>

                        {/* Add Item form */}
                        {selectedPpmp.ppmp.status !== "Approved" && selectedPpmp.ppmp.status !== "Pending Budget Review" && (
                          <form onSubmit={handleAddPpmpItem} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "20px" }}>
                            <h3 style={{ gridColumn: "span 2", margin: "5px 0" }}>Add Line Item</h3>
                            <input
                              type="text"
                              placeholder="Item Description"
                              className="form-input"
                              value={itemDesc}
                              onChange={(e) => setItemDesc(e.target.value)}
                              required
                              style={{ gridColumn: "span 2" }}
                            />
                            <select className="form-input" value={itemCat} onChange={(e) => setItemCat(e.target.value)}>
                              <option value="Office Supplies">Office Supplies</option>
                              <option value="IT Equipment">IT Equipment</option>
                              <option value="Catering Services">Catering Services</option>
                              <option value="Services">Services / Repair</option>
                            </select>
                            <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                              <input type="checkbox" checked={itemIsCse} onChange={(e) => setItemIsCse(e.target.checked)} />
                              Is Common-Use (PS-DBM)?
                            </label>
                            <input
                              type="number"
                              placeholder="Quantity"
                              className="form-input"
                              value={itemQty}
                              onChange={(e) => setItemQty(e.target.value)}
                              required
                            />
                            <input
                              type="text"
                              placeholder="Unit (e.g. pc, box)"
                              className="form-input"
                              value={itemUnit}
                              onChange={(e) => setItemUnit(e.target.value)}
                              required
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Unit Cost"
                              className="form-input"
                              value={itemCost}
                              onChange={(e) => setItemCost(e.target.value)}
                              required
                            />
                            <select className="form-input" value={itemProcMode} onChange={(e) => setItemProcMode(e.target.value)}>
                              <option value="Shopping">Shopping</option>
                              <option value="SVP">Small Value Procurement</option>
                              <option value="Competitive Bidding">Competitive Bidding</option>
                            </select>

                            <h4 style={{ gridColumn: "span 2", margin: "5px 0" }}>Milestone Distribution (Qty)</h4>
                            <input type="number" placeholder="Q1 Qty" className="form-input" value={q1} onChange={(e) => setQ1(e.target.value)} />
                            <input type="number" placeholder="Q2 Qty" className="form-input" value={q2} onChange={(e) => setQ2(e.target.value)} />
                            <input type="number" placeholder="Q3 Qty" className="form-input" value={q3} onChange={(e) => setQ3(e.target.value)} />
                            <input type="number" placeholder="Q4 Qty" className="form-input" value={q4} onChange={(e) => setQ4(e.target.value)} />

                            <button type="submit" className="btn" style={{ gridColumn: "span 2" }}>Add Item</button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="dashboard-card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        Select a PPMP to view or edit details.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- BUDGET OFFICE PPMP AUDIT (Dashboard) --- */}
              {user.role === "budget_office" && (
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
                                <button className="btn" onClick={() => handleSelectPpmp(p.id)}>Audit</button>
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

                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                          gap: "1.5rem", 
                          margin: "1.5rem 0",
                          padding: "1.5rem",
                          background: "var(--neuro-bg)",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)"
                        }}>
                          <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Department</div>
                            <div style={{ fontWeight: "700", fontSize: "1rem" }}>{auditDetails.office_name}</div>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                              Allocation: ₱{auditDetails.office_budget_allocation.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Budget Summary</div>
                            <div style={{ fontWeight: "700", fontSize: "1rem", color: auditDetails.is_within_budget ? "var(--success-color)" : "var(--danger-color)" }}>
                              ₱{auditDetails.total_ppmp_cost.toLocaleString()}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                              Remaining: ₱{auditDetails.remaining_budget.toLocaleString()}
                            </div>
                          </div>
                          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--border-color)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)" }}>Audit Status:</span>
                            <span className={`badge ${auditDetails.is_within_budget ? "badge-success" : "badge-danger"}`} style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                              {auditDetails.is_within_budget ? "READY FOR APPROVAL" : "OVER BUDGET LIMIT"}
                            </span>
                          </div>
                        </div>

                        <h3>Requested Items List</h3>
                        <table className="custom-table" style={{ fontSize: "12px", marginBottom: "20px" }}>
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Qty</th>
                              <th>Unit Cost</th>
                              <th>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPpmp.items.map((item) => (
                              <tr key={item.id}>
                                <td>{item.description}</td>
                                <td>{item.quantity}</td>
                                <td>₱{item.unit_cost.toLocaleString()}</td>
                                <td>₱{item.estimated_budget.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {user.role === "budget_office" && (
                          <>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem" }}>Budget Office Action</h3>
                            <textarea
                              className="form-input"
                              placeholder="Provide feedback or remarks here..."
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              style={{ minHeight: "100px", marginBottom: "1.5rem", fontSize: "0.9rem" }}
                            />

                            <div style={{ display: "flex", gap: "12px" }}>
                              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => handleReviewAction(selectedPpmp.ppmp.id, "approve")}>
                                <i className="fas fa-check" style={{ marginRight: "8px" }}></i>
                                Approve PPMP
                              </button>
                              <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleReviewAction(selectedPpmp.ppmp.id, "return")}>
                                <i className="fas fa-undo" style={{ marginRight: "8px" }}></i>
                                Return for Revision
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="dashboard-card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        Select a PPMP to execute budget review.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- BAC ADMIN VIEW --- */}
              {user.role === "bac_admin" && (
                <div className="grid-2">
                  <div>
                    <div className="dashboard-card">
                      <h2 className="card-title">APP Consolidation</h2>
                      <form onSubmit={handleConsolidate} style={{ display: "flex", gap: "10px" }}>
                        <input
                          type="number"
                          className="form-input"
                          value={consolidationYear}
                          onChange={(e) => setConsolidationYear(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn">Run Consolidation</button>
                      </form>
                    </div>

                    <div className="dashboard-card" style={{ marginTop: "20px" }}>
                      <h2 className="card-title">Consolidated APPs</h2>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Fiscal Year</th>
                            <th>Created At</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apps.map((a) => (
                            <tr key={a.id}>
                              <td>{a.title}</td>
                              <td>{a.fiscal_year}</td>
                              <td>{new Date(a.created_at + "Z").toLocaleDateString()}</td>
                              <td>
                                <button className="btn" onClick={() => handleSelectApp(a.id)}>View Rows</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    {selectedApp ? (
                      <div className="dashboard-card">
                        <h2 className="card-title">{selectedApp.app.title} Details</h2>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "8px 0 16px 0" }}>
                          <button
                            className="btn"
                            onClick={() => handleExportApp(selectedApp.app.fiscal_year, "cse")}
                          >
                            Download CSE APP (.xlsx)
                          </button>
                          <button
                            className="btn"
                            onClick={() => handleExportApp(selectedApp.app.fiscal_year, "noncse")}
                          >
                            Download Non-CSE APP (.xlsx)
                          </button>
                          <button
                            className="btn"
                            onClick={() => handleExportApp(selectedApp.app.fiscal_year, "combined")}
                          >
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
                            <button className="btn" onClick={() => handleSelectPpmp(p.id)}>Audit</button>
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

                    <div style={{ 
                      display: "grid", 
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                      gap: "1.5rem", 
                      margin: "1.5rem 0",
                      padding: "1.5rem",
                      background: "var(--neuro-bg)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)"
                    }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Department</div>
                        <div style={{ fontWeight: "700", fontSize: "1rem" }}>{auditDetails.office_name}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                          Allocation: ₱{auditDetails.office_budget_allocation.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Budget Summary</div>
                        <div style={{ fontWeight: "700", fontSize: "1rem", color: auditDetails.is_within_budget ? "var(--success-color)" : "var(--danger-color)" }}>
                          ₱{auditDetails.total_ppmp_cost.toLocaleString()}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                          Remaining: ₱{auditDetails.remaining_budget.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--border-color)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)" }}>Audit Status:</span>
                        <span className={`badge ${auditDetails.is_within_budget ? "badge-success" : "badge-danger"}`} style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                          {auditDetails.is_within_budget ? "READY FOR APPROVAL" : "OVER BUDGET LIMIT"}
                        </span>
                      </div>
                    </div>

                    <h3>Requested Items List</h3>
                    <table className="custom-table" style={{ fontSize: "12px", marginBottom: "20px" }}>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit Cost</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPpmp.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.description}</td>
                            <td>{item.quantity}</td>
                            <td>₱{item.unit_cost.toLocaleString()}</td>
                            <td>₱{item.estimated_budget.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
              <h2 className="card-title">Indicative PPMP Management</h2>
              <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
                Manage indicative PPMPs for RA 12009 compliance
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
                      <td colSpan="5">No indicative PPMPs available for posting.</td>
                    </tr>
                  ) : (
                    indicativePpmps.map((p) => (
                      <tr key={p.id}>
                        <td>{getOfficeLabel(p.office_id)}</td>
                        <td>{p.title}</td>
                        <td>{p.fiscal_year}</td>
                        <td>
                          <span className={`badge ${p.posting_status === "Draft" ? "badge-secondary" : p.posting_status === "Posted" ? "badge-warning" : p.posting_status === "Approved" ? "badge-success" : "badge-danger"}`}>
                            {p.posting_status}
                          </span>
                        </td>
                        <td>
                          {p.posting_status === "Draft" && (
                            <button className="btn" onClick={() => handlePostIndicativePpmp(p.id)}>Post</button>
                          )}
                          {p.posting_status === "Posted" && (
                            <button className="btn btn-danger" onClick={() => handleUnpostIndicativePpmp(p.id)}>Unpost</button>
                          )}
                          {p.posting_status !== "Draft" && p.posting_status !== "Posted" && (
                            <span className="badge badge-secondary">{p.posting_status}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
{/* --- BUDGET ALLOCATION SECTION FOR END USERS --- */}
          {activeTab === "budget_allocation" && user.role === "end_user" && (
            <div className="dashboard-card">
              <h2 className="card-title">Budget Allocation</h2>
              <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
                Input and view your office's budget allocation for the current fiscal year
              </p>
              
              {!user.office_id ? (
                <div className="dashboard-card" style={{ 
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid var(--danger-color)",
                  textAlign: "center",
                  padding: "2rem"
                }}>
                  <i className="fas fa-exclamation-triangle" style={{ fontSize: "2rem", color: "var(--danger-color)", marginBottom: "1rem" }}></i>
                  <h3 style={{ color: "var(--danger-color)", marginBottom: "0.5rem" }}>No Office Assigned</h3>
                  <p style={{ color: "var(--text-secondary)" }}>
                    You are not currently assigned to any office. Please contact the BAC Administrator to assign you to an office.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "1fr 1fr", 
                    gap: "1.5rem", 
                    marginBottom: "1.5rem"
                  }}>
                    <div>
                      <div className="dashboard-card" style={{ 
                        background: "var(--neuro-bg)",
                        border: "1px solid var(--border-color)"
                      }}>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "1rem", color: "var(--text-secondary)" }}>
                          <i className="fas fa-wallet" style={{ marginRight: "8px" }}></i>
                          Your Office Budget Allocation
                        </h3>
                        <div style={{ 
                          fontSize: "2rem", 
                          fontWeight: "700", 
                          color: "var(--accent-color)",
                          marginBottom: "0.5rem"
                        }}>
                          ₱{userOfficeBudget.toLocaleString()}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          {getOfficeLabel(user.office_id)}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <form onSubmit={handleUpdateBudgetAllocation} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <h3 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                          <i className="fas fa-edit" style={{ marginRight: "8px" }}></i>
                          Update Budget Allocation
                        </h3>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Enter Budget Allocation Amount"
                          className="form-input"
                          value={userBudgetAllocation}
                          onChange={(e) => setUserBudgetAllocation(e.target.value)}
                          required
                        />
                        <button type="submit" className="btn">
                          <i className="fas fa-save" style={{ marginRight: "8px" }}></i>
                          Save Budget Allocation
                        </button>
                      </form>
                    </div>
                  </div>
                  
                  <div className="dashboard-card" style={{ 
                    background: "var(--neuro-bg)",
                    border: "1px solid var(--border-color)",
                    marginTop: "1rem"
                  }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "1rem", color: "var(--text-secondary)" }}>
                      <i className="fas fa-info-circle" style={{ marginRight: "8px" }}></i>
                      RA 12009 Budget Allocation Guidelines
                    </h3>
                    <ul style={{ 
                      fontSize: "0.85rem", 
                      color: "var(--text-secondary)",
                      paddingLeft: "1.25rem",
                      lineHeight: "1.8"
                    }}>
                      <li>Budget allocation should align with the approved Annual Investment Program (AIP)</li>
                      <li>End-users are responsible for ensuring their PPMP requests do not exceed this allocation</li>
                      <li>The Budget Office will verify all allocations during the review process</li>
                      <li>Any changes to the allocation must be coordinated with the Budget Office</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "signatory" && user.role === "end_user" && (
            <div className="signatory-section">
              <div className="signatory-section-header">
                <h2 className="signatory-section-title">Signatory Information</h2>
                <p className="signatory-section-subtitle">
                  Update signatory details and reference numbers for your PPMP documents
                </p>
              </div>

              <form onSubmit={handleUpdateSignatory} className="signatory-form">
                <div className="signatory-form-grid-horizontal">
                  {/* Submitted By Section */}
                  <div className="signatory-section-group">
                    <h3 className="signatory-section-group-title">Submission Details</h3>
                    <div className="form-group">
                      <label className="form-label" htmlFor="submittedBy">
                        <i className="fas fa-user" style={{ marginRight: "8px" }}></i>
                        Submitted By
                      </label>
                      <input
                        id="submittedBy"
                        type="text"
                        className="form-input"
                        placeholder="Full Name"
                        value={submittedBy}
                        onChange={(e) => setSubmittedBy(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="submittedByDesignation">
                        <i className="fas fa-id-badge" style={{ marginRight: "8px" }}></i>
                        Designation
                      </label>
                      <input
                        id="submittedByDesignation"
                        type="text"
                        className="form-input"
                        placeholder="Position/Title"
                        value={submittedByDesignation}
                        onChange={(e) => setSubmittedByDesignation(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Prepared By Section */}
                  <div className="signatory-section-group">
                    <h3 className="signatory-section-group-title">Preparation Details</h3>
                    <div className="form-group">
                      <label className="form-label" htmlFor="preparedBy">
                        <i className="fas fa-user-edit" style={{ marginRight: "8px" }}></i>
                        Prepared By
                      </label>
                      <input
                        id="preparedBy"
                        type="text"
                        className="form-input"
                        placeholder="Full Name"
                        value={preparedBy}
                        onChange={(e) => setPreparedBy(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="preparedByDesignation">
                        <i className="fas fa-id-badge" style={{ marginRight: "8px" }}></i>
                        Designation
                      </label>
                      <input
                        id="preparedByDesignation"
                        type="text"
                        className="form-input"
                        placeholder="Position/Title"
                        value={preparedByDesignation}
                        onChange={(e) => setPreparedByDesignation(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Reference Numbers Section */}
                  <div className="signatory-section-group">
                    <h3 className="signatory-section-group-title">Reference Information</h3>
                    <div className="form-group">
                      <label className="form-label" htmlFor="aipReference">
                        <i className="fas fa-hashtag" style={{ marginRight: "8px" }}></i>
                        AIP Reference #
                      </label>
                      <input
                        id="aipReference"
                        type="text"
                        className="form-input"
                        placeholder="e.g., AIP-2025-001"
                        value={aipReference}
                        onChange={(e) => setAipReference(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="responsibilityCenterNo">
                        <i className="fas fa-building" style={{ marginRight: "8px" }}></i>
                        Responsibility Center #
                      </label>
                      <input
                        id="responsibilityCenterNo"
                        type="text"
                        className="form-input"
                        placeholder="e.g., RC-001"
                        value={responsibilityCenterNo}
                        onChange={(e) => setResponsibilityCenterNo(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="officeCodeFromPR">
                        <i className="fas fa-code" style={{ marginRight: "8px" }}></i>
                        Office Code (from PR)
                      </label>
                      <input
                        id="officeCodeFromPR"
                        type="text"
                        className="form-input"
                        placeholder="e.g., CMO, CHO, GSO"
                        value={officeCodeFromPR}
                        onChange={(e) => setOfficeCodeFromPR(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="signatory-section-group">
                    <div className="signatory-submit-row">
                      <button type="submit" className="btn signatory-submit-btn">
                        <i className="fas fa-save"></i>
                        Update Signatory Information
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
                <h2 className="card-title">Add Department/Office</h2>
                <form onSubmit={handleCreateOffice} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Office Name"
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
                    onChange={(e) => setNewOfficeCode(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn">Add Office</button>
                </form>
              </div>

              <div className="dashboard-card">
                <h2 className="card-title">Ormoc City Hall Offices</h2>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Office Name</th>
                      <th>Budget Ceiling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offices.map((o) => (
                      <tr key={o.id}>
                        <td>{o.code}</td>
                        <td>{o.name}</td>
                        <td>₱{o.budget_allocation.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "users" && user.role === "bac_admin" && (
            <div className="grid-2-wide">
              <div className="dashboard-card">
                <h2 className="card-title">Register New User</h2>
                <form onSubmit={handleRegisterUser} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Username"
                    className="form-input"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
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
                    placeholder="Password"
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
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
                    <select
                      className="form-input"
                      value={newUserOfficeId}
                      onChange={(e) => setNewUserOfficeId(e.target.value)}
                      required
                    >
                      <option value="">Select Office</option>
                      {offices.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.code})
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="submit" className="btn">Register User</button>
                </form>
              </div>

              <div className="dashboard-card">
                <h2 className="card-title">Registered Users</h2>
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Office</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registeredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="6">No users registered yet.</td>
                        </tr>
                      ) : (
                        registeredUsers.map((u) => (
                          <tr key={u.id}>
                            <td>{u.username}</td>
                            <td>{u.email}</td>
                            <td>{formatRole(u.role)}</td>
                            <td>{getOfficeLabel(u.office_id)}</td>
                            <td>
                              <span className={`badge ${u.is_active ? "badge-success" : "badge-secondary"}`}>
                                {u.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
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

{activeTab === "budget_allocation" && user.role === "end_user" && (
          <footer className="workspace-footer">
            <div className="workspace-footer-inner workspace-footer-budget">
              <h2 className="workspace-footer-title">RA 12009 Budget Allocation Guidelines</h2>
              <div className="workspace-footer-content">
                <h3>Key Provisions</h3>
                <ul>
                  <li><strong>Section 4 - Planning Phase:</strong> End-users must conduct market scoping and cost estimation</li>
                  <li><strong>Budget Transparency:</strong> All budget allocations must be visible for accountability</li>
                  <li><strong>Digital Integration:</strong> Budget data must be submitted electronically for consolidation</li>
                  <li><strong>Transitory Period:</strong> Three-year transition for full compliance with NGPA</li>
                </ul>
                <p className="workspace-footer-note">
                  <i className="fas fa-info-circle" aria-hidden="true"></i>
                  Under RA 12009, end-users are responsible for inputting their budget allocations which are visible to Budget Office and BAC Admin for review and consolidation
                </p>
              </div>
            </div>
          </footer>
        )}

        {activeTab === "indicative" && user.role === "budget_office" && (
          <footer className="workspace-footer">
            <div className="workspace-footer-inner workspace-footer-budget">
              <h2 className="workspace-footer-title">RA 12009 Compliance Guide</h2>
              <div className="workspace-footer-content">
                <h3>Key Requirements</h3>
                <ul>
                  <li><strong>Market Scoping:</strong> End-users must perform market research before drafting PPMPs</li>
                  <li><strong>Life-Cycle Costing:</strong> Include operating, maintenance, and disposal costs</li>
                  <li><strong>Digital Integration:</strong> All PPMPs must be submitted electronically</li>
                  <li><strong>Transitory Period:</strong> Three-year transition period for full compliance</li>
                </ul>
                <p className="workspace-footer-note">
                  <i className="fas fa-info-circle" aria-hidden="true"></i>
                  Refer to RA 12009 Section 4 for detailed implementation guidelines
                </p>
              </div>
            </div>
          </footer>
        )}

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
    </div>
  );
}

export default Dashboard;
  