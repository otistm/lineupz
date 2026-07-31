/* LINEUP — content catalog.
   Batters are career versions of a lineage (Rookie → Base → All-Star → World Series).
   HIT / POW resolve quietly; the player shops abilities, sequence, and upgrades. */

export const SETS = {
  ROOKIE:        { key: 'ROOKIE',        label: 'Topps Rookie',        short: 'Rookie',  rank: 0 },
  BASE:          { key: 'BASE',          label: 'Topps',               short: 'Topps',   rank: 1 },
  ALL_STAR:      { key: 'ALL_STAR',      label: 'Topps All-Star',      short: 'All-Star', rank: 2 },
  WORLD_SERIES:  { key: 'WORLD_SERIES',  label: 'Topps World Series',  short: 'WS',      rank: 3 },
};
export const SET_ORDER = ['ROOKIE', 'BASE', 'ALL_STAR', 'WORLD_SERIES'];

/** Draft weights by ladder rung — later nights lean All-Star / World Series. */
export const SET_WEIGHTS = [
  { ROOKIE: 55, BASE: 35, ALL_STAR: 10, WORLD_SERIES: 0 },
  { ROOKIE: 30, BASE: 40, ALL_STAR: 25, WORLD_SERIES: 5 },
  { ROOKIE: 15, BASE: 35, ALL_STAR: 35, WORLD_SERIES: 15 },
  { ROOKIE: 5,  BASE: 25, ALL_STAR: 40, WORLD_SERIES: 30 },
  { ROOKIE: 0,  BASE: 15, ALL_STAR: 40, WORLD_SERIES: 45 },
];

