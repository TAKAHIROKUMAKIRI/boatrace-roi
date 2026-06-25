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

type BetResult = {
  race: string;
  bet: string;
  probability: number;
  odds: number;
  ev: number;
  payout?: number | null;
  result?: string | null;
  hit: boolean;
  reason?: string;
};

type EvComparison = {
  threshold: number;
  betCount: number;
  hitCount: number;
  hitRate: number;
  investment: number;
  payout: number;
  profit: number;
  roi: number;
};

type BacktestResult = {
  totalCandidates: number;
  bets: BetResult[];
  skippedBets: Array<BetResult & { reason: string }>;
  evComparisons: EvComparison[];
  investment: number;
  payout: number;
  profit: number;
  roi: number;
  hitCount: number;
  hitRate: number;
};

const emptyResult: BacktestResult = {
  totalCandidates: 0,
  bets: [],
  skippedBets: [],
  evComparisons: [],
  investment: 0,
  payout: 0,
  profit: 0,
  roi: 0,
  hitCount: 0,
  hitRate: 0,
};

const DB_NAME = "boatrace-cache-db";
const STORE_NAME = "daily-races";

function openRaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRaceCache(date: string): Promise<any[] | null> {
  const db = await openRaceDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(date);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function saveRaceCache(date: string, races: any[]) {
  const db = await openRaceDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(races, date);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export default function Home() {
  const [evThreshold, setEvThreshold] = useState(1.15);
  const [minOdds, setMinOdds] = useState(4);
  const [maxOdds, setMaxOdds] = useState(50);

  const [startDate, setStartDate] = useState("2026-06-09");
  const [endDate, setEndDate] = useState("2026-06-09");

  const [races, setRaces] = useState<Race[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showRaceDetails, setShowRaceDetails] = useState(false);
  const [showOfficialData, setShowOfficialData] = useState(false);
  const [showSkippedBets, setShowSkippedBets] = useState(false);

  const stake = 1000;

  const yen = (value: number | null | undefined) =>
    `¥${(value ?? 0).toLocaleString()}`;

  useEffect(() => {
  if (!startDate || !endDate) return;

  const getDates = (start: string, end: string) => {
    const dates: string[] = [];
    const current = new Date(start);
    const last = new Date(end);

    while (current <= last) {
      dates.push(
        current.getFullYear().toString() +
          String(current.getMonth() + 1).padStart(2, "0") +
          String(current.getDate()).padStart(2, "0")
      );
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const load = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setRaces([]);


    try {
      const dates = getDates(startDate, endDate);
      const allRaces: Race[] = [];

      for (const date of dates) {
        const cacheKey = `boatrace-${date}`;
const cached = await readRaceCache(date);

if (cached) {
  console.log("CACHE HIT", date);

  allRaces.push(...cached);
  continue;
}

console.log("FETCH", date);

const res = await fetch(
  `/api/boatrace?mode=backtest&startDate=${date}&endDate=${date}`
);

        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }

       const data = await res.json();
const racesForDate = Array.isArray(data.races) ? data.races : [];

const compactRaces = racesForDate.map((r: any) => ({
  raceId: r.raceId,
  date: r.date,
  venueCode: r.venueCode,
  venueName: r.venueName,
  raceNo: r.raceNo,
  race: r.race,
  result: r.result,
  payout: r.payout,
  odds: r.odds,
  racers: r.racers,
}));

await saveRaceCache(date, compactRaces);
allRaces.push(...compactRaces);
      }

      setRaces(allRaces);
    } catch (error) {
      console.error(error);
      setErrorMessage("データ取得に失敗しました。期間を短くして再実行してください。");
      setRaces([]);
    } finally {
      setIsLoading(false);
    }
  };

  load();
}, [startDate, endDate]);

  const result = useMemo<BacktestResult>(() => {
    const allBets: BetResult[] = [];

    if (!races || races.length === 0) {
      return emptyResult;
    }

    for (const race of races) {
  if (!race.racers || race.racers.length !== 6 || !race.odds) {
    continue;
  }

  const predictions = predictExacta(race.racers);

  const hitPrediction = predictions.find(
    (p) => p.bet === race.result
  );

      for (const prediction of predictions) {
        const odds = race.odds?.[prediction.bet];
        if (!odds) continue;

        const ev = prediction.probability * odds;

        allBets.push({
  race: race.race,
  bet: prediction.bet,
  probability: prediction.probability,
  odds,
  ev,
  payout: race.payout,
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

    console.log(
  "RACE GROUPS",
  Object.values(raceGroups)
    .slice(0, 20)
    .map((g) => ({
      race: g[0].race,
      count: g.length,
    }))
);
    
    const betsRaw = Object.values(raceGroups).flatMap((raceBets) =>
  raceBets.sort((a, b) => b.ev - a.ev).slice(0, 1)
);

const bets = betsRaw.filter((b) => {
  return !(b.odds <= 8 && b.ev < 6);
});
    
    const hitBets = bets.filter((b) => b.hit);

    const missBets = bets.filter((b) => !b.hit);

console.log(
  "MISS WINNER",
  missBets.slice(0, 50).map((b) => ({
    bet: b.bet,
    result: b.result,
  }))
);
            
    console.log(
  "AVG BETS PER RACE",
  bets.length,
  Object.keys(raceGroups).length,
  bets.length / Object.keys(raceGroups).length
);
        

    const investment = bets.length * stake;

    console.log(
  "PAYOUT CHECK",
  bets
    .filter((b) => b.hit)
    .slice(0, 20)
    .map((b) => {
      const raceData = races.find(
        (r) => r.race === b.race
      );

      return {
        race: b.race,
        bet: b.bet,
        odds: b.odds,
        payout: raceData?.payout,
      };
    })
);
    
    const payout = bets.reduce(
  (sum, b) =>
    sum +
    (b.hit
      ? ((b.payout ?? 0) / 100) * stake
      : 0),
  0
);
    const profit = payout - investment;
    const roi = investment > 0 ? (payout / investment) * 100 : 0;
    const hitCount = bets.filter((b) => b.hit).length;
    const hitRate = bets.length > 0 ? (hitCount / bets.length) * 100 : 0;
    
    const skippedBets: Array<BetResult & { reason: string }> = [];

    const evComparisons = [5.0, 5.5, 6.0, 6.5, 7.0].map((threshold) => {
      const filtered = allBets.filter(
        (b) => b.ev >= threshold && b.odds >= minOdds && b.odds <= maxOdds
      );

      const groups = filtered.reduce<Record<string, BetResult[]>>((acc, bet) => {
        if (!acc[bet.race]) acc[bet.race] = [];
        acc[bet.race].push(bet);
        return acc;
      }, {});

      const comparisonBetsRaw = Object.values(groups).flatMap((raceBets) =>
  raceBets.sort((a, b) => b.ev - a.ev).slice(0, 1)
);

const comparisonBets = comparisonBetsRaw.filter((b) => {
  return !(b.odds <= 8 && b.ev < 6);
});
      
      const investment = comparisonBets.length * stake;
      const payout = comparisonBets.reduce(
  (sum, b) =>
    sum +
    (b.hit
      ? ((b.payout ?? 0) / 100) * stake
      : 0),
  0
);
      const profit = payout - investment;
      const roi = investment > 0 ? (payout / investment) * 100 : 0;
      const hitCount = comparisonBets.filter((b) => b.hit).length;
      const hitRate =
        comparisonBets.length > 0
          ? (hitCount / comparisonBets.length) * 100
          : 0;

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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
          <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>購入条件</h2>

          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <DateInput label="開始日" value={startDate} onChange={setStartDate} />
            <DateInput label="終了日" value={endDate} onChange={setEndDate} />

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
                  style={inputStyle}
                />
              </label>
            ))}
          </div>

          {isLoading && (
            <p style={{ marginTop: "16px", color: "#2563eb", fontWeight: 600 }}>
              データ取得中です。期間が長い場合は時間がかかります。
            </p>
          )}
          {errorMessage && (
            <p style={{ marginTop: "16px", color: "#b91c1c", fontWeight: 600 }}>
              {errorMessage}
            </p>
          )}
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
            <SummaryCard key={String(label)} label={String(label)} value={String(value)} />
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

        <section style={sectionStyle}>
          <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>
            EV別バックテスト比較
          </h2>

          <table style={tableStyle}>
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

        <section style={sectionStyle}>
          <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>レース詳細</h2>

          <button
            onClick={() => setShowRaceDetails((prev) => !prev)}
            style={buttonStyle}
          >
            {showRaceDetails ? "レース詳細を閉じる" : "レース詳細を表示（先頭50件）"}
          </button>

          {showRaceDetails &&
            races.slice(0, 50).map((race) => (
              <div
                key={race.raceId}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "16px",
                  marginTop: "16px",
                }}
              >
                <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>
                  {race.date} / {race.venueName} {race.raceNo}R
                </h3>

                <p>結果：{race.result}</p>
                <p>2連単払戻：{yen(race.payout)}</p>

                <table style={{ ...tableStyle, marginTop: "12px" }}>
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

        <section style={sectionStyle}>
          <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>
            公式取得データ
          </h2>

          <button
            onClick={() => setShowOfficialData((prev) => !prev)}
            style={buttonStyle}
          >
            {showOfficialData ? "公式取得データを閉じる" : "公式取得データを表示（先頭100件）"}
          </button>

          {showOfficialData && (
            <table style={{ ...tableStyle, marginTop: "16px" }}>
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
                {races.slice(0, 100).map((race) => (
                  <tr key={race.raceId}>
                    <Td>{race.date}</Td>
                    <Td>{race.venueName}</Td>
                    <Td>{race.raceNo}R</Td>
                    <Td>{race.result ?? "-"}</Td>
                    <Td>{race.payout != null ? yen(race.payout) : "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <Table title="購入対象" rows={result.bets.slice(0, 300)} showResult />

        <section style={sectionStyle}>
          <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>見送り買い目</h2>
          <button
            onClick={() => setShowSkippedBets((prev) => !prev)}
            style={buttonStyle}
          >
            {showSkippedBets ? "見送り買い目を閉じる" : "見送り買い目を表示（先頭300件）"}
          </button>

          {showSkippedBets && (
            <TableContent rows={result.skippedBets.slice(0, 300)} showReason />
          )}
        </section>
      </div>
    </main>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ fontWeight: 600 }}>
      {label}
      <br />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        padding: "18px",
        borderRadius: "14px",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: "13px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "6px" }}>
        {value}
      </div>
    </div>
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
    <section style={sectionStyle}>
      <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>{title}</h2>
      <TableContent rows={rows} showResult={showResult} showReason={showReason} />
    </section>
  );
}

function TableContent({
  rows,
  showResult,
  showReason,
}: {
  rows: Array<BetResult & { reason?: string }>;
  showResult?: boolean;
  showReason?: boolean;
}) {
  return (
    <table style={tableStyle}>
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
        {rows.map((b, index) => (
          <tr key={`${b.race}-${b.bet}-${index}`}>
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

const inputStyle: React.CSSProperties = {
  marginTop: "6px",
  padding: "10px",
  width: "150px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  padding: "20px",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
  marginBottom: "24px",
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: 600,
};
