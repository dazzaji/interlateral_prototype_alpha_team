import { skins, getSkinById, getDefaultSkin, skinExists } from '../skins';
import type { SkinEntry } from '../skins/types';

interface SkinSelectorProps {
  currentSkinId: string;
  onSkinChange: (skinId: string) => void;
}

const STORAGE_KEY = 'comms-monitor-skin';

// Load saved skin from localStorage
export function loadSavedSkin(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && skinExists(saved)) {
      return saved;
    }
  } catch (e) {
    console.warn('[SkinSelector] Failed to load saved skin:', e);
  }

  const defaultSkin = getDefaultSkin();
  return defaultSkin?.id || 'cockpit';
}

// Save skin to localStorage
export function saveSkin(skinId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, skinId);
  } catch (e) {
    console.warn('[SkinSelector] Failed to save skin:', e);
  }
}

function SkinSelector({ currentSkinId, onSkinChange }: SkinSelectorProps) {
  const currentSkin = getSkinById(currentSkinId);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSkinId = e.target.value;
    saveSkin(newSkinId);
    onSkinChange(newSkinId);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={{ fontSize: '13px', color: '#888' }}>
        Skin:
      </label>
      <select
        value={currentSkinId}
        onChange={handleChange}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          border: '1px solid #333',
          background: '#1a1a2e',
          color: '#eee',
          fontSize: '13px',
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        {skins.map((skin: SkinEntry) => (
          <option key={skin.id} value={skin.id}>
            {skin.icon} {skin.name}
          </option>
        ))}
      </select>
      {currentSkin && (
        <span style={{ fontSize: '12px', color: '#666' }}>
          {currentSkin.description}
        </span>
      )}
    </div>
  );
}

export default SkinSelector;
