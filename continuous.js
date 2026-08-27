(() => {
  "use strict";

  const DATA = window.TRAJETORIA_CONTINUOUS;
  const Storage = window.TrajetoriaContinuousStorage;
  const STATUS = {
    future: { label: "Futuro", icon: "○" },
    current: { label: "Atual", icon: "◐" },
    consolidated: { label: "Consolidado", icon: "✓" },
  };
  const RESULTS = { achieved: "Consegui", partial: "Parcial", stuck: "Travei", practiced: "Pratiquei" };
  const REPERTOIRE_STATUS = { learning: "Aprendendo", problem: "Trecho problemático", playable: "Tocável", consolidated: "Consolidada", maintenance: "Em manutenção" };
  const GAME_CATEGORIES = {
    "hanging-piece": "Peça pendurada", "missed-tactic": "Tática não vista", calculation: "Erro de cálculo",
    endgame: "Final", strategy: "Decisão estratégica", opening: "Abertura", time: "Uso do tempo",
  };
  const GAME_SKILLS = {
    "hanging-piece": "x-pecas-soltas", "missed-tactic": "x-tatica-mista", calculation: "x-variantes-curtas",
    endgame: "x-finais-peoes", strategy: "x-trocas-espaco", opening: "x-principios-abertura", time: "x-ameaca-candidatos",
  };

  let state = Storage.loadState();
  let host = {};
  let dialog = null;
  let dialogBody = null;
  let dialogTitle = null;
  let dialogEyebrow = null;
  let activeSession = null;

  function initialize(options) {
    host = options || {};
    dialog = document.getElementById("continuous-dialog");
    dialogBody = document.getElementById("continuous-dialog-body");
    dialogTitle = document.getElementById("continuous-dialog-title");
    dialogEyebrow = document.getElementById("continuous-dialog-eyebrow");
    document.getElementById("close-continuous-dialog")?.addEventListener("click", closeDialog);
    dialog?.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
    dialog?.addEventListener("click", handleDialogClick);
    document.addEventListener("submit", handlePageSubmit);
    document.addEventListener("change", handlePageChange);
  }

  function renderHomeSection() {
    return `
      <section class="continuous-home-section" aria-labelledby="continuous-home-title">
        <div class="section-heading continuous-heading"><div><p class="eyebrow">Formação contínua</p><h2 id="continuous-home-title">Continuar aprendendo</h2><p>Trilhas permanentes, sem porcentagem de conclusão total.</p></div><button class="text-button" type="button" data-action="navigate" data-view-target="continuous">Ver todas as trilhas</button></div>
        ${renderWeeklyPracticeSummary("continuous-weekly-home")}
        <div class="continuous-now-grid">${DATA.trails.map(renderNowCard).join("")}</div>
      </section>`;
  }

  function renderNowCard(trail) {
    const skill = getCurrentSkill(trail);
    const skillState = getSkillState(trail.id, skill.id);
    const lastDifficulty = getLastDifficulty(skillState);
    return `
      <article class="continuous-now-card" style="--trail-accent:${trail.accent}">
        <div class="trail-card-heading"><span class="trail-icon" aria-hidden="true">${trail.icon}</span><div><h3>${escapeHTML(trail.name)}</h3><p>${escapeHTML(skill.stage)}</p></div></div>
        <p class="now-label">Agora</p><strong>${escapeHTML(skill.objective)}</strong>
        ${lastDifficulty ? `<p class="last-difficulty"><span>Última dificuldade</span>${escapeHTML(lastDifficulty)}</p>` : ""}
        <p class="next-step"><span>Próximo passo</span>${escapeHTML(skill.applications[0])}</p>
        <div class="continuous-card-actions">
          <button class="primary-button continuous-button" type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${skill.id}">Estudar</button>
          ${renderPracticeButton(trail.id, skill.id, "secondary-button continuous-checkin-button")}
        </div>
        <button class="text-button continuous-open-trail" type="button" data-action="navigate-trail" data-trail-id="${trail.id}">Ver trilha →</button>
      </article>`;
  }

  function renderWeeklyPracticeSummary(titleId) {
    const week = getCurrentWeek();
    const trailDays = DATA.trails.map((trail) => ({ trail, days: getTrailPracticeDays(trail.id, week) }));
    const allDays = new Set(trailDays.flatMap(({ days }) => [...days]));
    return `
      <section class="continuous-weekly-summary" aria-labelledby="${titleId}">
        <div class="continuous-weekly-heading"><div><p class="eyebrow">Prática livre</p><strong id="${titleId}">Esta semana</strong><p>Sem meta obrigatória: apenas uma visão do que ganhou espaço nos seus dias.</p></div><span class="continuous-weekly-total">${formatDayCount(allDays.size)} com alguma prática</span></div>
        <div class="continuous-weekly-grid">${trailDays.map(({ trail, days }) => `
          <article class="continuous-weekly-item" style="--trail-accent:${trail.accent}"><span class="continuous-weekly-icon" aria-hidden="true">${trail.icon}</span><span><strong>${escapeHTML(trail.name)}</strong><small>${formatDayCount(days.size)} de prática</small></span></article>
        `).join("")}</div>
      </section>`;
  }

  function renderContinuousHome(mainContent) {
    const due = getDueSkills();
    mainContent.innerHTML = `
      <section class="page-intro formation-intro"><div><p class="eyebrow">${escapeHTML(DATA.config.pageTitle)}</p><h1>Formação contínua</h1><p class="intro-copy">Caminhos de longo prazo para saber onde você está, o que praticar agora e qual evidência permite avançar.</p></div><div class="priority-reminder"><span>Prioridade atual</span><strong>${escapeHTML(DATA.config.priority.label)}</strong><button type="button" data-action="navigate" data-view-target="home">Abrir preparação</button></div></section>
      ${renderWeeklyPracticeSummary("continuous-weekly-overview")}
      <section class="continuous-dashboard" aria-labelledby="continue-learning"><div class="section-heading"><div><p class="eyebrow">Agora</p><h2 id="continue-learning">Continuar aprendendo</h2></div></div><div class="continuous-now-grid expanded">${DATA.trails.map(renderNowCard).join("")}</div></section>
      <section class="review-queue" aria-labelledby="continuous-review-title"><div class="section-heading"><div><p class="eyebrow">Revisão simples e transparente</p><h2 id="continuous-review-title">Vale revisar</h2></div><span>${due.length} ${due.length === 1 ? "item" : "itens"}</span></div>${due.length ? `<div class="continuous-review-list">${due.map(({ trail, skill }) => `<button type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${skill.id}"><span>${trail.icon}</span><span><small>${escapeHTML(trail.name)} · ${escapeHTML(skill.stage)}</small><strong>${escapeHTML(skill.title)}</strong></span><b>Revisar →</b></button>`).join("")}</div>` : `<p class="continuous-empty">Nada venceu hoje. Uma habilidade consolidada aparecerá aqui no intervalo programado.</p>`}</section>
    `;
  }

  function renderTrailPage(mainContent, trailId) {
    const trail = findTrail(trailId);
    if (!trail) return host.navigate?.("continuous");
    Storage.reconcileUnlocks(state, trail);
    const current = getCurrentSkill(trail);
    const currentState = getSkillState(trail.id, current.id);
    const due = trail.skills.filter((skill) => Storage.due(getSkillState(trail.id, skill.id)));
    mainContent.innerHTML = `
      <section class="page-intro trail-intro" style="--trail-accent:${trail.accent}">
        <div><p class="eyebrow">Formação contínua · ${escapeHTML(current.stage)}</p><h1><span aria-hidden="true">${trail.icon}</span> ${escapeHTML(trail.name)}</h1><p class="intro-copy">${escapeHTML(trail.description)}</p></div>
        <div class="trail-current-summary"><span>Habilidade atual</span><strong>${escapeHTML(current.title)}</strong><small>${escapeHTML(current.objective)}</small></div>
      </section>
      <section class="trail-continue" style="--trail-accent:${trail.accent}"><div><p class="eyebrow">Continue de onde parou</p><h2>${escapeHTML(current.title)}</h2><p>${escapeHTML(getLastDifficulty(currentState) || current.applications[0])}</p></div><div class="trail-continue-actions"><button class="primary-button continuous-hero-button" type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${current.id}">Estudar</button>${renderPracticeButton(trail.id, current.id, "secondary-button continuous-checkin-button")}</div></section>
      ${renderEnglishCompetencies(trail)}
      ${renderRecurringChessFocus(trail)}
      ${due.length ? `<section class="trail-due"><p class="eyebrow">Vale revisar nesta trilha</p>${due.map((skill) => `<button type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${skill.id}">↻ ${escapeHTML(skill.title)} <span>Revisar →</span></button>`).join("")}</section>` : ""}
      <section class="trail-path-section"><div class="section-heading"><div><p class="eyebrow">Caminho</p><h2>${trail.timeline ? "Linha do tempo navegável" : "Seu caminho de formação"}</h2><p>✓ consolidado · ◐ atual · ○ futuro</p></div></div>${trail.transversalAxes ? `<div class="transversal-axes" aria-label="Eixos transversais">${trail.transversalAxes.map((axis) => `<span>${escapeHTML(axis)}</span>`).join("")}</div>` : ""}<div class="trail-path ${trail.timeline ? "art-timeline" : ""}">${trail.stages.map((stage) => renderStage(trail, stage, current.id)).join("")}</div></section>
      ${trail.repertoire ? renderRepertoire(trail) : ""}
      ${trail.gameLog ? renderChessLog(trail) : ""}
      ${renderPracticeHistory(trail)}
    `;
  }

  function renderStage(trail, stage, currentId) {
    return `<article class="trail-stage"><header><span>${escapeHTML(stage.id.toUpperCase())}</span><div><h3>${escapeHTML(stage.name)}</h3><p>${escapeHTML(stage.description)}</p></div></header><ol>${stage.skills.map((skill) => renderPathSkill(trail, skill, currentId)).join("")}</ol></article>`;
  }

  function renderPathSkill(trail, skill, currentId) {
    const skillState = getSkillState(trail.id, skill.id);
    const displayStatus = skillState.status === "consolidated" ? "consolidated" : skill.id === currentId ? "current" : "future";
    const status = STATUS[displayStatus];
    const blockedClass = skillState.status === "blocked" ? " blocked" : "";
    return `<li class="path-skill ${displayStatus}${blockedClass}" data-skill-status="${skillState.status}"><button type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${skill.id}" ${skillState.status === "blocked" ? "disabled" : ""}><span class="path-marker" aria-hidden="true">${status.icon}</span><span><strong>${escapeHTML(skill.title)}</strong><small>${escapeHTML(skill.objective)}</small></span><b>${status.label}</b></button></li>`;
  }

  function renderEnglishCompetencies(trail) {
    if (!trail.competencies) return "";
    return `<section class="competency-panel"><div><p class="eyebrow">Competências independentes</p><h2>Seu inglês não precisa avançar em bloco</h2></div><div class="competency-grid">${Object.entries(trail.competencies).map(([id, name]) => `<div><span>${escapeHTML(name)}</span><strong>${escapeHTML(getCompetencyLevel(trail, id))}</strong></div>`).join("")}</div></section>`;
  }

  function getCompetencyLevel(trail, competency) {
    const skills = trail.skills.filter((skill) => skill.tags.includes(`competency:${competency}`));
    const active = skills.filter((skill) => getSkillState(trail.id, skill.id).status !== "blocked");
    const skill = active.at(-1) || skills[0];
    return skill?.tags.find((tag) => tag.startsWith("level:"))?.slice(6) || "Pre-A1";
  }

  function renderRepertoire(trail) {
    const repertoire = state.trails[trail.id].repertoire;
    return `<section class="special-trail-section" id="repertorio"><div class="section-heading"><div><p class="eyebrow">Parte central do aprendizado</p><h2>Repertório</h2><p>Músicas avançam junto com a técnica; não é necessário terminar a trilha.</p></div></div><form class="compact-entry-form" id="repertoire-form" data-trail-id="${trail.id}"><label>Música<input name="title" maxlength="140" required placeholder="Nome da música ou peça" /></label><label>Situação<select name="status">${Object.entries(REPERTOIRE_STATUS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><label>Trecho ou dificuldade<input name="problem" maxlength="500" placeholder="Ex.: troca C → G no refrão" /></label><button class="secondary-button" type="submit">Adicionar</button></form>${repertoire.length ? `<div class="repertoire-list">${repertoire.map((item) => `<article><div><span>${escapeHTML(REPERTOIRE_STATUS[item.status])}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.problem || "Nenhum trecho problemático registrado.")}</p></div><label><span class="sr-only">Atualizar situação</span><select data-continuous-change="repertoire-status" data-trail-id="${trail.id}" data-item-id="${item.id}">${Object.entries(REPERTOIRE_STATUS).map(([value, label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><button class="icon-text-button danger-text" type="button" data-continuous-action="delete-repertoire" data-trail-id="${trail.id}" data-item-id="${item.id}">Excluir</button></article>`).join("")}</div>` : `<p class="continuous-empty">Seu repertório ainda está vazio. Adicione a música que já estuda ou quer começar.</p>`}</section>`;
  }

  function renderChessLog(trail) {
    const games = [...state.trails[trail.id].games].reverse();
    return `<section class="special-trail-section"><div class="section-heading"><div><p class="eyebrow">Jogar → analisar sozinho → comparar</p><h2>Aprender com suas partidas</h2><p>Registre apenas o erro principal depois de analisar por conta própria.</p></div></div><form class="compact-entry-form chess-form" id="chess-game-form" data-trail-id="${trail.id}"><label>Categoria<select name="category">${Object.entries(GAME_CATEGORIES).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><label>Resultado<input name="result" maxlength="30" placeholder="Ex.: derrota" /></label><label>Momento crítico ou hipótese<input name="note" maxlength="600" required placeholder="O que você pensou antes de consultar a engine?" /></label><button class="secondary-button" type="submit">Registrar partida</button></form>${games.length ? `<div class="game-log">${games.slice(0, 8).map((game) => `<div><span>${escapeHTML(GAME_CATEGORIES[game.category])}</span><p>${escapeHTML(game.note)}</p><small>${formatDate(game.date)}</small></div>`).join("")}</div>` : `<p class="continuous-empty">Nenhuma partida analisada foi registrada.</p>`}</section>`;
  }

  function renderRecurringChessFocus(trail) {
    if (!trail.gameLog) return "";
    const counts = state.trails[trail.id].games.reduce((result, game) => ({ ...result, [game.category]: (result[game.category] || 0) + 1 }), {});
    const recurring = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!recurring || recurring[1] < 2) return "";
    const skill = findSkill(trail, GAME_SKILLS[recurring[0]]);
    return `<section class="recurring-focus"><span>Erro recorrente detectado</span><div><strong>${escapeHTML(GAME_CATEGORIES[recurring[0]])}</strong><p>Apareceu em ${recurring[1]} registros. Próximo objetivo sugerido: ${escapeHTML(skill?.title || "revisar o processo de decisão")}.</p></div>${skill ? `<button class="secondary-button" type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${skill.id}">Praticar</button>` : ""}</section>`;
  }

  function renderPracticeHistory(trail) {
    const entries = trail.skills.flatMap((skill) => getSkillState(trail.id, skill.id).practiceLog.map((entry) => ({ ...entry, skill }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12);
    return `<details class="practice-history"><summary>Histórico de prática <span>${entries.length ? `${entries.length} recente${entries.length === 1 ? "" : "s"}` : "vazio"}</span></summary>${entries.length ? `<div>${entries.map((entry) => `<article><span class="result-${entry.result}">${escapeHTML(RESULTS[entry.result] || "Prática")}</span><p><strong>${escapeHTML(entry.skill.title)}</strong>${entry.note ? `<small>${escapeHTML(entry.note)}</small>` : ""}</p><time>${formatDate(entry.date)}</time></article>`).join("")}</div>` : `<p class="continuous-empty">As práticas concluídas aparecerão aqui.</p>`}</details>`;
  }

  function openSkill(trailId, skillId) {
    const trail = findTrail(trailId);
    const skill = findSkill(trail, skillId);
    if (!trail || !skill) return;
    const skillState = getSkillState(trail.id, skill.id);
    if (skillState.status === "blocked") return;
    activeSession = { trailId, skillId };
    dialogEyebrow.textContent = `${trail.icon} ${trail.name} · ${skill.stage}`;
    dialogTitle.textContent = skill.title;
    const connections = getConnections(skill);
    const practicedToday = hasPracticedToday(trail.id);
    dialogBody.innerHTML = `
      <section class="skill-overview"><div><span>Objetivo</span><p>${escapeHTML(skill.objective)}</p></div><div><span>Por que importa</span><p>${escapeHTML(skill.why)}</p></div></section>
      <section class="skill-study-guide"><div class="skill-practices"><p class="eyebrow">Como estudar</p><ul>${skill.practices.map((practice) => `<li>${escapeHTML(practice)}</li>`).join("")}</ul></div><div class="skill-applications"><p class="eyebrow">Aplicar</p><ul>${skill.applications.map((application) => `<li>${escapeHTML(application)}</li>`).join("")}</ul></div></section>
      <section class="mastery-evidence"><p class="eyebrow">Critério de domínio</p>${skill.mastery.map((criterion) => `<p>✓ ${escapeHTML(criterion)}</p>`).join("")}</section>
      ${connections.length ? `<section class="skill-connections"><p class="eyebrow">Conexões</p>${connections.map(({ trail: targetTrail, skill: targetSkill }) => `<button type="button" data-continuous-action="jump-connection" data-trail-id="${targetTrail.id}" data-skill-id="${targetSkill.id}">${targetTrail.icon} ${escapeHTML(targetTrail.name)} · ${escapeHTML(targetSkill.title)} →</button>`).join("")}</section>` : ""}
      <section class="continuous-practice-checkin">
        <div class="continuous-practice-checkin-copy"><p class="eyebrow">Registro leve</p><h3 data-continuous-practice-status="${trail.id}">${practicedToday ? "Prática de hoje registrada" : "Praticou hoje?"}</h3><p>Um toque basta. Não há tempo mínimo nem meta obrigatória.</p></div>
        ${practicedToday ? "" : `<details class="continuous-observation"><summary>Adicionar observação <span>opcional</span></summary><label>Observação<textarea name="practice-note" rows="3" maxlength="600" placeholder="Algo que queira lembrar desta prática"></textarea></label></details>`}
        <div class="continuous-skill-actions">${renderPracticeButton(trail.id, skill.id, "primary-button continuous-dialog-checkin")}${skillState.status !== "consolidated" ? `<button class="secondary-button continuous-consolidate-button" type="button" data-continuous-action="consolidate-skill">Consolidar</button>` : ""}</div>
      </section>
      ${skillState.status === "consolidated" ? `<p class="consolidated-note">✓ Habilidade consolidada. O conteúdo permanece disponível para consulta.</p>` : ""}`;
    showDialog();
  }

  function renderPracticeButton(trailId, skillId, className) {
    const practicedToday = hasPracticedToday(trailId);
    return `<button class="${className}" type="button" data-continuous-action="practice-today" data-trail-id="${trailId}" data-skill-id="${skillId}" aria-pressed="${practicedToday}" ${practicedToday ? "disabled" : ""}>${practicedToday ? "✓ Praticado hoje" : "Pratiquei hoje"}</button>`;
  }

  function ensurePracticeToday(trail, skill, note = "") {
    const skillState = getSkillState(trail.id, skill.id);
    if (!skillState || skillState.status === "blocked") return false;
    const now = new Date();
    const dayKey = localDayKey(now);
    if (hasPracticedOnDay(trail.id, dayKey)) return false;
    const timestamp = now.toISOString();
    const entryId = `hobby-checkin:${trail.id}:${dayKey}`;
    const entry = {
      id: entryId, date: timestamp, dayKey, result: "practiced", note: String(note || "").slice(0, 600),
      trailId: trail.id, skillId: skill.id,
    };
    skillState.practiceLog = skillState.practiceLog.filter((item) => item.id !== entryId);
    skillState.practiceLog.push({ ...entry });
    skillState.practiceLog = skillState.practiceLog.slice(-100);
    skillState.lastPractice = timestamp;
    skillState.updatedAt = timestamp;
    if (skillState.status === "available") skillState.status = "learning";
    const trailState = state.trails[trail.id];
    if (!['blocked', 'consolidated'].includes(skillState.status)) {
      trailState.currentSkillId = skill.id;
      trailState.currentSkillUpdatedAt = timestamp;
    }
    trailState.updatedAt = timestamp;
    state.activity = state.activity.filter((item) => item.id !== entryId);
    state.activity.push({ ...entry });
    state.activity = state.activity.slice(-300);
    return true;
  }

  function recordPracticeToday(trailId, skillId, note = "") {
    const trail = findTrail(trailId);
    const skill = findSkill(trail, skillId);
    if (!trail || !skill) return;
    if (!ensurePracticeToday(trail, skill, note)) {
      toast("A prática de hoje já está registrada.");
      updatePracticeButtons(trail.id);
      return;
    }
    persist();
    host.renderCurrentView?.();
    updatePracticeButtons(trail.id);
    toast(`${trail.name}: prática de hoje registrada.`);
  }

  function updatePracticeButtons(trailId) {
    document.querySelectorAll('[data-continuous-action="practice-today"]').forEach((button) => {
      if (button.dataset.trailId !== trailId) return;
      button.disabled = true;
      button.setAttribute("aria-pressed", "true");
      button.textContent = "✓ Praticado hoje";
    });
    document.querySelectorAll("[data-continuous-practice-status]").forEach((element) => {
      if (element.dataset.continuousPracticeStatus === trailId) element.textContent = "Prática de hoje registrada";
    });
    dialogBody?.querySelector(".continuous-observation")?.setAttribute("hidden", "");
  }

  function consolidateActiveSkill() {
    if (!activeSession) return;
    const trail = findTrail(activeSession.trailId);
    const skill = findSkill(trail, activeSession.skillId);
    if (!trail || !skill) return;
    const skillState = getSkillState(trail.id, skill.id);
    ensurePracticeToday(trail, skill, getDialogPracticeNote());
    const now = new Date().toISOString();
    skillState.status = "consolidated";
    skillState.consolidatedAt = now;
    skillState.updatedAt = now;
    skillState.review = { step: 0, nextAt: Storage.addDays(DATA.config.reviewIntervals[0]) };
    Storage.reconcileUnlocks(state, trail);
    const nextSkill = getNextEligibleSkill(trail);
    const trailState = state.trails[trail.id];
    trailState.currentSkillId = nextSkill?.id || null;
    trailState.currentSkillUpdatedAt = now;
    trailState.updatedAt = now;
    persist();
    closeDialog();
    host.renderCurrentView?.();
    toast(nextSkill ? `${skill.title} consolidado. Próximo: ${nextSkill.title}.` : `${skill.title} consolidado.`);
  }

  function getNextEligibleSkill(trail) {
    return trail.skills.find((skill) => !["blocked", "consolidated"].includes(getSkillState(trail.id, skill.id).status)) || null;
  }

  function getCurrentSkill(trail) {
    const trailState = state.trails[trail.id];
    const selected = findSkill(trail, trailState.currentSkillId);
    if (selected && !["blocked", "consolidated"].includes(trailState.skills[selected.id].status)) return selected;
    const due = trail.skills.find((skill) => Storage.due(trailState.skills[skill.id]));
    if (due) return due;
    const active = trail.skills.find((skill) => ["learning", "practicing", "review"].includes(trailState.skills[skill.id].status));
    if (active) return active;
    const available = trail.skills.find((skill) => trailState.skills[skill.id].status === "available");
    return available || trail.skills.at(-1);
  }

  function getDueSkills() {
    return DATA.trails.flatMap((trail) => trail.skills.filter((skill) => Storage.due(getSkillState(trail.id, skill.id))).map((skill) => ({ trail, skill })));
  }

  function getLastDifficulty(skillState) {
    const entry = [...skillState.practiceLog].reverse().find((item) => item.note && ["partial", "stuck"].includes(item.result));
    return entry?.note || skillState.notes || "";
  }

  function getConnections(skill) {
    const all = DATA.trails.flatMap((trail) => trail.skills.map((candidate) => ({ trail, skill: candidate })));
    return all.filter((candidate) => candidate.skill.id !== skill.id && (skill.tags.includes(candidate.skill.id) || candidate.skill.tags.includes(skill.id))).slice(0, 4);
  }

  function handleAction(action) {
    const name = action.dataset.continuousAction;
    if (!name) return false;
    if (name === "open-skill") openSkill(action.dataset.trailId, action.dataset.skillId);
    else if (name === "practice-today") recordPracticeToday(action.dataset.trailId, action.dataset.skillId);
    else if (name === "delete-repertoire") deleteRepertoire(action.dataset.trailId, action.dataset.itemId);
    return true;
  }

  function handleDialogClick(event) {
    const action = event.target.closest("[data-continuous-action]");
    if (!action) return;
    const name = action.dataset.continuousAction;
    if (name === "practice-today") recordPracticeToday(action.dataset.trailId, action.dataset.skillId, getDialogPracticeNote());
    else if (name === "consolidate-skill") consolidateActiveSkill();
    else if (name === "jump-connection") { closeDialog(); host.navigate?.("trail", action.dataset.trailId); setTimeout(() => openSkill(action.dataset.trailId, action.dataset.skillId), 0); }
  }

  function handlePageSubmit(event) {
    if (event.target.id === "repertoire-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const trailId = event.target.dataset.trailId;
      const now = new Date().toISOString();
      state.trails[trailId].repertoire.push({ id: Storage.id(), title: data.get("title").trim(), status: data.get("status"), problem: data.get("problem").trim(), skillIds: [], updatedAt: now });
      state.trails[trailId].updatedAt = now;
      persist(); host.renderCurrentView?.(); toast("Música adicionada ao repertório.");
    } else if (event.target.id === "chess-game-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const trailId = event.target.dataset.trailId;
      const now = new Date().toISOString();
      state.trails[trailId].games.push({ id: Storage.id(), category: data.get("category"), result: data.get("result").trim(), note: data.get("note").trim(), date: now });
      state.trails[trailId].games = state.trails[trailId].games.slice(-100);
      state.trails[trailId].updatedAt = now;
      persist(); host.renderCurrentView?.(); toast("Partida registrada para análise.");
    }
  }

  function handlePageChange(event) {
    const action = event.target.dataset.continuousChange;
    if (action === "repertoire-status") {
      const trailState = state.trails[event.target.dataset.trailId];
      const item = trailState.repertoire.find((candidate) => candidate.id === event.target.dataset.itemId);
      if (item) { const now = new Date().toISOString(); item.status = event.target.value; item.updatedAt = now; trailState.updatedAt = now; persist(); toast("Situação do repertório atualizada."); }
    }
  }

  function deleteRepertoire(trailId, itemId) {
    const trailState = state.trails[trailId];
    const now = new Date().toISOString();
    trailState.repertoire = trailState.repertoire.filter((item) => item.id !== itemId);
    trailState.deletedRepertoire = trailState.deletedRepertoire.filter((item) => item.id !== itemId);
    trailState.deletedRepertoire.push({ id: itemId, deletedAt: now });
    trailState.updatedAt = now;
    persist(); host.renderCurrentView?.(); toast("Música removida do repertório.");
  }

  function exportState() { return state; }
  function importState(candidate) { state = Storage.normalizeState(candidate); Storage.saveState(state); }
  function resetState() { state = Storage.createDefaultState(); Storage.saveState(state); }
  function mergeStates(localCandidate, remoteCandidate) { return Storage.mergeStates(localCandidate, remoteCandidate); }
  function persist() { Storage.saveState(state); host.queueCloudSave?.(); }
  function findTrail(trailId) { return DATA.trails.find((trail) => trail.id === trailId) || null; }
  function findSkill(trail, skillId) { return trail?.skills.find((skill) => skill.id === skillId) || null; }
  function getSkillState(trailId, skillId) { return state.trails[trailId].skills[skillId]; }
  function getDialogPracticeNote() { return dialogBody?.querySelector('[name="practice-note"]')?.value.trim().slice(0, 600) || ""; }

  function getCurrentWeek(reference = new Date()) {
    const start = new Date(reference);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: localDayKey(start), end: localDayKey(end) };
  }

  function getTrailPracticeDayKeys(trailId) {
    const days = new Set();
    const collect = (entry) => {
      if (!Storage.VALID_RESULTS.includes(entry?.result)) return;
      const dayKey = practiceDayKey(entry);
      if (dayKey) days.add(dayKey);
    };
    state.activity.filter((entry) => entry.trailId === trailId).forEach(collect);
    const trail = findTrail(trailId);
    trail?.skills.forEach((skill) => getSkillState(trailId, skill.id).practiceLog.forEach(collect));
    return days;
  }

  function getTrailPracticeDays(trailId, week = getCurrentWeek()) {
    return new Set([...getTrailPracticeDayKeys(trailId)].filter((dayKey) => dayKey >= week.start && dayKey <= week.end));
  }

  function hasPracticedOnDay(trailId, dayKey) { return getTrailPracticeDayKeys(trailId).has(dayKey); }
  function hasPracticedToday(trailId) { return hasPracticedOnDay(trailId, localDayKey(new Date())); }
  function practiceDayKey(entry) { return /^\d{4}-\d{2}-\d{2}$/.test(entry?.dayKey || "") ? entry.dayKey : localDayKey(entry?.date); }
  function localDayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatDayCount(count) { return `${count} ${count === 1 ? "dia" : "dias"}`; }
  function showDialog() { if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); }
  function closeDialog() { if (!dialog?.open) return; if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); }
  function toast(message) { if (host.showToast) host.showToast(message); }
  function formatDate(value) { return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

  window.TrajetoriaContinuous = { initialize, renderHomeSection, renderContinuousHome, renderTrailPage, handleAction, exportState, importState, resetState, mergeStates };
})();
