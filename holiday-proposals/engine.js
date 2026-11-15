// Builds a browser-ready copy of app/js/sprites.js for the proposal gallery. sprites.js has the headroom, the
// captured body and head transforms and the outfit stamping built in (render(k, pose, out, parts)); this only
// adds HOOK.stamp, called between the palette snap and the outline pass with transforms in canvas pixels,
// so stamp.js (stampPart) can preview designs that aren't in app/js/outfits.js yet.
// Nothing in app/ is changed. Used by build.js.
const fs = require('fs'), path = require('path');
exports.engineSource = (opt = {}) => {
  let s = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'sprites.js'), 'utf8').split(String.fromCharCode(13)).join('');
  const rep = (a, b) => { if (!s.includes(a)) throw new Error('patch miss: ' + a); s = s.replace(a, b); };
  s = s.replace(/^export /gm, '');
  // For measuring only: more headroom, so a design taller than the real LIFT shows how much it needs.
  if (opt.lift) { if (!/const LIFT = \{[^}]*\};/.test(s)) throw new Error('patch miss: LIFT'); s = s.replace(/const LIFT = \{[^}]*\};/, 'const LIFT = ' + JSON.stringify(opt.lift) + ';'); }
  rep('  if (parts) for (const part of parts) stamp(part, d, mask, w, h, dy);',
    '  if (parts) for (const part of parts) stamp(part, d, mask, w, h, dy);\n' +
    '  if (HOOK.stamp) { const sh = m => m && new DOMMatrix([1, 0, 0, 1, 0, dy]).multiply(m); HOOK.stamp(k, pose, d, mask, w, h, { body: sh(XF.body), head: sh(XF.head) }); }');
  // For measuring only: a wider canvas, so art past the right edge shows how far it goes.
  if (opt.wide) { if (!/const WIDE = \{[^}]*\};/.test(s)) throw new Error('patch miss: WIDE'); s = s.replace(/const WIDE = \{[^}]*\};/, 'const WIDE = ' + JSON.stringify(opt.wide) + ';'); }
  return `const Sprites = (() => {\nconst HOOK = {};\n${s}\nreturn { render, box, SIZE, NOSE, PAL, OUT, PAD, XF, HOOK, mouthPoint, LIFT, WIDE };\n})();\n`;
};
