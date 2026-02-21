import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { UPLOADS_DIR, DASHBOARDS_DIR } from "@/lib/paths";
import { ingestCsv } from "@/lib/duckdb";
import { profileTable } from "@/lib/profiler";
import { recommendCharts } from "@/lib/chart-recommender";
import type { DashboardConfig } from "@/types/dashboard";

const SAMPLE_CSV = `Date,Campaign,Channel,Leads,Sent,Replies,Meetings,Spend,Revenue,Region
2025-09-01,ICE Barcelona,LinkedIn Outreach,180,145,32,8,420.00,12000,EMEA
2025-09-01,ICE Barcelona,Email,220,198,41,11,180.00,16500,EMEA
2025-09-01,SiGMA Dubai,LinkedIn Outreach,95,78,18,4,310.00,6000,MENA
2025-09-01,SiGMA Dubai,Email,110,92,22,5,95.00,7500,MENA
2025-10-01,ICE Barcelona,LinkedIn Outreach,210,170,38,10,480.00,15000,EMEA
2025-10-01,ICE Barcelona,Email,250,225,48,13,210.00,19500,EMEA
2025-10-01,SiGMA Dubai,LinkedIn Outreach,120,98,24,6,380.00,9000,MENA
2025-10-01,SiGMA Dubai,Email,140,118,28,7,120.00,10500,MENA
2025-10-01,Consensus HK,LinkedIn Outreach,55,42,9,2,290.00,3000,APAC
2025-10-01,Consensus HK,Email,65,54,12,3,75.00,4500,APAC
2025-11-01,ICE Barcelona,LinkedIn Outreach,240,195,44,12,540.00,18000,EMEA
2025-11-01,ICE Barcelona,Email,280,252,55,15,240.00,22500,EMEA
2025-11-01,SiGMA Dubai,LinkedIn Outreach,135,110,27,7,420.00,10500,MENA
2025-11-01,SiGMA Dubai,Email,160,134,33,8,140.00,12000,MENA
2025-11-01,Consensus HK,LinkedIn Outreach,70,56,13,3,340.00,4500,APAC
2025-11-01,Consensus HK,Email,80,67,15,4,90.00,6000,APAC
2025-11-01,Bitcoin Conf,LinkedIn Outreach,35,27,6,1,180.00,1500,Americas
2025-11-01,Bitcoin Conf,Email,45,38,8,2,50.00,3000,Americas
2025-12-01,ICE Barcelona,LinkedIn Outreach,260,212,48,13,580.00,19500,EMEA
2025-12-01,ICE Barcelona,Email,310,279,61,17,260.00,25500,EMEA
2025-12-01,SiGMA Dubai,LinkedIn Outreach,150,122,30,8,460.00,12000,MENA
2025-12-01,SiGMA Dubai,Email,175,147,36,9,155.00,13500,MENA
2025-12-01,Consensus HK,LinkedIn Outreach,85,68,16,4,390.00,6000,APAC
2025-12-01,Consensus HK,Email,95,79,18,5,105.00,7500,APAC
2025-12-01,Bitcoin Conf,LinkedIn Outreach,48,38,9,2,220.00,3000,Americas
2025-12-01,Bitcoin Conf,Email,58,49,11,3,65.00,4500,Americas
2026-01-01,ICE Barcelona,LinkedIn Outreach,290,236,54,15,620.00,22500,EMEA
2026-01-01,ICE Barcelona,Email,340,306,67,19,280.00,28500,EMEA
2026-01-01,SiGMA Dubai,LinkedIn Outreach,165,134,33,9,500.00,13500,MENA
2026-01-01,SiGMA Dubai,Email,190,160,39,10,170.00,15000,MENA
2026-01-01,Consensus HK,LinkedIn Outreach,100,80,19,5,430.00,7500,APAC
2026-01-01,Consensus HK,Email,115,96,22,6,115.00,9000,APAC
2026-01-01,Bitcoin Conf,LinkedIn Outreach,60,48,12,3,260.00,4500,Americas
2026-01-01,Bitcoin Conf,Email,72,61,14,4,80.00,6000,Americas
2026-01-01,Clay Direct,LinkedIn Outreach,25,20,5,1,150.00,1500,EMEA
2026-01-01,Clay Direct,Email,30,25,6,2,35.00,3000,EMEA
2026-02-01,ICE Barcelona,LinkedIn Outreach,310,252,58,16,660.00,24000,EMEA
2026-02-01,ICE Barcelona,Email,365,329,72,20,300.00,30000,EMEA
2026-02-01,SiGMA Dubai,LinkedIn Outreach,180,146,36,10,540.00,15000,MENA
2026-02-01,SiGMA Dubai,Email,210,176,43,11,185.00,16500,MENA
2026-02-01,Consensus HK,LinkedIn Outreach,115,92,22,6,470.00,9000,APAC
2026-02-01,Consensus HK,Email,130,109,25,7,130.00,10500,APAC
2026-02-01,Bitcoin Conf,LinkedIn Outreach,72,58,14,4,300.00,6000,Americas
2026-02-01,Bitcoin Conf,Email,85,72,17,5,95.00,7500,Americas
2026-02-01,Clay Direct,LinkedIn Outreach,35,28,7,2,180.00,3000,EMEA
2026-02-01,Clay Direct,Email,42,35,8,2,45.00,3000,EMEA`;

export async function POST() {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
    const filePath = path.join(UPLOADS_DIR, "sample-marketing-data.csv");
    await writeFile(filePath, SAMPLE_CSV);

    const tableName = "sample_marketing_data";
    const { rows, columns } = await ingestCsv(filePath, tableName);

    const profile = await profileTable(tableName);
    const charts = recommendCharts(profile);

    const config: DashboardConfig = {
      id: `dash-${Date.now()}`,
      title: "Marketing Campaign Analytics",
      tableName,
      csvPath: filePath,
      rowCount: rows,
      columnCount: columns.length,
      charts,
      profile,
      createdAt: new Date().toISOString(),
    };

    await mkdir(DASHBOARDS_DIR, { recursive: true });
    await writeFile(
      path.join(DASHBOARDS_DIR, `${config.id}.json`),
      JSON.stringify(config, null, 2)
    );

    return NextResponse.json({
      dashboardId: config.id,
      title: config.title,
      rowCount: rows,
      columnCount: columns.length,
      chartCount: charts.length,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
