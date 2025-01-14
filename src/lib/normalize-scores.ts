/**
 * Normalizes an array of score weights such that the sum of the resulting scores is 1.
 * The input weights can be either relative weights (greater than or equal to 1) or percentage weights (less than 1).
 *
 * @param scoreWeights - An array of numbers representing the score weights to be normalized.
 *                     Each weight can be a relative weight (greater than or equal to 1) or a percentage weight (less than 1).
 * @returns An array of numbers where each weight is normalized such that their sum equals 1.
 *
 * @example
 * ```typescript
 * const weights = [0.5, 1.5, 2.0, 1.2];
 * const normalizedWeights = normalizeScores(weights);
 * console.log(normalizedWeights); // Output: [0.35616438356164387, 0.20547945205479454, 0.273972602739726, 0.1643835616438356]
 * ```
 */
export function normalizeScores(scoreWeights: number[]) {
  if (!scoreWeights || scoreWeights.length === 0) {
    return scoreWeights;
  }

  // const relativeScores = scores.filter(score => score >= 1);

  // const maxRelativeScore = relativeScores.length > 0 ? Math.max(...relativeScores) : 1;
  let totalScore = scoreWeights.reduce((sum, score) => sum + score, 0) || 1;

  let _totalScore = 0;
  scoreWeights = scoreWeights.map(score => {
    score = score < 1 ? score * totalScore : score
    _totalScore += score;
    return score;
  });

  const adjustedScores = scoreWeights.map(score => (
    score / _totalScore
  ));

  totalScore = adjustedScores.reduce((sum, score) => sum + score, 0);

  const result = adjustedScores.map(score => score / totalScore);

  return result;
}
