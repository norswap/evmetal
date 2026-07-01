import { generateDts } from "@bunup/dts"
import { SolidPlugin } from "bun-plugin-solid"

const target = Bun.argv.length < 3 ? "all" : Bun.argv[2]

if (target === "all" || target === "js") {
    // Externalize all runtime dependencies, so the consumer can dedupe them.
    // We can't use `packages: "external"` or `external: ["*"]` because that will kill our `#src/*` subpath imports.
    const pkg = (await Bun.file("./package.json").json()) as Record<string, Record<string, string>>
    const deps = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies }
    const external = Object.keys(deps).flatMap(dep => [dep, `${dep}/*`])
    const result = await Bun.build({
        entrypoints: ["./src/index.ts"],
        outdir: "./dist/src",
        target: "browser",
        sourcemap: "inline",
        external,
        plugins: [SolidPlugin({ hydratable: false })],
    })
    if (!result.success) {
        console.error("Build failed")
        for (const log of result.logs) console.error(log)
        process.exit(1)
    }
}

if (target === "all" || target === "types") {
    const result = await generateDts(["./src/index.ts"])
    if (result.errors.length > 0) {
        for (const error of result.errors) console.error(error)
    } else {
        await Promise.all(
            result.files.map(async file => {
                await Bun.write(`dist/src/${file.outputPath}`, file.dts)
            }),
        )
    }
}
