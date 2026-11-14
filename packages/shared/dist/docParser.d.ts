/**
 * Extracts readable paragraph text from a .docx ZIP archive (`word/document.xml`).
 */
export declare function extractTextFromDocxBytes(bytes: Uint8Array): string;
export declare function extractTextFromHtml(html: string): string;
export declare function extractTextFromEml(rawEml: string): {
    subject: string;
    body: string;
};
//# sourceMappingURL=docParser.d.ts.map