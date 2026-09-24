// RM adaptation of PK WMS pallet receiving: no stock changes until putaway.
(function (root) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const tagPayload = id => `RMTAG|${id}`;
  function parseTag(raw) {
    const parts = String(raw ?? '').trim().split('|');
    return parts.length === 2 && parts[0].trim().toUpperCase() === 'RMTAG' && uuid.test(parts[1].trim())
      ? parts[1].trim().toLowerCase() : null;
  }
  function quantityUnits(value) {
    if (String(value ?? '').trim() === '') return null;
    const number = Number(value), units = Math.round(number * 1000);
    return Number.isFinite(number) && number > 0 && Number.isSafeInteger(units) && Math.abs(number * 1000 - units) < 1e-7 ? units : null;
  }
  function distributeQuantity(total, count) {
    const units = quantityUnits(total);
    if (units === null || !Number.isInteger(count) || count < 1 || count > 100 || units < count) return null;
    const whole = units % 1000 === 0, amount = whole ? units / 1000 : units, scale = whole ? 1 : 1000;
    if (amount < count) return null;
    const base = Math.floor(amount / count), extra = amount % count;
    return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / scale);
  }
  function validAllocation(total, values) {
    const units = quantityUnits(total);
    if (units === null || !Array.isArray(values) || !values.length || values.length > 100) return false;
    const parts = values.map(quantityUnits);
    return parts.every(part => part !== null) && parts.reduce((sum, part) => sum + part, 0) === units;
  }
  const api = { tagPayload, parseTag, quantityUnits, distributeQuantity, validAllocation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RMIncoming = api;
})(typeof window !== 'undefined' ? window : globalThis);
