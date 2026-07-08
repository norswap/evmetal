import { Feedback } from "@dnd-kit/dom"
import { DragDropProvider } from "@dnd-kit/solid"
import type { JSX } from "solid-js"
import { GameBoardContext } from "./GameBoardContext"
import { GameBoardController } from "./GameBoardController"

/**
 * Game board within which card drag and drop is possible.
 * Multiple boards may coexist on a page but must not nest.
 */
export function GameBoard(props: { children?: JSX.Element }): JSX.Element {
    const board = new GameBoardController()
    return (
        <DragDropProvider
            onDragStart={event => board.handleDragStart(event)}
            onDragEnd={event => board.handleDragEnd(event)}
            plugins={defaults =>
                defaults.map(plugin =>
                    plugin === Feedback
                        ? Feedback.configure({ feedback: source => board.resolveFeedback(source.id) })
                        : plugin,
                )
            }
        >
            {/* CSS rule to hide parked cards placeholders (dragged out and excluded from the layout).
                Only required for clone placeholders that get hidden because of {@link CardSlotProps.maxDisplayed}.
                This needs to live here because we need to hide the placeholder but not the actual card being dragged,
                which requires selected on a dnd-kit CSS attribute. */}
            <style>{".gb-card.gb-parked [data-dnd-placeholder] { visibility: hidden; }"}</style>
            <GameBoardContext.Provider value={board}>{props.children}</GameBoardContext.Provider>
        </DragDropProvider>
    )
}