export const HITTERS = [
  // Ozzie Smith
  { id: 'ozzie78-rc',  lineage: 'ozzie',  set: 'ROOKIE',       n: 'Ozzie Smith',      y: 1978, team: 'Padres',    arch: 'SPARK',   HIT: 4, POW: 1, cap: 2, cost: 2 },
  { id: 'ozzie87',     lineage: 'ozzie',  set: 'BASE',         n: 'Ozzie Smith',      y: 1987, team: 'Cardinals', arch: 'SPARK',   HIT: 5, POW: 2, cap: 2, cost: 3 },
  { id: 'ozzie85-as',  lineage: 'ozzie',  set: 'ALL_STAR',     n: 'Ozzie Smith',      y: 1985, team: 'Cardinals', arch: 'SPARK',   HIT: 6, POW: 2, cap: 2, cost: 6 },
  // Iván Rodríguez
  { id: 'pudge91-rc',  lineage: 'pudge',  set: 'ROOKIE',       n: 'Iván Rodríguez',   y: 1991, team: 'Rangers',   arch: 'SPARK',   HIT: 4, POW: 2, cap: 2, cost: 2 },
  { id: 'pudge99',     lineage: 'pudge',  set: 'BASE',         n: 'Iván Rodríguez',   y: 1999, team: 'Rangers',   arch: 'SPARK',   HIT: 5, POW: 3, cap: 2, cost: 4 },
  { id: 'pudge99-as',  lineage: 'pudge',  set: 'ALL_STAR',     n: 'Iván Rodríguez',   y: 1999, team: 'Rangers',   arch: 'SPARK',   HIT: 6, POW: 3, cap: 2, cost: 7 },
  // Johnny Bench
  { id: 'bench68-rc',  lineage: 'bench',  set: 'ROOKIE',       n: 'Johnny Bench',     y: 1968, team: 'Reds',      arch: 'RALLY',   HIT: 3, POW: 3, cap: 2, cost: 2 },
  { id: 'bench72',     lineage: 'bench',  set: 'BASE',         n: 'Johnny Bench',     y: 1972, team: 'Reds',      arch: 'RALLY',   HIT: 4, POW: 4, cap: 2, cost: 3 },
  { id: 'bench76-ws',  lineage: 'bench',  set: 'WORLD_SERIES', n: 'Johnny Bench',     y: 1976, team: 'Reds',      arch: 'RALLY',   HIT: 5, POW: 6, cap: 2, cost: 9 },
  // Ken Griffey Jr.
  { id: 'griffey89-rc', lineage: 'griffey', set: 'ROOKIE',     n: 'Ken Griffey Jr.',  y: 1989, team: 'Mariners',  arch: 'SLUGGER', HIT: 3, POW: 4, cap: 2, cost: 2 },
  { id: 'griffey97',   lineage: 'griffey', set: 'BASE',        n: 'Ken Griffey Jr.',  y: 1997, team: 'Mariners',  arch: 'SLUGGER', HIT: 4, POW: 6, cap: 2, cost: 4 },
  { id: 'griffey98-as', lineage: 'griffey', set: 'ALL_STAR',   n: 'Ken Griffey Jr.',  y: 1998, team: 'Mariners',  arch: 'SLUGGER', HIT: 5, POW: 8, cap: 2, cost: 8 },
  // Mike Schmidt
  { id: 'schmidt73-rc', lineage: 'schmidt', set: 'ROOKIE',     n: 'Mike Schmidt',     y: 1973, team: 'Phillies',  arch: 'SLUGGER', HIT: 2, POW: 5, cap: 2, cost: 2 },
  { id: 'schmidt80',   lineage: 'schmidt', set: 'BASE',        n: 'Mike Schmidt',     y: 1980, team: 'Phillies',  arch: 'SLUGGER', HIT: 3, POW: 7, cap: 2, cost: 4 },
  { id: 'schmidt80-ws', lineage: 'schmidt', set: 'WORLD_SERIES', n: 'Mike Schmidt',   y: 1980, team: 'Phillies',  arch: 'SLUGGER', HIT: 4, POW: 9, cap: 2, cost: 10 },
  // Alex Rodriguez
  { id: 'arod94-rc',   lineage: 'arod',   set: 'ROOKIE',       n: 'Alex Rodriguez',   y: 1994, team: 'Mariners',  arch: 'RALLY',   HIT: 3, POW: 3, cap: 2, cost: 2 },
  { id: 'arod96',      lineage: 'arod',   set: 'BASE',         n: 'Alex Rodriguez',   y: 1996, team: 'Mariners',  arch: 'RALLY',   HIT: 4, POW: 5, cap: 2, cost: 4 },
  { id: 'arod01-as',   lineage: 'arod',   set: 'ALL_STAR',     n: 'Alex Rodriguez',   y: 2001, team: 'Rangers',   arch: 'RALLY',   HIT: 5, POW: 7, cap: 2, cost: 8 },
  // Rickey Henderson
  { id: 'rickey79-rc', lineage: 'rickey', set: 'ROOKIE',       n: 'Rickey Henderson', y: 1979, team: 'Athletics', arch: 'SPARK',   HIT: 5, POW: 2, cap: 2, cost: 3 },
  { id: 'rickey85',    lineage: 'rickey', set: 'BASE',         n: 'Rickey Henderson', y: 1985, team: 'Yankees',   arch: 'SPARK',   HIT: 6, POW: 3, cap: 2, cost: 6 },
  { id: 'rickey89-ws', lineage: 'rickey', set: 'WORLD_SERIES', n: 'Rickey Henderson', y: 1989, team: 'Athletics', arch: 'SPARK',   HIT: 7, POW: 3, cap: 2, cost: 10 },
  // Joe Morgan
  { id: 'morgan65-rc', lineage: 'morgan', set: 'ROOKIE',       n: 'Joe Morgan',       y: 1965, team: 'Astros',    arch: 'GRINDER', HIT: 4, POW: 2, cap: 3, cost: 3 },
  { id: 'morgan76',    lineage: 'morgan', set: 'BASE',         n: 'Joe Morgan',       y: 1976, team: 'Reds',      arch: 'GRINDER', HIT: 6, POW: 3, cap: 3, cost: 7 },
  { id: 'morgan75-ws', lineage: 'morgan', set: 'WORLD_SERIES', n: 'Joe Morgan',       y: 1975, team: 'Reds',      arch: 'GRINDER', HIT: 7, POW: 4, cap: 3, cost: 11 },
  // Barry Bonds
  { id: 'bonds86-rc',  lineage: 'bonds',  set: 'ROOKIE',       n: 'Barry Bonds',      y: 1986, team: 'Pirates',   arch: 'GRINDER', HIT: 4, POW: 4, cap: 3, cost: 3 },
  { id: 'bonds01',     lineage: 'bonds',  set: 'BASE',         n: 'Barry Bonds',      y: 2001, team: 'Giants',    arch: 'GRINDER', HIT: 6, POW: 6, cap: 3, cost: 7 },
  { id: 'bonds01-as',  lineage: 'bonds',  set: 'ALL_STAR',     n: 'Barry Bonds',      y: 2001, team: 'Giants',    arch: 'GRINDER', HIT: 7, POW: 8, cap: 3, cost: 11 },
  // Mickey Mantle
  { id: 'mantle51-rc', lineage: 'mantle', set: 'ROOKIE',       n: 'Mickey Mantle',    y: 1951, team: 'Yankees',   arch: 'SLUGGER', HIT: 3, POW: 5, cap: 2, cost: 3 },
  { id: 'mantle56',    lineage: 'mantle', set: 'BASE',         n: 'Mickey Mantle',    y: 1956, team: 'Yankees',   arch: 'SLUGGER', HIT: 5, POW: 8, cap: 2, cost: 7 },
  { id: 'mantle61-ws', lineage: 'mantle', set: 'WORLD_SERIES', n: 'Mickey Mantle',    y: 1961, team: 'Yankees',   arch: 'SLUGGER', HIT: 6, POW: 10, cap: 2, cost: 12 },
  // Lou Gehrig
  { id: 'gehrig25-rc', lineage: 'gehrig', set: 'ROOKIE',       n: 'Lou Gehrig',       y: 1925, team: 'Yankees',   arch: 'RALLY',   HIT: 4, POW: 4, cap: 2, cost: 3 },
  { id: 'gehrig27',    lineage: 'gehrig', set: 'BASE',         n: 'Lou Gehrig',       y: 1927, team: 'Yankees',   arch: 'RALLY',   HIT: 6, POW: 6, cap: 2, cost: 6 },
  { id: 'gehrig27-ws', lineage: 'gehrig', set: 'WORLD_SERIES', n: 'Lou Gehrig',       y: 1927, team: 'Yankees',   arch: 'RALLY',   HIT: 7, POW: 8, cap: 2, cost: 11 },
  // Tony Gwynn
  { id: 'gwynn82-rc',  lineage: 'gwynn',  set: 'ROOKIE',       n: 'Tony Gwynn',       y: 1982, team: 'Padres',    arch: 'SPARK',   HIT: 5, POW: 1, cap: 2, cost: 3 },
  { id: 'gwynn94',     lineage: 'gwynn',  set: 'BASE',         n: 'Tony Gwynn',       y: 1994, team: 'Padres',    arch: 'SPARK',   HIT: 7, POW: 2, cap: 2, cost: 6 },
  { id: 'gwynn98-as',  lineage: 'gwynn',  set: 'ALL_STAR',     n: 'Tony Gwynn',       y: 1998, team: 'Padres',    arch: 'SPARK',   HIT: 8, POW: 2, cap: 2, cost: 9 },
  // Ichiro
  { id: 'ichiro01-rc', lineage: 'ichiro', set: 'ROOKIE',       n: 'Ichiro Suzuki',    y: 2001, team: 'Mariners',  arch: 'SPARK',   HIT: 6, POW: 2, cap: 2, cost: 5 },
  { id: 'ichiro04',    lineage: 'ichiro', set: 'BASE',         n: 'Ichiro Suzuki',    y: 2004, team: 'Mariners',  arch: 'SPARK',   HIT: 8, POW: 3, cap: 2, cost: 10 },
  { id: 'ichiro01-as', lineage: 'ichiro', set: 'ALL_STAR',     n: 'Ichiro Suzuki',    y: 2001, team: 'Mariners',  arch: 'SPARK',   HIT: 9, POW: 3, cap: 2, cost: 12 },
  // Ted Williams
  { id: 'williams39-rc', lineage: 'williams', set: 'ROOKIE',   n: 'Ted Williams',     y: 1939, team: 'Red Sox',   arch: 'GRINDER', HIT: 5, POW: 4, cap: 3, cost: 5 },
  { id: 'williams41',  lineage: 'williams', set: 'BASE',       n: 'Ted Williams',     y: 1941, team: 'Red Sox',   arch: 'GRINDER', HIT: 8, POW: 6, cap: 3, cost: 11 },
  { id: 'williams46-as', lineage: 'williams', set: 'ALL_STAR', n: 'Ted Williams',     y: 1946, team: 'Red Sox',   arch: 'GRINDER', HIT: 9, POW: 7, cap: 3, cost: 14 },
  // Babe Ruth
  { id: 'ruth14-rc',   lineage: 'ruth',   set: 'ROOKIE',       n: 'Babe Ruth',        y: 1914, team: 'Red Sox',   arch: 'SLUGGER', HIT: 4, POW: 6, cap: 2, cost: 5 },
  { id: 'ruth27',      lineage: 'ruth',   set: 'BASE',         n: 'Babe Ruth',        y: 1927, team: 'Yankees',   arch: 'SLUGGER', HIT: 6, POW: 10, cap: 2, cost: 12 },
  { id: 'ruth27-ws',   lineage: 'ruth',   set: 'WORLD_SERIES', n: 'Babe Ruth',        y: 1927, team: 'Yankees',   arch: 'SLUGGER', HIT: 7, POW: 12, cap: 2, cost: 16 },
  // Willie Mays
  { id: 'mays51-rc',   lineage: 'mays',   set: 'ROOKIE',       n: 'Willie Mays',      y: 1951, team: 'Giants',    arch: 'SLUGGER', HIT: 4, POW: 5, cap: 2, cost: 5 },
  { id: 'mays65',      lineage: 'mays',   set: 'BASE',         n: 'Willie Mays',      y: 1965, team: 'Giants',    arch: 'SLUGGER', HIT: 6, POW: 9, cap: 2, cost: 11 },
  { id: 'mays54-ws',   lineage: 'mays',   set: 'WORLD_SERIES', n: 'Willie Mays',      y: 1954, team: 'Giants',    arch: 'SLUGGER', HIT: 7, POW: 10, cap: 2, cost: 14 },
  // Mike Trout
  { id: 'trout11-rc',  lineage: 'trout',  set: 'ROOKIE',       n: 'Mike Trout',       y: 2011, team: 'Angels',    arch: 'RALLY',   HIT: 5, POW: 4, cap: 2, cost: 5 },
  { id: 'trout12',     lineage: 'trout',  set: 'BASE',         n: 'Mike Trout',       y: 2012, team: 'Angels',    arch: 'RALLY',   HIT: 7, POW: 7, cap: 2, cost: 10 },
  { id: 'trout14-as',  lineage: 'trout',  set: 'ALL_STAR',     n: 'Mike Trout',       y: 2014, team: 'Angels',    arch: 'RALLY',   HIT: 8, POW: 8, cap: 2, cost: 13 },
  // Derek Jeter — showcase lineage for upgrades
  { id: 'jeter96-rc',  lineage: 'jeter',  set: 'ROOKIE',       n: 'Derek Jeter',      y: 1996, team: 'Yankees',   arch: 'SPARK',   HIT: 5, POW: 2, cap: 2, cost: 3 },
  { id: 'jeter98-as',  lineage: 'jeter',  set: 'ALL_STAR',     n: 'Derek Jeter',      y: 1998, team: 'Yankees',   arch: 'SPARK',   HIT: 7, POW: 3, cap: 2, cost: 8 },
  { id: 'jeter00-ws',  lineage: 'jeter',  set: 'WORLD_SERIES', n: 'Derek Jeter',      y: 2000, team: 'Yankees',   arch: 'SPARK',   HIT: 8, POW: 4, cap: 2, cost: 12 },
];

