// Ajustes manuais sobre a geometria extraída do DWG (src/casa.gerada.json).
// Tudo em metros. Sistema global = coordenadas da planta do térreo (x para leste, y para norte).
// Os outros pavimentos são deslocados para o mesmo sistema (as três plantas do DWG são cópias
// desalinhadas). TODAS as coordenadas deste ficheiro são globais (já com o deslocamento aplicado).
// Fonte das decisões: rótulos do DWG ("L x A / peitoril", "SOBE H=…", numeração dos degraus),
// o projeto de interiores (PDF) e as imagens de referência do estilo "modern farmhouse".
export const ajustes = {
  // Deslocamento (dx, dy) de cada planta extraída para o sistema global.
  deslocamentos: { subsolo: [0.35, -4.4], terreo: [0, 0], superior: [0.55, 0] },

  // Espessura da laje entre pavimentos.
  laje: 0.15,

  // Contornos de piso por pavimento (sistema global).
  pisos: {
    subsolo: {
      material: 'pedra_escura',
      poligono: [[0.35, -4.4], [7.79, -4.4], [7.79, 7.235], [0.35, 7.235]],
    },
    terreo: {
      material: 'madeira_escura',
      // a frente tem a bay window da brinquedoteca (x 5,82–8,74, avança 0,45 m para a varanda)
      poligono: [[0.35, -2.75], [5.823, -2.75], [6.02, -3.2], [8.6, -3.2], [8.741, -2.75], [9.09, -2.75], [9.09, 15.5], [0, 15.5], [0, 8.725], [0.35, 8.725]],
      // sem laje aqui (a escada para o subsolo e o poço)
      furos: [
        [[0.44, 4.23], [1.54, 4.23], [1.54, 7.14], [0.44, 7.14]],
        [[1.54, 6.04], [3.34, 6.04], [3.34, 7.14], [1.54, 7.14]],
      ],
      exteriores: [
        { nome: 'Varanda da frente', material: 'deck', nivel: 1.45, poligono: [[0.35, -4.43], [9.09, -4.43], [9.09, -2.75], [0.35, -2.75]] },
        { nome: 'Varanda dos fundos', material: 'deck', nivel: 1.45, poligono: [[0, 15.5], [9.09, 15.5], [9.09, 17.5], [0, 17.5]] },
      ],
    },
    superior: {
      material: 'madeira_escura',
      poligono: [[0.8, -3.195], [8.585, -3.195], [8.585, 2.855], [5.59, 2.855], [5.59, 15.5], [0.55, 15.5], [0.55, 6.04], [0.8, 6.04]],
      // o teto cobre também o vazio do mezanino (pé-direito duplo)
      teto: [[0.55, -3.195], [8.585, -3.195], [8.585, 15.5], [0.55, 15.5]],
      // poço da escada (as duas faixas) — a rampa/patamar fornecem o piso
      furos: [[[0.64, 6.04], [4.09, 6.04], [4.09, 7.34], [4.2, 7.34], [4.2, 8.64], [0.64, 8.64]]],
      exteriores: [
        { nome: 'Sacada', material: 'porcelanato_cinza', nivel: 4.42, poligono: [[0.64, 15.5], [5.39, 15.5], [5.39, 16.5], [0.64, 16.5]] },
      ],
    },
  },

  // Vazios de teto: mezanino (pé-direito duplo sobre estar/jantar/cozinha) e poço da escada no subsolo.
  vazios: {
    terreo: [
      [[5.59, 2.855], [8.49, 2.855], [8.49, 15.405], [5.59, 15.405]],
      // poço da escada para o superior (o mesmo furo do piso de cima)
      [[0.64, 6.04], [4.09, 6.04], [4.09, 7.34], [4.2, 7.34], [4.2, 8.64], [0.64, 8.64]],
    ],
    subsolo: [
      [[0.44, 4.23], [1.54, 4.23], [1.54, 7.14], [0.44, 7.14]],
      [[1.54, 6.04], [3.4, 6.04], [3.4, 7.14], [1.54, 7.14]],
    ],
  },

  // Paredes com altura limitada (ex.: parede do lavabo que fica debaixo da escada).
  alturasParede: {
    subsolo: [{ perto: [3.12, 6.58], topo: 0.85 }],
    // mureta entre o 1.º lance da escada de subida e o poço da escada do subsolo (o 2.º lance passa por cima; guarda de balaústres em cima)
    terreo: [
      { perto: [2.28, 7.24], topo: 2.4 },
      { perto: [4.0, 6.99], topo: 4.15 }, // pilarete no topo do 2.º lance: fica debaixo dos últimos degraus
      { perto: [4.0, 6.36], topo: 4.15 }, // parede da passagem para a escada do subsolo (verga fica sob o 2.º lance)
    ],
  },

  // Paredes que a extração não apanhou (sistema global).
  paredesExtra: {
    terreo: [
      { a: [5.497, 15.5], b: [5.72, 15.5], esp: 0.17 },
      { a: [8.35, 15.5], b: [9.09, 15.5], esp: 0.17 },
      // lareira: parede de pedra que fecha o nicho no muro leste
      { a: [9.09, 6.85], b: [9.09, 8.75], esp: 0.17, material: 'pedra' },
      // parede entre a circulação e o BWC social (com porta), não extraída
      { a: [5.48, 1.075], b: [5.48, 1.1], esp: 0.17 },
      // bay window da brinquedoteca (o DWG desenha-a com lados oblíquos, que a extração ortogonal não apanha)
      { a: [5.823, -2.75], b: [6.02, -3.2], esp: 0.17 },
      { a: [6.02, -3.2], b: [6.29, -3.2], esp: 0.17 },
      { a: [8.29, -3.2], b: [8.6, -3.2], esp: 0.17 },
      { a: [8.6, -3.2], b: [8.741, -2.75], esp: 0.17 },
    ],
    superior: [
      { a: [3.915, 0], b: [4.38, 0], esp: 0.17 },
      { a: [5.18, 0], b: [5.48, 0], esp: 0.17 },
      { a: [5.48, 1.075], b: [6.364, 1.075], esp: 0.17 },
      { a: [5.48, 2.66], b: [8.585, 2.66], esp: 0.17 },
      // chaminé da lareira: o DWG interrompe a parede leste aqui; a pedra sobe pelo pé-direito duplo
      { a: [8.585, 6.814], b: [8.585, 8.79], esp: 0.17, material: 'pedra' },
    ],
  },

  // Vãos a substituir/adicionar. "remover" apaga vãos extraídos cujo centro esteja a < 0,35 m do ponto.
  vaosRemover: { terreo: [[9.09, 7.8], [4.0, 6.36], [7.28, -2.75]], superior: [[4.0, 2.12], [5.48, 0.62]] },
  vaosExtra: {
    subsolo: [{ tipo: 'porta', a: [4.05, 5.7], b: [4.75, 5.7], altura: 2.1, peitoril: 0 }],
    terreo: [
      { tipo: 'janela', a: [6.29, -3.2], b: [8.29, -3.2], altura: 1.75, peitoril: 0.5 }, // bay window
      { tipo: 'janela', a: [9.09, 5.85], b: [9.09, 6.85], altura: 1.65, peitoril: 0.6 },
      { tipo: 'janela', a: [9.09, 8.75], b: [9.09, 9.75], altura: 1.65, peitoril: 0.6 },
      { tipo: 'porta_vidro', a: [5.72, 15.5], b: [8.35, 15.5], altura: 2.25, peitoril: 0 },
      { tipo: 'porta', a: [1.85, 9.523], b: [1.85, 10.323], altura: 2.1, peitoril: 0 },
      { tipo: 'porta_vidro', a: [5.48, -1.47], b: [5.48, -0.11], altura: 2.1, peitoril: 0 },
      { tipo: 'porta', a: [5.48, 1.1], b: [5.48, 1.9], altura: 2.1, peitoril: 0 },
      // passagem para a escada do subsolo: sem folha (a porta celeiro corre ao lado)
      { tipo: 'passagem', a: [4.0, 5.872], b: [4.0, 6.842], altura: 2.1, peitoril: 0 },
    ],
    superior: [
      { tipo: 'porta', a: [4.0, 1.85], b: [4.0, 2.65], altura: 2.1, peitoril: 0 },
      { tipo: 'porta', a: [5.48, 0.15], b: [5.48, 0.95], altura: 2.1, peitoril: 0 },
      { tipo: 'porta', a: [4.38, 0], b: [5.18, 0], altura: 2.1, peitoril: 0 },
      { tipo: 'porta', a: [5.65, 1.075], b: [6.35, 1.075], altura: 2.1, peitoril: 0 },
    ],
  },

  // Vidros/guarda-corpos extraídos que são apenas linhas de janela (duplicados) — ignorar por proximidade.
  vidrosIgnorar: {
    terreo: [[0.53, 8.0], [0.58, 8.0], [8.58, 1.9], [8.6, 1.9], [6.4, 15.47], [7.0, 15.5], [7.3, -3.2], [7.3, -3.17], [2.36, 8.54], [2.36, 8.59]],
    superior: [[2.36, 6.09], [2.36, 6.14], [3.01, 7.29], [2.98, 7.39], [4.13, 7.9], [3.01, 7.24]],
    subsolo: [[2.565, -4.43], [2.565, -4.4], [1.437, 5.133], [1.487, 5.133]],
  },

  // Escadas: lances (rampas de colisão + degraus visuais) e patamares. Coordenadas globais.
  escadas: [
    {
      id: 'terreo-superior',
      // linhas do DWG: 1.º lance x 4,09→1,94 (y 7,34–8,64), patamar x 0,64–1,94, 2.º lance x 1,94→4,09 (y 6,04–7,34)
      lances: [
        { de: [4.09, 7.99], para: [1.94, 7.99], largura: 1.3, z0: 1.5, z1: 2.985, degraus: 8 },
        { patamar: [[0.64, 6.04], [1.94, 8.64]], z: 2.985 },
        { de: [1.94, 6.69], para: [4.09, 6.69], largura: 1.3, z0: 2.985, z1: 4.47, degraus: 8 },
      ],
      guardas: [
        { a: [4.09, 7.37], b: [1.94, 7.37], altura: 0.95, lance: 0 }, // 1.º lance, lado da sala (sobre a mureta)
        { a: [1.94, 8.61], b: [4.09, 8.61], altura: 0.95, lance: 0 }, // 1.º lance, lado da cozinha
        { a: [1.94, 7.31], b: [4.09, 7.31], altura: 0.95, lance: 2 }, // 2.º lance, guarda central
        { a: [0.64, 6.08], b: [1.94, 6.08], altura: 1.0, z: 2.985 }, // patamar, sobre o poço da escada do subsolo
        { a: [4.15, 7.34], b: [4.15, 8.64], altura: 1.1, z: 4.47 }, // bordo do piso superior
      ],
    },
    {
      id: 'terreo-subsolo',
      // linhas do DWG: 1.º lance x 3,34→1,54 (6 espelhos), patamar x 0,44–1,54, 2.º lance desce para sul ao longo da parede oeste (7 espelhos)
      lances: [
        { de: [3.34, 6.59], para: [1.54, 6.59], largura: 1.1, z0: 1.5, z1: 0.323, degraus: 6 },
        { patamar: [[0.44, 6.04], [1.54, 7.14]], z: 0.323 },
        { de: [0.99, 6.04], para: [0.99, 4.23], largura: 1.1, z0: 0.323, z1: -1.05, degraus: 7 },
      ],
      guardas: [{ a: [1.5, 6.04], b: [1.5, 4.23], altura: 1.0, lance: 2 }], // lado aberto para a garagem
    },
  ],

  // Acabamentos por ambiente. Chave = nome extraído (ou nome@x,y para desambiguar).
  // lambri: painel inferior (paineis brancos por defeito; lambriTipo 'ripado' = tábuas verticais);
  // boiserie: molduras na parte superior das paredes; paredesPorLado: acento numa parede (norte/sul/leste/oeste).
  ambientes: {
    terreo: {
      'Hall': { piso: 'madeira_escura', parede: 'parede_branca', lambri: true, boiserie: true, nome: 'Hall de entrada', poligono: [[0.435, -2.665], [4.0, -2.665], [4.0, -0.085], [0.435, -0.085]] },
      'Brinquedoteca': { piso: 'madeira_escura', parede: 'parede_creme', lambri: true, lambriMaterial: 'shiplap_branco', lambriTipo: 'ripado', poligono: [[5.565, -2.665], [5.86, -2.665], [6.03, -3.12], [8.59, -3.12], [8.71, -2.665], [9.005, -2.665], [9.005, 0.99], [5.565, 0.99]] },
      'Sanitário@7.48,1.65': { piso: 'ladrilho', parede: 'marmore', nome: 'Banheiro social', poligono: [[5.567, 1.16], [9.0, 1.16], [9.0, 2.66], [5.567, 2.66]] },
      'Sanitário@2.6,1.1': { piso: 'ladrilho', parede: 'marmore', nome: 'Banheiro da suíte de hóspedes', poligono: [[0.44, 0.17], [3.915, 0.17], [3.915, 1.5], [0.44, 1.5]] },
      'Suíte 1': { piso: 'madeira_escura', parede: 'papel_floral', lambri: true, lambriMaterial: 'salvia', lambriAltura: 1.0, nome: 'Suíte de hóspedes' },
      'Circulação': { piso: 'madeira_escura', parede: 'parede_branca', lambri: true, poligono: [[4.085, 1.16], [5.48, 1.16], [5.48, 2.66], [4.085, 2.66]] },
      'Sala De Estar/Tv': { piso: 'madeira_escura', parede: 'parede_branca', lambri: true, boiserie: true, nome: 'Sala de estar', poligono: [[4.085, 2.83], [9.005, 2.83], [9.005, 8.7], [4.085, 8.7]] },
      'Cozinha/Jantar': { piso: 'madeira_escura', parede: 'parede_branca', nome: 'Cozinha e sala de jantar', poligono: [[1.935, 8.7], [9.005, 8.7], [9.005, 15.415], [1.935, 15.415]] },
      'Lavanderia': { piso: 'madeira_escura', parede: 'subway', poligono: [[0.085, 8.81], [1.765, 8.81], [1.765, 15.415], [0.085, 15.415]] },
      'Escada': { piso: 'madeira_escura', parede: 'parede_branca', lambri: true, poligono: [[0.44, 7.34], [4.0, 7.34], [4.0, 8.64], [0.44, 8.64]] },
    },
    superior: {
      'Escritório': { piso: 'madeira_escura', parede: 'parede_verde', boiserie: true, poligono: [[0.885, -3.11], [5.395, -3.11], [5.395, -0.085], [0.885, -0.085]] },
      'Suíte 2': { piso: 'madeira_escura', parede: 'papel_xadrez', lambri: true, lambriTipo: 'ripado', lambriMaterial: 'shiplap_azul', lambriAltura: 1.05, nome: 'Suíte do filho', poligono: [[0.885, 1.755], [3.915, 1.755], [3.915, 5.87], [0.885, 5.87]] },
      'Suíte 3': { piso: 'madeira_escura', parede: 'papel_floral', lambri: true, lambriMaterial: 'salvia', lambriAltura: 1.0, nome: 'Suíte de hóspedes (superior)', poligono: [[5.565, -3.11], [8.5, -3.11], [8.5, 0.99], [5.565, 0.99]] },
      'Suíte Casal': { piso: 'madeira_escura', parede: 'parede_creme', paredesPorLado: { oeste: 'papel_floral_bege' }, nome: 'Suíte master', poligono: [[0.635, 10.4], [5.395, 10.4], [5.395, 15.415], [0.635, 15.415]] },
      'Circulação': { piso: 'madeira_escura', parede: 'parede_branca', lambri: true, lambriMaterial: 'bege', boiserie: true, poligono: [[4.085, 0.085], [5.48, 0.085], [5.48, 10.3], [4.085, 10.3]] },
      'Sanitário@2.19,1.07': { piso: 'ladrilho', parede: 'marmore', nome: 'Banheiro da suíte do filho', poligono: [[0.885, 0.17], [3.915, 0.17], [3.915, 1.5], [0.885, 1.5]] },
      'Sanitário@6.85,1.72': { piso: 'ladrilho', parede: 'marmore', nome: 'Banheiro da suíte de hóspedes', poligono: [[5.565, 1.16], [8.5, 1.16], [8.5, 2.575], [5.565, 2.575]] },
      'Sanitário@2.4,9.7': { piso: 'ladrilho', parede: 'marmore', nome: 'Banheiro da suíte master', poligono: [[0.635, 8.81], [4.225, 8.81], [4.225, 10.305], [0.635, 10.305]] },
    },
    subsolo: {
      'Garagem': { piso: 'pedra_escura', parede: 'tijolo', teto: 'shiplap_branco', semCortinas: true, nome: 'Garagem e bar', poligono: [[0.435, -4.315], [7.705, -4.315], [7.705, 7.15], [0.435, 7.15]] },
      'Lavabo': { piso: 'ladrilho', parede: 'marmore', poligono: [[3.205, 5.785], [4.805, 5.785], [4.805, 7.15], [3.205, 7.15]] },
    },
  },

  // Onde o jogador começa.
  spawn: { pos: [2.9, -3.6], nivel: 1.45, yaw: 0 }, // na varanda da frente, virado para a porta

  // Mobiliário procedural (tipo, posição global [x, y], rotação em graus, pavimento).
  // Convenção de rotação: 0 = frente virada para o sul (-y), 180 = norte, 90 = leste, -90 = oeste.
  mobiliario: [
    // ---- Hall de entrada: mudroom, cómoda com espelho em arco e lanternas
    { tipo: 'banco_mudroom', pos: [0.66, -1.4], rot: 90, pav: 'terreo', largura: 2.4 },
    { tipo: 'comoda', pos: [2.4, -0.34], rot: 0, pav: 'terreo', largura: 1.5 },
    { tipo: 'espelho', pos: [2.4, -0.1], rot: 0, pav: 'terreo', z: 1.15 },
    { tipo: 'arandela', pos: [1.45, -0.1], rot: 0, pav: 'terreo', z: 1.7, luz: true },
    { tipo: 'arandela', pos: [3.35, -0.1], rot: 0, pav: 'terreo', z: 1.7 },
    { tipo: 'tapete', pos: [2.3, -1.45], rot: 0, pav: 'terreo', dims: [2.4, 1.3], material: 'tapete' },
    { tipo: 'pendente', pos: [2.3, -1.45], pav: 'terreo', z: 2.3, corrente: 0.5 },
    // ---- Brinquedoteca
    { tipo: 'mesa_infantil', pos: [7.0, -1.3], rot: 0, pav: 'terreo' },
    { tipo: 'estante_baixa', pos: [7.3, 0.74], rot: 0, pav: 'terreo' },
    { tipo: 'tapete_redondo', pos: [7.3, -1.0], pav: 'terreo', raio: 1.2, material: 'marcenaria_azul' },
    { tipo: 'banco_janela', pos: [7.29, -2.88], rot: 180, pav: 'terreo', largura: 2.3 }, // banco na bay window
    // ---- Banheiro social (sálvia + mármore)
    { tipo: 'bancada_lavatorio', pos: [6.4, 2.35], rot: 0, pav: 'terreo' },
    { tipo: 'vaso', pos: [7.5, 2.35], rot: 0, pav: 'terreo' },
    { tipo: 'box', pos: [8.5, 2.15], rot: 0, pav: 'terreo' },
    // ---- Suíte de hóspedes (térreo): papel floral, lambri sálvia
    // (planta do PDF: cabeceira na parede oeste, closet no canto NO, alcova a norte com secretária)
    { tipo: 'cama', pos: [1.6, 3.13], rot: 90, pav: 'terreo', largura: 1.4, mesas: [-1] },
    { tipo: 'banco_pe_cama', pos: [3.0, 3.13], rot: 90, pav: 'terreo', largura: 1.2 },
    { tipo: 'tapete', pos: [1.9, 3.13], rot: 0, pav: 'terreo', dims: [2.8, 2.2] },
    { tipo: 'mesa_escritorio', pos: [2.8, 5.38], rot: 0, pav: 'terreo', pequena: true },
    { tipo: 'lustre_ratan', pos: [2.0, 3.13], pav: 'terreo', z: 2.35 },
    { tipo: 'quadro', pos: [0.45, 2.55], rot: 90, pav: 'terreo', z: 1.75, cor: '#7d8f6a', largura: 0.8, altura: 0.6 },
    { tipo: 'quadro', pos: [0.45, 3.35], rot: 90, pav: 'terreo', z: 1.75, cor: '#8a7a5a', largura: 0.8, altura: 0.6 },
    { tipo: 'bancada_lavatorio', pos: [1.1, 0.47], rot: 180, pav: 'terreo' },
    { tipo: 'vaso', pos: [2.3, 0.47], rot: 180, pav: 'terreo' },
    { tipo: 'box', pos: [3.4, 0.8], rot: 180, pav: 'terreo' },
    // ---- Sala de estar (disposição do PDF): corredor livre junto às estantes (x 4,1–5,5), sofá em L ao norte
    // virado para a lareira, mesa live edge à frente, tapete redondo com poltrona ao sul, consola atrás do sofá
    { tipo: 'lareira', pos: [8.8, 7.8], rot: -90, pav: 'terreo', altura: 5.6, largura: 2.1 },
    // sofá em L: braço norte (x 5,6–7,6, costas para a consola/jantar) + braço oeste (y 6,5–9,0) virado à lareira
    { tipo: 'sofa_l', pos: [6.6, 9.45], rot: 0, pav: 'terreo', largura: 2.0, retorno: 2.5 },
    { tipo: 'mesa_live_edge', pos: [7.3, 7.55], rot: 90, pav: 'terreo', largura: 1.5, prof: 0.8 },
    { tipo: 'tapete', pos: [7.0, 8.0], rot: 0, dims: [3.2, 3.6], pav: 'terreo', material: 'boucle' },
    { tipo: 'mesa_console', pos: [6.6, 10.2], rot: 180, pav: 'terreo', largura: 1.8 },
    { tipo: 'estante_arcos', pos: [7.29, 3.17], rot: 180, pav: 'terreo', largura: 3.3, altura: 2.7 },
    { tipo: 'tapete_redondo', pos: [7.45, 5.2], pav: 'terreo', raio: 1.05 },
    { tipo: 'poltrona', pos: [6.9, 5.25], rot: 20, pav: 'terreo' },
    { tipo: 'poltrona', pos: [8.0, 5.25], rot: -20, pav: 'terreo' },
    { tipo: 'mesa_lateral', pos: [7.45, 4.6], pav: 'terreo' },
    { tipo: 'lustre_roda', pos: [7.0, 7.6], pav: 'terreo', z: 4.5, raio: 0.65 },
    { tipo: 'porta_celeiro', pos: [4.16, 5.3], rot: 90, pav: 'terreo', largura: 1.0, altura: 2.2 },
    { tipo: 'arandela', pos: [9.0, 4.5], rot: -90, pav: 'terreo', z: 1.8 },
    // ---- Sala de jantar: mesa de fazenda com cadeiras de bouclé, lustre de velas, cristaleira
    { tipo: 'mesa_jantar', pos: [7.0, 12.4], rot: 90, pav: 'terreo', comprimento: 2.6, largura: 1.05, lugares: 8 },
    { tipo: 'tapete', pos: [7.0, 12.4], rot: 0, pav: 'terreo', dims: [2.8, 4.0], material: 'tapete' },
    { tipo: 'lustre_velas', pos: [7.0, 12.4], pav: 'terreo', z: 4.3, corrente: 1.3 },
    { tipo: 'cristaleira', pos: [8.75, 14.7], rot: -90, pav: 'terreo', largura: 1.25 },
    { tipo: 'arandela', pos: [9.0, 10.1], rot: -90, pav: 'terreo', z: 1.8 },
    // ---- Cozinha: armários shaker brancos, ilha com tampo de madeira e pernas torneadas, lanternas
    { tipo: 'ilha', pos: [4.3, 12.0], rot: 90, pav: 'terreo', comprimento: 2.6, prof: 1.0 },
    { tipo: 'armario_cozinha', pos: [2.25, 13.0], rot: 90, pav: 'terreo', largura: 3.0, fogao: true, vidro: true },
    { tipo: 'geladeira', pos: [2.3, 11.0], rot: 90, pav: 'terreo' },
    { tipo: 'armario_cozinha', pos: [3.6, 15.08], rot: 0, pav: 'terreo', largura: 2.34, pia: true, semSuperior: true },
    { tipo: 'pendente', pos: [4.3, 11.3], pav: 'terreo', z: 2.2, corrente: 0.6 },
    { tipo: 'pendente', pos: [4.3, 12.7], pav: 'terreo', z: 2.2, corrente: 0.6 },
    { tipo: 'arandela', pos: [2.1, 15.37], rot: 0, pav: 'terreo', z: 1.95 },
    { tipo: 'arandela', pos: [5.2, 15.37], rot: 0, pav: 'terreo', z: 1.95 },
    // ---- Lavanderia: vigas de madeira, subway, armário de madeira com tanque, máquinas
    { tipo: 'armario_cozinha', pos: [0.42, 12.0], rot: 90, pav: 'terreo', largura: 3.0, tanque: true, semSuperior: true, material: 'carvalho' },
    { tipo: 'maquina', pos: [0.75, 9.15], rot: 180, pav: 'terreo' },
    { tipo: 'vigas_teto', pos: [0.925, 12.1], rot: 0, pav: 'terreo', z: 2.82, comprimento: 1.68, quantidade: 6, passo: 1.05 },
    { tipo: 'prateleira_madeira', pos: [1.7, 14.2], rot: -90, pav: 'terreo', z: 1.6, largura: 1.0 },
    { tipo: 'tapete', pos: [1.0, 11.5], rot: 0, pav: 'terreo', dims: [0.8, 2.6], material: 'tapete' },
    // ---- Varandas
    // (a bay window ocupa a frente da brinquedoteca; as poltronas ficam entre a porta e a bay)
    { tipo: 'poltrona', pos: [4.05, -3.75], rot: 180, pav: 'terreo', z: -0.05, material: 'ratan' },
    { tipo: 'poltrona', pos: [5.5, -3.75], rot: 180, pav: 'terreo', z: -0.05, material: 'ratan' },
    { tipo: 'mesa_lateral', pos: [4.78, -4.1], pav: 'terreo', z: -0.05 },
    { tipo: 'vaso_planta', pos: [1.0, -3.6], pav: 'terreo', z: -0.05, variante: 'oliveira' },
    { tipo: 'sofa', pos: [7.2, 16.8], rot: 180, pav: 'terreo', z: -0.05, material: 'ratan', largura: 1.8 },
    { tipo: 'mesa_lateral', pos: [5.9, 16.8], pav: 'terreo', z: -0.05 },
    { tipo: 'vaso_planta', pos: [1.5, 16.9], pav: 'terreo', z: -0.05, variante: 'oliveira' },

    // ---- Superior · Escritório verde com estante embutida, secretária torneada, sofá de veludo
    { tipo: 'estante_embutida', pos: [1.1, -1.6], rot: 90, pav: 'superior', largura: 3.0, altura: 2.65, material: 'marcenaria_verde' },
    { tipo: 'mesa_escritorio', pos: [2.9, -1.55], rot: 90, pav: 'superior' },
    { tipo: 'sofa', pos: [4.9, -1.6], rot: -90, pav: 'superior', material: 'veludo_verde', largura: 1.9 },
    { tipo: 'tapete', pos: [3.0, -1.6], rot: 0, pav: 'superior', dims: [2.6, 2.2], material: 'boucle' },
    { tipo: 'pendente', pos: [3.0, -1.6], pav: 'superior', z: 2.0, corrente: 0.65 },
    { tipo: 'quadro', pos: [2.6, -0.11], rot: 0, pav: 'superior', z: 1.6, cor: '#6b6a5a', moldura: 'nogueira' },
    { tipo: 'arandela', pos: [1.8, -0.11], rot: 0, pav: 'superior', z: 1.7 },
    { tipo: 'arandela', pos: [3.4, -0.11], rot: 0, pav: 'superior', z: 1.7 },
    // ---- Suíte do filho: papel xadrez, lambri ripado azul, cama-baú, espelho oval
    { tipo: 'cama_solteiro_bau', pos: [1.42, 2.95], rot: 180, pav: 'superior' },
    { tipo: 'prateleira_madeira', pos: [0.92, 4.4], rot: 90, pav: 'superior', z: 1.75, largura: 1.2 },
    { tipo: 'mesa_escritorio', pos: [3.55, 3.4], rot: -90, pav: 'superior', pequena: true },
    { tipo: 'guarda_roupa', pos: [2.4, 5.55], rot: 0, pav: 'superior', largura: 1.8, material: 'nogueira' },
    { tipo: 'espelho_oval', pos: [3.97, 2.2], rot: -90, pav: 'superior', z: 1.15 },
    { tipo: 'tapete', pos: [2.5, 3.6], rot: 0, pav: 'superior', dims: [1.6, 2.2], material: 'couro' },
    { tipo: 'lustre_ratan', pos: [2.4, 3.9], pav: 'superior', z: 2.3 },
    { tipo: 'bancada_lavatorio', pos: [1.6, 0.48], rot: 180, pav: 'superior', material: 'marcenaria_azul' },
    { tipo: 'vaso', pos: [2.7, 0.48], rot: 180, pav: 'superior' },
    { tipo: 'box', pos: [3.45, 0.83], rot: 180, pav: 'superior' },
    // ---- Suíte de hóspedes (superior): floral + sálvia
    { tipo: 'cama', pos: [6.72, -1.65], rot: 90, pav: 'superior', largura: 1.4, estilo: 'madeira' },
    { tipo: 'banco_pe_cama', pos: [8.1, -1.65], rot: 90, pav: 'superior', largura: 1.2 },
    { tipo: 'guarda_roupa', pos: [7.45, 0.68], rot: 0, pav: 'superior', largura: 1.8 },
    { tipo: 'lustre_ratan', pos: [7.03, -1.5], pav: 'superior', z: 2.3 },
    { tipo: 'quadro', pos: [5.6, -1.0], rot: 90, pav: 'superior', z: 1.6, cor: '#7d8f6a' },
    { tipo: 'quadro', pos: [5.6, -2.0], rot: 90, pav: 'superior', z: 1.6, cor: '#9a8a6a' },
    { tipo: 'tapete', pos: [7.2, -1.65], rot: 0, pav: 'superior', dims: [2.4, 2.4] },
    { tipo: 'bancada_lavatorio', pos: [6.4, 2.3], rot: 0, pav: 'superior' },
    { tipo: 'vaso', pos: [7.4, 2.3], rot: 0, pav: 'superior' },
    { tipo: 'box', pos: [8.05, 1.8], rot: 0, pav: 'superior' },
    // ---- Suíte master: cama de nogueira na parede de acento floral, roupeiro, painel de TV, closet aberto
    { tipo: 'guarda_roupa', pos: [0.95, 12.9], rot: 90, pav: 'superior', largura: 4.6 },
    { tipo: 'cama', pos: [2.45, 12.9], rot: 90, pav: 'superior', largura: 1.8, estilo: 'madeira' },
    { tipo: 'banco_pe_cama', pos: [3.9, 12.9], rot: 90, pav: 'superior', largura: 1.5 },
    { tipo: 'painel_tv', pos: [5.12, 12.9], rot: -90, pav: 'superior', largura: 2.8 },
    { tipo: 'closet_aberto', pos: [4.58, 9.55], rot: 90, pav: 'superior', largura: 1.4 },
    { tipo: 'lustre_ratan', pos: [2.9, 12.9], pav: 'superior', z: 2.3 },
    { tipo: 'tapete', pos: [2.9, 12.9], rot: 0, pav: 'superior', dims: [3.0, 2.8], material: 'tapete' },
    { tipo: 'bancada_lavatorio', pos: [1.7, 9.15], rot: 180, pav: 'superior', largura: 1.6 },
    { tipo: 'vaso', pos: [3.0, 9.15], rot: 180, pav: 'superior' },
    { tipo: 'box', pos: [3.75, 9.55], rot: 180, pav: 'superior' },
    // ---- Circulação (superior): lambri bege, galeria de quadros, consola, lanternas
    { tipo: 'galeria', pos: [4.09, 4.2], rot: 90, pav: 'superior', z: 1.65, colunas: 3, linhas: 2 },
    { tipo: 'mesa_console', pos: [5.3, 4.6], rot: -90, pav: 'superior', largura: 1.2 }, // encostada à parede leste (o topo da escada fica livre)
    { tipo: 'pendente', pos: [4.78, 2.0], pav: 'superior', z: 2.05, corrente: 0.55 },
    { tipo: 'pendente', pos: [4.78, 6.8], pav: 'superior', z: 2.05, corrente: 0.55 },
    { tipo: 'tapete', pos: [4.78, 4.5], rot: 0, pav: 'superior', dims: [0.9, 5.5], material: 'tapete' },

    // ---- Subsolo (referências): carros de frente para o portão preto; lounge na faixa leste com chesterfield
    // virado ao painel de TV; bar com bancos e adega em grelha no nicho ao fundo; quadros e luminárias de gaiola
    { tipo: 'carro', pos: [1.45, -1.0], rot: 0, pav: 'subsolo', cor: 'carro_preto' },
    { tipo: 'carro', pos: [3.75, -0.8], rot: 0, pav: 'subsolo', cor: 'carro_vermelho', modelo: 'picape' },
    { tipo: 'spots_teto', pos: [2.6, 1.0], pav: 'subsolo', z: 2.372, colunas: 2, linhas: 4, passoX: 1.6, passoY: 2.2 },
    { tipo: 'spots_teto', pos: [6.3, -0.5], pav: 'subsolo', z: 2.372, colunas: 1, linhas: 3, passoY: 2.0 },
    { tipo: 'portao_garagem', pos: [2.565, -4.36], rot: 0, pav: 'subsolo', largura: 4.0, altura: 2.3 },
    { tipo: 'sofa', pos: [5.45, 2.0], rot: 90, pav: 'subsolo', material: 'couro_caramelo', largura: 2.6, chesterfield: true },
    { tipo: 'mesa_live_edge', pos: [6.5, 2.0], rot: 90, pav: 'subsolo', largura: 1.2, prof: 0.5 },
    { tipo: 'painel_tv', pos: [7.5, 2.0], rot: -90, pav: 'subsolo', material: 'nogueira', largura: 2.8 },
    { tipo: 'tapete', pos: [6.3, 2.0], rot: 0, pav: 'subsolo', dims: [2.2, 3.2], material: 'boucle' },
    { tipo: 'pendente', pos: [6.3, 1.3], pav: 'subsolo', z: 2.05, corrente: 0.3, estilo: 'gaiola' },
    { tipo: 'pendente', pos: [6.3, 2.7], pav: 'subsolo', z: 2.05, corrente: 0.3, estilo: 'gaiola' },
    { tipo: 'galeria', pos: [7.62, 4.5], rot: -90, pav: 'subsolo', z: 1.5, colunas: 2, linhas: 1, largura: 0.6, altura: 0.8 },
    { tipo: 'arandela', pos: [7.62, 3.7], rot: -90, pav: 'subsolo', z: 1.6 },
    { tipo: 'arandela', pos: [7.62, 5.3], rot: -90, pav: 'subsolo', z: 1.6 },
    { tipo: 'vaso_planta', pos: [7.2, -0.2], pav: 'subsolo', variante: 'arbusto' },
    { tipo: 'balcao_bar', pos: [6.3, 6.3], rot: 0, pav: 'subsolo', largura: 2.6, semPrateleiras: true },
    { tipo: 'banqueta', pos: [5.35, 5.5], pav: 'subsolo' },
    { tipo: 'banqueta', pos: [5.98, 5.5], pav: 'subsolo' },
    { tipo: 'banqueta', pos: [6.62, 5.5], pav: 'subsolo' },
    { tipo: 'banqueta', pos: [7.25, 5.5], pav: 'subsolo' },
    { tipo: 'adega', pos: [6.3, 6.9], rot: 0, pav: 'subsolo', largura: 2.6, altura: 2.2 },
    { tipo: 'pendente', pos: [5.7, 6.1], pav: 'subsolo', z: 2.0, corrente: 0.35, estilo: 'gaiola' },
    { tipo: 'pendente', pos: [6.9, 6.1], pav: 'subsolo', z: 2.0, corrente: 0.35, estilo: 'gaiola' },
    { tipo: 'bancada_lavatorio', pos: [3.7, 6.85], rot: 0, pav: 'subsolo', largura: 0.8 },
    { tipo: 'vaso', pos: [4.4, 6.85], rot: 0, pav: 'subsolo' },
  ],

  // Luzes interiores gerais (pontos quentes) onde não há luminária com luz própria.
  luzes: [
    { pos: [7.3, -0.8], pav: 'terreo', z: 2.5, int: 6 },
    { pos: [7.4, 1.9], pav: 'terreo', z: 2.4, int: 4 },
    { pos: [2.0, 0.8], pav: 'terreo', z: 2.4, int: 4 },
    { pos: [4.8, 1.9], pav: 'terreo', z: 2.4, int: 4 },
    { pos: [2.5, 7.9], pav: 'terreo', z: 2.5, int: 5 },
    { pos: [1.0, 12.0], pav: 'terreo', z: 2.4, int: 6 },
    { pos: [3.0, 13.5], pav: 'terreo', z: 2.6, int: 5 },
    { pos: [2.4, 0.8], pav: 'superior', z: 2.4, int: 4 },
    { pos: [7.0, 1.9], pav: 'superior', z: 2.4, int: 4 },
    { pos: [2.4, 9.5], pav: 'superior', z: 2.4, int: 4 },
    { pos: [4.8, 9.5], pav: 'superior', z: 2.4, int: 4 },
    { pos: [2.6, -1.2], pav: 'subsolo', z: 1.9, int: 3 },
    { pos: [2.6, 2.8], pav: 'subsolo', z: 1.9, int: 3 },
    { pos: [4.0, 6.5], pav: 'subsolo', z: 2.0, int: 2 },
  ],
};
