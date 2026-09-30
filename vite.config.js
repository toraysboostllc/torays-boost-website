import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { shopDevPlugin } from "./scripts/dev/viteShopPlugin.js";

export default defineConfig({
  // shopDevPlugin is dev-server only (apply: "serve"): it answers /api/shop
  // locally with a fake backend so the store can be built and tested
  // without Supabase/PayPal. It never touches `vite build` output.
  plugins: [react(), shopDevPlugin()],
});
