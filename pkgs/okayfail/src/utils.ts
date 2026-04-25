import type { AsyncResult } from "#src/asyncResult"
import type { Result } from "#src/result"

// === PUBLIC API TYPES ================================================================================================
// Types exposed in signatures or whose usage is strongly encouraged.

export type ResultUnknown = Result<unknown, unknown>
export type AsyncResultUnknown = AsyncResult<unknown, unknown>

/** Matches any class constructor. */
export type Constructor = abstract new (...a: never[]) => unknown

/**
 * Type of things that can be converted to a {@link Result} or  {@link AsyncResult} with the given value and error type.
 *
 * Note that every type is assignable to `Resultifiable`, so the purpose of this type is to capture value and error type
 * constraints.
 *
 * Notably used in the signatures of {@link AsyncResult.map}, {@link AsyncResult.handle}, where it for instance enables
 * taking in function returning `number | Result<number, Error>` and returning a uniform `Result<number | ..., Error |
 * ...>`.
 */
// biome-ignore format: readability
export type Resultifiable<V = unknown, E = unknown> =
    | Result<V, E>
    | PromiseLike<Result<V, E>> // covers AsyncResult
    | PromiseLike<V>
    | V

/**
 * Extracts the value type from a concrete member of the {@link Resultifiable} union.
 * You can capture such a concrete type with `T extends Resultifiable` bound.
 */
// biome-ignore format: readability
export type GetV<T> =
    T extends Result<infer V, unknown> ? V :
    T extends PromiseLike<Result<infer V, unknown>> ? V : // covers AsyncResult
    T extends PromiseLike<infer V> ? V :
    T

/**
 * Extracts the error type from a concrete member of the {@link Resultifiable} union.
 * You can capture such a concrete type with `T extends Resultifiable` type bound.
 */
// biome-ignore format: readability
export type GetE<T> =
    T extends Result<unknown, infer E> ? E :
    T extends PromiseLike<Result<unknown, infer E>> ? E : // covers AsyncResult
    never

// === PUBLIC FUNCTIONS ================================================================================================

/**
 * Returns {@link u} if the it is an instance of {@link Error}, or a new {@link Error} instance wrapping {@link u}
 * instead, in which case the message is the JSON stringification of {@link u} (with extra handling for edge cases
 * (undefined, bigints, circular objects, ...), and {@link u} is saved as the cause of the returned error.
 */
export function unknownToError(u: unknown): Error {
    if (u instanceof Error) return u
    // `JSON.stringify` returns `undefined` for these — produce a sensible message instead.
    if (u === undefined) return new Error("undefined", { cause: u })
    if (typeof u === "function") return new Error(`[Function: ${u.name || "anonymous"}]`, { cause: u })
    if (typeof u === "symbol") return new Error(u.toString(), { cause: u })
    // `JSON.stringify` throws on `BigInt` by default.
    if (typeof u === "bigint") return new Error(`${u}n`, { cause: u })

    let message: string
    try {
        // The replacer guards against circular references (which `JSON.stringify` would otherwise throw on)
        // and against nested `BigInt` values. Nested `undefined` / function / symbol values are still subject
        // to `JSON.stringify`'s normal behaviour (omitted in objects, `null` in arrays).
        const seen = new WeakSet<object>()
        function replacer(_key: string, value: unknown) {
            if (typeof value === "bigint") return `${value}n`
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return "[Circular]"
                seen.add(value)
            }
            return value
        }
        message = JSON.stringify(u, replacer, 2) ?? String(u)
    } catch {
        // Last resort if stringification still fails (e.g. exotic Proxy/getter traps).
        message = String(u)
    }
    return new Error(message, { cause: u })
}

// === INTERNAL FUNCTIONS ==============================================================================================

export function isPromiseLike<T>(obj: unknown): obj is PromiseLike<T> {
    return (
        !!obj &&
        (typeof obj === "object" || typeof obj === "function") &&
        "then" in obj &&
        typeof obj.then === "function"
    )
}
