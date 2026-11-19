/**
 * iOS home-screen (standalone) apps using the `black-translucent` status bar
 * have a WebKit bug: the layout viewport (100vh / 100dvh / `position: fixed;
 * bottom: 0`) is shorter than the physical screen by roughly the status-bar
 * height, leaving an empty strip below the fixed bottom nav.
 *
 * `window.innerHeight` can still report the full screen in this state, so we
 * measure the real layout viewport with an invisible fixed probe and compare
 * it to the screen height. The difference is exposed as `--ios-gap`, which
 * the CSS uses to stretch the app shell and push the bottom nav to the true
 * bottom edge. On every other browser/device the gap is 0 and nothing changes.
 */
export function installIosViewportFix() {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone !== true) return

  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:fixed;top:0;left:0;bottom:0;width:0;visibility:hidden;pointer-events:none;'
  document.documentElement.appendChild(probe)

  const update = () => {
    const landscape = window.matchMedia('(orientation: landscape)').matches
    const { width, height } = window.screen
    const screenH = landscape ? Math.min(width, height) : Math.max(width, height)
    const layoutH = Math.min(
      probe.getBoundingClientRect().height,
      document.documentElement.clientHeight || Infinity,
      window.innerHeight,
    )
    const gap = Math.round(screenH - layoutH)
    // Only correct plausible status-bar-sized gaps (avoids iPad split view etc.)
    const value = gap > 0 && gap <= 80 ? gap : 0
    document.documentElement.style.setProperty('--ios-gap', `${value}px`)
    if (debug) {
      debug.textContent =
        `screen ${screenH} · probe ${Math.round(probe.getBoundingClientRect().height)} · ` +
        `client ${document.documentElement.clientHeight} · inner ${window.innerHeight} · gap ${value}`
    }
  }

  // Diagnostic readout: open the app once with ?vpdebug to show it
  let debug: HTMLDivElement | null = null
  try {
    if (new URLSearchParams(location.search).has('vpdebug')) sessionStorage.setItem('vpdebug', '1')
    if (sessionStorage.getItem('vpdebug')) {
      debug = document.createElement('div')
      debug.style.cssText =
        'position:fixed;top:calc(env(safe-area-inset-top) + 4px);left:4px;z-index:9999;' +
        'background:#000c;color:#0f0;font:11px monospace;padding:2px 6px;border-radius:4px;pointer-events:none;'
      document.documentElement.appendChild(debug)
    }
  } catch { /* storage unavailable */ }

  update()
  // Layout can settle after first paint in standalone mode — re-check shortly after
  requestAnimationFrame(update)
  setTimeout(update, 500)
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', () => setTimeout(update, 300))
  window.visualViewport?.addEventListener('resize', update)
}
