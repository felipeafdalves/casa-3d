// HUD: ambiente atual, mini-mapa do pavimento, lista de teleporte.
import { ambienteEm } from './modelo.js';

export class Interface {
  constructor(modelo, jogador, construtor) {
    this.modelo = modelo;
    this.jogador = jogador;
    this.construtor = construtor;
    this.elAmbiente = document.getElementById('ambiente-atual');
    this.mapa = document.getElementById('minimapa');
    this.ctx = this.mapa.getContext('2d');
    this.mapaVisivel = true;
    this.teleporte = document.getElementById('teleporte');
    this.montarTeleporte();
    this.ultimoNome = '';
  }

  pavimentoAtual() {
    const y = this.jogador.pos.y;
    let melhor = this.modelo.pavimentos[0];
    for (const p of this.modelo.pavimentos) if (p.nivel <= y + 0.6) melhor = p;
    return melhor;
  }

  atualizar() {
    const pav = this.pavimentoAtual();
    const p = this.jogador.plano;
    const y = this.jogador.pos.y;
    let nome;
    const naEscada = Math.abs(y - pav.nivel) > 0.3;
    if (naEscada) nome = 'Escada';
    else {
      const amb = ambienteEm(pav, p);
      const fora = !amb || !this.construtor.superficies.some((s) => s.nivel === pav.nivel && dentroPoly(p, s.poly));
      nome = fora ? this.nomeExterior(pav, p) : amb.nome;
    }
    const texto = `${nome} · ${pav.nome}`;
    if (texto !== this.ultimoNome) {
      this.elAmbiente.textContent = texto;
      this.ultimoNome = texto;
    }
    if (this.mapaVisivel) this.desenharMapa(pav);
  }

  nomeExterior(pav, p) {
    for (const ex of pav.piso.exteriores) if (dentroPoly(p, ex.poligono)) return ex.nome;
    return 'Exterior';
  }

  desenharMapa(pav) {
    const ctx = this.ctx;
    const W = this.mapa.width;
    const H = this.mapa.height;
    ctx.clearRect(0, 0, W, H);
    // planta rodada: eixo y da planta → horizontal
    const ymin = -10;
    const ymax = 19;
    const xmin = -1;
    const xmax = 10;
    const esc = Math.min((W - 16) / (ymax - ymin), (H - 16) / (xmax - xmin));
    const u = (pt) => 8 + (pt[1] - ymin) * esc;
    const v = (pt) => H - 8 - (pt[0] - xmin) * esc;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(244,239,230,0.9)';
    ctx.beginPath();
    for (const w of pav.paredes) {
      ctx.moveTo(u(w.a), v(w.a));
      ctx.lineTo(u(w.b), v(w.b));
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(140,200,255,0.8)';
    ctx.beginPath();
    for (const o of pav.vaos) {
      ctx.moveTo(u(o.a), v(o.a));
      ctx.lineTo(u(o.b), v(o.b));
    }
    ctx.stroke();
    // jogador
    const p = this.jogador.plano;
    const yaw = this.jogador.yaw;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(u(p), v(p), 4, 0, Math.PI * 2);
    ctx.fill();
    // direção: frente no plano = (-sin yaw, cos yaw)
    const fx = -Math.sin(yaw);
    const fy = Math.cos(yaw);
    ctx.strokeStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(u(p), v(p));
    ctx.lineTo(u([p[0] + fx * 1.2, p[1] + fy * 1.2]), v([p[0] + fx * 1.2, p[1] + fy * 1.2]));
    ctx.stroke();
    ctx.fillStyle = 'rgba(244,239,230,0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText(pav.nome.toUpperCase(), 10, 12);
  }

  alternarMapa() {
    this.mapaVisivel = !this.mapaVisivel;
    this.mapa.hidden = !this.mapaVisivel;
  }

  montarTeleporte() {
    const lista = document.getElementById('lista-ambientes');
    lista.innerHTML = '';
    for (const pav of this.modelo.pavimentos) {
      const grupo = document.createElement('div');
      grupo.className = 'grupo';
      grupo.textContent = pav.nome.toUpperCase();
      lista.appendChild(grupo);
      const vistos = new Set();
      for (const amb of pav.ambientes) {
        if (vistos.has(amb.nome)) continue;
        vistos.add(amb.nome);
        const b = document.createElement('button');
        b.textContent = amb.nome;
        b.addEventListener('click', () => {
          const p = amb.poligono ? centro(amb.poligono) : amb.seed;
          this.jogador.teleportar(p[0], p[1], pav.nivel);
          this.fecharTeleporte();
          this.jogador.entrar();
        });
        lista.appendChild(b);
      }
      for (const ex of pav.piso.exteriores) {
        const b = document.createElement('button');
        b.textContent = ex.nome;
        b.addEventListener('click', () => {
          const p = centro(ex.poligono);
          this.jogador.teleportar(p[0], p[1], ex.nivel);
          this.fecharTeleporte();
          this.jogador.entrar();
        });
        lista.appendChild(b);
      }
    }
  }

  alternarTeleporte() {
    if (this.teleporte.hidden) {
      this.teleporte.hidden = false;
      document.exitPointerLock?.();
    } else this.fecharTeleporte();
  }

  fecharTeleporte() {
    this.teleporte.hidden = true;
  }
}

function centro(poly) {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

function dentroPoly(p, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
