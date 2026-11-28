import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { json } from "@/lib/api";

export async function projectPdf(title: string, items: string[], file: string, preview: boolean) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor("Axonill");
  doc.registerFontkit(fontkit);
  const env = getCloudflareContext().env;
  const fontAsset = await env.ASSETS?.fetch(new URL("/brand/quotation-fonts/NotoSans-Regular.ttf", env.BETTER_AUTH_URL));
  const font = fontAsset?.ok ? await doc.embedFont(await fontAsset.arrayBuffer(), { subset: true }) : await doc.embedFont(StandardFonts.Helvetica);
  const glyphs = new Set(font.getCharacterSet());
  const printable = (value: string) => value.replace(/[^\S\n]/g, " ");
  if ([title, ...items].some((value) => [...printable(value)].some((char) => char !== "\n" && !glyphs.has(char.codePointAt(0)!))))
    return json({ error: "This document contains characters the PDF font cannot reproduce. Use the web view to print it." }, 422);
  let page = doc.addPage([595, 842]);
  let y = 770;
  function line(value: string, size: number) {
    if (y < 65) { page = doc.addPage([595, 842]); y = 770; }
    page.drawText(value, { x: 44, y, size, font, color: size > 16 ? rgb(.42,.15,.52) : rgb(.06,.09,.16) });
    y -= size + 6;
  }
  function paragraph(value: string, size: number) {
    for (const part of printable(value).split("\n")) {
      let current = "";
      for (const word of part.split(/\s+/)) {
        const candidate = current ? current + " " + word : word;
        if (font.widthOfTextAtSize(candidate, size) <= 507) { current = candidate; continue; }
        if (current) line(current, size);
        current = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(current + char, size) > 507) { line(current, size); current = ""; }
          current += char;
        }
      }
      line(current, size);
    }
  }
  line("Axonill", 21);
  paragraph(title, 18);
  y -= 12;
  for (const item of items) { paragraph(item, 11); y -= 7; }
  const bytes = await doc.save();
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { headers: {
    "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Content-Disposition": (preview ? "inline" : "attachment") + '; filename="' + file.replace(/[^a-zA-Z0-9_-]/g, "_") + '.pdf"',
  } });
}
