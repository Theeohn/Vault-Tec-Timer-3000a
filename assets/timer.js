// =============================================================================
//  Name: Vault-Tec Timer, Timer
//  Authors: @Theeohn, @trekker87
//  License: MIT
//  Repository: https://github.com/Theeohn/Vault-Tec-Timer-3000a
// =============================================================================

(function (goTo) {
  const C = {
    MODES: { SET: 0, RUNNING: 1, PAUSED: 2, DONE: 3 },
    ALERT_TYPES: ['SOUND ONLY', 'LIGHTS ONLY', 'LIGHTS AND SOUND'],
    FIELD_X: [140, 240, 340],
    FIELD_LABELS: ['H', 'M', 'S'],
  };

  let mode = C.MODES.SET;
  let time = [0, 0, 0]; // hours, minutes, seconds
  let alertIndex = 0;
  let row = 0; // SET: 0 = time fields, 1 = alert type, 2 = start, 3 = menu
  let fieldIndex = 0;
  let editing = false;
  let secondsRemaining = 0;
  let ticker, alarmTicker, flashFrame = 0, redrawInterval;
  let runRow = 0; // RUNNING: 0 = cancel, 1 = menu | PAUSED: 0 = resume, 1 = cancel, 2 = menu

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function drawSet() {
    h.setColor(3).setFontMonofonto23().setFontAlign(0, 0).drawString('TIMER', 240, 50);

    h.setColor(2).setFontMonofonto16().setFontAlign(0, 0)
      .drawString('SET TIME  (KNOB1/KNOB2)', 240, 108);

    for (let i = 0; i < 3; i++) {
      if (row === 0 && i === fieldIndex) {
        if (editing) {
          Pip.shadeBox(C.FIELD_X[i] - 45, 128, C.FIELD_X[i] + 45, 168);
        } else {
          h.setColor(3);
          for (let o = 0; o < 3; o++) {
            h.drawRect(C.FIELD_X[i] - 45 - o, 128 - o, C.FIELD_X[i] + 45 + o, 168 + o);
          }
        }
      }
      h.setColor(3).setFontMonofonto36().setFontAlign(0, 0)
        .drawString(pad(time[i]) + C.FIELD_LABELS[i], C.FIELD_X[i], 150);
    }

    h.setColor(2).setFontMonofonto16().setFontAlign(0, 0)
      .drawString('ALERT TYPE  (KNOB 2)', 240, 220);
    Pip.shadeBox(80, 233, 400, 263);
    if (row === 1) {
      h.setColor(3);
      for (let o = 0; o < 2; o++) h.drawRect(80 - o, 233 - o, 400 + o, 263 + o);
    }
    h.setColor(3).setFontMonofonto18().setFontAlign(0, 0)
      .drawString(C.ALERT_TYPES[alertIndex], 240, 248);

    h.setColor(2).drawRect(150, 273, 270, 297);
    if (row === 2) {
      h.setColor(3);
      for (let o = 1; o <= 3; o++) h.drawRect(150 - o, 273 - o, 270 + o, 297 + o);
    }
    h.setColor(3).setFontMonofonto18().setFontAlign(0, 0).drawString('START', 210, 285);

    h.setColor(2).drawRect(290, 273, 400, 297);
    if (row === 3) {
      h.setColor(3);
      for (let o = 1; o <= 3; o++) h.drawRect(290 - o, 273 - o, 400 + o, 297 + o);
    }
    h.setColor(3).setFontMonofonto18().setFontAlign(0, 0).drawString('MENU', 345, 285);
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

  // knob1 press — behavior depends on mode/row
  function onPress() {
    if (mode === C.MODES.SET) {
      if (row === 0) {
        editing = !editing;
        Pip.playSound('TAB');
        draw();
      } else if (row === 2) {
        startTimer();
      } else if (row === 3) {
        Pip.playSound('TAB');
        goTo('HOLO/VAULT_TEC_TIMER/TITLE.JS');
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

  // knob1 rotate — moves the row cursor depending on mode
  function onKnob1(dir) {
    if (dir) {
      if (mode === C.MODES.SET) {
        if (editing) return;
        row = E.clip(row + dir, 0, 3);
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

  // knob2 rotate — moves between h/m/s (or adjusts the locked field), or
  // cycles the alert type, depending on which row is active
  function onKnob2(dir) {
    if (mode !== C.MODES.SET || row === 2 || row === 3) return;
    if (row === 0) {
      if (editing) {
        const max = fieldIndex === 0 ? 99 : 59;
        time[fieldIndex] = E.clip(time[fieldIndex] + dir, 0, max);
      } else {
        fieldIndex = (fieldIndex + dir + 3) % 3;
      }
    } else if (row === 1) {
      alertIndex = (alertIndex + dir + C.ALERT_TYPES.length) % C.ALERT_TYPES.length;
    }
    Pip.playSound('SCROLL');
    draw();
  }

  Pip.audioStop();
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