import { NextResponse } from "next/server";
import { generateDeepAnalysis } from "@/lib/llm";
import {
  DeepAnalyzeRequest,
  Market,
  OpportunityReport,
  Verdict
} from "@/lib/types";

export const runtime = "nodejs";

function isMarket(value: unknown): value is Market {
  return value === "US" || value === "AU";
}

function isVerdict(value: unknown): value is Verdict {
  return (
    value === "Worth testing" ||
    value === "Test carefully" ||
    value === "Skip for now"
  );
}

function looksLikeOpportunityReport(value: unknown): value is OpportunityReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<OpportunityReport>;

  return (
    typeof report.keyword === "string" &&
    isMarket(report.market) &&
    typeof report.score === "number" &&
    isVerdict(report.verdict) &&
    typeof report.generatedAt === "string" &&
    Array.isArray(report.redFlags) &&
    Array.isArray(report.limitations) &&
    typeof report.executiveSummary === "string" &&
    typeof report.verdictReason === "string" &&
    Boolean(report.scorecard) &&
    Boolean(report.demand) &&
    Boolean(report.competition) &&
    Boolean(report.priceMap) &&
    Boolean(report.painPoints) &&
    Boolean(report.opportunityAngle)
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<DeepAnalyzeRequest>;

    if (!looksLikeOpportunityReport(payload.report)) {
      return NextResponse.json(
        { error: "A valid opportunity report is required for AI analysis." },
        { status: 400 }
      );
    }

    const analysis = await generateDeepAnalysis(payload.report);
    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json(
      { error: "Unable to generate the AI deep analysis." },
      { status: 500 }
    );
  }
}
