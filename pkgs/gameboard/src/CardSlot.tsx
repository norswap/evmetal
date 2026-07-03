import { useDraggable, useDragOperation, useDroppable } from "@dnd-kit/solid"
import { createMemo, For, type JSX } from "solid-js"
import { type SlotLayout, type SlotLayoutKind, useGameBoard } from "./GameBoardContext"

export interface CardSlotProps {
    /** Unique slot id within the board; a memorable one is minted if omitted. */
    id?: string
    /** How the slot's cards are positioned, with its layout-specific options (default `{ kind: "STACKED" }`). A bare
     * {@link SlotLayoutKind} string is accepted as shorthand for the optionless `{ kind }`. */
    layout?: SlotLayoutKind | SlotLayout
    /** Whether to grow the slot size to accomodate all the cards (works with every layout).
     * You can combine with min-{width, height} on `.gb-slot`. */
    grow?: boolean
    /** Which cards can be dragged out: `true` = all, `false` = none, `"top"` = only the top card (default `true`). */
    isDrag?: boolean | "top"
    /** Further restricts draggability: given a card id, returns whether it may be dragged (applied after `isDrag`). */
    canDrag?: (cardId: string) => boolean
    /** Whether cards can be dropped here; `"top"` aliases `true` for now (default `true`). */
    isDrop?: boolean | "top"
    /** Further restricts dropping: given the dragged card id and the slot's top card id (`null` if empty), returns if
     * it may be dropped (applied after `isDrop`). */
    canDrop?: (src: string, dst: string | null) => boolean
}

/**
 * A named drag source & drop target. The cards it contains are read from {@link GameBoardController.slotContent} and
 * laid out per its `layout`. It renders `highlight-ok` / `highlight-no` while a valid / invalid card hovers over it.
 *
 * ## Styling
 *
 * The component applies the following classes you can access for styling:
 * - `.gb-slot` — the slot box and drop target. Note that this has height 0 by default if it contains no cards, so
 *   height needs to be set for cards to be droppable inside. If you specify `grow: true`, use `min-{width,height}`
 *   instead.
 * - `.gb-slot.highlight-ok` / `.gb-slot.highlight-no` — these classes are attached to denote a card is hovering the
 *   slot and the slot rules mark this is a valid/invalid drop.
 * - `.gb-layout` — the single container the cards live under. Separate from `.gb-slot` for layouting purposes.
 *   You do not need to touch this unless you are using the `"FREE"` layout, in which case it can for instance be used
 *   as flex or grid container.
 * - `.gb-card` — per-card wrapper. With `"FREE"` you can apply flex/grid items styles here.
 *   It carries `data-card-id` / `data-index` attributes (can be used for CSS selection) and `--gb-index` / `--gb-count`
 *   custom CSS properties (unitless integers, for `calc()`-driven placement).
 *   Note: the drag overlay (copy of the card that gets dragged around) is NOT a `.gb-card` (it's its content, whatever
 *   users pass to {@link GameBoardController#spawn}).
 * - `.gb-more` — added to the bottom-most displayed `.gb-card` only when `maxDisplayed` hides deeper cards in some
 *   layouts. Use it to style to signal the stack runs deeper. It carries a `--gb-hidden` custom property with the
 *   number of hidden cards.
 */
