import { Rating, State, WordProgress, ReviewLog, UserSettings } from '../types';

/**
 * FSRS (Free Spaced Repetition Scheduler) 核心算法实现
 * 基于 DSR (Difficulty, Stability, Retrievability) 认知记忆模型
 * 参考文献: Jarrett Ye, et al. Free Spaced Repetition Scheduler
 */

export interface FSRSParameters {
  w: number[];
  requestRetention: number;
  maximumInterval: number;
}

export const DEFAULT_FSRS_WEIGHTS: number[] = [
  0.4072, // w0: S0(Again)
  1.1829, // w1: S0(Hard)
  3.1262, // w2: S0(Good)
  15.4722, // w3: S0(Easy)
  7.2102, // w4: Initial D intercept
  0.5316, // w5: Initial D slope
  1.0651, // w6: Next D parameter
  0.0234, // w7: Mean reversion weight
  1.616,  // w8: Recall S factor
  0.1544, // w9: S power in recall
  1.0824, // w10: R power in recall
  1.9813, // w11: Forget S factor
  0.0953, // w12: D power in forget
  0.2975, // w13: S power in forget
  0.2207, // w14: R factor in forget
  0.2922, // w15: Hard bonus/penalty
  2.6107, // w16: Easy bonus
  0.2052, // w17: Short-term stability factor
  0.3012  // w18: Short-term difficulty factor
];

const DECAY = -0.5;
const FACTOR = 19 / 81; // = 0.2345679

export class FSRSScheduler {
  private params: FSRSParameters;

  constructor(requestRetention = 0.9, maximumInterval = 36500, weights = DEFAULT_FSRS_WEIGHTS) {
    this.params = {
      w: weights,
      requestRetention,
      maximumInterval,
    };
  }

  /**
   * 计算当前时刻的记忆留存率 (Retrievability R)
   * @param elapsedDays 距上次复习的天数
   * @param stability 记忆稳定性 (S)
   */
  public calculateRetrievability(elapsedDays: number, stability: number): number {
    if (stability <= 0) return 0;
    if (elapsedDays <= 0) return 1.0;
    return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
  }

