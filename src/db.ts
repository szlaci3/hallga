import Dexie, { type Table } from 'dexie';
import { MAX_DOCUMENTS } from './config';
import type { HallgaDocument } from './types';

class HallgaDatabase extends Dexie {
  documents!: Table<HallgaDocument, number>;

  constructor() {
    super('hallga');
    this.version(1).stores({
      documents: '++id, createdAt, updatedAt, pinned',
    });
  }
}

export const db = new HallgaDatabase();

export async function listDocuments() {
  const documents = await db.documents.toArray();

  return documents.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return Number(b.pinned) - Number(a.pinned);
    }

    return b.createdAt - a.createdAt;
  });
}

export async function createDocument(content: string) {
  const now = Date.now();
  const id = await db.documents.add({
    title: createTitle(content),
    content: content.trim(),
    createdAt: now,
    updatedAt: now,
    pinned: false,
  });

  await enforceDocumentLimit();
  return id;
}

export async function updateDocument(id: number, content: string) {
  await db.documents.update(id, {
    title: createTitle(content),
    content: content.trim(),
    updatedAt: Date.now(),
  });
}

export async function togglePinned(id: number, pinned: boolean) {
  await db.documents.update(id, { pinned });
}

export async function deleteDocument(id: number) {
  await db.documents.delete(id);
}

function createTitle(content: string) {
  const words = content
    .replace(/[#*_>`~[\]()-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);

  return words.length > 0 ? words.join(' ') : 'Untitled document';
}

async function enforceDocumentLimit() {
  const count = await db.documents.count();

  if (count <= MAX_DOCUMENTS) {
    return;
  }

  const overflow = count - MAX_DOCUMENTS;
  const documents = await db.documents.toArray();
  const removalIds = documents
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(a.pinned) - Number(b.pinned);
      }

      return a.createdAt - b.createdAt;
    })
    .slice(0, overflow)
    .map((document) => document.id)
    .filter((id): id is number => typeof id === 'number');

  await db.documents.bulkDelete(removalIds);
}
