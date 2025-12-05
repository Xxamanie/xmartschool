import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  off,
  child
} from 'firebase/database';
import { rtdb } from '../../firebase-config';

export const firebaseRealtimeService = {
  write: async (path: string, data: any): Promise<void> => {
    try {
      await set(ref(rtdb, path), data);
    } catch (error: any) {
      throw new Error(error.message || 'Write failed');
    }
  },

  read: async (path: string): Promise<any> => {
    try {
      const snapshot = await get(ref(rtdb, path));
      return snapshot.val();
    } catch (error: any) {
      throw new Error(error.message || 'Read failed');
    }
  },

  update: async (path: string, data: any): Promise<void> => {
    try {
      await update(ref(rtdb, path), data);
    } catch (error: any) {
      throw new Error(error.message || 'Update failed');
    }
  },

  delete: async (path: string): Promise<void> => {
    try {
      await remove(ref(rtdb, path));
    } catch (error: any) {
      throw new Error(error.message || 'Delete failed');
    }
  },

  subscribe: (path: string, callback: (data: any) => void): (() => void) => {
    const reference = ref(rtdb, path);
    const listener = onValue(reference, (snapshot) => {
      callback(snapshot.val());
    });
    
    return () => off(reference);
  },

  syncData: async (path: string, localData: any): Promise<any> => {
    try {
      const remoteData = await firebaseRealtimeService.read(path);
      if (!remoteData) {
        await firebaseRealtimeService.write(path, localData);
        return localData;
      }
      const mergedData = { ...remoteData, ...localData };
      await firebaseRealtimeService.update(path, mergedData);
      return mergedData;
    } catch (error: any) {
      throw new Error(error.message || 'Sync failed');
    }
  }
};
