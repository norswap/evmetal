import { useDragOperation, useDroppable } from "@dnd-kit/solid"
import { createMemo, For, type JSX } from "solid-js"
import { Card, type CardDisplay } from "#src/Card"
import { useGameBoard } from "#src/GameBoardContext"
import type { DragPlaceholderMode } from "#src/GameBoardController"
import { type CardPlacement, resolveLayout, type SlotLayout } from "#src/layout"
import type { CardId, SlotId } from "#src/utils"

export interface CardSlotProps {
    /** Unique slot id within the board; a memorable one is minted if omitted. */
    id?: string
    /** How the slot's cards are positioned, with its layout-specific options (default `{ kind: "FREE" }`). */
    layout?: SlotLayout
    /** Which cards can be dragged out: `true` = all, `false` = none, `"top"` = only the top card (default `true`). */
    isDrag?: boolean | "top"
    /** Further restricts draggability: given a card id, returns whether it may be dragged (applied after `isDrag`). */
    canDrag?: (cardId: CardId) => boolean
    /** Whether cards can be dropped here; `"top"` aliases `true` for now (default `true`). */
    isDrop?: boolean | "top"
    /** Further restricts dropping: given the id of the slot the card is dragged from and the dragged card's id,
     * returns whether it may be dropped here (applied after `isDrop`). */
    canDrop?: (src: SlotId, cardId: CardId) => boolean
    /** What placeholder a card leaves behind when dragged from its slot. cf. {@link DragPlaceholderMode}. */
    dragPlaceholder?: DragPlaceholderMode
}

/**
 * A named drag source & drop target. The cards it contains are read from {@link GameBoardController.slotContent}, and
 * renders according to the props.
 *
 * The slot renders each card from the render thunk registered by {@link GameBoardController#spawn}.
 *A card changing slots is recreated in its new slot — internal component state does not survive moves.
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
 *   as flex or grid container. It defines `--gb-count` (visible card count) and `--gb-extra` (extra card count)
 *   CSS variables, plus a `data-gb-count` attribute set to the visible card count.
 * - `.gb-card` — per-card wrapper. With `"FREE"` you can apply flex/grid items styles here.
 *   It carries `data-gb-card-id` / `data-gb-index` attributes (can be used for CSS selection) and the `--gb-index` CSS
 *   variable.
 * - `[data-dnd-placeholder]` — dnd-kit's placeholder for a card being dragged out. Style it to customize what a lifted
 *   card leaves behind. By default, this element is hidden when using a ghost placeholder, or no placeholder (in which
 *   case it's also removed from normal flow and should really not be styled). cf. {@link DragPlaceholderMode}
 * - `.gb-bottom` — added to the bottom-most displayed `.gb-card` (the bottom of what `maxDisplayed` allows).
 * - `.gb-cue-extra` — added to the bottom-most displayed `.gb-card` whenever cards are extra to `maxDisplayed`.
 *   Staggered layouts draw a built-in cue (a stagger of shadows, cf. {@link CueExtra}) unless disabled via
 *   `cueExtra: false`.
 */
