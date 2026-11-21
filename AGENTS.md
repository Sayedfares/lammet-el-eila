# AGENTS.md — لمّة العيلة

Family party-game library in Egyptian Arabic (RTL). Read this before editing.

## Run
- `python server.py` → http://localhost:8000 (phones use the LAN URL it prints, same Wi-Fi).
- No build step, no npm, no dependencies. Python standard library only.
- One-phone games also work by opening `index.html` directly; only the room game needs the server.

## Hard rules
- All user-facing text in **Egyptian colloquial Arabic** (عامية مصرية), RTL. Keep code comments short Arabic or English.
- **No frameworks, no bundler, no external JS libraries.** Plain `<script>` files, global functions. Only external asset: Google Fonts (Cairo).
- `server.py` must stay **stdlib-only** (no pip installs).
- Escape every dynamic string with `esc()` before putting it in HTML (team names, family questions and room answers are user input).
- Content must be family-friendly and factually correct. Don't invent facts for quiz / true-false / bluff answers.
- Keep mobile-first: works at 375px width, big touch targets, respects `prefers-reduced-motion` and dark mode.

## Layout
| Path | What |
|---|---|
| `index.html` | Shell; loads scripts in order: content → core → games → app |
| `css/style.css` | All styles. Color tokens on `:root` (+ dark mode) |
| `js/content.js` | ALL content: `RAW.q` questions, `RAW.r` riddles, `RAW.c` challenges, `RAW.tf` true/false, `RAW.pro` proverbs, `RAW.emo` emoji puzzles, `WORDS` (forehead game), `FAMILY_SUGGEST` |
| `js/core.js` | Shared: storage `S` + `save()`, `CARDS` (parsed content), `draw()` no-repeat decks, `allowed()` level/pack filter, `Sound`, `confetti()`, `toast()`, `Timer`, avatars, `Match` (team turns + scores), `setupView`, `endScreen`, wheel |
| `js/games/cards.js` | `makeCardGame()` factory + games `lamma`, `proverbs`, `emoji` |
| `js/games/tf.js` | صح ولا غلط |
| `js/games/heads.js` | على الجبهة (device tilt via `deviceorientation`, tap fallback) |
| `js/games/bluff.js` | كدّاب ولا بجد؟ client (polls `/api/state` every 1.2s) |
| `js/app.js` | Router (`#/`, `#/teams`, `#/family`, `#/play/<id>`), home library, teams editor, family-questions editor. `ORDER` = games shown on home |
| `server.py` | Static files + in-memory rooms API for the bluff game |
| `data/bluff.json` | Bluff prompts: `facts` = `[question with ____, truth]`, `people` = templates with `{p}` |

## Content format (`js/content.js`)
Each line: `"text|answer|tags"`, tags space-separated:
- `k` = easy / kids (no `k` = adults)
- `rm` رمضان, `eid` العيد, `sm` الصيف (none = general)
- `h:...` hint (emoji puzzles)
- Challenges: answer field = seconds. True/false: answer is `T` or `F`.

## Adding a game
1. New file in `js/games/`, register `GAMES.<id> = { id, title, icon, color, desc, tag, render(root), begin(), onExit?() }`.
   - Card-style game? Use `makeCardGame({...})` in `cards.js` instead.
2. Add a `<script>` tag in `index.html` (before `app.js`) and the id to `ORDER` in `app.js`.
3. Team games: `Match.begin(id, rounds, state)`, `Match.add(points)`, `Match.next()`, render `endScreen(id)` when `S.match.over`.
4. Re-render with `route()`. Stop timers/listeners in `onExit()`.

## Gotchas
- `S` is persisted to `localStorage` key `lamma-v2`. Changing its shape? Merge defaults in `core.js` so old saves still load.
- Only one `Timer` runs at a time; `Timer.owner` tells a game whether the running timer is its own after a re-render or reload.
- Don't reuse class names across components (`.back` is the card back face; the header link is `.backlink`).
- Elements with the `hidden` attribute rely on the global `[hidden]{display:none!important}` rule.
- Server: all room state changes go through `Room.act()` under `LOCK`. Tokens are secret per player; `pub` ids (`p1`, `p2`…) are what clients see. Never send `truth` or answer owners to clients before the `reveal` phase.
- Server blocks `/data/` and `.py` paths so players can't read the answers.

## Check your change
- Start the server and open each touched game at mobile width (375px). The console should show no errors.
- For the room game: open 3 tabs (or use the API), create/join, play one round, check the scores.
