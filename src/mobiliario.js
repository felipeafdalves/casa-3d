// Kit de mobiliário paramétrico em estilo "modern farmhouse", construído com primitivas e materiais PBR.
// Cada peça é construída na origem, com +y para cima e a FRENTE virada para +z local
// (rotação 0 = frente para o sul; 90 = leste; 180 = norte; -90 = oeste).
// Devolve { grupo, colisores: [{x, y, hx, hy, h0, h1}] } em coordenadas locais (x, y-plano = -z).
import * as THREE from 'three';
import { material } from './materiais.js';

// ---------------------------------------------------------------- primitivas
const M = (mat) => (typeof mat === 'string' ? material(mat) : mat);

function caixa(w, h, d, mat, x = 0, y = 0, z = 0, sombra = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(mat));
  m.position.set(x, y, z);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}

// caixa com UVs em metros (texturas com escala real, ex.: pedra da lareira)
function caixaM(w, h, d, mat, x = 0, y = 0, z = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) uv.setXY(f * 4 + i, uv.getX(f * 4 + i) * dims[f][0], uv.getY(f * 4 + i) * dims[f][1]);
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, M(mat));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cilindro(r, h, mat, x = 0, y = 0, z = 0, seg = 16, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), M(mat));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function esfera(r, mat, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), M(mat));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function toro(r, tubo, mat, x = 0, y = 0, z = 0, seg = 32) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tubo, 8, seg), M(mat));
  m.position.set(x, y, z);
  m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  return m;
}

/** Caixa com cantos arredondados (almofadas, estofados). */
function almofada(w, h, d, mat, x = 0, y = 0, z = 0, raio = 0.04) {
  const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const m = new THREE.Mesh(geo, M(mat));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  // "arredonda" visualmente com uma escala ligeira nos cantos via esferas nas pontas (barato)
  const r = Math.min(raio, h / 2, d / 2);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) m.add(cilindro(r, h - 0.005, mat, sx * (w / 2 - r + 0.002), 0, sz * (d / 2 - r + 0.002), 10));
  return m;
}

/** Perna torneada (pilha de cilindros e esferas). */
function pernaTorneada(h, mat, x = 0, z = 0, r = 0.035) {
  const g = new THREE.Group();
  g.add(cilindro(r * 0.9, h * 0.3, mat, 0, h * 0.15, 0, 12, r * 1.15));
  g.add(esfera(r * 1.4, mat, 0, h * 0.34, 0, 10));
  g.add(cilindro(r * 0.8, h * 0.28, mat, 0, h * 0.52, 0, 12, r * 0.95));
  g.add(esfera(r * 1.25, mat, 0, h * 0.69, 0, 10));
  g.add(cilindro(r * 1.1, h * 0.3, mat, 0, h * 0.85, 0, 12, r * 1.2));
  g.position.set(x, 0, z);
  return g;
}

/** Porta/painel estilo shaker: painel rebaixado com moldura em relevo. */
function shaker(w, h, mat, x, y, z, puxador = 'latao', esp = 0.02) {
  const g = new THREE.Group();
  g.add(caixa(w, h, esp, mat, 0, 0, 0));
  const b = Math.min(0.07, w * 0.18);
  g.add(caixa(w, b, esp + 0.012, mat, 0, h / 2 - b / 2, 0));
  g.add(caixa(w, b, esp + 0.012, mat, 0, -h / 2 + b / 2, 0));
  g.add(caixa(b, h, esp + 0.012, mat, -w / 2 + b / 2, 0, 0));
  g.add(caixa(b, h, esp + 0.012, mat, w / 2 - b / 2, 0, 0));
  if (puxador) g.add(esfera(0.014, puxador, w / 2 - b - 0.03, 0, esp / 2 + 0.014, 8));
  g.position.set(x, y, z);
  return g;
}

/** Porta com vidro e travessas (armário superior). */
function portaVidro(w, h, mat, x, y, z) {
  const g = new THREE.Group();
  const b = 0.05;
  g.add(caixa(w, b, 0.025, mat, 0, h / 2 - b / 2, 0));
  g.add(caixa(w, b, 0.025, mat, 0, -h / 2 + b / 2, 0));
  g.add(caixa(b, h, 0.025, mat, -w / 2 + b / 2, 0, 0));
  g.add(caixa(b, h, 0.025, mat, w / 2 - b / 2, 0, 0));
  g.add(caixa(0.015, h - 2 * b, 0.012, mat, 0, 0, 0));
  g.add(caixa(w - 2 * b, 0.015, 0.012, mat, 0, 0, 0));
  const v = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * b, h - 2 * b), material('vidro'));
  g.add(v);
  g.add(esfera(0.012, 'latao', w / 2 - b - 0.02, -0.05, 0.02, 8));
  g.position.set(x, y, z);
  return g;
}

/** Pilha de livros coloridos. */
function livros(x, y, z, n = 6, deitados = false) {
  const g = new THREE.Group();
  const cores = ['#6f4a3a', '#3f5b4a', '#b39a7a', '#4a5a6a', '#8a3a2a', '#d9d2c3', '#2f3a44'];
  for (let i = 0; i < n; i++) {
    const cor = new THREE.MeshStandardMaterial({ color: cores[i % cores.length], roughness: 0.9 });
    const h = 0.18 + (i % 3) * 0.03;
    if (deitados) g.add(caixa(0.16, 0.03, 0.22, cor, 0, 0.015 + i * 0.03, 0));
    else g.add(caixa(0.035, h, 0.2, cor, i * 0.04, h / 2, 0));
  }
  g.position.set(x, y, z);
  return g;
}

function candeeiroMesa(x, y, z, escala = 1) {
  const g = new THREE.Group();
  g.add(cilindro(0.09 * escala, 0.32 * escala, 'ceramica_branca', 0, 0.16 * escala, 0, 14, 0.07 * escala));
  g.add(cilindro(0.12 * escala, 0.2 * escala, 'cupula', 0, 0.45 * escala, 0, 16, 0.17 * escala));
  g.add(esfera(0.03 * escala, 'lampada', 0, 0.42 * escala, 0, 8));
  g.position.set(x, y, z);
  return g;
}

function planta(x, y, z, r = 0.25, folhas = 5) {
  const g = new THREE.Group();
  for (let i = 0; i < folhas; i++) {
    const a = (i / folhas) * Math.PI * 2;
    g.add(esfera(r * (0.6 + (i % 2) * 0.25), 'planta', Math.cos(a) * r * 0.55, r * 0.7 + (i % 3) * r * 0.25, Math.sin(a) * r * 0.55, 8));
  }
  g.position.set(x, y, z);
  return g;
}

const col = (hx, hy, h1, x = 0, y = 0, h0 = 0) => ({ x, y, hx, hy, h0, h1 });

