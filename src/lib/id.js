const HEX = []
for (let i = 0; i < 256; i++) HEX.push((i + 0x100).toString(16).slice(1))

// crypto.randomUUID() only exists on Android WebView 92+ / Safari 15.4+, and
// only in secure contexts. Older phones throw on it, which killed photo
// uploads outright -- so fall back through getRandomValues to Math.random.
export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const b = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(b)
  } else {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  }
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant 10

  return (
    HEX[b[0]] + HEX[b[1]] + HEX[b[2]] + HEX[b[3]] +
    '-' + HEX[b[4]] + HEX[b[5]] +
    '-' + HEX[b[6]] + HEX[b[7]] +
    '-' + HEX[b[8]] + HEX[b[9]] +
    '-' + HEX[b[10]] + HEX[b[11]] + HEX[b[12]] + HEX[b[13]] + HEX[b[14]] + HEX[b[15]]
  )
}
