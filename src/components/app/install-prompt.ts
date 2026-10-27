/**
 * Inline script for the root layout. Catches the browser's install offer as
 * early as possible: Chrome can fire it before React has loaded, and a listener
 * added later (in InstallButton) would miss it.
 */
export const captureInstallPrompt = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e;window.dispatchEvent(new Event("installpromptready"))});`;
