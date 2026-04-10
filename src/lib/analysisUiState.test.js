import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAnalysisUiState,
  loadAnalysisUiState,
  saveAnalysisUiState,
} from './analysisUiState.js';

describe('analysisUiState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveAnalysisUiState / loadAnalysisUiState round-trip', () => {
    it('persists and restores a state object', () => {
      saveAnalysisUiState('possession', 'test', { viewMode: 'heat', selectedHalf: 'first' });
      const result = loadAnalysisUiState('possession', 'test', {});
      expect(result).toEqual({ viewMode: 'heat', selectedHalf: 'first' });
    });

    it('merges stored state on top of defaults', () => {
      saveAnalysisUiState('possession', 'test', { viewMode: 'heat' });
      const result = loadAnalysisUiState('possession', 'test', {
        viewMode: 'dots',
        showPressureOnly: false,
        legendOpen: true,
      });
      expect(result).toEqual({
        viewMode: 'heat',
        showPressureOnly: false,
        legendOpen: true,
      });
    });

    it('returns defaults when nothing has been saved', () => {
      const result = loadAnalysisUiState('possession', 'test', { viewMode: 'dots', legendOpen: false });
      expect(result).toEqual({ viewMode: 'dots', legendOpen: false });
    });

    it('scopes keys by panel and scope so they do not collide', () => {
      saveAnalysisUiState('possession', 'test', { viewMode: 'heat' });
      saveAnalysisUiState('pass', 'test', { viewMode: 'dots' });
      saveAnalysisUiState('possession', 'other', { viewMode: 'trend' });

      expect(loadAnalysisUiState('possession', 'test', {}).viewMode).toBe('heat');
      expect(loadAnalysisUiState('pass', 'test', {}).viewMode).toBe('dots');
      expect(loadAnalysisUiState('possession', 'other', {}).viewMode).toBe('trend');
    });

    it('uses "local" as the default scope when none is provided', () => {
      saveAnalysisUiState('possession', null, { viewMode: 'heat' });
      expect(loadAnalysisUiState('possession', null, {}).viewMode).toBe('heat');
      expect(loadAnalysisUiState('possession', undefined, {}).viewMode).toBe('heat');
    });
  });

  describe('loadAnalysisUiState error recovery', () => {
    it('returns defaults when the stored value is corrupt JSON', () => {
      localStorage.setItem('ko_analysis_ui:possession:test', 'not-valid-json{{');
      const result = loadAnalysisUiState('possession', 'test', { viewMode: 'dots' });
      expect(result).toEqual({ viewMode: 'dots' });
    });

    it('returns defaults when the stored value is null or missing', () => {
      localStorage.setItem('ko_analysis_ui:possession:test', 'null');
      expect(loadAnalysisUiState('possession', 'test', { viewMode: 'dots' })).toEqual({ viewMode: 'dots' });
    });

    it('returns defaults when the stored state value is not an object', () => {
      localStorage.setItem(
        'ko_analysis_ui:possession:test',
        JSON.stringify({ version: 1, state: 'a string' }),
      );
      const result = loadAnalysisUiState('possession', 'test', { viewMode: 'dots' });
      expect(result).toEqual({ viewMode: 'dots' });
    });

    it('still returns stored state on a version mismatch', () => {
      localStorage.setItem(
        'ko_analysis_ui:possession:test',
        JSON.stringify({ version: 99, state: { viewMode: 'heat' } }),
      );
      const result = loadAnalysisUiState('possession', 'test', { viewMode: 'dots' });
      expect(result.viewMode).toBe('heat');
    });
  });

  describe('clearAnalysisUiState', () => {
    it('removes the stored entry so subsequent loads return defaults', () => {
      saveAnalysisUiState('possession', 'test', { viewMode: 'heat' });
      clearAnalysisUiState('possession', 'test');
      expect(loadAnalysisUiState('possession', 'test', { viewMode: 'dots' })).toEqual({ viewMode: 'dots' });
    });

    it('does not affect other panel/scope combinations', () => {
      saveAnalysisUiState('possession', 'test', { viewMode: 'heat' });
      saveAnalysisUiState('pass', 'test', { viewMode: 'dots' });
      clearAnalysisUiState('possession', 'test');
      expect(loadAnalysisUiState('pass', 'test', {}).viewMode).toBe('dots');
    });

    it('is a no-op when nothing was stored', () => {
      expect(() => clearAnalysisUiState('possession', 'missing')).not.toThrow();
    });
  });
});
