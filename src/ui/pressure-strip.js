// Live pressure graph across the top of the screen: RA, RV and (from the RV climb on) PA, 0–30 mmHg.
// Where two lines cross, a valve flips: a simplified Wiggers diagram.
const W = 1280, H = 110, X0 = 150, PLOT_W = W - X0 - 190, MAX = 30;
const COLOURS = { ra: 0x6fa8ff, rv: 0xc58cff, pa: 0xffa64d };
const SAMPLES = 360; // ~2 beats at 60 fps (one game beat is 4.8 s)

export function createPressureStrip(scene) {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(100);
  const txt = (x, y, s, c = '#f6e6ea') => scene.add.text(x, y, s, { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: c })
    .setScrollFactor(0).setDepth(101).setResolution(2);
  const labels = [txt(16, 14, 'Pressure (mmHg)', '#d8aab6'), txt(16, 38, '● RA', '#6fa8ff'), txt(16, 58, '● RV', '#c58cff'), txt(16, 78, '● PA', '#ffa64d')];
  const valveTxt = txt(W - 180, 22, ''); const phaseTxt = txt(W - 180, 70, '', '#d8aab6');
  const hist = { ra: [], rv: [], pa: [] };
  let visible = false;
  const setVisible = v => { visible = v; g.setVisible(v); for (const t of [...labels, valveTxt, phaseTxt]) t.setVisible(v); };
  setVisible(false);
  scene.events.on('toggle-strip', () => setVisible(!visible));

  return {
    get visible() { return visible; },
    setVisible,
    update({ heart, level }) {
      for (const k of ['ra', 'rv', 'pa']) { hist[k].push(heart.pressures[k]); if (hist[k].length > SAMPLES) hist[k].shift(); }
      if (!visible) return;
      const showPA = level.part === 'rv-climb' || level.part === 'complete';
      labels[3].setVisible(showPA);
      g.clear();
      g.fillStyle(0x14040a, 0.82).fillRoundedRect(8, 8, W - 16, H - 4, 10);
      g.lineStyle(1, 0xffffff, 0.08);
      for (const v of [0, 10, 20, 30]) { const y = 12 + (H - 16) * (1 - v / MAX); g.lineBetween(X0, y, X0 + PLOT_W, y); }
      for (const k of showPA ? ['pa', 'ra', 'rv'] : ['ra', 'rv']) {
        const arr = hist[k]; if (arr.length < 2) continue;
        g.lineStyle(k === 'rv' ? 3 : 2.5, COLOURS[k], 1).beginPath();
        arr.forEach((v, i) => {
          const x = X0 + PLOT_W * (i + SAMPLES - arr.length) / (SAMPLES - 1), y = 12 + (H - 16) * (1 - Math.min(v, MAX) / MAX);
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        });
        g.strokePath();
      }
      valveTxt.setText(`Tricuspid: ${heart.valves.tricuspid ? 'OPEN' : 'shut'}\nPulmonary: ${heart.valves.pulmonary ? 'OPEN' : 'shut'}`);
      phaseTxt.setText(heart.phase.replace(/-/g, ' '));
    },
  };
}
