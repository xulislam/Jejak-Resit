(function () {
  'use strict';

  /* ---------- pembantu ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var todayISO = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var keyOf = function (s) {
    var k = String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
    return k || String(s).trim().toLowerCase();
  };
  var fmtDate = function (iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    try { return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso; }
  };
  var newId = function () {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  };
  function h(tag, attrs) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      var v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e[k] = v;
      else e.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  }

  /* ---------- simpanan (IndexedDB) ---------- */
  var DB_NAME = 'jejak-resit', STORE = 'receipts';
  var idb = null;

  function openDB() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('no idb')); return; }
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function dbAll() {
    return new Promise(function (res, rej) {
      var q = idb.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      q.onsuccess = function () { res(q.result || []); };
      q.onerror = function () { rej(q.error); };
    });
  }
  function dbWrite(fn) {
    return new Promise(function (res, rej) {
      var t = idb.transaction(STORE, 'readwrite');
      fn(t.objectStore(STORE));
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error || new Error('abort')); };
    });
  }
  async function saveReceipts(list) {
    if (idb) await dbWrite(function (s) { list.forEach(function (r) { s.put(r); }); });
  }
  async function deleteReceipt(id) {
    if (idb) await dbWrite(function (s) { s.delete(id); });
  }
  function askPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* abaikan */ }
  }

  /* ---------- keadaan ---------- */
  var receipts = [];
  var period = 'all';
  var openKeys = new Set();
  var confirmId = null;
  var pendingFile = null;
  var pendingThumb = '';
  var previewUrl = '';
  var readToken = 0;

  function setStatus(msg, bad) { var s = $('status'); s.textContent = msg || ''; s.className = 'state' + (bad ? ' bad' : ''); }
  function setRv(msg, bad) { var s = $('rv-state'); s.textContent = msg || ''; s.className = 'state' + (bad ? ' bad' : ''); }
  function setData(msg, bad) { var s = $('data-state'); s.textContent = msg || ''; s.className = 'state' + (bad ? ' bad' : ''); }

  /* ---------- ringkasan ---------- */
  function groups() {
    var month = todayISO().slice(0, 7);
    var list = receipts.filter(function (r) { return period === 'all' || String(r.date || '').slice(0, 7) === month; });
    var map = {};
    list.forEach(function (r) {
      var k = r.key || keyOf(r.store || '');
      var g = map[k] || (map[k] = { key: k, name: r.store, total: 0, count: 0, last: '', lastAt: 0, items: [] });
      g.total += Number(r.amount) || 0; g.count++; g.items.push(r);
      if ((r.date || '') >= g.last) {
        g.last = r.date || '';
        if ((r.createdAt || 0) >= g.lastAt) { g.name = r.store; g.lastAt = r.createdAt || 0; }
      }
    });
    var arr = Object.keys(map).map(function (k) { return map[k]; });
    arr.forEach(function (g) {
      g.items.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0); });
    });
    arr.sort(function (a, b) { return b.total - a.total; });
    return { list: list, groups: arr };
  }

  function render() {
    var g = groups();
    var grand = g.groups.reduce(function (s, x) { return s + x.total; }, 0);
    var big = $('grand'); big.textContent = '';
    big.append(h('small', null, 'RM'), fmt(grand));
    $('meta').textContent = g.list.length + ' resit · ' + g.groups.length + ' kedai';

    var empty = $('empty');
    if (!g.groups.length) {
      empty.hidden = false;
      empty.textContent = '';
      if (receipts.length) empty.append(h('strong', null, 'Tiada resit bulan ini'), 'Tukar ke "Semua" untuk melihat resit lama.');
      else empty.append(h('strong', null, 'Belum ada resit'), 'Tambah resit pertama anda. Setiap kali anda membeli di kedai yang sama, jumlahnya ditambah ke kedai itu.');
    } else empty.hidden = true;

    var ul = $('stores'); ul.textContent = '';
    g.groups.forEach(function (s) {
      var open = openKeys.has(s.key);
      var pct = grand > 0 ? Math.max(2, Math.round(s.total / grand * 100)) : 0;
      var btn = h('button', { type: 'button', 'class': 'storebtn', 'aria-expanded': open ? 'true' : 'false', onclick: function () {
        if (openKeys.has(s.key)) openKeys.delete(s.key); else openKeys.add(s.key);
        confirmId = null; render();
      } },
        h('span', { 'class': 'line' }, h('span', { 'class': 'name' }, s.name), h('span', { 'class': 'dots', 'aria-hidden': 'true' }), h('span', { 'class': 'amt' }, 'RM ' + fmt(s.total))),
        h('span', { 'class': 'bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + pct + '%' })),
        h('span', { 'class': 'sub' }, h('span', null, s.count + ' lawatan'), h('span', null, 'Terakhir ' + fmtDate(s.last)))
      );
      var li = h('li', null, btn);
      if (open) {
        var rl = h('ul', { 'class': 'rcpts' });
        s.items.forEach(function (r) {
          var del = confirmId === r.id
            ? h('button', { type: 'button', 'class': 'link danger', onclick: function () { removeReceipt(r.id); } }, 'Sahkan padam')
            : h('button', { type: 'button', 'class': 'link', onclick: function () { confirmId = r.id; render(); } }, 'Padam');
          rl.append(h('li', null,
            r.thumb ? h('img', { src: r.thumb, alt: '' }) : null,
            h('span', { 'class': 'd' }, fmtDate(r.date)),
            h('span', { 'class': 'a' }, 'RM ' + fmt(r.amount)),
            del));
        });
        li.append(rl);
      }
      ul.append(li);
    });

    var dl = $('store-list'); dl.textContent = '';
    var seen = {};
    receipts.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).forEach(function (r) {
      var k = r.key || keyOf(r.store || '');
      if (!seen[k] && r.store) { seen[k] = 1; dl.append(h('option', { value: r.store })); }
    });
  }

  async function removeReceipt(id) {
    try {
      await deleteReceipt(id);
      receipts = receipts.filter(function (r) { return r.id !== id; });
      confirmId = null; render(); setStatus('Resit dipadam.');
    } catch (e) { setStatus('Resit tidak dapat dipadam. Cuba lagi.', true); }
  }

  /* ---------- borang ---------- */
  function closeForm() {
    readToken++;
    $('rv').hidden = true; $('rv').reset();
    pendingFile = null; pendingThumb = '';
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
    $('pv').hidden = true; $('pv').removeAttribute('src');
    setRv('');
    $('b-save').disabled = false;
  }
  function openForm() {
    $('rv').hidden = false;
    $('i-date').value = todayISO();
    $('i-store').focus();
  }

  /* ---------- gambar dan OCR ---------- */
  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); });
    }
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('img')); };
      im.src = u;
    });
  }
  function sizeOf(b) { return { w: b.width || b.naturalWidth, h: b.height || b.naturalHeight }; }

  function makeThumb(bmp) {
    var sz = sizeOf(bmp), s = Math.min(1, 160 / Math.max(sz.w, sz.h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sz.w * s)); c.height = Math.max(1, Math.round(sz.h * s));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    try { return c.toDataURL('image/jpeg', 0.6); } catch (e) { return ''; }
  }

  function prepForOcr(bmp) {
    var sz = sizeOf(bmp), s = Math.min(1, 1800 / Math.max(sz.w, sz.h));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sz.w * s)); c.height = Math.max(1, Math.round(sz.h * s));
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    try {
      var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        g = (g - 128) * 1.35 + 128;
        d[i] = d[i + 1] = d[i + 2] = g < 0 ? 0 : g > 255 ? 255 : g;
      }
      ctx.putImageData(img, 0, 0);
    } catch (e) { /* guna gambar asal */ }
    return c;
  }

  var tessPromise = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!tessPromise) {
      tessPromise = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
        s.onload = res;
        s.onerror = function () { tessPromise = null; rej(new Error('load')); };
        document.head.append(s);
      });
    }
    return tessPromise;
  }

  async function ocr(canvas, onProgress) {
    await loadTesseract();
    var worker = await Tesseract.createWorker('eng', 1, {
      logger: function (m) { if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)); }
    });
    try {
      var out = await worker.recognize(canvas);
      return out.data.text || '';
    } finally {
      try { await worker.terminate(); } catch (e) { /* abaikan */ }
    }
  }

  async function onFile(file) {
    if (!file) return;
    closeForm(); openForm();
    pendingFile = file;
    previewUrl = URL.createObjectURL(file);
    $('pv').src = previewUrl; $('pv').hidden = false;
    var token = ++readToken;
    setRv('Menyediakan gambar…');
    var bmp;
    try { bmp = await loadBitmap(file); } catch (e) { setRv('Gambar tidak dapat dibuka. Pilih gambar lain atau isi manual.', true); return; }
    if (token !== readToken) return;
    pendingThumb = makeThumb(bmp);
    if (!navigator.onLine) { setRv('Tiada internet untuk bacaan automatik. Isi butiran secara manual.'); return; }
    try {
      setRv('Membaca resit…');
      var text = await ocr(prepForOcr(bmp), function (p) { if (token === readToken) setRv('Membaca resit… ' + p + '%'); });
      if (token !== readToken) return;
      var r = JejakParse.parseReceipt(text);
      if (r.store && !$('i-store').value) $('i-store').value = r.store;
      if (r.total > 0 && !$('i-amt').value) $('i-amt').value = r.total.toFixed(2);
      if (r.date && $('i-date').value === todayISO()) $('i-date').value = r.date;
      if (!r.store && !(r.total > 0)) setRv('Teks resit tidak jelas. Isi butiran secara manual.', true);
      else setRv('Semak butiran di atas, ubah jika perlu, kemudian simpan.');
    } catch (e) {
      if (token !== readToken) return;
      setRv('Bacaan automatik gagal. Isi butiran secara manual.', true);
    }
  }

  $('b-cam').onclick = function () { $('f-cam').click(); };
  $('b-pick').onclick = function () { $('f-pick').click(); };
  $('b-manual').onclick = function () { closeForm(); openForm(); setRv('Isi nama kedai dan jumlah dari resit.'); };
  ['f-cam', 'f-pick'].forEach(function (id) {
    $(id).onchange = function (ev) { var f = ev.target.files && ev.target.files[0]; ev.target.value = ''; onFile(f); };
  });
  $('b-cancel').onclick = closeForm;

  $('rv').onsubmit = async function (ev) {
    ev.preventDefault();
    var store = $('i-store').value.trim().replace(/\s+/g, ' ');
    var amount = Math.round(Number($('i-amt').value) * 100) / 100;
    var date = $('i-date').value;
    if (!store) { setRv('Isi nama kedai.', true); return; }
    if (!(amount > 0)) { setRv('Isi jumlah lebih daripada 0.', true); return; }
    if (!date) { setRv('Pilih tarikh pembelian.', true); return; }
    var key = keyOf(store);
    var prev = receipts.filter(function (r) { return (r.key || keyOf(r.store || '')) === key; });
    var prevTotal = prev.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
    var rec = { id: newId(), store: store, key: key, amount: amount, date: date, createdAt: Date.now(), thumb: pendingThumb || '' };
    $('b-save').disabled = true; setRv('Menyimpan…');
    try {
      await saveReceipts([rec]);
      receipts.push(rec);
      var name = prev.length ? prev[0].store : store;
      closeForm();
      openKeys.add(key); render();
      askPersist();
      setStatus('Disimpan. Jumlah belanja di ' + name + ' kini RM ' + fmt(prevTotal + amount) + ' (' + (prev.length + 1) + ' lawatan).' + (idb ? '' : ' Penyimpanan peranti tidak tersedia, data hilang apabila aplikasi ditutup.'));
    } catch (e) {
      $('b-save').disabled = false;
      setRv('Resit tidak dapat disimpan. Ruang peranti mungkin penuh.', true);
    }
  };

  function setPeriod(p) {
    period = p;
    $('p-all').setAttribute('aria-pressed', p === 'all' ? 'true' : 'false');
    $('p-month').setAttribute('aria-pressed', p === 'month' ? 'true' : 'false');
    render();
  }
  $('p-all').onclick = function () { setPeriod('all'); };
  $('p-month').onclick = function () { setPeriod('month'); };

  /* ---------- eksport dan pulih ---------- */
  async function saveFile(name, type, text) {
    var file = new File([text], name, { type: type });
    var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    if (coarse && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    var u = URL.createObjectURL(file);
    var a = h('a', { href: u, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
    return true;
  }
  function csvCell(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  $('b-csv').onclick = async function () {
    if (!receipts.length) { setData('Belum ada resit untuk dieksport.'); return; }
    var rows = receipts.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
      .map(function (r) { return [r.date, r.store, Number(r.amount).toFixed(2)].map(csvCell).join(','); });
    var ok = await saveFile('jejak-resit-' + todayISO() + '.csv', 'text/csv', 'Tarikh,Kedai,Jumlah (RM)\n' + rows.join('\n') + '\n');
    if (ok) setData('CSV sedia.');
  };
  $('b-json').onclick = async function () {
    if (!receipts.length) { setData('Belum ada resit untuk disandarkan.'); return; }
    var ok = await saveFile('jejak-resit-sandaran-' + todayISO() + '.json', 'application/json', JSON.stringify({ app: 'jejak-resit', version: 1, receipts: receipts }));
    if (ok) setData('Sandaran sedia. Simpan fail ini di tempat selamat.');
  };
  $('b-restore').onclick = function () { $('f-restore').click(); };
  $('f-restore').onchange = async function (ev) {
    var f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    try {
      var data = JSON.parse(await f.text());
      var src = Array.isArray(data) ? data : data && data.receipts;
      if (!Array.isArray(src)) throw new Error('format');
      var have = new Set(receipts.map(function (r) { return r.id; }));
      var add = [];
      src.forEach(function (r) {
        if (!r || typeof r !== 'object') return;
        var store = String(r.store || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        var amount = Math.round(Number(r.amount) * 100) / 100;
        var date = String(r.date || '');
        if (!store || !(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        var id = typeof r.id === 'string' && r.id.length < 80 ? r.id : newId();
        if (have.has(id)) return;
        have.add(id);
        add.push({
          id: id, store: store, key: keyOf(store), amount: amount, date: date,
          createdAt: Number(r.createdAt) || Date.now(),
          thumb: typeof r.thumb === 'string' && r.thumb.indexOf('data:image/') === 0 && r.thumb.length < 60000 ? r.thumb : ''
        });
      });
      await saveReceipts(add);
      receipts = receipts.concat(add);
      render();
      setData(add.length + ' resit dipulihkan.');
    } catch (e) { setData('Fail sandaran tidak sah.', true); }
  };

  /* ---------- pasang ke skrin utama ---------- */
  var deferred = null;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (standalone) return;
    $('install').hidden = false; $('b-install').hidden = false;
  });
  window.addEventListener('appinstalled', function () { deferred = null; $('install').hidden = true; });
  $('b-install').onclick = async function () {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* abaikan */ }
    deferred = null; $('install').hidden = true;
  };
  if (isIOS && !standalone) {
    $('install').hidden = false;
    $('install-hint').textContent = 'Di Safari, ketik butang Kongsi, kemudian "Tambah ke Skrin Utama".';
  }

  /* ---------- mula ---------- */
  render();
  (async function init() {
    try { idb = await openDB(); receipts = await dbAll(); render(); }
    catch (e) { idb = null; setStatus('Penyimpanan peranti tidak tersedia. Data hilang apabila aplikasi ditutup.', true); }
  })();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* tanpa luar talian */ }); });
  }
})();