export function CardSlot(props: CardSlotProps): JSX.Element {
    const board = useGameBoard()
    const layout = createMemo(() => resolveLayout(props.layout))
    const slotId = board.registerSlot(props.id, {
        isDrop: () => props.isDrop ?? true,
        canDrop: () => props.canDrop,
        dragPlaceholder: () => props.dragPlaceholder,
    })
    const droppable = useDroppable({ id: slotId })
    const op = useDragOperation()

    // "none" unless a card from another slot is hovering here; then "ok"/"no" per the controller's drop predicate.
    const dropValidity = (): "none" | "ok" | "no" => {
        const cardId = op.source()?.id as CardId
        if (op.target()?.id !== slotId) return "none"
        if (board.slotContent[slotId].includes(cardId)) return "none"
        return board.canDrop(cardId, slotId) ? "ok" : "no"
    }

    /** The cards to render (bottom-most first), each one's {@link CardDisplay}, and the laid-out card counts that
     * size the `.gb-layout` container (via `layoutStyle`). */
    const rendered = createMemo((): Rendered => {
        // Convention: variables with a $ are temp vars only used to define other variables.

        const l = layout()
        const isDrag = props.isDrag ?? true
        const placeholder = props.dragPlaceholder ?? "none"
        const $content = board.slotContent[slotId]
        const $src = op.source()?.id as CardId | undefined
        const $cardDragged = $src !== undefined && $content.includes($src) ? $src : undefined
        const $numShown = Math.min($content.length, l.maxDisplayed || Number.POSITIVE_INFINITY)

        // The card being dragged out of this slot, or undefined.
        const cardDraggedOut = board.isDraggingCard() ? $cardDragged : undefined

        // A card that has been dropped but is still animating, or undefined.
        const $cardDroppedIn = board.isDraggingCard() ? undefined : $cardDragged

        // (Mutable) Number of extra cards below the displayed stack (beyond `maxDisplayed`).
        let numExtra = $content.length - $numShown

        // (Mutable) Cards for which we will render a DOM element.
        // Inclusive card dragged out / dropped in, excepted if isExtraDrag.
        const domCards = $content.slice(numExtra)

        // The topmost card made extra by `maxDisplayed`, or undefined if none is.
        const topExtraCard = numExtra > 0 ? $content[numExtra - 1] : undefined

        // (Mutable) Number of cards that take space in the layout (include ghost, clone, cards dropping in).
        let numLaidOut = domCards.length

        // Is drag out with no placeholder/space left behind?
        const isNoPlaceholderDrag = placeholder === "none" && !!cardDraggedOut

        // Is drag out of a card that would now be extra because of new cards added to the slot?
        const isExtraDrag = !!cardDraggedOut && !domCards.includes(cardDraggedOut)

        const isVisibleNoPlaceholderDrag = isNoPlaceholderDrag && !isExtraDrag

        // The card is being dragged from the bottom of the rendered cards and leaves a ghost behind.
        const $isBottomGhostDrag = placeholder === "ghost" && domCards[0] === cardDraggedOut

        // The card is being dropped towards the bottom of the rendered cards.
        const $isBottomDrop = domCards[0] === $cardDroppedIn

        // We render the top extra card because we're ghost-dragging from the bottom or dropping to the bottom.
        const replacedBottomDrag = !!topExtraCard && ($isBottomGhostDrag || $isBottomDrop)

        // A card being dragged out must always exist somewhere for dnd-kit to work.
        if (isExtraDrag) {
            --numExtra
            // The dragged card is out of flow, don't touch `numLaidOut`.
            domCards.unshift(cardDraggedOut!) // comes first to preserve ordering in <For> (avoid breaking the drag)
        } else if (isVisibleNoPlaceholderDrag) {
            --numLaidOut // The dragged part card is out of flow.
            if (topExtraCard) {
                // Show top extra card, achieving "instant reflow" as though the dragged card wasn't there.
                // (It will be taken out of flow below.)
                --numExtra
                ++numLaidOut
                domCards.unshift(topExtraCard)
            }
        } else if (replacedBottomDrag) {
            /** Show top extra card when ... cf. {@link replacedBottomDrag }.
             * Otherwise, it would be incoherent/jarring: it makes the stack look empty when it isn't, and extra cues
             * might attach to an empty space. */
            --numExtra
            // The card must overlap with the dragged or dropped card placeholder, don't touch `numLaidOut`.
            domCards.unshift(topExtraCard)
        }

        const displays: Record<CardId, CardDisplay> = {}

        /** Records a {@link CardDisplay} into {@link displays}. */
        const display = (cardId: CardId, isDraggable: boolean, placement: CardPlacement): void => {
            displays[cardId] = {
                style: {
                    ...l.cardStyle(placement),
                    "--gb-index": placement.index,
                },
                index: placement.index,
                isBottom: placement.index === 0,
                carriesExtraCue: placement.index === 0 && placement.numExtra > 0,
                isDraggable,
            }
        }

        for (let i = 0, index = 0; i < domCards.length; i++, index++) {
            // `index` is the in-flow index, skipping the non-layout card
            const cardId = domCards[i]
            if ((isNoPlaceholderDrag || isExtraDrag) && cardId === cardDraggedOut) {
                // Card must exist (is being dragged) but we want it hidden and out of the flow.
                displays[cardId] = {
                    // Take the card out of the regular layout flow.
                    style: { position: "absolute" },
                    index: numLaidOut,
                    carriesExtraCue: false,
                    isBottom: false,
                    parked: true,
                    isDraggable: true, // must stay true for drag duration
                }
                --index // out of flow, takes no space in layout
            } else if (cardId === topExtraCard) {
                display(cardId, false, {
                    index: 0,
                    numCards: numLaidOut,
                    isAnchor: l.grow && numLaidOut === 1,
                    numExtra,
                })
                if (replacedBottomDrag) --index // overlay top extra card with dragged/dropped card
            } else {
                const dragAllowed = isDrag === true || (isDrag === "top" && cardId === board.topCardOf(slotId))
                display(cardId, dragAllowed && (props.canDrag?.(cardId) ?? true), {
                    index,
                    numCards: numLaidOut,
                    isAnchor: l.grow && index === numLaidOut - 1,
                    numExtra,
                })
            }
        }

        return { domCards: domCards, displays, numLaidOut, numExtra }
    })

    return (
        <div
            class="gb-slot"
            classList={{ "highlight-ok": dropValidity() === "ok", "highlight-no": dropValidity() === "no" }}
            ref={el => droppable.ref(el)}
        >
            <div
                class="gb-layout"
                data-gb-count={rendered().numLaidOut}
                style={{
                    ...layout().layoutStyle({ numVisible: rendered().numLaidOut, numExtra: rendered().numExtra }),
                    "--gb-count": rendered().numLaidOut,
                    "--gb-extra": rendered().numExtra,
                }}
            >
                <For each={rendered().domCards}>
                    {cardId => (
                        <Card cardId={cardId} display={rendered().displays[cardId]}>
                            {board.renderCard(cardId)}
                        </Card>
                    )}
                </For>
            </div>
        </div>
    )
}

/**
 * The cards to render (bottom-most first), each one's {@link CardDisplay}, and the laid-out card counts that
 * size the `.gb-layout` container (via `layoutStyle`).
 */
interface Rendered {
    /** Card IDs to render (bottom-most first). */
    domCards: CardId[]
    /** Display information for each card to render. */
    displays: Record<CardId, CardDisplay>
    /** Number of card to "lay out", i.e. {@link domCards} minus rendered cards to remove from flow & hide. */
    numLaidOut: number
    /** Number of extra cards that are not rendered. */
    numExtra: number
}
