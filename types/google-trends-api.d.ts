declare module "google-trends-api" {
  export interface TrendOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string | string[];
    hl?: string;
    timezone?: number;
    category?: number;
    property?: "" | "images" | "news" | "youtube" | "froogle";
    granularTimeResolution?: boolean;
  }

  export interface GoogleTrendsApi {
    interestOverTime(options: TrendOptions): Promise<string>;
    relatedQueries(options: TrendOptions): Promise<string>;
  }

  const googleTrends: GoogleTrendsApi;
  export default googleTrends;
}
