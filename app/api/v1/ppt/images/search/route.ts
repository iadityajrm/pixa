import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "business";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const apiKey = process.env.PEXELS_API_KEY?.trim();
    if (apiKey) {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}`,
        {
          headers: { Authorization: apiKey },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const urls = (data.photos || []).map((p: any) => p.src?.large || p.src?.medium);
        if (urls.length > 0) return NextResponse.json(urls);
      }
    }

    // High-quality stock placeholders
    const placeholders = [
      "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200",
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200",
      "/static/images/replaceable_template_image.png",
    ];

    return NextResponse.json(placeholders.slice(0, limit));
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
