// api/questions.js
// Vercel turns this file into the endpoint: POST /api/questions
//
// Flow: frontend sends { prompt }  ->  we call Gemini with our own
// instructions  ->  we return { questions: string[] } to the frontend.
// The Gemini API key never leaves this file.

const GEMINI_MODEL = "gemini-3.5-flash-lite"; // check aistudio.google.com for the current recommended flash model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// --- Your predefined instructions live here ---
// This is the one place that controls how questions get generated.
// Tune this wording however you like; everything downstream just
// follows whatever this says.
const SYSTEM_INSTRUCTIONS = `You are a prompt-engineering assistant.
Given a user's rough draft prompt, write exactly 3 short clarifying
questions that would help rewrite it into a more precise, more
token-efficient prompt. Base the questions on what's actually missing
or ambiguous in THIS specific prompt (don't reuse generic boilerplate
questions every time). Keep each question under 20 words. Mention any
necessary libraries for the ai agent based on their request from user
prompt in the enhanced prompt. Final prompt should be noticeably larger
and advanced.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Missing 'prompt' in request body" });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
    return res.status(500).json({ error: "Server is missing its API key" });
  }

  try {
    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${SYSTEM_INSTRUCTIONS}\n\nUser's prompt:\n"""${prompt}"""`,
              },
            ],
          },
        ],
        // Ask Gemini to return strict JSON matching this shape, so we
        // never have to guess-parse free-form text on our end.
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3,
              },
            },
            required: ["questions"],
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errText);
      return res.status(502).json({ error: "Failed to reach Gemini API" });
    }

    const data = await geminiResponse.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("Unexpected Gemini response shape:", JSON.stringify(data));
      return res.status(502).json({ error: "Unexpected response from Gemini" });
    }

    const parsed = JSON.parse(rawText);

    return res.status(200).json({ questions: parsed.questions });
  } catch (err) {
    console.error("Server error in /api/questions:", err);
    return res.status(500).json({ error: "Something went wrong generating questions" });
  }
}
