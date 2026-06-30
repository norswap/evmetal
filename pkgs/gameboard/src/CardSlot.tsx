import { useDraggable, useDroppable } from "@dnd-kit/solid"
import { For, type JSX } from "solid-js"
import { useGameBoard } from "./GameBoardContext"

/** Props for a CardSlot (Step 1 subset). */
export interface CardSlotProps {
    id?: string
}

/**
 * A named drag source & drop target. The card it contains are read from {@link BoardGameController.slotContent}.
 */
export function CardSlot(props: CardSlotProps): JSX.Element {
    const board = useGameBoard()
    const id = board.registerSlot(props.id)
    const droppable = useDroppable({ id })

    return (
        <div class="gb-slot" classList={{ "highlight-ok": droppable.isDropTarget() }} ref={el => droppable.ref(el)}>
            <div class="gb-slot-mount">
                <For each={board.slotContent[id]}>
                    {cardId => <Card cardId={cardId}>{board.renderCard(cardId)}</Card>}
                </For>
            </div>
        </div>
    )
}

/**
 * Wraps a card's component, making it draggable and hiding it while a drag is in flight (a drag overlay shows the
 * moving render instead).
 */
function Card(props: { cardId: string; children?: JSX.Element }): JSX.Element {
    const draggable = useDraggable({ id: props.cardId })
    return (
        <div
            class="gb-card"
            style={{ visibility: draggable.isDragging() || draggable.isDropping() ? "hidden" : "visible" }}
            ref={el => draggable.ref(el)}
        >
            {props.children}
        </div>
    )
}
