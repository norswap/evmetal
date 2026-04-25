// noinspection UnnecessaryLocalVariableJS
// noinspection DuplicatedCode

import type { AsyncResult } from "#src/asyncResult"
import { fail, okay, type Result } from "#src/result"
import { resultify } from "#src/resultify"

// Strict equality check (not just assignability).
// biome-ignore format: parens
type Equal<X, Y> = (<T>() => (T extends X ? 1 : 2)) extends (<T>() => (T extends Y ? 1 : 2)) ? true : false
type Expect<T extends true> = T

const vToValue = (v: number) => v + 2
const vToOkay = (v: number) => okay(v + 2)
const vToFail = (_v: number) => fail("nope")
const vToResult = (v: number) => (v > 0 ? okay(v) : fail("negative"))
const vToPromisedValue = async (v: number) => v + 2
const vtoPromisedResult = async (v: number) => okay(v + 2)
const vtoAsyncResult = resultify(
    async (v: number) => v + 2,
    (e: unknown) => String(e),
)
const eToValue = (_e: unknown) => 69
const eToOkay = (_e: unknown) => okay(69)
const eToResult = (e: unknown) => (e instanceof Error ? okay(69) : fail("error"))
const eToFail = (_e: unknown) => fail("nope")
const eToPromisedValue = async (_e: unknown) => 69
const etoPromisedResult = async (e: unknown) => (e instanceof Error ? okay(69) : fail("error"))
const etoAsyncResult = resultify(
    async (_e: unknown) => 69,
    (e: unknown) => String(e),
)

const vToVoid = (_v: number): void => {}
const vToOkayVoid = (_v: number): Result<void> => okay(undefined)
const vToFailVoid = (_v: number): Result<void, string> => fail("nope")
const vToVoidOrFail = (v: number): void | Result<void, string> => (v > 0 ? undefined : fail("nope"))
const eToVoid = (_e: unknown): void => {}
const eToFailVoid = (_e: unknown): Result<void, string> => fail("nope")
const eToVoidOrFail = (e: unknown): void | Result<void, string> => (e instanceof Error ? undefined : fail("nope"))
const vToPromisedVoid = async (_v: number): Promise<void> => {}
const vToPromisedFailVoid = async (_v: number): Promise<Result<void, string>> => fail("nope")
const eToPromisedVoid = async (_e: unknown): Promise<void> => {}
const eToPromisedFailVoid = async (_e: unknown): Promise<Result<void, string>> => fail("nope")

// =====================================================================================================================
// Sync Basic

const ok = okay(42)
const no = fail(new Error("boop"))
const uh = [].length ? ok : no

const r01 = ok.map(vToValue)
type _t01 = Expect<Equal<typeof r01, Result<number>>>

const r02 = no.map(vToValue)
type _t02 = Expect<Equal<typeof r02, Result<number, Error>>>

const r03 = uh.map(vToValue)
type _t03 = Expect<Equal<typeof r03, Result<number, Error>>>

const r04 = ok.map(vToOkay)
type _t04 = Expect<Equal<typeof r04, Result<number>>>

const r05 = no.map(vToOkay)
type _t05 = Expect<Equal<typeof r05, Result<number, Error>>>

const r06 = uh.map(vToOkay)
type _t06 = Expect<Equal<typeof r06, Result<number, Error>>>

const r07 = ok.map(vToFail)
type _t07 = Expect<Equal<typeof r07, Result<never, string>>>

const r08 = no.map(vToFail)
type _t08 = Expect<Equal<typeof r08, Result<never, Error | string>>>

const r09 = uh.map(vToFail)
type _t09 = Expect<Equal<typeof r09, Result<never, Error | string>>>

const r10 = ok.map(vToResult)
type _t10 = Expect<Equal<typeof r10, Result<number, string>>>

const r11 = no.map(vToResult)
type _t11 = Expect<Equal<typeof r11, Result<number, Error | string>>>

const r12 = uh.map(vToResult)
type _t12 = Expect<Equal<typeof r12, Result<number, Error | string>>>

const r13 = ok.handle(eToValue)
type _t13 = Expect<Equal<typeof r13, Result<number>>>

const r14 = no.handle(eToValue)
type _t14 = Expect<Equal<typeof r14, Result<number>>>

const r15 = uh.handle(eToValue)
type _t15 = Expect<Equal<typeof r15, Result<number>>>

