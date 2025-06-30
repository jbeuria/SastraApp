// @ts-nocheck
import { openDB } from 'idb';

// Database version remains 3. The upgrade logic is now fixed.
export const dbPromise = openDB('sastra-app-db', 3, {
  upgrade(db, oldVersion, newVersion, tx) {
    // These checks for creating stores are correct for initial setup.
    if (!db.objectStoreNames.contains('content')) {
      db.createObjectStore('content', { keyPath: 'id', autoIncrement: false });
    }
    if (!db.objectStoreNames.contains('highlights')) {
      db.createObjectStore('highlights', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('notes')) {
      db.createObjectStore('notes', { keyPath: 'toc_url' });
    }
    if (!db.objectStoreNames.contains('bookmarks')) {
      db.createObjectStore('bookmarks', { keyPath: 'url' });
    }

    // CORRECTED: This logic now correctly uses the provided upgrade transaction `tx`
    // to clear the highlights store, preventing the error.
    if (oldVersion < 3) {
        if (db.objectStoreNames.contains('highlights')) {
            console.log('Clearing old highlights using the correct transaction...');
            tx.objectStore('highlights').clear();
        }
    }
  }
});

// The rest of the db object remains the same.
export const db = {
  content: {
    async get(id) { const db = await dbPromise; return db.get('content', id); },
    async bulkPut(data) {
      const db = await dbPromise;
      const tx = db.transaction('content', 'readwrite');
      for (const item of data) await tx.store.put(item);
      await tx.done;
    },
  },
  highlights: {
    async where(field, value) { const db = await dbPromise; const all = await db.getAll('highlights'); return all.filter(x => x[field] === value); },
    async add(data) { const db = await dbPromise; return db.add('highlights', data); },
    async delete(id) { 
        // EDITED: Added a console log to test the delete command
        console.log(`[db.js] Received command to delete highlight with ID: ${id}`);
        const db = await dbPromise; 
        return db.delete('highlights', id); 
    },
    async getAll() { const db = await dbPromise; return db.getAll('highlights'); },
  },
  notes: {
    async get(toc_url) { const db = await dbPromise; return db.get('notes', toc_url); },
    async put(data) { const db = await dbPromise; return db.put('notes', data); },
    async getAll() { const db = await dbPromise; return db.getAll('notes'); },
    async bulkDelete(urls) {
        const db = await dbPromise;
        const tx = db.transaction('notes', 'readwrite');
        await Promise.all(urls.map(url => tx.store.delete(url)));
        await tx.done;
    },
  },
  bookmarks: {
    async get(url) { const db = await dbPromise; return db.get('bookmarks', url); },
    async put(data) { const db = await dbPromise; return db.put('bookmarks', data); },
    async delete(url) { const db = await dbPromise; return db.delete('bookmarks', url); },
    async getAll() { const db = await dbPromise; return db.getAll('bookmarks'); }
  }
};
