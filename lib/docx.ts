import "server-only";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun, BorderStyle } from "docx";

const FONT = "Calibri";

/** Splits text into runs, making [placeholders] bold and highlighted so they
 * cannot be missed in Word. */
function runs(text: string, opts: { bold?: boolean; size?: number } = {}): TextRun[] {
  return text
    .split(/(\[[^\]\n]{2,60}\])/g)
    .filter(Boolean)
    .map((part) =>
      /^\[[^\]]+\]$/.test(part)
        ? new TextRun({ text: part, bold: true, highlight: "yellow", font: FONT, size: opts.size })
        : new TextRun({ text: part, bold: opts.bold, font: FONT, size: opts.size })
    );
}

/**
 * CV text format (what the kit generator writes and the editor keeps):
 *   line 1: name; line 2: contact line
 *   "## Section", "### Role, Employer", "- bullet", anything else = paragraph
 */
export async function cvToDocx(cvText: string): Promise<Buffer> {
  const lines = cvText.split("\n");
  const children: Paragraph[] = [];
  let firstContentLine = 0;

  const nameLine = lines.findIndex((l) => l.trim());
  if (nameLine >= 0) {
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: runs(lines[nameLine].trim(), { bold: true, size: 36 }) })
    );
    const contact = lines[nameLine + 1]?.trim();
    if (contact && !contact.startsWith("#")) {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(contact, { size: 20 }) }));
      firstContentLine = nameLine + 2;
    } else {
      firstContentLine = nameLine + 1;
    }
  }

  for (const raw of lines.slice(firstContentLine)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
          children: [new TextRun({ text: line.slice(3).toUpperCase(), bold: true, font: FONT, size: 24, color: "111111" })],
        })
      );
    } else if (line.startsWith("### ")) {
      children.push(new Paragraph({ spacing: { before: 120 }, children: runs(line.slice(4), { bold: true, size: 22 }) }));
    } else if (/^[-•]\s+/.test(line)) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: runs(line.replace(/^[-•]\s+/, ""), { size: 21 }) }));
    } else {
      children.push(new Paragraph({ spacing: { after: 60 }, children: runs(line, { size: 21 }) }));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children }],
  });
  return Packer.toBuffer(doc);
}

/** Cover letter: blank lines separate paragraphs; single newlines are kept. */
export async function letterToDocx(text: string): Promise<Buffer> {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const children = paragraphs.map((p) => {
    const lines = p.split("\n");
    const kids: TextRun[] = [];
    lines.forEach((l, i) => {
      if (i > 0) kids.push(new TextRun({ break: 1 }));
      kids.push(...runs(l, { size: 22 }));
    });
    return new Paragraph({ spacing: { after: 200, line: 300 }, children: kids });
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{ properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
