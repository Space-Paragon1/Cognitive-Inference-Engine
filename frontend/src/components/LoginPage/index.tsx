import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Mode = "login" | "register";

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.title}>Cognitive Load Router</div>
        <div style={styles.subtitle}>Student productivity intelligence</div>

        <div style={styles.tabs}>
          <button
            type="button"
            style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Sign In
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(mode === "register" ? styles.tabActive : {}) }}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Create Account
          </button>
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

          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder={mode === "register" ? "At least 8 characters" : "Password"}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.submit} disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
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
} as const;
