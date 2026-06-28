import { ArrowLeft, Save } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createDocument, db } from '../db';
import type { HallgaFolder } from '../types';

export function CreatePage() {
  const [content, setContent] = useState('');
  const [folders, setFolders] = useState<HallgaFolder[]>([]);
  const [searchParams] = useSearchParams();
  const initialFolderId = searchParams.get('folder') ?? '';
  const [folderId, setFolderId] = useState(initialFolderId);
  const navigate = useNavigate();
  const folderOptions = useMemo(() => [...folders].sort(folderSort), [folders]);

  useEffect(() => {
    db.folders.toArray().then(setFolders);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content.trim()) {
      return;
    }

    const id = await createDocument(content, folderId ? Number(folderId) : undefined);
    navigate(`/document/${id}`);
  }

  return (
    <main className="page editor-page" aria-labelledby="create-title">
      <header className="topbar">
        <Link className="icon-button" to="/" aria-label="Go to document list" title="Go to document list">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <div className="topbar-title">
          <p className="eyebrow">New document</p>
          <h1 id="create-title">Paste Markdown</h1>
        </div>
      </header>

      <form className="editor-form" onSubmit={handleSubmit}>
        <div className="editor-actions">
          <select className="folder-picker" value={folderId} onChange={(event) => setFolderId(event.target.value)} aria-label="Document folder">
            <option value="">Main space</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folderLabel(folder, folders)}
              </option>
            ))}
          </select>
          <button className="save-button" type="submit" disabled={!content.trim()}>
            <Save size={18} aria-hidden="true" />
            Save
          </button>
        </div>
        <textarea
          className="markdown-input"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          spellCheck="true"
          placeholder="Paste Markdown here..."
          aria-label="Markdown document content"
        />
      </form>
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
