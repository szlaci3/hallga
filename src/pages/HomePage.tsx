import {
  CheckSquare,
  ChevronRight,
  Database,
  FileText,
  Folder,
  FolderPlus,
  Pin,
  PinOff,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createFolder,
  db,
  deleteDocument,
  deleteDocuments,
  deleteFolder,
  moveDocuments,
  moveFolder,
  renameFolder,
  toggleFolderPinned,
  togglePinned,
} from '../db';
import { useDocuments } from '../hooks/useDocuments';
import type { HallgaFolder } from '../types';
import { useEffect, useMemo, useState } from 'react';

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function HomePage() {
  const [searchParams] = useSearchParams();
  const folderId = Number(searchParams.get('folder')) || undefined;
  const [refreshKey, setRefreshKey] = useState(0);
  const { documents, folders, loading } = useDocuments(refreshKey, folderId);
  const [allFolders, setAllFolders] = useState<HallgaFolder[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingFolderDeleteId, setPendingFolderDeleteId] = useState<number | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  useEffect(() => {
    db.folders.toArray().then(setAllFolders);
  }, [refreshKey]);

  useEffect(() => {
    setSelectedIds([]);
    setPendingDeleteId(null);
    setPendingFolderDeleteId(null);
    setConfirmBulkDelete(false);
  }, [folderId]);

  const currentFolder = allFolders.find((folder) => folder.id === folderId);
  const parentFolder = currentFolder?.parentId ? allFolders.find((folder) => folder.id === currentFolder.parentId) : undefined;
  const topLevelFolders = useMemo(() => allFolders.filter((folder) => folder.parentId === undefined), [allFolders]);
  const folderOptions = useMemo(() => [...allFolders].sort(folderSort), [allFolders]);

  async function refresh(action: Promise<unknown> | undefined) {
    await action;
    setRefreshKey((key) => key + 1);
  }

  function toggleSelected(id: number) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]));
  }

  async function handleCreateFolder() {
    if (folderId && !currentFolder) {
      window.alert('This folder is no longer available.');
      return;
    }

    if (currentFolder?.parentId) {
      window.alert('This folder is already a subfolder. Hallga supports two folder levels.');
      return;
    }

    const name = window.prompt(folderId ? 'Subfolder name' : 'Folder name');
    await refresh(createFolder(name ?? '', folderId));
  }

  async function handleRenameFolder(folder: HallgaFolder) {
    const name = window.prompt('Rename folder', folder.name);
    await refresh(renameFolder(folder.id!, name ?? ''));
  }

  async function handleBulkDelete() {
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }

    await refresh(deleteDocuments(selectedIds));
    setSelectedIds([]);
    setConfirmBulkDelete(false);
  }

  async function handleBulkMove(folderValue: string) {
    if (folderValue === '__move') {
      return;
    }

    const nextFolderId = folderValue ? Number(folderValue) : undefined;
    await refresh(moveDocuments(selectedIds, nextFolderId));
    setSelectedIds([]);
  }

  const hasSelectedDocuments = selectedIds.length > 0;

  return (
    <main className="page page-list" aria-labelledby="hallga-title">
      <header className="topbar">
        <div>
          <p className="eyebrow">Hallga</p>
          <h1 id="hallga-title">{currentFolder?.name ?? 'Documents'}</h1>
        </div>
        <div className="topbar-actions">
          <Link className="icon-button" to="/data" aria-label="Open data page" title="Data">
            <Database size={22} aria-hidden="true" />
          </Link>
          <button className="icon-button" type="button" onClick={handleCreateFolder} aria-label="Create folder" title="Create folder">
            <FolderPlus size={22} aria-hidden="true" />
          </button>
          <Link className="icon-button create-button" to={`/new${folderId ? `?folder=${folderId}` : ''}`} aria-label="Create document" title="Create document">
            <Plus size={22} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <nav className="breadcrumbs" aria-label="Folder path">
        <Link to="/">Main space</Link>
        {parentFolder ? (
          <>
            <ChevronRight size={16} aria-hidden="true" />
            <Link to={`/?folder=${parentFolder.id}`}>{parentFolder.name}</Link>
          </>
        ) : null}
        {currentFolder ? (
          <>
            <ChevronRight size={16} aria-hidden="true" />
            <span>{currentFolder.name}</span>
          </>
        ) : null}
      </nav>

      {hasSelectedDocuments ? (
        <section className="bulk-actions" aria-label="Selected document actions">
          <span>{selectedIds.length} selected</span>
          <select aria-label="Move selected documents" defaultValue="__move" onChange={(event) => handleBulkMove(event.target.value)}>
            <option value="__move" disabled>
              Move to...
            </option>
            <option value="">Main space</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folderLabel(folder, allFolders)}
              </option>
            ))}
          </select>
          <button className={confirmBulkDelete ? 'danger-button confirm' : 'danger-button'} type="button" onClick={handleBulkDelete}>
            <Trash2 size={17} aria-hidden="true" />
            {confirmBulkDelete ? 'Confirm delete' : 'Delete selected'}
          </button>
        </section>
      ) : null}

      {loading ? <p className="status">Loading documents...</p> : null}

      {!loading && folders.length === 0 && documents.length === 0 ? (
        <section className="empty-state" aria-label="No documents">
          <FileText size={38} aria-hidden="true" />
          <h2>{currentFolder ? 'This folder is empty' : 'No documents yet'}</h2>
          <p>Paste Markdown into Hallga and it will stay in this browser.</p>
        </section>
      ) : null}

      <ul className="document-list" aria-label="Saved folders and documents">
        {folders.map((folder) => (
          <li className={folder.pinned ? 'document-row folder-row pinned' : 'document-row folder-row'} key={`folder-${folder.id}`}>
            <Link className="document-link" to={`/?folder=${folder.id}`}>
              <span className="folder-title">
                <Folder size={19} aria-hidden="true" />
                <span className="document-title">{folder.name}</span>
              </span>
              <span className="document-meta">
                {folder.pinned ? 'Pinned · ' : ''}
                {formatter.format(folder.createdAt)}
              </span>
            </Link>
            <div className="row-actions">
              {folder.parentId !== undefined ? (
                <select
                  aria-label="Move subfolder"
                  value={folder.parentId ?? ''}
                  onChange={(event) => refresh(moveFolder(folder.id!, event.target.value ? Number(event.target.value) : undefined))}
                >
                  <option value="">Main space</option>
                  {topLevelFolders
                    .filter((targetFolder) => targetFolder.id !== folder.id)
                    .map((targetFolder) => (
                      <option key={targetFolder.id} value={targetFolder.id}>
                        {targetFolder.name}
                      </option>
                    ))}
                </select>
              ) : null}
              <button className="text-button" type="button" onClick={() => handleRenameFolder(folder)}>
                Rename
              </button>
              <button
                className="icon-button subtle"
                type="button"
                onClick={() => refresh(toggleFolderPinned(folder.id!, !folder.pinned))}
                aria-label={folder.pinned ? 'Unpin folder' : 'Pin folder'}
                title={folder.pinned ? 'Unpin folder' : 'Pin folder'}
              >
                {folder.pinned ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}
              </button>
              <button
                className={pendingFolderDeleteId === folder.id ? 'danger-button confirm compact' : 'icon-button danger'}
                type="button"
                onClick={() =>
                  pendingFolderDeleteId === folder.id
                    ? refresh(deleteFolder(folder.id!)).then(() => setPendingFolderDeleteId(null))
                    : setPendingFolderDeleteId(folder.id!)
                }
                aria-label="Delete folder"
                title="Delete folder"
              >
                {pendingFolderDeleteId === folder.id ? 'Confirm' : <Trash2 size={18} aria-hidden="true" />}
              </button>
            </div>
          </li>
        ))}

        {documents.map((document) => (
          <li className={document.pinned ? 'document-row pinned' : 'document-row'} key={document.id}>
            <button
              className="select-button"
              type="button"
              onClick={() => toggleSelected(document.id!)}
              aria-label={selectedIds.includes(document.id!) ? 'Deselect document' : 'Select document'}
              title={selectedIds.includes(document.id!) ? 'Deselect document' : 'Select document'}
            >
              {selectedIds.includes(document.id!) ? <CheckSquare size={20} aria-hidden="true" /> : <Square size={20} aria-hidden="true" />}
            </button>
            <Link className="document-link" to={`/document/${document.id}`}>
              <span className="document-title">{document.title}</span>
              <span className="document-meta">
                {document.pinned ? 'Pinned · ' : ''}
                {formatter.format(document.createdAt)}
              </span>
            </Link>
            <div className="row-actions">
              <select
                aria-label="Move document"
                value={document.folderId ?? ''}
                onChange={(event) => refresh(moveDocuments([document.id!], event.target.value ? Number(event.target.value) : undefined))}
              >
                <option value="">Main space</option>
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folderLabel(folder, allFolders)}
                  </option>
                ))}
              </select>
              <button
                className="icon-button subtle"
                type="button"
                onClick={() => refresh(togglePinned(document.id!, !document.pinned))}
                aria-label={document.pinned ? 'Unpin document' : 'Pin document'}
                title={document.pinned ? 'Unpin document' : 'Pin document'}
              >
                {document.pinned ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}
              </button>
              <button
                className={pendingDeleteId === document.id ? 'danger-button confirm compact' : 'icon-button danger'}
                type="button"
                onClick={() =>
                  pendingDeleteId === document.id
                    ? refresh(deleteDocument(document.id!)).then(() => setPendingDeleteId(null))
                    : setPendingDeleteId(document.id!)
                }
                aria-label="Delete document"
                title="Delete document"
              >
                {pendingDeleteId === document.id ? 'Confirm' : <Trash2 size={18} aria-hidden="true" />}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function folderSort(a: HallgaFolder, b: HallgaFolder) {
  if (a.parentId !== b.parentId) {
    return (a.parentId ?? 0) - (b.parentId ?? 0);
  }

  return a.name.localeCompare(b.name);
}

function folderLabel(folder: HallgaFolder, folders: HallgaFolder[]) {
  const parent = folder.parentId ? folders.find((candidate) => candidate.id === folder.parentId) : undefined;
  return parent ? `${parent.name} / ${folder.name}` : folder.name;
}
