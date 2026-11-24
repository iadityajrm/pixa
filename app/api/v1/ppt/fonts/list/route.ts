import { NextResponse } from "next/server";

export async function GET() {
  const commonFonts = [
    { font_name: "Inter", family_name: "Inter", format: "woff2" },
    { font_name: "Montserrat", family_name: "Montserrat", format: "ttf" },
    { font_name: "DM Sans", family_name: "DM Sans", format: "ttf" },
    { font_name: "Playfair Display", family_name: "Playfair Display", format: "ttf" },
  ];

  return NextResponse.json({
    success: true,
    fonts: commonFonts,
    message: `Found ${commonFonts.length} font files`,
  });
}
