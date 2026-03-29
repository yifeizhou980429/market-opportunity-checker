import { GoogleGenAI } from "@google/genai";
import {
  DetailedAnalysis,
  NarrativeInput,
  NarrativeOutput,
  OpportunityReport
} from "@/lib/types";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

interface GeminiDetailedAnalysisResponse {
  headline: string;
  marketRead: string;
  entryAngle: string;
  testPlan: string[];
  riskNotes: string[];
}

export function buildFactNarrative(input: NarrativeInput): NarrativeOutput {
  const riskLine =
    input.redFlags.length > 0
      ? `Main risks: ${input.redFlags.join("; ")}.`
      : "No hard red flags surfaced in the current readout.";

  const executiveSummary = `${input.keyword} in ${input.market} scores ${input.score}/100 and currently lands in ${input.verdict}. ${input.demandSummary} ${input.competitionSummary} ${input.angleSummary} ${riskLine}`;

  const verdictReason =
    input.verdict === "Worth testing"
      ? `The live signal stack is strong enough to justify a small test. ${riskLine}`
      : input.verdict === "Test carefully"
        ? `There is enough live signal to justify a small test, but the offer needs tighter positioning and closer validation before spending aggressively. ${riskLine}`
        : `The current live signal stack does not justify a near-term test unless you uncover a more defensible angle or better economics. ${riskLine}`;

  return {
    executiveSummary,
    verdictReason
  };
}

function buildFallbackDetailedAnalysis(report: OpportunityReport): DetailedAnalysis {
  const leadAngle = (report.opportunityAngle.bullets[0] ?? "a single, narrow promise")
    .replace(/[.]+$/g, "")
    .trim();
  const riskNotes =
    report.redFlags.length > 0
      ? report.redFlags
      : report.limitations.slice(0, 2);

  const testPlan = [
    `Build one landing page around this lead angle: ${leadAngle}.`,
    `Keep the opening offer close to the visible market median of ${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: report.priceMap.currency
    }).format(report.priceMap.mid || 0)} unless your positioning clearly earns a premium.`,
    `Use ad hooks and product copy pulled from the live demand and pain-point language already surfaced in this run.`
  ];

  return {
    mode: "Fallback",
    headline: `${report.verdict} based on current live evidence, with the clearest upside in tighter positioning rather than a broader product claim.`,
    marketRead: `${report.demand.summary} ${report.competition.summary} ${report.painPoints.summary}`,
    entryAngle: `${report.opportunityAngle.summary} ${report.opportunityAngle.bullets.slice(0, 2).join(" ")}`.trim(),
    testPlan,
    riskNotes
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({ apiKey });
}

function buildDetailedAnalysisPrompt(report: OpportunityReport): string {
  return JSON.stringify(
    {
      keyword: report.keyword,
      market: report.market,
      priceBand: report.priceBand ?? null,
      analysisMode: report.analysisMode,
      score: report.score,
      verdict: report.verdict,
      executiveSummary: report.executiveSummary,
      verdictReason: report.verdictReason,
      scorecard: report.scorecard,
      redFlags: report.redFlags,
      demand: {
        summary: report.demand.summary,
        bullets: report.demand.bullets,
        metrics: report.demand.metrics
      },
      competition: {
        summary: report.competition.summary,
        bullets: report.competition.bullets,
        metrics: report.competition.metrics
      },
      priceMap: {
        summary: report.priceMap.summary,
        metrics: report.priceMap.metrics
      },
      painPoints: {
        summary: report.painPoints.summary,
        bullets: report.painPoints.bullets
      },
      opportunityAngle: report.opportunityAngle,
      limitations: report.limitations
    },
    null,
    2
  );
}

function parseDetailedAnalysisResponse(rawText: string): DetailedAnalysis | null {
  if (!rawText.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawText) as Partial<GeminiDetailedAnalysisResponse>;

    if (
      typeof parsed.headline !== "string" ||
      typeof parsed.marketRead !== "string" ||
      typeof parsed.entryAngle !== "string" ||
      !Array.isArray(parsed.testPlan) ||
      !Array.isArray(parsed.riskNotes)
    ) {
      return null;
    }

    const testPlan = parsed.testPlan
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 4);
    const riskNotes = parsed.riskNotes
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 4);

    if (testPlan.length === 0 || riskNotes.length === 0) {
      return null;
    }

    return {
      mode: "AI",
      headline: parsed.headline.trim(),
      marketRead: parsed.marketRead.trim(),
      entryAngle: parsed.entryAngle.trim(),
      testPlan,
      riskNotes
    };
  } catch {
    return null;
  }
}

export async function generateDeepAnalysis(
  report: OpportunityReport
): Promise<DetailedAnalysis> {
  const client = getGeminiClient();

  if (!client) {
    return buildFallbackDetailedAnalysis(report);
  }

  try {
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
      contents: `Create a detailed opportunity analysis from this structured market-opportunity report:\n${buildDetailedAnalysisPrompt(
        report
      )}`,
      config: {
        temperature: 0.4,
        responseMimeType: "application/json",
        systemInstruction:
          "You are advising a small ecommerce seller deciding whether to test a product category. Use only the provided report. Return valid JSON only with exactly these keys: headline, marketRead, entryAngle, testPlan, riskNotes. headline, marketRead, and entryAngle must be short plain-English paragraphs. testPlan and riskNotes must each be arrays of 3 or 4 concise strings. Be concrete, evidence-led, and slightly opinionated. Do not add markdown or extra keys."
      }
    });

    return (
      parseDetailedAnalysisResponse(response.text ?? "") ??
      buildFallbackDetailedAnalysis(report)
    );
  } catch {
    return buildFallbackDetailedAnalysis(report);
  }
}
