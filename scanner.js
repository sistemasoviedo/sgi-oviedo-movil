/* SGI Oviedo móvil - lector de QR con la cámara trasera.
 * Usa BarcodeDetector (nativo de Chrome en Android) y, si no existe, jsQR. Sin enviar imágenes a ningún servidor. */
(function () {
  'use strict';

  function Escaner(video, alLeer) {
    this.video = video; this.alLeer = alLeer;
    this.stream = null; this.activo = false; this.pausado = false;
    this.detector = null; this.lienzo = null; this.ultimo = ''; this.ultimoT = 0; this.cuadro = 0; this.exigirAusencia = false;
  }

  Escaner.prototype.iniciar = function () {
    var self = this;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Este navegador no permite usar la cámara (se requiere HTTPS).'));
    }
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(function (stream) {
      self.stream = stream;
      self.video.srcObject = stream;
      self.video.setAttribute('playsinline', 'true');
      return self.video.play();
    }).then(function () {
      if ('BarcodeDetector' in window) {
        try { self.detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { self.detector = null; }
      }
      self.activo = true; self.pausado = false;
      self._ciclo();
    });
  };

  Escaner.prototype._ciclo = function () {
    var self = this;
    if (!self.activo) return;
    self.cuadro++;
    // ~8 lecturas por segundo bastan y cuidan la batería.
    if (!self.pausado && self.video.readyState >= 2 && self.cuadro % 7 === 0) {
      self._leer().then(function (texto) {
        if (!texto) { self.exigirAusencia = false; return; }          // el código salió de cuadro: ya puede volver a leerse
        if (self.exigirAusencia && texto === self.ultimo) return;     // sigue apuntando al mismo QR tras guardar: no reabrirlo
        self.exigirAusencia = false;
        self._encontrado(texto);
      }).catch(function () { }).then(function () { requestAnimationFrame(function () { self._ciclo(); }); });
    } else {
      requestAnimationFrame(function () { self._ciclo(); });
    }
  };

  Escaner.prototype._leer = function () {
    var self = this;
    if (self.detector) {
      return self.detector.detect(self.video).then(function (r) { return r && r.length ? r[0].rawValue : ''; });
    }
    return Promise.resolve(self._leerConJsQR(self.video, self.video.videoWidth, self.video.videoHeight));
  };

  Escaner.prototype._leerConJsQR = function (fuente, ancho, alto) {
    if (!window.jsQR || !ancho || !alto) return '';
    var max = 640, k = Math.min(1, max / Math.max(ancho, alto));
    var w = Math.round(ancho * k), h = Math.round(alto * k);
    if (!this.lienzo) this.lienzo = document.createElement('canvas');
    this.lienzo.width = w; this.lienzo.height = h;
    var ctx = this.lienzo.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(fuente, 0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h);
    var r = window.jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
    return r && r.data ? r.data : '';
  };

  /** Lee un QR desde una foto (plan B cuando la cámara en vivo no está disponible). */
  Escaner.prototype.leerArchivo = function (archivo) {
    var self = this;
    return createImageBitmap(archivo).then(function (bmp) {
      if ('BarcodeDetector' in window) {
        try {
          var det = new window.BarcodeDetector({ formats: ['qr_code'] });
          return det.detect(bmp).then(function (r) {
            if (r && r.length) return r[0].rawValue;
            return self._leerConJsQR(bmp, bmp.width, bmp.height);
          });
        } catch (e) { }
      }
      return self._leerConJsQR(bmp, bmp.width, bmp.height);
    });
  };

  Escaner.prototype._encontrado = function (texto) {
    var ahora = Date.now();
    if (texto === this.ultimo && ahora - this.ultimoT < 3000) return;   // el mismo código no se repite en 3 s
    this.ultimo = texto; this.ultimoT = ahora;
    this.pausado = true;
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { }
    this.alLeer(texto);
  };

  Escaner.prototype.pausar = function () { this.pausado = true; };
  /** Tras guardar una revisión se reanuda; el QR que acaba de leerse no se vuelve a abrir hasta que salga de cuadro. */
  Escaner.prototype.reanudar = function () { this.pausado = false; this.exigirAusencia = true; };

  /** Linterna: solo en los celulares cuya cámara la ofrece. Devuelve si quedó encendida. */
  Escaner.prototype.linterna = function (encender) {
    var pista = this.stream && this.stream.getVideoTracks()[0];
    var cap = pista && pista.getCapabilities ? pista.getCapabilities() : {};
    if (!cap.torch) return Promise.reject(new Error('Este celular no permite encender la linterna desde la app.'));
    return pista.applyConstraints({ advanced: [{ torch: !!encender }] }).then(function () { return !!encender; });
  };

  Escaner.prototype.detener = function () {
    this.activo = false;
    if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; }
    try { this.video.srcObject = null; } catch (e) { }
  };

  window.SGIEscaner = Escaner;
}());
