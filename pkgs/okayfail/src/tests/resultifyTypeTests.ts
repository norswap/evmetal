// noinspection UnnecessaryLocalVariableJS

import type { AsyncResult } from "#src/asyncResult"
import type { Result } from "#src/result"
import { type Resultified, result, resultify } from "#src/resultify"
import type { Resultifiable } from "#src/utils"

// === Helpers =========================================================================================================

// Strict equality check (not just assignability) for function return types.
// biome-ignore format: parens
type Equal<X, Y> = (<T>() => (T extends X ? 1 : 2)) extends (<T>() => (T extends Y ? 1 : 2)) ? true : false

// Mutual assignability check, which is looser than strict equality.
// We distributing an union over a type conditional, we sometimes end up with a `T | T` union which is equivalent to `T`
// but will fail the strict equality check.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

type Expect<T extends true> = T

/** Custom makeError to exercise non-default E2. */
const toStr = (e: unknown) => String(e)

// === Fixtures ========================================================================================================

declare const r: Result<number, string>
declare const ar: AsyncResult<number, string>
declare const pr: PromiseLike<Result<number, string>>
declare const pn: Promise<number>
declare const pu: PromiseLike<unknown>
declare const u: unknown
declare const n: number

declare const fnR: () => Result<number, string>
declare const fnAR: () => AsyncResult<number, string>
declare const fnPR: () => PromiseLike<Result<number, string>>
declare const fnPN: () => Promise<number>
declare const fnPU: () => PromiseLike<unknown>
declare const fnU: () => unknown
declare const fnN: () => number

// === result — concrete ===============================================================================================

const rv01 = result(r)
type _trv01 = Expect<Equal<typeof rv01, Result<number, string>>>

const rv02 = result(r, toStr)
type _trv02 = Expect<Equal<typeof rv02, Result<number, string>>>

const rv03 = result(pr)
type _trv03 = Expect<Equal<typeof rv03, AsyncResult<number, string | Error>>>

const rv04 = result(pr, toStr)
type _trv04 = Expect<Equal<typeof rv04, AsyncResult<number, string>>>

const rv05 = result(ar)
type _trv05 = Expect<Equal<typeof rv05, AsyncResult<number, string | Error>>>

const rv06 = result(ar, toStr)
type _trv06 = Expect<Equal<typeof rv06, AsyncResult<number, string>>>

const rv07 = result(n)
type _trv07 = Expect<Equal<typeof rv07, Result<number>>>

const rv08 = result(n, toStr)
type _trv08 = Expect<Equal<typeof rv08, Result<number>>>

const rv09 = result(pn)
type _trv09 = Expect<Equal<typeof rv09, AsyncResult<number, Error>>>

const rv10 = result(pn, toStr)
type _trv10 = Expect<Equal<typeof rv10, AsyncResult<number, string>>>

// PromiseLike<unknown>: vague async type.
const rv11 = result(pu)
type _trv11 = Expect<Equal<typeof rv11, AsyncResult<unknown, unknown>>>

const rv12 = result(pu, toStr)
type _trv12 = Expect<Equal<typeof rv12, AsyncResult<unknown, unknown>>>

// unknown: vague Result/AsyncResult union.
const rv13 = result(u)
type _trv13 = Expect<Equal<typeof rv13, Result<unknown, unknown> | AsyncResult<unknown, unknown>>>

const rv14 = result(u, toStr)
type _trv14 = Expect<Equal<typeof rv14, Result<unknown, unknown> | AsyncResult<unknown, unknown>>>

// === resultify — concrete ============================================================================================

const r01 = resultify(fnR)
type _tv01 = Expect<Equal<typeof r01, () => Result<number, string | Error>>>

const r02 = resultify(fnR, toStr)
type _tv02 = Expect<Equal<typeof r02, () => Result<number, string>>>

const r03 = resultify(fnPR)
type _tv03 = Expect<Equal<typeof r03, () => AsyncResult<number, string | Error>>>

const r04 = resultify(fnPR, toStr)
type _tv04 = Expect<Equal<typeof r04, () => AsyncResult<number, string>>>

