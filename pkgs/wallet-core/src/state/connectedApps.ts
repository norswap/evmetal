import { ObservableMap, type Serialize } from "@norswap/utils"
import type { ChainID } from "#src/state/chains"

/** Type of app identifiers (e.g. domain names). */
export type App = string & { _tag: "App" }

/**
 * An (app identifier, last chain id) pair.
 *
 * We want to remember the last chain that an app was used so that it can be used by default the next time the app
 * is used.
 */
export type AppInfo = {
    app: App
    lastChainId: ChainID
}

/** A version of {@link AppInfo} without tagged types, suitable for serialization. */
export type AppInfoStorage = Serialize<AppInfo>

/** An observable map from app identifiers to app information. */
export const connectedApps: ObservableMap<App, AppInfo> = new ObservableMap<App, AppInfo>()

/** Connect an app, meaning it is granted permission to send requests to the wallet. */
export function connectApp(appString: string, chainId: ChainID): App {
    const app = appString as App
    connectedApps.set(app, { app, lastChainId: chainId })
    return app
}

/** Disconnect an app, revoking its permission to send requests to the wallet. */
export function disconnectApp(app: App): void {
    connectedApps.delete(app)
}

/** Load connected apps into the wallet. (internal) */
export function loadConnectedApps(apps: AppInfoStorage[]): void {
    for (const { app, lastChainId } of apps) {
        connectApp(app, lastChainId as ChainID)
    }
}

/** Wipe connected apps from the wallet. (internal) */
export function wipeConnectedApps(): void {
    for (const [app] of connectedApps) {
        disconnectApp(app)
    }
}
