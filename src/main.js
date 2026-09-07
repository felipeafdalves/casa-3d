// Ponto de entrada: monta a cena, o jogador, a interface e o ciclo de render.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { construirModelo, ambienteEm } from './modelo.js';
import { Construtor } from './construtor.js';
import { Jogador } from './jogador.js';
import { Interface } from './interface.js';
import { Iluminacao } from './iluminacao.js';
import { criarPeca } from './mobiliario.js';
import { prepararMateriais } from './materiais.js';

const canvas = document.getElementById('cena');
const estado = document.getElementById('estado-carregamento');
const botao = document.getElementById('botao-entrar');
botao.disabled = true;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd4ea');
scene.fog = new THREE.Fog('#c9d9e6', 45, 140);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 300);

const params = new URLSearchParams(location.search);
let qualidade = Math.min(2, Math.max(0, parseInt(params.get('qualidade') ?? '2', 10) || 0)); // 0 baixa, 1 média, 2 alta
let composer;
let gtao;
let jogador;
let interfaceHud;
let iluminacao;
let construtor;
const modelo = construirModelo();

async function iniciar() {
  await prepararMateriais((p, nome) => {
    estado.textContent = `A preparar materiais… ${Math.round(p * 100)}% (${nome})`;
  });
  estado.textContent = 'A construir a casa…';
  await new Promise((r) => setTimeout(r, 0));

  construtor = new Construtor(modelo);
  scene.add(construtor.construir());

  // mobiliário
  const nColisoresBase = construtor.colisores.length; // paredes, guardas, escadas
  const pecasColocadas = []; // { item, colisores } — usado pela auditoria automática (tools/capturas.mjs)
  for (const item of modelo.mobiliario) {
    const pav = modelo.porId[item.pav];
    const peca = criarPeca(item.tipo, item);
    const rot = ((item.rot || 0) * Math.PI) / 180;
    peca.grupo.position.set(item.pos[0], pav.nivel + (item.z || 0), -item.pos[1]);
    peca.grupo.rotation.y = rot;
    peca.grupo.userData.pav = item.pav;
    scene.add(peca.grupo);
    const colocados = [];
    for (const c of peca.colisores) {
      // colisor local (x, y-plano) rodado para o mundo
      // (plano y = −z do mundo; rotation.y = θ leva o eixo local +x para (cos θ, sin θ) no plano)
      const cx = item.pos[0] + c.x * Math.cos(rot) - c.y * Math.sin(rot);
      const cy = item.pos[1] + c.x * Math.sin(rot) + c.y * Math.cos(rot);
      colocados.push(construtor.addColisorCaixa(cx, cy, c.hx, c.hy, rot, pav.nivel + (item.z || 0) + c.h0, pav.nivel + (item.z || 0) + c.h1));
    }
    pecasColocadas.push({ item, colisores: colocados });
  }
  window.__casa.pecas = pecasColocadas;
  window.__casa.nColisoresBase = nColisoresBase;

  // luzes interiores (z relativo ao piso do pavimento)
  const luzes = modelo.luzes.map((l) => ({ ...l, nivelAbs: modelo.porId[l.pav].nivel }));
  iluminacao = new Iluminacao(scene, renderer, luzes);

  // pós-processamento: oclusão ambiente (GTAO) + anti-aliasing (SMAA)
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1, thickness: 1, scale: 1.2, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
  composer.addPass(gtao);
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());
  gtao.enabled = qualidade > 0;
  if (qualidade < 2) {
    gtao.updateGtaoMaterial({ samples: 8 });
    const tam = [1024, 2048][qualidade];
    iluminacao.sol.shadow.mapSize.set(tam, tam);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, [1, 1.5][qualidade]));
  }

  // modelo glTF opcional (ex.: exportado do SketchUp do projeto de interiores)
  carregarModeloOpcional();

  jogador = new Jogador(camera, canvas, construtor);
  jogador.teleportar(modelo.spawn.pos[0], modelo.spawn.pos[1], modelo.spawn.nivel, modelo.spawn.yaw);
  jogador.aoInteragir = interagir;
  interfaceHud = new Interface(modelo, jogador, construtor);

  estado.textContent = 'Pronto. Clique em “Entrar na casa”.';
  botao.disabled = false;
  botao.addEventListener('click', () => {
    document.getElementById('tela-inicial').hidden = true;
    jogador.entrar();
  });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && document.getElementById('teleporte').hidden) {
      document.getElementById('tela-inicial').hidden = false;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') alternarModoFoto();
    else if (modoFoto?.ativo && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Escape', 'KeyT', 'KeyL', 'KeyQ'].includes(e.code)) modoFoto.sair();
    if (e.code === 'KeyM') interfaceHud.alternarMapa();
    if (e.code === 'KeyL') iluminacao.alternarDiaNoite();
    if (e.code === 'KeyQ') alternarQualidade();
    if (e.code === 'KeyT') interfaceHud.alternarTeleporte();
    if (e.code === 'Escape' && !document.getElementById('teleporte').hidden) interfaceHud.fecharTeleporte();
  });
  requestAnimationFrame(ciclo);
}

