import { useDroppable } from "@dnd-kit/solid"
import { createEffect, type JSX } from "solid-js"
import { useGameBoard } from "./context"

/** Props for a CardSlot (Step 1 subset). */
export interface CardSlotProps {
    id?: string
}

// Makes `mount`'s children exactly `desired`, in order, by *moving* existing nodes rather than recreating them
// (insertBefore/appendChild relocate an already-attached node). Trailing leftovers are detached; if they belong to
// another slot, that slot's reconciler re-attaches them.
function reconcileChildren(mount: HTMLElement, desired: HTMLElement[]): void {
    desired.forEach((el, index) => {
        const current = mount.childNodes[index]
        if (current !== el) mount.insertBefore(el, current ?? null)
    })
    while (mount.childNodes.length > desired.length) {
        mount.removeChild(mount.lastChild as ChildNode)
    }
}

/**
 * A named drop region. It holds no cards directly: membership is read from the board's location store, and the
 * cards' elements are reparented into this slot's mount point by the reconciler effect below.
 */
export function CardSlot(props: CardSlotProps): JSX.Element {
    const board = useGameBoard()
    const id = board.registerSlot(props.id)
    const droppable = useDroppable({ id })
    let mount!: HTMLDivElement

    // Keep the slot's DOM in sync with the cards the location store assigns to it.
    createEffect(() => {
        const ids = board.locations[id] ?? []
        const els = ids.map(cardId => board.cardEl(cardId)).filter((el): el is HTMLElement => el !== undefined)
        reconcileChildren(mount, els)
    })

    return (
        <div class="gb-slot" classList={{ "highlight-ok": droppable.isDropTarget() }} ref={el => droppable.ref(el)}>
            <div class="gb-slot-mount" ref={mount} />
        </div>
    )
}
