// Constrói a geometria 3D da casa a partir do modelo normalizado (modelo.js).
// Convenção: plano (x, y) da planta → mundo (x, altura, -y).
import * as THREE from 'three';
import { material } from './materiais.js';
import { ambienteEm, dentroDe } from './modelo.js';

const V = (x, h, y) => new THREE.Vector3(x, h, -y);

// ---------------------------------------------------------------- utilidades
function uvsEmMetros(geo, L, H, E) {
  // BoxGeometry: grupos +x, -x, +y, -y, +z, -z (4 vértices cada, em sequência)
  const dims = [[E, H], [E, H], [L, E], [L, E], [L, H], [L, H]];
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [w, h] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * w, uv.getY(k) * h);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Caixa com comprimento L (eixo local x) entre dois pontos do plano, altura de h0 a h1. */
function caixaEntre(a, b, esp, h0, h1, mats, offsetLateral = 0) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  const geo = uvsEmMetros(new THREE.BoxGeometry(L, h1 - h0, esp), L, h1 - h0, esp);
  const mesh = new THREE.Mesh(geo, mats);
  const ang = Math.atan2(dy, dx);
  mesh.rotation.y = ang;
  // deslocamento lateral (+ = lado "z local" = direita do sentido a→b)
  const nx = Math.sin(ang);
  const ny = -Math.cos(ang);
  mesh.position.set((a[0] + b[0]) / 2 + nx * offsetLateral, (h0 + h1) / 2, -((a[1] + b[1]) / 2 + ny * offsetLateral));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function formaDePoligono(poly, furos = []) {
  const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], p[1])));
  for (const f of furos) shape.holes.push(new THREE.Path(f.map((p) => new THREE.Vector2(p[0], p[1]))));
  return shape;
}

/** Superfície horizontal (piso/teto) a partir de um polígono do plano. */
function superficie(poly, furos, altura, mat, paraCima = true) {
  const geo = new THREE.ShapeGeometry(formaDePoligono(poly, furos));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; // (x, y) → (x, 0, -y), normal para cima
  mesh.position.y = altura;
  if (!paraCima) {
    mesh.rotation.x = Math.PI / 2;
    mesh.scale.y = -1; // mantém a orientação (x, -y) com normal para baixo
  }
  mesh.receiveShadow = true;
  mesh.castShadow = !paraCima;
  return mesh;
}

