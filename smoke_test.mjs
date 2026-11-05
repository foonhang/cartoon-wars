import fs from 'fs';
import assert from 'assert';
import { createRequire } from 'module';

const CFG = JSON.parse(fs.readFileSync('./config.json','utf8'));
const STR = JSON.parse(fs.readFileSync('./strings.en.json','utf8'));
const game = fs.readFileSync('./game.js','utf8');

assert.deepStrictEqual(CFG.EXP_THRESHOLDS, [0,30,80,150]);
assert.strictEqual(CFG.LEVEL_MAX, 4);
assert.strictEqual(CFG.EXP_REWARD.Bug, 10);
assert.strictEqual(CFG.EXP_REWARD.Mouse, 15);
assert.strictEqual(CFG.EXP_REWARD.FoxCub, 40);
assert.strictEqual(CFG.PLAYER_HP_BASE, 40);
assert.strictEqual(CFG.PLAYER_ATK_BASE, 6);
assert.strictEqual(CFG.SKILL_UNLOCK.Pounce, 2);
assert.strictEqual(CFG.SKILL_UNLOCK.Groom, 3);
assert.strictEqual(CFG.POUNCE_MULT, 2);
assert.strictEqual(CFG.POUNCE_WAIT_TURNS, 2);
assert.strictEqual(CFG.GROOM_HEAL_PCT, 0.4);
assert.strictEqual(CFG.GROOM_USES_PER_BATTLE, 2);
assert.strictEqual(CFG.COMPANION_ASSIST_EVERY, 2);
assert.strictEqual(CFG.COMPANION_ATK, 4);
assert.strictEqual(CFG.ASSIST_ON_FAIL_STREAK, 2);
assert.strictEqual(CFG.ASSIST_ON_FAIL_ENEMY_HP_PCT, 0.2);
assert.strictEqual(CFG.TTS_RATE, 0.85);
assert.strictEqual(CFG.ENEMIES.Bug.hp, 15);
assert.strictEqual(CFG.ENEMIES.Bug.atk, 3);
assert.strictEqual(CFG.ENEMIES.Mouse.hp, 25);
assert.strictEqual(CFG.ENEMIES.Mouse.atk, 4);
assert.strictEqual(CFG.ENEMIES.FoxCub.hp, 50);
assert.strictEqual(CFG.ENEMIES.FoxCub.atk, 5);
assert.deepStrictEqual(CFG.ZONES, ['Camp','Forest','Creek']);

function maxHp(lv){ return CFG.PLAYER_HP_BASE + CFG.PLAYER_HP_PER_LEVEL*(lv-1); }
function atk(lv){ return CFG.PLAYER_ATK_BASE + CFG.PLAYER_ATK_PER_LEVEL*(lv-1); }
assert.strictEqual(maxHp(1), 40);
assert.strictEqual(maxHp(2), 50);
assert.strictEqual(maxHp(3), 60);
assert.strictEqual(maxHp(4), 70);
assert.strictEqual(atk(1), 6);
assert.strictEqual(atk(2), 8);
assert.strictEqual(atk(3), 10);
assert.strictEqual(atk(4), 12);

function levelFromExp(exp){
  const t = CFG.EXP_THRESHOLDS;
  let lv = 1;
  for (let i = t.length-1; i>=0; i--) if (exp >= t[i]) { lv = i+1; break; }
  return Math.min(lv, CFG.LEVEL_MAX);
}
assert.strictEqual(levelFromExp(0), 1);
assert.strictEqual(levelFromExp(29), 1);
assert.strictEqual(levelFromExp(30), 2);
assert.strictEqual(levelFromExp(80), 3);
assert.strictEqual(levelFromExp(150), 4);

// strings ≤6 words
const bad = [];
for (const section of Object.values(STR)) {
  for (const [k,v] of Object.entries(section)) {
    const words = v.replace(/\.\.\./g,' ').trim().split(/\s+/).filter(Boolean);
    if (words.length > 6) bad.push([k,v,words.length]);
  }
}
assert.deepStrictEqual(bad, [], 'lines >6 words: '+JSON.stringify(bad));

// game.js pulls from CFG (sanity: key names present)
assert.strictEqual(CFG.LOCALSTORAGE_KEY, 'mao_zu_v01');
for (const needle of ['PLAYER_HP_BASE','POUNCE_MULT','GROOM_HEAL_PCT','COMPANION_ATK','ASSIST_ON_FAIL_STREAK','TTS_RATE','LOCALSTORAGE_KEY','speechSynthesis']) {
  assert.ok(game.includes(needle), 'missing '+needle);
}

// button min height in CSS
const css = fs.readFileSync('./style.css','utf8');
assert.ok(css.includes('min-height: 88px') || css.includes('min-height: 72px'));
assert.ok(css.includes('min-height: 72px'));

console.log('SMOKE OK');
