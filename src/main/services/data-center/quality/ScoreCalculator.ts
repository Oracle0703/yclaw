import type {
  DataQualityBatchScore,
  DataQualityFinding,
  DataQualityGrade,
  DataQualityResultScore,
} from '@shared/types';

export class ScoreCalculator {
  calculateResultScore(resultId: string, findings: DataQualityFinding[]): DataQualityResultScore {
    const deductions = findings
      .filter((finding) => finding.resultId === resultId)
      .map((finding) => ({
        ruleId: finding.ruleId,
        points: finding.scoreImpact,
      }));
    const score = clampScore(100 - deductions.reduce((sum, deduction) => sum + deduction.points, 0));

    return {
      resultId,
      score,
      grade: toGrade(score),
      deductions,
    };
  }

  calculateBatchScore(
    batchId: string,
    scores: Array<Pick<DataQualityResultScore, 'score'>>,
  ): DataQualityBatchScore {
    const score =
      scores.length === 0
        ? 100
        : clampScore(
            Math.round(scores.reduce((sum, current) => sum + current.score, 0) / scores.length),
          );

    return {
      batchId,
      score,
      grade: toGrade(score),
    };
  }
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function toGrade(score: number): DataQualityGrade {
  if (score >= 90) {
    return 'excellent';
  }
  if (score >= 80) {
    return 'good';
  }
  if (score >= 60) {
    return 'watch';
  }
  return 'poor';
}
