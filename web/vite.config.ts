import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    mdx({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }),
    react(),
  ],
  worker: { format: "es" },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
});
