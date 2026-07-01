import Dexie, { type Table } from 'dexie';
import { MAX_DOCUMENTS } from './config';
import type { HallgaDocument, HallgaFolder } from './types';

export type HallgaBackup = {
  app: 'hallga';
  schemaVersion: 2;
  exportedAt: string;
  documents: HallgaDocument[];
  folders: HallgaFolder[];
};

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

export async function exportDatabase(): Promise<HallgaBackup> {
  const [documents, folders] = await Promise.all([db.documents.toArray(), db.folders.toArray()]);

  return {
    app: 'hallga',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    documents,
    folders,
  };
}

export async function replaceDatabase(backup: unknown) {
  const data = normalizeBackup(backup);

  await db.transaction('rw', db.folders, db.documents, async () => {
    await db.documents.clear();
    await db.folders.clear();
    await db.folders.bulkAdd(data.folders);
    await db.documents.bulkAdd(data.documents);
  });
}

export async function mergeDatabaseBackup(backup: unknown) {
  const data = normalizeBackup(backup);
  const folderIdMap = new Map<number, number>();
  const orderedFolders = [...data.folders].sort((a, b) => Number(a.parentId !== undefined) - Number(b.parentId !== undefined));

  await db.transaction('rw', db.folders, db.documents, async () => {
    for (const folder of orderedFolders) {
      const { id, ...folderData } = folder;
      const nextId = await db.folders.add({
        ...folderData,
        parentId: folder.parentId === undefined ? undefined : folderIdMap.get(folder.parentId),
      });

      if (typeof id === 'number') {
        folderIdMap.set(id, nextId);
      }
    }

    await db.documents.bulkAdd(
      data.documents.map((document) => {
        const { id, ...documentData } = document;

        return {
          ...documentData,
          folderId: document.folderId === undefined ? undefined : folderIdMap.get(document.folderId),
        };
      }),
    );
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

function normalizeBackup(value: unknown): Pick<HallgaBackup, 'documents' | 'folders'> {
  if (!isRecord(value) || !Array.isArray(value.documents) || !Array.isArray(value.folders)) {
    throw new Error('Choose a Hallga database backup JSON file.');
  }

  return {
    documents: value.documents.map(normalizeDocument),
    folders: value.folders.map(normalizeFolder),
  };
}

function normalizeDocument(value: unknown): HallgaDocument {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.content !== 'string') {
    throw new Error('The backup contains an invalid document.');
  }

  return {
    id: optionalNumber(value.id),
    title: value.title,
    content: value.content,
    createdAt: requiredNumber(value.createdAt, 'document createdAt'),
    updatedAt: requiredNumber(value.updatedAt, 'document updatedAt'),
    pinned: Boolean(value.pinned),
    pinnedAt: optionalNumber(value.pinnedAt),
    folderId: optionalNumber(value.folderId),
  };
}

function normalizeFolder(value: unknown): HallgaFolder {
  if (!isRecord(value) || typeof value.name !== 'string') {
    throw new Error('The backup contains an invalid folder.');
  }

  return {
    id: optionalNumber(value.id),
    name: value.name,
    parentId: optionalNumber(value.parentId),
    createdAt: requiredNumber(value.createdAt, 'folder createdAt'),
    updatedAt: requiredNumber(value.updatedAt, 'folder updatedAt'),
    pinned: Boolean(value.pinned),
    pinnedAt: optionalNumber(value.pinnedAt),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function requiredNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`The backup contains an invalid ${field}.`);
  }

  return value;
}
