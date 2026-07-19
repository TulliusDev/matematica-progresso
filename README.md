# Trajetória — Matemática

Plataforma pessoal, responsiva e sem dependências para acompanhar o estudo de
Matemática. Além de mostrar quais conteúdos foram cobertos, ela registra evidências
de prática e ajuda a revisar o que pode estar sendo esquecido.

## Como executar

Abra `index.html` diretamente em um navegador moderno. Não é necessário instalar
pacotes nem iniciar um servidor.

## Arquivos

- `index.html`: estrutura semântica do dashboard e das janelas de conteúdo.
- `styles.css`: tema escuro, componentes, responsividade e movimento reduzido.
- `script.js`: dados, cálculos, renderização, revisões e persistência.

## Recursos

- Estados **Não iniciado**, **Em estudo** e **Dominado**.
- Percentuais gerais e por bloco calculados automaticamente.
- Recomendação inteligente que prioriza:
  1. revisões vencidas;
  2. conteúdos que já estão em estudo;
  3. o próximo conteúdo ainda não iniciado.
- Revisões espaçadas com avaliação **Esqueci**, **Difícil**, **Bom** ou **Fácil**.
- Intervalos de revisão configuráveis.
- Registro de baterias de questões e cálculo da taxa de acerto.
- Nível de confiança, anotação rápida e caderno de erros por conteúdo.
- Indicadores gerais de prática e erros ainda não resolvidos.
- Filtros por estado e blocos expansíveis.
- Exportação e importação de backup em JSON.
- Migração automática do progresso salvo pela primeira versão.
- Reinício protegido por confirmação.

## Como utilizar

Clique no nome de um conteúdo para abrir seus detalhes. O botão quadrado à
esquerda permite marcar o domínio rapidamente.

Uma rotina recomendada:

1. Siga o conteúdo indicado no cartão de foco.
2. Mude-o para **Em estudo**.
3. Registre uma bateria de questões.
4. Anote os erros pelo motivo que os causou.
5. Marque como **Dominado** quando conseguir resolver sem ajuda.
6. Quando a revisão aparecer, avalie honestamente a dificuldade.

Marcar um conteúdo como dominado agenda sua primeira revisão. Se **Reabrir ao
esquecer** estiver ativo, escolher **Esqueci** devolve o conteúdo para **Em estudo**.

## Persistência e privacidade

Os dados são armazenados no `localStorage` deste navegador, sob a chave
`trajetoria-matematica-v2`. Nada é enviado para servidores.

Como o armazenamento pertence ao navegador e ao endereço local usados, limpar os
dados do navegador pode apagar o progresso. Use **Configurações e backup →
Exportar backup** para guardar uma cópia.

## Configurações

O ícone de engrenagem abre as preferências. É possível:

- ativar ou desativar revisões;
- alterar os quatro intervalos, em dias;
- escolher se um conteúdo esquecido deve voltar para estudo;
- exportar ou importar os dados;
- reiniciar todo o progresso.

Os intervalos configurados são aplicados aos próximos agendamentos, sem alterar
retroativamente datas já calculadas.

## Alterar os conteúdos

Os blocos ficam no array `blocks`, no início de `script.js`.

### Adicionar um bloco

```js
{
  id: "funcoes",
  name: "Funções",
  topics: [
    { id: "funcao-afim", name: "Função afim", initiallyCompleted: false }
  ]
}
```

### Adicionar um tópico

```js
{ id: "equacao-segundo-grau", name: "Equação do 2º grau", initiallyCompleted: false }
```

Todos os identificadores devem ser únicos, sem espaços e sem acentos.

### Alterar o estado inicial

Mude `initiallyCompleted` para `true` ou `false`. A configuração é usada quando não
existe progresso salvo ou quando o progresso é reiniciado.

## Evoluções futuras

A estrutura já comporta novos campos sem exigir mudanças no HTML. Próximas
evoluções possíveis são metas semanais baseadas em questões, páginas de teoria,
flashcards gerados a partir do caderno de erros e sincronização entre dispositivos.
Elas não foram incluídas agora para preservar o foco e a simplicidade.
