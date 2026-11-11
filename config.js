/* Configuración de la app móvil SGI Oviedo. Estos valores NO son secretos (van en el navegador),
   pero deben ser los suyos. Mientras API_URL diga PEGAR..., la app funciona en MODO DEMOSTRACIÓN. */
window.SGI_CONFIG = {
  // URL de la aplicación web de Apps Script (termina en /exec). Implementar > Nueva implementación.
  API_URL: 'PEGAR_URL_DE_LA_APLICACION_WEB_/exec',
  // ID de cliente OAuth "Aplicación web" de Google Cloud (termina en .apps.googleusercontent.com).
  CLIENT_ID: 'PEGAR_CLIENT_ID.apps.googleusercontent.com',
  // Solo cuentas de este dominio de Google Workspace.
  DOMINIO: 'oviedo.com.co'
};
