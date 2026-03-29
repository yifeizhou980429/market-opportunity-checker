import { NextResponse } from "next/server";
import { buildOpportunityReport } from "@/lib/analyze";
import { AnalyzeRequest, Market } from "@/lib/types";

export const runtime = "nodejs";

function isMarket(value: unknown): value is Market {
  return value === "US" || value === "AU";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<AnalyzeRequest>;
    const keyword = payload.keyword?.trim();

    if (!keyword || keyword.length < 2) {
      return NextResponse.json(
        { error: "Keyword is required and must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (!isMarket(payload.market)) {
      return NextResponse.json(
        { error: "Market must be either US or AU." },
        { status: 400 }
      );
    }

    const report = await buildOpportunityReport({
      keyword,
      market: payload.market,
      priceBand: payload.priceBand?.trim() || undefined
    });

    return NextResponse.json(report);
  } catch {
    return NextResponse.json(
      { error: "Unable to generate the market opportunity report." },
      { status: 500 }
    );
  }
}