/* Gear — sold only by sponsors. OUT = the bat's outs cost the pitcher that much stamina. */
export const GEAR = [
  { id: 'ash',      n: 'Ash Bat',        w: 1, cost: 2, mods: { HIT: 1 }, tags: ['hit'] },
  { id: 'cork',     n: 'Corked Bat',     w: 1, cost: 3, mods: { POW: 2 }, tags: ['pow'] },
  { id: 'tar',      n: 'Pine Tar',       w: 1, cost: 3, mods: { OUT: 1 }, tags: ['wear'] },
  { id: 'bgloves',  n: 'Bat Gloves',     w: 1, cost: 3, mods: { HIT: 1, POW: 1 }, tags: ['hit'] },
  { id: 'eyeblack', n: 'Eye Black',      w: 1, cost: 3, mods: { HIT: 2, POW: -1 }, tags: ['hit'] },
  { id: 'helmet',   n: 'Two-Tone Lid',   w: 1, cost: 3, mods: { POW: 1, OUT: 1 }, tags: ['pow', 'wear'] },
  { id: 'chain',    n: 'Ti Necklace',    w: 1, cost: 4, mods: { HIT: 1, POW: 1, OUT: 1 }, tags: ['hit', 'pow', 'wear'] },
  { id: 'maple',    n: 'War Club',       w: 2, cost: 5, mods: { POW: 4, HIT: -1 }, tags: ['pow'] },
  { id: 'donut',    n: 'Weighted Donut', w: 2, cost: 5, mods: { OUT: 2 }, tags: ['wear'] },
  { id: 'guard',    n: 'Elbow Guard',    w: 2, cost: 5, mods: { HIT: 2, OUT: 1 }, tags: ['hit', 'wear'] },
  { id: 'cleats',   n: 'Gold Cleats',    w: 2, cost: 6, mods: { HIT: 3 }, tags: ['hit'] },
];

