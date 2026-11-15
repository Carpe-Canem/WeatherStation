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
// outline, so they get the dog's dark outline. Headroom above the dogs is PAD in sprites.js (at least 13).

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
};
