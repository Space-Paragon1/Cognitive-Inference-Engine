/* Sign in, create account, forgot password and set a new password (ScreenAuth).
   Desktop: the form on the left, the brand panel on the right. Phones: one column
   with the logo on top. Errors sit under their field and are announced; the
   submit button stays enabled and fields validate on blur and on submit. */
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowLeft, CircleAlert, EyeOff, Gauge, Info, Lock, Mail, Smartphone, WifiOff } from "lucide-react";
import { HttpError, forgotPassword } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { exitApp, useHardwareBack } from "../../lib/backStack";
import type { Icon } from "../../types/ui";
import { Banner } from "../Banner";
import { BottomSheet } from "../BottomSheet";
import { Button } from "../Button";
import { LoadGauge } from "../LoadGauge";
import { Logo } from "../Logo";
import { PrivacyPromise } from "../PrivacyPromise";
import { TextField } from "../TextField";
import { EMAIL_PARTIAL, MIN_PASSWORD, PASSWORD_MISSING, PASSWORD_SHORT, emailError, strength, waitText } from "./validate";
import styles from "./LoginPage.module.css";

type Mode = "signin" | "create" | "forgot" | "reset";

/** Set by App when the engine ends the session (socket closed with 4001). */
export const SESSION_EXPIRED_KEY = "clr_session_expired";
const TITLE_ID = "auth-title";
/** Seconds before "Resend" is allowed again. */
const RESEND_WAIT = 60;

interface FormIssue {
  title: string;
  body: string;
  icon: Icon;
  action?: { label: string; onClick: () => void };
}