/** Three sponsor identities. Each visit rolls all three; user picks one. */
export const SPONSORS = [
  { id: 'batco',  n: 'Bat Co.',     blurb: 'Contact wood and soft hands — get on base.', tags: ['hit'] },
  { id: 'pinetar', n: 'Pine & Tar', blurb: 'Long at-bats. Make even outs cost the pitcher.', tags: ['wear'] },
  { id: 'cage',   n: 'Power Cage',  blurb: 'Barrel work — drive the ball and empty the tank.', tags: ['pow'] },
];

export const ECONOMY = {
  startGold: 12,
  startLives: 4,
  rerollCost: 2,
  sellRate: 0.6,
  winGold: (rung) => 8 + rung,
  lossGold: 3,
  minSeated: 1,
  draftSlots: 6,
  sponsorOfferSlots: 4,
  /** Paying for a higher set of a lineage you own: new cost minus half the old card's cost. */
  upgradeDiscount: 0.5,
};

/* Pitchers are gimmick bosses. */
export const PITCHERS = [
  { id: 'longman',  n: 'Jamie Moyer',    y: 1996, stuff: 4, pool: 28,
    note: 'Soft opener — learn the draft, then the sequence.',
    tip: 'Seat what you can afford, light a link, and score one.' },
  { id: 'maddux95', n: 'Greg Maddux',    y: 1995, stuff: 6, pool: 42, efficient: true,
    note: 'Outs never cost this pitcher stamina. You have to put the ball in play.',
    tip: 'Lean on Sparks and Sluggers — Grinders who only wear the pitcher with outs do nothing.' },
  { id: 'koufax65', n: 'Sandy Koufax',   y: 1965, stuff: 5, pool: 46, freshEdge: 2,
    note: 'Untouchable while Fresh. Beat that first pitch or you never get going.',
    tip: 'Grinders and early wear — empty the tank before the middle of the order.' },
  { id: 'gibson68', n: 'Bob Gibson',     y: 1968, stuff: 6, pool: 42, recover: 7,
    note: 'This pitcher catches his breath between innings. Short innings let him reset.',
    tip: 'Build long rallies — Sparks into Rally men, keep the inning alive.' },
  { id: 'pedro00',  n: 'Pedro Martínez', y: 2000, stuff: 7, pool: 58, stubborn: 0.5,
    note: 'Deepest tank, and this pitcher fades slowest. Every link has to work.',
    tip: 'Fill the order, sequence your links, and stack Sluggers for when the pitcher cracks.' },
];

export const LADDER = [
  { pitcher: 'longman',  target: 1, name: 'Opening Night', blurb: 'Draft your bats, pick a sponsor, then build the order.' },
  { pitcher: 'maddux95', target: 2, name: 'The Surgeon',   blurb: 'Outs are free for this pitcher — put the ball in play.' },
  { pitcher: 'koufax65', target: 2, name: 'The Fastball',  blurb: 'A brutal pitch while Fresh — wear the pitcher down early.' },
  { pitcher: 'gibson68', target: 2, name: 'The Bulldog',   blurb: 'Recovers between innings — keep rallies going.' },
  { pitcher: 'pedro00',  target: 3, name: 'The Wall',      blurb: 'Deep tank, slow fade — every link has to fire.' },
];

/** @deprecated use SET_WEIGHTS — kept for any leftover imports */
export const TIER_WEIGHTS = SET_WEIGHTS.map((w) => ({
  common: w.ROOKIE + w.BASE,
  rare: w.ALL_STAR,
  legend: w.WORLD_SERIES,
}));
