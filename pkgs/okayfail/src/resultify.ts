import { AsyncResult } from "#src/asyncResult"
import { fail, okay, Result } from "#src/result"
import {
    type AsyncResultUnknown,
    type GetE,
    type GetV,
    isPromiseLike,
    type ResultUnknown,
    unknownToError,
} from "#src/utils"

/**
 * Given a type `T`, converts it to a {@link Result} or {@link AsyncResult} depending on its shape.
 *
 * This also takes two type parameters `EReject` and `EExtra`, where `EReject` indicates the error type to use in case
 * of promise rejection and `EExtra` indicates an extra error type, notably utilized by {@link resultify} to adjoin
 * the type of errors thrown by a function returning either a result or something convertible to one.
 */
// biome-ignore format: readability
export type Resultified<T, EReject = never, EExtra = never> =
    T extends ResultUnknown ? Result<GetV<T>, GetE<T> | EExtra> :
    T extends PromiseLike<ResultUnknown> ? AsyncResult<GetV<T>, GetE<T> | EReject | EExtra> : // covers AsyncResult
    T extends PromiseLike<infer X> ? (
        // T = PromiseLike<supertype of Result> => can't infer parameter types.
        Result<never> extends X ? AsyncResultUnknown :
        AsyncResult<GetV<T>, EReject | EExtra>) :
    // T = supertype of PromiseLike => don't know if async and can't infer parameter types
    PromiseLike<never> extends T ? ResultUnknown | AsyncResultUnknown :
    // T = supertype of Result  => can't infer parameter types
    Result<never> extends T ? ResultUnknown :
    Result<GetV<T>, EExtra>

/**
 * Converts a value into a {@link Result} or {@link AsyncResult} depending on its concrete type.
 *
 * - {@link Result} and {@link AsyncResult} instance are returned as-is.
 * - Promised results are converted into {@link AsyncResult} preserving value and error type.
 * - Other promised values are converted into {@link AsyncResult} with proper value type, and an error type given
 *   by {@link makeError} (see below).
 * - Promise nesting is NOT handled.
 *
 * Promise-likes can reject with an error. In those cases, the error gets passed to {@link makeError} to produce the
 * actual error (defaulting to {@link unknownToError}, returning an {@link Error}).
 *
 * In those cases, the error type of the result gets unioned `E`, the return type of {@link makeError} (`E` will be the
 * entire error type, unless the input is a promised result).
 *
 * If you know the rejection type, you can pass {@link throws} with the error type as type argument instead. If you know
 * the promise cannot reject, you can pass {@link noThrow} instead to assert (returns `never`, making `E` disappear).
 */
export function result<T, E = Error>(it: T, makeError?: (e: unknown) => E): Resultified<T, E> {
    if (it instanceof Result) return it as Resultified<T>
    if (it instanceof AsyncResult) return it as Resultified<T>
    // biome-ignore format: terse
    if (isPromiseLike(it)) return AsyncResult.make(it.then(
        v => (v instanceof Result) ? v : okay(v),
        e => fail((makeError ?? unknownToError)(e))
    )) as Resultified<T, E>
    return okay(it) as Resultified<T>
}

/**
 * Converts functions into functions returning results a {@link Result} or an {@link AsyncResult} depending on the shape
 * of the returned value. Errors thrown by the function are caught and turned into a failed result.
 *
 * This basically wraps the function in a `try {} catch(e) {}` and applies {@link result} on the returned value.
 * See {@link result} for the conversion rules.
 *
 * Since functions can throw errors and promise-like inputs can reject with an error, the error types gets unioned with
 * `E`, the result of the {@link makeError} function. If not provided, it defaults to {@link unknownToError} (returning
 * {@link Error}). If you know the rejection/throw type, you can pass {@link throws} with the error type as type
 * argument instead. If you know there won't be a thrown/rejection error, you can pass {@link noThrow} to assert instead
 * (returns `never`, making `E` disappear).
 *
 * **Caveat**: Functions that return promises or {@link AsyncResult} should NOT throw errors. Async functions normally
 * don't throw (they always return a promise, which can reject), and functions returning {@link AsyncResult} should
 * generally operate in the same way. If that nonetheless happens, {@link resultify} will return a failing {@link
 * Result} instead of an {@link AsyncResult} (as it is impossible to know the function return type at runtime), breaking
 * type safety.
 *
 * One common use of this function is to pass it a function, and to invoke its result immediately, using it as a
 * try-catch to convert thrown errors into results.
 */
export function resultify<R, E = Error, Args extends unknown[] = unknown[]>(
    it: (...a: Args) => R,
    makeError?: (e: unknown) => E,
): (...a: Args) => Resultified<R, E, E> {
    return (...a: Args) => {
        try {
            const returned = it(...a)
            return result(returned, makeError)
        } catch (e) {
            // Not strictly correct as explained in the docstring, but unavoidable.
            // Ok as long as functions returning async things don't throw.
            return fail((makeError ?? unknownToError)(e)) as never
        }
    }
}

/**
 * Pass this as second parameter to {@link result] or {@link resultify} to pass through thrown errors and/or promise
 * rejection value as failed results, while asserting their type to be {@link E}.
 */
export function throws<E>(e: unknown): E {
    return e as E
}

/**
 * Pass this as second parameter to {@link result] or {@link resultify} to asserts that no errors are thrown and
 * promises don't reject. If that should nonetheless happen, this function itself will throw an error.
 */
export function noThrow(): never {
    throw new Error("You passed noThrow to result or resultify, but the function threw or a promise rejected.")
}
