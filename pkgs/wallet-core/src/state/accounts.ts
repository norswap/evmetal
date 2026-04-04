import { Observable, ObservableArray } from "@norswap/utils"
import { english, generateMnemonic, mnemonicToAccount } from "viem/accounts"

// This file manages the memory storage for seed phrases.
// This is initialized by wallet frontends via the functions in `lifecycle.ts`.
// The frontends must handle the long-term persistence & encryption.

/** Tagged type of EVM addresses. */
export type Address = `0x${string}` & { _tag: "Address" }

/** Tagged type of seed phrase mnemonics. */
export type SeedPhrase = string & { _tag: "SeedPhrase" }

/** Tagged type of unique seed phrase names. */
export type SeedPhraseName = string & { _tag: "SeedPhraseName" }

/**
 * Tagged type of unique account names. An account is something with an address that can "send transactions".
 * At the moment only EOAs are supported.
 */
export type AccountName = string & { _tag: "AccountName" }

/** Tagged type of EVM private keys. */
export type PrivateKey = `0x${string}` & { _tag: "PrivateKey" }

/** Account information (cf. {@link AccountName} */
export type AccountInfo = {
    name: AccountName
    type: "eoa"
    seedPhraseName: SeedPhraseName
    derivationIndex: number
    privateKey: PrivateKey
    address: Address
}

/** A (seed phrase name, seed phrase) pair. */
export type SeedPhraseInfo = {
    name: SeedPhraseName
    seedPhrase: SeedPhrase
}

/**
 * The information that wallet frontend need to store to persist accounts and to supply on wallet load.
 * This purposefully does not use tagged type to allow for easy (de)serialization.
 */
export type AccountsStorage = {
    seedPhrases: { name: string; seedPhrase: string }[]
    eoas: { name: string; seedPhraseName: string; derivationIndex: number }[]
}

type HDPath = `m/44'/60'/${string}`

/**
 * An observable array with all the seed phrases loaded in the wallet.
 * Use {@link getSeedPhrase} to retrieve the seed phrase for a given seed phrase name.
 */
export const seedPhrases: ObservableArray<SeedPhraseInfo> = new ObservableArray<SeedPhraseInfo>()

/**
 * An observable array with all the accounts loaded in the wallet.
 * Use {@link getAccount} to retrieve the account for a given account name.
 */
export const accounts: ObservableArray<AccountInfo> = new ObservableArray<AccountInfo>()

/**
 * An observable holding the name of the account the wallet frontend is focused on.
 * Use {@link getCurrentAccount} to get the corresponding account info.
 *
 * This is offered as a convenience, and *only* used as a default value whenever an optional account parameter is
 * ommitted, so wallet frontends can ignore this if deemed appropriate.
 */
export const currentAccountName: Observable<AccountName | undefined> = new Observable<AccountName | undefined>(
    undefined,
)

/** Generate a new random seed phrase mnemonic. */
export function generateSeedPhrase(): SeedPhrase {
    return generateMnemonic(english) as SeedPhrase
}

/** Retrieve the loaded seed phrase with the given name. */
export function getSeedPhrase(seedPhraseName: SeedPhraseName): SeedPhrase | undefined {
    for (const { name, seedPhrase } of seedPhrases) {
        if (seedPhraseName === name) return seedPhrase
    }
    return undefined
}

/** Retrieve the loaded account with the given name. */
export function getAccount(acountName: AccountName): AccountInfo | undefined {
    for (const account of accounts) {
        if (account.name === acountName) return account
    }
    return undefined
}

/** Returns the information for the current account (cf. {@link currentAccountName}) */
export function getCurrentAccount(): AccountInfo {
    const accountName = currentAccountName.get()
    if (!accountName) throw new Error("Current account not set")
    const accountInfo = getAccount(accountName)
    if (!accountInfo) throw new Error("Current account does not exist")
    return accountInfo
}

function getHDPath(index: number): string {
    return `m/44'/60'/0'/0/${index}`
}

/** Load seed phrases & accounts into the wallet. (internal) */
export function loadAccounts(storage: AccountsStorage): void {
    for (const { name, seedPhrase } of storage.seedPhrases) {
        seedPhrases.push({ name: name as SeedPhraseName, seedPhrase: seedPhrase as SeedPhrase })
    }

    for (const { name, seedPhraseName, derivationIndex } of storage.eoas) {
        const seedPhrase = getSeedPhrase(seedPhraseName as SeedPhraseName)
        if (!seedPhrase) throw new Error(`SeedPhrase "${name}" not found`)
        const hdKey = mnemonicToAccount(seedPhrase, { path: getHDPath(derivationIndex) as HDPath }).getHdKey()
        accounts.push({
            name: name as AccountName,
            type: "eoa",
            seedPhraseName: seedPhraseName as SeedPhraseName,
            derivationIndex: derivationIndex,
            privateKey: `0x${hdKey.privateKey!.toHex()}` as PrivateKey,
            address: `0x${hdKey.publicKey!.toHex()}` as Address,
        })
    }
}

/** Wipe seed phrases and accounts from the wallet. (internal) */
export function wipeAccounts(): void {
    while (seedPhrases.length() > 0) seedPhrases.pop()
    while (accounts.length() > 0) accounts.pop()
}
