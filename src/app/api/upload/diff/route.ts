import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { safeUploadFilename } from "@/lib/dashboard-loader";
import { findMatchingDashboard } from "@/lib/data-differ";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Save to temp location for diffing
    const uploadDir = path.join(process.cwd(), "data", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const safeFilename = safeUploadFilename(file.name);
    const filePath = path.join(uploadDir, safeFilename);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Find matching dashboard
    const match = await findMatchingDashboard(filePath);

    if (!match) {
      return NextResponse.json({
        matched: false,
        tempPath: filePath,
        originalName: file.name,
      });
    }

    return NextResponse.json({
      matched: true,
      tempPath: filePath,
      originalName: file.name,
      diff: match.diff,
    });
  } catch (error) {
    console.error("Diff error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
