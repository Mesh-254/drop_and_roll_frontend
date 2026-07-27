import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// Build-time configuration guard. Lives in its own module so it is unit-testable
// without loading the Vite plugin chain — see src/config/assertProductionEnv.test.js.
import { assertProductionEnv } from "./src/config/assertProductionEnv.js";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Third arg "" loads every var, not only VITE_-prefixed ones, so the secret-leak check
  // above can see a server-side key that was mistakenly given a VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), "");

  if (mode === "production") {
    assertProductionEnv(env, {
      // Read from process.env, NOT from `env`. loadEnv would happily pick this name up out
      // of .env.production, and a hatch that can be written to a file is a permanent
      // downgrade nobody remembers enabling. It has to be typed on the command line.
      allowTestStripeKey: process.env.ALLOW_TEST_STRIPE_KEY === "1",
    });
  }

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react-router-dom")
            ) {
              return "vendor-react";
            }
            if (id.includes("node_modules/@react-oauth")) {
              return "vendor-auth";
            }
            if (
              id.includes("node_modules/react-hot-toast") ||
              id.includes("node_modules/lucide-react")
            ) {
              return "vendor-ui";
            }
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
