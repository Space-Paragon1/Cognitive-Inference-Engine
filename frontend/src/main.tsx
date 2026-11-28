import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist-mono/500.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./mobile.css";
import { AuthProvider } from "./auth/AuthContext";
import App from "./App";

function boot() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}

// Dev-only mock engine (VITE_MOCK=1 npm run dev); dropped from production builds.
if (import.meta.env.DEV && import.meta.env.VITE_MOCK === "1") {
  import("./dev/mockEngine").then(boot);
} else {
  boot();
}

// The web app works offline and can be installed (sw/sw.js). The Android and iOS apps
// already carry their files, so they don't register one.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Not supported here (private window, http): the app works without it. */
    });
  });
}
