import { unzipSync, strFromU8 } from 'fflate';

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function parseWordXmlParagraphs(xml: string): string {
  const paragraphs: string[] = [];
  const pMatches = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) ?? [];

  for (const pXml of pMatches) {
    // Convert tabs and line breaks inside paragraphs before collecting <w:t> runs
    const normalized = pXml
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<w:cr\b[^>]*\/>/g, '\n');

    const runParts: string[] = [];
    const tokenRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|(\t|\n)/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(normalized)) !== null) {
      if (match[1] !== undefined) {
        runParts.push(decodeXmlEntities(match[1]));
      } else if (match[2] !== undefined) {
        runParts.push(match[2]);
      }
    }

    const line = runParts.join('').trim();
    if (line.length > 0) {
      paragraphs.push(line);
    }
  }

  return paragraphs.join('\n\n');
}

/**
 * Extracts readable paragraph text from a .docx ZIP archive (`word/document.xml`).
 */
export function extractTextFromDocxBytes(bytes: Uint8Array): string {
  if (!bytes || bytes.byteLength === 0) {
    throw new Error('DOCX file is empty.');
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (err) {
    throw new Error(
      `Invalid DOCX archive: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const docEntry = files['word/document.xml'];
  if (!docEntry) {
    throw new Error('DOCX archive does not contain word/document.xml.');
  }

  const xml = strFromU8(docEntry);
  const extracted = parseWordXmlParagraphs(xml);
  if (extracted) {
    return extracted;
  }

  // Fallback: collect bare <w:t> tags if paragraphs lacked standard wrappers
  const fallbackParts: string[] = [];
  const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = tRegex.exec(xml)) !== null) {
    const val = decodeXmlEntities(m[1]).trim();
    if (val) fallbackParts.push(val);
  }
  return fallbackParts.join(' ');
}

export function extractTextFromHtml(html: string): string {
  return decodeXmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|p|div|li|h[1-6]|tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractTextFromEml(rawEml: string): {
  subject: string;
  body: string;
} {
  const normalized = rawEml.replace(/\r\n/g, '\n');
  const splitIdx = normalized.indexOf('\n\n');
  const headerPart = splitIdx >= 0 ? normalized.slice(0, splitIdx) : '';
  const bodyPart = splitIdx >= 0 ? normalized.slice(splitIdx + 2) : normalized;
  const subjectMatch = headerPart.match(/^Subject:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : '';
  const cleanedBody = /<html|<body|<div/i.test(bodyPart)
    ? extractTextFromHtml(bodyPart)
    : bodyPart.trim();
  return { subject, body: cleanedBody };
}
