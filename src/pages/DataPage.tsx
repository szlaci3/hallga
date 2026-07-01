import { ArrowLeft, Combine, Download, Upload } from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { exportDatabase, mergeDatabaseBackup, replaceDatabase } from '../db';

type ImportMode = 'replace' | 'merge';

export function DataPage() {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<ImportMode | 'export' | null>(null);
  const [status, setStatus] = useState('');

  async function handleExport() {
    setBusy('export');
    setStatus('');

    try {
      const backup = await exportDatabase();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `hallga-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${backup.documents.length} documents and ${backup.folders.length} folders.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>, mode: ImportMode) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (mode === 'replace' && !window.confirm('Replace current Hallga data with this backup?')) {
      return;
    }

    setBusy(mode);
    setStatus('');

    try {
      const backup = JSON.parse(await file.text());

      if (mode === 'replace') {
        await replaceDatabase(backup);
        setStatus('Imported backup and replaced current data.');
      } else {
        await mergeDatabaseBackup(backup);
        setStatus('Merged backup into current data.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="page data-page" aria-labelledby="data-title">
      <header className="topbar">
        <Link className="icon-button" to="/" aria-label="Go to document list" title="Go to document list">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <div className="topbar-title">
          <p className="eyebrow">Hallga</p>
          <h1 id="data-title">Data</h1>
        </div>
      </header>

      <section className="data-actions" aria-label="Database operations">
        <button className="data-action" type="button" onClick={handleExport} disabled={busy !== null}>
          <Download size={20} aria-hidden="true" />
          <span>Export database</span>
        </button>
        <button
          className="data-action danger-action"
          type="button"
          onClick={() => replaceInputRef.current?.click()}
          disabled={busy !== null}
          aria-label="Import database and replace current data"
        >
          <Upload size={20} aria-hidden="true" />
          <span>Import database</span>
          <small>Replace current data</small>
        </button>
        <button
          className="data-action"
          type="button"
          onClick={() => mergeInputRef.current?.click()}
          disabled={busy !== null}
          aria-label="Add existing database by merging another backup while preserving all current local data"
        >
          <Combine size={20} aria-hidden="true" />
          <span>Add existing database</span>
          <small>Preserve current data</small>
        </button>
      </section>

      <input
        ref={replaceInputRef}
        className="file-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => handleImport(event, 'replace')}
      />
      <input
        ref={mergeInputRef}
        className="file-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => handleImport(event, 'merge')}
      />

      {busy ? (
        <p className="status">Working...</p>
      ) : status ? (
        <p className="status" role="status">
          {status}
        </p>
      ) : null}
    </main>
  );
}
