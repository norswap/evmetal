import type { DragDropProviderProps } from "@dnd-kit/solid"
import { type Accessor, type Component, createComponent, createSignal, type JSX, onCleanup } from "solid-js"
import { createStore, produce, type SetStoreFunction } from "solid-js/store"
import { type CardId, freshId, recordId, type SlotId } from "#src/utils"

/**
 * What placeholder a card leaves behind when dragged from its slot:
 * - `"none"` (default): the card leaves the slot immediately, nothing is left behind & layout reflows
 * - `"clone"`: a clone of the card is left behind, style it via dnd-kit's `[data-dnd-placeholder]` attribute
 * - `"ghost"`: a hidden placeholder is left behind (takes up space)
 */
export type DragPlaceholderMode = "none" | "clone" | "ghost"

/**
 * A slot's drag & drop rules, set from the similarly named props in {@link CardSlotProps}.
 *
 * The fields are functions instead of values so that {@link CardSlot} can pass thunks to maintain reactivity.
 */
export interface SlotConfig {
    readonly isDrop: () => boolean | "top"
    readonly canDrop?: () => ((src: SlotId, cardId: CardId) => boolean) | undefined
    readonly dragPlaceholder?: () => DragPlaceholderMode | undefined
}

/**
 * The reactive state and API for a single GameBoard, available within {@link GameBoardContext} via {@link useContext}.
 */
export class GameBoardController {
    //
    // === STATE =======================================================================================================

    /**
     * Maps {@link CardSlot} id to ordered list of {@link Card} IDs it holds.
     *
     * Cards are only moved out of here at the end of a drag. So a card being dragged is still in here, even though it
     * might not be visually displayed in the origin slot whenever {@link CardSlotProps#dragPlaceholder} is `"none"`.
     */
    readonly slotContent: Readonly<Record<string, CardId[]>>

    /** Solid's mutator function for {@link slotContent}. */
    readonly #setSlotContent: SetStoreFunction<Record<string, CardId[]>>

    /** Set of IDs used in this gameboard (both for {@link CardSlot}s and {@link Card}s. */
    readonly #usedIds = new Set<string>()

    /** Maps {@link Card} IDs to the render thunk for their user-supplied content. */
    readonly #cardRegistry = new Map<CardId, () => JSX.Element>()

    /** Maps {@link CardSlot} IDs to their drag & drop rules. */
    readonly #slotConfig = new Map<SlotId, SlotConfig>()

    /**
     * Whether a card drag is currently live. Set/unset on the drag start/end handlers.
     *
     * When not using a drag placeholder ({@link DragPlaceholderMode}) {@link CardSlot} excludes the dragged card from
     * its layout flow while this is true (a DOM node is still rendered, as is required).
     *
     * If we instead relied on `useDragOperation().status()`, there would exist a window of time (after the drops the
     * card, but before dnd-kit updates the operation status) where it would look as though the card was being dragged
     * out of the destination slot. This might be fine (only trigger a bogus unpainted render) but this is much more
     * robust.
     */
    readonly isDraggingCard: Accessor<boolean>

    /** Setter for {@link isDraggingCard}. */
    readonly #setIsDraggingCard: (dragging: boolean) => void

    /**
     * Analogous to {@link isDraggingCard} but set synchronously.
     *
     * - This is used for setting the dnd-kit feedback mode, cf. {@link resolveFeedback}.
     * - {@link isDraggingCard} otoh is delayed by one microtask so that the Feedback plugin can measure the dragged
     *   card size and position before a reflow triggered by setting this variable destroys the information (when using
     *   no drag placeholders).
     * - Both are set/unset in {@link handleDragStart} and {@link handleDragEnd}.
     */
    #dragLive = false

    // === INIT ========================================================================================================

