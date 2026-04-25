import { describe, expect, test } from "bun:test"
import { AsyncResult } from "#src/asyncResult"
import { fail, okay, type Result } from "#src/result"

// === Helpers =========================================================================================================

class ErrA extends Error {
    readonly kind = "ErrA"
}
class ErrB extends Error {
    readonly kind = "ErrB"
}

// =====================================================================================================================
// Result.get

describe("Result.get", () => {
    test("discriminates okay with value access", () => {
        const g = okay(42).get
        expect(g.isOkay).toBe(true)
        if (g.isOkay) expect(g.value).toBe(42)
    })

    test("discriminates fail with error access", () => {
        const err = new Error("boom")
        const g = fail(err).get
        expect(g.isOkay).toBe(false)
        if (!g.isOkay) expect(g.error).toBe(err)
    })
})

// =====================================================================================================================
// Result.force

describe("Result.force", () => {
    test("returns the value when okay", () => {
        expect(okay(42).force()).toBe(42)
    })

    test("throws the Error when failed", () => {
        const err = new Error("boom")
        expect(() => fail(err).force()).toThrow(err)
    })

    test("throws non-Error error as-is", () => {
        let caught: unknown = "untouched"
        try {
            fail("oops").force()
        } catch (e) {
            caught = e
        }
        expect(caught).toBe("oops")
    })
})

// =====================================================================================================================
// Result.or

describe("Result.or", () => {
    test("returns the value when okay", () => {
        expect(okay(42).or(99)).toBe(42)
    })

    test("returns the alternative when failed", () => {
        expect(fail("oops").or(99)).toBe(99)
    })

    test("allows a different alternative type", () => {
        expect(fail("oops").or("fallback")).toBe("fallback")
    })
})

// =====================================================================================================================
// Result.maybe

describe("Result.maybe", () => {
    test("returns the value when okay", () => {
        expect(okay(42).maybe()).toBe(42)
    })

    test("returns undefined when failed", () => {
        expect(fail("oops").maybe()).toBeUndefined()
    })
})

// =====================================================================================================================
// Result iterator (yield* support)

describe("Result iterator", () => {
    test("yield* on okay returns the value to the caller", () => {
        function* gen(): Generator<Result<never, unknown>, number> {
            return yield* okay(42)
        }
        expect(gen().next()).toEqual({ done: true, value: 42 })
    })

    test("yield* on failed yields the failed Result", () => {
        const failed = fail("oops")
        function* gen(): Generator<Result<never, string>, void> {
            yield* failed
        }
        const first = gen().next()
        expect(first.done).toBe(false)
        expect((first.value as Result<never, string>).get).toEqual({ isOkay: false, error: "oops" })
    })

    test("throws if the same failed Result is iterated past the yield", () => {
        const it = fail("oops")[Symbol.iterator]()
        expect(it.next().done).toBe(false)
        expect(() => it.next()).toThrow()
    })
})

// =====================================================================================================================
// Result.map

describe("Result.map", () => {
    test("applies f to value when okay (value return)", () => {
        const r = okay(2).map(v => v + 3)
        expect(r.get).toEqual({ isOkay: true, value: 5 })
    })

    test("applies f to value when okay (okay return, flattens)", () => {
        const r = okay(2).map(v => okay(v + 3))
        expect(r.get).toEqual({ isOkay: true, value: 5 })
    })

    test("applies f to value when okay (fail return, flattens)", () => {
        const r = okay(2).map(_v => fail("nope"))
        expect(r.get).toEqual({ isOkay: false, error: "nope" })
    })

    test("applies f to value when okay (conditional Result return)", () => {
        const f = (v: number) => (v > 0 ? okay(v) : fail("negative"))
        expect(okay(5).map(f).get).toEqual({ isOkay: true, value: 5 })
        expect(okay(-5).map(f).get).toEqual({ isOkay: false, error: "negative" })
    })

    test("does not call f and preserves error when failed", () => {
        let called = false
        const err = new Error("boom")
        const original = fail(err)
        const r = original.map(v => {
            called = true
            return v
        })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: false, error: err })
        expect(r).toBe(original)
    })
})

// =====================================================================================================================
// Result.handle