const r16 = ok.handle(eToOkay)
type _t16 = Expect<Equal<typeof r16, Result<number>>>

const r17 = no.handle(eToOkay)
type _t17 = Expect<Equal<typeof r17, Result<number>>>

const r18 = uh.handle(eToOkay)
type _t18 = Expect<Equal<typeof r18, Result<number>>>

const r19 = ok.handle(eToFail)
type _t19 = Expect<Equal<typeof r19, Result<number, string>>>

const r20 = no.handle(eToFail)
type _t20 = Expect<Equal<typeof r20, Result<never, string>>>

const r21 = uh.handle(eToFail)
type _t21 = Expect<Equal<typeof r21, Result<number, string>>>

const r22 = ok.handle(eToResult)
type _t22 = Expect<Equal<typeof r22, Result<number, string>>>

const r23 = no.handle(eToResult)
type _t23 = Expect<Equal<typeof r23, Result<number, string>>>

const r24 = uh.handle(eToResult)
type _t24 = Expect<Equal<typeof r24, Result<number, string>>>

const r25 = ok.toAsync()
type _t25 = Expect<Equal<typeof r25, AsyncResult<number>>>

const r26 = no.toAsync()
type _t26 = Expect<Equal<typeof r26, AsyncResult<never, Error>>>

const r27 = uh.toAsync()
type _t27 = Expect<Equal<typeof r27, AsyncResult<number, Error>>>

// =====================================================================================================================
// Sync — .handle with error constructor

class ErrA extends Error {
    readonly kind = "ErrA"
}
class ErrB extends Error {
    readonly kind = "ErrB"
}

const noA = fail(new ErrA())
const noB = fail(new ErrB())
const noAB = [].length ? noA : noB
const uhAB = [].length ? ok : noAB

const hr01 = ok.handle(ErrA, eToValue)
type _ht01 = Expect<Equal<typeof hr01, Result<number>>>

const hr02 = noA.handle(ErrA, eToValue)
type _ht02 = Expect<Equal<typeof hr02, Result<number>>>

// Constructor doesn't match: error preserved.
const hr03 = noB.handle(ErrA, eToValue)
type _ht03 = Expect<Equal<typeof hr03, Result<number, ErrB>>>

// Union error reduced: ErrA removed, ErrB remains.
const hr04 = noAB.handle(ErrA, eToValue)
type _ht04 = Expect<Equal<typeof hr04, Result<number, ErrB>>>

const hr05 = uhAB.handle(ErrA, eToValue)
type _ht05 = Expect<Equal<typeof hr05, Result<number, ErrB>>>

const hr06 = ok.handle(ErrA, eToOkay)
type _ht06 = Expect<Equal<typeof hr06, Result<number>>>

const hr07 = noAB.handle(ErrA, eToOkay)
type _ht07 = Expect<Equal<typeof hr07, Result<number, ErrB>>>

const hr08 = ok.handle(ErrA, eToFail)
type _ht08 = Expect<Equal<typeof hr08, Result<number, string>>>

const hr09 = noA.handle(ErrA, eToFail)
type _ht09 = Expect<Equal<typeof hr09, Result<never, string>>>

// Union error reduced and combined with new error from handler.
const hr10 = noAB.handle(ErrA, eToFail)
type _ht10 = Expect<Equal<typeof hr10, Result<never, ErrB | string>>>

const hr11 = uhAB.handle(ErrA, eToFail)
type _ht11 = Expect<Equal<typeof hr11, Result<number, ErrB | string>>>

const hr12 = noAB.handle(ErrA, eToResult)
type _ht12 = Expect<Equal<typeof hr12, Result<number, ErrB | string>>>

const hr13 = uhAB.handle(ErrA, eToResult)
type _ht13 = Expect<Equal<typeof hr13, Result<number, ErrB | string>>>

// =====================================================================================================================
// Sync — withValue / withError with fallible callbacks

const wv01 = ok.withValue(vToVoid)
type _wvt01 = Expect<Equal<typeof wv01, Result<number>>>

const wv02 = no.withValue(vToVoid)
type _wvt02 = Expect<Equal<typeof wv02, Result<never, Error>>>

const wv03 = uh.withValue(vToVoid)
type _wvt03 = Expect<Equal<typeof wv03, Result<number, Error>>>

