import type { DragDropProviderProps } from "@dnd-kit/solid"
import {
    type Component,
    type Context,
    createComponent,
    createContext,
    createRoot,
    type JSX,
    type Owner,
    onCleanup,
    useContext,
} from "solid-js"
import { createStore, produce } from "solid-js/store"
import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator"

/** Event passed to the board's drag-end handler (derived from dnd-kit's provider props). */
export type DragEndEvent = Parameters<NonNullable<DragDropProviderProps["onDragEnd"]>>[0]

/** A live card: its single root element and the teardown for the `createRoot` it was rendered under. */
export interface CardEntry {
    el: HTMLElement
    dispose: () => void
}

/** The per-board API shared with descendant components via context. */
export interface GameBoardApi {
    /** Reactive map of slot id to the ordered ids of the cards it holds (the single source of truth for membership). */
    readonly locations: Record<string, string[]>
    /** Records a slot id (or mints a memorable one), erroring on a duplicate; returns the resolved id. */
    registerSlot(id?: string): string
    /** Records a freshly rendered card's root element and its teardown under its id. */
    registerCard(cardId: string, el: HTMLElement, dispose: () => void): void
    /** Returns (once) the id + teardown that `spawn` staged for the card currently rendering. */
    consumePending(): { cardId: string; dispose: () => void }
    /** Returns a card's root element, if it exists. */
    cardEl(cardId: string): HTMLElement | undefined
    /** Sets the owner (captured inside both providers) under which spawned cards are rendered. */
    setOwner(owner: Owner): void
    /** Renders `component` once and places the resulting card into `slotId`; returns the new card's id. */
    spawn<P extends Record<string, unknown>>(slotId: string, component: Component<P>, props?: P): string
    /** Applies the drop (single-card swap) to the location store. */
    handleDragEnd(event: DragEndEvent): void
    /** Produces the drag-overlay visual for a card: a static clone of its element. */
    overlay(cardId: string | number): JSX.Element
}

export const GameBoardContext: Context<GameBoardApi | undefined> = createContext<GameBoardApi>()

/** Returns the enclosing board's API; throws if used outside a `<GameBoard>`. */
export function useGameBoard(): GameBoardApi {
    const api = useContext(GameBoardContext)
    if (!api) throw new Error("GameBoard subcomponents must be used within a <GameBoard>")
    return api
}

// Generates a memorable two-word id, e.g. "calm-otter".
function memorableId(): string {
    return uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: "-", length: 2 })
}

// Returns a memorable id not already present in `used`, recording it.
function freshId(used: Set<string>): string {
    let id = memorableId()
    while (used.has(id)) id = memorableId()
    used.add(id)
    return id
}

/**
 * Creates the reactive state and API for a single GameBoard. The owner under which cards are rendered is supplied later
 * via `setOwner`, and must be captured *inside* both the dnd-kit and GameBoard context providers: cards are rendered
 * under detached roots (so reparenting between slots never disposes them), and parenting those roots to this owner is
 * what lets them still resolve both contexts.
 */
export function createGameBoard(): GameBoardApi {
    const [locations, setLocations] = createStore<Record<string, string[]>>({})
    const registry = new Map<string, CardEntry>()
    const usedIds = new Set<string>()
    let boardOwner: Owner | undefined
    let pending: { cardId: string; dispose: () => void } | undefined

    // Detached roots are never torn down automatically, so dispose every remaining card when the board unmounts.
    onCleanup(() => {
        for (const entry of registry.values()) entry.dispose()
    })

    // Returns the slot currently holding `cardId`, or undefined.
    function slotOf(cardId: string): string | undefined {
        for (const slotId of Object.keys(locations)) {
            if (locations[slotId]?.includes(cardId)) return slotId
        }
        return undefined
    }

    const api: GameBoardApi = {
        locations,
        registerSlot(id) {
            if (id !== undefined) {
                if (usedIds.has(id)) throw new Error(`GameBoard: duplicate id "${id}"`)
                usedIds.add(id)
                return id
            }
            return freshId(usedIds)
        },
        registerCard(cardId, el, dispose) {
            registry.set(cardId, { el, dispose })
        },
        consumePending() {
            if (!pending) throw new Error("<Card> rendered outside of board.spawn()")
            const result = pending
            pending = undefined
            return result
        },
        cardEl(cardId) {
            return registry.get(cardId)?.el
        },
        setOwner(owner) {
            boardOwner = owner
        },
        spawn(slotId, component, props) {
            if (!boardOwner) throw new Error("GameBoard: spawn called before the board was mounted")
            const cardId = freshId(usedIds)
            createRoot(dispose => {
                pending = { cardId, dispose }
                // Realize the card once under this stable root; <Card> consumes `pending` and registers its element.
                // The returned node is discarded — the element lives in the registry and is parented by the reconciler.
                void createComponent(
                    component as Component<Record<string, unknown>>,
                    (props ?? {}) as Record<string, unknown>,
                )
            }, boardOwner)
            setLocations(slotId, cards => [...(cards ?? []), cardId])
            return cardId
        },
        handleDragEnd(event) {
            if (event.canceled) return
            const cardId = event.operation.source?.id
            const targetSlot = event.operation.target?.id
            if (typeof cardId !== "string" || typeof targetSlot !== "string") return
            const sourceSlot = slotOf(cardId)
            if (sourceSlot === undefined || sourceSlot === targetSlot) return
            setLocations(
                produce(loc => {
                    const sourceCards = loc[sourceSlot] ?? (loc[sourceSlot] = [])
                    const targetCards = loc[targetSlot] ?? (loc[targetSlot] = [])
                    const dragIndex = sourceCards.indexOf(cardId)
                    if (dragIndex >= 0) sourceCards.splice(dragIndex, 1)
                    // Single-card swap: a card already in the target returns to the source slot.
                    const displaced = targetCards.shift()
                    if (displaced !== undefined) sourceCards.push(displaced)
                    targetCards.push(cardId)
                }),
            )
        },
        overlay(cardId) {
            const el = typeof cardId === "string" ? registry.get(cardId)?.el : undefined
            if (!el) return null
            const clone = el.cloneNode(true) as HTMLElement
            // The real card is hidden while dragging; the clone must be visible.
            clone.style.visibility = "visible"
            return clone
        },
    }
    return api
}
