# GameBoard Library

This library implements UI game board logic for card games for Solid.js, built on top of [dnd-kit](https://dndkit.com/).

## Overview

- The [`GameBoard`](./src/GameBoard.tsx) component implements the gameboard.
- Underneath the gameboard, you can create [`CardSlot`](./src/CardSlot.tsx) components, and get an instance of the
  [`GameBoardController`](./src/GameBoardController.ts) via the `useGameBoard()` hook.
    - Each slot is designated by a string slotId (chosen by the user or auto-assigned).
    - A slot holds 0 or more cards, ordered as a stack (index 0 = bottom of the stack).
- Every card lives in a slot. Cards are create via `controller.spawn(slotId, component, cardId?, props?)`.
    - Each card is designated by a string cardId (chosen by the user or auto-assigned).
    - The user provides its own component (a `props => JSX.Element` render function) to render each card.
    - The render function is invoked every time the card enters a new slot. As such, the component's internal state
      doesn't survive slot moves and needs to be entirely derivable from external stores and signals.
    - Each card component is encased in a content-fitting draggable div.
- The `CardSlot` props control the drag and drop behaviour and layout via its [`CardSlotProps`](./src/CardSlot.tsx)
    - `layout` — controls how the slot lays out its cards, see below
    - `isDrag` (`true | false | "top"`) — whether cards may be dragged from the slot (`"top"` → only the top card may be
      dropped)
    - `canDrag(cardId)` — additional predicate applied after `isDrag`
    - `isDrop` (`true | false | "top"`) — whether cards may be dropped on the slot (`"top"` → cards can only be dropped
      at the top)
        - currently, we only support dropping cards at the top (`true` aliases to `"top"`)
    - `canDrop(srcSlotId, cardId)` — additional predicate applied after `isDrop`
    - `dragPlaceholder` (`"none" | "ghost" | "clone"`) — when dragging a card away, what is left behind in its location
        - This is purely visual: the card will still logically belong to its slot until dropped/moved elsewhere.
        - `"none"` — The card disappears from the source slot layout, as though it didn't contain it.
        - `"ghost"` — The space the card occupied is held but nothing is rendered.
        - `"clone"` — A live clone of the card is left behind.

## HTML/CSS Structure

Here's how each slot structures its HTML hieararchy and the classes, attributes and variables that are applied /
defined.

To avoid confusion, we need to distinguish between three progressively narrower sets of cards:

1. **Slot cards** — The cards contained in a slot.
2. **DOM cards** — The cards which have an associated DOM node (`.gb-card` below) under the slot.
3. **Layout cards** — The cards which take up space in the slot's layout. The various CSS variables and data attributes
   we define usually reference this set of cards.

The difference between slot cards (1) and DOM cards (2) is the result of the  `maxDisplayed` layout option (see next
section), which allows limiting the number of cards displayed.

The difference between DOM cards (2) and layout cards (3) exist in two scenarios:

- a card is being dragged with a `"none"` placeholder option, which hides and removes the card from the layout (via
  `visibility: hidden` and `position: absolute`) as it is being dragged.
- a card is being dragged, but `maxDisplayed` would have it be hidden (this could happen if cards are programatically
  added to the slot after the start of a drag operation).

In both cases, the DOM node of the card being dragged must exist, so we can't remove it, but we also don't want it to
show or affect the layout in any way.

Also note that some layout cards have `visibility: hidden` (with ghost placeholders)! But they still take up space,
which is the criteria.

- `.gb-slot` div — Outer slot container, which is the drop target.
    - Per regular CSS rules, height 0 if empty, so be sure to set a `min-{width, height}`.
    - Gets the `.higlight-ok` or `highlight-no` class if hovered with a card, depending on `isDrop` and `canDrop`.

- `.gb-layout` div — Direct parent of the card wrappers, where style rules can be applied.
    - Most useful for the `"FREE"` layout, e.g. to apply CSS flex/grid container rules.
    - Mess with this for other layout at your own risk.
    - The CSS variables `--gb-count` and `--gb-extra` are defined on this element. They respectively carry the
      number of layout card in this layout and the number of extra cards hidden because of `maxDisplayed`.
    - This carries a `data-gb-count` attribute set to the number of layout cards.

- `.gb-card` divs — Per-DOM-card wrapper, where style rules can be applied.
    - Same comment. With `"FREE"`, you can apply CSS flex/grid item rules.
    - Carries the `data-gb-card-id` attribute set to the card ID.
    - Carries the `data-gb-index` attribute set to the index of the card in the layout cards (0 = bottom).
        - Only DOM nodes for layout cards carry this attribute.
    - The CSS variable `--gb-index` is defined on this element with the same value (can be used with CSS `calc()`)
        - Only DOM nodes for layout cards carry this attribute.
    - If this card is at the bottom of the layout cards, this gets the `.gb-bottom` class.
    - If this card is at the bottom of the layout cards, and there are extra cards hidden because of `maxDisplayed`,
      this gets the `.gb-cue-extra` class.
        - Use this to style a clue that the stack runs deeper.
        - The staggered layouts draw a built clue via shadows (see below) unless disabled.
    - If this card is a DOM card but not a layout card (see above), it gets the `.gb-parked` class.

- The draggable divs — One inside each `.gb-card`, this is the element that gets dragged, or replaced by a
  placeholder.
    - The dragged element gets the dnd-kit `data-dnd-dragging` attribute set.
    - The placeholder gets the dnd-kit `data-dnd-placeholder` set to either `"clone"` (for clone placeholders) or
      `"hidden"` (otherwise, in which case it is styled as `visibility: hidden`).
        - Use it style the placeholder (usually only for clones).
    - Both the dragged element and the placeholder are logically siblings in the DOM but dnd-kit sets the dragged
      element position to `"fixed"` and updates it to follow the cursor.

## Card Slot Layouts

- `"FREE"` — the library applies no layout, the user is free to style as they see fit.
    - [Options](./src/layouts/free.ts)
        - `maxDisplayed` — the maximum amount of cards to display

- `"STAGGER_{TL, TR, BL, BR}` — the cards as staggered on top of each other with a x and y offset
    - The top card appears visually on top, and is anchored to the named corner (Top Left, Top Right, Bottom Left,
      Bottom Right).
    - Other cards stagger below it towards the opposite corner, with a x- and y-offset.
    - [Options](./src/layouts/stagger.ts)
        - `staggerX` and `staggerX` — the per-card offsets, in CSS units. Default: `"14px"`
        - `centered` — whether to center the cards relative to their container, or anchor them to the named corner.
          Default: `false`
        - `maxDisplayed` — the maximum amount of cards to display
        - `grow` — if true, the slot sizes to fit its content, if false the user has to size it manually. Default:
          `false`. You can use the `min-width` and `min-height` CSS properties to set the minimum size with
          `grow: true`.
        - `cueExtra` — object that configures a cue that the slot holds extra cards beyond `maxDisplayed`
            - Disabled if `false`, takes on all defaults if `undefined`.
            - The cue is a series of shadows staggered underneath the bottom card of the stack.
            - `color` — The CSS color of the shadow at the bottom, shallower layers are lightened towards white.
              Default: `"#8f8f8f"`
            - `maxCount` — Maximum number of shadow layers drawn. Default: `3`
            - `lightenStep` — Fraction in `[0, 1]` lightened toward white per layer step. Default `0.3`
            - `offsetX` and `offsetY` — Per-layer shadow offset, in CSS units. Default: `"5px"`
            - `borderRadius` — Corner rounding applies to the shadows. Default: `"0"`