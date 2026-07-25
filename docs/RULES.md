# Singapore Mahjong — Rules Background

A quick primer on the rules this app models, for players learning the game. This is not a complete rulebook — it covers what you need to understand the app's analysis.

## The tiles

Singapore mahjong uses the standard 34 tile types, four copies each (136 tiles), plus bonus tiles (see below):

- **Suited tiles** (3 suits × ranks 1–9):
  - Characters / 萬 (wàn)
  - Dots / 筒 (tǒng)
  - Bamboo / 條 (tiáo)
- **Winds**: East 東, South 南, West 西, North 北
- **Dragons**: Red 中, Green 發, White 白

**Bonus tiles** — flowers (花), seasons, and Singapore's distinctive **animal tiles** (cat 貓, mouse 老鼠, rooster 公雞, centipede 蜈蚣) — are set aside when drawn and replaced with a new tile. They never form part of the 14-tile hand, but they add tai to your win:

- **Own flower/season** (the one matching your seat: East=1, South=2, West=3, North=4) — 1 tai each.
- **Each animal** — 1 tai.
- **Complete set** of all four flowers, all four seasons, or all four animals — bonus tai (this app uses +2 per complete set).

Mark the bonus tiles you've drawn in the app's "Your table" section and they'll be included in the score.

## The winning shape

A winning hand is **14 tiles** arranged as:

> **4 sets + 1 pair**

where a set is either:

- **Chow (順子)** — three consecutive tiles of the same suit, e.g. 4-5-6 of Dots. Honors can never form chows.
- **Pung (刻子)** — three identical tiles, e.g. 東東東.

(A **kong** — four identical tiles — is effectively a pung with an extra tile drawn as replacement; out of scope here.)

The only exception to the 4-sets-plus-pair shape in Singapore rules is:

- **Thirteen Wonders (十三幺)** — one of each 1 and 9 in every suit, one of each wind and dragon (13 unique tiles), plus a duplicate of any of them.

> ⚠️ **Seven Pairs is not a winning hand in Singapore mahjong**, unlike Japanese or Hong Kong variants. The app deliberately rejects it.

## Being "ready" — tenpai and the winning tile

With 13 tiles, you are **ready** (colloquially "waiting", 聽牌) when exactly one more tile completes your hand. The tile(s) you're waiting on are your **winning tiles** — you can claim a win when you draw one (self-draw, 自摸) or when an opponent discards one.

Example: holding `12m 456m 789m 123p 55s`, only **3m** completes the hand — that's your winning tile. The app computes this automatically at 13 tiles.

## Scoring — tai (台)

Singapore mahjong scores in **tai**. Your hand's patterns determine base tai, and payouts typically double per tai. Most tables play with a minimum (often 1 tai) and a limit (often 5 tai). Common pattern values, as used in this app:

| Tai | Patterns |
|---|---|
| 0 | Chicken Hand 雞胡 (no pattern at all — many tables don't pay it) |
| 1 | Pung of any dragon; seat/round wind pung* |
| 2 | Pong Pong 碰碰胡 · Half Flush 混一色 |
| 3 | Little Three Dragons 小三元 |
| 4 | Ping Hu 平和 (all chows) · Full Flush 清一色 |
| 5 (limit) | Big Three Dragons 大三元 · All Honors 字一色 · Thirteen Wonders 十三幺 |

\* A pung of **your seat wind** or **the prevailing (round) wind** is worth 1 tai each — set both winds in the app's "Your table" section and they're scored automatically. A pung of another wind scores nothing.

**Situational bonuses** (1 tai each, toggled in the app): self-draw 自摸, winning on the wall's last tile 海底撈月, winning on a kong replacement tile 槓上開花, robbing the kong 搶槓.

## Money payouts — shooter vs non-shooter

The winner is paid by all three opponents. Tables agree on a **base cost** before the game — what each non-shooter pays for a 1-tai win. Common Singapore stakes: **10¢, 20¢, 25¢, 50¢, $1, $2**.

- Payment **doubles with each tai**: non-shooter pays `base × 2^(tai−1)`.
- The **shooter** — whoever discarded the winning tile — pays **double** the non-shooter rate.
- On **self-draw**, all three players pay the shooter rate.
- A 0-tai chicken hand works out to half the base (where the table pays it at all).

Example at 20¢ base: a 3-tai win collects $0.80 from each non-shooter and $1.60 from the shooter.

### Bites (instant payouts)

Some events pay immediately from every player, win or not:

- **Open** kong or animal tile — **1 tai** (the base cost from each player).
- **Hidden (concealed) kong** — **2 tai** (double).

Set your table's base cost in the app's Stakes section to see the full payout reference and dollar amounts on every winning hand.

**House rules vary.** Treat the numbers above as sensible defaults for learning, and defer to your table.

## Strategy notes the app teaches

- **Escape the chicken hand** — a bare win may pay nothing. The cheapest insurance is a dragon pung (1 tai).
- **Half flush is the natural upgrade path** — if your hand leans toward one suit plus honors, the suggestions panel will surface it.
- **Pong Pong vs Ping Hu** — pairs in hand pull you toward Pong Pong; connected suited tiles pull toward Ping Hu. The closeness ranking makes this trade-off visible.
- **Watch your waits** — a two-sided wait (e.g. 2-3 waiting on 1 or 4) wins twice as often as a middle wait. Add 13 tiles and compare how many winning tiles appear.
