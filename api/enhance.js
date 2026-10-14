// api/enhance.js
// Vercel turns this file into the endpoint: POST /api/enhance
//
// Flow: frontend sends { prompt, qa }  ->  we build a single instruction
// combining the original prompt + the user's answers  ->  Gemini rewrites
// it  ->  we return { enhancedPrompt } to the frontend.

const GEMINI_MODEL = "gemini-3.5-flash-lite"; // check aistudio.google.com for the current recommended flash model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// --- Your predefined instructions live here ---
// This is the dial that controls what "enhanced" means for your tool.
// Adjust freely — e.g. bias it more toward brevity, or toward preserving
// more of the user's original wording, however you want the tool to feel.
const SYSTEM_INSTRUCTIONS = `You are a prompt-engineering assistant. You
will be given a user's original rough prompt, along with clarifying
questions that were asked and the user's answers to them. Using all of
this context, rewrite the prompt into a single, clear, precise, and
token-efficient version that an AI model could follow accurately with
minimal back-and-forth. Preserve the user's original intent and any
specific details they gave — do not invent new requirements. Remove
ambiguity, filler words, and redundant phrasing. Do not add caveats,
meta-commentary, or an explanation of what you changed. Return only the
rewritten prompt itself. Final prompt should be noticeably larger
and advanced.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, qa } = req.body || {};

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Missing 'prompt' in request body" });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
    return res.status(500).json({ error: "Server is missing its API key" });
  }

  // qa is optional — someone could hit this endpoint with just a prompt
  // and no answered questions, and it should still degrade gracefully.
  const qaList = Array.isArray(qa) ? qa : [];
  const qaText = qaList.length
    ? qaList
        .map(({ question, answer }) => `Q: ${question}\nA: ${answer?.trim() || "(no answer given)"}`)
        .join("\n\n")
    : "(no clarifying questions were answered)";

  const userMessage = `${SYSTEM_INSTRUCTIONS}

Original prompt:
"""${prompt}"""

Clarifying Q&A:
${qaText}`;

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
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.4, // lower than default — we want consistency, not creative variation
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              enhancedPrompt: { type: "string" },
            },
            required: ["enhancedPrompt"],
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

    return res.status(200).json({ enhancedPrompt: parsed.enhancedPrompt });
  } catch (err) {
    console.error("Server error in /api/enhance:", err);
    return res.status(500).json({ error: "Something went wrong enhancing the prompt" });
  }
}
