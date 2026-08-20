import React, { useState, useEffect, lazy, Suspense } from "react";
import Login from "./Login";
import { apiFetch } from "./api";

const Dashboard = lazy(() => import("./Dashboard"));

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      fetchUser(token);
    } else {
      localStorage.removeItem("token");
      setUser(null);
      setAuthLoading(false);
    }
  }, [token]);

  const fetchUser = async (authToken) => {
    setAuthLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await apiFetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setToken("");
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      setToken("");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    setToken("");
  };

  if (authLoading || (token && !user)) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          <div className="auth-loading-spinner" aria-hidden="true" />
          <p>Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {token && user ? (
        <Suspense
          fallback={
            <div className="auth-loading-screen">
              <div className="auth-loading-card">
                <div className="auth-loading-spinner" aria-hidden="true" />
                <p>Loading dashboard...</p>
              </div>
            </div>
          }
        >
          <Dashboard token={token} user={user} onLogout={handleLogout} />
        </Suspense>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
