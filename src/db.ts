import Dexie, { type Table } from 'dexie';
import { MAX_DOCUMENTS } from './config';
import type { HallgaDocument, HallgaFolder } from './types';

class HallgaDatabase extends Dexie {
  documents!: Table<HallgaDocument, number>;
  folders!: Table<HallgaFolder, number>;

  constructor() {
    super('hallga');
    this.version(1).stores({
      documents: '++id, createdAt, updatedAt, pinned',
    });
    this.version(2).stores({
      documents: '++id, createdAt, updatedAt, pinned, pinnedAt, folderId',
      folders: '++id, parentId, createdAt, updatedAt, pinned, pinnedAt',
    });
  }
}

export const db = new HallgaDatabase();

export async function listDocuments(folderId?: number) {
  const documents = await db.documents.toArray();

  return documents
    .filter((document) => document.folderId === folderId)
    .sort(sortPinnedFirst);
}

export async function listFolders(parentId?: number) {
  const folders = await db.folders.toArray();

  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort(sortPinnedFirst);
}

export async function createDocument(content: string, folderId?: number) {
  const now = Date.now();
  const id = await db.documents.add({
    title: createTitle(content),
    content: content.trim(),
    createdAt: now,
    updatedAt: now,
    pinned: false,
    folderId,
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
  await db.documents.update(id, { pinned, pinnedAt: pinned ? Date.now() : undefined });
}

export async function deleteDocument(id: number) {
  await db.documents.delete(id);
}

export async function deleteDocuments(ids: number[]) {
  await db.documents.bulkDelete(ids);
}

export async function moveDocuments(ids: number[], folderId?: number) {
  await db.documents.bulkUpdate(ids.map((id) => ({ key: id, changes: { folderId, updatedAt: Date.now() } })));
}

export async function createFolder(name: string, parentId?: number) {
  const now = Date.now();
  const trimmedName = name.trim();

  if (!trimmedName) {
    return;
  }

  if (parentId) {
    const parent = await db.folders.get(parentId);

    if (parent?.parentId) {
      throw new Error('Subfolders can only be created inside top-level folders.');
    }
  }

  return db.folders.add({
    name: trimmedName,
    parentId,
    createdAt: now,
    updatedAt: now,
    pinned: false,
  });
}

export async function renameFolder(id: number, name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return;
  }

  await db.folders.update(id, { name: trimmedName, updatedAt: Date.now() });
}

export async function moveFolder(id: number, parentId?: number) {
  const folder = await db.folders.get(id);

  if (!folder || folder.parentId === undefined) {
    return;
  }

  if (parentId) {
    const parent = await db.folders.get(parentId);

    if (parent?.parentId) {
      throw new Error('Subfolders can only be moved into top-level folders.');
    }
  }

  await db.folders.update(id, { parentId, updatedAt: Date.now() });
}

export async function toggleFolderPinned(id: number, pinned: boolean) {
  await db.folders.update(id, { pinned, pinnedAt: pinned ? Date.now() : undefined });
}

export async function deleteFolder(id: number) {
  const childFolders = await db.folders.where('parentId').equals(id).toArray();
  const folderIds = [id, ...childFolders.map((folder) => folder.id).filter((folderId): folderId is number => typeof folderId === 'number')];
  const documents = await db.documents.toArray();
  const documentIds = documents
    .filter((document) => document.folderId !== undefined && folderIds.includes(document.folderId))
    .map((document) => document.id)
    .filter((documentId): documentId is number => typeof documentId === 'number');

  await db.transaction('rw', db.folders, db.documents, async () => {
    await db.documents.bulkDelete(documentIds);
    await db.folders.bulkDelete(folderIds);
  });
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

function sortPinnedFirst<T extends { pinned: boolean; pinnedAt?: number; createdAt: number }>(a: T, b: T) {
  if (a.pinned !== b.pinned) {
    return Number(b.pinned) - Number(a.pinned);
  }

  if (a.pinned && b.pinned) {
    return (b.pinnedAt ?? b.createdAt) - (a.pinnedAt ?? a.createdAt);
  }

  return b.createdAt - a.createdAt;
}
