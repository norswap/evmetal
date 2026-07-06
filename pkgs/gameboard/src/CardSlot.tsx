import { useDraggable, useDragOperation, useDroppable } from "@dnd-kit/solid"
import { createMemo, For, type JSX } from "solid-js"
import {
    type SlotLayout,
    type SlotLayoutKind,
    type StaggerLayout,
    type StaggerMoreShadow,
    useGameBoard,
} from "./GameBoardContext"

export interface CardSlotProps {
    /** Unique slot id within the board; a memorable one is minted if omitted. */
    id?: string
    /** How the slot's cards are positioned, with its layout-specific options (default `{ kind: "FREE" }`). A bare
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
 * - `.gb-more` — added to the bottom-most displayed `.gb-card` whenever cards are hidden by `maxDisplayed`. It carries
 *   a `--gb-hidden` custom property with the number of hidden cards. Use it to signal the stack runs deeper. If you use
 *   {@link CardSlotProps#more}, this will get a default style (stagger of shadows).
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

    /** cf. {@link Displayed} */
    const displayed = createMemo((): Displayed => {
        const cards = board.slotContent[slotId]
        const max = layout().maxDisplayed || Number.POSITIVE_INFINITY
        const draggedCard = op.source()?.id as string | undefined
        const isDrag = draggedCard !== undefined && cards.includes(draggedCard)
        // When dragging, one more card is included in the DOM to replace the hidden dragged card.
        const numVisibleBeforeDrag = Math.min(cards.length, max)
        const numRendered = Math.min(cards.length, max + (isDrag ? 1 : 0))
        const numExtraBeforeDrag = cards.length - numVisibleBeforeDrag
        const numExtra = cards.length - numRendered
        const rendered = cards.slice(numExtra) // top cards are at the back of array
        const draggedIndex = isDrag ? rendered.indexOf(draggedCard) : -1
        return { rendered, draggedIndex, numExtra, numVisibleBeforeDrag, numExtraBeforeDrag }
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
            <div class="gb-layout" style={layoutStyle(props.grow ?? false, layout(), displayed())}>
                <For each={displayed().rendered}>
                    {(cardId, i) => (
                        <Card
                            cardId={cardId}
                            layout={layout()}
                            placement={cardPlacement(displayed(), i(), props.grow ?? false)}
                            isTop={cardId === board.topCardOf(slotId)}
                            isDrag={props.isDrag ?? true}
                            canDrag={props.canDrag}
                        >
                            {board.renderCard(cardId)}
                        </Card>
                    )}
                </For>
            </div>
        </div>
    )
}

/**  Information about the cards to render in the DOM, with awareness of whether a card is being dragged out or not. */
type Displayed = {
    /** Cards that will be present in the DOM. Includes visible card and possibly the card being dragged out, which will
     * be hidden. */
    rendered: string[]
    /** The index of the card being dragged away within rendered, or -1 if no drag. */
    draggedIndex: number
    /** Number of cards that will not be present in the DOM, but can be used for cues about slot depth. */
    numExtra: number
    /** If dragging, number of cards visible before the drag. Otherwise === {@link rendered}.length. */
    numVisibleBeforeDrag: number
    /** If dragging, number of extra (non-DOM) cards hidden before the drag. Otherwise === {@link numExtra}. */
    numExtraBeforeDrag: number
}

/**
 * A card's stacking and fan geometry within its slot, derived from the slot's {@link Displayed} state and the card's
 * position `i` in {@link Displayed.rendered}.
 *
 * A dragged card is kept in the DOM (hidden) at the slot it held at rest so @dnd-kit's overlay stays pinned to the
 * pointer; the rest reflow to close its gap. So the ghost gets its *resting* geometry and every other card the
 * *reflowed* one.
 */
type CardPlacement = {
    /** Stacking index (z-order); also surfaced as `--gb-index` / `data-index`. */
    index: number
    /** Size of the fan this card lays out within; also `--gb-count`. */
    numCards: number
    /** In a `grow` slot, whether this is the single in-flow card that shrink-wraps the box. */
    isAnchor: boolean
    /** Hidden-card count feeding the centered shadow *spacing* — kept at the resting value so nothing jitters mid-drag. */
    layoutHidden: number
    /** Hidden-card count the "more" cue actually *draws*; nonzero only on the back card. */
    cueHidden: number
}

/** cf. {@link CardPlacement} */
function cardPlacement(d: Displayed, i: number, grow: boolean): CardPlacement {
    const isDragging = d.draggedIndex >= 0
    const isDraggedCard = i === d.draggedIndex

    // TODO review below
    // TODO: numCards: the hidden card will have a different story there for both index and numCards
    // TODO do we need to separate our layouts?
    // The ghost's resting slot: its rendered position, less the deeper cards the drag revealed beneath it.
    const renderIndex = d.draggedIndex - (d.numExtraBeforeDrag - d.numExtra)
    const index = isDraggedCard ? renderIndex : isDragging && i > d.draggedIndex ? i - 1 : i
    const numCards = isDraggedCard ? d.numVisibleBeforeDrag : d.rendered.length - (isDragging ? 1 : 0)
    // A grow slot keeps exactly one in-flow card — the top of the fan — to size the box: the ghost if it held that slot
    // at rest, otherwise the reflowed top. That way the ghost never moves and the drag overlay stays pinned.
    const anchorIsGhost = renderIndex === d.numVisibleBeforeDrag - 1
    return {
        index,
        numCards,
        isAnchor: grow && (isDraggedCard || !anchorIsGhost) && index === numCards - 1,
        layoutHidden: isDraggedCard ? d.numExtraBeforeDrag : d.numExtra,
        cueHidden: index === 0 && !isDraggedCard ? d.numExtra : 0,
    }
}

/**
 * Wraps a card's component, positioning it per {@link cardPlacement}, making it draggable (subject to `isDrag` /
 * `canDrag`), and hiding it while a drag is in flight (a drag overlay shows the moving render instead).
 */
function Card(props: {
    cardId: string
    layout: ResolvedLayout
    placement: CardPlacement
    isTop: boolean
    isDrag: boolean | "top"
    canDrag?: (cardId: string) => boolean
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
            classList={{ "gb-more": props.placement.cueHidden > 0 }}
            data-card-id={props.cardId}
            data-index={props.placement.index}
            style={{
                ...cardStyle(props.layout, props.placement),
                "--gb-index": props.placement.index,
                "--gb-count": props.placement.numCards,
                "--gb-hidden": props.placement.cueHidden,
                "box-shadow": moreShadow(props.layout, props.placement.cueHidden),
                visibility: draggable.isDragging() || draggable.isDropping() ? "hidden" : "visible",
            }}
            ref={el => draggable.ref(el)}
        >
            {props.children}
        </div>
    )
}

/**
 * A {@link SlotLayout} with per-kind options defaulted, so consumers read them without fallbacks. `more` stays optional:
 * `undefined` means no built-in overflow render (the consumer styles `.gb-more` themselves); otherwise it is fully
 * defaulted.
 */
type ResolvedLayout =
    | { kind: "FREE"; maxDisplayed: number }
    | {
    kind: StaggerLayout
    staggerX: string
    staggerY: string
    centered: boolean
    maxDisplayed: number
    more?: Required<StaggerMoreShadow>
}

/**
 * Normalizes the `layout` prop (a bare {@link SlotLayoutKind} string, a {@link SlotLayout} object, or undefined) into a
 * {@link ResolvedLayout}, defaulting to `FREE` and filling in the per-kind options.
 */
function resolveLayout(layout: SlotLayoutKind | SlotLayout | undefined): ResolvedLayout {
    const l: SlotLayout = typeof layout === "string" ? ({ kind: layout } as SlotLayout) : (layout ?? { kind: "FREE" })
    if (l.kind === "FREE") return { kind: l.kind, maxDisplayed: l.maxDisplayed ?? 0 }

    const more = l.more && {
        color: l.more.color ?? "#8f8f8f",
        maxCount: l.more.maxCount ?? 3,
        lightenStep: l.more.lightenStep ?? 0.3,
        offsetX: l.more.offsetX ?? "5px",
        offsetY: l.more.offsetY ?? "5px",
    }

    return {
        kind: l.kind,
        staggerX: l.staggerX ?? "14px",
        staggerY: l.staggerY ?? "14px",
        centered: l.centered ?? false,
        maxDisplayed: l.maxDisplayed ?? 0,
        more,
    }
}

/**
 * The `box-shadow` for the built-in `.gb-more` cue when {@link SlotLayout#more} is set (otherwise returns `undefined`).
 *
 * Draws `min(hidden, maxCount)` layers offset diagonally towards the opposite corner, so the deck
 * edge peeks on 2 sides. The layer nearest the card is lightest; each deeper layer is `lightenStep` less lightened
 * toward white via `color-mix`, reaching the solid {@link MoreShadow#color}` only on a full stack.
 */
function moreShadow(layout: ResolvedLayout, hidden: number): string | undefined {
    if (hidden <= 0 || layout.kind === "FREE" || !layout.more) return undefined
    const { color, maxCount, lightenStep, offsetX, offsetY } = layout.more
    const [dx, dy] = [
        layout.kind === "STAGGER_TR" || layout.kind === "STAGGER_BR" ? -1 : 1,
        layout.kind === "STAGGER_BL" || layout.kind === "STAGGER_BR" ? -1 : 1,
    ]
    const layers: string[] = []
    for (let i = 1; i <= Math.min(hidden, maxCount); i++) {
        const c = `color-mix(in srgb, ${color}, white ${(maxCount - i) * lightenStep * 100}%)`
        layers.push(`calc(${dx} * ${offsetX} * ${i}) calc(${dy} * ${offsetY} * ${i}) 0 0 ${c}`)
    }
    return layers.join(", ")
}

/**
 * Computes a card's placement and stacking within its slot depending on the layout.
 *
 * `FREE` applies no positioning at all, users can provide their own by styling `.gb-card`.
 * That includes no z-index, but the user can do that manually via the `.gb-card { z-index: var(--gb-index); }`.
 *
 * Otherwise, `z-index = index`, so the top (last) card is front-most.
 *
 * `STAGGER_<corner>` offsets lower cards towards the opposite corner by `steps` multiples of the stagger offsets.
 *
 * When `centered`, the stack's cards (including the shadows cue for hidden cards) are centered in the slot; otherwise
 * the top card is anchored flush in the named corner.
 *
 * With `grow`, the top card is the one in-flow card (`position: relative`), so it gives {@link layoutStyle}'s
 * shrink-wrap a base size; a transform reproduces its staggered position without perturbing that flow box. All other cards
 * stay absolute and thus out of flow.
 */
function cardStyle(layout: ResolvedLayout, p: CardPlacement): JSX.CSSProperties {
    if (layout.kind === "FREE") return {}

    const { index, numCards, isAnchor, layoutHidden } = p
    const { kind, staggerX: sx, staggerY: sy, centered } = layout
    const steps = numCards - 1 - index
    const base = { position: "absolute" as const, "z-index": index }

    if (centered) {
        const dirX = kind === "STAGGER_TR" || kind === "STAGGER_BR" ? -1 : 1
        const dirY = kind === "STAGGER_BL" || kind === "STAGGER_BR" ? -1 : 1
        const numShadows = layout.more ? Math.min(layoutHidden, layout.more.maxCount) : 0
        const biasX = numShadows > 0 && layout.more ? ` - ${layout.more.offsetX} * ${numShadows} / 2` : ""
        const biasY = numShadows > 0 && layout.more ? ` - ${layout.more.offsetY} * ${numShadows} / 2` : ""
        const ox = `calc(${dirX} * (${sx} * (${steps} - (${numCards} - 1) / 2)${biasX}))`
        const oy = `calc(${dirY} * (${sy} * (${steps} - (${numCards} - 1) / 2)${biasY}))`
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
 * Without `grow` it's only `{ position: relative }`. The slot's size then comes entirely from consumer CSS
 * (and absolutely-positioned cards will overflow a fixed box).
 *
 * With `grow` the container fits its content, either using the regular CSS rules in a `FREE` layout, or computing the
 * rendered size of the entire stack in the `STAGGER_*` layout.
 *
 * In staggered layouts, if {@link SlotLayout#centered} is set, will also set padding so that stack is visually centered
 * in the container. Otherwise the stack will anchor to its corner (e.g. `STAGGER_TL` to the top left).
 */
function layoutStyle(grow: boolean, layout: ResolvedLayout, displayed: Displayed): JSX.CSSProperties {
    if (!grow) return { position: "relative" }

    const numVisible = displayed.numVisibleBeforeDrag // see explanation below
    // TODO check what this actually does (and if the explanation below is correct)
    // const numVisible = displayed.rendered.length

    const base = { position: "relative", width: "fit-content", height: "fit-content" } as const
    if (numVisible <= 1 || layout.kind === "FREE") return base

    // In a staggered layout, we size by fitting the "in-flow" content, which is the top card in the slot and by adding
    // padding to accomodate the staggered cards (and potentially the shadows that cue that there are extra cards not
    // rendered).
    //
    // If we're dragging, we must use the number of visible & extra cards *before* dragging.
    // This might cause the padding to be slightly excessive for a strict content-fit, but it is required.
    // Without it, the location of the card being dragged (now hidden) would shift on drag, causing the drag overlay
    // to also shift.

    const { kind, staggerX, staggerY, centered } = layout

    const spreadX = `calc(${staggerX} * (${numVisible} - 1))`
    const spreadY = `calc(${staggerY} * (${numVisible} - 1))`

    if (centered) {
        const numShadows = layout.more ? Math.min(displayed.numExtraBeforeDrag, layout.more.maxCount) : 0
        // TODO check what this actually does
        // const numShadows = layout.more ? Math.min(displayed.numExtra, layout.more.maxCount) : 0
        const shadowX = numShadows <= 0 ? "0" : `${layout.more!.offsetX} * ${numShadows}`
        const shadowY = numShadows <= 0 ? "0" : `${layout.more!.offsetY} * ${numShadows}`
        const halfX = `calc((${spreadX} + ${shadowX}) / 2)`
        const halfY = `calc((${spreadY} + ${shadowY}) / 2)`
        return { ...base, "padding-left": halfX, "padding-right": halfX, "padding-top": halfY, "padding-bottom": halfY }
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
