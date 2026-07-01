import { SolidPlugin } from "bun-plugin-solid"

// Bundles the Solid app (HTML entrypoint + TSX) into static assets under `dist/`.
// The dev server (`make dev`) transforms TSX on the fly via `bunfig.toml`; this is the production build.
const result = await Bun.build({
    entrypoints: ["./src/index.html"],
    outdir: "./dist/src",
    target: "browser",
    splitting: true,
    // sourcemap: "inline", // enable to debug prod builds
    minify: true,
    plugins: [SolidPlugin({ hydratable: false /* , sourceMaps: false */ })],
})

if (!result.success) {
    console.error("Build failed")
    for (const log of result.logs) console.error(log)
    process.exit(1)
}
