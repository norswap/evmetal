import type { JSX } from "solid-js"
import type { CardPlacement, LayoutView, ResolvedLayout } from "#src/layout"

/** A layout that staggers cards towards the named corner. */
export type SlotLayoutStagger = {
    kind: "STAGGER_TL" | "STAGGER_TR" | "STAGGER_BL" | "STAGGER_BR"
    /** Whether to grow the slot size to accomodate all the cards. You can combine with min-{width, height}
     * on `.gb-slot`. */
    grow?: boolean
    /** Per-card x-offset as a CSS unit (default `"14px"`). */
    staggerX?: string
    /** Per-card y-offset as a CSS unit (default `"14px"`). */
    staggerY?: string
    /** Whether to center or anchor to the named corner (default: false). */
    centered?: boolean
    /** Caps how many cards are rendered. When cards become extra, the bottom-most displayed card gets the
     * `.gb-cue-extra` class and a `--gb-extra` count for styling (see {@link CardSlot}). Omit or 0 for no cap. */
    maxDisplayed?: number
    /** Options for the built-in overflow cue for the extra cards beyond `maxDisplayed`, drawn by default (see
     * {@link CueExtra}). Pass `false` to draw no built-in cue — the `.gb-cue-extra` class and `--gb-extra` count are
     * still exposed so you can style it yourself. */
    cueExtra?: CueExtra | false
}

/**
 * Options for the built-in `.gb-cue-extra` overflow cue: a stagger of drop shadows peeking out from under the
 * bottom-most displayed card to suggest the extra cards beyond `maxDisplayed`. `min(numExtra, maxCount)` shadows are
 * drawn, stepping diagonally toward the slot interior (the stagger direction); the one nearest the card is lightest and
 * each deeper layer is `lightenStep` less lightened toward white, reaching the solid `color` only once the stack is
 * full.
 */
export type CueExtra = {
    /** Deepest (most saturated) shadow color; shallower layers are lightened toward white. Default `"#8f8f8f"`. */
    color?: string
    /** Maximum number of shadow layers drawn. Default `3`. */
    maxCount?: number
    /** Fraction in `[0, 1]` lightened toward white per layer step. Default `0.3`. */
    lightenStep?: number
    /** Per-layer x-offset magnitude as a CSS unit; direction follows the corner. Default `"5px"`. */
    offsetX?: string
    /** Per-layer y-offset magnitude as a CSS unit; direction follows the corner. Default `"5px"`. */
    offsetY?: string
    /** Corner rounding applied to the card wrapper while the cue shows, so the shadows match a rounded card face.
     * Default `"0"`. */
    borderRadius?: string
}

/**
 * `STAGGER_<corner>` anchors the top card in the named corner and offsets lower cards towards the opposite corner by
 * multiples of the stagger offsets; `z-index = index`, so the top (last) card is front-most.
 *
 * When `centered`, the stack's cards (including the shadows cue for extra cards) are centered in the slot; otherwise
 * the top card is anchored flush in the named corner.
 *
 * With `grow`, the `.gb-layout` container fits its content by sizing on the one "in-flow" card — the top card
 * (`position: relative`; all other cards stay absolute and thus out of flow) — and adding padding to accomodate the
 * staggered cards (and potentially the shadows that cue that there are extra cards not rendered). Without `grow`, the
 * container is only `{ position: relative }`: the slot's size then comes entirely from consumer CSS (and
 * absolutely-positioned cards will overflow a fixed box).
 */
