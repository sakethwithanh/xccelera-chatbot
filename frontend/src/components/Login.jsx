import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Icon } from "./icons";
import World from "./World";

const FEATURES = [
  { icon: Icon.spark, h: "Persistent memory", p: "Recall names, projects and preferences across every session." },
  { icon: Icon.news, h: "Daily intel feed", p: "The signals that move your industry, summarized at dawn." },
];

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const isSignup = mode === "signup";

  function switchMode(m) {
    setMode(m);
    setError(null);
    setNote(null);
  }

  async function forgot() {
    setError(null);
    setNote(null);
    if (!email) return setError("Enter your email first, then click Forgot?");
    setLoading(true);
    const { error: err } = await resetPassword(email);
    setLoading(false);
    if (err) return setError(err.message);
    setNote(
      "If an account exists for that email, a password reset link has been sent. Check your inbox.",
    );
  }

  async function submit(e) {
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
    if (err) return setError(err.message);
    if (isSignup && !data.session) {
      setNote("Account created. Confirm via email (if enabled), then sign in.");
      setMode("signin");
    }
  }

  return (
    <>
      <World />
      <main className="auth-shell">
        <aside className="auth-aside">
          <div className="brand-large">
            <div className="mark has-img" aria-hidden="true">
              <img src="/axis-icon.png" alt="" />
            </div>
            <div className="wordmark">
              <em>A</em>xis
            </div>
          </div>

          <div className="hero-copy">
            <span className="eyebrow">
              <span className="dot" /> Context-aware agentic AI
            </span>
            <h1>
              An assistant that <em>remembers</em>, reasons, and runs ahead of
              you.
            </h1>
            <p>
              Axis connects your conversations into a single working memory —
              so every question picks up exactly where the last one left off.
            </p>

            <div className="features">
              {FEATURES.map((f, i) => (
                <div className="feature" key={i}>
                  <div className="ico">
                    <f.icon width="16" height="16" />
                  </div>
                  <h4>{f.h}</h4>
                  <p>{f.p}</p>
                </div>
              ))}
            </div>

            <div className="testimonial">
              <p>“Axis replaced four tabs and three rituals. It just <em>knows</em>.”</p>
              <div className="who">
                <span className="ava" aria-hidden="true" />
                <span>Mira Okafor · Head of Research, Halcyon Labs</span>
              </div>
            </div>
          </div>

          <div className="row" style={{ gap: 24, marginTop: 28, color: "var(--ink-3)", fontSize: 12 }}>
            <span>SOC&nbsp;2 Type&nbsp;II</span><span>·</span>
            <span>GDPR</span><span>·</span>
            <span>ISO&nbsp;27001</span>
          </div>
        </aside>

        <section className="auth-card-wrap">
          <div className="auth-card panel" data-state={mode}>
            <div className="auth-tabs">
              <div className="tabs">
                <button className={`tab${!isSignup ? " active" : ""}`} type="button" onClick={() => switchMode("signin")}>
                  Sign in
                </button>
                <button className={`tab${isSignup ? " active" : ""}`} type="button" onClick={() => switchMode("signup")}>
                  Create account
                </button>
              </div>
            </div>

            <h2>{isSignup ? "Build with Axis." : "Welcome back."}</h2>
            <p className="lede">
              {isSignup ? (
                <>Start your workspace. No card required — your context-aware AI co-worker awaits.</>
              ) : (
                <>Sign in to continue with <b>Axis</b> — picks up right where you left off.</>
              )}
            </p>

            {error && <div className="auth-msg err">{error}</div>}
            {note && <div className="auth-msg ok">{note}</div>}

            <form className="auth-form" onSubmit={submit}>
              {isSignup && (
                <div className="field">
                  <label>Full name</label>
                  <div className="input">
                    <span className="lead"><Icon.user width="16" height="16" /></span>
                    <input type="text" placeholder="Saketh Ragirolla" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="field">
                <label>Work email</label>
                <div className="input">
                  <span className="lead"><Icon.mail width="16" height="16" /></span>
                  <input type="email" placeholder="you@company.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="field">
                <div className="row-between">
                  <label>Password</label>
                  {!isSignup && (
                    <a
                      className="link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        forgot();
                      }}
                    >
                      Forgot?
                    </a>
                  )}
                </div>
                <div className="input">
                  <span className="lead"><Icon.lock width="16" height="16" /></span>
                  <input type={showPw ? "text" : "password"} placeholder="••••••••••••" autoComplete={isSignup ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                  <span className="trail">
                    <button type="button" aria-label="Show password" onClick={() => setShowPw(!showPw)}>
                      <Icon.eye width="16" height="16" />
                    </button>
                  </span>
                </div>
              </div>

              <div className="row-between" style={{ marginTop: 2 }}>
                <label className="check">
                  <input type="checkbox" defaultChecked />
                  <span className="box" />
                  <span>Keep me signed in</span>
                </label>
                <span className="muted mono" style={{ fontSize: 11 }}>256-bit · zero-trust</span>
              </div>

              <button className="btn btn--primary submit" type="submit" disabled={loading}>
                {loading ? "Working…" : isSignup ? "Create my workspace" : "Sign in to Axis"}
                <Icon.arrow className="ico" />
              </button>

              <p className="foot">
                {isSignup ? (
                  <>Already have access?{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); switchMode("signin"); }}>Sign in →</a>
                  </>
                ) : (
                  <>New to Axis?{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); switchMode("signup"); }}>Create an account →</a>
                  </>
                )}
              </p>
            </form>
          </div>
        </section>
      </main>

      <div className="legal">
        © 2026 Axis · Context-aware Agentic AI
      </div>
    </>
  );
}