// modo foto (path tracing progressivo): o módulo só é descarregado na primeira utilização
let modoFoto = null;
async function alternarModoFoto() {
  if (modoFoto?.ativo) {
    modoFoto.sair();
    return;
  }
  if (!modoFoto) {
    const { ModoFoto } = await import('./modoFoto.js');
    modoFoto = new ModoFoto(renderer, scene, camera, iluminacao);
    window.__casa.modoFoto = modoFoto;
  }
  await modoFoto.entrar(qualidade);
  jogador.moveu = false;
}

function carregarModeloOpcional() {
  const url = './modelos/casa.glb';
  new GLTFLoader().load(
    url,
    (gltf) => {
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(gltf.scene);
      console.info('Modelo glTF carregado:', url);
    },
    undefined,
    () => {
      /* sem modelo externo: usa-se a geometria procedural */
    }
  );
}

// abre/fecha a porta mais próxima à frente do jogador
function interagir() {
  const p = jogador.plano;
  const f = jogador.direcaoFrente();
  let melhor = null;
  let dist = 2.4;
  for (const porta of construtor.portas) {
    const dx = porta.pos[0] - p[0];
    const dy = porta.pos[1] - p[1];
    const d = Math.hypot(dx, dy);
    if (d > dist || Math.abs(porta.nivel - jogador.pos.y) > 2.5) continue;
    const dot = (dx * f.x + dy * -f.z) / (d || 1);
    if (dot < 0.3) continue;
    melhor = porta;
    dist = d;
  }
  if (melhor) melhor.aberta = !melhor.aberta;
}

function animarPortas(dt) {
  for (const porta of construtor.portas) {
    const alvo = porta.aberta ? porta.aberto : porta.fechado;
    if (porta.tipo === 'abrir') porta.grupo.rotation.y = THREE.MathUtils.damp(porta.grupo.rotation.y, alvo, 6, dt);
    else porta.grupo.position.x = THREE.MathUtils.damp(porta.grupo.position.x, alvo, 6, dt);
  }
}

function alternarQualidade() {
  qualidade = (qualidade + 1) % 3;
  const tam = [1024, 2048, 4096][qualidade];
  iluminacao.sol.shadow.mapSize.set(tam, tam);
  iluminacao.sol.shadow.map?.dispose();
  iluminacao.sol.shadow.map = null;
  const pr = Math.min(window.devicePixelRatio, [1, 1.5, 2][qualidade]);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  composer.setSize(window.innerWidth, window.innerHeight);
  gtao.enabled = qualidade > 0;
  gtao.updateGtaoMaterial({ samples: qualidade === 2 ? 16 : 8 });
  document.getElementById('dica').textContent = `Qualidade: ${['baixa', 'média', 'alta'][qualidade]} · WASD mover · Shift correr · E porta · M mapa · L luz · Q qualidade · T teleporte`;
}

let ultimo = performance.now();
function ciclo(agora) {
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;
  if (!modoFoto?.ativo) jogador.atualizar(dt);
  animarPortas(dt);
  interfaceHud.atualizar();
  if (modoFoto?.ativo) {
    // a câmara fica parada: cada frame acrescenta uma amostra ao path tracing
    if (jogador.moveu) modoFoto.sair();
    else if (modoFoto.renderizar()) return requestAnimationFrame(ciclo);
  }
  if (window.__casa.cameraOverride) renderer.render(scene, window.__casa.cameraOverride);
  else composer.render();
  requestAnimationFrame(ciclo);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
});

// exposto para testes automáticos (Playwright)
window.__casa = { get jogador() { return jogador; }, get construtor() { return construtor; }, modelo, scene, renderer, camera, THREE, ambienteEm };

iniciar().catch((e) => {
  console.error(e);
  estado.textContent = 'Erro ao iniciar: ' + e.message;
});
