import { useDraggable } from "@dnd-kit/solid"
import type { JSX } from "solid-js"
import { useGameBoard } from "./context"

/** Props for a Card (Step 1 subset). */
export interface CardProps {
    source?: boolean
    children?: JSX.Element
}

/**
 * Draggable chrome around a card's visual. Rendered once by `board.spawn` under a stable root; it registers its root
 * element (which the board reparents between slots) and the card's teardown. While being dragged it is hidden, since
 * the board's drag overlay shows a clone in its place.
 */
export function Card(props: CardProps): JSX.Element {
    const board = useGameBoard()
    const { cardId, dispose } = board.consumePending()
    const draggable = useDraggable({ id: cardId, disabled: props.source === false })
    return (
        <div
            class="gb-card"
            style={{ visibility: draggable.isDragging() ? "hidden" : "visible" }}
            ref={el => {
                draggable.ref(el)
                board.registerCard(cardId, el, dispose)
            }}
        >
            {props.children}
        </div>
    )
}
