import { describe, expect, test } from "bun:test"
import { AsyncResult } from "#src/asyncResult"
import { fresult } from "#src/fresult"
import { fail, okay, Result } from "#src/result"

// =====================================================================================================================
// fresult — sync generators

describe("fresult (sync)", () => {
    test("returns a Result wrapping the final value", () => {
        // biome-ignore lint/correctness/useYield: testing return-only generator
        const fn = fresult(function* () {
            return 42
        })
        const r = fn()
        expect(r).toBeInstanceOf(Result)
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("returns the okay Result returned by the generator", () => {
        // biome-ignore lint/correctness/useYield: testing return-only generator
        const fn = fresult(function* () {
            return okay(42)
        })
        expect(fn().get).toEqual({ isOkay: true, value: 42 })
    })

    test("returns the failed Result returned by the generator", () => {
        // biome-ignore lint/correctness/useYield: testing return-only generator
        const fn = fresult(function* () {
            return fail("boom")
        })
        expect(fn().get).toEqual({ isOkay: false, error: "boom" })
    })

    test("yield* on okay Result resolves to the inner value", () => {
        const fn = fresult(function* () {
            const v = yield* okay(42)
            return v + 1
        })
        expect(fn().get).toEqual({ isOkay: true, value: 43 })
    })

    test("yield* on failed Result short-circuits and returns the failure", () => {
        const fn = fresult(function* () {
            const v = yield* fail("boom")
            return v
        })
        expect(fn().get).toEqual({ isOkay: false, error: "boom" })
    })

    test("code after a failed yield does not run", () => {
        const log: string[] = []
        const fn = fresult(function* () {
            log.push("before")
            yield* fail("boom")
            log.push("after")
            return 0
        })
        fn()
        expect(log).toEqual(["before"])
    })

    test("multiple okay yields flow values through", () => {
        const fn = fresult(function* () {
            const a = yield* okay(2)
            const b = yield* okay(3)
            return a + b
        })
        expect(fn().get).toEqual({ isOkay: true, value: 5 })
    })

    test("first failure short-circuits over later yields", () => {
        const log: string[] = []
        const fn = fresult(function* () {
            yield* fail("first")
            log.push("between")
            yield* fail("second")
            return 0
        })
        const r = fn()
        expect(r.get).toEqual({ isOkay: false, error: "first" })
        expect(log).toEqual([])
    })

    test("supports returning either a value or an okay Result at the same call site", () => {
        const fn = fresult(function* (asResult: boolean) {
            const v = yield* okay(10)
            return asResult ? okay(v + 1) : v + 1
        })
        expect(fn(true).get).toEqual({ isOkay: true, value: 11 })
        expect(fn(false).get).toEqual({ isOkay: true, value: 11 })
    })

    test("forwards arguments to the generator function", () => {
        // biome-ignore lint/correctness/useYield: testing return-only generator
        const fn = fresult(function* (a: number, b: number) {
            return a + b
        })
        expect(fn(2, 3).get).toEqual({ isOkay: true, value: 5 })
    })
})

// =====================================================================================================================
// fresult — async generators

describe("fresult (async)", () => {
    test("returns an AsyncResult wrapping the final value", async () => {
        // biome-ignore lint/correctness/useYield: testing return-only generator
        const fn = fresult(async function* () {
            return 42
        })
        const ar = fn()
        expect(ar).toBeInstanceOf(AsyncResult)
        const r = await ar
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("yield* on okay AsyncResult resolves to the inner value", async () => {
        const fn = fresult(async function* () {
            const v = yield* okay(42).toAsync()
            return v + 1
        })
        const r = await fn()
        expect(r.get).toEqual({ isOkay: true, value: 43 })
    })

    test("yield* on failed AsyncResult short-circuits and returns the failure", async () => {
        const fn = fresult(async function* () {
            const v = yield* fail("boom").toAsync()
            return v
        })
        const r = await fn()
        expect(r.get).toEqual({ isOkay: false, error: "boom" })
    })

    test("can yield* a sync Result from inside an async generator", async () => {
        const fn = fresult(async function* () {
            const v = yield* okay(7)
            return v * 2
        })
        const r = await fn()
        expect(r.get).toEqual({ isOkay: true, value: 14 })
    })

    test("a sync failed Result yielded inside an async generator short-circuits", async () => {
        const fn = fresult(async function* () {
            yield* fail("boom")
            return 0
        })
        const r = await fn()
        expect(r.get).toEqual({ isOkay: false, error: "boom" })
    })

    test("code after a failed async yield does not run", async () => {
        const log: string[] = []
        const fn = fresult(async function* () {
            log.push("before")
            yield* fail("boom").toAsync()
            log.push("after")
            return 0
        })
        await fn()
        expect(log).toEqual(["before"])
    })

    test("forwards arguments to the async generator function", async () => {
        // biome-ignore lint/correctness/useYield: testing return-only generator
        const fn = fresult(async function* (a: number, b: number) {
            return a + b
        })
        const r = await fn(2, 3)
        expect(r.get).toEqual({ isOkay: true, value: 5 })
    })
})
