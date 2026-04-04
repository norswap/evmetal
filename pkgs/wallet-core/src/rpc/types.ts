import type { PublicRpcSchema, WalletRpcSchema } from "viem"

/**
 * A RPC schema is an array of RPC method specifications (method, parameters and return type).
 * This is a copy of Viem's `RpcSchema type.
 */
export type RPCSchema = readonly {
    Method: string
    Parameters?: unknown | undefined
    ReturnType: unknown
}[]

/** RPC schema for EVMetal wallet's specific RPC methods. */
export type EVMetalRPCRequestSchema = []

/** RPC requests schemas conforming to Viem's `RpcSchema` type. */
export type RPCRequestSchema = [...EVMetalRPCRequestSchema, ...PublicRpcSchema, ...WalletRpcSchema]

/** Union type of all RPC requests method names. */
export type RPCMethod = RPCRequestSchema[number]["Method"]

/**
 * Union type of all RPC requests whose method name match the type parameter (all of them by default).
 */
export type RPCRequest<Method extends RPCMethod = RPCMethod> = {
    method: Method
    params: Extract<RPCRequestSchema[number], { Method: Method }>["Parameters"]
}

/**
 * Union type of results of all RPC request whose method name match the type parameter (all of them by default).
 */
export type RPCResult<Method extends RPCMethod = RPCMethod> = Extract<
    RPCRequestSchema[number],
    { Method: Method }
>["ReturnType"]

/** Vague type for unknown RPC requests (not typed in a schema). */
export type RawRRPCRequest = RPCSchema[number]

/** Vague type for unknown RPC requests' results (not typed in a schema). */
export type RawRPCResult = Record<string, unknown>
