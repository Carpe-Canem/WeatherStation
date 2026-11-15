// The dogs' holiday outfits, chosen from the proposal gallery. Stamped onto each dog by render() in sprites.js
// while its holiday is on (holidays.js). A holiday with no entry here means nothing is worn.
//
// OUTFITS[holiday][dog] = { name, parts }, dog = z (Ziggy), f (Frank), m (Minnie). Each part is one piece of
// pixel art stamped onto the dog's sprite:
//   rows    pixel rows, one character per sprite pixel, '.' = empty. Drawn at the dog's own sprite scale
//           (SIZE in sprites.js: z 0.9, f 0.75, m 0.64 sprite px per drawing unit), dog facing right.
//   pal     colour for each character used in rows
//   frame   'head': follows the head through every turn and posture (the transform right after the head's
//           pivot in the dog's draw function, which for Ziggy includes his head offset).
//           'body': follows the body only (the transform right after posture()).
//   at      [x, y] attach point in that frame, in the dog's unscaled drawing coordinates
//   pivot   [x, y] the point of the art, in art pixels (may be fractional), that sits on `at`
//   turn    optional, default 1: how much of the frame's rotation the art follows (0 = always upright)
//   behind  optional: true = drawn only where the dog isn't
// Every row of a part must be the same width. Parts are stamped after the palette snap and before the
// outline, so they get the dog's dark outline. A taller or wider part may need more room: raise that dog's LIFT
// (rows above) or WIDE (columns at the right) in sprites.js, as the pose-grid clip test reports.

