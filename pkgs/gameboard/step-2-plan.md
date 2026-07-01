# Step 2 Plan — multi-card slots, layouts, drag/drop rules

This is the implementation plan for Step 2 of the [GameBoard spec](./spec.md). It builds on the **golden state** of
Step 1 (the repo, *not* `step-1-plan.md`, which described a reparenting model we did not adopt — cards are re-rendered
from thunks on move, matching the spec's "a move does not preserve internal state").

## Scope

**In:**

- Layouts: `STACKED` (default) and `STAGGER_{TL,TR,BL,BR}`, with `staggerX` / `staggerY` offsets (default `14px` each).
- `isDrag` (`true` / `false` / `"top"`) + `canDrag`.
- `isDrop` (`true` / `false` / `"top"`) + `canDrop`.
- Genuinely multi-card slots: a drop **appends to the top** of the target slot; `highlight-ok` / `highlight-no` reflect
  *real* drop validity during a drag.

**Deferred** (unchanged from Step 1, plus new): `FREE` layout, `STAGGER_BG_*`, `FANOUT_*`, `dragZone` / ghost cards,
`forward`, `onClick` / `onClickComponent`, `onDragStart` / `onDragEnd` / `disableDragStart` / `disableDragEnd`,
`width` / `height`, `classes`, `FreeDragArea`, in-slot reordering / positional (between-cards) drop.

## Decisions (resolved during design)

1. **`end = top`.** The last element of `slotContent[id]` is the topmost / most-recently-added card. `spawn` and drops
   both append, so the freshest card is on top.
2. **`STAGGER_<corner>`:** the **top** card sits flush in the named corner with the highest `z-index`; lower cards are
   offset *away* from the corner (toward the slot interior). `STAGGER_TL` → top card top-left, others fan toward
   bottom-right. The other three corners mirror the axis signs.
3. **Drop = append to top; the Step-1 swap is removed.** A drop only ever moves the dragged card; nothing bounces back.
   *(Future: swap is re-enabled by a user `onDragEnd` calling `moveCard` — see Forward-looking notes.)*
4. **`isDrop: "top"` aliases `isDrop: true` in Step 2.** With no positional/ghost drop zones yet, "drop anywhere in
   slot" and "drop onto top" are indistinguishable (every drop appends to top). The value is accepted and documented as
   a no-op-for-now to keep the API stable.
5. **`canDrop`'s `dst` = the target slot's current top card id, or `null` if the slot is empty.** This folds the
   empty-slot case into the same `null` contract the spec reserves for ghost areas, and generalizes unchanged when
   positional targets arrive.
6. **Draggability is reactive via a getter-backed `disabled`** (never a precomputed boolean). dnd-kit's `useDraggable`
   syncs `draggable.disabled` inside a `createEffect` (see `@dnd-kit/solid` `index.js`), so passing `disabled` as a
   getter lets any reactive source it touches (the `slotContent` "is-top" read **and** a store referenced by
   `canDrag`) be tracked and update live. Users write `canDrag` as a plain function; no special provision is
   required on their side.
7. **Highlight is shown only on the hovered target slot**, computed from a single `canDrop` predicate that
   `handleDragEnd` also uses to reject invalid drops — one source of truth, zero drift.
8. **Layout positioning** uses **inline computed styles** (dynamic per-index `transform` + `z-index`) on
   `position: absolute` cards inside a `position: relative` mount. `STACKED` centers all cards; `STAGGER_*` anchors to
   the corner. Structural styles are set by the component so layouts work without user CSS; cosmetics stay in CSS.
9. **Per-slot drop rules are registered into the controller**; `isDrag` / `canDrag` stay local to the slot (it
   renders its own cards). Three future-proofing seams are adopted now: a `moveCard(cardId, toSlot, index)` placement
   primitive, an isolated "resolve dnd-kit target → `(slotId, index)`" section in `handleDragEnd`, and a
   controller-owned `canDrop` with membership-mutation as the *default* action (room for future effect-only drops).

## Steps (in dependency order)

### 1. Controller — `src/GameBoardContext.ts`

**New types** (exported):

```typescript
/** Multi-card layouts supported in Step 2. `FREE`, `STAGGER_BG_*`, `FANOUT_*` are deferred. */
export type SlotLayout = "STACKED" | "STAGGER_TL" | "STAGGER_TR" | "STAGGER_BL" | "STAGGER_BR"

/** A slot's drop rules, registered with the controller so the central drag handler can enforce them. */
export interface SlotConfig {
    readonly isDrop: boolean | "top"
    readonly canDrop?: (src: string, dst: string | null) => boolean
}
```

**New state:** `readonly #slotConfig = new Map<string, SlotConfig>()`.

**`registerSlot(id?, config?)`** — extend to accept a `SlotConfig` and store it under the resolved slot id; delete it in
the existing `onCleanup`. The config object is passed with **getters backed by the slot's props** (so reads are
reactive), e.g. from `CardSlot`:

