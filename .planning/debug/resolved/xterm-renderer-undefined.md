---
status: awaiting_human_verify
trigger: "xterm.js throws 'can't access property dimensions, this._renderer.value is undefined' when terminal page loads"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - FitAddon.fit() called synchronously after Terminal.open() accesses renderer before it is assigned
test: Moved fit() into requestAnimationFrame callback
expecting: Renderer is initialized by next frame; fit() succeeds without error
next_action: Awaiting human verification in browser

## Symptoms

expected: xterm.js terminal renders in the browser and shows a shell prompt
actual: Runtime TypeError — can't access property "dimensions", this._renderer.value is undefined
errors: "can't access property 'dimensions', this._renderer.value is undefined" in xterm.js internals
reproduction: Navigate to /dashboard/env/{id}/terminal in the DevDock app
started: First time testing the terminal UI (Phase 04 just built)

## Eliminated

## Evidence

- timestamp: 2026-04-13T00:01:00Z
  checked: xterm.js RenderService.ts source (node_modules/@xterm/xterm/src/browser/services/RenderService.ts)
  found: Line 50 has `get dimensions(): IRenderDimensions { return this._renderer.value!.dimensions; }` -- non-null assertion on a MutableDisposable that starts empty. Line 203 shows renderer is set via setRenderer() method.
  implication: FitAddon.fit() accesses dimensions getter before renderer is assigned.

- timestamp: 2026-04-13T00:02:00Z
  checked: terminal-instance.tsx lines 77-78
  found: fitAddon.fit() is called synchronously immediately after terminal.open(containerRef.current). No frame delay.
  implication: The renderer may not be initialized by the time fit() runs. Also, the DOM layout (flex container height) may not have been computed yet, causing zero-dimension container.

## Resolution

root_cause: FitAddon.fit() is called synchronously on the same line after Terminal.open(). In xterm.js v5.5, fit() accesses RenderService.dimensions which dereferences this._renderer.value (a MutableDisposable). The renderer has not been assigned yet at that point because the browser has not completed the layout/paint cycle triggered by open(). The non-null assertion in the getter throws TypeError.
fix: Wrapped the initial fit() call in requestAnimationFrame so it runs after the browser completes layout and the renderer is fully initialized. Added cancelAnimationFrame in the cleanup to prevent calls on unmounted components. Moved terminalRef/fitAddonRef assignment before the rAF so refs are available for the guard check inside the callback.
verification: TypeScript compiles cleanly (no errors in terminal files). Awaiting browser verification.
files_changed: [src/app/dashboard/env/[id]/terminal/_components/terminal-instance.tsx]
