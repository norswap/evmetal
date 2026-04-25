import { describe, expect, test } from "bun:test"
import { AsyncResult } from "#src/asyncResult"
import { fail, okay, Result } from "#src/result"
import { noThrow, result, resultify, throws } from "#src/resultify"

// === Helpers =========================================================================================================

const toStr = (e: unknown) => String(e)

// =====================================================================================================================
// result — Result/AsyncResult passthrough

describe("result (passthrough)", () => {
    test("returns Result instance as-is", () => {
        const r = okay(42)
        const out = result(r)
        expect(out).toBe(r as unknown as typeof out)
    })

    test("returns failed Result instance as-is", () => {
        const r = fail(new Error("boom"))
        const out = result(r)
        expect(out).toBe(r as unknown as typeof out)
    })

    test("returns AsyncResult instance as-is", () => {
        const ar = okay(42).toAsync()
        const out = result(ar)
        expect(out).toBe(ar as unknown as typeof out)
    })
})

// =====================================================================================================================
// result — plain values

describe("result (plain value)", () => {
    test("wraps a plain value in an okay Result", () => {
        const out = result(42)
        expect(out).toBeInstanceOf(Result)
        expect(out.get).toEqual({ isOkay: true, value: 42 })
    })

    test("wraps undefined in an okay Result", () => {
        const out = result(undefined)
        expect(out.get).toEqual({ isOkay: true, value: undefined })
    })

    test("ignores makeError for plain values (cannot throw)", () => {
        let called = false
        const out = result(42, _e => {
            called = true
            return "x"
        })
        expect(called).toBe(false)
        expect(out.get).toEqual({ isOkay: true, value: 42 })
    })
})

// =====================================================================================================================
// result — Promises

