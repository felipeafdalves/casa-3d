// Controlo em primeira pessoa: rato (pointer lock), WASD, corrida, gravidade, colisões 2D
// contra caixas orientadas (paredes, móveis, guardas) e altura do chão (pisos, escadas, rampas).
import * as THREE from 'three';

const ALTURA_OLHOS = 1.62;
const RAIO = 0.28;
const VEL_ANDAR = 2.4;
const VEL_CORRER = 4.6;
const GRAVIDADE = 14;

export class Jogador {
  constructor(camera, dom, construtor) {
    this.camera = camera;
    this.dom = dom;
    this.construtor = construtor;
    this.pos = new THREE.Vector3(); // pés
    this.vy = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.teclas = {};
    this.ativo = false;
    this.aoInteragir = null;
    this.ultimoDt = 0;

    dom.addEventListener('click', () => {
      if (!this.ativo) dom.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.ativo = document.pointerLockElement === dom;
      document.body.classList.toggle('a-jogar', this.ativo);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.ativo) return;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.moveu = true; // o modo foto sai ao mexer o rato
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('keydown', (e) => {
      this.teclas[e.code] = true;
      if (e.code === 'KeyE' && this.ativo) this.aoInteragir?.();
    });
    document.addEventListener('keyup', (e) => {
      this.teclas[e.code] = false;
    });
  }

  entrar() {
    this.dom.requestPointerLock?.();
  }

  teleportar(x, y, nivel, yaw = this.yaw) {
    this.pos.set(x, nivel + 0.02, -y);
    this.vy = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.atualizarCamera();
  }

  get plano() {
    return [this.pos.x, -this.pos.z];
  }

  direcaoFrente() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  atualizar(dt) {
    this.moveu = false;
    dt = Math.min(dt, 0.05);
    const frente = this.direcaoFrente();
    const direita = new THREE.Vector3(-frente.z, 0, frente.x);
    const mov = new THREE.Vector3();
    if (this.ativo) {
      if (this.teclas.KeyW || this.teclas.ArrowUp) mov.add(frente);
      if (this.teclas.KeyS || this.teclas.ArrowDown) mov.sub(frente);
      if (this.teclas.KeyD || this.teclas.ArrowRight) mov.add(direita);
      if (this.teclas.KeyA || this.teclas.ArrowLeft) mov.sub(direita);
    }
    const correr = this.teclas.ShiftLeft || this.teclas.ShiftRight;
    if (mov.lengthSq() > 0) mov.normalize().multiplyScalar((correr ? VEL_CORRER : VEL_ANDAR) * dt);

    // movimento horizontal por eixos separados (deslizar ao longo das paredes)
    this.pos.x += mov.x;
    this.resolverColisoes();
    this.pos.z += mov.z;
    this.resolverColisoes();

    // altura do chão e gravidade
    const chao = this.construtor.alturaChao(this.pos.x, -this.pos.z, this.pos.y);
    if (this.pos.y <= chao + 0.02) {
      // subir degraus suavemente
      this.pos.y = chao > this.pos.y + 0.001 ? THREE.MathUtils.lerp(this.pos.y, chao, Math.min(1, dt * 18)) : chao;
      this.vy = 0;
    } else {
      this.vy -= GRAVIDADE * dt;
      this.pos.y = Math.max(chao, this.pos.y + this.vy * dt);
      if (this.pos.y === chao) this.vy = 0;
    }
    this.atualizarCamera();
  }

  resolverColisoes() {
    const pe = this.pos.y + 0.25;
    const cabeca = this.pos.y + 1.75;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.construtor.colisores) {
        if (c.y1 < pe || c.y0 > cabeca) continue;
        if (!c.ativo()) continue;
        // para o referencial da caixa
        const dx = this.pos.x - c.cx;
        const dy = -this.pos.z - c.cy;
        const cos = Math.cos(c.rot);
        const sin = Math.sin(c.rot);
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        // ponto mais próximo da caixa
        const px = Math.max(-c.hx, Math.min(c.hx, lx));
        const py = Math.max(-c.hy, Math.min(c.hy, ly));
        let ex = lx - px;
        let ey = ly - py;
        const d2 = ex * ex + ey * ey;
        if (d2 >= RAIO * RAIO) continue;
        let empurrar;
        if (d2 < 1e-9) {
          // centro dentro da caixa: sair pela face mais próxima
          const sx = c.hx - Math.abs(lx);
          const sy = c.hy - Math.abs(ly);
          if (sx < sy) {
            ex = Math.sign(lx) || 1;
            ey = 0;
            empurrar = sx + RAIO;
          } else {
            ex = 0;
            ey = Math.sign(ly) || 1;
            empurrar = sy + RAIO;
          }
        } else {
          const d = Math.sqrt(d2);
          ex /= d;
          ey /= d;
          empurrar = RAIO - d;
        }
        // de volta ao mundo
        const wx = ex * cos - ey * sin;
        const wy = ex * sin + ey * cos;
        this.pos.x += wx * empurrar;
        this.pos.z -= wy * empurrar;
      }
    }
  }

  atualizarCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + ALTURA_OLHOS, this.pos.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
  }
}
