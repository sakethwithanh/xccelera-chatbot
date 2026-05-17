import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Icon } from "./icons";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const isSignup = mode === "signup";

  function switchMode(next) {
    setMode(next);
    setError(null);
    setNote(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password || loading) return;
    if (isSignup && !name) return;
    setError(null);
    setNote(null);
    setLoading(true);
    const { data, error: err } = isSignup
      ? await signUp(email, password, name)
      : await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (isSignup && !data.session) {
      setNote(
        "Account created. If email confirmation is enabled, confirm via the link, then sign in.",
      );
      setMode("signin");
    }
    // On success with a session, AuthContext flips to the chat automatically.
  }

  return (
    <div className="login-stage">
      <video
        className="login-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>
      <div className="login-video-overlay" />
      <LoginOrbits />

      <form className="login-card" onSubmit={handleSubmit}>
        <img className="login-logo" src="/logo.webp" alt="Xccelera" />

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={`auth-tab${!isSignup ? " active" : ""}`}
            onClick={() => switchMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={`auth-tab${isSignup ? " active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Create account
          </button>
          <span className="auth-tab-thumb" data-pos={isSignup ? "1" : "0"} />
        </div>

        <h1 className="login-title">
          {isSignup ? "Create your workspace" : "Welcome back"}
        </h1>
        <p className="login-sub">
          {isSignup ? (
            <>
              Get started with{" "}
              <span style={{ color: "var(--accent-2)", fontWeight: 500 }}>
                Axis
              </span>{" "}
              — your context-aware AI assistant.
            </>
          ) : (
            <>
              Sign in to continue with{" "}
              <span style={{ color: "var(--accent-2)", fontWeight: 500 }}>
                Axis
              </span>{" "}
              — your context-aware AI assistant.
            </>
          )}
        </p>

        {error && <div className="login-error">{error}</div>}
        {note && <div className="login-note">{note}</div>}

        {isSignup && (
          <div className="login-field">
            <label htmlFor="name">Full name</label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <Icon.user />
              </span>
              <input
                id="name"
                type="text"
                className="login-input"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          </div>
        )}

        <div className="login-field">
          <label htmlFor="email">Work email</label>
          <div className="login-input-wrap">
            <span className="login-input-icon">
              <Icon.mail />
            </span>
            <input
              id="email"
              type="email"
              className="login-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="login-field">
          <label htmlFor="pw">Password</label>
          <div className="login-input-wrap">
            <span className="login-input-icon">
              <Icon.lock />
            </span>
            <input
              id="pw"
              type={showPw ? "text" : "password"}
              className="login-input"
              placeholder={
                isSignup ? "At least 6 characters" : "Enter your password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={6}
              required
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShowPw(!showPw)}
              aria-label="Toggle password visibility"
            >
              {showPw ? <Icon.eyeOff /> : <Icon.eye />}
            </button>
          </div>
        </div>

        {!isSignup ? (
          <div className="login-row">
            <label className="login-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me signed in
            </label>
          </div>
        ) : (
          <div className="login-row" style={{ marginTop: 4 }}>
            <label className="login-check">
              <input type="checkbox" required defaultChecked />
              I agree to the Terms
            </label>
          </div>
        )}

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? (
            <>
              <span className="spin" />{" "}
              {isSignup ? "Creating account…" : "Signing you in…"}
            </>
          ) : (
            <>
              {isSignup ? "Create account" : "Sign in"} <Icon.arrow />
            </>
          )}
        </button>

        <div className="login-footer">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <a
                href="#"
                className="login-link"
                onClick={(e) => {
                  e.preventDefault();
                  switchMode("signin");
                }}
              >
                Sign in
              </a>
            </>
          ) : (
            <>
              New to Xccelera?{" "}
              <a
                href="#"
                className="login-link"
                onClick={(e) => {
                  e.preventDefault();
                  switchMode("signup");
                }}
              >
                Create an account
              </a>
            </>
          )}
        </div>
      </form>

      <div className="login-tag">
        © 2026 Xccelera · Context-aware Agentic AI
      </div>
    </div>
  );
}

function LoginOrbits() {
  return (
    <svg
      className="login-orbits"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="orbitStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2D6FF8" stopOpacity="0" />
          <stop offset="50%" stopColor="#5B8DFF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2D6FF8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(720 480)">
        <circle r="180" fill="none" stroke="url(#orbitStroke)" strokeWidth="1" opacity="0.6" />
        <circle r="280" fill="none" stroke="url(#orbitStroke)" strokeWidth="1" opacity="0.45" />
        <circle r="400" fill="none" stroke="url(#orbitStroke)" strokeWidth="1" opacity="0.3" />
        <circle r="540" fill="none" stroke="url(#orbitStroke)" strokeWidth="1" opacity="0.2" />
        <circle r="700" fill="none" stroke="url(#orbitStroke)" strokeWidth="1" opacity="0.12" />
      </g>
      <g fill="#5B8DFF">
        <circle cx="320" cy="220" r="2" opacity="0.6">
          <animate attributeName="opacity" values="0.2;0.9;0.2" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="1180" cy="180" r="2.5" opacity="0.7">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="240" cy="700" r="1.5" opacity="0.5">
          <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="1240" cy="720" r="2" opacity="0.6">
          <animate attributeName="opacity" values="0.3;0.9;0.3" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="180" cy="440" r="1.5" opacity="0.4" />
        <circle cx="1280" cy="460" r="1.5" opacity="0.4" />
      </g>
    </svg>
  );
}
