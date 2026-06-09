import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const date = searchParams.get("date") ?? "20260609";
  const jcd = searchParams.get("jcd") ?? "07";
  const rno = searchParams.get("rno") ?? "1";

  const url = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${rno}&jcd=${jcd}&hd=${date}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      cache: "no-store",
    });

    const html = await response.text();
    const text = htmlToText(html);

    return NextResponse.json({
      ok: true,
      sourceUrl: url,
      date,
      jcd,
      rno,
      htmlLength: html.length,
      textLength: text.length,
      textPreview: text.slice(0, 3000),
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
