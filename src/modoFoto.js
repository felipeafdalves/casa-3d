// Modo foto: path tracing progressivo (three-gpu-pathtracer) da vista atual.
// Carregado só quando se carrega em F — não pesa no arranque nem no passeio normal.
// A imagem começa granulada e converge, amostra a amostra, para uma fotografia com luz
// indireta, sombras suaves e reflexos físicos: o mesmo princípio dos renders de arquitetura.
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { ParallelMeshBVHWorker } from 'three-mesh-bvh/worker';

export class ModoFoto {
  constructor(renderer, scene, camera, iluminacao) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.iluminacao = iluminacao;
    this.ativo = false;
    this.aPreparar = false;
    this.tracer = null;
    this.painel = document.getElementById('modo-foto');
    this.texto = document.getElementById('modo-foto-estado');
    document.getElementById('modo-foto-guardar')?.addEventListener('click', () => this.guardar());
  }

  /** Prepara o path tracer para a cena/câmara atual (constrói o BVH) e entra no modo foto. */
  async entrar(qualidade = 1) {
    if (this.ativo || this.aPreparar) return;
    this.aPreparar = true;
    this.painel.hidden = false;
    this.texto.textContent = 'A preparar a cena para o path tracing…';
    try {
      if (!this.tracer) {
        this.tracer = new WebGLPathTracer(this.renderer);
        this.tracer.bounces = 4;
        this.tracer.filterGlossyFactor = 0.8; // suaviza reflexos após ressaltos: menos "fireflies", converge mais depressa
        this.tracer.minSamples = 1;
        this.tracer.renderDelay = 0;
        this.tracer.fadeDuration = 0;
        this.tracer.rasterizeScene = false;
        this.tracer.dynamicLowRes = false;
        this.tracer.tiles.set(3, 3);
        this.tracer.textureSize.set(2048, 2048);
        // o BVH (índice espacial de todos os triângulos) constrói-se num worker para não congelar a página
        try {
          this.worker = new ParallelMeshBVHWorker();
          this.tracer.setBVHWorker(this.worker);
        } catch (e) {
          console.warn('Sem workers para o BVH; construção síncrona.', e);
          this.worker = null;
        }
      }
      this.tracer.renderScale = [0.5, 0.75, 1][qualidade] ?? 0.75;
      // o path tracer precisa do HDR equiretangular original (não do mapa PMREM usado no passeio)
      const hdr = this.iluminacao.hdrAtual();
      const ambienteAnterior = this.scene.environment;
      const fundoAnterior = this.scene.background;
      if (hdr) {
        this.scene.environment = hdr.fundo;
        this.scene.background = hdr.fundo;
      }
      // Num render físico o interior só recebe luz pelas janelas: como nas fotografias de arquitetura,
      // compensa-se com exposição (e as luminárias contam de facto como fontes de luz).
      this.exposicaoAnterior = this.renderer.toneMappingExposure;
      this.renderer.toneMappingExposure = this.exposicaoAnterior * (this.iluminacao.noite ? 1.6 : 2.2);
      this.ambienteIntAnterior = this.scene.environmentIntensity;
      this.scene.environmentIntensity = this.iluminacao.noite ? 0.5 : 1.4;
      this.luzesAnteriores = this.iluminacao.interiores.map((l) => l.intensity);
      for (const l of this.iluminacao.interiores) l.intensity *= 2.5;
      this.escondidos = [];
      this.scene.traverse((o) => {
        // o céu procedural (esfera gigante) e os helpers não entram na foto
        if ((o.isMesh && o.userData.semFoto) || o.isSky) {
          if (o.visible) this.escondidos.push(o);
          o.visible = false;
        }
      });
      if (this.worker) {
        await this.tracer.setSceneAsync(this.scene, this.camera, {
          onProgress: (p) => { this.texto.textContent = `A preparar a cena… ${Math.round(p * 100)}%`; },
        });
      } else {
        await new Promise((r) => setTimeout(r, 30)); // deixa o texto do painel aparecer antes de bloquear
        this.tracer.setScene(this.scene, this.camera);
      }
      this.scene.environment = ambienteAnterior;
      this.scene.background = fundoAnterior;
      this.scene.environmentIntensity = this.ambienteIntAnterior;
      this.ativo = true;
      this.inicio = performance.now();
      this.texto.textContent = 'A convergir… 0 amostras';
    } catch (erro) {
      this.restaurarLuz();
      console.error('Modo foto indisponível:', erro);
      this.texto.textContent = 'Modo foto indisponível neste dispositivo (precisa de WebGL2 com texturas float).';
      setTimeout(() => this.sair(), 3000);
    } finally {
      this.aPreparar = false;
    }
  }

  /** Uma amostra por frame; devolve true se desenhou (o ciclo normal não deve renderizar por cima). */
  renderizar() {
    if (!this.ativo) return false;
    this.tracer.renderSample();
    const n = Math.floor(this.tracer.samples); // com 3×3 tiles, cada frame acrescenta 1/9 de amostra
    if (n !== this.ultimasAmostras) {
      this.ultimasAmostras = n;
      const s = ((performance.now() - this.inicio) / 1000).toFixed(0);
      this.texto.textContent = `A convergir… ${n} amostra${n === 1 ? '' : 's'} · ${s}s · F ou qualquer tecla de movimento sai`;
    }
    return true;
  }

  restaurarLuz() {
    if (this.exposicaoAnterior !== undefined) this.renderer.toneMappingExposure = this.exposicaoAnterior;
    if (this.luzesAnteriores) this.iluminacao.interiores.forEach((l, i) => { l.intensity = this.luzesAnteriores[i]; });
    this.exposicaoAnterior = undefined;
    this.luzesAnteriores = null;
  }

  sair() {
    this.ativo = false;
    this.painel.hidden = true;
    this.restaurarLuz();
    for (const o of this.escondidos || []) o.visible = true;
    this.escondidos = [];
  }

  /** Guarda a imagem convergida como PNG. */
  guardar() {
    if (!this.ativo) return;
    this.tracer.renderSample();
    const a = document.createElement('a');
    a.download = `casa-foto-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.href = this.renderer.domElement.toDataURL('image/png');
    a.click();
  }
}
