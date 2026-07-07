/// <reference path="./types/babel-preset-solid.d.ts" />
/// <reference path="./types/babel-preset-typescript.d.ts" />
import type { PluginItem, TransformOptions } from "@babel/core"
import tsPreset from "@babel/preset-typescript"
import solidPreset, { type BabelPresetSolidOptions } from "babel-preset-solid"
import type { BunPlugin } from "bun"
import solidRefresh from "solid-refresh/babel"
import bunHotShim from "./bun-hot-shim"

type SolidPluginOptions = {
    /**
     * Whether to generate DOM or SSR-compatible output.
     * Defaults to `dom`.
     */
    generate?: BabelPresetSolidOptions["generate"]

    /**
     * Enables hydration code generation for SSR. Defaults to `true`.
     */
    hydratable?: BabelPresetSolidOptions["hydratable"]

    /**
     * Controls source map generation:
     * - false (default): no source maps
     * - true: external `.map` file
     * - "inline": embedded base64-encoded map in output
     *
     * Defaults to `"inline"`.
     */
    sourceMaps?: boolean | "inline"

    /**
     * Enables Solid's HMR integration (`solid-refresh`) so components hot-swap in place while preserving state. Without
     * it, changes to Solid-transformed modules are not picked up.
     *
     * Disable this in prod builds, as it adds overhead.
     * Defaults to `false` in programmatic usage, and `true` when this plugin is picked up via `bunfig.toml`.
     */
    hot?: boolean

    /**
     * Whether to enable debug logging.
     * Defaults to `false`.
     */
    debug?: boolean

    /**
     * Extra Babel transformation options.
     * Defaults to `{}`.
     */
    babelOptions?: TransformOptions
}

/**
 * Edit the properties of this object to change the options of the {@link defaultPlugin}.
 * This janky approach is necessary because `bunfig.toml/[serve.static]/plugins` requires a ready-made plugin object,
 * and configuring this key is the only way to instruct the runtime Bun bundler (i.e. Bun.serve) to use a plugin.
 */
export const solidPluginOptions: SolidPluginOptions = {
    generate: "dom",
    hydratable: true,
    sourceMaps: "inline",
    hot: true,
    debug: false,
    babelOptions: {},
}

