import type { JSX } from "solid-js"
import { freeLayout, type SlotLayoutFree } from "#src/layouts/free"
import { type SlotLayoutStagger, staggerLayout } from "#src/layouts/stagger"

/**
 * A {@link CardSlot} layout together with its options.
 */
export type SlotLayout = SlotLayoutFree | SlotLayoutStagger

/** A card's stacking/fan geometry within its slot. */
export type CardPlacement = {
    /** Stacking index (z-order) among the visible cards; also `--gb-index` / `data-gb-index`. */
    index: number
    /** Number of visible cards it fans within; also `--gb-count`. */
    numCards: number
    /** In a `grow` slot, whether this is the single in-flow card that shrink-wraps the box. */
    isAnchor: boolean
    /** Number of extra cards below those displayed (beyond `maxDisplayed`). */
    numExtra: number
}

/** The slice of the slot's view a layout needs to size its `.gb-layout` container. */
export type LayoutView = {
    /** Number of cards displayed by the slot. */
    numVisible: number
    /** Number of extra cards below the displayed stack (beyond `maxDisplayed`). */
    numExtra: number
}

/**
 * A {@link SlotLayout} resolved into its per-kind implementation: options defaulted (so consumers read them without
 * fallbacks) and the layout's style computations bound over them. One implementation lives per kind in `src/layouts/`.
 */
export interface ResolvedLayout {
    /** Whether the slot grows to accomodate all the cards. */
    readonly grow: boolean
    /** Cap on how many cards are rendered; 0 for no cap. */
    readonly maxDisplayed: number
    /** Inline style positioning a card within the slot's `.gb-layout`, including the built-in `.gb-cue-extra` cue. */
    cardStyle(p: CardPlacement): JSX.CSSProperties
    /** Style for the `.gb-layout` container the cards live in. */
    layoutStyle(view: LayoutView): JSX.CSSProperties
}

/**
 * Normalizes the `layout` prop (a {@link SlotLayout} object or undefined) into a {@link ResolvedLayout}, defaulting to
 * `FREE` and dispatching to the kind's implementation.
 */
export function resolveLayout(layout: SlotLayout | undefined): ResolvedLayout {
    const l = layout ?? { kind: "FREE" }
    return l.kind === "FREE" ? freeLayout(l) : staggerLayout(l)
}
