require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { sendChatMessage } = require("./gemini");
const { checkEmergencyKeywords } = require("./guardrail");
const {
  getOrCreateSession,
  updateSessionProfile,
  formatSessionContext,
} = require("./session");

const app = express();
const PORT = process.env.PORT || 3000;

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  const clientData = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(ip, clientData);
    return true;
  }

  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  clientData.count += 1;
  rateLimitMap.set(ip, clientData);
  return true;
}


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.get("/api/status", (req, res) => {
  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim() !== "" &&
    process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
  );

  res.json({
    status: "ok",
    app: "Bunda Sehat",
    version: "1.0.0",
    hasApiKey,
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  });
});

app.get("/api/session/:id", (req, res) => {
  const session = getOrCreateSession(req.params.id);
  res.json({
    id: session.id,
    profil: session.profil,
    topikTerakhir: session.topikTerakhir,
    messageCount: session.history.length,
  });
});

app.post("/chat", async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || "localhost";
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: "Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu 1 menit sebelum mengirim pesan lagi.",
      });
    }

    const { message, history = [], tone = "santai", sessionId } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        error: "Pesan tidak boleh kosong.",
      });
    }

    const trimmedMessage = message.trim();

    const currentSession = getOrCreateSession(sessionId);
    updateSessionProfile(currentSession, trimmedMessage);
    const sessionContext = formatSessionContext(currentSession);
    const emergencyCheck = checkEmergencyKeywords(trimmedMessage);
    if (emergencyCheck.isEmergency) {
      console.log(`[Guardrail Triggered]: Kata kunci bahaya terdeteksi: ${emergencyCheck.detectedLabels.join(", ")}`);
      return res.json({
        reply: emergencyCheck.message,
        isEmergency: true,
        sessionId: currentSession.id,
        sessionProfile: currentSession.profil,
        meta: {
          source: "guardrail",
          detectedLabels: emergencyCheck.detectedLabels,
        },
      });
    }

    const chatResult = await sendChatMessage({
      message: trimmedMessage,
      history,
      tone,
      sessionContext,
    });

    currentSession.history.push({ role: "user", parts: [{ text: trimmedMessage }] });
    currentSession.history.push({ role: "model", parts: [{ text: chatResult.reply }] });
    if (currentSession.history.length > 20) {
      currentSession.history = currentSession.history.slice(-20);
    }

    return res.json({
      reply: chatResult.reply,
      isEmergency: false,
      sessionId: currentSession.id,
      sessionProfile: currentSession.profil,
      functionCalled: chatResult.functionCalled || false,
      functionName: chatResult.functionName || null,
      functionData: chatResult.functionData || null,
      meta: {
        source: "gemini",
        tone,
        functionCalled: chatResult.functionCalled || false,
        functionName: chatResult.functionName || null,
      },
    });
  } catch (error) {
    console.error("[Chat Error]:", error);

    const errorMessage = error?.message || "";

    if (errorMessage.includes("GEMINI_API_KEY")) {
      return res.status(500).json({
        error:
          "API Key Gemini belum disetel. Tambahkan GEMINI_API_KEY di file .env backend untuk mulai menggunakan chatbot.",
      });
    }

    if (errorMessage.includes("quota") || errorMessage.includes("429")) {
      return res.status(429).json({
        error:
          "Mohon maaf, batas kuota penggunaan API sedang penuh. Silakan coba kembali beberapa saat lagi.",
      });
    }

    return res.status(500).json({
      error:
        "Mohon maaf, terjadi kendala saat memproses jawaban. Silakan coba ajukan pertanyaan Anda kembali.",
      details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Bunda Sehat - Chatbot AI Edukasi KIA`);
  console.log(`  Server aktif di http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
