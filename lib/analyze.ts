import {
  AnalyzeRequest,
  AnalysisMode,
  EvidenceItem,
  OpportunityAngleSection,
  OpportunityReport,
  Verdict
} from "@/lib/types";
import { buildFactNarrative } from "@/lib/llm";
import { collectMarketSignal } from "@/lib/collectors/market";
import { collectReviewSignal } from "@/lib/collectors/reviews";
import { collectTrendSignal } from "@/lib/collectors/trends";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function weightedScore(scorecard: OpportunityReport["scorecard"]): number {
  return Math.round(
    scorecard.demand * 0.3 +
      scorecard.competition * 0.25 +
      scorecard.pricingRoom * 0.2 +
      scorecard.painPointSolvability * 0.15 +
      scorecard.evidenceQuality * 0.1
  );
}

function buildEvidenceQuality(
  trendStatus: OpportunityReport["sourceHealth"][number],
  marketStatus: OpportunityReport["sourceHealth"][number],
  reviewStatus: OpportunityReport["sourceHealth"][number],
  marketSampleSize: number,
  reviewSampleSize: number
): number {
  const liveSources = [trendStatus, marketStatus, reviewStatus].filter(
    (item) => item.status === "Live"
  ).length;

  return clamp(
    26 +
      liveSources * 20 +
      Math.min(marketSampleSize, 10) +
      Math.min(reviewSampleSize, 6) * 2,
    18,
    92
  );
}

function buildAnalysisMode(sourceHealth: OpportunityReport["sourceHealth"]): AnalysisMode {
  const liveSources = sourceHealth.filter((item) => item.status === "Live").length;

  if (liveSources === sourceHealth.length) {
    return "Live";
  }

  if (liveSources >= 2) {
    return "Mixed";
  }

  return "Fallback";
}

function buildRedFlags(scorecard: OpportunityReport["scorecard"], analysisMode: AnalysisMode): string[] {
  const redFlags: string[] = [];

  if (scorecard.demand < 45) {
    redFlags.push("demand momentum looks weak or unstable");
  }

  if (scorecard.competition < 45) {
    redFlags.push("live listings look crowded and feature-led");
  }

  if (scorecard.pricingRoom < 40) {
    redFlags.push("price spread is narrow enough to limit obvious offer separation");
  }

  if (scorecard.painPointSolvability < 40) {
    redFlags.push("public pain-point evidence is too thin or too noisy");
  }

  if (analysisMode !== "Live") {
    redFlags.push("one or more live collectors degraded during this run");
  }

  return redFlags;
}

function resolveVerdict(score: number, redFlags: string[]): Verdict {
  if (score >= 70 && redFlags.length === 0) {
    return "Worth testing";
  }

  if (score < 45 || redFlags.length >= 2) {
    return "Skip for now";
  }

  return "Test carefully";
}

function buildOpportunityAngle(
  request: AnalyzeRequest,
  trendRelatedQueries: string[],
  repeatedTokens: string[],
  reviewBullets: string[],
  priceSpreadRatio: number,
  evidence: EvidenceItem[]
): OpportunityAngleSection {
  const bullets: string[] = [];

  if (reviewBullets.some((bullet) => /drain|setup|space/i.test(bullet))) {
    bullets.push("Own the small-space setup story instead of selling generic recovery benefits.");
  }

  if (reviewBullets.some((bullet) => /durability|quality/i.test(bullet))) {
    bullets.push("Use stronger material proof, insulation proof, and clearer build specs to separate from cheap listings.");
  }

  if (priceSpreadRatio >= 0.45) {
    bullets.push("There is enough live price spread to support a better-built premium angle if the product page earns it.");
  } else {
    bullets.push("Price compression is tight, so the angle should be scenario-led rather than feature-bloated.");
  }

  if (trendRelatedQueries.length > 0) {
    bullets.push(
      `Trend-adjacent demand is surfacing around ${trendRelatedQueries.slice(0, 2).join(" and ")}.`
    );
  }

  if (repeatedTokens.length > 0) {
    bullets.push(
      `Most live titles repeat ${repeatedTokens.slice(0, 3).join(", ")}, so a sharper promise is more valuable than copying the same vocabulary.`
    );
  }

  if (request.priceBand?.trim()) {
    bullets.push(`Pressure-test whether your offer can credibly sit inside the ${request.priceBand.trim()} range before committing spend.`);
  }

  return {
    summary:
      "The best opening is to enter with a narrow promise that solves one visible objection, not another generic category clone.",
    bullets: bullets.slice(0, 4),
    evidence
  };
}

