import type { TableProfile } from "@/lib/profiler";
import type { ChartRecommendation } from "@/lib/chart-recommender";
import type { StoredRelationship } from "@/lib/relationship-store";
import { matchContactPipeline } from "./contact-pipeline";
import { matchChannelComparison } from "./channel-comparison";
import { matchCustomerJourney } from "./customer-journey";
import { matchLeadSourceRoi } from "./lead-source-roi";
import { matchSingleDataset } from "./single-dataset";

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  match: (profile: TableProfile, relationships?: StoredRelationship[]) => TemplateMatch;
  generate: (profile: TableProfile) => ChartRecommendation[];
}

export interface TemplateMatch {
  score: number; // 0-1, how well the data fits this template
  confidence: number;
  reason: string;
}

export interface TemplateSelection {
  template: DashboardTemplate;
  score: number;
  confidence: number;
  reason: string;
}

const templates: DashboardTemplate[] = [
  matchContactPipeline,
  matchChannelComparison,
  matchCustomerJourney,
  matchLeadSourceRoi,
  matchSingleDataset, // fallback — always matches at 0.5
];

export function selectTemplate(
  profile: TableProfile,
  relationships?: StoredRelationship[]
): TemplateSelection {
  let best: TemplateSelection | null = null;

  for (const template of templates) {
    const match = template.match(profile, relationships);
    if (!best || match.score > best.score) {
      best = {
        template,
        score: match.score,
        confidence: match.confidence,
        reason: match.reason,
      };
    }
  }

  return best!;
}

export { templates };
