// Production bundle for the API server (single-service hosts like Render).
// vite build empties dist/ first, so this runs AFTER it and drops the
// bundled server next to the frontend assets: dist/server.js.
// Run: npm run build:server (or plain `npm run build` which chains both).
import { build } from "esbuild";

await build({
  entryPoints: ["server/api-server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/server.js",
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
