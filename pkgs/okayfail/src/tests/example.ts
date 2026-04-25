// noinspection SuspiciousTypeOfGuard — WebStorm can't handle NoInfer

import type { AsyncResult } from "#src/asyncResult"
import { fresult } from "#src/fresult"
import { okay, type Result } from "#src/result"

// ================================================================================================

// Very contrived example but shows the API possibilities.

// ================================================================================================
// DUMMY DEFINITIONS

type Purchase = { value: number }
type User = { purchases: Purchase[] }
type TotalSpendOutput = {
    userExists: boolean
    totalSpend: number
    written: boolean
}

// Errors need branding to be distinct types.

class UnknownUser extends Error {
    readonly kind = "UnknownUser"
}
class FetchError extends Error {
    readonly kind = "FetchError"
    constructor(readonly url: string) {
        super()
    }
}
class DBError extends Error {
    readonly kind = "DBError"
    constructor(readonly table: string) {
        super()
    }
}

function getUser(_id: number): Result<User, UnknownUser> {
    return okay({ purchases: [{ value: 1 }, { value: 2 }] })
}

function getUserPurchases(user: User): Result<Purchase[], FetchError> {
    return okay(user.purchases)
}

function networkAvailable(): boolean {
    return true
}

function writeTotalToDB(_id: number, _total: number): AsyncResult<true, DBError> {
    return okay(true as const).toAsync()
}

async function enqueueTotalDBUpdate(_id: number, _total: number) {}

const userId = 42

// ================================================================================================
// EXAMPLE USAGE WITH GENERATORS (RECOMMENDED)

const getAndUpdateTotalSpend: (id: number) => AsyncResult<TotalSpendOutput, FetchError | DBError> = fresult(
    async function* (id) {
        const user = getUser(id)
            .withError(e => console.log(`${e} (user id: ${id})`))
            .maybe()

        if (!user) return { totalSpend: 0, written: false, userExists: false }

        const purchases = yield* getUserPurchases(user).handle(_e => getUserPurchases(user)) // retry once
        const totalSpend = purchases.reduce((total, p) => total + p.value, 0)
        console.log(`User ${id} spent ${totalSpend}$`)

        if (!networkAvailable()) {
            void enqueueTotalDBUpdate(id, totalSpend)
            console.log(`Network unavailable, enqueuing for later.`)
            return { totalSpend, written: false, userExists: true }
        } else {
            yield* writeTotalToDB(id, totalSpend)
            return { totalSpend, written: true, userExists: true }
        }
    },
)

const totalSpendResult = await getAndUpdateTotalSpend(userId)

totalSpendResult
    .withValue(({ userExists, written, totalSpend }) => {
        const success = written ? "successful" : "deferred"
        if (userExists) console.log(`user ${userId} total spend updated to ${totalSpend} ${success}`)
    })
    .handle(DBError, e => {
        console.log(`user ${userId} total spend update failed: couldn't write to DB (table: ${e.table})`)
    })
    .handle((e: FetchError) => {
        console.log(`user ${userId} total spend update failed: couldn't fetch purchases from ${e.url}`)
    })

// ================================================================================================
// EXAMPLE USAGE WITHOUT GENERATORS

function _getAndUpdateTotalSpend(id: number): AsyncResult<TotalSpendOutput, DBError | FetchError> {
    return getUser(id)
        .withValue(user => console.log(`Read user: ${JSON.stringify(user)}`))
        .withError(err => console.log(`[Error] while getting user: ${err}`))
        .map(user => {
            const purchases = getUserPurchases(user).handle(_e => getUserPurchases(user)) // retry once
            return purchases.map(purchases => ({ user, purchases }))
        })
        .map(ctx => ({ ...ctx, total: ctx.purchases.reduce((total, p) => total + p.value, 0) }))
        .withValue(({ total }) => console.log(`User ${id} spent ${total}$`))
        .toAsync()
        .map(async ctx => {
            if (!networkAvailable()) {
                void enqueueTotalDBUpdate(id, ctx.total)
                console.log(`Network unavailable, enqueuing for later.`)
                return okay({ ...ctx, written: false })
            }
            return (await writeTotalToDB(id, ctx.total)) //
                .map(() => ({ ...ctx, written: true }))
        })
        .map(({ total, written }) => ({ userExists: true, totalSpend: total, written }))
        .handle(UnknownUser, _ => ({ userExists: false, totalSpend: 0, written: false }))
}
