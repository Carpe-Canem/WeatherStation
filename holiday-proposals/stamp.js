// Reference accessory renderer (plain browser script; the build session can lift this into sprites.js).
// Called between the palette snap and the outline pass of render(), so an accessory gets the same dark
// outline as the dog and reads as part of the sprite.
//
// An accessory part:
//   rows   pixel rows, one character per sprite pixel ('.' = empty), at the dog's own sprite resolution
//   pal    colour per character
//   frame  'head' (follows the head through every turn and posture) or 'body' (follows the body only)
//   at     [x, y] attach point in the dog's unscaled drawing coordinates, in that frame
//   pivot  [x, y] the point of the pixel art (in art pixels, may be fractional) that sits on `at`
//   turn   how much of the frame's rotation the art follows (default 1; 0 = always upright)
//   behind true = only shows where the dog isn't (far-side ears, bows behind the neck)
function stampPart(part, XF, d, mask, w, h) {
  const m = XF[part.frame || 'head'], a = m.transformPoint({ x: part.at[0], y: part.at[1] });
  let th = Math.atan2(m.b, m.a) * (part.turn ?? 1);
  if (Math.abs(th) < 0.07) th = 0; // dead level: keep the art pixel-perfect
  const c = Math.cos(th), s = Math.sin(th), rows = part.rows, [px, py] = part.pivot;
  const ax = th ? a.x : Math.round(a.x * 2) / 2, ay = th ? a.y : Math.round(a.y * 2) / 2;
  const R = Math.ceil(Math.hypot(rows[0].length, rows.length)) + 1, x0 = Math.floor(ax), y0 = Math.floor(ay);
  for (let Y = Math.max(0, y0 - R); Y <= Math.min(h - 1, y0 + R); Y++) for (let X = Math.max(0, x0 - R); X <= Math.min(w - 1, x0 + R); X++) {
    const rx = X + 0.5 - ax, ry = Y + 0.5 - ay;
    const ch = rows[Math.floor(-s * rx + c * ry + py)]?.[Math.floor(c * rx + s * ry + px)];
    if (!ch || ch === '.') continue;
    const i = Y * w + X;
    if (part.behind && mask[i]) continue;
    const col = part.pal[ch], j = i * 4;
    d[j] = parseInt(col.substr(1, 2), 16); d[j + 1] = parseInt(col.substr(3, 2), 16); d[j + 2] = parseInt(col.substr(5, 2), 16); d[j + 3] = 255;
    mask[i] = 1;
  }
}
