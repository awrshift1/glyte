import path from "path";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "glyte.duckdb");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const DASHBOARDS_DIR = path.join(DATA_DIR, "dashboards");
