const fs = require("fs");
const path = require("path");

const MPASI_DATA_PATH = path.join(__dirname, "data", "mpasi.json");
let rawData = null;

function getMPASIData() {
  if (!rawData) {
    const content = fs.readFileSync(MPASI_DATA_PATH, "utf-8");
    rawData = JSON.parse(content);
  }
  return rawData;
}


function getRekomendasiMPASI(usiaBulanInput) {
  const usiaBulan = parseFloat(usiaBulanInput);
  if (isNaN(usiaBulan) || usiaBulan < 0) {
    return {
      success: false,
      error: "Usia anak dalam bulan harus berupa angka positif, misalnya 6, 7, atau 9.",
    };
  }

  const data = getMPASIData();

  if (usiaBulan < 6) {
    return {
      success: true,
      usiaBulan,
      kategori: "ASI Eksklusif (Belum Waktunya MPASI)",
      pesanKunci:
        "Bayi berusia di bawah 6 bulan disarankan hanya mendapatkan ASI Eksklusif tanpa makanan atau cairan tambahan apa pun (termasuk air putih atau madu), kecuali atas indikasi medis langsung dari dokter spesialis anak.",
      alasan:
        "Saluran cerna dan ginjal bayi belum matang sempurna untuk mencerna makanan padat, serta refleks menelan dan menegakkan leher belum optimal.",
      sumber: data.sumber,
    };
  }

  let matchedTahapan = null;
  for (const t of data.tahapan) {
    if (usiaBulan >= t.usiaMinBulan && usiaBulan <= t.usiaMaxBulan) {
      matchedTahapan = t;
      break;
    }
  }

  if (!matchedTahapan && usiaBulan >= 24) {
    matchedTahapan = {
      rentangUsia: "2 tahun ke atas (Batita/Balita)",
      tekstur: "Makanan keluarga penuh seperti orang dewasa, dengan gizi seimbang.",
      porsiPerMakan: "1 mangkuk penuh / porsi makan anak balita (sekitar 250 - 300 ml).",
      frekuensi: "3 kali makan utama per hari ditambah 2 kali camilan sehat (buah, susu, puding sehat).",
      komposisiWajib: "Gizi seimbang: karbohidrat, protein hewani, protein nabati, sayuran, dan buah-buahan.",
      contohMenu: [
        "Nasi + ayam bumbu kecap manis + sup jamur wortel + tempe goreng.",
        "Nasi + ikan bakar/kuah asam segar + tumis buncis + tahu kukus."
      ],
      fingerFood: "Buah potong segar, jagung rebus manis, edamame kupas."
    };
  }

  return {
    success: true,
    usiaBulan,
    rentangUsia: matchedTahapan ? matchedTahapan.rentangUsia : `${usiaBulan} bulan`,
    tekstur: matchedTahapan ? matchedTahapan.tekstur : "Sesuai kemampuan kunyah anak",
    porsiPerMakan: matchedTahapan ? matchedTahapan.porsiPerMakan : "1/2 - 1 mangkuk",
    frekuensi: matchedTahapan ? matchedTahapan.frekuensi : "3 kali makan utama + 1-2 snack",
    komposisiWajib: matchedTahapan ? matchedTahapan.komposisiWajib : "Protein Hewani, Karbohidrat, Lemak, Sayur",
    contohMenu: matchedTahapan ? matchedTahapan.contohMenu : [],
    fingerFood: matchedTahapan ? matchedTahapan.fingerFood : null,
    pantanganDanPeringatan: data.pantanganDanPeringatan,
    sumber: data.sumber,
  };
}

module.exports = {
  getRekomendasiMPASI,
  getMPASIData,
};
