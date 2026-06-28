import { ArrowLeft, Edit3, Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { db, updateDocument } from '../db';
import type { HallgaDocument } from '../types';

export function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const documentId = Number(id);
  const [document, setDocument] = useState<HallgaDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      if (!Number.isFinite(documentId)) {
        navigate('/');
        return;
      }

      const result = await db.documents.get(documentId);

      if (!cancelled) {
        setDocument(result ?? null);
        setDraft(result?.content ?? '');
        setLoading(false);
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
    };
  }, [documentId, navigate]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!document?.id || !draft.trim()) {
      return;
    }

    await updateDocument(document.id, draft);
    const updated = await db.documents.get(document.id);
    setDocument(updated ?? null);
    setDraft(updated?.content ?? '');
    setIsEditing(false);
  }

  if (loading) {
    return <main className="page"><p className="status">Loading document...</p></main>;
  }

  if (!document) {
    return (
      <main className="page not-found">
        <Link className="icon-button" to="/" aria-label="Go to document list" title="Go to document list">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1>Document not found</h1>
      </main>
    );
  }

  return (
    <main className="page reader-page">
      <header className="reader-header">
        <Link className="icon-button" to="/" aria-label="Go to document list" title="Go to document list">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        {!isEditing ? (
          <button
            className="icon-button"
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label="Edit document"
            title="Edit document"
          >
            <Edit3 size={20} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {isEditing ? (
        <form className="editor-form" onSubmit={handleSave}>
          <div className="editor-actions">
            <button className="save-button" type="submit" disabled={!draft.trim()}>
              <Save size={18} aria-hidden="true" />
              Save
            </button>
          </div>
          <textarea
            className="markdown-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck="true"
            aria-label="Markdown document content"
          />
        </form>
      ) : (
        <article className="reader-content" aria-labelledby="document-title">
          <h1 id="document-title">{document.title}</h1>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{document.content}</ReactMarkdown>
        </article>
      )}
    </main>
  );
}
