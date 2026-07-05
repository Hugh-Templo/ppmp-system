import React, { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="split-root">
      <style>{`
        :root{--bg:#060717;--panel:#0b1220;--glass:rgba(255,255,255,0.04);--accent1:#06b6d4;--accent2:#3b82f6;}
        *{box-sizing:border-box}
        html,body,#root{height:100%}
        .split-root{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px;background:linear-gradient(180deg,#03040a 0%, #071026 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;}
        .split-shell{width:min(1200px,100%);height:min(800px,calc(100vh - 56px));display:grid;grid-template-columns:1fr 1fr;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(2,6,23,0.7);border:1px solid rgba(255,255,255,0.03);background:linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.00));}
        /* LEFT VISUAL PANEL */
        .visual-panel{position:relative;background:linear-gradient(180deg,#041024 0%, #071223 100%);padding:48px;display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;}
        .visual-overlay{position:absolute;inset:0;background:
          radial-gradient(ellipse at 10% 15%, rgba(59,130,246,0.06) 0%, transparent 20%),
          radial-gradient(ellipse at 90% 85%, rgba(6,182,212,0.04) 0%, transparent 18%);pointer-events:none;}
        .code-rain{position:absolute;inset:0;opacity:0.12;background-image:
          linear-gradient(transparent 60%, rgba(0,255,170,0.06) 61%);mix-blend-mode:screen;filter:blur(6px);animation: drift 18s linear infinite;}
        @keyframes drift{from{transform:translateY(0)}to{transform:translateY(-40px)}}
        .visual-card{width:88%;max-width:680px;border-radius:18px;padding:28px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 30px rgba(2,6,23,0.6);backdrop-filter: blur(6px);position:relative;overflow:hidden;}
        .scene-layer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transition:opacity 1s ease-in-out;pointer-events:none}
        .scene{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative}
        .scene svg{width:100%;height:100%;max-height:420px;opacity:0.98}
        /* three cross-fading scenes */
        .scene-one{animation:sceneFade 12s infinite;animation-delay:0s}
        .scene-two{animation:sceneFade 12s infinite;animation-delay:4s}
        .scene-three{animation:sceneFade 12s infinite;animation-delay:8s}
        @keyframes sceneFade{
          0%{opacity:0}
          8%{opacity:1}
          33%{opacity:1}
          41%{opacity:0}
          100%{opacity:0}
        }
        .visual-caption{position:relative;margin-top:22px;color:rgba(255,255,255,0.88);text-align:center;z-index:3}
        .visual-caption h2{margin:0;font-size:20px;letter-spacing:0.2px}
        .visual-caption p{margin:8px 0 0;color:rgba(255,255,255,0.65);font-size:13px}

        /* RIGHT FORM PANEL */
        .form-panel{display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg, rgba(2,6,23,0.55), rgba(2,6,23,0.7));padding:48px;}
        .form-card{width:100%;max-width:420px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border-radius:14px;padding:28px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 10px 30px rgba(2,6,23,0.6);backdrop-filter: blur(8px);}
        .brand{display:flex;align-items:center;gap:12px;margin-bottom:6px}
        .brand-logo{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--accent1),var(--accent2));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;box-shadow:0 6px 18px rgba(59,130,246,0.12)}
        .headline{font-size:22px;margin:6px 0 14px;color:#eaf6ff}
        .sub{font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:18px}
        .form-group{margin-bottom:12px}
        label{display:block;font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:6px}
        input[type="text"],input[type="password"],input[type="email"]{width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:#e6f0ff;outline:none;font-size:14px}
        .pw-row{display:flex;align-items:center;gap:8px}
        .show-btn{background:transparent;border:none;color:rgba(255,255,255,0.6);cursor:pointer;padding:8px;border-radius:8px}
        .btn-login{width:100%;padding:12px;border-radius:10px;border:none;color:white;font-weight:600;font-size:15px;cursor:pointer;margin-top:8px;background:linear-gradient(90deg,var(--accent1),var(--accent2));box-shadow:0 8px 20px rgba(11,92,171,0.16)}
        .socials{display:flex;gap:10px;margin-top:14px}
        .social-btn{flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:rgba(255,255,255,0.02);color:#e8f2ff;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}
        .links{display:flex;justify-content:space-between;margin-top:12px;font-size:13px;color:rgba(255,255,255,0.66)}
        .alert{background:linear-gradient(90deg,rgba(220,38,38,0.12),rgba(234,88,12,0.06));padding:10px;border-radius:8px;color:#ffdede;margin-bottom:12px;border:1px solid rgba(220,38,38,0.12)}
        @media (max-width:900px){
          .split-shell{grid-template-columns:1fr;min-height:calc(100vh - 40px);height:auto}
          .visual-panel{display:none}
          .form-panel{padding:28px}
        }
      `}</style>

      <div className="split-shell" role="main">
        <div className="visual-panel" aria-hidden="true">
          <div className="visual-overlay" />
          <div className="code-rain" />

          <div className="visual-card" aria-hidden="true">
            {/* Scene 1 - Young male developer */}
            <div className="scene-layer scene-one">
              <div className="scene">
                <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <defs>
                    <linearGradient id="g1" x1="0" x2="1">
                      <stop offset="0" stopColor="#04263a" />
                      <stop offset="1" stopColor="#051428" />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" x2="1">
                      <stop offset="0" stopColor="#08334b" />
                      <stop offset="1" stopColor="#021126" />
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#g1)" rx="14" />
                  {/* desk */}
                  <rect x="70" y="360" width="860" height="120" rx="10" fill="#0b1b2a" />
                  <rect x="220" y="160" width="560" height="180" rx="8" fill="#071428" />
                  {/* monitors */}
                  <rect x="250" y="120" width="220" height="120" rx="6" fill="#051428" />
                  <rect x="530" y="100" width="260" height="140" rx="6" fill="#021127" />
                  {/* keyboard */}
                  <rect x="340" y="300" width="320" height="28" rx="6" fill="#0f1724" />
                  {/* human silhouette */}
                  <circle cx="200" cy="220" r="34" fill="#0ea5a4" opacity="0.12" />
                  <circle cx="200" cy="220" r="22" fill="#7dd3fc" />
                  <rect x="170" y="252" width="60" height="80" rx="8" fill="#0f1724" opacity="0.85" />
                  {/* subtle code lines */}
                  <g fill="#06b6d4" opacity="0.14">
                    <rect x="260" y="130" width="18" height="6" rx="2" />
                    <rect x="286" y="148" width="90" height="8" rx="2" />
                    <rect x="554" y="118" width="26" height="6" rx="2" />
                    <rect x="588" y="136" width="140" height="8" rx="2" />
                    <rect x="430" y="166" width="54" height="6" rx="2" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Scene 2 - Female developer */}
            <div className="scene-layer scene-two">
              <div className="scene">
                <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect width="100%" height="100%" fill="#021024" rx="14" />
                  <rect x="60" y="360" width="880" height="120" rx="10" fill="#081726" />
                  <rect x="180" y="170" width="220" height="150" rx="8" fill="#042033" />
                  <rect x="470" y="130" width="300" height="180" rx="8" fill="#032232" />
                  <rect x="320" y="310" width="360" height="28" rx="6" fill="#0b1720" />
                  <circle cx="750" cy="220" r="34" fill="#7dd3fc" opacity="0.12" />
                  <circle cx="750" cy="220" r="22" fill="#60a5fa" />
                  <rect x="720" y="252" width="60" height="80" rx="8" fill="#081022" opacity="0.9" />
                  <g fill="#3b82f6" opacity="0.12">
                    <rect x="196" y="178" width="26" height="6" rx="2" />
                    <rect x="230" y="196" width="88" height="8" rx="2" />
                    <rect x="482" y="148" width="28" height="6" rx="2" />
                    <rect x="520" y="168" width="160" height="8" rx="2" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Scene 3 - Senior experienced developer */}
            <div className="scene-layer scene-three">
              <div className="scene">
                <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect width="100%" height="100%" fill="#041027" rx="14" />
                  <rect x="70" y="360" width="860" height="120" rx="10" fill="#071726" />
                  <rect x="200" y="150" width="600" height="200" rx="8" fill="#031427" />
                  <rect x="240" y="130" width="240" height="140" rx="6" fill="#021127" />
                  <rect x="520" y="120" width="220" height="160" rx="6" fill="#061528" />
                  <rect x="360" y="300" width="280" height="28" rx="6" fill="#0b1720" />
                  <circle cx="150" cy="210" r="36" fill="#06b6d4" opacity="0.11" />
                  <circle cx="150" cy="210" r="22" fill="#0891b2" />
                  <rect x="120" y="252" width="60" height="88" rx="10" fill="#071726" opacity="0.92" />
                  <g fill="#06b6d4" opacity="0.14">
                    <rect x="260" y="160" width="46" height="6" rx="2" />
                    <rect x="312" y="178" width="120" height="8" rx="2" />
                    <rect x="560" y="146" width="86" height="6" rx="2" />
                    <rect x="660" y="168" width="110" height="8" rx="2" />
                  </g>
                </svg>
              </div>
            </div>

          </div>

          <div className="visual-caption" aria-hidden="true">
            <h2>Developer Workspace — Cinematic</h2>
            <p>Subtle code lines, multi-monitor desk, soft cross-fade transitions</p>
          </div>
        </div>

        <div className="form-panel">
          <div className="form-card" role="form" aria-labelledby="signin-heading">
            <div className="brand">
              <div className="brand-logo">PP</div>
              <div>
                <div id="signin-heading" className="headline">Welcome Back</div>
                <div className="sub">Ormoc City Hall PPMP-APP Consolidation System</div>
              </div>
            </div>

            {error && <div className="alert" role="alert">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">Email or Username</label>
                <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@company.com or username" required />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="pw-row">
                  <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required />
                  <button type="button" className="show-btn" aria-label="Toggle password visibility" onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button className="btn-login" type="submit" disabled={loading}>{loading ? "Please wait..." : "Sign In"}</button>

              <div className="socials" aria-hidden="false" style={{marginTop:12}}>
                <button type="button" className="social-btn" onClick={() => alert("GitHub login placeholder")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.074.55-.174.55-.386 0-.19-.007-.693-.01-1.36-2.22.483-2.69-1.07-2.69-1.07-.364-.924-.89-1.17-.89-1.17-.727-.497.055-.487.055-.487.803.056 1.225.825 1.225.825.714 1.223 1.873.87 2.33.665.072-.517.28-.87.508-1.07-1.777-.202-3.644-.888-3.644-3.95 0-.873.312-1.587.823-2.147-.083-.203-.357-1.02.078-2.125 0 0 .672-.215 2.2.82a7.66 7.66 0 012-.27c.68.003 1.37.092 2 .27 1.53-1.035 2.2-.82 2.2-.82.435 1.105.161 1.922.079 2.125.513.56.822 1.274.822 2.147 0 3.07-1.87 3.744-3.65 3.943.288.25.544.737.544 1.486 0 1.073-.01 1.94-.01 2.203 0 .214.148.463.555.384A8.001 8.001 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  <span style={{fontSize:13}}>GitHub</span>
                </button>
                <button type="button" className="social-btn" onClick={() => alert("Google login placeholder")}>
                  <svg width="16" height="16" viewBox="0 0 533.5 544.3" aria-hidden="true"><path d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272v95.4h147.1c-6.4 34.5-26.9 63.8-57.6 83.3v68.8h93.3c54.5-50.2 86.7-124.4 86.7-197.1z" fill="#4285f4"/></svg>
                  <span style={{fontSize:13}}>Google</span>
                </button>
              </div>

              <div className="links">
                <a href="#" style={{color:"inherit",textDecoration:"underline"}}>Forgot Password?</a>
                <a href="#" style={{color:"inherit",textDecoration:"underline"}}>Create Account</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
