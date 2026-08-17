// =============================================================================
//  Name: Vault-Tec Timer, Stopwatch
//  Authors: @Theeohn, @trekker87
//  License: MIT
//  Repository: https://github.com/Theeohn/Vault-Tec-Timer-3000a
// =============================================================================

(function (goTo) {
  const C = {
    FIELD_X: [140, 240, 340],
    FIELD_Y: 160, // time display vertically centered in the 320px-tall display
    FIELD_LABELS: ['H', 'M', 'S'],
    SIDE_W: 50, // half-width of the MENU/RESET side buttons
    MENU_CX: 90, // 30px left of the stack's left edge (170), minus its own half-width
    RESET_CX: 390, // 30px right of the stack's right edge (310), plus its own half-width
    SIDE_Y1: 220,
    SIDE_Y2: 244,
    START_Y1: 205,
    START_Y2: 229,
    LAP_Y1: 235,
    LAP_Y2: 259,
    LAPCOUNT_Y: 282, // "LAP X OF Y" - 8px below LAP button's bottom edge
    LAPVIEW_Y: 302, // "<  00:00:00  >" - bottom edge lands 10px above the display's bottom (320)
  };

  let running = false;
  let elapsed = 0; // seconds
  let laps = [];
  let lapView = 0;
  let row = 0; // 0 = start/stop, 1 = lap, 2 = lap list (only if laps exist)
  let focus = 'stack'; // 'stack' | 'menu' | 'reset'
  let ticker, redrawInterval;

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function fmt(sec) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return pad(hrs) + ':' + pad(mins) + ':' + pad(secs);
  }

  function maxRow() {
    return laps.length ? 2 : 1;
  }

  function rowEnabled(r) {
    if (r === 1) return running;
    return true;
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

  function draw() {  "ram";
    h.clear(1);
    h.setColor(3).setFontMonofonto36().setFontAlign(0, 0).drawString('STOPWATCH', 240, 47);

    const hrs = Math.floor(elapsed / 3600);
    const mins = Math.floor((elapsed % 3600) / 60);
    const secs = elapsed % 60;
    const vals = [hrs, mins, secs];
    for (let i = 0; i < 3; i++) {
      h.setColor(3).setFontMonofonto36().setFontAlign(0, 0)
        .drawString(pad(vals[i]) + C.FIELD_LABELS[i], C.FIELD_X[i], C.FIELD_Y - 25);
    }

    // Main vertical stack: START, LAP
    drawButton(240, C.START_Y1, C.START_Y2, 70, running ? 'STOP' : 'START', focus === 'stack' && row === 0, true);
    drawButton(240, C.LAP_Y1, C.LAP_Y2, 70, 'LAP', focus === 'stack' && row === 1, running);

    // MENU and RESET sit off to the sides, mirrored, reached via knob2.
    drawButton(C.MENU_CX, C.SIDE_Y1, C.SIDE_Y2, C.SIDE_W, 'MENU', focus === 'menu', true);
    drawButton(C.RESET_CX, C.SIDE_Y1, C.SIDE_Y2, C.SIDE_W, 'RESET', focus === 'reset', elapsed > 0);

    if (laps.length) {
      h.setColor(2).setFontMonofonto14().setFontAlign(0, 0)
        .drawString('LAP ' + (lapView + 1) + ' OF ' + laps.length, 240, C.LAPCOUNT_Y);
      h.setColor(focus === 'stack' && row === 2 ? 3 : 2).setFontMonofonto16().setFontAlign(0, 0)
        .drawString('<  ' + laps[lapView] + '  >', 240, C.LAPVIEW_Y);
    }

    h.flip();
    Pip.lastFlip = getTime();
  }

  function leaveForMenu() {
    if (ticker) clearInterval(ticker);
    running = false;
    Pip.playSound('TAB');
    goTo('HOLO/VAULT_TEC_TIMER/TITLE.JS');
  }

  function doReset() {
    if (elapsed <= 0) return;
    if (ticker) clearInterval(ticker);
    running = false;
    elapsed = 0;
    laps = [];
    lapView = 0;
    row = 0;
    focus = 'stack';
    Pip.playSound('TAB');
    draw();
  }

  // knob1 press — activates whatever currently has focus
  function onPress() {
    if (focus === 'menu') {
      leaveForMenu();
      return;
    }
    if (focus === 'reset') {
      doReset();
      return;
    }

    if (row === 0) {
      running = !running;
      Pip.playSound('TAB');
      if (running) {
        ticker = setInterval(function () {
          elapsed++;
          draw();
        }, 1000);
      } else {
        clearInterval(ticker);
      }
      draw();
    } else if (row === 1) {
      if (!running) return;
      laps.push(fmt(elapsed));
      lapView = laps.length - 1;
      Pip.playSound('TAB');
      draw();
    }
  }

  // knob1 rotate — moves the row cursor among the usable stack rows,
  // skipping any rows that are currently disabled (e.g. LAP while not
  // running). If no enabled row exists further in that direction, the
  // cursor simply doesn't move - it never lands on a disabled row.
  // Has no effect while a side button has focus.
  function onKnob1(dir) {
    if (dir) {
      if (focus !== 'stack') return;
      const top = maxRow();
      let next = row, found = false;
      for (let i = 0; i < top + 1; i++) {
        const candidate = next + dir;
        if (candidate < 0 || candidate > top) break;
        next = candidate;
        if (rowEnabled(next)) { found = true; break; }
      }
      if (found) {
        row = next;
        Pip.playSound('SCROLL');
        draw();
      }
    } else {
      onPress();
    }
  }

  // knob2 rotate — pages through recorded laps while viewing the lap list;
  // otherwise jumps focus to MENU (left) or RESET (right). Both are
  // reachable from either middle button (START/STOP or LAP). RESET only
  // requires there being time on the clock (elapsed > 0) - it stays
  // reachable after stopping so the clock can still be cleared. Rotating
  // back the opposite way returns focus to whatever stack row it left from.
  function onKnob2(dir) {
    if (focus === 'menu') {
      if (dir > 0) {
        focus = 'stack';
        Pip.playSound('SCROLL');
        draw();
      }
      return;
    }
    if (focus === 'reset') {
      if (dir < 0) {
        focus = 'stack';
        Pip.playSound('SCROLL');
        draw();
      }
      return;
    }
    if (row === 2 && laps.length) {
      lapView = E.clip(lapView + dir, 0, laps.length - 1);
      Pip.playSound('SCROLL');
      draw();
      return;
    }
    if (dir < 0) {
      focus = 'menu';
      Pip.playSound('SCROLL');
      draw();
    } else if (dir > 0 && (row === 0 || row === 1) && elapsed > 0) {
      focus = 'reset';
      Pip.playSound('SCROLL');
      draw();
    }
  }

  Pip.audioStop();
  Pip.onExclusive('knob1', onKnob1);
  Pip.onExclusive('knob2', onKnob2);
  redrawInterval = setInterval(draw, 1000);
  draw();

  return {
    remove: function () {
      clearInterval(redrawInterval);
      if (ticker) clearInterval(ticker);
      Pip.removeListener('knob1', onKnob1);
      Pip.removeListener('knob2', onKnob2);
      Pip.audioStop();
      h.clear();
    },
  };
});