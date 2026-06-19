#!/usr/bin/env node
/* global console */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "../package.json"));

// Absolute paths to preact's ESM + CJS builds. The renderer (@testing-library/preact)
// imports preact's ESM build, so every react/react-dom shim must re-export the SAME
// ESM build or hooks attach to a second preact instance and break.
const compatCjs = require.resolve("preact/compat");
const compatMjs = compatCjs.replace(/compat\.js$/, "compat.mjs");
const jsxCjs = require.resolve("preact/jsx-runtime");
const jsxMjs = jsxCjs.replace(/jsxRuntime\.js$/, "jsxRuntime.mjs");

const q = (p) => JSON.stringify(p);

function esmReexport(mjs) {
  return (
    `export * from ${q(mjs)};\n` + `import __mod from ${q(mjs)};\n` + `export default __mod;\n`
  );
}
function cjsReexport(cjs) {
  return `module.exports = require(${q(cjs)});\n`;
}

const pkgJson = (name) =>
  JSON.stringify(
    {
      name,
      version: "18.2.0",
      type: "module",
      main: "index.js",
      module: "index.mjs",
      exports: {
        ".": { import: "./index.mjs", require: "./index.js", default: "./index.mjs" },
        "./client": { import: "./index.mjs", require: "./index.js", default: "./index.mjs" },
        "./jsx-runtime": {
          import: "./jsx-runtime.mjs",
          require: "./jsx-runtime.js",
          default: "./jsx-runtime.mjs",
        },
        "./jsx-dev-runtime": {
          import: "./jsx-dev-runtime.mjs",
          require: "./jsx-dev-runtime.js",
          default: "./jsx-dev-runtime.mjs",
        },
        "./package.json": "./package.json",
      },
    },
    null,
    2
  );

function writeShim(dir, name) {
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), pkgJson(name));
  writeFileSync(join(dir, "index.mjs"), esmReexport(compatMjs));
  writeFileSync(join(dir, "index.js"), cjsReexport(compatCjs));
  writeFileSync(join(dir, "client.js"), cjsReexport(compatCjs));
  writeFileSync(join(dir, "jsx-runtime.mjs"), `export * from ${q(jsxMjs)};\n`);
  writeFileSync(join(dir, "jsx-runtime.js"), cjsReexport(jsxCjs));
  writeFileSync(join(dir, "jsx-dev-runtime.mjs"), `export * from ${q(jsxMjs)};\n`);
  writeFileSync(join(dir, "jsx-dev-runtime.js"), cjsReexport(jsxCjs));
}

// Local shim for the frontend workspace.
writeShim(join(__dirname, "../node_modules/react"), "react");

// Bun hoists peer-required react@19/react-dom@19 into the workspace store, which
// shadows the local shim for libraries like @tanstack/react-query. Rewrite those
// hoisted copies so the whole tree shares one preact renderer.
const storeDir = join(__dirname, "../../node_modules/.bun");
if (existsSync(storeDir)) {
  for (const entry of readdirSync(storeDir)) {
    if (entry.startsWith("react@")) {
      writeShim(join(storeDir, entry, "node_modules/react"), "react");
    }
    if (entry.startsWith("react-dom@")) {
      writeShim(join(storeDir, entry, "node_modules/react-dom"), "react-dom");
    }
  }
}

console.log("React shim for Bun tests created");
