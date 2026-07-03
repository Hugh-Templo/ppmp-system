import React, { useState, useEffect } from "react";

function Login({ onLogin }) {
  const [activeTab, setActiveTab] = useState("login"); // "login" or "register"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("end_user"); // "end_user", "budget_office", "bac_admin"
  const [officeId, setOfficeId] = useState("");
  const [offices, setOffices] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOffices();
  }, []);

  const fetchOffices = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/offices");
      if (response.ok) {
        const data = await response.json();
        setOffices(data);
        if (data.length > 0) {
          setOfficeId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching offices:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (activeTab === "login") {
      try {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        const response = await fetch("http://localhost:8000/api/auth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        });

        const data = await response.json();
        if (response.ok) {
          onLogin(data.access_token);
        } else {
          setError(data.detail || "Incorrect username or password");
        }
      } catch (err) {
        setError("Network error. Make sure the FastAPI backend is running.");
      }
    } else {
      // Registration Flow
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("http://localhost:8000/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            email,
            hashed_password: password,
            role: role,
            office_id: role === "end_user" ? parseInt(officeId) : null,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          setSuccess("Account created successfully! You can now log in.");
          setActiveTab("login");
          setPassword("");
        } else {
          setError(data.detail || "Registration failed. Username or email might be taken.");
        }
      } catch (err) {
        setError("Network error. Make sure the FastAPI backend is running.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">PPMP Sys</h1>
          <p className="auth-subtitle">Ormoc City Hall PPMP-APP Consolidation System (RA 12009)</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === "login" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("login");
              setError("");
              setSuccess("");
            }}
          >
            Log In
          </button>
          <button
            className={`auth-tab ${activeTab === "register" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("register");
              setError("");
              setSuccess("");
            }}
          >
            Register
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          {activeTab === "register" && (
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {activeTab === "register" && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="role">
                  System Role
                </label>
                <select
                  id="role"
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="end_user">End-User (Office Representative)</option>
                  <option value="budget_office">Budget Office Officer</option>
                  <option value="bac_admin">BAC Secretariat / Admin</option>
                </select>
              </div>

              {role === "end_user" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="office">
                    Assigned Office
                  </label>
                  <select
                    id="office"
                    className="form-input"
                    value={officeId}
                    onChange={(e) => setOfficeId(e.target.value)}
                  >
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Please wait..." : activeTab === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
