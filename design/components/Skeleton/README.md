Loading placeholders that copy the shape of the real layout, so nothing jumps when the data arrives.

**Maps to** the loading state of every panel. Props: `SkeletonProps`.

## Use
- Match the real component: a ring for the gauge, bars for text lines (60–90% width, varied), tiles for stats, and rows for lists. Use the same radii and gaps.
- Colour: `--skeleton` with a gentle `--skeleton-shine` sweep over 1.6 s. Under reduced motion there is no sweep, only a static fill.
- Only show skeletons after 300 ms. A fast response should never flash a skeleton.
- Never mix a skeleton with stale numbers in the same card.

## Accessibility
The loading region gets `aria-busy="true"` and a visually hidden "Loading your dashboard" message. The skeleton shapes themselves are `aria-hidden`.
