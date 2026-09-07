// Junta a geometria extraída do DWG (casa.gerada.json) com os ajustes manuais (casa.ajustes.js)
// e devolve um modelo normalizado em coordenadas globais (metros, x→leste, y→norte).
import gerada from './casa.gerada.json';
import { ajustes } from './casa.ajustes.js';

const perto = (p, q, tol) => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol;
const meio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function desloca(p, d) {
  return [Math.round((p[0] + d[0]) * 1000) / 1000, Math.round((p[1] + d[1]) * 1000) / 1000];
}

/** Ponto dentro de polígono (ray casting). */
export function dentroDe(p, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const cruza = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/**
 * Os vãos extraídos do DWG são intervalos vazios entre segmentos colineares de parede.
 * Para construir a parede com a abertura, fundimos os segmentos de cada lado do vão
 * num único segmento que o atravessa (ou criamos um segmento só para o vão).
 */
function fundirParedesAtravesDosVaos(paredes, vaos) {
  const lista = paredes.map((w) => ({ ...w }));
  const colinear = (w, v) => {
    const wx = w.b[0] - w.a[0];
    const wy = w.b[1] - w.a[1];
    const vx = v.b[0] - v.a[0];
    const vy = v.b[1] - v.a[1];
    const lw = Math.hypot(wx, wy) || 1;
    const lv = Math.hypot(vx, vy) || 1;
    if (Math.abs((wx * vx + wy * vy) / (lw * lv)) < 0.98) return false;
    // distância do meio do vão à reta da parede
    const mx = (v.a[0] + v.b[0]) / 2 - w.a[0];
    const my = (v.a[1] + v.b[1]) / 2 - w.a[1];
    return Math.abs((mx * wy - my * wx) / lw) < 0.06;
  };
  for (const v of vaos) {
    const tocam = (w, p) => perto(w.a, p, 0.08) || perto(w.b, p, 0.08);
    const cands = lista.filter((w) => colinear(w, v) && (tocam(w, v.a) || tocam(w, v.b)));
    let esp = v.esp || 0.17;
    if (cands.length === 0) {
      lista.push({ a: v.a, b: v.b, esp });
      continue;
    }
    // extremos mais afastados ao longo do eixo do vão
    const ux = v.b[0] - v.a[0];
    const uy = v.b[1] - v.a[1];
    const L = Math.hypot(ux, uy) || 1;
    const proj = (p) => ((p[0] - v.a[0]) * ux + (p[1] - v.a[1]) * uy) / L;
    let tMin = 0;
    let tMax = L;
    let material;
    for (const w of cands) {
      for (const p of [w.a, w.b]) {
        tMin = Math.min(tMin, proj(p));
        tMax = Math.max(tMax, proj(p));
      }
      esp = w.esp;
      material = material || w.material;
      lista.splice(lista.indexOf(w), 1);
    }
    lista.push({
      a: [v.a[0] + (ux / L) * tMin, v.a[1] + (uy / L) * tMin],
      b: [v.a[0] + (ux / L) * tMax, v.a[1] + (uy / L) * tMax],
      esp,
      material,
    });
  }
  return lista;
}

export function construirModelo() {
  const pavimentos = gerada.pavimentos.map((pav) => {
    const d = ajustes.deslocamentos[pav.id] || [0, 0];
    const aj = ajustes.ambientes[pav.id] || {};
    const pisoAj = ajustes.pisos[pav.id] || {};

    // paredes
    let paredes = pav.paredes.map((w) => ({ a: desloca(w.a, d), b: desloca(w.b, d), esp: w.esp }));
    paredes = paredes.concat(ajustes.paredesExtra[pav.id] || []);

    // vãos
    const remover = ajustes.vaosRemover[pav.id] || [];
    let vaos = pav.vaos
      .map((v) => ({ ...v, a: desloca(v.a, d), b: desloca(v.b, d) }))
      .filter((v) => !remover.some((r) => perto(meio(v.a, v.b), r, 0.35)));
    vaos = vaos.concat(ajustes.vaosExtra[pav.id] || []);
    paredes = fundirParedesAtravesDosVaos(paredes, vaos);
    for (const h of ajustes.alturasParede?.[pav.id] || []) {
      for (const w of paredes) if (perto(meio(w.a, w.b), h.perto, 0.3)) w.topo = h.topo;
    }

    // vidros / guarda-corpos
    const ignorar = ajustes.vidrosIgnorar[pav.id] || [];
    const vidros = pav.vidros
      .map((v) => ({ ...v, a: desloca(v.a, d), b: desloca(v.b, d) }))
      .filter((v) => !ignorar.some((r) => perto(meio(v.a, v.b), r, 0.12)))
      // remove linhas duplicadas (faces paralelas a < 8 cm)
      .filter((v, i, arr) => !arr.slice(0, i).some((u) => u.tipo === v.tipo && perto(meio(u.a, u.b), meio(v.a, v.b), 0.08)));

    // ambientes
    const ambientes = pav.ambientes
      .filter((a) => !['Subsolo', 'Vazio Mezanino'].includes(a.nome))
      .map((a) => {
        const seed = desloca(a.seed, d);
        const chaveSeed = `${a.nome}@${seed[0].toFixed(2)},${seed[1].toFixed(2)}`;
        // ajuste por nome exato, por nome@x,y (aproximado) ou por nome
        let cfg = aj[a.nome];
        for (const k of Object.keys(aj)) {
          if (k.includes('@')) {
            const [nome, xy] = k.split('@');
            const [x, y] = xy.split(',').map(Number);
            if (nome === a.nome && perto(seed, [x, y], 0.3)) cfg = aj[k];
          }
        }
        cfg = cfg || {};
        return {
          nome: cfg.nome || a.nome,
          chave: chaveSeed,
          seed,
          areaProjeto: a.areaProjeto,
          poligono: cfg.poligono || (a.poligono ? a.poligono.map((p) => desloca(p, d)) : null),
          piso: cfg.piso || pisoAj.material || 'madeira_escura',
          parede: cfg.parede || 'parede_branca',
          lambri: !!cfg.lambri,
          teto: cfg.teto, // material de teto próprio do ambiente (ex.: shiplap na garagem)
          semCortinas: !!cfg.semCortinas,
          lambriTipo: cfg.lambriTipo,
          lambriMaterial: cfg.lambriMaterial,
          lambriAltura: cfg.lambriAltura,
          boiserie: !!cfg.boiserie,
          paredesPorLado: cfg.paredesPorLado,
        };
      });

    return {
      id: pav.id,
      nome: pav.nome,
      nivel: pav.nivel,
      peDireito: pav.peDireito,
      paredes,
      vaos,
      vidros,
      ambientes,
      piso: {
        material: pisoAj.material || 'madeira_escura',
        poligono: pisoAj.poligono,
        teto: pisoAj.teto,
        furos: pisoAj.furos || [],
        exteriores: pisoAj.exteriores || [],
      },
      vazios: ajustes.vazios[pav.id] || [],
    };
  });

  return {
    laje: ajustes.laje,
    pavimentos,
    escadas: ajustes.escadas,
    mobiliario: ajustes.mobiliario,
    luzes: ajustes.luzes,
    spawn: ajustes.spawn,
    porId: Object.fromEntries(pavimentos.map((p) => [p.id, p])),
  };
}

/** Devolve o ambiente em que um ponto está (polígono) ou o mais próximo pelo seed. */
export function ambienteEm(pav, p) {
  for (const a of pav.ambientes) if (a.poligono && dentroDe(p, a.poligono)) return a;
  let melhor = null;
  let dist = 6;
  for (const a of pav.ambientes) {
    const dd = Math.hypot(a.seed[0] - p[0], a.seed[1] - p[1]);
    if (dd < dist) {
      dist = dd;
      melhor = a;
    }
  }
  return melhor;
}