const wv04 = ok.withValue(vToOkayVoid)
type _wvt04 = Expect<Equal<typeof wv04, Result<number>>>

const wv05 = ok.withValue(vToFailVoid)
type _wvt05 = Expect<Equal<typeof wv05, Result<number, string>>>

const wv06 = no.withValue(vToFailVoid)
type _wvt06 = Expect<Equal<typeof wv06, Result<never, Error | string>>>

const wv07 = uh.withValue(vToFailVoid)
type _wvt07 = Expect<Equal<typeof wv07, Result<number, Error | string>>>

const wv08 = ok.withValue(vToVoidOrFail)
type _wvt08 = Expect<Equal<typeof wv08, Result<number, string>>>

const wv09 = uh.withValue(vToVoidOrFail)
type _wvt09 = Expect<Equal<typeof wv09, Result<number, Error | string>>>

const we01 = ok.withError(eToVoid)
type _wet01 = Expect<Equal<typeof we01, Result<number>>>

const we02 = no.withError(eToVoid)
type _wet02 = Expect<Equal<typeof we02, Result<never, Error>>>

const we03 = uh.withError(eToVoid)
type _wet03 = Expect<Equal<typeof we03, Result<number, Error>>>

const we04 = ok.withError(eToFailVoid)
type _wet04 = Expect<Equal<typeof we04, Result<number, string>>>

const we05 = no.withError(eToFailVoid)
type _wet05 = Expect<Equal<typeof we05, Result<never, Error | string>>>

const we06 = uh.withError(eToFailVoid)
type _wet06 = Expect<Equal<typeof we06, Result<number, Error | string>>>

const we07 = uh.withError(eToVoidOrFail)
type _wet07 = Expect<Equal<typeof we07, Result<number, Error | string>>>

const wec01 = noA.withError(ErrA, eToFailVoid)
type _wect01 = Expect<Equal<typeof wec01, Result<never, ErrA | string>>>

const wec02 = noB.withError(ErrA, eToFailVoid)
type _wect02 = Expect<Equal<typeof wec02, Result<never, ErrB | string>>>

const wec03 = noAB.withError(ErrA, eToFailVoid)
type _wect03 = Expect<Equal<typeof wec03, Result<never, ErrA | ErrB | string>>>

const wec04 = uhAB.withError(ErrA, eToFailVoid)
type _wect04 = Expect<Equal<typeof wec04, Result<number, ErrA | ErrB | string>>>

// =====================================================================================================================
// Async Basic

const aok = ok.toAsync()
const ano = no.toAsync()
const auh = [].length === 1 ? aok : ano

const ar00 = aok.map(vToValue)
type _at00 = Expect<Equal<typeof ar00, AsyncResult<number>>>

const ar01 = ano.map(vToValue)
type _at01 = Expect<Equal<typeof ar01, AsyncResult<number, Error>>>

const ar02 = auh.map(vToValue)
type _at02 = Expect<Equal<typeof ar02, AsyncResult<number, Error>>>

const ar03 = aok.map(vToOkay)
type _at03 = Expect<Equal<typeof ar03, AsyncResult<number>>>

const ar04 = ano.map(vToOkay)
type _at04 = Expect<Equal<typeof ar04, AsyncResult<number, Error>>>

const ar05 = auh.map(vToOkay)
type _at05 = Expect<Equal<typeof ar05, AsyncResult<number, Error>>>

const ar06 = aok.map(vToFail)
type _at06 = Expect<Equal<typeof ar06, AsyncResult<never, string>>>

const ar07 = ano.map(vToFail)
type _at07 = Expect<Equal<typeof ar07, AsyncResult<never, Error | string>>>

const ar08 = auh.map(vToFail)
type _at08 = Expect<Equal<typeof ar08, AsyncResult<never, Error | string>>>

const ar09 = aok.map(vToResult)
type _at09 = Expect<Equal<typeof ar09, AsyncResult<number, string>>>

const ar10 = ano.map(vToResult)
type _at10 = Expect<Equal<typeof ar10, AsyncResult<number, Error | string>>>

const ar11 = auh.map(vToResult)
type _at11 = Expect<Equal<typeof ar11, AsyncResult<number, Error | string>>>

const ar12 = aok.map(vToPromisedValue)
type _at12 = Expect<Equal<typeof ar12, AsyncResult<number>>>

