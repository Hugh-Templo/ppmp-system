import React, { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

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
    setLoading(false);
  };

  return (
    <div className="split-login-container">
      {/* Left Pane: Visual branding with silhouette */}
      <div className="login-left-pane">
        <div className="dev-silhouette-container">
          <img 
            src="/dev.png" 
            alt="Developer Silhouette" 
            className="dev-silhouette" 
          />
        </div>
        
        <div className="login-left-content">
          <div className="login-left-logo">
            <img src="/Ormoc_City.png" alt="Ormoc City" />
          </div>
          <h1 className="login-left-title">
            PPMP <br />
            CONSOLIDATION
          </h1>
          <p className="login-left-subtitle">
            Ormoc City Hall PPMP-APP Consolidation System
            <br />
            RA 12009 Compliance Module
          </p>
        </div>
      </div>

      {/* Right Pane: Login Form Area */}
      <div className="login-right-pane">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <h2 className="login-form-title">Portal Sign In</h2>
            <p className="login-form-subtitle">Enter your official credentials to access the system</p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit} className="form-stack">
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
                placeholder="e.g. jdoe_ormoc"
                autoComplete="username"
                required
              />
            </div>

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
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? "Authenticating..." : "Access System"}
            </button>
          </form>

          <div className="mt-20" style={{ textAlign: 'center' }}>
            <p className="login-form-subtitle" style={{ fontSize: '0.85rem' }}>
              &copy; {new Date().getFullYear()} Ormoc City Government. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
