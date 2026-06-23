export type Racer = {
  lane: number;
  racerName: string;
  winRate: number;
  localWinRate: number;
  averageStart: number;
  motorNo: number;
  motorRate: number;
  boatNo: number;
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
  const startScore =
    Math.max(0, 0.25 - racer.averageStart) * 10;

  return (
  racer.winRate * 1.6 +
  racer.localWinRate * 1.0 +
  racer.motorRate * 0.18 +
  racer.boatRate * 0.08 +
  startScore * 1.5
);
}

export function predictExacta(racers: Racer[]): Prediction[] {
  const firstLaneBonus: Record<number, number> = {
  1: 2.2,
  2: 1.25,
  3: 1.0,
  4: 0.85,
  5: 0.55,
  6: 0.35,
};

const secondLaneBonus: Record<number, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.1,
  4: 1.0,
  5: 0.8,
  6: 0.6,
};

const scores = racers.map((r) => ({
  ...r,
  baseScore: racerScore(r),
  firstScore: racerScore(r) * firstLaneBonus[r.lane],
  secondScore: racerScore(r) * secondLaneBonus[r.lane],
}));

  console.log(
  "SCORE SAMPLE",
  scores.map((s) => ({
    lane: s.lane,
    baseScore: s.baseScore,
    firstScore: s.firstScore,
    secondScore: s.secondScore,
    winRate: s.winRate,
    localWinRate: s.localWinRate,
    motorRate: s.motorRate,
    boatRate: s.boatRate,
    averageStart: s.averageStart,
  }))
);
  
  const combinations: Prediction[] = [];

  for (const first of scores) {
    for (const second of scores) {
      if (first.lane === second.lane) continue;

      const firstProb =
  first.firstScore /
  scores.reduce((sum, r) => sum + r.firstScore, 0);

const remaining = scores.filter((r) => r.lane !== first.lane);

const secondProb =
  second.secondScore /
  remaining.reduce((sum, r) => sum + r.secondScore, 0);

      combinations.push({
        bet: `${first.lane}-${second.lane}`,
        probability: firstProb * secondProb,
      });
    }
  }

  return combinations.sort((a, b) => b.probability - a.probability);
}
