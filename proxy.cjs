// proxy.cjs — LIFERANK AI PROXY (Gemini Free Tier)
// ─────────────────────────────────────────────────
// SETUP (one time):
//   npm install express cors dotenv node-fetch
//
// Create a .env file in the same folder:
//   GEMINI_API_KEY=your_key_here
//
// Run it:
//   node proxy.cjs
//
// Get free Gemini key at: https://aistudio.google.com/app/apikey
// ─────────────────────────────────────────────────

const express = require("express");
const cors    = require("cors");
const dotenv  = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY missing from .env file");
    return res.status(500).json({ text: "Error: API Key not set in .env file." });
  }

  const userMessage = req.body.message || "Hello";

  // Log first 120 chars so you can see what the app is sending
  console.log("📡 Prompt (first 120 chars):", userMessage.slice(0, 120));

  try {
    const { default: fetch } = await import("node-fetch");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: userMessage }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 600,
          temperature: 0.7,
        }
      })
    });

    const data = await response.json();

    // Always log full response for debugging
    if (data.error) {
      console.error("❌ Gemini API Error:", JSON.stringify(data.error));
      return res.json({ text: `AI Error: ${data.error.message}` });
    }

    // Extract text from Gemini's nested response structure
    const aiText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.output ||
      "";

    if (!aiText) {
      console.warn("⚠️ No text in response:", JSON.stringify(data).slice(0, 300));
      return res.json({ text: "No response from AI. Check console for details." });
    }

    console.log("✅ Response (first 80 chars):", aiText.slice(0, 80));
    res.json({ text: aiText });

  } catch (err) {
    console.error("❌ PROXY CRASHED:", err.message);
    res.status(500).json({ text: `Proxy error: ${err.message}` });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log("═══════════════════════════════════════════════");
  console.log(`🚀 LifeRank AI Proxy running on port ${PORT}`);
  console.log(`   Endpoint: http://localhost:${PORT}/api/chat`);
  console.log("   Powered by: Google Gemini 1.5 Flash (Free)");
  console.log("═══════════════════════════════════════════════");
});
