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

const VENUE_CODES = Object.keys(VENUE_NAMES);

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

  const start = html.indexOf("2連単オッズ");
  const end = html.indexOf("2連複オッズ");

  const target =
    start >= 0 && end > start ? html.slice(start, end) : html;

  const matches = [
    ...target.matchAll(
      /<td[^>]*class="[^"]*is-boatColor(\d)[^"]*"[^>]*>\s*(\d)\s*<\/td>\s*<td[^>]*class="[^"]*oddsPoint[^"]*"[^>]*>\s*([\d.]+)\s*<\/td>/g
    ),
  ];

  const firstBoats = [1, 2, 3, 4, 5, 6];
  let index = 0;

  for (const first of firstBoats) {
    for (const second of firstBoats) {
      if (first === second) continue;

      const match = matches[index];
      if (match) {
        odds[`${first}-${second}`] = Number(match[3]);
      }

      index++;
    }
  }

  return odds;
}

function extractRacers(beforeText: string, raceListText: string) {
  const before = beforeText.replace(/\s+/g, " ");
  const list = raceListText.replace(/\s+/g, " ");

  const baseMatches = [
    ...before.matchAll(
      /(\d)\s+([^\d\s]+)\s+([^\d\s]+)\s+(\d+\.\d)kg\s+([\d.]+)\s+(-?[\d.]+)/g
    ),
  ];

  return baseMatches.slice(0, 6).map((m) => {
    const lane = Number(m[1]);
    const racerName = `${m[2]} ${m[3]}`;

    const nameKey = `${m[2]} ${m[3]}`;
const namePos = list.indexOf(nameKey);

const block =
  namePos >= 0
    ? list.slice(namePos, namePos + 350)
    : "";

const nums = [...block.matchAll(/\d+\.\d+|\d+/g)].map((x) =>
  Number(x[0])
);
    
    return {
  lane,
  racerName,

  weight: Number(m[4]),

  averageStart: nums[4] ?? 0.15,

  winRate: nums[5] ?? 5,
  localWinRate: nums[8] ?? 5,

  motorNo: nums[11] ?? 0,
  motorRate: nums[12] ?? 0,

  boatNo: nums[14] ?? 0,
  boatRate: nums[15] ?? 0,
};
  });
}

async function getSingleRace(date: string, jcd: string, rno: string) {
  const beforeInfoUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${rno}&jcd=${jcd}&hd=${date}`;
  const racelistUrl = `https://www.boatrace.jp/owpc/pc/race/racelist?rno=${rno}&jcd=${jcd}&hd=${date}`;
  const resultUrl = `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${rno}&jcd=${jcd}&hd=${date}`;
  const oddsUrl = `https://www.boatrace.jp/owpc/pc/race/odds2tf?rno=${rno}&jcd=${jcd}&hd=${date}`;

  const beforeInfo = await fetchText(beforeInfoUrl);
const resultPage = await fetchText(resultUrl);
const oddsPage = await fetchText(oddsUrl);
const raceListPage = await fetchText(racelistUrl);
  
  
const result = extractResult(resultPage.text);
const odds = extractOdds2t(oddsPage.html);
  const racers = extractRacers(beforeInfo.text, raceListPage.text);


  
  if (Object.keys(odds).length === 0) {
  
}
  
  const venueName = VENUE_NAMES[jcd] ?? jcd;

  const isErrorPage =
  beforeInfo.text.includes("見つかりませんでした") ||
  resultPage.text.includes("見つかりませんでした") ||
  oddsPage.text.includes("見つかりませんでした");

  if (date === "20260608" && rno === "1") {

}
  
  return {
  raceId: `${date}-${jcd}-${rno}`,
  date,
  venueCode: jcd,
  venueName,
  raceNo: Number(rno),
  race: `${venueName} ${rno}R`,

    isErrorPage,
    
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
    beforeInfoTextPreview: beforeInfo.text.slice(0, 3000),
    beforeInfoHtmlPreview: (() => {
  const index = beforeInfo.html.indexOf("体重");
  return index >= 0
    ? beforeInfo.html.slice(index, index + 12000)
    : beforeInfo.html.slice(0, 12000);
})(),
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

 const targetVenues = [
  "01","02","03","04","05","06",
  "07","08","09","10","11","12",
  "13","14","15","16","17","18",
  "19","20","21","22","23","24"
];

const raceTasks = [];

for (const venueCode of targetVenues) {
  for (let raceNo = 1; raceNo <= 12; raceNo++) {
    raceTasks.push(getSingleRace(date, venueCode, String(raceNo)));
  }
}

const allRaces = await Promise.all(raceTasks);

return NextResponse.json({
  ok: true,
  mode,
  date,
  venueCode: "ALL",
  venueName: "全場",
  count: allRaces.length,
  races: allRaces,
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

