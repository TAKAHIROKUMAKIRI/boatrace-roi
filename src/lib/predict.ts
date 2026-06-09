export type Racer = {
  lane: number;
  winRate: number;
  localWinRate: number;
  averageStart: number;
  motorRate: number;
  boatRate: number;
};

export type Prediction = {
  bet: string;
  probability: number;
};

const laneBonus: Record<number, number> = {
  1: 1.35,
  2: 1.1,
  3: 1.0,
  4: 0.92,
  5: 0.82,
  6: 0.72,
};

function racerScore(racer: Racer) {
  const startScore = Math.max(0, 0.25 - racer.averageStart) * 20;

  return (
    racer.winRate * 1.8 +
    racer.localWinRate * 1.2 +
    racer.motorRate * 0.08 +
    racer.boatRate * 0.04 +
    startScore
  ) * laneBonus[racer.lane];
}

export function predictExacta(racers: Racer[]): Prediction[] {
  const scores = racers.map((r) => ({
    ...r,
    score: racerScore(r),
  }));

  const combinations: Prediction[] = [];

  for (const first of scores) {
    for (const second of scores) {
      if (first.lane === second.lane) continue;

      const firstProb =
        first.score / scores.reduce((sum, r) => sum + r.score, 0);

      const remaining = scores.filter((r) => r.lane !== first.lane);
      const secondProb =
        second.score / remaining.reduce((sum, r) => sum + r.score, 0);

      combinations.push({
        bet: `${first.lane}-${second.lane}`,
        probability: firstProb * secondProb,
      });
    }
  }

  return combinations.sort((a, b) => b.probability - a.probability);
}
