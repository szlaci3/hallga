export type HallgaDocument = {
  id?: number;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  pinnedAt?: number;
  folderId?: number;
};

export type HallgaFolder = {
  id?: number;
  name: string;
  parentId?: number;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  pinnedAt?: number;
};
