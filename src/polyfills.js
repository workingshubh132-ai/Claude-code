// Loaded before anything else in main.jsx.
//
// The build target only transpiles *syntax*; missing built-in methods still
// throw at runtime. supabase-js reaches for globalThis (Android WebView 71+)
// and Object.fromEntries (73+), and on an older phone either one throws during
// module evaluation -- which surfaces as a completely blank page with no error
// the user can see.

if (typeof globalThis === 'undefined' && typeof window !== 'undefined') {
  window.globalThis = window
}

if (typeof Object.fromEntries !== 'function') {
  Object.fromEntries = function fromEntries(entries) {
    const out = {}
    for (const entry of entries) out[entry[0]] = entry[1]
    return out
  }
}
