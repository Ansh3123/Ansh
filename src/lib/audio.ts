export const playSound = (type: 'win' | 'lose' | 'recharge' | 'tick' | 'click' | 'roll') => {
  try {
    if (typeof window === 'undefined') return;
    const isMuted = localStorage.getItem('isMuted') === 'true';
    if (isMuted) return;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === 'win') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'lose') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'recharge') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'tick') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'roll') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

let bgmCtx: AudioContext | null = null;
let bgmOsc: OscillatorNode | null = null;
let bgmGain: GainNode | null = null;

export const playBgm = () => {
  try {
    if (typeof window === 'undefined') return;
    const isMuted = localStorage.getItem('isMuted') === 'true';
    if (isMuted) return;

    if (bgmCtx) return; // already playing
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    bgmCtx = new AudioContext();
    bgmOsc = bgmCtx.createOscillator();
    bgmGain = bgmCtx.createGain();
    
    bgmOsc.type = 'sine';
    bgmOsc.frequency.setValueAtTime(100, bgmCtx.currentTime); // low hum
    
    bgmGain.gain.setValueAtTime(0, bgmCtx.currentTime);
    bgmGain.gain.linearRampToValueAtTime(0.05, bgmCtx.currentTime + 2); // very soft
    
    bgmOsc.connect(bgmGain);
    bgmGain.connect(bgmCtx.destination);
    
    bgmOsc.start();
  } catch (e) {
    console.error("BGM playback failed", e);
  }
};

export const stopBgm = () => {
  if (bgmGain && bgmCtx) {
    bgmGain.gain.linearRampToValueAtTime(0, bgmCtx.currentTime + 1);
    setTimeout(() => {
      bgmOsc?.stop();
      bgmCtx?.close();
      bgmCtx = null;
      bgmOsc = null;
      bgmGain = null;
    }, 1000);
  }
};

export const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const isMuted = localStorage.getItem('isMuted') === 'true';
    if (!isMuted) {
      navigator.vibrate(pattern);
    }
  }
};
