// biome-ignore-all lint/complexity/noBannedTypes: we want {}

/**
 * Type shorthand for `null | undefined`.
 */
export type Nullish = null | undefined

/**
 * Type for any value that is not undefined. Very useful as a type bound.
 */
export type NotUndefined = {} | null

/**
 * Type for any value that is not null. Very useful as a type bound.
 */
export type NotNull = {} | undefined

/**
 * Type for any value that is not undefined or null. Very useful as a type bound.
 * This type definition is just `{}`, which you can use directly, but some linter discourage it.
 */
export type Defined = {}

/**
 * Type of objects with values of type `T` (`unknown` by default). `Obj` a better object type than `object`, as it
 * excludes `null`, `undefined` and primitive types (numbers, booleans, strings).
 */
export type Obj<T = unknown> = Record<string, T>

/**
 * Type guard shorthand for `value !== null && value !== undefined`
 */
export function isDef(value: unknown): value is Defined {
    return value !== null && value !== undefined
}

/**
 * Type guard shorthand for `value === null || value === undefined`.
 */
export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined
}

/**
 * Type guard to check if a value is an object in the sense of {@link Obj} (a non-null non-undefined record).
 */
export function isObj(value: unknown): value is Obj {
    return typeof value === "object" && isDef(value) && !Array.isArray(value)
}
