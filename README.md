# Glyte

Open-source analytics dashboard. Upload a CSV — get instant charts, AI chat, and an MCP server.

No database setup. No configuration. Just data.

## Why

Every analytics tool requires you to set up connectors, define schemas, and configure dashboards. Glyte skips all of that: drop a CSV, get a dashboard. Built for marketing ops, sales teams, and anyone who lives in spreadsheets but wants better visualization.

I built Glyte because I needed it — running lead-gen campaigns across multiple platforms (Greenfi, Clay, ZapMail), each exporting CSVs with different schemas. I wanted one place to upload, explore, and ask questions about the data. Nothing existed that was fast, self-hosted, and didn't require a PhD in BI tools.

## Features

- **Auto-Dashboard** — Upload CSV/TSV/Excel, get KPIs + line charts + bar charts + donut charts instantly
- **AI Sidebar** — Ask questions in plain English ("What's the top campaign by response rate?"), get SQL + charts
- **Cross-Filtering** — Click any chart segment to filter the entire dashboard
- **MCP Server** — 4 tools (`list_dashboards`, `get_dashboard`, `query_dashboard`, `ask_dashboard`) for AI agents
- **URL Filters** — Every filter state is in the URL. Copy, share, bookmark
- **CSV Export** — Export filtered data with one click
- **Date Range Filter** — Filter any temporal column by date range

## Quick Start

```bash
git clone https://github.com/awrshift1/glyte.git
cd glyte
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). Upload a CSV or click "Sample marketing data" to try it out.

### AI Sidebar

To enable AI-powered natural language queries, add an API key for any supported provider:

```bash
cp .env.example .env.local
# Edit .env.local — pick one:
#   ANTHROPIC_API_KEY=sk-ant-...   (default, Claude Haiku)
#   OPENAI_API_KEY=sk-...          (GPT-4o-mini)
#   GOOGLE_GENERATIVE_AI_API_KEY=AI...  (Gemini Flash)
```

Switch models via `GLYTE_MODEL` env var (format: `provider:model-id`).

### MCP Server

Connect Glyte to Claude Code, Cursor, or any MCP-compatible client:

```json
{
  "mcpServers": {
    "glyte": {
      "command": "node",
      "args": ["src/mcp/server.ts"],
      "cwd": "/path/to/glyte"
    }
  }
}
```

Requires `npm run dev` running alongside.

## How It Works

```
CSV → DuckDB (in-memory) → Profiler → Chart Recommender → Dashboard
                                     → Semantic Layer → AI Sidebar
```

1. **Upload** — CSV is ingested into DuckDB as an in-memory table
2. **Profile** — Each column is analyzed: type (numeric/categorical/temporal), cardinality, sample values, ranges
3. **Recommend** — Profile drives automatic chart selection (KPIs for aggregates, lines for time series, bars for categories)
4. **Serve** — Dashboard config saved as JSON, charts rendered with Recharts

The AI sidebar uses the same profile to build a dynamic system prompt, so the LLM knows your schema without any configuration.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Database | DuckDB (embedded, in-memory) |
| AI | Anthropic / OpenAI / Google (via Vercel AI SDK) |
| Charts | Recharts |
| Styling | Tailwind CSS 4 |
| MCP | @modelcontextprotocol/sdk |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts           # AI: NL → SQL → DuckDB → chart
│   │   ├── dashboard/[id]/         # Dashboard data + query + export
│   │   ├── dashboards/route.ts     # List dashboards
│   │   ├── seed/route.ts           # Sample data
│   │   └── upload/route.ts         # CSV upload → DuckDB → profile → charts
│   ├── dashboard/[id]/page.tsx     # Dashboard view
│   ├── dashboards/page.tsx         # Dashboard list
│   └── page.tsx                    # Home (upload zone)
├── components/                     # UI components
├── lib/
│   ├── chart-detection.ts          # AI result → chart type
│   ├── chart-recommender.ts        # Profile → chart config
│   ├── dashboard-loader.ts         # Shared loader + security + WHERE builder
│   ├── duckdb.ts                   # DuckDB instance + query + ingest
│   ├── profiler.ts                 # Column profiling
│   └── semantic-layer.ts           # Profile → LLM system prompt
├── mcp/                            # MCP server + tools
├── store/                          # URL-based filter state
└── types/                          # TypeScript interfaces
```

## License

MIT
