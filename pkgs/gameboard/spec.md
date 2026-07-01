# GameBoard Spec

We are building `<GameBoard>` Solid.js component to build card games.
The key requirement is drag-and-drop support for cards to and from dedicated slots.

This is an EARLY preview of what this library could look like. We'll take it step by step to build it.

## End State Exploration

`<GameBoard>` is a context-provider component, which also holds per-board state and drag and drop context.
We suport having multiple GameBoards per app, but they do not nest.

We will need the following subcomponents that can only appear as the descendant of a GameBoard:

- `<CardSlot>`: an area that can contain 0 or more cards (determined by global register) — doesn't take children
  components
- `<FreeDragArea>`: an area where card can freely be dragged around

The GameBoard manages the state via:

- a **slot content store** `slotId → ordered cardId[]` — the single source of truth for which cards are in which slot
- a **card registry** `cardId → () => JSX.Element`, recording how to render a card

`<CardSlot>` accepts the following props:

- `id`: optional string identifying the CardSlot — error if not unique in the GameBoard (accross components in this lib)
    - if not provided, generate a random memorable name, e.g. using the unique-names-generator library
- `layout`: an enum member of: `STAGGER_{TL,TR,BL,BR}` (representing the four corners: top left, etc — the top card is
  fully visible in the specified corner, other cards are staggered below), or `STACKED` (only top card visible), `FREE`
  (no layout applied, user controls via CSS), `STAGGER_BG_{TL,TR,BL,BR}` (use a rectangle with a class applied instead
  of
  rendering all cards in the stagger), `FANOUT_{TL,TR,BL,BR,TOP,BOT,LEFT,RIGHT}` laying the cards in a fan pattern, the
  direction indicates where the narrow part of the fan points to (default: `FREE`)
    - `staggerX`: if the layout is `STAGGER_XX` or `STAGGER_BG_XX`, the x-offset for each staggered card (as a CSS unit)
    - `staggerY`: idem for y-offset
    - need similar parameters to control fanout (will figure out later)
    - `staggerClass`: class class applied to the rectangle representing bottom cards when using `STAGGER_BG_XX`
- `dragZone`: if `isDrop == true`, either "rect" (full rectangular area of this slot), or a number that indicates a
  minimum number of "ghost cards" to define a drag area: the drag area will be the area that that number of cards would
  cover, if there are less
  than this number of cards in this slot (if there are more, use actual cards area instead) (default: 0)
    - if `layout == FREE`, then a value of 0 becomes equivalent to "rect"
- `isDrag`:
    - true (default) if all cards can be dragged
    - false if no cards can be dragged
    - "top" if only the top card can be dragged
        - note that in some layouts (like `STACKED` or `STAGGERED_XXXXX` with narrow offsets) you will only be able to
          select the top card even if the value is `true`
- `canDrag`: a function passed a card id, determining if it can be dragged (after applying the `isDrag` criteria)
- `isDrop`:
    - true: cards can be dragged anywhere into this slot
    - false: cards cannot be dragged into this slot
    - top: cards can be dragged to the top of this slot
- `canDrop`: a function passed two card id (src and dst), determining if the source can be dragged onto the target
    - the `isDrop` criteria applies first
    - `dst` can be null if there are ghost cards
- `classes` a set of class names to apply to the CardSlot's outer div (default: empty)
    - NOTE: the CardSlot must get added the `.highlight-ok` when hovered with a card and the drag target is valid
    - NOTE: the CardSlot must get added the `.highlight-no` when hovered with a card and the drag target is invalid
- `width`, `height`: optional size of the CardSlot area (if omitted, CardSlot will fill its container)
- `forward`: an optional string id designating another CardSlot that the card will be sent to if the card is dropped on
  this CardSlot
- `onClick`: a function to run if this component is clicked (doesn't disable dragging, set `isDrag = false` for that)
- `onClickComponent`: an un-instantiated components to render (with `<Dynamic>`) when this card slot is clicked
    - the component gets passed the cards in this slot as the `cards` prop
    - it's an error if both `onClick` and `onClickComponent` are specified
- `onDragStart` / `onDragEnd`: functions executed when a drag starts/stop on this slot
- `disableDragStart` / `disableDragEnd`: boolean (default: false), disables the default drag behaviour of removing a
  card from a slot when dragged away, or adding a card to a slot when dragged there
    - can be used in combination with `onDragStart` / `onDragEnd` to enable custom behaviour (e.g. duplicating a card,
      or simply using drag-n-drop for targetting)

`<FreeDragArea>` accepts the following props:

- `id`: optional string identifying the area — error if not unique in the GameBoard (accross components in this lib)
    - if not provided, generate a random memorable name, e.g. using the unique-names-generator library
- `snapToGrid`: boolean (default: false), whether to snap to a grid
- `snapXOffset`: the grid offset for snapping in css units (pick a sensible default... 20px?)
- `snapYOffset`: the grid offset for snapping in css units (pick a sensible default... 20px?)
- `overlap`: whether to allows cards to overlap (default: true)
- `gridGuides`: if `snapToGrid` is true, whether to display little + over the area as grid corner guides

## Technology

Use dnd-kit and its built-in Solid.js support (`@dnd-kit/solid`) as well the framework agnostic `@dnd-kit/dom` lib it's
built-on.

## Key Architecture Details

**Cards enter programmatically** via `board.spawn({ slotId, component, props })`, which registers a render thunk under a
fresh `cardId` and appends it to the slot's content. A card's visual is its `component` rendered with `props`; the
draggable chrome is applied by the slot, so users never write it themselves.

**The slot content store is the source of truth.** Each `CardSlot` renders the cards listed for its id, in place, from
their thunks. Moving a card is a store edit (`onDragEnd` splices it between slots); the card is then re-rendered in its
new slot. A move does not preserve the card's internal DOM/component state.

**Using dnd-kit**: dnd-kit owns the *gesture* (sensors, collision detection, accessibility) and is state-driven. The
`DragDropProvider` lives in `GameBoard`, `useDraggable` on each card, `useDroppable` on `CardSlot` (which drives the
`highlight-ok` / `highlight-no` classes).

**The drag visual is dnd-kit's `DragOverlay`** (a top-level layer), so a dragged card escapes slot clipping and
z-index stacking.