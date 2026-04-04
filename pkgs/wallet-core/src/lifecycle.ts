import {
    type AccountName,
    type AccountsStorage,
    currentAccountName,
    loadAccounts,
    wipeAccounts,
} from "#src/state/accounts"
import { type ChainID, type ChainStorage, currentChainID, loadChains, wipeChains } from "#src/state/chains"
import { type AppInfoStorage, loadConnectedApps, wipeConnectedApps } from "#src/state/connectedApps"

// Lifecycle functions to be called by the frontend.

/** Wallet storage managed by the wallet frontend. */
export type WalletStorage = {
    accounts: AccountsStorage
    chains: ChainStorage[]
    connectedApps: AppInfoStorage[]
    currentAccountName?: AccountName
    currentChainID?: ChainID
}

/**
 * Call to load the wallet with the data managed by the frontend.
 * Secrets (seed phrases and private keys will be clear in memory until {@link unload} is called.
 */
export function load(storage: WalletStorage): void {
    loadAccounts(storage.accounts)
    loadChains(storage.chains)
    loadConnectedApps(storage.connectedApps)
    currentAccountName.set(storage.currentAccountName)
    currentChainID.set(storage.currentChainID)
}

/**
 * Call to unload the wallet.
 * Secrets will be unloaded from memory.
 * e.g. call this when locking down the wallet if it uses a password
 */
export function unload(): void {
    wipeAccounts()
    wipeChains()
    wipeConnectedApps()
    currentAccountName.set(undefined)
    currentChainID.set(undefined)
}
