import { useDraggable } from "@dnd-kit/solid"
import type { JSX } from "solid-js"
import type { CardId } from "#src/utils"

/** Everything a {@link CardSlot} computes to render one of its cards. */
export type CardDisplay = {
    /** Inline style positioning the card within the slot's `.gb-layout`. */
    style: JSX.CSSProperties
    /** Stacking index within the visible stack. The card at the bottom is index 0. */
    index: number
    /** Whether the card may currently be dragged. */
    isDraggable: boolean
    /** Whether this is the bottom-most displayed card. */
    isBottom: boolean
    /** Whether the `.gb-cue-extra` overflow cue is active on this card. */
    carriesExtraCue: boolean
    /** Whether the card is parked: dragged out and excluded from the layout. Adds the `gb-parked` class, whose
     * built-in rule (cf. {@link GameBoard}) hides the `[data-dnd-placeholder]` copy left under .gb-layout.
     * Only required for clone placeholders that get hidden because of {@link CardSlotProps.maxDisplayed}. */
    parked?: boolean
}

/**
 * The draggable wrapper around a card's user-rendered content.
 *
 * A fresh Card (and thus a fresh instance of the user component) is created whenever a card enters a slot.
 */
export function Card(props: { cardId: CardId; display: CardDisplay; children?: JSX.Element }): JSX.Element {
    const draggable = useDraggable({
        id: props.cardId,
        get disabled() {
            return !props.display.isDraggable
        },
    })
    return (
        <div
            class="gb-card"
            classList={{
                "gb-cue-extra": props.display.carriesExtraCue,
                "gb-bottom": props.display.isBottom,
                "gb-parked": props.display.parked,
            }}
            data-gb-card-id={props.cardId}
            data-gb-index={!props.display.parked ? props.display.index : null}
            style={props.display.style}
        >
            {/* This div is the draggable one. It exists because dnd-kit doesn't play nicely with transforms on the
                draggable elements, which we do apply. We also want to detach the dragged card from its classes and
                attributes (which have to do with its rendering inside a slot). */}
            <div style={{ width: "100%", height: "100%" }} ref={el => draggable.ref(el)}>
                {props.children}
            </div>
        </div>
    )
}
