/**
 * Presensi GPS + Selfie — Google Apps Script
 * Maliki Studio (malikisaputra.biz.id) · Lisensi Nonkomersial Maliki Studio
 *
 * Langkah singkat: jalankan setup() sekali, isi sheet "Pengaturan" & "Karyawan",
 * lalu Deploy → New deployment → Web app. Detail ada di README.md.
 */

var SHEET_KARYAWAN = 'Karyawan';
var SHEET_PRESENSI = 'Presensi';
var SHEET_PENGATURAN = 'Pengaturan';
var KOLOM_PRESENSI = ['Waktu', 'Tanggal', 'ID', 'Nama', 'Jenis', 'Status', 'Telat (menit)', 'Jarak (m)', 'Akurasi (m)', 'Latitude', 'Longitude', 'Foto', 'Perangkat'];

// ===================== Logo instansi =====================
// Satu-satunya tempat mengatur logo. Isi URL gambar publik (https://...png/svg)
// atau link berbagi Google Drive ("Siapa saja yang memiliki link"). Kosong = pakai inisial.
var LOGO_URL = '';
var LOGO_INISIAL = 'P';

function logoUrl_() {
  var u = String(LOGO_URL || '').trim();
  var m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  return m ? 'https://lh3.googleusercontent.com/d/' + m[1] : u;
}

var PENGATURAN_AWAL = [
  ['nama_kantor', 'Kantor Pusat', 'Nama lokasi yang tampil di aplikasi'],
  ['lat_kantor', '-6.917464', 'Latitude titik kantor (klik kanan di Google Maps untuk menyalin)'],
  ['lng_kantor', '107.619123', 'Longitude titik kantor'],
  ['radius_meter', '100', 'Jarak maksimal dari titik kantor'],
  ['akurasi_maks', '150', 'Tolak jika akurasi GPS lebih buruk dari ini (meter)'],
  ['jam_masuk', '08:00', 'Format HH:MM'],
  ['toleransi_menit', '10', 'Lewat jam_masuk + toleransi = Telat'],
  ['jam_pulang', '17:00', 'Pulang sebelum jam ini = Pulang Cepat'],
  ['wajib_foto', 'ya', 'ya / tidak'],
  ['kunci_admin', 'ganti-kunci-ini', 'Kata sandi halaman admin (?page=admin)'],
  ['folder_foto_id', '', 'Diisi otomatis oleh setup()']
];

// ===================== Halaman =====================
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'index';
  var file = page === 'admin' ? 'admin' : 'index';
  var t = HtmlService.createTemplateFromFile(file);
  t.logoUrl = logoUrl_();
  t.logoInisial = LOGO_INISIAL;
  return t.evaluate()
    .setTitle(page === 'admin' ? 'Admin Presensi' : 'Presensi')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

// ===================== Setup otomatis =====================
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka skrip ini dari Google Sheet (Ekstensi → Apps Script).');

  var k = ss.getSheetByName(SHEET_KARYAWAN) || ss.insertSheet(SHEET_KARYAWAN);
  if (k.getLastRow() === 0) {
    k.appendRow(['ID', 'Nama', 'Jabatan', 'PIN', 'Aktif']);
    k.appendRow(['K001', 'Budi Santoso', 'Staf Gudang', '1234', 'ya']);
    k.appendRow(['K002', 'Siti Rahma', 'Admin', '5678', 'ya']);
    k.getRange('D:D').setNumberFormat('@');
    gayaHeader_(k, 5);
  }

  var p = ss.getSheetByName(SHEET_PRESENSI) || ss.insertSheet(SHEET_PRESENSI);
  if (p.getLastRow() === 0) {
    p.appendRow(KOLOM_PRESENSI);
    gayaHeader_(p, KOLOM_PRESENSI.length);
    p.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    p.getRange('B:B').setNumberFormat('@');
  }

  var s = ss.getSheetByName(SHEET_PENGATURAN) || ss.insertSheet(SHEET_PENGATURAN);
  if (s.getLastRow() === 0) {
    s.appendRow(['Kunci', 'Nilai', 'Keterangan']);
    PENGATURAN_AWAL.forEach(function (r) { s.appendRow(r); });
    s.getRange('B:B').setNumberFormat('@');
    gayaHeader_(s, 3);
    s.autoResizeColumns(1, 3);
  }

  var cfg = bacaPengaturan_();
  if (!cfg.folder_foto_id) {
    var folder = DriveApp.createFolder('Foto Presensi - ' + ss.getName());
    simpanPengaturan_('folder_foto_id', folder.getId());
  }

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);

  tryAlert_('Setup selesai. Isi sheet Pengaturan & Karyawan, lalu Deploy sebagai Web App.');
}

