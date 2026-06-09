"use client";

import { useEffect, useMemo, useState } from "react";
import { predictExacta, type Racer } from "../lib/predict";

type Race = {
  race: string;
  result: string;
  odds: Record<string, number>;
  racers: Racer[];
};

type BetResult = {
  race: string;
  bet: string;
  probability: number;
  odds: number;
  ev: number;
  result: string;
  hit: boolean;
};

export default function Home() {
  const [evThreshold, setEvThreshold] = useState(1.15);
  const [minOdds, setMinOdds] = useState(4);
  const [maxOdds, setMaxOdds] = useState(50);
  const [races, setRaces] = useState<Race[]>([]);
  const stake = 1000;

  useEffect(() => {
    fetch("/sample-races.json")
      .then((res) => res.json())
      .then((data) => setRaces(data))
      .catch(() => setRaces([]));
  }, []);

  const result = useMemo(() => {
    const allBets: BetResult[] = [];

    for (const race of races) {
      const predictions = predictExacta(race.racers);

      for (const prediction of predictions) {
        const odds = race.odds[prediction.bet];

        if (!odds) continue;

        const ev = prediction.probability * odds;

        allBets.push({
          race: race.race,
          bet: prediction.bet,
          probability: prediction.probability,
          odds,
          ev,
          result: race.result,
          hit: prediction.bet === race.result,
        });
      }
    }

    const filteredBets = allBets.filter(
  (b) =>
    b.ev >= evThreshold &&
    b.odds >= minOdds &&
    b.odds <= maxOdds
);

const raceGroups = filteredBets.reduce<Record<string, BetResult[]>>(
  (groups, bet) => {
    if (!groups[bet.race]) {
      groups[bet.race] = [];
    }

    groups[bet.race].push(bet);
    return groups;
  },
  {}
);

const bets = Object.values(raceGroups).flatMap((raceBets) =>
  raceBets
    .sort((a, b) => b.ev - a.ev)
    .slice(0, 3)
);

    const investment = bets.length * stake;
    const payout = bets.reduce(
      (sum, b) => sum + (b.hit ? b.odds * stake : 0),
      0
    );
    const profit = payout - investment;
    const roi = investment > 0 ? (payout / investment) * 100 : 0;
    const hitCount = bets.filter((b) => b.hit).length;
    const hitRate = bets.length > 0 ? (hitCount / bets.length) * 100 : 0;

    const boughtKeys = new Set(
  bets.map((b) => `${b.race}-${b.bet}`)
);

const skippedBets = allBets
  .filter((b) => !boughtKeys.has(`${b.race}-${b.bet}`))
  .map((b) => {
    let reason = "見送り";

    if (b.ev < evThreshold) {
      reason = "EV不足";
    } else if (b.odds < minOdds) {
      reason = "最低オッズ未満";
    } else if (b.odds > maxOdds) {
      reason = "最高オッズ超過";
    } else {
      reason = "1レース上限で除外";
    }

    return {
      ...b,
      reason,
    };
  });
    
    return {
      totalCandidates: allBets.length,
      bets,
      investment,
      payout,
      profit,
      roi,
      hitCount,
      hitRate,
    };
  }, [races, evThreshold, minOdds, maxOdds]);

  return (
    <main style={{ padding: "24px", maxWidth: "1100px" }}>
      <h1>競艇2連単 ROIバックテスト</h1>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <label>
          EV閾値
          <br />
          <input
            type="number"
            step="0.05"
            value={evThreshold}
            onChange={(e) => setEvThreshold(Number(e.target.value))}
          />
        </label>

        <label>
          最低オッズ
          <br />
          <input
            type="number"
            value={minOdds}
            onChange={(e) => setMinOdds(Number(e.target.value))}
          />
        </label>

        <label>
          最高オッズ
          <br />
          <input
            type="number"
            value={maxOdds}
            onChange={(e) => setMaxOdds(Number(e.target.value))}
          />
        </label>
      </div>

      <div style={{ marginTop: "24px", lineHeight: 1.9 }}>
        <p>総レース数: {races.length}</p>
        <p>総候補数: {result.totalCandidates}</p>
        <p>購入点数: {result.bets.length}</p>
        <p>的中数: {result.hitCount}</p>
        <p>的中率: {result.hitRate.toFixed(1)}%</p>
        <p>投資額: ¥{result.investment.toLocaleString()}</p>
        <p>払戻額: ¥{result.payout.toLocaleString()}</p>
        <p>
          収支: {result.profit >= 0 ? "+" : ""}¥
          {result.profit.toLocaleString()}
        </p>
        <p>ROI: {result.roi.toFixed(1)}%</p>
      </div>

      <h2 style={{ marginTop: "32px" }}>購入対象</h2>

      <table
        border={1}
        cellPadding={8}
        style={{ marginTop: "12px", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th>レース</th>
            <th>買い目</th>
            <th>予測確率</th>
            <th>オッズ</th>
            <th>EV</th>
            <th>結果</th>
            <th>判定</th>
          </tr>
        </thead>
        <tbody>
          {result.bets.map((b) => (
            <tr key={`${b.race}-${b.bet}`}>
              <td>{b.race}</td>
              <td>{b.bet}</td>
              <td>{(b.probability * 100).toFixed(2)}%</td>
              <td>{b.odds.toFixed(1)}倍</td>
              <td>{b.ev.toFixed(2)}</td>
              <td>{b.result}</td>
              <td>{b.hit ? "的中" : "不的中"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
