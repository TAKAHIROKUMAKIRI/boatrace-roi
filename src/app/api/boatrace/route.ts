import { NextRequest, NextResponse } from "next/server";

const VENUE_NAMES: Record<string, string> = {
  "01": "桐生",
  "02": "戸田",
  "03": "江戸川",
  "04": "平和島",
  "05": "多摩川",
  "06": "浜名湖",
  "07": "蒲郡",
  "08": "常滑",
  "09": "津",
  "10": "三国",
  "11": "びわこ",
  "12": "住之江",
  "13": "尼崎",
  "14": "鳴門",
  "15": "丸亀",
  "16": "児島",
  "17": "宮島",
  "18": "徳山",
  "19": "下関",
  "20": "若松",
  "21": "芦屋",
  "22": "福岡",
  "23": "唐津",
  "24": "大村",
};

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    cache: "no-store",
  });

  const html = await response.text();

  return {
  html,
  text: htmlToText(html),
  rawHtml: html,
};
}

function extractResult(text: string) {
  const normalized = text
    .replace(/&yen;/g, "¥")
    .replace(/\s+/g, " ");

  const index = normalized.indexOf("2連単");

  if (index < 0) {
    return {
      result: null,
      payout: null,
      debugSnippet: "2連単 not found",
    };
  }

  const snippet = normalized.substring(index, index + 300);

  const match = snippet.match(/2連単\s+(\d)\s*-\s*(\d)/);

  if (!match) {
    return {
      result: null,
      payout: null,
      debugSnippet: snippet,
    };
  }

  const yenIndex = snippet.indexOf("¥");

  let payout = null;

  if (yenIndex >= 0) {
    const afterYen = snippet.substring(yenIndex + 1);
    const numberMatch = afterYen.match(/^(\d[\d,]*)/);

    if (numberMatch) {
      payout = Number(numberMatch[1].replace(/,/g, ""));
    }
  }

  return {
    result: `${match[1]}-${match[2]}`,
    payout,
    debugSnippet: snippet,
  };
}

function extractOdds2t(html: string) {
  const odds: Record<string, number> = {};

  const matches = [
    ...html.matchAll(
      /is-boatColor(\d)[^>]*>(\d)<\/td>\s*<td class="oddsPoint[^"]*">([\d.]+)<\/td>/g
    ),
  ];

  for (const match of matches) {
    const first = match[1];
    const second = match[2];
    const value = Number(match[3]);

    if (first !== second) {
      odds[`${first}-${second}`] = value;
    }
  }

  return odds;
}

function extractRacers(text: string) {
  const normalized = text.replace(/\s+/g, " ");

  const matches = [
    ...normalized.matchAll(
      /(\d)\s+([^\s]+)\s+([^\s]+)\s+(\d+\.\d)kg/g
    ),
  ];

  return matches.map((m) => ({
  lane: Number(m[1]),
  racerName: `${m[2]} ${m[3]}`,
  weight: Number(m[4]),

  winRate: 0,
  localWinRate: 0,
  averageStart: 0,

  motorNo: 0,
  motorRate: 0,

  boatNo: 0,
  boatRate: 0,
}));

async function getSingleRace(date: string, jcd: string, rno: string) {
  const beforeInfoUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${rno}&jcd=${jcd}&hd=${date}`;
  const resultUrl = `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${rno}&jcd=${jcd}&hd=${date}`;
  const oddsUrl = `https://www.boatrace.jp/owpc/pc/race/odds2tf?rno=${rno}&jcd=${jcd}&hd=${date}`;

  const beforeInfo = await fetchText(beforeInfoUrl);
const resultPage = await fetchText(resultUrl);
const oddsPage = await fetchText(oddsUrl);

const result = extractResult(resultPage.text);
const odds = extractOdds2t(oddsPage.html);
  const racers = extractRacers(beforeInfo.text);

  const venueName = VENUE_NAMES[jcd] ?? jcd;

  return {
  raceId: `${date}-${jcd}-${rno}`,
  date,
  venueCode: jcd,
  venueName,
  raceNo: Number(rno),
  race: `${venueName} ${rno}R`,

  result: result.result,
  payout: result.payout,

  odds,

  racers, 

  debugSnippet: result.debugSnippet,

  sourceUrls: {
    beforeInfo: beforeInfoUrl,
    result: resultUrl,
    odds: oddsUrl,
  },

  debug: {
    beforeInfoTextPreview: beforeInfo.text.slice(0, 1200),
    resultTextPreview: resultPage.text.slice(0, 1200),
  },

  debug: {
    beforeInfoTextPreview: beforeInfo.text.slice(0, 3000),
    resultTextPreview: resultPage.text.slice(0, 1200),
    oddsHtmlPreview: (() => {
  const index = oddsPage.html.indexOf("2連単オッズ");
  return index >= 0
    ? oddsPage.html.slice(index, index + 8000)
    : oddsPage.html.slice(0, 8000);
})(),
  },
};
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("mode") ?? "single";
  const date = searchParams.get("date") ?? "20260609";
  const jcd = searchParams.get("jcd") ?? "07";
  const rno = searchParams.get("rno") ?? "1";

  try {
    if (mode === "backtest") {
      const races = [];

      for (let raceNo = 1; raceNo <= 12; raceNo++) {
        const race = await getSingleRace(date, jcd, String(raceNo));
        races.push(race);
      }

      return NextResponse.json({
        ok: true,
        mode,
        date,
        venueCode: jcd,
        venueName: VENUE_NAMES[jcd] ?? jcd,
        count: races.length,
        races,
      });
    }

    const race = await getSingleRace(date, jcd, rno);

    return NextResponse.json({
      ok: true,
      mode,
      ...race,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "BOAT RACE公式サイトからデータ取得に失敗しました。",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
// test deploy
