import { NextResponse } from "next/server";
import { api } from "@/lib/downr";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ Status: false, Error: "URL is required" }, { status: 400 });
    }

    const result = await api.download(url);
    const response = NextResponse.json({ Status: true, Result: result });
    
    response.headers.set('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
    
    return response;
  } catch (error: any) {
    return NextResponse.json({ Status: false, Error: error.message || "Failed to process request" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ Status: false, Error: "URL is required" }, { status: 400 });
    }

    const result = await api.download(url);
    return NextResponse.json({ Status: true, Result: result });
  } catch (error: any) {
    return NextResponse.json({ Status: false, Error: error.message || "Failed to process request" }, { status: 500 });
  }
}