export function CardSlot(props: CardSlotProps): JSX.Element {
    const board = useGameBoard()
    const layout = createMemo(() => resolveLayout(props.layout))
    const slotId = board.registerSlot(props.id, {
        isDrop: () => props.isDrop ?? true,
        canDrop: () => props.canDrop,
    })
    const droppable = useDroppable({ id: slotId })
    const op = useDragOperation()

    // The top `maxDisplayed` cards actually rendered, plus how many deeper ones are dropped from the DOM.
    const displayed = createMemo((): { cards: string[], hidden: number } => {
        const cards = board.slotContent[slotId]
        const l = layout()
        const max = "maxDisplayed" in l ? l.maxDisplayed : 0
        if (max <= 0 || cards.length <= max) return { cards, hidden: 0 }
        return { cards: cards.slice(cards.length - max), hidden: cards.length - max }
    })

    // "none" unless a card from another slot is hovering here; then "ok"/"no" per the controller's drop predicate.
    const dropValidity = (): "none" | "ok" | "no" => {
        const cardId = op.source()?.id as string
        if (op.target()?.id !== slotId) return "none"
        if (board.slotContent[slotId].includes(cardId)) return "none"
        return board.canDrop(cardId, slotId) ? "ok" : "no"
    }

    return (
        <div
            class="gb-slot"
            classList={{ "highlight-ok": dropValidity() === "ok", "highlight-no": dropValidity() === "no" }}
            ref={el => droppable.ref(el)}
        >
            <div class="gb-layout" style={layoutStyle(props.grow ?? false, layout(), displayed().cards.length)}>
                <For each={displayed().cards}>
                    {(cardId, index) => (
                        <Card
                            cardId={cardId}
                            layout={layout()}
                            index={index()}
                            total={displayed().cards.length}
                            isTop={cardId === board.topCardOf(slotId)}
                            grow={props.grow ?? false}
                            isDrag={props.isDrag ?? true}
                            canDrag={props.canDrag}
                            hidden={index() === 0 ? displayed().hidden : 0}
                        >
                            {board.renderCard(cardId)}
                        </Card>
                    )}
                </For>
            </div>
        </div>
    )
}

/**
 * Wraps a card's component, positioning it per the slot layout, making it draggable (subject to `isDrag` /
 * `canDrag`), and hiding it while a drag is in flight (a drag overlay shows the moving render instead).
 */
function Card(props: {
    cardId: string
    layout: ResolvedLayout
    index: number
    total: number
    isTop: boolean
    grow: boolean
    isDrag: boolean | "top"
    canDrag?: (cardId: string) => boolean
    hidden: number
    children?: JSX.Element
}): JSX.Element {
    const draggable = useDraggable({
        id: props.cardId,
        get disabled() {
            const dragOk = props.isDrag === true || (props.isDrag === "top" && props.isTop)
            if (!dragOk) return true
            return props.canDrag ? !props.canDrag(props.cardId) : false
        },
    })
    return (
        <div
            class="gb-card"
            classList={{ "gb-more": props.hidden > 0 }}
            data-card-id={props.cardId}
            data-index={props.index}
            style={{
                ...cardStyle(props.layout, props.index, props.total, props.grow),
                "--gb-index": props.index,
                "--gb-count": props.total,
                "--gb-hidden": props.hidden,
                visibility: draggable.isDragging() || draggable.isDropping() ? "hidden" : "visible",
            }}
            ref={el => draggable.ref(el)}
        >
            {props.children}
        </div>
    )
}

/** A {@link SlotLayout} with the `STAGGER_*` options defaulted, so consumers can read them without fallbacks. */
type ResolvedLayout = RequiredMembers<SlotLayout>

// Needed to distribute over the SlotLayout union.
type RequiredMembers<T> = T extends unknown ? Required<T> : never

/**
 * Normalizes the `layout` prop (a bare {@link SlotLayoutKind} string, a {@link SlotLayout} object, or undefined) into a
 * {@link ResolvedLayout}, defaulting to `STACKED` and filling in the per-kind options.
 */
function resolveLayout(layout: SlotLayoutKind | SlotLayout | undefined): ResolvedLayout {
    const l: SlotLayout =
        typeof layout === "string" ? ({ kind: layout } as SlotLayout) : (layout ?? { kind: "STACKED" })
    if (l.kind === "STACKED") return { kind: l.kind }
    if (l.kind === "FREE") return { kind: l.kind, maxDisplayed: l.maxDisplayed ?? 0 }
    return {
        kind: l.kind,
        staggerX: l.staggerX ?? "14px",
        staggerY: l.staggerY ?? "14px",
        centered: l.centered ?? false,
        maxDisplayed: l.maxDisplayed ?? 0,
    }
}

