import { describe, it, expect } from 'vitest';
import { normalizeScores } from './normalize-scores.js';

describe('normalizeScores', () => {
  it('should return an empty array if input is an empty array', () => {
    const result = normalizeScores([]);
    expect(result).toEqual([]);
  });

  it('should handle all scores less than 1', () => {
    const result = normalizeScores([0.5, 0.2, 0.8]);
    expect(result).toEqual([0.3333333333333333, 0.13333333333333336, 0.5333333333333334]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle all scores equal to 1', () => {
    const result = normalizeScores([1, 1, 1]);
    expect(result).toEqual([1/3, 1/3, 1/3]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle all scores greater than 1', () => {
    const result = normalizeScores([2, 3, 4]);
    expect(result).toEqual([2/9, 3/9, 4/9]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle mixed scores', () => {
    const result = normalizeScores([0.5, 1.5, 2.0, 1.2]);
    expect(result).toEqual([0.35616438356164387, 0.20547945205479454, 0.273972602739726, 0.1643835616438356]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle scores with a single score greater than 1', () => {
    const result = normalizeScores([0.5, 0.2, 1.5]);
    expect(result).toEqual([0.3618421052631579, 0.14473684210526316, 0.4934210526315789]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle scores with a single score equal to 1', () => {
    const result = normalizeScores([0.5, 0.2, 1]);
    expect(result).toEqual([0.3881278538812785, 0.15525114155251143, 0.4566210045662101]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle scores with a single score less than 1', () => {
    const result = normalizeScores([0.5, 1.5, 1.2, 0.8]);
    expect(result).toEqual([0.25316455696202533, 0.18987341772151903, 0.1518987341772152, 0.4050632911392406]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle scores with all identical scores greater than 1', () => {
    const result = normalizeScores([2, 2, 2]);
    expect(result).toEqual([2/6, 1/3, 1/3]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle scores with all identical scores less than 1', () => {
    const result = normalizeScores([0.5, 0.4, 0.1]);
    expect(result).toEqual([0.5, 0.4, 0.1]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle scores with all identical scores equal to 1', () => {
    const result = normalizeScores([1, 1, 1]);
    expect(result).toEqual([1/3, 1/3, 1/3]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });

  it('should handle scores with a mix of very large and very small numbers', () => {
    const result = normalizeScores([0.01, 1000, 1.5]);
    expect(result).toEqual([0.009901087981780994, 0.9886159880361648, 0.001482923982054247]);
    expect(result.reduce((sum, score) => sum + score, 0)).toBeCloseTo(1);
  });
});