const r05 = resultify(fnAR)
type _tv05 = Expect<Equal<typeof r05, () => AsyncResult<number, string | Error>>>

const r06 = resultify(fnAR, toStr)
type _tv06 = Expect<Equal<typeof r06, () => AsyncResult<number, string>>>

const r07 = resultify(fnN)
type _tv07 = Expect<Equal<typeof r07, () => Result<number, Error>>>

const r08 = resultify(fnN, toStr)
type _tv08 = Expect<Equal<typeof r08, () => Result<number, string>>>

const r09 = resultify(fnPN)
type _tv09 = Expect<Equal<typeof r09, () => AsyncResult<number, Error>>>

const r10 = resultify(fnPN, toStr)
type _tv10 = Expect<Equal<typeof r10, () => AsyncResult<number, string>>>

// Function returning PromiseLike<unknown>: vague async type.
const r11 = resultify(fnPU)
type _tv11 = Expect<Equal<typeof r11, () => AsyncResult<unknown, unknown>>>

const r12 = resultify(fnPU, toStr)
type _tv12 = Expect<Equal<typeof r12, () => AsyncResult<unknown, unknown>>>

// Function returning unknown: vague Result/AsyncResult union.
const r13 = resultify(fnU)
type _tv13 = Expect<Equal<typeof r13, () => Result<unknown, unknown> | AsyncResult<unknown, unknown>>>

const r14 = resultify(fnU, toStr)
type _tv14 = Expect<Equal<typeof r14, () => Result<unknown, unknown> | AsyncResult<unknown, unknown>>>

// === result — generic ================================================================================================

function _foo1<V, E>() {
    const r = undefined as unknown as Result<V, E>
    const ar = undefined as unknown as AsyncResult<V, E>
    const pr = undefined as unknown as PromiseLike<Result<V, E>>

    const r1 = result(r)
    type _t1 = Expect<Equal<typeof r1, Result<V, E>>>

    const r2 = result(r, toStr)
    type _t2 = Expect<Equal<typeof r2, Result<V, E>>>

    const r3 = result(ar)
    type _t3 = Expect<Equal<typeof r3, AsyncResult<V, E | Error>>>

    const r4 = result(ar, toStr)
    type _t4 = Expect<Equal<typeof r4, AsyncResult<V, E | string>>>

    const r5 = result(pr)
    type _t5 = Expect<Equal<typeof r5, AsyncResult<V, E | Error>>>

    const r6 = result(pr, toStr)
    type _t6 = Expect<Equal<typeof r6, AsyncResult<V, E | string>>>
}

function _foo2<V>() {
    const v = undefined as unknown as V
    const p = undefined as unknown as Promise<V>

    const r1 = result(v)
    type _t1 = Expect<Equal<typeof r1, Resultified<V, Error>>>

    const r2 = result(v, toStr)
    type _t2 = Expect<Equal<typeof r2, Resultified<V, string>>>

    const r3 = result(p)
    type _t3 = Expect<Equal<typeof r3, Resultified<Promise<V>, Error>>>

    const r4 = result(p, toStr)
    type _t4 = Expect<Equal<typeof r4, Resultified<Promise<V>, string>>>
}

function _foo3<T extends Resultifiable>(input: T) {
    const out = result(input)
    type _t = Expect<Equal<typeof out, Resultified<T, Error>>>
}

// === resultify — generic =============================================================================================

