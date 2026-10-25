import type { Review } from "../types";

export interface PreviousRun {
  run: number;
  reviews: Review[];
}

export interface SplitRuns {
  /** Reviews de la run actual: las únicas que cuentan para el estado y los hallazgos. */
  current: Review[];
  /** Reviews de runs anteriores (un reintento las conserva), la más reciente primero. */
  previous: PreviousRun[];
}

/** Una review sin `run` es de la run 1, como el valor por defecto del backend. */
const runOf = (review: Review) => review.run ?? 1;

export function splitRuns(reviews: readonly Review[], currentRun: number | undefined): SplitRuns {
  const run = currentRun ?? 1;
  const earlier = new Map<number, Review[]>();
  const current: Review[] = [];
  for (const review of reviews) {
    if (runOf(review) === run) {
      current.push(review);
    } else {
      earlier.set(runOf(review), [...(earlier.get(runOf(review)) ?? []), review]);
    }
  }
  const previous = [...earlier]
    .map(([n, items]) => ({ run: n, reviews: items }))
    .sort((a, b) => b.run - a.run);
  return { current, previous };
}
