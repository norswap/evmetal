export type { WalletStorage } from "#src/lifecycle"
export { load, unload } from "#src/lifecycle"

export { sendRawRequest, sendRequest } from "#src/rpc/requests"

export type {
    AccountInfo,
    AccountName,
    AccountsStorage,
    Address,
    PrivateKey,
    SeedPhrase,
    SeedPhraseInfo,
    SeedPhraseName,
} from "#src/state/accounts"
export {
    accounts,
    currentAccountName,
    generateSeedPhrase,
    getAccount,
    getCurrentAccount,
    getSeedPhrase,
    seedPhrases,
} from "#src/state/accounts"

export type { Chain, ChainID, ChainName, RpcURL } from "#src/state/chains"
export { chains, currentChainID } from "#src/state/chains"

export type { App } from "#src/state/connectedApps"
export { connectApp, disconnectApp } from "#src/state/connectedApps"

export type { HttpURL } from "#src/utils/types"