function _foo4<Args extends unknown[], V, E>() {
    const fnR = undefined as unknown as (...a: Args) => Result<V, E>
    const fnAR = undefined as unknown as (...a: Args) => AsyncResult<V, E>
    const fnPR = undefined as unknown as (...a: Args) => PromiseLike<Result<V, E>>

    const r1 = resultify(fnR)
    type _t1 = Expect<Equal<typeof r1, (...a: Args) => Result<V, E | Error>>>

    const r2 = resultify(fnR, toStr)
    type _t2 = Expect<Equal<typeof r2, (...a: Args) => Result<V, E | string>>>

    const r3 = resultify(fnAR)
    type _t3 = Expect<Equal<typeof r3, (...a: Args) => AsyncResult<V, E | Error>>>

    const r4 = resultify(fnAR, toStr)
    type _t4 = Expect<Equal<typeof r4, (...a: Args) => AsyncResult<V, E | string>>>

    const r5 = resultify(fnPR)
    type _t5 = Expect<Equal<typeof r5, (...a: Args) => AsyncResult<V, E | Error>>>

    const r6 = resultify(fnPR, toStr)
    type _t6 = Expect<Equal<typeof r6, (...a: Args) => AsyncResult<V, E | string>>>
}

function _foo5<Args extends unknown[], V>() {
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

function _foo6<Args extends unknown[], R extends Resultifiable>(fn: (...a: Args) => R) {
    const out = resultify(fn)
    type _t = Expect<Equal<typeof out, (...a: Args) => Resultified<R, Error, Error>>>
}

// === result — mixed return types =====================================================================================

declare const nOrR: number | Result<number, string>
declare const rOrPR: Result<number, string> | PromiseLike<Result<number, string>>
declare const nOrPR: number | PromiseLike<Result<number, string>>
declare const nOrPN: number | Promise<number>

const rm01 = result(nOrR)
type _trm01 = Expect<Same<typeof rm01, Result<number> | Result<number, string>>>

const rm02 = result(nOrR, toStr)
type _trm02 = Expect<Same<typeof rm02, Result<number> | Result<number, string>>>

const rm03 = result(rOrPR)
type _trm03 = Expect<Same<typeof rm03, Result<number, string> | AsyncResult<number, string | Error>>>

const rm04 = result(rOrPR, toStr)
type _trm04 = Expect<Same<typeof rm04, Result<number, string> | AsyncResult<number, string>>>

const rm05 = result(nOrPR)
type _trm05 = Expect<Same<typeof rm05, Result<number> | AsyncResult<number, string | Error>>>

const rm06 = result(nOrPR, toStr)
type _trm06 = Expect<Same<typeof rm06, Result<number> | AsyncResult<number, string>>>

const rm07 = result(nOrPN)
type _trm07 = Expect<Same<typeof rm07, Result<number> | AsyncResult<number, Error>>>

const rm08 = result(nOrPN, toStr)
type _trm08 = Expect<Same<typeof rm08, Result<number> | AsyncResult<number, string>>>

// === resultify — mixed return types ==================================================================================

declare const fnNOrR: () => number | Result<number, string>
declare const fnROrPR: () => Result<number, string> | PromiseLike<Result<number, string>>
declare const fnNOrPR: () => number | PromiseLike<Result<number, string>>
declare const fnNOrPN: () => number | Promise<number>

const rm09 = resultify(fnNOrR)
type _trm09 = Expect<Same<typeof rm09, () => Result<number, Error> | Result<number, string | Error>>>

const rm10 = resultify(fnNOrR, toStr)
type _trm10 = Expect<Same<typeof rm10, () => Result<number, string>>>

const rm11 = resultify(fnROrPR)
type _trm11 = Expect<Same<typeof rm11, () => Result<number, string | Error> | AsyncResult<number, string | Error>>>

const rm12 = resultify(fnROrPR, toStr)
type _trm12 = Expect<Same<typeof rm12, () => Result<number, string> | AsyncResult<number, string>>>

const rm13 = resultify(fnNOrPR)
type _trm13 = Expect<Same<typeof rm13, () => Result<number, Error> | AsyncResult<number, string | Error>>>

const rm14 = resultify(fnNOrPR, toStr)
type _trm14 = Expect<Same<typeof rm14, () => Result<number, string> | AsyncResult<number, string>>>

const rm15 = resultify(fnNOrPN)
type _trm15 = Expect<Same<typeof rm15, () => Result<number, Error> | AsyncResult<number, Error>>>

const rm16 = resultify(fnNOrPN, toStr)
type _trm16 = Expect<Same<typeof rm16, () => Result<number, string> | AsyncResult<number, string>>>
