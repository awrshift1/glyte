import type { TableProfile } from "@/lib/profiler";
import type { DashboardTemplate, TemplateMatch } from "./index";
import type { ChartRecommendation } from "@/lib/chart-recommender";
import { recommendCharts } from "@/lib/chart-recommender";

export const matchSingleDataset: DashboardTemplate = {
  id: "single-dataset",
  name: "Single Dataset",
  description: "General-purpose dashboard for any dataset. Auto-generates charts based on column types.",

  match(_profile: TableProfile): TemplateMatch {
    return {
      score: 0.5,
      confidence: 0.5,
      reason: "Default template — fits any dataset",
    };
  },

  generate(profile: TableProfile): ChartRecommendation[] {
    return recommendCharts(profile);
  },
};
