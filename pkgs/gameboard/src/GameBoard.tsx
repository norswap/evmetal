import { DragDropProvider, DragOverlay, useDragDropMonitor } from "@dnd-kit/solid"
import { getOwner, type JSX } from "solid-js"
import { createGameBoard, type GameBoardApi, GameBoardContext } from "./context"

/** Props for the GameBoard root component. */
export interface GameBoardProps {
    children?: JSX.Element
}

// Rendered inside BOTH the dnd-kit provider and our context provider, so the owner it captures resolves both. Cards are
// later rendered under detached roots parented to this owner (see GameBoardApi.spawn), which is why the owner must sit
// below both providers. Also wires the drag-end handler and hosts the shared drag overlay.
function BoardRuntime(props: { board: GameBoardApi; children?: JSX.Element }): JSX.Element {
    const owner = getOwner()
    if (!owner) throw new Error("GameBoard: no reactive owner available")
    props.board.setOwner(owner)
    useDragDropMonitor({ onDragEnd: event => props.board.handleDragEnd(event) })
    return (
        <>
            {props.children}
            <DragOverlay>{source => props.board.overlay(source.id)}</DragOverlay>
        </>
    )
}

/**
 * Root of a card game board. Provides per-board state and a dnd-kit drag-and-drop context to its descendant
 * `<CardSlot>` and `<Card>` components. Multiple boards may coexist on a page but must not nest.
 */
export function GameBoard(props: GameBoardProps): JSX.Element {
    const board = createGameBoard()
    return (
        <DragDropProvider>
            <GameBoardContext.Provider value={board}>
                <BoardRuntime board={board}>{props.children}</BoardRuntime>
            </GameBoardContext.Provider>
        </DragDropProvider>
    )
}
