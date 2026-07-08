import { CardSlot, GameBoard, type GameBoardController, type SlotLayout, useGameBoard } from "@norswap/gameboard"
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
        spawnCard(board, "deck", "5♣", "black")
        spawnCard(board, "deck", "9♥", "red")
        spawnCard(board, "deck", "K♠", "black")
        spawnCard(board, "hand", "A♠", "black")
        spawnCard(board, "hand", "10♥", "red")
        spawnCard(board, "hand", "J♦", "red")
        spawnCard(board, "hand", "2♦", "red")
        spawnCard(board, "hand", "3♣", "black")
        spawnCard(board, "hand", "4♥", "red")
        spawnCard(board, "hand", "5♦", "red")
        spawnCard(board, "discard", "3♥", "red")
        spawnCard(board, "discard", "8♦", "red")
        spawnCard(board, "discard", "K♥", "red")
        spawnCard(board, "discard", "2♥", "red")
        spawnCard(board, "discard", "4♦", "red")
        spawnCard(board, "discard", "6♥", "red")
        spawnCard(board, "discard", "7♦", "red")
        spawnCard(board, "locked", "4♣", "black")
        spawnCard(board, "locked", "9♠", "black")
        spawnCard(board, "locked", "5♠", "black")
        spawnCard(board, "locked", "6♠", "black")
        spawnCard(board, "locked", "7♣", "black")
        spawnCard(board, "locked", "8♣", "black")
        spawnCard(board, "locked", "10♠", "black")
        spawnCard(board, "free-none", "6♣", "black")
        spawnCard(board, "free-none", "J♥", "red")
        spawnCard(board, "free-none", "A♦", "red")
        spawnCard(board, "free-clone", "Q♦", "red")
        spawnCard(board, "free-clone", "K♣", "black")
        spawnCard(board, "free-clone", "9♣", "black")
        spawnCard(board, "free-ghost", "2♠", "black")
        spawnCard(board, "free-ghost", "3♦", "red")
        spawnCard(board, "free-ghost", "4♠", "black")
        spawnCard(board, "stagger-none", "A♣", "black")
        spawnCard(board, "stagger-none", "2♣", "black")
        spawnCard(board, "stagger-none", "3♠", "black")
        spawnCard(board, "stagger-none", "4♦", "red")
        spawnCard(board, "stagger-none", "5♣", "black")
        spawnCard(board, "stagger-clone", "6♦", "red")
        spawnCard(board, "stagger-clone", "7♥", "red")
        spawnCard(board, "stagger-clone", "8♥", "red")
        spawnCard(board, "stagger-clone", "9♦", "red")
        spawnCard(board, "stagger-clone", "10♣", "black")
        spawnCard(board, "stagger-ghost", "J♣", "black")
        spawnCard(board, "stagger-ghost", "Q♥", "red")
        spawnCard(board, "stagger-ghost", "K♦", "red")
        spawnCard(board, "stagger-ghost", "A♥", "red")
        spawnCard(board, "stagger-ghost", "2♥", "red")
    })
    return null
}

/** Layout shared by the three stagger-row slots: a horizontal 3-card window over 5 cards, with the overflow cue. */
const staggerRowLayout: SlotLayout = {
    kind: "STAGGER_TR",
    staggerX: "116px",
    staggerY: "0px",
    grow: true,
    maxDisplayed: 3,
    cueExtra: { borderRadius: "8px" },
}

const freeRowLayout: SlotLayout = { kind: "FREE" }

