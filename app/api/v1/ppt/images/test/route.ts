import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query =
      typeof body?.query === "string" && body.query.trim()
        ? body.query.trim()
        : "nature";
    const rawProvider =
      body?.provider ?? body?.image_provider ?? body?.IMAGE_PROVIDER ?? "pexels";
    const provider =
      typeof rawProvider === "string"
        ? rawProvider.trim().toLowerCase()
        : "pexels";
    const rawKey =
      body?.apiKey ??
      (provider === "pixabay"
        ? body?.pixabay_api_key ?? body?.PIXABAY_API_KEY
        : body?.pexels_api_key ?? body?.PEXELS_API_KEY) ??
      "";
    const apiKey = typeof rawKey === "string" ? rawKey.trim() : "";

    if (provider === "pixabay") {
      const key = apiKey || process.env.PIXABAY_API_KEY?.trim();
      if (!key) {
        return NextResponse.json(
          { ok: false, detail: "Pixabay API key is required." },
          { status: 400 }
        );
      }
      const res = await fetch(
        `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&per_page=3`
      );
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, detail: `Pixabay returned ${res.status}` },
          { status: 400 }
        );
      }
      const data = await res.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      if (hits.length === 0) {
        return NextResponse.json(
          { ok: false, detail: "No images returned from Pixabay." },
          { status: 400 }
        );
      }
      const results = hits.map((h: any) => h.webformatURL || h.largeImageURL).filter(Boolean);
      return NextResponse.json({
        ok: true,
        image_url: results[0] || "",
        results,
      });
    }

    const key = apiKey || process.env.PEXELS_API_KEY?.trim();
    if (!key) {
      return NextResponse.json(
        { ok: false, detail: "Pexels API key is required." },
        { status: 400 }
      );
    }
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, detail: `Pexels returned ${res.status}` },
        { status: 400 }
      );
    }
    const data = await res.json();
    const photos = Array.isArray(data?.photos) ? data.photos : [];
    if (photos.length === 0) {
      return NextResponse.json(
        { ok: false, detail: "No images returned from Pexels." },
        { status: 400 }
      );
    }
    const results = photos.map((p: any) => p.src?.medium || p.src?.large).filter(Boolean);
    return NextResponse.json({
      ok: true,
      image_url: results[0] || "",
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image provider test failed";
    return NextResponse.json({ ok: false, detail: message }, { status: 400 });
  }
}
