/**
 * Cadrage sur les visages pour l'image a la une des interviews et sujets de
 * couv quand la photo de l'artiste n'est pas horizontale. sharp ne detecte
 * pas les visages : Claude (vision) renvoie leurs boites, on cadre sur le
 * groupe. Aucun visage ou erreur : null, l'appelant garde le recadrage par defaut.
 */

import sharp from 'sharp';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, getClaudeModel } from './claude';
import type { FocusPoint } from './imageResize';

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Copie envoyee a Claude : suffisante pour situer des visages, legere. */
const ANALYSIS_MAX_SIDE = 1024;
const FACE_TIMEOUT_MS = 60_000;

const FACE_TOOL = {
  name: 'report_faces',
  description: 'Renvoie la position de chaque visage humain visible sur la photo.',
  input_schema: {
    type: 'object' as const,
    properties: {
      faces: {
        type: 'array',
        description: 'Un element par visage. Coordonnees relatives (0 a 1) depuis le coin haut gauche. Liste vide si aucun visage.',
        items: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'Bord gauche du visage (0-1).' },
            y: { type: 'number', description: 'Bord haut du visage (0-1).' },
            width: { type: 'number', description: 'Largeur du visage (0-1).' },
            height: { type: 'number', description: 'Hauteur du visage (0-1).' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
    },
    required: ['faces'],
  },
};

const inUnit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** Boites valides seulement ; une boite qui deborde est ramenee dans l'image. */
export function parseFaceBoxes(input: unknown): FaceBox[] {
  const faces = (input as { faces?: unknown })?.faces;
  if (!Array.isArray(faces)) return [];
  return faces.flatMap((f) => {
    const b = f as Partial<FaceBox> | null;
    if (!b || !inUnit(b.x) || !inUnit(b.y) || !inUnit(b.width) || !inUnit(b.height)) return [];
    return [{ x: b.x, y: b.y, width: Math.min(b.width, 1 - b.x), height: Math.min(b.height, 1 - b.y) }];
  });
}

/** Centre du rectangle englobant tous les visages. */
export function focusFromFaces(faces: FaceBox[]): FocusPoint | null {
  if (faces.length === 0) return null;
  const left = Math.min(...faces.map((f) => f.x));
  const top = Math.min(...faces.map((f) => f.y));
  const right = Math.max(...faces.map((f) => f.x + f.width));
  const bottom = Math.max(...faces.map((f) => f.y + f.height));
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

export async function detectFaceFocus(input: Buffer): Promise<FocusPoint | null> {
  const preview = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(ANALYSIS_MAX_SIDE, ANALYSIS_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  const anthropic = await getAnthropicClient(FACE_TIMEOUT_MS);
  const response = await anthropic.messages.create({
    model: await getClaudeModel(),
    max_tokens: 1024,
    tools: [FACE_TOOL],
    // Forcer l'outil (tool_choice « tool ») n'est pas accepte par tous les modeles.
    tool_choice: { type: 'auto' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: preview.toString('base64') } },
        { type: 'text', text: `Situe chaque visage humain de cette photo de presse (artiste ou groupe) et reponds uniquement avec l'outil ${FACE_TOOL.name}.` },
      ],
    }],
  });
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  return focusFromFaces(parseFaceBoxes(toolUse?.input));
}