export const OUTFITS = {
  thanksgiving: {
    z: { name: 'Two feathers', parts: [
      { frame: 'head', at: [52.5, 8], pivot: [3.5, 8],
        pal: { Y: '#f2c230', y: '#c99a1e', R: '#c8372d', r: '#8f241d', K: '#6b3d1c', O: '#e8802a' },
        rows: [
          '..Y....',
          '.YyY...',
          '.YyY.R.',
          '.YyYRrR',
          '..y.RrR',
          '..y.RrR',
          '..y..r.',
          'KOKOKOK',
        ] },
    ] },
    f: { name: 'Tall pilgrim hat', parts: [
      { frame: 'head', at: [50.5, 9], pivot: [6, 8],
        pal: { H: '#6a6a7c', C: '#474757', S: '#30303a', W: '#e8e4da', G: '#f2c230' },
        rows: [
          '....HHHH....',
          '....CCCS....',
          '...CCCCCS...',
          '...CCCCCS...',
          '...CCCCCS...',
          '...CCCCCS...',
          '...WWWGGW...',
          'HCCCCCCCCCCS',
        ] },
    ] },
    m: { name: 'Leaf-print bandana', parts: [
      { frame: 'head', at: [43.5, 20.2], pivot: [3, 0.5],
        pal: { K: '#b84e14', O: '#e8802a', Y: '#f2c230', R: '#c8372d' },
        rows: [
          'KOOOOO',
          '.OYOOO',
          '.OOORO',
          '..OYO.',
          '...OO.',
          '....O.',
        ] },
    ] },
  },
  christmas: {
    z: { name: 'Santa hat', parts: [
      { frame: 'head', at: [54.5, 8], pivot: [8, 7],
        pal: { R: '#d0312d', r: '#94201f', W: '#f4f1ea', w: '#cfc8bb' },
        rows: [
          '......RRRR..',
          '....RRRRRRR.',
          '..rRRRRRRRRR',
          '.rRr..RRRRRr',
          'WWr...RRRRRr',
          'WW..WWWWWWWW',
          '....wWWWWWWw',
        ] },
    ] },
    f: { name: 'Santa hat, pulled low', parts: [
      { frame: 'head', at: [50.5, 10], pivot: [8, 7],
        pal: { R: '#d0312d', r: '#94201f', W: '#f4f1ea', w: '#cfc8bb' },
        rows: [
          '.....RRRRR..',
          '....RRRRRRR.',
          '...rRRRRRRRR',
          '..rRr.RRRRRR',
          'WWr...RRRRRr',
          'WW..WWWWWWWW',
          '....wwwwwwww',
        ] },
    ] },
    m: { name: 'Holly sprig', parts: [
      { frame: 'head', at: [50.5, 8.2], pivot: [3, 2.5],
        pal: { R: '#d0312d', G: '#2f8a3e', g: '#1d5c29' },
        rows: [
          'G....g',
          'GGRRgg',
          '.GRRg.',
        ] },
    ] },
  },
  newyear: {
    z: { name: 'Sparkly bow tie', parts: [
      { frame: 'head', at: [53.6, 19.2], pivot: [2.5, 1.5],
        pal: { Y: '#f2c230', y: '#b88a14', W: '#fff6d8' },
        rows: [
          'Y...Y',
          'YYyWY',
          'YWyYY',
          'Y...Y',
        ] },
    ] },
    f: { name: 'Crooked party hat', parts: [
      { frame: 'head', at: [54.4, 10], pivot: [3, 9],
        pal: { B: '#3d6fd6', P: '#ef6fa2', Y: '#f2c230' },
        rows: [
          '.....YY',
          '.....Y.',
          '....PB.',
          '...BBP.',
          '...PBB.',
          '..BBPB.',
          '..BPBB.',
          '.PBBBP.',
          'YYYYYY.',
        ] },
    ] },
    m: { name: 'Gold tiara', parts: [
      { frame: 'head', at: [50.3, 8.4], pivot: [2.5, 4],
        pal: { Y: '#f2c230', y: '#b88a14', T: '#4fc3c8' },
        rows: [
          '..Y..',
          'Y.Y.Y',
          'YYTYY',
          'yyyyy',
        ] },
    ] },
  },
  valentines: {
    z: { name: 'Rose in his teeth', parts: [
      { frame: 'head', at: [57, 15.6], pivot: [3, 2.5],
        pal: { R: '#d63345', r: '#97202f', G: '#3f8f3a' },
        rows: [
          '.RR.......',
          'RrRR..G...',
          'RRrRGGGGGG',
          '.RRG......',
          '..G.......',
        ] },
    ] },
    f: { name: 'Studded collar, heart tag', parts: [
      { frame: 'head', at: [39.3, 19.2], pivot: [0, 0],
        pal: { R: '#d63345', r: '#97202f', P: '#f27fa6', S: '#c9ced8' },
        rows: [
          'S.S......',
          'RRRS.S...',
          'rRRRRRS..',
          '..rRRRRRS',
          '....rRRRR',
          '......P.P',
          '.....PPPP',
          '......PP.',
        ] },
    ] },
    m: { name: 'Pink hair bow', parts: [
      { frame: 'head', at: [50.3, 8.4], pivot: [2.5, 2.5],
        pal: { P: '#f27fa6', p: '#c4547c' },
        rows: [
          'PP.PP',
          'PPpPP',
          '.p.p.',
        ] },
    ] },
  },
  stpatricks: {
    z: { name: 'Leprechaun hat', parts: [
      { frame: 'head', at: [54.5, 8], pivot: [5, 6],
        pal: { G: '#2f9a44', g: '#1d6a2c', K: '#3a2a1a', Y: '#f2c230', y: '#b88a14' },
        rows: [
          '..GGGGGGg.',
          '..GGGGGGg.',
          '...GGGGg..',
          '...GGGGg..',
          '...KYyYK..',
          'GGGGGGGGGg',
        ] },
    ] },
    f: { name: 'Shamrock tag', parts: [
      { frame: 'head', at: [39.3, 19.2], pivot: [0, 0],
        pal: { G: '#2f9a44', g: '#1d6a2c', L: '#8fdc7a' },
        rows: [
          'g.........',
          'gGG.......',
          '.gGGG.....',
          '..ggGGG...',
          '....gGGG..',
          '.....L.L..',
          '.....LLL..',
          '....LL.LL.',
          '.....LgL..',
          '.......g..',
        ] },
    ] },
    m: { name: 'Tiny leprechaun hat, askew', parts: [
      { frame: 'head', at: [49.6, 7.9], pivot: [3, 5],
        pal: { G: '#2f9a44', g: '#1d6a2c', K: '#3a2a1a' },
        rows: [
          'GGGG..',
          '.GGGg.',
          '..GGg.',
          '..KKK.',
          '.GGGGG',
        ] },
    ] },
  },
  easter: {
    z: { name: 'Bunny ears', parts: [
      { frame: 'head', at: [54.2, 7.6], pivot: [5, 7],
        pal: { W: '#f8f5ee', P: '#f4a6c8', L: '#b9a0e8' },
        rows: [
          '.WW....WW.',
          'WPPW..WPPW',
          'WPPW..WPPW',
          'WPPW..WPPW',
          '.WPW..WPW.',
          '.WW....WW.',
          '..W....W..',
          'LLLLLLLLLL',
        ] },
    ] },
    f: { name: 'Bunny ears, one flopped', parts: [
      { frame: 'head', at: [50.5, 9.6], pivot: [5, 7],
        pal: { W: '#f8f5ee', P: '#f4a6c8', L: '#b9a0e8' },
        rows: [
          '.WW.......',
          'WPPW......',
          'WPPW..WWW.',
          'WPPW.WPPPW',
          'WPPW.WPW..',
          '.WPW.WPW..',
          '.WPW.WPW..',
          'LLLLLLLLLL',
        ] },
    ] },
    m: { name: 'Daisy crown', parts: [
      { frame: 'head', at: [47.4, 7.6], pivot: [4, 2],
        pal: { P: '#f4a6c8', W: '#f8f5ee', p: '#d6789f', Y: '#f7d95a', G: '#5fae4a' },
        rows: [
          '.P..W..P.',
          'PpPWYWPpP',
          '.G.GWG.G.',
        ] },
    ] },
  },
  july4: {
    z: { name: 'Stars-and-stripes bandana', parts: [
      { frame: 'head', at: [45.6, 15.8], pivot: [0, 0],
        pal: { B: '#2a4aa8', b: '#1b3274', W: '#f4f1ea', R: '#c8282e' },
        rows: [
          'BB......',
          'bWBB....',
          '.BBWBB..',
          '.RRRRRRR',
          '..WWWWW.',
          '...RRRR.',
          '....WW..',
          '.....R..',
        ] },
    ] },
    f: { name: 'Uncle Sam hat', parts: [
      { frame: 'head', at: [50.5, 9.6], pivot: [5, 7],
        pal: { W: '#f4f1ea', R: '#c8282e', B: '#2a4aa8', b: '#1b3274' },
        rows: [
          '..WWWWWW..',
          '..RWRWRW..',
          '..RWRWRW..',
          '..RWRWRW..',
          '..RWRWRW..',
          '..BBWBBB..',
          'bBBBBBBBBb',
        ] },
    ] },
    m: { name: 'Navy star bandana', parts: [
      { frame: 'head', at: [43.5, 20.2], pivot: [3, 0.5],
        pal: { r: '#8e1c21', R: '#c8282e', B: '#2a4aa8', W: '#f4f1ea' },
        rows: [
          'rRRRRR',
          '.BWBBB',
          '.BBBWB',
          '..BWB.',
          '...BB.',
          '....B.',
        ] },
    ] },
  },
  dogday: {
    z: { name: 'Red polka-dot bandana', parts: [
      { frame: 'head', at: [45.6, 15.8], pivot: [0, 0],
        pal: { R: '#d0312d', r: '#94201f', W: '#f4f1ea' },
        rows: [
          'RR......',
          'rRRW....',
          '.WRRRR..',
          '.RRRWRRW',
          '..RRRRR.',
          '...WRRR.',
          '....RW..',
          '.....R..',
        ] },
    ] },
    f: { name: 'Teal paw-print bandana', parts: [
      { frame: 'head', at: [43.5, 22], pivot: [3, 0.5],
        pal: { t: '#1b7069', T: '#2aa39a', W: '#f4f1ea' },
        rows: [
          'tTTTTTTT',
          '.TWTWTTT',
          '.TTWTTT.',
          '..TTTT..',
          '...TT...',
          '...T....',
        ] },
    ] },
    m: { name: 'Blue gingham bandana', parts: [
      { frame: 'head', at: [43.5, 20.2], pivot: [3, 0.5],
        pal: { b: '#284c9e', B: '#3d6fd6', C: '#a9c6f2', W: '#f4f1ea' },
        rows: [
          'bBCBCB',
          '.CWCWC',
          '.BCBCB',
          '..WCW.',
          '...BC.',
          '....C.',
        ] },
    ] },
  },
  halloween: {
    z: { name: 'Devil horns', parts: [
      { frame: 'head', at: [54.5, 7.8], pivot: [4.5, 4],
        pal: { R: '#c8282e', r: '#8e1c21' },
        rows: [
          '..R.....R',
          '.RR....RR',
          'rRR...rRR',
          'rRR...rRR',
        ] },
    ] },
    f: { name: 'Vampire cape', parts: [
      { frame: 'body', at: [40.5, 20.5], pivot: [17, 0.5],
        pal: { v: '#2e1b44', V: '#4a2d6a', R: '#c8282e' },
        rows: [
          '......vVVVVVVVVVVV',
          '...vVVVVVVVVVVVVVV',
          '.RRVVVVVVVVVVVVVVv',
          'RRRVVVVVVVVVVVVVv.',
          'RRVVVVVVVVVVVVVVv.',
          'RRVVVVVVVVVVVVVv..',
          '.RVVVVVVVVVVVVVv..',
          '.RVVVvVVVVvVVVv...',
          '..VV.vVV.vVV.v....',
          '...V..V...V.......',
        ] },
      { frame: 'head', at: [36.5, 13.2], pivot: [0, 0], behind: true,
        pal: { R: '#c8282e', r: '#8e1c21' },
        rows: [
          'R.....',
          'RR....',
          'RrR...',
          '.RrRRR',
          '..RrRR',
          '...RRR',
          '...RRR',
        ] },
    ] },
    m: { name: 'Tiny witch hat', parts: [
      { frame: 'head', at: [48.8, 7.2], pivot: [3.5, 5.5],
        pal: { K: '#1a1420', O: '#e8802a', o: '#b4561a' },
        rows: [
          'K......',
          '.KK....',
          '..KK...',
          '..KKK..',
          '..OOOo.',
          'KKKKKKK',
        ] },
    ] },
  },
};