function gayaHeader_(sh, n) {
  sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#0b1f3a').setFontColor('#ffffff');
  sh.setFrozenRows(1);
}
function tryAlert_(m) { try { SpreadsheetApp.getUi().alert(m); } catch (e) { Logger.log(m); } }

// ===================== Pengaturan =====================
function bacaPengaturan_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PENGATURAN);
  var cfg = {};
  if (!sh) return cfg;
  sh.getDataRange().getValues().slice(1).forEach(function (r) { if (r[0]) cfg[String(r[0]).trim()] = String(r[1]).trim(); });
  return cfg;
}
function simpanPengaturan_(kunci, nilai) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PENGATURAN);
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === kunci) { sh.getRange(i + 1, 2).setValue(nilai); return; }
  sh.appendRow([kunci, nilai, '']);
}

// ===================== Logika murni (bisa diuji di Node) =====================
/** Jarak dua titik (meter) dengan rumus haversine. */
function haversine_(lat1, lng1, lat2, lng2) {
  var R = 6371000, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
function keMenit_(hhmm) { var p = String(hhmm || '00:00').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }

/** Hitung status masuk/pulang dari jam (menit sejak 00:00). */
function hitungStatus_(jenis, menitSekarang, cfg) {
  if (jenis === 'Masuk') {
    var batas = keMenit_(cfg.jam_masuk) + (+cfg.toleransi_menit || 0);
    var telat = Math.max(0, menitSekarang - keMenit_(cfg.jam_masuk));
    return menitSekarang > batas ? { status: 'Telat', telat: telat } : { status: 'Tepat Waktu', telat: 0 };
  }
  return menitSekarang < keMenit_(cfg.jam_pulang) ? { status: 'Pulang Cepat', telat: 0 } : { status: 'Pulang', telat: 0 };
}

/** Validasi aturan presensi. riwayatHariIni = daftar jenis yang sudah tercatat hari ini. */
function validasi_(data, cfg, riwayatHariIni) {
  if (data.jenis !== 'Masuk' && data.jenis !== 'Pulang') return 'Jenis presensi tidak dikenal.';
  if (!isFinite(data.lat) || !isFinite(data.lng)) return 'Lokasi tidak terbaca. Aktifkan GPS lalu coba lagi.';
  var akurasiMaks = +cfg.akurasi_maks || 150;
  if (data.akurasi && data.akurasi > akurasiMaks) return 'Sinyal GPS kurang akurat (±' + Math.round(data.akurasi) + ' m). Pindah ke area terbuka lalu coba lagi.';
  var jarak = haversine_(+cfg.lat_kantor, +cfg.lng_kantor, data.lat, data.lng);
  var radius = +cfg.radius_meter || 100;
  if (jarak > radius) return 'Kamu berada ' + Math.round(jarak) + ' m dari ' + (cfg.nama_kantor || 'kantor') + '. Batas radius ' + radius + ' m.';
  if (riwayatHariIni.indexOf(data.jenis) > -1) return 'Kamu sudah presensi ' + data.jenis.toLowerCase() + ' hari ini.';
  if (data.jenis === 'Pulang' && riwayatHariIni.indexOf('Masuk') < 0) return 'Belum ada presensi masuk hari ini.';
  if (String(cfg.wajib_foto).toLowerCase() === 'ya' && !data.foto) return 'Foto selfie wajib diambil.';
  return '';
}

// ===================== API untuk index.html =====================
function getInfo() {
  var cfg = bacaPengaturan_();
  return {
    kantor: cfg.nama_kantor, lat: +cfg.lat_kantor, lng: +cfg.lng_kantor, radius: +cfg.radius_meter || 100,
    jamMasuk: cfg.jam_masuk, jamPulang: cfg.jam_pulang, wajibFoto: String(cfg.wajib_foto).toLowerCase() === 'ya',
    zona: Session.getScriptTimeZone()
  };
}

function cariKaryawan_(id, pin) {
  var v = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KARYAWAN).getDataRange().getDisplayValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim().toUpperCase() === String(id).trim().toUpperCase()) {
      if (String(v[i][4]).toLowerCase() === 'tidak') return { error: 'Akun nonaktif. Hubungi admin.' };
      if (String(v[i][3]).trim() !== String(pin).trim()) return { error: 'PIN salah.' };
      return { id: v[i][0], nama: v[i][1], jabatan: v[i][2] };
    }
  }
  return { error: 'ID karyawan tidak ditemukan.' };
}

