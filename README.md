# Cat Clan (貓族) — web prototype

**Version:** v0.5.0 (character creator + Slice1 lv1–5)

Kids ~7.5 story RPG light. Camp→Forest; Creek teaser after FoxCub midboss.

## Run
```bash
cd mao-zu-proto && python3 -m http.server 8765
# open http://localhost:8765
```

## Smoke
```bash
node smoke_test.mjs
```

## Slice1 locks
- Dialogue SoT: Poe §E (trimmed ≤6 words)
- Player: HP base 40 / +6 per lv; ATK base 6 / +2
- Skills: Claw, Pounce@2, Groom@3, ScratchWave@5 (Leap@7 table only; Roar deferred)
- Companion: cream buddy @ story Lv3; OldGrey/Pebble = NPC
- Enemies: Bug / Mouse / FoxCub midboss (HP35 ATK5)
- Save key: `mao_zu_v04` (migrates from `mao_zu_v01`; `playerCustom` Sunny default)
- Creator: name/fur/eyes/markings/accessory + 4 presets; tint interim until Art P0

Pages: parent CloudAgent push — do not self-push.
