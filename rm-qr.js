// QR scans reveal RM inventory context only. All stock changes remain in the reviewed forms.
(() => {
  const $ = id => document.getElementById(id);
  const input = $('rmQrScanInput');
  const status = $('rmQrScanStatus');
  const results = $('rmQrScanResults');
  const cameraView = $('rmQrCameraView');
  const startButton = $('rmQrCameraStart');
  const stopButton = $('rmQrCameraStop');
  const printStatus = $('rmQrPrintStatus');
  const locations = Object.entries(FLOORPLAN.slots).map(([slotId, slot]) => ({
    slotId, code: slot.code, zone: slot.code.split('-')[0]
  }));
  let selectedProductCode = '';
  let camera = null, cameraRunning = false, cameraStarting = false, cameraGeneration = 0;
  let lastScan = '', lastScanAt = 0;

  function products() {
    const byCode = new Map();
    for (const item of STOCK.items || []) {
      if (item?.code) byCode.set(String(item.code).trim().toUpperCase(), item);
    }
    for (const items of Object.values(SLOT_INVENTORY)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const key = String(item?.code || '').trim().toUpperCase();
        if (key && !byCode.has(key)) byCode.set(key, item);
      }
    }
    return [...byCode.values()];
  }
  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }
  function printMessage(text, error = false) {
    printStatus.textContent = text;
    printStatus.dataset.error = String(error);
  }
  function clearScan() {
    input.value = '';
    selectedProductCode = '';
    results.replaceChildren();
    message('ล้างรายการที่สแกนแล้ว');
  }
  async function stopCamera() {
    cameraGeneration += 1;
    const active = camera, wasRunning = cameraRunning;
    camera = null; cameraRunning = false; cameraStarting = false;
    if (active && wasRunning) { try { await active.stop(); } catch (_) {} }
    if (active) { try { active.clear(); } catch (_) {} }
    cameraView.hidden = true;
    cameraView.replaceChildren();
    startButton.disabled = false;
    startButton.hidden = false;
    stopButton.hidden = true;
  }
  function productLocations(code) {
    const key = String(code).trim().toUpperCase();
    const entry = [...buildAreaIndex().entries()].find(([itemCode]) => itemCode.trim().toUpperCase() === key);
    if (!entry) return [];
    return [...new Set(entry[1].slots.map(slot => slot.slotId))].filter(id => FLOORPLAN.slots[id]);
  }
  function showProduct(product) {
    selectedProductCode = product.code;
    const slots = productLocations(product.code);
    results.replaceChildren();
    if (slots.length) {
      const label = document.createElement('span');
      label.textContent = 'ตำแหน่งที่พบ:';
      results.append(label);
      for (const slotId of slots) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.slot = slotId;
        button.textContent = FLOORPLAN.slots[slotId].code;
        results.append(button);
      }
    }
    message(slots.length
      ? `พบ ${product.code} · ${product.name || ''} ใน ${slots.length} ตำแหน่ง เลือกตำแหน่งด้านล่างหรือสแกน QR ตำแหน่งต่อ`
      : `พบ ${product.code} · ${product.name || ''} แต่ยังไม่มีตำแหน่งที่บันทึกในผัง`);
  }
  async function openLocation(location) {
    const slotItems = Array.isArray(SLOT_INVENTORY[location.slotId]) ? SLOT_INVENTORY[location.slotId] : [];
    const selected = selectedProductCode;
    await stopCamera();
    switchToTab('floorplan');
    focusSlotInZoom(location.slotId);
    openEditPanel(location.slotId);
    results.replaceChildren();
    selectedProductCode = '';
    if (selected) {
      const found = slotItems.some(item => String(item?.code || '').trim().toUpperCase() === selected.toUpperCase());
      message(found
        ? `พบ ${selected} ที่ ${location.code} · ตรวจยอดในรายการก่อนดำเนินการ`
        : `ตำแหน่ง ${location.code} ยังไม่มี ${selected} · ตรวจรายการก่อนเพิ่มหรือเบิก`);
    } else {
      message(`เปิดตำแหน่ง ${location.code} · การสแกนยังไม่เปลี่ยนข้อมูล`);
    }
  }
  async function applyScan(raw) {
    const value = String(raw || '').trim().toUpperCase();
    const now = Date.now();
    if (value && value === lastScan && now - lastScanAt < 1200) return;
    lastScan = value; lastScanAt = now;
    const match = RMQR.resolveScan(raw, locations, products());
    input.value = '';
    if (match.kind === 'invalid') { message(match.reason, true); return; }
    if (match.kind === 'product') { showProduct(match.product); return; }
    await openLocation(match.location);
  }

  $('rmQrScanApply').addEventListener('click', () => applyScan(input.value));
  $('rmQrScanClear').addEventListener('click', clearScan);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); applyScan(input.value); }
  });
  results.addEventListener('click', event => {
    const button = event.target.closest('button[data-slot]');
    if (!button) return;
    const location = locations.find(loc => loc.slotId === button.dataset.slot);
    if (location) openLocation(location);
  });
  startButton.addEventListener('click', async () => {
    if (cameraRunning || cameraStarting) return;
    if (typeof Html5Qrcode === 'undefined') { message('ตัวอ่าน QR ไม่พร้อม กรุณาใช้เครื่องอ่านหรือพิมพ์รหัส', true); return; }
    if (!window.isSecureContext) { message('การใช้กล้องต้องเปิดเว็บผ่าน HTTPS หรือ localhost', true); return; }
    const generation = ++cameraGeneration;
    cameraStarting = true; startButton.disabled = true;
    try {
      const next = new Html5Qrcode('rmQrCameraView');
      camera = next;
      cameraView.hidden = false;
      await next.start({ facingMode: 'environment' }, {
        fps: 8,
        qrbox: (w, h) => ({ width: Math.min(w - 20, 300), height: Math.min(h - 20, 220) })
      }, decoded => applyScan(decoded), () => {});
      if (generation !== cameraGeneration || camera !== next) {
        try { await next.stop(); } catch (_) {}
        try { next.clear(); } catch (_) {}
        return;
      }
      cameraRunning = true; startButton.hidden = true; stopButton.hidden = false;
      message('เล็งกล้องไปที่ QR ตำแหน่งหรือวัตถุดิบของ RM');
    } catch (error) {
      if (generation === cameraGeneration) {
        await stopCamera();
        message('เปิดกล้องไม่ได้ · ตรวจสิทธิ์กล้องหรือใช้เครื่องอ่าน/พิมพ์รหัส', true);
      }
    } finally {
      if (generation === cameraGeneration) { cameraStarting = false; startButton.disabled = false; }
    }
  });
  stopButton.addEventListener('click', stopCamera);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  $('tabs').addEventListener('click', event => {
    if (event.target.closest('.tab-btn')?.dataset.tab !== 'floorplan') stopCamera();
  });

  const printZone = $('rmQrPrintZone');
  const zoneCodes = [...new Set(locations.map(loc => loc.zone))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  for (const zone of zoneCodes) {
    const option = document.createElement('option');
    option.value = zone; option.textContent = `โซน ${zone}`;
    printZone.append(option);
  }
  const productCodes = $('rmQrProductCodes');
  for (const product of STOCK.items || []) {
    if (!product?.code) continue;
    const option = document.createElement('option');
    option.value = product.code;
    option.label = product.name || '';
    productCodes.append(option);
  }
  function htmlEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function qrMarkup(payload) {
    const qr = qrcode(0, 'M');
    qr.addData(payload); qr.make();
    return qr.createSvgTag(3, 2);
  }
  function printLabels(title, labels) {
    const page = window.open('', '_blank');
    if (!page) { printMessage('เบราว์เซอร์ปิดกั้นหน้าพิมพ์ กรุณาอนุญาตป๊อปอัป', true); return; }
    page.opener = null;
    page.document.write(`<!doctype html><html lang="th"><meta charset="utf-8"><title>${htmlEscape(title)}</title><style>
      @page{size:A4 portrait;margin:12mm}body{font:13px Arial,sans-serif;color:#111}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}
      .label{border:1px solid #333;padding:8mm 4mm;text-align:center;break-inside:avoid;overflow-wrap:anywhere}
      .label svg{width:32mm;height:32mm}.label b,.label small{display:block;margin:3mm 0}
      </style><h2>${htmlEscape(title)}</h2><div class="grid">${labels}</div></html>`);
    page.document.close(); page.focus(); page.print();
    printMessage(`เปิดหน้าพิมพ์ ${title} แล้ว`);
  }
  $('rmQrPrintLocations').addEventListener('click', () => {
    const selected = printZone.value;
    const slots = locations.filter(loc => loc.zone === selected);
    if (!slots.length || typeof qrcode !== 'function') { printMessage('ยังสร้างป้าย QR ไม่ได้', true); return; }
    const labels = slots.map(loc => `<div class="label">${qrMarkup(RMQR.locationPayload(loc.zone, loc.code))}<b>${htmlEscape(loc.zone)} / ${htmlEscape(loc.code)}</b><small>RMLOC · คลังวัตถุดิบ</small></div>`).join('');
    printLabels(`ป้ายตำแหน่ง RM โซน ${selected}`, labels);
  });
  $('rmQrPrintProduct').addEventListener('click', () => {
    const code = $('rmQrPrintProductCode').value.trim().toUpperCase();
    const product = products().find(item => String(item.code).trim().toUpperCase() === code);
    if (!product || typeof qrcode !== 'function') { printMessage('ไม่พบรหัสวัตถุดิบแบบตรงตัว กรุณาตรวจรหัสก่อนพิมพ์', true); return; }
    const label = `<div class="label">${qrMarkup(RMQR.productPayload(product.code))}<b>${htmlEscape(product.code)}</b><small>${htmlEscape(product.name || '')}</small></div>`;
    printLabels(`ป้ายวัตถุดิบ RM ${product.code}`, label);
  });
})();
