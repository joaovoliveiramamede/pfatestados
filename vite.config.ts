import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  appType: "spa",
  server: {
    middlewareMode: true,
    fs: {
      deny: ["data", "uploads", "server", ".git"],
    },
    watch: {
      ignored: ["**/uploads/**", "**/data/**"],
    },
  },
});
