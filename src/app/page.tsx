"use client";

import { useEffect, useMemo, useState } from "react";
import { predictExacta, type Racer } from "../lib/predict";

type Race = {
  raceId: string;
  date: string;
  venueCode: string;
  venueName: string;
  raceNo: number;
  race: string;

  result: string;
  payout: number;

  odds: Record<string, number>;

  racers: Racer[];
};

type OfficialRace = {
  raceId: string;
  date: string;
  venueName: string;
  raceNo: number;
  result: string | null;
  payout: number | null;
  odds?: Record<string, number>;
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
  const [officialRaces, setOfficialRaces] =
  useState<Race[]>([]);
  const stake = 1000;

  const yen = (value: number) => `¥${value.toLocaleString()}`;

  useEffect(() => {
  fetch("/api/boatrace?mode=backtest&date=20260609&jcd=07")
    .then((res) => res.json())
    .then((data) => {
      const races = data.races ?? [];

      setOfficialRaces(races);
      setRaces(races);
    })
    .catch(() => {
      setOfficialRaces([]);
      setRaces([]);
    });
}, []);

useEffect(() => {
  fetch("/api/boatrace?mode=backtest&date=20260609&jcd=07")
    .then((res) => res.json())
    .then((data) => setOfficialRaces(data.races ?? []))
    .catch(() => setOfficialRaces([]));
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
      (b) => b.ev >= evThreshold && b.odds >= minOdds && b.odds <= maxOdds
    );

    const raceGroups = filteredBets.reduce<Record<string, BetResult[]>>(
      (groups, bet) => {
        if (!groups[bet.race]) groups[bet.race] = [];
        groups[bet.race].push(bet);
        return groups;
      },
      {}
    );

    const bets = Object.values(raceGroups).flatMap((raceBets) =>
      raceBets.sort((a, b) => b.ev - a.ev).slice(0, 3)
    );

        const investment = bets.length * stake;
    const payout = bets.reduce((sum, b) => sum + (b.hit ? b.odds * stake : 0), 0);
    const profit = payout - investment;
    const roi = investment > 0 ? (payout / investment) * 100 : 0;
    const hitCount = bets.filter((b) => b.hit).length;
    const hitRate = bets.length > 0 ? (hitCount / bets.length) * 100 : 0;

    const boughtKeys = new Set(bets.map((b) => `${b.race}-${b.bet}`));

    const skippedBets = allBets
      .filter((b) => !boughtKeys.has(`${b.race}-${b.bet}`))
      .map((b) => {
        let reason = "見送り";

        if (b.ev < evThreshold) reason = "EV不足";
        else if (b.odds < minOdds) reason = "最低オッズ未満";
        else if (b.odds > maxOdds) reason = "最高オッズ超過";
        else reason = "1レース上限で除外";

        return { ...b, reason };
      });

    const evComparisons = [1.05, 1.1, 1.15, 1.2, 1.3].map((threshold) => {
      const filtered = allBets.filter(
        (b) => b.ev >= threshold && b.odds >= minOdds && b.odds <= maxOdds
      );

      const groups = filtered.reduce<Record<string, BetResult[]>>((acc, bet) => {
        if (!acc[bet.race]) acc[bet.race] = [];
        acc[bet.race].push(bet);
        return acc;
      }, {});

      const comparisonBets = Object.values(groups).flatMap((raceBets) =>
        raceBets.sort((a, b) => b.ev - a.ev).slice(0, 3)
      );

      const investment = comparisonBets.length * stake;
      const payout = comparisonBets.reduce(
        (sum, b) => sum + (b.hit ? b.odds * stake : 0),
        0
      );
      const profit = payout - investment;
      const roi = investment > 0 ? (payout / investment) * 100 : 0;
      const hitCount = comparisonBets.filter((b) => b.hit).length;
      const hitRate =
        comparisonBets.length > 0 ? (hitCount / comparisonBets.length) * 100 : 0;

      return {
        threshold,
        betCount: comparisonBets.length,
        hitCount,
        hitRate,
        investment,
        payout,
        profit,
        roi,
      };
    });

    return {
      totalCandidates: allBets.length,
      bets,
      skippedBets,
      evComparisons,
      investment,
      payout,
      profit,
      roi,
      hitCount,
      hitRate,
    };
  }, [races, evThreshold, minOdds, maxOdds]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "32px",
        color: "#111827",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>
          競艇2連単 ROIバックテスト
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "24px" }}>
          選手・モーター・ボート情報から2連単確率を計算し、EV条件に合う買い目だけを検証します。
        </p>

        <section
          style={{
            background: "#ffffff",
            padding: "20px",
            borderRadius: "14px",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
            marginBottom: "24px",
          }}
        >
          <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>
            購入条件
          </h2>

          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            {[
              ["EV閾値", evThreshold, setEvThreshold, 0.05],
              ["最低オッズ", minOdds, setMinOdds, 0.1],
              ["最高オッズ", maxOdds, setMaxOdds, 0.1],
            ].map(([label, value, setter, step]) => (
              <label key={String(label)} style={{ fontWeight: 600 }}>
                {String(label)}
                <br />
                <input
                  type="number"
                  step={Number(step)}
                  value={Number(value)}
                  onChange={(e) =>
                    (setter as React.Dispatch<React.SetStateAction<number>>)(
                      Number(e.target.value)
                    )
                  }
                  style={{
                    marginTop: "6px",
                    padding: "10px",
                    width: "130px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>
            ))}
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {[
            ["総レース数", races.length],
            ["総候補数", result.totalCandidates],
            ["購入点数", result.bets.length],
            ["的中数", result.hitCount],
            ["的中率", `${result.hitRate.toFixed(1)}%`],
            ["ROI", `${result.roi.toFixed(1)}%`],
            ["投資額", yen(result.investment)],
            ["払戻額", yen(result.payout)],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              style={{
                background: "#ffffff",
                padding: "18px",
                borderRadius: "14px",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
              }}
            >
              <div style={{ color: "#6b7280", fontSize: "13px" }}>
                {String(label)}
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  marginTop: "6px",
                }}
              >
                {String(value)}
              </div>
            </div>
          ))}

          <div
            style={{
              background: result.profit >= 0 ? "#ecfdf5" : "#fef2f2",
              padding: "18px",
              borderRadius: "14px",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div style={{ color: "#6b7280", fontSize: "13px" }}>収支</div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: 700,
                marginTop: "6px",
                color: result.profit >= 0 ? "#047857" : "#b91c1c",
              }}
            >
              {result.profit >= 0 ? "+" : ""}
              {yen(result.profit)}
            </div>
          </div>
        </section>

        <section
  style={{
    background: "#ffffff",
    padding: "20px",
    borderRadius: "14px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    marginBottom: "24px",
    overflowX: "auto",
  }}