  /**
   * 根据期望记忆留存率计算下一次复习间隔天数
   */
  public nextInterval(stability: number, desiredRetention = this.params.requestRetention): number {
    const interval = (stability / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
    const clampedInterval = Math.max(1, Math.round(interval));
    return Math.min(clampedInterval, this.params.maximumInterval);
  }

  /**
   * 新单词初始难度 D0(G)
   */
  private initDifficulty(rating: Rating): number {
    const w = this.params.w;
    const g = rating;
    const d = w[4] - Math.exp(w[5] * (g - 1)) + 1;
    return this.constrainDifficulty(d);
  }

  /**
   * 新单词初始稳定性 S0(G)
   */
  private initStability(rating: Rating): number {
    const w = this.params.w;
    return Math.max(0.1, w[rating - 1]);
  }

  /**
   * 限制难度在 1.0 ~ 10.0 区间
   */
  private constrainDifficulty(d: number): number {
    return Math.min(Math.max(Number(d.toFixed(2)), 1.0), 10.0);
  }

  /**
   * 计算复习后的新难度 D'(D, G)
   */
  private nextDifficulty(d: number, rating: Rating): number {
    const w = this.params.w;
    const d0Good = this.initDifficulty(Rating.Good);
    const deltaD = -w[6] * (rating - 3);
    const nextD = w[7] * d0Good + (1 - w[7]) * (d + deltaD);
    return this.constrainDifficulty(nextD);
  }

  /**
   * 回忆成功（Hard, Good, Easy）后的新稳定性
   */
  private nextRecallStability(d: number, s: number, r: number, rating: Rating): number {
    const w = this.params.w;
    const hardPenalty = rating === Rating.Hard ? w[15] : 1;
    const easyBonus = rating === Rating.Easy ? w[16] : 1;
    
    const factor = Math.exp(w[8]) *
      (11 - d) *
      Math.pow(s, -w[9]) *
      (Math.exp(w[10] * (1 - r)) - 1) *
      hardPenalty *
      easyBonus + 1;

    return Math.max(0.1, s * factor);
  }

  /**
   * 遗忘（Again）后的新稳定性
   */
  private nextForgetStability(d: number, s: number, r: number): number {
    const w = this.params.w;
    const nextS = w[11] *
      Math.pow(d, -w[12]) *
      (Math.pow(s + 1, w[13]) - 1) *
      Math.exp(w[14] * (1 - r));
    
    return Math.max(0.1, Math.min(s, nextS));
  }

  /**
   * 核心复习调度状态演进
   * 结合用户反应时长 (Latency) 实施自适应微调
   */
  public reviewCard(
    progress: WordProgress,
    rating: Rating,
    latencyMs: number,
    settings: UserSettings,
    mode: 'flashcard' | 'cloze' | 'spelling' | 'speed' = 'flashcard',
    now: number = Date.now()
  ): { nextProgress: WordProgress; log: ReviewLog } {
    const elapsedDays = progress.lastReview > 0 
      ? Math.max(0, (now - progress.lastReview) / (1000 * 60 * 60 * 24))
      : 0;
    
    const retrievability = progress.lastReview > 0 
      ? this.calculateRetrievability(elapsedDays, progress.stability)
      : 1.0;

    let nextD: number;
    let nextS: number;
    let nextState: State;

    // 认知神经学反应时间校正（Reaction Latency Penalty）
    // 若用户虽然点了 Good/Easy，但反应超过阈值（如 > 4.5秒），说明存在显著提取阻力，适当下调稳定性增长
    let effectiveRating = rating;
    if (settings.enableLatencyPenalty && latencyMs > settings.latencyThresholdMs) {
      if (rating === Rating.Easy) {
        effectiveRating = Rating.Good;
      } else if (rating === Rating.Good) {
        // 轻微衰减稳定性增幅
      }
    }

    if (progress.state === State.New) {
      // 首次学习
      nextD = this.initDifficulty(effectiveRating);
      nextS = this.initStability(effectiveRating);
      nextState = rating === Rating.Again ? State.Learning : State.Review;
    } else {
      // 后续复习
      nextD = this.nextDifficulty(progress.difficulty, effectiveRating);
      
      if (rating === Rating.Again) {
        nextS = this.nextForgetStability(progress.difficulty, progress.stability, retrievability);
        nextState = State.Relearning;
      } else {
        nextS = this.nextRecallStability(progress.difficulty, progress.stability, retrievability, effectiveRating);
        nextState = State.Review;
      }
    }

    // 若反应时间严重过长，给稳定性施加微幅摩擦阻尼
    if (settings.enableLatencyPenalty && latencyMs > settings.latencyThresholdMs && rating !== Rating.Again) {
      const delayRatio = Math.min(2.0, latencyMs / settings.latencyThresholdMs);
      const dampingFactor = 1.0 - (delayRatio - 1.0) * 0.15; // 降低 0%~15%
      nextS = Math.max(0.1, nextS * Math.max(0.7, dampingFactor));
    }

    const scheduledDays = rating === Rating.Again ? 0 : this.nextInterval(nextS, settings.desiredRetention);
    const nextReview = rating === Rating.Again 
      ? now + 10 * 60 * 1000 // 10分钟后重现（短时记忆工作流）
      : now + scheduledDays * 24 * 60 * 60 * 1000;

    const log: ReviewLog = {
      timestamp: now,
      rating,
      state: progress.state,
      due: nextReview,
      stability: nextS,
      difficulty: nextD,
      elapsedDays: Number(elapsedDays.toFixed(2)),
      scheduledDays,
      latencyMs,
      mode
    };

    const nextProgress: WordProgress = {
      ...progress,
      state: nextState,
      difficulty: Number(nextD.toFixed(2)),
      stability: Number(nextS.toFixed(2)),
      retrievability: Number(this.calculateRetrievability(0, nextS).toFixed(3)),
      lastReview: now,
      nextReview,
      reps: progress.reps + 1,
      lapses: rating === Rating.Again ? progress.lapses + 1 : progress.lapses,
      history: [...(progress.history || []), log],
      isMastered: nextS >= 90 // 稳定性超过 90 天判定为稳固掌握
    };

    return { nextProgress, log };
  }
}

export const defaultFsrs = new FSRSScheduler();
