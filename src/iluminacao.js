// Sol com sombras, céu/ambiente HDR (imagem real), reflexos PBR e luzes quentes interiores.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const HDR_DIA = './hdr/spruit_sunrise_1k.hdr';
const HDR_NOITE = './hdr/moonless_golf_1k.hdr';

export class Iluminacao {
  constructor(scene, renderer, luzes) {
    this.scene = scene;
    this.renderer = renderer;
    this.noite = false;
    this.hdr = {};
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.sol = new THREE.DirectionalLight('#fff3e0', 3.0);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(4096, 4096);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.03;
    const c = this.sol.shadow.camera;
    c.left = -22;
    c.right = 22;
    c.top = 26;
    c.bottom = -26;
    c.near = 1;
    c.far = 90;
    this.sol.target.position.set(4.6, 2, -6);
    scene.add(this.sol, this.sol.target);

    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#6b6152', 0.45);
    scene.add(this.hemi);

    // céu procedural enquanto o HDR não chega
    this.sky = new Sky();
    this.sky.scale.setScalar(4000);
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.85;
    scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    // luzes interiores
    this.interiores = [];
    for (const l of luzes) {
      const luz = new THREE.PointLight(l.cor || '#ffe4bf', 0, 9, 1.6);
      luz.userData.int = l.int;
      luz.position.set(l.pos[0], (l.nivelAbs ?? 0) + l.z, -l.pos[1]);
      scene.add(luz);
      this.interiores.push(luz);
    }
    this.definirHora(10.5);
    this.carregarHDR(HDR_DIA).then(() => this.aplicarHDR());
  }

  carregarHDR(url) {
    if (this.hdr[url]) return Promise.resolve(this.hdr[url]);
    return new Promise((resolver) => {
      new HDRLoader().load(
        url,
        (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          this.hdr[url] = { fundo: tex, ambiente: this.pmrem.fromEquirectangular(tex).texture };
          resolver(this.hdr[url]);
        },
        undefined,
        () => resolver(null)
      );
    });
  }

  aplicarHDR() {
    const h = this.hdr[this.noite ? HDR_NOITE : HDR_DIA];
    if (!h) return;
    this.sky.visible = false;
    this.scene.background = h.fundo;
    this.scene.environment = h.ambiente;
    this.scene.backgroundIntensity = this.noite ? 0.6 : 1.15;
    this.scene.environmentIntensity = this.noite ? 0.25 : 0.75;
    this.scene.backgroundBlurriness = 0;
  }

  definirHora(h) {
    this.hora = h;
    const t = ((h - 6) / 12) * Math.PI; // 6h → 0, 18h → π
    const elev = Math.sin(t);
    const az = -Math.cos(t);
    const dir = new THREE.Vector3(az * 0.8, Math.max(elev, 0.02), -0.5).normalize();
    this.sol.position.copy(dir.clone().multiplyScalar(45).add(this.sol.target.position));
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    const noite = elev < 0.05;
    this.noite = noite;
    this.sol.intensity = noite ? 0 : 2.4 + 1.2 * elev;
    this.sol.color.setHSL(0.08, 0.5, noite ? 0.2 : 0.85 + 0.15 * elev);
    this.hemi.intensity = noite ? 0.1 : 0.35 + 0.3 * elev;
    for (const luz of this.interiores) luz.intensity = noite ? luz.userData.int * 1.6 : luz.userData.int * 0.4;
    this.renderer.toneMappingExposure = noite ? 0.9 : 1.15;
    this.carregarHDR(noite ? HDR_NOITE : HDR_DIA).then(() => this.aplicarHDR());
  }

  /** HDR (equiretangular + PMREM) em uso, se já carregado. */
  hdrAtual() {
    return this.hdr[this.noite ? HDR_NOITE : HDR_DIA] || null;
  }

  alternarDiaNoite() {
    this.definirHora(this.noite ? 10.5 : 21);
  }
}
