import {
  ref,
  uploadBytes,
  downloadURL,
  deleteObject,
  listAll
} from 'firebase/storage';
import { storage } from '../../firebase-config';

export const firebaseStorageService = {
  upload: async (path: string, file: File): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await downloadURL(storageRef);
      return url;
    } catch (error: any) {
      throw new Error(error.message || 'Upload failed');
    }
  },

  getUrl: async (path: string): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      return await downloadURL(storageRef);
    } catch (error: any) {
      throw new Error(error.message || 'Get URL failed');
    }
  },

  delete: async (path: string): Promise<void> => {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error: any) {
      throw new Error(error.message || 'Delete failed');
    }
  },

  listFiles: async (folderPath: string): Promise<string[]> => {
    try {
      const listRef = ref(storage, folderPath);
      const res = await listAll(listRef);
      const urls: string[] = [];
      for (const itemRef of res.items) {
        const url = await downloadURL(itemRef);
        urls.push(url);
      }
      return urls;
    } catch (error: any) {
      throw new Error(error.message || 'List files failed');
    }
  }
};
