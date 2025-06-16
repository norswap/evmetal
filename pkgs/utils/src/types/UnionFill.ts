import type { Keys } from "#src/types/keys"
import type { Prettify, Select } from "#src/types/utils"

/**
 * Returns a copy of an union of objects, where each object is augmented with the
 * optional undefined-typed keys from the other objects that it does not have itself.
 *
 * e.g. `UnionFill<{ a: string } | { b: string }>` evaluates to
 * `{ a: string, b?: undefined } | { a?: undefined, b: string }`
 */
// biome-ignore-all format: readability
export type UnionFill<Union, Original = Union> = Prettify<
    [Union] extends [never]
        ? never
        : Select<Union> extends infer Member
            ? | ( & { [K in Exclude<Keys<Original>, keyof Member>]?: undefined }
                  & { [K in keyof Member]: Member[K] } )
              | UnionFill<Exclude<Union, Member>, Original>
            : never
>
