// Holiday accessory proposals. Each option is a list of parts; see stamp.js for the part format.
// Coordinates in `at` are in the dog's unscaled drawing (the numbers used in app/js/sprites.js);
// `rows` are in sprite pixels at that dog's own scale (Ziggy 0.9, Frank 0.75, Minnie 0.64 px per unit).
const C = { R: '#c8372d', O: '#e8802a', Y: '#f2c230', y: '#c99a1e', r: '#8f241d', N: '#a8642a', K: '#6b3d1c', D: '#4e2c14', G: '#5f8a3a', W: '#f2efe8', w: '#c9c4b8', e: '#141012' };
const HAT = { C: '#474757', H: '#6a6a7c', S: '#30303a', W: '#e8e4da', G: '#f2c230' };
const DESIGNS = {
  thanksgiving: {
    z: [
      { id: 'zA', name: 'Feather fan', note: 'Five turkey feathers fanned up from a brown band.', parts: [
        { at: [52.5, 7.5], pivot: [6.5, 8], pal: C, rows: [
          '.....OYO.....',
          '..RR.OYO.RR..',
          '..RRR.Y.RRR..',
          'N..RR.Y.RR..N',
          'NN..RRYRR..NN',
          '.NNN.RYR.NNN.',
          '...NNKKKNN...',
          '....KKKKK....'] }] },
      { id: 'zB', name: 'Turkey hat', note: 'A plush turkey riding on his head, tail fanned out behind.', parts: [
        { at: [54, 7.5], pivot: [5.5, 8], pal: { ...C, N: '#9a5a2a', M: '#7a4420' }, rows: [
          '.RRR........',
          'ROOOR...NN..',
          'ROYYOR.NeNY.',
          'ROYYO..NNR..',
          '.ROYNNNNN...',
          '.RONNMMNN...',
          '..NNNMMNN...',
          '..DNNNNND...'] }] },
      { id: 'zC', name: 'Two feathers', note: 'A beaded band with two feathers standing up behind his ear.', parts: [
        { at: [52.5, 8], pivot: [3.5, 8], pal: C, rows: [
          '..Y....',
          '.YyY...',
          '.YyY.R.',
          '.YyYRrR',
          '..y.RrR',
          '..y.RrR',
          '..y..r.',
          'KOKOKOK'] }] },
    ],
    f: [
      { id: 'fA', name: 'Tall pilgrim hat', note: 'The classic: tall crown, pale band, gold buckle.', parts: [
        { at: [50.5, 9], pivot: [6, 8], pal: HAT, rows: [
          '....HHHH....',
          '....CCCS....',
          '...CCCCCS...',
          '...CCCCCS...',
          '...CCCCCS...',
          '...CCCCCS...',
          '...WWWGGW...',
          'HCCCCCCCCCCS'] }] },
      { id: 'fB', name: 'Brown wide-brim hat', note: 'Squat and wide, pulled low over his brow. Stands out best against his black coat.', parts: [
        { at: [51.5, 9.6], pivot: [6, 5], pal: { B: '#6a4a32', H: '#8a6444', S: '#4a3222', K: '#2a1c14', G: '#f2c230' }, rows: [
          '...HHHHHH...',
          '...BBBBBS...',
          '...BBBBBS...',
          '...KKKGGK...',
          'HBBBBBBBBBBS'] }] },
      { id: 'fC', name: 'Hat and collar', note: 'The full pilgrim: the tall hat plus a wide white collar. Worn under protest.', parts: [
        { at: [50.5, 9], pivot: [6, 8], pal: HAT, rows: [
          '....HHHH....',
          '....CCCS....',
          '...CCCCCS...',
          '...CCCCCS...',
          '...CCCCCS...',
          '...CCCCCS...',
          '...WWWGGW...',
          'HCCCCCCCCCCS'] },
        { at: [45, 22.5], pivot: [3.5, 1.5], pal: C, rows: [
          '.WWWWWW.',
          'WWWWWWWW',
          'wWWwWWWw',
          '.ww..ww.'] }] },
    ],
    m: [
      { id: 'mA', name: 'Leaf-print bandana', note: 'Burnt orange with little leaves, tied at the back.', parts: [
        { at: [43.5, 20.2], pivot: [3, 0.5], pal: { ...C, K: '#b84e14' }, rows: [
          'KOOOOO',
          '.OYOOO',
          '.OOORO',
          '..OYO.',
          '...OO.',
          '....O.'] }] },
      { id: 'mB', name: 'Maple-leaf bandana', note: 'Cranberry red with a gold hem and one gold maple leaf.', parts: [
        { at: [43.5, 20.2], pivot: [4, 0.5], pal: { ...C, M: '#a8323a', m: '#7d2029' }, rows: [
          'mMMMMMMM',
          'mMMYMMMY',
          '.YMYYYY.',
          '..YMYY..',
          '...YMY..',
          '....Y...'] }] },
      { id: 'mC', name: 'Leaf garland', note: 'A string of leaves for a collar, and one on her head she has not noticed.', parts: [
        { at: [43.5, 20.2], pivot: [3.5, 0.5], pal: C, rows: [
          'ROYGRO.',
          '.Y.R.Y.'] },
        { at: [49.5, 7.6], pivot: [2, 3], pal: C, rows: [
          '.OO.',
          'OORO',
          '.OO.'] }] },
    ],
  },
};
