import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build:share` makes one self-contained HTML file of the client pages only (no studio, no internal notes).
export default defineConfig(({ mode }) =>
  mode === "share"
    ? {
        plugins: [react(), viteSingleFile()],
        define: { "import.meta.env.VITE_SHARE": JSON.stringify("1") },
        build: { outDir: "dist-share", rollupOptions: { input: "share.html" } },
      }
    : { plugins: [react()] }
);
