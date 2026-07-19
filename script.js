(() => {
  "use strict";

  const STORAGE_KEY = "trajetoria-matematica-v2";
  const LEGACY_STORAGE_KEY = "trajetoria-matematica-v1";
  const APP_VERSION = 2;
  const DAY_MS = 86_400_000;
  const DEFAULT_INTERVALS = [1, 7, 21, 45];
  const INITIAL_REVIEW_OFFSETS = [1, 2, 3, 5, 7, 9, 11];

  const blocks = [
    {
      id: "numeros-operacoes",
      name: "Números e Operações",
      topics: [
        { id: "operacoes", name: "Operações", initiallyCompleted: true },
        { id: "fracoes", name: "Frações", initiallyCompleted: true },
        { id: "numeros-decimais", name: "Números decimais", initiallyCompleted: true },
        { id: "porcentagem", name: "Porcentagem", initiallyCompleted: true },
        { id: "razao", name: "Razão", initiallyCompleted: true },
        { id: "proporcao", name: "Proporção", initiallyCompleted: true },
      ],
    },
    {
      id: "algebra",
      name: "Álgebra",
      topics: [
        { id: "equacoes", name: "Equações", initiallyCompleted: true },
        { id: "sistemas", name: "Sistemas", initiallyCompleted: false },
        { id: "produtos-notaveis", name: "Produtos notáveis", initiallyCompleted: false },
        { id: "fatoracao", name: "Fatoração", initiallyCompleted: false },
      ],
    },
    {
      id: "geometria-plana",
      name: "Geometria Plana",
      topics: [
        { id: "angulos", name: "Ângulos", initiallyCompleted: false },
        { id: "triangulos", name: "Triângulos", initiallyCompleted: false },
        { id: "poligonos", name: "Polígonos", initiallyCompleted: false },
        { id: "circunferencia", name: "Circunferência", initiallyCompleted: false },
      ],
    },
    {
      id: "medidas",
      name: "Medidas",
      topics: [
        { id: "area", name: "Área", initiallyCompleted: false },
        { id: "perimetro", name: "Perímetro", initiallyCompleted: false },
        { id: "volume", name: "Volume", initiallyCompleted: false },
        { id: "prismas", name: "Prismas", initiallyCompleted: false },
      ],
    },
    {
      id: "estatistica-probabilidade",
      name: "Estatística e Probabilidade",
      topics: [
        { id: "estatistica", name: "Estatística", initiallyCompleted: false },
        { id: "media", name: "Média", initiallyCompleted: false },
        { id: "moda", name: "Moda", initiallyCompleted: false },
        { id: "mediana", name: "Mediana", initiallyCompleted: false },
        { id: "probabilidade", name: "Probabilidade", initiallyCompleted: false },
      ],
    },
    {
      id: "questoes-mistas",
      name: "Questões Mistas",
      topics: [
        { id: "revisao-geral", name: "Revisão geral", initiallyCompleted: false },
        { id: "questoes-combinadas", name: "Questões combinadas", initiallyCompleted: false },
      ],
    },
  ];

  const allTopics = blocks.flatMap((block, blockIndex) =>
    block.topics.map((topic, topicIndex) => ({ ...topic, block, blockIndex, topicIndex }))
  );

  const elements = {};
  const expandedBlocks = new Set(blocks.map((block) => block.id));
  let state = loadState();
  let currentFilter = "all";
  let currentTopicId = null;
  let toastTimer;

  function createTopicState(topic, completedIndex = 0) {
    const mastered = topic.initiallyCompleted;
    const now = Date.now();
    const offset = INITIAL_REVIEW_OFFSETS[completedIndex % INITIAL_REVIEW_OFFSETS.length];

    return {
      status: mastered ? "mastered" : "not-started",
      confidence: 0,
      notes: "",
      attempts: [],
      errors: [],
      masteredAt: mastered ? new Date(now).toISOString() : null,
      review: {
        step: 0,
        lastAt: null,
        nextAt: mastered ? new Date(now + offset * DAY_MS).toISOString() : null,
      },
    };
  }

  function createDefaultState() {
    let completedIndex = 0;
    const topics = {};

    allTopics.forEach((topic) => {
      topics[topic.id] = createTopicState(topic, completedIndex);
      if (topic.initiallyCompleted) completedIndex += 1;
    });

    return {
      version: APP_VERSION,
      topics,
      activities: [],
      settings: {
        reviewsEnabled: true,
        reviewIntervals: [...DEFAULT_INTERVALS],
        reopenForgotten: true,
      },
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.version === APP_VERSION && saved.topics) {
        return normalizeState(saved);
      }

      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
      if (legacy?.progress) {
        return migrateLegacyState(legacy);
      }
    } catch (error) {
      console.warn("Não foi possível restaurar o progresso salvo.", error);
    }

    return createDefaultState();
  }

  function migrateLegacyState(legacy) {
    const migrated = createDefaultState();
    let completedIndex = 0;

    allTopics.forEach((topic) => {
      const completed =
        typeof legacy.progress[topic.id] === "boolean"
          ? legacy.progress[topic.id]
          : topic.initiallyCompleted;
      migrated.topics[topic.id] = createTopicState(
        { ...topic, initiallyCompleted: completed },
        completedIndex
      );
      if (completed) completedIndex += 1;
    });

    if (legacy.lastActivity?.topic) {
      migrated.activities.push({
        id: createId(),
        type: "mastery",
        topicId: null,
        description: `${legacy.lastActivity.topic} dominado`,
        timestamp: legacy.lastActivity.timestamp || new Date().toISOString(),
      });
    }

    saveState(migrated);
    return migrated;
  }

  function normalizeState(candidate) {
    const defaults = createDefaultState();
    const normalized = {
      version: APP_VERSION,
      topics: {},
      activities: Array.isArray(candidate.activities)
        ? candidate.activities.filter((item) => item && item.timestamp).slice(-100)
        : [],
      settings: {
        reviewsEnabled:
          typeof candidate.settings?.reviewsEnabled === "boolean"
            ? candidate.settings.reviewsEnabled
            : true,
        reviewIntervals: normalizeIntervals(candidate.settings?.reviewIntervals),
        reopenForgotten:
          typeof candidate.settings?.reopenForgotten === "boolean"
            ? candidate.settings.reopenForgotten
            : true,
      },
    };

    allTopics.forEach((topic) => {
      const fallback = defaults.topics[topic.id];
      const source = candidate.topics?.[topic.id];
      const status = ["not-started", "studying", "mastered"].includes(source?.status)
        ? source.status
        : fallback.status;

      normalized.topics[topic.id] = {
        status,
        confidence: clampNumber(source?.confidence, 0, 5, 0),
        notes: typeof source?.notes === "string" ? source.notes.slice(0, 800) : "",
        attempts: Array.isArray(source?.attempts)
          ? source.attempts
              .filter(
                (attempt) =>
                  attempt &&
                  Number.isFinite(Number(attempt.correct)) &&
                  Number.isFinite(Number(attempt.total)) &&
                  Number(attempt.total) > 0
              )
              .map((attempt) => ({
                id: String(attempt.id || createId()),
                correct: Math.min(
                  Math.max(1, Number(attempt.total)),
                  Math.max(0, Number(attempt.correct))
                ),
                total: Math.max(1, Number(attempt.total)),
                timestamp: attempt.timestamp || new Date().toISOString(),
              }))
              .slice(-50)
          : [],
        errors: Array.isArray(source?.errors)
          ? source.errors
              .filter((error) => error && typeof error.text === "string")
              .map((error) => ({
                id: String(error.id || createId()),
                text: error.text.slice(0, 240),
                resolved: Boolean(error.resolved),
                timestamp: error.timestamp || new Date().toISOString(),
              }))
              .slice(-50)
          : [],
        masteredAt:
          status === "mastered" && typeof source?.masteredAt === "string"
            ? source.masteredAt
            : status === "mastered"
              ? fallback.masteredAt
              : null,
        review: {
          step: clampNumber(source?.review?.step, 0, 20, 0),
          lastAt: typeof source?.review?.lastAt === "string" ? source.review.lastAt : null,
          nextAt:
            status === "mastered" && typeof source?.review?.nextAt === "string"
              ? source.review.nextAt
              : status === "mastered"
                ? fallback.review.nextAt
                : null,
        },
      };
    });

    return normalized;
  }

  function normalizeIntervals(intervals) {
    if (!Array.isArray(intervals) || intervals.length !== 4) return [...DEFAULT_INTERVALS];
    return intervals.map((value, index) =>
      clampNumber(value, 1, 365, DEFAULT_INTERVALS[index])
    );
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
  }

  function saveState(nextState = state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (error) {
      console.warn("Não foi possível salvar o progresso.", error);
      showToast("Não foi possível salvar neste navegador.");
    }
  }

  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function findTopic(topicId) {
    return allTopics.find((topic) => topic.id === topicId) || null;
  }

  function getTopicStats(topicId) {
    const topicState = state.topics[topicId];
    const totals = topicState.attempts.reduce(
      (result, attempt) => ({
        correct: result.correct + attempt.correct,
        total: result.total + attempt.total,
      }),
      { correct: 0, total: 0 }
    );

    return {
      ...totals,
      accuracy: totals.total ? Math.round((totals.correct / totals.total) * 100) : null,
      openErrors: topicState.errors.filter((error) => !error.resolved).length,
    };
  }

  function isReviewDue(topicId) {
    if (!state.settings.reviewsEnabled) return false;
    const topicState = state.topics[topicId];
    if (topicState.status !== "mastered" || !topicState.review.nextAt) return false;
    return new Date(topicState.review.nextAt).getTime() <= endOfToday().getTime();
  }

  function getBlockStats(block) {
    const mastered = block.topics.filter(
      (topic) => state.topics[topic.id].status === "mastered"
    ).length;

    return {
      mastered,
      total: block.topics.length,
      percentage: Math.round((mastered / block.topics.length) * 100),
      isComplete: mastered === block.topics.length,
    };
  }

  function getOverallStats() {
    const mastered = allTopics.filter(
      (topic) => state.topics[topic.id].status === "mastered"
    ).length;
    const studying = allTopics.filter(
      (topic) => state.topics[topic.id].status === "studying"
    ).length;
    const due = allTopics.filter((topic) => isReviewDue(topic.id)).length;
    const completedBlocks = blocks.filter((block) => getBlockStats(block).isComplete).length;
    const practice = allTopics.reduce(
      (result, topic) => {
        const stats = getTopicStats(topic.id);
        result.correct += stats.correct;
        result.total += stats.total;
        result.openErrors += stats.openErrors;
        return result;
      },
      { correct: 0, total: 0, openErrors: 0 }
    );

    return {
      mastered,
      studying,
      due,
      total: allTopics.length,
      completedBlocks,
      percentage: Math.round((mastered / allTopics.length) * 100),
      practice,
      accuracy: practice.total
        ? Math.round((practice.correct / practice.total) * 100)
        : null,
    };
  }

  function getFocusTopic() {
    const dueTopics = allTopics
      .filter((topic) => isReviewDue(topic.id))
      .sort(
        (a, b) =>
          new Date(state.topics[a.id].review.nextAt) -
          new Date(state.topics[b.id].review.nextAt)
      );

    if (dueTopics.length) {
      return {
        topic: dueTopics[0],
        type: "review",
        label: "Revisão prioritária",
        reason:
          dueTopics.length === 1
            ? "Há uma revisão esperando por você."
            : `Há ${dueTopics.length} revisões esperando por você.`,
      };
    }

    const studying = allTopics.find((topic) => state.topics[topic.id].status === "studying");
    if (studying) {
      return {
        topic: studying,
        type: "studying",
        label: "Continue de onde parou",
        reason: "Concluir o que já começou reduz a dispersão.",
      };
    }

    const pending = allTopics.find(
      (topic) => state.topics[topic.id].status === "not-started"
    );
    if (pending) {
      return {
        topic: pending,
        type: "next",
        label: "Próximo passo recomendado",
        reason: "Primeiro conteúdo pendente na ordem da trilha.",
      };
    }

    return null;
  }

  function renderBlocks({ celebratedTopicId = null, celebratedBlockId = null } = {}) {
    const focus = getFocusTopic();
    const visibleBlocks = blocks.filter((block) =>
      block.topics.some((topic) => topicMatchesFilter(topic.id))
    );

    elements.blocksContainer.innerHTML = visibleBlocks
      .map((block) => {
        const blockIndex = blocks.findIndex((item) => item.id === block.id);
        const stats = getBlockStats(block);
        const expanded = expandedBlocks.has(block.id);
        const visibleTopics = block.topics.filter((topic) => topicMatchesFilter(topic.id));

        return `
          <article class="block-card ${stats.isComplete ? "mastered" : ""} ${
            celebratedBlockId === block.id ? "just-mastered" : ""
          }" data-block-id="${block.id}">
            <button
              class="block-toggle"
              type="button"
              aria-expanded="${expanded}"
              aria-controls="topics-${block.id}"
            >
              <span class="block-number">${String(blockIndex + 1).padStart(2, "0")}</span>
              <span class="block-heading">
                <span class="block-title-row">
                  <h3>${escapeHTML(block.name)}</h3>
                  ${stats.isComplete ? '<span class="mastered-badge">Bloco dominado</span>' : ""}
                </span>
                <p>${stats.mastered} de ${stats.total} conteúdos dominados</p>
              </span>
              <span class="chevron" aria-hidden="true">⌄</span>
            </button>
            <div class="block-progress">
              <div
                class="progress-track"
                role="progressbar"
                aria-label="Progresso de ${escapeHTML(block.name)}"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${stats.percentage}"
              >
                <span style="width: ${stats.percentage}%"></span>
              </div>
              <span>${stats.percentage}%</span>
            </div>
            <ul class="topic-list" id="topics-${block.id}" ${expanded ? "" : "hidden"}>
              ${visibleTopics
                .map((topic) =>
                  renderTopic(topic, focus?.topic.id, celebratedTopicId)
                )
                .join("")}
            </ul>
          </article>
        `;
      })
      .join("");

    elements.emptyState.hidden = visibleBlocks.length > 0;
  }

  function renderTopic(topic, focusTopicId, celebratedTopicId) {
    const topicState = state.topics[topic.id];
    const stats = getTopicStats(topic.id);
    const due = isReviewDue(topic.id);
    const recommended = focusTopicId === topic.id;
    const statusClass = due ? "due" : topicState.status;
    const statusText = due
      ? "Revisar"
      : topicState.status === "mastered"
        ? "Dominado"
        : topicState.status === "studying"
          ? "Em estudo"
          : "Não iniciado";
    const evidence = [];
    if (stats.accuracy !== null) evidence.push(`${stats.accuracy}% em questões`);
    if (topicState.confidence) evidence.push(`confiança ${topicState.confidence}/5`);
    if (stats.openErrors) evidence.push(`${stats.openErrors} erro${stats.openErrors > 1 ? "s" : ""}`);

    return `
      <li
        class="topic-item ${statusClass} ${recommended ? "recommended" : ""} ${
          celebratedTopicId === topic.id ? "celebrate" : ""
        }"
        id="topic-${topic.id}"
      >
        <button
          class="quick-state"
          type="button"
          data-quick-topic="${topic.id}"
          aria-label="${
            topicState.status === "mastered"
              ? `Mover ${escapeHTML(topic.name)} para em estudo`
              : `Marcar ${escapeHTML(topic.name)} como dominado`
          }"
          title="${
            topicState.status === "mastered" ? "Mover para em estudo" : "Marcar como dominado"
          }"
        >
          <span aria-hidden="true">${due ? "↻" : topicState.status === "mastered" ? "✓" : ""}</span>
        </button>
        <button class="topic-open" type="button" data-topic-id="${topic.id}">
          <span class="topic-main">
            <span class="topic-name">${escapeHTML(topic.name)}</span>
            <span class="topic-evidence">${evidence.length ? evidence.join(" · ") : "Sem evidências registradas"}</span>
          </span>
          <span class="topic-meta">
            ${recommended ? '<span class="recommended-label">Foco</span>' : ""}
            <span class="topic-status">${statusText}</span>
            <span class="topic-arrow" aria-hidden="true">→</span>
          </span>
        </button>
      </li>
    `;
  }

  function topicMatchesFilter(topicId) {
    const topicState = state.topics[topicId];
    if (currentFilter === "pending") return topicState.status !== "mastered";
    if (currentFilter === "studying") return topicState.status === "studying";
    if (currentFilter === "review") return isReviewDue(topicId);
    if (currentFilter === "mastered") return topicState.status === "mastered";
    return true;
  }

  function updateDashboard() {
    const stats = getOverallStats();
    const focus = getFocusTopic();

    elements.overallPercentage.textContent = `${stats.percentage}%`;
    elements.progressRing.style.setProperty("--progress", `${stats.percentage * 3.6}deg`);
    elements.overallBar.style.width = `${stats.percentage}%`;
    elements.overallTrack.setAttribute("aria-valuenow", String(stats.percentage));
    elements.masteredCount.textContent = stats.mastered;
    elements.totalCount.textContent = `de ${stats.total} conteúdos`;
    elements.completedBlocks.textContent = stats.completedBlocks;
    elements.totalBlocks.textContent = `de ${blocks.length} blocos`;
    elements.dueCount.textContent = stats.due;
    elements.reviewStatus.textContent = state.settings.reviewsEnabled
      ? stats.due === 1
        ? "para hoje"
        : "para hoje"
      : "desativadas";
    elements.reviewStat.classList.toggle("has-due", stats.due > 0);
    elements.progressMessage.textContent = getProgressMessage(stats.percentage, stats.due);

    elements.studyingCount.textContent = stats.studying;
    elements.accuracyValue.textContent =
      stats.accuracy === null ? "—" : `${stats.accuracy}%`;
    elements.practiceSummary.textContent = stats.practice.total
      ? `${stats.practice.correct} acertos em ${stats.practice.total} questões`
      : "nenhuma questão ainda";
    elements.openErrorsCount.textContent = stats.practice.openErrors;

    updateFocusCard(focus);
    updateLastActivity();
  }

  function updateFocusCard(focus) {
    elements.focusCard.classList.remove("review", "studying", "complete");

    if (!focus) {
      elements.focusCard.classList.add("complete");
      elements.focusLabel.textContent = "Trilha concluída";
      elements.focusTitle.textContent = "Todos os conteúdos foram dominados.";
      elements.focusContext.textContent =
        state.settings.reviewsEnabled
          ? "Você está em dia. As próximas revisões aparecerão aqui."
          : "Ative as revisões nas configurações para acompanhar a retenção.";
      elements.focusReason.textContent = "Excelente trabalho.";
      elements.focusIcon.textContent = "✓";
      elements.goToFocus.hidden = true;
      return;
    }

    elements.focusCard.classList.add(focus.type);
    elements.focusLabel.textContent = focus.label;
    elements.focusTitle.textContent = focus.topic.name;
    elements.focusContext.textContent = `Bloco ${focus.topic.blockIndex + 1} — ${focus.topic.block.name}`;
    elements.focusReason.textContent = focus.reason;
    elements.focusIcon.textContent = focus.type === "review" ? "↻" : "↗";
    elements.goToFocus.textContent = focus.type === "review" ? "Revisar agora →" : "Abrir conteúdo →";
    elements.goToFocus.hidden = false;
  }

  function getProgressMessage(percentage, dueCount) {
    if (dueCount > 0) {
      return `${dueCount} revisão${dueCount > 1 ? "ões" : ""} pode${
        dueCount > 1 ? "m" : ""
      } fortalecer seu domínio hoje.`;
    }
    if (percentage === 100) return "Trilha concluída e revisões em dia.";
    if (percentage >= 75) return "A reta final já está à vista.";
    if (percentage >= 50) return "Mais da metade da jornada concluída.";
    if (percentage >= 25) return "Uma base consistente está tomando forma.";
    return "Cada avanço fortalece a sua base.";
  }

  function updateLastActivity() {
    const activity = [...state.activities].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    )[0];

    if (!activity) {
      elements.lastActivity.innerHTML =
        '<span class="activity-dot" aria-hidden="true"></span><span>Nenhuma atividade recente</span>';
      return;
    }

    elements.lastActivity.innerHTML = `
      <span class="activity-dot" aria-hidden="true"></span>
      <span>${escapeHTML(activity.description)} · ${formatRelativeDate(activity.timestamp)}</span>
    `;
  }

  function setTopicStatus(topicId, newStatus, options = {}) {
    const topic = findTopic(topicId);
    const topicState = state.topics[topicId];
    if (!topic || !topicState || topicState.status === newStatus) return;

    const blockWasComplete = getBlockStats(topic.block).isComplete;
    const previousStatus = topicState.status;
    topicState.status = newStatus;

    if (newStatus === "mastered") {
      topicState.masteredAt = new Date().toISOString();
      topicState.review = {
        step: 0,
        lastAt: null,
        nextAt: addDays(new Date(), state.settings.reviewIntervals[0]).toISOString(),
      };
      addActivity("mastery", topicId, `${topic.name} dominado`);
    } else {
      topicState.masteredAt = null;
      topicState.review.nextAt = null;
      if (newStatus === "studying" && previousStatus === "not-started") {
        addActivity("started", topicId, `${topic.name} iniciado`);
      } else if (previousStatus === "mastered" && !options.silent) {
        addActivity("reopened", topicId, `${topic.name} voltou para estudo`);
      }
    }

    saveState();
    const blockIsComplete = getBlockStats(topic.block).isComplete;
    refreshAll({
      celebratedTopicId: newStatus === "mastered" ? topicId : null,
      celebratedBlockId:
        !blockWasComplete && blockIsComplete && newStatus === "mastered"
          ? topic.block.id
          : null,
    });

    if (!options.silent) {
      if (newStatus === "mastered" && getOverallStats().percentage === 100) {
        showToast("Trilha completa. Agora mantenha o conhecimento com as revisões.");
      } else if (!blockWasComplete && blockIsComplete) {
        showToast(`${topic.block.name}: bloco dominado!`);
      } else if (newStatus === "mastered") {
        showToast(`${topic.name} dominado. Primeira revisão agendada.`);
      } else if (newStatus === "studying") {
        showToast(`${topic.name} está em estudo.`);
      } else {
        showToast(`${topic.name} voltou para não iniciado.`);
      }
    }
  }

  function quickToggleTopic(topicId) {
    const topicState = state.topics[topicId];
    setTopicStatus(topicId, topicState.status === "mastered" ? "studying" : "mastered");
  }

  function addActivity(type, topicId, description) {
    state.activities.push({
      id: createId(),
      type,
      topicId,
      description,
      timestamp: new Date().toISOString(),
    });
    state.activities = state.activities.slice(-100);
  }

  function openTopicDialog(topicId) {
    const topic = findTopic(topicId);
    if (!topic) return;

    currentTopicId = topicId;
    populateTopicDialog();
    openDialog(elements.topicDialog);
  }

  function populateTopicDialog() {
    const topic = findTopic(currentTopicId);
    const topicState = state.topics[currentTopicId];
    if (!topic || !topicState) return;

    const stats = getTopicStats(currentTopicId);
    const due = isReviewDue(currentTopicId);

    elements.topicDialogBlock.textContent = `Bloco ${topic.blockIndex + 1} — ${topic.block.name}`;
    elements.topicDialogTitle.textContent = topic.name;
    elements.statePicker.querySelectorAll("[data-state]").forEach((button) => {
      const active = button.dataset.state === topicState.status;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    elements.topicReviewDate.textContent = getReviewDateText(topicState);
    elements.reviewPanel.hidden = !due;
    elements.topicAccuracy.textContent =
      stats.accuracy === null
        ? "Sem dados"
        : `${stats.accuracy}% · ${stats.correct}/${stats.total}`;
    elements.topicNotes.value = topicState.notes;
    elements.topicOpenErrors.textContent = `${stats.openErrors} pendente${
      stats.openErrors === 1 ? "" : "s"
    }`;

    elements.confidencePicker.querySelectorAll("[data-confidence]").forEach((button) => {
      const active = Number(button.dataset.confidence) === topicState.confidence;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    renderAttempts(topicState);
    renderErrors(topicState);
    elements.practiceFeedback.textContent = "";
  }

  function getReviewDateText(topicState) {
    if (!state.settings.reviewsEnabled) return "Revisões desativadas";
    if (topicState.status !== "mastered" || !topicState.review.nextAt) return "";
    if (isReviewDue(currentTopicId)) return "Revisão disponível";
    return `Próxima revisão: ${formatDate(topicState.review.nextAt)}`;
  }

  function renderAttempts(topicState) {
    const attempts = [...topicState.attempts].reverse().slice(0, 4);
    elements.attemptsList.innerHTML = attempts.length
      ? attempts
          .map((attempt) => {
            const accuracy = Math.round((attempt.correct / attempt.total) * 100);
            return `
              <div class="attempt-row">
                <span>${accuracy}% <small>${attempt.correct}/${attempt.total} questões</small></span>
                <span>${formatRelativeDate(attempt.timestamp)}</span>
              </div>
            `;
          })
          .join("")
      : '<p class="list-placeholder">As últimas práticas aparecerão aqui.</p>';
  }

  function renderErrors(topicState) {
    const errors = [...topicState.errors].reverse();
    elements.errorsList.innerHTML = errors.length
      ? errors
          .map(
            (error) => `
              <li class="${error.resolved ? "resolved" : ""}">
                <button
                  class="error-toggle"
                  type="button"
                  data-error-toggle="${escapeHTML(error.id)}"
                  aria-label="${error.resolved ? "Reabrir erro" : "Marcar erro como resolvido"}"
                >
                  <span aria-hidden="true">${error.resolved ? "✓" : ""}</span>
                </button>
                <span>${escapeHTML(error.text)}</span>
                <button
                  class="error-delete"
                  type="button"
                  data-error-delete="${escapeHTML(error.id)}"
                  aria-label="Excluir erro"
                >×</button>
              </li>
            `
          )
          .join("")
      : '<li class="list-placeholder">Nenhum erro registrado neste conteúdo.</li>';
  }

  function registerPractice(event) {
    event.preventDefault();
    const correct = Number(elements.practiceCorrect.value);
    const total = Number(elements.practiceTotal.value);

    if (!Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || correct < 0) {
      elements.practiceFeedback.textContent = "Informe números inteiros válidos.";
      return;
    }
    if (correct > total) {
      elements.practiceFeedback.textContent = "Os acertos não podem superar o total.";
      return;
    }

    const topic = findTopic(currentTopicId);
    const topicState = state.topics[currentTopicId];
    topicState.attempts.push({
      id: createId(),
      correct,
      total,
      timestamp: new Date().toISOString(),
    });
    topicState.attempts = topicState.attempts.slice(-50);

    if (topicState.status === "not-started") {
      topicState.status = "studying";
      addActivity("started", currentTopicId, `${topic.name} iniciado`);
    }
    addActivity("practice", currentTopicId, `${correct}/${total} em ${topic.name}`);
    saveState();
    elements.practiceForm.reset();
    refreshAll();

    const accuracy = Math.round((correct / total) * 100);
    elements.practiceFeedback.textContent =
      accuracy >= 80
        ? "Boa prática. Considere o domínio se também conseguir explicar o raciocínio."
        : "Prática salva. Revise os erros antes da próxima tentativa.";
    showToast(`Prática registrada em ${topic.name}.`);
  }

  function setConfidence(level) {
    state.topics[currentTopicId].confidence = clampNumber(level, 1, 5, 1);
    saveState();
    populateTopicDialog();
    renderBlocks();
    updateDashboard();
  }

  function saveNotes() {
    state.topics[currentTopicId].notes = elements.topicNotes.value.trim().slice(0, 800);
    saveState();
    showToast("Anotação salva.");
  }

  function addError(event) {
    event.preventDefault();
    const text = elements.errorText.value.trim();
    if (!text) return;

    const topic = findTopic(currentTopicId);
    const topicState = state.topics[currentTopicId];
    topicState.errors.push({
      id: createId(),
      text: text.slice(0, 240),
      resolved: false,
      timestamp: new Date().toISOString(),
    });
    if (topicState.status === "not-started") topicState.status = "studying";
    addActivity("error", currentTopicId, `Erro registrado em ${topic.name}`);
    saveState();
    elements.errorForm.reset();
    refreshAll();
    showToast("Erro adicionado ao caderno.");
  }

  function toggleError(errorId) {
    const error = state.topics[currentTopicId].errors.find((item) => item.id === errorId);
    if (!error) return;
    error.resolved = !error.resolved;
    if (error.resolved) {
      const topic = findTopic(currentTopicId);
      addActivity("error-resolved", currentTopicId, `Erro resolvido em ${topic.name}`);
    }
    saveState();
    refreshAll();
  }

  function deleteError(errorId) {
    const topicState = state.topics[currentTopicId];
    topicState.errors = topicState.errors.filter((item) => item.id !== errorId);
    saveState();
    refreshAll();
    showToast("Registro removido.");
  }

  function rateReview(rating) {
    const topic = findTopic(currentTopicId);
    const topicState = state.topics[currentTopicId];
    if (!topic || !topicState) return;

    let nextStep = topicState.review.step;
    let message;

    if (rating === "forgot") {
      nextStep = 0;
      if (state.settings.reopenForgotten) {
        topicState.status = "studying";
        topicState.masteredAt = null;
        topicState.review.nextAt = null;
        message = `${topic.name} voltou para estudo.`;
      } else {
        topicState.review.nextAt = addDays(
          new Date(),
          state.settings.reviewIntervals[0]
        ).toISOString();
        message = "Revisão curta agendada para amanhã.";
      }
    } else {
      if (rating === "hard") nextStep = Math.max(0, nextStep - 1);
      if (rating === "good") nextStep += 1;
      if (rating === "easy") nextStep += 2;

      const intervalIndex = Math.min(nextStep, state.settings.reviewIntervals.length - 1);
      const interval = state.settings.reviewIntervals[intervalIndex];
      topicState.review.nextAt = addDays(new Date(), interval).toISOString();
      message = `Próxima revisão em ${interval} dia${interval === 1 ? "" : "s"}.`;
    }

    topicState.review.step = nextStep;
    topicState.review.lastAt = new Date().toISOString();
    addActivity("review", currentTopicId, `${topic.name} revisado`);
    saveState();
    refreshAll();
    showToast(message);
  }

  function refreshAll(renderOptions = {}) {
    renderBlocks(renderOptions);
    updateDashboard();
    if (currentTopicId && elements.topicDialog.open) populateTopicDialog();
  }

  function goToFocus() {
    const focus = getFocusTopic();
    if (!focus) return;
    openTopicDialog(focus.topic.id);
  }

  function openSettings() {
    populateSettings();
    openDialog(elements.settingsDialog);
  }

  function populateSettings() {
    elements.reviewsEnabled.checked = state.settings.reviewsEnabled;
    elements.reopenForgotten.checked = state.settings.reopenForgotten;
    state.settings.reviewIntervals.forEach((interval, index) => {
      elements[`interval${index + 1}`].value = interval;
    });
    elements.intervalSettings.disabled = !state.settings.reviewsEnabled;
  }

  function saveSettings() {
    const intervals = [1, 2, 3, 4].map((index) =>
      clampNumber(elements[`interval${index}`].value, 1, 365, DEFAULT_INTERVALS[index - 1])
    );
    const ascending = intervals.every((interval, index) => index === 0 || interval > intervals[index - 1]);

    if (!ascending) {
      showToast("Os intervalos devem crescer a cada etapa.");
      return;
    }

    state.settings.reviewsEnabled = elements.reviewsEnabled.checked;
    state.settings.reopenForgotten = elements.reopenForgotten.checked;
    state.settings.reviewIntervals = intervals;
    saveState();
    closeDialog(elements.settingsDialog);
    refreshAll();
    showToast("Configurações salvas.");
  }

  function exportData() {
    const backup = {
      app: "trajetoria-matematica",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trajetoria-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exportado.");
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.app !== "trajetoria-matematica" || !parsed.data?.topics) {
          throw new Error("Formato incompatível");
        }
        state = normalizeState(parsed.data);
        saveState();
        closeDialog(elements.settingsDialog);
        refreshAll();
        showToast("Backup importado com sucesso.");
      } catch (error) {
        console.warn("Falha ao importar backup.", error);
        showToast("Este arquivo não é um backup válido.");
      } finally {
        elements.importData.value = "";
      }
    });
    reader.readAsText(file);
  }

  function resetProgress() {
    state = createDefaultState();
    currentFilter = "all";
    elements.statusFilter.value = "all";
    expandedBlocks.clear();
    blocks.forEach((block) => expandedBlocks.add(block.id));
    saveState();
    closeDialog(elements.resetDialog);
    closeDialog(elements.settingsDialog);
    refreshAll();
    showToast("Progresso restaurado ao estado inicial.");
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("visible");
    }, 3000);
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog.open) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * DAY_MS);
  }

  function endOfToday() {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  }

  function formatDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "data indisponível";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  }

  function formatRelativeDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "recentemente";
    const difference = Date.now() - date.getTime();
    if (difference < 60_000) return "agora";
    if (difference < 3_600_000) return `há ${Math.floor(difference / 60_000)} min`;
    if (difference < DAY_MS) return `há ${Math.floor(difference / 3_600_000)} h`;
    if (difference < DAY_MS * 7) return `há ${Math.floor(difference / DAY_MS)} d`;
    return formatDate(date);
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cacheElements() {
    const ids = [
      "open-settings",
      "last-activity",
      "progress-ring",
      "overall-percentage",
      "overall-track",
      "overall-bar",
      "mastered-count",
      "total-count",
      "completed-blocks",
      "total-blocks",
      "review-stat",
      "due-count",
      "review-status",
      "progress-message",
      "focus-card",
      "focus-icon",
      "focus-label",
      "focus-title",
      "focus-context",
      "focus-reason",
      "go-to-focus",
      "studying-count",
      "accuracy-value",
      "practice-summary",
      "open-errors-count",
      "status-filter",
      "toggle-all",
      "blocks-container",
      "empty-state",
      "footer-settings",
      "toast",
      "topic-dialog",
      "topic-dialog-block",
      "topic-dialog-title",
      "topic-review-date",
      "state-picker",
      "review-panel",
      "review-actions",
      "topic-accuracy",
      "practice-form",
      "practice-correct",
      "practice-total",
      "practice-feedback",
      "attempts-list",
      "confidence-picker",
      "topic-notes",
      "save-notes",
      "topic-open-errors",
      "error-form",
      "error-text",
      "errors-list",
      "settings-dialog",
      "reviews-enabled",
      "interval-settings",
      "interval-1",
      "interval-2",
      "interval-3",
      "interval-4",
      "reopen-forgotten",
      "save-settings",
      "export-data",
      "import-data",
      "reset-progress",
      "reset-dialog",
    ];

    ids.forEach((id) => {
      const key = id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      elements[key] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements.blocksContainer.addEventListener("click", (event) => {
      const quickButton = event.target.closest("[data-quick-topic]");
      if (quickButton) {
        quickToggleTopic(quickButton.dataset.quickTopic);
        return;
      }

      const topicButton = event.target.closest("[data-topic-id]");
      if (topicButton) {
        openTopicDialog(topicButton.dataset.topicId);
        return;
      }

      const blockToggle = event.target.closest(".block-toggle");
      if (blockToggle) {
        const blockId = blockToggle.closest("[data-block-id]").dataset.blockId;
        if (expandedBlocks.has(blockId)) expandedBlocks.delete(blockId);
        else expandedBlocks.add(blockId);
        renderBlocks();
      }
    });

    elements.statusFilter.addEventListener("change", () => {
      currentFilter = elements.statusFilter.value;
      renderBlocks();
    });

    elements.toggleAll.addEventListener("click", () => {
      const shouldExpand = expandedBlocks.size !== blocks.length;
      expandedBlocks.clear();
      if (shouldExpand) blocks.forEach((block) => expandedBlocks.add(block.id));
      elements.toggleAll.textContent = shouldExpand ? "Recolher todos" : "Expandir todos";
      renderBlocks();
    });

    elements.goToFocus.addEventListener("click", goToFocus);
    elements.openSettings.addEventListener("click", openSettings);
    elements.footerSettings.addEventListener("click", openSettings);

    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => {
        closeDialog(document.getElementById(button.dataset.closeDialog));
      });
    });

    [elements.topicDialog, elements.settingsDialog].forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });

    elements.statePicker.addEventListener("click", (event) => {
      const button = event.target.closest("[data-state]");
      if (button) setTopicStatus(currentTopicId, button.dataset.state);
    });

    elements.reviewActions.addEventListener("click", (event) => {
      const button = event.target.closest("[data-rating]");
      if (button) rateReview(button.dataset.rating);
    });

    elements.practiceForm.addEventListener("submit", registerPractice);
    elements.confidencePicker.addEventListener("click", (event) => {
      const button = event.target.closest("[data-confidence]");
      if (button) setConfidence(button.dataset.confidence);
    });
    elements.saveNotes.addEventListener("click", saveNotes);
    elements.errorForm.addEventListener("submit", addError);

    elements.errorsList.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-error-toggle]");
      if (toggle) {
        toggleError(toggle.dataset.errorToggle);
        return;
      }
      const remove = event.target.closest("[data-error-delete]");
      if (remove) deleteError(remove.dataset.errorDelete);
    });

    elements.reviewsEnabled.addEventListener("change", () => {
      elements.intervalSettings.disabled = !elements.reviewsEnabled.checked;
    });
    elements.saveSettings.addEventListener("click", saveSettings);
    elements.exportData.addEventListener("click", exportData);
    elements.importData.addEventListener("change", importData);

    elements.resetProgress.addEventListener("click", () => {
      closeDialog(elements.settingsDialog);
      openDialog(elements.resetDialog);
    });
    elements.resetDialog.addEventListener("close", () => {
      if (elements.resetDialog.returnValue === "confirm") resetProgress();
    });
  }

  function initialize() {
    cacheElements();
    bindEvents();
    renderBlocks();
    updateDashboard();
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
