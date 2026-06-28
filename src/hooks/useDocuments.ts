import { useEffect, useState } from 'react';
import { listDocuments } from '../db';
import type { HallgaDocument } from '../types';

type DocumentsState = {
  documents: HallgaDocument[];
  loading: boolean;
};

export function useDocuments(refreshKey = 0) {
  const [state, setState] = useState<DocumentsState>({
    documents: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      const documents = await listDocuments();

      if (!cancelled) {
        setState({ documents, loading: false });
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return state;
}
