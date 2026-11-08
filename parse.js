/* Membaca nama kedai, jumlah dan tarikh daripada teks OCR sesebuah resit. Boleh dijalankan di pelayar dan Node. */
(function (root) {
  'use strict';

  var MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, mei:5, jun:6, jul:7, aug:8, ogo:8, sep:9, oct:10, okt:10, nov:11, dec:12, dis:12 };

  function pad(n) { return String(n).padStart(2, '0'); }

  function mkDate(y, m, d) {
    var dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
    var now = new Date();
    var limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    if (y < 2000 || dt > limit) return '';
    return y + '-' + pad(m) + '-' + pad(d);
  }

  function guessDate(text) {
    var m;
    if ((m = text.match(/\b(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])\b/))) {
      var a = mkDate(+m[1], +m[2], +m[3]); if (a) return a;
    }
    if ((m = text.match(/\b(0?[1-9]|[12]\d|3[01])[-\/.](0?[1-9]|1[0-2])[-\/.](20\d{2}|\d{2})\b/))) {
      var y = +m[3]; if (y < 100) y += 2000;
      var b = mkDate(y, +m[2], +m[1]); if (b) return b;
    }
    if ((m = text.match(/\b(0?[1-9]|[12]\d|3[01])[\s\-]*([A-Za-z]{3,9})[\s\-,.]*(20\d{2}|\d{2})\b/))) {
      var mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
      if (mo) {
        var yy = +m[3]; if (yy < 100) yy += 2000;
        var c = mkDate(yy, mo, +m[1]); if (c) return c;
      }
    }
    return '';
  }

  function parseAmounts(line) {
    var out = [];
    var re = /(\d{1,3}(?:[ ,]\d{3})+|\d+)[.,](\d{2})(?!\d)/g;
    var m;
    while ((m = re.exec(line))) {
      out.push(parseFloat(m[1].replace(/[ ,]/g, '') + '.' + m[2]));
    }
    return out;
  }

  var DATE_LINE = /\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b|\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b|\b\d{1,2}:\d{2}\b/;
  var STRONG = /grand\s*total|amount\s*(due|payable)|net+\s*total|jumlah\s*(besar|bayaran|perlu\s*dibayar|bayar)|total\s*(due|payable|bayar|amount)|bayaran\s*perlu/i;
  var WEAK = /total|jumlah/i;
  var SKIP = /sub\s*-?\s*total|total\s*(qty|item|quantity|kuantiti)|(total|jumlah)\s*(tax|gst|sst|cukai|disc|diskaun|saving|jimat)|change|baki|tunai|cash|tender|rounding|pembulatan|discount|diskaun|visa|master|debit|credit|kad|card/i;

  function guessTotal(lines) {
    var best = null;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var strong = STRONG.test(l);
      if (!strong && !WEAK.test(l)) continue;
      if (SKIP.test(l) && !strong) continue;
      var amts = parseAmounts(l);
      if (!amts.length && i + 1 < lines.length && !SKIP.test(lines[i + 1])) amts = parseAmounts(lines[i + 1]);
      if (!amts.length) continue;
      var score = strong ? 3 : 2;
      var val = amts[amts.length - 1];
      if (!(val > 0)) continue;
      if (!best || score >= best.score) best = { score: score, val: val };
    }
    if (best) return best.val;
    var max = 0;
    lines.forEach(function (l) {
      if (DATE_LINE.test(l) || SKIP.test(l)) return;
      parseAmounts(l).forEach(function (v) { if (v > max && v < 100000) max = v; });
    });
    return max > 0 ? max : 0;
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, function (_, a, b) { return a + b.toUpperCase(); });
  }

  var NOT_STORE = /^(tel|fax|phone|hp|gst|sst|reg|co\.?\s*no|company\s*no|no\.?\s|invoice|receipt|resit|tax|cashier|date|tarikh|www|http|welcome|selamat|thank|terima)/i;

  function guessStore(lines) {
    var top = lines.slice(0, 10);
    for (var i = 0; i < top.length; i++) {
      var l = top[i].replace(/[^\p{L}\p{N}&'.\- ]/gu, ' ').replace(/\s+/g, ' ').trim();
      var letters = (l.match(/\p{L}/gu) || []).length;
      var visible = l.replace(/\s/g, '').length;
      if (letters < 3 || !visible || letters / visible < 0.6) continue;
      if (NOT_STORE.test(l) || /\d{5,}/.test(l)) continue;
      l = l.replace(/^[.\- ]+|[.\- ]+$/g, '');
      if (l === l.toUpperCase()) l = titleCase(l);
      return l.slice(0, 80);
    }
    return '';
  }

  function parseReceipt(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    return { store: guessStore(lines), total: guessTotal(lines), date: guessDate(String(text || '')) };
  }

  var api = { parseReceipt: parseReceipt, guessDate: guessDate, guessTotal: guessTotal, guessStore: guessStore };
  root.JejakParse = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