    constructor() {
        ;[this.slotContent, this.#setSlotContent] = createStore<Record<string, CardId[]>>({})
        ;[this.isDraggingCard, this.#setIsDraggingCard] = createSignal(false)
    }

    // === UTILS =======================================================================================================

    /** Returns the id of the card slot currently holding `cardId`, or undefined. */
    #slotOf(cardId: CardId): SlotId | undefined {
        for (const slotId of Object.keys(this.slotContent) as SlotId[]) {
            if (this.slotContent[slotId]?.includes(cardId)) return slotId
        }
        return undefined
    }

    // === API =========================================================================================================

    /**
     * Called by {@link CardSlot} to registers itself with an id (or mints a memorable one), erroring on duplicate id.
     * @returns the slot id
     * @internal
     */
    readonly registerSlot = (id: string | undefined, config: SlotConfig): SlotId => {
        const slotId = id !== undefined ? recordId<SlotId>(this.#usedIds, id) : freshId<SlotId>(this.#usedIds)
        this.#setSlotContent(slotId, [])
        this.#slotConfig.set(slotId, config)
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
    readonly topCardOf = (slotId: string): CardId | undefined => {
        const cards = this.slotContent[slotId]
        return cards?.[cards.length - 1]
    }

    /**
     * Whether the card can be dropped in the slot.
     *
     * Used to determine what happens when dragging the card to the slot, as well as setting the highligh-ok and
     * highlight-no classes on the card slot.
     */
    readonly canDrop = (cardId: string, targetSlotId: string): boolean => {
        if (!(targetSlotId in this.slotContent)) return false
        const cfg = this.#slotConfig.get(targetSlotId as SlotId)!
        if (cfg.isDrop() === false) return false
        const src = this.#slotOf(cardId as CardId)
        // Should never happen: a dragged card stays in its slot until the drag ends.
        if (src === undefined) return false
        return cfg.canDrop?.()?.(src, cardId as CardId) ?? true
    }

    /**
     * Removes `cardId` from its current slot and inserts it into `toSlotId` at `index` (clamped to `[0, length]`).
     * Append with `index = length`.
     *
     * Currently never called for a card that is already in the destination slot.
     */
    readonly moveCard = (cardId: string, toSlotId: string, index: number): void => {
        const fromSlot = this.#slotOf(cardId as CardId)
        if (fromSlot === undefined || !(toSlotId in this.slotContent)) return
        this.#setSlotContent(
            produce(loc => {
                const from = loc[fromSlot]
                from.splice(from.indexOf(cardId as CardId), 1)
                const to = loc[toSlotId]
                to.splice(Math.max(0, Math.min(index, to.length)), 0, cardId as CardId)
            }),
        )
    }

    /**
     * Registers a new card, rendering `component` with `props`, into the {@link CardSlot} with the given `slotId`.
     * The component is instantiated by whichever slot displays the card (see {@link renderCard}).
     *
     * The `component` render function is invoked every time the card enters a new slot. As such, the component's
     * internal state doesn't survive slot moves and needs to be entirely derivable from external stores and signals.
     *
     * @returns the new card's id.
     */
    readonly spawn = <P extends Record<string, unknown>>(
        args: {
            slotId: string
            component: Component<P>
            cardId?: string
        } & (Record<never, never> extends P ? { props?: P } : { props: P }),
    ): CardId => {
        const { slotId, component } = args
        const props = (args.props ?? {}) as P
        const cardId = args.cardId ? recordId<CardId>(this.#usedIds, args.cardId) : freshId<CardId>(this.#usedIds)
        this.#cardRegistry.set(cardId, () => createComponent(component, props))
        this.#setSlotContent(slotId, cards => [...cards, cardId])
        return cardId
    }

    /**
     * Renders a fresh instance of the card's user component (undefined for an unknown card).
     * @internal
     */
    readonly renderCard = (cardId: CardId): JSX.Element => {
        return this.#cardRegistry.get(cardId)?.()
    }

    /**
     * Resolves the @dnd-kit feedback mode for the card being dragged or dropped.
     *
     * For cards being dragged, the feedback mode derives from {@link CardSlotProps#dragPlaceholder} (cf.
     * {@link DragPlaceholderMode})
     *
     * - both "ghost" and "none" map to "default" feedback: dnd-kit leave a hidden space-keeping placeholder behind
     *   - for "none" we simply manually remove the element from the usual flow in {@link CardSlot} so it doesn't take
     *     up any space in the layout (but the element still exists)
     * - "clone" maps to "clone" feedback — instead of a space-keeping placeholder, a clone is left behind, which
     *   is synchronized with the element being dragged
     *
     * For cards being dropped, the feedback mode is always "default", we want the card drop to animate into the
     * empty placeholder.
     *
     * @internal
     */
    readonly resolveFeedback = (cardId: string | number): "default" | "clone" => {
        if (!this.#dragLive) return "default"
        const slotId = typeof cardId === "string" ? this.#slotOf(cardId as CardId) : undefined
        const cfg = slotId !== undefined ? this.#slotConfig.get(slotId) : undefined
        return (cfg?.dragPlaceholder?.() ?? "none") === "clone" ? "clone" : "default"
    }

    /** Records that a drag is live (see {@link isDraggingCard}). */
    readonly handleDragStart = (_event: Parameters<NonNullable<DragDropProviderProps["onDragStart"]>>[0]): void => {
        /** cf. `#dragLive` docstring for explanations */
        this.#dragLive = true
        queueMicrotask(() => {
            if (this.#dragLive) this.#setIsDraggingCard(true)
        })
    }

    /** Applies a drop: moves the dragged card onto the top of a valid target slot. */
    readonly handleDragEnd = (event: Parameters<NonNullable<DragDropProviderProps["onDragEnd"]>>[0]): void => {
        try {
            if (event.canceled) return
            const cardId = event.operation.source?.id
            if (typeof cardId !== "string") return

            const targetSlot = event.operation.target?.id
            if (typeof targetSlot !== "string" || !(targetSlot in this.slotContent)) return

            const sourceSlot = this.#slotOf(cardId as CardId)
            if (sourceSlot === undefined || sourceSlot === targetSlot) return

            if (!this.canDrop(cardId, targetSlot)) return

            this.moveCard(cardId, targetSlot, this.slotContent[targetSlot].length)
        } finally {
            this.#dragLive = false
            this.#setIsDraggingCard(false)
        }
    }
}
