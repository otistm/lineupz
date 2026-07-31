# LINEUPZ

Build the sequence. Break the pitcher.

A Bazaar-style auto-battler in baseball clothes: you **draft batters**, pick a
**sponsor** for gear, assemble the order in a Warming Up dugout, then watch it
loop against a boss pitcher. Score the target to climb a five-arm ladder. Fail a
night and lose a life; zero lives ends the run.

## The loop

```
draft players → pick 1 of 3 sponsors → dugout (Warming Up) → play night
     ↑_________________________________________________________|
```

Between nights (win advance or loss retry) you always return to draft, then a
**new** sponsor trio (no loyalty lock), then the dugout again.

## The focus

Strategy is the **lineup**, not the math. You read cards for abilities, light
neighbor links, seat bats in the right third of the order, and counter each
pitcher's gimmick. HIT and POW sit on the card as big identity numbers — the
night resolves quietly underneath; you never calculate a reach percentage.

Emptying his **stamina** moves him **Fresh → Laboring → Gassed → BROKEN**, which
is when Sluggers and Rally men cash in. In the dugout he shows **Warming up**;
he becomes Fresh on the first pitch.

## The design

- **Empty start.** 12g, 4 lives, empty roster. Seat **1+** to play — thin opens
  and gold hoarding are legal.
- **Draft.** Six batter offers, reroll for 2g, sell at ~60%. Continue to sponsors
  with no seat requirement.
- **Sponsors.** Bat Co. (HIT), Pine & Tar (wear), Power Cage (POW). Pick one;
  only their gear is buyable that visit.
- **Career cards.** Rarity is Topps set + lineage (Rookie → Topps → All-Star →
  World Series). At most one card per lineage; buying a higher set **upgrades**
  in place (discounted).
- **You only bat.** No positions, no fielding, no free full roster.
- **Sequence is the strategy.** Neighbours link (wrapping 9 → 1) and feed each
  other — Sparks set the table for Sluggers, Grinders soften the next bat.
- **Where a bat sits matters**: top gets on base, heart drives them in, bottom
  makes his outs still cost him.
- **Empty seats are skipped, never outs** — but a short order means he keeps
  seeing the same bats, and a bat he has already seen is easier for him.
- **Pitchers are gimmick bosses** with a stamina tank and one trick each.

Balance is enforced by `scripts/qa.mjs`: scrappy early boards clear Opening
Night in band, funded boards clear Pedro while underfunded ones don't, and
sequence still moves win rate ≥ +5pp.

## Quick start

```bash
npm install
npm run dev       # local dev server
npm run build     # runs QA gates, then builds to dist/
npm run preview   # serve the production build
```

## Scripts

| Script            | What it does                                                    |
| ----------------- | --------------------------------------------------------------- |
| `npm run qa`      | Correctness + draft/sponsor + progression gates (also before `build`) |
| `npm run balance` | Monte Carlo tuning report: progression boards and lever impact  |
| `npm run sweep`   | Win probability per target for every board × ladder rung         |

## Structure

```
index.html            page shell + markup
src/main.js           entry (styles + app)
src/styles/main.css   all styling
src/data/catalog.js   sets, lineages, sponsors, pitchers, ladder, economy
src/engine/sim.js     pure night resolution (no DOM)
src/engine/shop.js    draft / sponsors, upgrades, sell price, play gate
src/app/main.js       UI: phase machine, drag/drop, audio, play loop
scripts/qa.mjs        QA gates
scripts/balance.mjs   balance/tuning harness
legacy/               the original single-file prototype
```

Deploys as a static site (`vercel.json` included): `vite build` → `dist/`.
