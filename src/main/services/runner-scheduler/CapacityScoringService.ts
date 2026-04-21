import type { RunnerNode, RunnerScoreBreakdown } from '@shared/types';

export class CapacityScoringService {
  score(runner: RunnerNode): RunnerScoreBreakdown {
    const reasons: string[] = [];
    const normalizedCpuUsage = this.clamp01(runner.cpuUsage);
    const normalizedMemoryUsage = this.clamp01(runner.memoryUsage);
    const normalizedFailureRate = this.clamp01(runner.recentFailureRate);
    const normalizedLatencyMs = this.normalizeNonNegative(runner.heartbeatLatencyMs);
    const normalizedRunningCount = this.normalizeNonNegative(runner.runningCount);
    const normalizedMaxConcurrency = this.normalizePositive(runner.maxConcurrency);
    const hasInvalidConcurrency = normalizedMaxConcurrency <= 0;

    const filtered = this.isFiltered(
      runner,
      normalizedRunningCount,
      normalizedMaxConcurrency,
      hasInvalidConcurrency,
      reasons,
    );

    const capacityScore =
      normalizedMaxConcurrency <= 0
        ? 1
        : normalizedRunningCount / normalizedMaxConcurrency;
    const resourceScore = Math.max(normalizedCpuUsage, normalizedMemoryUsage);
    const latencyScore = Math.min(normalizedLatencyMs / 5000, 1);
    const failureScore = normalizedFailureRate;
    const statusPenalty = this.statusPenalty(runner.status);
    const score = filtered
      ? 999
      : capacityScore * 0.4 + resourceScore * 0.25 + latencyScore * 0.15 + failureScore * 0.2 + statusPenalty;

    if (!filtered) {
      reasons.push('schedulable');
      reasons.push(`load:${normalizedRunningCount}/${normalizedMaxConcurrency}=${capacityScore.toFixed(3)}`);
      reasons.push(
        `resource:cpu=${normalizedCpuUsage.toFixed(3)},memory=${normalizedMemoryUsage.toFixed(3)},max=${resourceScore.toFixed(3)}`,
      );
      reasons.push(`latency:${normalizedLatencyMs}ms=>${latencyScore.toFixed(3)}`);
      reasons.push(`failure:${failureScore.toFixed(3)}`);
      if (statusPenalty > 0) {
        reasons.push(`status-penalty:${statusPenalty.toFixed(3)}`);
      }
    }

    return {
      runnerId: runner.id,
      score,
      capacityScore,
      resourceScore,
      latencyScore,
      failureScore,
      statusPenalty,
      filtered,
      reasons,
    };
  }

  selectBest(runners: RunnerNode[]): { runner: RunnerNode | null; breakdowns: RunnerScoreBreakdown[] } {
    const breakdowns = runners.map((runner) => this.score(runner));
    const candidates = runners
      .map((runner, index) => ({ runner, breakdown: breakdowns[index] }))
      .filter(({ breakdown }) => !breakdown.filtered)
      .sort((left, right) => left.breakdown.score - right.breakdown.score);
    return { runner: candidates[0]?.runner ?? null, breakdowns };
  }

  private isFiltered(
    runner: RunnerNode,
    runningCount: number,
    maxConcurrency: number,
    hasInvalidConcurrency: boolean,
    reasons: string[],
  ): boolean {
    if (runner.status === 'offline' || runner.status === 'draining') {
      reasons.push(`status:${runner.status}`);
      return true;
    }
    if (hasInvalidConcurrency) {
      reasons.push('capacity:invalid');
      reasons.push('capacity:full');
      return true;
    }
    if (runningCount >= maxConcurrency) {
      reasons.push('capacity:full');
      return true;
    }
    return false;
  }

  private statusPenalty(status: RunnerNode['status']): number {
    if (status === 'degraded') return 0.5;
    if (status === 'offline' || status === 'draining') return 999;
    return 0;
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  private normalizeNonNegative(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    return value;
  }

  private normalizePositive(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    return value;
  }
}
