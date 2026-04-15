let audioContext: AudioContext | null = null;
let clickBuffer: AudioBuffer | null = null;

const isMobile = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const getVolume = () => (isMobile() ? 0.25 : 0.4);

const initAudioContext = (): AudioContext | null => {
  if (audioContext) return audioContext;
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
};

const generateClickSound = (context: AudioContext): AudioBuffer => {
  const sampleRate = context.sampleRate;
  // Short sharp click: ~8ms transient + ~20ms tail
  const duration = 0.028;
  const length = Math.floor(sampleRate * duration);
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // White noise burst for the "click" transient
    const noise = (Math.random() * 2 - 1);
    // Sharp attack, very fast exponential decay — mimics a physical click
    const envelope = Math.exp(-t * 400);
    // Slight low-mid body (around 200Hz) to give it weight
    const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 250) * 0.4;
    data[i] = (noise * envelope + body) * 0.8;
  }

  return buffer;
};

const preloadSound = (): void => {
  const context = initAudioContext();
  if (!context || clickBuffer) return;
  try {
    clickBuffer = generateClickSound(context);
  } catch {
    // silently fail
  }
};

export const playClickSound = async (): Promise<void> => {
  const context = initAudioContext();
  if (!context) return;

  if (!clickBuffer) {
    try {
      clickBuffer = generateClickSound(context);
    } catch {
      return;
    }
  }

  try {
    if (context.state === 'suspended') {
      await context.resume();
    }

    const source = context.createBufferSource();
    const gainNode = context.createGain();
    gainNode.gain.value = getVolume();

    source.buffer = clickBuffer;
    source.connect(gainNode);
    gainNode.connect(context.destination);
    source.start(0);
  } catch {
    // silently fail — don't break UI for audio issues
  }
};

// Preload on module init
preloadSound();
