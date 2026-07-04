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
    } else if (user.role === "bac_admin") {
      fetchApps();
      fetchOffices();
      fetchUsers();
    }
  };

  useEffect(() => {
    if (user.role === "bac_admin" && activeTab === "users") {
      fetchUsers();
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
        if (user.role === "budget_office") {
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
    offices: "Manage Offices",
    users: "Manage Users",
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
                      <form onSubmit={handleCreatePpmp} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="PPMP Title (e.g., Office Supplies 2027)"
                          value={newPpmpTitle}
                          onChange={(e) => setNewPpmpTitle(e.target.value)}
                          required
                        />
                        <select className="form-input" value={newPpmpType} onChange={(e) => setNewPpmpType(e.target.value)}>
                          <option value="Indicative">Indicative PPMP</option>
                          <option value="Final">Final PPMP</option>
                        </select>
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
                              <td colSpan="4">No PPMPs created yet.</td>
                            </tr>
                          ) : (
                            ppmps.map((p) => (
                              <tr key={p.id}>
                                <td>{p.title}</td>
                                <td>{p.fiscal_year}</td>
                                <td>
                                  <span className={`badge ${p.status === "Approved" ? "badge-success" : p.status === "Pending Budget Review" ? "badge-warning" : "badge-secondary"}`}>
                                    {p.status}
                                  </span>
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

              {/* --- BUDGET OFFICE VIEW --- */}
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
                              <td>{p.office_id}</td>
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

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "15px 0" }}>
                          <div>
                            <strong>Department Code:</strong> {auditDetails.office_name}<br />
                            <strong>Allocation:</strong> ₱{auditDetails.office_budget_allocation.toLocaleString()}
                          </div>
                          <div>
                            <strong>Total PPMP Requested:</strong> ₱{auditDetails.total_ppmp_cost.toLocaleString()}<br />
                            <strong>Remaining Balance:</strong> ₱{auditDetails.remaining_budget.toLocaleString()}
                          </div>
                          <div style={{ gridColumn: "span 2", fontWeight: "bold" }}>
                            Status: <span style={{ color: auditDetails.is_within_budget ? "green" : "red" }}>
                              {auditDetails.is_within_budget ? "WITHIN BUDGET LIMIT" : "EXCEEDED BUDGET LIMIT"}
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

                        <textarea
                          className="form-input"
                          placeholder="Review Remarks..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          style={{ minHeight: "80px", marginBottom: "15px" }}
                        />

                        <div style={{ display: "flex", gap: "10px" }}>
                          <button className="btn btn-success" onClick={() => handleReviewAction(selectedPpmp.ppmp.id, "approve")}>
                            Approve PPMP
                          </button>
                          <button type="button" className="btn btn-danger" onClick={() => handleReviewAction(selectedPpmp.ppmp.id, "return")}>
                            Return for Revision
                          </button>
                        </div>
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
                        <div className="table-wrapper">
                          <table className="custom-table" style={{ fontSize: "11px" }}>
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Total Qty</th>
                                <th>Unit Cost</th>
                                <th>Total Budget</th>
                                <th>Mode</th>
                                <th>Milestones (Q1-Q4)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedApp.rows.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.category}</td>
                                  <td>{row.description}</td>
                                  <td>{row.total_quantity} {row.unit_of_measure}</td>
                                  <td>₱{row.unit_cost.toLocaleString()}</td>
                                  <td>₱{row.total_estimated_budget.toLocaleString()}</td>
                                  <td>{row.procurement_mode}</td>
                                  <td>{row.q1_qty}/{row.q2_qty}/{row.q3_qty}/{row.q4_qty}</td>
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
                  <input
                    type="number"
                    placeholder="Annual Budget Ceiling"
                    className="form-input"
                    value={newOfficeBudget}
                    onChange={(e) => setNewOfficeBudget(e.target.value)}
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

        </div>
      </main>
    </div>
  );
}

export default Dashboard;
