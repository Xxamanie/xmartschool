import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { env } from '../../config/env';

const router = Router();

const getAi = async () => {
  if (!env.geminiApiKey) {
    throw new Error('AI features are not configured on this server');
  }
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
};

router.post(
  '/generate-questions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { topic, type, difficulty, count } = z.object({
      topic: z.string().trim().min(1).max(500),
      type: z.string().trim().max(50).optional().default('multiple-choice'),
      difficulty: z.string().trim().max(50).optional().default('medium'),
      count: z.number().int().min(1).max(20).optional().default(5),
    }).parse(req.body);

    const safeCount = count;

    const formatMap: Record<string, string> = {
      'multiple-choice': "Format: Multiple Choice. Provide exactly 4 distinct options for each question. The 'correctAnswer' must be one of the options.",
      'true-false': "Format: True/False. The 'correctAnswer' must be exactly 'True' or 'False'. The 'options' array must be empty [].",
      'short-answer': "Format: Short Answer. Provide a concise correct answer. The 'options' array must be empty [].",
      'essay': "Format: Essay. Provide key grading points as the 'correctAnswer'. The 'options' array must be empty [].",
    };

    const formatInstructions = formatMap[type] ?? formatMap['multiple-choice'];
    const prompt = `Create ${safeCount} ${difficulty} level questions about "${topic}". ${formatInstructions}`;

    const { Type } = await import('@google/genai');
    const ai = await getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert educational assessment specialist. Generate high-quality exam questions suitable for high school students. Ensure strict adherence to the requested JSON schema and question type constraints.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: 'The question stem' },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of options for MCQs (empty for others)' },
              correctAnswer: { type: Type.STRING, description: 'The correct answer or grading key' },
              points: { type: Type.NUMBER, description: 'Suggested score value' },
            },
            required: ['text', 'options', 'correctAnswer', 'points'],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      res.status(502).json({ ok: false, data: null, message: 'AI returned no content' });
      return;
    }

    let questions: unknown;
    try {
      questions = JSON.parse(text);
    } catch {
      res.status(502).json({ ok: false, data: null, message: 'AI returned malformed response' });
      return;
    }
    res.json({ ok: true, data: questions, message: 'Questions generated' });
  }),
);

router.post(
  '/generate-remark',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { studentName, average, grade } = z.object({
      studentName: z.string().trim().min(1).max(200),
      average: z.number().min(0).max(100),
      grade: z.string().trim().min(1).max(20),
    }).parse(req.body);

    const prompt = `Generate a concise (max 15 words), professional, and encouraging report card remark for a high school student named ${studentName} who scored an average of ${average}%. The grade is ${grade}.`;

    const ai = await getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const remark = response.text;
    if (!remark) {
      res.status(502).json({ ok: false, data: null, message: 'AI returned no content' });
      return;
    }

    res.json({ ok: true, data: remark.trim(), message: 'Remark generated' });
  }),
);

export { router as aiRouter };
