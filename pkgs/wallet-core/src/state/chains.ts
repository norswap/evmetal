import { Observable, ObservableMap, type Serialize, uniques } from "@norswap/utils"
import type { Chain as ViemChain } from "viem"
import type { HttpURL, WebsocketURL } from "#src/utils/types"

export type ChainName = string & { _tag: "ChainName" }
export type ChainID = number & { _tag: "ChainID" }
export type RpcURL = (HttpURL | WebsocketURL) & { _tag: "RpcURL" }

export type Chain = {
    name: ChainName
    id: ChainID
    rpcURLs: RpcURL[] // use an array for future-proofness but we will only use one at first
    // When we support multiple RPCs, we should name them.
    isTestnet?: boolean
    blockTime?: number
    explorer?: HttpURL
    gasToken?: {
        name: string // Ether by default
        ticker: string // ETH by default
        decimals?: number // 18 by default
    }

    // In the future, support preconfs (e.g. flashblocks)

    // In the future, add addresses of well-known contracts if needed:
    // - multicall
    // - ENS registry
    // - smart account implementation
}

/** A version of {@link Chain} without tagged types, suitable for serialization. */
export type ChainStorage = Serialize<Chain>

function _fromViemChain(chain: ViemChain): Chain {
    const rpcEntries = Object.entries(chain.rpcUrls).map(([_name, entry]) => entry)
    rpcEntries.unshift(chain.rpcUrls.default)
    const rpcURLs = uniques(rpcEntries) // remove duplicate default entry
        .flatMap(entry => [...entry.http, ...(entry.webSocket || [])]) as RpcURL[]

    return {
        name: chain.name as ChainName,
        id: chain.id as ChainID,
        explorer: chain.blockExplorers?.default.url as HttpURL | undefined,
        blockTime: chain.blockTime,
        gasToken: {
            name: chain.nativeCurrency.name,
            ticker: chain.nativeCurrency.symbol,
            decimals: chain.nativeCurrency.decimals,
        },
        rpcURLs,
        isTestnet: chain.testnet,
    }
}

function _toViemChain(chain: Chain): ViemChain {
    const first = chain.rpcURLs[0]
    const firstHttp = chain.rpcURLs.find(url => url.startsWith("http")) || "no HTTP JSON RPC available"
    const rpcUrls = Object.fromEntries(
        chain.rpcURLs.map(rpcURL => {
            const urls = rpcURL.startsWith("http") ? { http: [rpcURL] } : { http: [firstHttp], ws: [rpcURL] }
            return rpcURL === first ? ["default", urls] : [rpcURL, urls]
        }),
    ) as unknown as ViemChain["rpcUrls"] // safe, TS can't infer that `default` is always present

    return {
        name: chain.name,
        id: chain.id,
        blockExplorers: chain.explorer && {
            default: {
                name: "explorer",
                url: chain.explorer,
            },
        },
        blockTime: chain.blockTime,
        nativeCurrency: {
            name: chain.gasToken?.name ?? "Ether",
            symbol: chain.gasToken?.ticker ?? "ETH",
            decimals: chain.gasToken?.decimals ?? 18,
        },
        rpcUrls,
        testnet: chain.isTestnet,
    }
}

/** Mapping of chain ID to chain information currently registered in the wallet. */
export const chains: ObservableMap<ChainID, Chain> = new ObservableMap<ChainID, Chain>()

/**
 * An observable holding the ID of the chain the wallet frontend is focused on.
 *
 * This is offered as a convenience, and *only* used as a default value whenever an optional chain parameter is
 * ommitted, so wallet frontends can ignore this if deemed appropriate.
 */
export const currentChainID: Observable<ChainID | undefined> = new Observable<ChainID | undefined>(undefined)

/** Add a new chain or edit an existing chain. */
export function addChain(chain: Chain): Chain {
    chains.set(chain.id, chain)
    return chain
}

/** Load chains into the wallet. (internal) */
export function loadChains(chains: ChainStorage[]): void {
    for (const chain of chains) addChain(chain as Chain)
}

/** Wipe chains from the wallet. (internal) */
export function wipeChains(): void {
    for (const [chainId] of chains) chains.delete(chainId)
}
