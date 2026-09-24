// RM QR payloads are intentionally distinct from PK labels to prevent cross-warehouse scans.
(function (root) {
  const normalize = value => String(value ?? '').trim().toUpperCase();
  const locationPayload = (zone, slot) => `RMLOC|${zone}|${slot}`;
  const productPayload = code => `RMITEM|${code}`;

  function resolveScan(raw, locations, products) {
    const value = normalize(raw);
    if (!value) return { kind: 'invalid', reason: 'ยังไม่มีรหัสให้ตรวจ' };
    const parts = String(raw).trim().split('|');
    const prefix = normalize(parts[0]);
    if (prefix.startsWith('PK') && parts.length > 1) {
      return { kind: 'invalid', reason: 'ป้ายนี้เป็นของคลัง PK กรุณาใช้ป้าย RM' };
    }
    const isLocation = prefix === 'RMLOC';
    const isProduct = prefix === 'RMITEM';
    if (parts.length > 1 && !isLocation && !isProduct) {
      return { kind: 'invalid', reason: 'รูปแบบ QR ไม่รองรับในคลัง RM' };
    }
    if ((isLocation && (parts.length !== 3 || !normalize(parts[1]) || !normalize(parts[2]))) ||
        (isProduct && (parts.length !== 2 || !normalize(parts[1])))) {
      return { kind: 'invalid', reason: 'รูปแบบ QR ไม่ถูกต้อง' };
    }
    const locationMatches = isProduct ? [] : locations.filter(loc => isLocation
      ? normalize(loc.zone) === normalize(parts[1]) && normalize(loc.code) === normalize(parts[2])
      : normalize(loc.code) === value || normalize(`${loc.zone}/${loc.code}`) === value);
    const productCode = isProduct ? normalize(parts[1]) : value;
    const productMatches = isLocation ? [] : products.filter(product =>
      [product.code, product.barcode, product.ean, product.gtin].some(code => code && normalize(code) === productCode));
    const byCode = new Map();
    productMatches.forEach(product => { if (!byCode.has(normalize(product.code))) byCode.set(normalize(product.code), product); });
    const uniqueProducts = [...byCode.values()];
    if (locationMatches.length === 1 && !uniqueProducts.length) return { kind: 'location', location: locationMatches[0] };
    if (uniqueProducts.length === 1 && !locationMatches.length) return { kind: 'product', product: uniqueProducts[0] };
    if (locationMatches.length || uniqueProducts.length) return { kind: 'invalid', reason: 'รหัสนี้ตรงกับหลายรายการ กรุณาใช้ป้าย QR ที่ระบุประเภท' };
    return { kind: 'invalid', reason: 'ไม่พบรหัสนี้ในตำแหน่งหรือรายการวัตถุดิบ' };
  }

  const api = { resolveScan, locationPayload, productPayload };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RMQR = api;
})(typeof window !== 'undefined' ? window : globalThis);
