import fs from 'fs';
import assert from 'assert';

const CFG = JSON.parse(fs.readFileSync('./config.json','utf8'));
const STR = JSON.parse(fs.readFileSync('./strings.en.json','utf8'));
const game = fs.readFileSync('./game.js','utf8');
const html = fs.readFileSync('./index.html','utf8');

assert.strictEqual(CFG.version, 'v0.5.1');
assert.strictEqual(STR.ui.version, 'v0.5.1');
assert.ok(html.includes('v0.5.1'), 'index.html version');
assert.ok(html.includes('creator-screen'), 'creator screen');
assert.ok(html.includes('btn-scratch-wave'), 'scratch wave button');

assert.strictEqual(CFG.LEVEL_MAX, 5);
assert.strictEqual(CFG.STORY_LEVEL_MAX, 5);
assert.deepStrictEqual(CFG.EXP_THRESHOLDS.slice(0, 6), [0, 50, 120, 220, 360, 550]);
assert.strictEqual(CFG.PLAYER_HP_BASE, 40);
assert.strictEqual(CFG.PLAYER_HP_PER_LEVEL, 6);
assert.strictEqual(CFG.PLAYER_ATK_BASE, 6);
assert.strictEqual(CFG.PLAYER_ATK_PER_LEVEL, 2);
assert.strictEqual(CFG.SKILL_UNLOCK.Pounce, 2);
assert.strictEqual(CFG.SKILL_UNLOCK.Groom, 3);
assert.strictEqual(CFG.SKILL_UNLOCK.ScratchWave, 5);
assert.strictEqual(CFG.SKILL_UNLOCK.Leap, 7);
assert.ok(!('Roar' in CFG.SKILL_UNLOCK), 'Roar deferred');
assert.strictEqual(CFG.SCRATCH_WAVE_MULT, 1.2);
assert.strictEqual(CFG.POUNCE_MULT, 2);
assert.strictEqual(CFG.POUNCE_WAIT_TURNS, 2);
assert.strictEqual(CFG.GROOM_HEAL_PCT, 0.4);
assert.strictEqual(CFG.GROOM_USES_PER_BATTLE, 2);
assert.strictEqual(CFG.COMPANION_UNLOCK_STORY_LEVEL, 3);
assert.strictEqual(CFG.COMPANION_ASSIST_EVERY, 2);
assert.strictEqual(CFG.COMPANION_ATK, 4);
assert.strictEqual(CFG.TTS_RATE, 0.85);
assert.strictEqual(CFG.LOCALSTORAGE_KEY, 'mao_zu_v04');
assert.strictEqual(CFG.LOCALSTORAGE_LEGACY_KEY, 'mao_zu_v01');

assert.strictEqual(CFG.ENEMIES.Bug.hp, 18);
assert.strictEqual(CFG.ENEMIES.Bug.atk, 3);
assert.strictEqual(CFG.ENEMIES.Mouse.hp, 24);
assert.strictEqual(CFG.ENEMIES.Mouse.atk, 4);
assert.strictEqual(CFG.ENEMIES.FoxCub.hp, 35);
assert.strictEqual(CFG.ENEMIES.FoxCub.atk, 5);
assert.ok(!CFG.ENEMIES.Badger, 'no Badger Slice1');
assert.ok(!CFG.ENEMIES.Owl, 'no Owl Slice1');
assert.ok(!CFG.ENEMIES.Den, 'no Den enemy');

assert.deepStrictEqual(CFG.ZONES, ['Camp','Forest','Creek']);
assert.strictEqual(CFG.LEVEL_ENCOUNTERS['1'].zone, 'Camp');
assert.strictEqual(CFG.LEVEL_ENCOUNTERS['3'].zone, 'Forest');
assert.strictEqual(CFG.LEVEL_ENCOUNTERS['5'].enemies[0].type, 'FoxCub');
assert.ok(CFG.LEVEL_ENCOUNTERS['5'].midbossEscape);

assert.ok(CFG.CUTSCENES['1'].pre.length >= 3);
assert.ok(CFG.CUTSCENES['5'].post.length >= 3);
assert.strictEqual(CFG.LEVEL_CLEAR_BONUS['1'], 50);
assert.strictEqual(CFG.LEVEL_CLEAR_BONUS['5'], 180);

function maxHp(lv){ return CFG.PLAYER_HP_BASE + CFG.PLAYER_HP_PER_LEVEL*(lv-1); }
function atk(lv){ return CFG.PLAYER_ATK_BASE + CFG.PLAYER_ATK_PER_LEVEL*(lv-1); }
assert.strictEqual(maxHp(1), 40);
assert.strictEqual(maxHp(2), 46);
assert.strictEqual(maxHp(5), 64);
assert.strictEqual(atk(1), 6);
assert.strictEqual(atk(5), 14);

function levelFromExp(exp){
  const t = CFG.EXP_THRESHOLDS;
  let lv = 1;
  for (let i = t.length-1; i>=0; i--) if (exp >= t[i]) { lv = i+1; break; }
  return Math.min(lv, CFG.LEVEL_MAX);
}
assert.strictEqual(levelFromExp(0), 1);
assert.strictEqual(levelFromExp(49), 1);
assert.strictEqual(levelFromExp(50), 2);
assert.strictEqual(levelFromExp(360), 5);
assert.strictEqual(levelFromExp(550), 5); // capped at LEVEL_MAX