>
  <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>
    EV別バックテスト比較
  </h2>

  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "14px",
    }}
  >
    <thead>
      <tr style={{ background: "#f9fafb" }}>
        <Th>EV条件</Th>
        <Th>購入点数</Th>
        <Th>的中数</Th>
        <Th>的中率</Th>
        <Th>投資額</Th>
        <Th>払戻額</Th>
        <Th>収支</Th>
        <Th>ROI</Th>
      </tr>
    </thead>
    <tbody>
      {result.evComparisons.map((row) => (
        <tr key={row.threshold}>
          <Td>EV &gt;= {row.threshold.toFixed(2)}</Td>
          <Td>{row.betCount}</Td>
          <Td>{row.hitCount}</Td>
          <Td>{row.hitRate.toFixed(1)}%</Td>
          <Td>{yen(row.investment)}</Td>
          <Td>{yen(row.payout)}</Td>
          <Td>
            {row.profit >= 0 ? "+" : ""}
            {yen(row.profit)}
          </Td>
          <Td>{row.roi.toFixed(1)}%</Td>
        </tr>
      ))}
    </tbody>
  </table>
</section>

        <section
  style={{
    background: "#ffffff",
    padding: "20px",
    borderRadius: "14px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    marginBottom: "24px",
  }}
>
  <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>
    レース詳細
  </h2>

  {races.map((race) => (
    <div
      key={race.raceId}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>
        {race.date} / {race.venueName} {race.raceNo}R
      </h3>

      <p>結果：{race.result}</p>
      <p>2連単払戻：¥{race.payout.toLocaleString()}</p>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "12px",
          fontSize: "14px",
        }}
      >
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <Th>枠</Th>
            <Th>選手名</Th>
            <Th>全国勝率</Th>
            <Th>当地勝率</Th>
            <Th>平均ST</Th>
            <Th>モーター</Th>
            <Th>モーター2連率</Th>
            <Th>ボート</Th>
            <Th>ボート2連率</Th>
          </tr>
        </thead>
        <tbody>
          {race.racers.map((racer) => (
            <tr key={`${race.raceId}-${racer.lane}`}>
              <Td>{racer.lane}</Td>
              <Td>{racer.racerName}</Td>
              <Td>{racer.winRate.toFixed(2)}</Td>
              <Td>{racer.localWinRate.toFixed(2)}</Td>
              <Td>{racer.averageStart.toFixed(2)}</Td>
              <Td>{racer.motorNo}</Td>
              <Td>{racer.motorRate.toFixed(1)}%</Td>
              <Td>{racer.boatNo}</Td>
              <Td>{racer.boatRate.toFixed(1)}%</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ))}
</section>

        <section
  style={{
    background: "#ffffff",
    padding: "20px",
    borderRadius: "14px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    marginBottom: "24px",
    overflowX: "auto",
  }}
>
  <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>
    公式取得データ（蒲郡 2026-06-09）
  </h2>

  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "14px",
    }}
  >
    <thead>
      <tr style={{ background: "#f9fafb" }}>
        <Th>日付</Th>
        <Th>場名</Th>
        <Th>R</Th>
        <Th>2連単結果</Th>
        <Th>払戻</Th>
      </tr>
    </thead>
    <tbody>
      {officialRaces.map((race) => (
        <tr key={race.raceId}>
          <Td>{race.date}</Td>
          <Td>{race.venueName}</Td>
          <Td>{race.raceNo}R</Td>
          <Td>{race.result ?? "-"}</Td>
          <Td>
            {race.payout ? `¥${race.payout.toLocaleString()}` : "-"}
          </Td>
        </tr>
      ))}
    </tbody>
  </table>
