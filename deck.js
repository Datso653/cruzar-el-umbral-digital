/* =========================================================================
   deck.js — shared engine for the main presentation and the backup deck.
   Navegación (flechas, clic, deslizar), contadores animados, waffle, curva
   logística, mapa (solo si la página trae MAPA), notas del orador (tecla N)
   y las chispas de fondo. No depende de ninguna librería salvo Leaflet,
   que solo se carga en la página que tiene mapa.
   ========================================================================= */
(function () {
  var deck = document.getElementById('deck');
  var slides = deck.querySelectorAll('.slide');
  var TOTAL = slides.length;
  var PREFIJO = deck.getAttribute('data-prefijo') || '';   // "R" en el respaldo
  var current = 1;
  var counter = document.getElementById('navCounter');
  var prog = document.getElementById('progFill');

  // ----- waffle: 100 cuadraditos, uno por cada 100 comercios -----
  Array.prototype.forEach.call(document.querySelectorAll('[data-waffle]'), function (w) {
    var k = 0;
    w.getAttribute('data-waffle').split(',').map(Number).forEach(function (n, clase) {
      for (var j = 0; j < n; j++, k++) {
        var i = document.createElement('i');
        if (clase) i.className = 'w' + clase;
        i.style.setProperty('--i', k);
        w.appendChild(i);
      }
    });
  });

  // ----- curva logística (Logit): p = 1 / (1 + e^-(x - 430)/75) -----
  var curva = document.getElementById('curvaS');
  if (curva) {
    var d = '';
    for (var x = 70; x <= 730; x += 6) {
      var p = 1 / (1 + Math.exp(-(x - 430) / 75));
      d += (d ? ' L' : 'M') + x + ',' + (410 - 340 * p).toFixed(1);
    }
    curva.setAttribute('d', d);
  }

  // ----- números que cuentan hacia arriba (el texto final es el del HTML) -----
  function runCounts(slide) {
    Array.prototype.forEach.call(slide.querySelectorAll('[data-count]'), function (el) {
      var final = el.getAttribute('data-final') || el.textContent;
      el.setAttribute('data-final', final);
      var to = parseFloat(el.getAttribute('data-count'));
      var dec = +(el.getAttribute('data-dec') || 0);
      var tok = el._tok = (el._tok || 0) + 1, t0 = null;
      function step(ts) {
        if (el._tok !== tok) return;
        if (t0 === null) t0 = ts;
        var q = Math.max(0, Math.min(1, (ts - t0 - 300) / 1100));
        el.textContent = (to * (1 - Math.pow(1 - q, 3))).toLocaleString('en-US',
          { minimumFractionDigits: dec, maximumFractionDigits: dec });
        if (q < 1) requestAnimationFrame(step); else el.textContent = final;
      }
      requestAnimationFrame(step);
    });
  }

  // ----- mapa: se arma la primera vez; los círculos crecen cada vez que se entra -----
  var mapa = null, marcas = [];
  function crecerCirculos() {
    var t0 = performance.now();
    function paso(ts) {
      var vivos = false;
      marcas.forEach(function (m, i) {
        var q = Math.max(0, Math.min(1, (ts - t0 - 250 - i * 35) / 600));
        var e = 1 - Math.pow(1 - q, 3);
        m.setRadius(m._rFinal * (q < 1 ? e * 1.08 : 1));
        if (q < 1) vivos = true;
      });
      if (vivos) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }
  function mostrarMapa() {
    if (!window.L || !window.MAPA || !document.getElementById('mapa')) return;
    if (!mapa) {
      mapa = L.map('mapa', { zoomControl: false, dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false });
      // Esri gris claro (sin clave): CARTO empezó a pedir API key y salía con marca de agua.
      var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
      L.tileLayer(ESRI + 'World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Map © Esri', maxZoom: 16 }).addTo(mapa);
      L.tileLayer(ESRI + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(mapa);
      var maxN = Math.max.apply(null, window.MAPA.celdas.map(function (c) { return c[2]; }));
      var puntos = [];
      window.MAPA.celdas.forEach(function (c) {
        var m = L.circleMarker([c[0], c[1]], { radius: 0, color: '#14201A', weight: 2,
          fillColor: '#C9F24D', fillOpacity: .88 }).addTo(mapa);
        m._rFinal = 7 + 23 * Math.sqrt(c[2] / maxN);
        marcas.push(m); puntos.push([c[0], c[1]]);
      });
      mapa.fitBounds(puntos, { padding: [40, 40] });
    } else {
      mapa.invalidateSize();
      marcas.forEach(function (m) { m.setRadius(0); });
    }
    crecerCirculos();
  }

  // ----- notas del orador (tecla N): para ensayar, no para proyectar -----
  var panel = document.createElement('div');
  panel.className = 'notes-panel'; panel.hidden = true;
  document.body.appendChild(panel);
  function pintarNotas() {
    if (panel.hidden) return;
    var n = document.getElementById('slide-' + current).querySelector('.notes');
    panel.innerHTML = '<div class="np-k">Notes · slide ' + PREFIJO + current + ' (N to hide)</div>' +
      (n ? n.innerHTML : '<i>No notes for this slide.</i>');
  }
  function alternarNotas() { panel.hidden = !panel.hidden; pintarNotas(); }

  // las bandas de los costados (pantallas que no son 16:9) toman el color de la slide
  function paintBands(sl) {
    var bg = getComputedStyle(sl).backgroundColor;
    document.documentElement.style.background = bg;
    document.body.style.backgroundColor = bg;
  }

  function goTo(n, inicial) {
    n = Math.max(1, Math.min(TOTAL, n));
    if (n === current && !inicial) return;
    deck.setAttribute('data-dir', n >= current ? 'fwd' : 'back');
    var prev = document.getElementById('slide-' + current);
    if (prev) prev.classList.remove('active');
    current = n;
    var next = document.getElementById('slide-' + n);
    next.classList.add('active');
    runCounts(next);
    paintBands(next);
    deck.classList.toggle('on-dark', next.classList.contains('slide--forest'));
    counter.textContent = PREFIJO + current + ' / ' + PREFIJO + TOTAL;
    prog.style.width = (100 * current / TOTAL) + '%';
    if (next.querySelector('#mapa')) setTimeout(mostrarMapa, 80);
    pintarNotas();
    try { history.replaceState(null, '', '#' + current); } catch (e) {}
  }

  document.getElementById('prevBtn').addEventListener('click', function (e) { e.stopPropagation(); goTo(current - 1); });
  document.getElementById('nextBtn').addEventListener('click', function (e) { e.stopPropagation(); goTo(current + 1); });
  deck.addEventListener('click', function (e) { if (!e.target.closest('a')) goTo(current + 1); });
  document.addEventListener('keydown', function (e) {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].indexOf(e.key) > -1) { e.preventDefault(); goTo(current + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].indexOf(e.key) > -1) { e.preventDefault(); goTo(current - 1); }
    else if (e.key === 'Home') goTo(1);
    else if (e.key === 'End') goTo(TOTAL);
    else if (e.key === 'n' || e.key === 'N') alternarNotas();
  });
  // los enlaces internos del índice del respaldo (#4, #7...) cambian de slide
  window.addEventListener('hashchange', function () {
    var h = /^#(\d+)$/.exec(location.hash);
    if (h && +h[1] !== current) goTo(+h[1]);
  });
  // en el celular: deslizar para pasar
  var x0 = null;
  deck.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  deck.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) goTo(current + (dx < 0 ? 1 : -1));
  });

  // ----- escalar el lienzo 1600x900 a la ventana -----
  function fit() {
    document.documentElement.style.setProperty('--k', Math.min(window.innerWidth / 1600, window.innerHeight / 900));
  }
  window.addEventListener('resize', fit);
  fit();

  var hm = /^#(\d+)$/.exec(location.hash);
  goTo(hm ? +hm[1] : 1, true);
  deck.focus();
})();