/** Cek login + status hari ini (dipanggil saat karyawan masuk ke aplikasi). */
function cekKaryawan(id, pin) {
  var k = cariKaryawan_(id, pin);
  if (k.error) return k;
  k.hariIni = riwayatHariIni_(k.id);
  return k;
}

function riwayatHariIni_(id) {
  var tz = Session.getScriptTimeZone();
  var tgl = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PRESENSI);
  var n = sh.getLastRow();
  if (n < 2) return [];
  var mulai = Math.max(2, n - 1500); // cukup cek baris terbaru agar cepat
  var v = sh.getRange(mulai, 1, n - mulai + 1, 5).getDisplayValues();
  return v.filter(function (r) { return r[1] === tgl && String(r[2]).toUpperCase() === String(id).toUpperCase(); })
    .map(function (r) { return r[4]; });
}

/** Simpan presensi. data: {id,pin,jenis,lat,lng,akurasi,foto(dataURL),perangkat} */
function absen(data) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, pesan: 'Server sedang sibuk, coba lagi.' };
  try {
    var k = cariKaryawan_(data.id, data.pin);
    if (k.error) return { ok: false, pesan: k.error };
    var cfg = bacaPengaturan_();
    data.lat = parseFloat(data.lat); data.lng = parseFloat(data.lng); data.akurasi = parseFloat(data.akurasi) || 0;
    var salah = validasi_(data, cfg, riwayatHariIni_(k.id));
    if (salah) return { ok: false, pesan: salah };

    var tz = Session.getScriptTimeZone(), now = new Date();
    var menit = +Utilities.formatDate(now, tz, 'H') * 60 + +Utilities.formatDate(now, tz, 'm');
    var st = hitungStatus_(data.jenis, menit, cfg);
    var jarak = Math.round(haversine_(+cfg.lat_kantor, +cfg.lng_kantor, data.lat, data.lng));

    var urlFoto = '';
    if (data.foto) {
      var m = String(data.foto).match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
      if (!m) return { ok: false, pesan: 'Format foto tidak valid.' };
      if (m[2].length > 2500000) return { ok: false, pesan: 'Foto terlalu besar.' };
      var nama = Utilities.formatDate(now, tz, 'yyyyMMdd-HHmmss') + '_' + k.id + '_' + data.jenis + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
      var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), 'image/' + m[1], nama);
      var folder = DriveApp.getFolderById(cfg.folder_foto_id);
      urlFoto = folder.createFile(blob).getUrl();
    }

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PRESENSI).appendRow([
      now, Utilities.formatDate(now, tz, 'yyyy-MM-dd'), k.id, k.nama, data.jenis, st.status, st.telat,
      jarak, Math.round(data.akurasi), data.lat, data.lng, urlFoto, String(data.perangkat || '').slice(0, 120)
    ]);
    return { ok: true, nama: k.nama, jenis: data.jenis, status: st.status, telat: st.telat, jarak: jarak, jam: Utilities.formatDate(now, tz, 'HH:mm') };
  } finally {
    lock.releaseLock();
  }
}

