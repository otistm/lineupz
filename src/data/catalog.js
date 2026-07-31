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
  // David Ortiz — Closer (finishes frames)
  { id: 'ortiz97-rc',  lineage: 'ortiz',  set: 'ROOKIE',       n: 'David Ortiz',      y: 1997, team: 'Twins',     arch: 'CLOSER',  HIT: 3, POW: 4, cap: 2, cost: 3 },
  { id: 'ortiz04',     lineage: 'ortiz',  set: 'BASE',         n: 'David Ortiz',      y: 2004, team: 'Red Sox',   arch: 'CLOSER',  HIT: 4, POW: 7, cap: 2, cost: 6 },
  { id: 'ortiz04-ws',  lineage: 'ortiz',  set: 'WORLD_SERIES', n: 'David Ortiz',      y: 2004, team: 'Red Sox',   arch: 'CLOSER',  HIT: 5, POW: 9, cap: 2, cost: 11 },
  // Kirk Gibson — Closer
  { id: 'gibson80-rc', lineage: 'kgibson', set: 'ROOKIE',      n: 'Kirk Gibson',      y: 1980, team: 'Tigers',    arch: 'CLOSER',  HIT: 3, POW: 4, cap: 2, cost: 2 },
  { id: 'gibson88',    lineage: 'kgibson', set: 'BASE',        n: 'Kirk Gibson',      y: 1988, team: 'Dodgers',   arch: 'CLOSER',  HIT: 4, POW: 6, cap: 2, cost: 5 },
  { id: 'gibson88-ws', lineage: 'kgibson', set: 'WORLD_SERIES', n: 'Kirk Gibson',     y: 1988, team: 'Dodgers',   arch: 'CLOSER',  HIT: 5, POW: 8, cap: 2, cost: 10 },
  // Wade Boggs — Patient
  { id: 'boggs82-rc',  lineage: 'boggs',  set: 'ROOKIE',       n: 'Wade Boggs',       y: 1982, team: 'Red Sox',   arch: 'PATIENT', HIT: 5, POW: 2, cap: 2, cost: 3 },
  { id: 'boggs87',     lineage: 'boggs',  set: 'BASE',         n: 'Wade Boggs',       y: 1987, team: 'Red Sox',   arch: 'PATIENT', HIT: 7, POW: 2, cap: 2, cost: 6 },
  { id: 'boggs96-as',  lineage: 'boggs',  set: 'ALL_STAR',     n: 'Wade Boggs',       y: 1996, team: 'Yankees',   arch: 'PATIENT', HIT: 8, POW: 3, cap: 2, cost: 9 },
  // Joey Votto — Patient
  { id: 'votto07-rc',  lineage: 'votto',  set: 'ROOKIE',       n: 'Joey Votto',       y: 2007, team: 'Reds',      arch: 'PATIENT', HIT: 4, POW: 3, cap: 2, cost: 3 },
  { id: 'votto10',     lineage: 'votto',  set: 'BASE',         n: 'Joey Votto',       y: 2010, team: 'Reds',      arch: 'PATIENT', HIT: 6, POW: 5, cap: 2, cost: 7 },
  { id: 'votto10-as',  lineage: 'votto',  set: 'ALL_STAR',     n: 'Joey Votto',       y: 2010, team: 'Reds',      arch: 'PATIENT', HIT: 7, POW: 6, cap: 2, cost: 11 },
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
  nodeGold: (rung) => 4 + rung,
  minSeated: 1,
  draftSlots: 6,
  eventDraftSlots: 3,
  sponsorOfferSlots: 4,
  /** Paying for a higher set of a lineage you own: new cost minus half the old card's cost. */
  upgradeDiscount: 0.5,
};

/** Run-wide passives — not seat-equipped. */
export const CHARMS = [
  { id: 'coffee',   n: 'Clubhouse Coffee', cost: 4, blurb: '+2g whenever you win a night.',
    effect: { goldOnWin: 2 } },
  { id: 'scout',    n: 'Scouting Report',  cost: 5, blurb: 'First look vs any bat: pitch −1.',
    effect: { firstLookStuff: -1 } },
  { id: 'rosin',    n: 'Pine Rosin',       cost: 4, blurb: 'Every bat: outs cost the pitcher +1.',
    effect: { allOut: 1 } },
  { id: 'tape',     n: 'Tape Job',         cost: 4, blurb: 'Every bat: +1 HIT.',
    effect: { allHit: 1 } },
  { id: 'rallycap', n: 'Rally Cap',        cost: 5, blurb: 'Once the pitcher is Laboring+: every bat +1 STAM DMG.',
    effect: { laboringPow: 1 } },
  { id: 'waiver',   n: 'Waiver Wire',      cost: 3, blurb: '+2g consolation after a loss.',
    effect: { lossGoldBonus: 2 } },
];