const ar13 = ano.map(vToPromisedValue)
type _at13 = Expect<Equal<typeof ar13, AsyncResult<number, Error>>>

const ar14 = auh.map(vToPromisedValue)
type _at14 = Expect<Equal<typeof ar14, AsyncResult<number, Error>>>

const ar15 = aok.map(vtoPromisedResult)
type _at15 = Expect<Equal<typeof ar15, AsyncResult<number>>>

const ar16 = ano.map(vtoPromisedResult)
type _at16 = Expect<Equal<typeof ar16, AsyncResult<number, Error>>>

const ar17 = auh.map(vtoPromisedResult)
type _at17 = Expect<Equal<typeof ar17, AsyncResult<number, Error>>>

const ar18 = aok.map(vtoAsyncResult)
type _at18 = Expect<Equal<typeof ar18, AsyncResult<number, string>>>

const ar19 = ano.map(vtoAsyncResult)
type _at19 = Expect<Equal<typeof ar19, AsyncResult<number, Error | string>>>

const ar20 = auh.map(vtoAsyncResult)
type _at20 = Expect<Equal<typeof ar20, AsyncResult<number, Error | string>>>

const ar21 = aok.handle(eToValue)
type _at21 = Expect<Equal<typeof ar21, AsyncResult<number>>>

const ar22 = ano.handle(eToValue)
type _at22 = Expect<Equal<typeof ar22, AsyncResult<number>>>

const ar23 = auh.handle(eToValue)
type _at23 = Expect<Equal<typeof ar23, AsyncResult<number>>>

const ar24 = aok.handle(eToOkay)
type _at24 = Expect<Equal<typeof ar24, AsyncResult<number>>>

const ar25 = ano.handle(eToOkay)
type _at25 = Expect<Equal<typeof ar25, AsyncResult<number>>>

const ar26 = auh.handle(eToOkay)
type _at26 = Expect<Equal<typeof ar26, AsyncResult<number>>>

const ar27 = aok.handle(eToFail)
type _at27 = Expect<Equal<typeof ar27, AsyncResult<number, string>>>

const ar28 = ano.handle(eToFail)
type _at28 = Expect<Equal<typeof ar28, AsyncResult<never, string>>>

const ar29 = auh.handle(eToFail)
type _at29 = Expect<Equal<typeof ar29, AsyncResult<number, string>>>

const ar30 = aok.handle(eToResult)
type _at30 = Expect<Equal<typeof ar30, AsyncResult<number, string>>>

const ar31 = ano.handle(eToResult)
type _at31 = Expect<Equal<typeof ar31, AsyncResult<number, string>>>

const ar32 = auh.handle(eToResult)
type _at32 = Expect<Equal<typeof ar32, AsyncResult<number, string>>>

const ar33 = aok.handle(eToPromisedValue)
type _at33 = Expect<Equal<typeof ar33, AsyncResult<number>>>

const ar34 = ano.handle(eToPromisedValue)
type _at34 = Expect<Equal<typeof ar34, AsyncResult<number>>>

const ar35 = auh.handle(eToPromisedValue)
type _at35 = Expect<Equal<typeof ar35, AsyncResult<number>>>

const ar36 = aok.handle(etoPromisedResult)
type _at36 = Expect<Equal<typeof ar36, AsyncResult<number, string>>>

const ar37 = ano.handle(etoPromisedResult)
type _at37 = Expect<Equal<typeof ar37, AsyncResult<number, string>>>

const ar38 = auh.handle(etoPromisedResult)
type _at38 = Expect<Equal<typeof ar38, AsyncResult<number, string>>>

const ar39 = aok.handle(etoAsyncResult)
type _at39 = Expect<Equal<typeof ar39, AsyncResult<number, string>>>

const ar40 = ano.handle(etoAsyncResult)
type _at40 = Expect<Equal<typeof ar40, AsyncResult<number, string>>>

const ar41 = auh.handle(etoAsyncResult)
type _at41 = Expect<Equal<typeof ar41, AsyncResult<number, string>>>

/// ====================================================================================================================
// Async — .handle with error constructor

const anoA = noA.toAsync()
const anoB = noB.toAsync()
const anoAB = [].length ? anoA : anoB
const auhAB = [].length === 1 ? aok : anoAB

const ahr01 = aok.handle(ErrA, eToValue)
type _aht01 = Expect<Equal<typeof ahr01, AsyncResult<number>>>

