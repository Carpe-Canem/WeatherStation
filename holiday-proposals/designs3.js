// Round 3: Easter, July 4, National Dog Day, Halloween. Same part format as designs.js (see stamp.js).
// Reference points as in designs2.js. Frank's Halloween capes are the one body costume: frame 'body', laid over
// his back from the neck (body ellipse top y ~19-20.5 from x 17 to 41), plus head-frame pieces where needed.
// Dog Day is matching bandanas: each letter is one pattern, drawn for all three dogs.
const EA = { P: '#f4a6c8', p: '#d6789f', L: '#b9a0e8', l: '#8a70c0', M: '#8fdcb0', m: '#5aaa80', Y: '#f7d95a', y: '#c9a72e', W: '#f8f5ee', w: '#d8d2c6', O: '#f08a3a', G: '#5fae4a', g: '#3f7f34', e: '#141012' };
const AM = { R: '#c8282e', r: '#8e1c21', W: '#f4f1ea', w: '#cfc8bb', B: '#2a4aa8', b: '#1b3274', Y: '#f2c230', y: '#b88a14', S: '#c9ced8', s: '#8f96a6' };
const DD = { T: '#2aa39a', t: '#1b7069', R: '#d0312d', r: '#94201f', B: '#3d6fd6', b: '#284c9e', C: '#a9c6f2', W: '#f4f1ea' };
const HW = { O: '#e8802a', o: '#b4561a', K: '#1a1420', P: '#7a4ab8', p: '#53307f', G: '#7ac943', g: '#4e8a28', R: '#c8282e', r: '#8e1c21', Y: '#f2c230', y: '#b88a14', V: '#4a2d6a', v: '#2e1b44', N: '#2b3f8f', n: '#1c2a62', W: '#f4f1ea' };
// The bandana shapes used in earlier rounds, as stencils: X = the bandana's colour, filled per pattern below.
const BAND = {
  z: { at: [45.6, 15.8], pivot: [0, 0] },
  f: { at: [43.5, 22], pivot: [3, 0.5] },
  m: { at: [43.5, 20.2], pivot: [3, 0.5] },
};
Object.assign(DESIGNS, {
  easter: {
    z: [
      { id: 'zEA', name: 'Bunny ears', note: 'Tall white bunny ears on a lavender band. Now he hops on purpose.', parts: [
        { at: [54.2, 7.6], pivot: [5, 7], pal: EA, rows: [
          '.WW....WW.',
          'WPPW..WPPW',
          'WPPW..WPPW',
          'WPPW..WPPW',
          '.WPW..WPW.',
          '.WW....WW.',
          '..W....W..',
          'LLLLLLLLLL'] }] },
      { id: 'zEB', name: 'Easter-egg bandana', note: 'Mint green, sprinkled with pink, yellow and lavender eggs.', parts: [
        { ...BAND.z, pal: EA, rows: [
          'MM......',
          'mMMP....',
          '.MMMMY..',
          '.MLMMMPM',
          '..MMYMM.',
          '...PMML.',
          '....MM..',
          '.....M..'] }] },
      { id: 'zEC', name: 'Egg in his mouth', note: 'A striped egg carried very, very gently. For about four seconds.', parts: [
        { at: [63, 16.2], pivot: [2.5, 2], pal: EA, rows: [
          '.LLL.',
          'PYPYP',
          'LLLLL',
          '.PPP.'] }] },
    ],
    f: [
      { id: 'fEA', name: 'Bunny ears, one flopped', note: 'One ear stands up. The other refuses, and so does Frank.', parts: [
        { at: [50.5, 9.6], pivot: [5, 7], pal: EA, rows: [
          '.WW.......',
          'WPPW......',
          'WPPW..WWW.',
          'WPPW.WPPPW',
          'WPPW.WPW..',
          '.WPW.WPW..',
          '.WPW.WPW..',
          'LLLLLLLLLL'] }] },
      { id: 'fEB', name: 'Lavender bow tie', note: 'Lavender with yellow dots. Dressed for brunch, under protest.', parts: [
        { at: [49.6, 23.6], pivot: [3, 1.5], pal: EA, rows: [
          'LL...LL',
          'LYLlLYL',
          'LLLlLLL',
          'LL...LL'] }] },
      { id: 'fEC', name: 'Daisy crown', note: 'White daisies and pink buds across his head. The grumpiest flower child.', parts: [
        { at: [50.5, 9.4], pivot: [5.5, 2], pal: EA, rows: [
          '.W...P...W.',
          'WYW.PpP.WYW',
          'GWGGGgGGGWG'] }] },
    ],
    m: [
      { id: 'mEA', name: 'Daisy crown', note: 'A ring of white daisies and pink buds across her head.', parts: [
        { at: [47.4, 7.6], pivot: [4, 2], pal: EA, rows: [
          '.P..W..P.',
          'PpPWYWPpP',
          '.G.GWG.G.'] }] },
      { id: 'mEB', name: 'Chick on her head', note: 'A fuzzy yellow chick riding on her head. She has not noticed.', parts: [
        { at: [50.3, 8.4], pivot: [3, 5], pal: EA, rows: [
          '...YY.',
          '...YeO',
          'yYYYY.',
          'yYYYY.',
          '.yyy..'] }] },
      { id: 'mEC', name: 'Easter-egg bandana', note: 'Mint green with little pastel eggs, knotted at the back.', parts: [
        { ...BAND.m, pal: EA, rows: [
          'mMMMMM',
          '.MPMMM',
          '.MMMYM',
          '..MLM.',
          '...MM.',
          '....M.'] }] },
    ],
  },
  july4: {
    z: [
      { id: 'zJA', name: 'Stars-and-stripes bandana', note: 'Blue with white stars up top, red and white stripes below.', parts: [
        { ...BAND.z, pal: AM, rows: [
          'BB......',
          'bWBB....',
          '.BBWBB..',
          '.RRRRRRR',
          '..WWWWW.',
          '...RRRR.',
          '....WW..',
          '.....R..'] }] },
      { id: 'zJB', name: 'Uncle Sam hat', note: 'A striped top hat with a starred blue band. Leads the parade at a sprint.', parts: [
        { at: [54.5, 8], pivot: [5, 6], pal: AM, rows: [
          '...WWWWW..',
          '...RWRWR..',
          '...RWRWR..',
          '...RWRWR..',
          '...BBWBB..',
          'bBBBBBBBBb'] }] },
      { id: 'zJC', name: 'Star-shaped shades', note: 'Red star sunglasses. Too cool for the fireworks, then not.', parts: [
        { at: [57.3, 10.4], pivot: [6.5, 1.5], pal: AM, rows: [
          '......R..',
          'SSSSRWRRR',
          '.....RRR.',
          '.....R.R.'] }] },
    ],
    f: [
      { id: 'fJA', name: 'Uncle Sam hat', note: 'Tall, striped, with a starred band. Frank wants YOU off his lawn.', parts: [
        { at: [50.5, 9.6], pivot: [5, 7], pal: AM, rows: [
          '..WWWWWW..',
          '..RWRWRW..',
          '..RWRWRW..',
          '..RWRWRW..',
          '..RWRWRW..',
          '..BBWBBB..',
          'bBBBBBBBBb'] }] },
      { id: 'fJB', name: 'Flag bandana', note: 'Starred blue corner, red and white stripes. Patriotic, not cheerful.', parts: [
        { ...BAND.f, pal: AM, rows: [
          'bBBBRRRR',
          '.BWBWWWW',
          '.BBBRRR.',
          '..WWWW..',
          '...RR...',
          '...W....'] }] },
      { id: 'fJC', name: 'Star collar', note: 'A navy collar with white stars and a gold star tag.', parts: [
        { at: [39.3, 19.2], pivot: [0, 0], pal: AM, rows: [
          'BB........',
          'bBWBB.....',
          '..bBBWBB..',
          '....bBBWB.',
          '......bBB.',
          '.......Y..',
          '.....YYYYY',
          '......YYY.',
          '......Y.Y.'] }] },
    ],
    m: [
      { id: 'mJA', name: 'Star boppers', note: 'A red star and a blue star on springs, bobbing over her head.', parts: [
        { at: [48.4, 8.6], pivot: [4.5, 6], pal: AM, rows: [
          '.R.....B.',
          'RRR...BBB',
          'R.R...B.B',
          '.s.....s.',
          '..s...s..',
          '...sss...'] }] },
      { id: 'mJB', name: 'Navy star bandana', note: 'Navy with white stars and a red hem.', parts: [
        { ...BAND.m, pal: AM, rows: [
          'rRRRRR',
          '.BWBBB',
          '.BBBWB',
          '..BWB.',
          '...BB.',
          '....B.'] }] },
      { id: 'mJC', name: 'Red, white and blue bow', note: 'Half red, half blue, tied with white, just in front of her ears.', parts: [
        { at: [50.3, 8.4], pivot: [2.5, 2.5], pal: AM, rows: [
          'RR.BB',
          'RRWBB',
          '.r.b.'] }] },
    ],
  },
  dogday: {
    z: [
      { id: 'zDA', name: 'Teal paw-print bandana', note: 'Matching set A: teal with white paw prints.', parts: [
        { ...BAND.z, pal: DD, rows: [
          'TT......',
          'tTTT....',
          '.TTTTW..',
          '.TWTWTTT',
          '..TWTTT.',
          '...TTTT.',
          '....TT..',
          '.....T..'] }] },
      { id: 'zDB', name: 'Red polka-dot bandana', note: 'Matching set B: the classic red bandana with white dots.', parts: [
        { ...BAND.z, pal: DD, rows: [
          'RR......',
          'rRRW....',
          '.WRRRR..',
          '.RRRWRRW',
          '..RRRRR.',
          '...WRRR.',
          '....RW..',
          '.....R..'] }] },
      { id: 'zDC', name: 'Blue gingham bandana', note: 'Matching set C: blue-and-white check, picnic style.', parts: [
        { ...BAND.z, pal: DD, rows: [
          'BC......',
          'bBCB....',
          '.CWCWC..',
          '.BCBCBCB',
          '..WCWCW.',
          '...BCBC.',
          '....CW..',
          '.....C..'] }] },
    ],
    f: [
      { id: 'fDA', name: 'Teal paw-print bandana', note: 'Matching set A: teal with white paw prints.', parts: [
        { ...BAND.f, pal: DD, rows: [
          'tTTTTTTT',
          '.TWTWTTT',
          '.TTWTTT.',
          '..TTTT..',
          '...TT...',
          '...T....'] }] },
      { id: 'fDB', name: 'Red polka-dot bandana', note: 'Matching set B: the classic red bandana with white dots.', parts: [
        { ...BAND.f, pal: DD, rows: [
          'rRRRRRRR',
          '.RWRRRWR',
          '.RRRWRR.',
          '..WRRR..',
          '...RR...',
          '...R....'] }] },
      { id: 'fDC', name: 'Blue gingham bandana', note: 'Matching set C: blue-and-white check, picnic style.', parts: [
        { ...BAND.f, pal: DD, rows: [
          'bBCBCBCB',
          '.CWCWCWC',
          '.BCBCBC.',
          '..WCWC..',
          '...BC...',
          '...C....'] }] },
    ],
    m: [
      { id: 'mDA', name: 'Teal paw-print bandana', note: 'Matching set A: teal with white paw prints.', parts: [
        { ...BAND.m, pal: DD, rows: [
          'tTTTTT',
          '.TWTWT',
          '.TTWTT',
          '..TTT.',
          '...TT.',
          '....T.'] }] },
      { id: 'mDB', name: 'Red polka-dot bandana', note: 'Matching set B: the classic red bandana with white dots.', parts: [
        { ...BAND.m, pal: DD, rows: [
          'rRRRRR',
          '.RWRRR',
          '.RRRWR',
          '..WRR.',
          '...RR.',
          '....R.'] }] },
      { id: 'mDC', name: 'Blue gingham bandana', note: 'Matching set C: blue-and-white check, picnic style.', parts: [
        { ...BAND.m, pal: DD, rows: [
          'bBCBCB',
          '.CWCWC',
          '.BCBCB',
          '..WCW.',
          '...BC.',
          '....C.'] }] },
    ],
  },
  halloween: {
    z: [
      { id: 'zHA', name: 'Witch hat', note: 'Purple, pointy, tip bent back, with a green band and gold buckle.', parts: [
        { at: [54.5, 8], pivot: [5, 7], pal: HW, rows: [
          '.pP.......',
          '..PP......',
          '...PP.....',
          '...PPP....',
          '...PPPp...',
          '..PPPPPp..',
          '..GGYGGg..',
          'PPPPPPPPPp'] }] },
      { id: 'zHB', name: 'Devil horns', note: 'Two little red horns. No band showing on his black head, so they look like his own.', parts: [
        { at: [54.5, 7.8], pivot: [4.5, 4], pal: HW, rows: [
          '..R.....R',
          '.RR....RR',
          'rRR...rRR',
          'rRR...rRR'] }] },
      { id: 'zHC', name: "Jack-o'-lantern bandana", note: 'Orange with a grinning pumpkin face.', parts: [
        { ...BAND.z, pal: HW, rows: [
          'OO......',
          'oOOO....',
          '.OOOOO..',
          '.OKOKOOO',
          '..OOOOO.',
          '...KOKO.',
          '....OO..',
          '.....O..'] }] },
    ],
    f: [
      { id: 'fHA', name: 'Vampire cape', note: 'Deep purple with a red lining and a tall collar standing up behind his neck. Count Frank.', parts: [
        { frame: 'body', at: [40.5, 20.5], pivot: [17, 0.5], pal: HW, rows: [
          '......vVVVVVVVVVVV',
          '...vVVVVVVVVVVVVVV',
          '.RRVVVVVVVVVVVVVVv',
          'RRRVVVVVVVVVVVVVv.',
          'RRVVVVVVVVVVVVVVv.',
          'RRVVVVVVVVVVVVVv..',
          '.RVVVVVVVVVVVVVv..',
          '.RVVVvVVVVvVVVv...',
          '..VV.vVV.vVV.v....',
          '...V..V...V.......'] },
        { at: [36.5, 13.2], pivot: [0, 0], behind: true, pal: HW, rows: [
          'R.....',
          'RR....',
          'RrR...',
          '.RrRRR',
          '..RrRR',
          '...RRR',
          '...RRR'] }] },
      { id: 'fHB', name: 'Superhero cape', note: 'Red with a gold lightning bolt and a gold clasp at his neck. Defender of the yard.', parts: [
        { frame: 'body', at: [40.5, 20.5], pivot: [17, 0.5], pal: HW, rows: [
          '.......rRRRRRRRRRY',
          '....rRRRRRRRRRRRRR',
          '.rRRRRRRRRRYRRRRRr',
          'rRRRRRRRRYYRRRRRr.',
          'rRRRRRRRYYYYRRRRr.',
          '.rRRRRRRRRYYRRRr..',
          '..rRRRRRRRYRRRRr..',
          '...rRRRRRRRRRRr...',
          '.....rRRRRRRrr....'] }] },
      { id: 'fHC', name: 'Wizard cape and hat', note: 'Midnight blue with gold stars, and a pointed hat to match. Frank the Grey would be a better name, but he is black.', parts: [
        { frame: 'body', at: [40.5, 20.5], pivot: [17, 0.5], pal: HW, rows: [
          '......nNNNNNNNNNNN',
          '...nNNNNNYNNNNNNNN',
          '.nNNNNNNNNNNNNNNNn',
          'nNNYNNNNNNNNNYNNn.',
          'nNNNNNNNNNNNNNNNn.',
          'nNNNNNNYNNNNNNNn..',
          '.nNNNNNNNNNNNNNn..',
          '.nNNNNNNNNNYNNn...',
          '..nnnnnnnnnnnn....'] },
        { at: [50.5, 9.6], pivot: [5.5, 8], pal: HW, rows: [
          '..nN.......',
          '...NN......',
          '....NN.....',
          '....NYN....',
          '...NNNNn...',
          '...NNNYNn..',
          '..NYNNNNNn.',
          '..YYYYYYY..',
          'nNNNNNNNNNN'] }] },
    ],
    m: [
      { id: 'mHA', name: 'Tiny witch hat', note: 'Black, pointy, with an orange band. She wears it like she invented it.', parts: [
        { at: [48.8, 7.2], pivot: [3.5, 5.5], pal: HW, rows: [
          'K......',
          '.KK....',
          '..KK...',
          '..KKK..',
          '..OOOo.',
          'KKKKKKK'] }] },
      { id: 'mHB', name: 'Bat hair clip', note: 'A little black bat with orange eyes, clipped on top of her head.', parts: [
        { at: [49, 7.4], pivot: [3.5, 2], pal: HW, rows: [
          'K.K.K.K',
          'KKOKOKK',
          '.K.K.K.'] }] },
      { id: 'mHC', name: 'Pumpkin bandana', note: "Orange with a jack-o'-lantern face. Matches Ziggy's, if you pick his.", parts: [
        { ...BAND.m, pal: HW, rows: [
          'oOOOOO',
          '.OKOKO',
          '.OOOOO',
          '..KOK.',
          '...OO.',
          '....O.'] }] },
    ],
  },
});
