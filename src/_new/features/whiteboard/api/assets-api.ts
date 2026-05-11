import { apiClient } from '@/_new/lib/api/client';
import { SavedAsset, SavedAssetCreate } from '../types/assets';

export async function fetchUserAssets(): Promise<SavedAsset[]> {
  const res = await apiClient.get<SavedAsset[]>('/api/v1/assets/');
  return res.data;
}

export async function saveUserAsset(data: SavedAssetCreate): Promise<SavedAsset> {
  const res = await apiClient.post<SavedAsset>('/api/v1/assets/', data);
  return res.data;
}

export async function deleteUserAsset(assetId: number): Promise<void> {
  await apiClient.delete(`/api/v1/assets/${assetId}`);
}
