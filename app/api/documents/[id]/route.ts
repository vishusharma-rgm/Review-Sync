import { NextResponse } from "next/server";
import { getDocument } from "@/lib/demo-data";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ document: getDocument(params.id) });
}
