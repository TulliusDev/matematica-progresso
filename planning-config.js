(() => {
  "use strict";

  window.TRAJETORIA_PLANNING_CONFIG = {
  "schemaVersion": 1,
  "planName": "Trajetória — CEFET-MG 2027",
  "timezone": "America/Sao_Paulo",
  "dates": {
    "planStartDate": "2026-09-23",
    "lastRegularStudyDate": "2026-11-27",
    "examDate": "2026-11-29"
  },
  "exam": {
    "durationMinutes": 180,
    "totalQuestions": 50,
    "questionDistribution": {
      "Português": 15,
      "Matemática": 15,
      "Ciências": 8,
      "História": 6,
      "Geografia": 6
    }
  },
  "dailyTargetsMinutes": {
    "2026-09": 90,
    "2026-10": 165,
    "2026-11": 195
  },
  "regularWeekdayCounts": {
    "2026-09": 6,
    "2026-10": 22,
    "2026-11": 20
  },
  "capacity": {
    "regularCapacityMinutes": 8070,
    "regularCapacityHours": 134.5,
    "simulationExtraCapacityMinutes": 720,
    "totalCapacityIncludingSimulationsMinutes": 8790,
    "totalCapacityIncludingSimulationsHours": 146.5
  },
  "workload": {
    "requiredLiteratureMinutes": 90,
    "baseBudgetTotalMinutes": 4320,
    "baseBudgetTotalHours": 72,
    "integrationReserveMinutes": 2910,
    "integrationReserveHours": 48.5,
    "simulationReviewReserveMinutes": 240,
    "simulationReviewReserveHours": 4,
    "simulationPlanMinutes": 720,
    "simulationPlanHours": 12,
    "plannedRegularWorkMinutes": 7470,
    "plannedRegularWorkHours": 124.5,
    "plannedWorkIncludingSimulationsMinutes": 8190,
    "plannedWorkIncludingSimulationsHours": 136.5,
    "initialMarginMinutes": 600,
    "initialMarginHours": 10
  },
  "phaseGuides": {
    "2026-09": {
      "regularMinutes": 540,
      "baseGuideMinutes": 360,
      "integrationGuideMinutes": 180,
      "simulationReviewGuideMinutes": 0,
      "marginGuideMinutes": 0,
      "note": "Referência de fase, sem travar a distribuição do estudo."
    },
    "2026-10": {
      "regularMinutes": 3630,
      "baseGuideMinutes": 2340,
      "integrationGuideMinutes": 1050,
      "simulationReviewGuideMinutes": 60,
      "marginGuideMinutes": 180,
      "note": "Referência de fase, sem travar a distribuição do estudo."
    },
    "2026-11": {
      "regularMinutes": 3900,
      "baseGuideMinutes": 1620,
      "integrationGuideMinutes": 1680,
      "simulationReviewGuideMinutes": 180,
      "marginGuideMinutes": 420,
      "note": "Referência de fase, sem travar a distribuição do estudo."
    }
  },
  "requiredLiterature": {
    "materia": "Português",
    "bloco": "Literatura",
    "topico": "O Alienista — leitura obrigatória",
    "estadoInicial": "não iniciado",
    "budgetMinutes": 90,
    "softTargetMonth": "2026-09",
    "objective": "Estudo ativo: enredo, personagens, ironia/sátira, temas e questões. Obra já lida; sem nova leitura integral."
  },
  "simulationPlan": [
    {
      "id": "sim-1",
      "windowStart": "2026-10-19",
      "windowEnd": "2026-10-25",
      "preferredDate": "2026-10-25",
      "durationMinutes": 180,
      "reviewBudgetMinutes": 60
    },
    {
      "id": "sim-2",
      "windowStart": "2026-11-02",
      "windowEnd": "2026-11-08",
      "preferredDate": "2026-11-08",
      "durationMinutes": 180,
      "reviewBudgetMinutes": 60
    },
    {
      "id": "sim-3",
      "windowStart": "2026-11-09",
      "windowEnd": "2026-11-15",
      "preferredDate": "2026-11-15",
      "durationMinutes": 180,
      "reviewBudgetMinutes": 60
    },
    {
      "id": "sim-4",
      "windowStart": "2026-11-16",
      "windowEnd": "2026-11-21",
      "preferredDate": "2026-11-21",
      "durationMinutes": 180,
      "reviewBudgetMinutes": 60
    }
  ],
  "marginRules": {
    "description": "A margem não gera replanejamento automático. Ela combina aderência ao calendário, eficiência real dos tópicos e estouro de reservas.",
    "initialMarginMinutes": 600,
    "dailyDelta": {
      "pastRegularWeekday": "actualRegularMinutes - targetMinutes",
      "today": "max(0, actualRegularMinutes - targetMinutes)",
      "weekendsAndOutsidePlan": 0,
      "simulationSessionsExcludedFromRegularActual": true
    },
    "topicDelta": {
      "completedWithTrackedTime": "budgetMinutes - actualTrackedMinutes",
      "completedWithoutTrackedTime": 0,
      "incompleteWithinBudget": 0,
      "incompleteOverBudget": "budgetMinutes - actualTrackedMinutes"
    },
    "reserveOverrun": {
      "integration": "-max(0, actualIntegrationMinutes - 2910)",
      "simulationReview": "-max(0, actualSimulationReviewMinutes - 240)"
    },
    "currentMarginFormula": "600 + sum(dailyDelta) + sum(topicDelta) - max(0, integrationMinutes - 2910) - max(0, simulationReviewMinutes - 240)",
    "statusThresholds": {
      "above180": "Plano cabe",
      "from0to180": "Margem curta",
      "below0": "Replanejar"
    }
  },
  "topicBudgets": [
    {
      "materia": "Matemática",
      "bloco": "Álgebra",
      "topico": "Equação do 2º grau",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "Matemática",
      "bloco": "Geometria",
      "topico": "Ângulos",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Matemática",
      "bloco": "Geometria",
      "topico": "Triângulos",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Matemática",
      "bloco": "Geometria",
      "topico": "Quadriláteros e polígonos",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Matemática",
      "bloco": "Geometria",
      "topico": "Perímetro e área",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "Matemática",
      "bloco": "Geometria",
      "topico": "Teorema de Pitágoras",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Matemática",
      "bloco": "Geometria",
      "topico": "Semelhança",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Matemática",
      "bloco": "Geometria",
      "topico": "Circunferência e círculo",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Matemática",
      "bloco": "Geometria",
      "topico": "Geometria espacial e volume",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "Matemática",
      "bloco": "Tratamento da informação",
      "topico": "Tabelas e gráficos",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Matemática",
      "bloco": "Tratamento da informação",
      "topico": "Média, moda e mediana",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Matemática",
      "bloco": "Tratamento da informação",
      "topico": "Probabilidade",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Português",
      "bloco": "Interpretação textual",
      "topico": "Tema, assunto e ideia principal",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Interpretação textual",
      "topico": "Informações explícitas e implícitas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Interpretação textual",
      "topico": "Inferência",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Interpretação textual",
      "topico": "Finalidade e ponto de vista",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Interpretação textual",
      "topico": "Ironia, humor e ambiguidade",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Interpretação textual",
      "topico": "Intertextualidade",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Gêneros textuais",
      "topico": "Notícia e reportagem",
      "estado": "não iniciado",
      "peso_minutos_base": 15
    },
    {
      "materia": "Português",
      "bloco": "Gêneros textuais",
      "topico": "Artigo de opinião",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Gêneros textuais",
      "topico": "Crônica e conto",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Gêneros textuais",
      "topico": "Poema",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Gêneros textuais",
      "topico": "Charge, tirinha e propaganda",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Gêneros textuais",
      "topico": "Texto de divulgação científica",
      "estado": "não iniciado",
      "peso_minutos_base": 15
    },
    {
      "materia": "Português",
      "bloco": "Gramática aplicada",
      "topico": "Classes de palavras",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Português",
      "bloco": "Gramática aplicada",
      "topico": "Verbos",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Português",
      "bloco": "Gramática aplicada",
      "topico": "Frase, oração e período",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Gramática aplicada",
      "topico": "Sujeito e predicado",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Gramática aplicada",
      "topico": "Coordenação e subordinação",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "Português",
      "bloco": "Gramática aplicada",
      "topico": "Concordância",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Português",
      "bloco": "Gramática aplicada",
      "topico": "Pontuação",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Português",
      "bloco": "Linguagem",
      "topico": "Denotação e conotação",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Linguagem",
      "topico": "Figuras de linguagem",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Português",
      "bloco": "Linguagem",
      "topico": "Coesão e coerência",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Português",
      "bloco": "Linguagem",
      "topico": "Variação linguística",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Matéria",
      "topico": "Mudanças de estado",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Matéria",
      "topico": "Propriedades da matéria",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Matéria",
      "topico": "Substâncias e misturas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Matéria",
      "topico": "Separação de misturas",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Estrutura da matéria",
      "topico": "Átomos",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Estrutura da matéria",
      "topico": "Prótons, elétrons e nêutrons",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Estrutura da matéria",
      "topico": "Elementos químicos",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Estrutura da matéria",
      "topico": "Moléculas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Estrutura da matéria",
      "topico": "Tabela periódica — fundamentos",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Estrutura da matéria",
      "topico": "Transformações físicas e químicas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Movimento e repouso",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Velocidade média",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Força",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Massa e peso",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Gravidade",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Trabalho e energia",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Calor e temperatura",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Ondas e som",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Luz e óptica",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Física e energia",
      "topico": "Eletricidade básica",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Célula",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Célula animal e vegetal",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Tecidos, órgãos e sistemas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Sistema digestório",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Sistema respiratório",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Sistema circulatório",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Sistema nervoso",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Reprodução",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Genética básica",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "Ciências",
      "bloco": "Vida",
      "topico": "Evolução",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Ecologia",
      "topico": "Ecossistemas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Ecologia",
      "topico": "Habitat e nicho",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Ecologia",
      "topico": "Cadeias e teias alimentares",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Ecologia",
      "topico": "Relações ecológicas",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Ciências",
      "bloco": "Ecologia",
      "topico": "Biomas brasileiros",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Ecologia",
      "topico": "Impactos ambientais",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Ciências",
      "bloco": "Ecologia",
      "topico": "Mudanças climáticas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Antiguidade",
      "topico": "Egito",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Antiguidade",
      "topico": "Grécia",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Antiguidade",
      "topico": "Roma",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Idade Média",
      "topico": "Feudalismo",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Idade Média",
      "topico": "Igreja medieval",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Idade Média",
      "topico": "Cruzadas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Idade Média",
      "topico": "Crescimento das cidades",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Idade Moderna",
      "topico": "Renascimento",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Idade Moderna",
      "topico": "Reformas religiosas",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Idade Moderna",
      "topico": "Absolutismo",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Idade Moderna",
      "topico": "Mercantilismo",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Idade Moderna",
      "topico": "Expansão marítima",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Idade Moderna",
      "topico": "Colonização das Américas",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Idade Moderna",
      "topico": "Iluminismo",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Revoluções",
      "topico": "Revolução Industrial",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Revoluções",
      "topico": "Independência dos EUA",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Revoluções",
      "topico": "Revolução Francesa",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Revoluções",
      "topico": "Era Napoleônica",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Imperialismo",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Primeira Guerra Mundial",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Revolução Russa",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Crise de 1929",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Fascismo e nazismo",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Segunda Guerra Mundial",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Guerra Fria",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Descolonização",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Mundo Contemporâneo",
      "topico": "Mundo pós-Guerra Fria",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil Colonial",
      "topico": "Povos indígenas antes da colonização",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil Colonial",
      "topico": "Colonização portuguesa",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Brasil Colonial",
      "topico": "Açúcar e escravidão",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Brasil Colonial",
      "topico": "Bandeirantes",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil Colonial",
      "topico": "Mineração",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil Colonial",
      "topico": "Revoltas coloniais",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Brasil Império",
      "topico": "Família Real no Brasil",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil Império",
      "topico": "Independência",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Brasil Império",
      "topico": "Primeiro Reinado",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil Império",
      "topico": "Período Regencial",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Brasil Império",
      "topico": "Segundo Reinado",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Brasil Império",
      "topico": "Café e escravidão",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil Império",
      "topico": "Abolição",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "Proclamação da República",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "República da Espada",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "República Oligárquica",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "Coronelismo",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "Era Vargas",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "República de 1946",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "Ditadura militar",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "Redemocratização",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "História",
      "bloco": "Brasil República",
      "topico": "Constituição de 1988",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Fundamentos",
      "topico": "Espaço geográfico",
      "estado": "não iniciado",
      "peso_minutos_base": 15
    },
    {
      "materia": "Geografia",
      "bloco": "Fundamentos",
      "topico": "Paisagem",
      "estado": "não iniciado",
      "peso_minutos_base": 15
    },
    {
      "materia": "Geografia",
      "bloco": "Fundamentos",
      "topico": "Lugar",
      "estado": "não iniciado",
      "peso_minutos_base": 15
    },
    {
      "materia": "Geografia",
      "bloco": "Fundamentos",
      "topico": "Território",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Fundamentos",
      "topico": "Região",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Cartografia",
      "topico": "Orientação",
      "estado": "não iniciado",
      "peso_minutos_base": 15
    },
    {
      "materia": "Geografia",
      "bloco": "Cartografia",
      "topico": "Pontos cardeais",
      "estado": "não iniciado",
      "peso_minutos_base": 15
    },
    {
      "materia": "Geografia",
      "bloco": "Cartografia",
      "topico": "Latitude e longitude",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Cartografia",
      "topico": "Coordenadas geográficas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Cartografia",
      "topico": "Mapas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Cartografia",
      "topico": "Escalas",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Cartografia",
      "topico": "Fusos horários",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Cartografia",
      "topico": "Projeções cartográficas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Estrutura interna da Terra",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Placas tectônicas",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Relevo",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Rochas e solos",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Atmosfera",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Tempo e clima",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Climas brasileiros",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Hidrografia",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Vegetação",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia física",
      "topico": "Biomas brasileiros",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "População",
      "topico": "População absoluta e relativa",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "População",
      "topico": "Densidade demográfica",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "População",
      "topico": "Crescimento populacional",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "População",
      "topico": "Natalidade e mortalidade",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "População",
      "topico": "Migrações",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "População",
      "topico": "Pirâmides etárias",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "População",
      "topico": "Urbanização",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia econômica",
      "topico": "Agricultura",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia econômica",
      "topico": "Pecuária",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia econômica",
      "topico": "Extrativismo",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia econômica",
      "topico": "Industrialização",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia econômica",
      "topico": "Comércio e serviços",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia econômica",
      "topico": "Fontes de energia",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Geografia econômica",
      "topico": "Transportes",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Brasil",
      "topico": "Regionalização brasileira",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Brasil",
      "topico": "Regiões do Brasil",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Brasil",
      "topico": "Industrialização brasileira",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Brasil",
      "topico": "Urbanização brasileira",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Brasil",
      "topico": "Agropecuária brasileira",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Brasil",
      "topico": "Desigualdades regionais",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Mundo contemporâneo",
      "topico": "Globalização",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Mundo contemporâneo",
      "topico": "Capitalismo",
      "estado": "não iniciado",
      "peso_minutos_base": 45
    },
    {
      "materia": "Geografia",
      "bloco": "Mundo contemporâneo",
      "topico": "Blocos econômicos",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Mundo contemporâneo",
      "topico": "Países desenvolvidos e em desenvolvimento",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Mundo contemporâneo",
      "topico": "Geopolítica",
      "estado": "não iniciado",
      "peso_minutos_base": 60
    },
    {
      "materia": "Geografia",
      "bloco": "Mundo contemporâneo",
      "topico": "Migrações internacionais",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    },
    {
      "materia": "Geografia",
      "bloco": "Mundo contemporâneo",
      "topico": "Problemas ambientais globais",
      "estado": "não iniciado",
      "peso_minutos_base": 30
    }
  ],
  "activeTopicIds": {
    "matematica": [],
    "historia": [
      "his-roma",
      "his-feudalismo",
      "his-renascimento",
      "his-reformas-religiosas",
      "his-absolutismo",
      "his-mercantilismo",
      "his-expansao-maritima",
      "his-iluminismo",
      "his-revolucao-industrial",
      "his-revolucao-francesa",
      "his-imperialismo",
      "his-primeira-guerra",
      "his-revolucao-russa",
      "his-crise-1929",
      "his-fascismo-nazismo",
      "his-segunda-guerra",
      "his-guerra-fria",
      "his-colonizacao-portuguesa",
      "his-acucar-escravidao",
      "his-independencia-brasil",
      "his-segundo-reinado",
      "his-abolicao",
      "his-republica-oligarquica",
      "his-era-vargas",
      "his-ditadura-militar",
      "his-redemocratizacao"
    ],
    "geografia": [
      "geo-latitude-longitude",
      "geo-coordenadas",
      "geo-escalas",
      "geo-fusos",
      "geo-placas-tectonicas",
      "geo-relevo",
      "geo-tempo-clima",
      "geo-climas-brasileiros",
      "geo-hidrografia",
      "geo-biomas-brasileiros",
      "geo-densidade",
      "geo-crescimento-populacional",
      "geo-migracoes",
      "geo-piramides-etarias",
      "geo-urbanizacao",
      "geo-industrializacao",
      "geo-fontes-energia",
      "geo-regionalizacao-brasileira",
      "geo-regioes-brasil",
      "geo-industrializacao-brasileira",
      "geo-urbanizacao-brasileira",
      "geo-agropecuaria-brasileira",
      "geo-desigualdades-regionais",
      "geo-globalizacao",
      "geo-capitalismo",
      "geo-blocos-economicos",
      "geo-desenvolvimento",
      "geo-geopolitica",
      "geo-migracoes-internacionais",
      "geo-problemas-ambientais"
    ]
  },
  "dailyBlocksMinutes": {
    "2026-09": [
      60,
      30
    ],
    "2026-10": [
      105,
      60
    ],
    "2026-11": [
      120,
      75
    ]
  },
  "stateRebase": {
    "version": "2026-09-22",
    "consolidatedSubjects": [
      "matematica"
    ],
    "consolidatedTopicIds": [
      "cie-materia-corpo-objeto",
      "cie-estados-fisicos",
      "cie-mudancas-estado",
      "cie-propriedades-materia",
      "cie-substancias-misturas",
      "cie-separacao-misturas"
    ],
    "correctHistoryTopicIds": [
      "his-o-que-e",
      "his-fontes",
      "his-tempo",
      "his-pre-historia",
      "his-mesopotamia",
      "his-egito",
      "his-grecia"
    ]
  }
};
})();
