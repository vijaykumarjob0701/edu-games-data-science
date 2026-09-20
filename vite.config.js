import { defineConfig, loadEnv } from "vite";
import { passwordGatePlugin } from "./plugins/password-gate.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sitePassword = env.SITE_PASSWORD || process.env.SITE_PASSWORD || "";

  return {
    plugins: [passwordGatePlugin(sitePassword)],
    test: {
      environment: "node",
      include: ["tests/**/*.test.js"],
    },
    build: {
      assetsInlineLimit: 0,
    },
  };
});
