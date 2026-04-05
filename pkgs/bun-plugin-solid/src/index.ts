import type { PluginItem, TransformOptions } from "@babel/core"
import tsPreset from "@babel/preset-typescript"
import solidPreset, { type BabelPresetSolidOptions } from "babel-preset-solid"
import type { BunPlugin } from "bun"

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

            build.onLoad({ filter: /\.[tj]sx$/ }, async ({ path }) => {
                // Memoized lazy import of babel
                if (!babel) babel = await import("@babel/core")

                if (!babelTransformPresets) {
                    babelTransformPresets = [
                        [tsPreset, {}],
                        [solidPreset, { generate: opts.generate, hydratable: opts.hydratable }],
                    ]
                }

                debugLog(`Transforming: ${path}`)
                const start = performance.now()

                const result = await babel.transformFileAsync(path, {
                    presets: babelTransformPresets,
                    filename: path,
                    sourceMaps: opts.sourceMaps,
                    ...opts.babelOptions,
                })

                const end = performance.now()
                debugLog(`Transformed: ${path} in ${Math.round(end - start)}ms`)

                if (!result?.code) {
                    throw Error(`No code for: ${path}`)
                }

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