/* ===== CHISPAS: partículas que flotan y se conectan cuando están cerca ===== */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cv = document.getElementById('chispas'); if (!cv) return;
  var ctx = cv.getContext('2d'), deck = document.getElementById('deck');
  var W = 1600, H = 900, N = 56, LEJOS = 150, pts = [];
  // [r, g, b, alfa] para slides claras y oscuras
  var CLARO  = [[20, 32, 26, .16], [20, 32, 26, .10], [120, 170, 20, .45], [80, 160, 120, .38]];
  var OSCURO = [[201, 242, 77, .55], [201, 242, 77, .30], [158, 217, 185, .45], [255, 255, 255, .18]];
  for (var i = 0; i < N; i++) {
    pts.push({ x: Math.random() * W, y: Math.random() * H, r: 1.6 + Math.random() * 3.2,
      vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5, c: i % 4, fase: Math.random() * Math.PI * 2 });
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function cuadro(t) {
    ctx.clearRect(0, 0, W, H);
    var pal = deck.classList.contains('on-dark') ? OSCURO : CLARO;
    pts.forEach(function (p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
    });
    ctx.lineWidth = 1.2;
    for (var a = 0; a < N; a++) {
      for (var b = a + 1; b < N; b++) {
        var dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < LEJOS) {
          ctx.strokeStyle = rgba(pal[0], pal[0][3] * (1 - d / LEJOS) * .9);
          ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
        }
      }
    }
    pts.forEach(function (q) {
      var col = pal[q.c], brillo = .75 + .25 * Math.sin(t / 700 + q.fase);
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(col, col[3] * brillo); ctx.fill();
    });
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
})();
