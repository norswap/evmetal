import { Result } from "#src/result"
import { noThrow, result, resultify } from "#src/resultify"
import type { AsyncResultUnknown, Constructor, GetE, GetV, Resultifiable } from "#src/utils"

/** Return type for functions passed to {@link AsyncResult.withValue} and {@link AsyncResult.withError}. */
export type VoidWithError<E> = void | Result<unknown, E> | PromiseLike<unknown> | PromiseLike<Result<unknown, E>>

/**
 * This wraps a promised {@link Result}. This class is itself a {@link PromiseLike} (aka "thenable") meaning it can be
 * `await`ed to obtain the {@link Result}.
 *
 * The methods are mostly straightforward equivalent to the synchronous {@link Result} methods. `get` is not
 * available as it requires awaiting the promise — simply await then manipulate the result directly.
 *
 * In the docstrings for the methods, we mostly elide its async/promise nature — so we'll say "returns a value" instead
 * of "returns a promise containing the value". Similarly, we'll say "throw" instead of "returns a rejected promise".
 */
export class AsyncResult<out V, out E = never> implements PromiseLike<Result<V, E>> {
    private constructor(private readonly promise: PromiseLike<Result<V, E>>) {}

    /**
     * Constructor for {@link AsyncResult} from a promised {@link Result}.
     * (As a static method to make the actual constructor private and the class closed to extension.)
     *
     * Do not use this directly, use {@link result} instead, which ensures proper promise rejection handling.
     *
     * @internal
     */
    static make<V, E>(promise: PromiseLike<Result<V, E>>): AsyncResult<V, E> {
        return new AsyncResult(promise)
    }

    /**
     * This function is required to make {@link AsyncResult} into a {@link PromiseLike} ("thenable"), which allows
     * it to be `await`ed, yielding the equivalent of awaiting the wrapped promised result.
     *
     * This function should not be used directly, use other functions like {@link map} and {@link handle} instead.
     *
     * The function attaches the {@link onfulfilled} callback to the resolution of the wrapped promise and the {@link
     * onrejected} callback to the rejection of the wrapped promise. Note that {@link onrejected} is NOT called when the
     * result is an error, only when the promise rejects (either rejected explicitly or an error is thrown in an `async`
     * function).
     *
     * Under the recommended usage, the promise will never reject: {@link AsyncResult} instances should be obtained via
     * {@link result}, {@link resultify} or {@link Result.toAsync}.
     */
    // biome-ignore lint/suspicious/noThenProperty: yes then property!
    then<T2 = Result<V, E>, T3 = never>(
        onfulfilled?: ((result: Result<V, E>) => T2 | PromiseLike<T2>) | null | undefined,
        onrejected?: ((reason: unknown) => T3 | PromiseLike<T3>) | null | undefined,
    ): PromiseLike<T2 | T3> {
        return this.promise.then(onfulfilled, onrejected)
    }

    /** Returns the value if present, or throws the error if not. */
    async force(): Promise<V> {
        return (await this.promise).force()
    }

    /** Returns the value if present, or the {@link alternative} argument if not. */
    async or<V2>(alternative: V2 | PromiseLike<V2>): Promise<V | V2> {
        return (await this.promise).or(await alternative)
    }

    /** Shorthand for `this.or(undefined)`. */
    async maybe(): Promise<V | undefined> {
        return this.or(undefined)
    }

    /**
     * Returns the result of applying {@link f} to the value if present, or a result equivalent (but not `===`) to the
     * current one if not.
     *
     * If {@link f} can throw, or if it returns a promise that can reject, wrap it using {@link resultify} first.
     */
    map<T extends AsyncResultUnknown, V2, E2 = never>(
        this: T,
        f: (v: GetV<T>) => Resultifiable<V2, E2>,
    ): AsyncResult<V2, GetE<T> | E2> {
        // biome-ignore format: terse
        return new AsyncResult(
            this.promise.then(promised => !promised.get.isOkay
                ? (promised as Result<never, GetE<T>>)
                : (result(f(promised.get.value as GetV<T>), noThrow) as Result<V2, E2>),
        ))
    }

    /**
     * Returns the result of applying {@link f} to the error if present, or a result equivalent (but not `===`) to the
     * current one if not.
     *
     * If {@link f} can throw, or if it returns a promise that can reject, wrap it using {@link resultify} first.
     */
    handle<T extends AsyncResultUnknown, V2, E2 = never>(
        this: T,
        f: (e: GetE<T>) => Resultifiable<V2, E2>,
    ): AsyncResult<GetV<T> | V2, E2>

