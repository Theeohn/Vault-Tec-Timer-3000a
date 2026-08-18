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
    START_Y1: 205, // same coordinates as stopwatch.js's START button
    START_Y2: 229,
    ALERT_Y1: 235, // same coordinates as stopwatch.js's LAP button - directly below START
    ALERT_Y2: 259,
    MENU_CX: 90, // same coordinates as stopwatch.js's MENU button
    SIDE_W: 50,
  };

  let mode = C.MODES.SET;
  let time = [0, 0, 0]; // hours, minutes, seconds
  let alertIndex = 0;
  // Unified position for knob1 in SET mode: 0=hour, 1=minute, 2=second,
  // 3=START, 4=ALERT. Replaces the old separate row/fieldIndex pair - the
  // three time fields are now individually reachable stops in the same
  // list as the two buttons below them.
  let pos = 0;
  let editing = false;
  let focus = 'stack'; // 'stack' | 'menu' - SET mode only, mirrors stopwatch.js
  let secondsRemaining = 0;
  let ticker, alarmTicker, flashFrame = 0, redrawInterval;
  let runRow = 0; // RUNNING: 0 = cancel, 1 = menu | PAUSED: 0 = resume, 1 = cancel, 2 = menu
  let alertW; // computed once at load - half-width of the ALERT button

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function layoutAlertButton() {
    let maxW = 0;
    for (let i = 0; i < C.ALERT_TYPES.length; i++) {
      const w = h.setFontMonofonto18().stringWidth(C.ALERT_TYPES[i]);
      if (w > maxW) maxW = w;
    }
    alertW = maxW / 2 + 16;
  }

  function drawButton(cx, y1, y2, w, label, focused, enabled) {
    h.setColor(2).drawRect(cx - w, y1, cx + w, y2);
    if (enabled && focused) {
      h.setColor(3);
      for (let o = 1; o <= 3; o++) h.drawRect(cx - w - o, y1 - o, cx + w + o, y2 + o);
    }
    h.setColor(enabled ? 3 : 2).setFontMonofonto18().setFontAlign(0, 0)
      .drawString(label, cx, (y1 + y2) / 2);
  }

  // Draws a time field as two pieces sharing a baseline: the number in
  // Monofonto36 followed immediately by its lowercase unit letter in the
  // smaller Monofonto28, the pair centered together on x. Matches
  // stopwatch.js's drawField exactly.
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
      if (focus === 'stack' && pos === i) {
        const by = C.FIELD_Y - 25;
        if (editing) {
          Pip.shadeBox(C.FIELD_X[i] - 45, by - C.FIELD_BOX_HALF, C.FIELD_X[i] + 45, by + C.FIELD_BOX_HALF);
        } else {
          h.setColor(3);
          for (let o = 0; o < 3; o++) {
            h.drawRect(C.FIELD_X[i] - 45 - o, by - C.FIELD_BOX_HALF - o, C.FIELD_X[i] + 45 + o, by + C.FIELD_BOX_HALF + o);
          }
        }
      }
      drawField(C.FIELD_X[i], C.FIELD_Y - 25, pad(time[i]), C.FIELD_LABELS[i]);
    }

    drawButton(240, C.START_Y1, C.START_Y2, 70, 'START', focus === 'stack' && pos === 3, true);
    drawButton(240, C.ALERT_Y1, C.ALERT_Y2, alertW, C.ALERT_TYPES[alertIndex], focus === 'stack' && pos === 4, true);
    drawButton(C.MENU_CX, C.START_Y1, C.START_Y2, C.SIDE_W, 'MENU', focus === 'menu', true);
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
    if (alertIndex !== 1) {
      h.setColor(3).setFontMonofonto23().setFontAlign(0, 0).drawString("** TIME'S UP! **", 240, 130);
      h.setColor(2).setFontMonofonto16().setFontAlign(0, 0).drawString('PRESS KNOB 1 TO RESET', 240, 210);
    }
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
  }

  function startAlarm() {
    flashFrame = 0;
    let soundToggle = false;
    const colors = [1, 2, 3];

    alarmTicker = setInterval(function () {
      flashFrame++;

      if (alertIndex === 1 || alertIndex === 2) {
        const col = colors[flashFrame % colors.length];
        h.reset().setColor(col).fillRect(0, 0, 479, 319);
        h.setColor(col === 3 ? 1 : 3).setFontMonofonto23().setFontAlign(0, 0)
          .drawString("** TIME'S UP! **", 240, 130);
        h.setFontMonofonto16().setFontAlign(0, 0).drawString('PRESS KNOB 1 TO RESET', 240, 210);
        h.flip();
        Pip.lastFlip = getTime();
      }

      if (alertIndex === 0 || alertIndex === 2) {
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
        if (alertIndex !== 1) draw();
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

  // Leaves for the title menu. If a countdown is in progress it is paused
  // (ticker stopped, secondsRemaining preserved) rather than cancelled, so
  // selecting TIMER again from the menu can resume it. A brief notice is
  // shown for one frame before navigating away.
  function goToMenuFromRunning() {
    stopTicker();
    mode = C.MODES.PAUSED;
    runRow = 0;
    h.clear(1);
    h.setColor(3).setFontMonofonto23().setFontAlign(0, 0).drawString('TIMER PAUSED', 240, 110);
    h.setColor(2).setFontMonofonto18().setFontAlign(0, 0)
      .drawString('RUNNING TIMER WILL BE', 240, 160);
    h.setColor(2).setFontMonofonto18().setFontAlign(0, 0)
      .drawString('DISPLAYED IN OS HEADER', 240, 184);
    h.flip();
    Pip.lastFlip = getTime();
    goTo('HOLO/VAULT_TEC_TIMER/TITLE.JS');
  }

  // knob1 press — behavior depends on mode/pos/focus
  function onPress() {
    if (mode === C.MODES.SET) {
      if (focus === 'menu') {
        Pip.playSound('TAB');
        goTo('HOLO/VAULT_TEC_TIMER/TITLE.JS');
        return;
      }
      if (pos <= 2) {
        editing = !editing;
        Pip.playSound('TAB');
        draw();
      } else if (pos === 3) {
        startTimer();
      }
      // pos === 4 (ALERT): no separate press action - cycled directly via
      // rotation, same as before.
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

  // knob1 rotate — in SET mode: adjusts the locked field's value while
  // editing; otherwise moves through the unified stop list (hour, minute,
  // second, START, ALERT). Has no effect while MENU has focus. RUNNING and
  // PAUSED modes keep their existing runRow navigation.
  function onKnob1(dir) {
    if (dir) {
      if (mode === C.MODES.SET) {
        if (focus !== 'stack') return;
        if (editing) {
          const max = pos === 0 ? 99 : 59;
          time[pos] = E.clip(time[pos] + dir, 0, max);
          Pip.playSound('SCROLL');
          draw();
          return;
        }
        pos = E.clip(pos + dir, 0, 4);
        Pip.playSound('SCROLL');
        draw();
      } else if (mode === C.MODES.RUNNING) {
        runRow = E.clip(runRow + dir, 0, 1);
        Pip.playSound('SCROLL');
        draw();
      } else if (mode === C.MODES.PAUSED) {
        runRow = E.clip(runRow + dir, 0, 2);
        Pip.playSound('SCROLL');
        draw();
      }
    } else {
      onPress();
    }
  }

  // knob2 rotate — in SET mode: adjusts the locked field's value while
  // editing (mirrors knob1); otherwise cycles between the three time
  // fields (wrapping) while one has focus, cycles the alert type while
  // ALERT has focus, or jumps focus to/from MENU while START has focus.
  function onKnob2(dir) {
    if (mode !== C.MODES.SET) return;

    if (focus === 'menu') {
      if (dir > 0) {
        focus = 'stack';
        Pip.playSound('SCROLL');
        draw();
      }
      return;
    }

    if (editing) {
      const max = pos === 0 ? 99 : 59;
      time[pos] = E.clip(time[pos] + dir, 0, max);
      Pip.playSound('SCROLL');
      draw();
      return;
    }

    if (pos <= 2) {
      pos = (pos + dir + 3) % 3;
      Pip.playSound('SCROLL');
      draw();
    } else if (pos === 3) {
      if (dir < 0) {
        focus = 'menu';
        Pip.playSound('SCROLL');
        draw();
      }
    } else if (pos === 4) {
      alertIndex = (alertIndex + dir + C.ALERT_TYPES.length) % C.ALERT_TYPES.length;
      Pip.playSound('SCROLL');
      draw();
    }
  }

  Pip.audioStop();
  layoutAlertButton();
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