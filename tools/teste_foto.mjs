// Teste do modo foto (path tracing) num Chromium sem GPU: entra, espera por amostras e tira captura.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve('dist');
const saida = process.argv[2] || 'capturas';
mkdirSync(saida, { recursive: true });
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const servidor = createServer(async (req, res) => {
  let f = path.join(raiz, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  let d;
  try { d = await readFile(f); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' });
  res.end(d);
});
await new Promise((r) => servidor.listen(0, r));
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const larg = +(process.env.LARGURA || 640), alt = Math.round(larg * 9 / 16);
const page = await browser.newPage({ viewport: { width: larg, height: alt } });
page.on('pageerror', (e) => console.error('ERRO NA PÁGINA:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto(`http://127.0.0.1:${servidor.address().port}/?qualidade=${process.env.QUALIDADE || 0}`);
page.setDefaultTimeout(600000);
await page.waitForFunction(() => document.getElementById('botao-entrar') && !document.getElementById('botao-entrar').disabled);
await page.evaluate(() => { document.getElementById('tela-inicial').hidden = true; });
const [x, y, nivel, yaw, pitch] = (process.env.VISTA || '5.2,6.5,1.5,-1.5,0.1').split(',').map(Number);
await page.evaluate(([x, y, nivel, yaw, pitch]) => { const j = window.__casa.jogador; j.teleportar(x, y, nivel, yaw); j.pitch = pitch; j.atualizarCamera(); }, [x, y, nivel, yaw, pitch]);
await page.waitForTimeout(500);
const t0 = Date.now();
await page.keyboard.press('KeyF');
await page.waitForFunction(() => window.__casa.modoFoto && window.__casa.modoFoto.ativo);
console.log(`modo foto pronto em ${((Date.now() - t0) / 1000).toFixed(1)}s (BVH + shaders)`);
const alvo = +(process.env.AMOSTRAS || 4);
await page.waitForFunction((n) => window.__casa.modoFoto.tracer.samples >= n, alvo);
console.log(`${alvo} amostras em ${((Date.now() - t0) / 1000).toFixed(1)}s ·`, await page.evaluate(() => document.getElementById('modo-foto-estado').textContent));
await page.screenshot({ path: path.join(saida, 'modo-foto.png') });
await page.evaluate(() => { document.getElementById('hud').style.visibility = 'hidden'; });
await page.screenshot({ path: path.join(saida, 'modo-foto-sem-hud.png') });
await page.evaluate(() => { document.getElementById('hud').style.visibility = ''; });
await page.keyboard.press('KeyF');
console.log('saiu do modo foto:', await page.evaluate(() => !window.__casa.modoFoto.ativo && document.getElementById('modo-foto').hidden));
await browser.close();
servidor.close();