describe("Result.handle", () => {
    test("does not call f and preserves value when okay", () => {
        let called = false
        const original = okay(42)
        const r = original.handle(_e => {
            called = true
            return 0
        })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: true, value: 42 })
        expect(r).toBe(original)
    })

    test("applies f to error when failed (value return)", () => {
        const r = fail(new Error("boom")).handle(_e => 69)
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })

    test("applies f to error when failed (okay return, flattens)", () => {
        const r = fail("boom").handle(_e => okay(69))
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })

    test("applies f to error when failed (fail return, flattens)", () => {
        const r = fail("boom").handle(_e => fail("recovered-fail"))
        expect(r.get).toEqual({ isOkay: false, error: "recovered-fail" })
    })

    test("applies f to error when failed (conditional Result return)", () => {
        const f = (e: unknown) => (e instanceof Error ? okay(69) : fail("error"))
        expect(fail(new Error("x")).handle(f).get).toEqual({ isOkay: true, value: 69 })
        expect(fail("x").handle(f).get).toEqual({ isOkay: false, error: "error" })
    })
})

// =====================================================================================================================
// Result.handle with error constructor

describe("Result.handle (with constructor)", () => {
    test("does not call f when okay", () => {
        let called = false
        const r = okay(1).handle(ErrA, _e => {
            called = true
            return 0
        })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: true, value: 1 })
    })

    test("calls f when error matches constructor", () => {
        const r = fail(new ErrA()).handle(ErrA, _e => 69)
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })

    test("preserves error when error does not match constructor", () => {
        let called = false
        const err = new ErrB()
        const r = fail(err).handle(ErrA, _e => {
            called = true
            return 0
        })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("flattens failed Result returned by f", () => {
        const r = fail(new ErrA()).handle(ErrA, _e => fail("recovered"))
        expect(r.get).toEqual({ isOkay: false, error: "recovered" })
    })
})

// =====================================================================================================================
// Result.withValue

