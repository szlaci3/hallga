import { ArrowLeft, Save } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createDocument } from '../db';

export function CreatePage() {
  const [content, setContent] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content.trim()) {
      return;
    }

    const id = await createDocument(content);
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
