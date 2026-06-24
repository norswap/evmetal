# okayfail API Design

<!-- @formatter:off -->
<!-- TOC -->
* [okayfail API Design](#okayfail-api-design)
  * [Background](#background)
  * [Result as a Single Class](#result-as-a-single-class)
  * [Squashing Unions](#squashing-unions)
    * [First Method: Type Variable Inference](#first-method-type-variable-inference)
    * [Second Method: Extractor Types](#second-method-extractor-types)
  * [Designing `resultify` and Generator Usage](#designing-resultify-and-generator-usage)
    * [Exceptions Types](#exceptions-types)
    * [The Async Throw Pitfall](#the-async-throw-pitfall)
  * [Do we need `AsyncResult` at all?](#do-we-need-asyncresult-at-all)
  * [Default Error](#default-error)
  * [Overloads](#overloads)
    * [Overloading With Type Variables](#overloading-with-type-variables)
    * [Overloading With Mapper Types](#overloading-with-mapper-types)
      * [First Method: Mapping With Nested Type Variable Inference](#first-method-mapping-with-nested-type-variable-inference)
      * [Second Method: Mapping With Extractor Types](#second-method-mapping-with-extractor-types)
<!-- TOC -->
<!-- @formatter:on -->

## Background

okayfail is largely my own twist on a classical Result-type library, and in particular [NeverThrow][neverthrow] for
TypeScript.

[neverthrow]: https://github.com/supermacro/neverthrow

I wrote it because I thought it would be easy (it wasn't) and interesting (it was). It took way too much time because of
me trying to get things "just so".

It wasn't even necessary work — NeverThrow is mostly great, besides some typing performance issue when you build very
long pipelines. But I kept at it because it was fun, sunk costs, and I knew if I completed it I would use it
religiously.

With that in mind, this document describes the difficult design choices I made when writing the library. All of these
are deeply tied into TypeScript's type system. Maybe you learn from them as I have!

## Result as a Single Class

Schematically, NeverThrow's core data structure looks like this:

```typescript
interface IResult<V, E> { ... }
class Okay<V, E> implements IResult<V, E> { ... }
class Fail<V, E> implements IResult<V, E> { ... }
type Result<V, E> = Okay<V, E> | Fail<V, E>
```

The reason for this setup is flow-typing: you can do `result.isOkay() ? result.value : result.error` in a type-safe way
that is not possible if using `IResult` or a singular class. You need the union.

Also notice how it's `Okay<V, E> implements IResult<V, E>` instead of `Okay<V> implement IResult<V, never>` (and
vice-versa for `Fail`). This addresses some NeverThrow-specific typing problems (which I didn't look into since I didn't
have those myself).

okayfail has a single `Result` class. It achives flow typing via its `get` property: `result.get.isOkay ?
result.get.value : result.get.error`. `get` is an accessor that returns `{ isOkay: true, value: V } | { isOkay: false,
error: E }`.

Having a single class reduces redundancy in the implementation, and makes things type a little bit cleaner, using
`Result<V, E>` uniformly, instead of having the union show up in tooltips and diagnostics.

There is a case where we do end up with an union: `condition ? okay(value) : fail(error)` — this types as `Result<V,
never> | Result<never, E>`. In the next section we'll see how to automatically squash this to `Result<V, E>`

## Squashing Unions

It's pretty common to end up with a value or function whose (return) type is `Result<V, never> | Result<never, E>` (e.g.
`condition ? okay(value) : fail(error)`).

This is annoying, because unions will start popping up in all inferred types in your pipeline.

Say you define your map function as:

```typescript
map<V2, E2 = never>(f: (v: V) => Result<V2, E2> | V2): Result<V2, E | E2>
```

Then you get this:

```typescript
const uh = [].length ? okay(42) : fail(new Error()) // Result<number> | Result<never, Error>
const x = uh.map((x: number) => "a") //  Result<string, never> | Result<string, Error>
```

The union distributes over the signature, so you get the weird union instead of a clean `Result<string, Error>`.

Let me show you two methods to avoid this issue (we went with the second one in okayfail).

Note that while we frame these methods in terms of how they squash unions on the receiver type, these methods work
equally well for squashing unions on method parameters.

### First Method: Type Variable Inference

Is there a way we can avoid this? As it turns out yes, here is one possible solutions:

```typescript
map<V0, E0, V2, E2 = never>(this: Result<V0, E0>, f: (v: NoInfer<V0>) => Result<V2, E2> | V2): Result<V2, E0 | E2>

const uh = [].length ? okay(42) : fail(new Error()) // Result<number, never> | Result<never, Error>
const x = uh.map((x: number) => "a") //  Result<string, Error>
```

To understand exactly what's going on here, see [my article on type variable inference][TODO]. But in summary, the union
distributes over the target type `Result<V0, E0>`, yield candidates `number, never` for `V0` and `never, Error` for
`E0`. We then select the supertypes `V0 = number` (which is a supertype of `never`) and `E0 = Error` (also a supertype
of `never`). The receiver is then explicitly typed as `Result<number, Error>` via the `this` parameter, and the
signature doesn't distribute over a receiver union type anymore.

One thing to notice is the `NoInfer` type. This prevents a mistaken function type from hijacking inference (which it
will because contaravariant inference candidates have priority — [cf. my article][TODO]). Here's what happens if we
remove `NoInfer` and feed it a function with the wrong `V0` type:

```typescript
uh.map((x: boolean) => "a")
^^
TS2684: The this context of type Result<number, never> | Result<never, Error> is not assignable to method's this
of type Result<boolean, Error>.
```

Without `NoInfer`, `V0` is inferred to boolean and it therefore indicates that `uh` is incompatible with the expected
`this` type. `NoInfer` blocks this inference, allowing the error to show on the function instead.

Note a minor inconvenience of `NoInfer`: some IDE tooling (at least IntelliJ) doesn't always see through `NoInfer` and
might give you some spurious warnings in the functions whose param type is `NoInfer<V0>`.

This method only works when the corresponding parameter types in the union have a subtyping relationship. So
it will squash `Result<number, never> | Result<never, Error>` to `Result<number, Error>` since `number` and `Error`
supertype `never`. It will not reduce `Result<number, string> | Result<string, Error>` to
`Result<number | string, string | Error>`, as these types are not related.

### Second Method: Extractor Types

Here's the method that will actually produce proper union types for unrelated types:

```typescript
type GetV<T extends Result<unknown, unknown>> = T extends Result<infer V> ? V : never
type GetE<T extends Result<unknown, unknown>> = T extends Result<unknown, infer E> ? E : never

map<T extends Result<unknown, unknown>, V2, E2 = never>(this: T, f: (v: GetV<T>) => Result<V2, E2> | V2): Result<V2, GetE<T> | E2>

declare const uh: Result<number, never> | Result<never, Error>
const x = uh.map((x: number) => "a") //  Result<string, Error>

declare const mixed: Result<number, string> | Result<string, Error>
const y = mixed.map((it: number | string) => [it]) // Result<(number | string)[], string | Error>
```

In this case, we don't infer the receiver's `V` and `E`, instead we infer the entire type as `T`, then use the extractor
types `GetV` and `GetE` to recover its `V` and `E` parameters.

This is in my opinion less readable as a signature, but handling all unions makes it worth it in my opinion, so I
ended up using it.

## Designing `resultify` and Generator Usage

`resultify` converts functions returning values into functions returning `Result`, and functions returning promises
into functions returning `AsyncResult` (capturing thrown exceptions and promise rejections as errors). We also want to
pass through returned `Result` and `AsyncResult` to allow mixed return-type functions.

In the original design, `resultify` covered the functionality that are now covered by the new `resultify` but also:

- `result`: converts a value into a `Result` or `AsyncResult`
- `fresult`: converts a function returning a result generator into a function returning a `Result` or `AsyncResult`

`result` needed to be its own function anyway: the original `resultify` would call it for values, and for
functions and it would return a function wrapping. The use cases are also fairly different — a separation makes sense.

Finally, the separation allows `result` to wrap functions into a result, which wouldn't be possible with the
combined form.

Generator syntax is one of the coolest thing about the library, which lets you basically have a checked exception syntax
(i.e. throw-like behaviour, but fully captured by the type system) that can be mixed with the fluent syntax to implement
local and syntactically-convenient recovery.

Initially, I wanted generator-style function to stand on their own:

```typescript
type GenResult<V, E> = Generator<Result<never, E>, V>

class ErrA { readonly kind = "ErrA" }
class ErrB { readonly kind = "ErrB" }
class ErrC { readonly kind = "ErrC" }
declare function bar(): Result<"A", ErrA>
declare function baz(): GenResult<"B", ErrB>

function* foo(): GenResult<["A", "B"], ErrA | ErrB | ErrC> {
    const a = yield* bar()
    const b = yield* baz()
    if ([].length) yield* fail(new ErrC())
    return [a, b]
}
```

This works nicely as long as you stay in the "generator world". To branch out to regular function, you needed to convert
your `GenResult` into a `Result` (or your `GenAsyncResult` into `AsyncResult`), which required (at the time) passing it
into `resultify` which handled the conversion.

Besides this minor incovenience, it also create another pitfall: you couldn't use `resultify` to create a
`Result<Generator<...>, E>`. The implementation of `resultify` couldn't distinguish between a `GenResult` and another
instance of `Generator` before calling `Generator.next()`, a destructive operation.

It was possible to exclude `Generator` that did not match `GenResult`, but it made usage in a generic context painful:
it made it impossible to pass a function returning a naked type variable `V` to `resultify` without constraining the
type in very annoying ways.

Instead, the new way:

```typescript
const foo: () => Result<["A", "B"], ErrA | ErrB | ErrC> = fresult(function* () {
    const a = yield* bar()
    const b = yield* baz()
    if ([].length) yield* fail(new ErrC())
    return [a, b]
})
```

Which is slightly less clean but makes everything downstream more convenient. It also support returning both values (as
previously) and results from the function body (so above we could replace `yield* fail(...)` by `return fail(...)`).

### Exceptions Types

We'll cover the `Resultified` type present in the return type of `resultify` in the [section on overloading
signatures](#overloads). However, I want to point out one of its pecularities here.

Here's the type. Don't bother to understand it deeply, just focus on the use of the type parameters related to errors:
`ERejected` and `EExtra`:

```typescript
export type Resultified<T extends Resultifiable, EReject = never, EExtra = never> =
    T extends ResultUnknown ? Result<GetV<T>, GetE<T> | EExtra> :
    T extends PromiseLike<ResultUnknown> ? AsyncResult<GetV<T>, GetE<T> | EReject | EExtra> : // covers AsyncResult
    T extends PromiseLike<infer X> ? (
        // T = PromiseLike<supertype of Result> => can't infer parameter types.
        // Can also trigger if V and E are not inferred, and the wrong types are provided.
        Result<never> extends X ? AsyncResultUnknown :
        // If we reach here and V is inferred, the first branch is always taken. `never` only if a bad V is supplied.
        X extends GetV<T> ? AsyncResult<GetV<T>, EReject | EExtra> :
        never):
    // T = supertype of PromiseLike => don't know if async and can't infer parameter types
    PromiseLike<never> extends T ? ResultUnknown | AsyncResultUnknown :
    // T = supertype of Result  => can't infer parameter types
    Result<never> extends T ? ResultUnknown :
    Result<GetV<T>, EExtra>
    
export function resultify<R extends Resultifiable, E = Error, Args extends unknown[] = unknown[]>(
    it: (...a: Args) => R,
    makeError?: (e: unknown) => E,
): (...a: Args) => Resultified<R, E, E>
```

TODO does the signature need to be earlier?

`ERejected` is the type of errors that promise inputs to the function passed to `resultify` generate when they reject.
`EExtra` is an extra error type conjoined to all result types. It is used by `resultify` to conjoin the type of errors
that its argument function can throw.

`resultify` doesn't actually distinguish between both, so `ERejected` is unnecessary in its context. But the distinction
is needed for `result`: we need to handle promise rejections, but there is no thrown exceptions. In the
definition of `Resultified` we therefore need to distinguish sites that have a promise rejection from all the others.

The main issue with TypeScript that okayfail fixes is its lack of typing for errors. Given a function or a promise, we
don't know the type of error it can throw / reject with. Therefore, when converting, we need to hint or enforce the
error type. This is done via the optional `makeError` parameter, which default to `unknownToError`. The actual
thrown/rejection error is passed to it and it converts it to its return type `E` (defaulting to `Error` for
`unknownToError`).

Note a type safety violation is possible here: if type parameters are provided explicitly to `resultify` and `makeError`
is omitted, the assumed error type `E` can be set to something else than `Error` which is what actually results from the
default `unknownToError`. It's possible to sidestep this by using overloads: one signature with a non-optional
`makeError` and a `E` type parameters, and one signature without `makeError` and `Error` hardcoded in `Resultified`'s
arguments. I deemed this unlikely enough that I didn't bother with the extra syntactic noise.

Also note that sometimes you know exactly the type of thrown/rejection errors, or that no such error can occur.
For those cases, we provide the `throws<E>` and `noThrows` function which are just passthrough (`it => it`) that lets
you assert the error type to `E` or `never`.

### The Async Throw Pitfall

There is one major pitfall from handling both synchronous and asynchronous variants together: if the function passed to
`resultify` throws, it's impossible for the implementation to determine if the function was supposed to return something
that converts to a `Result` or to an `AsyncResult`. In those case, we return a failed `Result`, which is a type safety
violation if the function returned a promise-like (only those convert to `AsyncResult`).

I briefly considered implementing an ambiguous result type that would be fully compatible with the `Result` API and as
compatible as possible with the `AsyncResult` API. I decided against it, because it's a lot of complexity, and `async`
functions do not throw by construction (thrown errors get captured and emitted as promise rejections). It's still
possible for functions returning promise-likes to throw, but it's a big code smell.

## Do we need `AsyncResult` at all?

An important question that came to me late in the implementation process. `AsyncResult` are actually janky and
unnecessary in `async` context where it's better to deal with `Result` directly. So why not use `Promise<Result>`
directly? In fact, an `async` function returning an `AsyncResult` has actual return type `Promise<Result>`, owing to
`async` function automatically unwrapping the returning promise-likes (`AsyncResult<V,E>` implements
`PromiseLike<Result<V,E>>`) and wrapping the result in a `Promise`.

One wrong answer is that `AsyncResult` are easier to manipulate in a non-`async` context (you can't call `map` on a
`Promise<Result<V, E>>`). But it's easy to enter an `async` context on demand, using an async IIFE (Immeidately Invoked
Function Expression) or `Promise.then`.

The real answer is that sometimes we want to pass an async function to `map`. The output type of the `map` invocation
should mark the returned value as being async somehow. And at that point, a dedicated `AsyncResult` is the best option.

Even more problematic: when we pass a function to map, it is only invoked if the result wraps a value. If it does not,
we should return a failed asynchronous result if the passed function is `async` and a failed synchronous result
otherwise. But the implementation is unable to make this determination without calling the function! This is analogous
to the pitfall of `resultify` promise-returning arguments throwing, but this one is unacceptable in practice.

An intriguing option is something like `Result<V, E, "async">`. It looks like this might *perhaps* work (as in "work at
all"), though it seems to me it's rather confusing to the user. It doesn't fully solve the "async function problem" from
the last paragraph, but can be made to work most of the time as long as returned promises (from `force()`, `maybe()`,
etc...) are `await`ed, which will work even when the actual thing is a direct value, not a promise. The `get` would need
to be reworked, as accessor can't take `this` params (which would be necessary to prevent calling `get` on an async
result).

## Default Error

Many places in the API can fail to infer an error type when no error is possible.

For instance: `result.handle(it => 42)`. Normally, `E2` (the error type of the result) is inferred from the function
return type, but in this case, we have `V2 = number` and nothing to infer `E2` against, so it would infer as `unknown`.

This is a problem: the type of `result.map(it => 42)` should be `Result<number, never>`, NOT `Result<number, unknown>`.

To prevent this, `handle` must specify a default value `E2 = never`. And so any function where the error type might fail
to be inferred.

It's important to note that it is not sufficient that `Result` is defined as `class Result<out V, out E = never> { ...
}`. That default will only be used when typing `Result<V>` without the second type parameter, but it wouldn't be used
when using `handle` since the return type is explicitly typed as `Result<V | V2, E2>` and `E2` infers as `unknown` in a
process completely independent of the definition of `Result`.

## Overloads

A lot of the difficulty with the implementation was to use "overloaded" methods, which I use to mean both signature
overloads and complex generic methods: basically a single method accepting multiple sets of parameters, and sometimes
returning different kinds of results accordingly.

Overload appears in two spots: `Result` and `AsyncResult` methods, and the `resultify` function. For the methods, we'll
use `map` as the prime example. We'll also touch on `handle`, because it accepts either one or two parameters.

`Result.map` is the easy case where overloading isn't really required: it can take a `(v: V) => V2` or a `(v: V) =>
Result<V2, E2>`, we could call the former `map` and the latter `fmap`, matching other languages and libraries.

For `AsyncResult.map` however, we need to handle functions returnings plain values, results, promised plain values and
promised results. This is already a lot less obvious, maybe `map`, `fmap`, `asyncMap` and `asyncFmap`, respectively?

But it should be obvious from the return value. Just `map` for all cases is better. And it reduces the API surface,
documentation duplication, ...

Having a single method has another advantage: it allows functions with mixed return values, e.g.: `result.map(v =>
condition ? 42 : okay(42))`.

We covered `resultify` in the previous section, so see there for background.

### Overloading With Type Variables

For result methods, it's easy because the return type is fixed (`Result<V, E>` for `Result.map`, `AsyncResult<V, E>`
for `ÀsyncResult.map`), so we can just use an union for the mapping function return type:

```typescript
map<V2, E2 = never>(this: Result<V0, E0>, f: (v: V) => Result<V2, E2> | V2): Result<V2, E | E2>
                                                       \____the union____/
```

For `AsyncResult`, we do the same but use a type alias given the greater number of union branches:

```typescript
export type Resultifiable<V, E = never> =
    | Result<V, E>
    | PromiseLike<Result<V, E>> // covers AsyncResult
    | PromiseLike<V>
    | V
```

**Important note**: this way of doing things is not entirely type-safe! If `f` has type `(v: V) => unknown`, `map` will
*have a return type of `Result<unknown, E>`. But if `f` actually returns a result (say `Result<V2, E2>`, which is indeed
*a subtype of `unknown`), then the value actually returned by map will be a `Result<V2, E | E2>`, i.e. we're losing the
*mapped error type `E2`.

This is actually avoidable, and we do avoid this pitfall for resultify — we will cover how in the next section.

I decided to keep this pitfall because it did make the signature vastly simpler, and I do expect this edge case to be
almost never hit in practice.

### Overloading With Mapper Types

`resultify` is harder because the return type is dependent on the input type and a way that we can't just map with
inferred variable — we need conditional types.

I went through two iterations of how to do this, which match the two methods for [union squashing](#squashing-unions).
Just like there, we ended up going with the second, extractor-type-based solution. I'm including the first version,
because it comes with very interesting TypeScript type system lessons.

The core of both solutions is a "mapper" type to map a concrete input type to the proper result type. (The terminology
here is my own.)

#### First Method: Mapping With Nested Type Variable Inference

In this solution, we also need a "matcher" type capturing the input type as well as the value and error types `V` and
`E`. Here's what it looks like:

```typescript
export type InferResultifiable<T, V = unknown, E = unknown> =
    T extends Result<V, E> ? T & Result<V, E> :
    T extends AsyncResult<V, E> ? T & AsyncResult<V, E> :
    T extends PromiseLike<Result<V, E>> ? T & PromiseLike<Result<V, E>> :
    T extends PromiseLike<V> ? T & PromiseLike<V> :
    V

export type Resultified<T, V, E, EReject = never, EExtra = never> =
    T extends Result<V, E> ? Result<V, E | EExtra> :
    T extends PromiseLike<Result<V, E>> ? AsyncResult<V, E | EReject | EExtra> : // covers AsyncResult
    T extends PromiseLike<infer X> ? (
        // T = PromiseLike<supertype of Result> => can't infer parameter types.
        // Can also trigger if V and E are not inferred, and the wrong types are provided.
        Result<never> extends X ? AsyncResult<unknown, unknown> :
        // If we reach here and V is inferred, the first branch is always taken. `never` only if a bad V is supplied.
        X extends V ? AsyncResult<V, EReject | EExtra> :
        never):
    // T = supertype of PromiseLike => don't know if async and can't infer parameter types
    PromiseLike<never> extends T ? Result<unknown, unknown> | AsyncResult<unknown, unknown> :
    // T = supertype of Result  => can't infer parameter types
    Result<never> extends T ? Result<unknown, unknown> :
    Result<V, EExtra>
    
export function resultify<R, V, E, E2 = Error, Args extends unknown[] = unknown[]>(
    it: (...a: Args) => InferResultifiable<R, V, E>,
    makeError?: (e: unknown) => E2,
): (...a: Args) => Resultified<R, V, E, E2, E2>
```

Let's unpack. In the `resultify` signature, `InferResultifiable<R, V, E>` captures the input, value and error types
in `R`, `V`, `E`.

It's tempting to use `T extends Resultifiable<V, E>` instead. `Resultifiable` has a much saner definition
(it's just an union) compared to `InferResultifiable` and its `extends` chain. Unfortunately, it doesn't work:
TypeScript is very happy to infer both `V` and `E` to `unknown`, which is indeed technically correct.

(The second solution will get us close to this!)

TypeScript simply doesn't consider type bounds in inference at all. This is again recorded in [my article on type
variable inference][TODO].

Another thing the article will help you understand is why `InferResultifiable` needs the `T` intersection on all
branches, and why it is not present on the last (`V`) branch. `T` needs to appear in an inference position, which is the
"if" or "else" part of a conditional (not the condition). Recording inference candidates doesn't care what the *actual*
type of `T` is (conditionals are not evaluated at that time). Because of `T`'s presence in the intersection, the entire
source type is recorded as a candidate for `T`. Technically, we only need `T` to appear on a single branch, but having
it on every branch is clearer and more pleasant.

It does not appear on the final branch though! Another thing the article eludicates: if the type was `T & V` TypeScript
wouldn't know how to split the source type betweeen `T` & `V` during inference and so does not record an inference
candidate. `V` must appear on its own.

Next on, the mapper type `Resultified`. After having captured `R`, `V` and `E`, we can pass them into `Resultified`
to obtain the proper return type. Here are the principles:

- Synchronous input map to `Result`, asynchronous inputs map to `AsyncResult`, ambiguous one to an union of both
- Some inputs are ambiguous, because they are supertype of `Result` or `PromiseLike` and so could contain one of those
  things. We give appropriately vague error types in those cases, with `unknown` value and error types.
- In other cases (input type unrelated to `Result` and `PromiseLike`), we map to a `Result` with the input type as value
  type.
- Error types get unioned with the `EExtra` type parameter — in `resultify` this is used to add the type of errors
  caught from the try-catch statement.
- When the input is a promise, it gets unioned with the `ERejected` type parameter representing the promise rejection
  error.

Note that the mapper type does not support unwrapping nested promises. I *believe* this is technically feasible, but the
added complexity and pitfalls weren't worth the complexity. It's not really needed in practice: an `async` function will
not return a nested promise, for instance and you can flatten any nested promise (or promise-like) via
`Promise.resolve(promise)` (or unwrap them via `await`).

Note that the typing for promises does match the implementation where we use `then`, so only take a single unwrawpping
step.

#### Second Method: Mapping With Extractor Types

```typescript
export type Resultified<T extends Resultifiable, EReject = never, EExtra = never> =
    T extends ResultUnknown ? Result<GetV<T>, GetE<T> | EExtra> :
    T extends PromiseLike<ResultUnknown> ? AsyncResult<GetV<T>, GetE<T> | EReject | EExtra> : // covers AsyncResult
    T extends PromiseLike<infer X> ? (
        // T = PromiseLike<supertype of Result> => can't infer parameter types.
        // Can also trigger if V and E are not inferred, and the wrong types are provided.
        Result<never> extends X ? AsyncResultUnknown :
        // If we reach here and V is inferred, the first branch is always taken. `never` only if a bad V is supplied.
        X extends GetV<T> ? AsyncResult<GetV<T>, EReject | EExtra> :
        never):
    // T = supertype of PromiseLike => don't know if async and can't infer parameter types
    PromiseLike<never> extends T ? ResultUnknown | AsyncResultUnknown :
    // T = supertype of Result  => can't infer parameter types
    Result<never> extends T ? ResultUnknown :
    Result<GetV<T>, EExtra>
    
export function resultify<R extends Resultifiable, E = Error, Args extends unknown[] = unknown[]>(
    it: (...a: Args) => R,
    makeError?: (e: unknown) => E,
): (...a: Args) => Resultified2<R, E, E>
```

Compared to the previous solution, we got rid of the matcher type, and `Resultified` now does not take `V` and `E`
directly, instead it retrieves them from `T` directly via the `GetV` and `GetE` extractor methods.

All we need to constraint the input is `R extends Resultifiable` in the `resultify` method. Note that we do need to
capture the concrete type in `R`, it's not sufficient to use `Resultifiable` which is an union type we can't extract
`V` and `E` from.

This method is generally simpler (less code!) and works better in generic settings. Consider these type tests taken from
[`resultifyTypeTests.ts`](/pkgs/okayfail/src/misc/resultifyTypeTests.ts).

```typescript
function _foo<Args extends unknown[], V>() {
    const fnV = undefined as unknown as (...a: Args) => V
    const fnP = undefined as unknown as (...a: Args) => Promise<V>

    const r1 = resultify(fnV)
    type _t1 = Expect<Equal<typeof r1, (...a: Args) => Resultified<V, Error, Error>>>

    const r2 = resultify(fnV, toStr)
    type _t2 = Expect<Equal<typeof r2, (...a: Args) => Resultified<V, string, string>>>

    const r3 = resultify(fnP)
    type _t3 = Expect<Equal<typeof r3, (...a: Args) => Resultified<Promise<V>, Error, Error>>>

    const r4 = resultify(fnP, toStr)
    type _t4 = Expect<Equal<typeof r4, (...a: Args) => Resultified<Promise<V>, string, string>>>
}
```

These tests do not pass with the type-variable inference solution. The issue is that `V` and `Promise<V>` are not
assignable to `InferResultifiable`: the naked type variable `V` prevents resolution of the conditionals in that
type, meaning only a structural match is possible (e.g. if one of our functions returned `InferResultifiable<...>`
directly). In the current solution, we simply match `V` or `Promise<V>` against the `Resultifiable<V, E>` union, which
doesn't have conditional and works.

Note that the naked `V` still prevents resolution of the conditionals in `Resultified` (as we want, we don't know what
`V` is). But if we were to return one of the resultified functions from `_foo5`, then the calling context (in which we
assign `V` a concrete type) can resolve `Resultified<V, ...>` to a concrete type.

------------------------------------------------------------------------------------------------------------------------

// TODO START
This works as well on parameters.

```typescript
class Foo<out E> {}
declare const uh: Foo<"A"> | Foo<never>
function foo<E>(f: Foo<E>) {}
foo(uh)
```

// TODO END

// TODO START
This also works on parameters.

```typescript
type GetE<T extends Foo<unknown>> = T extends Foo<infer E> ? E : never
declare function foo<T extends Foo<unknown>>(f: T): GetE<T>
const x = foo(uh)
```

// TODO END

// biome-ignore format: readability
export type FResultified<T extends Generator<ResultUnknown> | AsyncGenerator<ResultUnknown>> =
T extends Generator<infer Y, infer R> ? Result<ReturnValue<R>, YieldError<Y>> :
T extends AsyncGenerator<infer Y, infer R> ? AsyncResult<ReturnValue<R>, YieldError<Y>> :
never

export function fresult<
T extends Generator<ResultUnknown> | AsyncGenerator<ResultUnknown>,
Args extends unknown[] = unknown[],
> (f: (...a: Args) => T): (...a: Args) => FResultified<T>