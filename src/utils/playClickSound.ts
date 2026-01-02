let audioContext: AudioContext | null = null;
let clickBuffer: AudioBuffer | null = null;

const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const getMobileVolume = () => (isMobile() ? 0.3 : 0.5);

const initAudioContext = () => {
  if (audioContext) return audioContext;
  
  const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    console.warn('AudioContext not supported');
    return null;
  }
  
  audioContext = new AudioContextClass();
  return audioContext;
};

const generateClickSound = async (): Promise<AudioBuffer | null> => {
  const context = initAudioContext();
  if (!context) return null;

  const sampleRate = context.sampleRate;
  // Lower-frequency, less thumpy haptic tap (≈18ms), no bright HF tone
  const duration = 0.018; // seconds
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const audioBuffer = context.createBuffer(1, length, sampleRate);
  const data = audioBuffer.getChannelData(0);

  // Envelope parameters (very quick for tactile feel)
  const attackTime = 0.0006; // very quick attack (~0.6ms)
  const decayRate = 260; // faster decay for less thump

  for (let i = 0; i < audioBuffer.length; i++) {
    const t = i / sampleRate;
    // Very fast attack then rapid decay
    const attack = 1 - Math.exp(-t / attackTime);
    const decay = Math.exp(-decayRate * t);

    // Gentle low-frequency body (so it's not too thumpy)
    const low = Math.sin(2 * Math.PI * 200 * t) * 0.06; // lower freq, lower amp

    // Soft mid transient (non-bright) to give click clarity without sparkle
    const mid = Math.sin(2 * Math.PI * 520 * t) * 0.12 * Math.exp(-300 * t);

    // Very subtle, low-pass-ish noise transient for mechanical feel, reduced amplitude
    const noise = (Math.random() * 2 - 1) * Math.exp(-500 * t) * 0.05;

    // Mix components, apply envelope and final scaling
    const sample = (low + mid + noise) * attack * decay * 0.65;
    data[i] = sample;
  }

  return audioBuffer;
};

const preloadSound = async () => {
  if (clickBuffer) return;

  clickBuffer = await generateClickSound();
};

export const playClickSound = async () => {
  if (!clickBuffer) {
    await preloadSound();
  }

  const context = initAudioContext();
  if (!context || !clickBuffer) return;

  try {
    if (context.state === 'suspended') {
      await context.resume();
    }

    const source = context.createBufferSource();
    const gainNode = context.createGain();

    source.buffer = clickBuffer;
    gainNode.gain.value = getMobileVolume();

    source.connect(gainNode);
    gainNode.connect(context.destination);

    source.start(0);
  } catch (error) {
    console.warn('Failed to play click sound:', error);
  }
};

preloadSound().catch(() => {
  console.warn('Failed to preload click sound');
});
