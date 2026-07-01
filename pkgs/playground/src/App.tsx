import { CardSlot, GameBoard, type GameBoardController, useGameBoard } from "@norswap/gameboard"
import { type JSX, onMount } from "solid-js"

/** Suit/colour metadata the demo tracks per card id, since the controller passes only ids to filters. */
const cardMeta = new Map<string, { label: string; color: "red" | "black" }>()

// A tiny demo card visual; the draggable Card chrome is supplied by `board.spawn`.
function PlayingCard(props: { label: string; color: "red" | "black" }): JSX.Element {
    return (
        <div class="demo-card" style={{ color: props.color === "red" ? "#c62828" : "#111" }}>
            {props.label}
        </div>
    )
}

/** Spawns a card and records its colour so `canDrop` can decide by identity. */
function spawnCard(board: GameBoardController, slotId: string, label: string, color: "red" | "black"): void {
    const cardId = board.spawn({ slotId, component: PlayingCard, props: { label, color } })
    cardMeta.set(cardId, { label, color })
}

// Spawns the initial cards once the board and its slots are mounted.
function Setup(): JSX.Element {
    const board = useGameBoard()
    onMount(() => {
        spawnCard(board, "deck", "2♣", "black")
        spawnCard(board, "deck", "7♦", "red")
        spawnCard(board, "deck", "Q♠", "black")
        spawnCard(board, "hand", "A♠", "black")
        spawnCard(board, "hand", "10♥", "red")
        spawnCard(board, "hand", "J♦", "red")
        spawnCard(board, "discard", "3♥", "red")
        spawnCard(board, "discard", "8♦", "red")
        spawnCard(board, "discard", "K♥", "red")
        spawnCard(board, "locked", "4♣", "black")
        spawnCard(board, "locked", "9♠", "black")
        spawnCard(board, "locked", "5♠", "black")
    })
    return null
}

/** Demo app exercising Step 2: layouts, drag rules, and a colour-based canDrop. */
export function App(): JSX.Element {
    return (
        <main>
            <h1>Gameboard</h1>
            <p>
                Deck is stacked and deals from the top; hand, discard and locked fan out (centered) in different
                directions; discard accepts only red cards; the locked pile can't be dragged out.
            </p>
            <GameBoard>
                <div class="demo-board">
                    <div class="demo-col">
                        <span class="demo-label">Deck (STACKED, top only)</span>
                        <CardSlot id="deck" layout="STACKED" isDrag="top" />
                    </div>
                    <div class="demo-col">
                        <span class="demo-label">Hand (STAGGER_TL, centered)</span>
                        <CardSlot id="hand" layout="STAGGER_TL" centered={true} isDrag={true} />
                    </div>
                    <div class="demo-col">
                        <span class="demo-label">Discard (STAGGER_TR, centered, red only)</span>
                        <CardSlot
                            id="discard"
                            layout="STAGGER_TR"
                            centered={true}
                            canDrop={src => cardMeta.get(src)?.color === "red"}
                        />
                    </div>
                    <div class="demo-col">
                        <span class="demo-label">Locked (STAGGER_BR, centered, no drag)</span>
                        <CardSlot id="locked" layout="STAGGER_BR" centered={true} isDrag={false} />
                    </div>
                </div>
                <Setup />
            </GameBoard>
        </main>
    )
}
