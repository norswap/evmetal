import { type Context, createContext, useContext } from "solid-js"
import type { GameBoardController } from "#src/GameBoardController"

export const GameBoardContext: Context<GameBoardController | undefined> = createContext<GameBoardController>()

/** Returns the game board controller; throws if used outside a `<GameBoard>`. */
export function useGameBoard(): GameBoardController {
    const ctrl = useContext(GameBoardContext)
    if (!ctrl) throw new Error("useGameBoard must be used within a <GameBoard>")
    return ctrl
}
