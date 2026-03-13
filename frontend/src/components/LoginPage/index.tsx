import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import * as api from "../../api/client";

type Mode = "login" | "register" | "forgot" | "reset";

export function LoginPage() {
  const { login, register } = useAuth();

  // If the URL contains ?token=xxx, jump straight to the reset form.
  const initialToken =
    new URLSearchParams(window.location.search).get("token") ?? "";
  const [mode, setMode] = useState<Mode>(initialToken ? "reset" : "login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetToken, setResetToken] = useState(initialToken);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // Keep resetToken in sync if the query param changes (e.g. deep link).
  useEffect(() => {
    const tok = new URLSearchParams(window.location.search).get("token") ?? "";
    if (tok) {
      setResetToken(tok);
      setMode("reset");
    }
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else if (mode === "register") {
        await register(email, password);
      } else if (mode === "forgot") {
        await api.forgotPassword(email);
        setInfo("If that email is registered, a reset link has been sent.");
        setEmail("");
      } else if (mode === "reset") {
        const { access_token } = await api.resetPassword(resetToken, newPassword);
        // Log in immediately with the new token.
        api.setAuthToken(access_token);
        window.location.replace(
          window.location.pathname + window.location.hash
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderLoginRegisterTabs = () => (
    <div style={styles.tabs}>
      <button
        type="button"
        style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
        onClick={() => switchMode("login")}
      >
        Sign In
      </button>
      <button
        type="button"
        style={{
          ...styles.tab,
          ...(mode === "register" ? styles.tabActive : {}),
        }}
        onClick={() => switchMode("register")}
      >
        Create Account
      </button>
    </div>
  );

  const renderForgotMode = () => (
    <>
      <div style={styles.backRow}>
        <button
          type="button"
          style={styles.backBtn}
          onClick={() => switchMode("login")}
        >
          ← Back to Sign In
        </button>
      </div>
      <div style={styles.modeHeading}>Reset your password</div>
      <div style={styles.modeSubtext}>
        Enter your account email and we'll send a reset link.
      </div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </label>
        {error && <div style={styles.error}>{error}</div>}
        {info && <div style={styles.success}>{info}</div>}
        <button type="submit" style={styles.submit} disabled={busy}>
          {busy ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </>
  );

  const renderResetMode = () => (
    <>
      <div style={styles.modeHeading}>Set a new password</div>
      <div style={styles.modeSubtext}>
        Choose a password of at least 8 characters.
      </div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={styles.input}
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
          />
        </label>
        {error && <div style={styles.error}>{error}</div>}
        <button type="submit" style={styles.submit} disabled={busy}>
          {busy ? "Saving..." : "Set New Password"}
        </button>
        <button
          type="button"
          style={styles.linkBtn}
          onClick={() => switchMode("login")}
        >
          Back to Sign In
        </button>
      </form>
    </>
  );

  const renderLoginRegisterMode = () => (
    <>
      {renderLoginRegisterTabs()}
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            placeholder={
              mode === "register" ? "At least 8 characters" : "Password"
            }
            required
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        </label>

        {mode === "login" && (
          <button
            type="button"
            style={styles.linkBtn}
            onClick={() => switchMode("forgot")}
          >
            Forgot password?
          </button>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" style={styles.submit} disabled={busy}>
          {busy
            ? "Please wait..."
            : mode === "login"
            ? "Sign In"
            : "Create Account"}
        </button>
      </form>
    </>
  );

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.title}>Cognitive Load Router</div>
        <div style={styles.subtitle}>Student productivity intelligence</div>

        {mode === "forgot"
          ? renderForgotMode()
          : mode === "reset"
          ? renderResetMode()
          : renderLoginRegisterMode()}
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "#0d0d1f",
  } as React.CSSProperties,

  card: {
    background: "#13132b",
    border: "1px solid #1e1e3a",
    borderRadius: 20,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 400,
  } as React.CSSProperties,

  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#e8e8ff",
    marginBottom: 4,
  } as React.CSSProperties,

  subtitle: {
    fontSize: 13,
    color: "#6666aa",
    marginBottom: 28,
  } as React.CSSProperties,

  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
  } as React.CSSProperties,

  tab: {
    flex: 1,
    padding: "8px 0",
    background: "none",
    border: "1px solid #2a2a4a",
    borderRadius: 10,
    color: "#6666aa",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  } as React.CSSProperties,

  tabActive: {
    background: "#1e1e4a",
    borderColor: "#4a4af0",
    color: "#a0a0ff",
  } as React.CSSProperties,

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  } as React.CSSProperties,

  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "#8888bb",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  } as React.CSSProperties,

  input: {
    background: "#0d0d1f",
    border: "1px solid #2a2a4a",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#e8e8ff",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  } as React.CSSProperties,

  error: {
    background: "#3a0d0d",
    border: "1px solid #6a2020",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#f08080",
    fontSize: 13,
  } as React.CSSProperties,

  success: {
    background: "#0d2a1a",
    border: "1px solid #205a30",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#80e0a0",
    fontSize: 13,
  } as React.CSSProperties,

  submit: {
    marginTop: 4,
    padding: "12px 0",
    background: "#4a4af0",
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.15s",
  } as React.CSSProperties,

  linkBtn: {
    background: "none",
    border: "none",
    color: "#7070cc",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
    textDecoration: "underline",
  } as React.CSSProperties,

  backRow: {
    marginBottom: 16,
  } as React.CSSProperties,

  backBtn: {
    background: "none",
    border: "none",
    color: "#7070cc",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
  } as React.CSSProperties,

  modeHeading: {
    fontSize: 16,
    fontWeight: 700,
    color: "#e8e8ff",
    marginBottom: 6,
  } as React.CSSProperties,

  modeSubtext: {
    fontSize: 13,
    color: "#6666aa",
    marginBottom: 20,
  } as React.CSSProperties,
} as const;