```typescript
const id = board.registerSlot(props.id, {
    get isDrop() { return props.isDrop ?? true },
    get canDrop() { return props.canDrop },
})
```

**`topCardOf(slotId)`** — helper returning the last element of `slotContent[slotId]`, or `undefined`.

**`canDrop(srcCardId, targetSlotId): boolean`** — the single drop-validity predicate (consumed by both the slot
highlight and `handleDragEnd`):

```typescript
readonly canDrop = (srcCardId: string, targetSlotId: string): boolean => {
    if (!(targetSlotId in this.slotContent)) return false
    const cfg = this.#slotConfig.get(targetSlotId)
    const isDrop = cfg?.isDrop ?? true        // default permissive; "top" treated as true (Step 2)
    if (isDrop === false) return false
    const dst = this.topCardOf(targetSlotId) ?? null
    return cfg?.canDrop?.(srcCardId, dst) ?? true
}
```

**`moveCard(cardId, toSlotId, index): void`** — the placement primitive. Removes the card from its current slot and
inserts it into `toSlotId` at `index` (clamped to `[0, length]`). Append = `index = targetLength`. General enough for
future positional inserts; the same-slot guard lives in the caller, not here.

```typescript
readonly moveCard = (cardId: string, toSlotId: string, index: number): void => {
    const fromSlot = this.#slotOf(cardId)
    if (fromSlot === undefined || !(toSlotId in this.slotContent)) return
    this.#setSlotContent(produce(loc => {
        const from = loc[fromSlot]
        from.splice(from.indexOf(cardId), 1)
        const to = loc[toSlotId]
        to.splice(Math.max(0, Math.min(index, to.length)), 0, cardId)
    }))
}
```

**`handleDragEnd`** — rewrite to delete the swap and route through `canDrop` + `moveCard`, with the target resolution
isolated as its own clearly-commented section (the future seam for card/gap droppables):

```typescript
readonly handleDragEnd = (event): void => {
    if (event.canceled) return
    const cardId = event.operation.source?.id
    if (typeof cardId !== "string") return

    // Resolve dnd-kit target → (slotId, index). Step 2: target.id IS a slot, drop appends to the end.
    // Future card/gap droppables enrich only this section (e.g. reading a `data` payload for an insert index).
    const targetSlot = event.operation.target?.id
    if (typeof targetSlot !== "string" || !(targetSlot in this.slotContent)) return

    const sourceSlot = this.#slotOf(cardId)
    if (sourceSlot === undefined || sourceSlot === targetSlot) return   // same-slot drop is a no-op for now
    if (!this.canDrop(cardId, targetSlot)) return                       // invalid → don't mutate; card stays put

    // Membership mutation is the DEFAULT drop action (future effect-only drops via deferred onDragEnd/disableDragEnd).
    this.moveCard(cardId, targetSlot, this.slotContent[targetSlot].length)
}
```

### 2. CardSlot — `src/CardSlot.tsx`

**Props** — expand `CardSlotProps`:

```typescript
export interface CardSlotProps {
    id?: string
    layout?: SlotLayout                                   // default "STACKED"
    staggerX?: string                                     // CSS unit, default "14px" (STAGGER_* only)
    staggerY?: string                                     // CSS unit, default "14px" (STAGGER_* only)
    isDrag?: boolean | "top"                              // default true
    canDrag?: (cardId: string) => boolean
    isDrop?: boolean | "top"                              // default true ("top" aliases true in Step 2)
    canDrop?: (src: string, dst: string | null) => boolean
}
```

