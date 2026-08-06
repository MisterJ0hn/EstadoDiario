import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cl.temposoft.estadodiario',
  appName: 'Estado Diario',
  // Lo que produce `ng build` (ver angular.json). Capacitor copia esta carpeta
  // dentro del APK en cada `cap sync`.
  webDir: 'www',
  android: {
    // El backend hoy responde por http, no https. Sin esto Android 9+ corta el
    // tráfico en claro y la app falla con un error de red que no dice por qué.
    // Cuando la API tenga TLS, sacar esta línea.
    allowMixedContent: true,
  },
  server: {
    // El WebView sirve la app desde https://localhost. Es lo que permite que
    // localStorage —donde vive el token de sesión— tenga un origen estable
    // entre arranques: con `capacitor://` cada actualización podría perderlo.
    androidScheme: 'https',
  },
};

export default config;
