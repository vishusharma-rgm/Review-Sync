import { NextResponse } from "next/server";
import { getDocumentSummaries } from "@/lib/demo-data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json({ documents: getDocumentSummaries(url.searchParams.get("q") ?? "") });
}
