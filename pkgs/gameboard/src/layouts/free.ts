import type { JSX } from "solid-js"
import type { ResolvedLayout } from "#src/layout"

/** A layout that applies no positioning, leaving card placement to consumer CSS (see {@link CardSlot}). */
export type SlotLayoutFree = {
    kind: "FREE"
    /** Caps how many cards are rendered. When cards become extra, the bottom-most displayed card gets the
     * `.gb-cue-extra` class and a `--gb-extra` count for styling (see {@link CardSlot}). Omit or 0 for no cap. */
    maxDisplayed?: number
}

/**
 * `FREE` applies no positioning at all: users provide their own by styling `.gb-card` and `.gb-layout` (e.g. as a
 * flex or grid container). That includes no z-index, but the user can set one manually via
 * `.gb-card { z-index: var(--gb-index); }`.
 */
export function freeLayout(l: SlotLayoutFree): ResolvedLayout {
    return {
        grow: false,
        maxDisplayed: l.maxDisplayed ?? 0,
        cardStyle: (): JSX.CSSProperties => ({}),
        layoutStyle: (): JSX.CSSProperties => ({}),
    }
}
