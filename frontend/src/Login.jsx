import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";

const isStandaloneDisplay = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const detectMobile = () => {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return uaMobile || (coarse && narrow);
};

const LOGO_SRC = `${import.meta.env.BASE_URL}Ormoc_City.png`;
const SECRET_CLICKS = 5;
const SECRET_CLICK_WINDOW_MS = 2500;

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [maintenance, setMaintenance] = useState({
    is_enabled: false,
    message: null,
    loaded: false,
  });
  const [adminUnlock, setAdminUnlock] = useState(false);
  const clickTimesRef = useRef([]);

  useEffect(() => {
    const refresh = () => {
      setIsMobile(detectMobile());
      setIsStandalone(isStandaloneDisplay());
    };
    refresh();
    window.addEventListener("resize", refresh);
    const onBip = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadMaintenance = async () => {
      try {
        const res = await apiFetch("/api/maintenance");
        if (!res.ok) {
          if (!cancelled) {
            setMaintenance((prev) => ({ ...prev, loaded: true }));
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setMaintenance({
            is_enabled: Boolean(data.is_enabled),
            message: data.message || null,
            loaded: true,
          });
        }
      } catch {
        if (!cancelled) {
          setMaintenance((prev) => ({ ...prev, loaded: true }));
        }
      }
    };
    loadMaintenance();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!maintenance.is_enabled || adminUnlock) return undefined;

    const onKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "M" || e.key === "m")) {
        e.preventDefault();
        setAdminUnlock(true);
        setError("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [maintenance.is_enabled, adminUnlock]);

  const unlockAdminAccess = () => {
    setAdminUnlock(true);
    setError("");
    clickTimesRef.current = [];
  };

  const handleSecretLogoClick = () => {
    if (adminUnlock || !maintenance.is_enabled) return;
    const now = Date.now();
    const recent = clickTimesRef.current.filter(
      (t) => now - t < SECRET_CLICK_WINDOW_MS
    );
    recent.push(now);
    clickTimesRef.current = recent;
    if (recent.length >= SECRET_CLICKS) {
      unlockAdminAccess();
    }
  };

  const showInstall = isMobile && !isStandalone;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {
        // ignore
      }
      setDeferredPrompt(null);
      return;
    }
    setShowIosTip(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

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
      } else if (response.status === 503) {
        setError(
          data.detail ||
            data.message ||
            "System is under maintenance. Please try again later."
        );
      } else if (response.status >= 500) {
        setError(
          "The server is not accepting logins right now (API error). This is not website traffic — check Hostinger Laravel logs and .env."
        );
      } else {
        setError(data.detail || data.message || "Incorrect username or password");
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Request timed out. The API did not respond in time.");
      } else {
        setError("Network error. The login API could not be reached.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loginFormFields = (
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
        {loading ? "Authenticating..." : adminUnlock ? "Administrator Sign In" : "Access System"}
      </button>
    </form>
  );

  if (maintenance.loaded && maintenance.is_enabled) {
    return (
      <div className="maintenance-page">
        <div className="maintenance-page__glow" aria-hidden="true" />
        <div className="maintenance-page__card">
          <button
            type="button"
            className="maintenance-page__logo-btn"
            onClick={handleSecretLogoClick}
            aria-label="City of Ormoc official seal"
          >
            <img
              src={LOGO_SRC}
              alt="City of Ormoc Official Seal"
              className="maintenance-page__logo"
              draggable={false}
            />
          </button>

          <p className="maintenance-page__brand">City of Ormoc</p>
          <h1 className="maintenance-page__title">System Under Maintenance</h1>
          <p className="maintenance-page__lead">
            {maintenance.message ||
              "The PPMP to APP Consolidation System is temporarily unavailable while we perform scheduled maintenance."}
          </p>

          <div className="maintenance-page__meta">
            <span className="maintenance-page__badge">
              <i className="fas fa-tools" aria-hidden="true" />
              Offline for end users
            </span>
            <p className="maintenance-page__contact">
              For assistance, contact the BAC Office.
            </p>
          </div>

          {adminUnlock && (
            <div className="maintenance-page__admin">
              <div className="maintenance-page__admin-header">
                <h2>Administrator Access</h2>
                <p>Authorized BAC Admin and Super Admin accounts only.</p>
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              {loginFormFields}
            </div>
          )}

          <footer className="maintenance-page__footer">
            <span>PPMP to APP Consolidation System</span>
            <span>&copy; {new Date().getFullYear()} Ormoc City Government</span>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className={`split-login-container${isMobile ? " is-mobile-login" : ""}`}>
      <div className="login-left-pane">
        <div className="dev-silhouette-container">
          <img
            src={LOGO_SRC}
            alt="Background Logo"
            className="bg-logo"
          />
          <img
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

      <div className="login-right-pane">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <h2 className="login-form-title">Portal Sign In</h2>
            <p className="login-form-subtitle">Enter your official credentials to access the system</p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {loginFormFields}

          {showInstall && (
            <button
              type="button"
              className="btn-install-app"
              onClick={handleInstallClick}
            >
              <i className="fas fa-download" aria-hidden="true"></i>
              Install App
            </button>
          )}

          <div className="mt-20" style={{ textAlign: "center" }}>
            <p className="login-form-subtitle" style={{ fontSize: "0.85rem" }}>
              &copy; {new Date().getFullYear()} Ormoc City Government. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {showIosTip && (
        <div
          className="pwa-ios-tip-overlay"
          role="presentation"
          onClick={() => setShowIosTip(false)}
        >
          <div
            className="pwa-ios-tip"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-ios-tip-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pwa-ios-tip-title">Add to Home Screen</h3>
            <ol>
              <li>
                Tap the <strong>Share</strong> button in Safari
              </li>
              <li>
                Scroll and tap <strong>Add to Home Screen</strong>
              </li>
              <li>
                Tap <strong>Add</strong> to install PPMP Portal
              </li>
            </ol>
            <button type="button" className="btn" onClick={() => setShowIosTip(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