/**
 * Computes a card's placement and stacking within its slot depending on the layout.
 *
 * `FREE` applies no positioning at all, users can provide their own by styling `.gb-card`.
 * That includes no z-index, but the user can do that manually via the `.gb-card { z-index: var(--gb-index); }`.
 *
 * Otherwise, `z-index = index`, so the top (last) card is front-most.
 *
 * `STACKED` centers every card in the slot; `STAGGER_<corner>` offsets lower cards toward the slot interior by `steps`
 * multiples of the stagger offsets.
 *
 * When `centered`, the staggered cards' bounding box is centered in the slot (the corner only sets the stagger
 * direction); otherwise
 * the top card is anchored flush in the named corner.
 *
 * With `grow`, the top card is the one in-flow card (`position: relative`), so it gives {@link layoutStyle}'s
 * shrink-wrap a base size; a transform reproduces its staggered position without perturbing that flow box. All other cards
 * stay absolute and thus out of flow.
 */
function cardStyle(layout: ResolvedLayout, index: number, total: number, grow: boolean): JSX.CSSProperties {
    if (layout.kind === "FREE") return {}

    const isAnchor = grow && index === total - 1

    if (layout.kind === "STACKED") {
        if (isAnchor) return { position: "relative", "z-index": index }
        return { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", "z-index": index }
    }

    const { kind, staggerX: sx, staggerY: sy, centered } = layout
    const steps = total - 1 - index
    const base = { position: "absolute" as const, "z-index": index }

    if (centered) {
        const dirX = kind === "STAGGER_TR" || kind === "STAGGER_BR" ? -1 : 1
        const dirY = kind === "STAGGER_BL" || kind === "STAGGER_BR" ? -1 : 1
        const ox = `calc(${dirX} * ${sx} * (${steps} - (${total} - 1) / 2))`
        const oy = `calc(${dirY} * ${sy} * (${steps} - (${total} - 1) / 2))`
        if (isAnchor) return { position: "relative", transform: `translate(${ox}, ${oy})`, "z-index": index }
        return { ...base, top: "50%", left: "50%", transform: `translate(-50%, -50%) translate(${ox}, ${oy})` }
    }

    if (isAnchor) return { position: "relative", "z-index": index }

    const dx = `calc(${sx} * ${steps})`
    const dy = `calc(${sy} * ${steps})`
    switch (kind) {
        case "STAGGER_TL":
            return { ...base, top: 0, left: 0, transform: `translate(${dx}, ${dy})` }
        case "STAGGER_TR":
            return { ...base, top: 0, right: 0, transform: `translate(calc(-1 * ${dx}), ${dy})` }
        case "STAGGER_BL":
            return { ...base, bottom: 0, left: 0, transform: `translate(${dx}, calc(-1 * ${dy}))` }
        case "STAGGER_BR":
            return { ...base, bottom: 0, right: 0, transform: `translate(calc(-1 * ${dx}), calc(-1 * ${dy}))` }
    }
}

/**
 * Style for the `.gb-layout` container the cards live in.
 *
 * Without `grow` it only establishes the positioning context; the slot's size then comes entirely from consumer CSS
 * (and absolutely-positioned cards will overflow a fixed box).
 *
 * With `grow` the container shrink-wraps its in-flow top card (see {@link cardStyle}) and reserves padding for the
 * spread, so the box's border edge tracks the staggered cards' bounding box: `STAGGER_*` reserves the spread on the
 * staggered side(s), or split evenly on both sides when `centered`. `STACKED`, `FREE` and single-card slots need no
 * padding — for `FREE`, `grow` merely shrink-wraps whatever the consumer's `flex` / `grid` produces (as long as the
 * cards stay in flow).
 */
function layoutStyle(grow: boolean, layout: ResolvedLayout, numCards: number): JSX.CSSProperties {
    if (!grow) return { position: "relative" }
    const base: JSX.CSSProperties = { position: "relative", width: "fit-content", height: "fit-content" }
    if (numCards <= 1 || layout.kind === "STACKED" || layout.kind === "FREE") return base

    const { kind, staggerX, staggerY, centered } = layout

    if (centered) {
        const halfX = `calc(${staggerX} * (${numCards} - 1) / 2)`
        const halfY = `calc(${staggerY} * (${numCards} - 1) / 2)`
        return { ...base, "padding-left": halfX, "padding-right": halfX, "padding-top": halfY, "padding-bottom": halfY }
    }

    const spreadX = `calc(${staggerX} * (${numCards} - 1))`
    const spreadY = `calc(${staggerY} * (${numCards} - 1))`
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
