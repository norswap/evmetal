import type { RawRPCResult, RawRRPCRequest, RPCMethod, RPCRequest, RPCResult } from "#src/rpc/types"
import type { AccountName } from "#src/state/accounts"
import type { ChainID } from "#src/state/chains"

/** Send a known RPC request (type-safe). */
export function sendRequest<Method extends RPCMethod>(
    _account: AccountName,
    _chainID: ChainID,
    _request: RPCRequest<Method>,
): RPCResult<Method> {
    return {} as RPCResult<Method>
}

/**
 * Sends a raw RPC request (no type checking).
 * This should only be used for exotic RPC requests that the wallet is not aware of, otherwise use {@link sendRequest}.
 */
export function sendRawRequest(_account: AccountName, _chainID: ChainID, _request: RawRRPCRequest): RawRPCResult {
    return {}
}
