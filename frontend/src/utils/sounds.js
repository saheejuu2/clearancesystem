let _audioCtxReady = false;

function getCtx() {
  if (!window._audioCtx) {
    window._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (window._audioCtx.state === 'suspended') {
    window._audioCtx.resume().catch(() => {});
  }
  return window._audioCtx;
}

// Unlock AudioContext on first user gesture
function unlockAudio() {
  if (_audioCtxReady) return;
  _audioCtxReady = true;
  if (window._audioCtx && window._audioCtx.state === 'suspended') {
    window._audioCtx.resume().catch(() => {});
  }
}
['click', 'keydown', 'touchstart'].forEach(evt =>
  document.addEventListener(evt, unlockAudio, { once: true, capture: true })
);

// Realistic bell using multiple partials with bell-specific frequency ratios
function bellStrike(baseFreq, duration = 2.0, vol = 0.4) {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Bell partials: frequency ratio, relative amplitude, decay multiplier
    const partials = [
      [1.0,    1.0,   1.0],
      [2.756,  0.5,   0.7],
      [5.404,  0.25,  0.5],
      [8.933,  0.12,  0.4],
      [13.457, 0.06,  0.3],
    ];

    partials.forEach(([ratio, amp, decay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratio, now);
      gain.gain.setValueAtTime(vol * amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration * decay);
      osc.start(now);
      osc.stop(now + duration * decay + 0.05);
    });
  } catch { /* silent fail */ }
}

// Notification bell — single clear bell strike
export function playNotificationSound() {
  bellStrike(523, 2.5, 0.35); // C5
}

// Message bell — two bell strikes (ding ding)
export function playMessageSound() {
  bellStrike(659, 2.0, 0.3);  // E5
  setTimeout(() => bellStrike(784, 2.5, 0.3), 350); // G5
}
