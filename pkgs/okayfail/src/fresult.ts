import { AsyncResult } from "#src/asyncResult"
import { okay, Result } from "#src/result"
import type { AsyncResultUnknown, ResultUnknown } from "#src/utils"

/**
 * Captures the result error type from the yielded type of the generator returned by the function passed to {@link
 * fresult}.
 */
export type YieldError<Y extends ResultUnknown> = Y extends Result<unknown, infer E> ? E : never

/**
 * Captures the return type from the return type of the generator returned by the function passed to {@link fresult}.
 */
export type ReturnValue<R> = R extends Result<infer V, unknown> ? V : R

/**
 * Captures the result error type from the return type of the generator returned by the function passed to {@link
 * fresult}.
 */
export type ReturnError<R> = R extends Result<unknown, infer E> ? E : never

/**
 * Create a function that uses generator syntax to make {@link Result} and {@link AsyncResult} behave like checked
 * exceptions: within such a function you can call `yield*` on a result to either obtain its successful value, or
 * immediately exit with its error result. The passed-in function can either return a value or a result (or a mix of
 * both, as long as the value type matches).
 *
 * Do not throw from functions passed to {@link fresult} — return a failed result with {@link fail} instead, and
 * only call functions that can throw (using {@link resultify} to ensure this if needed).
 *
 * Example:
 * ```
 * declare const numberResult: Result<number, Error>
 * declare function fNumberResult(): Result<number, string>
 * declare const shouldSum: boolean
 *
 * const foo: () => Result<number, Error | string> = fresult(function *() {
 *     const v1 = yield* numberResult
 *     // v1 is type `number` — if the result fails, foo returns it immediately
 *     const v2 = yield* fNumberResult()
 *     // same
 *     return shouldSum ? v1 + v2 : okay(v1 - v2)
 *     // can return either values or results, or a mix (the value types must match!)
 * })
 * ```
 */

export function fresult<Y extends ResultUnknown, R, Args extends unknown[] = unknown[]>(
    f: (...a: Args) => Generator<Y, R>,
): (...a: Args) => Result<ReturnValue<R>, ReturnError<R> | YieldError<Y>>

export function fresult<Y extends ResultUnknown, R, Args extends unknown[] = unknown[]>(
    f: (...a: Args) => AsyncGenerator<Y, R>,
): (...a: Args) => AsyncResult<ReturnValue<R>, ReturnError<R> | YieldError<Y>>

export function fresult(
    f: (...a: unknown[]) => Generator<ResultUnknown, unknown> | AsyncGenerator<ResultUnknown, unknown>,
): (...a: unknown[]) => ResultUnknown | AsyncResultUnknown {
    return (...args: unknown[]) => {
        const gen = f(...args)
        return Symbol.iterator in gen
            ? toResult(gen.next().value)
            : AsyncResult.make(gen.next().then(it => toResult(it.value)))
    }
}

function toResult<V, E = never>(it: Result<V, E> | V): Result<V, E> {
    return it instanceof Result ? it : okay(it)
}
