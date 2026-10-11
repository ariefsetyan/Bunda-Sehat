/**
 * Guardrail Keamanan Medis untuk Bunda Sehat
 * Memeriksa kata kunci bahaya (red flags) pada ibu hamil, nifas, bayi, dan balita.
 * Jika ditemukan tanda bahaya, sistem LANGSUNG membalas peringatan darurat statis
 * TANPA memanggil model LLM untuk mencegah halusinasi medis.
 */

// Daftar kata kunci dan frasa bahaya kritis (case-insensitive)
const EMERGENCY_KEYWORDS = [
  // 1. Tanda Bahaya Kehamilan & Persalinan (Buku KIA Kemenkes)
  { phrase: "perdarahan", label: "Perdarahan pada kehamilan/nifas" },
  { phrase: "keluar darah", label: "Pendarahan dari jalan lahir" },
  { phrase: "pendarahan hebat", label: "Pendarahan hebat" },
  { phrase: "flek banyak", label: "Perdarahan aktif" },
  { phrase: "ketuban pecah", label: "Ketuban pecah dini" },
  { phrase: "air ketuban", label: "Ketuban merembes/pecah" },
  { phrase: "gerak janin berkurang", label: "Penurunan gerakan janin" },
  { phrase: "janin tidak bergerak", label: "Janin tidak bergerak" },
  { phrase: "bayi tidak bergerak", label: "Janin/bayi tidak bergerak" },
  { phrase: "pandangan kabur", label: "Tanda preeklampsia/eklampsia" },
  { phrase: "mata berkunang", label: "Tanda preeklampsia" },
  { phrase: "nyeri ulu hati hebat", label: "Tanda preeklampsia berat" },
  { phrase: "bengkak di wajah", label: "Edema/tanda preeklampsia" },

  // 2. Tanda Bahaya Umum & Kritis (Bayi, Anak, dan Ibu)
  { phrase: "kejang", label: "Kejang / Step" },
  { phrase: "tidak sadar", label: "Penurunan kesadaran" },
  { phrase: "pingsan", label: "Hilang kesadaran" },
  { phrase: "hilang kesadaran", label: "Hilang kesadaran" },
  { phrase: "tidak merespons", label: "Tidak merespons / letargis" },
  { phrase: "sangat lemas", label: "Letargis / lemas berat" },
  { phrase: "sesak napas", label: "Sesak napas / distress pernapasan" },
  { phrase: "napas sesak", label: "Sesak napas" },
  { phrase: "napas bunyi", label: "Stridor / napas berbunyi mengi/megap" },
  { phrase: "napas megap", label: "Distress pernapasan akut" },
  { phrase: "tarikan dada", label: "Tarikan dinding dada ke dalam" },
  { phrase: "bibir biru", label: "Sianosis / kekurangan oksigen" },
  { phrase: "kulit biru", label: "Sianosis / kekurangan oksigen" },
  { phrase: "membiru", label: "Sianosis" },

  // 3. Tanda Bahaya Bayi Baru Lahir & Balita
  { phrase: "muntah terus", label: "Muntah persisten / risiko dehidrasi berat" },
  { phrase: "tidak mau menyusu", label: "Penolakan minum total pada bayi" },
  { phrase: "tidak bisa minum", label: "Tidak bisa minum / dehidrasi akut" },
  { phrase: "demam tinggi bayi", label: "Demam pada bayi muda" },
  { phrase: "demam kejang", label: "Kejang demam" },
  { phrase: "tinja berdarah", label: "Perdarahan saluran cerna" },
  { phrase: "bab berdarah", label: "Perdarahan saluran cerna" },
  { phrase: "kuning sampai kaki", label: "Ikterus patologis berat" },
];

/**
 * Pesan Darurat Statis Resmi (Tidak dihasilkan oleh LLM)
 */
function buildEmergencyMessage(detectedLabels = []) {
  const detailTanda =
    detectedLabels.length > 0
      ? `\n**Tanda bahaya yang terdeteksi:** ${detectedLabels.join(", ")}.\n`
      : "";

  return `🚨 **PERINGATAN DARURAT MEDIS (RED FLAG)** 🚨
${detailTanda}
Kondisi yang Anda sampaikan merupakan **tanda bahaya medis** yang membutuhkan penanganan segera dan tidak dapat ditunda dengan konsultasi daring!

Segera lakukan langkah darurat berikut:
1. **SEGERA KE IGD / FASILITAS KESEHATAN:** Bawa ibu / anak ke Unit Gawat Darurat (IGD) rumah sakit, puskesmas 24 jam, atau hubungi ambulans / layanan darurat **119**.
2. **JANGAN PANIK:** Pastikan jalan napas tetap aman, baringkan di tempat yang datar dan aman.
3. **PADA KONDISI KEJANG / HILANG KESADARAN:** Jangan memasukkan benda atau sendok apa pun ke dalam mulut dan jangan memberikan makanan atau minuman.
4. **BAWA DOKUMEN:** Jangan lupa membawa Buku KIA (buku pink), kartu identitas, dan riwayat obat yang sedang dikonsumsi.

*Pesan ini dikeluarkan otomatis oleh sistem guardrail keselamatan medis Bunda Sehat rujukan panduan Kementerian Kesehatan RI.*`;
}

/**
 * Memeriksa apakah teks pesan mengandung kata kunci bahaya
 * @param {string} text
 * @returns {{ isEmergency: boolean, message: string|null, detectedLabels: string[] }}
 */
function checkEmergencyKeywords(text) {
  if (!text || typeof text !== "string") {
    return { isEmergency: false, message: null, detectedLabels: [] };
  }

  const normalizedText = text.toLowerCase();
  const matched = [];

  for (const item of EMERGENCY_KEYWORDS) {
    if (normalizedText.includes(item.phrase)) {
      if (!matched.includes(item.label)) {
        matched.push(item.label);
      }
    }
  }

  if (matched.length > 0) {
    return {
      isEmergency: true,
      message: buildEmergencyMessage(matched),
      detectedLabels: matched,
    };
  }

  return { isEmergency: false, message: null, detectedLabels: [] };
}

module.exports = {
  checkEmergencyKeywords,
  EMERGENCY_KEYWORDS,
  buildEmergencyMessage,
};
