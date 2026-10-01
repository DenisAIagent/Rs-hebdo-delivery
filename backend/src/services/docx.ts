import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'images' | 'stars';
  required: boolean;
  validation?: 'youtube' | 'website';
  min?: number;
  max?: number;
}

/** Strip all HTML tags from text, preserving line breaks */
function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')           // <br> → newline
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')   // </p><p> → double newline
    .replace(/<\/?(p|div|h[1-6])[^>]*>/gi, '\n') // block tags → newline
    .replace(/<[^>]*>/g, '')                  // strip remaining HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[^\S\n]{2,}/g, ' ')            // collapse spaces but keep \n
    .replace(/\n{3,}/g, '\n\n')              // max 2 newlines in a row
    .trim();
}

export async function generateDocx(params: {
  title: string;
  author: string;
  paperType: string;
  metadata: Record<string, any>;
  fieldsConfig: FieldConfig[];
  content?: string; // For backward compatibility
}): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];

  // Title - use provided title or extract from metadata
  const documentTitle = params.title || params.metadata.artiste || params.metadata.album || 'Sans titre';
  paragraphs.push(
    new Paragraph({
      text: documentTitle,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    })
  );

  // Author + type
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Par ${params.author} — ${params.paperType}`,
          italics: true,
          size: 22,
          color: '666666',
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Separator
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: '—'.repeat(40), color: 'CCCCCC' })],
      spacing: { after: 200 },
    })
  );

  // Add metadata fields in order of fieldsConfig
  if (params.fieldsConfig && params.fieldsConfig.length > 0) {
    for (const field of params.fieldsConfig) {
      // Skip image fields in DOCX
      if (field.type === 'images') continue;
      // Le chapo ne sert qu'au site (WordPress) : il ne part JAMAIS sur Dropbox
      // (consigne redaction du 01/10/2026).
      if (field.key === 'chapo') continue;

      // Star rating — render as "★★★★½ (4.5/5)"
      if (field.type === 'stars') {
        const rating = parseFloat(params.metadata[field.key]) || 0;
        const maxStars = field.max || 5;
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 !== 0;
        const emptyStars = maxStars - fullStars - (hasHalf ? 1 : 0);
        const filled = '★'.repeat(fullStars) + (hasHalf ? '½' : '') + '☆'.repeat(emptyStars);
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${field.label}: `,
                size: 22,
                bold: true,
              }),
              new TextRun({
                text: `${filled} (${rating % 1 === 0 ? rating : rating.toFixed(1)}/${maxStars})`,
                size: 24,
              }),
            ],
            spacing: { after: 200 },
          })
        );
        continue;
      }

      const rawValue = params.metadata[field.key];
      if (!rawValue) continue;
      const value = typeof rawValue === 'string' ? stripHtml(rawValue) : rawValue;

      // Special handling for different field types
      if (field.key === 'accroche') {
        // Accroche in italic
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: value,
                italics: true,
                size: 26,
                font: 'Georgia',
              }),
            ],
            spacing: { after: 300 },
          })
        );
      } else if (field.key === 'credits') {
        // Credits in small italic
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Crédits: ${value}`,
                italics: true,
                size: 20,
                color: '666666',
              }),
            ],
            spacing: { after: 200 },
          })
        );
      } else if (field.key === 'chapo') {
        // Chapo as lead paragraph
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: value,
                size: 26,
                font: 'Georgia',
                bold: true,
              }),
            ],
            spacing: { after: 400, line: 360 },
          })
        );
      } else if (field.key === 'corps' || field.type === 'textarea') {
        // Main body text or any textarea — preserve all line breaks
        const lines = value.split(/\n/);
        for (const line of lines) {
          // Empty line = paragraph break (add extra spacing)
          if (!line.trim()) {
            paragraphs.push(
              new Paragraph({
                children: [],
                spacing: { after: 120 },
              })
            );
            continue;
          }
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 24,
                  font: 'Georgia',
                }),
              ],
              spacing: { after: 200, line: 360 },
            })
          );
        }
      } else if (field.type === 'url') {
        // URL as a link-like text
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${field.label}: `,
                size: 22,
                bold: true,
              }),
              new TextRun({
                text: value,
                size: 22,
                color: '0066CC',
                underline: {},
              }),
            ],
            spacing: { after: 200 },
          })
        );
      } else {
        // Regular text fields
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${field.label}: `,
                size: 22,
                bold: true,
              }),
              new TextRun({
                text: value,
                size: 22,
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }
    }
  } else if (params.content) {
    // Fallback for backward compatibility — preserve all line breaks
    const lines = params.content.split(/\n/);
    for (const line of lines) {
      if (!line.trim()) {
        paragraphs.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        continue;
      }
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: 24,
              font: 'Georgia',
            }),
          ],
          spacing: { after: 200, line: 360 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}