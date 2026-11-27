import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { filesBucket } from "@/lib/api";
import type { PublicQuote } from "@/lib/quotation-public";
import { formatQuoteMoney, quoteLineAmount, QUOTE_LABELS } from "@/lib/quotations";
import { QuoteError } from "@/lib/quotation-store";

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT = WIDTH - MARGIN * 2;
const ink = rgb(.06,.09,.16);
const muted = rgb(.27,.33,.44);
const purple = rgb(.42,.15,.52);
const magenta = rgb(.75,.29,.58);
const cyan = rgb(.035,.67,.81);
const paper = rgb(.96,.97,.99);

export async function renderQuotationPdf(quote: PublicQuote) {
  const doc = await PDFDocument.create();
  doc.setTitle(quote.number + " revision " + quote.revision);
  doc.setAuthor(quote.branding.company);
  const env = getCloudflareContext().env;
  async function asset(url: string) {
    const response = await env.ASSETS?.fetch(new URL(url,env.BETTER_AUTH_URL));
    return response?.ok ? response.arrayBuffer() : null;
  }
  doc.registerFontkit(fontkit);
  const [regularFile,boldFile] = await Promise.all([
    asset("/brand/quotation-fonts/NotoSans-Regular.ttf"), asset("/brand/quotation-fonts/NotoSans-Bold.ttf"),
  ]);
  const regular = await doc.embedFont(regularFile ?? StandardFonts.Helvetica, regularFile ? { subset:true } : undefined);
  const bold = await doc.embedFont(boldFile ?? StandardFonts.HelveticaBold, boldFile ? { subset:true } : undefined);
  const available = new Map([[regular,new Set(regular.getCharacterSet())],[bold,new Set(bold.getCharacterSet())]]);
  function printable(value: string,font: PDFFont) {
    const normalized=value.replace(/[^\S\n]/g," ");
    if ([...normalized].some(char=>char!=="\n" && !available.get(font)?.has(char.codePointAt(0)!)))
      throw new QuoteError("The PDF font cannot reproduce a character in this quotation. Print the full quotation from the web preview instead.",422);
    return normalized;
  }
  const amount = (value: number) => formatQuoteMoney(value, quote.currency, quote.digits);
  const compact = quote.branding.layout === "compact";
  const textSize = compact ? 9 : 10;
  const leading = compact ? 12 : 14;
  let page: PDFPage;
  let y = 0;
  let repeatingTable = false;

  const addPage = () => {
    page = doc.addPage([WIDTH, HEIGHT]);
    y = HEIGHT - MARGIN;
    if (doc.getPageCount() > 1) {
      draw(quote.number + " / Revision " + quote.revision, MARGIN, y, 9, bold, purple);
      y -= 24;
    }
    if (repeatingTable) tableHeader();
  };
  const draw = (value: string, x: number, baseline: number, size = textSize, font = regular, color = ink) => {
    page.drawText(printable(value,font).replaceAll("\n"," "), {x,y:baseline,size,font,color});
  };
  const ensure = (height: number) => { if (y - height < 61) addPage(); };
  const wrap = (value: string, maxWidth: number, size = textSize, font = regular) => {
    const lines: string[] = [];
    for (const paragraph of printable(value,font).split("\n")) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        const candidate = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(candidate,size) <= maxWidth) { line = candidate; continue; }
        if (line) { lines.push(line); line = ""; }
        for (const char of word) {
          if (font.widthOfTextAtSize(line+char,size) > maxWidth) { lines.push(line); line = ""; }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const block = (label: string, content: string) => {
    if (!content) return;
    ensure(34);
    draw(label,MARGIN,y,11,bold,purple);
    y -= 17;
    for (const line of wrap(content,CONTENT)) { ensure(leading); draw(line,MARGIN,y); y -= leading; }
    y -= 11;
  };
  const tableHeader = () => {
    page.drawRectangle({ x:MARGIN,y:y-7,width:CONTENT,height:20,color:paper });
    draw("Service",MARGIN+7,y,9,bold);
    draw("Qty / unit",MARGIN+256,y,9,bold);
    draw("Unit price",MARGIN+335,y,9,bold);
    draw("Line amount",MARGIN+425,y,9,bold);
    y -= 25;
  };
  async function image(key: string, fallback?: string) {
    try {
      if (key) {
        const object = await filesBucket().get(key);
        if (object && object.size <= 1024 * 1024) {
          const bytes = await object.arrayBuffer();
          if (object.httpMetadata?.contentType === "image/png") return await doc.embedPng(bytes);
          if (object.httpMetadata?.contentType === "image/jpeg") return await doc.embedJpg(bytes);
        }
      }
      if (fallback) {
        const bytes = await asset(fallback);
        if (bytes) return await doc.embedPng(bytes);
      }
    } catch { /* The company name remains in the document if a branding asset is unavailable. */ }
    return null;
  }

  addPage();
  const logo = await image(quote.branding.logoKey,"/brand/mark.png");
  if (logo) {
    const size = logo.scaleToFit(84,42);
    page!.drawImage(logo,{ x:MARGIN,y:y-size.height,width:size.width,height:size.height });
  }
  const companyX = MARGIN + (logo ? Math.min(logo.width * 42 / logo.height,84)+17 : 0);
  const companyLines = wrap(quote.branding.company,WIDTH-MARGIN-120-companyX,18,bold);
  for (const [index,line] of companyLines.entries()) draw(line,companyX,y-19-index*22,18,bold);
  draw("QUOTATION",WIDTH-MARGIN-104,y-19,15,bold,purple);
  y -= Math.max(57,companyLines.length*22+25);
  for (const [index,color] of [purple,magenta,cyan].entries()) {
    page!.drawRectangle({x:MARGIN+index*CONTENT/3,y,width:CONTENT/3,height:2,color});
  }
  y -= 24;
  draw(quote.number + " / Revision " + quote.revision,MARGIN,y,13,bold);
  y -= 18;
  draw("Issued " + quote.issue + "  |  Valid through " + quote.expiry + "  |  " + QUOTE_LABELS[quote.status],MARGIN,y,9,regular,muted);
  y -= 22;

  block("Prepared for", [quote.client.name,quote.client.company,quote.client.email,quote.client.phone,
    [quote.client.address,quote.client.country].filter(Boolean).join(", ")].filter(Boolean).join("\n"));
  block("Project", [quote.title,quote.description].filter(Boolean).join("\n"));
  block("Estimated delivery",quote.timeline);
  block("Scope",quote.scope);
  block("Deliverables",quote.deliverables);

  ensure(55);
  draw("Services",MARGIN,y,12,bold,purple);
  y -= 22;
  repeatingTable = true;
  tableHeader();
  for (const line of quote.lines) {
    const label = line.name + (line.optional ? " (optional)" : "") + (line.recurring ? " / monthly" : "");
    const labelLines = wrap(label,238,textSize,bold);
    const detailLines = wrap([line.description, line.discount ? "Line discount: " + line.discount/100 + "%" : ""].filter(Boolean).join("\n"),237,9);
    ensure((labelLines.length + detailLines.length) * leading + 16);
    for (const [index,value] of wrap(line.quantity/1000 + " / " + (line.unit==="Custom" ? line.customUnit : line.unit),75,8).entries()) {
      draw(value,MARGIN+256,y-index*10,8);
    }
    draw(amount(line.unitPrice),MARGIN+335,y,8);
    draw(amount(quoteLineAmount({ ...line, serviceId:null, category:"", taxable:false, cost:0 })),MARGIN+425,y,8,bold);
    for (const value of labelLines) { draw(value,MARGIN+7,y,textSize,bold); y -= leading; }
    for (const value of detailLines) { draw(value,MARGIN+7,y,9,regular,muted); y -= leading; }
    page!.drawLine({ start:{x:MARGIN,y:y+4},end:{x:WIDTH-MARGIN,y:y+4},thickness:.6,color:rgb(.89,.91,.94) });
    y -= 9;
  }
  repeatingTable = false;
  ensure(132);
  for (const [name,total] of [["One-time charges",quote.oneTime],["Monthly recurring charges",quote.monthly]] as const) {
    if (name.startsWith("Monthly") && !quote.lines.some(line=>line.recurring && !line.optional)) continue;
    ensure(99);
    draw(name,MARGIN,y,12,bold,purple); y -= 17;
    for (const [label,value] of [["Subtotal",total.subtotal],["Discount",total.discount],["Tax",total.tax],["Total",total.total]] as const) {
      draw(label,MARGIN,y,10,label==="Total"?bold:regular);
      const formatted = amount(value);
      draw(formatted,WIDTH-MARGIN-regular.widthOfTextAtSize(printable(formatted,regular),10),y,10,label==="Total"?bold:regular);
      y -= 14;
    }
    y -= 10;
  }
  block("One-time payment schedule",quote.oneTime.total ? quote.milestones.filter(item=>item.share>0).map(item=>
    [item.name + " (" + item.share/100 + "%): " + amount(item.amount),item.due && "Due " + item.due,item.description].filter(Boolean).join(" · ")).join("\n") : "");
  if (quote.monthly.total) block("Recurring payment",amount(quote.monthly.total) + " per month");
  block("Payment instructions",quote.instructions);
  block("Terms and conditions",quote.terms);
  ensure(65);
  draw("Acceptance",MARGIN,y,11,bold,purple);
  y -= 24;
  draw("Client signature ________________________  Date ________________",MARGIN,y);
  y -= 22;
  const signature = await image(quote.branding.signatureKey);
  if (signature) {
    ensure(53);
    const size = signature.scaleToFit(140,38);
    page!.drawImage(signature,{x:MARGIN,y:y-size.height,width:size.width,height:size.height});
    y -= size.height+10;
  }
  if (quote.branding.signature) block("Authorized by",quote.branding.signature);
  block("Business contact", [quote.branding.address,quote.branding.email,quote.branding.phone,
    quote.branding.registration && "Registration: " + quote.branding.registration,
    quote.branding.taxId && "Tax ID: " + quote.branding.taxId].filter(Boolean).join("\n"));
  block(quote.branding.company,quote.branding.footer);
  const pages = doc.getPages();
  for (const [index,item] of pages.entries()) {
    item.drawLine({start:{x:MARGIN,y:47},end:{x:WIDTH-MARGIN,y:47},thickness:.6,color:rgb(.89,.91,.94)});
    item.drawText(printable(quote.number,regular),{x:MARGIN,y:32,size:9,font:regular,color:muted});
    item.drawText((index+1) + " / " + pages.length,{x:WIDTH-MARGIN-35,y:32,size:9,font:regular,color:muted});
  }
  return doc.save();
}

export async function quotationPdfResponse(quote: PublicQuote, request: Request) {
  const bytes = await renderQuotationPdf(quote);
  const inline = new URL(request.url).searchParams.get("view")==="1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":"application/pdf",
      "Content-Disposition":(inline?"inline":"attachment") + '; filename="' + quote.number + '-r' + quote.revision + '.pdf"',
      "Cache-Control":"private, no-store",
      "Referrer-Policy":"no-referrer",
      "X-Robots-Tag":"noindex, nofollow, noarchive",
    },
  });
}