export function staggerLayout(l: SlotLayoutStagger): ResolvedLayout {
    const { kind } = l
    const grow = l.grow ?? false
    const staggerX = l.staggerX ?? "14px"
    const staggerY = l.staggerY ?? "14px"
    const centered = l.centered ?? false
    const cueExtra =
        l.cueExtra === false
            ? undefined
            : {
                  color: l.cueExtra?.color ?? "#8f8f8f",
                  maxCount: l.cueExtra?.maxCount ?? 3,
                  lightenStep: l.cueExtra?.lightenStep ?? 0.3,
                  offsetX: l.cueExtra?.offsetX ?? "5px",
                  offsetY: l.cueExtra?.offsetY ?? "5px",
                  borderRadius: l.cueExtra?.borderRadius ?? "0",
              }

    // Direction multipliers pointing from the anchored corner towards the slot interior.
    const dirX = kind === "STAGGER_TR" || kind === "STAGGER_BR" ? -1 : 1
    const dirY = kind === "STAGGER_BL" || kind === "STAGGER_BR" ? -1 : 1

    /** Number of shadow layers the cue draws for `numExtra` extra cards. */
    const numShadows = (numExtra: number): number =>
        cueExtra === undefined ? 0 : Math.min(numExtra, cueExtra.maxCount)

    /**
     * The `.gb-cue-extra` cue's styles when it must signal `numExtra` cards (otherwise `{}`): the layered `box-shadow`
     * offset diagonally towards the opposite corner so the deck edge peeks on 2 sides (the layer nearest the card is
     * lightest, each deeper layer `lightenStep` less lightened toward white via `color-mix`, reaching the solid
     * {@link CueExtra#color} only on a full stack), plus the cue's corner rounding.
     */
    const cueExtraStyle = (numExtra: number): JSX.CSSProperties => {
        if (numExtra <= 0 || cueExtra === undefined) return {}
        const { color, maxCount, lightenStep, offsetX, offsetY } = cueExtra
        const layers: string[] = []
        for (let i = 1; i <= numShadows(numExtra); i++) {
            const c = `color-mix(in srgb, ${color}, white ${(maxCount - i) * lightenStep * 100}%)`
            layers.push(`calc(${dirX} * ${offsetX} * ${i}) calc(${dirY} * ${offsetY} * ${i}) 0 0 ${c}`)
        }
        return { "box-shadow": layers.join(", "), "border-radius": cueExtra.borderRadius }
    }

    /**
     * A card's placement and stacking within the slot (cf. {@link staggerLayout}'s docs). With `grow`, the anchor
     * card's staggered position is reproduced with a transform so its flow box is not perturbed.
     */
    const cardStyle = (p: CardPlacement): JSX.CSSProperties => {
        const { index, numCards, isAnchor, numExtra } = p
        const steps = numCards - 1 - index
        const base = { position: "absolute" as const, "z-index": index }
        const cue = index === 0 ? cueExtraStyle(numExtra) : {}

        if (centered) {
            const n = numShadows(numExtra)
            const biasX = n > 0 && cueExtra !== undefined ? ` - ${cueExtra.offsetX} * ${n} / 2` : ""
            const biasY = n > 0 && cueExtra !== undefined ? ` - ${cueExtra.offsetY} * ${n} / 2` : ""
            const ox = `calc(${dirX} * (${staggerX} * (${steps} - (${numCards} - 1) / 2)${biasX}))`
            const oy = `calc(${dirY} * (${staggerY} * (${steps} - (${numCards} - 1) / 2)${biasY}))`
            if (isAnchor)
                return { position: "relative", transform: `translate(${ox}, ${oy})`, "z-index": index, ...cue }
            return {
                ...base,
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) translate(${ox}, ${oy})`,
                ...cue,
            }
        }

        if (isAnchor) return { position: "relative", "z-index": index, ...cue }

        const dx = `calc(${staggerX} * ${steps})`
        const dy = `calc(${staggerY} * ${steps})`
        switch (kind) {
            case "STAGGER_TL":
                return { ...base, top: 0, left: 0, transform: `translate(${dx}, ${dy})`, ...cue }
            case "STAGGER_TR":
                return { ...base, top: 0, right: 0, transform: `translate(calc(-1 * ${dx}), ${dy})`, ...cue }
            case "STAGGER_BL":
                return { ...base, bottom: 0, left: 0, transform: `translate(${dx}, calc(-1 * ${dy}))`, ...cue }
            case "STAGGER_BR":
                return {
                    ...base,
                    bottom: 0,
                    right: 0,
                    transform: `translate(calc(-1 * ${dx}), calc(-1 * ${dy}))`,
                    ...cue,
                }
        }
    }

    /**
     * Style for the `.gb-layout` container (cf. {@link staggerLayout}'s docs). With `grow` and `centered`, the
     * padding is what visually centers the stack in the container; otherwise the stack anchors to its corner (e.g.
     * `STAGGER_TL` to the top left).
     */
    const layoutStyle = (view: LayoutView): JSX.CSSProperties => {
        if (!grow) return { position: "relative" }

        const base = { position: "relative", width: "fit-content", height: "fit-content" } as const
        if (view.numVisible <= 1) return base

        const spreadX = `calc(${staggerX} * (${view.numVisible} - 1))`
        const spreadY = `calc(${staggerY} * (${view.numVisible} - 1))`

        if (centered) {
            const n = numShadows(view.numExtra)
            const shadowX = n > 0 && cueExtra !== undefined ? `${cueExtra.offsetX} * ${n}` : "0"
            const shadowY = n > 0 && cueExtra !== undefined ? `${cueExtra.offsetY} * ${n}` : "0"
            const halfX = `calc((${spreadX} + ${shadowX}) / 2)`
            const halfY = `calc((${spreadY} + ${shadowY}) / 2)`
            return {
                ...base,
                "padding-left": halfX,
                "padding-right": halfX,
                "padding-top": halfY,
                "padding-bottom": halfY,
            }
        }

        switch (kind) {
            case "STAGGER_TL":
                return { ...base, "padding-right": spreadX, "padding-bottom": spreadY }
            case "STAGGER_TR":
                return { ...base, "padding-left": spreadX, "padding-bottom": spreadY }
            case "STAGGER_BL":
                return { ...base, "padding-right": spreadX, "padding-top": spreadY }
            case "STAGGER_BR":
                return { ...base, "padding-left": spreadX, "padding-top": spreadY }
        }
    }

    return { grow, maxDisplayed: l.maxDisplayed ?? 0, cardStyle, layoutStyle }
}
