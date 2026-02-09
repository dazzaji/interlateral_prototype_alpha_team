import type { SkinEntry, SkinModule } from './types';

// Auto-discover all skin modules using Vite's import.meta.glob
// This is the PLUGIN ARCHITECTURE (Obj 2.7): New .tsx files are automatically found
const skinModules = import.meta.glob<SkinModule>('./*Skin.tsx', { eager: true });

// Build skin registry from discovered modules
const skins: SkinEntry[] = [];

for (const path in skinModules) {
  const module = skinModules[path];

  if (module.default && module.meta) {
    skins.push({
      id: module.meta.id,
      name: module.meta.name,
      description: module.meta.description,
      icon: module.meta.icon,
      Component: module.default,
    });
  } else {
    console.warn(`[Skins] Invalid skin module: ${path} (missing default export or meta)`);
  }
}

// Sort skins by name for consistent ordering
skins.sort((a, b) => a.name.localeCompare(b.name));

console.log(`[Skins] Discovered ${skins.length} skins:`, skins.map(s => s.id));

export { skins };

// Get skin by ID
export function getSkinById(id: string): SkinEntry | undefined {
  return skins.find(s => s.id === id);
}

// Get default skin (first one, or fallback)
export function getDefaultSkin(): SkinEntry | undefined {
  return skins[0];
}

// Check if a skin exists
export function skinExists(id: string): boolean {
  return skins.some(s => s.id === id);
}

export type { SkinEntry, SkinModule } from './types';
