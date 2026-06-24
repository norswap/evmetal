<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=Ecosystem&background=tiles&project=bun-plugin-solid" alt="bun-plugin-solid">
</p>

# bun-plugin-solid

Forked from https://github.com/dsnchz/bun-plugin-solid

> 🧩 A Bun plugin for transforming SolidJS JSX/TSX files at runtime or build time using Babel. Supports SSR and DOM
> output.
>
> 🟢 Works seamlessly with [Bun](https://bun.sh) and [Elysia](https://elysiajs.com) servers for both runtime and
> build-time JSX/TSX transformation.

> ⚠️ **Note**: This plugin is designed specifically for use with the [Bun runtime](https://bun.sh). It will not work in
> Node.js, Deno, or other JavaScript environments.

## Features

- ✅ Works in both `bun run` (runtime), `bun build` (build-time), and Bun dev server (e.g. `bun index.html`) contexts
- 🎯 Supports SSR (`generate: "ssr"`) and DOM (`generate: "dom"`) output
- 💧 Hydratable output toggle for SSR
- 🧱 Designed to be invoked via `preload` or build plugins
- 🪄 Minimal and explicit configuration surface

## Installation

```bash
# If this package is in your workspace.
bun add --dev "bun-plugin-solid@workspace:"
```

## Plugin Options

> Plugin options `generate` and `hydratable` are directly derived from [
`babel-preset-solid`](https://github.com/solidjs/solid/blob/main/packages/babel-preset-solid/src/index.ts#L11-L18) and
> will be passed to it under the hood.

```ts
type SolidPluginOptions = {
    /**
     * Whether to generate DOM or SSR-compatible output.
     * Defaults to "dom".
     */
    generate?: "dom" | "ssr";

    /**
     * Enables hydration code generation for SSR.
     * Defaults to true.
     */
    hydratable?: boolean;

    /**
     * Controls source map generation:
     * - false: no source maps
     * - true: external .map file
     * - "inline": base64-encoded inline source maps
     *
     * Defaults to "inline".
     */
    sourceMaps?: boolean | "inline";

    /**
     * Enable verbose debug logs during transform.
     * Defaults to false.
     */
    debug?: boolean;

    /**
     * Extra Babel transformation options.
     * Defaults to {}.
     */
    babelOptions?: TransformOptions
}
```

## Usage

### 🔧 Runtime development / Bun server (`bun [--hot] {index.html,server.ts}`)

Use this for runtime-based workflows where you ask bun to bundle and serve an html file, or to run a TypeScript
file that will run a server (e.g. `Bun.serve` or things using it, like Elysia).

To be compatible with server-side rendering, you must edit the options before running `Bun.serve`.

#### `bunfig.toml`

```toml
[serve.static]
plugins = ["bun-plugin-solid"]
```

### `server.ts` (or equivalent)

Optional, if you require non-default options.

```ts
import { solidPluginOptions } from "bun-plugin-solid"

// You can also alter the other options.
solidPluginOptions.generate = "ssr"

Bun.serve({
    // ...
})
```

---

### 📦 Build-Time Compilation with `Bun.build()`

Use this in production workflows to pre-compile `.tsx` or `.jsx` files to JavaScript.

#### `build.ts`:

```ts
import { SolidPlugin } from "bun-plugin-solid"

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  plugins: [
    SolidPlugin({
      generate: "ssr",
      hydratable: true,
      sourceMaps: false, // recommended for production
    }),
  ],
})
```

If you want `tsc` to typecheck `build.ts`, add `"customConditions": ["bun"]` under `tsconfig.json/"compilerOptions"`.