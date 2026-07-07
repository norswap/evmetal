import type { template as BabelTemplate, types as BabelTypes, PluginObj } from "@babel/core"

type BabelApi = { types: typeof BabelTypes; template: typeof BabelTemplate }

/**
 * Builds the object literal that stands in for `import.meta.hot` when handed to `solid-refresh`'s runtime.
 *
 * Every method/getter dereferences the *literal* `import.meta.hot.<api>` phrase, which is the only form Bun's HMR
 * runtime accepts — it substitutes those phrases syntactically and makes any aliased access (e.g. `hot.data` where
 * `hot` was passed by reference) throw at runtime. `invalidate` maps to a full page reload because Bun does not
 * implement `import.meta.hot.invalidate()`; solid-refresh only reaches it when a change can't be hot-patched, so a
 * clean reload is the correct fallback.
 */
function buildHotShim(template: typeof BabelTemplate) {
    return template.expression(`({
        get data() { return import.meta.hot.data; },
        accept(cb) { return import.meta.hot.accept(cb); },
        dispose(cb) { return import.meta.hot.dispose(cb); },
        decline() { return import.meta.hot.decline(); },
        invalidate() { globalThis.location.reload(); },
    })`)()
}

/**
 * Whether `node` is a bare, argument-less `import.meta.hot.accept()` call.
 */
function isBareAcceptCall(t: typeof BabelTypes, node: BabelTypes.Node): boolean {
    if (!t.isCallExpression(node) || node.arguments.length > 0) return false
    const callee = node.callee
    if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property, { name: "accept" })) return false
    const hot = callee.object
    if (!t.isMemberExpression(hot) || !t.isIdentifier(hot.property, { name: "hot" })) return false
    return t.isMetaProperty(hot.object)
}

/**
 * Babel plugin that bridges `solid-refresh`'s HMR runtime onto Bun's `import.meta.hot` API.
 *
 * `solid-refresh` emits, at each module's tail, `import.meta.hot.accept(); $$refresh(<mode>, import.meta.hot, <reg>)`.
 * Two problems on Bun: (1) it forwards the hot object by reference and its runtime then reads `hot.data`/`hot.accept`/…
 * indirectly, which Bun forbids (only literal `import.meta.hot.<api>` phrases work); (2) the bare `accept()` makes Bun
 * auto-patch importers while `solid-refresh` also patches its registry, applying the update twice and duplicating DOM.
 *
 * This plugin fixes both: it replaces the `$$refresh` hot argument with an inline shim ({@link buildHotShim}) built from
 * literal phrases, and drops the redundant bare `accept()` so `solid-refresh` alone owns the update (its runtime still
 * registers the boundary via `import.meta.hot.accept(cb)` inside the shim). Run it as a *second* Babel pass over
 * `solid-refresh`'s output, since the tail is inserted late (at `Program` exit) and must exist when this visitor runs.
 */
export default function bunHotShim({ types: t, template }: BabelApi): PluginObj {
    return {
        name: "bun-hot-shim",
        visitor: {
            CallExpression(path) {
                const callee = path.node.callee
                if (!t.isIdentifier(callee)) return

                const binding = path.scope.getBinding(callee.name)
                const specifier = binding?.path
                if (!specifier?.isImportSpecifier()) return

                const imported = specifier.node.imported
                const importedName = t.isIdentifier(imported) ? imported.name : imported.value
                if (importedName !== "$$refresh") return

                const source = specifier.parentPath
                if (!source.isImportDeclaration() || source.node.source.value !== "solid-refresh") return

                if (path.node.arguments.length < 2) return
                path.node.arguments[1] = buildHotShim(template)

                const statement = path.getStatementParent()
                const prev = statement?.getPrevSibling()
                if (prev?.isExpressionStatement() && isBareAcceptCall(t, prev.node.expression)) prev.remove()
            },
        },
    }
}
