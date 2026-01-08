import { GoogleGenerativeAI } from '@google/genai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function gradeEssay(
  questionText: string,
  essay: string,
  rubric: string,
  maxPoints: number
): Promise<{ score: number; feedback: string }> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
Grade this essay based on the provided rubric. Provide a score out of ${maxPoints} and brief feedback.

Question: ${questionText}

Essay: ${essay}

Rubric: ${rubric}

Max Points: ${maxPoints}

Respond in JSON format: {"score": number, "feedback": "string"}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON
    const parsed = JSON.parse(text.trim());
    if (parsed.score && typeof parsed.score === 'number' && parsed.feedback) {
      return {
        score: Math.min(Math.max(parsed.score, 0), maxPoints), // Clamp between 0 and maxPoints
        feedback: parsed.feedback
      };
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('AI Grading Error:', error);
    // Fallback: assign half points
    return {
      score: Math.floor(maxPoints / 2),
      feedback: 'Grading failed, assigned default score.'
    };
  }
}