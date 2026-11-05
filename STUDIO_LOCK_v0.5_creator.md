# Studio lock — Cat Clan v0.5 Creator (2026-11-05)

Poe draft (partial): custom PC Sims-like create. Studio locks below override Poe conflicts (no swords; no Redux/TS; keep v0.4 combat curve + cream companion).

## Direction
- PC = player-made original cat (not fixed book hero).
- Book cast (MamaCat, OldGrey, Pebble, LittleMoss, FoxCub, cream companion) = NPC / mentor / combat buddy as already locked.
- v0.4.0-s1 stays playable until v0.5 ships.

## Creator UX (kids)
1. First boot / no `playerCustom` → Creator screen before Camp lv1.
2. Live preview (tint+overlays).
3. Slots (≤8 taps; preset palettes only, no free RGB):
   - **Name** (en letters, max 12; default `Kit`)
   - **Fur** 4: orange / grey / cream / black
   - **Eyes** 3: amber / green / blue
   - **Markings** 4: none / stripes / spots / blaze
   - **Accessory** 4: none / collar / bandana / bell
4. One-tap presets: Sunny / Mystic / Shadow / CreamDream (fill all slots).
5. **Create** → save → intro cutscene → Camp lv1.
6. Cosmetic only — **no weapons on sprite**.

## Runtime art
- Base: grayscale-tintable `player_*` idle / walk_a / walk_b / atk / portrait (pose 128; portrait 96; comic).
- Overlay: markings_{id}.png + accessory_{id}.png (anchor neck/chest; same canvas size).
- Draw: tint fur → eyes → markings → accessory. Missing overlay = skip.
- Until new base lands: Code may tint current orange player as interim OR use preset nearest color.

## Save
- Extend `mao_zu_v04` with `playerCustom: {name,fur,eyes,markings,accessory,preset?}`.
- Old saves without custom → soft-migrate default Sunny + optional one-time Creator offer (or auto default; prefer auto default + Camp “Remake look” later).

## Cutscenes
- Replace fixed hero address with `{playerName}` in strings; §E lines keep ≤6 words/line.

## Art brief → Game Art (P0)
Burn via Poe (Foon帳), QA, Drive 貓族 folder:
1. Grayscale base: `player_idle/walk_a/walk_b/atk/portrait` (comic kids cat, no collar baked-in).
2. Markings overlays: stripes, spots, blaze (transparent bg).
3. Accessories: collar, bandana, bell.
4. Optional: simple creator panel bg / Continue already exists.
Reuse cream companion + NPC Batch A. No Badger/Owl.

## Code brief → Game Code (v0.5.0)
- Creator screen + preview compositor + save field.
- Wire custom look into explore/battle/cutscene portraits.
- Presets + Randomize optional.
- Smoke: create→Camp→cutscene shows name; battle uses tinted PC; reload keeps look.
- Pages `cat-warriors`; Drive zip; do not invent Slice2 Den/Badger.
- Follow poteto-mode; no play-design changes beyond this lock.

## Ship
Slice Creator first (create→lv1). Slice2 lv6–10 still waits Foon.
