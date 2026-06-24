import { generateDts } from "@bunup/dts"

const target = Bun.argv.length < 3 ? "all" : Bun.argv[2]

if (target === "all" || target === "js") {
    const result = await Bun.build({
        entrypoints: ["./src/index.ts"],
        outdir: "./dist/src",
        target: "browser",
        sourcemap: "inline",
        // inline sourcemaps + no minify — the consumer can handle these concerns
    })
    if (!result.success) {
        console.error("Build failed")
        for (const log of result.logs) console.error(log)
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

// Note: we can't use bunup directly for everything because (1) it does not traverse subpath imports and (2)
// it does not allow skipping js bundle generation. (https://github.com/bunup/bunup/issues/103)
// tsdown is a possible alternative, but it's slower than either bun & bunup.