/** Laje com espessura (extrusão do polígono), do nível base até base+espessura. */
function laje(poly, furos, base, espessura, matTopo, matLado) {
  const geo = new THREE.ExtrudeGeometry(formaDePoligono(poly, furos), { depth: espessura, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, [matTopo, matLado]);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = base;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

const centroide = (poly) => {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
};

// ---------------------------------------------------------------- construtor
export class Construtor {
  constructor(modelo) {
    this.modelo = modelo;
    this.grupo = new THREE.Group();
    this.colisores = []; // {cx, cy, hx, hy, rot, y0, y1, ativo()}
    this.portas = []; // {grupo, tipo, aberta, alvo, pivo...}
    this.superficies = []; // {tipo:'poligono', poly, furos, nivel} para altura do chão
    this.rampas = []; // funções (x,y)→altura|null
    this.pontosLuz = [];
    this.laje = modelo.laje;
  }

  construir() {
    this.nivelMaximo = Math.max(...this.modelo.pavimentos.map((p) => p.nivel));
    for (const pav of this.modelo.pavimentos) this.construirPavimento(pav);
    for (const esc of this.modelo.escadas) this.construirEscada(esc);
    this.construirExterior();
    return this.grupo;
  }

  // ---------- colisores
  addColisorCaixa(cx, cy, hx, hy, rot, y0, y1, ativo) {
    const c = { cx, cy, hx, hy, rot, y0, y1, ativo: ativo || (() => true) };
    this.colisores.push(c);
    return c;
  }

  addColisorSegmento(a, b, esp, y0, y1, ativo) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return this.addColisorCaixa((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(dx, dy) / 2, esp / 2, Math.atan2(dy, dx), y0, y1, ativo);
  }

  // ---------- pavimento
  construirPavimento(pav) {
    const nivel = pav.nivel;
    // paredes sobem até ao piso seguinte; no último pavimento sobem até ao telhado (sem frestas)
    const topo = nivel + pav.peDireito + this.laje + (pav.nivel === this.nivelMaximo ? 0.24 : 0);
    const g = new THREE.Group();
    g.name = pav.id;
    this.grupo.add(g);

    // superfícies de piso para o cálculo de altura
    if (pav.piso.poligono) this.superficies.push({ poly: pav.piso.poligono, furos: pav.piso.furos, nivel });
    for (const ex of pav.piso.exteriores) this.superficies.push({ poly: ex.poligono, furos: [], nivel: ex.nivel });

    // ----- laje do piso (com espessura) + acabamento por ambiente
    if (pav.piso.poligono) {
      const furosPiso = pav.piso.furos;
      g.add(laje(pav.piso.poligono, furosPiso, nivel - this.laje, this.laje, material(pav.piso.material), material('parede_creme')));
      for (const amb of pav.ambientes) {
        if (amb.poligono && amb.piso !== pav.piso.material) {
          g.add(superficie(amb.poligono, [], nivel + 0.004, material(amb.piso)));
        }
      }
      // tetos próprios de alguns ambientes (ligeiramente abaixo do teto geral)
      for (const amb of pav.ambientes) {
        if (amb.poligono && amb.teto) {
          const m = material(amb.teto);
          m.side = THREE.DoubleSide;
          const t = superficie(amb.poligono, pav.vazios, nivel + pav.peDireito - 0.012, m, false);
          t.userData.tipo = 'teto';
          g.add(t);
        }
      }
      // teto (menos vazios)
      const tetoMat = material('teto');
      tetoMat.side = THREE.DoubleSide;
      const teto = superficie(pav.piso.teto || pav.piso.poligono, pav.vazios, nivel + pav.peDireito - 0.005, tetoMat, false);
      teto.userData.tipo = 'teto';
      g.add(teto);
    }
    for (const ex of pav.piso.exteriores) {
      g.add(laje(ex.poligono, [], ex.nivel - this.laje, this.laje, material(ex.material), material('parede_creme')));
    }

    // ----- paredes
    for (const w of pav.paredes) this.construirParede(pav, w, nivel, topo, g);

    // ----- vidros e guarda-corpos soltos
    for (const v of pav.vidros) {
      const meioV = [(v.a[0] + v.b[0]) / 2, (v.a[1] + v.b[1]) / 2];
      const exterior = !pav.piso.poligono || !dentroDe(meioV, pav.piso.poligono);
      if (v.tipo === 'guarda_corpo') this.construirGuarda(v.a, v.b, v.altura || 1.1, () => nivel, g, exterior ? 'branco' : 'preto');
      else this.construirDivisoriaVidro(v.a, v.b, nivel, nivel + pav.peDireito, g);
    }

    // rodapé? (simplificado: não)
  }

  // ---------- parede com vãos e materiais por lado
  construirParede(pav, w, nivel, topo, g) {
    const a = w.a;
    const b = w.b;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 0.05) return;
    const ux = dx / L;
    const uy = dy / L;
    const nx = -uy; // normal "esquerda" (lado -z local)
    const ny = ux;
    if (w.topo !== undefined) topo = w.topo; // parede com altura limitada (ex.: debaixo da escada)
    const fundo = nivel - this.laje; // a parede desce até à base da laje (sem frestas entre pavimentos)

    // materiais por lado
    const meioP = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const lado = (s) => {
      const p = [meioP[0] + s * nx * (w.esp / 2 + 0.3), meioP[1] + s * ny * (w.esp / 2 + 0.3)];
      const envelope = pav.piso.teto || pav.piso.poligono;
      const dentroCasa = envelope && dentroDe(p, envelope);
      if (!dentroCasa) return { mat: material(pav.nivel > 0 ? 'siding' : 'parede_branca'), lambri: false, amb: null, exterior: true };
      // dentro do envelope mas fora do piso deste pavimento = face virada para um vazio (pé-direito duplo)
      if (!dentroDe(p, pav.piso.poligono)) return { mat: material('parede_branca'), lambri: false, amb: null, vazio: true, exterior: false };
      const amb = ambienteEm(pav, p);
      const vazio = pav.vazios.some((vz) => dentroDe(p, vz));
      let nomeMat = w.material || (amb ? amb.parede : 'parede_branca');
      // parede de acento: a parede está do lado X do ambiente quando o ponto amostrado (dentro do ambiente) está do lado oposto
      if (amb && amb.paredesPorLado && !w.material) {
        const vertical = Math.abs(ux) < 0.2;
        const ladoDaParede = vertical ? (p[0] > meioP[0] ? 'oeste' : 'leste') : p[1] > meioP[1] ? 'sul' : 'norte';
        if (amb.paredesPorLado[ladoDaParede]) nomeMat = amb.paredesPorLado[ladoDaParede];
      }
      return { mat: material(nomeMat), lambri: !!(amb && amb.lambri), amb, vazio, exterior: false };
    };
    const esq = lado(1); // lado -z local (normal esquerda)
    const dir = lado(-1); // lado +z local
    const matTopo = material('parede_branca');
    const mats = [matTopo, matTopo, matTopo, matTopo, dir.mat, esq.mat];

    // vãos sobre esta parede
    const vaos = [];
    for (const v of pav.vaos) {
      const m = [(v.a[0] + v.b[0]) / 2, (v.a[1] + v.b[1]) / 2];
      const rel = [m[0] - a[0], m[1] - a[1]];
      const t = rel[0] * ux + rel[1] * uy;
      const dist = Math.abs(rel[0] * nx + rel[1] * ny);
      if (dist > w.esp / 2 + 0.03 || t < -0.02 || t > L + 0.02) continue;
      const meia = Math.hypot(v.b[0] - v.a[0], v.b[1] - v.a[1]) / 2;
      // o vão tem de estar alinhado com a parede
      const vux = (v.b[0] - v.a[0]) / (2 * meia);
      if (Math.abs(vux * ux + ((v.b[1] - v.a[1]) / (2 * meia)) * uy) < 0.9) continue;
      vaos.push({ ...v, t0: Math.max(0, t - meia), t1: Math.min(L, t + meia) });
    }
    vaos.sort((p, q) => p.t0 - q.t0);

    const ponto = (t) => [a[0] + ux * t, a[1] + uy * t];
    const peca = (t0, t1, h0, h1) => {
      if (t1 - t0 < 0.005 || h1 - h0 < 0.005) return;
      g.add(caixaEntre(ponto(t0), ponto(t1), w.esp, h0, h1, mats));
      this.addColisorSegmento(ponto(t0), ponto(t1), w.esp, h0, h1);
      const comprimento = t1 - t0;
      for (const [s, info] of [[1, esq], [-1, dir]]) {
        if (!info.amb || w.material === 'pedra') continue;
        const branco = material('marcenaria_branca');
        // rodapé
        if (h0 <= nivel + 0.01 && h1 > nivel + 0.2) {
          const rodape = caixaEntre(ponto(t0), ponto(t1), 0.016, nivel, nivel + 0.12, branco, -s * (w.esp / 2 + 0.008));
          rodape.castShadow = false;
          g.add(rodape);
        }
        // sanca (só onde há teto deste pavimento)
        const teto = nivel + pav.peDireito;
        if (h1 >= teto - 0.02 && h0 < teto - 0.1 && !info.vazio) {
          const sanca = caixaEntre(ponto(t0), ponto(t1), 0.05, teto - 0.09, teto, branco, -s * (w.esp / 2 + 0.025));
          sanca.castShadow = false;
          g.add(sanca);
        }
        // lambri (painel inferior) com almofadas, ou ripado
        if (info.lambri && h0 <= nivel + 0.01) {
          const cfg = info.amb;
          const alt = Math.min(cfg.lambriAltura || 0.95, h1 - h0);
          const matL = material(cfg.lambriTipo === 'ripado' ? cfg.lambriMaterial || 'shiplap_azul' : cfg.lambriMaterial || 'marcenaria_branca');
          const off = s * (w.esp / 2 + 0.012);
          const painel = caixaEntre(ponto(t0), ponto(t1), 0.024, nivel + 0.12, nivel + alt, matL, -off);
          painel.castShadow = false;
          g.add(painel);
          const cap = caixaEntre(ponto(t0), ponto(t1), 0.05, nivel + alt, nivel + alt + 0.04, matL, -s * (w.esp / 2 + 0.025));
          cap.castShadow = false;
          g.add(cap);
          if (cfg.lambriTipo !== 'ripado') this.molduras(ponto, t0, t1, nivel + 0.2, nivel + alt - 0.08, matL, -s * (w.esp / 2 + 0.03), g, 0.7);
        }
        // boiserie (molduras na parte superior da parede, na cor da parede)
        if (info.amb.boiserie && h1 >= nivel + 2.2 && h0 <= nivel + 1.3) {
          const base = info.lambri ? nivel + (info.amb.lambriAltura || 0.95) + 0.25 : nivel + 0.35;
          this.molduras(ponto, t0, t1, base, Math.min(h1, nivel + pav.peDireito) - 0.3, info.mat, -s * (w.esp / 2 + 0.012), g, 0.95);
        }
      }
    };

    let cursor = 0;
    for (const v of vaos) {
      peca(cursor, v.t0, fundo, topo);
      const base = nivel + (v.peitoril || 0);
      const cimo = base + v.altura;
      if (v.peitoril > 0) peca(v.t0, v.t1, fundo, base);
      peca(v.t0, v.t1, Math.min(cimo, topo), topo);
      let ladoCortina = esq.amb && !dir.amb ? 1 : dir.amb && !esq.amb ? -1 : 0;
      if ((esq.amb || dir.amb)?.semCortinas) ladoCortina = 0; // garagem, lavandaria: sem cortinas
      this.construirVao(v, ponto(v.t0), ponto(v.t1), w.esp, base, Math.min(cimo, topo), ux, uy, g, nivel, ladoCortina);
      cursor = v.t1;
    }
    peca(cursor, L, fundo, topo);
  }

  /** Molduras retangulares (boiserie) ao longo de um troço de parede, entre alturas yA e yB. */
  molduras(ponto, t0, t1, yA, yB, mat, offset, g, larguraMax) {
    const L = t1 - t0;
    if (L < 0.5 || yB - yA < 0.3) return;
    const n = Math.max(1, Math.round(L / larguraMax));
    const larg = L / n;
    const b = 0.035;
    for (let i = 0; i < n; i++) {
      const a0 = t0 + larg * i + 0.09;
      const a1 = t0 + larg * (i + 1) - 0.09;
      if (a1 - a0 < 0.2) continue;
      const cima = caixaEntre(ponto(a0), ponto(a1), 0.012, yB - b, yB, mat, offset);
      const baixo = caixaEntre(ponto(a0), ponto(a1), 0.012, yA, yA + b, mat, offset);
      const esqB = caixaEntre(ponto(a0), ponto(a0 + b), 0.012, yA, yB, mat, offset);
      const dirB = caixaEntre(ponto(a1 - b), ponto(a1), 0.012, yA, yB, mat, offset);
      for (const m of [cima, baixo, esqB, dirB]) {
        m.castShadow = false;
        g.add(m);
      }
    }
  }

  // ---------- janelas e portas
  construirVao(v, p0, p1, esp, h0, h1, ux, uy, g, nivel, ladoCortina = 0) {
    const largura = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const altura = h1 - h0;
    const grupo = new THREE.Group();
    const ang = Math.atan2(uy, ux);
    grupo.position.copy(V((p0[0] + p1[0]) / 2, h0, (p0[1] + p1[1]) / 2));
    grupo.rotation.y = ang;
    g.add(grupo);
    const preto = material('caixilho');
    const s = 0.06; // secção do caixilho

    const barra = (cx, cy, w, h, d = esp + 0.02, mat = preto) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(cx, cy, 0);
      m.castShadow = true;
      grupo.add(m);
      return m;
    };

    if (v.tipo === 'janela' || v.tipo === 'porta_vidro') {
      // caixilho exterior
      barra(0, altura - s / 2, largura, s);
      barra(0, s / 2, largura, s);
      barra(-largura / 2 + s / 2, altura / 2, s, altura);
      barra(largura / 2 - s / 2, altura / 2, s, altura);
      // vidro
      const vidro = new THREE.Mesh(new THREE.PlaneGeometry(largura - s, altura - s), material('vidro'));
      vidro.position.set(0, altura / 2, 0);
      grupo.add(vidro);
      // travessas (quadriculado preto do projeto)
      const nH = Math.max(1, Math.round(largura / 0.55));
      const nV = Math.max(1, Math.round(altura / 0.55));
      for (let i = 1; i < nH; i++) barra(-largura / 2 + (largura / nH) * i, altura / 2, 0.025, altura - s, esp * 0.5);
      for (let i = 1; i < nV; i++) barra(0, (altura / nV) * i, largura - s, 0.025, esp * 0.5);
      // peitoril
      if (v.tipo === 'janela') barra(0, -0.015, largura + 0.08, 0.03, esp + 0.08, material('marcenaria_branca'));
      // cortinas de voil com varão preto, do lado interior
      if (ladoCortina !== 0 && altura >= 1.0 && v.cortinas !== false) {
        const zc = -ladoCortina * (esp / 2 + 0.14);
        const topoC = altura + 0.18;
        const varao = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, largura + 0.7, 8), preto);
        varao.rotation.z = Math.PI / 2;
        varao.position.set(0, topoC, zc);
        grupo.add(varao);
        for (const sx of [-1, 1]) {
          const fin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), preto);
          fin.position.set(sx * (largura / 2 + 0.35), topoC, zc);
          grupo.add(fin);
          const largP = Math.min(0.55, largura * 0.32);
          const altP = topoC - 0.02 + h0 - nivel; // até ao chão
          const geo = new THREE.PlaneGeometry(largP, altP, 28, 1);
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / largP) * Math.PI * 7) * 0.035);
          geo.computeVertexNormals();
          const painel = new THREE.Mesh(geo, material('cortina'));
          painel.position.set(sx * (largura / 2 + 0.12), topoC - 0.02 - altP / 2, zc);
          painel.castShadow = false;
          grupo.add(painel);
        }
      }
      if (v.tipo === 'porta_vidro') {
        // porta de correr: metade abre deslizando
        const folha = new THREE.Group();
        const larg = largura / 2;
        const f = new THREE.Mesh(new THREE.BoxGeometry(larg, altura - 0.02, 0.04), preto);
        f.position.set(0, altura / 2, 0);
        const fv = new THREE.Mesh(new THREE.PlaneGeometry(larg - 0.1, altura - 0.12), material('vidro'));
        fv.position.set(0, altura / 2, 0.03);
        folha.add(f, fv);
        folha.position.set(-larg / 2, 0, esp / 2 + 0.03);
        grupo.add(folha);
        const porta = { grupo: folha, tipo: 'correr', aberta: false, fechado: -larg / 2, aberto: larg / 2, pos: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], nivel };
        this.portas.push(porta);
        // colisor da metade fixa e da folha (quando fechada)
        this.addColisorSegmento(p0, [p0[0] + ux * larg, p0[1] + uy * larg], esp, h0, h1, () => !porta.aberta);
        this.addColisorSegmento([p0[0] + ux * larg, p0[1] + uy * larg], p1, esp, h0, h1);
      } else {
        this.addColisorSegmento(p0, p1, esp, h0, h1); // janelas bloqueiam
      }
    } else if (v.tipo === 'passagem') {
      // vão sem folha (ex.: porta celeiro que corre ao lado)
      const branco = material('marcenaria_branca');
      barra(0, altura - 0.04, largura + 0.1, 0.08, esp + 0.04, branco);
      barra(-largura / 2 - 0.03, altura / 2, 0.06, altura, esp + 0.04, branco);
      barra(largura / 2 + 0.03, altura / 2, 0.06, altura, esp + 0.04, branco);
    } else {
      // porta de abrir: aduela + folha com dobradiça no início do vão
      const branco = material('marcenaria_branca');
      barra(0, altura - 0.04, largura + 0.1, 0.08, esp + 0.04, branco);
      barra(-largura / 2 - 0.03, altura / 2, 0.06, altura, esp + 0.04, branco);
      barra(largura / 2 + 0.03, altura / 2, 0.06, altura, esp + 0.04, branco);
      const pivo = new THREE.Group();
      pivo.position.set(-largura / 2 + 0.02, 0, 0);
      const lf = largura - 0.04;
      const folha = new THREE.Mesh(new THREE.BoxGeometry(lf, altura - 0.03, 0.045), material('porta'));
      folha.position.set(lf / 2, altura / 2, 0);
      folha.castShadow = true;
      pivo.add(folha);
      // almofadas (painéis) da porta
      for (const [py, ph] of [[0.62, 0.7], [1.45, 0.5]]) {
        const painel = new THREE.Mesh(new THREE.BoxGeometry(lf - 0.24, ph, 0.02), material('marcenaria_branca'));
        painel.position.set(lf / 2, py + ph / 2 - 0.2, 0.03);
        pivo.add(painel);
        const painel2 = painel.clone();
        painel2.position.z = -0.03;
        pivo.add(painel2);
      }
      const macaneta = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), material('latao'));
      macaneta.position.set(lf - 0.08, 1.02, 0.045);
      pivo.add(macaneta);
      grupo.add(pivo);
      const porta = { grupo: pivo, tipo: 'abrir', aberta: false, fechado: 0, aberto: -Math.PI / 2 * 0.95, pos: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], nivel };
      this.portas.push(porta);
      this.addColisorSegmento(p0, p1, esp, h0, h1, () => !porta.aberta);
    }
  }

  // ---------- guarda-corpo (balaústres pretos + corrimão de madeira)
  construirGuarda(a, b, altura, alturaBase, g, estilo = 'preto') {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 0.2) return;
    const ux = dx / L;
    const uy = dy / L;
    const branco = estilo === 'branco';
    const preto = material(branco ? 'marcenaria_branca' : 'metal_preto');
    const matCorrimao = material(branco ? 'marcenaria_branca' : 'marcenaria_madeira');
    const passo = branco ? 0.14 : 0.13;
    const n = Math.max(2, Math.round(L / passo));
    const geoBal = new THREE.BoxGeometry(branco ? 0.035 : 0.016, altura - 0.05, branco ? 0.035 : 0.016);
    const inst = new THREE.InstancedMesh(geoBal, preto, n + 1);
    const m = new THREE.Matrix4();
    for (let i = 0; i <= n; i++) {
      const t = (L * i) / n;
      const x = a[0] + ux * t;
      const y = a[1] + uy * t;
      const base = alturaBase(x, y);
      m.makeTranslation(x, base + (altura - 0.05) / 2, -y);
      inst.setMatrixAt(i, m);
    }
    inst.castShadow = true;
    g.add(inst);
    // corrimão: segmentos a acompanhar a base (rampas)
    const seg = 6;
    for (let i = 0; i < seg; i++) {
      const t0 = (L * i) / seg;
      const t1 = (L * (i + 1)) / seg;
      const pA = [a[0] + ux * t0, a[1] + uy * t0];
      const pB = [a[0] + ux * t1, a[1] + uy * t1];
      const hA = alturaBase(pA[0], pA[1]) + altura;
      const hB = alturaBase(pB[0], pB[1]) + altura;
      const corrimao = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(t1 - t0, hB - hA), 0.05, 0.07), matCorrimao);
      corrimao.position.copy(V((pA[0] + pB[0]) / 2, (hA + hB) / 2 - 0.025, (pA[1] + pB[1]) / 2));
      corrimao.rotation.y = Math.atan2(uy, ux);
      corrimao.rotation.z = Math.atan2(hB - hA, t1 - t0);
      corrimao.castShadow = true;
      g.add(corrimao);
    }
    // prumos nas pontas
    for (const p of [a, b]) {
      const base = alturaBase(p[0], p[1]);
      const prumo = new THREE.Mesh(new THREE.BoxGeometry(0.08, altura, 0.08), matCorrimao);
      prumo.position.copy(V(p[0], base + altura / 2, p[1]));
      g.add(prumo);
    }
    const base0 = alturaBase(a[0], a[1]);
    const base1 = alturaBase(b[0], b[1]);
    this.addColisorSegmento(a, b, 0.08, Math.min(base0, base1), Math.max(base0, base1) + altura);
  }

  // ---------- divisória de vidro com caixilho preto
  construirDivisoriaVidro(a, b, h0, h1, g) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 0.2) return;
    const grupo = new THREE.Group();
    grupo.position.copy(V((a[0] + b[0]) / 2, h0, (a[1] + b[1]) / 2));
    grupo.rotation.y = Math.atan2(dy, dx);
    g.add(grupo);
    const H = h1 - h0;
    const preto = material('caixilho');
    const barra = (cx, cy, w, h) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), preto);
      m.position.set(cx, cy, 0);
      grupo.add(m);
    };
    barra(0, H - 0.03, L, 0.06);
    barra(0, 0.03, L, 0.06);
    const nH = Math.max(1, Math.round(L / 0.6));
    for (let i = 0; i <= nH; i++) barra(-L / 2 + (L / nH) * i, H / 2, 0.04, H);
    const nV = Math.max(1, Math.round(H / 0.6));
    for (let i = 1; i < nV; i++) barra(0, (H / nV) * i, L, 0.025);
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(L, H), material('vidro'));
    vidro.position.set(0, H / 2, 0);
    grupo.add(vidro);
    this.addColisorSegmento(a, b, 0.05, h0, h1);
  }

  // ---------- escadas
  construirEscada(esc) {
    const g = new THREE.Group();
    g.name = esc.id;
    this.grupo.add(g);
    const madeira = material(esc.material || 'marcenaria_madeira');
    const branco = material(esc.materialEspelho || 'marcenaria_branca');
    const alturas = [];
    for (const l of esc.lances) {
      if (l.patamar) {
        const [[x0, y0], [x1, y1]] = l.patamar;
        const poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        g.add(laje(poly, [], l.z - 0.2, 0.2, madeira, branco));
        this.superficies.push({ poly, furos: [], nivel: l.z });
        alturas.push((x, y) => (x >= x0 - 0.02 && x <= x1 + 0.02 && y >= y0 - 0.02 && y <= y1 + 0.02 ? l.z : null));
        continue;
      }
      const dx = l.para[0] - l.de[0];
      const dy = l.para[1] - l.de[1];
      const L = Math.hypot(dx, dy);
      const ux = dx / L;
      const uy = dy / L;
      const nx = -uy;
      const ny = ux;
      const n = l.degraus || 1;
      const tread = L / n;
      const riser = (l.z1 - l.z0) / n;
      if (l.degraus) {
        const espLaje = 0.18;
        for (let i = 0; i < n; i++) {
          const t0 = tread * i;
          const t1 = tread * (i + 1);
          const topoDegrau = riser > 0 ? l.z0 + riser * (i + 1) : l.z0 + riser * i;
          const p0 = [l.de[0] + ux * t0, l.de[1] + uy * t0];
          const p1 = [l.de[0] + ux * t1, l.de[1] + uy * t1];
          g.add(caixaEntre(p0, p1, l.largura, topoDegrau - Math.abs(riser) - 0.02, topoDegrau, [madeira, madeira, madeira, madeira, branco, branco]));
        }
        // laje inclinada por baixo dos degraus (soffit)
        const compr = Math.hypot(L, l.z1 - l.z0);
        const geo = uvsEmMetros(new THREE.BoxGeometry(compr, espLaje, l.largura), compr, espLaje, l.largura);
        const soffit = new THREE.Mesh(geo, material('parede_branca'));
        const zc = (l.z0 + l.z1) / 2 - Math.abs(riser) - espLaje / 2 - 0.02;
        soffit.position.copy(V((l.de[0] + l.para[0]) / 2, zc, (l.de[1] + l.para[1]) / 2));
        soffit.rotation.y = Math.atan2(uy, ux);
        soffit.rotation.z = Math.atan2(l.z1 - l.z0, L);
        soffit.castShadow = true;
        soffit.receiveShadow = true;
        g.add(soffit);
      } else {
        // rampa contínua (sem degraus)
        const geo = uvsEmMetros(new THREE.BoxGeometry(Math.hypot(L, l.z1 - l.z0), 0.2, l.largura), L, 0.2, l.largura);
        const m = new THREE.Mesh(geo, material(l.material || 'cimento'));
        m.position.copy(V((l.de[0] + l.para[0]) / 2, (l.z0 + l.z1) / 2 - 0.1, (l.de[1] + l.para[1]) / 2));
        m.rotation.y = Math.atan2(uy, ux);
        m.rotation.z = Math.atan2(l.z1 - l.z0, L);
        m.receiveShadow = true;
        g.add(m);
      }
      const meia = l.largura / 2;
      alturas.push((x, y) => {
        const rx = x - l.de[0];
        const ry = y - l.de[1];
        const t = rx * ux + ry * uy;
        const s = rx * nx + ry * ny;
        if (t < -0.05 || t > L + 0.05 || Math.abs(s) > meia + 0.03) return null;
        const k = Math.min(1, Math.max(0, t / L));
        return l.z0 + (l.z1 - l.z0) * k;
      });
      // paredes laterais invisíveis? não — deixamos as guardas fazerem o bloqueio
    }
    const alturaEscada = (x, y) => {
      let melhor = null;
      for (const f of alturas) {
        const h = f(x, y);
        if (h !== null && (melhor === null || h > melhor)) melhor = h;
      }
      return melhor;
    };
    this.rampas.push(alturaEscada);
    for (const gd of esc.guardas || []) {
      const base = gd.z === 'rampa' ? (x, y) => alturaEscada(x, y) ?? 0 : () => gd.z;
      this.construirGuarda(gd.a, gd.b, gd.altura, base, g);
    }
  }

  // ---------- exterior: terreno, plinto, rampa, telhado, varandas
  construirExterior() {
    const g = new THREE.Group();
    g.name = 'exterior';
    this.grupo.add(g);
    const base = [[0.35, -4.43], [9.09, -4.43], [9.09, 17.7], [0, 17.7], [0, 8.725], [0.35, 8.725]];
    const rampa = [[0.56, -9.9], [4.57, -9.9], [4.57, -4.43], [0.56, -4.43]];
    this.base = base;
    this.rampaPoly = rampa;
    // terreno (lote) com buracos para a casa e a rampa
    const lote = [[-1.65, -9.9], [10.85, -9.9], [10.85, 26.1], [-1.65, 26.1]];
    g.add(superficie(lote, [base, rampa], 0, material('grama')));
    // rua e vizinhança
    const envolvente = superficie([[-60, -60], [70, -60], [70, 90], [-60, 90]], [lote], -0.01, new THREE.MeshStandardMaterial({ color: '#7d8a6a', roughness: 1 }));
    g.add(envolvente);
    const asfalto = new THREE.Mesh(new THREE.PlaneGeometry(60, 8), new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.9 }));
    asfalto.rotation.x = -Math.PI / 2;
    asfalto.position.set(4.6, -0.01, 15.5);
    g.add(asfalto);
    // calçada de entrada (lado leste) e caminho
    g.add(superficie([[4.9, -9.9], [9.09, -9.9], [9.09, -6.6], [4.9, -6.6]], [], 0.005, material('cimento')));
    // rampa da garagem (desce de 0 a -1.05)
    this.construirEscada({ id: 'rampa-garagem', lances: [{ de: [2.565, -9.9], para: [2.565, -4.43], largura: 4.0, z0: 0, z1: -1.05, degraus: 0, material: 'cimento' }], guardas: [] });
    for (const x of [0.56, 4.57]) {
      const muro = caixaEntre([x, -9.9], [x, -4.43], 0.2, -1.2, 0.0, material('cimento_parede'), 0);
      g.add(muro);
      this.addColisorSegmento([x, -9.9], [x, -4.43], 0.2, -1.2, 0.5);
    }
    // escada de entrada (8 degraus até à varanda)
    this.construirEscada({ id: 'escada-entrada', material: 'porcelanato_cinza', materialEspelho: 'cimento_parede', lances: [{ de: [7.0, -6.83], para: [7.0, -4.43], largura: 2.4, z0: 0, z1: 1.45, degraus: 8 }], guardas: [] });
    // plinto (base da casa até ao nível do térreo), onde não há parede do subsolo
    const plinto = material('parede_branca');
    const segs = [
      [[7.79, -4.43], [9.09, -4.43]],
      [[9.09, -4.43], [9.09, 17.7]],
      [[9.09, 17.7], [0, 17.7]],
      [[0, 17.7], [0, 8.725]],
      [[0, 8.725], [0.35, 8.725]],
      [[0.35, 8.725], [0.35, 7.235]],
    ];
    for (const [a, b] of segs) {
      g.add(caixaEntre(a, b, 0.3, -0.3, 1.45, plinto, 0.15));
      this.addColisorSegmento(a, b, 0.3, -0.3, 1.45);
    }
    // guarda no bordo da rampa/varanda da frente já vem dos vidros extraídos (guarda_corpo)
    // varandas: cobertura + colunas
    const branco = material('marcenaria_branca');
    for (const [poly, cols] of [
      [[[0.35, -4.6], [9.09, -4.6], [9.09, -2.75], [0.35, -2.75]], [[0.6, -4.35], [3.2, -4.35], [6.1, -4.35], [8.85, -4.35]]],
      [[[0, 15.5], [9.09, 15.5], [9.09, 17.7], [0, 17.7]], [[0.25, 17.45], [3.2, 17.45], [6.1, 17.45], [8.85, 17.45]]],
    ]) {
      const cobertura = laje(poly, [], 4.3, 0.15, material('parede_creme'), material('parede_creme'));
      cobertura.userData.tipo = 'telhado';
      g.add(cobertura);
      for (const c of cols) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.3 - 1.45, 0.2), branco);
        col.position.copy(V(c[0], 1.45 + (4.3 - 1.45) / 2, c[1]));
        col.castShadow = true;
        g.add(col);
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.05, 0.34), material('pedra'));
        base.position.copy(V(c[0], 1.45 + 0.52, c[1]));
        base.castShadow = true;
        g.add(base);
        const capitel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), branco);
        capitel.position.copy(V(c[0], 4.26, c[1]));
        g.add(capitel);
        this.addColisorCaixa(c[0], c[1], 0.09, 0.09, 0, 1.4, 4.3);
      }
    }
    // muros do lote
    const muro = material('parede_creme');
    for (const [a, b, h] of [
      [[-1.65, -9.9], [-1.65, 26.1], 2.0],
      [[10.85, -9.9], [10.85, 26.1], 2.0],
      [[-1.65, 26.1], [10.85, 26.1], 2.0],
      [[-1.65, -9.9], [0.4, -9.9], 0.6],
      [[4.75, -9.9], [10.85, -9.9], 0.6],
    ]) {
      g.add(caixaEntre(a, b, 0.2, 0, h, muro));
      this.addColisorSegmento(a, b, 0.2, -1.5, h);
    }
    // gradil da frente
    this.construirGuarda([-1.65, -9.9], [0.4, -9.9], 1.4, () => 0.6, g, 'preto');
    this.construirGuarda([4.75, -9.9], [10.85, -9.9], 1.4, () => 0.6, g, 'preto');
    // telhado (duas águas, telha shingle escura) sobre o pavimento superior
    const telha = new THREE.MeshStandardMaterial({ color: '#3b3a38', roughness: 0.95 });
    const xW = 0.55 - 0.75; // beirais simétricos de 0,75 m
    const xE = 8.585 + 0.75;
    const cumeeira = (xW + xE) / 2;
    const yS = -3.7;
    const yN = 16.2;
    const hBeiral = 7.3;
    const hCume = hBeiral + ((xE - xW) / 2) * 0.23;
    for (const [x0, x1] of [[xW, cumeeira], [cumeeira, xE]]) {
      const largura = Math.hypot(x1 - x0, hCume - hBeiral);
      const agua = new THREE.Mesh(new THREE.BoxGeometry(largura, 0.12, yN - yS), telha);
      const hx = (x0 + x1) / 2;
      agua.position.copy(V(hx, (hBeiral + hCume) / 2, (yS + yN) / 2));
      agua.rotation.z = (x0 < cumeeira ? 1 : -1) * Math.atan2(hCume - hBeiral, (xE - xW) / 2);
      agua.castShadow = true;
      agua.receiveShadow = true;
      agua.userData.tipo = 'telhado';
      g.add(agua);
    }
    // oitões (triângulos brancos) nas extremidades
    for (const y of [-3.195, 15.5]) {
      const tri = new THREE.Shape([new THREE.Vector2(0.55, hBeiral - 0.05), new THREE.Vector2(8.585, hBeiral - 0.05), new THREE.Vector2(cumeeira, hCume - 0.05)]);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), material('parede_branca'));
      m.material = material('parede_branca').clone();
      m.material.side = THREE.DoubleSide;
      m.position.z = -y;
      m.userData.tipo = 'telhado';
      g.add(m);
    }
    // vegetação: árvores com copa em cachos e sebes ao longo dos muros
    const tronco = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 1 });
    const copas = ['#3e5a30', '#4a6a38', '#365229', '#55703f'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    let semente = 7;
    const rnd = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (const [x, y, r] of [[-0.6, 21, 1.4], [3.5, 23.5, 1.8], [8.5, 21.5, 1.3], [10.2, 6, 1.1], [10.2, 12, 1.1], [-1.0, 12.5, 1.0], [-1.0, 3, 1.0], [-14, 8, 2.2], [20, 10, 2.4], [6, 34, 2.6], [-8, 30, 2.0]]) {
      const alt = r * 1.6;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.13, alt, 8), tronco);
      t.position.copy(V(x, alt / 2, y));
      t.castShadow = true;
      g.add(t);
      for (let k = 0; k < 7; k++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * r * 0.55;
        const rr = r * (0.45 + rnd() * 0.35);
        const c = new THREE.Mesh(new THREE.SphereGeometry(rr, 9, 7), copas[k % copas.length]);
        c.position.copy(V(x + Math.cos(a) * d, alt + rr * 0.4 + rnd() * r * 0.8, y + Math.sin(a) * d));
        c.castShadow = true;
        g.add(c);
      }
      this.addColisorCaixa(x, y, 0.2, 0.2, 0, -1, 3);
    }
    // sebes junto aos muros laterais e do fundo
    const sebe = new THREE.MeshStandardMaterial({ color: '#3f5a32', roughness: 1 });
    for (const [a, b] of [[[-1.35, -6], [-1.35, 25.8]], [[10.55, -6], [10.55, 25.8]], [[-1.4, 25.8], [10.5, 25.8]]]) {
      const s = caixaEntre(a, b, 0.5, 0, 1.6, sebe);
      s.castShadow = true;
      g.add(s);
    }
  }

  // ---------- altura do chão para o jogador
  alturaChao(x, y, yAtual) {
    const cands = [];
    for (const s of this.superficies) {
      if (dentroDe([x, y], s.poly) && !s.furos.some((f) => dentroDe([x, y], f))) cands.push(s.nivel);
    }
    for (const r of this.rampas) {
      const h = r(x, y);
      if (h !== null && h !== undefined) cands.push(h);
    }
    if (this.base && !dentroDe([x, y], this.base) && !dentroDe([x, y], this.rampaPoly)) cands.push(0);
    if (!cands.length) return -1.05;
    const ok = cands.filter((h) => h <= yAtual + 0.45);
    if (ok.length) return Math.max(...ok);
    return Math.min(...cands);
  }
}