function SolidPlugin_(opts: SolidPluginOptions = {}, isDefault = false): BunPlugin {
    if (isDefault) {
        // This is the (singleton) default plugin object.
        opts = solidPluginOptions
    } else {
        // Set defaults.
        opts.generate ??= "dom"
        opts.hydratable ??= true
        opts.sourceMaps ??= "inline"
        opts.hot ??= false
        opts.debug ??= false
        opts.babelOptions ??= {}
    }

    const debugLog = (msg: string) => {
        if (opts.debug) console.log(`\x1b[36m[bun-plugin-solid-jsx]\x1b[0m ${msg}`)
    }

    const plugin: BunPlugin = {
        name: "bun-plugin-solid",
        setup: build => {
            let babel: typeof import("@babel/core") | undefined
            let babelTransformPresets: PluginItem[] | undefined
            let babelTransformPlugins: PluginItem[] | undefined

            if (opts.hot) {
                // The transformed app code imports the `solid-refresh` runtime by bare specifier, but that package is a
                // dependency of THIS plugin, not of the app being bundled — so the app's module graph can't resolve it.
                // Redirect the specifier to the copy this plugin owns, keeping HMR self-contained for consumers.
                const solidRefreshRuntime = Bun.resolveSync("solid-refresh", import.meta.dir)
                build.onResolve({ filter: /^solid-refresh$/ }, () => ({ path: solidRefreshRuntime }))
            }

            build.onLoad({ filter: /\.[tj]sx$/ }, async ({ path }) => {
                // Memoized lazy import of babel
                if (!babel) babel = await import("@babel/core")

                if (!babelTransformPresets) {
                    babelTransformPresets = [
                        [tsPreset, {}],
                        [solidPreset, { generate: opts.generate, hydratable: opts.hydratable }],
                    ]
                    // `solid-refresh` must run as a plugin (before the preset) so it can wrap components before
                    // `babel-preset-solid` lowers their JSX. The `vite` target is the one whose runtime speaks
                    // `import.meta.hot` (the others use `module.hot`/`import.meta.webpackHot`); `bunHotShim` then adapts
                    // it to Bun's stricter literal-only form in the second pass below.
                    babelTransformPlugins = opts.hot ? [[solidRefresh, { bundler: "vite" }]] : []
                }

                debugLog(`Transforming: ${path}`)
                const start = performance.now()

                let result = await babel.transformFileAsync(path, {
                    presets: babelTransformPresets,
                    plugins: babelTransformPlugins,
                    filename: path,
                    sourceMaps: opts.sourceMaps,
                    ...opts.babelOptions,
                })

                if (!result?.code) {
                    throw Error(`No code for: ${path}`)
                }

                if (opts.hot) {
                    // Second pass: rewrite `solid-refresh`'s `import.meta.hot` hand-off into a Bun-literal shim. This is
                    // separate because `solid-refresh` inserts that call at `Program` exit, so it only exists once the
                    // first transform has fully finished. See `bunHotShim` for why the rewrite is necessary.
                    result = await babel.transformAsync(result.code, {
                        plugins: [bunHotShim],
                        filename: path,
                        sourceMaps: opts.sourceMaps,
                        inputSourceMap: (result.map ?? undefined) as never,
                        configFile: false,
                        babelrc: false,
                    })
                    if (!result?.code) {
                        throw Error(`No code for: ${path}`)
                    }
                }

                const end = performance.now()
                debugLog(`Transformed: ${path} in ${Math.round(end - start)}ms`)

                return {
                    loader: "js",
                    contents: result.code,
                }
            })
        },
    }

    return Object.freeze(plugin)
}

/**
 * A Bun plugin for transforming SolidJS `.tsx`/`.jsx` files at build time using Babel.
 *
 * This plugin uses the `babel-preset-solid` and `@babel/preset-typescript` presets to convert Solid JSX
 * into DOM or SSR-compatible output, depending on the configuration.
 *
 * @remarks
 * - This plugin is **Bun-only** and is designed for use with `bun build`, a Bun preload script, or the Bun dev server
 *   (`plugins` under `[serve.static]` in `bunfig.toml`).
 * - It does not run in Node.js, Deno, or browser environments.
 * - Consumers must provide their own versions of Babel and the required presets as peer dependencies.
 *
 * @example
 * ```ts
 * // Using Bun.build
 * import { SolidPlugin } from "@dschz/bun-plugin-solid";
 *
 * await Bun.build({
 *   entrypoints: ["./src/index.ts"],
 *   outdir: "./dist",
 *   target: "bun",
 *   format: "esm",
 *   plugins: [
 *     SolidPlugin({
 *       generate: "ssr",
 *       hydratable: true,
 *       sourceMaps: false, // recommended for production
 *     }),
 *   ],
 * });
 * ```
 *
 * * @example
 * ```ts
 * // Using Bun.plugin
 * import { SolidPlugin } from "@dschz/bun-plugin-solid";
 *
 * // You must pass this script to `preload` in your `bunfig.toml`
 * await Bun.plugin(
 *   SolidPlugin({
 *     generate: "ssr",
 *     hydratable: true,
 *     sourceMaps: true,
 *   }),
 * );
 * ```
 *
 * @param options - Configuration, see {@link SolidPluginOptions}
 * @returns A Bun-compatible plugin object that can be passed to `bun build`.
 */
export function SolidPlugin(options: SolidPluginOptions = {}): BunPlugin {
    return SolidPlugin_(options)
}

const defaultPlugin: BunPlugin = SolidPlugin_({}, true)
export default defaultPlugin
