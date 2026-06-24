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

// Holistic principal's comment for a whole report card.
router.post(
  '/report-comment',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { studentName, average, grade, position, classSize, attendance, term } = z.object({
      studentName: z.string().trim().min(1).max(200),
      average: z.number().min(0).max(100),
      grade: z.string().trim().min(1).max(20),
      position: z.number().int().min(0).optional().default(0),
      classSize: z.number().int().min(0).optional().default(0),
      attendance: z.number().min(0).max(100).optional().default(0),
      term: z.string().trim().max(100).optional().default('this term'),
    }).parse(req.body);

    const posText = position && classSize ? `placed ${position} of ${classSize} in class, ` : '';
    const prompt = `Write a warm, professional 2-3 sentence overall report-card comment from a Nigerian secondary school principal for ${studentName}, who scored a term average of ${average}% (grade ${grade}), ${posText}with ${attendance}% attendance for ${term}. Acknowledge the performance, note one specific strength or area to improve, and end with encouragement. Plain text only, no markdown, no preamble.`;

    const ai = await getAi();
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const comment = response.text;
    if (!comment) {
      res.status(502).json({ ok: false, data: null, message: 'AI returned no content' });
      return;
    }
    res.json({ ok: true, data: comment.trim(), message: 'Comment generated' });
  }),
);

// Week-by-week scheme of work for a subject/class/term.
router.post(
  '/scheme-of-work',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { subject, className, term, weeks } = z.object({
      subject: z.string().trim().min(1).max(120),
      className: z.string().trim().min(1).max(60),
      term: z.string().trim().min(1).max(100),
      weeks: z.number().int().min(1).max(16).optional().default(12),
    }).parse(req.body);

    const prompt = `Create a ${weeks}-week scheme of work for "${subject}" for ${className} (${term}) following the Nigerian secondary school curriculum (WAEC/NERDC). For each week give a clear topic and 2-3 concise learning objectives.`;

    const { Type } = await import('@google/genai');
    const ai = await getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a Nigerian secondary school curriculum planner. Produce a practical, sequenced scheme of work. Adhere strictly to the JSON schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              week: { type: Type.NUMBER, description: 'Week number' },
              topic: { type: Type.STRING, description: 'Topic for the week' },
              objectives: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Learning objectives' },
            },
            required: ['week', 'topic', 'objectives'],
          },
        },
      },
    });

    const text = response.text;
    if (!text) { res.status(502).json({ ok: false, data: null, message: 'AI returned no content' }); return; }
    let scheme: unknown;
    try { scheme = JSON.parse(text); } catch { res.status(502).json({ ok: false, data: null, message: 'AI returned malformed response' }); return; }
    res.json({ ok: true, data: scheme, message: 'Scheme generated' });
  }),
);

export { router as aiRouter };
