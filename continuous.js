(() => {
  "use strict";

  const DATA = window.TRAJETORIA_CONTINUOUS;
  const Storage = window.TrajetoriaContinuousStorage;
  const STATUS = {
    blocked: { label: "Futuro", icon: "🔒" }, available: { label: "Disponível", icon: "○" },
    learning: { label: "Aprendendo", icon: "◐" }, practicing: { label: "Praticando", icon: "◐" },
    consolidated: { label: "Consolidado", icon: "✓" }, review: { label: "Revisar", icon: "↻" },
  };
  const RESULTS = { achieved: "Consegui", partial: "Parcial", stuck: "Travei" };
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
    dialog?.addEventListener("submit", handleDialogSubmit);
    document.addEventListener("submit", handlePageSubmit);
    document.addEventListener("change", handlePageChange);
  }

  function renderHomeSection() {
    return `
      <section class="continuous-home-section" aria-labelledby="continuous-home-title">
        <div class="section-heading continuous-heading"><div><p class="eyebrow">Formação contínua</p><h2 id="continuous-home-title">Continuar aprendendo</h2><p>Trilhas permanentes, sem porcentagem de conclusão total.</p></div><button class="text-button" type="button" data-action="navigate" data-view-target="continuous">Ver todas as trilhas</button></div>
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
        <button class="primary-button continuous-button" type="button" data-action="navigate-trail" data-trail-id="${trail.id}">Continuar →</button>
      </article>`;
  }

  function renderContinuousHome(mainContent) {
    const due = getDueSkills();
    mainContent.innerHTML = `
      <section class="page-intro formation-intro"><div><p class="eyebrow">${escapeHTML(DATA.config.pageTitle)}</p><h1>Formação contínua</h1><p class="intro-copy">Caminhos de longo prazo para saber onde você está, o que praticar agora e qual evidência permite avançar.</p></div><div class="priority-reminder"><span>Prioridade atual</span><strong>${escapeHTML(DATA.config.priority.label)}</strong><button type="button" data-action="navigate" data-view-target="home">Abrir preparação</button></div></section>
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
      <section class="trail-continue" style="--trail-accent:${trail.accent}"><div><p class="eyebrow">Continue de onde parou</p><h2>${escapeHTML(current.title)}</h2><p>${escapeHTML(getLastDifficulty(currentState) || current.applications[0])}</p></div><button class="primary-button continuous-hero-button" type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${current.id}">Continuar</button></section>
      <section class="session-duration" aria-labelledby="duration-title"><div><p class="eyebrow">Sessão flexível</p><h2 id="duration-title">Tenho agora</h2><p>Os tempos são referências; não há cronômetro obrigatório.</p></div><div>${DATA.config.sessionDurations.map((minutes) => `<button class="secondary-button" type="button" data-continuous-action="start-session" data-trail-id="${trail.id}" data-skill-id="${current.id}" data-minutes="${minutes}">${minutes} min</button>`).join("")}<button class="secondary-button" type="button" data-continuous-action="start-session" data-trail-id="${trail.id}" data-skill-id="${current.id}" data-minutes="free">Continuar livremente</button></div></section>
      ${renderEnglishCompetencies(trail)}
      ${renderRecurringChessFocus(trail)}
      ${due.length ? `<section class="trail-due"><p class="eyebrow">Vale revisar nesta trilha</p>${due.map((skill) => `<button type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${skill.id}">↻ ${escapeHTML(skill.title)} <span>Revisar →</span></button>`).join("")}</section>` : ""}
      <section class="trail-path-section"><div class="section-heading"><div><p class="eyebrow">Caminho</p><h2>${trail.timeline ? "Linha do tempo navegável" : "Seu caminho de formação"}</h2><p>✓ consolidado · ◐ atual · ○ disponível · 🔒 futuro</p></div></div>${trail.transversalAxes ? `<div class="transversal-axes" aria-label="Eixos transversais">${trail.transversalAxes.map((axis) => `<span>${escapeHTML(axis)}</span>`).join("")}</div>` : ""}<div class="trail-path ${trail.timeline ? "art-timeline" : ""}">${trail.stages.map((stage) => renderStage(trail, stage, current.id)).join("")}</div></section>
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
    const displayStatus = Storage.due(skillState) ? "review" : skillState.status;
    const status = STATUS[displayStatus];
    return `<li class="path-skill ${displayStatus} ${skill.id === currentId ? "current" : ""}"><button type="button" data-continuous-action="open-skill" data-trail-id="${trail.id}" data-skill-id="${skill.id}" ${skillState.status === "blocked" ? "disabled" : ""}><span class="path-marker" aria-hidden="true">${skill.id === currentId && displayStatus !== "consolidated" ? "◐" : status.icon}</span><span><strong>${escapeHTML(skill.title)}</strong><small>${escapeHTML(skill.objective)}</small></span><b>${skill.id === currentId ? "Atual" : status.label}</b></button></li>`;
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
    return `<details class="practice-history"><summary>Histórico de prática <span>${entries.length ? `${entries.length} recente${entries.length === 1 ? "" : "s"}` : "vazio"}</span></summary>${entries.length ? `<div>${entries.map((entry) => `<article><span class="result-${entry.result}">${escapeHTML(RESULTS[entry.result])}</span><p><strong>${escapeHTML(entry.skill.title)}</strong>${entry.note ? `<small>${escapeHTML(entry.note)}</small>` : ""}</p><time>${formatDate(entry.date)}</time></article>`).join("")}</div>` : `<p class="continuous-empty">As práticas concluídas aparecerão aqui.</p>`}</details>`;
  }

  function openSkill(trailId, skillId) {
    const trail = findTrail(trailId);
    const skill = findSkill(trail, skillId);
    if (!trail || !skill) return;
    const skillState = getSkillState(trail.id, skill.id);
    if (skillState.status === "blocked") return;
    activeSession = { trailId, skillId, minutes: null };
    dialogEyebrow.textContent = `${trail.icon} ${trail.name} · ${skill.stage}`;
    dialogTitle.textContent = skill.title;
    const connections = getConnections(skill);
    dialogBody.innerHTML = `<section class="skill-overview"><div><span>Objetivo</span><p>${escapeHTML(skill.objective)}</p></div><div><span>Por que importa</span><p>${escapeHTML(skill.why)}</p></div></section><section class="mastery-evidence"><p class="eyebrow">Critério de domínio</p>${skill.mastery.map((criterion) => `<p>✓ ${escapeHTML(criterion)}</p>`).join("")}</section>${connections.length ? `<section class="skill-connections"><p class="eyebrow">Conexões</p>${connections.map(({ trail: targetTrail, skill: targetSkill }) => `<button type="button" data-continuous-action="jump-connection" data-trail-id="${targetTrail.id}" data-skill-id="${targetSkill.id}">${targetTrail.icon} ${escapeHTML(targetTrail.name)} · ${escapeHTML(targetSkill.title)} →</button>`).join("")}</section>` : ""}<section class="dialog-duration"><p class="eyebrow">Tenho agora</p><div>${DATA.config.sessionDurations.map((minutes) => `<button class="secondary-button" type="button" data-continuous-action="choose-duration" data-minutes="${minutes}">${minutes} min</button>`).join("")}<button class="secondary-button" type="button" data-continuous-action="choose-duration" data-minutes="free">Continuar livremente</button></div></section>${skillState.status !== "consolidated" ? `<button class="text-button mastery-button" type="button" data-continuous-action="consolidate-skill">O critério já está funcional — consolidar</button>` : `<p class="consolidated-note">✓ Habilidade consolidada. Ela continuará voltando para revisão.</p>`}`;
    showDialog();
  }

  function startSession(trailId, skillId, minutes) {
    const trail = findTrail(trailId);
    const skill = findSkill(trail, skillId);
    if (!trail || !skill) return;
    const trailState = state.trails[trail.id];
    const skillState = trailState.skills[skill.id];
    if (skillState.status === "available") skillState.status = "learning";
    trailState.currentSkillId = skill.id;
    skillState.updatedAt = new Date().toISOString();
    persist();
    activeSession = { trailId, skillId, minutes };
    const due = trail.skills.find((candidate) => candidate.id !== skill.id && Storage.due(getSkillState(trail.id, candidate.id)));
    const steps = buildSessionSteps(skill, due, minutes);
    dialogEyebrow.textContent = `${trail.icon} ${trail.name} · ${minutes === "free" ? "sessão livre" : `${minutes} min`}`;
    dialogTitle.textContent = skill.title;
    dialogBody.innerHTML = `<section class="session-plan"><p class="eyebrow">Prática sugerida</p><ol>${steps.map((step) => `<li>${escapeHTML(step)}</li>`).join("")}</ol>${due ? `<p class="review-in-session">↻ Revisão incluída: ${escapeHTML(due.title)}</p>` : ""}</section><section class="session-finish"><p class="eyebrow">Ao terminar</p><h3>Como foi?</h3><form id="continuous-result-form"><div class="result-buttons"><button type="submit" name="result" value="achieved">Consegui</button><button type="submit" name="result" value="partial">Parcial</button><button type="submit" name="result" value="stuck">Travei</button></div><label>O que aconteceu? <span>opcional</span><textarea name="note" rows="3" maxlength="600" placeholder="Ex.: o ritmo quebrava na troca C → G"></textarea></label></form></section>`;
    showDialog();
  }

  function buildSessionSteps(skill, due, minutes) {
    const short = minutes === 10;
    const steps = ["Tente realizar a habilidade uma vez sem consultar instruções."];
    if (due && !short) steps.push(`Recupere brevemente: ${due.title}. Confira somente depois da tentativa.`);
    steps.push(skill.practices[0]);
    if (!short && skill.practices[1]) steps.push(skill.practices[1]);
    steps.push(skill.applications[0]);
    if (minutes === 40 || minutes === "free") steps.push("Repita o todo em uma situação ligeiramente diferente e compare o resultado.");
    return steps;
  }

  function recordResult(result, note) {
    if (!activeSession || !Storage.VALID_RESULTS.includes(result)) return;
    const trail = findTrail(activeSession.trailId);
    const skill = findSkill(trail, activeSession.skillId);
    const skillState = getSkillState(trail.id, skill.id);
    const now = new Date().toISOString();
    skillState.practiceLog.push({ id: Storage.id(), date: now, result, note: note.slice(0, 600) });
    skillState.practiceLog = skillState.practiceLog.slice(-100);
    skillState.lastPractice = now;
    skillState.updatedAt = now;
    if (note) skillState.notes = note.slice(0, 1200);
    if (result === "stuck") {
      skillState.status = "learning";
      skillState.review.step = 0;
      skillState.review.nextAt = Storage.addDays(1);
    } else if (result === "partial") {
      if (skillState.status !== "consolidated") skillState.status = "practicing";
      skillState.review.nextAt = Storage.addDays(3);
    } else {
      if (skillState.status !== "consolidated") skillState.status = "practicing";
      skillState.review.step += 1;
      skillState.review.nextAt = Storage.addDays(DATA.config.reviewIntervals[Math.min(skillState.review.step, DATA.config.reviewIntervals.length - 1)]);
    }
    state.activity.push({ id: Storage.id(), trailId: trail.id, skillId: skill.id, result, note: note.slice(0, 600), date: now });
    state.activity = state.activity.slice(-300);
    persist();
    closeDialog();
    host.renderCurrentView?.();
    toast(`Prática registrada: ${RESULTS[result].toLowerCase()}.`);
  }

  function consolidateActiveSkill() {
    if (!activeSession) return;
    const trail = findTrail(activeSession.trailId);
    const skill = findSkill(trail, activeSession.skillId);
    const skillState = getSkillState(trail.id, skill.id);
    const now = new Date().toISOString();
    skillState.status = "consolidated";
    skillState.consolidatedAt = now;
    skillState.updatedAt = now;
    skillState.review = { step: 0, nextAt: Storage.addDays(DATA.config.reviewIntervals[0]) };
    Storage.reconcileUnlocks(state, trail);
    state.trails[trail.id].currentSkillId = null;
    persist();
    closeDialog();
    host.renderCurrentView?.();
    toast(`${skill.title} consolidado. Novos passos podem estar disponíveis.`);
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
    const entry = [...skillState.practiceLog].reverse().find((item) => item.note && item.result !== "achieved");
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
    else if (name === "start-session") startSession(action.dataset.trailId, action.dataset.skillId, parseMinutes(action.dataset.minutes));
    else if (name === "delete-repertoire") deleteRepertoire(action.dataset.trailId, action.dataset.itemId);
    return true;
  }

  function handleDialogClick(event) {
    const action = event.target.closest("[data-continuous-action]");
    if (!action) return;
    const name = action.dataset.continuousAction;
    if (name === "choose-duration") startSession(activeSession.trailId, activeSession.skillId, parseMinutes(action.dataset.minutes));
    else if (name === "consolidate-skill") consolidateActiveSkill();
    else if (name === "jump-connection") { closeDialog(); host.navigate?.("trail", action.dataset.trailId); setTimeout(() => openSkill(action.dataset.trailId, action.dataset.skillId), 0); }
  }

  function handleDialogSubmit(event) {
    if (event.target.id !== "continuous-result-form") return;
    event.preventDefault();
    const result = event.submitter?.value;
    recordResult(result, new FormData(event.target).get("note")?.trim() || "");
  }

  function handlePageSubmit(event) {
    if (event.target.id === "repertoire-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const trailId = event.target.dataset.trailId;
      state.trails[trailId].repertoire.push({ id: Storage.id(), title: data.get("title").trim(), status: data.get("status"), problem: data.get("problem").trim(), skillIds: [], updatedAt: new Date().toISOString() });
      persist(); host.renderCurrentView?.(); toast("Música adicionada ao repertório.");
    } else if (event.target.id === "chess-game-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const trailId = event.target.dataset.trailId;
      state.trails[trailId].games.push({ id: Storage.id(), category: data.get("category"), result: data.get("result").trim(), note: data.get("note").trim(), date: new Date().toISOString() });
      state.trails[trailId].games = state.trails[trailId].games.slice(-100);
      persist(); host.renderCurrentView?.(); toast("Partida registrada para análise.");
    }
  }

  function handlePageChange(event) {
    const action = event.target.dataset.continuousChange;
    if (action === "repertoire-status") {
      const item = state.trails[event.target.dataset.trailId].repertoire.find((candidate) => candidate.id === event.target.dataset.itemId);
      if (item) { item.status = event.target.value; item.updatedAt = new Date().toISOString(); persist(); toast("Situação do repertório atualizada."); }
    }
  }

  function deleteRepertoire(trailId, itemId) {
    state.trails[trailId].repertoire = state.trails[trailId].repertoire.filter((item) => item.id !== itemId);
    persist(); host.renderCurrentView?.(); toast("Música removida do repertório.");
  }

  function exportState() { return state; }
  function importState(candidate) { state = Storage.normalizeState(candidate); persist(); }
  function resetState() { state = Storage.createDefaultState(); persist(); }
  function persist() { Storage.saveState(state); }
  function findTrail(trailId) { return DATA.trails.find((trail) => trail.id === trailId) || null; }
  function findSkill(trail, skillId) { return trail?.skills.find((skill) => skill.id === skillId) || null; }
  function getSkillState(trailId, skillId) { return state.trails[trailId].skills[skillId]; }
  function parseMinutes(value) { return value === "free" ? "free" : Number(value); }
  function showDialog() { if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); }
  function closeDialog() { if (!dialog?.open) return; if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); }
  function toast(message) { if (host.showToast) host.showToast(message); }
  function formatDate(value) { return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

  window.TrajetoriaContinuous = { initialize, renderHomeSection, renderContinuousHome, renderTrailPage, handleAction, exportState, importState, resetState };
})();
