import { DragDropProvider, DragOverlay } from "@dnd-kit/solid"
import type { JSX } from "solid-js"
import { GameBoardContext, GameBoardController } from "./GameBoardContext"

/**
 * Game board within which card drag and drop is possible.
 * Multiple boards may coexist on a page but must not nest.
 */
export function GameBoard(props: { children?: JSX.Element }): JSX.Element {
    const board = new GameBoardController()
    return (
        <DragDropProvider onDragEnd={event => board.handleDragEnd(event)}>
            <GameBoardContext.Provider value={board}>
                {props.children}
                <DragOverlay>{source => board.renderCard(source.id as string)}</DragOverlay>
            </GameBoardContext.Provider>
        </DragDropProvider>
    )
}
