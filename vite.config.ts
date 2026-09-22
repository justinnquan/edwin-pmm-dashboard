import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Shown in the rail footer, so a screenshot always says which build it came from.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
