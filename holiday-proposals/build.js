// node build.js  ->  gallery.html (self-contained), plus clip.html, dump.html and sheet.html used while designing.
// clip.html is the pose-grid clip test; build.js runs it in headless Chrome and writes clip.json, whose
// results go onto the gallery cards ("needs more headroom").
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const here = f => path.join(__dirname, f), read = f => fs.readFileSync(here(f), 'utf8');
const { engineSource } = require('./engine.js');
const designs = ['designs.js', 'designs2.js', 'designs3.js'].map(read).join('\n'); // round 1, then rounds 2+ (Object.assign onto DESIGNS)
const outfits = fs.readFileSync(here('../app/js/outfits.js'), 'utf8').replace(/^export /gm, '');
// Every row of a part must be the same width, and every character must have a colour.
const D = new Function(designs + '; return DESIGNS;')();
const ids = new Set();
for (const [h, dogs] of Object.entries(D)) for (const opts of Object.values(dogs)) for (const o of opts) {
  if (ids.has(h + o.id)) throw new Error('duplicate id ' + h + ' ' + o.id); ids.add(h + o.id);
  o.parts.forEach((p, i) => {
    const w = p.rows[0].length;
    p.rows.forEach((r, y) => {
      if (r.length !== w) throw new Error(h + ' ' + o.id + ' part ' + i + ' row ' + y + ': width ' + r.length + ', expected ' + w);
      for (const ch of r) if (ch !== '.' && !p.pal[ch]) throw new Error(h + ' ' + o.id + ' part ' + i + ': no colour for ' + ch);
    });
  });
}
const BIG = { z: 30, f: 30, m: 30 };
const libs = [read('stamp.js'), designs, outfits].join('\n');
const page = (f, extra = '') => {
  const src = read(f), big = src.includes('/*BIGLIFT*/');
  const scripts = [engineSource(big ? { lift: BIG, wide: BIG } : {}), libs, extra].join('\n');
  const out = f.replace('.tpl.html', '.html');
  fs.writeFileSync(here(out), src.replace('/*BIGLIFT*/', '').replace('/*ENGINE*/', () => scripts));
  console.log('wrote', out);
};
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = f => 'file:///' + here(f).split(path.sep).join('/');
function clip(query) {
  const dom = execFileSync(CHROME, ['--headless', '--disable-gpu', '--virtual-time-budget=600000', '--dump-dom', url('clip.html') + query], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
  const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!m || !m[1].trim()) throw new Error('clip.html gave no result');
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
}
const only = process.argv.slice(2);
page('clip.tpl.html');
let needs = {};
if (!only.includes('--noclip')) {
  needs = clip(only.includes('--outfits') ? '?src=outfits' : '');
  fs.writeFileSync(here('clip.json'), JSON.stringify(needs, null, 1));
  console.log('wrote clip.json');
}
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.tpl.html') && f !== 'clip.tpl.html'))
  page(f, 'const NEEDS = ' + JSON.stringify(needs) + ';');
