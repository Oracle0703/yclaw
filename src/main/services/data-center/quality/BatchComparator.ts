import type { DataQualityBatchScore, DataQualityScoreTrendHint } from '@shared/types';

export class BatchComparator {
  compare(
    currentBatchScore: Pick<DataQualityBatchScore, 'score'>,
    previousBatchScore?: Pick<DataQualityBatchScore, 'score'> | null,
  ): DataQualityScoreTrendHint {
    if (!previousBatchScore) {
      return 'unknown';
    }
    if (currentBatchScore.score > previousBatchScore.score) {
      return 'up';
    }
    if (currentBatchScore.score < previousBatchScore.score) {
      return 'down';
    }
    return 'flat';
  }
}
