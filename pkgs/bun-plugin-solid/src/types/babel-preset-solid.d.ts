declare module "babel-preset-solid" {
    import type { PluginObj, PresetAPI } from "@babel/core"

    /**
     * Options for [babel-preset-solid](https://github.com/solidjs/solid/tree/main/packages/babel-preset-solid)
     *
     * The options for `babel-preset-solid` are derived from the underlying [babel-plugin-jsx-dom-expressions](https://github.com/ryansolid/dom-expressions/tree/main/packages/babel-plugin-jsx-dom-expressions)
     * that it is built upon. There are defaults that `babel-preset-solid` sets, so there is no need to modify those particular options.
     *
     * We only expose options that are worth configuring
     */
    export type BabelPresetSolidOptions = {
        /**
         * Whether to generate DOM or SSR-compatible output.
         */
        readonly generate: "dom" | "ssr"
        /**
         * Enables hydration code generation for SSR.
         */
        readonly hydratable: boolean
    }

    const preset: (api: PresetAPI, options?: Partial<BabelPresetSolidOptions>) => PluginObj[]
    export default preset
}
