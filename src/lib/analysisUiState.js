const STORAGE_PREFIX = 'ko_analysis_ui';
const STORAGE_VERSION = 1;

function storageKey(panel, scope) {
  return `${STORAGE_PREFIX}:${panel}:${scope || 'local'}`;
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
