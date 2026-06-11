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
  };
}

function extractResult(text: string) {
  const match = text.match(/2連単\s+(\d)-(\d)\s+[\d,]+円/);

  if (!match) {
    return {
      result: null,
      payout: null,
    };
  }

  const payoutMatch = text.match(/2連単\s+\d-\d\s+([\d,]+)円/);

  return {
    result: `${match[1]}-${match[2]}`,
    payout: payoutMatch ? Number(payoutMatch[1].replace(/,/g, "")) : null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const date = searchParams.get("date") ?? "20260609";
  const jcd = searchParams.get("jcd") ?? "07";
  const venueName = VENUE_NAMES[jcd] ?? jcd;

  const races = [];

  for (let rno = 1; rno <= 12; rno++) {
    const beforeInfoUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${rno}&jcd=${jcd}&hd=${date}`;
    const resultUrl = `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${rno}&jcd=${jcd}&hd=${date}`;

    try {
      const beforeInfo = await fetchText(beforeInfoUrl);
      const resultPage = await fetchText(resultUrl);
      const result = extractResult(resultPage.text);

      races.push({
        raceId: `${date}-${jcd}-${rno}`,
        date,
        venueCode: jcd,
        venueName,
        raceNo: rno,
        race: `${venueName} ${rno}R`,
        result: result.result,
        payout: result.payout,
        sourceUrls: {
          beforeInfo: beforeInfoUrl,
          result: resultUrl,
        },
        debug: {
          beforeInfoTextPreview: beforeInfo.text.slice(0, 800),
          resultTextPreview: resultPage.text.slice(0, 800),
        },
      });
    } catch (error) {
      races.push({
        raceId: `${date}-${jcd}-${rno}`,
        date,
        venueCode: jcd,
        venueName,
        raceNo: rno,
        race: `${venueName} ${rno}R`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    date,
    venueCode: jcd,
    venueName,
    count: races.length,
    races,
  });
}
