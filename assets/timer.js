// =============================================================================
//  Name: Vault-Tec Timer, Timer
//  Authors: @Theeohn, @trekker87
//  License: MIT
//  Repository: https://github.com/Theeohn/Vault-Tec-Timer-3000a
// =============================================================================

(function (goTo) {
  const C = {
    MODES: { SET: 0, RUNNING: 1, PAUSED: 2, DONE: 3 },
    ALERT_TYPES: [
      '<  ALERT TYPE: SOUND ONLY  >',
      '<  ALERT TYPE: LED FLASH  >',
      '<  ALERT TYPE: SOUND AND LED  >',
    ],
    FIELD_X: [152, 240, 328], // same coordinates as stopwatch.js's time fields
    FIELD_Y: 160,
    FIELD_LABELS: ['h', 'm', 's'], // lowercase, matching stopwatch.js
    FIELD_BOX_HALF: 20, // field highlight box half-height

    // ALERT bar: bottom-anchored, 20px above the display's bottom edge (320)
    ALERT_Y1: 276,
    ALERT_Y2: 300,

    // MENU/START share one row directly above the ALERT bar, side by side -
    // MENU keeps its normal size, START is enlarged (bigger text, taller box)
    ROW_Y1: 224,
    ROW_Y2: 258,
    MENU_W: 50,
    START_W: 90,
    PAIR_GAP: 12, // gap between the MENU and START boxes
  };

  let mode = C.MODES.SET;
  let time = [0, 0, 0]; // hours, minutes, seconds
  let alertIndex = 0;
  let pos = 4; // starts on START
  let lastPair = 4; // remembers whether MENU(3) or START(4) was last active
  let editing = false;
  let secondsRemaining = 0;
  let ticker, alarmTicker, flashFrame = 0, redrawInterval;
  let runRow = 0; // RUNNING: 0 = cancel, 1 = menu | PAUSED: 0 = resume, 1 = cancel, 2 = menu
  let alertW; // computed once at load - half-width of the ALERT button
  let menuCx, startCx; // computed once at load - centers of the MENU/START pair

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function layoutButtons() {
    let maxW = 0;
    for (let i = 0; i < C.ALERT_TYPES.length; i++) {
      const w = h.setFontMonofonto18().stringWidth(C.ALERT_TYPES[i]);
      if (w > maxW) maxW = w;
    }
    alertW = maxW / 2 + 16;

    const totalHalf = alertW;
    menuCx = 240 - totalHalf + C.MENU_W;
    startCx = 240 + totalHalf - C.START_W;
    // Keep at least PAIR_GAP between the two boxes' facing edges.
    const minStartLeft = menuCx + C.MENU_W + C.PAIR_GAP + C.START_W;
    if (startCx < minStartLeft) startCx = minStartLeft;
  }

  function drawButton(cx, y1, y2, w, label, font, focused, enabled) {
    h.setColor(2).drawRect(cx - w, y1, cx + w, y2);
    if (enabled && focused) {
      h.setColor(3);
      for (let o = 1; o <= 3; o++) h.drawRect(cx - w - o, y1 - o, cx + w + o, y2 + o);
    }
    h.setColor(enabled ? 3 : 2);
    if (font === 28) h.setFontMonofonto28(); else h.setFontMonofonto18();
    h.setFontAlign(0, 0).drawString(label, cx, (y1 + y2) / 2);
  }

  const NUM_FONT_SIZE = 36, LETTER_FONT_SIZE = 28;
  const LETTER_Y_OFFSET = (NUM_FONT_SIZE - LETTER_FONT_SIZE) / 2;

  function drawField(x, y, numStr, letterStr) {
    const numW = h.setFontMonofonto36().stringWidth(numStr);
    const letterW = h.setFontMonofonto28().stringWidth(letterStr);
    const startX = x - (numW + letterW) / 2;
    h.setColor(3).setFontMonofonto36().setFontAlign(-1, 0).drawString(numStr, startX, y);
    h.setColor(3).setFontMonofonto28().setFontAlign(-1, 0)
      .drawString(letterStr, startX + numW, y + LETTER_Y_OFFSET);
  }

  function drawSet() {
    h.setColor(3).setFontMonofonto36().setFontAlign(0, 0).drawString('TIMER', 240, 47);

    for (let i = 0; i < 3; i++) {
      if (pos === i) {
        const by = C.FIELD_Y;
        if (editing) {
          Pip.shadeBox(C.FIELD_X[i] - 45, by - C.FIELD_BOX_HALF, C.FIELD_X[i] + 45, by + C.FIELD_BOX_HALF);
        } else {
          h.setColor(3);
          for (let o = 0; o < 3; o++) {
            h.drawRect(C.FIELD_X[i] - 45 - o, by - C.FIELD_BOX_HALF - o, C.FIELD_X[i] + 45 + o, by + C.FIELD_BOX_HALF + o);
          }
        }
      }
      drawField(C.FIELD_X[i], C.FIELD_Y, pad(time[i]), C.FIELD_LABELS[i]);
    }

    drawButton(menuCx, C.ROW_Y1, C.ROW_Y2, C.MENU_W, 'MENU', 18, pos === 3, true);
    drawButton(startCx, C.ROW_Y1, C.ROW_Y2, C.START_W, 'START', 28, pos === 4, true);
    drawButton(240, C.ALERT_Y1, C.ALERT_Y2, alertW, C.ALERT_TYPES[alertIndex], 18, pos === 5, true);
  }

  function drawRunning() {
    const hrs = Math.floor(secondsRemaining / 3600);
    const mins = Math.floor((secondsRemaining % 3600) / 60);
    const secs = secondsRemaining % 60;
    h.setColor(3).setFontMonofonto23().setFontAlign(0, 0).drawString('TIMER RUNNING', 240, 55);
    h.setFontMonofonto36().setFontAlign(0, 0)
      .drawString(pad(hrs) + ':' + pad(mins) + ':' + pad(secs), 240, 150);
    h.setColor(2).setFontMonofonto16().setFontAlign(0, 0).drawString(C.ALERT_TYPES[alertIndex], 240, 200);

    h.setColor(2).drawRect(120, 230, 240, 254);
    if (runRow === 0) {
      h.setColor(3);
      for (let o = 1; o <= 3; o++) h.drawRect(120 - o, 230 - o, 240 + o, 254 + o);
    }
    h.setColor(3).setFontMonofonto18().setFontAlign(0, 0).drawString('CANCEL', 180, 242);

    h.setColor(2).drawRect(260, 230, 380, 254);
    if (runRow === 1) {
      h.setColor(3);
      for (let o = 1; o <= 3; o++) h.drawRect(260 - o, 230 - o, 380 + o, 254 + o);
    }
    h.setColor(3).setFontMonofonto18().setFontAlign(0, 0).drawString('MENU', 320, 242);
  }

  function drawPaused() {
    const hrs = Math.floor(secondsRemaining / 3600);
    const mins = Math.floor((secondsRemaining % 3600) / 60);
    const secs = secondsRemaining % 60;
    h.setColor(3).setFontMonofonto23().setFontAlign(0, 0).drawString('TIMER PAUSED', 240, 50);
    h.setFontMonofonto36().setFontAlign(0, 0)
      .drawString(pad(hrs) + ':' + pad(mins) + ':' + pad(secs), 240, 130);

    const labels = ['RESUME', 'CANCEL', 'MENU'];
    const y1 = 200, y2 = 224;
    for (let i = 0; i < 3; i++) {
      const cx = 130 + i * 110;
      h.setColor(2).drawRect(cx - 48, y1, cx + 48, y2);
      if (runRow === i) {
        h.setColor(3);
        for (let o = 1; o <= 3; o++) h.drawRect(cx - 48 - o, y1 - o, cx + 48 + o, y2 + o);
      }
      h.setColor(3).setFontMonofonto16().setFontAlign(0, 0).drawString(labels[i], cx, (y1 + y2) / 2);
    }
  }

  function drawDone() {
    h.setColor(3).setFontMonofonto23().setFontAlign(0, 0).drawString("** TIME'S UP! **", 240, 130);
    h.setColor(2).setFontMonofonto16().setFontAlign(0, 0).drawString('PRESS KNOB 1 TO RESET', 240, 210);
  }

  function draw() {  "ram";
    h.clear(1);
    if (mode === C.MODES.SET) drawSet();
    else if (mode === C.MODES.RUNNING) drawRunning();
    else if (mode === C.MODES.PAUSED) drawPaused();
    else drawDone();
    h.flip();
    Pip.lastFlip = getTime();
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
  }

  function stopAlarm() {
    if (alarmTicker) clearInterval(alarmTicker);
    if (alertIndex === 1 || alertIndex === 2) {
      try { Pip.setTorch(false); } catch (e) { Pip.log('setTorch failed: ' + e); }
    }
  }

  function startAlarm() {
    flashFrame = 0;
    let soundToggle = false;
    let ledOn = true;

    alarmTicker = setInterval(function () {
      flashFrame++;

      if (alertIndex === 1 || alertIndex === 2) {
        try {
          Pip.setTorch(ledOn);
        } catch (e) {
          Pip.log('setTorch failed: ' + e);
        }
        ledOn = !ledOn;
      }

      if (alertIndex === 0) {
        Pip.playSound(soundToggle ? 'SCROLL' : 'TAB');
        soundToggle = !soundToggle;
      }
    }, 500);
  }

  function runTicker() {
    mode = C.MODES.RUNNING;
    runRow = 0;
    draw();
    ticker = setInterval(function () {
      secondsRemaining--;
      if (secondsRemaining <= 0) {
        stopTicker();
        mode = C.MODES.DONE;
        draw();
        startAlarm();
      } else {
        draw();
      }
    }, 1000);
  }

  function startTimer() {
    secondsRemaining = time[0] * 3600 + time[1] * 60 + time[2];
    if (secondsRemaining <= 0) return;
    runTicker();
  }

  function resumeTimer() {
    runTicker();
  }

  function goToMenuFromRunning() {
    stopTicker();
    mode = C.MODES.PAUSED;
    runRow = 0;
    h.clear(1);
    h.setColor(3).setFontMonofonto23().setFontAlign(0, 0).drawString('TIMER PAUSED', 240, 150);
    h.flip();
    Pip.lastFlip = getTime();
    goTo('HOLO/VAULT_TEC_TIMER/TITLE.JS');
  }

  function onPress() {
    if (mode === C.MODES.SET) {
      if (pos <= 2) {
        editing = !editing;
        Pip.playSound('TAB');
        draw();
      } else if (pos === 3) {
        Pip.playSound('TAB');
        goTo('HOLO/VAULT_TEC_TIMER/TITLE.JS');
      } else if (pos === 4) {
        startTimer();
      }
    } else if (mode === C.MODES.RUNNING) {
      if (runRow === 0) {
        stopTicker();
        mode = C.MODES.SET;
        draw();
      } else {
        Pip.playSound('TAB');
        goToMenuFromRunning();
      }
    } else if (mode === C.MODES.PAUSED) {
      if (runRow === 0) {
        Pip.playSound('TAB');
        resumeTimer();
      } else if (runRow === 1) {
        mode = C.MODES.SET;
        draw();
      } else {
        Pip.playSound('TAB');
        goTo('HOLO/VAULT_TEC_TIMER/TITLE.JS');
      }
    } else if (mode === C.MODES.DONE) {
      stopAlarm();
      mode = C.MODES.SET;
      draw();
    }
  }

  function adjustFieldOrExit(dir) {
    const max = pos === 0 ? 99 : 59;
    const next = time[pos] - dir;
    if (next < 0 || next > max) {
      editing = false;
      return false;
    }
    time[pos] = next;
    return true;
  }

  function moveVertical(dir) {
    if (pos <= 2) {
      if (dir > 0) {
        pos = pos === 2 ? lastPair : pos + 1;
      } else {
        pos = E.clip(pos - 1, 0, 2);
      }
    } else if (pos === 3 || pos === 4) {
      lastPair = pos;
      pos = dir > 0 ? 5 : 2;
    } else if (pos === 5) {
      if (dir < 0) pos = lastPair;
    }
  }

  function onKnob1(dir) {
    if (dir) {
      if (mode === C.MODES.SET) {
        let changed = false;
        if (editing) {
          if (adjustFieldOrExit(dir)) {
            changed = true;
          } else {
            const prev = pos;
            moveVertical(dir);
            changed = pos !== prev;
          }
        } else {
          const prev = pos;
          moveVertical(dir);
          changed = pos !== prev;
        }
        if (changed) Pip.playSound('SCROLL');
        draw();
      } else if (mode === C.MODES.RUNNING) {
        const prev = runRow;
        runRow = E.clip(runRow + dir, 0, 1);
        if (runRow !== prev) Pip.playSound('SCROLL');
        draw();
      } else if (mode === C.MODES.PAUSED) {
        const prev = runRow;
        runRow = E.clip(runRow + dir, 0, 2);
        if (runRow !== prev) Pip.playSound('SCROLL');
        draw();
      }
    } else {
      onPress();
    }
  }

  function horizontalNav(dir) {
    if (pos <= 2) {
      const prev = pos;
      pos = (pos + dir + 3) % 3;
      return pos !== prev;
    } else if (pos === 3 || pos === 4) {
      pos = pos === 3 ? 4 : 3;
      lastPair = pos;
      return true;
    } else if (pos === 5) {
      const prev = alertIndex;
      alertIndex = (alertIndex + dir + C.ALERT_TYPES.length) % C.ALERT_TYPES.length;
      return alertIndex !== prev;
    }
    return false;
  }

  function onKnob2(dir) {
    if (mode === C.MODES.RUNNING) {
      const prev = runRow;
      runRow = E.clip(runRow + dir, 0, 1);
      if (runRow !== prev) Pip.playSound('SCROLL');
      draw();
      return;
    }
    if (mode !== C.MODES.SET) return;

    let changed = false;
    if (editing) {
      if (adjustFieldOrExit(dir)) {
        changed = true;
      } else {
        changed = horizontalNav(dir);
      }
    } else {
      changed = horizontalNav(dir);
    }
    if (changed) Pip.playSound('SCROLL');
    draw();
  }

  Pip.audioStop();
  layoutButtons();
  Pip.onExclusive('knob1', onKnob1);
  Pip.onExclusive('knob2', onKnob2);
  redrawInterval = setInterval(draw, 1000);
  draw();

  return {
    remove: function () {
      clearInterval(redrawInterval);
      stopTicker();
      stopAlarm();
      Pip.removeListener('knob1', onKnob1);
      Pip.removeListener('knob2', onKnob2);
      Pip.audioStop();
      h.clear();
    },
  };
});