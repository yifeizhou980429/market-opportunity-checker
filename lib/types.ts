export type Market = "US" | "AU";

export type Verdict = "Worth testing" | "Test carefully" | "Skip for now";

export type Confidence = "High" | "Medium" | "Low";

export type SectionStatus = "Positive" | "Mixed" | "Negative";

export type SourceState = "Live" | "Fallback" | "Unavailable";

export type AnalysisMode = "Live" | "Mixed" | "Fallback";

export interface AnalyzeRequest {
  keyword: string;
  market: Market;
  priceBand?: string;
}

export interface EvidenceItem {
  id: string;
  label: string;
  url: string;
  excerpt: string;
}

export interface InsightMetric {
  label: string;
  value: string;
}

export interface ReportSection {
  score: number;
  status: SectionStatus;
  summary: string;
  metrics: InsightMetric[];
  bullets: string[];
  evidence: EvidenceItem[];
}

export interface PriceMapSection {
  low: number;
  mid: number;
  high: number;
  currency: string;
  sampleSize: number;
  summary: string;
  metrics: InsightMetric[];
  evidence: EvidenceItem[];
}

export interface OpportunityAngleSection {
  summary: string;
  bullets: string[];
  evidence: EvidenceItem[];
}

export interface SourceHealth {
  key: "trend" | "market" | "reviews";
  label: string;
  status: SourceState;
  detail: string;
}

export interface OpportunityReport {
  keyword: string;
  market: Market;
  priceBand?: string;
  generatedAt: string;
  analysisMode: AnalysisMode;
  executiveSummary: string;
  verdict: Verdict;
  score: number;
  verdictReason: string;
  sourceHealth: SourceHealth[];
  scorecard: {
    demand: number;
    competition: number;
    pricingRoom: number;
    painPointSolvability: number;
    evidenceQuality: number;
  };
  redFlags: string[];
  demand: ReportSection;
  competition: ReportSection;
  priceMap: PriceMapSection;
  painPoints: ReportSection;
  opportunityAngle: OpportunityAngleSection;
  limitations: string[];
}

export interface NarrativeInput {
  keyword: string;
  market: Market;
  priceBand?: string;
  analysisMode: AnalysisMode;
  score: number;
  verdict: Verdict;
  scorecard: OpportunityReport["scorecard"];
  redFlags: string[];
  demandSummary: string;
  competitionSummary: string;
  painPointSummary: string;
  angleSummary: string;
}

export interface NarrativeOutput {
  executiveSummary: string;
  verdictReason: string;
}

export type DetailedAnalysisMode = "AI" | "Fallback";

export interface DetailedAnalysis {
  mode: DetailedAnalysisMode;
  headline: string;
  marketRead: string;
  entryAngle: string;
  testPlan: string[];
  riskNotes: string[];
}

export interface DeepAnalyzeRequest {
  report: OpportunityReport;
}
