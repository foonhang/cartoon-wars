# Cat Clan（《貓族》）RPG light — v0.2.0

Browser prototype for kids (~7.5). English UI. Camp → Forest → Creek (Fox Cub ending).

Play: https://foonhang.github.io/cartoon-wars/

## Run locally

From this repository root:

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/` (relative `config.json` / `strings.en.json` need HTTP, not `file://`).

## Files

| File | Role |
| --- | --- |
| `index.html` | Shell + HUD + battle buttons |
| `style.css` | Tablet-first; battle buttons ≥72px |
| `game.js` | Explore / dialogue / battle / save |
| `config.json` | **All gameplay numbers** (do not hardcode elsewhere) |
| `strings.en.json` | All player-facing English (≤6 words/line) |
| `art/` | Optional PNG sprites (see below) |

Progress key: `localStorage.mao_zu_v01`.

## How to swap art

1. Drop PNGs into `art/` using the filenames in `config.json` → `"art"`:

```
art/player.png
art/companion.png
art/old_grey.png
art/pebble.png
art/mama_cat.png
art/little_moss.png
art/bug.png
art/mouse.png
art/fox_cub.png
art/bg_camp.png
art/bg_forest.png
art/bg_creek.png
```

2. Keep the same paths in `config.json` `"art"`, or change paths there if you rename files.
3. Until a file loads, the game draws colored circles (`placeholderColors` in config).
4. Recommended size: ~128×128 characters, ~960×540 backgrounds (bg images optional; zone tint still used if bg missing).
5. No code change needed for a same-path swap — refresh the page.

## Balance source of truth

Numbers come from Drive `GAME_CODE_PROMPT_v0.1` / Poe v148. Do not invent new combat values in `game.js`.

## TTS

Web Speech API, `en-US`, rate `0.85`. 🔊 replay + mute on the HUD.

## Art status (v0.2.0)

P0 and P1 comic PNGs are in `art/`: player, companion, old_grey, pebble, mama_cat, little_moss, little_moss_alt_worried, bug, mouse, fox_cub, bg_camp, bg_forest, bg_creek.

`config.json` also names optional button skins (`art/btn_claw.png`, `art/btn_pounce.png`, `art/btn_groom.png`, `art/btn_continue.png`, `art/btn_retry.png`). Those files are not in this drop; the battle and screen buttons keep their HTML labels until the PNGs are added.
