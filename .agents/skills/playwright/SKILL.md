---
name: playwright
description: Drive a running app with the Playwright MCP to verify behaviour in a real browser. Use when checking that a dev server renders, has no console errors, or that an interaction works. Covers important drag-and-drop pitfalls.
---

# Playwright MCP — verifying app behaviour in a real browser

Use the `mcp__playwright__*` tools to load a running dev server, snapshot the DOM, read the
console, and exercise interactions. Schemas are deferred — load them with
`ToolSearch` (e.g. `select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot`).

Typical loop: `browser_navigate` → `browser_snapshot` (preferred over screenshots for
finding elements) → `browser_console_messages` (check `error` level) → interact → re-read.

## Pitfall: drag-and-drop with pointer-sensor libraries (dnd-kit, etc.)

`browser_drag` (and Playwright's `locator.dragTo`) performs a **single** press → move →
release with **no intermediate `pointermove` events**. Libraries that use a pointer sensor —
**dnd-kit**, and most modern drag libs — track the cursor across `pointermove`s and run
collision detection on them. With a one-shot drag they never see the cursor travel onto the
real target, so the drop resolves back to the **source** element and the handler silently
no-ops. This looks exactly like "the feature is broken" when the feature is actually fine —
it's a test-harness artifact. **Do not conclude a drag feature is broken from `browser_drag`
alone.**

Instead, drive a **stepped pointer drag** via `browser_run_code_unsafe`, moving in small
increments with brief waits so the pointer sensor activates and collision detection runs:

```js
async (page) => {
  // Read live slot/target centres first (don't hardcode coordinates).
  const coords = await page.evaluate(() =>
    [...document.querySelectorAll('.target-selector')].map(el => {
      const r = el.getBoundingClientRect()
      return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }
    }),
  )
  const drag = async (from, to) => {
    await page.mouse.move(from.cx, from.cy)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(from.cx + (to.cx - from.cx) * i / 20, from.cy + (to.cy - from.cy) * i / 20)
      await page.waitForTimeout(12) // let pointermove + collision detection run
    }
    await page.mouse.move(to.cx, to.cy)
    await page.waitForTimeout(60)
    await page.mouse.up()
    await page.waitForTimeout(400) // settle: let any drag-overlay clone be removed before re-reading
  }
  await drag(coords[0], coords[1])
  return page.evaluate(() => /* read resulting DOM state */)
}
```

Notes:

- **Settle before re-reading.** A drag overlay often renders a *clone* of the dragged node;
  it lingers briefly after `mouse.up`. Counting nodes too early double-counts, and firing a
  second drag back-to-back can hit the stale overlay instead of the real element. Wait
  (~300–400 ms) between drags.
- **Read coordinates live**, not from an earlier snapshot — positions shift after each move.
- When asserting "no node lost / nodes intact", filter to connected, in-place nodes
  (`el.isConnected && el.closest('.container')`) so transient overlay clones don't skew counts.

## Mandatory cleanup: delete generated artifacts when done

The Playwright MCP writes artifacts into the working tree:

- screenshots from `browser_take_screenshot` (default `./page-*.png`, or whatever
  `filename` you passed — these may land at the **repo root**),
- the `.playwright-mcp/` directory (snapshot `.yml` and `console-*.log` files).

These are **diagnostic scratch**, not deliverables. **After you finish diagnosing, delete
every screenshot and `.playwright-mcp/` artifact you generated** so they never get committed:

```sh
rm -f <repo-root>/*.png            # the screenshots you saved (use the exact names)
rm -rf <repo-root>/.playwright-mcp # snapshot + console scratch
```

Remove only files Playwright generated this session; don't touch unrelated `.png`s. Verify
`git status` is clean of these artifacts before reporting done.
