// Tira capturas de ecrã de vários pontos da casa (verificação visual sem GPU).
// Uso: node tools/capturas.mjs [pasta-saida]   (requer `npm run build` antes)
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve('dist');
const saida = process.argv[2] || 'capturas';
mkdirSync(saida, { recursive: true });

const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const servidor = createServer(async (req, res) => {
  let f = path.join(raiz, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  try {
    const dados = await readFile(f);
    res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' });
    res.end(dados);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;

const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('ERRO NA PÁGINA:', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
await page.goto(`http://127.0.0.1:${porta}/?qualidade=${process.env.QUALIDADE || 0}`);
page.setDefaultTimeout(120000);
await page.waitForFunction(() => document.getElementById('botao-entrar') && !document.getElementById('botao-entrar').disabled, null, { timeout: 120000 });
await page.evaluate(() => { document.getElementById('tela-inicial').hidden = true; });

const vistas = [
  ['frente', 4.6, -9.0, 0.0, 0, 0.05],
  ['varanda-frente', 4.5, -3.8, 1.45, 0, 0],
  ['hall', 2.2, -2.3, 1.5, 0, 0],
  ['brinquedoteca', 6.2, -2.3, 1.5, -0.7, 0],
  ['sala-estar', 4.6, 3.3, 1.5, -0.5, 0.05],
  ['sala-para-lareira', 5.2, 6.5, 1.5, -1.5, 0.1],
  ['jantar-cozinha', 4.3, 9.2, 1.5, -0.3, 0.05],
  ['cozinha', 7.5, 12.5, 1.5, 1.7, 0.05],
  ['lavanderia', 0.9, 9.4, 1.5, 0, 0],
  ['suite-hospedes', 2.8, 2.2, 1.5, 0, 0],
  ['escada', 3.6, 8.0, 1.5, 1.5, 0.1],
  ['superior-circulacao', 4.7, 1.0, 4.47, 0, 0],
  ['escritorio', 4.6, -0.5, 4.47, 2.6, 0],
  ['suite-filho', 2.4, 2.2, 4.47, 0, 0],
  ['suite-master', 3.0, 11.0, 4.47, 0, 0],
  ['mezanino', 4.7, 7.5, 4.47, -1.2, 0.35],
  ['garagem', 4.0, -3.5, -1.05, 0, 0],
  ['bar', 4.2, 3.6, -1.05, 0, 0],
  ['fundos', 4.5, 21, 0, Math.PI, 0.15],
];
const filtro = process.env.VISTAS ? process.env.VISTAS.split(',') : null;
for (const [nome, x, y, nivel, yaw, pitch] of vistas) {
  if (filtro && !filtro.includes(nome)) continue;
  await page.evaluate(([x, y, nivel, yaw, pitch]) => {
    const j = window.__casa.jogador;
    j.teleportar(x, y, nivel, yaw);
    j.pitch = pitch;
    j.atualizarCamera();
  }, [x, y, nivel, yaw, pitch]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(saida, `${nome}.png`) });
  console.log('captura', nome);
}
// vistas de topo por pavimento (auditoria das divisões)
const soVistas = !!process.env.SO_VISTAS;
for (const [pav, nivel, ymin, ymax] of (soVistas ? [] :  [['subsolo', -1.05, -10, 8], ['terreo', 1.5, -6, 19], ['superior', 4.47, -5, 18]])) {
  await page.evaluate(([pav, nivel, ymin, ymax]) => {
    const T = window.__casa.THREE;
    const { scene, renderer, modelo } = window.__casa;
    const ordem = modelo.pavimentos.map((p) => p.id);
    const acima = ordem.slice(ordem.indexOf(pav) + 1);
    scene.traverse((o) => {
      if (o.userData.tipo === 'teto' || o.userData.tipo === 'telhado') o.visible = o.userData.tipo === 'teto' && !(o.parent && o.parent.name === pav) && !acima.includes(o.parent?.name);
      if (acima.includes(o.name) || acima.includes(o.userData.pav)) o.visible = false;
    });
    // olhar de cima: x da planta → vertical do ecrã (este em cima), y da planta → horizontal (norte à esquerda)
    const larg = ymax - ymin;
    const alt = (larg * 720) / 1280;
    const cam = new T.OrthographicCamera(-larg / 2, larg / 2, alt / 2, -alt / 2, 0.1, 100);
    cam.position.set(4.5, nivel + 20, -(ymin + ymax) / 2);
    cam.up.set(1, 0, 0);
    cam.lookAt(4.5, nivel, -(ymin + ymax) / 2);
    cam.updateProjectionMatrix();
    window.__casa.cameraOverride = cam;
  }, [pav, nivel, ymin, ymax]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(saida, `planta-${pav}.png`) });
  await page.evaluate(() => { window.__casa.cameraOverride = null; window.__casa.scene.traverse((o) => { o.visible = true; }); });
  console.log('planta', pav);
}
if (!soVistas) {
// noite
await page.keyboard.press('KeyL');
await page.evaluate(() => { const j = window.__casa.jogador; j.teleportar(5.2, 6.5, 1.5, -1.5); j.pitch = 0.1; j.atualizarCamera(); });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(saida, 'sala-noite.png') });
// ---- testes de movimento: subir a escada e bater numa parede
async function andar(x, y, nivel, yaw, segundos) {
  return page.evaluate(async ([x, y, nivel, yaw, segundos]) => {
    const j = window.__casa.jogador;
    j.teleportar(x, y, nivel, yaw);
    j.ativo = true;
    j.teclas.KeyW = true;
    for (let i = 0; i < segundos * 60; i++) j.atualizar(1 / 60); // simulação determinística a 60 Hz
    j.teclas.KeyW = false;
    j.ativo = false;
    return { x: +j.pos.x.toFixed(2), y: +(-j.pos.z).toFixed(2), altura: +j.pos.y.toFixed(2) };
  }, [x, y, nivel, yaw, segundos]);
}
const subida = await andar(4.1, 8.0, 1.5, Math.PI / 2, 2.5); // para oeste, ao longo do 1.º lance
console.log('escada 1.º lance →', subida, subida.altura > 2.7 ? 'OK subiu' : 'FALHOU');
const parede = await andar(2.2, -1.5, 1.5, Math.PI / 2, 2.0); // para oeste contra a parede do hall
console.log('parede do hall →', parede, parede.x > 0.6 ? 'OK bloqueou' : 'FALHOU');
const portaFechada = await andar(2.9, -4.0, 1.45, 0, 2.5); // para norte, porta da frente fechada
console.log("porta fechada →", portaFechada, portaFechada.y < -2.6 ? 'OK bloqueou' : 'FALHOU');
await page.evaluate(() => { const p = window.__casa.construtor.portas.find((d) => Math.abs(d.pos[0] - 2.9) < 0.2 && Math.abs(d.pos[1] + 2.75) < 0.2); if (p) p.aberta = true; });
await page.waitForTimeout(800);
const portaAberta = await andar(2.9, -4.0, 1.45, 0, 2.5);
console.log("porta aberta →", portaAberta, portaAberta.y > -2.6 ? 'OK passou' : 'FALHOU');
const descida = await andar(3.9, 6.6, 1.5, Math.PI / 2, 2.5); // para oeste, descendo para o subsolo
console.log('escada subsolo →', descida, descida.altura < 0.5 ? 'OK desceu' : 'FALHOU');
}

// ---- auditoria automática do mobiliário: peças a atravessar paredes, a invadir outro ambiente ou umas dentro das outras
const auditoria = await page.evaluate(() => {
  const { pecas, nColisoresBase, construtor, modelo, ambienteEm } = window.__casa;
  const cantos = (c, folga = 0) => {
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    const hx = Math.max(0.01, c.hx - folga), hy = Math.max(0.01, c.hy - folga);
    return [[hx, hy], [-hx, hy], [-hx, -hy], [hx, -hy]].map(([x, y]) => [c.cx + x * cs - y * sn, c.cy + x * sn + y * cs]);
  };
  const eixos = (c) => [[Math.cos(c.rot), Math.sin(c.rot)], [-Math.sin(c.rot), Math.cos(c.rot)]];
  const sobrepoe = (a, b, folga) => {
    if (a.y1 <= b.y0 + 0.1 || b.y1 <= a.y0 + 0.1) return false;
    const ca = cantos(a, folga), cb = cantos(b, folga);
    for (const [ex, ey] of [...eixos(a), ...eixos(b)]) {
      const pa = ca.map(([x, y]) => x * ex + y * ey), pb = cb.map(([x, y]) => x * ex + y * ey);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
    return true;
  };
  const paredes = construtor.colisores.slice(0, nColisoresBase);
  const problemas = [];
  const nomePeca = (p) => `${p.item.tipo}@${p.item.pos[0]},${p.item.pos[1]} (${p.item.pav})`;
  pecas.forEach((p, i) => {
    if (['box', 'tapete', 'tapete_redondo'].includes(p.item.tipo)) return; // linhas de vidro e tapetes não bloqueiam
    const pav = modelo.porId[p.item.pav];
    const centro = ambienteEm(pav, p.item.pos);
    for (const c of p.colisores) {
      // (a) cantos noutro ambiente que não o do centro da peça (a peça atravessa uma parede/divisão)
      const abertos = ['Sala de estar', 'Cozinha e sala de jantar']; // planta aberta: a divisão entre eles é virtual
      const fora = cantos(c, 0.08).map((q) => ambienteEm(pav, q)).filter((a) => a && centro && a.nome !== centro.nome && !(abertos.includes(a.nome) && abertos.includes(centro.nome)));
      if (fora.length) problemas.push(`${nomePeca(p)}: em "${centro?.nome}" mas ${fora.length} canto(s) em "${fora[0].nome}"`);
      // (b) atravessa uma parede/guarda (só até 1,2 m acima do piso: ignora vigas e lustres)
      const cc = { ...c, y1: Math.min(c.y1, c.y0 + 1.2) };
      const par = paredes.find((w) => w.hy < 0.35 && sobrepoe(cc, w, 0.06));
      if (par) problemas.push(`${nomePeca(p)}: atravessa parede em (${par.cx.toFixed(2)}, ${par.cy.toFixed(2)})`);
      // (c) sobreposição com outra peça
      pecas.slice(i + 1).forEach((q) => {
        if (q.item.pav !== p.item.pav) return;
        for (const d of q.colisores) if (sobrepoe(c, d, 0.03)) { problemas.push(`${nomePeca(p)} ⟂ ${nomePeca(q)}`); break; }
      });
    }
  });
  return { pecas: pecas.length, problemas: [...new Set(problemas)] };
});
console.log(`auditoria do mobiliário: ${auditoria.pecas} peças, ${auditoria.problemas.length} problema(s)`);
for (const p of auditoria.problemas) console.log('  ·', p);

const info = await page.evaluate(() => ({ colisores: window.__casa.construtor.colisores.length, portas: window.__casa.construtor.portas.length, triangulos: window.__casa.renderer.info.render.triangles, chamadas: window.__casa.renderer.info.render.calls }));
console.log(info);
await browser.close();
servidor.close();
