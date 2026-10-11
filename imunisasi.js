const fs = require("fs");
const path = require("path");

const IMUNISASI_DATA_PATH = path.join(__dirname, "data", "imunisasi.json");
let rawData = null;

function getImunisasiData() {
  if (!rawData) {
    const fileContent = fs.readFileSync(IMUNISASI_DATA_PATH, "utf-8");
    rawData = JSON.parse(fileContent);
  }
  return rawData;
}

const BULAN_INDONESIA = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agu: 7, ags: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  desember: 11, des: 11,
};

/**
 * Parsing tanggal dari berbagai format (ISO, DD/MM/YYYY, teks Indonesia)
 * @param {string|Date} dateInput
 * @returns {Date|null}
 */
function parseTanggal(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput;
  }

  const str = String(dateInput).trim().toLowerCase();

  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    if (!isNaN(d.getTime())) return d;
  }

  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const d = new Date(parseInt(slashMatch[3], 10), parseInt(slashMatch[2], 10) - 1, parseInt(slashMatch[1], 10));
    if (!isNaN(d.getTime())) return d;
  }

  const textMatch = str.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2];
    const year = parseInt(textMatch[3], 10);
    if (BULAN_INDONESIA[monthName] !== undefined) {
      const d = new Date(year, BULAN_INDONESIA[monthName], day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const nativeParse = new Date(dateInput);
  if (!isNaN(nativeParse.getTime())) {
    return nativeParse;
  }

  return null;
}


function formatTanggalIndo(date) {
  if (!date) return "";
  const namaBulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${date.getDate()} ${namaBulan[date.getMonth()]} ${date.getFullYear()}`;
}


function hitungUsia(birthDate, referenceDate) {
  let years = referenceDate.getFullYear() - birthDate.getFullYear();
  let months = referenceDate.getMonth() - birthDate.getMonth();
  let days = referenceDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;
  let labelUsia = "";
  if (years > 0) {
    labelUsia = `${years} tahun ${months} bulan ${days} hari`;
  } else if (months > 0) {
    labelUsia = `${months} bulan ${days} hari`;
  } else {
    labelUsia = `${days} hari`;
  }

  return { years, months, days, totalMonths, labelUsia };
}


function tambahBulan(date, bulan) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + bulan);
  return result;
}

/**
 * Fungsi Utama: Menghitung Jadwal Imunisasi
 * @param {string|Date} tanggalLahir Input tanggal lahir anak
 * @param {string|Date} [tanggalSekarang] Tanggal patokan (default hari ini)
 */
function hitungJadwalImunisasi(tanggalLahir, tanggalSekarang = new Date()) {
  const birthDate = parseTanggal(tanggalLahir);
  if (!birthDate) {
    return {
      success: false,
      error: `Format tanggal lahir "${tanggalLahir}" tidak valid. Contoh format yang diterima: "1 Maret 2026" atau "2026-03-01".`,
    };
  }

  const refDate = parseTanggal(tanggalSekarang) || new Date();
  if (birthDate > refDate) {
    return {
      success: false,
      error: `Tanggal lahir (${formatTanggalIndo(birthDate)}) tidak boleh berada di masa depan.`,
    };
  }

  const usia = hitungUsia(birthDate, refDate);
  const data = getImunisasiData();

  const jadwalLengkap = [];
  let imunisasiTerdekat = null;

  for (const item of data.daftar) {
    const tanggalTarget = tambahBulan(birthDate, item.usiaBulan);
    let status = "mendatang";

    if (item.usiaBulan < usia.totalMonths) {
      status = "sudah_lewat";
    } else if (item.usiaBulan === usia.totalMonths) {
      status = "bulan_ini";
    } else {
      status = "mendatang";
    }

    const infoJadwal = {
      id: item.id,
      usiaBulan: item.usiaBulan,
      namaVaksin: item.namaVaksin,
      tanggalTarget: formatTanggalIndo(tanggalTarget),
      status: status,
      mencegah: item.mencegah,
      catatan: item.catatan,
    };

    jadwalLengkap.push(infoJadwal);

    if (!imunisasiTerdekat) {
      if (status === "bulan_ini") {
        imunisasiTerdekat = infoJadwal;
      } else if (status === "mendatang") {
        imunisasiTerdekat = infoJadwal;
      }
    }
  }

  const ringkasan = {
    sudahLewat: jadwalLengkap.filter((j) => j.status === "sudah_lewat"),
    bulanIni: jadwalLengkap.filter((j) => j.status === "bulan_ini"),
    mendatang: jadwalLengkap.filter((j) => j.status === "mendatang"),
  };

  return {
    success: true,
    tanggalLahirFormatted: formatTanggalIndo(birthDate),
    usiaAnak: usia.labelUsia,
    totalUsiaBulan: usia.totalMonths,
    jadwalLengkap,
    ringkasan,
    imunisasiTerdekat: imunisasiTerdekat || null,
    sumber: data.sumber,
  };
}

module.exports = {
  hitungJadwalImunisasi,
  parseTanggal,
  formatTanggalIndo,
  hitungUsia,
};
