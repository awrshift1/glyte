import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtemp, rm, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import { NextRequest } from "next/server";

let tempDir: string;

// Route module references — dynamically imported after DATA_DIR is set
let uploadRoute: typeof import("@/app/api/upload/route");
let dashboardRoute: typeof import("@/app/api/dashboard/[id]/route");
let queryRoute: typeof import("@/app/api/dashboard/[id]/query/route");
let tablesRoute: typeof import("@/app/api/dashboard/[id]/tables/route");

// Shared state between tests
let dashboardId: string;
let tableName: string;

function createRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "glyte-test-"));
  process.env.DATA_DIR = tempDir;
  await mkdir(path.join(tempDir, "uploads"), { recursive: true });
  await mkdir(path.join(tempDir, "dashboards"), { recursive: true });

  // Dynamic imports AFTER DATA_DIR is set (paths.ts reads env at module load)
  uploadRoute = await import("@/app/api/upload/route");
  dashboardRoute = await import("@/app/api/dashboard/[id]/route");
  queryRoute = await import("@/app/api/dashboard/[id]/query/route");
  tablesRoute = await import("@/app/api/dashboard/[id]/tables/route");
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("API Routes Integration", () => {
  // Test 1: Upload CSV -> dashboard created
  it("POST /api/upload creates a dashboard from CSV", async () => {
    const csvContent =
      "name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF\nDiana,28,Boston\nEve,32,Seattle";
    const file = new File([csvContent], "test-data.csv", {
      type: "text/csv",
    });
    const formData = new FormData();
    formData.append("file", file);

    const request = createRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await uploadRoute.POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.dashboardId).toBeDefined();
    expect(data.dashboardId).toMatch(/^dash-\d+$/);
    expect(data.rowCount).toBe(5);
    expect(data.columnCount).toBe(3);
    expect(data.chartCount).toBeGreaterThanOrEqual(1);

    // Save for subsequent tests
    dashboardId = data.dashboardId;
  });

  // Test 2: Dashboard GET returns config + chart data
  it("GET /api/dashboard/[id] returns dashboard data", async () => {
    const request = createRequest(
      `http://localhost:3000/api/dashboard/${dashboardId}`
    );

    const response = await dashboardRoute.GET(request, {
      params: Promise.resolve({ id: dashboardId }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.config).toBeDefined();
    expect(data.config.id).toBe(dashboardId);
    expect(data.config.title).toBeDefined();
    expect(data.config.rowCount).toBe(5);
    expect(data.charts).toBeDefined();
    expect(Array.isArray(data.charts)).toBe(true);

    // Save table name for query test
    tableName = data.config.tableName;
  });

  // Test 3: Query SELECT works, DROP blocked
  it("POST /api/dashboard/[id]/query allows SELECT, blocks DROP", async () => {
    // Valid SELECT
    const selectReq = createRequest(
      `http://localhost:3000/api/dashboard/${dashboardId}/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `SELECT COUNT(*) as cnt FROM "${tableName}"`,
        }),
      }
    );

    const selectRes = await queryRoute.POST(selectReq, {
      params: Promise.resolve({ id: dashboardId }),
    });
    const selectData = await selectRes.json();

    expect(selectRes.status).toBe(200);
    expect(selectData.results).toBeDefined();
    expect(selectData.results[0].cnt).toBe(5);

    // Blocked DROP
    const dropReq = createRequest(
      `http://localhost:3000/api/dashboard/${dashboardId}/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `DROP TABLE "${tableName}"`,
        }),
      }
    );

    const dropRes = await queryRoute.POST(dropReq, {
      params: Promise.resolve({ id: dashboardId }),
    });
    const dropData = await dropRes.json();

    expect(dropRes.status).toBe(400);
    expect(dropData.error).toBeDefined();
  });

  // Test 4: Dashboard DELETE cleanup
  it("DELETE /api/dashboard/[id] removes dashboard", async () => {
    const deleteReq = createRequest(
      `http://localhost:3000/api/dashboard/${dashboardId}`,
      { method: "DELETE" }
    );

    const deleteRes = await dashboardRoute.DELETE(deleteReq, {
      params: Promise.resolve({ id: dashboardId }),
    });
    const deleteData = await deleteRes.json();

    expect(deleteRes.status).toBe(200);
    expect(deleteData.deleted).toBe(true);

    // GET same dashboard should fail (config file gone)
    const getReq = createRequest(
      `http://localhost:3000/api/dashboard/${dashboardId}`
    );
    const getRes = await dashboardRoute.GET(getReq, {
      params: Promise.resolve({ id: dashboardId }),
    });

    expect(getRes.status).toBe(404);
  });

  // Test 5: Tables add/remove
  it("POST/DELETE /api/dashboard/[id]/tables manages additional tables", async () => {
    // First, upload a new dashboard to work with
    const csv1 =
      "product,price,quantity\nWidgetA,10,100\nWidgetB,20,50\nWidgetC,15,75";
    const file1 = new File([csv1], "products.csv", { type: "text/csv" });
    const form1 = new FormData();
    form1.append("file", file1);

    const uploadRes = await uploadRoute.POST(
      createRequest("http://localhost:3000/api/upload", {
        method: "POST",
        body: form1,
      })
    );
    const uploadData = await uploadRes.json();
    const newDashId = uploadData.dashboardId;

    // Add a second table via file upload
    const csv2 = "region,sales\nNorth,5000\nSouth,3000\nEast,4000";
    const file2 = new File([csv2], "regions.csv", { type: "text/csv" });
    const form2 = new FormData();
    form2.append("file", file2);

    const addRes = await tablesRoute.POST(
      createRequest(
        `http://localhost:3000/api/dashboard/${newDashId}/tables`,
        { method: "POST", body: form2 }
      ),
      { params: Promise.resolve({ id: newDashId }) }
    );
    const addData = await addRes.json();

    expect(addRes.status).toBe(200);
    expect(addData.table).toBeDefined();
    expect(addData.table.tableName).toBe("regions");
    expect(addData.table.rowCount).toBe(3);
    expect(addData.totalTables).toBe(1);

    // Remove the added table
    const removeRes = await tablesRoute.DELETE(
      createRequest(
        `http://localhost:3000/api/dashboard/${newDashId}/tables`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableName: "regions" }),
        }
      ),
      { params: Promise.resolve({ id: newDashId }) }
    );
    const removeData = await removeRes.json();

    expect(removeRes.status).toBe(200);
    expect(removeData.deleted).toBe("regions");
    expect(removeData.totalTables).toBe(0);
  });
});
