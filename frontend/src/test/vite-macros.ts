import { plugin } from "bun";
import { readFileSync } from "fs";

// `import.meta.glob` is a Vite compile-time macro that is undefined under `bun test`.
// In production it eagerly loads the optional `custom/frontend` extension. We rewrite it
// to a small inline fake (one nav item, no routes) so files using it — Navigation.tsx and
// main.tsx — load AND exercise their custom-extension code paths under coverage, instead of
// being mocked out wholesale.
(globalThis as { __knitlyExtIcon?: () => null }).__knitlyExtIcon = () => null;

const fakeGlob =
  '({ "custom/frontend": { ' +
  'customNavItems: [{ to: "/ext-demo", label: "Ext Demo", icon: globalThis.__knitlyExtIcon }], ' +
  "customRoutes: [] } })";

plugin({
  name: "vite-import-meta-glob",
  setup(build) {
    build.onLoad({ filter: /(components\/Navigation|main)\.tsx$/ }, (args) => {
      const source = readFileSync(args.path, "utf8");
      const contents = source.replace(/import\.meta\.glob\s*(<[^>]*>)?\s*\([^)]*\)/g, fakeGlob);
      return { contents, loader: "tsx" };
    });
  },
});
