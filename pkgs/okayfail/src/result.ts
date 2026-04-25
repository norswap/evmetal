import { AsyncResult } from "#src/asyncResult"
import type { Constructor, GetE, GetV, ResultUnknown } from "#src/utils"

/** Builds a new {@link Result} wrapping a value. */
export function okay<V>(value: V): Result<V> {
    return Result.okay(value)
}

/** Builds a new Result wrapping an error. */
export function fail<E>(error: E): Result<never, E> {
    return Result.fail(error)
}

/** A result type wrapping either a value (`V`) or an error (`E`). */
export class Result<out V, out E = never> {
    private constructor(
        private readonly isOkay: boolean,
        private readonly valueOrError: V | E,
    ) {}

    /**
     * Builds a new {@link Result} wrapping a value. This is the same as non-method `okay` function.
     * @internal
     */
    static okay<V>(value: V): Result<V> {
        return new Result<V, never>(true, value)
    }

    /**
     * Builds a new {@link Result} wrapping an error. This is the same as the non-method `fail` function.
     * @internal
     */
    static fail<E>(error: E): Result<never, E> {
        return new Result<never, E>(false, error)
    }

    /**
     * Enables flow typing: use `this.get.isOkay` to discriminate then access value/error via
     * `this.get.value` or `this.get.error`.
     *
     * @example
     * if(result.get.isOkay) {
     *     console.log(`value: ${result.get.value}`)
     *     // accessing `result.get.error` here would error
     * } else {
     *     console.log(`error: ${result.get.error}`)
     *     // accessing `result.get.value` here would error
     * }
     */
    get get(): { isOkay: true; value: V } | { isOkay: false; error: E } {
        return this.isOkay
            ? { isOkay: true, value: this.valueOrError as V }
            : { isOkay: false, error: this.valueOrError as E }
    }

    /** Returns the value if present, or throws the error if not. */
    force(): V {
        if (this.isOkay) return this.valueOrError as V
        throw this.valueOrError as E
    }

    /** Returns the value if present, or the {@link alternative} argument if not.  */
    or<V2>(alternative: V2): V | V2 {
        return this.isOkay ? (this.valueOrError as V) : alternative
    }

    /** Shorthand for `this.or(undefined)`. */
    maybe(): V | undefined {
        return this.or(undefined)
    }

    /** Returns an async result wrapping this result. */
    toAsync<V, E>(this: Result<V, E>): AsyncResult<V, E> {
        return AsyncResult.make(Promise.resolve(this))
    }

    /**
     * Returns the result of applying {@link f} to the value if present, or the current result if not.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     */
    map<T extends ResultUnknown, V2, E2 = never>(
        this: T,
        f: (v: GetV<T>) => Result<V2, E2> | V2,
    ): Result<V2, GetE<T> | E2> {
        if (!this.isOkay) return this as unknown as Result<never, GetE<T>>
        const mapped = f(this.valueOrError as GetV<T>)
        return mapped instanceof Result ? mapped : okay(mapped)
    }

    /**
     * Returns the result of applying {@link f} to the error if present, or the current result if not.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     */
    handle<T extends ResultUnknown, V2, E2 = never>(
        this: T,
        f: (v: GetE<T>) => Result<V2, E2> | V2,
    ): Result<GetV<T> | V2, E2>

    /**
     * Returns the result of applying {@link f} to the error if present and matching {@link errorConstructor}, or the
     * current result if not.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     */
    handle<T extends ResultUnknown, C extends Constructor, V2, E2 = never>(
        this: T,
        errorConstructor: C,
        f: (e: InstanceType<C>) => Result<V2, E2> | V2,
    ): Result<GetV<T> | V2, E2 | Exclude<GetE<T>, InstanceType<C>>>

    handle<C extends Constructor, V2, E2>(
        a: C | ((e: E) => Result<V2, E2> | V2),
        b?: (e: InstanceType<C>) => Result<V2, E2> | V2,
    ): Result<V | V2, unknown> {
        const f = (b ?? a) as (e: E | InstanceType<C>) => Result<V2, E2> | V2
        if (this.isOkay) return this
        if (b && !(this.valueOrError instanceof a)) return this
        const handled = f(this.valueOrError as E | InstanceType<C>)
        return handled instanceof Result ? handled : okay(handled)
    }

    /**
     * Calls {@link f} with the value if present. If {@link f} returns a failed result, return that, otherwise return
     * the current result.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     */
    withValue<T extends ResultUnknown, E2 = never>(
        this: T,
        f: (v: GetV<T>) => void | Result<void, E2>,
    ): Result<GetV<T>, GetE<T> | E2> {
        if (this.isOkay) {
            const out = f(this.valueOrError as GetV<T>)
            if (out instanceof Result && !out.isOkay) return out as Result<never, E2>
        }
        return this as Result<GetV<T>, GetE<T>>
    }

    /**
     * Calls {@link f} with the error if present. If {@link f} returns a failed result, return that, otherwise return
     * the current result.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     */
    withError<T extends ResultUnknown, E2 = never>(
        this: T,
        f: (e: GetE<T>) => void | Result<void, E2>,
    ): Result<GetV<T>, GetE<T> | E2>

    /**
     * Calls {@link f} with the error if present and matching {@link errorConstructor}. If {@link f} returns a failed
     * result, return that, otherwise return the current result.
     *
     * If {@link f} can throw, wrap it using {@link resultify} first.
     */
    withError<T extends ResultUnknown, C extends Constructor, E2 = never>(
        this: T,
        errorConstructor: C,
        f: (e: InstanceType<C>) => void | Result<unknown, E2>,
    ): Result<GetV<T>, GetE<T> | E2>

    withError<C extends Constructor = Constructor, E2 = never>(
        a: C | ((e: E) => void | Result<unknown, E2>),
        b?: (e: InstanceType<C>) => void | Result<unknown, E2>,
    ): Result<V, E | E2> {
        const f = (b ?? a) as (e: E | InstanceType<C>) => void | Result<unknown, E2>
        if (!this.isOkay && (!b || this.valueOrError instanceof (a as C))) {
            const out = f(this.valueOrError as E | InstanceType<C>)
            if (out instanceof Result && !out.isOkay) return out as Result<never, E2>
        }
        return this
    }

    /**
     * In a generator function, using `yield*` on the result will yield the error if present (equivalent to "throwing",
     * but instead the generator returns the failed result) or return the value if present (letting the generator
     * function continue).
     */
    *[Symbol.iterator](): Generator<Result<never, E>, V> {
        // We don't use a `this` parameter: inside a generator function, GetE<T> & GetV<T> would be inferred based on
        // the function's return type if explicitly provided, which would cause errors.
        if (this.isOkay) return this.valueOrError as V
        yield this as unknown as Result<never, E>
        throw new Error("only use `yield*` on Result: don't use in a loop or invoke the generator explicitly")
    }
}
