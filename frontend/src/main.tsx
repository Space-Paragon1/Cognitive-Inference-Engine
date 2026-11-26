import React from "react";
import ReactDOM from "react-dom/client";
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
