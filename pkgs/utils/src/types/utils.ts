import type { Keys } from "#src/types/keys"

/**
 * Merges object definitions within a type intersection.
 *
 * e.g. `Prettify<{ a: string } & { b: number }>` evaluates to `{ a: string, b: number }`.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Returns the types of the values of T (where T is an object).
 */
export type Values<T> = T[keyof T]

/**
 * A version of `Base` with `OptionalKeys` made optional.
 *
 * e.g. `Optional<{ a: string, b: number }, "b">` evaluates to `{ a: string, b?: number }`.
 */
export type WithOptional<Base, OptionalKeys extends keyof Base> = Prettify<
    Omit<Base, OptionalKeys> & Partial<Pick<Base, OptionalKeys>>
>

/**
 * Given an union U, selects one of its members. This is *generally* the last one, but sometimes it does weird things,
 * e.g. `Select<1|2|3> == 2`.
 */
export type Select<U> = ReturnOf<InferAsArg<RetFunc<U>>>

type RetFunc<T> = T extends never ? never : () => T
type ArgFunc<T> = T extends never ? never : (_: T) => void
type ReturnOf<T> = T extends () => infer R ? R : never
type InferAsArg<T> = ArgFunc<T> extends (_: infer A) => void ? A : never

/**
 * Returns a version of `T` where all fields of type `Src` have been replaced by a field of type `Dst`, recursively.
 * Does not affect array types.
 */
// biome-ignore-all format: readability
export type RecursiveReplace<T, Src, Dst> = Prettify<{
    [K in keyof T]:
        T[K] extends Src
            ? Dst
            : T[K] extends object
                ? RecursiveReplace<T[K], Src, Dst>
                : T[K]
}>

/**
 * Distributes the types in an union.
 *
 * e.g. `Distribute<{ a: 1, b: 2 } | { a: 3, b: 4 }>` evaluates to `{ a: 1 | 3, b: 2 | 4 }`
 */
export type Distribute<T> = {
    [K in Keys<T>]: T extends Record<K, infer U> ? U : never
}

/**
 * Deeply replaces subtypes of `string` and `number` by the primitive type, giving a type suitable for JSON
 * serialization.
 *
 * Tuples are widened to arrays since `infer U` loses positional info. For tuple preservation, we'd need a branch with
 * `T extends readonly [...infer Items]` with mapped recursion over Items, which gets considerably more complex.
 */
export type Serialize<T> = T extends string
    ? string
    : T extends number
      ? number
      : T extends readonly (infer U)[]
        ? Serialize<U>[]
        : T extends object
          ? { [K in keyof T]: Serialize<T[K]> }
          : T