// ---------------------------------------------------------------- peças
const pecas = {
  // ---------- hall / circulação
  banco_mudroom({ largura = 2.4 }) {
    const g = new THREE.Group();
    const lb = largura * 0.62; // largura do banco
    const xb = -largura / 2 + lb / 2;
    const xa = largura / 2 - (largura - lb) / 2;
    // banco com cubículos
    g.add(caixa(lb, 0.05, 0.45, 'marcenaria_branca', xb, 0.45, 0));
    g.add(caixa(0.03, 0.45, 0.45, 'marcenaria_branca', xb - lb / 2 + 0.015, 0.225, 0));
    g.add(caixa(0.03, 0.45, 0.45, 'marcenaria_branca', xb + lb / 2 - 0.015, 0.225, 0));
    g.add(caixa(0.03, 0.45, 0.45, 'marcenaria_branca', xb, 0.225, 0));
    g.add(almofada(lb - 0.06, 0.07, 0.42, 'tecido_claro', xb, 0.51, 0));
    // painel ripado de madeira ao fundo, com ganchos
    g.add(caixa(lb, 1.45, 0.03, 'carvalho', xb, 1.3, -0.2));
    for (let i = 0; i < 3; i++) g.add(caixa(0.03, 0.1, 0.05, 'metal_preto', xb - lb / 3 + (i * lb) / 3, 1.55, -0.16));
    // prateleira superior com cestos
    g.add(caixa(lb, 0.04, 0.35, 'marcenaria_branca', xb, 2.0, -0.05));
    for (let i = 0; i < 3; i++) g.add(caixa(lb / 3 - 0.08, 0.28, 0.3, 'ratan', xb - lb / 3 + (i * lb) / 3, 2.16, -0.06));
    g.add(caixa(lb, 0.3, 0.4, 'marcenaria_branca', xb, 2.45, -0.02));
    // armário lateral com portas shaker
    g.add(caixa(largura - lb, 2.6, 0.45, 'marcenaria_branca', xa, 1.3, 0));
    shakerColuna(g, largura - lb - 0.04, 2.45, xa, 1.3, 0.226, 2);
    return { grupo: g, colisores: [col(largura / 2, 0.23, 2.6)] };
  },
  comoda({ largura = 1.5, material: mat = 'carvalho' }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.78, 0.48, mat, 0, 0.55, 0));
    for (const [x, z] of [[-largura / 2 + 0.06, -0.18], [largura / 2 - 0.06, -0.18], [-largura / 2 + 0.06, 0.18], [largura / 2 - 0.06, 0.18]]) g.add(cilindro(0.02, 0.16, mat, x, 0.08, z, 8, 0.028));
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 2; c++) {
        g.add(caixa(largura / 2 - 0.05, 0.2, 0.012, mat, -largura / 4 + (c * largura) / 2, 0.29 + r * 0.24, 0.246));
        g.add(esfera(0.012, 'bronze', -largura / 4 + (c * largura) / 2, 0.29 + r * 0.24, 0.26, 8));
      }
    g.add(caixa(largura + 0.03, 0.03, 0.51, mat, 0, 0.955, 0));
    // decoração: vaso preto com ramos, velas, lanterna
    g.add(cilindro(0.09, 0.32, 'metal_preto', -largura / 2 + 0.3, 1.13, 0, 12, 0.07));
    g.add(planta(-largura / 2 + 0.3, 1.25, 0, 0.16, 4));
    g.add(cilindro(0.03, 0.12, 'ceramica_branca', 0, 1.03, 0.05, 8));
    g.add(cilindro(0.03, 0.16, 'ceramica_branca', 0.12, 1.05, -0.05, 8));
    g.add(caixa(0.14, 0.24, 0.14, 'metal_preto', largura / 2 - 0.3, 1.09, 0));
    g.add(esfera(0.03, 'lampada', largura / 2 - 0.3, 1.09, 0, 8));
    return { grupo: g, colisores: [col(largura / 2, 0.25, 1.0)] };
  },
  espelho({ largura = 1.1, altura = 1.2 }) {
    const g = new THREE.Group();
    const arco = new THREE.Shape();
    arco.moveTo(-largura / 2, 0);
    arco.lineTo(-largura / 2, altura - largura / 2);
    arco.absarc(0, altura - largura / 2, largura / 2, Math.PI, 0, true);
    arco.lineTo(largura / 2, 0);
    arco.lineTo(-largura / 2, 0);
    const moldura = new THREE.Mesh(new THREE.ExtrudeGeometry(arco, { depth: 0.03, bevelEnabled: false }), material('metal_preto'));
    moldura.position.set(0, -altura / 2, -0.015);
    g.add(moldura);
    const esp = new THREE.Shape();
    const l2 = largura / 2 - 0.035;
    esp.moveTo(-l2, 0.035);
    esp.lineTo(-l2, altura - largura / 2);
    esp.absarc(0, altura - largura / 2, l2, Math.PI, 0, true);
    esp.lineTo(l2, 0.035);
    esp.lineTo(-l2, 0.035);
    const vidro = new THREE.Mesh(new THREE.ShapeGeometry(esp), new THREE.MeshStandardMaterial({ color: '#dfe4e6', roughness: 0.03, metalness: 1 }));
    vidro.position.set(0, -altura / 2, 0.02);
    g.add(vidro);
    return { grupo: g, colisores: [] };
  },
  espelho_oval({ largura = 0.6, altura = 1.6 }) {
    const g = new THREE.Group();
    const r = largura / 2;
    const forma = new THREE.Shape();
    forma.absarc(0, altura / 2 - r, r, 0, Math.PI, false);
    forma.lineTo(-r, -altura / 2 + r);
    forma.absarc(0, -altura / 2 + r, r, Math.PI, 0, false);
    forma.lineTo(r, altura / 2 - r);
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.025, bevelEnabled: false }), material('bronze')));
    const vidro = new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshStandardMaterial({ color: '#dfe4e6', roughness: 0.03, metalness: 1 }));
    vidro.scale.set(0.93, 0.95, 1);
    vidro.position.z = 0.03;
    g.add(vidro);
    return { grupo: g, colisores: [] };
  },
  quadro({ largura = 0.9, altura = 0.7, cor = '#7d8f7a', moldura = 'metal_preto' }) {
    const g = new THREE.Group();
    g.add(caixa(largura, altura, 0.03, moldura, 0, 0, 0));
    g.add(caixa(largura - 0.06, altura - 0.06, 0.012, 'marcenaria_branca', 0, 0, 0.012));
    g.add(caixa(largura - 0.22, altura - 0.22, 0.008, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.9 }), 0, 0, 0.024));
    return { grupo: g, colisores: [] };
  },
  galeria({ colunas = 3, linhas = 2, largura = 0.55, altura = 0.45, passo = 0.12 }) {
    const g = new THREE.Group();
    const cores = ['#8a8f96', '#6b7078', '#9aa0a6', '#5c6167', '#7d8288', '#a3a8ad'];
    for (let r = 0; r < linhas; r++)
      for (let c = 0; c < colunas; c++) {
        const q = pecas.quadro({ largura, altura, cor: cores[(r * colunas + c) % cores.length] }).grupo;
        q.position.set(-((colunas - 1) * (largura + passo)) / 2 + c * (largura + passo), ((linhas - 1) * (altura + passo)) / 2 - r * (altura + passo), 0);
        g.add(q);
      }
    return { grupo: g, colisores: [] };
  },
  arandela({ luz = false }) {
    const g = new THREE.Group();
    g.add(caixa(0.08, 0.14, 0.03, 'metal_preto', 0, 0, 0));
    g.add(cilindro(0.008, 0.16, 'metal_preto', 0, 0.05, 0.08, 6).rotateX(Math.PI / 2));
    g.add(cilindro(0.06, 0.14, 'cupula', 0, 0.14, 0.15, 14, 0.095));
    g.add(esfera(0.022, 'lampada', 0, 0.12, 0.15, 8));
    if (luz) {
      const l = new THREE.PointLight('#ffd9a8', 1.2, 3.5, 1.8);
      l.position.set(0, 0.1, 0.18);
      g.add(l);
    }
    return { grupo: g, colisores: [] };
  },
  tapete({ dims = [2, 3], material: mat = 'tapete' }) {
    const g = new THREE.Group();
    g.add(caixa(dims[0], 0.014, dims[1], mat, 0, 0.007, 0, false));
    return { grupo: g, colisores: [] };
  },
  tapete_redondo({ raio = 1.0, material: mat = 'boucle' }) {
    const g = new THREE.Group();
    const m = cilindro(raio, 0.014, mat, 0, 0.007, 0, 40);
    m.castShadow = false;
    g.add(m);
    return { grupo: g, colisores: [] };
  },

  // ---------- brinquedoteca
  mesa_infantil() {
    const g = new THREE.Group();
    g.add(cilindro(0.5, 0.04, 'marcenaria_branca', 0, 0.55, 0, 24));
    g.add(cilindro(0.05, 0.53, 'carvalho', 0, 0.27, 0));
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.add(caixa(0.3, 0.3, 0.3, 'marcenaria_azul', Math.cos(a) * 0.7, 0.15, Math.sin(a) * 0.7));
    }
    return { grupo: g, colisores: [col(0.55, 0.55, 0.6)] };
  },
  estante_baixa({ largura = 2.4 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.9, 0.35, 'marcenaria_branca', 0, 0.45, 0));
    for (let i = 0; i <= 4; i++) g.add(caixa(0.02, 0.8, 0.33, 'marcenaria_branca', -largura / 2 + (largura / 4) * i, 0.45, 0.01));
    g.add(caixa(largura, 0.02, 0.33, 'marcenaria_branca', 0, 0.45, 0.01));
    for (let i = 0; i < 4; i++) g.add(caixa(largura / 4 - 0.1, 0.25, 0.28, i % 2 ? 'ratan' : 'marcenaria_azul', -largura / 2 + (largura / 4) * (i + 0.5), 0.13, 0.02));
    g.add(livros(-largura / 2 + 0.1, 0.47, 0.02, 5));
    g.add(caixa(largura + 0.04, 0.04, 0.38, 'carvalho', 0, 0.92, 0));
    return { grupo: g, colisores: [col(largura / 2, 0.18, 0.95)] };
  },

  // ---------- banheiros
  bancada_lavatorio({ largura = 1.2, material: mat = 'salvia' }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.78, 0.55, mat, 0, 0.42, 0));
    // portas e gavetas shaker
    const lp = largura * 0.55;
    g.add(shaker(lp / 2 - 0.02, 0.6, mat, -largura / 2 + lp / 4 + 0.03, 0.42, 0.28, 'metal_preto'));
    g.add(shaker(lp / 2 - 0.02, 0.6, mat, -largura / 2 + (3 * lp) / 4 - 0.03, 0.42, 0.28, 'metal_preto'));
    for (let k = 0; k < 3; k++) g.add(shaker(largura - lp - 0.06, 0.17, mat, largura / 2 - (largura - lp) / 2, 0.2 + k * 0.21, 0.28, 'metal_preto'));
    g.add(caixa(largura + 0.04, 0.04, 0.6, 'marmore', 0, 0.83, 0));
    g.add(caixa(largura + 0.04, 0.12, 0.03, 'marmore', 0, 0.91, -0.29));
    // cuba, torneira preta em cruz
    g.add(caixa(0.5, 0.02, 0.38, 'ceramica_branca', 0, 0.855, 0.02));
    g.add(cilindro(0.012, 0.22, 'metal_preto', 0, 0.96, -0.16, 8));
    g.add(cilindro(0.012, 0.16, 'metal_preto', 0, 1.06, -0.09, 8).rotateX(Math.PI / 2));
    for (const s of [-1, 1]) g.add(cilindro(0.02, 0.05, 'metal_preto', s * 0.12, 0.88, -0.16, 8));
    // espelho de moldura preta e arandelas
    g.add(caixa(largura * 0.62, 0.9, 0.025, 'metal_preto', 0, 1.62, -0.265));
    const esp = new THREE.Mesh(new THREE.PlaneGeometry(largura * 0.62 - 0.05, 0.85), new THREE.MeshStandardMaterial({ color: '#dfe4e6', roughness: 0.03, metalness: 1 }));
    esp.position.set(0, 1.62, -0.25);
    g.add(esp);
    for (const s of [-1, 1]) {
      const ar = pecas.arandela({}).grupo;
      ar.position.set(s * (largura * 0.31 + 0.14), 1.62, -0.27);
      g.add(ar);
    }
    // frascos
    g.add(cilindro(0.03, 0.14, 'bronze', -largura / 2 + 0.2, 0.92, 0.05, 8));
    g.add(cilindro(0.03, 0.12, 'bronze', -largura / 2 + 0.28, 0.91, 0.1, 8));
    return { grupo: g, colisores: [col(largura / 2, 0.3, 0.9)] };
  },
  vaso() {
    const g = new THREE.Group();
    g.add(caixa(0.38, 0.4, 0.2, 'ceramica_branca', 0, 0.6, -0.14));
    g.add(cilindro(0.19, 0.38, 'ceramica_branca', 0, 0.21, 0.08, 16, 0.14));
    g.add(cilindro(0.2, 0.05, 'ceramica_branca', 0, 0.42, 0.08, 16, 0.19));
    g.add(caixa(0.36, 0.3, 0.3, 'ceramica_branca', 0, 0.15, -0.08));
    return { grupo: g, colisores: [col(0.2, 0.3, 0.6)] };
  },
  box({ largura = 0.9 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.01, 0.9, 'pedra_escura', 0, 0.005, 0, false));
    // parede de fundo em espinha de peixe, nicho com prateleiras
    g.add(caixa(largura, 2.2, 0.02, 'espinha', 0, 1.1, -0.44));
    g.add(caixa(0.3, 0.6, 0.1, 'pedra_escura', largura / 2 - 0.2, 1.3, -0.38));
    for (let k = 0; k < 3; k++) g.add(caixa(0.28, 0.015, 0.09, 'metal_preto', largura / 2 - 0.2, 1.02 + k * 0.25, -0.38));
    // vidro frontal com moldura preta
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(largura, 2.0), material('vidro'));
    vidro.position.set(0, 1.0, 0.45);
    g.add(vidro);
    g.add(caixa(0.04, 2.0, 0.04, 'caixilho', -largura / 2, 1.0, 0.45));
    g.add(caixa(0.04, 2.0, 0.04, 'caixilho', largura / 2, 1.0, 0.45));
    g.add(caixa(largura, 0.04, 0.04, 'caixilho', 0, 2.0, 0.45));
    // chuveiro preto de teto e ducha
    g.add(cilindro(0.012, 1.0, 'metal_preto', -largura / 2 + 0.2, 1.5, -0.38, 8));
    g.add(cilindro(0.11, 0.015, 'metal_preto', -largura / 2 + 0.2, 2.05, -0.2, 16));
    g.add(cilindro(0.012, 0.3, 'metal_preto', -largura / 2 + 0.2, 2.05, -0.29, 8).rotateX(Math.PI / 2));
    return { grupo: g, colisores: [col(largura / 2, 0.02, 2.0, 0, -0.45)] };
  },
  nicho_toalhas() {
    const g = new THREE.Group();
    g.add(toro(0.09, 0.008, 'metal_preto', 0, 0, 0.02).rotateX(-Math.PI / 2));
    g.add(caixa(0.18, 0.3, 0.02, 'tecido_claro', 0, -0.2, 0.05));
    return { grupo: g, colisores: [] };
  },

  // ---------- quartos
  cama({ largura = 1.6, estilo = 'madeira', comp = 2.05, mesas = [-1, 1] }) {
    const g = new THREE.Group();
    const madeira = estilo === 'madeira' ? 'nogueira' : 'carvalho';
    // estrutura com colunas
    g.add(caixa(largura + 0.14, 0.26, comp + 0.1, madeira, 0, 0.3, 0));
    for (const [sx, sz, h] of [[-1, -1, 1.2], [1, -1, 1.2], [-1, 1, 0.62], [1, 1, 0.62]]) {
      g.add(caixa(0.09, h, 0.09, madeira, sx * (largura / 2 + 0.06), h / 2, sz * (comp / 2 + 0.06)));
      g.add(esfera(0.02, 'bronze', sx * (largura / 2 + 0.06), h - 0.12, sz * (comp / 2 + 0.06) + sz * 0.045, 8));
    }
    if (estilo === 'madeira') {
      g.add(caixa(largura + 0.02, 0.62, 0.06, madeira, 0, 0.85, -comp / 2 - 0.05));
      g.add(caixa(largura + 0.02, 0.06, 0.07, madeira, 0, 1.17, -comp / 2 - 0.05));
      g.add(caixa(largura + 0.02, 0.28, 0.06, madeira, 0, 0.48, comp / 2 + 0.05));
    } else {
      g.add(almofada(largura + 0.02, 0.75, 0.1, 'boucle', 0, 0.8, -comp / 2 - 0.05, 0.05));
    }
    // colchão, edredão e almofadas
    g.add(almofada(largura, 0.24, comp, 'colchao', 0, 0.55, 0, 0.06));
    g.add(almofada(largura + 0.04, 0.09, comp * 0.62, 'tecido_claro', 0, 0.71, 0.3, 0.045));
    g.add(almofada(largura * 0.9, 0.04, comp * 0.35, 'tapete', 0, 0.775, 0.55, 0.02));
    const nA = largura > 1.3 ? 2 : 1;
    for (let i = 0; i < nA; i++) {
      const x = nA === 1 ? 0 : (i - 0.5) * (largura / 2);
      g.add(almofada(largura / (nA + 0.15), 0.16, 0.42, 'colchao', x, 0.75, -comp / 2 + 0.3, 0.06));
      g.add(almofada(largura / (nA + 0.6), 0.14, 0.34, i % 2 ? 'boucle' : 'tecido_claro', x + 0.02, 0.8, -comp / 2 + 0.5, 0.05));
    }
    // mesas de cabeceira com candeeiros
    for (const s of mesas) {
      const xm = s * (largura / 2 + 0.42);
      g.add(caixa(0.5, 0.58, 0.42, madeira, xm, 0.29, -comp / 2 + 0.3));
      g.add(caixa(0.42, 0.14, 0.012, madeira, xm, 0.2, -comp / 2 + 0.515));
      g.add(caixa(0.42, 0.14, 0.012, madeira, xm, 0.42, -comp / 2 + 0.515));
      g.add(esfera(0.012, 'bronze', xm, 0.2, -comp / 2 + 0.53, 8));
      g.add(esfera(0.012, 'bronze', xm, 0.42, -comp / 2 + 0.53, 8));
      g.add(candeeiroMesa(xm, 0.58, -comp / 2 + 0.3, 0.9));
    }
    return {
      grupo: g,
      colisores: [col(largura / 2 + 0.07, comp / 2 + 0.07, 0.9), ...mesas.map((s) => col(0.26, 0.22, 0.6, s * (largura / 2 + 0.42), comp / 2 - 0.3))],
    };
  },
  banco_pe_cama({ largura = 1.3 }) {
    const g = new THREE.Group();
    g.add(almofada(largura, 0.14, 0.42, 'boucle', 0, 0.42, 0, 0.06));
    g.add(caixa(largura, 0.3, 0.42, 'boucle', 0, 0.2, 0));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(caixa(0.02, 0.06, 0.02, 'metal_preto', sx * (largura / 2 - 0.08), 0.03, sz * 0.17));
    return { grupo: g, colisores: [col(largura / 2, 0.22, 0.5)] };
  },
  guarda_roupa({ largura = 2.0, material: mat = 'marcenaria_branca' }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 2.35, 0.6, mat, 0, 1.175, 0));
    g.add(caixa(largura + 0.06, 0.08, 0.64, mat, 0, 2.39, 0));
    const n = Math.max(2, Math.round(largura / 0.5));
    for (let i = 0; i < n; i++) g.add(shaker(largura / n - 0.03, 2.15, mat, -largura / 2 + (largura / n) * (i + 0.5), 1.15, 0.31, 'bronze'));
    return { grupo: g, colisores: [col(largura / 2, 0.3, 2.45)] };
  },
  closet_aberto({ largura = 1.6 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 2.5, 0.5, 'marcenaria_branca', 0, 1.25, 0));
    for (let i = 0; i < 2; i++)
      for (let k = 0; k < 5; k++) g.add(caixa(largura / 2 - 0.08, 0.025, 0.42, 'marcenaria_branca', -largura / 4 + (i * largura) / 2, 0.25 + k * 0.45, 0.03));
    for (let i = 0; i <= 2; i++) g.add(caixa(0.025, 2.4, 0.42, 'marcenaria_branca', -largura / 2 + (i * largura) / 2, 1.25, 0.03));
    g.add(livros(-largura / 2 + 0.1, 0.72, 0.05, 4));
    g.add(cilindro(0.08, 0.16, 'ceramica_branca', largura / 4, 1.7, 0.05, 10, 0.06));
    for (let k = 0; k < 3; k++) g.add(shaker(largura / 2 - 0.1, 0.22, 'marcenaria_branca', largura / 4, 0.2 + k * 0.26, 0.245, 'bronze'));
    return { grupo: g, colisores: [col(largura / 2, 0.25, 2.5)] };
  },
  cama_solteiro_bau({ largura = 0.95, comp = 1.95 }) {
    const g = new THREE.Group();
    g.add(caixa(largura + 0.08, 0.42, comp + 0.08, 'nogueira', 0, 0.21, 0));
    g.add(caixa(largura + 0.08, 0.48, 0.05, 'nogueira', 0, 0.62, -comp / 2 - 0.02));
    g.add(caixa(largura + 0.08, 0.36, 0.05, 'nogueira', 0, 0.56, comp / 2 + 0.02));
    g.add(caixa(0.05, 0.42, comp + 0.08, 'nogueira', -largura / 2 - 0.02, 0.6, 0));
    // grade azul de proteção
    for (let i = 0; i < 6; i++) g.add(caixa(0.04, 0.3, 0.03, 'marcenaria_azul', largura / 2 - 0.02, 0.6, -comp / 2 + 0.25 + i * 0.12));
    g.add(caixa(0.04, 0.03, 0.75, 'marcenaria_azul', largura / 2 - 0.02, 0.76, -comp / 2 + 0.55));
    // gavetas e almofadas
    for (let k = 0; k < 2; k++) g.add(shaker(comp / 2 - 0.1, 0.16, 'nogueira', 0, 0.12, largura / 2 + 0.04, 'bronze', 0.01).rotateY(0));
    g.add(almofada(largura, 0.14, comp, 'tecido_claro', 0, 0.49, 0, 0.05));
    for (let i = 0; i < 4; i++) g.add(almofada(0.36, 0.34, 0.12, i % 2 ? 'marcenaria_azul' : 'tecido_claro', -largura / 2 + 0.1, 0.7, -comp / 2 + 0.35 + i * 0.32, 0.04).rotateY(Math.PI / 2));
    return { grupo: g, colisores: [col(largura / 2 + 0.05, comp / 2 + 0.05, 0.8)] };
  },
  cadeira_madeira() {
    const g = new THREE.Group();
    g.add(caixa(0.42, 0.04, 0.42, 'nogueira', 0, 0.45, 0));
    for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) g.add(cilindro(0.018, 0.44, 'nogueira', x, 0.22, z, 8));
    for (let i = 0; i < 5; i++) g.add(cilindro(0.012, 0.42, 'nogueira', -0.16 + i * 0.08, 0.68, -0.19, 6));
    g.add(caixa(0.44, 0.05, 0.04, 'nogueira', 0, 0.9, -0.19));
    return { grupo: g, colisores: [col(0.22, 0.22, 0.9)] };
  },
  prateleira_madeira({ largura = 1.2 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.04, 0.22, 'carvalho', 0, 0, 0.11));
    for (const s of [-1, 1]) g.add(caixa(0.04, 0.16, 0.18, 'carvalho', s * (largura / 2 - 0.1), -0.1, 0.1));
    g.add(planta(-largura / 2 + 0.2, 0.02, 0.1, 0.1, 4));
    g.add(cilindro(0.05, 0.14, 'ceramica_branca', 0.1, 0.09, 0.1, 10, 0.04));
    g.add(livros(largura / 2 - 0.3, 0.02, 0.05, 3));
    return { grupo: g, colisores: [] };
  },

  // ---------- estar
  sofa({ largura = 2.4, material: mat = 'tecido_claro', chesterfield = false }) {
    const g = new THREE.Group();
    const prof = 1.0;
    if (chesterfield) {
      g.add(caixa(largura, 0.45, prof, mat, 0, 0.3, 0));
      g.add(caixa(largura, 0.5, 0.28, mat, 0, 0.75, -prof / 2 + 0.14));
      for (const s of [-1, 1]) g.add(cilindro(0.15, prof - 0.05, mat, s * (largura / 2 - 0.15), 0.68, 0, 14).rotateX(Math.PI / 2));
      // capitonê: grelha de botões no encosto
      for (let r = 0; r < 3; r++) for (let c = 0; c < Math.round(largura / 0.22); c++) g.add(esfera(0.018, 'bronze', -largura / 2 + 0.2 + c * 0.22 + (r % 2) * 0.11, 0.6 + r * 0.14, -prof / 2 + 0.29, 6));
      for (let i = 0; i < 3; i++) g.add(almofada(largura / 3 - 0.06, 0.13, prof - 0.4, mat, -largura / 3 + (i * largura) / 3, 0.58, 0.1, 0.05));
      for (const [x, z] of [[-largura / 2 + 0.1, -0.4], [largura / 2 - 0.1, -0.4], [-largura / 2 + 0.1, 0.4], [largura / 2 - 0.1, 0.4]]) g.add(cilindro(0.04, 0.08, 'nogueira', x, 0.04, z, 8, 0.05));
    } else {
      g.add(almofada(largura, 0.4, prof, mat, 0, 0.25, 0, 0.05));
      for (const s of [-1, 1]) g.add(almofada(0.18, 0.3, prof, mat, s * (largura / 2 - 0.09), 0.6, 0, 0.06));
      const n = Math.max(1, Math.round(largura / 0.85));
      for (let i = 0; i < n; i++) {
        const x = -largura / 2 + 0.18 + ((largura - 0.36) / n) * (i + 0.5);
        g.add(almofada((largura - 0.36) / n - 0.03, 0.14, prof - 0.35, mat, x, 0.52, 0.12, 0.05));
        g.add(almofada((largura - 0.36) / n - 0.03, 0.42, 0.2, mat, x, 0.78, -prof / 2 + 0.17, 0.07).rotateX(-0.12));
        const alm = almofada(0.42, 0.42, 0.12, i % 2 ? 'nogueira' : 'boucle', x + (i % 2 ? 0.1 : -0.1), 0.8, -prof / 2 + 0.36, 0.05);
        alm.rotation.x = -0.2;
        g.add(alm);
      }
      for (const [x, z] of [[-largura / 2 + 0.1, -0.4], [largura / 2 - 0.1, -0.4], [-largura / 2 + 0.1, 0.4], [largura / 2 - 0.1, 0.4]]) g.add(cilindro(0.02, 0.06, 'nogueira', x, 0.03, z, 8));
    }
    return { grupo: g, colisores: [col(largura / 2, prof / 2, 0.9)] };
  },
  // sofá de canto em L: módulo principal (largura, virado a +z) + retorno à esquerda, perpendicular,
  // virado para +x — como na planta humanizada da sala (um braço a norte, outro a oeste)
  sofa_l({ material: mat = 'tecido_claro', largura = 3.0, retorno = 2.5 }) {
    const g = new THREE.Group();
    const a = pecas.sofa({ largura, material: mat });
    g.add(a.grupo);
    const b = pecas.sofa({ largura: retorno, material: mat });
    b.grupo.rotation.y = Math.PI / 2;
    b.grupo.position.set(-largura / 2 + 0.5, 0, 0.5 + retorno / 2);
    g.add(b.grupo);
    return { grupo: g, colisores: [col(largura / 2, 0.5, 0.9), col(0.5, retorno / 2, 0.9, -largura / 2 + 0.5, -(0.5 + retorno / 2))] };
  },
  poltrona({ material: mat = 'boucle' }) {
    const g = new THREE.Group();
    g.add(almofada(0.72, 0.36, 0.72, mat, 0, 0.26, 0, 0.06));
    g.add(almofada(0.66, 0.12, 0.6, mat, 0, 0.5, 0.04, 0.05));
    // encosto em barril (meio cilindro)
    const enc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.42, 20, 1, true, Math.PI * 0.75, Math.PI * 1.5), M(mat));
    enc.position.set(0, 0.62, 0.02);
    enc.castShadow = true;
    g.add(enc);
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) g.add(cilindro(0.02, 0.1, 'nogueira', x, 0.05, z, 8));
    return { grupo: g, colisores: [col(0.4, 0.4, 0.9)] };
  },
  mesa_live_edge({ largura = 1.4, prof = 0.7 }) {
    const g = new THREE.Group();
    const forma = new THREE.Shape();
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = -largura / 2 + largura * t;
      const y = prof / 2 + Math.sin(t * Math.PI * 3.1) * 0.05 + Math.sin(t * 11) * 0.02;
      if (i === 0) forma.moveTo(x, y);
      else forma.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      const x = -largura / 2 + largura * t;
      const y = -prof / 2 + Math.sin(t * Math.PI * 2.3 + 1) * 0.05 + Math.cos(t * 9) * 0.02;
      forma.lineTo(x, y);
    }
    const tampo = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.06, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01 }), material('nogueira'));
    tampo.rotation.x = -Math.PI / 2;
    tampo.position.y = 0.4;
    tampo.castShadow = true;
    tampo.receiveShadow = true;
    g.add(tampo);
    g.add(caixa(0.12, 0.38, prof * 0.7, 'nogueira', -largura / 2 + 0.25, 0.19, 0));
    g.add(caixa(0.12, 0.38, prof * 0.7, 'nogueira', largura / 2 - 0.25, 0.19, 0));
    // tabuleiro de xadrez, livros e suculenta
    const tab = new THREE.Group();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) tab.add(caixa(0.04, 0.008, 0.04, (i + j) % 2 ? 'nogueira' : 'carvalho', -0.14 + i * 0.04, 0, -0.14 + j * 0.04, false));
    tab.position.set(-0.2, 0.47, 0.05);
    g.add(tab);
    g.add(livros(0.25, 0.46, -0.1, 3, true));
    g.add(cilindro(0.06, 0.08, 'cimento_parede', 0.45, 0.5, 0.12, 10, 0.05));
    g.add(planta(0.45, 0.5, 0.12, 0.07, 6));
    return { grupo: g, colisores: [col(largura / 2, prof / 2, 0.5)] };
  },
  mesa_lateral() {
    const g = new THREE.Group();
    g.add(cilindro(0.25, 0.02, 'nogueira', 0, 0.55, 0, 24));
    g.add(cilindro(0.015, 0.54, 'latao', 0, 0.27, 0, 8));
    g.add(cilindro(0.16, 0.015, 'latao', 0, 0.01, 0, 20));
    return { grupo: g, colisores: [col(0.25, 0.25, 0.56)] };
  },
  mesa_console({ largura = 1.6 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.05, 0.4, 'nogueira', 0, 0.78, 0));
    g.add(caixa(largura - 0.1, 0.03, 0.36, 'nogueira', 0, 0.2, 0));
    for (const [x, z] of [[-largura / 2 + 0.05, -0.17], [largura / 2 - 0.05, -0.17], [-largura / 2 + 0.05, 0.17], [largura / 2 - 0.05, 0.17]]) g.add(caixa(0.05, 0.78, 0.05, 'nogueira', x, 0.39, z));
    for (let i = 0; i < 2; i++) g.add(caixa(0.5, 0.32, 0.32, 'ratan', -largura / 4 + (i * largura) / 2, 0.38, 0));
    g.add(candeeiroMesa(-largura / 2 + 0.3, 0.8, 0, 1.1));
    g.add(caixa(0.22, 0.28, 0.02, 'metal_preto', 0.1, 0.94, 0));
    g.add(cilindro(0.06, 0.2, 'cimento_parede', largura / 2 - 0.25, 0.9, 0.05, 10, 0.045));
    return { grupo: g, colisores: [col(largura / 2, 0.2, 0.8)] };
  },
  lareira({ altura = 2.8, largura = 2.1, bancos = true }) {
    // coluna de pedra até ao teto, soleira de pedra elevada, boca da lareira com moldura preta, viga-consola de madeira e TV;
    // bancos de janela dos dois lados (o da direita com nicho de lenha), como no render do projeto
    const g = new THREE.Group();
    g.add(caixaM(largura, altura, 0.55, 'pedra', 0, altura / 2, 0));
    g.add(caixaM(largura + 0.3, 0.32, 0.85, 'pedra', 0, 0.16, 0.15)); // soleira (hearth)
    g.add(caixa(1.25, 0.72, 0.3, new THREE.MeshStandardMaterial({ color: '#141210', roughness: 1 }), 0, 0.72, 0.18));
    g.add(caixa(1.3, 0.06, 0.05, 'metal_preto', 0, 1.1, 0.3));
    g.add(caixa(1.3, 0.06, 0.05, 'metal_preto', 0, 0.34, 0.3));
    for (const sx of [-1, 1]) g.add(caixa(0.06, 0.8, 0.05, 'metal_preto', sx * 0.62, 0.72, 0.3));
    for (let i = 0; i < 3; i++) g.add(cilindro(0.05, 0.6, 'nogueira', -0.25 + i * 0.25, 0.42, 0.15, 8).rotateX(Math.PI / 2));
    const lume = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshStandardMaterial({ color: '#ff7a1c', emissive: '#ff8a2a', emissiveIntensity: 3, transparent: true, opacity: 0.85 }));
    lume.position.set(0, 0.6, 0.32);
    g.add(lume);
    const luz = new THREE.PointLight('#ff9a3c', 4, 5, 2);
    luz.position.set(0, 0.8, 0.6);
    g.add(luz);
    g.add(caixa(1.7, 0.14, 0.3, 'nogueira', 0, 1.42, 0.35)); // viga-consola
    g.add(caixa(1.55, 0.88, 0.04, 'tela_tv', 0, 2.15, 0.29));
    g.add(cilindro(0.05, 0.16, 'ceramica_branca', 0.62, 1.57, 0.36, 10, 0.04));
    g.add(planta(0.62, 1.58, 0.36, 0.07, 4));
    const colisores = [col(largura / 2 + 0.15, 0.43, altura, 0, -0.15)];
    if (bancos) {
      for (const s of [-1, 1]) {
        const xb = s * (largura / 2 + 0.75);
        g.add(caixa(1.5, 0.42, 0.55, 'marcenaria_branca', xb, 0.21, 0.0));
        g.add(caixa(1.0, 0.28, 0.4, new THREE.MeshStandardMaterial({ color: '#0d0b09', roughness: 1 }), xb, 0.15, 0.05));
        for (let i = 0; i < 5; i++) g.add(cilindro(0.045, 0.38, 'nogueira', xb - 0.35 + i * 0.17, 0.12 + (i % 2) * 0.1, 0.08, 8).rotateX(Math.PI / 2));
        g.add(almofada(1.46, 0.08, 0.52, 'tecido_claro', xb, 0.46, 0, 0.04));
        g.add(almofada(0.45, 0.42, 0.12, 'papel_xadrez', xb + s * 0.3, 0.72, -0.15, 0.04));
        colisores.push(col(0.75, 0.28, 0.5, xb, 0));
      }
    }
    return { grupo: g, colisores };
  },
  // estante em arcos do projeto: armários base fundos (0,62 m) com portas shaker e tampo de nogueira,
  // corpo superior raso (0,36 m) com três arcos de fundo ripado; ao centro uma secretária aberta com cadeira
  estante_arcos({ largura = 3.6, altura = 2.7 }) {
    const g = new THREE.Group();
    const n = 3;
    const lw = largura / n;
    const pBase = 0.62;
    const pCima = 0.36;
    const zFundo = -pCima / 2; // costas do móvel encostadas à parede
    // corpo superior: painel de fundo ripado, laterais/topo, e um painel frontal com os três arcos recortados
    const H = altura - 0.94;
    const y0 = 0.94;
    g.add(caixa(largura, H, 0.025, 'shiplap_branco', 0, y0 + H / 2, zFundo + 0.0125));
    g.add(caixa(largura, 0.04, pCima, 'marcenaria_branca', 0, y0 + H - 0.02, 0));
    for (const s of [-1, 1]) g.add(caixa(0.03, H, pCima, 'marcenaria_branca', s * (largura / 2 - 0.015), y0 + H / 2, 0));
    const frente = new THREE.Shape();
    frente.moveTo(-largura / 2, 0);
    frente.lineTo(largura / 2, 0);
    frente.lineTo(largura / 2, H);
    frente.lineTo(-largura / 2, H);
    frente.lineTo(-largura / 2, 0);
    const r = lw / 2 - 0.12;
    const hArco = H - 0.16;
    for (let i = 0; i < n; i++) {
      const x = -largura / 2 + lw * (i + 0.5);
      const furo = new THREE.Path();
      furo.moveTo(x - r, 0.03);
      furo.lineTo(x + r, 0.03);
      furo.lineTo(x + r, hArco - r);
      furo.absarc(x, hArco - r, r, 0, Math.PI, false);
      furo.lineTo(x - r, 0.03);
      frente.holes.push(furo);
      // divisórias entre nichos e prateleiras de madeira
      if (i > 0) g.add(caixa(0.05, H, pCima - 0.05, 'marcenaria_branca', -largura / 2 + lw * i, y0 + H / 2, 0));
      const anel = new THREE.Mesh(new THREE.TorusGeometry(r + 0.025, 0.025, 8, 28, Math.PI), material('marcenaria_branca'));
      anel.position.set(x, y0 + hArco - r, pCima / 2);
      g.add(anel);
      if (i === 1) {
        g.add(pecas.quadro({ largura: 0.6, altura: 0.48, cor: '#7f8b6a', moldura: 'nogueira' }).grupo.translateX(x).translateY(y0 + 0.95).translateZ(zFundo + 0.045));
        g.add(cilindro(0.06, 0.16, 'ceramica_branca', x + 0.35, y0 + 0.12, zFundo + 0.2, 10, 0.045));
        g.add(candeeiroMesa(x - 0.45, y0, zFundo + 0.2, 0.9));
      } else {
        for (let k = 0; k < 3; k++) g.add(caixa(2 * r - 0.02, 0.03, pCima - 0.08, 'nogueira', x, y0 + 0.36 + k * 0.42, zFundo + 0.16));
        g.add(livros(x - r + 0.08, y0 + 0.39, zFundo + 0.1, 6));
        g.add(cilindro(0.06, 0.16, 'ceramica_branca', x + 0.15, y0 + 0.88, zFundo + 0.16, 10, 0.045));
        g.add(livros(x - r + 0.1, y0 + 1.22, zFundo + 0.1, 4));
      }
    }
    const painelFrente = new THREE.Mesh(new THREE.ExtrudeGeometry(frente, { depth: 0.035, bevelEnabled: false }), material('marcenaria_branca'));
    painelFrente.position.set(0, y0, pCima / 2 - 0.035);
    painelFrente.castShadow = true;
    painelFrente.receiveShadow = true;
    g.add(painelFrente);
    // cadeira de secretária em bouclé, virada para a bancada
    const cad = new THREE.Group();
    cad.add(almofada(0.5, 0.08, 0.5, 'boucle', 0, 0.46, 0, 0.04));
    cad.add(almofada(0.5, 0.42, 0.08, 'boucle', 0, 0.7, -0.22, 0.04));
    cad.add(cilindro(0.02, 0.42, 'metal_preto', 0, 0.21, 0, 8));
    for (let k = 0; k < 5; k++) {
      const p = caixa(0.03, 0.02, 0.28, 'metal_preto', 0, 0.02, 0);
      p.rotation.y = (k * Math.PI * 2) / 5;
      p.translateZ(0.14);
      cad.add(p);
    }
    cad.position.set(0, 0, zFundo + pBase + 0.35);
    g.add(cad);
    return {
      grupo: g,
      colisores: [col(largura / 2, pBase / 2, 0.95, 0, -(zFundo + pBase / 2)), col(largura / 2, pCima / 2, altura, 0, -(zFundo + pCima / 2)), col(0.3, 0.3, 0.9, 0, -(zFundo + pBase + 0.35))],
    };
  },
  // banco de janela (bay window): base ripada branca, almofada e almofadas decorativas
  banco_janela({ largura = 2.3, prof = 0.45 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.44, prof, 'shiplap_branco', 0, 0.22, 0));
    g.add(caixa(largura + 0.04, 0.03, prof + 0.03, 'marcenaria_branca', 0, 0.455, 0));
    g.add(almofada(largura - 0.06, 0.09, prof - 0.04, 'tecido_claro', 0, 0.515, 0, 0.04));
    for (let i = 0; i < 3; i++) {
      const alm = almofada(0.42, 0.42, 0.12, i % 2 ? 'papel_xadrez' : 'boucle', -largura / 2 + 0.4 + i * ((largura - 0.8) / 2), 0.78, -prof / 2 + 0.12, 0.04);
      alm.rotation.x = -0.15;
      g.add(alm);
    }
    return { grupo: g, colisores: [col(largura / 2, prof / 2, 0.5)] };
  },
  porta_celeiro({ largura = 1.0, altura = 2.2 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, altura, 0.045, 'carvalho', 0, altura / 2, 0));
    for (let i = 0; i < 5; i++) g.add(caixa(0.012, altura - 0.1, 0.05, 'nogueira', -largura / 2 + (largura / 5) * (i + 0.5), altura / 2, 0));
    g.add(caixa(largura, 0.12, 0.02, 'carvalho', 0, altura - 0.15, 0.03));
    g.add(caixa(largura, 0.12, 0.02, 'carvalho', 0, 0.15, 0.03));
    const diag = caixa(largura * 1.25, 0.12, 0.02, 'carvalho', 0, altura / 2, 0.03);
    diag.rotation.z = Math.atan2(altura - 0.4, largura);
    g.add(diag);
    // calha preta e roldanas
    g.add(caixa(largura * 2, 0.04, 0.03, 'metal_preto', largura / 2, altura + 0.12, -0.02));
    for (const s of [-1, 1]) {
      g.add(cilindro(0.06, 0.02, 'metal_preto', s * (largura / 2 - 0.15), altura + 0.12, 0.02, 16).rotateX(Math.PI / 2));
      g.add(caixa(0.04, 0.25, 0.02, 'metal_preto', s * (largura / 2 - 0.15), altura - 0.02, 0.03));
    }
    g.add(caixa(0.03, 0.3, 0.05, 'metal_preto', largura / 2 - 0.12, altura / 2 - 0.1, 0.05));
    return { grupo: g, colisores: [col(largura / 2, 0.04, altura)] };
  },

  // ---------- iluminação
  lustre_roda({ raio = 0.6, duplo = true, corrente = 1.0 }) {
    const g = new THREE.Group();
    g.add(cilindro(0.012, corrente, 'metal_preto', 0, corrente / 2, 0, 8));
    const anel = (r, y, n) => {
      g.add(toro(r, 0.02, 'metal_preto', 0, y, 0, 40));
      g.add(toro(r, 0.008, 'metal_preto', 0, y + 0.1, 0, 40));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.add(cilindro(0.016, 0.16, 'metal_preto', Math.cos(a) * r, y + 0.1, Math.sin(a) * r, 8));
        g.add(esfera(0.022, 'lampada', Math.cos(a) * r, y + 0.21, Math.sin(a) * r, 8));
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const br = cilindro(0.008, r, 'metal_preto', (Math.cos(a) * r) / 2, y, (Math.sin(a) * r) / 2, 6);
        br.rotation.z = Math.PI / 2;
        br.rotation.y = -a;
        g.add(br);
      }
    };
    anel(raio, 0, 14);
    if (duplo) anel(raio * 0.62, 0.32, 8);
    const luz = new THREE.PointLight('#ffd9a8', 5, 9, 1.5);
    luz.position.y = 0.15;
    g.add(luz);
    return { grupo: g, colisores: [] };
  },
  lustre_velas({ bracos = 12, raio = 0.55, corrente = 1.2 }) {
    const g = new THREE.Group();
    g.add(cilindro(0.01, corrente, 'metal_preto', 0, corrente / 2, 0, 8));
    g.add(cilindro(0.03, 0.5, 'metal_preto', 0, -0.1, 0, 8));
    for (let i = 0; i < bracos; i++) {
      const a = (i / bracos) * Math.PI * 2;
      const r = i % 2 ? raio : raio * 0.65;
      const y = i % 2 ? 0.05 : 0.2;
      const braco = cilindro(0.008, r, 'metal_preto', (Math.cos(a) * r) / 2, y - 0.1, (Math.sin(a) * r) / 2, 6);
      braco.rotation.z = Math.PI / 2 + 0.35;
      braco.rotation.y = -a;
      g.add(braco);
      g.add(cilindro(0.014, 0.2, 'metal_preto', Math.cos(a) * r, y + 0.1, Math.sin(a) * r, 8));
      g.add(esfera(0.02, 'lampada', Math.cos(a) * r, y + 0.22, Math.sin(a) * r, 8));
    }
    const luz = new THREE.PointLight('#ffd9a8', 4, 8, 1.5);
    luz.position.y = 0.2;
    g.add(luz);
    return { grupo: g, colisores: [] };
  },
  lustre_ratan({ raio = 0.35, corrente = 0.5 }) {
    const g = new THREE.Group();
    g.add(cilindro(0.008, corrente, 'metal_preto', 0, corrente / 2, 0, 6));
    for (const [r, y, h] of [[raio, 0, 0.16], [raio * 0.8, -0.16, 0.14], [raio * 0.55, -0.3, 0.12]]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 28, 1, true), material('ratan'));
      c.position.y = y;
      g.add(c);
    }
    g.add(esfera(0.05, 'lampada', 0, -0.12, 0, 10));
    const luz = new THREE.PointLight('#ffd9a8', 3.5, 7, 1.6);
    luz.position.y = -0.1;
    g.add(luz);
    return { grupo: g, colisores: [] };
  },
  pendente({ estilo = 'lanterna', corrente = 1.0 }) {
    // lanterna de ferro com cúpula de tecido (cozinha) ou gaiola industrial (garagem)
    const g = new THREE.Group();
    g.add(cilindro(0.006, corrente, 'metal_preto', 0, corrente / 2, 0, 6));
    if (estilo === 'lanterna') {
      const w = 0.3;
      const h = 0.42;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(caixa(0.012, h, 0.012, 'metal_preto', (sx * w) / 2, -h / 2, (sz * w) / 2));
      for (const y of [0, -h]) {
        g.add(caixa(w, 0.012, 0.012, 'metal_preto', 0, y, -w / 2));
        g.add(caixa(w, 0.012, 0.012, 'metal_preto', 0, y, w / 2));
        g.add(caixa(0.012, 0.012, w, 'metal_preto', -w / 2, y, 0));
        g.add(caixa(0.012, 0.012, w, 'metal_preto', w / 2, y, 0));
      }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const arco = cilindro(0.008, 0.22, 'metal_preto', (sx * w) / 4, 0.09, (sz * w) / 4, 6);
        arco.rotation.z = sx * 0.6;
        arco.rotation.x = -sz * 0.6;
        g.add(arco);
      }
      g.add(cilindro(0.09, 0.26, 'cupula', 0, -h / 2, 0, 18));
      g.add(esfera(0.03, 'lampada', 0, -h / 2, 0, 8));
    } else {
      g.add(cilindro(0.16, 0.06, 'metal_preto', 0, -0.03, 0, 16, 0.08));
      g.add(toro(0.16, 0.006, 'metal_preto', 0, -0.3, 0, 24));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(cilindro(0.004, 0.28, 'metal_preto', Math.cos(a) * 0.15, -0.17, Math.sin(a) * 0.15, 4));
      }
      g.add(esfera(0.045, 'lampada', 0, -0.17, 0, 10));
    }
    const luz = new THREE.PointLight('#ffd9a8', 2.5, 6, 1.6);
    luz.position.y = -0.25;
    g.add(luz);
    return { grupo: g, colisores: [] };
  },
  vigas_teto({ comprimento = 4, quantidade = 4, passo = 1.0, secao = 0.16 }) {
    const g = new THREE.Group();
    for (let i = 0; i < quantidade; i++) g.add(caixa(comprimento, secao, secao * 0.7, 'nogueira', 0, -secao / 2, -((quantidade - 1) * passo) / 2 + i * passo));
    return { grupo: g, colisores: [] };
  },

  // ---------- jantar e cozinha
  mesa_jantar({ comprimento = 2.4, largura = 1.05, lugares = 8 }) {
    const g = new THREE.Group();
    g.add(caixa(comprimento, 0.06, largura, 'nogueira', 0, 0.75, 0));
    g.add(caixa(comprimento - 0.3, 0.1, largura - 0.3, 'nogueira', 0, 0.67, 0));
    for (const [x, z] of [[-comprimento / 2 + 0.2, -largura / 2 + 0.2], [comprimento / 2 - 0.2, -largura / 2 + 0.2], [-comprimento / 2 + 0.2, largura / 2 - 0.2], [comprimento / 2 - 0.2, largura / 2 - 0.2]]) g.add(pernaTorneada(0.66, 'nogueira', x, z, 0.045));
    // cadeiras de bouclé com encosto curvo
    const porLado = Math.floor(lugares / 2);
    for (let i = 0; i < porLado; i++) {
      for (const s of [-1, 1]) {
        const x = -comprimento / 2 + (comprimento / porLado) * (i + 0.5);
        const c = new THREE.Group();
        c.add(almofada(0.46, 0.1, 0.46, 'boucle', 0, 0.45, 0, 0.05));
        const enc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.42, 16, 1, true, Math.PI * 0.8, Math.PI * 1.4), material('boucle'));
        enc.position.set(0, 0.7, 0.02);
        c.add(enc);
        for (const [px, pz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) c.add(cilindro(0.018, 0.42, 'nogueira', px, 0.21, pz, 8));
        c.position.set(x, 0, s * (largura / 2 + 0.3));
        c.rotation.y = s > 0 ? Math.PI : 0;
        g.add(c);
        // louça
        g.add(cilindro(0.13, 0.01, 'ceramica_branca', x, 0.785, s * (largura / 2 - 0.22), 20));
        g.add(cilindro(0.09, 0.03, 'ceramica_branca', x, 0.8, s * (largura / 2 - 0.22), 16, 0.06));
        g.add(cilindro(0.03, 0.14, 'vidro', x + 0.15, 0.85, s * (largura / 2 - 0.3), 10, 0.025));
      }
    }
    g.add(caixa(comprimento - 0.6, 0.01, 0.35, 'tecido_claro', 0, 0.785, 0, false));
    g.add(cilindro(0.06, 0.2, 'bronze', 0, 0.88, 0, 12, 0.04));
    g.add(planta(0, 0.98, 0, 0.14, 6));
    return { grupo: g, colisores: [col(comprimento / 2 + 0.35, largura / 2 + 0.55, 0.9)] };
  },
  cristaleira({ largura = 1.6 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.85, 0.5, 'nogueira', 0, 0.45, 0));
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 2; k++) {
        g.add(caixa(largura / 3 - 0.06, 0.28, 0.012, 'nogueira', -largura / 3 + (i * largura) / 3, 0.28 + k * 0.32, 0.256));
        g.add(caixa(0.08, 0.012, 0.02, 'latao', -largura / 3 + (i * largura) / 3, 0.28 + k * 0.32, 0.27));
      }
    g.add(caixa(largura, 1.55, 0.42, 'nogueira', 0, 1.65, -0.02));
    for (let i = 0; i < 3; i++) g.add(portaVidro(largura / 3 - 0.04, 1.4, 'nogueira', -largura / 3 + (i * largura) / 3, 1.65, 0.2));
    for (let k = 0; k < 3; k++) {
      g.add(caixa(largura - 0.1, 0.02, 0.36, 'nogueira', 0, 1.1 + k * 0.4, -0.02));
      for (let i = 0; i < 4; i++) g.add(cilindro(0.09, 0.01, i % 2 ? 'ceramica_branca' : 'marcenaria_azul', -largura / 2 + 0.25 + i * 0.36, 1.2 + k * 0.4, -0.12, 16).rotateX(Math.PI / 2));
    }
    // coroa em arco
    const arco = new THREE.Shape();
    arco.moveTo(-largura / 2 - 0.04, 0);
    arco.quadraticCurveTo(-largura / 4, 0.2, 0, 0.22);
    arco.quadraticCurveTo(largura / 4, 0.2, largura / 2 + 0.04, 0);
    arco.lineTo(-largura / 2 - 0.04, 0);
    const coroa = new THREE.Mesh(new THREE.ExtrudeGeometry(arco, { depth: 0.46, bevelEnabled: false }), material('nogueira'));
    coroa.position.set(0, 2.42, -0.25);
    g.add(coroa);
    return { grupo: g, colisores: [col(largura / 2, 0.26, 2.65)] };
  },
  ilha({ comprimento = 2.6, prof = 1.0 }) {
    const g = new THREE.Group();
    const corpo = prof - 0.35; // parte fechada; os bancos ficam sob a aba do tampo
    g.add(caixa(comprimento, 0.86, corpo, 'marcenaria_branca', 0, 0.43, -0.175));
    // painéis shaker nas costas e laterais
    for (let i = 0; i < 3; i++) g.add(shaker(comprimento / 3 - 0.08, 0.7, 'marcenaria_branca', -comprimento / 3 + (i * comprimento) / 3, 0.45, -0.175 - corpo / 2 - 0.001, null, 0.01));
    for (const s of [-1, 1]) g.add(shaker(corpo - 0.08, 0.7, 'marcenaria_branca', s * (comprimento / 2 + 0.001), 0.45, -0.175, null, 0.01).rotateY(Math.PI / 2));
    for (let i = 0; i < 3; i++) g.add(shaker(comprimento / 3 - 0.08, 0.7, 'marcenaria_branca', -comprimento / 3 + (i * comprimento) / 3, 0.45, -0.175 + corpo / 2 + 0.001, null, 0.01));
    g.add(caixa(comprimento + 0.1, 0.06, prof + 0.1, 'nogueira', 0, 0.9, 0));
    for (const s of [-1, 1]) g.add(pernaTorneada(0.87, 'carvalho', s * (comprimento / 2 - 0.12), prof / 2 - 0.1, 0.045));
    // bancos de linho com encosto curvo e pernas pretas
    const nB = Math.max(2, Math.round(comprimento / 0.65));
    for (let i = 0; i < nB; i++) {
      const x = -comprimento / 2 + (comprimento / nB) * (i + 0.5);
      const b = new THREE.Group();
      b.add(almofada(0.42, 0.08, 0.4, 'tecido_claro', 0, 0.72, 0, 0.04));
      const enc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 16, 1, true, Math.PI * 0.8, Math.PI * 1.4), material('tecido_claro'));
      enc.position.set(0, 0.92, 0);
      b.add(enc);
      for (const [px, pz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) b.add(cilindro(0.01, 0.7, 'metal_preto', px, 0.35, pz, 6));
      b.add(caixa(0.3, 0.01, 0.01, 'metal_preto', 0, 0.25, 0.15));
      b.position.set(x, 0, prof / 2 + 0.28);
      b.rotation.y = Math.PI;
      g.add(b);
    }
    // decoração: tábua, tigela e jarro
    g.add(caixa(0.45, 0.02, 0.28, 'carvalho', -0.6, 0.94, -0.2));
    g.add(cilindro(0.12, 0.07, 'nogueira', -0.55, 0.965, -0.2, 16, 0.08));
    g.add(cilindro(0.09, 0.28, 'ceramica_branca', 0.5, 1.07, -0.25, 14, 0.06));
    g.add(planta(0.5, 1.2, -0.25, 0.16, 6));
    return { grupo: g, colisores: [col(comprimento / 2 + 0.05, prof / 2 + 0.05, 0.95), col(comprimento / 2, 0.25, 0.75, 0, -(prof / 2 + 0.28))] };
  },
  armario_cozinha({ largura = 2.4, pia = false, fogao = false, tanque = false, semSuperior = false, vidro = false, material: mat = 'marcenaria_branca', matSuperior = 'marcenaria_branca' }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.86, 0.6, mat, 0, 0.43, 0));
    g.add(caixa(largura, 0.1, 0.55, mat, 0, 0.05, -0.02));
    const n = Math.max(1, Math.round(largura / 0.6));
    const lw = largura / n;
    for (let i = 0; i < n; i++) {
      const x = -largura / 2 + lw * (i + 0.5);
      if (fogao && Math.abs(x) < 0.4) continue;
      if (i % 3 === 2) for (let k = 0; k < 3; k++) g.add(shaker(lw - 0.04, 0.22, mat, x, 0.24 + k * 0.25, 0.31, 'bronze'));
      else g.add(shaker(lw - 0.04, 0.68, mat, x, 0.48, 0.31, 'bronze'));
    }
    g.add(caixa(largura + 0.02, 0.04, 0.64, 'marmore', 0, 0.88, 0));
    if (!semSuperior) {
      // frontão em azulejo subway até aos armários superiores
      g.add(caixa(largura, 0.6, 0.02, 'subway', 0, 1.2, -0.29));
      g.add(caixa(largura, 0.9, 0.35, matSuperior, 0, 1.95, -0.12));
      for (let i = 0; i < n; i++) {
        const x = -largura / 2 + lw * (i + 0.5);
        if (fogao && Math.abs(x) < 0.45) continue;
        if (vidro) g.add(portaVidro(lw - 0.04, 0.8, matSuperior, x, 1.95, 0.06));
        else g.add(shaker(lw - 0.04, 0.8, matSuperior, x, 1.95, 0.06, 'bronze'));
      }
      g.add(caixa(largura + 0.04, 0.1, 0.42, matSuperior, 0, 2.45, -0.1));
      g.add(caixa(largura + 0.08, 0.05, 0.46, matSuperior, 0, 2.52, -0.1));
      if (fogao) {
        // coifa branca com guarnição de madeira
        g.add(caixa(0.9, 0.9, 0.5, matSuperior, 0, 1.95, -0.05));
        g.add(caixa(0.96, 0.12, 0.56, 'nogueira', 0, 1.56, -0.05));
        g.add(caixa(0.8, 0.5, 0.45, matSuperior, 0, 1.25, -0.08));
      }
    } else {
      g.add(caixa(largura, 0.5, 0.02, 'subway', 0, 1.15, -0.29));
    }
    if (pia || tanque) {
      // cuba de avental (farmhouse) e torneira de ponte
      g.add(caixa(0.7, 0.26, 0.5, 'ceramica_branca', 0, 0.77, 0.06));
      g.add(caixa(0.58, 0.1, 0.4, new THREE.MeshStandardMaterial({ color: '#e6e3dc', roughness: 0.4 }), 0, 0.86, 0.03));
      const metal = pia ? 'latao' : 'metal_preto';
      g.add(cilindro(0.012, 0.28, metal, -0.08, 1.02, -0.2, 8));
      g.add(cilindro(0.012, 0.28, metal, 0.08, 1.02, -0.2, 8));
      g.add(cilindro(0.012, 0.18, metal, 0, 1.15, -0.2, 8).rotateZ(Math.PI / 2));
      g.add(cilindro(0.012, 0.22, metal, 0, 1.1, -0.1, 8).rotateX(Math.PI / 2));
    }
    if (fogao) {
      g.add(caixa(0.76, 0.86, 0.6, 'metal_preto', 0, 0.43, 0.005));
      g.add(caixa(0.76, 0.03, 0.55, 'metal_preto', 0, 0.9, 0));
      for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) g.add(cilindro(0.06, 0.02, 'inox', x, 0.92, z, 12));
      g.add(caixa(0.7, 0.03, 0.02, 'inox', 0, 0.62, 0.31));
      g.add(caixa(0.7, 0.03, 0.02, 'inox', 0, 0.3, 0.31));
      g.add(caixa(0.72, 0.12, 0.05, 'metal_preto', 0, 0.97, -0.26));
    }
    // objetos de bancada
    g.add(cilindro(0.05, 0.16, 'ceramica_branca', largura / 2 - 0.25, 0.98, -0.1, 10, 0.04));
    g.add(planta(largura / 2 - 0.25, 1.06, -0.1, 0.08, 5));
    if (!fogao) g.add(caixa(0.3, 0.02, 0.2, 'carvalho', -largura / 2 + 0.3, 0.91, -0.1));
    return { grupo: g, colisores: [col(largura / 2, 0.32, 0.95)] };
  },
  geladeira() {
    const g = new THREE.Group();
    g.add(caixa(1.0, 2.45, 0.7, 'marcenaria_branca', 0, 1.225, -0.03));
    g.add(caixa(0.9, 1.8, 0.72, 'inox', 0, 0.9, 0));
    g.add(caixa(0.9, 0.9, 0.005, new THREE.MeshStandardMaterial({ color: '#a3a6a9', roughness: 0.3, metalness: 0.8 }), 0, 1.35, 0.362));
    g.add(caixa(0.02, 1.2, 0.02, 'metal_preto', 0, 1.0, 0.36));
    for (const s of [-1, 1]) g.add(caixa(0.025, 0.55, 0.03, 'inox', s * 0.1, 1.35, 0.38));
    g.add(caixa(0.85, 0.03, 0.03, 'inox', 0, 0.55, 0.38));
    g.add(shaker(0.86, 0.5, 'marcenaria_branca', 0, 2.1, 0.33, 'bronze'));
    g.add(caixa(0.4, 0.14, 0.24, 'metal_preto', -0.55, 0.07, 0.15));
    g.add(cilindro(0.1, 0.06, 'inox', -0.64, 0.17, 0.15, 12));
    g.add(cilindro(0.1, 0.06, 'inox', -0.46, 0.17, 0.15, 12));
    return { grupo: g, colisores: [col(0.5, 0.36, 2.45)] };
  },
  armario_alto({ largura = 1.0 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 2.45, 0.6, 'marcenaria_branca', 0, 1.225, 0));
    g.add(shaker(largura / 2 - 0.03, 2.3, 'marcenaria_branca', -largura / 4, 1.2, 0.31, 'bronze'));
    g.add(shaker(largura / 2 - 0.03, 2.3, 'marcenaria_branca', largura / 4, 1.2, 0.31, 'bronze'));
    g.add(caixa(largura + 0.06, 0.08, 0.64, 'marcenaria_branca', 0, 2.49, 0));
    return { grupo: g, colisores: [col(largura / 2, 0.3, 2.5)] };
  },
  maquina() {
    const g = new THREE.Group();
    for (const x of [-0.32, 0.32]) {
      g.add(caixa(0.6, 0.85, 0.6, 'ceramica_branca', x, 0.425, 0));
      g.add(cilindro(0.2, 0.03, 'metal_preto', x, 0.4, 0.3, 24).rotateX(Math.PI / 2));
      g.add(cilindro(0.15, 0.02, new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.2, metalness: 0.5 }), x, 0.4, 0.31, 20).rotateX(Math.PI / 2));
      g.add(caixa(0.5, 0.08, 0.02, 'metal_preto', x, 0.78, 0.3));
    }
    return { grupo: g, colisores: [col(0.62, 0.3, 0.85)] };
  },
  vaso_planta({ variante = 'oliveira' }) {
    const g = new THREE.Group();
    g.add(cilindro(0.22, 0.45, 'cimento_parede', 0, 0.225, 0, 18, 0.18));
    if (variante === 'oliveira') {
      g.add(cilindro(0.03, 0.9, 'nogueira', 0, 0.85, 0, 8, 0.045));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        g.add(esfera(0.22 + (i % 2) * 0.08, new THREE.MeshStandardMaterial({ color: '#6f8a5e', roughness: 0.95 }), Math.cos(a) * 0.28, 1.25 + (i % 3) * 0.2, Math.sin(a) * 0.28, 8));
      }
    } else {
      g.add(planta(0, 0.45, 0, 0.35, 7));
    }
    return { grupo: g, colisores: [col(0.28, 0.28, 1.6)] };
  },

  // ---------- escritório
  mesa_escritorio({ pequena = false }) {
    const g = new THREE.Group();
    const w = pequena ? 1.1 : 1.6;
    const d = pequena ? 0.6 : 0.8;
    g.add(caixa(w, 0.05, d, 'nogueira', 0, 0.75, 0));
    g.add(caixa(w - 0.16, 0.12, d - 0.2, 'nogueira', 0, 0.67, 0));
    g.add(caixa(0.5, 0.08, 0.01, 'nogueira', 0, 0.67, d / 2 - 0.09));
    g.add(esfera(0.012, 'bronze', 0, 0.67, d / 2 - 0.08, 8));
    for (const [x, z] of [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]]) g.add(pernaTorneada(0.66, 'nogueira', x, z, 0.03));
    // monitores e teclado
    const nM = pequena ? 1 : 2;
    for (let i = 0; i < nM; i++) {
      const x = nM === 1 ? 0 : (i - 0.5) * 0.55;
      g.add(caixa(0.52, 0.32, 0.02, 'tela_tv', x, 0.98, -d / 2 + 0.22));
      g.add(caixa(0.05, 0.12, 0.05, 'metal_preto', x, 0.81, -d / 2 + 0.24));
      g.add(caixa(0.18, 0.01, 0.12, 'metal_preto', x, 0.78, -d / 2 + 0.24));
    }
    g.add(caixa(0.36, 0.015, 0.13, 'metal_preto', 0, 0.785, 0.08));
    // cadeira de couro com rodas
    const c = new THREE.Group();
    c.add(almofada(0.5, 0.08, 0.5, 'couro_caramelo', 0, 0.48, 0, 0.04));
    c.add(almofada(0.48, 0.55, 0.08, 'couro_caramelo', 0, 0.8, 0.22, 0.04));
    c.add(cilindro(0.03, 0.4, 'inox', 0, 0.25, 0, 8));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = cilindro(0.012, 0.28, 'inox', Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14, 6);
      p.rotation.z = Math.PI / 2;
      p.rotation.y = -a;
      c.add(p);
      c.add(esfera(0.025, 'metal_preto', Math.cos(a) * 0.27, 0.025, Math.sin(a) * 0.27, 6));
    }
    c.position.set(0, 0, d / 2 + 0.4);
    c.rotation.y = Math.PI;
    g.add(c);
    return { grupo: g, colisores: [col(w / 2, d / 2, 0.8), col(0.28, 0.28, 0.9, 0, -(d / 2 + 0.4))] };
  },
  estante_embutida({ largura = 3.0, altura = 2.6, material: mat = 'marcenaria_verde' }) {
    const g = new THREE.Group();
    g.add(caixa(largura, altura, 0.4, mat, 0, altura / 2, 0));
    const n = Math.max(2, Math.round(largura / 0.8));
    const lw = largura / n;
    for (let i = 0; i < n; i++) {
      const x = -largura / 2 + lw * (i + 0.5);
      g.add(shaker(lw - 0.06, 0.78, mat, x, 0.42, 0.21, 'latao'));
      for (let k = 0; k < 4; k++) g.add(caixa(lw - 0.06, 0.025, 0.34, mat, x, 1.05 + k * 0.4, 0.03));
      g.add(livros(x - lw / 2 + 0.06, 1.07, 0.05, 5));
      if (k2(i)) g.add(caixa(lw * 0.5, 0.22, 0.28, 'ratan', x + 0.05, 1.58, 0.05));
      else g.add(cilindro(0.08, 0.2, 'ceramica_branca', x + 0.1, 1.57, 0.05, 12, 0.06));
      g.add(livros(x - lw / 2 + 0.08, 1.87, 0.05, 4));
      g.add(caixa(0.16, 0.12, 0.12, 'nogueira', x + 0.1, 2.32, 0.05));
    }
    for (let i = 0; i <= n; i++) g.add(caixa(0.05, altura - 0.9, 0.36, mat, -largura / 2 + lw * i, 0.9 + (altura - 0.9) / 2, 0.02));
    g.add(caixa(largura + 0.04, 0.05, 0.44, mat, 0, 0.86, 0.01));
    g.add(caixa(largura + 0.06, 0.1, 0.44, mat, 0, altura - 0.05, 0.01));
    return { grupo: g, colisores: [col(largura / 2, 0.22, altura)] };
  },

  // ---------- painel de TV / garagem
  painel_tv({ material: mat = 'nogueira', largura = 2.8 }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 2.5, 0.06, mat, 0, 1.25, -0.05));
    g.add(caixa(largura - 0.3, 0.05, 0.28, mat, 0, 2.05, 0.1));
    g.add(cilindro(0.06, 0.16, 'ceramica_branca', -largura / 2 + 0.4, 2.15, 0.1, 10, 0.045));
    g.add(planta(largura / 2 - 0.4, 2.12, 0.1, 0.12, 5));
    g.add(livros(-0.2, 2.075, 0.05, 4));
    g.add(caixa(1.5, 0.85, 0.04, 'tela_tv', 0, 1.35, 0));
    // rack com cubículos
    g.add(caixa(largura - 0.4, 0.5, 0.45, mat, 0, 0.35, 0.2));
    for (let i = 0; i < 4; i++) {
      g.add(caixa(0.02, 0.4, 0.4, mat, -largura / 2 + 0.2 + ((largura - 0.4) / 4) * i + 0.01, 0.35, 0.22));
      if (i % 2) g.add(livros(-largura / 2 + 0.3 + ((largura - 0.4) / 4) * i, 0.12, 0.25, 4));
      else g.add(caixa(0.3, 0.2, 0.3, 'ratan', -largura / 2 + 0.2 + ((largura - 0.4) / 4) * (i + 0.5), 0.22, 0.22));
    }
    g.add(esfera(0.12, new THREE.MeshStandardMaterial({ color: '#c9a56b', roughness: 0.6 }), largura / 2 - 0.5, 0.74, 0.2, 12));
    return { grupo: g, colisores: [col(largura / 2, 0.25, 2.5, 0, -0.1)] };
  },
  // Carro com silhueta real: perfil lateral extrudado com arestas boleadas, vidros escuros, cavas de roda,
  // faróis, grelha, retrovisores e barras de tejadilho. `modelo`: 'suv' (por defeito) ou 'picape' com capota marítima.
  // Carro com silhueta real: perfil lateral extrudado com arestas boleadas, vidros escuros, cavas de roda,
  // faróis, grelha, retrovisores. `modelo`: 'sedan' (Jetta), 'picape' (C10 clássica com capota marítima) ou 'suv'.
  carro({ cor = 'carro_preto', modelo = 'sedan' }) {
    const g = new THREE.Group();
    const dims = { sedan: [4.66, 1.78], picape: [5.1, 1.98], suv: [4.75, 1.92] }[modelo] || [4.66, 1.78];
    const [L, W] = dims;
    const h = L / 2;
    const pintura = M(cor);
    const vidro = new THREE.MeshPhysicalMaterial({ color: '#0e1216', roughness: 0.06, metalness: 0.4, clearcoat: 1, envMapIntensity: 0.5 });
    const preto = new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.7 });
    const cromado = material('inox');
    // perfil (z ao longo do carro, y altura), do fundo traseiro, pela retaguarda, tejadilho e capô até ao fundo dianteiro
    const perfis = {
      sedan: [[-h, 0.36], [-h - 0.02, 0.8], [-h + 0.08, 0.93], [-h + 0.8, 0.96], [-h + 1.45, 1.38], [-0.3, 1.45], [0.55, 1.45], [1.35, 1.05], [1.7, 0.97], [h - 0.15, 0.9], [h + 0.02, 0.62], [h, 0.36]],
      picape: [[-h, 0.42], [-h - 0.02, 1.0], [-h + 0.06, 1.06], [-0.5, 1.06], [-0.45, 1.72], [-0.3, 1.8], [0.5, 1.8], [1.0, 1.32], [1.35, 1.1], [h - 0.2, 1.04], [h + 0.02, 0.74], [h, 0.42]],
      suv: [[-h, 0.4], [-h - 0.03, 0.9], [-h + 0.05, 1.12], [-h + 0.32, 1.7], [-h + 0.8, 1.78], [0.35, 1.78], [1.05, 1.28], [1.35, 1.08], [h - 0.15, 1.0], [h + 0.02, 0.72], [h, 0.4]],
    };
    const perfil = perfis[modelo] || perfis.sedan;
    const forma = new THREE.Shape();
    perfil.forEach(([z, y], i) => (i ? forma.lineTo(z, y) : forma.moveTo(z, y)));
    forma.lineTo(h, perfil[perfil.length - 1][1]);
    const corpoGeo = new THREE.ExtrudeGeometry(forma, { depth: W - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 6 });
    const corpo = new THREE.Mesh(corpoGeo, pintura);
    corpo.rotation.y = -Math.PI / 2; // x do perfil → z do carro; extrusão → largura
    corpo.position.x = (W - 0.12) / 2; // a extrusão corre de 0 a −(W−0,12) em x: centrar
    corpo.castShadow = true;
    corpo.receiveShadow = true;
    g.add(corpo);
    // vidros laterais (ligeiramente salientes), montante entre portas, puxadores e retrovisores
    const jan = { sedan: [-h + 1.0, 1.15, 1.02, 0.34], picape: [-0.35, 0.85, 1.42, 0.36], suv: [-h + 0.5, 1.0, 1.4, 0.5] }[modelo] || [-h + 1.0, 1.15, 1.02, 0.34];
    const [zv0, zv1, yv, hv] = jan;
    for (const sx of [-1, 1]) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.02, hv, zv1 - zv0), vidro);
      v.position.set(sx * (W / 2), yv, (zv0 + zv1) / 2);
      g.add(v);
      g.add(caixa(0.03, hv + 0.02, 0.05, preto, sx * (W / 2 + 0.005), yv, modelo === 'picape' ? 0.3 : (zv0 + zv1) / 2));
      for (const zp of modelo === 'picape' ? [0.1] : [-0.45, 0.6]) g.add(caixa(0.03, 0.03, 0.18, cromado, sx * (W / 2 + 0.01), yv - hv / 2 - 0.12, zp));
      g.add(caixa(0.18, 0.09, 0.14, pintura, sx * (W / 2 + 0.09), yv - 0.05, zv1 - 0.1));
    }
    // para-brisas e óculo traseiro (painéis inclinados)
    const pbz = { sedan: [0.95, 1.28, -0.75], picape: [0.75, 1.58, -0.7], suv: [0.7, 1.55, -0.62] }[modelo] || [0.95, 1.28, -0.75];
    const pb = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.02, 0.8), vidro);
    pb.position.set(0, pbz[1], pbz[0]);
    pb.rotation.x = pbz[2];
    g.add(pb);
    const otz = { sedan: [-h + 1.15, 1.2, 0.85, 0.55], picape: [-0.45, 1.5, 1.5, 0.45], suv: [-h + 0.19, 1.48, 1.15, 0.62] }[modelo] || [-h + 1.15, 1.2, 0.85, 0.55];
    const ot = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.02, otz[3]), vidro);
    ot.position.set(0, otz[1], otz[0]);
    ot.rotation.x = otz[2];
    g.add(ot);
    // cavas de roda (cilindros escuros que atravessam a carroçaria) e rodas
    const pneu = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.92 });
    const zRodas = { sedan: [-1.4, 1.4], picape: [-1.65, 1.6], suv: [-1.45, 1.45] }[modelo] || [-1.4, 1.4];
    const rPneu = modelo === 'sedan' ? 0.32 : 0.37;
    for (const z of zRodas) {
      const cava = new THREE.Mesh(new THREE.CylinderGeometry(rPneu + 0.1, rPneu + 0.1, W + 0.02, 24), preto);
      cava.rotation.z = Math.PI / 2;
      cava.position.set(0, rPneu + 0.05, z);
      g.add(cava);
      for (const sx of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(rPneu, rPneu, 0.24, 24), pneu);
        r.rotation.z = Math.PI / 2;
        r.position.set(sx * (W / 2 - 0.15), rPneu, z);
        r.castShadow = true;
        g.add(r);
        const jante = cilindro(rPneu * 0.66, 0.25, cromado, sx * (W / 2 - 0.15), rPneu, z, 10);
        jante.rotation.z = Math.PI / 2;
        g.add(jante);
        for (let k = 0; k < 5; k++) {
          const raio = caixa(0.03, rPneu * 0.55, 0.04, preto, sx * (W / 2 - 0.02), rPneu, z);
          raio.rotation.x = (k * Math.PI * 2) / 5;
          raio.translateY(rPneu * 0.28);
          g.add(raio);
        }
      }
    }
    // frente: grelha, faróis, para-choques; traseira: farolins, matrícula
    const yF = perfil[perfil.length - 3][1] - 0.02; // altura do capô à frente
    g.add(caixa(modelo === 'picape' ? 1.2 : 0.9, 0.26, 0.04, preto, 0, yF - 0.28, h + 0.03));
    g.add(caixa(W - 0.2, 0.16, 0.08, modelo === 'picape' ? cromado : preto, 0, 0.5, h + 0.02));
    const farol = new THREE.MeshStandardMaterial({ color: '#f4f6ff', emissive: '#dfe8ff', emissiveIntensity: 0.6, roughness: 0.2 });
    const farolim = new THREE.MeshStandardMaterial({ color: '#b3121b', emissive: '#7a0a10', emissiveIntensity: 0.8, roughness: 0.3 });
    for (const sx of [-1, 1]) {
      if (modelo === 'picape') g.add(cilindro(0.09, 0.04, farol, sx * (W / 2 - 0.3), yF - 0.22, h + 0.03, 14).rotateX(Math.PI / 2));
      else g.add(caixa(0.4, 0.13, 0.04, farol, sx * (W / 2 - 0.33), yF - 0.2, h + 0.03));
      g.add(caixa(0.34, 0.13, 0.04, farolim, sx * (W / 2 - 0.28), perfil[1][1] - 0.15, -h - 0.04));
    }
    g.add(caixa(0.4, 0.13, 0.02, material('marcenaria_branca'), 0, 0.58, -h - 0.05));
    if (modelo === 'picape') {
      g.add(caixa(W - 0.3, 0.03, h - 0.55, preto, 0, 1.08, -h / 2 - 0.25)); // capota marítima
      g.add(caixa(W - 0.2, 0.05, 0.05, cromado, 0, 0.93, -h - 0.02)); // para-choques traseiro cromado
    } else if (modelo === 'suv') for (const sx of [-1, 1]) g.add(caixa(0.05, 0.06, 1.9, preto, sx * 0.62, 1.82, -0.3));
    return { grupo: g, colisores: [col(W / 2 + 0.03, h + 0.05, 1.5)] };
  },
  // focos embutidos no teto (discos emissivos), em grelha
  spots_teto({ colunas = 2, linhas = 3, passoX = 1.2, passoY = 1.5 }) {
    const g = new THREE.Group();
    const aro = new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.6 });
    const luz = new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe9b8', emissiveIntensity: 3 });
    for (let i = 0; i < colunas; i++) {
      for (let k = 0; k < linhas; k++) {
        const x = (i - (colunas - 1) / 2) * passoX;
        const z = (k - (linhas - 1) / 2) * passoY;
        g.add(cilindro(0.06, 0.01, aro, x, -0.005, z, 16));
        g.add(cilindro(0.045, 0.006, luz, x, -0.006, z, 16));
      }
    }
    return { grupo: g, colisores: [] };
  },
  balcao_bar({ largura = 3.2, semPrateleiras = false }) {
    const g = new THREE.Group();
    g.add(caixa(largura, 0.9, 0.65, 'marcenaria_cinza', 0, 0.45, 0));
    const n = Math.max(2, Math.round(largura / 0.64));
    for (let i = 0; i < n; i++) g.add(shaker(largura / n - 0.08, 0.75, 'marcenaria_cinza', -largura / 2 + (largura / n) * (i + 0.5), 0.45, -0.33, 'metal_preto'));
    g.add(caixa(largura + 0.1, 0.05, 0.75, 'granito_preto', 0, 0.925, 0));
    g.add(cilindro(0.04, 0.16, 'vidro', -largura / 2 + 0.4, 1.03, 0.1, 10));
    g.add(cilindro(0.06, 0.22, 'metal_preto', largura / 2 - 0.4, 1.06, 0.05, 10, 0.045));
    if (!semPrateleiras) {
      g.add(caixa(largura - 0.2, 0.04, 0.3, 'nogueira', 0, 1.7, -0.45));
      g.add(caixa(largura - 0.2, 0.04, 0.3, 'nogueira', 0, 2.1, -0.45));
      for (let i = 0; i < Math.round(largura / 0.26); i++) g.add(cilindro(0.035, 0.28, new THREE.MeshStandardMaterial({ color: i % 3 ? '#2b3a2a' : '#5a3a1a', roughness: 0.3 }), -largura / 2 + 0.3 + i * 0.24, 1.86 + (i % 2) * 0.4, -0.45, 10));
    }
    return { grupo: g, colisores: [col(largura / 2, 0.35, 0.95)] };
  },
  banqueta() {
    const g = new THREE.Group();
    g.add(cilindro(0.18, 0.06, 'couro_caramelo', 0, 0.7, 0, 16));
    g.add(cilindro(0.02, 0.68, 'metal_preto', 0, 0.34, 0, 8));
    g.add(cilindro(0.2, 0.02, 'metal_preto', 0, 0.02, 0, 16));
    return { grupo: g, colisores: [col(0.2, 0.2, 0.75)] };
  },
  adega({ largura = 3.0, altura = 2.2 }) {
    // grelha metálica preta sobre a parede de bloco, com garrafas deitadas
    const g = new THREE.Group();
    const cols = Math.round(largura / 0.45);
    const linhas = Math.round((altura - 0.3) / 0.16);
    for (let i = 0; i <= cols; i++) g.add(caixa(0.015, altura, 0.015, 'metal_preto', -largura / 2 + (largura / cols) * i, altura / 2, 0.06));
    for (let k = 0; k < linhas; k++) {
      g.add(caixa(largura, 0.012, 0.012, 'metal_preto', 0, 0.3 + k * 0.16, 0.12));
      g.add(caixa(largura, 0.012, 0.012, 'metal_preto', 0, 0.3 + k * 0.16 + 0.04, 0.02));
      for (let i = 0; i < cols; i++) {
        if ((i * 7 + k * 3) % 5 === 0) continue;
        const cor = ['#3a1f1a', '#2a3a2a', '#5a4a20', '#3a2a3a'][(i + k) % 4];
        const gar = cilindro(0.037, 0.3, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.25 }), -largura / 2 + (largura / cols) * (i + 0.5), 0.34 + k * 0.16, 0.16, 10);
        gar.rotation.x = Math.PI / 2;
        g.add(gar);
        g.add(cilindro(0.014, 0.08, 'metal_preto', -largura / 2 + (largura / cols) * (i + 0.5), 0.34 + k * 0.16, 0.34, 8).rotateX(Math.PI / 2));
      }
    }
    return { grupo: g, colisores: [col(largura / 2, 0.2, altura)] };
  },
  portao_garagem({ largura = 4.0, altura = 2.3 }) {
    const g = new THREE.Group();
    const preto = new THREE.MeshStandardMaterial({ color: '#1e2124', roughness: 0.6 });
    for (const s of [-1, 1]) {
      const w = largura / 2 - 0.03;
      const x = s * (largura / 4);
      g.add(caixa(w, altura, 0.06, preto, x, altura / 2, 0));
      for (let i = 0; i < 6; i++) g.add(caixa(0.01, altura - 0.2, 0.07, new THREE.MeshStandardMaterial({ color: '#0f1113', roughness: 0.7 }), x - w / 2 + (w / 6) * (i + 0.5), altura / 2, 0));
      g.add(caixa(w - 0.1, 0.1, 0.02, preto, x, altura - 0.15, 0.04));
      g.add(caixa(w - 0.1, 0.1, 0.02, preto, x, 0.15, 0.04));
      const diag = caixa(w * 1.2, 0.1, 0.02, preto, x, altura / 2, 0.04);
      diag.rotation.z = s * Math.atan2(altura - 0.4, w);
      g.add(diag);
      for (const y of [0.4, altura - 0.4]) g.add(caixa(0.5, 0.05, 0.02, 'metal_preto', x + s * (w / 2 - 0.3), y, 0.05));
      // janelas superiores em arco (simplificadas)
      for (let i = 0; i < 2; i++) g.add(caixa(w / 2 - 0.12, 0.35, 0.01, 'vidro', x - w / 4 + (i * w) / 2, altura - 0.5, 0.045));
    }
    return { grupo: g, colisores: [col(largura / 2, 0.05, altura)] };
  },
};

// portas shaker empilhadas numa coluna de armário
function shakerColuna(g, w, h, x, y, z, n) {
  for (let i = 0; i < n; i++) g.add(shaker(w, h / n - 0.03, 'marcenaria_branca', x, y - h / 2 + (h / n) * (i + 0.5), z, 'bronze'));
}
const k2 = (i) => i % 2 === 1;

/** Cria uma peça pelo nome. */
export function criarPeca(tipo, opcoes = {}) {
  const f = pecas[tipo];
  if (!f) {
    console.warn('peça desconhecida', tipo);
    return { grupo: new THREE.Group(), colisores: [] };
  }
  return f(opcoes);
}
