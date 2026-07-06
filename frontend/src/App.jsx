import React, { useState, useEffect } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";

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
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch("http://localhost:8000/api/auth/me", {
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
        <Dashboard token={token} user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
