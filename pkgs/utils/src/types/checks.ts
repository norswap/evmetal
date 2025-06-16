/**
 * Asserts that `_A` is assignable to `_B`.
 *
 * @example
 * ```ts twoslash
 * type _assert1 = AssertAssignableTo<"test", string> // okay
 * type _assert2 = AssertAssignableTo<string, "test"> // error
 * ```
 */
export type CheckAssignableTo<_A extends _B, _B> = never

/**
 * Asserts that `A` and `B` are mutually assignable.
 *
 * @example
 * ```ts twoslash
 * type _assert1 = AssertCompatible<{ a: string, b?: string }, { a: string }> // okay
 * type _assert2 = AssertCompatible<{ a: string, b?: string }, { a: string, b: string }> // error
 * ```
 */
export type CheckAssignable<A extends B, B extends C, C = A> = never
