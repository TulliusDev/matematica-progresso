(() => {
  "use strict";

  const { subjects, schedule } = window.TRAJETORIA_DATA;
  const Storage = window.TrajetoriaStorage;
  const { allTopics, DAY_MS } = Storage;
  const STATUS_WEIGHT = { "not-started": 0, studying: 0.34, consolidating: 0.67, mastered: 1 };
  const STATUS_LABEL = {
    "not-started": "Não iniciado",
    studying: "Estudando",
    consolidating: "Consolidando",
    mastered: "Dominado",
  };
  const LITERATURE_FIELDS = [
    "title", "author", "progress", "characters", "narrator", "space", "time",
    "structure", "conflicts", "themes", "symbols", "ironies", "language",
    "context", "notes", "passages", "questions",
  ];

  const elements = {};
  const expandedBlocks = new Set(subjects.flatMap((subject) => subject.blocks.map((block) => block.id)));
  let state = Storage.loadState();
  let activeView = "home";
  let activeSubjectId = "matematica";
  let currentTopicId = null;
  let currentStatusFilter = "all";
  let currentErrorFilter = "open";
  let currentErrorSubject = "all";
  let toastTimer;
  let cloudSync = null;

  function initialize() {
    cacheElements();
    renderSubjectNavigation();
    populateSubjectSelects();
    bindStaticEvents();
    navigateFromHash();
    updateNavigationBadges();
    initializeCloudSync();
  }

  function cacheElements() {
    const ids = [
      "sidebar", "close-menu", "open-menu", "sidebar-backdrop", "subject-navigation",
      "open-settings", "mobile-settings", "main-content", "nav-errors-count",
      "nav-review-count", "toast", "topic-dialog", "topic-dialog-block",
      "topic-dialog-title", "topic-review-date", "state-picker", "review-panel",
      "review-actions", "topic-accuracy", "practice-form", "practice-correct",
      "practice-total", "practice-feedback", "attempts-list", "confidence-picker",
      "topic-notes", "save-notes", "topic-open-errors", "error-form", "error-text",
      "error-correction", "errors-list", "global-error-dialog", "global-error-form",
      "global-error-subject", "global-error-topic", "global-error-description",
      "global-error-correction", "literature-dialog", "literature-form", "literature-id",
      "literature-dialog-title", "exam-dialog", "exam-form", "exam-institution",
      "exam-year", "exam-subject", "exam-topic-options", "exam-result", "exam-difficulty",
      "exam-observation", "exam-solution", "settings-dialog", "reviews-enabled",
      "interval-settings", "interval-1", "interval-2", "interval-3", "interval-4",
      "reopen-forgotten", "stale-review-days", "save-settings", "export-data",
      "import-data", "reset-progress", "reset-dialog", "sync-summary", "sync-summary-text",
      "sync-detail", "sync-login", "sync-email", "sync-account", "sync-user-email",
      "sync-now", "sync-sign-out",
    ];
    ids.forEach((id) => {
      elements[toCamel(id)] = document.getElementById(id);
    });
    LITERATURE_FIELDS.forEach((field) => {
      elements[`literature${capitalize(field)}`] = document.getElementById(`literature-${field}`);
    });
  }

  function renderSubjectNavigation() {
    elements.subjectNavigation.innerHTML = subjects.map((subject) => `
      <button class="nav-item" type="button" data-view="subject" data-subject-id="${subject.id}">
        <span class="nav-icon subject-nav-mark" aria-hidden="true">${subject.mark}</span>
        <span>${escapeHTML(subject.name)}</span>
        <span class="nav-progress" data-nav-progress="${subject.id}">0%</span>
      </button>
    `).join("");
  }

  function populateSubjectSelects() {
    const options = subjects.map((subject) => `<option value="${subject.id}">${escapeHTML(subject.name)}</option>`).join("");
    elements.globalErrorSubject.innerHTML = options;
    elements.examSubject.innerHTML = options;
    updateGlobalErrorTopics();
    updateExamTopicOptions();
  }

  function navigateFromHash() {
    const path = location.hash.replace(/^#\/?/, "");
    if (path.startsWith("materia/")) {
      const subjectId = path.split("/")[1];
      if (findSubject(subjectId)) {
        activeView = "subject";
        activeSubjectId = subjectId;
      }
    } else if (["literatura", "errors", "review", "exams"].includes(path)) {
      activeView = path;
    } else {
      activeView = "home";
    }
    renderCurrentView();
  }

  function navigate(view, subjectId = null, pushHash = true) {
    activeView = view;
    if (subjectId) activeSubjectId = subjectId;
    currentStatusFilter = "all";
    if (pushHash) {
      const nextHash = view === "home" ? "#home" : view === "subject" ? `#materia/${activeSubjectId}` : `#${view}`;
      if (location.hash !== nextHash) history.pushState(null, "", nextHash);
    }
    closeSidebar();
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    elements.mainContent.focus({ preventScroll: true });
  }

  function renderCurrentView() {
    if (activeView === "subject") renderSubjectPage(findSubject(activeSubjectId));
    else if (activeView === "literatura") renderLiteraturePage();
    else if (activeView === "errors") renderErrorsPage();
    else if (activeView === "review") renderWeeklyReviewPage();
    else if (activeView === "exams") renderExamsPage();
    else renderHomePage();
    updateActiveNavigation();
    updateNavigationBadges();
  }

  function renderHomePage() {
    const stats = getOverallStats();
    const today = new Date();
    const todaySchedule = schedule[today.getDay()];
    const focus = getGlobalFocus(todaySchedule);
    const dateLabel = capitalize(today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }));

    elements.mainContent.innerHTML = `
      <section class="page-intro home-intro">
        <div><p class="eyebrow">${escapeHTML(dateLabel)}</p><h1>O que estudar agora?</h1><p class="intro-copy">Uma visão clara do seu dia, sem transformar estudo em burocracia.</p></div>
        ${renderLastActivity()}
      </section>
      ${renderDailyRoutine(todaySchedule)}
      ${renderFocusCard(focus, "Foco recomendado agora")}
      <section class="overview home-overview" aria-label="Resumo geral">
        <div class="progress-feature">
          <div class="progress-ring" style="--progress:${stats.progress * 3.6}deg"><span>${stats.progress}%</span></div>
          <div class="progress-copy"><p class="stat-label">Progresso da preparação</p><p class="progress-message">${getOverallMessage(stats)}</p><div class="progress-track progress-track-large" role="progressbar" aria-label="Progresso geral" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${stats.progress}"><span style="width:${stats.progress}%"></span></div></div>
        </div>
        ${renderStatCard("✓", stats.mastered, `de ${stats.total}`, "Dominados", "check-icon")}
        ${renderStatCard("◐", stats.active, "em andamento", "Estudando", "blocks-icon")}
        ${renderStatCard("↻", stats.due, "pendentes", "Revisões", stats.due ? "review-icon has-value" : "review-icon")}
        ${renderStatCard("!", stats.openErrors, "não revisados", "Erros", stats.openErrors ? "error-icon has-value" : "error-icon")}
      </section>
      <section class="dashboard-section">
        <div class="section-heading"><div><p class="eyebrow">Visão por matéria</p><h2>Seu avanço</h2></div></div>
        <div class="subject-progress-grid">${subjects.map(renderSubjectProgressCard).join("")}</div>
      </section>
      ${renderRecentActivitySection()}
    `;
  }

  function renderDailyRoutine(todaySchedule) {
    if (todaySchedule?.type === "weekly-review") {
      const review = getWeeklyReviewData();
      return `
        <section class="daily-plan weekend-plan">
          <div><p class="eyebrow">Rotina flexível de fim de semana</p><h2>Revisão semanal leve</h2><p>${review.totalItems} item${review.totalItems === 1 ? "" : "s"} reunido${review.totalItems === 1 ? "" : "s"} automaticamente. Você pode concluir no sábado ou domingo.</p></div>
          <button class="primary-button" type="button" data-action="navigate" data-view-target="review">Abrir revisão →</button>
        </section>
      `;
    }
    const primary = findSubject(todaySchedule.primary.subjectId);
    const secondary = findSubject(todaySchedule.secondary.subjectId);
    return `
      <section class="daily-plan" aria-label="Plano de hoje">
        <div class="plan-heading"><div><p class="eyebrow">Plano de hoje</p><h2>80 minutos de estudo focado</h2></div><span>+ revisões necessárias</span></div>
        <div class="routine-grid">
          ${renderRoutineCard(primary, todaySchedule.primary.minutes, "Matéria principal")}
          ${renderRoutineCard(secondary, todaySchedule.secondary.minutes, "Matéria secundária")}
        </div>
      </section>
    `;
  }

  function renderRoutineCard(subject, minutes, label) {
    const recommendation = getSubjectFocus(subject.id);
    return `
      <button class="routine-card" type="button" data-action="navigate-subject" data-subject-id="${subject.id}">
        <span class="subject-mark" aria-hidden="true">${subject.mark}</span>
        <span class="routine-copy"><small>${label}</small><strong>${escapeHTML(subject.name)}</strong><span>${recommendation ? escapeHTML(recommendation.topic.name) : "Trilha em dia"}</span></span>
        <span class="routine-time">${minutes} min</span>
      </button>
    `;
  }

  function renderFocusCard(focus, label = "Próximo passo") {
    if (!focus) return `
      <section class="focus-card complete"><div class="focus-icon" aria-hidden="true">✓</div><div class="focus-copy"><p class="eyebrow">Tudo em dia</p><h2>Não há conteúdo urgente agora.</h2><p>Use o tempo para uma prova anterior ou leitura.</p></div></section>
    `;
    return `
      <section class="focus-card ${focus.type}" aria-label="${escapeHTML(label)}">
        <div class="focus-icon" aria-hidden="true">${focus.type === "review" ? "↻" : "↗"}</div>
        <div class="focus-copy"><p class="eyebrow">${escapeHTML(label)}</p><h2>${escapeHTML(focus.topic.name)}</h2><p>${escapeHTML(focus.topic.subject.name)} · ${escapeHTML(focus.topic.block.name)}</p><div class="focus-reason">${escapeHTML(focus.reason)}</div></div>
        <button class="primary-button" type="button" data-action="open-topic" data-topic-id="${focus.topic.id}">${focus.type === "review" ? "Revisar agora" : "Abrir conteúdo"} →</button>
      </section>
    `;
  }

  function renderStatCard(icon, value, detail, label, iconClass) {
    return `<div class="stat-card"><span class="stat-icon ${iconClass}" aria-hidden="true">${icon}</span><div><strong>${value}</strong><span>${escapeHTML(detail)}</span></div><p>${escapeHTML(label)}</p></div>`;
  }

  function renderSubjectProgressCard(subject) {
    const stats = getSubjectStats(subject);
    return `
      <button class="subject-progress-card" type="button" data-action="navigate-subject" data-subject-id="${subject.id}">
        <span class="subject-card-top"><span class="subject-mark" aria-hidden="true">${subject.mark}</span><span><strong>${escapeHTML(subject.name)}</strong><small>${stats.mastered} dominados · ${stats.active} em andamento</small></span><b>${stats.progress}%</b></span>
        <span class="progress-track"><span style="width:${stats.progress}%"></span></span>
      </button>
    `;
  }

  function renderSubjectPage(subject) {
    if (!subject) return navigate("home");
    const stats = getSubjectStats(subject);
    const focus = getSubjectFocus(subject.id);
    const visibleTopicCount = subject.blocks.reduce((count, block) => count + block.topics.filter((topic) => topicMatchesFilter(topic.id)).length, 0);
    elements.mainContent.innerHTML = `
      <section class="page-intro subject-intro">
        <div><p class="eyebrow">Trilha de ${escapeHTML(subject.name)}</p><h1>${escapeHTML(subject.name)}</h1><p class="intro-copy">${escapeHTML(subject.description)}</p></div>
        <div class="subject-summary"><strong>${stats.progress}%</strong><span>${stats.mastered} de ${stats.total} dominados</span></div>
      </section>
      ${renderFocusCard(focus, focus?.type === "review" ? "Revisão prioritária" : "Próximo nesta matéria")}
      <section class="insights subject-insights">
        <div class="insight"><span>Estudando</span><strong>${stats.studying}</strong><small>conteúdos ativos</small></div>
        <div class="insight"><span>Consolidando</span><strong>${stats.consolidating}</strong><small>para reforçar</small></div>
        <div class="insight"><span>Revisões</span><strong>${stats.due}</strong><small>pendentes hoje</small></div>
        <div class="insight"><span>Taxa de acerto</span><strong>${stats.accuracy === null ? "—" : `${stats.accuracy}%`}</strong><small>${stats.practiceTotal ? `${stats.practiceTotal} questões` : "sem prática"}</small></div>
      </section>
      <section class="study-section" id="conteudos">
        <div class="section-heading"><div><p class="eyebrow">Mapa de aprendizagem</p><h2>${subject.chronology ? "Linha de estudo" : "Blocos de estudo"}</h2></div>
          <div class="view-actions"><label class="select-wrap"><span class="sr-only">Filtrar conteúdos</span><select id="status-filter"><option value="all" ${currentStatusFilter === "all" ? "selected" : ""}>Todos os conteúdos</option><option value="pending" ${currentStatusFilter === "pending" ? "selected" : ""}>Pendentes</option><option value="studying" ${currentStatusFilter === "studying" ? "selected" : ""}>Estudando</option><option value="consolidating" ${currentStatusFilter === "consolidating" ? "selected" : ""}>Consolidando</option><option value="review" ${currentStatusFilter === "review" ? "selected" : ""}>Para revisar</option><option value="mastered" ${currentStatusFilter === "mastered" ? "selected" : ""}>Dominados</option></select></label><button class="text-button" type="button" data-action="toggle-all-blocks">Recolher todos</button></div>
        </div>
        <div class="blocks-grid ${subject.chronology ? "chronology-grid" : ""}" id="blocks-container">${renderBlocks(subject, focus?.topic.id)}</div>
        <p class="empty-state" id="empty-state" ${visibleTopicCount ? "hidden" : ""}>Nenhum conteúdo corresponde a este filtro.</p>
      </section>
    `;
  }

  function renderBlocks(subject, focusTopicId) {
    const visibleBlocks = subject.blocks.filter((block) => block.topics.some((topic) => topicMatchesFilter(topic.id)));
    if (!visibleBlocks.length) return "";
    return visibleBlocks.map((block) => {
      const blockIndex = subject.blocks.indexOf(block);
      const stats = getBlockStats(block);
      const expanded = expandedBlocks.has(block.id);
      return `
        <article class="block-card ${stats.complete ? "mastered" : ""}" data-block-id="${block.id}">
          <button class="block-toggle" type="button" data-action="toggle-block" data-block-id="${block.id}" aria-expanded="${expanded}" aria-controls="topics-${block.id}">
            <span class="block-number">${String(blockIndex + 1).padStart(2, "0")}</span>
            <span class="block-heading"><span class="block-title-row"><h3>${escapeHTML(block.name)}</h3>${stats.complete ? '<span class="mastered-badge">Bloco dominado</span>' : ""}</span><p>${block.period ? `${escapeHTML(block.period)} · ` : ""}${stats.mastered} de ${stats.total} dominados</p></span><span class="chevron" aria-hidden="true">⌄</span>
          </button>
          <div class="block-progress"><div class="progress-track" role="progressbar" aria-label="Progresso de ${escapeHTML(block.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${stats.progress}"><span style="width:${stats.progress}%"></span></div><span>${stats.progress}%</span></div>
          <ul class="topic-list" id="topics-${block.id}" ${expanded ? "" : "hidden"}>${block.topics.filter((topic) => topicMatchesFilter(topic.id)).map((topic) => renderTopic(topic, focusTopicId)).join("")}</ul>
        </article>
      `;
    }).join("");
  }

  function renderTopic(topic, focusTopicId) {
    const topicState = state.topics[topic.id];
    const stats = getTopicStats(topic.id);
    const due = isReviewDue(topic.id);
    const statusClass = due ? "due" : topicState.status;
    const evidence = [];
    if (stats.accuracy !== null) evidence.push(`${stats.accuracy}% em questões`);
    if (topicState.confidence) evidence.push(`confiança ${topicState.confidence}/5`);
    if (stats.openErrors) evidence.push(`${stats.openErrors} erro${stats.openErrors === 1 ? "" : "s"}`);
    return `
      <li class="topic-item ${statusClass} ${focusTopicId === topic.id ? "recommended" : ""}" id="topic-${topic.id}">
        <button class="quick-state" type="button" data-action="quick-topic" data-topic-id="${topic.id}" aria-label="${topicState.status === "mastered" ? "Mover para consolidando" : "Marcar como dominado"}"><span aria-hidden="true">${due ? "↻" : topicState.status === "mastered" ? "✓" : topicState.status === "consolidating" ? "◐" : ""}</span></button>
        <button class="topic-open" type="button" data-action="open-topic" data-topic-id="${topic.id}"><span class="topic-main"><span class="topic-name">${escapeHTML(topic.name)}</span><span class="topic-evidence">${evidence.length ? evidence.join(" · ") : "Sem evidências registradas"}</span></span><span class="topic-meta">${focusTopicId === topic.id ? '<span class="recommended-label">Foco</span>' : ""}<span class="topic-status">${due ? "Revisar" : STATUS_LABEL[topicState.status]}</span><span class="topic-arrow" aria-hidden="true">→</span></span></button>
      </li>
    `;
  }

  function renderErrorsPage() {
    const errors = getAllErrors().filter((item) => {
      if (currentErrorFilter === "open" && item.error.resolved) return false;
      if (currentErrorFilter === "resolved" && !item.error.resolved) return false;
      return currentErrorSubject === "all" || item.topic.subject.id === currentErrorSubject;
    });
    elements.mainContent.innerHTML = `
      <section class="page-intro tool-intro"><div><p class="eyebrow">Aprenda com os padrões</p><h1>Caderno de erros</h1><p class="intro-copy">O erro só vira aprendizado quando a correção fica clara e é revisitada.</p></div><button class="primary-button" type="button" data-action="open-global-error">Registrar erro</button></section>
      <section class="tool-controls"><label class="select-wrap"><span class="sr-only">Filtrar status</span><select id="error-status-filter"><option value="open" ${currentErrorFilter === "open" ? "selected" : ""}>Não revisados</option><option value="resolved" ${currentErrorFilter === "resolved" ? "selected" : ""}>Revisados</option><option value="all" ${currentErrorFilter === "all" ? "selected" : ""}>Todos</option></select></label><label class="select-wrap"><span class="sr-only">Filtrar matéria</span><select id="error-subject-filter"><option value="all">Todas as matérias</option>${subjects.map((subject) => `<option value="${subject.id}" ${currentErrorSubject === subject.id ? "selected" : ""}>${escapeHTML(subject.name)}</option>`).join("")}</select></label><span>${errors.length} registro${errors.length === 1 ? "" : "s"}</span></section>
      <div class="global-errors-list">${errors.length ? errors.map(renderGlobalError).join("") : renderEmptyState("Nenhum erro neste filtro", "Registre uma dificuldade real para transformá-la em revisão útil.")}</div>
    `;
  }

  function renderGlobalError(item) {
    const { topic, error } = item;
    return `<article class="global-error-card ${error.resolved ? "resolved" : ""}"><div class="error-card-head"><span class="subject-chip">${escapeHTML(topic.subject.name)}</span><span>${formatDate(error.timestamp)}</span></div><button class="error-topic-link" type="button" data-action="open-topic" data-topic-id="${topic.id}">${escapeHTML(topic.name)} →</button><h3>${escapeHTML(error.description)}</h3><p><strong>Compreensão correta</strong>${escapeHTML(error.correctAnswer)}</p><div class="error-card-footer"><span>${error.reviewCount} revisão${error.reviewCount === 1 ? "" : "ões"}</span><div>${error.resolved ? `<button class="text-button" type="button" data-action="reopen-error" data-topic-id="${topic.id}" data-error-id="${error.id}">Reabrir</button>` : `<button class="secondary-button" type="button" data-action="review-error" data-topic-id="${topic.id}" data-error-id="${error.id}">Marcar revisado</button>`}<button class="icon-text-button danger-text" type="button" data-action="delete-error" data-topic-id="${topic.id}" data-error-id="${error.id}">Excluir</button></div></div></article>`;
  }

  function renderWeeklyReviewPage() {
    const review = getWeeklyReviewData();
    const completedAt = state.weeklyReviews[review.weekKey];
    elements.mainContent.innerHTML = `
      <section class="page-intro tool-intro"><div><p class="eyebrow">${escapeHTML(review.periodLabel)}</p><h1>Revisão semanal</h1><p class="intro-copy">Uma seleção automática para sábado ou domingo — sem dia obrigatório.</p></div>${completedAt ? `<span class="completion-badge">Concluída ${formatRelativeDate(completedAt)}</span>` : `<button class="primary-button" type="button" data-action="complete-weekly-review">Concluir revisão</button>`}</section>
      <section class="review-summary"><div><strong>${review.studied.length}</strong><span>estudados na semana</span></div><div><strong>${review.consolidating.length}</strong><span>consolidando</span></div><div><strong>${review.errors.length}</strong><span>erros pendentes</span></div><div><strong>${review.stale.length}</strong><span>sem revisão recente</span></div></section>
      <div class="review-columns">
        ${renderReviewGroup("Estudados nesta semana", "Retome a ideia central sem consultar a anotação.", review.studied)}
        ${renderReviewGroup("Consolidando", "Resolva novamente antes de marcar como dominado.", review.consolidating)}
        ${renderReviewErrorGroup(review.errors)}
        ${renderReviewGroup("Há muito tempo sem revisão", `Mais de ${state.settings.staleReviewDays} dias sem contato.`, review.stale)}
      </div>
    `;
  }

  function renderReviewGroup(title, description, topics) {
    return `<section class="review-group"><div class="review-group-head"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div><span>${topics.length}</span></div>${topics.length ? `<ul>${topics.map((topic) => `<li><button type="button" data-action="open-topic" data-topic-id="${topic.id}"><span><small>${escapeHTML(topic.subject.name)}</small>${escapeHTML(topic.name)}</span><span>Revisar →</span></button></li>`).join("")}</ul>` : '<p class="group-empty">Nada para revisar aqui.</p>'}</section>`;
  }

  function renderReviewErrorGroup(errors) {
    return `<section class="review-group"><div class="review-group-head"><div><h2>Erros ainda não revisados</h2><p>Confirme a compreensão correta antes de encerrar.</p></div><span>${errors.length}</span></div>${errors.length ? `<ul>${errors.map(({ topic, error }) => `<li><button type="button" data-action="review-error" data-topic-id="${topic.id}" data-error-id="${error.id}"><span><small>${escapeHTML(topic.subject.name)} · ${escapeHTML(topic.name)}</small>${escapeHTML(error.description)}</span><span>Marcar revisado →</span></button></li>`).join("")}</ul>` : '<p class="group-empty">Nenhum erro pendente.</p>'}</section>`;
  }

  function renderLiteraturePage() {
    const works = state.literatureWorks;
    const average = works.length ? Math.round(works.reduce((sum, work) => sum + Number(work.progress || 0), 0) / works.length) : 0;
    elements.mainContent.innerHTML = `
      <section class="page-intro tool-intro"><div><p class="eyebrow">Leitura sem rigidez diária</p><h1>Literatura</h1><p class="intro-copy">Fichas completas para ler com atenção a forma, contexto e interpretação.</p></div><button class="primary-button" type="button" data-action="open-literature">Adicionar obra</button></section>
      ${works.length ? `<section class="literature-summary"><div><strong>${works.length}</strong><span>obras cadastradas</span></div><div><strong>${average}%</strong><span>progresso médio de leitura</span></div><div><strong>${works.filter((work) => Number(work.progress) === 100).length}</strong><span>leituras concluídas</span></div></section><div class="literature-grid">${works.map(renderLiteratureCard).join("")}</div>` : renderEmptyState("Sua estante está vazia", "Adicione a primeira obra e construa uma ficha de leitura no seu ritmo.", '<button class="secondary-button" type="button" data-action="open-literature">Criar primeira ficha</button>')}
    `;
  }

  function renderLiteratureCard(work) {
    const highlights = [work.themes, work.characters, work.context].filter(Boolean).length;
    return `<article class="literature-card"><div class="book-spine" aria-hidden="true"></div><div class="literature-card-head"><div><span>${escapeHTML(work.author || "Autor não informado")}</span><h2>${escapeHTML(work.title)}</h2></div><strong>${Number(work.progress || 0)}%</strong></div><div class="progress-track"><span style="width:${Number(work.progress || 0)}%"></span></div><p>${highlights ? `${highlights} áreas principais preenchidas` : "Ficha pronta para suas observações"}</p><div class="card-actions"><button class="secondary-button" type="button" data-action="edit-literature" data-work-id="${work.id}">Abrir ficha</button><button class="icon-text-button danger-text" type="button" data-action="delete-literature" data-work-id="${work.id}">Excluir</button></div></article>`;
  }

  function renderExamsPage() {
    const questions = [...state.examQuestions].reverse();
    const answered = questions.filter((question) => question.result !== "unanswered");
    const correct = questions.filter((question) => question.result === "correct").length;
    elements.mainContent.innerHTML = `
      <section class="page-intro tool-intro"><div><p class="eyebrow">Preparação direcionada</p><h1>Provas CEFET/COLTEC</h1><p class="intro-copy">Estrutura pronta para relacionar cada questão aos conteúdos da sua trilha.</p></div><button class="primary-button" type="button" data-action="open-exam">Cadastrar questão</button></section>
      <section class="exam-summary"><div><strong>${questions.length}</strong><span>questões cadastradas</span></div><div><strong>${answered.length ? Math.round(correct / answered.length * 100) : "—"}${answered.length ? "%" : ""}</strong><span>taxa de acerto</span></div><div><strong>${questions.filter((q) => q.institution === "CEFET-MG").length}</strong><span>CEFET-MG</span></div><div><strong>${questions.filter((q) => q.institution === "COLTEC").length}</strong><span>COLTEC</span></div></section>
      ${questions.length ? `<div class="exam-list">${questions.map(renderExamQuestion).join("")}</div>` : renderEmptyState("Banco preparado", "Cadastre questões aos poucos. Uma questão pode ser vinculada a vários conteúdos.", '<button class="secondary-button" type="button" data-action="open-exam">Cadastrar primeira questão</button>')}
    `;
  }

  function renderExamQuestion(question) {
    const subject = findSubject(question.subjectId);
    const topics = (question.topicIds || []).map(findTopic).filter(Boolean);
    const resultLabel = question.result === "correct" ? "Acerto" : question.result === "incorrect" ? "Erro" : "Não respondida";
    return `<article class="exam-card ${question.result}"><div class="exam-card-head"><span class="institution-badge">${escapeHTML(question.institution)} ${question.year || ""}</span><span>${escapeHTML(resultLabel)}</span></div><h2>${escapeHTML(subject?.name || "Matéria")}</h2><p>${topics.length ? topics.map((topic) => escapeHTML(topic.name)).join(" · ") : "Sem conteúdos vinculados"}</p>${question.observation ? `<blockquote>${escapeHTML(question.observation)}</blockquote>` : ""}<div class="exam-card-footer"><span>Dificuldade ${escapeHTML(question.difficulty || "Média")}</span><button class="icon-text-button danger-text" type="button" data-action="delete-exam" data-question-id="${question.id}">Excluir</button></div></article>`;
  }

  function renderRecentActivitySection() {
    const activities = [...state.activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6);
    if (!activities.length) return "";
    return `<section class="dashboard-section recent-section"><div class="section-heading"><div><p class="eyebrow">Histórico</p><h2>Atividade recente</h2></div></div><div class="activity-list">${activities.map((activity) => `<div><span class="activity-dot"></span><p>${escapeHTML(activity.description)}<small>${formatRelativeDate(activity.timestamp)}</small></p></div>`).join("")}</div></section>`;
  }

  function renderLastActivity() {
    const latest = [...state.activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return `<div class="activity"><span class="activity-dot" aria-hidden="true"></span><span>${latest ? `${escapeHTML(latest.description)} · ${formatRelativeDate(latest.timestamp)}` : "Nenhuma atividade recente"}</span></div>`;
  }

  function renderEmptyState(title, description, action = "") {
    return `<section class="large-empty-state"><span aria-hidden="true">○</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p>${action}</section>`;
  }

  function getSubjectStats(subject) {
    const topics = subject.blocks.flatMap((block) => block.topics);
    return calculateTopicCollectionStats(topics);
  }

  function getOverallStats() {
    return calculateTopicCollectionStats(allTopics);
  }

  function calculateTopicCollectionStats(topics) {
    let correct = 0;
    let totalQuestions = 0;
    let openErrors = 0;
    const counts = { mastered: 0, studying: 0, consolidating: 0, due: 0 };
    let weighted = 0;
    topics.forEach((topic) => {
      const topicState = state.topics[topic.id];
      counts[topicState.status] = (counts[topicState.status] || 0) + 1;
      if (isReviewDue(topic.id)) counts.due += 1;
      weighted += STATUS_WEIGHT[topicState.status];
      const stats = getTopicStats(topic.id);
      correct += stats.correct;
      totalQuestions += stats.total;
      openErrors += stats.openErrors;
    });
    return {
      total: topics.length,
      mastered: counts.mastered,
      studying: counts.studying,
      consolidating: counts.consolidating,
      active: counts.studying + counts.consolidating,
      due: counts.due,
      openErrors,
      progress: topics.length ? Math.round(weighted / topics.length * 100) : 0,
      accuracy: totalQuestions ? Math.round(correct / totalQuestions * 100) : null,
      practiceTotal: totalQuestions,
    };
  }

  function getBlockStats(block) {
    const stats = calculateTopicCollectionStats(block.topics);
    return { ...stats, complete: stats.mastered === stats.total };
  }

  function getTopicStats(topicId) {
    const topicState = state.topics[topicId];
    const totals = topicState.attempts.reduce((sum, attempt) => ({ correct: sum.correct + attempt.correct, total: sum.total + attempt.total }), { correct: 0, total: 0 });
    return { ...totals, accuracy: totals.total ? Math.round(totals.correct / totals.total * 100) : null, openErrors: topicState.errors.filter((error) => !error.resolved).length };
  }

  function getGlobalFocus(todaySchedule) {
    const due = allTopics.filter((topic) => isReviewDue(topic.id)).sort(byReviewDate)[0];
    if (due) return { topic: due, type: "review", reason: "Revisão vencida tem prioridade para proteger a retenção." };
    if (todaySchedule?.primary) return getSubjectFocus(todaySchedule.primary.subjectId);
    const consolidating = allTopics.find((topic) => state.topics[topic.id].status === "consolidating");
    if (consolidating) return { topic: consolidating, type: "consolidating", reason: "Está em consolidação e merece uma recuperação ativa." };
    return allTopics.map((topic) => ({ topic, state: state.topics[topic.id] })).find((entry) => entry.state.status !== "mastered") ? getSubjectFocus("matematica") : null;
  }

  function getSubjectFocus(subjectId) {
    const subjectTopics = allTopics.filter((topic) => topic.subject.id === subjectId);
    const due = subjectTopics.filter((topic) => isReviewDue(topic.id)).sort(byReviewDate)[0];
    if (due) return { topic: due, type: "review", reason: "Revisão pendente nesta matéria." };
    const consolidating = subjectTopics.find((topic) => state.topics[topic.id].status === "consolidating");
    if (consolidating) return { topic: consolidating, type: "consolidating", reason: "Reforce este conteúdo antes de avançar." };
    const studying = subjectTopics.find((topic) => state.topics[topic.id].status === "studying");
    if (studying) return { topic: studying, type: "studying", reason: "Continue de onde parou para reduzir dispersão." };
    const pending = subjectTopics.find((topic) => state.topics[topic.id].status === "not-started");
    return pending ? { topic: pending, type: "next", reason: "Primeiro conteúdo pendente na ordem da trilha." } : null;
  }

  function isReviewDue(topicId) {
    if (!state.settings.reviewsEnabled) return false;
    const topicState = state.topics[topicId];
    return topicState.status === "mastered" && Boolean(topicState.review.nextAt) && new Date(topicState.review.nextAt) <= endOfToday();
  }

  function isStale(topic) {
    const topicState = state.topics[topic.id];
    if (topicState.status !== "mastered") return false;
    const reference = topicState.review.lastAt || topicState.masteredAt || topicState.updatedAt;
    return reference && Date.now() - new Date(reference).getTime() >= state.settings.staleReviewDays * DAY_MS;
  }

  function getWeeklyReviewData() {
    const start = startOfWeek(new Date());
    const end = new Date(start.getTime() + 6 * DAY_MS);
    const studiedIds = new Set(state.activities.filter((activity) => new Date(activity.timestamp) >= start && activity.topicId).map((activity) => activity.topicId));
    const studied = [...studiedIds].map(findTopic).filter(Boolean);
    const consolidating = allTopics.filter((topic) => state.topics[topic.id].status === "consolidating" && !studiedIds.has(topic.id));
    const errors = getAllErrors().filter(({ error }) => !error.resolved);
    const stale = allTopics.filter((topic) => isStale(topic) && !studiedIds.has(topic.id));
    return {
      studied, consolidating, errors, stale,
      totalItems: studied.length + consolidating.length + errors.length + stale.length,
      weekKey: start.toISOString().slice(0, 10),
      periodLabel: `${formatShortDate(start)} — ${formatShortDate(end)}`,
    };
  }

  function getAllErrors() {
    return allTopics.flatMap((topic) => state.topics[topic.id].errors.map((error) => ({ topic, error })));
  }

  function getOverallMessage(stats) {
    if (stats.due) return `${stats.due} revisão${stats.due === 1 ? "" : "ões"} merece${stats.due === 1 ? "" : "m"} atenção hoje.`;
    if (stats.progress >= 75) return "A preparação entrou na reta final.";
    if (stats.progress >= 40) return "A base interdisciplinar está ganhando consistência.";
    return "Cada conceito consolidado reduz a incerteza na prova.";
  }

  function topicMatchesFilter(topicId) {
    const topicState = state.topics[topicId];
    if (currentStatusFilter === "pending") return topicState.status !== "mastered";
    if (currentStatusFilter === "review") return isReviewDue(topicId);
    if (["studying", "consolidating", "mastered"].includes(currentStatusFilter)) return topicState.status === currentStatusFilter;
    return true;
  }

  function openTopicDialog(topicId) {
    if (!findTopic(topicId)) return;
    currentTopicId = topicId;
    populateTopicDialog();
    openDialog(elements.topicDialog);
  }

  function populateTopicDialog() {
    const topic = findTopic(currentTopicId);
    if (!topic) return;
    const topicState = state.topics[currentTopicId];
    const stats = getTopicStats(currentTopicId);
    elements.topicDialogBlock.textContent = `${topic.subject.name} · ${topic.block.name}`;
    elements.topicDialogTitle.textContent = topic.name;
    elements.topicReviewDate.textContent = getReviewDateText(topicState);
    elements.statePicker.querySelectorAll("[data-state]").forEach((button) => {
      const active = button.dataset.state === topicState.status;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.reviewPanel.hidden = !isReviewDue(currentTopicId);
    elements.topicAccuracy.textContent = stats.accuracy === null ? "Sem dados" : `${stats.accuracy}% · ${stats.correct}/${stats.total}`;
    elements.topicNotes.value = topicState.notes;
    elements.topicOpenErrors.textContent = `${stats.openErrors} pendente${stats.openErrors === 1 ? "" : "s"}`;
    elements.confidencePicker.querySelectorAll("[data-confidence]").forEach((button) => {
      const active = Number(button.dataset.confidence) === topicState.confidence;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderAttempts(topicState);
    renderTopicErrors(topicState);
    elements.practiceFeedback.textContent = "";
  }

  function setTopicStatus(topicId, newStatus, silent = false) {
    const topic = findTopic(topicId);
    const topicState = state.topics[topicId];
    if (!topic || topicState.status === newStatus) return;
    topicState.status = newStatus;
    topicState.updatedAt = new Date().toISOString();
    if (newStatus !== "not-started") topicState.startedAt ||= topicState.updatedAt;
    if (newStatus === "mastered") {
      topicState.masteredAt = topicState.updatedAt;
      topicState.review = { step: 0, lastAt: topicState.review.lastAt, nextAt: addDays(new Date(), state.settings.reviewIntervals[0]).toISOString() };
      addActivity("mastery", topicId, `${topic.name} dominado em ${topic.subject.name}`);
    } else {
      topicState.masteredAt = null;
      topicState.review.nextAt = null;
      addActivity("status", topicId, `${topic.name}: ${STATUS_LABEL[newStatus]}`);
    }
    persist();
    refreshAfterMutation();
    if (!silent) showToast(`${topic.name} agora está ${STATUS_LABEL[newStatus].toLowerCase()}.`);
  }

  function registerPractice(event) {
    event.preventDefault();
    const correct = Number(elements.practiceCorrect.value);
    const total = Number(elements.practiceTotal.value);
    if (!Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || correct < 0 || correct > total) {
      elements.practiceFeedback.textContent = "Confira os valores: acertos devem estar entre 0 e o total.";
      return;
    }
    const topic = findTopic(currentTopicId);
    const topicState = state.topics[currentTopicId];
    topicState.attempts.push({ id: Storage.createId(), correct, total, timestamp: new Date().toISOString() });
    topicState.attempts = topicState.attempts.slice(-100);
    topicState.updatedAt = new Date().toISOString();
    if (topicState.status === "not-started") topicState.status = "studying";
    addActivity("practice", currentTopicId, `${correct}/${total} em ${topic.name}`);
    persist();
    elements.practiceForm.reset();
    refreshAfterMutation();
    const accuracy = Math.round(correct / total * 100);
    elements.practiceFeedback.textContent = accuracy >= 80 ? "Boa evidência. Considere consolidar ou dominar se conseguir explicar o raciocínio." : "Prática salva. Registre os erros e tente novamente depois.";
    showToast("Prática registrada.");
  }

  function renderAttempts(topicState) {
    const attempts = [...topicState.attempts].reverse().slice(0, 5);
    elements.attemptsList.innerHTML = attempts.length ? attempts.map((attempt) => `<div class="attempt-row"><span>${Math.round(attempt.correct / attempt.total * 100)}% <small>${attempt.correct}/${attempt.total} questões</small></span><span>${formatRelativeDate(attempt.timestamp)}</span></div>`).join("") : '<p class="list-placeholder">As últimas práticas aparecerão aqui.</p>';
  }

  function addTopicError(event) {
    event.preventDefault();
    const description = elements.errorText.value.trim();
    const correctAnswer = elements.errorCorrection.value.trim();
    if (!description || !correctAnswer) return;
    createError(currentTopicId, description, correctAnswer);
    elements.errorForm.reset();
    refreshAfterMutation();
    showToast("Erro adicionado ao caderno geral.");
  }

  function createError(topicId, description, correctAnswer) {
    const topic = findTopic(topicId);
    const topicState = state.topics[topicId];
    topicState.errors.push({ id: Storage.createId(), description: description.slice(0, 300), correctAnswer: correctAnswer.slice(0, 500), resolved: false, reviewCount: 0, timestamp: new Date().toISOString(), lastReviewedAt: null });
    if (topicState.status === "not-started") topicState.status = "studying";
    topicState.updatedAt = new Date().toISOString();
    addActivity("error", topicId, `Erro registrado em ${topic.name}`);
    persist();
  }

  function renderTopicErrors(topicState) {
    elements.errorsList.innerHTML = topicState.errors.length ? [...topicState.errors].reverse().map((error) => `<li class="${error.resolved ? "resolved" : ""}"><button class="error-toggle" type="button" data-error-action="${error.resolved ? "reopen" : "review"}" data-error-id="${error.id}" aria-label="${error.resolved ? "Reabrir" : "Marcar revisado"}"><span aria-hidden="true">${error.resolved ? "✓" : ""}</span></button><span><strong>${escapeHTML(error.description)}</strong><small>${escapeHTML(error.correctAnswer)}</small></span><button class="error-delete" type="button" data-error-action="delete" data-error-id="${error.id}" aria-label="Excluir erro">×</button></li>`).join("") : '<li class="list-placeholder">Nenhum erro registrado neste conteúdo.</li>';
  }

  function reviewError(topicId, errorId) {
    const error = findError(topicId, errorId);
    if (!error) return;
    error.resolved = true;
    error.reviewCount += 1;
    error.lastReviewedAt = new Date().toISOString();
    const topic = findTopic(topicId);
    addActivity("error-reviewed", topicId, `Erro revisado em ${topic.name}`);
    persist();
    refreshAfterMutation();
    showToast("Erro marcado como revisado.");
  }

  function reopenError(topicId, errorId) {
    const error = findError(topicId, errorId);
    if (!error) return;
    error.resolved = false;
    persist();
    refreshAfterMutation();
  }

  function deleteError(topicId, errorId) {
    state.topics[topicId].errors = state.topics[topicId].errors.filter((error) => error.id !== errorId);
    persist();
    refreshAfterMutation();
    showToast("Registro removido.");
  }

  function rateReview(rating) {
    const topic = findTopic(currentTopicId);
    const topicState = state.topics[currentTopicId];
    let nextStep = topicState.review.step;
    let message;
    if (rating === "forgot") {
      nextStep = 0;
      if (state.settings.reopenForgotten) {
        topicState.status = "studying";
        topicState.masteredAt = null;
        topicState.review.nextAt = null;
        message = "Conteúdo devolvido para Estudando.";
      } else {
        topicState.review.nextAt = addDays(new Date(), state.settings.reviewIntervals[0]).toISOString();
        message = "Revisão curta agendada.";
      }
    } else if (rating === "hard") {
      topicState.status = "consolidating";
      topicState.masteredAt = null;
      topicState.review.nextAt = null;
      nextStep = Math.max(0, nextStep - 1);
      message = "Conteúdo movido para Consolidando.";
    } else {
      nextStep += rating === "easy" ? 2 : 1;
      const interval = state.settings.reviewIntervals[Math.min(nextStep, 3)];
      topicState.review.nextAt = addDays(new Date(), interval).toISOString();
      message = `Próxima revisão em ${interval} dia${interval === 1 ? "" : "s"}.`;
    }
    topicState.review.step = nextStep;
    topicState.review.lastAt = new Date().toISOString();
    topicState.updatedAt = topicState.review.lastAt;
    addActivity("review", currentTopicId, `${topic.name} revisado`);
    persist();
    refreshAfterMutation();
    showToast(message);
  }

  function openGlobalErrorDialog() {
    elements.globalErrorForm.reset();
    updateGlobalErrorTopics();
    openDialog(elements.globalErrorDialog);
  }

  function submitGlobalError(event) {
    event.preventDefault();
    createError(elements.globalErrorTopic.value, elements.globalErrorDescription.value.trim(), elements.globalErrorCorrection.value.trim());
    closeDialog(elements.globalErrorDialog);
    renderCurrentView();
    showToast("Erro registrado.");
  }

  function updateGlobalErrorTopics() {
    const subject = findSubject(elements.globalErrorSubject.value || subjects[0].id);
    const topics = subject.blocks.flatMap((block) => block.topics);
    elements.globalErrorTopic.innerHTML = topics.map((topic) => `<option value="${topic.id}">${escapeHTML(topic.name)}</option>`).join("");
  }

  function openLiteratureDialog(workId = null) {
    elements.literatureForm.reset();
    const work = state.literatureWorks.find((item) => item.id === workId);
    elements.literatureDialogTitle.textContent = work ? "Editar obra" : "Adicionar obra";
    elements.literatureId.value = work?.id || "";
    LITERATURE_FIELDS.forEach((field) => {
      elements[`literature${capitalize(field)}`].value = work?.[field] ?? (field === "progress" ? 0 : "");
    });
    openDialog(elements.literatureDialog);
  }

  function submitLiterature(event) {
    event.preventDefault();
    const id = elements.literatureId.value || Storage.createId();
    const existing = state.literatureWorks.find((work) => work.id === id);
    const work = { id, createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    LITERATURE_FIELDS.forEach((field) => {
      const value = elements[`literature${capitalize(field)}`].value;
      work[field] = field === "progress" ? Storage.clampNumber(value, 0, 100, 0) : value.trim().slice(0, 4000);
    });
    if (existing) Object.assign(existing, work);
    else state.literatureWorks.push(work);
    addActivity("literature", null, `${work.title}: ficha de leitura atualizada`);
    persist();
    closeDialog(elements.literatureDialog);
    renderCurrentView();
    showToast("Ficha de leitura salva.");
  }

  function deleteLiterature(workId) {
    state.literatureWorks = state.literatureWorks.filter((work) => work.id !== workId);
    persist();
    renderCurrentView();
    showToast("Obra removida.");
  }

  function openExamDialog() {
    elements.examForm.reset();
    elements.examYear.value = new Date().getFullYear();
    updateExamTopicOptions();
    openDialog(elements.examDialog);
  }

  function updateExamTopicOptions() {
    const subject = findSubject(elements.examSubject.value || subjects[0].id);
    elements.examTopicOptions.innerHTML = subject.blocks.map((block) => `<div class="topic-option-group"><strong>${escapeHTML(block.name)}</strong>${block.topics.map((topic) => `<label><input type="checkbox" name="exam-topic" value="${topic.id}" /><span>${escapeHTML(topic.name)}</span></label>`).join("")}</div>`).join("");
  }

  function submitExam(event) {
    event.preventDefault();
    const topicIds = [...elements.examTopicOptions.querySelectorAll('input[name="exam-topic"]:checked')].map((input) => input.value);
    state.examQuestions.push({ id: Storage.createId(), institution: elements.examInstitution.value, year: Number(elements.examYear.value) || null, subjectId: elements.examSubject.value, topicIds, result: elements.examResult.value, difficulty: elements.examDifficulty.value, observation: elements.examObservation.value.trim().slice(0, 1000), solution: elements.examSolution.value.trim().slice(0, 3000), createdAt: new Date().toISOString() });
    addActivity("exam", null, `Questão ${elements.examInstitution.value} cadastrada`);
    persist();
    closeDialog(elements.examDialog);
    renderCurrentView();
    showToast("Questão cadastrada.");
  }

  function completeWeeklyReview() {
    const review = getWeeklyReviewData();
    state.weeklyReviews[review.weekKey] = new Date().toISOString();
    addActivity("weekly-review", null, "Revisão semanal concluída");
    persist();
    renderCurrentView();
    showToast("Revisão semanal concluída.");
  }

  function openSettings() {
    elements.reviewsEnabled.checked = state.settings.reviewsEnabled;
    elements.reopenForgotten.checked = state.settings.reopenForgotten;
    elements.staleReviewDays.value = state.settings.staleReviewDays;
    state.settings.reviewIntervals.forEach((interval, index) => { elements[`interval${index + 1}`].value = interval; });
    elements.intervalSettings.disabled = !state.settings.reviewsEnabled;
    openDialog(elements.settingsDialog);
  }

  function saveSettings() {
    const intervals = [1, 2, 3, 4].map((index) => Storage.clampNumber(elements[`interval${index}`].value, 1, 365, Storage.DEFAULT_INTERVALS[index - 1]));
    if (!intervals.every((value, index) => index === 0 || value > intervals[index - 1])) return showToast("Os intervalos devem crescer a cada etapa.");
    state.settings.reviewsEnabled = elements.reviewsEnabled.checked;
    state.settings.reopenForgotten = elements.reopenForgotten.checked;
    state.settings.reviewIntervals = intervals;
    state.settings.staleReviewDays = Storage.clampNumber(elements.staleReviewDays.value, 7, 180, 21);
    persist();
    closeDialog(elements.settingsDialog);
    renderCurrentView();
    showToast("Configurações salvas.");
  }

  function exportData() {
    const backup = { app: "trajetoria", version: Storage.APP_VERSION, exportedAt: new Date().toISOString(), data: state };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
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
        if (!parsed.data?.topics || !["trajetoria", "trajetoria-matematica"].includes(parsed.app)) throw new Error("Formato inválido");
        state = parsed.app === "trajetoria-matematica" ? Storage.migrateV2(parsed.data) : Storage.normalizeState(parsed.data);
        persist();
        closeDialog(elements.settingsDialog);
        renderCurrentView();
        showToast("Backup importado.");
      } catch (error) {
        console.warn("Falha ao importar backup.", error);
        showToast("Arquivo de backup inválido.");
      } finally {
        elements.importData.value = "";
      }
    });
    reader.readAsText(file);
  }

  function resetAll() {
    state = Storage.createDefaultState();
    persist();
    closeDialog(elements.resetDialog);
    closeDialog(elements.settingsDialog);
    navigate("home");
    showToast("Estação restaurada ao estado inicial.");
  }

  function refreshAfterMutation() {
    updateNavigationBadges();
    if (elements.topicDialog.open) populateTopicDialog();
    renderCurrentView();
  }

  function persist() {
    try { Storage.saveState(state); cloudSync?.queueSave(state); }
    catch (error) { console.warn("Não foi possível salvar.", error); showToast("Não foi possível salvar neste navegador."); }
  }

  function initializeCloudSync() {
    if (!window.TrajetoriaCloud) return;
    cloudSync = window.TrajetoriaCloud.create({
      getState: () => state,
      mergeStates: Storage.mergeStates,
      applyState(nextState) {
        state = Storage.normalizeState(nextState);
        Storage.saveState(state);
        renderCurrentView();
        if (elements.topicDialog.open) populateTopicDialog();
      },
      onAuth(user) {
        elements.syncLogin.hidden = Boolean(user);
        elements.syncAccount.hidden = !user;
        elements.syncUserEmail.textContent = user?.email || "";
      },
      onStatus({ status, detail }) {
        elements.syncSummary.dataset.status = status;
        elements.syncSummaryText.textContent = status === "synced" ? "Progresso sincronizado" : status === "offline" ? "Salvo offline" : status === "error" ? "Falha na sincronização" : status === "signed-out" ? "Somente neste dispositivo" : status === "email-sent" ? "Confira seu e-mail" : "Sincronizando…";
        elements.syncDetail.textContent = detail;
      },
    });
    cloudSync.initialize();
  }

  function addActivity(type, topicId, description) {
    state.activities.push({ id: Storage.createId(), type, topicId, description, timestamp: new Date().toISOString() });
    state.activities = state.activities.slice(-200);
  }

  function updateNavigationBadges() {
    subjects.forEach((subject) => {
      document.querySelector(`[data-nav-progress="${subject.id}"]`)?.replaceChildren(document.createTextNode(`${getSubjectStats(subject).progress}%`));
    });
    const errorCount = getAllErrors().filter(({ error }) => !error.resolved).length;
    const reviewCount = getWeeklyReviewData().totalItems;
    elements.navErrorsCount.textContent = errorCount;
    elements.navErrorsCount.hidden = errorCount === 0;
    elements.navReviewCount.textContent = reviewCount;
    elements.navReviewCount.hidden = reviewCount === 0;
  }

  function updateActiveNavigation() {
    document.querySelectorAll(".nav-item[data-view]").forEach((button) => {
      const matches = button.dataset.view === activeView && (activeView !== "subject" || button.dataset.subjectId === activeSubjectId);
      button.classList.toggle("active", matches);
      if (matches) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
  }

  function bindStaticEvents() {
    document.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-view]");
      if (nav && (nav.classList.contains("nav-item") || nav.classList.contains("nav-button"))) {
        navigate(nav.dataset.view, nav.dataset.subjectId || null);
      }
    });
    window.addEventListener("popstate", navigateFromHash);
    elements.openMenu.addEventListener("click", openSidebar);
    elements.closeMenu.addEventListener("click", closeSidebar);
    elements.sidebarBackdrop.addEventListener("click", closeSidebar);
    elements.openSettings.addEventListener("click", openSettings);
    elements.mobileSettings.addEventListener("click", openSettings);
    elements.mainContent.addEventListener("click", handleMainClick);
    elements.mainContent.addEventListener("change", handleMainChange);
    document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => closeDialog(document.getElementById(button.dataset.closeDialog))));
    [elements.topicDialog, elements.globalErrorDialog, elements.literatureDialog, elements.examDialog, elements.settingsDialog].forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); }));
    elements.statePicker.addEventListener("click", (event) => { const button = event.target.closest("[data-state]"); if (button) setTopicStatus(currentTopicId, button.dataset.state); });
    elements.reviewActions.addEventListener("click", (event) => { const button = event.target.closest("[data-rating]"); if (button) rateReview(button.dataset.rating); });
    elements.practiceForm.addEventListener("submit", registerPractice);
    elements.confidencePicker.addEventListener("click", (event) => { const button = event.target.closest("[data-confidence]"); if (!button) return; state.topics[currentTopicId].confidence = Number(button.dataset.confidence); state.topics[currentTopicId].updatedAt = new Date().toISOString(); persist(); populateTopicDialog(); });
    elements.saveNotes.addEventListener("click", () => { state.topics[currentTopicId].notes = elements.topicNotes.value.trim().slice(0, 1200); state.topics[currentTopicId].updatedAt = new Date().toISOString(); persist(); showToast("Anotação salva."); });
    elements.errorForm.addEventListener("submit", addTopicError);
    elements.errorsList.addEventListener("click", (event) => { const button = event.target.closest("[data-error-action]"); if (!button) return; if (button.dataset.errorAction === "review") reviewError(currentTopicId, button.dataset.errorId); else if (button.dataset.errorAction === "reopen") reopenError(currentTopicId, button.dataset.errorId); else deleteError(currentTopicId, button.dataset.errorId); });
    elements.globalErrorSubject.addEventListener("change", updateGlobalErrorTopics);
    elements.globalErrorForm.addEventListener("submit", submitGlobalError);
    elements.literatureForm.addEventListener("submit", submitLiterature);
    elements.examSubject.addEventListener("change", updateExamTopicOptions);
    elements.examForm.addEventListener("submit", submitExam);
    elements.reviewsEnabled.addEventListener("change", () => { elements.intervalSettings.disabled = !elements.reviewsEnabled.checked; });
    elements.saveSettings.addEventListener("click", saveSettings);
    elements.exportData.addEventListener("click", exportData);
    elements.importData.addEventListener("change", importData);
    elements.syncSummary.addEventListener("click", openSettings);
    elements.syncLogin.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = elements.syncLogin.querySelector("button[type='submit']");
      button.disabled = true;
      try { await cloudSync.signIn(elements.syncEmail.value.trim()); showToast("Link de acesso enviado por e-mail."); }
      catch (error) { showToast(error.message); }
      finally { button.disabled = false; }
    });
    elements.syncNow.addEventListener("click", async () => { await cloudSync.synchronize(); });
    elements.syncSignOut.addEventListener("click", async () => {
      try { await cloudSync.signOut(); showToast("Você saiu da sincronização."); }
      catch (error) { showToast(error.message); }
    });
    elements.resetProgress.addEventListener("click", () => { closeDialog(elements.settingsDialog); openDialog(elements.resetDialog); });
    elements.resetDialog.addEventListener("close", () => { if (elements.resetDialog.returnValue === "confirm") resetAll(); });
  }

  function handleMainClick(event) {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const name = action.dataset.action;
    if (name === "open-topic") openTopicDialog(action.dataset.topicId);
    else if (name === "quick-topic") setTopicStatus(action.dataset.topicId, state.topics[action.dataset.topicId].status === "mastered" ? "consolidating" : "mastered");
    else if (name === "navigate-subject") navigate("subject", action.dataset.subjectId);
    else if (name === "navigate") navigate(action.dataset.viewTarget);
    else if (name === "toggle-block") { const id = action.dataset.blockId; expandedBlocks.has(id) ? expandedBlocks.delete(id) : expandedBlocks.add(id); renderSubjectPage(findSubject(activeSubjectId)); }
    else if (name === "toggle-all-blocks") { const subject = findSubject(activeSubjectId); const allExpanded = subject.blocks.every((block) => expandedBlocks.has(block.id)); subject.blocks.forEach((block) => allExpanded ? expandedBlocks.delete(block.id) : expandedBlocks.add(block.id)); renderSubjectPage(subject); }
    else if (name === "open-global-error") openGlobalErrorDialog();
    else if (name === "review-error") reviewError(action.dataset.topicId, action.dataset.errorId);
    else if (name === "reopen-error") reopenError(action.dataset.topicId, action.dataset.errorId);
    else if (name === "delete-error") deleteError(action.dataset.topicId, action.dataset.errorId);
    else if (name === "complete-weekly-review") completeWeeklyReview();
    else if (name === "open-literature") openLiteratureDialog();
    else if (name === "edit-literature") openLiteratureDialog(action.dataset.workId);
    else if (name === "delete-literature") deleteLiterature(action.dataset.workId);
    else if (name === "open-exam") openExamDialog();
    else if (name === "delete-exam") { state.examQuestions = state.examQuestions.filter((question) => question.id !== action.dataset.questionId); persist(); renderCurrentView(); showToast("Questão removida."); }
  }

  function handleMainChange(event) {
    if (event.target.id === "status-filter") { currentStatusFilter = event.target.value; renderSubjectPage(findSubject(activeSubjectId)); }
    if (event.target.id === "error-status-filter") { currentErrorFilter = event.target.value; renderErrorsPage(); }
    if (event.target.id === "error-subject-filter") { currentErrorSubject = event.target.value; renderErrorsPage(); }
  }

  function findSubject(subjectId) { return subjects.find((subject) => subject.id === subjectId) || null; }
  function findTopic(topicId) { return allTopics.find((topic) => topic.id === topicId) || null; }
  function findError(topicId, errorId) { return state.topics[topicId]?.errors.find((error) => error.id === errorId) || null; }
  function byReviewDate(a, b) { return new Date(state.topics[a.id].review.nextAt) - new Date(state.topics[b.id].review.nextAt); }
  function addDays(date, days) { return new Date(date.getTime() + days * DAY_MS); }
  function endOfToday() { const date = new Date(); date.setHours(23, 59, 59, 999); return date; }
  function startOfWeek(date) { const result = new Date(date); const day = result.getDay(); result.setDate(result.getDate() - (day === 0 ? 6 : day - 1)); result.setHours(0, 0, 0, 0); return result; }
  function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "data indisponível" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }); }
  function formatShortDate(date) { return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
  function formatRelativeDate(value) { const date = new Date(value); const difference = Date.now() - date.getTime(); if (!Number.isFinite(difference)) return "recentemente"; if (difference < 60_000) return "agora"; if (difference < 3_600_000) return `há ${Math.floor(difference / 60_000)} min`; if (difference < DAY_MS) return `há ${Math.floor(difference / 3_600_000)} h`; if (difference < DAY_MS * 7) return `há ${Math.floor(difference / DAY_MS)} d`; return formatDate(date); }
  function getReviewDateText(topicState) { if (!state.settings.reviewsEnabled) return "Revisões desativadas"; if (topicState.status !== "mastered" || !topicState.review.nextAt) return ""; return isReviewDue(currentTopicId) ? "Revisão disponível" : `Próxima revisão: ${formatDate(topicState.review.nextAt)}`; }
  function toCamel(value) { return value.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase()); }
  function capitalize(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : ""; }
  function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function prefersReducedMotion() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function openSidebar() { elements.sidebar.classList.add("open"); elements.sidebarBackdrop.classList.add("visible"); }
  function closeSidebar() { elements.sidebar.classList.remove("open"); elements.sidebarBackdrop.classList.remove("visible"); }
  function openDialog(dialog) { if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); }
  function closeDialog(dialog) { if (!dialog?.open) return; if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); }
  function showToast(message) { clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add("visible"); toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 3000); }

  document.addEventListener("DOMContentLoaded", initialize);
})();
