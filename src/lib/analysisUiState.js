const STORAGE_PREFIX = 'ko_analysis_ui';
const PRESET_STORAGE_PREFIX = 'ko_analysis_presets';
const STORAGE_VERSION = 1;

function storageKey(panel, scope) {
  return `${STORAGE_PREFIX}:${panel}:${scope || 'local'}`;
}

function presetStorageKey(panel, scope) {
  return `${PRESET_STORAGE_PREFIX}:${panel}:${scope || 'local'}`;
}

function readStoredState(rawValue) {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION) {
      return parsed.state && typeof parsed.state === 'object' ? parsed.state : null;
    }
    return parsed.state && typeof parsed.state === 'object' ? parsed.state : null;
  } catch {
    return null;
  }
}

export function loadAnalysisUiState(panel, scope, defaults = {}) {
  if (typeof localStorage === 'undefined') {
    return { ...defaults };
  }

  try {
    const stored = readStoredState(localStorage.getItem(storageKey(panel, scope)));
    return stored ? { ...defaults, ...stored } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function saveAnalysisUiState(panel, scope, state = {}) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(storageKey(panel, scope), JSON.stringify({
      version: STORAGE_VERSION,
      state,
    }));
  } catch {
    // Ignore storage failures; the UI should keep working without persistence.
  }
}

export function clearAnalysisUiState(panel, scope) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(storageKey(panel, scope));
  } catch {
    // Ignore storage failures.
  }
}

function readStoredPresets(rawValue) {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue);
    const presets = parsed?.presets && typeof parsed.presets === 'object' ? parsed.presets : parsed;
    if (!presets || typeof presets !== 'object' || Array.isArray(presets)) return {};
    return Object.fromEntries(
      Object.entries(presets).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value)),
    );
  } catch {
    return {};
  }
}

export function loadAnalysisPresets(panel, scope) {
  if (typeof localStorage === 'undefined') return {};

  try {
    return readStoredPresets(localStorage.getItem(presetStorageKey(panel, scope)));
  } catch {
    return {};
  }
}

export function saveAnalysisPreset(panel, scope, name, state = {}) {
  if (typeof localStorage === 'undefined') return;
  const key = String(name || '').trim();
  if (!key) return;

  try {
    const presets = loadAnalysisPresets(panel, scope);
    presets[key] = state && typeof state === 'object' ? { ...state } : {};
    localStorage.setItem(presetStorageKey(panel, scope), JSON.stringify({
      version: STORAGE_VERSION,
      presets,
    }));
  } catch {
    // Ignore storage failures; presets are a convenience only.
  }
}

export function loadAnalysisPreset(panel, scope, name) {
  const key = String(name || '').trim();
  if (!key) return null;
  const preset = loadAnalysisPresets(panel, scope)[key];
  return preset && typeof preset === 'object' ? { ...preset } : null;
}
