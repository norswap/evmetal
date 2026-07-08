import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator"

declare const idBrand: unique symbol

/** A {@link Card} id. */
export type CardId = string & { readonly [idBrand]: "card" }

/** A {@link CardSlot} id. */
export type SlotId = string & { readonly [idBrand]: "slot" }

/** Generates a memorable two-word id, e.g. "calm-otter". */
function memorableId(): string {
    return uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: "-", length: 2 })
}

/** Returns a memorable (never empty) id not already present in `used`, recording it. */
export function freshId<T extends string = string>(used: Set<string>): T {
    let id = memorableId()
    while (used.has(id)) id = memorableId()
    used.add(id)
    return id as T
}

/**
 * Validates a user-supplied {@link id}, records it in {@link used} and returns it branded.
 * Throws if the id is empty or already in use.
 */
export function recordId<T extends string = string>(used: Set<string>, id: string): T {
    if (id === "") throw new Error("GameBoard: id must not be an empty string")
    if (used.has(id)) throw new Error(`duplicate id ${id}`)
    used.add(id)
    return id as T
}
