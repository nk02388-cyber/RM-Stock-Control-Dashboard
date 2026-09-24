(() => {
  const $ = id => document.getElementById(id);
  const key = 'rmIncomingTags_v1';
  const esc = value => escapeHtml(value);
  const locations = Object.entries(FLOORPLAN.slots).map(([id, slot]) => ({ id, code: slot.code, zone: slot.code.split('-')[0] }));
  let tags = [], selectedTag = null, selectedLocation = null, created = [], busy = false;
  let camera = null, cameraRunning = false, cameraGeneration = 0;
  function msg(id, value, error = false) { $(id).textContent = value; $(id).dataset.error = String(error); }
  function saveTags(next) {
    localStorage.setItem(key, JSON.stringify(next));
    tags = next;
    renderHistory();
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    tags = Array.isArray(parsed) ? parsed.filter(row => row && RMIncoming.parseTag(RMIncoming.tagPayload(row.id))) : [];
  } catch (_) { msg('rmInReceiveStatus', 'อ่านทะเบียนป้ายในเครื่องนี้ไม่ได้ กรุณาตรวจข้อมูลก่อนรับเข้าใหม่', true); }
  // If the page closed between the inventory write and tag-status write, recover the
  // status from the inventory marker so the same pallet cannot be put away twice.
  const recovered = tags.map(tag => {
    if (tag.status !== 'pending') return tag;
    const location = Object.entries(SLOT_INVENTORY).find(([, rows]) => Array.isArray(rows) && rows.some(row => row?.inboundTagId === tag.id));
    return location ? { ...tag, status: 'stored', slotId: location[0], location: FLOORPLAN.slots[location[0]]?.code || location[0], storer: '(กู้คืนสถานะ)' } : tag;
  });
  if (recovered.some((tag, i) => tag !== tags[i])) {
    try { saveTags(recovered); } catch (_) { tags = recovered; }
  }
  const catalog = new Map();
  for (const item of STOCK.items || []) {
    const code = String(item?.code || '').trim().toUpperCase();
    if (code && !catalog.has(code)) catalog.set(code, { code: item.code, name: item.name || '', unit: item.unit || '' });
  }
  for (const items of Object.values(SLOT_INVENTORY)) for (const item of Array.isArray(items) ? items : []) {
    const code = String(item?.code || '').trim().toUpperCase();
    if (code && !catalog.has(code)) catalog.set(code, { code: item.code, name: item.name || '', unit: item.unit || '' });
  }
  for (const item of catalog.values()) {
    const option = document.createElement('option'); option.value = item.code; option.label = item.name;
    $('rmInProducts').append(option);
  }
  function identifyProduct() {
    const raw = $('rmInProduct').value.trim();
    const parts = raw.split('|');
    const code = parts[0].trim().toUpperCase() === 'RMITEM' && parts.length === 2 ? parts[1].trim().toUpperCase() : raw.toUpperCase();
    const item = catalog.get(code);
    $('rmInName').value = item?.name || '';
    if (item) { $('rmInProduct').value = item.code; if (!$('rmInUnit').value) $('rmInUnit').value = item.unit; }
    return item || null;
  }
  $('rmInProduct').addEventListener('change', identifyProduct);
  $('rmInProduct').addEventListener('input', () => { $('rmInName').value = ''; });
  $('rmInDate').value = new Date().toLocaleDateString('en-CA');
  function allocation(reset = false) {
    const total = $('rmInQty').value, count = Number($('rmInCount').value);
    const values = RMIncoming.distributeQuantity(total, count), box = $('rmInAllocation');
    if (!values) { box.textContent = 'กรอกจำนวนรวมและจำนวนพาเลต 1–100 ให้ถูกต้อง'; return; }
    const existing = [...box.querySelectorAll('[data-pallet-qty]')];
    if (reset || existing.length !== count) box.innerHTML = `<b>จำนวนต่อพาเลต (ปรับได้ แต่ยอดรวมต้องตรง)</b><div class="rm-incoming-allocation">${values.map((qty, i) => `<label>พาเลต ${i + 1}/${count}<input data-pallet-qty="${i}" type="number" min="0.001" step="0.001" required value="${qty}"></label>`).join('')}</div><p id="rmInAllocationStatus"></p>`;
    const actual = [...box.querySelectorAll('[data-pallet-qty]')].map(el => el.value);
    const ok = RMIncoming.validAllocation(total, actual);
    $('rmInAllocationStatus').textContent = `${ok ? '✓ ยอดตรง' : 'ยอดรวมไม่ตรง'} · ${actual.reduce((sum, value) => sum + (Number(value) || 0), 0).toLocaleString('th-TH', { maximumFractionDigits: 3 })} / ${Number(total).toLocaleString('th-TH', { maximumFractionDigits: 3 })} ${$('rmInUnit').value}`;
    $('rmInAllocationStatus').dataset.error = String(!ok);
  }
  $('rmInQty').addEventListener('input', () => allocation(true));
  $('rmInCount').addEventListener('input', () => allocation(true));
  $('rmInUnit').addEventListener('input', () => allocation());
  $('rmInAllocation').addEventListener('input', event => { if (event.target.matches('[data-pallet-qty]')) allocation(); });
  function view(name) {
    for (const section of ['receive', 'putaway', 'history']) $('rmIncoming' + nameOf(section)).hidden = section !== name;
    for (const button of document.querySelectorAll('[data-incoming-view]')) button.classList.toggle('active', button.dataset.incomingView === name);
    stopCamera();
  }
  function nameOf(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
  document.querySelectorAll('[data-incoming-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.incomingView)));
  $('rmInGoPutaway').addEventListener('click', () => view('putaway'));
  function renderHistory() {
    const pending = tags.filter(tag => tag.status === 'pending').length;
    $('tabBadgeIncoming').textContent = pending;
    $('rmInHistorySummary').textContent = `${tags.length} ป้ายในเครื่องนี้ · รอจัดเก็บ ${pending} ป้าย`;
    $('rmInHistoryList').innerHTML = tags.length ? [...tags].reverse().slice(0, 100).map(tag => `<article class="rm-incoming-record"><strong>${esc(tag.receipt)} · ${tag.index}/${tag.count}</strong><span>${tag.status === 'stored' ? 'จัดเก็บแล้ว' : 'รอจัดเก็บ'}</span><br>${esc(tag.code)} · ${esc(tag.name)} · ${esc(tag.qty)} ${esc(tag.unit)} · Lot ${esc(tag.lot)}<br>${tag.status === 'stored' ? `ตำแหน่ง ${esc(tag.location || '')} · ผู้จัดเก็บ ${esc(tag.storer || '')}` : 'ยังไม่มีตำแหน่ง'}<div>${tag.status === 'pending' ? `<button type="button" data-select-tag="${esc(tag.id)}">เลือกจัดเก็บ</button>` : ''}<button type="button" data-print-tag="${esc(tag.id)}">พิมพ์ป้าย</button></div></article>`).join('') : 'ยังไม่มีป้ายรับเข้า';
  }
  renderHistory();
  $('rmIncomingForm').addEventListener('submit', event => {
    event.preventDefault(); if (busy) return;
    const product = identifyProduct(), count = Number($('rmInCount').value);
    const amounts = [...document.querySelectorAll('#rmInAllocation [data-pallet-qty]')].map(el => el.value);
    if (!product) { msg('rmInReceiveStatus', 'ไม่พบรหัสวัตถุดิบแบบตรงตัวในข้อมูล RM', true); return; }
    if (!RMIncoming.validAllocation($('rmInQty').value, amounts) || amounts.length !== count) { msg('rmInReceiveStatus', 'ยอดต่อพาเลตไม่ตรงกับจำนวนรวม', true); return; }
    if ($('rmInMfg').value && $('rmInExpiry').value && $('rmInExpiry').value < $('rmInMfg').value) { msg('rmInReceiveStatus', 'วันหมดอายุต้องไม่ก่อนวันที่ผลิต', true); return; }
    if (!window.isSecureContext || !crypto.randomUUID) { msg('rmInReceiveStatus', 'การสร้างป้ายต้องเปิดเว็บผ่าน HTTPS หรือ localhost', true); return; }
    const receipt = $('rmInReceipt').value.trim(), receiver = $('rmInReceiver').value.trim(), lot = $('rmInLot').value.trim(), unit = $('rmInUnit').value.trim();
    if (!receipt || !receiver || !lot || !unit) { msg('rmInReceiveStatus', 'กรอกเลขที่รับเข้า ผู้รับเข้า Lot และหน่วยให้ครบ', true); return; }
    const batch = crypto.randomUUID(), now = new Date().toISOString();
    const batchTags = amounts.map((amount, index) => ({ id: crypto.randomUUID(), batch, index: index + 1, count, receipt, receiver, supplier: $('rmInSupplier').value.trim(), received: $('rmInDate').value, code: product.code, name: product.name, lot, qty: Number(amount), total: Number($('rmInQty').value), unit, mfg: $('rmInMfg').value, expiry: $('rmInExpiry').value, shelf: $('rmInShelf').value.trim(), status: 'pending', createdAt: now }));
    busy = true;
    try {
      saveTags([...tags, ...batchTags]); created = batchTags;
      $('rmInCreated').hidden = false;
      msg('rmInReceiveStatus', `บันทึกรับเข้า ${receipt} แล้ว · สร้างป้าย ${count} ใบ · ยังไม่เพิ่มยอดในผังคลัง`);
      $('rmInProduct').value = ''; $('rmInName').value = ''; $('rmInQty').value = ''; $('rmInLot').value = ''; $('rmInCount').value = '1';
      $('rmInAllocation').replaceChildren();
    } catch (error) { msg('rmInReceiveStatus', 'บันทึกทะเบียนป้ายไม่สำเร็จ · ตรวจพื้นที่เก็บข้อมูลเบราว์เซอร์: ' + error.message, true); }
    finally { busy = false; }
  });
  function updatePutaway() {
    const tag = selectedTag;
    $('rmInPutawaySummary').innerHTML = tag ? `<b>${tag.status === 'pending' ? '✓ พบป้ายพาเลต' : 'ป้ายนี้จัดเก็บแล้ว'} · ${esc(tag.receipt)} · ${tag.index}/${tag.count}</b><br>${esc(tag.code)} · ${esc(tag.name)} · ${esc(tag.qty)} ${esc(tag.unit)} · Lot ${esc(tag.lot)}<br>${selectedLocation ? `✓ ตำแหน่ง ${esc(selectedLocation.code)}` : '○ รอระบุตำแหน่ง'}` : `○ รอสแกนป้ายพาเลต<br>${selectedLocation ? `✓ ตำแหน่ง ${esc(selectedLocation.code)}` : '○ รอระบุตำแหน่ง'}`;
    $('rmInConfirm').disabled = busy || tag?.status !== 'pending' || !selectedLocation || !$('rmInStorer').value.trim();
  }
  function selectTag(raw) {
    const id = RMIncoming.parseTag(raw), tag = tags.find(row => row.id === id);
    if (!tag) { selectedTag = null; updatePutaway(); msg('rmInPutawayStatus', id ? 'ไม่พบป้ายในทะเบียนเครื่องนี้' : 'QR ป้ายพาเลตไม่ถูกต้อง ต้องเป็น RMTAG', true); return; }
    if (selectedTag && selectedTag.id !== tag.id) { selectedLocation = null; $('rmInLocation').value = ''; $('rmInZone').value = ''; populateSlots(); }
    selectedTag = tag; $('rmInTag').value = RMIncoming.tagPayload(tag.id); updatePutaway();
    msg('rmInPutawayStatus', tag.status === 'pending' ? 'อ่านป้ายแล้ว · สแกนหรือเลือกตำแหน่งจัดเก็บ' : `ป้ายนี้จัดเก็บแล้วที่ ${tag.location || 'ตำแหน่งเดิม'}`, tag.status !== 'pending');
  }
  function populateSlots() {
    const zone = $('rmInZone').value;
    $('rmInSlot').innerHTML = `<option value="">เลือกตำแหน่ง</option>${locations.filter(loc => loc.zone === zone).map(loc => `<option value="${esc(loc.id)}">${esc(loc.code)}</option>`).join('')}`;
  }
  for (const zone of [...new Set(locations.map(loc => loc.zone))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }))) $('rmInZone').add(new Option(`โซน ${zone}`, zone));
  function selectLocation(raw) {
    const match = RMQR.resolveScan(raw, locations.map(loc => ({ slotId: loc.id, ...loc })), []);
    selectedLocation = match.kind === 'location' ? locations.find(loc => loc.id === match.location.slotId) : null;
    $('rmInZone').value = selectedLocation?.zone || ''; populateSlots(); $('rmInSlot').value = selectedLocation?.id || '';
    if (selectedLocation) { $('rmInLocation').value = RMQR.locationPayload(selectedLocation.zone, selectedLocation.code); msg('rmInPutawayStatus', `เลือกตำแหน่ง ${selectedLocation.code} · ตรวจข้อมูลแล้วกดยืนยัน`); }
    else msg('rmInPutawayStatus', 'ไม่พบตำแหน่ง RM แบบตรงตัวในผัง', true);
    updatePutaway();
  }
  $('rmInTag').addEventListener('change', event => selectTag(event.target.value));
  $('rmInTag').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); selectTag(event.target.value); } });
  $('rmInLocation').addEventListener('change', event => selectLocation(event.target.value));
  $('rmInLocation').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); selectLocation(event.target.value); } });
  $('rmInZone').addEventListener('change', () => { selectedLocation = null; $('rmInLocation').value = ''; populateSlots(); updatePutaway(); });
  $('rmInSlot').addEventListener('change', () => { const loc = locations.find(row => row.id === $('rmInSlot').value); if (loc) selectLocation(RMQR.locationPayload(loc.zone, loc.code)); else { selectedLocation = null; updatePutaway(); } });
  $('rmInStorer').addEventListener('input', updatePutaway);
  $('rmInConfirm').addEventListener('click', () => {
    if (busy || !selectedTag || selectedTag.status !== 'pending' || !selectedLocation || !$('rmInStorer').value.trim()) return;
    const tag = tags.find(row => row.id === selectedTag.id), loc = selectedLocation;
    if (!tag || tag.status !== 'pending' || !FLOORPLAN.slots[loc.id]) { msg('rmInPutawayStatus', 'ป้ายหรือตำแหน่งไม่พร้อม กรุณาตรวจอีกครั้ง', true); return; }
    busy = true; updatePutaway();
    const oldRows = Array.isArray(SLOT_INVENTORY[loc.id]) ? SLOT_INVENTORY[loc.id] : [];
    const item = { code: tag.code, name: tag.name, lot: tag.lot, qty_received: tag.qty, unit: tag.unit, received_date: tag.received, mfg_date: tag.mfg, shelf_life: tag.shelf, expiry_date: tag.expiry, inboundTagId: tag.id };
    try {
      if (Object.values(SLOT_INVENTORY).some(rows => Array.isArray(rows) && rows.some(row => row?.inboundTagId === tag.id))) throw new Error('พบรายการจากป้ายนี้ในผังแล้ว กรุณาตรวจสอบก่อนทำซ้ำ');
      SLOT_INVENTORY[loc.id] = [...oldRows, item];
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(SLOT_INVENTORY));
      const next = tags.map(row => row.id === tag.id ? { ...row, status: 'stored', location: loc.code, slotId: loc.id, storer: $('rmInStorer').value.trim(), storedAt: new Date().toISOString() } : row);
      try { saveTags(next); } catch (error) { SLOT_INVENTORY[loc.id] = oldRows; localStorage.setItem(INVENTORY_KEY, JSON.stringify(SLOT_INVENTORY)); throw error; }
      if (typeof renderAreaItemsTable === 'function') renderAreaItemsTable();
      if (typeof refreshZoomSlotStates === 'function') refreshZoomSlotStates();
      if (typeof renderReceivingDailyReport === 'function') renderReceivingDailyReport();
      if (typeof renderStockDiffReport === 'function') renderStockDiffReport();
      msg('rmInPutawayStatus', `จัดเก็บ ${tag.code} ${tag.qty} ${tag.unit} ที่ ${loc.code} แล้ว · บันทึกในเบราว์เซอร์เครื่องนี้`);
      selectedTag = null; selectedLocation = null; $('rmInTag').value = ''; $('rmInLocation').value = ''; $('rmInZone').value = ''; populateSlots();
    } catch (error) { msg('rmInPutawayStatus', 'บันทึกจัดเก็บไม่สำเร็จ: ' + error.message, true); }
    finally { busy = false; updatePutaway(); }
  });
  function printTags(rows) {
    if (!rows.length || typeof qrcode !== 'function') { msg('rmInReceiveStatus', 'สร้าง QR ไม่ได้', true); return; }
    const page = window.open('', '_blank');
    if (!page) { msg('rmInReceiveStatus', 'เบราว์เซอร์ปิดกั้นหน้าพิมพ์ กรุณาอนุญาตป๊อปอัป', true); return; }
    page.opener = null;
    const label = tag => { const qr = qrcode(0, 'M'); qr.addData(RMIncoming.tagPayload(tag.id)); qr.make(); return `<article class="tag"><header><b>FM-ST-019 · ใบกำกับวัตถุดิบ RM</b><strong>${tag.index}/${tag.count}</strong></header><p>เลขที่รับเข้า: <b>${esc(tag.receipt)}</b></p><p>ผู้ส่งมอบ: ${esc(tag.supplier || '—')}</p><p>รหัส: <b>${esc(tag.code)}</b> · ${esc(tag.name)}</p><p>Lot: ${esc(tag.lot)}</p><p>จำนวนพาเลต: <b>${esc(tag.qty)} ${esc(tag.unit)}</b> / รวม ${esc(tag.total)} ${esc(tag.unit)}</p><p>วันที่รับ: ${esc(tag.received)} · ผลิต: ${esc(tag.mfg || '—')} · หมดอายุ: ${esc(tag.expiry || '—')}</p><div class="qr">${qr.createSvgTag(3, 1)}<small>${esc(RMIncoming.tagPayload(tag.id))}</small></div></article>`; };
    const sheets = rows.map(tag => `<section class="sheet">${label(tag).repeat(4)}</section>`).join('');
    page.document.write(`<!doctype html><html lang="th"><meta charset="utf-8"><title>FM-ST-019 RM · ${esc(rows[0].receipt)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:9pt Arial,sans-serif;color:#111}.sheet{width:277mm;height:190mm;display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);gap:4mm;break-after:page}.sheet:last-child{break-after:auto}.tag{border:1.5px solid #111;padding:3mm;overflow:hidden;overflow-wrap:anywhere}.tag header{display:flex;justify-content:space-between;border-bottom:1px solid #555}.tag header strong{font-size:16pt}.tag p{margin:2mm 0}.qr{text-align:center}.qr svg{width:30mm;height:30mm}.qr small{display:block;font-size:6pt}</style>${sheets}</html>`);
    page.document.close(); page.focus(); page.print();
  }
  $('rmInPrintCreated').addEventListener('click', () => printTags(created));
  $('rmInHistoryList').addEventListener('click', event => {
    const select = event.target.closest('[data-select-tag]'), print = event.target.closest('[data-print-tag]');
    if (select) { view('putaway'); selectTag(RMIncoming.tagPayload(select.dataset.selectTag)); }
    if (print) { const tag = tags.find(row => row.id === print.dataset.printTag); if (tag) printTags([tag]); }
  });
  async function stopCamera() {
    cameraGeneration++; const active = camera, running = cameraRunning; camera = null; cameraRunning = false;
    if (active && running) try { await active.stop(); } catch (_) {}
    if (active) try { active.clear(); } catch (_) {}
    $('rmInCamera').hidden = true; $('rmInCamera').replaceChildren(); $('rmInCameraStop').hidden = true;
  }
  async function startCamera(target) {
    if (camera) await stopCamera();
    if (typeof Html5Qrcode === 'undefined' || !window.isSecureContext) { msg('rmInPutawayStatus', 'กล้องต้องเปิดผ่าน HTTPS หรือ localhost และอนุญาตสิทธิ์กล้อง', true); return; }
    const generation = ++cameraGeneration, reader = new Html5Qrcode('rmInCamera'); camera = reader; $('rmInCamera').hidden = false;
    try {
      await reader.start({ facingMode: 'environment' }, { fps: 8, qrbox: 230 }, decoded => { if (target === 'tag') selectTag(decoded); else selectLocation(decoded); stopCamera(); }, () => {});
      if (generation !== cameraGeneration) { try { await reader.stop(); } catch (_) {} try { reader.clear(); } catch (_) {} return; }
      cameraRunning = true; $('rmInCameraStop').hidden = false;
    } catch (_) { if (generation === cameraGeneration) { await stopCamera(); msg('rmInPutawayStatus', 'เปิดกล้องไม่ได้ ใช้เครื่องอ่านหรือพิมพ์รหัสแทนได้', true); } }
  }
  $('rmInTagCamera').addEventListener('click', () => startCamera('tag'));
  $('rmInLocationCamera').addEventListener('click', () => startCamera('location'));
  $('rmInCameraStop').addEventListener('click', stopCamera);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  $('tabs').addEventListener('click', event => { if (event.target.closest('.tab-btn')?.dataset.tab !== 'incoming') stopCamera(); });
})();
