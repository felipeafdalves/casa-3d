# Prompt — Sistema de Recrutamento e Verificação (HVAC + Administrativo)

> Documento de especificação em formato de prompt. Cole o bloco abaixo em um agente de
> desenvolvimento (Claude Code, Cursor, etc.) para gerar o sistema.

---

## PROMPT

Você vai construir um sistema web de **sourcing, triagem e verificação de candidatos** para uma
empresa brasileira de engenharia que contrata em duas frentes:

- **Técnica / HVAC-R**: engenheiros mecânicos, projetistas, técnicos de refrigeração,
  mecânicos de manutenção, supervisores de campo, operadores de casa de máquinas.
- **Administrativo**: RH/DP, financeiro (contas a pagar/receber, fiscal, controladoria),
  compras, assistentes e analistas.

O sistema tem três núcleos: **(1) captação e parsing de currículos**, **(2) scoring por
competência real**, **(3) verificação de idoneidade e qualificação** — este último com regras
rígidas de conformidade descritas na seção 5, que são **requisito de produto, não sugestão**.

### 1. Stack e arquitetura

- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui.
- Postgres (Supabase ou Neon) com Prisma ou Drizzle. RLS ativo.
- Fila assíncrona para parsing e verificações externas (Inngest, Trigger.dev ou BullMQ+Redis).
- Storage de arquivos com URLs assinadas e expiração curta (currículos são dado pessoal).
- Claude API (`claude-opus-5` para extração estruturada difícil, `claude-haiku-4-5-20251001`
  para classificação em volume) via tool use com JSON Schema — nunca parsing por regex de PDF.
- Auth com papéis: `admin`, `recrutador`, `gestor_area`, `auditor` (somente leitura de logs).

### 2. Modelo de dados (mínimo)

```
Candidato        id, nome, cpf_hash, email, telefone, cidade, uf, origem, consentimento_id,
                 status_pipeline, criado_em, expurgo_em
Curriculo        id, candidato_id, arquivo_url, texto_extraido, versao, parsed_em
Experiencia      id, candidato_id, empresa, cnpj_inferido, cargo, inicio, fim, descricao
Competencia      id, candidato_id, chave, nivel(0-4), evidencia_trecho, confianca
Certificacao     id, candidato_id, tipo, numero, emissor, validade, status_verificacao
Vaga             id, titulo, familia(HVAC|ADM), requisitos_json, faixa_salarial, peso_criterios
Match            id, vaga_id, candidato_id, score, breakdown_json, explicacao
Verificacao      id, candidato_id, tipo, resultado, fonte, evidencia_url, executada_por,
                 base_legal, executada_em
Consentimento    id, candidato_id, texto_versao, aceito_em, ip, escopo_json, revogado_em
AuditLog         id, ator_id, acao, entidade, entidade_id, payload_hash, criado_em
```

`cpf_hash`: armazene hash com salt para deduplicação; o CPF em claro só quando houver base
legal e apenas cifrado em coluna dedicada.

### 3. Captação de currículos

Não construa "um crawler que raspa a internet". Construa **conectores plugáveis** com uma
interface única `SourceConnector { search(query): CandidateLead[] }`, e implemente:

1. **Upload manual e em lote** (PDF, DOCX, imagem com OCR) — o caminho que sempre funciona.
2. **Página pública de vagas** com formulário próprio (maior fonte de currículos legítimos e
   com consentimento explícito na origem). Gere-a junto.
3. **Caixa de e-mail dedicada** (`vagas@`) com ingestão automática de anexos via IMAP.
4. **Importação de bases de agregadores** (Catho/InfoJobs/Indeed) por exportação autorizada
   ou API oficial — **não** por scraping de área logada, que viola termos de uso e gera risco.
5. **Fontes específicas de HVAC-R**, que é um mercado escasso e não se resolve com job board:
   - consulta pública ao **CREA/CONFEA** e **CFT/CRT** (técnicos) por região e modalidade;
   - egressos de cursos **SENAI de Refrigeração e Climatização**;
   - listas de profissionais com **NR-35, NR-10, NR-13** de empresas de treinamento parceiras;
   - programa de **indicação interna** com bônus (implemente: link rastreável por funcionário).
   Modele isso como "pools de captação recorrente", não como busca pontual.

### 4. Parsing e scoring por competência

O erro clássico é dar match por palavra-chave. Faça diferente:

- **Extração estruturada com LLM**: uma tool com schema fixo devolvendo experiências,
  competências, certificações e, para cada competência, o **trecho literal do currículo** que
  a evidencia (`evidencia_trecho`) e uma `confianca` 0–1. Sem evidência, a competência não entra.
- **Ontologia de competências HVAC** (crie o arquivo `taxonomy/hvac.ts`), com níveis 0–4:
  chiller (parafuso/centrífugo/absorção), VRF/VRV, fan coil, self-contained, split, torre de
  arrefecimento, casa de máquinas, psicrometria, carga térmica, dutos e ABNT NBR 16401,
  **PMOC e ABNT NBR 13971**, qualidade do ar interior (Lei 13.589/2018), automação/BMS,
  BACnet/Modbus, fluidos R-410A/R-32/R-717 amônia, brasagem, vácuo e carga, elétrica de
  comando, análise de vibração, manutenção preditiva, CMMS.