// ===================== API untuk admin.html =====================
function cekAdmin_(kunci) {
  var cfg = bacaPengaturan_();
  if (!kunci || kunci !== cfg.kunci_admin) throw new Error('Kunci admin salah.');
  return cfg;
}

/** mode: 'hari' (tanggal yyyy-MM-dd) atau 'bulan' (yyyy-MM). */
function rekap(kunci, mode, nilai) {
  cekAdmin_(kunci);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var kar = ss.getSheetByName(SHEET_KARYAWAN).getDataRange().getDisplayValues().slice(1)
    .filter(function (r) { return r[0] && String(r[4]).toLowerCase() !== 'tidak'; })
    .map(function (r) { return { id: r[0], nama: r[1], jabatan: r[2] }; });
  var sh = ss.getSheetByName(SHEET_PRESENSI);
  var baris = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, KOLOM_PRESENSI.length).getDisplayValues() : [];
  var cocok = baris.filter(function (r) { return mode === 'bulan' ? r[1].slice(0, 7) === nilai : r[1] === nilai; });
  return olahRekap_(kar, cocok, mode);
}

/** Bagian murni dari rekap (bisa diuji di Node). */
function olahRekap_(karyawan, baris, mode) {
  if (mode === 'hari') {
    return {
      mode: 'hari',
      baris: karyawan.map(function (k) {
        var m = baris.filter(function (r) { return r[2] === k.id && r[4] === 'Masuk'; })[0];
        var p = baris.filter(function (r) { return r[2] === k.id && r[4] === 'Pulang'; })[0];
        return {
          id: k.id, nama: k.nama, jabatan: k.jabatan,
          masuk: m ? m[0].slice(11, 16) : '', pulang: p ? p[0].slice(11, 16) : '',
          status: m ? m[5] : 'Belum hadir', telat: m ? +m[6] : 0, jarak: m ? +m[7] : '', foto: m ? m[11] : '', fotoPulang: p ? p[11] : ''
        };
      })
    };
  }
  return {
    mode: 'bulan',
    baris: karyawan.map(function (k) {
      var milik = baris.filter(function (r) { return r[2] === k.id && r[4] === 'Masuk'; });
      var hari = {};
      milik.forEach(function (r) { hari[r[1]] = r[5]; });
      var tgl = Object.keys(hari);
      return {
        id: k.id, nama: k.nama, jabatan: k.jabatan,
        hadir: tgl.length,
        tepat: tgl.filter(function (t) { return hari[t] === 'Tepat Waktu'; }).length,
        telat: tgl.filter(function (t) { return hari[t] === 'Telat'; }).length,
        totalTelat: milik.reduce(function (s, r) { return s + (+r[6] || 0); }, 0),
        pulangCepat: baris.filter(function (r) { return r[2] === k.id && r[5] === 'Pulang Cepat'; }).length
      };
    })
  };
}

/** Data mentah untuk ekspor CSV di admin. */
function dataMentah(kunci, mode, nilai) {
  cekAdmin_(kunci);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PRESENSI);
  var v = sh.getDataRange().getDisplayValues();
  return [v[0]].concat(v.slice(1).filter(function (r) { return mode === 'bulan' ? r[1].slice(0, 7) === nilai : r[1] === nilai; }));
}

// Ekspor untuk pengujian di Node (diabaikan oleh Apps Script)
if (typeof module !== 'undefined') module.exports = { haversine_: haversine_, hitungStatus_: hitungStatus_, validasi_: validasi_, olahRekap_: olahRekap_, keMenit_: keMenit_ };
