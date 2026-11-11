# SGI Oviedo móvil — guía de puesta en marcha

App instalable (PWA) para Android que trabaja **conectada y en tiempo real** con el libro de Google Sheets
`SGI_Oviedo`: revisión de inventario por QR, consulta, formularios (entrega/devolución, novedad de accesos,
activos) y decisión de las respuestas del formulario de Gestión Humana.

No guarda datos en el celular (salvo la cola de revisiones que no alcanzaron a enviarse por falta de señal).
Todo lo que se hace desde el celular pasa por las mismas funciones del libro: mismas validaciones, mismos IDs,
mismas actas y misma BITÁCORA, a nombre de la persona que opera.

## 0. Ver la app sin conectar nada (modo demostración)
Cualquier hospedaje (o el celular abriendo la URL) con `?demo=1` al final, por ejemplo
`https://su-sitio/index.html?demo=1`, abre la app con datos inventados. No toca el libro.
Con `&rol=revisor` se ve la versión limitada. Mientras `config.js` tenga los textos `PEGAR...`, la app entra
sola en modo demostración.

## 1. Probar siempre primero en la COPIA de pruebas
Haga todo este paso a paso en el libro `SGI_Oviedo_PRUEBAS` (copia completa; en CONFIG apunte correos, carpetas y
respaldos a pruebas). Solo cuando todo funcione repita en el libro real.

## 2. Apps Script (en el libro)
1. Pegue/reemplace estos archivos del proyecto (conserve los demás):
   `Codigo.gs` (v3.8), `RevisionFormulario.gs` (v3.2), `Menu.gs` (v3.7) y el nuevo `Movil.gs`.
2. Recargue el libro. Aparece el menú **App móvil**.
3. Antes de configurar, complete el paso 3 de esta guía para tener el **Client ID**.
4. Menú **App móvil > 1. Configurar**: pegue el Client ID y escriba el dominio (`oviedo.com.co`).
   Crea las hojas `USUARIOS_APP` (lista de autorizados; usted queda como ADMIN) y `REVISIONES_INVENTARIO`.
5. Menú **App móvil > Probar lecturas (no escribe nada)**: debe dar OK en las 5 líneas.
6. **Implementar > Nueva implementación > Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona** (si no aparece esa opción, el administrador de Workspace debe permitirla)
   - Copie la URL que termina en `/exec`.
   - Ábrala en el navegador: debe mostrar un JSON con `"ok":true`.
7. Cada vez que cambie `Movil.gs` u otro archivo: **Implementar > Administrar implementaciones > editar (lápiz) >
   Versión: Nueva versión**. La URL no cambia.
8. Agregue en `USUARIOS_APP` a quienes usarán la app: CORREO, NOMBRE, ROL (`ADMIN` o `REVISOR`), ACTIVO = Sí.
   - `ADMIN`: todo.
   - `REVISOR`: revisión por QR y consulta de equipos, **sin** cédulas, correos ni fichas de colaboradores.
   - Poner ACTIVO = No (o borrar la fila) corta el acceso de inmediato.
   - La hoja queda protegida: solo el propietario la edita (quien pueda editarla se concede acceso).

## 3. Google Cloud: el Client ID (una sola vez, ~5 minutos)
1. https://console.cloud.google.com > cree o elija un proyecto de la organización.
2. **APIs y servicios > Pantalla de consentimiento de OAuth**: tipo **Interno** (solo su Workspace). Nombre: SGI Oviedo.
3. **Credenciales > Crear credenciales > ID de cliente de OAuth > Aplicación web**.
   - **Orígenes de JavaScript autorizados**: la dirección donde alojará la app (paso 4), por ejemplo
     `https://usuario.github.io`. Sin barra final ni ruta. No se necesitan URI de redirección.
4. Copie el ID (termina en `.apps.googleusercontent.com`). No es un secreto, pero use el suyo.

## 4. Alojar la app (carpeta con los archivos de este paquete)
Es un sitio estático; necesita **HTTPS** (la cámara no funciona sin él). Opciones gratuitas:
- **GitHub Pages** (el repositorio debe ser público en el plan gratuito; la app no contiene datos, pero sí la URL de la API
  y el Client ID — la protección real es el inicio de sesión + `USUARIOS_APP`),
- **Firebase Hosting** o **Cloudflare Pages** (permiten repositorio/proyecto privado).

Antes de subir, edite `config.js`:
```js
window.SGI_CONFIG = {
  API_URL:   'https://script.google.com/macros/s/XXXXXXXX/exec',
  CLIENT_ID: 'XXXXXXXX.apps.googleusercontent.com',
  DOMINIO:   'oviedo.com.co'
};
```
Cuando cambie archivos de la app, suba el número `VERSION` de `sw.js` para que los celulares se actualicen.

## 5. Instalar en el celular Android
1. Abra la dirección en **Chrome**, inicie sesión con la cuenta corporativa.
2. Menú ⋮ > **Instalar aplicación** (o "Agregar a la pantalla de inicio").
3. La primera vez que abra **Escanear**, acepte el permiso de cámara.

## 6. Lo que debe comprobar en la copia de pruebas (lista corta)
- [ ] Entra con su cuenta; con una cuenta NO autorizada ve "no autorizada".
- [ ] Escanear un QR de un equipo abre su ficha; guardar la revisión crea una fila en `REVISIONES_INVENTARIO`.
- [ ] Una revisión sin señal queda "por enviar" y sale sola al volver la señal (sin duplicarse).
- [ ] Entrega/devolución actualiza `INVENTARIO` y `MOVIMIENTOS`; con acta, el PDF cae en la carpeta de PRUEBAS.
- [ ] Novedad de accesos: el ID sale `NOV-xxxx` **mayor al último** y la celda queda como texto (haga antes la Fase 2 de Estructura).
- [ ] BITÁCORA muestra el correo de quien operó (no el del propietario).
- [ ] Un `REVISOR` no ve colaboradores ni la pestaña GH/Formularios.

## 7. Seguridad, en corto
- La API es alcanzable desde Internet, pero **ninguna acción corre sin un token de Google válido, de su dominio y de
  alguien en `USUARIOS_APP`**; los tokens falsos se descartan sin consultar a Google; revocar es inmediato.
- Todo dato del libro se muestra escapado (probado con datos hostiles). La página lleva una política de contenido (CSP);
  si el botón de Google no apareciera, borre temporalmente esa línea de `index.html` para descartarla como causa.
- Los movimientos y novedades NO se reintentan solos (evita duplicados): si se corta la señal, la app avisa que debe
  verificar antes de repetir. Solo las revisiones de inventario tienen cola, porque llevan un identificador único.
- El lector de QR corre en el propio celular; ninguna imagen sale de él.

## 8. Qué quedó validado y qué no
Validado con las funciones reales del sistema y datos del libro (simulación de Sheets): 74 pruebas de la API, 28 de la lógica
de la app y 43 de la interfaz en Chrome (incluida lectura de un QR con cámara simulada).
**No** se pudo probar desde aquí: el inicio de sesión real de Google, el envío de correos, la generación de PDF en Drive y la
cámara física de un celular. Eso es justo lo que valida la copia de pruebas (sección 6).

Licencias: `vendor/jsQR.js` es jsQR 1.4.0 (Apache-2.0), ver `vendor/LICENSE-jsQR.txt`.
