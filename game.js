/* Cat Clan RPG light v0.4.0-s1 — Slice1 lv1–5; numbers from config.json; cutscenes §E */
(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let CFG = null;
  let STR = null;
  let artImages = {};

  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function playerMaxHp(level) {
    return CFG.PLAYER_HP_BASE + CFG.PLAYER_HP_PER_LEVEL * (level - 1);
  }
  function playerAtk(level) {
    return CFG.PLAYER_ATK_BASE + CFG.PLAYER_ATK_PER_LEVEL * (level - 1);
  }
  function levelFromExp(exp) {
    const t = CFG.EXP_THRESHOLDS;
    let lv = 1;
    for (let i = t.length - 1; i >= 0; i--) {
      if (exp >= t[i]) { lv = i + 1; break; }
    }
    return Math.min(lv, CFG.LEVEL_MAX);
  }

  let muted = false;
  let lastSpoken = "";
  function speak(text) {
    lastSpoken = text || "";
    if (muted || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = CFG.TTS_LANG || "en-US";
    u.rate = CFG.TTS_RATE;
    window.speechSynthesis.speak(u);
  }
  function replay() { speak(lastSpoken); }

  const state = {
    mode: "title", // title | explore | dialogue | battle | faint | ending | pause
    zone: "Camp",
    storyLevel: 1,
    levelCleared: false,
    cutscenePending: null, // "pre" | "post" | null
    player: {
      x: 160, y: 300, r: 28,
      hp: 40, maxHp: 40, atk: 6,
      level: 1, exp: 0,
      facing: 1,
    },
    companion: null,
    flags: {
      companionJoined: false,
      sawLvlPounce: false,
      sawLvlGroom: false,
      sawLvlScratchWave: false,
      slice1Done: false,
      ending: false,
    },
    faintStreak: 0,
    npcs: [],
    enemies: [],
    props: [],
    dialogueQueue: [],
    dialogueCb: null,
    dialogueSpeaker: null,
    battle: null,
    targetArrow: null,
    moveTarget: null,
    saveLoaded: false,
    anim: {
      walkT: 0,
      walkFlip: 0,
      playerAtkUntil: 0,
      companionAtkUntil: 0,
      enemyAtkUntil: 0,
    },
    _defeated: {},
  };

  const W = 960, H = 540;

  function zoneBgColor(zone) {
    return CFG.placeholderColors[
      zone === "Camp" ? "bgCamp" : zone === "Forest" ? "bgForest" : "bgCreek"
    ];
  }

  function encounterSpec(storyLv) {
    return CFG.LEVEL_ENCOUNTERS[String(storyLv)] || CFG.LEVEL_ENCOUNTERS["1"];
  }

  function ensureCompanion() {
    const need = state.storyLevel >= (CFG.COMPANION_UNLOCK_STORY_LEVEL || 3)
      || state.player.level >= (CFG.COMPANION_UNLOCK_STORY_LEVEL || 3);
    if (need && !state.flags.companionJoined) {
      state.flags.companionJoined = true;
      state.companion = { x: state.player.x - 40, y: state.player.y + 20, r: 22 };
      showToast(STR.ui.companion_join);
      speak(STR.ui.companion_join);
    }
    if (state.flags.companionJoined && !state.companion) {
      state.companion = { x: state.player.x - 40, y: state.player.y + 20, r: 22 };
    }
  }

  function spawnStoryLevel(storyLv, skipPre) {
    const spec = encounterSpec(storyLv);
    state.storyLevel = storyLv;
    state.zone = spec.zone;
    state.levelCleared = false;
    state.npcs = [];
    state.enemies = [];
    state.props = [];
    state.moveTarget = null;
    state._defeated = {};

    const entrance = { x: 80, y: H / 2 };
    state.player.x = entrance.x;
    state.player.y = entrance.y;

    // mentor / scout NPCs by zone (NPC only — not combat buddy)
    if (spec.zone === "Camp") {
      if (storyLv === 1) {
        state.npcs.push({
          id: "mama", name: "Mama Cat", kind: "mamaCat",
          x: 300, y: 240, r: 30, hasBang: false,
          lines: () => ["lv1_pre_0"],
          onDone: () => {},
        });
      } else {
        state.npcs.push({
          id: "moss", name: "Little Moss", kind: "littleMoss",
          x: 300, y: 240, r: 28, hasBang: false,
          lines: () => ["lv2_pre_0"],
          onDone: () => {},
        });
      }
    } else if (spec.zone === "Forest") {
      state.npcs.push({
        id: "oldGrey", name: "Old Grey", kind: "oldGrey",
        x: 260, y: 220, r: 30, hasBang: false,
        lines: () => ["lv3_pre_1"],
        onDone: () => {},
      });
      if (storyLv >= 4) {
        state.npcs.push({
          id: "pebble", name: "Pebble", kind: "pebble",
          x: 360, y: 300, r: 26, hasBang: false,
          lines: () => ["lv4_pre_1"],
          onDone: () => {},
        });
      }
    }

    let idx = 0;
    for (const pack of (spec.enemies || [])) {
      for (let i = 0; i < pack.count; i++) {
        const id = `L${storyLv}_${pack.type}_${idx}`;
        state.enemies.push({
          id,
          type: pack.type,
          x: 480 + (idx % 3) * 110,
          y: 260 + Math.floor(idx / 3) * 100,
          r: pack.type === "FoxCub" ? 34 : pack.type === "Mouse" ? 24 : 22,
          alive: true,
        });
        idx++;
      }
    }

    ensureCompanion();
    updateQuestHud();
    updateHud();
    saveGame();

    if (!skipPre) {
      playCutscene("pre", () => {
        setMode("explore");
        updateQuestHud();
      });
    }
  }

  function playCutscene(kind, cb) {
    const block = (CFG.CUTSCENES[String(state.storyLevel)] || {})[kind] || [];
    if (!block.length) {
      if (cb) cb();
      return;
    }
    state.cutscenePending = kind;
    const keys = block.map((line) => line.key);
    // show with per-line speakers via dialogue meta
    state._cutsceneLines = block.slice();
    state.dialogueQueue = keys.slice();
    state.dialogueCb = () => {
      state.cutscenePending = null;
      state._cutsceneLines = null;
      if (cb) cb();
    };
    state.dialogueSpeaker = block[0].speaker;
    setMode("dialogue");
    nextDialogueLine();
  }

  function loadZone(zone) {
    // Slice1: zone changes only via story levels
    spawnStoryLevel(state.storyLevel, true);
  }

  // ---------- save ----------
  function saveGame() {
    const key = CFG.LOCALSTORAGE_KEY || "mao_zu_v04";
    const data = {
      version: CFG.version,
      zone: state.zone,
      storyLevel: state.storyLevel,
      levelCleared: state.levelCleared,
      player: {
        exp: state.player.exp,
        level: state.player.level,
        hp: state.player.hp,
      },
      flags: { ...state.flags },
      faintStreak: state.faintStreak,
      defeated: state._defeated || {},
      muted,
      migratedFrom: state._migratedFrom || null,
    };
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
  }

  function migrateLegacy() {
    const legacy = CFG.LOCALSTORAGE_LEGACY_KEY;
    if (!legacy) return null;
    let raw;
    try { raw = localStorage.getItem(legacy); } catch (_) { return null; }
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      // Cap into Slice1: map old zone progress into storyLevel
      let story = 1;
      if (data.flags && data.flags.foxDefeated) story = 5;
      else if (data.flags && data.flags.forestDone) story = 4;
      else if (data.zone === "Forest") story = 3;
      else if (data.flags && data.flags.campDone) story = 2;
      return {
        version: CFG.version,
        zone: data.zone || "Camp",
        storyLevel: Math.min(story, CFG.STORY_LEVEL_MAX || 5),
        levelCleared: false,
        player: data.player || { exp: 0, level: 1, hp: 40 },
        flags: {
          companionJoined: !!(data.flags && (data.flags.pebbleJoined || data.flags.companionJoined)),
          sawLvlPounce: !!(data.flags && data.flags.sawLvlPounce),
          sawLvlGroom: !!(data.flags && data.flags.sawLvlGroom),
          sawLvlScratchWave: false,
          slice1Done: false,
          ending: false,
        },
        faintStreak: data.faintStreak || 0,
        defeated: {},
        muted: !!data.muted,
        migratedFrom: "v0.3",
      };
    } catch (_) { return null; }
  }

  function loadGame() {
    const key = CFG.LOCALSTORAGE_KEY || "mao_zu_v04";
    let raw;
    try { raw = localStorage.getItem(key); } catch (_) { raw = null; }
    let data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch (_) { data = null; }
    }
    if (!data) {
      data = migrateLegacy();
      if (data) {
        state._migratedFrom = "v0.3";
        try { localStorage.setItem(key, JSON.stringify({ ...data, version: CFG.version })); } catch (_) {}
      }
    }
    if (!data) return false;
    try {
      state.player.exp = data.player.exp || 0;
      state.player.level = levelFromExp(state.player.exp);
      applyPlayerStats();
      state.player.hp = Math.min(data.player.hp || state.player.maxHp, state.player.maxHp);
      state.flags = { ...state.flags, ...(data.flags || {}) };
      state.faintStreak = data.faintStreak || 0;
      state._defeated = data.defeated || {};
      muted = !!data.muted;
      state.storyLevel = data.storyLevel || 1;
      state.levelCleared = !!data.levelCleared;
      state._migratedFrom = data.migratedFrom || null;
      updateMuteBtn();
      spawnStoryLevel(state.storyLevel, true);
      if (state.flags.slice1Done) {
        // stay on last level explore
      }
      return true;
    } catch (_) { return false; }
  }

  function defaultFlags() {
    return {
      companionJoined: false,
      sawLvlPounce: false,
      sawLvlGroom: false,
      sawLvlScratchWave: false,
      slice1Done: false,
      ending: false,
    };
  }

  function newGame() {
    state.player.exp = 0;
    state.player.level = 1;
    applyPlayerStats();
    state.player.hp = state.player.maxHp;
    state.flags = defaultFlags();
    state.faintStreak = 0;
    state._defeated = {};
    state.companion = null;
    state.storyLevel = 1;
    state.levelCleared = false;
    state._migratedFrom = null;
    spawnStoryLevel(1, false);
  }

  function applyPlayerStats() {
    const lv = state.player.level;
    state.player.maxHp = playerMaxHp(lv);
    state.player.atk = playerAtk(lv);
    if (state.player.hp > state.player.maxHp) state.player.hp = state.player.maxHp;
  }

  // ---------- UI ----------
  function updateHud() {
    const p = state.player;
    const pct = (p.hp / p.maxHp) * 100;
    $("hp-fill").style.width = pct + "%";
    $("hp-fill").style.background = pct < 30 ? "#e53935" : pct < 60 ? "#fb8c00" : "#4caf50";
    $("hp-text").textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    $("lv-text").textContent = (STR.ui.lv || "Lv.") + p.level;
    $("ver").textContent = CFG.version;
  }

  function updateQuestHud() {
    const q = $("quest-text");
    const ico = $("quest-icon");
    const lv = state.storyLevel;
    const icons = { 1: "🐛", 2: "🐭", 3: "🌲", 4: "🤝", 5: "🦊" };
    ico.textContent = icons[lv] || "🐱";
    if (state.flags.slice1Done) {
      q.textContent = STR.quest.done;
    } else if (state.levelCleared) {
      q.textContent = STR.ui.win;
    } else {
      q.textContent = STR.quest["lv" + lv] || ("Level " + lv);
    }
    updateArrowTarget();
  }

  function updateArrowTarget() {
    let t = null;
    if (!state.levelCleared) {
      t = state.enemies.find((e) => e.alive) || null;
    }
    state.targetArrow = t ? { x: t.x, y: t.y - 50 } : null;
  }

  function updateMuteBtn() {
    $("btn-mute").textContent = muted ? "🔇" : "🔊";
  }

  function showToast(msg, ms = 1600) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add("hidden"), ms);
  }

  function setMode(m) {
    state.mode = m;
    $("dialogue").classList.toggle("hidden", m !== "dialogue");
    $("battle-ui").classList.toggle("hidden", m !== "battle");
    $("faint-screen").classList.toggle("hidden", m !== "faint");
    $("ending-screen").classList.toggle("hidden", m !== "ending");
    $("pause-screen").classList.toggle("hidden", m !== "pause");
    $("title-screen").classList.toggle("hidden", m !== "title");
  }

  // ---------- dialogue ----------
  function showDialogue(keys, cb, speakerKind) {
    state.dialogueQueue = keys.slice();
    state.dialogueCb = cb || null;
    state.dialogueSpeaker = speakerKind || null;
    state._cutsceneLines = null;
    setMode("dialogue");
    nextDialogueLine();
  }

  function resolveSpeaker(key) {
    if (state._cutsceneLines) {
      const line = state._cutsceneLines.find((l) => l.key === key);
      if (line) return line.speaker;
    }
    if (/^mama_|^lv1_pre|^lv1_post/.test(key)) return "mamaCat";
    if (/^lv2_/.test(key)) return "littleMoss";
    if (/^lv3_/.test(key)) return "oldGrey";
    if (/pebble|lv4_pre_1|lv4_pre_3|lv4_post_0|lv5_pre_3|lv5_post_3|creek_teaser/.test(key)) return "pebble";
    if (/fox|lv5_post_0/.test(key)) return "foxCub";
    if (/oldGrey|lv3_|lv4_pre_0|lv4_post_1|lv5_pre_0|lv5_pre_2|lv5_post_2/.test(key)) return "oldGrey";
    return state.dialogueSpeaker || "player";
  }

  function setDialoguePortrait(kind) {
    const av = $("dlg-avatar");
    const portKey = kind + "Portrait";
    const img = artImages[portKey];
    const col = CFG.placeholderColors[kind] || CFG.placeholderColors.oldGrey || "#9a9a9a";
    if (img && img.complete && img.naturalWidth) {
      av.style.backgroundColor = col;
      av.style.backgroundImage = "url(" + CFG.art[portKey] + ")";
      av.style.backgroundSize = "cover";
      av.style.backgroundPosition = "center";
      av.style.backgroundRepeat = "no-repeat";
    } else {
      av.style.backgroundImage = "none";
      av.style.background = col;
    }
  }

  function nextDialogueLine() {
    if (!state.dialogueQueue.length) {
      const cb = state.dialogueCb;
      state.dialogueCb = null;
      state.dialogueSpeaker = null;
      setMode("explore");
      if (cb) cb();
      saveGame();
      return;
    }
    const key = state.dialogueQueue.shift();
    const text = STR.dialogue[key] || STR.ui[key] || key;
    $("dlg-text").textContent = text;
    // speaker from cutscene queue head matching
    let speaker = resolveSpeaker(key);
    if (state._cutsceneLines) {
      const hit = state._cutsceneLines.find((l) => l.key === key);
      if (hit) speaker = hit.speaker;
    }
    setDialoguePortrait(speaker);
    speak(text);
  }

  // ---------- battle ----------
  function startBattle(enemy) {
    const edef = CFG.ENEMIES[enemy.type];
    let hp = edef.hp;
    if (state.faintStreak >= CFG.ASSIST_ON_FAIL_STREAK) {
      hp = Math.floor(hp * (1 - CFG.ASSIST_ON_FAIL_ENEMY_HP_PCT));
    }
    state.battle = {
      enemy,
      enemyHp: hp,
      enemyMaxHp: hp,
      enemyAtk: edef.atk,
      turn: 0,
      pounceWait: 0,
      groomUses: CFG.GROOM_USES_PER_BATTLE,
      telegraph: "bite",
      companionTimer: 0,
      playerActing: true,
      firstHint: enemy.type === "Bug" && state.storyLevel === 1 && state.enemies.filter((e) => !e.alive).length === 0,
    };
    setMode("battle");
    updateBattleUi();
    if (state.battle.firstHint) {
      showToast(STR.dialogue.tut_claw);
      speak(STR.dialogue.tut_claw);
    }
    if (enemy.type === "FoxCub") {
      speak(STR.dialogue.fox_1);
    }
  }

  function updateBattleUi() {
    const b = state.battle;
    if (!b) return;
    const lv = state.player.level;
    const pounceLv = CFG.SKILL_UNLOCK.Pounce;
    const groomLv = CFG.SKILL_UNLOCK.Groom;
    const waveLv = CFG.SKILL_UNLOCK.ScratchWave;
    const btnP = $("btn-pounce");
    const btnG = $("btn-groom");
    const btnW = $("btn-scratch-wave");
    btnP.classList.toggle("locked", lv < pounceLv);
    btnG.classList.toggle("locked", lv < groomLv);
    btnW.classList.toggle("locked", lv < waveLv);
    btnP.disabled = lv < pounceLv || b.pounceWait > 0 || !b.playerActing;
    btnG.disabled = lv < groomLv || b.groomUses <= 0 || !b.playerActing;
    btnW.disabled = lv < waveLv || b.pounceWait > 0 || !b.playerActing;
    $("btn-claw").disabled = !b.playerActing || b.pounceWait > 0;
    $("battle-telegraph").textContent = "🦷";
    let status = `${b.enemy.type}  ${b.enemyHp}/${b.enemyMaxHp}`;
    if (b.pounceWait > 0) status += `  (wait ${b.pounceWait})`;
    if (state.flags.companionJoined) status += "  · Buddy";
    if (b.groomUses < CFG.GROOM_USES_PER_BATTLE && lv >= groomLv) {
      status += `  Groom ${b.groomUses}`;
    }
    $("battle-status").textContent = status;
    updateHud();
  }

  function applyDamageToPlayer(dmg) {
    const p = state.player;
    if (p.hp > 1 && dmg >= p.hp) {
      p.hp = 1;
    } else {
      p.hp = Math.max(0, p.hp - dmg);
    }
  }

  function flashAtk(who) {
    const until = performance.now() + 260;
    if (who === "player") state.anim.playerAtkUntil = until;
    else if (who === "companion") state.anim.companionAtkUntil = until;
    else if (who === "enemy") state.anim.enemyAtkUntil = until;
  }

  function dealToEnemy(dmg) {
    const b = state.battle;
    b.enemyHp = Math.max(0, b.enemyHp - dmg);
  }

  function enemyHitOnce() {
    const b = state.battle;
    if (!b || state.mode !== "battle") return false;
    flashAtk("enemy");
    applyDamageToPlayer(b.enemyAtk);
    updateHud();
    if (state.player.hp <= 0) {
      onFaint();
      return true;
    }
    return false;
  }

  function runPounceSkips() {
    const b = state.battle;
    if (!b || state.mode !== "battle") return;
    if (b.pounceWait <= 0) {
      b.playerActing = true;
      b.turn++;
      updateBattleUi();
      return;
    }
    b.pounceWait--;
    updateBattleUi();
    setTimeout(() => {
      if (enemyHitOnce()) return;
      runPounceSkips();
    }, 450);
  }

  function afterPlayerAction() {
    const b = state.battle;
    if (b.enemyHp <= 0) {
      onBattleWin();
      return;
    }
    if (state.flags.companionJoined) {
      b.companionTimer++;
      if (b.companionTimer % CFG.COMPANION_ASSIST_EVERY === 0) {
        flashAtk("companion");
        dealToEnemy(CFG.COMPANION_ATK);
        showToast(`Buddy! −${CFG.COMPANION_ATK}`);
        if (b.enemyHp <= 0) {
          onBattleWin();
          return;
        }
      }
    }
    b.playerActing = false;
    updateBattleUi();
    setTimeout(() => {
      if (enemyHitOnce()) return;
      runPounceSkips();
    }, 450);
  }

  function playerClaw() {
    const b = state.battle;
    if (!b || !b.playerActing || b.pounceWait > 0) return;
    flashAtk("player");
    dealToEnemy(state.player.atk);
    afterPlayerAction();
  }

  function playerPounce() {
    const b = state.battle;
    if (!b || !b.playerActing) return;
    if (state.player.level < CFG.SKILL_UNLOCK.Pounce) return;
    if (b.pounceWait > 0) return;
    flashAtk("player");
    dealToEnemy(state.player.atk * CFG.POUNCE_MULT);
    b.pounceWait = CFG.POUNCE_WAIT_TURNS;
    afterPlayerAction();
  }

  function playerGroom() {
    const b = state.battle;
    if (!b || !b.playerActing) return;
    if (state.player.level < CFG.SKILL_UNLOCK.Groom) return;
    if (b.groomUses <= 0) return;
    const heal = Math.floor(state.player.maxHp * CFG.GROOM_HEAL_PCT);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    b.groomUses--;
    showToast(`+${heal} HP`);
    afterPlayerAction();
  }

  function playerScratchWave() {
    const b = state.battle;
    if (!b || !b.playerActing || b.pounceWait > 0) return;
    if (state.player.level < CFG.SKILL_UNLOCK.ScratchWave) return;
    flashAtk("player");
    const dmg = Math.floor(state.player.atk * (CFG.SCRATCH_WAVE_MULT || 1.2));
    dealToEnemy(dmg);
    showToast(`Wave! −${dmg}`);
    afterPlayerAction();
  }

  function gainExp(amount) {
    const before = state.player.level;
    state.player.exp += amount;
    const after = levelFromExp(state.player.exp);
    state.player.level = after;
    applyPlayerStats();
    if (after > before) {
      state.player.hp = state.player.maxHp;
      showToast(STR.ui.lvlup);
      speak(STR.ui.lvlup);
      if (after >= CFG.SKILL_UNLOCK.Pounce && !state.flags.sawLvlPounce) {
        state.flags.sawLvlPounce = true;
        setTimeout(() => {
          showToast(STR.ui.unlock_pounce);
          speak(STR.ui.unlock_pounce);
        }, 900);
      }
      if (after >= CFG.SKILL_UNLOCK.Groom && !state.flags.sawLvlGroom) {
        state.flags.sawLvlGroom = true;
        setTimeout(() => {
          showToast(STR.ui.unlock_groom);
          speak(STR.ui.unlock_groom);
        }, 900);
      }
      if (after >= CFG.SKILL_UNLOCK.ScratchWave && !state.flags.sawLvlScratchWave) {
        state.flags.sawLvlScratchWave = true;
        setTimeout(() => {
          showToast(STR.ui.unlock_scratch_wave);
          speak(STR.ui.unlock_scratch_wave);
        }, 900);
      }
      ensureCompanion();
    }
    updateHud();
  }

  function checkLevelClear() {
    const alive = state.enemies.some((e) => e.alive);
    if (alive || state.levelCleared) return;
    state.levelCleared = true;
    const bonus = (CFG.LEVEL_CLEAR_BONUS && CFG.LEVEL_CLEAR_BONUS[String(state.storyLevel)]) || 0;
    if (bonus) gainExp(bonus);

    const spec = encounterSpec(state.storyLevel);
    const afterPost = () => {
      if (state.storyLevel >= (CFG.STORY_LEVEL_MAX || 5)) {
        // Creek teaser then soft ending
        showDialogue(["creek_teaser_0", "creek_teaser_1", "ending_1", "ending_2"], () => {
          state.flags.slice1Done = true;
          state.flags.ending = true;
          $("end1").textContent = STR.ui.ending_1;
          $("end2").textContent = STR.ui.ending_2;
          setMode("ending");
          speak(STR.ui.ending_1);
          saveGame();
        }, "pebble");
        return;
      }
      spawnStoryLevel(state.storyLevel + 1, false);
    };

    setTimeout(() => {
      if (spec.midbossEscape) {
        showToast(STR.ui.fox_escape);
        speak(STR.ui.fox_escape);
      }
      playCutscene("post", afterPost);
    }, 500);
  }

  function onBattleWin() {
    const b = state.battle;
    const enemy = b.enemy;
    const exp = CFG.EXP_REWARD[enemy.type] || CFG.ENEMIES[enemy.type].exp;
    enemy.alive = false;
    if (!state._defeated) state._defeated = {};
    state._defeated[enemy.id] = true;
    state.enemies = state.enemies.filter((e) => e.id !== enemy.id);
    state.battle = null;
    state.faintStreak = 0;

    gainExp(exp);
    setMode("explore");
    showToast(STR.ui.win);
    speak(STR.ui.win);

    updateQuestHud();
    saveGame();
    checkLevelClear();
  }

  function onFaint() {
    state.battle = null;
    state.faintStreak++;
    state.player.hp = state.player.maxHp;
    state.player.x = 80;
    state.player.y = H / 2;
    state.moveTarget = null;
    $("faint-msg").textContent = STR.ui.faint;
    setMode("faint");
    speak(STR.ui.faint);
    saveGame();
  }

  // ---------- input ----------
  function canvasPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function onTap(evt) {
    if (state.mode !== "explore") return;
    evt.preventDefault();
    const p = canvasPos(evt);

    for (const n of state.npcs) {
      if (dist(p, n) < n.r + 20) {
        const lines = n.lines();
        showDialogue(lines, n.onDone, n.kind);
        return;
      }
    }
    for (const e of state.enemies) {
      if (e.alive && dist(p, e) < e.r + 16) {
        startBattle(e);
        return;
      }
    }
    state.moveTarget = { x: clamp(p.x, 40, W - 40), y: clamp(p.y, 60, H - 40) };
  }

  canvas.addEventListener("pointerdown", onTap);

  // ---------- draw ----------
  function artLoaded(key) {
    const img = artImages[key];
    return !!(img && img.complete && img.naturalWidth);
  }

  function resolveArtKey(kind, pose) {
    const suffix = { idle: "Idle", walkA: "WalkA", walkB: "WalkB", atk: "Atk" }[pose] || "Idle";
    const keyed = kind + suffix;
    if (CFG.art[keyed] && artLoaded(keyed)) return keyed;
    if (CFG.art[kind] && artLoaded(kind)) return kind;
    return null;
  }

  function pickPose(moving, attacking) {
    if (attacking) return "atk";
    if (moving) return state.anim.walkFlip ? "walkB" : "walkA";
    return "idle";
  }

  function drawPlaceholder(kind, x, y, r, pose) {
    const usePose = pose || "idle";
    const key = resolveArtKey(kind, usePose);
    if (key) {
      const img = artImages[key];
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      return;
    }
    const color = CFG.placeholderColors[kind] || "#888";
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (["player", "companion", "oldGrey", "pebble", "mamaCat", "littleMoss", "foxCub"].includes(kind)) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.5);
      ctx.lineTo(x - r * 0.3, y - r * 1.2);
      ctx.lineTo(x - r * 0.1, y - r * 0.4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + r * 0.7, y - r * 0.5);
      ctx.lineTo(x + r * 0.3, y - r * 1.2);
      ctx.lineTo(x + r * 0.1, y - r * 0.4);
      ctx.fill();
    }
    ctx.fillStyle = "#222";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    const label = kind === "foxCub" ? "Fox" : kind === "oldGrey" ? "Grey" : kind === "littleMoss" ? "Moss" : kind === "mamaCat" ? "Mama" : "";
    if (label) ctx.fillText(label, x, y + 4);
  }

  function draw() {
    const bgKey = state.zone === "Camp" ? "bgCamp" : state.zone === "Forest" ? "bgForest" : "bgCreek";
    const bgImg = artImages[bgKey];
    if (bgImg && bgImg.complete && bgImg.naturalWidth) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else {
      ctx.fillStyle = zoneBgColor(state.zone);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(0, i * 70, W, 30);
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(state.zone + " · L" + state.storyLevel, 16, H - 16);

    for (const n of state.npcs) {
      const kind = n.kind === "gate" ? "oldGrey" : n.kind;
      drawPlaceholder(kind, n.x, n.y, n.r, "idle");
    }

    const now = performance.now();
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const kind = e.type === "FoxCub" ? "foxCub" : e.type.toLowerCase();
      drawPlaceholder(kind, e.x, e.y, e.r, "idle");
    }

    if (state.companion && state.flags.companionJoined) {
      const c = state.companion;
      const cMoving = Math.hypot(c.x - (state.player.x - 40), c.y - (state.player.y + 20)) > 4;
      const cAtk = now < state.anim.companionAtkUntil;
      drawPlaceholder("companion", c.x, c.y, c.r, pickPose(cMoving, cAtk));
    }

    {
      const pMoving = !!state.moveTarget && state.mode === "explore";
      const pAtk = now < state.anim.playerAtkUntil;
      drawPlaceholder("player", state.player.x, state.player.y, state.player.r, pickPose(pMoving, pAtk));
    }

    if (state.mode === "battle" && state.battle) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, W, H);
      const e = state.battle.enemy;
      const eKind = e.type === "FoxCub" ? "foxCub" : e.type.toLowerCase();
      const eAtk = now < state.anim.enemyAtkUntil;
      const pAtkB = now < state.anim.playerAtkUntil;
      const cAtkB = now < state.anim.companionAtkUntil;
      drawPlaceholder(eKind, W * 0.7, H * 0.4, 50, pickPose(false, eAtk));
      drawPlaceholder("player", W * 0.28, H * 0.45, 44, pickPose(false, pAtkB));
      if (state.flags.companionJoined) {
        drawPlaceholder("companion", W * 0.18, H * 0.55, 28, pickPose(false, cAtkB));
      }
      drawBar(W * 0.7 - 50, H * 0.4 - 70, 100, 12, state.battle.enemyHp / state.battle.enemyMaxHp, "#e53935");
      drawBar(W * 0.28 - 50, H * 0.45 - 70, 100, 12, state.player.hp / state.player.maxHp, "#4caf50");
    }

    const arrow = $("arrow");
    if (state.targetArrow && state.mode === "explore") {
      const rect = canvas.getBoundingClientRect();
      const app = $("app").getBoundingClientRect();
      const sx = rect.left + (state.targetArrow.x / W) * rect.width - app.left;
      const sy = rect.top + (state.targetArrow.y / H) * rect.height - app.top;
      arrow.style.display = "block";
      arrow.style.left = sx + "px";
      arrow.style.top = sy + "px";
    } else {
      arrow.style.display = "none";
    }
  }

  function drawBar(x, y, w, h, pct, color) {
    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(pct, 0, 1), h);
  }

  function update(dt) {
    state.anim.walkT += dt;
    if (state.anim.walkT >= 0.15) {
      state.anim.walkT = 0;
      state.anim.walkFlip = state.anim.walkFlip ? 0 : 1;
    }
    if (state.mode !== "explore") return;
    const p = state.player;
    if (state.moveTarget) {
      const dx = state.moveTarget.x - p.x;
      const dy = state.moveTarget.y - p.y;
      const d = Math.hypot(dx, dy);
      const speed = 220;
      if (d < 4) {
        state.moveTarget = null;
      } else {
        p.x += (dx / d) * speed * dt;
        p.y += (dy / d) * speed * dt;
      }
    }
    if (state.companion && state.flags.companionJoined) {
      const c = state.companion;
      const tx = p.x - 40, ty = p.y + 20;
      c.x += (tx - c.x) * 0.08;
      c.y += (ty - c.y) * 0.08;
    }
    for (const e of state.enemies) {
      if (e.alive && dist(p, e) < p.r + e.r - 4) {
        state.moveTarget = null;
        startBattle(e);
        break;
      }
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function wire() {
    $("btn-start").onclick = () => {
      newGame();
      // newGame already fires pre cutscene
    };
    $("btn-continue").onclick = () => {
      if (loadGame()) setMode("explore");
    };
    $("btn-next").onclick = () => nextDialogueLine();
    $("btn-replay").onclick = () => replay();
    $("btn-mute").onclick = () => {
      muted = !muted;
      if (muted && window.speechSynthesis) window.speechSynthesis.cancel();
      updateMuteBtn();
      saveGame();
    };
    $("btn-pause").onclick = () => {
      if (state.mode === "explore" || state.mode === "battle") setMode("pause");
    };
    $("btn-resume").onclick = () => {
      setMode(state.battle ? "battle" : "explore");
    };
    $("btn-restart").onclick = () => {
      newGame();
    };
    $("btn-faint-ok").onclick = () => {
      setMode("explore");
      updateQuestHud();
    };
    $("btn-end-restart").onclick = () => {
      newGame();
    };
    $("btn-claw").onclick = () => playerClaw();
    $("btn-pounce").onclick = () => playerPounce();
    $("btn-groom").onclick = () => playerGroom();
    $("btn-scratch-wave").onclick = () => playerScratchWave();

    document.querySelectorAll("[data-str]").forEach((el) => {
      const k = el.getAttribute("data-str");
      if (STR.ui[k]) el.textContent = STR.ui[k];
    });
    $("faint-msg").textContent = STR.ui.faint;
    $("btn-faint-ok").textContent = STR.ui.retry;
    $("btn-resume").textContent = STR.ui.continue;
    $("end1").textContent = STR.ui.ending_1;
    $("end2").textContent = STR.ui.ending_2;
  }

  function preloadArt() {
    const keys = Object.keys(CFG.art);
    keys.forEach((k) => {
      const img = new Image();
      img.src = CFG.art[k];
      artImages[k] = img;
      img.onload = () => {
        if (k.startsWith("btn")) applyBtnArt();
      };
    });
  }

  function applyBtnArt() {
    const map = {
      btnClaw: "btn-claw",
      btnPounce: "btn-pounce",
      btnGroom: "btn-groom",
      btnScratchWave: "btn-scratch-wave",
      btnContinue: "btn-continue",
      btnRetry: "btn-faint-ok",
    };
    Object.keys(map).forEach((artKey) => {
      const img = artImages[artKey];
      const el = $(map[artKey]);
      if (!el || !img || !img.complete || !img.naturalWidth) return;
      el.classList.add("has-art");
      el.style.backgroundImage = "url(" + CFG.art[artKey] + ")";
      el.style.backgroundSize = "contain";
      el.style.backgroundRepeat = "no-repeat";
      el.style.backgroundPosition = "center";
      const ico = el.querySelector(".ico");
      if (ico) ico.style.visibility = "hidden";
    });
  }

  async function boot() {
    const [cRes, sRes] = await Promise.all([
      fetch("config.json"),
      fetch("strings.en.json"),
    ]);
    CFG = await cRes.json();
    STR = await sRes.json();
    state._defeated = {};
    applyPlayerStats();
    preloadArt();
    setTimeout(applyBtnArt, 200);
    wire();
    updateMuteBtn();
    updateHud();

    try {
      if (localStorage.getItem(CFG.LOCALSTORAGE_KEY) || localStorage.getItem(CFG.LOCALSTORAGE_LEGACY_KEY)) {
        $("btn-continue").classList.remove("hidden");
      }
    } catch (_) {}

    setMode("title");
    requestAnimationFrame(loop);
  }

  boot().catch((err) => {
    console.error(err);
    document.body.innerHTML = "<p style='color:#fff;padding:2rem'>Failed to load config/strings. Serve via http.server.</p>";
  });
})();
