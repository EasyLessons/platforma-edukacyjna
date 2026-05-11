import { DrawingElement } from './elements';

export interface SavedAsset {
  id: number;
  name: string;
  elements_data: DrawingElement[];
  thumbnail: string | null;
  created_at: string;
}

export interface SavedAssetCreate {
  name: string;
  elements_data: DrawingElement[];
  thumbnail: string | null;
}
