import type { DragDropProviderProps } from "@dnd-kit/solid"
import { type Component, type Context, createComponent, createContext, type JSX, onCleanup, useContext } from "solid-js"
import { createStore, produce, type SetStoreFunction } from "solid-js/store"
import { freshId, recordId } from "#src/utils"

/**
 * The reactive state and API for a single GameBoard, shared with descendant components via context.
 *
 * The board stores each card's render thunk and which slot holds it. Each {@link CardSlot} renders its cards in place
 * from those thunks. This means that moving a card does not preserve its internal state.
 */
export class GameBoardController {
    //
    // === STATE =======================================================================================================

    /** Maps {@link CardSlot} id to ordered list of {@link Card} ids it holds. */
    readonly slotContent: Readonly<Record<string, string[]>>

    /** Set of ids used in this gameboard (both for {@link CardSlot}s and {@link Card}s. */
    readonly #usedIds = new Set<string>()

    /** Maps {@link Card} ids to their render thunk. */
    readonly #cardRegistry = new Map<string, () => JSX.Element>()

    /** Solid's mutator function for {@link slotContent}. */
    readonly #setSlotContent: SetStoreFunction<Record<string, string[]>>

    // === INIT ========================================================================================================

    constructor() {
        const [locations, setLocations] = createStore<Record<string, string[]>>({})
        this.slotContent = locations
        this.#setSlotContent = setLocations
    }

    // === UTILS =======================================================================================================

    /** Returns the id of the card slot currently holding `cardId`, or undefined. */
    #slotOf(cardId: string): string | undefined {
        for (const slotId of Object.keys(this.slotContent)) {
            if (this.slotContent[slotId]?.includes(cardId)) return slotId
        }
        return undefined
    }

    // === API =========================================================================================================

    /**
     * Called by {@link CardSlot} to registers itself with an id (or mints a memorable one), erroring on duplicate id.
     * @returns the slot id
     */
    readonly registerSlot = (id?: string): string => {
        let slotId: string
        if (id !== undefined) {
            if (this.#usedIds.has(id)) throw new Error(`GameBoard: duplicate id "${id}"`)
            this.#usedIds.add(id)
            slotId = id
        } else {
            slotId = freshId(this.#usedIds)
        }
        this.#setSlotContent(slotId, [])
        onCleanup(() => {
            for (const cardId of this.slotContent[slotId]) {
                this.#cardRegistry.delete(cardId)
                this.#usedIds.delete(cardId)
            }
            this.#setSlotContent(produce(loc => delete loc[slotId]))
            this.#usedIds.delete(slotId)
        })
        return slotId
    }

    /**
     * Registers a new card, rendering `component` with `props`, into the {@link CardSlot} with the given `slotId`.
     *
     * @returns the new card's id.
     */
    readonly spawn = <P extends Record<string, unknown>>(
        args: {
            slotId: string
            component: Component<P>
            cardId?: string
        } & (Record<never, never> extends P ? { props?: P } : { props: P }),
    ): string => {
        const { slotId, component } = args
        const props = (args.props ?? {}) as P
        const cardId = args.cardId ? recordId(this.#usedIds, args.cardId) : freshId(this.#usedIds)
        this.#cardRegistry.set(cardId, () => createComponent(component, props))
        this.#setSlotContent(slotId, cards => [...cards, cardId])
        return cardId
    }

    /** Renders a fresh instance of the card's content (the user component). */
    readonly renderCard = (cardId: string): JSX.Element => {
        return this.#cardRegistry.get(cardId)?.()
    }

    /** Applies the drop (single-card swap) to the location store. */
    readonly handleDragEnd = (event: Parameters<NonNullable<DragDropProviderProps["onDragEnd"]>>[0]): void => {
        if (event.canceled) return

        const cardId = event.operation.source?.id
        const targetSlot = event.operation.target?.id
        if (typeof cardId !== "string" || typeof targetSlot !== "string") return
        if (!(targetSlot in this.slotContent)) return

        const sourceSlot = this.#slotOf(cardId)
        if (sourceSlot === undefined || sourceSlot === targetSlot) return

        this.#setSlotContent(
            produce(loc => {
                const sourceCards = loc[sourceSlot]
                const targetCards = loc[targetSlot]
                sourceCards.splice(sourceCards.indexOf(cardId), 1)
                // Single-card swap: a card already in the target returns to the source slot.
                const displaced = targetCards.shift()
                if (displaced !== undefined) sourceCards.push(displaced)
                targetCards.push(cardId)
            }),
        )
    }
}

export const GameBoardContext: Context<GameBoardController | undefined> = createContext<GameBoardController>()

/** Returns the game board controller; throws if used outside a `<GameBoard>`. */
export function useGameBoard(): GameBoardController {
    const ctrl = useContext(GameBoardContext)
    if (!ctrl) throw new Error("useGameBoard must be used within a <GameBoard>")
    return ctrl
}
