import { WordItem, WordProgress, State } from '../types';

export interface CognitiveState {
  fatigueIndex: number; // 0 (清醒/高效) ~ 100 (重度疲劳)
  fatigueLevel: 'fresh' | 'focused' | 'moderate' | 'fatigued' | 'exhausted';
  advice: string;
  averageLatencyMs: number;
  accuracyRate: number; // 最近窗口正确率 (0 - 1)
  streak: number;
}

export class CognitiveEngine {
  private static WINDOW_SIZE = 12;

  /**
   * 评估当前的认知负荷与专注疲劳度
   * 基于认知负荷理论 (Cognitive Load Theory) 与反应延迟偏离度
   */
  public static evaluateSession(
    latencies: number[],
    results: boolean[], // true 为回忆成功 (Hard/Good/Easy), false 为 Again
    sessionMinutes: number
  ): CognitiveState {
    if (latencies.length === 0) {
      return {
        fatigueIndex: 0,
        fatigueLevel: 'fresh',
        advice: '大脑状态饱满，准备进入深度主动回忆。',
        averageLatencyMs: 0,
        accuracyRate: 1.0,
        streak: 0,
      };
    }

    const recentLatencies = latencies.slice(-this.WINDOW_SIZE);
    const recentResults = results.slice(-this.WINDOW_SIZE);

    const avgLatency = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;
    const correctCount = recentResults.filter(Boolean).length;
    const accuracy = correctCount / recentResults.length;

    // 计算当前连续正确 streak
    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i]) streak++;
      else break;
    }

    // 早期基准反应速度（前 6 个卡片的平均时间）
    const baselineLatencies = latencies.slice(0, Math.min(6, latencies.length));
    const baselineAvg = baselineLatencies.reduce((a, b) => a + b, 0) / baselineLatencies.length;

    // 延迟增长率 (反应变慢)
    const latencySlowdown = baselineAvg > 0 ? (avgLatency - baselineAvg) / baselineAvg : 0;

    // 错误率激增因子
    const errorRateFactor = (1 - accuracy) * 45; // 错误越多，疲劳指数越高

    // 时间衰减因子 (超过 25 分钟番茄钟周期后疲劳开始累加)
    const timeFactor = Math.max(0, (sessionMinutes - 20) * 1.5);

    // 综合疲劳指数 (0 ~ 100)
    let rawFatigue = (latencySlowdown > 0 ? latencySlowdown * 35 : 0) + errorRateFactor + timeFactor;
    rawFatigue = Math.min(100, Math.max(0, Math.round(rawFatigue)));

    let level: CognitiveState['fatigueLevel'] = 'fresh';
    let advice = '状态极佳，神经可塑性处于巅峰，适合攻坚高难度词！';

    if (rawFatigue < 20) {
      level = 'fresh';
      advice = '大脑处于最佳工作记忆状态，保持主动拼读与联想。';
    } else if (rawFatigue < 45) {
      level = 'focused';
      advice = '心流节奏稳定，正在建立稳固的突触连接。';
    } else if (rawFatigue < 70) {
      level = 'moderate';
      advice = '提取反应略微放缓，请注意深呼吸，尽量先闭眼主动检索例句。';
    } else if (rawFatigue < 85) {
      level = 'fatigued';
      advice = '⚠️ 检测到认知负荷过高，反应延迟显著增加。建议在完成本组后休息 3-5 分钟。';
    } else {
      level = 'exhausted';
      advice = '🛑 建议立即暂停背诵！短时记忆区已饱和，继续背诵将导致顺向干扰（Proactive Interference）。';
    }

    return {
      fatigueIndex: rawFatigue,
      fatigueLevel: level,
      advice,
      averageLatencyMs: Math.round(avgLatency),
      accuracyRate: Number(accuracy.toFixed(2)),
      streak,
    };
  }

  /**
   * 科学交错排序（Interleaving Queue Optimizer）
   * 避免连续出现同一难度或高难度词汇，交替穿插复习词与新词，最大化长时记忆提取效应
   */
  public static interleaveCards(
    reviewList: { word: WordItem; progress: WordProgress }[],
    newList: { word: WordItem; progress: WordProgress }[],
    batchSize: number = 20
  ): { word: WordItem; progress: WordProgress }[] {
    const queue: { word: WordItem; progress: WordProgress }[] = [];
    const reviews = [...reviewList];
    const news = [...newList];

    // 按 3 个复习词 + 1 个新词 或 2:1 的黄金交错比穿插
    while ((reviews.length > 0 || news.length > 0) && queue.length < batchSize) {
      if (reviews.length > 0) {
        queue.push(reviews.shift()!);
      }
      if (reviews.length > 0) {
        queue.push(reviews.shift()!);
      }
      if (news.length > 0) {
        queue.push(news.shift()!);
      }
    }

    return queue;
  }
}
