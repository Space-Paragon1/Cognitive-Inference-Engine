`clr-mark.svg` is the app mark, copied exactly from the Android launcher icon (`ic_launcher_foreground.xml` on `ic_launcher_background` #0d0d1f): nodes `#a0a0ff`, connection lines `#6666cc` at 3.5 stroke with round caps, on a 108-unit canvas.

- Use this file as-is for the launcher, the store listing, the extension icon and favicons.
- Inside the app, draw the same geometry inline with nodes and lines in `accent` (lines at 70% opacity), so the mark follows the theme. Don't use the dark tile on light surfaces.
- Keep the Android safe zone: the mark sits within 18–90 units of the 108 canvas. Don't crop tighter.
- Pair it with "Cognitive Load Router" set in Geist 600. Never recolour individual nodes or add effects.