/** Demo app exercising Step 2: layouts, drag rules, and a colour-based canDrop. */
export function App(): JSX.Element {
    return (
        <main>
            <h1>Gameboard</h1>
            <ul>
                <li>
                    <b>First row</b>: tightly staggered layouts. All centered, all growing.
                    <ul>
                        <li>
                            <b>Deck</b> — STAGGER_TL, max 1, max cue 3.
                        </li>
                        <li>
                            <b>Discard</b> accepts only red cards — STAGGER_TL, max 4, max cue 3.
                        </li>
                        <li>
                            <b>Locked</b> can't be dragged out of — STAGGER_BR, max 4, max cue 3.
                        </li>
                    </ul>
                </li>
                <li>
                    <b>Second row — free rows</b>: FREE layouts using CSS flew to lay cards out in a row.
                    <ul>
                        <li>
                            One per <em>none/clone/ghost</em> drag placeholder.
                        </li>
                    </ul>
                </li>
                <li>
                    <b>Third row — stagger rows</b>: use STAGGER_BR layout with no y-offset and a large x-offset to lay
                    cards out in a row.
                    <ul>
                        <li>
                            One per <em>none/clone/ghost</em> drag placeholder — max 3, max cue 2.
                        </li>
                    </ul>
                </li>
            </ul>
            <GameBoard>
                <div class="demo-board">
                    <div class="demo-col">
                        <span class="demo-label">Deck</span>
                        <CardSlot
                            id="deck"
                            layout={{
                                kind: "STAGGER_TL",
                                centered: true,
                                maxDisplayed: 1,
                                cueExtra: { offsetX: "3px", offsetY: "3px", borderRadius: "8px" },
                            }}
                            isDrag="top"
                        />
                    </div>
                    <div class="demo-col">
                        <span class="demo-label">Hand</span>
                        <CardSlot
                            id="hand"
                            layout={{
                                kind: "STAGGER_TL",
                                centered: true,
                                maxDisplayed: 4,
                                cueExtra: { borderRadius: "8px" },
                                grow: true,
                            }}
                            isDrag="top"
                        />
                    </div>
                    <div class="demo-col">
                        <span class="demo-label">Discard</span>
                        <CardSlot
                            id="discard"
                            layout={{
                                kind: "STAGGER_TR",
                                centered: true,
                                maxDisplayed: 4,
                                cueExtra: { borderRadius: "8px" },
                                grow: true,
                            }}
                            isDrag="top"
                            canDrop={(_src, cardId) => cardMeta.get(cardId)?.color === "red"}
                        />
                    </div>
                    <div class="demo-col">
                        <span class="demo-label">Locked</span>
                        <CardSlot
                            id="locked"
                            layout={{
                                kind: "STAGGER_BR",
                                centered: true,
                                maxDisplayed: 4,
                                cueExtra: { borderRadius: "8px" },
                                grow: true,
                            }}
                            isDrag={false}
                        />
                    </div>
                </div>
                <div class="demo-rows">
                    <div class="demo-col demo-free">
                        <span class="demo-label">Free row (none)</span>
                        <CardSlot id="free-none" layout={freeRowLayout} isDrag={true} />
                    </div>
                    <div class="demo-col demo-free demo-clone">
                        <span class="demo-label">Free row (clone)</span>
                        <CardSlot id="free-clone" layout={freeRowLayout} isDrag={true} dragPlaceholder="clone" />
                    </div>
                    <div class="demo-col demo-free">
                        <span class="demo-label">Free row (ghost)</span>
                        <CardSlot id="free-ghost" layout={freeRowLayout} isDrag={true} dragPlaceholder="ghost" />
                    </div>
                </div>
                <div class="demo-rows">
                    <div class="demo-col">
                        <span class="demo-label">Stagger row (none)</span>
                        <CardSlot id="stagger-none" layout={staggerRowLayout} isDrag="top" />
                    </div>
                    <div class="demo-col demo-clone">
                        <span class="demo-label">Stagger row (clone)</span>
                        <CardSlot id="stagger-clone" layout={staggerRowLayout} isDrag="top" dragPlaceholder="clone" />
                    </div>
                    <div class="demo-col">
                        <span class="demo-label">Stagger row (ghost)</span>
                        <CardSlot id="stagger-ghost" layout={staggerRowLayout} isDrag="top" dragPlaceholder="ghost" />
                    </div>
                </div>
                <Setup />
            </GameBoard>
        </main>
    )
}
