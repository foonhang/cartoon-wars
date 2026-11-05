# Studio lock — Cat Clan v0.4 Slice1 (2026-11-05)

Source Poe: Drive `POE_DESIGN_lv10_v0.4.md` id `1oYjSnb1TlEsHdJx6mlQtOl2cd07KSIlZ`

## Locks (貓族)
1. Dialogue SoT = Poe §E (not §F generics). Trim any line >6 words when wiring.
2. Player curve: keep v0.3 feel — `PLAYER_HP_BASE 40`, `PLAYER_HP_PER_LEVEL 6`, `PLAYER_ATK_BASE 6`, `PLAYER_ATK_PER_LEVEL 2`. EXP take Poe §B thresholds (length for lv10).
3. Skills: keep Claw + Pounce@2 + Groom@3. Add **only 2** new: ScratchWave@5, Leap@7. **Roar deferred** (out of Slice1–2 for now).
4. Companion: combat buddy = existing cream `companion` art, unlock Forest/Lv3. **OldGrey = mentor NPC only** (cutscene/portrait). **Pebble = NPC** (no second combat companion in Slice1).
5. Enemies Slice1: Bug / Mouse / FoxCub midboss only (reuse Batch A). Prefer §D Bug/Mouse; FoxCub midboss HP35 ATK5 (§D FINAL_BOSS FoxCub block as mid scale). No Badger/Owl/Den in Slice1.
6. Zones Slice1: Camp Lv1–2, Forest Lv3–5. Creek gate after Lv5 teaser OK. Den later.
7. Cutscenes: between every level — portrait + Continue + TTS 0.85; fire §E `LVn_pre` before beat, `LVn_post` after win.

## Slice1 Code brief → Game Code (v0.4.0-s1)
- Target Pages `foonhang/cat-warriors`; Drive zip in 貓族 folder; interim `LEVEL_MAX` 5 (or 10 with 6–10 locked).
- Implement cutscene SM + §E lines lv1–5 into `strings.en.json`.
- Encounters from Poe §C Camp/Forest (scale enemy HP to player curve).
- ScratchWave@5 (aoe light); missing btn → text/color fallback.
- Companion assist every 2 turns after unlock (existing companion art).
- Migration: new key `mao_zu_v04` from `mao_zu_v01`; faint rule unchanged.
- Smoke: boot, cutscenes, Pounce/Groom, ScratchWave@5, FoxCub midboss escape/win → Creek teaser.
- Do **not** invent Badger/Owl/Den/Roar/dual companion.

## Slice1 Art brief → Game Art
- **Standby for Slice1 playable** (reuse Batch A). Optional P0: `btn_scratch_wave.png` only if Code needs before fallback.
- Slice2 Art (start after Slice1 Code underway or parallel): `bg_den`, badger×4 frames(+portrait), owl×4(+portrait), `btn_leap.png`. Comic book kids; white/transparent as prior; Pose 128 / portrait 96. Poe prompt later from 貓族.

## Slice2 (later)
Creek+Den, Leap@7, Badger/Owl, FoxCub+Badger finale, ending §E. After Slice1 playable + Foon ok.
