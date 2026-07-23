# 🀄 Singapore Mahjong Winning Hands

A lightweight web app that helps players understand the winning combinations of **Singapore-style mahjong**. Build your hand tile by tile, and the app tells you how close you are to each winning pattern — and, when you're ready (tenpai), exactly which tile wins the game for you.

**No build step, no dependencies** — plain HTML/CSS/JavaScript. Open `index.html` in a browser and play.

## Features

- **Full tile palette** — all 34 tile types (Characters 萬, Dots 筒, Bamboo 條, Winds, Dragons). Tap a tile repeatedly to add up to 4 copies; a badge shows how many you hold. Tap a tile in your hand to remove it.
- **Live hand analysis** — the app re-evaluates on every tap:
  - At **13 tiles**: tells you if you're ready (tenpai) and displays every **winning tile** you're waiting on.
  - At **14 tiles**: checks if the hand is a valid win, names the matched patterns, and totals the **tai (台)**.
- **Closest-pattern suggestions** — while your hand is still forming, the app ranks Singapore winning patterns by how many tiles away you are, so you can decide what to aim for.
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
| Big Three Dragons (大三元) | 5 (limit) |
| All Honors (字一色) | 5 (limit) |
| Thirteen Wonders (十三幺) | 5 (limit) |

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
js/tiles.js         # tile ids, notation, parsing helpers
js/engine.js        # win detection: 4 sets + pair, Thirteen Wonders, waits
js/patterns.js      # named Singapore patterns + tai values + detectors
js/suggestions.js   # shanten search + per-pattern closeness ranking
js/app.js           # UI wiring (palette, hand tray, analysis panel)
test/run-tests.js   # engine test suite
docs/               # design & rules documentation
```

See [`docs/DESIGN.md`](docs/DESIGN.md) for how the engine works and [`docs/RULES.md`](docs/RULES.md) for the mahjong rules background.

## Current limitations

- **Flowers and animals** (bonus tiles unique to Singapore play) are not modelled — they sit outside the 14-tile hand and only affect scoring, not the winning shape.
- Kong (four-of-a-kind) is treated as out of scope; enter the tiles as a pung plus a spare.
- Tai counting covers hand patterns only — no bonus tai for self-draw, last tile, kong replacement, etc.

## Roadmap / possible future features

- **Rule-style switcher** — let the user choose which country's rules to play under (Singapore, Hong Kong, Taiwanese, Riichi/Japanese, MCR/Chinese official). Each style changes the valid special hands (e.g. Seven Pairs), the scoring system, and the pattern list. The engine is already structured so `patterns.js` can be swapped per rule set.
- Flower/animal bonus tile support and full tai calculation.
- Discard suggestions ("which tile should I throw to get closer?").
- Shareable hand links (encode the hand in the URL).
- PWA/offline support for use at the table.

## License

MIT
