/**
 * SuperMemo-2 (SM-2) Spaced Repetition Algorithm
 * 
 * Calculates the next interval, ease factor, and repetitions count for a card.
 * 
 * @param {number} rating - User score from 0 to 5:
 *   5 - Perfect response; immediate recall.
 *   4 - Correct response after some hesitation.
 *   3 - Correct response recalled with serious difficulty.
 *   2 - Incorrect response; where the correct one seemed easy to recall.
 *   1 - Incorrect response; correct one remembered.
 *   0 - Complete blackout.
 * @param {number} currentInterval - Current interval in days.
 * @param {number} currentRepetitions - Current consecutive successful repetitions.
 * @param {number} currentEaseFactor - Current ease factor (multiplier).
 * @returns {object} The updated spaced repetition properties: { interval, repetitions, easeFactor, nextReviewDate }
 */
export function calculateSM2(rating, currentInterval = 0, currentRepetitions = 0, currentEaseFactor = 2.5) {
  // Constrain inputs
  let interval = currentInterval || 1;
  let repetitions = currentRepetitions || 0;
  let easeFactor = currentEaseFactor || 2.5;

  // Ensure rating is an integer between 0 and 5
  const q = Math.max(0, Math.min(5, Math.round(rating)));

  // Calculate new ease factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // Calculate new interval and repetitions
  if (q >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  } else {
    // Incorrect answers reset repetitions and start over at 1 day
    repetitions = 0;
    interval = 1;
  }

  // Calculate the next review date based on local time
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  
  // Format as YYYY-MM-DD
  const year = nextReviewDate.getFullYear();
  const month = String(nextReviewDate.getMonth() + 1).padStart(2, '0');
  const day = String(nextReviewDate.getDate()).padStart(2, '0');
  const nextReviewDateString = `${year}-${month}-${day}`;

  return {
    interval,
    repetitions,
    easeFactor: parseFloat(easeFactor.toFixed(2)),
    nextReviewDate: nextReviewDateString
  };
}
