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
  const audioBuffer = context.createBuffer(1, sampleRate * 0.1, sampleRate);
  const data = audioBuffer.getChannelData(0);

  for (let i = 0; i < audioBuffer.length; i++) {
    const t = i / sampleRate;
    const frequency = 800;
    const decay = Math.exp(-3 * t);
    data[i] = Math.sin(2 * Math.PI * frequency * t) * decay * 0.3;
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