/** Path-map encounter scripts. Effects resolved in engine/events.js. */
export const EVENTS = [
  {
    id: 'booster', title: 'Booster Box',
    body: 'A sealed pack under the dugout bench. Tear it open?',
    choices: [
      { label: 'Rip it — free draft pick', effect: { type: 'draftOne' } },
      { label: 'Flip it for cash', effect: { type: 'gainGold', n: 5 } },
    ],
  },
  {
    id: 'tipjar', title: 'Clubhouse Tip Jar',
    body: 'The veterans pass a jar. Pitch in, or shake it out?',
    choices: [
      { label: 'Shake it out (+4g)', effect: { type: 'gainGold', n: 4 } },
      { label: 'Kick in 2g for a charm', effect: { type: 'payForCharm', n: 2 } },
    ],
  },
  {
    id: 'autograph', title: 'Autograph Line',
    body: 'Fans want ink. Sign for tips, or grab a free bat from the queue.',
    choices: [
      { label: 'Sign for tips (+3g)', effect: { type: 'gainGold', n: 3 } },
      { label: 'Claim a free gear piece', effect: { type: 'gearOne' } },
    ],
  },
  {
    id: 'scrimmage', title: 'Spring Training Scrimmage',
    body: 'A low-stakes intra-squad. Risk the purse on the result.',
    choices: [
      { label: 'Bet 4g — win 8 or lose 4', effect: { type: 'riskGold', n: 4 } },
      { label: 'Sit it out (+2g)', effect: { type: 'gainGold', n: 2 } },
    ],
  },
  {
    id: 'buyback', title: 'Card Shop Buyback',
    body: 'The shop will take a career card off your hands at full sticker.',
    choices: [
      { label: 'Sell one card (full value)', effect: { type: 'removeCard' } },
      { label: 'Walk away (+1g)', effect: { type: 'gainGold', n: 1 } },
    ],
  },
  {
    id: 'rain', title: 'Rain Delay',
    body: 'The tarp is out. The clubhouse snack cart is open.',
    choices: [
      { label: 'Raid the cart (+6g)', effect: { type: 'gainGold', n: 6 } },
      { label: 'Nap through it', effect: { type: 'gainGold', n: 2 } },
    ],
  },
  {
    id: 'notebook', title: "Scout's Notebook",
    body: 'A dog-eared book of tells. Take a charm from the pages.',
    choices: [
      { label: 'Keep a random charm', effect: { type: 'gainCharm' } },
      { label: 'Sell the notes (+4g)', effect: { type: 'gainGold', n: 4 } },
    ],
  },
  {
    id: 'fanmail', title: 'Fan Mail',
    body: 'Three cards arrived overnight. Pick one for free.',
    choices: [
      { label: 'Open the mail', effect: { type: 'draftOne' } },
      { label: 'Return to sender (+3g)', effect: { type: 'gainGold', n: 3 } },
    ],
  },
];

export const NODE_LABELS = {
  draft: {
    label: 'Draft', short: 'Bats', color: '#F2EDE0',
    blurb: 'Six career cards on the table. Buy, upgrade, or reroll — then move on.',
  },
  sponsors: {
    label: 'Sponsors', short: 'Gear', color: '#78B7FF',
    blurb: 'Three shops. Pick one sponsor and kit out a bat with gear.',
  },
  gold: {
    label: 'Purse', short: 'Gold', color: '#FFB347',
    blurb: 'Gate receipts. Take the gold and keep walking.',
  },
  event: {
    label: 'Encounter', short: 'Event', color: '#B08DE6',
    blurb: 'Something happens on the road. A choice, a tip jar, a free card.',
  },
  boss: {
    label: 'Tonight', short: 'Boss', color: '#E8503A',
    blurb: 'Warm up in the dugout, then face tonight\'s pitcher.',
  },
};

/** Club colors for the opponent panel — primary / secondary / accent. */
export const TEAMS = {
  mariners:  { n: 'Mariners',  primary: '#0C2C56', secondary: '#005C5C', accent: '#C4CED4' },
  braves:    { n: 'Braves',    primary: '#132448', secondary: '#CE1141', accent: '#EAAA00' },
  dodgers:   { n: 'Dodgers',   primary: '#005A9C', secondary: '#A1A1A4', accent: '#FFFFFF' },
  cardinals: { n: 'Cardinals', primary: '#0C2340', secondary: '#C41E3A', accent: '#FEDB00' },
  redsox:    { n: 'Red Sox',   primary: '#0C2340', secondary: '#BD3039', accent: '#FFFFFF' },
  angels:    { n: 'Angels',    primary: '#003263', secondary: '#BA0021', accent: '#C4CED4' },
  yankees:   { n: 'Yankees',   primary: '#0C2340', secondary: '#C4CED4', accent: '#FFFFFF' },
};

/* Pitchers are gimmick bosses.
   Shared: lookMul scales familiarity (the Book). Unique flags punish specific boards. */
