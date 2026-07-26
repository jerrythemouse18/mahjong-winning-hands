# 🀄 Singapore Mahjong Winning Hands

A lightweight web app that helps players understand the winning combinations of **Singapore-style mahjong**. Build your hand tile by tile, and the app tells you how close you are to each winning pattern — and, when you're ready (tenpai), exactly which tile wins the game for you.

**No build step, no dependencies** — plain HTML/CSS/JavaScript. Open `index.html` in a browser and play.

**▶ Live demo: https://jerrythemouse18.github.io/mahjong-winning-hands/**

## Features

- **Full tile palette** — all 34 tile types (Characters 萬, Dots 筒, Bamboo 條, Winds, Dragons). Tap a tile repeatedly to add up to 4 copies; a badge shows how many you hold. Tap a tile in your hand to remove it.
- **Live hand analysis** — the app re-evaluates on every tap:
  - At **13 tiles**: tells you if you're ready (tenpai) and displays every **winning tile** you're waiting on.
  - At **14 tiles**: checks if the hand is a valid win and shows a full **tai (台) breakdown** with payout math.
- **Discard advisor** — at 14 tiles without a win, the app ranks your best discards: how close each one leaves you to ready (shanten) and how many useful tiles remain live (ukeire), with the accepted tiles rendered.
- **Table context** — set your **seat wind and prevailing wind** so wind pungs score correctly.
- **Flowers, seasons & animals** — toggle the Singapore bonus tiles you've drawn; own-flower, animal, and complete-set tai are included in the score.
- **Win-context bonuses** — self-draw (自摸), last tile (海底撈月), kong replacement (槓上開花), robbing the kong (搶槓).
- **Stakes & money payouts** — pick a common base cost (10¢, 20¢, 25¢, 50¢, $1, $2 at 1 tai), type a custom amount, or choose the **3/6 table** — a fixed per-tai schedule instead of the doubling formula: everyone-pays mode $2/$3/$5/$10/$20 from each player per tai, shooter mode $4/$7/$11/$20/$40 from the discarder alone; self-draw $2/$3/$5/$10/$20 from every player. A reference table shows what the **shooter** (discarder, pays double) and **non-shooters** pay at every tai level, plus **bite** payouts (open kong/animal = 1 tai, hidden kong = 2 tai, collected instantly from every player). Winning hands show the dollar amounts alongside the tai breakdown.
- **Custom tai limit** — the cap defaults to the common 5 tai but is adjustable per table. The payout table extends to your limit, totals cap against it, and limit hands (Big Three Dragons, All Honors, Thirteen Wonders) always score the full configured limit.
- **Payment mode selector** — "Everyone pays (half-shooter)": the discarder pays double and the other two pay the base rate. "Shooter pays all (全銃)": the discarder covers the entire pot alone (e.g. 1 tai at $1 base → shooter pays the whole $4). The winner collects the same either way; self-draw is unaffected.
- **Self-draw bonus** — an optional extra each player adds when the winner self-draws (some tables give e.g. $2 per player on top of the doubled rate). The payout table has a dedicated "Self-draw, each pays" column and shows the winner's collect for both discard and self-draw wins.
- **Closest-pattern suggestions** — while your hand is still forming, the app ranks Singapore winning patterns by how many tiles away you are, so you can decide what to aim for. At 14 tiles, each pattern card also shows **which tile(s) to throw** to chase that specific pattern.
- **Chase a hand** — tap "☆ Chase this hand" on any pattern to pin it as your target; the app then focuses its throw suggestions on that pattern until you unpin it.
- **Learn section** — every supported pattern with its tai value, difficulty rating, description, and a rendered example hand.

## Supported winning patterns (Singapore rules)

| Pattern | Tai* |
|---|---|
| Chicken Hand (雞胡) | 0 |
| Dragon Pung (三元牌) | 1 each |
| Pong Pong / All Pungs (碰碰胡) | 2 |
| Half Flush (混一色) | 2 |
| Little Three Dragons (小三元) | 3 |
| Ping Hu / All Chows (平和) | 4 |
| Full Flush (清一色) | 4 |
| Mixed Terminals (混么九) | 4 |
| Big Three Dragons (大三元) | limit |
| All Honors (字一色) | limit |
| Little Four Winds (小四喜) | limit |
| Big Four Winds (大四喜) | limit |
| Pure Terminals (清老頭) | limit |
| Nine Gates (九蓮寶燈) | limit |
| Thirteen Wonders (十三幺) | limit |

Situational bonuses: self-draw, fully concealed hand (門前清), last tile (海底撈月), kong replacement (槓上開花), flower replacement (花上自摸), robbing the kong (搶槓) — 1 tai each — plus Heavenly (天胡) and Earthly (地胡) hands, which are automatic limit wins. Limit hands score whatever your table's tai limit is set to.

\* Indicative values under common Singapore house rules — tables vary. Note that **Seven Pairs is not a valid hand** in Singapore mahjong, and it is deliberately not recognised here.

## Getting started

```bash
git clone https://github.com/jerrythemouse18/mahjong-winning-hands.git
cd mahjong-winning-hands
# open index.html directly, or serve it:
python3 -m http.server 8000
# then visit http://localhost:8000
```

Run the engine tests (requires Node.js):

```bash
node test/run-tests.js
```

## Project structure

```
index.html          # single-page app shell
css/style.css       # styling, tile rendering
js/version.js       # APP_VERSION shown in the corner badge — bump each release
js/tiles.js         # tile ids, notation, parsing helpers
js/engine.js        # win detection: 4 sets + pair, Thirteen Wonders, waits
js/patterns.js      # named Singapore patterns + tai values + detectors
js/suggestions.js   # shanten search, closeness ranking, discard advisor
js/scoring.js       # full tai calculation: winds, bonus tiles, win context
js/app.js           # UI wiring (palette, hand tray, analysis panel)
test/run-tests.js   # engine test suite
docs/               # design & rules documentation
```

See [`docs/DESIGN.md`](docs/DESIGN.md) for how the engine works and [`docs/RULES.md`](docs/RULES.md) for the mahjong rules background.

## Versioning

The badge in the app's top-right corner shows the deployed version (`APP_VERSION` in `js/version.js`). Bump it in every release commit — after pushing, reload the live site and wait for the badge to change to confirm GitHub Pages has picked up the deploy.

## Current limitations

- Kong (four-of-a-kind) is treated as out of scope; enter the tiles as a pung plus a spare. This also rules out kong-dependent hands: Eighteen Arhats (十八羅漢) and Four Concealed Pungs (四暗刻) as a distinct concealed pattern.
- Nine Gates is detected by tile shape only — the app can't know whether your hand was fully concealed, which the hand traditionally requires.
- Instant-win bonus hands (e.g. winning immediately from complete flower sets before play) are not modelled — bonus tiles contribute tai to a normal win only.
- The discard advisor optimises for the standard 4-sets-plus-pair shape; it doesn't strategise for Thirteen Wonders.

## Roadmap / possible future features

- **Rule-style switcher** — let the user choose which country's rules to play under (Singapore, Hong Kong, Taiwanese, Riichi/Japanese, MCR/Chinese official). Each style changes the valid special hands (e.g. Seven Pairs), the scoring system, and the pattern list. The engine is already structured so `patterns.js` can be swapped per rule set.
- Kong support (four-of-a-kind sets and their bonus tai).
- Practice/quiz mode — deal a random hand and quiz the player on waits and best discards.
- Shareable hand links (encode the hand in the URL).
- PWA/offline support for use at the table.

## License

MIT
