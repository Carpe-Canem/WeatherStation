// Round 2: Christmas, New Year's, Valentine's, St. Patrick's. Same part format as designs.js (see stamp.js).
// Neck reference points (head frame, unscaled): Ziggy's neck spans x 46-54 at y 18, Frank's x 40.5-50 at y 22,
// Minnie's black collar runs x 40.6-46.6 at y 19-21. Hats sit on the head top: Ziggy ~[54, 7.5] (his folded ear
// is up there too), Frank ~[50.5, 9.4] (a hat must reach y 1.4 to cover his ears), Minnie in front of her
// ears ~[50.5, 8].
const XM = { R: '#d0312d', r: '#94201f', W: '#f4f1ea', w: '#cfc8bb', G: '#2f8a3e', g: '#1d5c29', Y: '#f2c230', y: '#b88a14', B: '#a0703e', b: '#6e4a28', S: '#c9ced8' };
const NY = { B: '#3d6fd6', b: '#284c9e', P: '#ef6fa2', p: '#b84473', Y: '#f2c230', y: '#b88a14', W: '#fff6d8', S: '#d9dde6', s: '#8f96a6', R: '#d0312d', T: '#4fc3c8' };
const VAL = { R: '#d63345', r: '#97202f', P: '#f27fa6', p: '#c4547c', W: '#fbe9ee', S: '#c9ced8', Y: '#f2c230', y: '#b88a14', G: '#3f8f3a', g: '#2a6427' };
const PAT = { G: '#2f9a44', g: '#1d6a2c', L: '#8fdc7a', K: '#3a2a1a', Y: '#f2c230', y: '#b88a14', W: '#f4f1ea', O: '#e87a2a' };
const HATG = { C: '#474757', H: '#6a6a7c', S: '#30303a', G: '#f2c230', W: '#f4f1ea' };
Object.assign(DESIGNS, {
  christmas: {
    z: [
      { id: 'zXA', name: 'Reindeer antlers', note: 'Two felt antlers on a red band. He will try to play reindeer games with everyone.', parts: [
        { at: [54, 7.6], pivot: [5.5, 7], pal: XM, rows: [
          'b..b..B..B.',
          'b..b..B..B.',
          'bb.b..BB.B.',
          '.bbb...BBB.',
          '..b.....B..',
          '..b.....B..',
          '..RRRRRRR..'] }] },
      { id: 'zXB', name: 'Santa hat', note: 'Red with a white brim; the tip flops back and the pompom bounces behind his head.', parts: [
        { at: [54.5, 8], pivot: [8, 7], pal: XM, rows: [
          '......RRRR..',
          '....RRRRRRR.',
          '..rRRRRRRRRR',
          '.rRr..RRRRRr',
          'WWr...RRRRRr',
          'WW..WWWWWWWW',
          '....wWWWWWWw'] }] },
      { id: 'zXC', name: 'Jingle-bell collar', note: 'A red collar with one big gold bell at his throat. You will hear him coming.', parts: [
        { at: [45.6, 15.8], pivot: [0, 0], pal: XM, rows: [
          'RRR......',
          'rRRRR....',
          '.rrRRRR..',
          '...rrRRRR',
          '.....rRRR',
          '......YY.',
          '.....YYYy',
          '.....YyYy',
          '......yy.'] }] },
    ],
    f: [
      { id: 'fXA', name: 'Santa hat, pulled low', note: 'Red with a white brim, jammed down to his brow. The pompom hangs off the back.', parts: [
        { at: [50.5, 10], pivot: [8, 7], pal: XM, rows: [
          '.....RRRRR..',
          '....RRRRRRR.',
          '...rRRRRRRRR',
          '..rRr.RRRRRR',
          'WWr...RRRRRr',
          'WW..WWWWWWWW',
          '....wwwwwwww'] }] },
      { id: 'fXB', name: 'Tartan scarf', note: 'Red and green, wound twice, one end hanging down his chest. Cosy, and still grumpy.', parts: [
        { at: [39.3, 19.2], pivot: [0, 0], pal: XM, rows: [
          'RR.......',
          'RRGRR....',
          'rRGRRGRR.',
          '..rRRGRRG',
          '....rRGRR',
          '.....GGG.',
          '.....RRR.',
          '.....RRR.',
          '.....GGG.',
          '.....Y.Y.'] }] },
      { id: 'fXC', name: 'Nutcracker hat', note: "A tall red soldier's hat with gold bands and a white plume. On guard all season.", parts: [
        { at: [50.5, 10], pivot: [3.5, 11], pal: XM, rows: [
          '...W...',
          '..WW...',
          '..W....',
          'YRRRRRY',
          '.RRRRR.',
          '.YYYYY.',
          '.RRRRR.',
          '.RRRRR.',
          '.RRRRR.',
          'YYYYYYY',
          '....yyy'] }] },
    ],
    m: [
      { id: 'mXA', name: 'Holly sprig', note: 'Two holly leaves and three berries on her head. She has not noticed.', parts: [
        { at: [50.5, 8.2], pivot: [3, 2.5], pal: XM, rows: [
          'G....g',
          'GGRRgg',
          '.GRRg.'] }] },
      { id: 'mXB', name: 'Velvet bow', note: 'A big red bow on her collar, tied at the throat.', parts: [
        { at: [46.2, 20.6], pivot: [2.5, 1.5], pal: XM, rows: [
          'RR.RR',
          'RRrRR',
          '.r.r.',
          'r...r'] }] },
      { id: 'mXC', name: 'Slipping Santa hat', note: 'A little Santa hat sliding forward, pompom dangling in front of her nose.', parts: [
        { at: [50.5, 8.6], pivot: [3, 4], pal: XM, rows: [
          '..RRR...',
          '.RRRRRr.',
          '.RRRRR.r',
          'WWWWW..r',
          '.wwww.WW',
          '......WW'] }] },
    ],
  },
  newyear: {
    z: [
      { id: 'zNA', name: 'Party hat', note: 'A blue cone with gold dots and a pink pompom, for a midnight zoomie.', parts: [
        { at: [55, 7.6], pivot: [3.5, 9], pal: NY, rows: [
          '..PPP..',
          '...P...',
          '...B...',
          '..BYB..',
          '..YBB..',
          '.BBBYB.',
          '.BYBBB.',
          'BBBBBYB',
          'YYYYYYY'] }] },
      { id: 'zNB', name: 'Gold paper crown', note: 'King of the new year: a gold crown with pink and blue jewels.', parts: [
        { at: [54.5, 7.8], pivot: [3.5, 5], pal: NY, rows: [
          'Y..Y..Y',
          'YY.Y.YY',
          'YYYYYYY',
          'YPYBYPY',
          'yyyyyyy'] }] },
      { id: 'zNC', name: 'Sparkly bow tie', note: 'A gold sequin bow tie at his throat. Dressed up, still bouncing.', parts: [
        { at: [53.6, 19.2], pivot: [2.5, 1.5], pal: NY, rows: [
          'Y...Y',
          'YYyWY',
          'YWyYY',
          'Y...Y'] }] },
    ],
    f: [
      { id: 'fNA', name: 'Top hat', note: 'Charcoal with a gold band and a silver star. Very distinguished, very unamused.', parts: [
        { at: [50.5, 9.6], pivot: [5, 7], pal: HATG, rows: [
          '..HHHHHH..',
          '..CCCCCS..',
          '..CCCCCS..',
          '..CCCCCS..',
          '..CCCCCS..',
          '..GGWGGG..',
          'HCCCCCCCCS'] }] },
      { id: 'fNB', name: 'Crooked party hat', note: 'A party hat knocked crooked, tipping forward over his brow, ears sticking out behind it.', parts: [
        { at: [54.4, 10], pivot: [3, 9], pal: NY, rows: [
          '.....YY',
          '.....Y.',
          '....PB.',
          '...BBP.',
          '...PBB.',
          '..BBPB.',
          '..BPBB.',
          '.PBBBP.',
          'YYYYYY.'] }] },
      { id: 'fNC', name: 'Bow tie and wing collar', note: 'Black tie for a black dog: a white wing collar and a gold bow tie.', parts: [
        { at: [40.3, 20.4], pivot: [0, 0], pal: NY, rows: [
          'WW.......',
          'SWWW.....',
          '.SSWWW...',
          '...SSWWW.',
          '.....SWWW'] },
        { at: [49.6, 23.6], pivot: [2.5, 1.5], pal: NY, rows: [
          'Y...Y',
          'YYyYY',
          'YYyYY',
          'Y...Y'] }] },
    ],
    m: [
      { id: 'mNA', name: 'Gold tiara', note: 'A little gold tiara with a blue jewel. Exactly what she deserves.', parts: [
        { at: [50.3, 8.4], pivot: [2.5, 4], pal: NY, rows: [
          '..Y..',
          'Y.Y.Y',
          'YYTYY',
          'yyyyy'] }] },
      { id: 'mNB', name: 'Gold sequin bandana', note: 'Gold, with sparkles. Ready for the party she will sleep through.', parts: [
        { at: [43.5, 20.2], pivot: [3, 0.5], pal: NY, rows: [
          'yYYYYY',
          '.YWYYY',
          '.YYYWY',
          '..YWY.',
          '...YY.',
          '....Y.'] }] },
      { id: 'mNC', name: 'Tiny party hat, askew', note: 'A pink party hat sliding off backwards. She is in no hurry to fix it.', parts: [
        { at: [50.3, 8.4], pivot: [3.5, 6], pal: NY, rows: [
          'YY....',
          '.PB...',
          '.BPB..',
          '..PBP.',
          '..BPBP',
          '...YYY'] }] },
    ],
  },
  valentines: {
    z: [
      { id: 'zVA', name: 'Heart boppers', note: 'Two hearts on springs. They bounce exactly as much as he does.', parts: [
        { at: [52.4, 7.6], pivot: [6.5, 8], pal: VAL, rows: [
          'pp.pp...RR.RR',
          'ppppp...RRRRR',
          '.ppp.....RRR.',
          '..p.......R..',
          '..S.......S..',
          '...S.....S...',
          '...S.....S...',
          '....SSSSS....'] }] },
      { id: 'zVB', name: 'Heart bandana', note: 'Red, with a white heart, knotted at the back of his neck.', parts: [
        { at: [45.6, 15.8], pivot: [0, 0], pal: VAL, rows: [
          'RR......',
          'rRRR....',
          '.RRRRR..',
          '.RRWRWRR',
          '..RWWWR.',
          '...RWRR.',
          '....RR..',
          '.....R..'] }] },
      { id: 'zVC', name: 'Rose in his teeth', note: 'A red rose held sideways, very romantic, until he drops it to chase something.', parts: [
        { at: [57, 15.6], pivot: [3, 2.5], pal: VAL, rows: [
          '.RR.......',
          'RrRR..G...',
          'RRrRGGGGGG',
          '.RRG......',
          '..G.......'] }] },
    ],
    f: [
      { id: 'fVA', name: 'Studded collar, heart tag', note: 'Red leather with silver studs, and a pink heart tag. Tough, with a soft side.', parts: [
        { at: [39.3, 19.2], pivot: [0, 0], pal: VAL, rows: [
          'S.S......',
          'RRRS.S...',
          'rRRRRRS..',
          '..rRRRRRS',
          '....rRRRR',
          '......P.P',
          '.....PPPP',
          '......PP.'] }] },
      { id: 'fVB', name: "Cupid's arrow", note: 'The old arrow-through-the-head headband. Shot by Cupid, and not happy about it.', parts: [
        { at: [49, 9], pivot: [10, 2.5], behind: true, pal: VAL, rows: [
          'P.P.............RR..',
          '.P.P............RRR.',
          '..yyyyyyyyyyyyyyyRRR',
          '.P.P............RRR.',
          'P.P.............RR..'] }] },
      { id: 'fVC', name: 'Pink heart bandana', note: 'Pink with red hearts. He did not choose it.', parts: [
        { at: [43.5, 22], pivot: [3, 0.5], pal: VAL, rows: [
          'pPPPPPPP',
          '.PR.RPPP',
          '.PRRRPP.',
          '..PRPP..',
          '...PP...',
          '...P....'] }] },
    ],
    m: [
      { id: 'mVA', name: 'Pink hair bow', note: 'A pink bow on top of her head, just in front of her ears.', parts: [
        { at: [50.3, 8.4], pivot: [2.5, 2.5], pal: VAL, rows: [
          'PP.PP',
          'PPpPP',
          '.p.p.'] }] },
      { id: 'mVB', name: 'Heart locket', note: 'A gold heart with a red jewel, hanging from her collar.', parts: [
        { at: [45.6, 21], pivot: [2.5, 0], pal: VAL, rows: [
          '..y..',
          'YY.YY',
          'YYRYY',
          '.YYY.',
          '..Y..'] }] },
      { id: 'mVC', name: 'Rose crown', note: 'A ring of tiny red and pink roses across her head.', parts: [
        { at: [48.6, 8.8], pivot: [4, 2], pal: VAL, rows: [
          '..RR.PP..',
          '.RrRGPpRR',
          'G.G....Rr'] }] },
    ],
  },
  stpatricks: {
    z: [
      { id: 'zSA', name: 'Leprechaun hat', note: 'Green, flared at the top, with a gold buckle. Mischief, officially.', parts: [
        { at: [54.5, 8], pivot: [5, 6], pal: PAT, rows: [
          '..GGGGGGg.',
          '..GGGGGGg.',
          '...GGGGg..',
          '...GGGGg..',
          '...KYyYK..',
          'GGGGGGGGGg'] }] },
      { id: 'zSB', name: 'Four-leaf bandana', note: 'Green with a pale four-leaf clover. Lucky dog.', parts: [
        { at: [45.6, 15.8], pivot: [0, 0], pal: PAT, rows: [
          'GG......',
          'gGGG....',
          '.GGGLGG.',
          '.GGLLLGG',
          '..GGLGG.',
          '...GGG..',
          '....GG..',
          '.....G..'] }] },
      { id: 'zSC', name: 'Shamrock headband', note: 'One big shamrock on a green band, wobbling on top of his head.', parts: [
        { at: [54.5, 7.6], pivot: [4.5, 8], pal: PAT, rows: [
          '...LLL...',
          '...LGL...',
          'LLL.L.LLL',
          'LGLLGLLGL',
          'LLL.G.LLL',
          '....G....',
          '.....G...',
          '..ggggg..'] }] },
    ],
    f: [
      { id: 'fSA', name: 'Leprechaun hat', note: 'Tall, green, flared, with a gold buckle. A very grumpy leprechaun.', parts: [
        { at: [50.5, 10], pivot: [6, 7], pal: PAT, rows: [
          '...GGGGGGg..',
          '...GGGGGGg..',
          '....GGGGg...',
          '....GGGGg...',
          '....KYyYK...',
          '....GGGGg...',
          'GGGGGGGGGGGg'] }] },
      { id: 'fSB', name: 'Tweed flat cap', note: 'A green tweed cap pulled over his brow, ears poking out the top. Old man of the yard.', parts: [
        { at: [51, 10.6], pivot: [6, 4], pal: { T: '#5d7a4a', t: '#435a35', k: '#8aa46e' }, rows: [
          '...TTkTTT...',
          '.TTkTTTTkTT.',
          'TTTTTTkTTTTT',
          '.....ttttttt'] }] },
      { id: 'fSC', name: 'Shamrock tag', note: 'A plain green collar with one big shamrock tag. The least he will wear.', parts: [
        { at: [39.3, 19.2], pivot: [0, 0], pal: PAT, rows: [
          'g.........',
          'gGG.......',
          '.gGGG.....',
          '..ggGGG...',
          '....gGGG..',
          '.....L.L..',
          '.....LLL..',
          '....LL.LL.',
          '.....LgL..',
          '.......g..'] }] },
    ],
    m: [
      { id: 'mSA', name: 'Shamrock clip', note: 'One shamrock clipped beside her ear, slightly crooked.', parts: [
        { at: [50.6, 8.2], pivot: [3.5, 5], pal: PAT, rows: [
          '..LLL..',
          '..LGL..',
          'LL.L.LL',
          'LGLGLGL',
          'LL.G.LL',
          '....G..'] }] },
      { id: 'mSB', name: 'Shamrock bandana', note: 'Green with a pale clover, knotted at the back.', parts: [
        { at: [43.5, 20.2], pivot: [3, 0.5], pal: PAT, rows: [
          'gGGGGG',
          '.GGLGG',
          '.GLLLG',
          '..GLG.',
          '...GG.',
          '....G.'] }] },
      { id: 'mSC', name: 'Tiny leprechaun hat, askew', note: 'A little green hat tipped back, about to fall off.', parts: [
        { at: [49.6, 7.9], pivot: [3, 5], pal: PAT, rows: [
          'GGGG..',
          '.GGGg.',
          '..GGg.',
          '..KKK.',
          '.GGGGG'] }] },
    ],
  },
});
