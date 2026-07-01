import { ArrowLeft, Edit3, Save } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { db, updateDocument } from '../db';
import type { HallgaDocument } from '../types';

type TocItem = {
  id: string;
  level: number;
  title: string;
};

function slugifyHeading(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[`~!@#$%^&*()+=[\]{}|\\:;"'<>,.?/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'chapter';
}

function makeUniqueHeadingId(title: string, usedIds: Map<string, number>) {
  const baseId = slugifyHeading(title);
  const previousCount = usedIds.get(baseId) ?? 0;
  usedIds.set(baseId, previousCount + 1);

  return previousCount === 0 ? baseId : `${baseId}-${previousCount + 1}`;
}

function extractHeadings(markdown: string): TocItem[] {
  const usedIds = new Map<string, number>();
  const headings: TocItem[] = [];
  let isInFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      isInFence = !isInFence;
      continue;
    }

    if (isInFence) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);

    if (!match) {
      continue;
    }

    const title = match[2].trim();

    if (!title) {
      continue;
    }

    headings.push({
      id: makeUniqueHeadingId(title, usedIds),
      level: match[1].length,
      title,
    });
  }

  return headings;
}

function getNodeText(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(getNodeText).join('');
  }

  if (children && typeof children === 'object' && 'props' in children) {
    return getNodeText(children.props.children);
  }

  return '';
}

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

  const tocItems = extractHeadings(document.content);
  const headingRenderCounts = new Map<string, number>();
  const markdownComponents = {
    h1: ({ children, ...props }: { children?: ReactNode }) => {
      const title = getNodeText(children);
      const id = makeUniqueHeadingId(title, headingRenderCounts);

      return <h1 id={id} {...props}>{children}</h1>;
    },
    h2: ({ children, ...props }: { children?: ReactNode }) => {
      const title = getNodeText(children);
      const id = makeUniqueHeadingId(title, headingRenderCounts);

      return <h2 id={id} {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }: { children?: ReactNode }) => {
      const title = getNodeText(children);
      const id = makeUniqueHeadingId(title, headingRenderCounts);

      return <h3 id={id} {...props}>{children}</h3>;
    },
    h4: ({ children, ...props }: { children?: ReactNode }) => {
      const title = getNodeText(children);
      const id = makeUniqueHeadingId(title, headingRenderCounts);

      return <h4 id={id} {...props}>{children}</h4>;
    },
    h5: ({ children, ...props }: { children?: ReactNode }) => {
      const title = getNodeText(children);
      const id = makeUniqueHeadingId(title, headingRenderCounts);

      return <h5 id={id} {...props}>{children}</h5>;
    },
    h6: ({ children, ...props }: { children?: ReactNode }) => {
      const title = getNodeText(children);
      const id = makeUniqueHeadingId(title, headingRenderCounts);

      return <h6 id={id} {...props}>{children}</h6>;
    },
  };

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
        <div className="reader-layout">
          {tocItems.length > 0 ? (
            <nav className="reader-toc" aria-label="Table of contents">
              <div className="toc-title toc-title-desktop">Contents</div>
              <ol className="toc-list toc-list-desktop">
                {tocItems.map((item) => (
                  <li key={item.id} className={`toc-item toc-level-${item.level}`}>
                    <a href={`#${item.id}`}>{item.title}</a>
                  </li>
                ))}
              </ol>
              <details className="toc-mobile">
                <summary>Contents</summary>
                <ol className="toc-list">
                  {tocItems.map((item) => (
                    <li key={item.id} className={`toc-item toc-level-${item.level}`}>
                      <a href={`#${item.id}`}>{item.title}</a>
                    </li>
                  ))}
                </ol>
              </details>
            </nav>
          ) : null}
          <article className="reader-content" aria-labelledby="document-title">
            <h1 id="document-title">{document.title}</h1>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {document.content}
            </ReactMarkdown>
          </article>
        </div>
      )}
    </main>
  );
}