const ahr02 = anoA.handle(ErrA, eToValue)
type _aht02 = Expect<Equal<typeof ahr02, AsyncResult<number>>>

const ahr03 = anoB.handle(ErrA, eToValue)
type _aht03 = Expect<Equal<typeof ahr03, AsyncResult<number, ErrB>>>

const ahr04 = anoAB.handle(ErrA, eToValue)
type _aht04 = Expect<Equal<typeof ahr04, AsyncResult<number, ErrB>>>

const ahr05 = auhAB.handle(ErrA, eToValue)
type _aht05 = Expect<Equal<typeof ahr05, AsyncResult<number, ErrB>>>

const ahr06 = anoAB.handle(ErrA, eToOkay)
type _aht06 = Expect<Equal<typeof ahr06, AsyncResult<number, ErrB>>>

const ahr07 = anoA.handle(ErrA, eToFail)
type _aht07 = Expect<Equal<typeof ahr07, AsyncResult<never, string>>>

const ahr08 = anoAB.handle(ErrA, eToFail)
type _aht08 = Expect<Equal<typeof ahr08, AsyncResult<never, ErrB | string>>>

const ahr09 = auhAB.handle(ErrA, eToFail)
type _aht09 = Expect<Equal<typeof ahr09, AsyncResult<number, ErrB | string>>>

const ahr10 = anoAB.handle(ErrA, eToResult)
type _aht10 = Expect<Equal<typeof ahr10, AsyncResult<number, ErrB | string>>>

const ahr11 = anoAB.handle(ErrA, eToPromisedValue)
type _aht11 = Expect<Equal<typeof ahr11, AsyncResult<number, ErrB>>>

const ahr12 = anoAB.handle(ErrA, etoPromisedResult)
type _aht12 = Expect<Equal<typeof ahr12, AsyncResult<number, ErrB | string>>>

const ahr13 = anoAB.handle(ErrA, etoAsyncResult)
type _aht13 = Expect<Equal<typeof ahr13, AsyncResult<number, ErrB | string>>>

// =====================================================================================================================
// Async — withValue / withError with fallible callbacks

const awv01 = aok.withValue(vToVoid)
type _awvt01 = Expect<Equal<typeof awv01, AsyncResult<number>>>

const awv02 = ano.withValue(vToVoid)
type _awvt02 = Expect<Equal<typeof awv02, AsyncResult<never, Error>>>

const awv03 = auh.withValue(vToVoid)
type _awvt03 = Expect<Equal<typeof awv03, AsyncResult<number, Error>>>

const awv04 = aok.withValue(vToPromisedVoid)
type _awvt04 = Expect<Equal<typeof awv04, AsyncResult<number>>>

const awv05 = aok.withValue(vToFailVoid)
type _awvt05 = Expect<Equal<typeof awv05, AsyncResult<number, string>>>

const awv06 = ano.withValue(vToFailVoid)
type _awvt06 = Expect<Equal<typeof awv06, AsyncResult<never, Error | string>>>

const awv07 = auh.withValue(vToFailVoid)
type _awvt07 = Expect<Equal<typeof awv07, AsyncResult<number, Error | string>>>

const awv08 = aok.withValue(vToPromisedFailVoid)
type _awvt08 = Expect<Equal<typeof awv08, AsyncResult<number, string>>>

const awv09 = ano.withValue(vToPromisedFailVoid)
type _awvt09 = Expect<Equal<typeof awv09, AsyncResult<never, Error | string>>>

const awv10 = auh.withValue(vToPromisedFailVoid)
type _awvt10 = Expect<Equal<typeof awv10, AsyncResult<number, Error | string>>>

const awv11 = aok.withValue(vToVoidOrFail)
type _awvt11 = Expect<Equal<typeof awv11, AsyncResult<number, string>>>

const awe01 = aok.withError(eToVoid)
type _awet01 = Expect<Equal<typeof awe01, AsyncResult<number>>>

const awe02 = ano.withError(eToVoid)
type _awet02 = Expect<Equal<typeof awe02, AsyncResult<never, Error>>>

const awe03 = auh.withError(eToPromisedVoid)
type _awet03 = Expect<Equal<typeof awe03, AsyncResult<number, Error>>>

const awe04 = ano.withError(eToFailVoid)
type _awet04 = Expect<Equal<typeof awe04, AsyncResult<never, Error | string>>>

