// Keyboard + gamepad (standard mapping) merged into one input snapshot per frame.
// Edge-triggered: burst, use, toggleStrip, pause, dialLeft, dialRight, confirm.
const DEADZONE = 0.2;
const PAD = { A: 0, X: 2, VIEW: 8, START: 9, LEFT: 14, RIGHT: 15 };

export function createInput(scene) {
  const K = Phaser.Input.Keyboard.KeyCodes;
  // addKeys captures these keys, so Tab, Space and the arrows never scroll the page or move focus.
  const keys = scene.input.keyboard.addKeys({
    up: K.W, down: K.S, left: K.A, right: K.D,
    up2: K.UP, down2: K.DOWN, left2: K.LEFT, right2: K.RIGHT,
    burst: K.SPACE, use: K.E, strip: K.TAB, pause: K.ESC, enter: K.ENTER,
  }, true);
  const prev = {};
  let touch = null;

  const pad = () => {
    const gp = scene.input.gamepad;
    if (!gp || !gp.total) return null;
    let p;
    try { p = gp.getPad(0) || gp.pad1 || null; } catch { return null; }
    // Phaser keeps an unplugged pad with its last stick values; trust the browser's live list instead.
    const live = navigator.getGamepads ? navigator.getGamepads() : [];
    const raw = p && live && live[p.index];
    return raw && raw.connected ? p : null;
  };
  const btn = (p, i) => !!(p && p.buttons && p.buttons[i] && p.buttons[i].pressed);
  const edge = (name, down) => { const e = down && !prev[name]; prev[name] = down; return e; };

  return {
    setTouch(t) { touch = t; },
    poll() {
      const p = pad();
      let x = (keys.right.isDown || keys.right2.isDown ? 1 : 0) - (keys.left.isDown || keys.left2.isDown ? 1 : 0);
      let y = (keys.down.isDown || keys.down2.isDown ? 1 : 0) - (keys.up.isDown || keys.up2.isDown ? 1 : 0);
      let padX = 0;
      if (p && p.axes && p.axes.length >= 2) {
        const ax = p.axes[0].getValue(), ay = p.axes[1].getValue();
        if (Math.hypot(ax, ay) > DEADZONE) { x += ax; y += ay; padX = ax; }
      }
      const t = touch ? touch.state() : null;
      if (t) { x += t.x; y += t.y; }
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }

      const leftHeld = keys.left.isDown || keys.left2.isDown || btn(p, PAD.LEFT) || padX < -0.6;
      const rightHeld = keys.right.isDown || keys.right2.isDown || btn(p, PAD.RIGHT) || padX > 0.6;
      return {
        x, y,
        burst: edge('burst', keys.burst.isDown || btn(p, PAD.A) || !!(t && t.burst)),
        use: edge('use', keys.use.isDown || btn(p, PAD.X) || !!(t && t.use)),
        toggleStrip: edge('strip', keys.strip.isDown || btn(p, PAD.VIEW)),
        pause: edge('pause', keys.pause.isDown || btn(p, PAD.START)),
        confirm: edge('confirm', keys.enter.isDown || btn(p, PAD.A)),
        dialLeft: edge('dialL', leftHeld),
        dialRight: edge('dialR', rightHeld),
        padConnected: !!p,
      };
    },
  };
}
