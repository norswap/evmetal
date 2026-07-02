import type { DragDropProviderProps } from "@dnd-kit/solid"
import { type Component, type Context, createComponent, createContext, type JSX, onCleanup, useContext } from "solid-js"
import { createStore, produce, type SetStoreFunction } from "solid-js/store"
import { freshId, recordId } from "#src/utils"

/**
 * The positioning strategy for a slot's cards, without any options. `STACKED` centers every card; `STAGGER_*` fans
 * them toward the named corner; `FREE` applies no positioning, leaving card placement to consumer CSS (see
 * {@link CardSlot}). See {@link SlotLayout} for the option-carrying form used by the `layout` prop.
 */
export type SlotLayoutKind = "STACKED" | "FREE" | StaggerLayout

/** The corner-fanning subset of {@link SlotLayoutKind} — the only layouts that accept stagger options. */
export type StaggerLayout = "STAGGER_TL" | "STAGGER_TR" | "STAGGER_BL" | "STAGGER_BR"

/**
 * A slot layout together with the options that only make sense for it.
 */
export type SlotLayout =
    | { kind: "STACKED" }
    | { kind: "FREE" }
    | {
          kind: StaggerLayout
          /** Per-card x-offset as a CSS unit (default `"14px"`). */
          staggerX?: string
          /** Per-card y-offset as a CSS unit (default `"14px"`). */
          staggerY?: string
          /** Whether to center or anchor to the named corner (default: false). */
          centered?: boolean
      }

/**
 * A slot's drop rules, determining whether a card can be dropped onto the slot.
 *
 * The fields are functions instead of values so that {@link CardSlot} can pass thunks to maintain reactivity.
 */
export interface SlotConfig {
    readonly isDrop: () => boolean | "top"
    readonly canDrop?: () => ((src: string, dst: string | null) => boolean) | undefined
}

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

    /** Maps {@link CardSlot} id to its drop rules, so {@link handleDragEnd} can enforce them centrally. */
    readonly #slotConfig = new Map<string, SlotConfig>()

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
    readonly registerSlot = (id?: string, config?: SlotConfig): string => {
        let slotId: string
        if (id !== undefined) {
            if (this.#usedIds.has(id)) throw new Error(`GameBoard: duplicate id "${id}"`)
            this.#usedIds.add(id)
            slotId = id
        } else {
            slotId = freshId(this.#usedIds)
        }
        this.#setSlotContent(slotId, [])
        if (config !== undefined) this.#slotConfig.set(slotId, config)
        onCleanup(() => {
            for (const cardId of this.slotContent[slotId]) {
                this.#cardRegistry.delete(cardId)
                this.#usedIds.delete(cardId)
            }
            this.#setSlotContent(produce(loc => delete loc[slotId]))
            this.#slotConfig.delete(slotId)
            this.#usedIds.delete(slotId)
        })
        return slotId
    }

    /** Returns the topmost card id in `slotId`, or undefined if empty/unknown. */
    readonly topCardOf = (slotId: string): string | undefined => {
        const cards = this.slotContent[slotId]
        return cards?.[cards.length - 1]
    }

    /**
     * Whether the card can be dropped in the slot.
     *
     * Used to determine what happens when dragging the card to the slot, as well as setting the highligh-ok and
     * highlight-no classes on the card slot.
     */
    readonly canDrop = (srcCardId: string, targetSlotId: string): boolean => {
        if (!(targetSlotId in this.slotContent)) return false
        const cfg = this.#slotConfig.get(targetSlotId)
        const isDrop = cfg?.isDrop() ?? true
        if (isDrop === false) return false
        const dst = this.topCardOf(targetSlotId) ?? null
        return cfg?.canDrop?.()?.(srcCardId, dst) ?? true
    }

    /**
     * Removes `cardId` from its current slot and inserts it into `toSlotId` at `index` (clamped to `[0, length]`).
     * Append with `index = length`.
     *
     * Currently never called for a card that is already in the destination slot.
     */
    readonly moveCard = (cardId: string, toSlotId: string, index: number): void => {
        const fromSlot = this.#slotOf(cardId)
        if (fromSlot === undefined || !(toSlotId in this.slotContent)) return
        this.#setSlotContent(
            produce(loc => {
                const from = loc[fromSlot]
                from.splice(from.indexOf(cardId), 1)
                const to = loc[toSlotId]
                to.splice(Math.max(0, Math.min(index, to.length)), 0, cardId)
            }),
        )
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

    /** Applies a drop: moves the dragged card onto the top of a valid target slot. */
    readonly handleDragEnd = (event: Parameters<NonNullable<DragDropProviderProps["onDragEnd"]>>[0]): void => {
        if (event.canceled) return
        const cardId = event.operation.source?.id
        if (typeof cardId !== "string") return

        const targetSlot = event.operation.target?.id
        if (typeof targetSlot !== "string" || !(targetSlot in this.slotContent)) return

        const sourceSlot = this.#slotOf(cardId)
        if (sourceSlot === undefined || sourceSlot === targetSlot) return
        if (!this.canDrop(cardId, targetSlot)) return

        this.moveCard(cardId, targetSlot, this.slotContent[targetSlot].length)
    }
}

export const GameBoardContext: Context<GameBoardController | undefined> = createContext<GameBoardController>()

/** Returns the game board controller; throws if used outside a `<GameBoard>`. */
export function useGameBoard(): GameBoardController {
    const ctrl = useContext(GameBoardContext)
    if (!ctrl) throw new Error("useGameBoard must be used within a <GameBoard>")
    return ctrl
}
