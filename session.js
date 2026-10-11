
const sessionStore = new Map();


const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function getOrCreateSession(sessionId) {
  if (!sessionId) {
    sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  }

  let session = sessionStore.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      profil: {
        namaPanggilan: null,
        namaAnak: null,
        tanggalLahirAnak: null,
      },
      topikTerakhir: null,
      history: [],
    };
    sessionStore.set(sessionId, session);
  } else {
    session.lastAccessed = Date.now();
  }

  return session;
}


function updateSessionProfile(session, userMessage) {
  if (!userMessage || typeof userMessage !== "string") return;

  const text = userMessage.toLowerCase();

  const namaAnakMatch = userMessage.match(/(?:nama\s+anak(?:ku| saya)?\s+(?:adalah\s+)?|anak(?:ku| saya)?\s+namanya\s+)([A-Za-z]+)/i);
  if (namaAnakMatch && namaAnakMatch[1]) {
    session.profil.namaAnak = namaAnakMatch[1].trim();
  }
  const namaUserMatch = userMessage.match(/(?:panggil(?:\s+saja)?\s+(?:saya\s+)?|nama\s+saya\s+)([A-Za-z\s]+?)(?:,|\.|$)/i);
  if (namaUserMatch && namaUserMatch[1]) {
    const candidate = namaUserMatch[1].trim();
    if (!candidate.toLowerCase().includes("anak")) {
      session.profil.namaPanggilan = candidate;
    }
  }
  const birthMatch = userMessage.match(/(?:lahir(?:nya)?(?:\s+tanggal)?|tanggal\s+lahir(?:\s+anak(?:ku)?)?)\s*(?::|\s)\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i);
  if (birthMatch && birthMatch[1]) {
    session.profil.tanggalLahirAnak = birthMatch[1].trim();
  }
  if (text.includes("imunisasi") || text.includes("vaksin")) {
    session.topikTerakhir = "Imunisasi";
  } else if (text.includes("mpasi") || text.includes("makan") || text.includes("tekstur") || text.includes("menu")) {
    session.topikTerakhir = "MPASI";
  } else if (text.includes("hamil") || text.includes("janin") || text.includes("kandungan")) {
    session.topikTerakhir = "Kehamilan";
  } else if (text.includes("demam") || text.includes("batuk") || text.includes("pilek")) {
    session.topikTerakhir = "Kesehatan Bayi";
  }
}


function formatSessionContext(session) {
  if (!session) return "";

  const lines = [];
  if (session.profil.namaPanggilan) {
    lines.push(`- Nama Pengguna: ${session.profil.namaPanggilan}`);
  }
  if (session.profil.namaAnak) {
    lines.push(`- Nama Anak: ${session.profil.namaAnak}`);
  }
  if (session.profil.tanggalLahirAnak) {
    lines.push(`- Tanggal Lahir Anak: ${session.profil.tanggalLahirAnak}`);
  }
  if (session.topikTerakhir) {
    lines.push(`- Topik Percakapan Terakhir: ${session.topikTerakhir}`);
  }

  if (lines.length === 0) return "";
  return `\n\nMEMORI SESI PENGGUNA SAAT INI (Gunakan info ini agar pengguna tidak perlu mengulang):\n${lines.join("\n")}`;
}


setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionStore.entries()) {
    if (now - session.lastAccessed > SESSION_TTL_MS) {
      sessionStore.delete(id);
    }
  }
}, 30 * 60 * 1000);

module.exports = {
  getOrCreateSession,
  updateSessionProfile,
  formatSessionContext,
  sessionStore,
};