const awe05 = auh.withError(eToFailVoid)
type _awet05 = Expect<Equal<typeof awe05, AsyncResult<number, Error | string>>>

const awe06 = aok.withError(eToPromisedFailVoid)
type _awet06 = Expect<Equal<typeof awe06, AsyncResult<number, string>>>

const awe07 = ano.withError(eToPromisedFailVoid)
type _awet07 = Expect<Equal<typeof awe07, AsyncResult<never, Error | string>>>

const awe08 = auh.withError(eToPromisedFailVoid)
type _awet08 = Expect<Equal<typeof awe08, AsyncResult<number, Error | string>>>

const awe09 = auh.withError(eToVoidOrFail)
type _awet09 = Expect<Equal<typeof awe09, AsyncResult<number, Error | string>>>

const awec01 = anoA.withError(ErrA, eToFailVoid)
type _awect01 = Expect<Equal<typeof awec01, AsyncResult<never, ErrA | string>>>

const awec02 = anoB.withError(ErrA, eToFailVoid)
type _awect02 = Expect<Equal<typeof awec02, AsyncResult<never, ErrB | string>>>

const awec03 = anoAB.withError(ErrA, eToFailVoid)
type _awect03 = Expect<Equal<typeof awec03, AsyncResult<never, ErrA | ErrB | string>>>

const awec04 = auhAB.withError(ErrA, eToFailVoid)
type _awect04 = Expect<Equal<typeof awec04, AsyncResult<number, ErrA | ErrB | string>>>

const awec05 = anoAB.withError(ErrA, eToPromisedFailVoid)
type _awect05 = Expect<Equal<typeof awec05, AsyncResult<never, ErrA | ErrB | string>>>

// =====================================================================================================================
// Sync Mixed Unions

declare const mixedSync: Result<number, string> | Result<string, Error>

const mr01 = mixedSync.map((it: number | string) => [it])
type _mt01 = Expect<Equal<typeof mr01, Result<(number | string)[], string | Error>>>

const mr02 = mixedSync.map((it: number | string) => ([].length ? okay(it) : fail(new ErrA())))
type _mt02 = Expect<Equal<typeof mr02, Result<number | string, string | Error | ErrA>>>

const mr03 = mixedSync.handle((e: string | Error) => [e])
type _mt03 = Expect<Equal<typeof mr03, Result<number | string | (string | Error)[]>>>

const mr04 = mixedSync.handle((_e: string | Error) => fail("recovered"))
type _mt04 = Expect<Equal<typeof mr04, Result<number | string, string>>>

const mr05 = mixedSync.withValue((_it: number | string) => {})
type _mt05 = Expect<Equal<typeof mr05, Result<number | string, string | Error>>>

const mr06 = mixedSync.withError((_e: string | Error) => {})
type _mt06 = Expect<Equal<typeof mr06, Result<number | string, string | Error>>>

// =====================================================================================================================
// Async Mixed Unions

declare const mixedAsync: AsyncResult<number, string> | AsyncResult<string, Error>

const amr01 = mixedAsync.map((it: number | string) => [it])
type _amt01 = Expect<Equal<typeof amr01, AsyncResult<(number | string)[], string | Error>>>

const amr02 = mixedAsync.map(async (it: number | string) => [it])
type _amt02 = Expect<Equal<typeof amr02, AsyncResult<(number | string)[], string | Error>>>

const amr03 = mixedAsync.map((it: number | string) => ([].length ? okay(it) : fail(new ErrA())))
type _amt03 = Expect<Equal<typeof amr03, AsyncResult<number | string, string | Error | ErrA>>>

const amr04 = mixedAsync.handle((e: string | Error) => [e])
type _amt04 = Expect<Equal<typeof amr04, AsyncResult<number | string | (string | Error)[]>>>

const amr05 = mixedAsync.handle((_e: string | Error) => fail("recovered"))
type _amt05 = Expect<Equal<typeof amr05, AsyncResult<number | string, string>>>

const amr06 = mixedAsync.withValue((_it: number | string) => {})
type _amt06 = Expect<Equal<typeof amr06, AsyncResult<number | string, string | Error>>>

const amr07 = mixedAsync.withError((_e: string | Error) => {})
type _amt07 = Expect<Equal<typeof amr07, AsyncResult<number | string, string | Error>>>

// =====================================================================================================================
// Sync Generics

