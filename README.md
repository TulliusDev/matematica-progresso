# Trajetória — Painel de Formação Pessoal

Estação pessoal, responsiva e sem dependências. A preparação para CEFET-MG e
COLTEC permanece como objetivo acadêmico prioritário; uma área secundária de
Formação Contínua organiza Violão, Xadrez, Desenho, Inglês e História da Arte.
O painel responde primeiro a **“o que devo praticar agora?”** sem transformar
habilidades permanentes em uma porcentagem enganosa de conclusão total.

## Como executar

Abra `index.html` diretamente em um navegador moderno. Também é possível usar a
extensão Live Server do VS Code; o projeto já mantém a configuração da porta
`5501` em `.vscode/settings.json`.

Não há build, servidor ou framework. O SDK do Supabase é carregado pelo CDN e a
PWA usa somente APIs nativas do navegador.

## Estrutura do projeto

- `index.html`: estrutura semântica, navegação e diálogos reutilizáveis.
- `styles.css`: identidade escura, componentes, estados e responsividade.
- `subjects.js`: catálogo curricular e rotina semanal.
- `storage.js`: estado inicial, normalização, persistência e migrações.
- `script.js`: recomendações, renderização, interações e módulos especiais.
- `data/continuous-core.js`: configuração e construtor comum das trilhas.
- `data/violao.js`, `xadrez.js`, `desenho.js`, `ingles.js` e
  `historia-arte.js`: currículos editáveis da Formação Contínua.
- `continuous-storage.js`: estado, normalização e desbloqueios das trilhas.
- `continuous.js`: cards, caminhos, sessões, revisão e registros mínimos.
- `manifest.webmanifest`: nome, escopo, cores e ícones da PWA.
- `service-worker.js`: cache versionado do shell local e abertura offline.
- `icons/`: ícones de instalação e da tela inicial.
- `.vscode/settings.json`: preferência local do Live Server.

## Áreas disponíveis

### Minha Formação

A página inicial separa explicitamente:

- **Objetivo atual:** CEFET / COLTEC, com o painel completo já existente;
- **Formação contínua:** cinco cards que mostram etapa, habilidade atual,
  dificuldade registrada e botão **Continuar**.

Cada trilha oferece sessões flexíveis de 10, 20 ou 40 minutos e uma opção livre.
Ao terminar, basta registrar **Consegui**, **Parcial** ou **Travei**, com nota
opcional. Habilidades consolidadas retornam numa fila simples de revisão.

Violão inclui repertório; Xadrez registra erros de partidas; Inglês acompanha
sete competências separadamente; História da Arte usa uma linha do tempo e
eixos transversais; Desenho e História da Arte possuem conexões contextuais.

### Painel inicial

O painel considera automaticamente o dia da semana e mostra:

- matéria principal e secundária;
- duração prevista;
- conteúdo recomendado;
- revisões vencidas;
- progresso geral e por matéria;
- dominados, conteúdos ativos e erros;
- atividade recente.

Uma revisão vencida tem prioridade. Depois, a recomendação segue esta ordem:

1. conteúdo em **Consolidando**;
2. conteúdo em **Estudando**;
3. primeiro conteúdo **Não iniciado** da matéria planejada.

No sábado e domingo o painel oferece a revisão semanal, sem obrigar um dos dias.

### Matérias

Existem trilhas completas para:

- Matemática — 26 conteúdos;
- Português — 23 conteúdos;
- Ciências — 39 conteúdos;
- História — 54 conteúdos;
- Geografia — 50 conteúdos.

História utiliza uma apresentação cronológica com períodos. Cada conteúdo de
qualquer matéria aceita quatro estados:

- Não iniciado;
- Estudando;
- Consolidando;
- Dominado.

Também é possível registrar prática, confiança, anotação, erros e revisões.

### Literatura

As obras ficam fora da rotina obrigatória de 80 minutos. Cada ficha permite
registrar progresso de leitura, autor, personagens, narrador, espaço, tempo,
estrutura, conflitos, temas, símbolos, ironias, linguagem, contexto histórico,
anotações, trechos e questões relacionadas.

### Caderno de erros

O caderno reúne automaticamente os erros registrados dentro dos conteúdos e
também permite criar um registro pela área geral. Cada erro contém:

- matéria e conteúdo;
- descrição;
- compreensão correta;
- data;
- situação de revisão;
- quantidade de revisões.

