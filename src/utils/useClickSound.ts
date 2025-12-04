import { useCallback } from 'react';
import { playClickSound } from './playClickSound';

export const useClickSound = () => {
  const handleClick = useCallback(async () => {
    try {
      await playClickSound();
    } catch (error) {
      console.warn('Failed to play click sound:', error);
    }
  }, []);

  return { playSound: handleClick };
};