describe("result (promises)", () => {
    test("wraps a resolving Promise<value> into an okay AsyncResult", async () => {
        const out = result(Promise.resolve(42))
        expect(out).toBeInstanceOf(AsyncResult)
        const r = await out
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("wraps a resolving Promise<Result> by passing through the Result", async () => {
        const out = result(Promise.resolve(okay(42)))
        const r = await out
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("wraps a resolving Promise<failed Result> by passing through the Result", async () => {
        const err = new Error("boom")
        const out = result(Promise.resolve(fail(err)))
        const r = await out
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("converts a rejecting promise to failed Result using default unknownToError", async () => {
        const out = result(Promise.reject(new Error("boom")))
        const r = await out
        expect(r.get.isOkay).toBe(false)
        if (!r.get.isOkay) {
            expect(r.get.error).toBeInstanceOf(Error)
            expect((r.get.error as Error).message).toBe("boom")
        }
    })

    test("wraps non-Error rejection into an Error using unknownToError", async () => {
        const out = result(Promise.reject("string-reason"))
        const r = await out
        expect(r.get.isOkay).toBe(false)
        if (!r.get.isOkay) {
            expect(r.get.error).toBeInstanceOf(Error)
            expect((r.get.error as Error).cause).toBe("string-reason")
        }
    })

    test("applies custom makeError to rejection reason", async () => {
        const out = result(Promise.reject("string-reason"), toStr)
        const r = await out
        expect(r.get).toEqual({ isOkay: false, error: "string-reason" })
    })
})

// =====================================================================================================================
// result — sentinels (throws, noThrow)

describe("result (sentinels)", () => {
    test("throws<E> passes rejection through as the asserted type", async () => {
        const out = result<unknown, string>(Promise.reject("oops"), throws<string>)
        const r = await out
        expect(r.get).toEqual({ isOkay: false, error: "oops" })
    })

    test("noThrow itself throws when a promise rejects (recommended usage forbids this case)", async () => {
        const out = result(Promise.reject("oops"), noThrow)
        await expect((async () => await out)()).rejects.toThrow()
    })

    test("noThrow does not throw on resolving promise", async () => {
        const out = result(Promise.resolve(42), noThrow)
        const r = await out
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })
})

// =====================================================================================================================
// resultify — non-throwing functions

describe("resultify (non-throwing)", () => {
    test("wraps a value-returning function into one returning okay Result", () => {
        const fn = resultify(() => 42)
        const out = fn()
        expect(out).toBeInstanceOf(Result)
        expect(out.get).toEqual({ isOkay: true, value: 42 })
    })

    test("passes arguments through to the wrapped function", () => {
        const fn = resultify((a: number, b: number) => a + b)
        const out = fn(2, 3)
        expect(out.get).toEqual({ isOkay: true, value: 5 })
    })

    test("returns Result returned by the wrapped function as-is", () => {
        const r = okay(42)
        const fn = resultify(() => r)
        const out = fn()
        expect(out).toBe(r as unknown as typeof out)
    })

    test("returns failed Result returned by the wrapped function as-is", () => {
        const r = fail("nope")
        const fn = resultify(() => r)
        const out = fn()
        expect(out).toBe(r as unknown as typeof out)
    })
})

// =====================================================================================================================
// resultify — throwing functions

describe("resultify (throwing)", () => {
    test("catches thrown Error and returns failed Result", () => {
        const err = new Error("boom")
        const fn = resultify((): number => {
            throw err
        })
        const out = fn()
        expect(out.get).toEqual({ isOkay: false, error: err })
    })

    test("wraps non-Error throw into an Error via default unknownToError", () => {
        const fn = resultify((): number => {
            throw "string-thrown"
        })
        const out = fn()
        expect(out.get.isOkay).toBe(false)
        if (!out.get.isOkay) {
            expect(out.get.error).toBeInstanceOf(Error)
            expect((out.get.error as Error).cause).toBe("string-thrown")
        }
    })

    test("applies custom makeError to thrown value", () => {
        const fn = resultify(
            (): number => {
                throw "string"
            },
            str => str + "-thrown",
        )
        const out = fn()
        expect(out.get).toEqual({ isOkay: false, error: "string-thrown" })
    })
})

// =====================================================================================================================
// resultify — async functions

describe("resultify (async)", () => {
    test("wraps an async value-returning function into one returning AsyncResult", async () => {
        const fn = resultify(async () => 42)
        const out = fn()
        expect(out).toBeInstanceOf(AsyncResult)
        const r = await out
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("catches promise rejection and returns failed AsyncResult", async () => {
        const fn = resultify(async (): Promise<number> => {
            throw new Error("boom")
        })
        const r = await fn()
        expect(r.get.isOkay).toBe(false)
        if (!r.get.isOkay) {
            expect(r.get.error).toBeInstanceOf(Error)
            expect((r.get.error as Error).message).toBe("boom")
        }
    })

    test("applies custom makeError to promise rejection", async () => {
        const fn = resultify(async (): Promise<number> => {
            throw "string-thrown"
        }, toStr)
        const r = await fn()
        expect(r.get.isOkay).toBe(false)
        if (!r.get.isOkay) {
            expect(r.get.error).toBe("string-thrown")
        }
    })

    test("returns AsyncResult returned by the wrapped function as-is", async () => {
        const ar = okay(42).toAsync()
        const fn = resultify(() => ar)
        const out = fn()
        expect(out).toBe(ar as unknown as typeof out)
    })

    test("returns Promise<Result> as AsyncResult preserving the Result", async () => {
        const fn = resultify(async () => okay(42))
        const r = await fn()
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })
})

// =====================================================================================================================
// resultify — sentinels (throws, noThrow)

describe("resultify (sentinels)", () => {
    test("throws<E> passes thrown value through as the asserted type", () => {
        const fn = resultify(
            (): number => {
                throw "boom"
            },
            throws<string>,
        )
        const out = fn()
        expect(out.get).toEqual({ isOkay: false, error: "boom" })
    })

    test("noThrow itself throws when the wrapped function throws", () => {
        const fn = resultify((): number => {
            throw new Error("boom")
        }, noThrow)
        expect(() => fn()).toThrow()
    })

    test("noThrow does not throw when the wrapped function does not throw", () => {
        const fn = resultify(() => 42, noThrow)
        const out = fn()
        expect(out.get).toEqual({ isOkay: true, value: 42 })
    })
})

// =====================================================================================================================
// result — non-Promise thenable input

describe("result (thenable)", () => {
    test("treats a non-Promise PromiseLike as async input", async () => {
        const thenable: PromiseLike<number> = {
            // biome-ignore lint/suspicious/noThenProperty: testing PromiseLike (thenable) input
            then(onfulfilled) {
                return Promise.resolve(onfulfilled ? onfulfilled(42) : (42 as never))
            },
        }
        const out = result(thenable)
        expect(out).toBeInstanceOf(AsyncResult)
        const r = await out
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })
})

// =====================================================================================================================
// resultify — async-function-that-throws caveat

describe("resultify (async-throwing caveat)", () => {
    test("function lying about a Promise return type but throwing synchronously yields a Result, not an AsyncResult", () => {
        const lying = (): Promise<number> => {
            throw new Error("sync throw despite Promise return type")
        }
        const out = resultify(lying)()
        expect(out).toBeInstanceOf(Result)
        expect(out).not.toBeInstanceOf(AsyncResult)
        const get = (out as unknown as Result<number, Error>).get
        expect(get.isOkay).toBe(false)
        if (!get.isOkay) {
            expect(get.error).toBeInstanceOf(Error)
            expect((get.error as Error).message).toBe("sync throw despite Promise return type")
        }
    })
})

// =====================================================================================================================
// resultify — makeError invocation accounting

describe("resultify (makeError accounting)", () => {
    test("makeError is invoked exactly once with the original thrown value", () => {
        const calls: unknown[] = []
        const fn = resultify(
            (): number => {
                throw "boom"
            },
            e => {
                calls.push(e)
                return String(e)
            },
        )
        fn()
        expect(calls).toEqual(["boom"])
    })

    test("makeError is not invoked when the wrapped function does not throw", () => {
        let calls = 0
        const fn = resultify(
            () => 42,
            _e => {
                calls++
                return "x"
            },
        )
        fn()
        expect(calls).toBe(0)
    })

    test("makeError is invoked exactly once with the rejection reason for an async function", async () => {
        const calls: unknown[] = []
        const fn = resultify(
            async (): Promise<number> => {
                throw "boom"
            },
            e => {
                calls.push(e)
                return String(e)
            },
        )
        await fn()
        expect(calls).toEqual(["boom"])
    })
})

// =====================================================================================================================
// resultify — argument forwarding edges

describe("resultify (argument forwarding)", () => {
    test("forwards zero arguments", () => {
        const fn = resultify(() => 42)
        expect(fn().force()).toBe(42)
    })

    test("forwards rest arguments", () => {
        const fn = resultify((...nums: number[]) => nums.reduce((a, b) => a + b, 0))
        expect(fn(1, 2, 3, 4).force()).toBe(10)
    })

    test("respects default arguments when omitted", () => {
        const fn = resultify((a: number, b: number = 10) => a + b)
        expect(fn(5).force()).toBe(15)
        expect(fn(5, 20).force()).toBe(25)
    })
})
