# Holiday outfit proposals

Design tooling for the dogs' holiday outfits. Nothing here ships: the approved outfits live in
`app/js/outfits.js`, the holiday calendar in `app/js/holidays.js`, and the lines and scenes in the
"holidays" section of `app/js/dogs.js`.

## Files

- `designs.js`, `designs2.js`, `designs3.js`: the proposed designs for rounds 1–3, 2–3 options per dog
  per holiday. Each option is a list of parts in the format described in `stamp.js` and `app/js/outfits.js`.
  Rounds 2+ extend round 1's `DESIGNS` with `Object.assign`; add a new round the same way and list
  its file in `build.js`.
- `engine.js`: a browser copy of `app/js/sprites.js` with a hook, so designs not yet in `outfits.js` can
  be previewed on the real sprites (`stamp.js` stamps them).
- `*.tpl.html`: templates `build.js` turns into pages:
  - `gallery`: the pick-your-outfits page published as an artifact. It is `gallery-css.part` followed by
    one round's part (`gallery-r2.part`, `gallery-r3.part`; round 1's is `gallery-r1.tpl.txt`).
  - `clip`: the pose-grid clip test.
  - `sheet`: a grid of poses, for close-ups.
  - `dump` and `measure`: older measuring pages.
- `shot.sh <page?query> <out.png> <w,h>`: a headless Chrome screenshot of one of those pages.
- `crops.sh <holiday>`: close-ups of each dog's head and neck for one holiday, saved in `shots/`.
  For a body part (Frank's cape), use `./shot.sh "sheet.html?h=halloween&dog=f&zoom=5" shots/out.png 1500,900`.

## Workflow

1. `node build.js` checks every design: each part has rows of equal width, and every character has a
   colour. It then runs the clip test in headless Chrome and writes `clip.json`, the LIFT (rows of headroom) and WIDE
   (columns at the right) each design needs. The gallery cards show any design that needs more than
   `app/js/sprites.js` gives.
2. Once outfits are picked and added to `app/js/outfits.js`, `node build.js --outfits` runs the same test
   on what ships. Raise `LIFT` or `WIDE` in `sprites.js` only as far as it says.

Generated pages, `clip.json` and `shots/` are git-ignored; rebuild them with `node build.js`.
Requires Node and Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`.
