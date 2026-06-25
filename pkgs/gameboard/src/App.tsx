import { type JSX, onMount } from "solid-js"
import { Card } from "./Card"
import { CardSlot } from "./CardSlot"
import { useGameBoard } from "./context"
import { GameBoard } from "./GameBoard"

// A tiny demo card visual wrapped in the draggable Card chrome.
function PlayingCard(props: { label: string; color: string }): JSX.Element {
    return (
        <Card source>
            <div class="demo-card" style={{ "background-color": props.color }}>
                {props.label}
            </div>
        </Card>
    )
}

// Spawns the initial cards once the board and its slots are mounted.
function Setup(): JSX.Element {
    const board = useGameBoard()
    onMount(() => {
        board.spawn("hand", PlayingCard, { label: "A♠", color: "#f5f5f5" })
        board.spawn("discard", PlayingCard, { label: "K♥", color: "#ffe0e0" })
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