    /**
     * Returns the result of applying {@link f} to the error if present and matching {@link errorConstructor}, or a
     * result equivalent (but not `===`) to the current one if not.
     *
     * If {@link f} can throw, or if it returns a promise that can reject, wrap it using {@link resultify} first.
     */
    handle<T extends AsyncResultUnknown, C extends Constructor, V2, E2 = never>(
        this: T,
        errorConstructor: C,
        f: (e: InstanceType<C>) => Resultifiable<V2, E2>,
    ): AsyncResult<GetV<T> | V2, E2 | Exclude<GetE<T>, InstanceType<C>>>

    handle<C extends Constructor, V2, E2>(
        a: C | ((e: E) => Resultifiable<V2, E2>),
        b?: (e: InstanceType<C>) => Resultifiable<V2, E2>,
    ): AsyncResult<V | V2, E2> {
        // biome-ignore format: terse
        return new AsyncResult(this.promise.then(promised => {
            const f = (b ?? a) as (e: E | InstanceType<C>) => Resultifiable<V2, E2>
            if (promised.get.isOkay) return promised as Result<V>
            const error = promised.get.error
            if (b && !(error instanceof (a as C))) return promised as Result<V>
            return result(f(error), noThrow) as Result<V2, E2>
        }))
    }

    /**
     * Calls {@link f} with the value if present. If {@link f} returns a failed result, return that, otherwise return
     * a result equivalent (but not `===`) to the current result.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     *
     * Awaiting the returning result also waits for the completion of {@link f}.
     */
    withValue<T extends AsyncResultUnknown, E2 = never>(
        this: T,
        f: (v: GetV<T>) => VoidWithError<E2>,
    ): AsyncResult<GetV<T>, GetE<T> | E2> {
        return new AsyncResult(
            this.promise.then(async r => {
                if (r.get.isOkay) {
                    const out = await f(r.get.value as GetV<T>)
                    if (out instanceof Result && !out.get.isOkay) return out as Result<never, E2>
                }
                return r as Result<GetV<T>, GetE<T>>
            }),
        )
    }

    /**
     * Calls {@link f} with the error if present. If {@link f} returns a failed result, return that, otherwise return
     * a result equivalent (but not `===`) to the current result.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     *
     * Awaiting the returning result also waits for the completion of {@link f}.
     */
    withError<T extends AsyncResultUnknown, E2 = never>(
        this: T, //
        f: (e: GetE<T>) => VoidWithError<E2>,
    ): AsyncResult<GetV<T>, GetE<T> | E2>

    /**
     * Calls {@link f} with the error if present and matching {@link errorConstructor}. If {@link f} returns a failed
     * result, return that, otherwise return a result equivalent (but not `===`) to the current result.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     *
     * Awaiting the returning result also waits for the completion of {@link f}.
     */
    withError<T extends AsyncResultUnknown, C extends Constructor, E2 = never>(
        this: T,
        errorConstructor: C,
        f: (e: InstanceType<C>) => VoidWithError<E2>,
    ): AsyncResult<GetV<T>, GetE<T> | E2>

    withError<C extends Constructor, E2 = never>(
        a: C | ((e: E) => VoidWithError<E2>),
        b?: (e: InstanceType<C>) => VoidWithError<E2>,
    ): AsyncResult<V, E | E2> {
        return new AsyncResult(
            this.promise.then(async r => {
                const f = (b ?? a) as (e: E | InstanceType<C>) => VoidWithError<E2>
                const union = r.get
                if (!union.isOkay && (!b || union.error instanceof (a as C))) {
                    const out = await f(union.error)
                    if (out instanceof Result && !out.get.isOkay) return out as Result<never, E2>
                }
                return r
            }),
        )
    }

    async *[Symbol.asyncIterator](): AsyncGenerator<Result<never, E>, V> {
        // We don't use a `this` parameter: inside a generator function, GetE<T> & GetV<T> would be inferred based on
        // the function's return type if explicitly provided, which would cause errors.
        const result = await this.promise
        if (!result.get.isOkay) yield result as Result<never, E>
        else return result.get.value
        throw new Error("only use `yield*` on AsyncResult: don't use in a loop or invoke the generator explicitly")
    }
}
