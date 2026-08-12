import React, { useState } from "react";
import { apiFetch } from "./api";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await apiFetch("/api/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        onLogin(data.access_token);
      } else if (response.status === 429) {
        setError(
          data.detail ||
            data.message ||
            "Too many login attempts. Wait a minute and try again."
        );
      } else {
        setError(data.detail || "Incorrect username or password");
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Request timed out. Restart the backend server and try again.");
      } else {
        setError("Network error. Make sure the Laravel backend is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split-login-container">
      {/* Left Pane: Visual branding with silhouette */}
      <div className="login-left-pane">
        <div className="dev-silhouette-container">
          <img
            src={`${import.meta.env.BASE_URL}Ormoc_City.png`}
            alt="Background Logo"
            className="bg-logo"
          />
          <img
            //src={`${import.meta.env.BASE_URL}dev.png`}
            alt="Developer Silhouette"
            className="dev-silhouette"
          />
        </div>
        
        <div className="login-left-content">
          <h1 className="login-left-title">
            PPMP TO APP CONSOLIDATION SYSTEM<br />
          </h1>
          <p className="login-left-subtitle">
            Ormoc City Hall PPMP-APP Consolidation System
            <br />
            RA 12009 Compliance Module
          </p>
          <div className="login-left-hashtags">
            <span>#GoDigital</span>
            <span>#Paperless</span>
            <span>#Fast</span>
          </div>
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
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                placeholder="YOUR OFFICE"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                style={{ textTransform: "uppercase" }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
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