### Revisão semanal

A seleção semanal reúne automaticamente:

- conteúdos movimentados ou praticados na semana;
- conteúdos em **Consolidando**;
- erros não revisados;
- conteúdos dominados sem contato há muitos dias.

O limite de dias sem revisão pode ser alterado nas configurações.

### Provas CEFET/COLTEC

O banco de questões aceita instituição, ano, matéria, resultado, dificuldade,
observação e resolução. Uma questão pode ser vinculada a vários conteúdos da
mesma matéria.

## Persistência, sincronização e migração

Todos os dados continuam armazenados no `localStorage`, sob a chave
`trajetoria-estudos-v3`, para que o site funcione offline. Ao entrar com e-mail,
o estado também é sincronizado com a tabela `study_progress` do Supabase. O site
usa somente a chave publicável; o acesso individual é protegido pelas políticas
RLS configuradas no banco.

A Formação Contínua usa uma chave local independente,
`trajetoria-formacao-continua-v1`. Essa separação evita qualquer alteração ou
perda do progresso CEFET anterior. O backup exportado inclui as duas áreas. Ao
entrar com a mesma conta, o payload JSON do registro `study_progress` também
leva `continuousData`; o merge ocorre por trilha, habilidade e item antes de
atualizar qualquer armazenamento local.

Ao abrir esta versão pela primeira vez, dados das chaves anteriores
`trajetoria-matematica-v2` e `trajetoria-matematica-v1` são migrados
automaticamente. A migração preserva estados, práticas, confiança, anotações,
erros e datas de revisão sempre que houver correspondência.

Na trilha de Matemática, os conteúdos estudados até **Produtos notáveis** ficam
dominados. O estado já registrado de **Fatoração** é preservado.

Use **Configurações → Exportar backup** antes de limpar dados do navegador ou
trocar de endereço. O backup inclui todas as matérias, obras, erros, revisões,
questões e preferências.

## Editar conteúdos e rotina

Todo o currículo está em `subjects.js`, no array `subjects`. Um tópico segue este
formato:

```js
topic("identificador-unico", "Nome do conteúdo")
```

Para iniciar dominado:

```js
topic("identificador-unico", "Nome do conteúdo", "mastered")
```

Os identificadores devem ser únicos em toda a plataforma, sem espaços ou
acentos. Novas matérias utilizam a mesma estrutura de `blocks` e `topics`.

A rotina fica no objeto `schedule`, ao final de `subjects.js`. Os números de `0`
a `6` representam domingo a sábado.

## Publicação no GitHub Pages

Os arquivos do projeto e a pasta `.vscode` podem permanecer na raiz do
repositório. Em **Settings → Pages**, use o branch `main` e a pasta `/ (root)`.
Como os caminhos de CSS e JavaScript são relativos, o site funciona como página
de projeto sem ajustes adicionais.

## PWA

O site pode ser instalado como **Trajetória** no Android, em navegadores que
ofereçam a instalação, ou pelo comando **Adicionar à Tela de Início** do Safari
no iPhone/iPad. O botão **Instalar aplicativo** aparece nas configurações apenas
quando o navegador informa que a instalação nativa está disponível.

O service worker mantém em cache o HTML, CSS, scripts, currículos e ícones
locais. Assim, depois do primeiro acesso online, a interface abre offline e os
dados continuam sendo lidos e gravados no `localStorage`. O service worker não
intercepta nem replica a sincronização: chamadas ao Supabase continuam indo
diretamente à rede e o mecanismo existente envia alterações quando a conexão
volta.

O HTML usa rede primeiro e cache como alternativa; os demais arquivos locais
usam cache com atualização em segundo plano. Para uma publicação que altere o
shell, incremente `static-v1` e `runtime-v1` em `service-worker.js`. O novo worker
assume o controle, remove caches antigos e a versão atualizada aparece na
próxima abertura/navegação, sem recarregamentos automáticos em ciclo.

O manifesto e o registro usam caminhos relativos, portanto funcionam tanto no
domínio principal quanto no subdiretório do GitHub Pages.

Sem login, o progresso continua separado por dispositivo e navegador. Com o
mesmo e-mail conectado, alterações são enviadas ao Supabase e recuperadas nos
outros dispositivos. Atualizar os arquivos sem mudar a URL do site não remove
normalmente o `localStorage`.
