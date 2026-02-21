import { NextRequest, NextResponse } from "next/server";
import { sanitizeDashboardId } from "@/lib/dashboard-loader";
import { safeErrorMessage } from "@/lib/sql-utils";
import {
  getRelationships,
  createRelationship,
  updateRelationshipStatus,
  deleteRelationship,
} from "@/lib/relationship-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const safeId = sanitizeDashboardId(id);
    const relationships = await getRelationships(safeId);
    return NextResponse.json({ relationships });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const safeId = sanitizeDashboardId(id);
    const body = await request.json();

    // Handle status update (PATCH-like via POST)
    if (body.relationshipId && body.status) {
      await updateRelationshipStatus(body.relationshipId, body.status, body.userNote);
      return NextResponse.json({ updated: body.relationshipId });
    }

    // Create new relationship
    const { fromTable, fromColumn, toTable, toColumn, type, confidence, source, status } = body;

    if (!fromTable || !fromColumn || !toTable || !toColumn) {
      return NextResponse.json({ error: "All relationship fields required" }, { status: 400 });
    }

    const relationship = await createRelationship({
      dashboardId: safeId,
      fromTable,
      fromColumn,
      toTable,
      toColumn,
      type,
      confidence,
      source,
      status,
    });

    return NextResponse.json({ relationship });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    sanitizeDashboardId(id);
    const { relationshipId } = (await request.json()) as { relationshipId: string };
    await deleteRelationship(relationshipId);
    return NextResponse.json({ deleted: relationshipId });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
