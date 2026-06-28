import { FileText, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { deleteDocument, togglePinned } from '../db';
import { useDocuments } from '../hooks/useDocuments';
import { useState } from 'react';

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { documents, loading } = useDocuments(refreshKey);

  async function refresh(action: Promise<unknown>) {
    await action;
    setRefreshKey((key) => key + 1);
  }

  return (
    <main className="page page-list" aria-labelledby="hallga-title">
      <header className="topbar">
        <div>
          <p className="eyebrow">Hallga</p>
          <h1 id="hallga-title">Documents</h1>
        </div>
        <Link className="icon-button create-button" to="/new" aria-label="Create document" title="Create document">
          <Plus size={22} aria-hidden="true" />
        </Link>
      </header>

      {loading ? <p className="status">Loading documents...</p> : null}

      {!loading && documents.length === 0 ? (
        <section className="empty-state" aria-label="No documents">
          <FileText size={38} aria-hidden="true" />
          <h2>No documents yet</h2>
          <p>Paste Markdown into Hallga and it will stay in this browser.</p>
        </section>
      ) : null}

      <ul className="document-list" aria-label="Saved documents">
        {documents.map((document) => (
          <li className={document.pinned ? 'document-row pinned' : 'document-row'} key={document.id}>
            <Link className="document-link" to={`/document/${document.id}`}>
              <span className="document-title">{document.title}</span>
              <span className="document-meta">
                {document.pinned ? 'Pinned · ' : ''}
                {formatter.format(document.createdAt)}
              </span>
            </Link>
            <div className="row-actions">
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
                className="icon-button danger"
                type="button"
                onClick={() => refresh(deleteDocument(document.id!))}
                aria-label="Delete document"
                title="Delete document"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