</section>
        
        <Table
          title="購入対象"
          rows={result.bets}
          showResult
        />

        <Table
          title="見送り買い目"
          rows={result.skippedBets}
          showReason
        />
      </div>
    </main>
  );
}

function Table({
  title,
  rows,
  showResult,
  showReason,
}: {
  title: string;
  rows: Array<BetResult & { reason?: string }>;
  showResult?: boolean;
  showReason?: boolean;
}) {
  return (
    <section
      style={{
        background: "#ffffff",
        padding: "20px",
        borderRadius: "14px",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
        marginBottom: "24px",
        overflowX: "auto",
      }}
    >
      <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>{title}</h2>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
        }}
      >
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <Th>レース</Th>
            <Th>買い目</Th>
            <Th>予測確率</Th>
            <Th>オッズ</Th>
            <Th>EV</Th>
            {showResult && <Th>結果</Th>}
            {showResult && <Th>判定</Th>}
            {showReason && <Th>見送り理由</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={`${title}-${b.race}-${b.bet}`}>
              <Td>{b.race}</Td>
              <Td>
                <strong>{b.bet}</strong>
              </Td>
              <Td>{(b.probability * 100).toFixed(2)}%</Td>
              <Td>{b.odds.toFixed(1)}倍</Td>
              <Td>{b.ev.toFixed(2)}</Td>
              {showResult && <Td>{b.result}</Td>}
              {showResult && (
                <Td>
                  <span
                    style={{
                      color: b.hit ? "#047857" : "#b91c1c",
                      fontWeight: 700,
                    }}
                  >
                    {b.hit ? "的中" : "不的中"}
                  </span>
                </Td>
              )}
              {showReason && <Td>{b.reason}</Td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px",
        borderBottom: "1px solid #e5e7eb",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "10px",
        borderBottom: "1px solid #e5e7eb",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
