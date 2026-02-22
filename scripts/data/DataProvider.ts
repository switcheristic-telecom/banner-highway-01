import type { BannerAsset, RawSceneData, SceneData } from '@/constants/types';
import { applyDefaults } from '@/constants/defaults';

const generatedModules = import.meta.glob<{ default: RawSceneData }>(
  '../../generated/data.json',
  { eager: true }
);

export async function loadSceneData(): Promise<SceneData> {
  let raw: RawSceneData;

  if (import.meta.env.DEV) {
    const res = await fetch('/api/data');
    if (!res.ok) {
      throw new Error(
        `Failed to fetch scene data from /api/data (${res.status}). ` +
          'Is the editor server running? Start it with: bun run editor'
      );
    }
    raw = await res.json();
  } else {
    const mod = Object.values(generatedModules)[0];
    if (!mod) {
      throw new Error(
        'generated/data.json not found. Run: bun run extract'
      );
    }
    raw = mod.default;
  }

  const assetMap = new Map<string, BannerAsset>();
  for (const a of raw.assets ?? []) {
    assetMap.set(a.id, a);
  }

  return {
    highway: raw.highway,
    banners: raw.banners.map(b => applyDefaults(b, assetMap)),
  };
}