/* The engine's emailed link is `?reset_token=`; older links used `?token=`. */
function readResetToken(): string | null {
  const q = new URLSearchParams(window.location.search);
  return q.get("reset_token") ?? q.get("token");
}
function clearResetToken() {
  const url = new URL(window.location.href);
  url.searchParams.delete("reset_token");
  url.searchParams.delete("token");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
function takeExpiredFlag(): boolean {
  try {
    const v = sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1";
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    return v;
  } catch {
    return false;
  }
}

/** Anything that isn't a field error: rate limits, the server, the network. */
function issueFor(err: unknown): FormIssue {
  if (err instanceof HttpError && err.status === 429) {
    return { icon: CircleAlert, title: "Too many attempts.", body: `Wait ${waitText(err.retryAfter)} and try again.` };
  }
  if (err instanceof HttpError && err.status >= 500) {
    return { icon: CircleAlert, title: "Something went wrong on our side.", body: "Your data is safe. Try again in a moment." };
  }
  if (!navigator.onLine) {
    return { icon: WifiOff, title: "You are offline.", body: "Connect to the internet, then try again." };
  }
  return { icon: WifiOff, title: "Couldn't reach CLR.", body: "Check your connection and try again." };
}

function focusField(id: string) {
  window.setTimeout(() => document.getElementById(id)?.focus(), 0);
}

export function LoginPage() {
  const [token] = useState(readResetToken);
  const [mode, setMode] = useState<Mode>(token ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [expired] = useState(takeExpiredFlag);
  const first = useRef(true);

  const go = (m: Mode) => {
    if (m !== "reset" && mode === "reset") clearResetToken();
    setMode(m);
  };

  // Move focus to the new heading when the form changes, so it is announced.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById(TITLE_ID)?.focus({ preventScroll: true });
  }, [mode]);

  useHardwareBack(() => (mode === "signin" ? exitApp() : go("signin")));

  let form: ReactNode;
  if (mode === "create") form = <CreateForm email={email} setEmail={setEmail} onSignIn={() => go("signin")} />;
  else if (mode === "forgot") form = <ForgotForm email={email} setEmail={setEmail} onBack={() => go("signin")} />;
  else if (mode === "reset" && token) form = <ResetForm token={token} onExpired={() => go("forgot")} onBack={() => go("signin")} />;
  else form = <SignInForm email={email} setEmail={setEmail} expired={expired} onForgot={() => go("forgot")} onCreate={() => go("create")} />;

  return (
    <div className={styles.page}>
      <main className={styles.panel}>
        <div className={styles.column}>
          <div className={styles.mobileLogo}>
            <Logo size={32} />
            <span className="sr-only">Cognitive Load Router</span>
          </div>
          {form}
        </div>
      </main>
      <Aside />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Heading({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className={styles.heading}>
      <h1 id={TITLE_ID} tabIndex={-1}>
        {title}
      </h1>
      <p>{sub}</p>
    </div>
  );
}

/** Critical banners carry role="alert", so they are announced as they appear. */
function IssueBanner({ issue }: { issue: FormIssue | null }) {
  return issue ? <Banner tone="critical" icon={issue.icon} title={issue.title} body={issue.body} action={issue.action} /> : null;
}

function LinkButton({ children, onClick, block = false }: { children: ReactNode; onClick: () => void; block?: boolean }) {
  return (
    <button type="button" className={[styles.link, block && styles.linkBlock].filter(Boolean).join(" ")} onClick={onClick}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */

interface EmailProps {
  email: string;
  setEmail: (v: string) => void;
}

function SignInForm({ email, setEmail, expired, onForgot, onCreate }: EmailProps & { expired: boolean; onForgot: () => void; onCreate: () => void }) {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [seen, setSeen] = useState({ email: false, password: false });
  const [wrong, setWrong] = useState(false);
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [busy, setBusy] = useState(false);

  const emailErr = seen.email ? emailError(email) : undefined;
  const pwErr = wrong ? "That email and password do not match. Check both and try again." : seen.password && !password ? PASSWORD_MISSING : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSeen({ email: true, password: true });
    setWrong(false);
    setIssue(null);
    if (emailError(email)) return focusField("signin-email");
    if (!password) return focusField("signin-password");
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setBusy(false);
      if (err instanceof HttpError && (err.status === 401 || err.status === 422)) {
        setWrong(true);
        focusField("signin-password");
      } else setIssue(issueFor(err));
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {expired && <Banner tone="caution" icon={Info} title="You were signed out." body="Sign in again to carry on. Your data is safe." />}
      <Heading title="Welcome back" sub="Sign in to pick up where you left off." />
      <TextField
        id="signin-email"
        label="Email"
        type="email"
        icon={Mail}
        value={email}
        onChange={setEmail}
        onBlur={() => setSeen((s) => ({ ...s, email: email !== "" || s.email }))}
        error={emailErr}
        autoComplete="email"
        inputMode="email"
      />
      <TextField
        id="signin-password"
        label="Password"
        type="password"
        icon={Lock}
        value={password}
        onChange={(v) => {
          setPassword(v);
          setWrong(false);
        }}
        onBlur={() => setSeen((s) => ({ ...s, password: s.password || password !== "" }))}
        error={pwErr}
        autoComplete="current-password"
        aside={<LinkButton onClick={onForgot}>Forgot password?</LinkButton>}
      />
      <IssueBanner issue={issue} />
      <Button type="submit" size="lg" block loading={busy} loadingLabel="Signing in…">
        Sign in
      </Button>
      <p className={styles.switch}>
        New here? <LinkButton onClick={onCreate}>Create an account</LinkButton>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function CreateForm({ email, setEmail, onSignIn }: EmailProps & { onSignIn: () => void }) {
  const { register } = useAuth();
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [seen, setSeen] = useState({ email: false, password: false, terms: false });
  const [taken, setTaken] = useState(false);
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const meter = strength(password);

  const emailErr = taken ? "There's already an account with this email. Sign in instead." : seen.email ? emailError(email) : undefined;
  const pwErr = seen.password && password.length < MIN_PASSWORD ? PASSWORD_SHORT : undefined;
  const termsErr = seen.terms && !agreed ? "Agree to the terms to create your account." : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSeen({ email: true, password: true, terms: true });
    setIssue(null);
    if (emailError(email)) return focusField("create-email");
    if (password.length < MIN_PASSWORD) return focusField("create-password");
    if (!agreed) return focusField("create-terms");
    setBusy(true);
    try {
      await register(email.trim(), password);
    } catch (err) {
      setBusy(false);
      if (err instanceof HttpError && err.status === 409) {
        setTaken(true);
        focusField("create-email");
      } else if (err instanceof HttpError && err.status === 422) {
        // The engine's own email check is stricter than ours.
        setSeen((s) => ({ ...s, email: true }));
        setIssue({ icon: CircleAlert, title: "Check your email address.", body: EMAIL_PARTIAL });
      } else setIssue(issueFor(err));
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Heading title="Create your account" sub="Takes a minute. Your data stays yours." />
      <TextField
        id="create-email"
        label="Email"
        type="email"
        icon={Mail}
        value={email}
        onChange={(v) => {
          setEmail(v);
          setTaken(false);
        }}
        onBlur={() => setSeen((s) => ({ ...s, email: s.email || email !== "" }))}
        error={emailErr}
        autoComplete="email"
        inputMode="email"
      />
      <TextField
        id="create-password"
        label="Password"
        type="password"
        icon={Lock}
        value={password}
        onChange={setPassword}
        onBlur={() => setSeen((s) => ({ ...s, password: s.password || password !== "" }))}
        error={pwErr}
        help={meter?.help ?? "At least 8 characters."}
        valid={!!meter?.strong}
        strength={meter?.bars}
        autoComplete="new-password"
      />
      <div className={styles.checkWrap}>
        <label className={styles.check}>
          <input
            id="create-terms"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            aria-invalid={termsErr ? true : undefined}
            aria-describedby={termsErr ? "create-terms-error" : undefined}
          />
          <span className={styles.box} aria-hidden="true" />
          <span>
            I agree to the{" "}
            <LinkButton
              onClick={() => {
                setTerms(true);
              }}
            >
              terms and privacy policy
            </LinkButton>
            .
          </span>
        </label>
        {termsErr && (
          <span id="create-terms-error" className={styles.checkError} role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {termsErr}
          </span>
        )}
      </div>
      <IssueBanner issue={issue} />
      <Button type="submit" size="lg" block loading={busy} loadingLabel="Creating your account…">
        Create account
      </Button>
      <p className={styles.switch}>
        Have an account? <LinkButton onClick={onSignIn}>Sign in</LinkButton>
      </p>

      <BottomSheet
        open={terms}
        title="Terms and privacy"
        onClose={() => setTerms(false)}
        actions={
          <Button
            onClick={() => {
              setAgreed(true);
              setTerms(false);
            }}
          >
            I agree
          </Button>
        }
      >
        <div className={styles.terms}>
          <p>CLR estimates how mentally loaded you are from how you work, then adjusts your timers, your task order and your notifications. It is a study aid, not a judgement.</p>
          <PrivacyPromise flat />
          <p>Your data is yours. Export or delete everything at any time in Settings, under Privacy.</p>
        </div>
      </BottomSheet>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function ForgotForm({ email, setEmail, onBack }: EmailProps & { onBack: () => void }) {
  const [seen, setSeen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const err = seen ? emailError(email) : undefined;
  const sent = sentTo != null && sentTo === email.trim();

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setSeen(true);
    setIssue(null);
    if (emailError(email)) return focusField("forgot-email");
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSentTo(email.trim());
      setWait(RESEND_WAIT);
    } catch (e) {
      setIssue(issueFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (!sent) void send();
      }}
      noValidate
    >
      <Heading title="Reset your password" sub="We will email you a link to set a new one." />
      <TextField
        id="forgot-email"
        label="Email"
        type="email"
        icon={Mail}
        value={email}
        onChange={setEmail}
        onBlur={() => setSeen((s) => s || email !== "")}
        error={err}
        autoComplete="email"
        inputMode="email"
      />
      <IssueBanner issue={issue} />
      <Button type="submit" size="lg" block variant={sent ? "secondary" : "primary"} disabled={sent} loading={busy && !sent} loadingLabel="Sending…">
        Send reset link
      </Button>
      {sent && (
        <div className={styles.sent} data-tone="positive" role="status">
          <span className={styles.sentArt} aria-hidden="true">
            <Mail size={24} />
          </span>
          <p className={styles.sentTitle}>Check your inbox</p>
          {/* Deliberately neutral: never confirm whether an account exists. */}
          <p className={styles.sentBody}>If that email is registered, a link has been sent. It works for an hour.</p>
          <Button variant="ghost" size="sm" disabled={wait > 0} loading={busy} loadingLabel="Sending…" onClick={send}>
            {wait > 0 ? `Resend in 0:${String(wait).padStart(2, "0")}` : "Resend link"}
          </Button>
        </div>
      )}
      <LinkButton block onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to sign in
      </LinkButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function ResetForm({ token, onExpired, onBack }: { token: string; onExpired: () => void; onBack: () => void }) {
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [seen, setSeen] = useState({ password: false, confirm: false });
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const meter = strength(password);
  const match = confirm !== "" && confirm === password;

  const pwErr = seen.password && password.length < MIN_PASSWORD ? PASSWORD_SHORT : undefined;
  const confirmErr = seen.confirm && !match ? (confirm ? "These don't match yet." : "Type the new password again.") : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSeen({ password: true, confirm: true });
    setIssue(null);
    if (password.length < MIN_PASSWORD) return focusField("reset-password");
    if (confirm !== password) return focusField("reset-confirm");
    setBusy(true);
    try {
      await resetPassword(token, password);
      clearResetToken();
    } catch (err) {
      setBusy(false);
      if (err instanceof HttpError && err.status === 400) {
        setIssue({
          icon: CircleAlert,
          title: "This link has expired.",
          body: "Request a new one. Reset links last an hour.",
          action: { label: "Request a new link", onClick: onExpired },
        });
      } else setIssue(issueFor(err));
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Heading title="Set a new password" sub="You will be signed in as soon as it is saved." />
      <TextField
        id="reset-password"
        label="New password"
        type="password"
        icon={Lock}
        value={password}
        onChange={setPassword}
        onBlur={() => setSeen((s) => ({ ...s, password: s.password || password !== "" }))}
        error={pwErr}
        help={meter?.help ?? "At least 8 characters."}
        valid={!!meter?.strong}
        strength={meter?.bars}
        autoComplete="new-password"
        autoFocus
      />
      <TextField
        id="reset-confirm"
        label="Confirm password"
        type="password"
        icon={Lock}
        value={confirm}
        onChange={setConfirm}
        onBlur={() => setSeen((s) => ({ ...s, confirm: s.confirm || confirm !== "" }))}
        error={confirmErr}
        help={match ? "Passwords match." : undefined}
        valid={match}
        autoComplete="new-password"
      />
      <IssueBanner issue={issue} />
      <Button type="submit" size="lg" block loading={busy} loadingLabel="Saving…">
        Save password
      </Button>
      <LinkButton block onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to sign in
      </LinkButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */

const PROMISES: [Icon, string, string][] = [
  [EyeOff, "Never reads what you type", "Only rhythm and timing. No keystroke content, no page text."],
  [Gauge, "High load is information", "Not a grade. It tells CLR when to make things easier."],
  [Smartphone, "Laptop and phone", "Timers and nudges follow you to Android."],
];

/** The brand panel (desktop ≥1024px only). */
function Aside() {
  return (
    <aside className={styles.aside} aria-label="About Cognitive Load Router">
      <div className={styles.brand}>
        <Logo size={40} />
        <span>Cognitive Load Router</span>
      </div>
      <p className={styles.tagline}>A calm coach for how you study.</p>
      <p className={styles.pitch}>CLR notices when your focus is deep, scattered or worn out, then protects it, times your breaks and reorders your tasks to match.</p>
      <ul className={styles.promises}>
        {PROMISES.map(([I, title, body]) => (
          <li key={title}>
            <I size={20} aria-hidden="true" />
            <span>
              <b>{title}</b>
              {body}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.art} aria-hidden="true">
        <LoadGauge variant="mini" load={0.62} context="deep_focus" confidence={1} size={300} />
      </div>
    </aside>
  );
}