**Registration:** `board.registerSlot(props.id, { get isDrop()…, get canDrop()… })` (getters as above).

**Highlight:** use `useDragOperation()` to compute a `validity` of `"none" | "ok" | "no"`, suppressing highlight on the
slot the dragged card originates from (a same-slot drop is a no-op, so it must not read as a valid target):

```typescript
const op = useDragOperation()
const validity = (): "none" | "ok" | "no" => {
    const active = op.source()?.id
    if (typeof active !== "string" || op.target()?.id !== id) return "none"
    if (board.slotContent[id].includes(active)) return "none"   // dragged card is from this slot → no-op
    return board.canDrop(active, id) ? "ok" : "no"
}
// classList={{ "highlight-ok": validity() === "ok", "highlight-no": validity() === "no" }}
```

**Render:** the mount gets `position: relative` (inline). Pass the per-card layout inputs to `<Card>`; rely on Solid's
compiler wrapping component-prop expressions in getters so `index`, `total`, and `isTop` stay reactive:

```tsx
<div class="gb-slot" classList={{ "highlight-ok": validity() === "ok", "highlight-no": validity() === "no" }}
     ref={el => droppable.ref(el)}>
    <div class="gb-slot-mount" style={{ position: "relative" }}>
        <For each={board.slotContent[id]}>
            {(cardId, index) => (
                <Card
                    cardId={cardId}
                    layout={props.layout ?? "STACKED"}
                    index={index()}
                    total={board.slotContent[id].length}
                    isTop={cardId === board.topCardOf(id)}
                    staggerX={props.staggerX ?? "14px"}
                    staggerY={props.staggerY ?? "14px"}
                    isDrag={props.isDrag ?? true}
                    canDrag={props.canDrag}
                >
                    {board.renderCard(cardId)}
                </Card>
            )}
        </For>
    </div>
</div>
```

### 3. Card — `src/CardSlot.tsx` (same file)

**Reactive draggability** via getter-backed `disabled`, and **inline layout style** merged with the existing
drag-visibility toggle:

```typescript
function Card(props: {
    cardId: string; layout: SlotLayout; index: number; total: number; isTop: boolean
    staggerX: string; staggerY: string; isDrag: boolean | "top"
    canDrag?: (cardId: string) => boolean; children?: JSX.Element
}): JSX.Element {
    const draggable = useDraggable({
        id: props.cardId,
        get disabled() {
            const dragOk = props.isDrag === true || (props.isDrag === "top" && props.isTop)
            if (!dragOk) return true
            return props.canDrag ? !props.canDrag(props.cardId) : false
        },
    })
    return (
        <div
            class="gb-card"
            style={{
                ...cardStyle(props.layout, props.index, props.total, props.staggerX, props.staggerY),
                visibility: draggable.isDragging() || draggable.isDropping() ? "hidden" : "visible",
            }}
            ref={el => draggable.ref(el)}
        >
            {props.children}
        </div>
    )
}
```

**`cardStyle`** — pure helper computing absolute placement + stacking (`z-index = index`, so the top/last card is
front-most):

```typescript
function cardStyle(layout: SlotLayout, index: number, total: number, sx: string, sy: string): JSX.CSSProperties {
    if (layout === "STACKED")
        return { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", "z-index": index }

    const steps = total - 1 - index                 // 0 for the top card, growing toward the bottom of the stack
    const dx = `calc(${sx} * ${steps})`
    const dy = `calc(${sy} * ${steps})`
    const base = { position: "absolute" as const, "z-index": index }
    switch (layout) {
        case "STAGGER_TL": return { ...base, top: 0, left: 0, transform: `translate(${dx}, ${dy})` }
        case "STAGGER_TR": return { ...base, top: 0, right: 0, transform: `translate(calc(-1 * ${dx}), ${dy})` }
        case "STAGGER_BL": return { ...base, bottom: 0, left: 0, transform: `translate(${dx}, calc(-1 * ${dy}))` }
        case "STAGGER_BR": return { ...base, bottom: 0, right: 0, transform: `translate(calc(-1 * ${dx}), calc(-1 * ${dy}))` }
    }
}
```

