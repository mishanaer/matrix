# Matrix

Matrix rain effect for React. Falling characters, pointer highlights, light and dark themes.

## Run locally

Install [Bun](https://bun.sh), then run:

```sh
bun install
bun run dev
```

Open [localhost:5180](http://localhost:5180).

## Use the component

Copy `src/matrix.tsx` and `src/matrix-rain.js` into your React app. The effect only needs `react`; the demo controls are separate.

```tsx
import { Matrix } from './matrix'

<div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
  <Matrix options={{
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    color: 'var(--deslop-primary)',
    glowColor: 'var(--accent-blue)',
    glowBrightness: 1,
    opacity: 0.5,
  }} />
</div>
```

Give the parent a size. The canvas fills it and observes its own CSS dimensions, so parent padding and custom canvas sizes do not stretch the characters. Color values accept CSS colors and variables. Pass updated options when your app changes theme; the component does not change global styles or manage the theme itself.

`glowBrightness` controls pointer brightness: `0` hides it, `1` is the default, and `2` doubles it. Set `pointer: false` to disable highlights. An empty `characters` string clears the symbols. Increase `resetKey` to restart the rain.

Character sets preserve whole visible symbols, including joined emoji, flags, and combining accents. The renderer reuses the split set between animation frames.

Invalid types, omitted values, and non-finite numbers fall back to defaults. Finite numbers are clamped to these ranges:

| Option | Range |
| --- | --- |
| `fontSize` | 8–96 px |
| `lineHeight` | 4–128 px |
| `density` | 0.1–4 |
| `speed` | 0–10 |
| `interval` | 16–1000 ms |
| `opacity`, `decay`, `glowDecay` | 0–1 |
| `radius` | 0–1000 px |
| `glowBrightness` | 0–2 |

The canvas is decorative and hidden from assistive technology. Reduced motion follows the system setting. Animation stops while the canvas is offscreen or the page is hidden. Server rendering is supported; the canvas starts after mounting.

Pointer events and settings changes are combined into at most one draw per animation frame. Disabled pointer highlights do not schedule work. Initial trails are seeded directly, without simulating hundreds of startup frames.

The defaults and types are exported from `src/matrix.tsx`. Without React, size your canvas with CSS and call `createRain(canvas, settings)` from `src/matrix-rain.js`. The lower-level renderer accepts partial options and normalizes updates too. Mutate your settings object, then call `update(key)` or `rebuild()`; changes are applied on the next visible animation frame. Call `destroy()` when removing the canvas. Apply `opacity` and edge masking in your host styles when using it directly.

## Checks

```sh
bun test ./src
bun run typecheck
bun run build
```

The build writes the demo to `dist`. Tests cover whole Unicode symbols, trails, invalid settings, pointer brightness, frame batching, visibility, reduced motion, CSS resizing, cleanup, and server rendering.

## Sources

Colors: [Deslop](https://github.com/mishanaer/deslop). Demo layout and component organization follow [Richbox](https://github.com/mishanaer/richbox).

Demo controls come from [Fluid Functionalism](https://www.fluidfunctionalism.com). The unchanged UI primitives, utilities, and original license are in `demo/react`, copied from Richbox at `77ebff9240a9c41e1209a6fc81062972cbea0f91`. `demo/react/upstream.json` records their source URLs. InputGroup and Switch come from the official [input-group](https://www.fluidfunctionalism.com/r/input-group.json) and [switch](https://www.fluidfunctionalism.com/r/base/switch.json) registries. Import paths were adapted; Switch uses the `accent-blue` token from [Deslop Primitives](https://github.com/mishanaer/deslop/blob/c38287513d3d1e4b04be0d349380633c1a9d49f2/primitives/colors.md). Site colors and row layout are mapped in the demo stylesheet.

The drawer comes from the official [shadcn registry](https://ui.shadcn.com/r/styles/base-nova/drawer.json). Its import path is adapted to the existing utility. Original licenses are included in `demo/react/LICENSE.upstream`, `demo/fluid/LICENSE`, and `demo/shadcn/LICENSE.md`.

The rain renderer reconstructs the behavior of the MatrixRain effect on [aiforui.dev](https://aiforui.dev), with responsive sizing, editable settings, and pointer brightness added. The downloaded reference module and font are not distributed. The effect uses the system monospace font.