function _foo1<V, E>(r: Result<V, E>) {
    const r1 = r.map(it => [it, 42])
    type _t1 = Expect<Equal<typeof r1, Result<(V | number)[], E>>>

    const r2 = r.handle(it => [it, 42])
    type _t2 = Expect<Equal<typeof r2, Result<V | (E | number)[]>>>

    const r3 = r.map((_it: unknown) => 42)
    type _t3 = Expect<Equal<typeof r3, Result<number, E>>>

    const r4 = r.handle((_it: unknown) => 42)
    type _t4 = Expect<Equal<typeof r4, Result<V | number>>>

    const r5 = r.map(it => it)
    type _t5 = Expect<Equal<typeof r5, Result<V, E>>>

    const r6 = r.handle(it => it)
    type _t6 = Expect<Equal<typeof r6, Result<V | E>>>

    const r7 = r.map(<T>(it: T) => okay(it))
    type _t7 = Expect<Equal<typeof r7, Result<V, E>>>

    const r8 = r.handle(<T>(it: T) => okay(it))
    type _t8 = Expect<Equal<typeof r8, Result<V | E>>>
}

function _foo2<T extends Result<V, E>, V, E>(r: T) {
    // GetV<T> cannot reduce to `V` inside conditional types.
    // Fall back to TypeScript's assignability check.

    const r1 = r.map(it => [it, 42])
    const _t1: Result<(V | number)[], E> = r1

    const r2 = r.handle(it => [it, 42])
    const _t2: Result<V | (E | number)[]> = r2

    const r3 = r.map((_it: unknown) => 42)
    const _t3: Result<number, E> = r3

    const r4 = r.handle((_it: unknown) => 42)
    const _t4: Result<V | number> = r4

    const r5 = r.map(it => it)
    const _t5: Result<V, E> = r5

    const r6 = r.handle(it => it)
    const _t6: Result<V | E> = r6

    const r7 = r.map(<T>(it: T) => okay(it))
    const _t7: Result<V, E> = r7

    const r8 = r.handle(<T>(it: T) => okay(it))
    const _t8: Result<V | E> = r8
}

// =====================================================================================================================
// Async Generics

function _foo3<V, E>(r: AsyncResult<V, E>) {
    const r1 = r.map(it => [it, 42])
    type _t1 = Expect<Equal<typeof r1, AsyncResult<(V | number)[], E>>>

    const r2 = r.handle(it => [it, 42])
    type _t2 = Expect<Equal<typeof r2, AsyncResult<V | (E | number)[]>>>

    const r3 = r.map((_it: unknown) => 42)
    type _t3 = Expect<Equal<typeof r3, AsyncResult<number, E>>>

    const r4 = r.handle((_it: unknown) => 42)
    type _t4 = Expect<Equal<typeof r4, AsyncResult<V | number>>>

    const r5 = r.map(it => it)
    type _t5 = Expect<Equal<typeof r5, AsyncResult<V, E>>>

    const r6 = r.handle(it => it)
    type _t6 = Expect<Equal<typeof r6, AsyncResult<V | E>>>

    const r7 = r.map(async it => it)
    type _t7 = Expect<Equal<typeof r7, AsyncResult<V, E>>>

    const r8 = r.handle(async it => it)
    type _t8 = Expect<Equal<typeof r8, AsyncResult<V | E>>>
}

function _foo4<T extends AsyncResult<V, E>, V, E>(r: T) {
    // GetV<T> cannot reduce to `V` inside conditional types.
    // Fall back to TypeScript's assignability check.

    const r1 = r.map(it => [it, 42])
    const _t1: AsyncResult<(V | number)[], E> = r1

    const r2 = r.handle(it => [it, 42])
    const _t2: AsyncResult<V | (E | number)[]> = r2

    const r3 = r.map((_it: unknown) => 42)
    const _t3: AsyncResult<number, E> = r3

    const r4 = r.handle((_it: unknown) => 42)
    const _t4: AsyncResult<V | number> = r4

    const r5 = r.map(it => it)
    const _t5: AsyncResult<V, E> = r5

    const r6 = r.handle(it => it)
    const _t6: AsyncResult<V | E> = r6

    const r7 = r.map(async it => it)
    const _t7: AsyncResult<V, E> = r7

    const r8 = r.handle(async it => it)
    const _t8: AsyncResult<V | E> = r8
}
