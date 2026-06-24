# Step 1 Plan — simple cards & slots

This is the implementation plan for Step 1 of the [GameBoard spec](./spec.md). It assumes the architecture decided in
the spec's **Architecture Decisions** section.

**Scope:** `GameBoard`, `CardSlot`, `Card` with *no* layouts or advanced props. We only want to drag a card → slot and
between single-card slots, with swap on an occupied target. Everything else from the spec is deferred.

## Architecture recap (as decided)

- **Per-board context.** `GameBoard` = one dnd-kit `DragDropProvider` + its own stores + a captured board owner.
  Multiple boards are isolated; ids are unique **per board**.
- **Two structures in context:** a location store `slotId → cardId[]` (source of truth for membership) and a registry
  `cardId → { el, dispose }`, where `el` is the card's single root element (also dnd-kit's draggable ref target & what
  the reconciler reparents) and `dispose` tears down its `createRoot`. One `cardId` ↔ one instance ↔ one element; copies
  are distinct ids.
- **Render-once, reparent (model "ii"):** cards render once under `createRoot(fn, boardOwner)` (stable disposal + working
  context for dnd-kit); a reconciler reparents the *same* nodes between slot elements, so internal/DOM state survives
  moves.
- **Imperative authoring:** `board.spawn(slotId, Component, props)`. `<Card>` is draggable chrome (returns DOM,
  registers meta as props, `useDraggable`). No `cards` prop on `CardSlot`.
- **dnd-kit owns the gesture, we own placement:** `useDroppable` → `highlight-ok`/`highlight-no`; `onDragEnd` → store
  splice; `DragOverlay` is the drag visual. Occupied single-card slot → **swap**.

## Steps (in dependency order)

### 0. Dependencies

- `bun add @dnd-kit/solid unique-names-generator` in `pkgs/gameboard`. Both are single-package for now → direct deps,
  **not** the catalog (the catalog is only for deps shared across our own packages). Solid 1.9.10 already satisfies
  dnd-kit's ≥1.8 requirement.

### 1. Context & stores — `src/context.ts`

- `GameBoardContext` exposing: the `locations` store (`Record<slotId, cardId[]>`), the `registry`
  (`Map<cardId, CardEntry>`), the captured `boardOwner`, `spawn(...)`, `registerSlot` / `registerCard`, and the
  `currentCardId` channel used to pass the id from `spawn` down to `<Card>`.
- `useGameBoard()` hook; throws if used outside a board (this is also how we will later enforce "no nesting").
- Per-board uniqueness check on slot/card ids; auto-generate memorable ids via `unique-names-generator` when omitted.

### 2. `GameBoard` — `src/GameBoard.tsx`

- Capture `boardOwner = getOwner()`, create the stores, and render `<DragDropProvider onDragEnd={...}>` wrapping the
  context provider, its `children` (the slots), and a `<DragOverlay>`.
- `onDragEnd`: resolve `active` (cardId) → its source slot from `locations`; `operation.target.id` → target slot. Apply
  **swap** logic on the store (move active source → target; if target held a card, move it target → source). Drop is a
  no-op if the target is missing/invalid → the card stays put.
- `DragOverlay` shows a static clone of the active card's element (`entry.el.cloneNode(true)`) — a transient drag ghost
  needs no reactivity.

### 3. `CardSlot` — `src/CardSlot.tsx`

- Props (Step 1 subset): `id?`. Register the slot id; `useDroppable({ id })`.
- Render an outer div with the droppable `ref`; toggle `highlight-ok` / `highlight-no` from `isDropTarget` (Step 1:
  target is always valid → `highlight-ok`).
- An inner container element is the **reconciler mount point**. An effect keyed on `locations[id]` reparents each card's
  `el` into it via `insertBefore` / `appendChild` (the code is general and trivially handles 0/1 cards now).

### 4. `Card` — `src/Card.tsx`

- Props (Step 1 subset): `id?`, `source = true`, `children`.
- Read `currentCardId` from context (set by `spawn`); register meta `{ source }` under it.
- `useDraggable({ id: cardId, disabled: !source })`; return a draggable wrapper div (ref attached) around
  `props.children`.

### 5. `spawn` (in the context implementation)

- Generate a `cardId`; `createRoot((dispose) => { set currentCardId; render <Dynamic component={Component} {...props}/>
  }, boardOwner)`; the rendered `<Card>` registers its root element as `el`; store `{ el, dispose }` in the registry;
  push `cardId` into `locations[slotId]`. The reconciler does the rest. (`dispose` is called when the card is removed
  from the board, and for all remaining cards in the board's `onCleanup` — detached `createRoot`s are never torn down
  automatically.)

### 6. Demo & validation — `src/App.tsx`

- A `GameBoard` with ~3 `CardSlot`s; on mount, `spawn` a couple of simple cards (e.g. colored divs) into two slots.
  Manually drag: card → empty slot, and card → occupied slot (verify swap), and confirm the dragged element escapes slot
  clipping via the overlay.

### 7. Verify

- `make build pkg=@norswap/gameboard`, `make lintfix` then `make lint`, `make typecheck pkg=@norswap/gameboard`.
- `make dev pkg=@norswap/gameboard` and drive it in the browser to confirm: drag works, swap works, `highlight-ok`
  appears, and the overlay isn't clipped.
- **Watch item:** dnd-kit measures rects at drag start; since we reparent on drop, the *next* drag re-measures — confirm
  a card dragged into a new slot is then draggable out again (re-measurement is correct).

## Deliberately deferred to later steps

Layouts (`STAGGER*` / `STACKED` / `FANOUT*`), `dragZone` ghost areas, `forward`, `onClick` / `onClickComponent`,
`disableDragStart` / `disableDragEnd` custom behaviours, `FreeDragArea`, multi-card slots & ordered reconciliation,
`source: "top"`.
