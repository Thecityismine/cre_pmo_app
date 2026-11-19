/**
 * iOS home-screen (standalone) apps using the `black-translucent` status bar
 * have a WebKit bug: the layout viewport (100vh / 100dvh / `bottom: 0`) is
 * reported shorter than the physical screen by roughly the status-bar height.
 * That leaves an empty strip below the fixed bottom nav.
 *
 * We measure the missing height and expose it as `--ios-gap`, which the CSS
 * uses to stretch the app shell and push the bottom nav down to the real edge.
 * On every other browser/device the gap is 0 and nothing changes.
 */
export function installIosViewportFix() {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const isIosStandalone = nav.standalone === true
  if (!isIosStandalone) return

  const update = () => {
    const landscape = window.matchMedia('(orientation: landscape)').matches
    const { width, height } = window.screen
    const screenH = landscape ? Math.min(width, height) : Math.max(width, height)
    const gap = screenH - window.innerHeight
    // Only correct plausible status-bar-sized gaps (avoids iPad split view etc.)
    const value = gap > 0 && gap <= 80 ? gap : 0
    document.documentElement.style.setProperty('--ios-gap', `${value}px`)
  }

  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', () => setTimeout(update, 300))
}