describe("Result.withValue", () => {
    test("calls f with value when okay and returns original on void return", () => {
        const seen: number[] = []
        const original = okay(42)
        const r = original.withValue(v => {
            seen.push(v)
        })
        expect(seen).toEqual([42])
        expect(r).toBe(original)
    })

    test("returns failed Result from f instead of original", () => {
        const r = okay(42).withValue(_v => fail("nope"))
        expect(r.get).toEqual({ isOkay: false, error: "nope" })
    })

    test("ignores okay Result returned from f and returns original", () => {
        const original = okay(42)
        const r = original.withValue(_v => okay(undefined))
        expect(r).toBe(original)
    })

    test("does not call f when failed, preserves error", () => {
        let called = false
        const err = new Error("boom")
        const r = fail(err).withValue(_v => {
            called = true
        })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("conditional fail from f (void | Result)", () => {
        const f = (v: number): void | Result<void, string> => (v > 0 ? undefined : fail("nope"))
        expect(okay(5).withValue(f).get).toEqual({ isOkay: true, value: 5 })
        expect(okay(-5).withValue(f).get).toEqual({ isOkay: false, error: "nope" })
    })
})

// =====================================================================================================================
// Result.withError

describe("Result.withError", () => {
    test("calls f with error when failed and returns original on void return", () => {
        const seen: unknown[] = []
        const err = new Error("boom")
        const original = fail(err)
        const r = original.withError(e => {
            seen.push(e)
        })
        expect(seen).toEqual([err])
        expect(r).toBe(original)
    })

    test("returns failed Result from f instead of original", () => {
        const r = fail("boom").withError(_e => fail("recovered"))
        expect(r.get).toEqual({ isOkay: false, error: "recovered" })
    })

    test("does not call f when okay, preserves value", () => {
        let called = false
        const original = okay(42)
        const r = original.withError(_e => {
            called = true
        })
        expect(called).toBe(false)
        expect(r).toBe(original)
    })
})

// =====================================================================================================================
// Result.withError with error constructor

describe("Result.withError (with constructor)", () => {
    test("does not call f when okay", () => {
        let called = false
        const r = okay(1).withError(ErrA, _e => {
            called = true
        })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: true, value: 1 })
    })

    test("calls f when error matches constructor", () => {
        const seen: ErrA[] = []
        const err = new ErrA()
        const r = fail(err).withError(ErrA, e => {
            seen.push(e)
        })
        expect(seen).toEqual([err])
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("does not call f when error does not match constructor", () => {
        let called = false
        const err = new ErrB()
        const r = fail<ErrA | ErrB>(err).withError(ErrA, _e => {
            called = true
        })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("can replace failure with new failure when constructor matches", () => {
        const r = fail(new ErrA()).withError(ErrA, _e => fail("replaced"))
        expect(r.get).toEqual({ isOkay: false, error: "replaced" })
    })
})

// =====================================================================================================================
// Result.toAsync

describe("Result.toAsync", () => {
    test("wraps an okay Result into a resolved AsyncResult", async () => {
        const ar = okay(42).toAsync()
        expect(ar).toBeInstanceOf(AsyncResult)
        const r = await ar
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("wraps a failed Result into a resolved AsyncResult", async () => {
        const err = new Error("boom")
        const ar = fail(err).toAsync()
        const r = await ar
        expect(r.get).toEqual({ isOkay: false, error: err })
    })
})

// =====================================================================================================================
// AsyncResult as PromiseLike (then)

describe("AsyncResult.then", () => {
    test("invokes onfulfilled with the underlying okay Result", async () => {
        const r = await okay(42)
            .toAsync()
            .then(r => r)
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("invokes onfulfilled with the underlying failed Result", async () => {
        const err = new Error("boom")
        const r = await fail(err)
            .toAsync()
            .then(r => r)
        expect(r.get).toEqual({ isOkay: false, error: err })
    })
})

// =====================================================================================================================
// AsyncResult.force

describe("AsyncResult.force", () => {
    test("resolves with the value when okay", async () => {
        expect(await okay(42).toAsync().force()).toBe(42)
    })

    test("rejects with the Error when failed", async () => {
        const err = new Error("boom")
        await expect(fail(err).toAsync().force()).rejects.toBe(err)
    })
})

// =====================================================================================================================
// AsyncResult.or

describe("AsyncResult.or", () => {
    test("resolves with the value when okay", async () => {
        expect(await okay(42).toAsync().or(99)).toBe(42)
    })

    test("resolves with the alternative when failed", async () => {
        expect(await fail("oops").toAsync().or(99)).toBe(99)
    })

    test("awaits a PromiseLike alternative", async () => {
        expect(await fail("oops").toAsync().or(Promise.resolve(99))).toBe(99)
    })
})

// =====================================================================================================================
// AsyncResult.maybe

describe("AsyncResult.maybe", () => {
    test("resolves with the value when okay", async () => {
        expect(await okay(42).toAsync().maybe()).toBe(42)
    })

    test("resolves with undefined when failed", async () => {
        expect(await fail("oops").toAsync().maybe()).toBeUndefined()
    })
})

// =====================================================================================================================
// AsyncResult async iterator (yield* support)

describe("AsyncResult asyncIterator", () => {
    test("yield* on okay AsyncResult returns the value to the caller", async () => {
        async function* gen(): AsyncGenerator<Result<never, unknown>, number> {
            return yield* okay(42).toAsync()
        }
        expect(await gen().next()).toEqual({ done: true, value: 42 })
    })

    test("yield* on failed AsyncResult yields the failed Result", async () => {
        const failed = fail("oops").toAsync()
        async function* gen(): AsyncGenerator<Result<never, string>, void> {
            yield* failed
        }
        const first = await gen().next()
        expect(first.done).toBe(false)
        expect((first.value as Result<never, string>).get).toEqual({ isOkay: false, error: "oops" })
    })

    test("throws if the same failed AsyncResult is iterated past the yield", async () => {
        const it = fail("oops").toAsync()[Symbol.asyncIterator]()
        expect((await it.next()).done).toBe(false)
        await expect(it.next()).rejects.toThrow()
    })
})

// =====================================================================================================================
// AsyncResult.map

describe("AsyncResult.map", () => {
    test("applies sync f to value when okay (value return)", async () => {
        const r = await okay(2)
            .toAsync()
            .map(v => v + 3)
        expect(r.get).toEqual({ isOkay: true, value: 5 })
    })

    test("applies sync f to value when okay (okay return)", async () => {
        const r = await okay(2)
            .toAsync()
            .map(v => okay(v + 3))
        expect(r.get).toEqual({ isOkay: true, value: 5 })
    })

    test("applies sync f to value when okay (fail return)", async () => {
        const r = await okay(2)
            .toAsync()
            .map(_v => fail("nope"))
        expect(r.get).toEqual({ isOkay: false, error: "nope" })
    })

    test("applies async f to value when okay (promised value return)", async () => {
        const r = await okay(2)
            .toAsync()
            .map(async v => v + 3)
        expect(r.get).toEqual({ isOkay: true, value: 5 })
    })

    test("applies async f to value when okay (promised okay return)", async () => {
        const r = await okay(2)
            .toAsync()
            .map(async v => okay(v + 3))
        expect(r.get).toEqual({ isOkay: true, value: 5 })
    })

    test("applies f to value when okay (AsyncResult return)", async () => {
        const r = await okay(2)
            .toAsync()
            .map(v => okay(v + 3).toAsync())
        expect(r.get).toEqual({ isOkay: true, value: 5 })
    })

    test("does not call f and preserves error when failed", async () => {
        let called = false
        const err = new Error("boom")
        const r = await fail(err)
            .toAsync()
            .map(v => {
                called = true
                return v
            })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: false, error: err })
    })
})

// =====================================================================================================================
// AsyncResult.handle

describe("AsyncResult.handle", () => {
    test("does not call f and preserves value when okay", async () => {
        let called = false
        const r = await okay(42)
            .toAsync()
            .handle(_e => {
                called = true
                return 0
            })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("applies sync f to error when failed (value return)", async () => {
        const r = await fail(new Error("boom"))
            .toAsync()
            .handle(_e => 69)
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })

    test("applies sync f to error when failed (fail return)", async () => {
        const r = await fail("boom")
            .toAsync()
            .handle(_e => fail("recovered"))
        expect(r.get).toEqual({ isOkay: false, error: "recovered" })
    })

    test("applies async f to error when failed (promised value return)", async () => {
        const r = await fail(new Error("boom"))
            .toAsync()
            .handle(async _e => 69)
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })

    test("applies async f to error when failed (promised Result return)", async () => {
        const r = await fail(new Error("boom"))
            .toAsync()
            .handle(async _e => okay(69))
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })

    test("applies f to error when failed (AsyncResult return)", async () => {
        const r = await fail(new Error("boom"))
            .toAsync()
            .handle(_e => okay(69).toAsync())
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })
})

// =====================================================================================================================
// AsyncResult.handle with error constructor

describe("AsyncResult.handle (with constructor)", () => {
    test("does not call f when okay", async () => {
        let called = false
        const r = await okay(1)
            .toAsync()
            .handle(ErrA, _e => {
                called = true
                return 0
            })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: true, value: 1 })
    })

    test("calls f when error matches constructor", async () => {
        const r = await fail(new ErrA())
            .toAsync()
            .handle(ErrA, _e => 69)
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })

    test("preserves error when error does not match constructor", async () => {
        let called = false
        const err = new ErrB()
        const r = await fail(err)
            .toAsync()
            .handle(ErrA, _e => {
                called = true
                return 0
            })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("works with async handler when constructor matches", async () => {
        const r = await fail(new ErrA())
            .toAsync()
            .handle(ErrA, async _e => okay(69))
        expect(r.get).toEqual({ isOkay: true, value: 69 })
    })
})

// =====================================================================================================================
// AsyncResult.withValue

describe("AsyncResult.withValue", () => {
    test("calls sync f with value when okay and preserves value", async () => {
        const seen: number[] = []
        const r = await okay(42)
            .toAsync()
            .withValue(v => {
                seen.push(v)
            })
        expect(seen).toEqual([42])
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("awaits async f before resolving", async () => {
        const order: string[] = []
        const r = await okay(42)
            .toAsync()
            .withValue(async v => {
                await new Promise(res => setTimeout(res, 5))
                order.push(`f(${v})`)
            })
        order.push("after")
        expect(order).toEqual(["f(42)", "after"])
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })

    test("returns failed Result from f instead of original", async () => {
        const r = await okay(42)
            .toAsync()
            .withValue(_v => fail("nope"))
        expect(r.get).toEqual({ isOkay: false, error: "nope" })
    })

    test("returns failed Result from async f instead of original", async () => {
        const r = await okay(42)
            .toAsync()
            .withValue(async _v => fail("nope"))
        expect(r.get).toEqual({ isOkay: false, error: "nope" })
    })

    test("does not call f when failed, preserves error", async () => {
        let called = false
        const err = new Error("boom")
        const r = await fail(err)
            .toAsync()
            .withValue(_v => {
                called = true
            })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: false, error: err })
    })
})

// =====================================================================================================================
// AsyncResult.withError

describe("AsyncResult.withError", () => {
    test("calls sync f with error when failed and preserves error", async () => {
        const seen: unknown[] = []
        const err = new Error("boom")
        const r = await fail(err)
            .toAsync()
            .withError(e => {
                seen.push(e)
            })
        expect(seen).toEqual([err])
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("awaits async f before resolving", async () => {
        const order: string[] = []
        const err = new Error("boom")
        const r = await fail(err)
            .toAsync()
            .withError(async _e => {
                await new Promise(res => setTimeout(res, 5))
                order.push("f")
            })
        order.push("after")
        expect(order).toEqual(["f", "after"])
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("returns failed Result from async f instead of original", async () => {
        const r = await fail("boom")
            .toAsync()
            .withError(async _e => fail("recovered"))
        expect(r.get).toEqual({ isOkay: false, error: "recovered" })
    })

    test("does not call f when okay, preserves value", async () => {
        let called = false
        const r = await okay(42)
            .toAsync()
            .withError(_e => {
                called = true
            })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: true, value: 42 })
    })
})

// =====================================================================================================================
// AsyncResult.withError with error constructor

describe("AsyncResult.withError (with constructor)", () => {
    test("does not call f when okay", async () => {
        let called = false
        const r = await okay(1)
            .toAsync()
            .withError(ErrA, _e => {
                called = true
            })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: true, value: 1 })
    })

    test("calls f when error matches constructor and preserves error", async () => {
        const seen: ErrA[] = []
        const err = new ErrA()
        const r = await fail(err)
            .toAsync()
            .withError(ErrA, e => {
                seen.push(e)
            })
        expect(seen).toEqual([err])
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("does not call f when error does not match constructor", async () => {
        let called = false
        const err = new ErrB()
        const r = await fail(err)
            .toAsync()
            .withError(ErrA, _e => {
                called = true
            })
        expect(called).toBe(false)
        expect(r.get).toEqual({ isOkay: false, error: err })
    })

    test("can replace failure with new failure when constructor matches", async () => {
        const r = await fail(new ErrA())
            .toAsync()
            .withError(ErrA, async _e => fail("replaced"))
        expect(r.get).toEqual({ isOkay: false, error: "replaced" })
    })
})

// =====================================================================================================================
// Result — identity invariants for constructor-arg variants

describe("Result identity invariants (constructor-arg overloads)", () => {
    test("handle(Ctor, f) on okay returns the same instance", () => {
        const original = okay(42)
        const r = original.handle(ErrA, _e => 0)
        expect(r).toBe(original)
    })

    test("handle(Ctor, f) on non-matching error returns the same instance", () => {
        const original = fail<ErrA | ErrB>(new ErrB())
        const r = original.handle(ErrA, _e => 0)
        expect(r).toBe(original as unknown as typeof r)
    })

    test("withError(Ctor, f) on okay returns the same instance", () => {
        const original = okay(42)
        const r = original.withError(ErrA, _e => {})
        expect(r).toBe(original)
    })

    test("withError(Ctor, f) on non-matching error returns the same instance", () => {
        const original: Result<number, ErrA | ErrB> = fail(new ErrB())
        const r = original.withError(ErrA, _e => {})
        expect(r).toBe(original)
    })
})

// =====================================================================================================================
// Result — chaining

describe("Result chaining", () => {
    test("composes map, withValue, and handle on the okay path", () => {
        const log: string[] = []
        const r = okay(1)
            .map(x => x + 1)
            .withValue(x => {
                log.push(`got ${x}`)
            })
            .map(x => x * 2)
            .handle(_e => 0)
        expect(r.get).toEqual({ isOkay: true, value: 4 })
        expect(log).toEqual(["got 2"])
    })

    test("short-circuits subsequent map/withValue once failed, until handled", () => {
        const log: string[] = []
        const r = okay(1)
            .map((_x): Result<number, string> => fail("boom"))
            .withValue(x => {
                log.push(`got ${x}`)
            })
            .map(x => x * 2)
            .handle(e => `recovered: ${e}`)
        expect(r.get).toEqual({ isOkay: true, value: "recovered: boom" })
        expect(log).toEqual([])
    })
})

// =====================================================================================================================
// Result — undefined value / error edges

describe("Result with undefined", () => {
    test("okay(undefined) is an okay with undefined value", () => {
        const r = okay(undefined)
        expect(r.get).toEqual({ isOkay: true, value: undefined })
        expect(r.force()).toBeUndefined()
        expect(r.or("alt")).toBeUndefined()
        expect(r.maybe()).toBeUndefined()
    })

    test("fail(undefined) is indistinguishable from okay(undefined) via .maybe()", () => {
        const r = fail(undefined)
        expect(r.get).toEqual({ isOkay: false, error: undefined })
        expect(r.maybe()).toBeUndefined()
        expect(r.or("alt")).toBe("alt")
    })

    test("fail(undefined).force() throws undefined", () => {
        let caught: unknown = "untouched"
        try {
            fail(undefined).force()
        } catch (e) {
            caught = e
        }
        expect(caught).toBeUndefined()
    })
})

// =====================================================================================================================
// AsyncResult — identity contract (always new instance)

describe("AsyncResult identity contract", () => {
    test("map returns a new AsyncResult instance even on the no-op (failed) path", () => {
        const original = fail(new Error("boom")).toAsync()
        const r = original.map(v => v)
        expect(r).not.toBe(original as unknown as typeof r)
    })

    test("handle returns a new AsyncResult instance even on the no-op (okay) path", () => {
        const original = okay(42).toAsync()
        const r = original.handle(_e => 0)
        expect(r).not.toBe(original)
    })

    test("withValue returns a new AsyncResult instance even on the no-op (failed) path", () => {
        const original = fail(new Error("boom")).toAsync()
        const r = original.withValue(_v => {})
        expect(r).not.toBe(original as unknown as typeof r)
    })

    test("withError returns a new AsyncResult instance even on the no-op (okay) path", () => {
        const original = okay(42).toAsync()
        const r = original.withError(_e => {})
        expect(r).not.toBe(original)
    })
})

// =====================================================================================================================
// AsyncResult — underlying Result identity on no-op paths

describe("AsyncResult underlying-Result identity on no-op paths", () => {
    test("map on failed preserves the underlying Result instance", async () => {
        const inner = fail(new Error("boom"))
        const out = await inner.toAsync().map(v => v)
        expect(out).toBe(inner as unknown as typeof out)
    })

    test("handle on okay preserves the underlying Result instance", async () => {
        const inner = okay(42)
        const out = await inner.toAsync().handle(_e => 0)
        expect(out).toBe(inner)
    })

    test("withValue on failed preserves the underlying Result instance", async () => {
        const inner = fail(new Error("boom"))
        const out = await inner.toAsync().withValue(_v => {})
        expect(out).toBe(inner as unknown as typeof out)
    })

    test("withError on okay preserves the underlying Result instance", async () => {
        const inner = okay(42)
        const out = await inner.toAsync().withError(_e => {})
        expect(out).toBe(inner)
    })
})

// =====================================================================================================================
// AsyncResult — rejection propagation from callbacks

describe("AsyncResult rejection propagation from callbacks", () => {
    test("map: synchronous throw inside f rejects the underlying promise", async () => {
        const ar = okay(1)
            .toAsync()
            .map(_v => {
                throw new Error("sync throw")
            })
        await expect((async () => await ar)()).rejects.toThrow("sync throw")
    })

    test("map: rejecting promise returned by f rejects the underlying promise", async () => {
        const ar = okay(1)
            .toAsync()
            .map(_v => Promise.reject(new Error("async reject")))
        await expect((async () => await ar)()).rejects.toThrow()
    })

    test("handle: rejecting promise returned by f rejects the underlying promise", async () => {
        const ar = fail("boom")
            .toAsync()
            .handle(async _e => {
                throw new Error("nope")
            })
        await expect((async () => await ar)()).rejects.toThrow()
    })
})

// =====================================================================================================================
// AsyncResult.then — onrejected

describe("AsyncResult.then (onrejected)", () => {
    test("invokes onrejected when the underlying promise rejects", async () => {
        const rejecting = AsyncResult.make<never, never>(Promise.reject(new Error("boom")))
        let caught: unknown = null
        await rejecting.then(undefined, e => {
            caught = e
        })
        expect(caught).toBeInstanceOf(Error)
        expect((caught as Error).message).toBe("boom")
    })
})
