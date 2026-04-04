/** Type of URLs starting with http:// or https:// */
export type HttpURL = `http://${string}` | `https://${string}`

/** Type of URLs starting with ws:// */
export type WebsocketURL = `ws://${string}`