export async function buildOpportunityReport(
  request: AnalyzeRequest
): Promise<OpportunityReport> {
  const keyword = request.keyword.trim();
  const market = request.market;
  const [trendSignal, marketSignal, reviewSignal] = await Promise.all([
    collectTrendSignal(keyword, market),
    collectMarketSignal(keyword, market),
    collectReviewSignal(keyword, market)
  ]);

  const sourceHealth = [
    trendSignal.sourceHealth,
    marketSignal.sourceHealth,
    reviewSignal.sourceHealth
  ];
  const analysisMode = buildAnalysisMode(sourceHealth);

  const scorecard: OpportunityReport["scorecard"] = {
    demand: trendSignal.score,
    competition: marketSignal.competitionScore,
    pricingRoom: marketSignal.pricingRoomScore,
    painPointSolvability: reviewSignal.painPointScore,
    evidenceQuality: buildEvidenceQuality(
      trendSignal.sourceHealth,
      marketSignal.sourceHealth,
      reviewSignal.sourceHealth,
      marketSignal.sampleSize,
      reviewSignal.sampleCount
    )
  };

  const score = clamp(weightedScore(scorecard), 0, 100);
  const redFlags = buildRedFlags(scorecard, analysisMode);
  const verdict = resolveVerdict(score, redFlags);

  const opportunityAngle = buildOpportunityAngle(
    request,
    trendSignal.relatedQueries,
    marketSignal.titleTokens,
    reviewSignal.section.bullets,
    marketSignal.priceSpreadRatio,
    [
      trendSignal.section.evidence[0],
      marketSignal.priceMapSection.evidence[0],
      reviewSignal.section.evidence[0]
    ].filter((item): item is EvidenceItem => Boolean(item))
  );

  const narrative = buildFactNarrative({
    keyword,
    market,
    priceBand: request.priceBand,
    analysisMode,
    score,
    verdict,
    scorecard,
    redFlags,
    demandSummary: trendSignal.section.summary,
    competitionSummary: marketSignal.competitionSection.summary,
    painPointSummary: reviewSignal.section.summary,
    angleSummary: opportunityAngle.summary
  });

  const limitations = [
    "Trend uses live Google Trends data, marketplace uses live eBay listing samples, and review language uses public community discussion snippets.",
    "Marketplace and discussion coverage are proxies for category shape, not a complete market census.",
    "The first report is fact-first and rule-scored. AI deep analysis is an optional second layer, not the scoring engine."
  ];

  if (request.priceBand?.trim()) {
    limitations.push(
      `Optional price band "${request.priceBand.trim()}" is currently advisory and does not directly rewrite the score.`
    );
  }

  return {
    keyword,
    market,
    priceBand: request.priceBand,
    generatedAt: new Date().toISOString(),
    analysisMode,
    executiveSummary: narrative.executiveSummary,
    verdict,
    score,
    verdictReason: narrative.verdictReason,
    sourceHealth,
    scorecard,
    redFlags,
    demand: trendSignal.section,
    competition: marketSignal.competitionSection,
    priceMap: marketSignal.priceMapSection,
    painPoints: reviewSignal.section,
    opportunityAngle,
    limitations
  };
}
