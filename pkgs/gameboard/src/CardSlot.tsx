import { useDraggable, useDragOperation, useDroppable } from "@dnd-kit/solid"
import { For, type JSX } from "solid-js"
import { type SlotLayout, useGameBoard } from "./GameBoardContext"

export interface CardSlotProps {
    /** Unique slot id within the board; a memorable one is minted if omitted. */
    id?: string
    /** How the slot's cards are positioned (default `"STACKED"`). */
    layout?: SlotLayout
    /** Per-card x-offset for `STAGGER_*` layouts, as a CSS unit (default `"14px"`). */
    staggerX?: string
    /** Per-card y-offset for `STAGGER_*` layouts, as a CSS unit (default `"14px"`). */
    staggerY?: string
    /** For `STAGGER_*` layouts, whether to center or anchor to the named corner (default: false). */
    centered?: boolean
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
 */
export function CardSlot(props: CardSlotProps): JSX.Element {
    const board = useGameBoard()
    const slotId = board.registerSlot(props.id, {
        isDrop: () => props.isDrop ?? true,
        canDrop: () => props.canDrop,
    })
    const droppable = useDroppable({ id: slotId })
    const op = useDragOperation()

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
            <div class="gb-slot-mount" style={{ position: "relative" }}>
                <For each={board.slotContent[slotId]}>
                    {(cardId, index) => (
                        <Card
                            cardId={cardId}
                            layout={props.layout ?? "STACKED"}
                            index={index()}
                            total={board.slotContent[slotId].length}
                            isTop={cardId === board.topCardOf(slotId)}
                            staggerX={props.staggerX ?? "14px"}
                            staggerY={props.staggerY ?? "14px"}
                            centered={props.centered ?? false}
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

/**
 * Wraps a card's component, positioning it per the slot layout, making it draggable (subject to `isDrag` /
 * `canDrag`), and hiding it while a drag is in flight (a drag overlay shows the moving render instead).
 */
function Card(props: {
    cardId: string
    layout: SlotLayout
    index: number
    total: number
    isTop: boolean
    staggerX: string
    staggerY: string
    centered: boolean
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
            style={{
                ...cardStyle(props.layout, props.index, props.total, props.staggerX, props.staggerY, props.centered),
                visibility: draggable.isDragging() || draggable.isDropping() ? "hidden" : "visible",
            }}
            ref={el => draggable.ref(el)}
        >
            {props.children}
        </div>
    )
}

/**
 * Computes a card's absolute placement and stacking within its slot. `z-index = index`, so the top (last) card is
 * front-most. `STACKED` centers every card; `STAGGER_<corner>` offsets lower cards toward the slot interior by `steps`
 * multiples of the stagger offsets. When `centered`, the fan's bounding box is centered in the slot (the corner only
 * sets the fan direction); otherwise the top card is anchored flush in the named corner.
 */
function cardStyle(
    layout: SlotLayout,
    index: number,
    total: number,
    sx: string,
    sy: string,
    centered: boolean,
): JSX.CSSProperties {
    if (layout === "STACKED")
        return { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", "z-index": index }

    const steps = total - 1 - index
    const base = { position: "absolute" as const, "z-index": index }

    if (centered) {
        const dirX = layout === "STAGGER_TR" || layout === "STAGGER_BR" ? -1 : 1
        const dirY = layout === "STAGGER_BL" || layout === "STAGGER_BR" ? -1 : 1
        const ox = `calc(${dirX} * ${sx} * (${steps} - (${total} - 1) / 2))`
        const oy = `calc(${dirY} * ${sy} * (${steps} - (${total} - 1) / 2))`
        return { ...base, top: "50%", left: "50%", transform: `translate(-50%, -50%) translate(${ox}, ${oy})` }
    }

    const dx = `calc(${sx} * ${steps})`
    const dy = `calc(${sy} * ${steps})`
    switch (layout) {
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
