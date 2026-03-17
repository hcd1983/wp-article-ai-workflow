import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

const MODEL = 'gemini-3-pro-image-preview';

/**
 * 使用官方 @google/genai SDK 呼叫 Gemini 產出圖片，回傳 Buffer。
 *
 * @param {string} prompt - 圖片描述（英文建議較佳）
 * @param {Object} [options]
 * @param {{ buffer: Buffer, mimeType: string }[]} [options.referenceImages] - 參考圖片（用於角色一致性）
 * @returns {Promise<Buffer>} - 圖片二進位內容
 */
export async function generateImage(prompt, options = {}) {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY 未設定');
  }

  const client = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  const referenceImages = Array.isArray(options.referenceImages) ? options.referenceImages : [];
  const parts = [
    ...referenceImages.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.buffer.toString('base64'),
      },
    })),
    { text: prompt },
  ];

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: '16:9',
        imageSize: '2K',
      },
    },
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini 未返回任何候選結果');
  }

  const outParts = candidates[0].content?.parts;
  if (!outParts) {
    throw new Error('Gemini 回應中無 parts');
  }

  for (const part of outParts) {
    if (part.inlineData) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('Gemini 回應中未包含圖片');
}

