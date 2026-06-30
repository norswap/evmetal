import { type JSX, onMount } from "solid-js"
import { CardSlot } from "./CardSlot"
import { GameBoard } from "./GameBoard"
import { useGameBoard } from "./GameBoardContext"

// A tiny demo card visual; the draggable Card chrome is supplied by `board.spawn`.
function PlayingCard(props: { label: string; color: string }): JSX.Element {
    return (
        <div class="demo-card" style={{ "background-color": props.color }}>
            {props.label}
        </div>
    )
}

// Spawns the initial cards once the board and its slots are mounted.
function Setup(): JSX.Element {
    const board = useGameBoard()
    onMount(() => {
        board.spawn({ slotId: "hand", component: PlayingCard, props: { label: "A♠", color: "#f5f5f5" } })
        board.spawn({ slotId: "discard", component: PlayingCard, props: { label: "K♥", color: "#ffe0e0" } })
    })
    return null
}

/** Demo app exercising drag between single-card slots, with swap on an occupied target. */
export function App(): JSX.Element {
    return (
        <main>
            <h1>Gameboard</h1>
            <p>Drag a card onto another slot. Dropping onto an occupied slot swaps the two cards.</p>
            <GameBoard>
                <div class="demo-board">
                    <CardSlot id="hand" />
                    <CardSlot id="discard" />
                    <CardSlot id="free" />
                </div>
                <Setup />
            </GameBoard>
        </main>
    )
}
