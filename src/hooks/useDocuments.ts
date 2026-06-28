import { useEffect, useState } from 'react';
import { listDocuments, listFolders } from '../db';
import type { HallgaDocument, HallgaFolder } from '../types';

type DocumentsState = {
  documents: HallgaDocument[];
  folders: HallgaFolder[];
  loading: boolean;
};

export function useDocuments(refreshKey = 0, folderId?: number) {
  const [state, setState] = useState<DocumentsState>({
    documents: [],
    folders: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      const [documents, folders] = await Promise.all([listDocuments(folderId), listFolders(folderId)]);

      if (!cancelled) {
        setState({ documents, folders, loading: false });
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [folderId, refreshKey]);

  return state;
}