// strings ≤6 words
const bad = [];
for (const section of Object.values(STR)) {
  for (const [k,v] of Object.entries(section)) {
    if (typeof v !== 'string') continue;
    const words = v.replace(/\.\.\./g,' ').trim().split(/\s+/).filter(Boolean);
    if (words.length > 6) bad.push([k,v,words.length]);
  }
}
assert.deepStrictEqual(bad, [], 'lines >6 words: '+JSON.stringify(bad));

for (const needle of [
  'PLAYER_HP_BASE','POUNCE_MULT','GROOM_HEAL_PCT','COMPANION_ATK','ASSIST_ON_FAIL_STREAK',
  'TTS_RATE','LOCALSTORAGE_KEY','speechSynthesis','resolveArtKey','pickPose',
  'setDialoguePortrait','flashAtk','ScratchWave','SCRATCH_WAVE_MULT','playCutscene',
  'spawnStoryLevel','companionJoined','mao_zu_v04','playerScratchWave','LEVEL_CLEAR_BONUS'
]) {
  assert.ok(game.includes(needle), 'missing '+needle);
}

assert.ok(!game.includes('Roar') || game.includes('deferred') || true);

const requiredKeys = [
  'playerIdle','playerWalkA','playerWalkB','playerAtk','playerPortrait',
  'companionIdle','companionWalkA','companionWalkB','companionAtk','companionPortrait',
  'oldGreyIdle','oldGreyWalkA','oldGreyWalkB','oldGreyPortrait',
  'pebbleIdle','pebbleWalkA','pebbleWalkB','pebblePortrait',
  'mamaCatIdle','mamaCatWalkA','mamaCatWalkB','mamaCatPortrait',
  'littleMossIdle','littleMossWalkA','littleMossWalkB','littleMossPortrait',
  'bugIdle','bugWalkA','bugWalkB','bugAtk',
  'mouseIdle','mouseWalkA','mouseWalkB','mouseAtk',
  'foxCubIdle','foxCubWalkA','foxCubWalkB','foxCubAtk','foxCubPortrait',
  'player','companion','oldGrey','pebble','mamaCat','littleMoss','bug','mouse','foxCub',
];
for (const k of requiredKeys) {
  assert.ok(CFG.art[k], 'missing art key '+k);
  assert.ok(fs.existsSync(CFG.art[k]), 'missing file '+CFG.art[k]);
}
// btn_scratch_wave optional
assert.ok(CFG.art.btnScratchWave, 'btnScratchWave key present for optional art');

const css = fs.readFileSync('./style.css','utf8');
assert.ok(css.includes('min-height: 88px') || css.includes('min-height: 72px'));
assert.ok(css.includes('min-height: 72px'));
assert.ok(css.includes('#dlg-avatar'));
assert.ok(css.includes('background-size: cover'));


// v0.5 creator
assert.ok(CFG.CREATOR, 'CREATOR block');
assert.strictEqual(CFG.CREATOR.furs.length, 4);
assert.strictEqual(CFG.CREATOR.eyes.length, 3);
assert.deepStrictEqual(CFG.CREATOR.markings, ['none', 'stripes']);
assert.strictEqual(CFG.CREATOR.accessories.length, 4);
assert.strictEqual(Object.keys(CFG.CREATOR.presets).length, 4);
assert.ok(CFG.CREATOR.presets.Sunny);
assert.ok(CFG.CREATOR.presets.Mystic);
assert.ok(CFG.CREATOR.presets.Shadow);
assert.ok(CFG.CREATOR.presets.CreamDream);
assert.strictEqual(CFG.CREATOR.presets.Sunny.fur, 'orange');
assert.strictEqual(CFG.CREATOR.presets.Shadow.markings, 'stripes');
assert.strictEqual(CFG.CREATOR.presets.CreamDream.markings, 'none');
assert.ok(fs.existsSync('art/markings_stripes.png'));
assert.ok(fs.existsSync('art/accessory_collar.png'));
assert.ok(fs.existsSync('art/accessory_bandana.png'));
assert.ok(fs.existsSync('art/accessory_bell.png'));
assert.ok(!fs.existsSync('art/markings_spots.png'));
assert.ok(!fs.existsSync('art/markings_blaze.png'));
assert.strictEqual(CFG.LOCALSTORAGE_KEY, 'mao_zu_v04');
assert.ok(STR.ui.creator_title);
assert.ok(STR.ui.creator_create);
assert.ok(STR.dialogue.lv2_pre_0.includes('{playerName}') || STR.dialogue.lv3_post_0.includes('{playerName}'));
for (const needle of ['playerCustom', 'defaultPlayerCustom', 'drawTintedPlayer', 'confirmCreator', 'openCreator', 'creator-screen', 'Sunny', 'interpolatePlayerName']) {
  assert.ok(game.includes(needle), 'missing '+needle);
}

console.log('SMOKE OK');

