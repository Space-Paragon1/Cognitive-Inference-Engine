import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cognitiveloadrouter.app",
  appName: "Cognitive Load Router",
  webDir: "dist",
  server: {
    // Use https scheme on Android so cookies and fetch behave like a real browser
    androidScheme: "https",
  },
};

export default config;
