// Materiais PBR com texturas procedurais (canvas) — não depende de ficheiros externos.
// A paleta segue o projeto de interiores: piso de madeira escura, paredes brancas com lambri,
// cozinha branca com azulejo "subway", lareira de pedra, escritório verde, garagem industrial.
import * as THREE from 'three';

const cache = new Map();

// ---------- utilitários de ruído ----------
function ruido(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(tam) {
  const c = document.createElement('canvas');
  c.width = tam;
  c.height = tam;
  return c;
}

// Mapa de normais a partir de um mapa de altura (canvas em tons de cinza).
function normalDeAltura(alturaCanvas, forca = 2) {
  const tam = alturaCanvas.width;
  const src = alturaCanvas.getContext('2d').getImageData(0, 0, tam, tam).data;
  const out = canvas(tam);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(tam, tam);
  const h = (x, y) => src[(((y + tam) % tam) * tam + ((x + tam) % tam)) * 4] / 255;
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * forca;
      const dy = (h(x, y + 1) - h(x, y - 1)) * forca;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * tam + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function textura(c, repetir = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repetir[0], repetir[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- geradores ----------
function madeira({ base = '#5a3d25', veio = '#3d2814', claro = '#6e4c2e', tabuas = 6, seed = 7, tam = 1024 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const alt = canvas(tam);
  const actx = alt.getContext('2d');
  const r = ruido(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, tam, tam);
  actx.fillStyle = '#808080';
  actx.fillRect(0, 0, tam, tam);
  const largura = tam / tabuas;
  for (let i = 0; i < tabuas; i++) {
    const x0 = i * largura;
    const desloc = r() * tam; // junta desencontrada
    const tom = 0.85 + r() * 0.3;
    ctx.fillStyle = `rgba(${Math.round(90 * tom)},${Math.round(62 * tom)},${Math.round(38 * tom)},1)`;
    ctx.fillRect(x0, 0, largura, tam);
    // veios
    for (let v = 0; v < 26; v++) {
      ctx.strokeStyle = r() < 0.5 ? veio : claro;
      ctx.globalAlpha = 0.12 + r() * 0.18;
      ctx.lineWidth = 1 + r() * 2.5;
      ctx.beginPath();
      const xv = x0 + r() * largura;
      ctx.moveTo(xv, 0);
      for (let y = 0; y <= tam; y += 64) ctx.lineTo(xv + Math.sin(y / 90 + v) * 6 * r(), y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // juntas
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x0, 0, 3, tam);
    actx.fillStyle = '#404040';
    actx.fillRect(x0, 0, 4, tam);
    ctx.fillRect(x0, (desloc) % tam, largura, 3);
    actx.fillRect(x0, (desloc) % tam, largura, 4);
  }
  return { cor: c, altura: alt };
}

function azulejoSubway({ cor = '#f3f1ec', rejunte = '#b9b3a8', larg = 0.15, alt = 0.075, tam = 1024 } = {}) {
  // 1 metro = tam px
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const h = canvas(tam);
  const hctx = h.getContext('2d');
  ctx.fillStyle = rejunte;
  ctx.fillRect(0, 0, tam, tam);
  hctx.fillStyle = '#404040';
  hctx.fillRect(0, 0, tam, tam);
  const pw = larg * tam;
  const ph = alt * tam;
  const r = ruido(3);
  for (let row = 0; row * ph < tam; row++) {
    const off = row % 2 ? pw / 2 : 0;
    for (let x = -pw; x < tam; x += pw) {
      const t = 0.96 + r() * 0.06;
      ctx.fillStyle = `rgb(${Math.round(243 * t)},${Math.round(241 * t)},${Math.round(236 * t)})`;
      ctx.fillRect(x + off + 3, row * ph + 3, pw - 6, ph - 6);
      hctx.fillStyle = '#c8c8c8';
      hctx.fillRect(x + off + 3, row * ph + 3, pw - 6, ph - 6);
    }
  }
  return { cor: c, altura: h };
}

function pedra({ tam = 1024, seed = 11 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const h = canvas(tam);
  const hctx = h.getContext('2d');
  const r = ruido(seed);
  ctx.fillStyle = '#8f877c';
  ctx.fillRect(0, 0, tam, tam);
  hctx.fillStyle = '#303030';
  hctx.fillRect(0, 0, tam, tam);
  let y = 0;
  while (y < tam) {
    const ph = 60 + r() * 90;
    let x = -r() * 120;
    while (x < tam) {
      const pw = 90 + r() * 200;
      const t = 0.75 + r() * 0.45;
      ctx.fillStyle = `rgb(${Math.round(196 * t)},${Math.round(188 * t)},${Math.round(174 * t)})`;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, pw - 8, ph - 8, 6);
      ctx.fill();
      hctx.fillStyle = `rgb(${150 + Math.round(r() * 60)},0,0)`;
      hctx.fillStyle = `#${(150 + Math.round(r() * 60)).toString(16).repeat(3)}`;
      hctx.beginPath();
      hctx.roundRect(x + 4, y + 4, pw - 8, ph - 8, 6);
      hctx.fill();
      x += pw;
    }
    y += ph;
  }
  return { cor: c, altura: h };
}

// pedra "ledgestone": fiadas finas de pedras de comprimento variável, tons bege/cinza, juntas escuras (com relevo)
function ledgestone({ tam = 1024, seed = 41 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const h = canvas(tam);
  const hctx = h.getContext('2d');
  const r = ruido(seed);
  ctx.fillStyle = '#4e4a43';
  ctx.fillRect(0, 0, tam, tam);
  hctx.fillStyle = '#202020';
  hctx.fillRect(0, 0, tam, tam);
  const px = tam / 1.6; // px por metro (a textura cobre 1,6 m)
  const tons = [[201, 193, 178], [184, 176, 162], [214, 207, 194], [170, 162, 150], [224, 217, 204], [190, 180, 164]];
  let y = 0;
  while (y < tam) {
    const alt = (0.045 + r() * 0.07) * px;
    let x = -r() * 0.3 * px;
    while (x < tam) {
      const comp = (0.12 + r() * 0.36) * px;
      const t = tons[Math.floor(r() * tons.length)];
      const n = (r() - 0.5) * 18;
      ctx.fillStyle = `rgb(${t[0] + n | 0},${t[1] + n | 0},${t[2] + n | 0})`;
      const j = 2 + r() * 2; // junta
      ctx.fillRect(x + j, y + j, comp - 2 * j, alt - 2 * j);
      // sombra subtil na base de cada pedra e variação de relevo
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x + j, y + alt - 2 * j - 2, comp - 2 * j, 3);
      const rel = 120 + r() * 100;
      hctx.fillStyle = `rgb(${rel},${rel},${rel})`;
      hctx.fillRect(x + j, y + j, comp - 2 * j, alt - 2 * j);
      x += comp;
    }
    y += alt;
  }
  return { cor: c, altura: h };
}

function reboco({ cor = [231, 227, 218], tam = 512, seed = 5, granulo = 10 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const h = canvas(tam);
  const hctx = h.getContext('2d');
  const img = ctx.createImageData(tam, tam);
  const himg = hctx.createImageData(tam, tam);
  const r = ruido(seed);
  for (let i = 0; i < tam * tam; i++) {
    const n = (r() - 0.5) * granulo;
    img.data[i * 4] = cor[0] + n;
    img.data[i * 4 + 1] = cor[1] + n;
    img.data[i * 4 + 2] = cor[2] + n;
    img.data[i * 4 + 3] = 255;
    const hv = 128 + (r() - 0.5) * 30;
    himg.data[i * 4] = himg.data[i * 4 + 1] = himg.data[i * 4 + 2] = hv;
    himg.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  hctx.putImageData(himg, 0, 0);
  return { cor: c, altura: h };
}

function cimentoQueimado({ tam = 1024, seed = 21 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const r = ruido(seed);
  ctx.fillStyle = '#7d7c78';
  ctx.fillRect(0, 0, tam, tam);
  for (let i = 0; i < 400; i++) {
    const g = ctx.createRadialGradient(r() * tam, r() * tam, 0, r() * tam, r() * tam, 80 + r() * 250);
    const t = 100 + r() * 50;
    g.addColorStop(0, `rgba(${t},${t},${t - 4},0.18)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, tam, tam);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, tam, tam);
  return { cor: c, altura: null };
}

function ladrilhoHidraulico({ tam = 512 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e7e2d8';
  ctx.fillRect(0, 0, tam, tam);
  ctx.fillStyle = '#5c6b5a';
  const q = tam / 2;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(i * q + q / 2, j * q + q / 2, q * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.strokeStyle = '#c9c2b6';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, q, q);
  ctx.strokeRect(q, 0, q, q);
  ctx.strokeRect(0, q, q, q);
  ctx.strokeRect(q, q, q, q);
  return { cor: c, altura: null };
}

function porcelanato({ tam = 1024, cor = [232, 228, 220], rejunte = '#bdb6aa', seed = 9, pecas = 2 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const h = canvas(tam);
  const hctx = h.getContext('2d');
  const r = ruido(seed);
  ctx.fillStyle = rejunte;
  ctx.fillRect(0, 0, tam, tam);
  hctx.fillStyle = '#404040';
  hctx.fillRect(0, 0, tam, tam);
  const p = tam / pecas;
  for (let i = 0; i < pecas; i++)
    for (let j = 0; j < pecas; j++) {
      const t = 0.97 + r() * 0.05;
      ctx.fillStyle = `rgb(${cor[0] * t},${cor[1] * t},${cor[2] * t})`;
      ctx.fillRect(i * p + 2, j * p + 2, p - 4, p - 4);
      hctx.fillStyle = '#d0d0d0';
      hctx.fillRect(i * p + 2, j * p + 2, p - 4, p - 4);
      // veio de mármore suave
      ctx.strokeStyle = 'rgba(150,140,130,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(i * p + r() * p, j * p);
      ctx.bezierCurveTo(i * p + r() * p, j * p + r() * p, i * p + r() * p, j * p + r() * p, i * p + r() * p, j * p + p);
      ctx.stroke();
    }
  return { cor: c, altura: h };
}

function tecido({ cor = [222, 214, 200], tam = 256, seed = 4 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(tam, tam);
  const r = ruido(seed);
  for (let y = 0; y < tam; y++)
    for (let x = 0; x < tam; x++) {
      const trama = ((x % 4 < 2) ^ (y % 4 < 2)) ? 6 : -6;
      const n = (r() - 0.5) * 10 + trama;
      const i = (y * tam + x) * 4;
      img.data[i] = cor[0] + n;
      img.data[i + 1] = cor[1] + n;
      img.data[i + 2] = cor[2] + n;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return { cor: c, altura: null };
}

function tijoloAparente({ tam = 1024, seed = 13 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const h = canvas(tam);
  const hctx = h.getContext('2d');
  const r = ruido(seed);
  ctx.fillStyle = '#9e9a93';
  ctx.fillRect(0, 0, tam, tam);
  hctx.fillStyle = '#303030';
  hctx.fillRect(0, 0, tam, tam);
  const bw = tam * 0.24;
  const bh = tam * 0.075;
  for (let row = 0; row * bh < tam; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < tam; x += bw) {
      const t = 0.8 + r() * 0.35;
      ctx.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(144 * t)},${Math.round(136 * t)})`;
      ctx.fillRect(x + off + 4, row * bh + 4, bw - 8, bh - 8);
      hctx.fillStyle = '#c0c0c0';
      hctx.fillRect(x + off + 4, row * bh + 4, bw - 8, bh - 8);
    }
  }
  return { cor: c, altura: h };
}


// ---------- texturas fotográficas (three.js examples, licença MIT) ----------
const carregador = new THREE.TextureLoader();
function foto(nome, rep = [1, 1], srgb = true, rot = 0) {
  const t = carregador.load(`./texturas/${nome}`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  t.rotation = rot;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Carrega uma foto e processa os pixels (ex.: dessaturar) antes de a usar como textura. */
function fotoProcessada(nome, fn, rep = [1, 1], rot = 0) {
  const c = canvas(64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  t.rotation = rot;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  new THREE.ImageLoader().load(`./texturas/${nome}`, (img) => {
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    fn(d.data);
    ctx.putImageData(d, 0, 0);
    t.needsUpdate = true;
  });
  return t;
}

const dessaturar = (fator, brilho = 1) => (px) => {
  for (let i = 0; i < px.length; i += 4) {
    const l = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
    px[i] = Math.min(255, (px[i] + (l - px[i]) * fator) * brilho);
    px[i + 1] = Math.min(255, (px[i + 1] + (l - px[i + 1]) * fator) * brilho);
    px[i + 2] = Math.min(255, (px[i + 2] + (l - px[i + 2]) * fator) * brilho);
  }
};

// ---------- papéis de parede e revestimentos do projeto ----------
function papelFloral({ tam = 1024, fundo = [244, 240, 232], tinta = [156, 168, 148], seed = 61, densidade = 70 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const r = ruido(seed);
  ctx.fillStyle = `rgb(${fundo.join(',')})`;
  ctx.fillRect(0, 0, tam, tam);
  ctx.strokeStyle = `rgba(${tinta.join(',')},0.85)`;
  ctx.fillStyle = `rgba(${tinta.join(',')},0.7)`;
  ctx.lineWidth = 2;
  // ramos com folhas (motivo repetível: desenha também deslocado para as bordas casarem)
  const ramo = (x0, y0, ang, comp) => {
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(comp * 0.4, -comp * 0.15, comp, 0);
    ctx.stroke();
    const nf = 3 + Math.floor(r() * 4);
    for (let k = 0; k < nf; k++) {
      const t = (k + 1) / (nf + 1);
      const px = comp * t;
      const py = -comp * 0.15 * 4 * t * (1 - t);
      const lado = k % 2 ? 1 : -1;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(lado * (0.9 + r() * 0.4));
      ctx.beginPath();
      const fl = comp * (0.18 + r() * 0.1);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(fl * 0.5, -fl * 0.35, fl, 0);
      ctx.quadraticCurveTo(fl * 0.5, fl * 0.35, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };
  for (let i = 0; i < densidade; i++) {
    const x = r() * tam;
    const y = r() * tam;
    const ang = r() * Math.PI * 2;
    const comp = tam * (0.08 + r() * 0.08);
    for (const [dx, dy] of [[0, 0], [-tam, 0], [tam, 0], [0, -tam], [0, tam]]) ramo(x + dx, y + dy, ang, comp);
  }
  return { cor: c, altura: null };
}

function papelXadrez({ tam = 512, fundo = [245, 242, 236], linha = [200, 192, 180], seed = 3 } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${fundo.join(',')})`;
  ctx.fillRect(0, 0, tam, tam);
  const passo = tam / 4;
  for (let i = 0; i < 4; i++) {
    for (const [w, a] of [[passo * 0.28, 0.35], [passo * 0.06, 0.7], [passo * 0.02, 0.9]]) {
      ctx.fillStyle = `rgba(${linha.join(',')},${a})`;
      ctx.fillRect(i * passo + passo / 2 - w / 2, 0, w, tam);
      ctx.fillRect(0, i * passo + passo / 2 - w / 2, tam, w);
    }
  }
  return { cor: c, altura: null };
}

function ripado({ tam = 512, cor = [154, 167, 184], largura = 0.1, vertical = true } = {}) {
  // tábuas (shiplap) com junta sombreada
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const h = canvas(tam);
  const hctx = h.getContext('2d');
  ctx.fillStyle = `rgb(${cor.join(',')})`;
  ctx.fillRect(0, 0, tam, tam);
  hctx.fillStyle = '#c0c0c0';
  hctx.fillRect(0, 0, tam, tam);
  const n = Math.round(1 / largura);
  const p = tam / n;
  for (let i = 0; i < n; i++) {
    const g = i * p;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    hctx.fillStyle = '#404040';
    if (vertical) {
      ctx.fillRect(g, 0, 4, tam);
      hctx.fillRect(g, 0, 5, tam);
    } else {
      ctx.fillRect(0, g, tam, 4);
      hctx.fillRect(0, g, tam, 5);
    }
  }
  return { cor: c, altura: h };
}

function pedraEscura({ tam = 1024, seed = 27 } = {}) {
  const base = cimentoQueimado({ tam, seed });
  const ctx = base.cor.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, tam, tam);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, tam / 2, tam / 2);
  ctx.strokeRect(tam / 2, 0, tam / 2, tam / 2);
  ctx.strokeRect(0, tam / 2, tam / 2, tam / 2);
  ctx.strokeRect(tam / 2, tam / 2, tam / 2, tam / 2);
  return base;
}

function espinhaPeixe({ tam = 1024, cor = [212, 198, 178], rejunte = '#b9ad9b' } = {}) {
  const c = canvas(tam);
  const ctx = c.getContext('2d');
  const h = canvas(tam);
  const hctx = h.getContext('2d');
  ctx.fillStyle = rejunte;
  ctx.fillRect(0, 0, tam, tam);
  hctx.fillStyle = '#404040';
  hctx.fillRect(0, 0, tam, tam);
  const L = tam / 4;
  const W = L / 4;
  const r = ruido(9);
  for (let i = -2; i < 10; i++)
    for (let j = -2; j < 10; j++) {
      for (const ang of [Math.PI / 4, -Math.PI / 4]) {
        ctx.save();
        hctx.save();
        const x = i * L * 0.75 + (ang > 0 ? 0 : L * 0.5);
        const y = j * L * 0.75 + (ang > 0 ? 0 : L * 0.5) - i * L * 0.25;
        ctx.translate(x, y);
        ctx.rotate(ang);
        hctx.translate(x, y);
        hctx.rotate(ang);
        const t = 0.95 + r() * 0.08;
        ctx.fillStyle = `rgb(${cor[0] * t},${cor[1] * t},${cor[2] * t})`;
        ctx.fillRect(2, 2, L - 4, W - 4);
        hctx.fillStyle = '#cccccc';
        hctx.fillRect(2, 2, L - 4, W - 4);
        ctx.restore();
        hctx.restore();
      }
    }
  return { cor: c, altura: h };
}

// ---------- catálogo de materiais ----------
const receitas = {
  // pisos
  madeira_escura: () =>
    new THREE.MeshStandardMaterial({
      map: foto('hardwood2_diffuse.jpg', [1 / 1.4, 1 / 1.4], true, Math.PI / 2),
      bumpMap: foto('hardwood2_bump.jpg', [1 / 1.4, 1 / 1.4], false, Math.PI / 2),
      bumpScale: 0.6,
      roughnessMap: foto('hardwood2_roughness.jpg', [1 / 1.4, 1 / 1.4], false, Math.PI / 2),
      color: '#a07a56',
      roughness: 0.75,
    }),
  madeira_clara: () => padrao(madeira({ seed: 19 }), { rep: [1 / 1.2, 1 / 1.2], rough: 0.5, normal: 0.5, cor: '#c9a882' }),
  porcelanato_claro: () => padrao(porcelanato(), { rep: [1 / 1.2, 1 / 1.2], rough: 0.25, normal: 0.3 }),
  porcelanato_cinza: () => padrao(porcelanato({ cor: [190, 188, 184], rejunte: '#8f8d89' }), { rep: [1 / 1.2, 1 / 1.2], rough: 0.35, normal: 0.3 }),
  ladrilho: () => padrao(ladrilhoHidraulico(), { rep: [1 / 0.4, 1 / 0.4], rough: 0.5 }),
  cimento: () => padrao(cimentoQueimado(), { rep: [1 / 2.5, 1 / 2.5], rough: 0.8 }),
  cimento_claro: () => padrao(cimentoQueimado({ seed: 5 }), { rep: [1 / 2.5, 1 / 2.5], rough: 0.85, cor: '#cfcdc8' }),
  deck: () => padrao(madeira({ seed: 31 }), { rep: [1 / 1.5, 1 / 1.5], rough: 0.7, normal: 0.7, cor: '#a58a6a' }),
  grama: () => new THREE.MeshStandardMaterial({ map: foto('grasslight-big.jpg', [1 / 4, 1 / 4]), color: '#9fb37a', roughness: 1 }),

  // paredes
  parede_branca: () => padrao(reboco(), { rep: [1, 1], rough: 0.85, normal: 0.25 }),
  parede_creme: () => padrao(reboco({ cor: [226, 219, 205] }), { rep: [1, 1], rough: 0.85, normal: 0.25 }),
  parede_verde: () => padrao(reboco({ cor: [78, 90, 74], granulo: 5 }), { rep: [1, 1], rough: 0.65, normal: 0.15 }),
  parede_azul: () => padrao(papelXadrez(), { rep: [1 / 0.5, 1 / 0.5], rough: 0.9 }),
  parede_papel_floral: () => padrao(papelFloral(), { rep: [1 / 1.2, 1 / 1.2], rough: 0.9 }),
  subway: () => padrao(azulejoSubway(), { rep: [1, 1], rough: 0.2, normal: 0.8 }),
  pedra: () => padrao(ledgestone(), { rep: [1 / 1.6, 1 / 1.6], rough: 0.95, normal: 1.6 }),
  tijolo: () =>
    new THREE.MeshStandardMaterial({
      map: fotoProcessada('brick_diffuse.jpg', dessaturar(0.85, 1.25), [1 / 2.2, 1 / 2.2]),
      bumpMap: foto('brick_bump.jpg', [1 / 2.2, 1 / 2.2], false),
      bumpScale: 0.5,
      roughnessMap: foto('brick_roughness.jpg', [1 / 2.2, 1 / 2.2], false),
      roughness: 0.95,
    }),
  siding: () => padrao(ripado({ cor: [221, 218, 210], largura: 0.2, vertical: false }), { rep: [1, 1], rough: 0.8, normal: 0.5 }),
  shiplap_azul: () => padrao(ripado({ cor: [150, 163, 182], largura: 0.12, vertical: true }), { rep: [1, 1], rough: 0.6, normal: 0.6 }),
  shiplap_branco: () => padrao(ripado({ cor: [230, 227, 219], largura: 0.12, vertical: true }), { rep: [1, 1], rough: 0.6, normal: 0.5 }),
  papel_floral: () => padrao(papelFloral(), { rep: [1 / 1.2, 1 / 1.2], rough: 0.9 }),
  papel_floral_bege: () => padrao(papelFloral({ tinta: [196, 180, 156], fundo: [247, 243, 236], seed: 91, densidade: 90 }), { rep: [1 / 1.2, 1 / 1.2], rough: 0.9 }),
  papel_xadrez: () => padrao(papelXadrez(), { rep: [1 / 0.5, 1 / 0.5], rough: 0.9 }),
  salvia: () => new THREE.MeshStandardMaterial({ color: '#8c9a84', roughness: 0.55 }),
  bege: () => new THREE.MeshStandardMaterial({ color: '#e6dccb', roughness: 0.6 }),
  verde_escuro: () => new THREE.MeshStandardMaterial({ color: '#4a5744', roughness: 0.55 }),
  pedra_escura: () => padrao(pedraEscura(), { rep: [1 / 1.2, 1 / 1.2], rough: 0.35 }),
  espinha: () => padrao(espinhaPeixe(), { rep: [1, 1], rough: 0.35, normal: 0.5 }),
  cortina: () => new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 1, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
  ratan: () => new THREE.MeshStandardMaterial({ color: '#c9a56b', roughness: 0.9, side: THREE.DoubleSide }),
  veludo_verde: () => new THREE.MeshStandardMaterial({ color: '#1f5a3a', roughness: 0.75 }),
  boucle: () => padrao(tecido({ cor: [232, 226, 214], seed: 12 }), { rep: [6, 6], rough: 1 }),
  couro_caramelo: () => new THREE.MeshPhysicalMaterial({ color: '#6e4426', roughness: 0.45, clearcoat: 0.3 }),
  nogueira: () => padrao(madeira({ seed: 88, tabuas: 3 }), { rep: [1, 1], rough: 0.4, normal: 0.3, cor: '#8a6240' }),
  carvalho: () => padrao(madeira({ seed: 23, tabuas: 3 }), { rep: [1, 1], rough: 0.55, normal: 0.3, cor: '#c8a878' }),
  bronze: () => new THREE.MeshStandardMaterial({ color: '#3a2e22', roughness: 0.5, metalness: 0.6 }),
  carro_preto: () => new THREE.MeshPhysicalMaterial({ color: '#111214', roughness: 0.2, metalness: 0.7, clearcoat: 1 }),
  carro_vermelho: () => new THREE.MeshPhysicalMaterial({ color: '#b3121b', roughness: 0.25, metalness: 0.5, clearcoat: 1 }),
  lampada: () => new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd89a', emissiveIntensity: 2.2 }),
  cupula: () => new THREE.MeshStandardMaterial({ color: '#f3ede0', roughness: 1, transparent: true, opacity: 0.92, side: THREE.DoubleSide, emissive: '#c9b48a', emissiveIntensity: 0.25 }),
  cimento_parede: () => padrao(cimentoQueimado({ seed: 44 }), { rep: [1 / 2.5, 1 / 2.5], rough: 0.85 }),
  teto: () => new THREE.MeshStandardMaterial({ color: '#e9e5dd', roughness: 0.95 }),

  // marcenaria / móveis
  marcenaria_branca: () => new THREE.MeshStandardMaterial({ color: '#e6e2da', roughness: 0.45 }),
  marcenaria_madeira: () => padrao(madeira({ seed: 51, tabuas: 2 }), { rep: [1, 1], rough: 0.45, normal: 0.3 }),
  marcenaria_verde: () => new THREE.MeshStandardMaterial({ color: '#3f4d41', roughness: 0.45 }),
  marcenaria_azul: () => new THREE.MeshStandardMaterial({ color: '#7f8fb0', roughness: 0.5 }),
  marcenaria_cinza: () => new THREE.MeshStandardMaterial({ color: '#4a4f50', roughness: 0.5 }),
  tecido_claro: () => padrao(tecido(), { rep: [4, 4], rough: 1 }),
  tecido_verde: () => padrao(tecido({ cor: [46, 78, 58] }), { rep: [4, 4], rough: 1 }),
  couro: () => new THREE.MeshStandardMaterial({ color: '#7a4a2c', roughness: 0.55 }),
  colchao: () => padrao(tecido({ cor: [240, 236, 228] }), { rep: [3, 3], rough: 1 }),
  tapete: () => padrao(tecido({ cor: [150, 140, 128], seed: 8 }), { rep: [6, 6], rough: 1 }),
  marmore: () => padrao(porcelanato({ pecas: 1, rejunte: '#e8e4dc' }), { rep: [1, 1], rough: 0.15, normal: 0.1 }),
  granito_preto: () => new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.2, metalness: 0.1 }),
  metal_preto: () => new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.4, metalness: 0.7 }),
  inox: () => new THREE.MeshStandardMaterial({ color: '#b9bcbf', roughness: 0.25, metalness: 0.9 }),
  latao: () => new THREE.MeshStandardMaterial({ color: '#b08d4c', roughness: 0.3, metalness: 0.9 }),
  porta: () => new THREE.MeshStandardMaterial({ color: '#f5f3ee', roughness: 0.5 }),
  porta_madeira: () => padrao(madeira({ seed: 77, tabuas: 3 }), { rep: [1, 1], rough: 0.5, normal: 0.3, cor: '#8a6743' }),
  caixilho: () => new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.5, metalness: 0.4 }),
  vidro: () =>
    new THREE.MeshPhysicalMaterial({
      color: '#dfe9ee',
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      transmission: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  tela_tv: () => new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.1, metalness: 0.3 }),
  planta: () => new THREE.MeshStandardMaterial({ color: '#4d6b3f', roughness: 0.95 }),
  ceramica_branca: () => new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.15 }),
  carro: () => new THREE.MeshPhysicalMaterial({ color: '#e8e8e6', roughness: 0.25, metalness: 0.6, clearcoat: 1 }),
};

function padrao(mapas, { rep = [1, 1], rough = 0.6, normal = 0.5, cor } = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: textura(mapas.cor, rep),
    roughness: rough,
    metalness: 0,
  });
  if (cor) m.color = new THREE.Color(cor);
  if (mapas.altura && normal > 0) {
    m.normalMap = textura(normalDeAltura(mapas.altura, 3), rep, false);
    m.normalScale = new THREE.Vector2(normal, normal);
  }
  return m;
}

/** Devolve o material pelo nome (com cache). */
export function material(nome) {
  if (!cache.has(nome)) {
    const receita = receitas[nome] || receitas.parede_branca;
    cache.set(nome, receita());
  }
  return cache.get(nome);
}

/** Gera todos os materiais de uma vez (para mostrar progresso no ecrã inicial). */
export async function prepararMateriais(aoProgredir) {
  const nomes = Object.keys(receitas);
  for (let i = 0; i < nomes.length; i++) {
    material(nomes[i]);
    aoProgredir?.((i + 1) / nomes.length, nomes[i]);
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
}

export const nomesMateriais = Object.keys(receitas);
