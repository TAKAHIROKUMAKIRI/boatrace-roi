"use client";

import { useMemo, useState } from "react";

type Bet = {
  race: string;
  bet: string;
  probability: number;
  odds: number;
  result: string;
};

const sampleBets: Bet[] = [
  { race: "蒲郡 1R", bet: "1-3", probability: 0.18, odds: 7.2, result: "1-3" },
  { race: "蒲郡 2R", bet: "2-1", probability: 0.09, odds: 12.4, result: "1-2" },
  { race: "住之江 5R", bet: "1-2", probability: 0.31, odds: 3.4, result: "1-2" },
  { race: "桐生 8R", bet: "3-1", probability: 0.08, odds: 18.5, result: "3-1" },
  { race: "丸亀 11R", bet: "1-4", probability: 0.16, odds: 8.1, result: "1-5" },
];

export default function Home() {
  const [evThreshold, setEvThreshold] = useState(1.15);
  const stake = 1000;

  const result = useMemo(() => {
    const bets = sampleBets
      .map((b) => ({
        ...b,
        ev: b.probability * b.odds,
        hit: b.bet === b.result,
      }))
      .filter((b) => b.ev >= evThreshold);

    const investment = bets.length * stake;
    const payout = bets.reduce((sum, b) => sum + (b.hit ? b.odds * stake : 0), 0);
    const profit = payout - investment;
    const roi = investment > 0 ? (payout / investment) * 100 : 0;
    const hitCount = bets.filter((b) => b.hit).length;
    const hitRate = bets.length > 0 ? (hitCount / bets.length) * 100 : 0;

    return { bets, investment, payout, profit, roi, hitCount, hitRate };
  }, [evThreshold]);

  return (
    <main style={{ padding: "24px", maxWidth: "960px" }}>
      <h1>競艇2連単 ROIバックテスト</h1>

      <div style={{ marginTop: "24px" }}>
        <label>
          EV閾値：
          <input
            type="number"
            step="0.05"
            value={evThreshold}
            onChange={(e) => setEvThreshold(Number(e.target.value))}
            style={{ marginLeft: "8px", padding: "6px", width: "100px" }}
          />
        </label>
      </div>

      <div style={{ marginTop: "24px", lineHeight: 1.9 }}>
        <p>総候補数: {sampleBets.length}</p>
        <p>購入点数: {result.bets.length}</p>
        <p>的中数: {result.hitCount}</p>
        <p>的中率: {result.hitRate.toFixed(1)}%</p>
        <p>投資額: ¥{result.investment.toLocaleString()}</p>
        <p>払戻額: ¥{result.payout.toLocaleString()}</p>
        <p>収支: {result.profit >= 0 ? "+" : ""}¥{result.profit.toLocaleString()}</p>
        <p>ROI: {result.roi.toFixed(1)}%</p>
      </div>

      <h2 style={{ marginTop: "32px" }}>購入対象</h2>

      <table border={1} cellPadding={8} style={{ marginTop: "12px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>レース</th>
            <th>買い目</th>
            <th>的中確率</th>
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
              <td>{(b.probability * 100).toFixed(1)}%</td>
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