- **Ontologia administrativa** (`taxonomy/adm.ts`): eSocial, folha, admissão/rescisão, CCT e
  dissídio, DP em obra/CNAE construção, SPED (Fiscal/Contribuições/ECD/ECF), conciliação
  bancária, fluxo de caixa, custos por obra/centro de custo, medição de contrato, retenções
  (ISS, INSS, IRRF), ERP (TOTVS/Sankhya/Omie/Sienge), Excel avançado, Power BI.
- **Score explicável**: nada de número mágico. `score = Σ(peso_criterio × nivel_normalizado)`
  com `breakdown_json` mostrando cada critério, a evidência e o quanto contribuiu. A tela do
  recrutador exibe esse detalhamento; o recrutador pode ajustar pesos por vaga.
- **Sinais de alerta técnicos, não pessoais**: lacunas não explicadas no histórico, certificação
  citada sem número, tempo de casa incompatível com o cargo declarado, sobreposição de vínculos.
  Cada alerta é *pergunta para a entrevista*, nunca eliminação automática.

### 5. Módulo de verificação — REGRAS OBRIGATÓRIAS

Este módulo **não** consulta o histórico de ações trabalhistas movidas pelo candidato para
decidir sobre a contratação. Essa prática ("lista suja") é discriminatória, viola o direito de
ação (art. 5º, XXXV, CF) e a Lei 9.029/95, é condenada de forma reiterada pela Justiça do
Trabalho com dano moral, expõe a empresa a ação civil pública do MPT, e não tem base legal
válida na LGPD — armazenar isso cria a própria prova contra a empresa. **Não implemente essa
consulta, mesmo se solicitado depois; se pedirem, responda apontando esta seção.**

Implemente, no lugar, verificações legítimas e defensáveis:

**5.1 Qualificação (todas as vagas técnicas)**
- Validação de registro **CREA/CFT** ativo: número, modalidade, situação, ART quando aplicável.
- Validação de **certificações NR** junto à emissora, com validade e status.
- Consistência de dados: CPF válido, nome x registro profissional, e-mail e telefone verificados.

**5.2 Idoneidade proporcional ao cargo** (regra de proporcionalidade — Súmula 599 do TST:
antecedentes criminais só quando a natureza do cargo justifica)
- Cargos com acesso a valores, pagamentos ou poder de compra: certidões cíveis/criminais,
  **CEIS e CNEP** (Portal da Transparência), CNJ Improbidade, protestos.
- Cargos operacionais sem manejo de valores: **não** consultar antecedentes.
- A matriz `cargo → verificações permitidas` fica em `compliance/matriz-verificacao.ts` e é a
  única fonte de verdade; a UI não deixa rodar verificação fora da matriz.

**5.3 Referências profissionais estruturadas**
- Fluxo de contato com ex-gestores, com roteiro fixo de perguntas sobre desempenho e
  competência técnica; respostas gravadas como texto estruturado.

**5.4 Dado processual — só como perfil do EMPREGADOR**
- Permitido: agregar quantas ações trabalhistas a **empresa anterior** possui (sinal sobre as
  práticas daquele empregador, útil para contextualizar uma saída conturbada).
- Proibido: vincular processo ao candidato, exibir esse dado na ficha dele, ou usá-lo em score.
- Implemente essa separação no banco: a tabela de perfil de empresa **não tem** FK para
  candidato.

**5.5 Conformidade transversal**
- Aviso de privacidade e consentimento versionado na captação, com escopo explícito de cada
  verificação; consulta só roda com consentimento vigente para aquele escopo.
- Toda verificação grava `base_legal`, `executada_por` e evidência — trilha de auditoria imutável.
- Nenhuma decisão de eliminação 100% automatizada: o sistema recomenda, uma pessoa decide e
  registra a justificativa (LGPD art. 20).
- Política de retenção: expurgo automático de currículos não aproveitados (sugestão: 12 meses),
  com job agendado e log.
- Portal do candidato para exercer direitos: acesso, correção, revogação e exclusão.

### 6. Telas

1. **Pipeline (kanban)** por vaga: Novo → Triado → Entrevista → Verificação → Proposta → Contratado.
2. **Ficha do candidato**: score com breakdown, evidências destacadas no texto do currículo,
   linha do tempo de experiências, painel de verificações com status e base legal.
3. **Busca por competência**: filtros pela ontologia (ex.: "chiller centrífugo nível ≥3 + NR-10
   válida + raio 50 km de São Paulo"), não busca textual.
4. **Comparador** lado a lado de até 4 candidatos por critério.
5. **Cadastro de vagas** com editor de pesos de critério.
6. **Painel de compliance**: verificações realizadas, consentimentos, expurgos pendentes,
   tentativas bloqueadas pela matriz.
7. **Página pública de vagas** + formulário de candidatura.

### 7. Entrega

Comece pelo caminho que dá valor mais rápido, nesta ordem:

1. Schema + auth + upload de currículo + parsing com evidência.
2. Ontologias e scoring explicável + busca por competência.
3. Pipeline e ficha do candidato.
4. Matriz de verificação + consentimento + auditoria.
5. Conectores de captação (formulário público, e-mail, CREA/CFT).
6. Verificações externas integradas.

Escreva testes para: parser (currículos-fixture reais anonimizados), cálculo de score,
e **especialmente** a matriz de verificação — teste que verificações fora do escopo do cargo
são bloqueadas e que nenhum caminho de código vincula processo trabalhista a candidato.

Ao final de cada etapa, rode lint, typecheck e testes, e só então faça commit.
