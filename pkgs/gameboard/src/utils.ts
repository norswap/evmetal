import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator"

/** Generates a memorable two-word id, e.g. "calm-otter". */
function memorableId(): string {
    return uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: "-", length: 2 })
}

/** Returns a memorable id not already present in `used`, recording it. */
export function freshId(used: Set<string>): string {
    let id = memorableId()
    while (used.has(id)) id = memorableId()
    used.add(id)
    return id
}

/** Adds {@link id} to {@linkd used} then return it, or throw an error if the id is already in use. */
export function recordId(used: Set<string>, id: string): string {
    if (used.has(id)) throw new Error(`duplicate id ${id}`)
    used.add(id)
    return id
}
