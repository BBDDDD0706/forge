// 버들 대장간 — 소리. 외부 음원 없이 Web Audio로 직접 합성한 효과음과 자작 배경음악.
const Snd = (() => {
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch {} };
  let ctx = null, master, musicG, sfxG, verb;
  let musicOn = read('fg-music', true), sfxOn = read('fg-sfx', true);
  let timer = null, step = 0, nextT = 0, playing = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    verb = ctx.createDelay(); verb.delayTime.value = 0.17;
    const fb = ctx.createGain(); fb.gain.value = 0.25;
    const wet = ctx.createGain(); wet.gain.value = 0.28;
    verb.connect(fb).connect(verb); verb.connect(wet).connect(master);
    musicG = ctx.createGain(); musicG.gain.value = musicOn ? 0.2 : 0; musicG.connect(master); musicG.connect(verb);
    sfxG = ctx.createGain(); sfxG.gain.value = sfxOn ? 0.75 : 0; sfxG.connect(master); sfxG.connect(verb);
  }
  function tone(type, f, t, dur, vol, out = sfxG, to) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, f, type = 'bandpass', out = sfxG) {
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = type; fl.frequency.value = f; g.gain.value = vol; s.buffer = b; s.connect(fl).connect(g).connect(out); s.start(t);
  }
  const hz = (semi) => 523.25 * Math.pow(2, semi / 12);
  const S = {
    // 망치로 모루를 두드리는 소리
    hammer: (t) => { noise(t, 0.12, 0.7, 3200); tone('square', 1760, t, 0.18, 0.05); tone('triangle', 2640, t, 0.35, 0.05); tone('sine', 140, t, 0.1, 0.25, sfxG, 70); },
    success: (t) => [0, 4, 7, 12].forEach((x, i) => { tone('triangle', hz(x), t + i * 0.07, 0.45, 0.16); tone('sine', hz(x + 12), t + i * 0.07, 0.3, 0.05); }),
    big: (t) => [0, 4, 7, 12, 16, 19, 24].forEach((x, i) => tone('triangle', hz(x - 5), t + i * 0.08, 0.8, 0.15)),
    keep: (t) => { tone('sine', 440, t, 0.2, 0.12); tone('sine', 440, t + 0.12, 0.25, 0.1); },
    down: (t) => [0, -3, -7].forEach((x, i) => tone('triangle', hz(x - 5), t + i * 0.12, 0.35, 0.14)),
    destroy: (t) => { noise(t, 0.9, 0.8, 900, 'lowpass'); noise(t, 0.35, 0.5, 5000, 'highpass'); tone('sawtooth', 220, t, 0.9, 0.12, sfxG, 40); },
    coin: (t) => { tone('square', 1318, t, 0.08, 0.06); tone('square', 1760, t + 0.07, 0.25, 0.06); },
    clash: (t) => { noise(t, 0.2, 0.6, 4200); tone('square', 2200, t, 0.12, 0.05, sfxG, 900); },
    win: (t) => [0, 7, 12, 16].forEach((x, i) => tone('triangle', hz(x), t + i * 0.1, 0.5, 0.16)),
    lose: (t) => [4, 0, -5].forEach((x, i) => tone('sine', hz(x - 12), t + i * 0.18, 0.5, 0.14)),
    click: (t) => tone('sine', 1000, t, 0.05, 0.08),
    no: (t) => tone('sine', 240, t, 0.12, 0.1, sfxG, 180),
  };
  function play(name) { if (!sfxOn) return; try { ensure(); S[name]?.(ctx.currentTime + 0.001); } catch {} }

  // 배경음악: 대장간의 느긋한 리듬 (직접 작곡)
  const SONG = { bpm: 92, bass: [45, 0, 45, 0, 48, 0, 43, 0, 41, 0, 41, 0, 43, 0, 40, 0], mel: [69, 0, 72, 0, 76, 74, 72, 0, 67, 0, 69, 0, 71, 0, 0, 0, 69, 0, 72, 0, 77, 76, 74, 0, 72, 0, 71, 0, 69, 0, 0, 0] };
  const mhz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function sched() {
    const sd = 60 / SONG.bpm / 2;
    while (nextT < ctx.currentTime + 0.3) {
      const t = nextT, b = SONG.bass[step % SONG.bass.length], m = SONG.mel[step % SONG.mel.length];
      if (b) tone('triangle', mhz(b - 12), t, sd * 1.6, 0.09, musicG);
      if (m) tone('sine', mhz(m), t, sd * 1.5, 0.05, musicG);
      if (step % 4 === 0) noise(t, 0.05, 0.08, 3000, 'bandpass', musicG);
      nextT += sd; step++;
    }
  }
  function music(on) {
    if (on === playing) return; playing = on;
    try { ensure(); } catch { return; }
    clearInterval(timer);
    if (on) { step = 0; nextT = ctx.currentTime + 0.1; timer = setInterval(sched, 80); }
  }
  return {
    play, music, unlock() { try { ensure(); } catch {} },
    get musicOn() { return musicOn; }, get sfxOn() { return sfxOn; },
    toggleMusic() { musicOn = !musicOn; write('fg-music', musicOn); if (musicG) musicG.gain.value = musicOn ? 0.2 : 0; },
    toggleSfx() { sfxOn = !sfxOn; write('fg-sfx', sfxOn); if (sfxG) sfxG.gain.value = sfxOn ? 0.75 : 0; },
  };
})();
