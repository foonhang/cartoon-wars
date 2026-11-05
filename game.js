/* Cat Clan RPG light v0.1.0 — numbers from config.json only */
(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let CFG = null;
  let STR = null;
  let artImages = {};

  // ---------- helpers ----------
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

  // ---------- TTS ----------
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

  // ---------- state ----------
  const state = {
    mode: "title", // title | explore | dialogue | battle | faint | ending | pause
    zone: "Camp",
    player: {
      x: 160, y: 300, r: 28,
      hp: 40, maxHp: 40, atk: 6,
      level: 1, exp: 0,
      facing: 1,
    },
    companion: null, // {x,y} when unlocked
    flags: {
      tutTalked: false,
      tutFought: false,
      campDone: false,
      forestQuestAccepted: false,
      miceCaught: 0,
      forestDone: false,
      pebbleJoined: false,
      creekIntro: false,
      mossFound: false,
      foxDefeated: false,
      ending: false,
      sawLvlPounce: false,
      sawLvlGroom: false,
    },
    faintStreak: 0,
    npcs: [],
    enemies: [],
    props: [],
    dialogueQueue: [],
    dialogueCb: null,
    battle: null,
    targetArrow: null, // world {x,y}
    moveTarget: null,
    saveLoaded: false,
  };

  // zone layouts (world coords, canvas logical 960x540)
  const W = 960, H = 540;

  function zoneBgColor(zone) {
    return CFG.placeholderColors[
      zone === "Camp" ? "bgCamp" : zone === "Forest" ? "bgForest" : "bgCreek"
    ];
  }

  function spawnZone(zone) {
    state.zone = zone;
    state.npcs = [];
    state.enemies = [];
    state.props = [];
    state.moveTarget = null;

    const entrance = { x: 80, y: H / 2 };
    state.player.x = entrance.x;
    state.player.y = entrance.y;

    if (zone === "Camp") {
      state.npcs.push({
        id: "oldGrey", name: "Old Grey", kind: "oldGrey",
        x: 420, y: 260, r: 30, hasBang: true,
        lines: () => {
          if (!state.flags.tutTalked) {
            return ["camp_elder_1", "camp_elder_2", "camp_elder_3", "camp_elder_4"];
          }
          if (!state.flags.tutFought) return ["camp_elder_4"];
          if (!state.flags.campDone) {
            state.flags.campDone = true;
            return ["win_1", "gate_forest"];
          }
          return ["gate_forest"];
        },
        onDone: () => {
          state.flags.tutTalked = true;
          updateQuestHud();
        },
      });
      // gate to forest
      state.npcs.push({
        id: "gateForest", name: "Gate", kind: "gate",
        x: 900, y: H / 2, r: 36, hasBang: state.flags.campDone,
        lines: () => {
          if (!state.flags.campDone) return ["need_quest"];
          return ["gate_forest"];
        },
        onDone: () => {
          if (state.flags.campDone) loadZone("Forest");
        },
      });
      for (let i = 0; i < 3; i++) {
        if (state._defeated && state._defeated[`Camp_Bug_${i}`]) continue;
        state.enemies.push({
          id: `Camp_Bug_${i}`, type: "Bug",
          x: 520 + i * 90, y: 340 + (i % 2) * 40,
          r: 22, alive: true,
        });
      }
    }

    if (zone === "Forest") {
      state.npcs.push({
        id: "forestElder", name: "Old Grey", kind: "oldGrey",
        x: 280, y: 220, r: 30, hasBang: true,
        lines: () => {
          if (!state.flags.forestQuestAccepted) {
            return ["forest_elder_1", "forest_elder_2"];
          }
          if (state.flags.miceCaught < 3) {
            return ["forest_elder_2"];
          }
          if (!state.flags.forestDone) {
            return ["forest_done"];
          }
          return ["gate_creek"];
        },
        onDone: () => {
          if (!state.flags.forestQuestAccepted) {
            state.flags.forestQuestAccepted = true;
          }
          if (state.flags.miceCaught >= 3 && !state.flags.forestDone) {
            state.flags.forestDone = true;
            // Pebble joins
            if (!state.flags.pebbleJoined) {
              state.flags.pebbleJoined = true;
              state.companion = { x: state.player.x - 40, y: state.player.y + 20, r: 22 };
              queueDialogue(["pebble_1", "pebble_2"], null);
            }
          }
          updateQuestHud();
        },
      });
      state.npcs.push({
        id: "gateCreek", name: "Gate", kind: "gate",
        x: 900, y: H / 2, r: 36, hasBang: state.flags.forestDone,
        lines: () => {
          if (!state.flags.forestDone) return ["need_quest"];
          return ["gate_creek"];
        },
        onDone: () => {
          if (state.flags.forestDone) loadZone("Creek");
        },
      });
      for (let i = 0; i < 5; i++) {
        if (state._defeated && state._defeated[`Forest_Mouse_${i}`]) continue;
        state.enemies.push({
          id: `Forest_Mouse_${i}`, type: "Mouse",
          x: 450 + (i % 3) * 110, y: 280 + Math.floor(i / 3) * 100,
          r: 24, alive: true,
        });
      }
    }

    if (zone === "Creek") {
      state.npcs.push({
        id: "mama", name: "Mama Cat", kind: "mamaCat",
        x: 200, y: 240, r: 30, hasBang: !state.flags.creekIntro || !state.flags.mossFound,
        lines: () => {
          if (!state.flags.creekIntro) return ["mama_1", "mama_2"];
          if (!state.flags.mossFound) return ["mama_2"];
          return ["moss_2"];
        },
        onDone: () => {
          state.flags.creekIntro = true;
          updateQuestHud();
        },
      });
      if (!state.flags.mossFound) {
        state.npcs.push({
          id: "moss", name: "Little Moss", kind: "littleMoss",
          x: 720, y: 380, r: 26, hasBang: true,
          lines: () => ["moss_1", "moss_2"],
          onDone: () => {
            state.flags.mossFound = true;
            // remove moss from map after rescue (she follows conceptually)
            state.npcs = state.npcs.filter((n) => n.id !== "moss");
            updateQuestHud();
            // nudge toward fox if still alive
            showToast(STR.dialogue.fox_1 || "Grrr!");
          },
        });
      }
      for (let i = 0; i < 2; i++) {
        if (state._defeated && state._defeated[`Creek_Mouse_${i}`]) continue;
        state.enemies.push({
          id: `Creek_Mouse_${i}`, type: "Mouse",
          x: 480 + i * 100, y: 300, r: 24, alive: true,
        });
      }
      if (!state.flags.foxDefeated && !(state._defeated && state._defeated["Creek_FoxCub_0"])) {
        state.enemies.push({
          id: "Creek_FoxCub_0", type: "FoxCub",
          x: 820, y: 280, r: 34, alive: true,
        });
      }
    }

    if (state.flags.pebbleJoined && !state.companion) {
      state.companion = { x: state.player.x - 40, y: state.player.y + 20, r: 22 };
    }
    updateQuestHud();
    updateHud();
    saveGame();
  }

  function loadZone(zone) {
    spawnZone(zone);
  }

  // ---------- save ----------
  function saveGame() {
    const key = CFG.LOCALSTORAGE_KEY;
    const data = {
      version: CFG.version,
      zone: state.zone,
      player: {
        exp: state.player.exp,
        level: state.player.level,
        hp: state.player.hp,
      },
      flags: { ...state.flags },
      faintStreak: state.faintStreak,
      defeated: state._defeated || {},
      muted,
    };
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
  }

  function loadGame() {
    const key = CFG.LOCALSTORAGE_KEY;
    let raw;
    try { raw = localStorage.getItem(key); } catch (_) { return false; }
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      state.player.exp = data.player.exp;
      state.player.level = levelFromExp(data.player.exp);
      applyPlayerStats();
      state.player.hp = Math.min(data.player.hp, state.player.maxHp);
      state.flags = { ...state.flags, ...data.flags };
      state.faintStreak = data.faintStreak || 0;
      state._defeated = data.defeated || {};
      muted = !!data.muted;
      updateMuteBtn();
      spawnZone(data.zone || "Camp");
      return true;
    } catch (_) { return false; }
  }

  function newGame() {
    state.player.exp = 0;
    state.player.level = 1;
    applyPlayerStats();
    state.player.hp = state.player.maxHp;
    state.flags = {
      tutTalked: false, tutFought: false, campDone: false,
      forestQuestAccepted: false, miceCaught: 0, forestDone: false,
      pebbleJoined: false, creekIntro: false, mossFound: false,
      foxDefeated: false, ending: false,
      sawLvlPounce: false, sawLvlGroom: false,
    };
    state.faintStreak = 0;
    state._defeated = {};
    state.companion = null;
    spawnZone("Camp");
    saveGame();
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
    if (state.zone === "Camp") {
      ico.textContent = "🐛";
      if (!state.flags.tutTalked) q.textContent = STR.quest.camp;
      else if (!state.flags.tutFought) q.textContent = "Catch a bug";
      else if (!state.flags.campDone) q.textContent = "Talk to Old Grey";
      else q.textContent = "Go to Forest";
    } else if (state.zone === "Forest") {
      ico.textContent = "🐭";
      if (!state.flags.forestQuestAccepted) q.textContent = STR.quest.forest;
      else if (state.flags.miceCaught < 3) q.textContent = `🐭 ${state.flags.miceCaught}/3`;
      else if (!state.flags.forestDone) q.textContent = "Talk to elder";
      else q.textContent = "Go to Creek";
    } else {
      ico.textContent = "🐱";
      if (!state.flags.creekIntro) q.textContent = STR.quest.creek;
      else if (!state.flags.mossFound) q.textContent = "Find Little Moss";
      else if (!state.flags.foxDefeated) q.textContent = "Beat Fox Cub";
      else q.textContent = "Done!";
    }
    updateArrowTarget();
  }

  function updateArrowTarget() {
    let t = null;
    if (state.zone === "Camp") {
      if (!state.flags.tutTalked) t = state.npcs.find((n) => n.id === "oldGrey");
      else if (!state.flags.tutFought) t = state.enemies.find((e) => e.alive);
      else if (!state.flags.campDone) t = state.npcs.find((n) => n.id === "oldGrey");
      else t = state.npcs.find((n) => n.id === "gateForest");
    } else if (state.zone === "Forest") {
      if (!state.flags.forestQuestAccepted) t = state.npcs.find((n) => n.id === "forestElder");
      else if (state.flags.miceCaught < 3) t = state.enemies.find((e) => e.alive);
      else if (!state.flags.forestDone) t = state.npcs.find((n) => n.id === "forestElder");
      else t = state.npcs.find((n) => n.id === "gateCreek");
    } else {
      if (!state.flags.creekIntro) t = state.npcs.find((n) => n.id === "mama");
      else if (!state.flags.mossFound) t = state.npcs.find((n) => n.id === "moss");
      else if (!state.flags.foxDefeated) t = state.enemies.find((e) => e.type === "FoxCub" && e.alive);
      else t = null;
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
  function showDialogue(keys, cb) {
    state.dialogueQueue = keys.slice();
    state.dialogueCb = cb || null;
    setMode("dialogue");
    nextDialogueLine();
  }

  function nextDialogueLine() {
    if (!state.dialogueQueue.length) {
      const cb = state.dialogueCb;
      state.dialogueCb = null;
      setMode("explore");
      if (cb) cb();
      saveGame();
      return;
    }
    const key = state.dialogueQueue.shift();
    const text = STR.dialogue[key] || STR.ui[key] || key;
    $("dlg-text").textContent = text;
    // avatar color by zone/npc heuristic
    const col = CFG.placeholderColors.oldGrey;
    $("dlg-avatar").style.background = col;
    speak(text);
  }

  // ---------- battle ----------
  function startBattle(enemy) {
    const edef = CFG.ENEMIES[enemy.type];
    let hp = edef.hp;
    // assist on fail: reduce enemy HP by 20% after 2 faint streak
    if (state.faintStreak >= CFG.ASSIST_ON_FAIL_STREAK) {
      hp = Math.floor(hp * (1 - CFG.ASSIST_ON_FAIL_ENEMY_HP_PCT));
    }
    state.battle = {
      enemy,
      enemyHp: hp,
      enemyMaxHp: hp,
      enemyAtk: edef.atk,
      turn: 0, // player turns counted
      pounceWait: 0, // turns left to skip
      groomUses: CFG.GROOM_USES_PER_BATTLE,
      telegraph: "bite", // bite only for v0.1
      companionTimer: 0,
      playerActing: true,
      firstHint: enemy.type === "Bug" && !state.flags.tutFought,
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
    const lv = state.player.level;
    const pounceLv = CFG.SKILL_UNLOCK.Pounce;
    const groomLv = CFG.SKILL_UNLOCK.Groom;
    const btnP = $("btn-pounce");
    const btnG = $("btn-groom");
    btnP.classList.toggle("locked", lv < pounceLv);
    btnG.classList.toggle("locked", lv < groomLv);
    btnP.disabled = lv < pounceLv || b.pounceWait > 0 || !b.playerActing;
    btnG.disabled = lv < groomLv || b.groomUses <= 0 || !b.playerActing;
    $("btn-claw").disabled = !b.playerActing || b.pounceWait > 0;
    $("battle-telegraph").textContent = "🦷";
    let status = `${b.enemy.type}  ${b.enemyHp}/${b.enemyMaxHp}`;
    if (b.pounceWait > 0) status += `  (wait ${b.pounceWait})`;
    if (state.flags.pebbleJoined) status += "  · Pebble";
    if (b.groomUses < CFG.GROOM_USES_PER_BATTLE && lv >= groomLv) {
      status += `  Groom ${b.groomUses}`;
    }
    $("battle-status").textContent = status;
    updateHud();
  }

  /** Clamp: no instant kill on player — if hp>1, leave at least 1 */
  function applyDamageToPlayer(dmg) {
    const p = state.player;
    if (p.hp > 1 && dmg >= p.hp) {
      p.hp = 1;
    } else {
      p.hp = Math.max(0, p.hp - dmg);
    }
  }

  function dealToEnemy(dmg) {
    const b = state.battle;
    b.enemyHp = Math.max(0, b.enemyHp - dmg);
  }

  function enemyHitOnce() {
    const b = state.battle;
    if (!b || state.mode !== "battle") return false;
    applyDamageToPlayer(b.enemyAtk);
    updateHud();
    if (state.player.hp <= 0) {
      onFaint();
      return true; // fainted
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
    // consume one skipped player turn
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
    // companion assist every N player turns
    if (state.flags.pebbleJoined) {
      b.companionTimer++;
      if (b.companionTimer % CFG.COMPANION_ASSIST_EVERY === 0) {
        dealToEnemy(CFG.COMPANION_ATK);
        showToast(`Pebble! −${CFG.COMPANION_ATK}`);
        if (b.enemyHp <= 0) {
          onBattleWin();
          return;
        }
      }
    }
    b.playerActing = false;
    updateBattleUi();
    // enemy responds to this action once, then process pounce skips if any
    setTimeout(() => {
      if (enemyHitOnce()) return;
      runPounceSkips();
    }, 450);
  }

  function playerClaw() {
    const b = state.battle;
    if (!b || !b.playerActing || b.pounceWait > 0) return;
    dealToEnemy(state.player.atk);
    afterPlayerAction();
  }

  function playerPounce() {
    const b = state.battle;
    if (!b || !b.playerActing) return;
    if (state.player.level < CFG.SKILL_UNLOCK.Pounce) return;
    if (b.pounceWait > 0) return;
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

  function gainExp(amount) {
    const before = state.player.level;
    state.player.exp += amount;
    const after = levelFromExp(state.player.exp);
    state.player.level = after;
    applyPlayerStats();
    if (after > before) {
      state.player.hp = state.player.maxHp; // full heal on level up (kid-friendly)
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
    }
    updateHud();
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
    state.flags.tutFought = true;

    if (enemy.type === "Mouse" && state.zone === "Forest" && state.flags.forestQuestAccepted) {
      state.flags.miceCaught = Math.min(3, state.flags.miceCaught + 1);
    }

    gainExp(exp);
    setMode("explore");
    showToast(STR.ui.win);
    speak(STR.ui.win);

    if (enemy.type === "FoxCub") {
      state.flags.foxDefeated = true;
      setTimeout(() => {
        showDialogue(["fox_win", "ending_1", "ending_2"], () => {
          state.flags.ending = true;
          $("end1").textContent = STR.ui.ending_1;
          $("end2").textContent = STR.ui.ending_2;
          setMode("ending");
          speak(STR.ui.ending_1);
          saveGame();
        });
      }, 600);
    }

    updateQuestHud();
    saveGame();
  }

  function onFaint() {
    state.battle = null;
    state.faintStreak++;
    state.player.hp = state.player.maxHp; // full HP, keep EXP
    // return to zone entrance
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

    // tap NPC?
    for (const n of state.npcs) {
      if (dist(p, n) < n.r + 20) {
        const lines = n.lines();
        showDialogue(lines, n.onDone);
        return;
      }
    }
    // tap enemy? (also collide while moving)
    for (const e of state.enemies) {
      if (e.alive && dist(p, e) < e.r + 16) {
        // walk toward then battle — start immediately on tap for kids
        startBattle(e);
        return;
      }
    }
    // move
    state.moveTarget = { x: clamp(p.x, 40, W - 40), y: clamp(p.y, 60, H - 40) };
  }

  canvas.addEventListener("pointerdown", onTap);

  // ---------- draw ----------
  function drawPlaceholder(kind, x, y, r) {
    const imgPath = CFG.art[kind];
    const img = artImages[kind];
    if (img && img.complete && img.naturalWidth) {
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
    // ears for cats
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
    // label
    ctx.fillStyle = "#222";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    const label = kind === "foxCub" ? "Fox" : kind === "oldGrey" ? "Grey" : kind === "littleMoss" ? "Moss" : kind === "mamaCat" ? "Mama" : "";
    if (label) ctx.fillText(label, x, y + 4);
  }

  function draw() {
    // bg — image if loaded, else placeholder tint
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
    // zone label
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(state.zone, 16, H - 16);

    // NPCs
    for (const n of state.npcs) {
      const kind = n.kind === "gate" ? "oldGrey" : n.kind;
      if (n.kind === "gate") {
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(n.x - 20, n.y - 50, 40, 100);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("→", n.x, n.y);
      } else {
        drawPlaceholder(kind, n.x, n.y, n.r);
      }
      // dynamic bang: gates light up when zone quest is done
      let bang = n.hasBang;
      if (n.id === "gateForest") bang = state.flags.campDone;
      if (n.id === "gateCreek") bang = state.flags.forestDone;
      if (n.id === "oldGrey" || n.id === "forestElder") bang = true;
      if (n.id === "mama") bang = !state.flags.mossFound || !state.flags.creekIntro;
      if (n.id === "moss") bang = !state.flags.mossFound;
      if (bang && state.mode === "explore") {
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("❗", n.x, n.y - n.r - 8);
      }
    }

    // enemies
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const kind = e.type === "FoxCub" ? "foxCub" : e.type.toLowerCase();
      drawPlaceholder(kind, e.x, e.y, e.r);
    }

    // companion
    if (state.companion && state.flags.pebbleJoined) {
      drawPlaceholder("companion", state.companion.x, state.companion.y, state.companion.r);
    }

    // player
    drawPlaceholder("player", state.player.x, state.player.y, state.player.r);

    // battle overlay vignette
    if (state.mode === "battle" && state.battle) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, W, H);
      const e = state.battle.enemy;
      drawPlaceholder(
        e.type === "FoxCub" ? "foxCub" : e.type.toLowerCase(),
        W * 0.7, H * 0.4, 50
      );
      drawPlaceholder("player", W * 0.28, H * 0.45, 44);
      if (state.flags.pebbleJoined) {
        drawPlaceholder("companion", W * 0.18, H * 0.55, 28);
      }
      // HP bars
      drawBar(W * 0.7 - 50, H * 0.4 - 70, 100, 12, state.battle.enemyHp / state.battle.enemyMaxHp, "#e53935");
      drawBar(W * 0.28 - 50, H * 0.45 - 70, 100, 12, state.player.hp / state.player.maxHp, "#4caf50");
    }

    // arrow DOM position
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

  // ---------- update ----------
  function update(dt) {
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
    // companion follow
    if (state.companion && state.flags.pebbleJoined) {
      const c = state.companion;
      const tx = p.x - 40, ty = p.y + 20;
      c.x += (tx - c.x) * 0.08;
      c.y += (ty - c.y) * 0.08;
    }
    // collide enemies
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

  // ---------- wire buttons ----------
  function wire() {
    $("btn-start").onclick = () => {
      newGame();
      setMode("explore");
      showDialogue(["camp_elder_1", "camp_elder_2", "camp_elder_3"], () => {
        state.flags.tutTalked = true;
        updateQuestHud();
      });
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
      setMode("explore");
    };
    $("btn-faint-ok").onclick = () => {
      setMode("explore");
      updateQuestHud();
    };
    $("btn-end-restart").onclick = () => {
      newGame();
      setMode("explore");
    };
    $("btn-claw").onclick = () => playerClaw();
    $("btn-pounce").onclick = () => playerPounce();
    $("btn-groom").onclick = () => playerGroom();

    // apply string labels
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
      artImages[k] = img; // onerror → placeholder path
      img.onload = () => {
        if (k.startsWith("btn")) applyBtnArt();
      };
    });
  }

  // Optional comic button skins (config.art btn*); missing files keep HTML labels.
  function applyBtnArt() {
    const map = {
      btnClaw: "btn-claw",
      btnPounce: "btn-pounce",
      btnGroom: "btn-groom",
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

  // ---------- boot ----------
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

    // show continue if save exists
    try {
      if (localStorage.getItem(CFG.LOCALSTORAGE_KEY)) {
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
