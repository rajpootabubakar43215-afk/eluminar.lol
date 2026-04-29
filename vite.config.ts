import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "cpu-features": new URL("./src/shims/empty.ts", import.meta.url).pathname,
      },
    },
  },
});
