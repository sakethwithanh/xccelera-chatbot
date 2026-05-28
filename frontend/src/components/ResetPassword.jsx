import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Icon } from "./icons";
import World from "./World";

export default function ResetPassword() {
  const { updatePassword, clearRecovery, signOut } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) return setError("Password must be at least 6 characters.");
    if (pw !== pw2) return setError("Passwords don't match.");
    setLoading(true);
    const { error: err } = await updatePassword(pw);
    setLoading(false);
    if (err) return setError(err.message);
    setDone(true);
  }

  return (
    <>
      <World />
      <main className="auth-shell" style={{ gridTemplateColumns: "1fr" }}>
        <section className="auth-card-wrap">
          <div className="auth-card" style={{ maxWidth: 460, margin: "0 auto" }}>
            <h2>Set a new password</h2>
            <p className="lede">
              You arrived from a password-reset link. Choose a new password
              below.
            </p>

            {error && <div className="auth-msg err">{error}</div>}
            {done && (
              <div className="auth-msg ok">
                Password updated. You're signed in.
              </div>
            )}

            {!done ? (
              <form className="auth-form" onSubmit={submit}>
                <div className="field">
                  <label>New password</label>
                  <div className="input">
                    <span className="lead"><Icon.lock width="16" height="16" /></span>
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="At least 6 characters"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                    />
                    <span className="trail">
                      <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Show password">
                        <Icon.eye width="16" height="16" />
                      </button>
                    </span>
                  </div>
                </div>

                <div className="field">
                  <label>Confirm password</label>
                  <div className="input">
                    <span className="lead"><Icon.lock width="16" height="16" /></span>
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Re-enter password"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                    />
                  </div>
                </div>

                <button className="btn btn--primary submit" type="submit" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                  <Icon.arrow className="ico" />
                </button>
              </form>
            ) : (
              <button
                className="btn btn--primary submit"
                onClick={() => {
                  clearRecovery();
                }}
              >
                Continue to Axis
                <Icon.arrow className="ico" />
              </button>
            )}

            <p className="foot">
              <a
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  clearRecovery();
                  await signOut();
                }}
              >
                Cancel and sign in instead
              </a>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
