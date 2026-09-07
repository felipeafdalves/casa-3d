// Capturas de vistas arbitrárias: VISTAS_JSON='[["nome",x,y,nivel,yaw,pitch],...]' node tools/vistas.mjs pasta
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const raiz = path.resolve('dist');
const saida = process.argv[2] || 'capturas';
mkdirSync(saida, { recursive: true });
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const servidor = createServer(async (req, res) => { let f = path.join(raiz, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; let d; try { d = await readFile(f); } catch { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
await new Promise((r) => servidor.listen(0, r));
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('ERRO NA PÁGINA:', e.message));
await page.goto(`http://127.0.0.1:${servidor.address().port}/?qualidade=${process.env.QUALIDADE || 0}`);
page.setDefaultTimeout(240000);
await page.waitForFunction(() => document.getElementById('botao-entrar') && !document.getElementById('botao-entrar').disabled);
await page.evaluate(() => { document.getElementById('tela-inicial').hidden = true; document.getElementById('hud').style.display = 'none'; });
for (const [nome, x, y, nivel, yaw, pitch] of JSON.parse(process.env.VISTAS_JSON || '[]')) {
  await page.evaluate(([x, y, nivel, yaw, pitch]) => { const j = window.__casa.jogador; j.teleportar(x, y, nivel, yaw); j.pitch = pitch; j.atualizarCamera(); }, [x, y, nivel, yaw, pitch]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(saida, `${nome}.png`) });
  console.log('captura', nome);
}
await browser.close();
servidor.close();
