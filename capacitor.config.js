// Android app settings.
// With QS_WEB_URL set (the Vercel address of the website), the app opens the live website inside the app,
// so every change you deploy shows in the app straight away with no new APK.
// Without it, the app carries a copy of the website made when the APK was built.
const url = String(process.env.QS_WEB_URL || '').trim().replace(/\/+$/, '');

module.exports = {
  appId: 'in.queenstown.society',
  appName: 'Queenstown Society',
  webDir: 'www',
  server: Object.assign({ androidScheme: 'https' }, url ? { url, cleartext: false, errorPath: 'offline.html' } : {}),
  android: { allowMixedContent: false, appendUserAgent: 'QueenstownApp/1.0' }
};