### 4. Exports — `src/export.ts`

Export the new public type(s): `SlotLayout` (and `SlotConfig` if we consider it public — likely yes for typing custom
controllers later).

> **Note — `gameboard` is a library.** The demo/manual-test app (`App.tsx`, `index.tsx`, `index.html`, and the demo
> CSS) does **not** live in `pkgs/gameboard`. It lives in a separate **`playground`** package that consumes
> `@norswap/gameboard` as a dependency. Step 1's demo currently sits inside `pkgs/gameboard/src` — it will be moved into
> `playground` (seeded as a separate task, before/alongside this work) and removed from the library. The library ships
> only the component + controller + types; it has no `index.html` / app entry of its own.

### 5. Playground demo — `pkgs/playground`

Exercise every new prop in the `playground` package (which imports from `@norswap/gameboard`). Spawn several cards,
tracking a demo-side `Map<cardId, { suit, color }>` so the `canDrop` example can decide by card identity (the
controller passes only ids):

- **Deck** — `layout="STACKED"`, `isDrag="top"`: a pile; only the top card drags.
- **Hand** — `layout="STAGGER_BR"` (or another corner), `isDrag=true`: several fanned cards, all draggable.
- **Discard** — `isDrop` + `canDrop` accepting only e.g. red cards (look up suit/color in the demo map): dragging a
  black card over it shows `highlight-no` and bounces back; a red card appends on top.
- **Locked** — `isDrag={false}`: holds a card that cannot be dragged out.

### 6. CSS — playground's `index.html` (or stylesheet)

- Add `.gb-slot.highlight-no { border-color: #c62828; background: #ffebee; }`.
- Enlarge the deck/hand/discard slots enough to show staggered fans (the absolutely-positioned cards do not size the
  slot, so the slot needs explicit dimensions — provided by playground CSS, since `width`/`height` props are deferred).
- The component sets `position: relative` on the mount and `position: absolute` on cards inline, so the existing
  `.gb-slot-mount` flex-centering is harmless (absolute children ignore it).

### 7. Verify

- Library: `make build pkg=@norswap/gameboard`, `make lintfix` then `make lint`,
  `make typecheck pkg=@norswap/gameboard` (plus the same for `playground`).
- Run the `playground` dev server and drive it in the browser (Playwright):
    - `STACKED` shows only the top card; `STAGGER_*` fans toward the correct corner with the top card flush in it.
    - `isDrag="top"` lets only the top card drag; `isDrag=false` locks the slot.
    - A `canDrop`-rejected hover shows `highlight-no` and the card returns to its origin; a valid hover shows
      `highlight-ok` and the drop appends on top.
    - After moving a card, it is immediately draggable again (dnd-kit re-measures on the next drag — Step 1 watch item).
    - Getter-backed `disabled` reactivity: after dragging the top card off a `isDrag="top"` pile, the new top becomes
      draggable without interaction.

## Forward-looking notes (documented, not built)

- **Swap** is reintroduced later by a user `onDragEnd` (deferred) calling `moveCard` to push the displaced resident back
  to the source slot — no special-casing in the core.
- **Positional / between-cards drop** is additive: add per-card and per-gap droppables, enrich only the isolated target
  resolver in `handleDragEnd` to produce an insert `index`, and reuse `moveCard` unchanged. `canDrop`'s `dst`
  contract ("the card you'd land on", `null` if none) already generalizes.
- **Effect-vs-move drops** (dropping onto a card for a gameplay effect rather than a move): `handleDragEnd` treats
  membership mutation as the *default* action, leaving room for the deferred `disableDragEnd` + `onDragEnd` hooks to
  suppress/augment it.
- **Per-card / per-gap highlighting**: when cards/gaps become droppables, each computes its own highlight via the same
  controller `canDrop` predicate — the reason `canDrop` lives on the controller as the single evolvable signature.
- **Card metadata for filters**: `canDrag` / `canDrop` receive only ids, so identity-based filtering requires
  the user to track their own `cardId → metadata` map (as the demo does). A future `spawn` could optionally attach
  metadata to ease this.
