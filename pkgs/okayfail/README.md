# okayfail

okayfail is a TypeScript result library, similar to [NeverThrow] or the [Rust `Result` type][rust]. It lets you make
error type explicit while writing elegant pipelines.

```bash
npm install okayfail
bun install okayfail
```

[neverthrow]: https://github.com/supermacro/neverthrow

[comparison]: #neverthrow-comparison

[rust]: https://doc.rust-lang.org/std/result/enum.Result.html

**See [example.ts](./src/tests/example.ts) for a full example.**

## API Synopsis

See [the source] for extensive docstrings and type signatures.

[the source]: src

- `okay(value)` / `fail(error)`
    - Builds results wrapping values or errors.
- `Result<V, E>`
    - `force()`
        - returns value or throws error.
    - `or(alternative)`
        - returns value or alternative.
    - `maybe()`
        - returns value or undefined.
    - `map(f)`
        - applies `f` to the value if present (returning new value or result), returns a `Result`.
    - `handle(errorConstructor?, f)`
        - applies `f` to the error if present (returning new value (not error) or result), returns a `Result`.
        - If `errorConstructor` is provided, `f` is only invoked if the actual error matches the constructor.
        - The handled error types are removed from the signature of the returned `Result`.
    - `withValue(f)`
        - applies `f` to the value if present, returns result unchanged, unless `f` returns a failed result (then
          returns
          that instead).
    - `withError(errorConstructor?, f)`
        - applies `f` to the error if present (and matching `errorConstructor` if supplied), returns result unchanged.
    - `toAsync()`
        - returns an `AsyncResult` wrapping this result (suitable to apply async functions).
    - `get`
        - returns a struct that enables flow typing, e.g. `r.get.isOkay ? r.get.value : r.get.error`
- `AsyncResult<V, E>`
    - An async result wraps a `Promise<Result<V, E>>`.
    - This is a `PromiseLike` (aka "thenable") so it can be `await`ed to get the underlying `Result`.
    - The methods are equivalent to the `Result` methods, but return promises instead of values, and `AsyncResult`s
      instead of `Results`. `get` is not available, as it requires awaiting the promise — just `await` directly.
    - You can construct an `AsyncResult` via `Result#toAsync()`, `result(promise)`,
      `resultify(functionReturningPromise)()`.
    - Methods
        - `force()`
        - `or(valueOrPromise)`
        - `maybe()`
        - `map(f)`
        - `handle(errorConstructor?, f)`
        - `withValue(f)`
        - `withError(errorConstructor?, f)`
- `unknownToError(unknownError)`
    - returns `unknownError` unchanged if it is a standard `Error`, otherwise wraps it in an `Error`.
    - If wrapping, uses `JSON.stringify(unknownError)` as the description, and sets `unknownError` as the cause.
- `result(it, makeError?)`
    - Converts values or promised values into results.
        - `Result` and `AsyncResult` result instances are passed through.
        - Promised values and promised results are converted to `AsyncResult`.
        - Other values are converted to `Result`.
    - `makeError` is invoked on promises' rejection value and its return type is used as the returned result's error
      type when the input is a promise-like type (this includes `AsyncResult`).
        - If not provided, `makeError` defaults to `unknownToError` (error type `Error`).
            - For non-promises, the error type is `never`.
        - The functions `throws` and `noThrow` can be fed as `makeError`.
            - `throws<T>`: pass the rejection values through and assert their types
            - `noThrows`: signals that `it` doesn't reject
- `resultify(it, makeError?)`
    - Converts functions into functions returning results.
        - This basically wraps the function in a `try {} catch(e) {}` and applies `result` on the returned value.
    - Caught errors are converted to failed results via `makeError` if provided (defaults to `unknownToError`).
        - Just like `result`, `throws` and `noThrows` can be passed, and here apply to both rejection values and throw
          errors.
        - **Pitfall:** If a function returning a promise-like throws, a failed `Result` is returned, but the function
          return
          type is `AsyncResult`. This is most often okay: `async` functions never throw.
    - You can immediately invoke the returned function to provide the equivalent of a try-catch statement:
      ```typescript
      resultify(() => {
        if (condition) throw new Error("error")
        return 42
      })() satisfies Result<number, Error>
      ```

## Generator Protocol (`yield*`) — "Typed Exceptions"

Use `fresult` to wrap a generator function (`function*`) where you can use `yield*` on a `Result` or `ResultAsync` (in
an `async function*`) to either unwrap the value or immediately return the failed return. This enables a flow similar to
exceptions but encoding the error type in the result.

 ```typescript
declare const numberResult: Result<number, Error>
declare function fNumberResult(): Result<number, string>
declare const shouldSum: boolean

const foo: () => Result<number, Error | string> = fresult(function *() {
    const v1 = yield* numberResult
    // v1 is type `number` — if the result fails, foo returns it immediately
    const v2 = yield* fNumberResult()
    // same            
    return shouldSum ? v1 + v2 : okay(v1 - v2)
    // can return either values or results, or a mix (the value types must match!)
})
 ```

Note that the type annotation on `foo` is fully optional, but provides clarity & demonstrates how this works.

## Proper Error Hygiene

- The library generally assumes that you are working in the "Result world" where functions don't throw and promises
  don't reject.
- Use `result` and `resultify` to convert promises that can reject and functions that can throw to their proper
  resultified equivalent.
- In particular: do not feed functions that can throw or return exceptions that can reject to `map`, `handle`,
  `withValue` and `withError`.
- Do not throw from generator functions passed to `fresult` — it's never necessary to throw from the body (return a
  failed result with `fail` instead). Only call functions that can't throw, using `resultify` if needed.

## NeverThrow Comparison

NeverThrow is a great library, and if you're happy with it, you should keep using it.

okayfail might help if you're running into typing performance. For instance, when ported to NeverThrow, the fluent API
example above struggles in my IDE.

The two libraries are pretty much equivalent in terms of features. NeverThrow has utilities to combine lists of results,
while okayfail can have error-specific handlers.

Otherwise, it's just a different flavoring, I tried to make the library easily digestible and pretty 🌸✨

I got sucked into the rabbithole of building this, thinking it would only take a couple hours (it didn't — see [the
implementation notes][notes]). That being said, I'm quite happy for the result and intend to use it extensively for my
own projects.

[notes]: ramblings/design.md