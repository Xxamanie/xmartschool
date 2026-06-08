import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { env } from '../../config/env';

const router = Router();

const getAi = () => {
  if (!env.geminiApiKey) {
    throw new Error('AI features are not configured on this server');
  }
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
};

router.post(
  '/generate-questions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { topic, type, difficulty, count } = req.body as {
      topic: string;
      type: string;
      difficulty: string;
      count: number;
    };

    if (!topic?.trim()) {
      res.status(400).json({ ok: false, data: null, message: 'topic is required' });
      return;
    }

    const formatMap: Record<string, string> = {
      'multiple-choice': "Format: Multiple Choice. Provide exactly 4 distinct options for each question. The 'correctAnswer' must be one of the options.",
      'true-false': "Format: True/False. The 'correctAnswer' must be exactly 'True' or 'False'. The 'options' array must be empty [].",
      'short-answer': "Format: Short Answer. Provide a concise correct answer. The 'options' array must be empty [].",
      'essay': "Format: Essay. Provide key grading points as the 'correctAnswer'. The 'options' array must be empty [].",
    };

    const formatInstructions = formatMap[type] ?? formatMap['multiple-choice'];
    const prompt = `Create ${count} ${difficulty} level questions about "${topic}". ${formatInstructions}`;

    const ai = getAi();
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

    const questions = JSON.parse(text);
    res.json({ ok: true, data: questions, message: 'Questions generated' });
  }),
);

router.post(
  '/generate-remark',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { studentName, average, grade } = req.body as {
      studentName: string;
      average: number;
      grade: string;
    };

    if (!studentName?.trim()) {
      res.status(400).json({ ok: false, data: null, message: 'studentName is required' });
      return;
    }

    const prompt = `Generate a concise (max 15 words), professional, and encouraging report card remark for a high school student named ${studentName} who scored an average of ${average}%. The grade is ${grade}.`;

    const ai = getAi();
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