export const PITCHERS = [
  { id: 'longman',  n: 'Jamie Moyer',    y: 1996, team: 'mariners', stuff: 4, pool: 28, recover: 3,
    note: 'Paces himself — recovers a little stamina between innings.',
    tip: 'Keep the inning alive — short frames let him catch his breath.' },
  { id: 'maddux95', n: 'Greg Maddux',    y: 1995, team: 'braves', stuff: 6, pool: 42, efficient: true, noStretch: true,
    note: 'Outs never cost this pitcher stamina, and Sparks cannot stretch on him.',
    tip: 'Put the ball in play with HIT — outs and free doubles from Sparks do nothing.' },
  { id: 'koufax65', n: 'Sandy Koufax',   y: 1965, team: 'dodgers', stuff: 5, pool: 46, freshEdge: 2, topTax: 1,
    note: 'Untouchable while Fresh — and the top of the order pays an extra tax until he tires.',
    tip: 'Wear him from the heart and bottom — don\'t lean only on the 1–3 hole while he\'s Fresh.' },
  { id: 'gibson68', n: 'Bob Gibson',     y: 1968, team: 'cardinals', stuff: 6, pool: 42, recover: 7, lookMul: 1.25, traffic: 1,
    note: 'Recovers between innings, books repeat looks, and tightens up with traffic on.',
    tip: 'Long rallies still win — but each runner on raises the wall, so cash extras fast.' },
  { id: 'pedro00',  n: 'Pedro Martínez', y: 2000, team: 'redsox', stuff: 7, pool: 58, stubborn: 0.5, lookMul: 1.25, linkTax: 1,
    note: 'Fades slow, books looks, and taxes any bat riding a link.',
    tip: 'Links still matter later — but bare bats and a full order beat a perfect chain alone.' },
  { id: 'unit95',   n: 'Randy Johnson',  y: 1995, team: 'mariners', stuff: 6, pool: 50, intimidate: 3, fadeHard: 1.5, lookMul: 1.5, muteCloser: true,
    note: 'Terrifying while Fresh (+3 pitch). Closers stay quiet until he tires. The Book bites harder.',
    tip: 'Survive Fresh without leaning on 2-out Closers — then feast when he Laboring-fades.' },
  { id: 'ryan73',   n: 'Nolan Ryan',     y: 1973, team: 'angels', stuff: 8, pool: 70, lookMul: 2, denyFirstLook: true,
    note: 'Raw heat, a bottomless tank, and a deep Book — first looks get no Patient or scout help.',
    tip: 'Fill every seat. Stack lasting HIT, not first-look tricks, and grind the pool down.' },
  { id: 'mo99',     n: 'Mariano Rivera', y: 1999, team: 'yankees', stuff: 7, pool: 52, stubborn: 0.75, halfOuts: true, lookMul: 1.75, softContact: true,
    note: 'The cutter. Outs half-wear, soft contact (beat the wall by 1) dies, and the Book runs deep.',
    tip: 'Clear the wall by 2+ HIT — barely-over boards and half-wear outs will not empty this tank.' },
];

/** Night metadata keyed by pitcher id. */
export const LADDER_DEFS = {
  longman:  { pitcher: 'longman',  target: 2, name: 'Opening Night', blurb: 'Walk the path, draft bats, then break the soft opener.' },
  maddux95: { pitcher: 'maddux95', target: 3, name: 'The Surgeon',   blurb: 'Outs are free and Sparks can\'t stretch — beat the wall clean.' },
  koufax65: { pitcher: 'koufax65', target: 3, name: 'The Fastball',  blurb: 'Brutal while Fresh, especially on the top of the order.' },
  gibson68: { pitcher: 'gibson68', target: 4, name: 'The Bulldog',   blurb: 'Recovers between innings and tightens with traffic on.' },
  pedro00:  { pitcher: 'pedro00',  target: 4, name: 'The Wall',      blurb: 'Slow fade, a Book on looks, and a tax on linked bats.' },
  unit95:   { pitcher: 'unit95',   target: 5, name: 'The Unit',      blurb: 'Fresh intimidation mutes Closers — survive, then feast on the fade.' },
  ryan73:   { pitcher: 'ryan73',   target: 5, name: 'The Express',   blurb: 'Huge pool, deep Book, no first-look help — fill the order and grind.' },
  mo99:     { pitcher: 'mo99',     target: 6, name: 'The Sandman',   blurb: 'Half-wear outs and a cutter that eats soft contact.' },
};

/** Meta unlock order. Fresh profiles start with the first START_UNLOCKED arms. */
export const UNLOCK_ORDER = [
  'longman', 'maddux95', 'koufax65', 'gibson68', 'pedro00', 'unit95', 'ryan73', 'mo99',
];
export const START_UNLOCKED = 2;

/** Build a run ladder from unlocked pitcher ids (order preserved from UNLOCK_ORDER). */
export function buildLadder(unlockedIds) {
  const set = new Set(unlockedIds);
  return UNLOCK_ORDER.filter((id) => set.has(id)).map((id) => ({ ...LADDER_DEFS[id] }));
}

/** Full catalog ladder (all arms) — balance scripts and QA. */
export const LADDER = buildLadder(UNLOCK_ORDER);

/** Extend set weights for longer ladders — clamp to last band. */
export const SET_WEIGHTS_SAFE = SET_WEIGHTS;

/** @deprecated use SET_WEIGHTS — kept for any leftover imports */
export const TIER_WEIGHTS = SET_WEIGHTS.map((w) => ({
  common: w.ROOKIE + w.BASE,
  rare: w.ALL_STAR,
  legend: w.WORLD_SERIES,
}));
