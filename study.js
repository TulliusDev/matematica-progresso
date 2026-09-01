(() => {
  "use strict";

  const ACTIVE_STORAGE_KEY = "trajetoria-study-timer-v1";
  const ACTIVE_VERSION = 1;
  const MIN_INCOMPLETE_SECONDS = 60;
  const BREAK_EXTENSION_MINUTES = 5;
  const DEFAULT_SETTINGS = Object.freeze({
    primaryTargetMinutes: 60,
    breakMinutes: 15,
    secondaryTargetMinutes: 30,
  });
  const VALID_PHASES = new Set(["primary", "break-ready", "break", "secondary-ready", "secondary"]);
  const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  let host = {};
  let activeFlow = null;
  let tickTimer = null;
  let initialized = false;
  let dialogMode = "timer";
  let resumeAfterCancel = false;
  let finishingBreak = false;
  let audioContext = null;

  function initialize(options = {}) {
    host = options;
    activeFlow = loadActiveFlow();
    bindDialogEvents();
    bindLifecycleEvents();
    initialized = true;
    reconcileActiveWithCanonical();
    syncTick();

    if (activeFlow) {
      window.setTimeout(() => {
        if (!activeFlow) return;
        if (activeFlow.phase === "break" && breakRemainingMilliseconds(activeFlow) <= 0) {
          completeBreak(false);
          return;
        }
        openStudyDialog();
        toast(activeFlow.current?.runningSince
          ? "Sua sessão em andamento foi restaurada."
          : "Sua rotina de estudo foi restaurada.");
      }, 0);
    }
  }

  function renderDailyRoutine(todaySchedule) {
    const study = getStudyState();
    const settings = getSettings(study);

    if (activeFlow?.extra) {
      return `<section class="daily-plan study-weekend-plan"><div><p class="eyebrow">Estudo acadêmico extra</p><h2>${escapeHTML(activeFlow.current?.subjectName || activeFlow.primary.subjectName)}</h2><p>Este tempo reduz a carga real, sem transformar o dia em obrigação futura.</p></div><button class="primary-button study-plan-action" type="button" data-study-action="open-active">Abrir cronômetro</button></section>`;
    }

    if (!activeFlow && (!todaySchedule?.primary || !todaySchedule?.secondary)) {
      if (todaySchedule?.type === "weekly-review") {
        return `
          <section class="daily-plan weekend-plan study-weekend-plan">
            <div><p class="eyebrow">Rotina flexível de fim de semana</p><h2>Revisão ou estudo extra</h2><p>O estudo extra reduz a carga real sem tornar o fim de semana obrigatório.</p></div>
            <div class="study-weekend-actions"><button class="secondary-button study-plan-action" type="button" data-study-action="open-review">Abrir revisão</button><label><span class="sr-only">Matéria do estudo extra</span><select id="study-extra-subject">${renderSubjectOptions()}</select></label><button class="primary-button study-plan-action" type="button" data-study-action="start-extra">Iniciar estudo extra</button></div>
          </section>
        `;
      }
      return `
        <section class="daily-plan study-weekend-plan">
          <div><p class="eyebrow">Plano de hoje</p><h2>Sem rotina acadêmica programada</h2><p>O histórico e a constância continuam disponíveis abaixo.</p></div>
        </section>
      `;
    }

    const context = buildRoutineContext(todaySchedule, settings, study);
    const totalTarget = context.primary.targetMinutes + context.secondary.targetMinutes;
    return `
      <section class="daily-plan study-daily-plan" aria-labelledby="study-plan-title">
        <div class="plan-heading study-plan-heading">
          <div><p class="eyebrow">${context.isToday ? "Plano de hoje" : `Rotina de ${escapeHTML(formatDayKey(context.dayKey))}`}</p><h2 id="study-plan-title">${totalTarget} minutos de estudo focado</h2></div>
          <span>Intervalo de ${context.breakTargetMinutes} min</span>
        </div>
        <div class="routine-grid study-routine-grid">
          ${renderRoutineSubjectCard(context.primary, "Matéria principal")}
          <div class="study-plan-break-cue" aria-label="Intervalo de ${context.breakTargetMinutes} minutos"><span aria-hidden="true">↓</span><strong>Intervalo</strong><small>${context.breakTargetMinutes} min</small><span aria-hidden="true">↓</span></div>
          ${renderRoutineSubjectCard(context.secondary, "Segunda matéria")}
        </div>
        ${renderTodayState(context, study)}
        ${renderRoutineAction(context, study)}
      </section>
    `;
  }

  function renderConsistencySection() {
    const study = getStudyState();
    const today = startOfLocalDay(new Date());
    const last14 = Array.from({ length: 14 }, (_, index) => addLocalDays(today, -index));
    const summaries = last14.map((date) => summarizeDay(localDayKey(date), study));
    const last7 = summaries.slice(0, 7);
    const sevenStudyDays = last7.filter((day) => day.status !== "empty").length;
    const sevenComplete = last7.filter((day) => day.status === "complete").length;
    const sevenPartial = last7.filter((day) => day.status === "partial").length;
    const fourteenStudyDays = summaries.filter((day) => day.status !== "empty").length;
    const streak = calculateCurrentStreak(summaries, study);
    const completeThisWeek = countCompleteWeekdays(study, today);

    return `
      <section class="dashboard-section study-consistency" aria-labelledby="study-consistency-title">
        <div class="section-heading study-consistency-heading">
          <div><p class="eyebrow">Constância acadêmica</p><h2 id="study-consistency-title">Seu ritmo recente</h2></div>
          <span class="study-streak"><strong>${streak}</strong> ${streak === 1 ? "dia" : "dias"} com algum estudo</span>
        </div>
        <ol class="study-week-strip" aria-label="Situação dos últimos sete dias">
          ${[...last7].reverse().map(renderConsistencyDay).join("")}
        </ol>
        <div class="study-consistency-metrics">
          <div><span>Esta semana</span><strong>${completeThisWeek} de 5</strong><small>${pluralize(completeThisWeek, "dia completo", "dias completos")}</small></div>
          <div><span>Últimos 7 dias</span><strong>${sevenStudyDays} ${pluralize(sevenStudyDays, "dia", "dias")} com estudo</strong><small>${sevenComplete} ${pluralize(sevenComplete, "completo", "completos")} · ${sevenPartial} ${pluralize(sevenPartial, "parcial", "parciais")}</small></div>
          <div><span>Últimos 14 dias</span><strong>${fourteenStudyDays} ${pluralize(fourteenStudyDays, "dia", "dias")} com estudo</strong></div>
        </div>
        ${renderStudyHistory(last7, study)}
      </section>
    `;
  }

  function handleAction(element) {
    const action = element?.dataset?.studyAction;
    if (!action || element.disabled) return false;

    if (action === "navigate-subject") {
      saveActiveFlow();
      host.navigate?.("subject", element.dataset.subjectId);
    } else if (action === "open-review") {
      host.navigate?.("review");
    } else if (action === "start-routine" || action === "resume-routine") {
      startRoutineFromAction(element);
    } else if (action === "start-extra") {
      startExtraSession();
    } else if (action === "open-active") {
      saveActiveFlow();
      openStudyDialog();
    } else if (action === "pause") {
      pauseCurrentSession();
    } else if (action === "continue") {
      continueCurrentSession();
    } else if (action === "finish-subject") {
      finishCurrentSession();
    } else if (action === "start-break") {
      startBreak();
    } else if (action === "extend-break") {
      extendBreak();
    } else if (action === "skip-break") {
      completeBreak(true);
    } else if (action === "start-secondary") {
      startSecondarySession();
    } else if (action === "request-cancel") {
      requestCancellation();
    } else if (action === "cancel-back") {
      leaveCancellation();
    } else if (action === "cancel-discard") {
      discardActiveRoutine();
    } else if (action === "cancel-save-incomplete") {
      saveIncompleteAndCancel();
    } else if (action === "close-dialog") {
      saveActiveFlow();
      closeStudyDialog();
    } else {
      return false;
    }
    return true;
  }

  function applyExternalState() {
    const changed = reconcileActiveWithCanonical();
    syncTick();
    if (changed) host.renderCurrentView?.();
    if (isStudyDialogOpen()) renderStudyDialog();
    updateLiveTimerDom();
  }

  function resetActiveSession() {
    activeFlow = null;
    dialogMode = "timer";
    resumeAfterCancel = false;
    stopTick();
    removeStoredActiveFlow();
    closeStudyDialog();
    if (initialized) host.renderCurrentView?.();
  }

  function buildRoutineContext(todaySchedule, settings, study) {
    if (activeFlow) {
      return {
        routineId: activeFlow.routineId,
        dayKey: activeFlow.dayKey,
        isToday: activeFlow.dayKey === localDayKey(new Date()),
        primary: activeFlow.primary,
        secondary: activeFlow.secondary,
        breakTargetMinutes: Math.max(1, Math.round((activeFlow.breakState?.plannedSeconds || settings.breakMinutes * 60) / 60)),
        active: activeFlow,
      };
    }

    const dayKey = localDayKey(new Date());
    const routineId = routineIdForDay(dayKey);
    const sessionOne = findRoutineSession(study, routineId, 1);
    const sessionTwo = findRoutineSession(study, routineId, 2);
    return {
      routineId,
      dayKey,
      isToday: true,
      primary: subjectDescriptor(sessionOne?.subjectId || todaySchedule.primary.subjectId, sessionOne?.targetMinutes || settings.primaryTargetMinutes, sessionOne?.subjectName),
      secondary: subjectDescriptor(sessionTwo?.subjectId || todaySchedule.secondary.subjectId, sessionTwo?.targetMinutes || settings.secondaryTargetMinutes, sessionTwo?.subjectName),
      breakTargetMinutes: settings.breakMinutes,
      active: null,
    };
  }

  function renderRoutineSubjectCard(descriptor, label) {
    const subject = findSubject(descriptor.subjectId);
    const focus = safeSubjectFocus(descriptor.subjectId);
    const topicName = focus?.topic?.name || "Trilha em dia";
    return `
      <article class="study-routine-card">
        <span class="study-subject-mark" aria-hidden="true">${escapeHTML(subject?.mark || descriptor.subjectName.charAt(0) || "•")}</span>
        <div class="study-routine-copy"><small>${escapeHTML(label)}</small><strong>${escapeHTML(descriptor.subjectName)}</strong><span>${escapeHTML(topicName)}</span></div>
        <div class="study-routine-side"><span>Meta · ${descriptor.targetMinutes} min</span><button class="study-subject-link" type="button" data-study-action="navigate-subject" data-subject-id="${escapeHTML(descriptor.subjectId)}">Abrir matéria</button></div>
      </article>
    `;
  }

  function renderTodayState(context, study) {
    const sessionOne = findRoutineSession(study, context.routineId, 1);
    const sessionTwo = findRoutineSession(study, context.routineId, 2);
    const breakRecord = findRoutineBreak(study, context.routineId);
    const totalSeconds = routineTotalWithActive(context.routineId, study);
    return `
      <section class="study-today-state" aria-labelledby="study-today-title">
        <header><div><p class="eyebrow">${context.isToday ? "Hoje" : escapeHTML(formatDayKey(context.dayKey))}</p><h3 id="study-today-title">Estado da rotina</h3></div><strong>${formatStudyDuration(totalSeconds)}</strong></header>
        <ol class="study-phase-list">
          ${renderSessionStateRow(1, context.primary, sessionOne, context.active)}
          ${renderBreakStateRow(context, breakRecord)}
          ${renderSessionStateRow(2, context.secondary, sessionTwo, context.active)}
        </ol>
      </section>
    `;
  }

  function renderSessionStateRow(slot, descriptor, record, active) {
    const current = active?.current?.slot === slot ? active.current : null;
    let status = "pending";
    let text = "Ainda não realizada";
    let liveAttribute = "";
    if (current) {
      status = current.runningSince ? "active" : "paused";
      text = `${current.runningSince ? "Em andamento" : "Pausada"} — ${formatStudyDuration(currentElapsedSeconds(current))}`;
      liveAttribute = ` data-study-live-elapsed="${slot}"`;
    } else if (record?.status === "completed") {
      status = "complete";
      text = `${descriptor.subjectName} — ${formatStudyDuration(record.effectiveSeconds)}`;
    } else if (record?.status === "incomplete") {
      status = "partial";
      text = `${descriptor.subjectName} — ${formatStudyDuration(record.effectiveSeconds)} · incompleta`;
    } else if (slot === 2 && active?.phase === "secondary-ready") {
      status = "ready";
      text = "Pronta para iniciar";
    }
    return `
      <li class="study-phase-row study-phase-${status}">
        <span class="study-phase-marker" aria-hidden="true">${status === "complete" ? "✓" : slot}</span>
        <span><strong>Sessão ${slot}</strong><small${liveAttribute}>${escapeHTML(text)}</small></span>
      </li>
    `;
  }

  function renderBreakStateRow(context, record) {
    const active = context.active;
    let status = "pending";
    let text = "Após a sessão 1";
    let liveAttribute = "";
    if (active?.phase === "break") {
      status = "active";
      text = `${formatCountdown(breakRemainingSeconds(active))} restantes`;
      liveAttribute = " data-study-live-break";
    } else if (record) {
      status = record.skipped ? "skipped" : "complete";
      text = record.skipped ? "Intervalo pulado" : formatStudyDuration(record.actualSeconds);
    } else if (active?.phase === "break-ready") {
      status = "ready";
      text = "Pronto para iniciar";
    } else if (findRoutineSession(getStudyState(), context.routineId, 1)?.status === "completed") {
      status = "ready";
      text = "Aguardando início";
    }
    return `
      <li class="study-phase-row study-phase-${status}">
        <span class="study-phase-marker" aria-hidden="true">${status === "complete" ? "✓" : status === "skipped" ? "○" : "Ⅱ"}</span>
        <span><strong>Intervalo</strong><small${liveAttribute}>${escapeHTML(text)}</small></span>
      </li>
    `;
  }

  function renderRoutineAction(context, study) {
    const sessionOne = findRoutineSession(study, context.routineId, 1);
    const sessionTwo = findRoutineSession(study, context.routineId, 2);
    const breakRecord = findRoutineBreak(study, context.routineId);
    if (context.active) {
      return `<div class="study-plan-actions"><button class="primary-button study-plan-action" type="button" data-study-action="open-active">Continuar rotina</button></div>`;
    }
    if (sessionOne?.status === "completed" && sessionTwo?.status === "completed") {
      return `<p class="study-routine-complete">✓ As duas sessões foram registradas neste dia.</p>`;
    }

    let label = "Iniciar primeira matéria";
    let action = "start-routine";
    if (sessionOne?.status === "incomplete") {
      label = "Continuar primeira matéria";
      action = "resume-routine";
    } else if (sessionOne?.status === "completed" && !breakRecord) {
      label = "Continuar para o intervalo";
      action = "resume-routine";
    } else if (sessionOne?.status === "completed" && sessionTwo?.status === "incomplete") {
      label = "Continuar segunda matéria";
      action = "resume-routine";
    } else if (sessionOne?.status === "completed" && breakRecord) {
      label = "Continuar para a segunda matéria";
      action = "resume-routine";
    }
    return `
      <div class="study-plan-actions">
        <button class="primary-button study-plan-action" type="button" data-study-action="${action}" data-primary-subject-id="${escapeHTML(context.primary.subjectId)}" data-secondary-subject-id="${escapeHTML(context.secondary.subjectId)}">${escapeHTML(label)}</button>
      </div>
    `;
  }

  function renderConsistencyDay(summary) {
    const statusLabel = summary.status === "complete" ? "dia completo" : summary.status === "partial" ? "dia parcial" : "sem estudo";
    const visibleSlots = summary.status === "partial" ? Math.max(1, summary.completedSlots) : summary.completedSlots;
    return `
      <li class="study-day study-day-${summary.status}" aria-label="${escapeHTML(`${WEEKDAY_LABELS[summary.date.getDay()]} ${formatDayKey(summary.dayKey)}: ${statusLabel}`)}">
        <span>${WEEKDAY_LABELS[summary.date.getDay()]}</span><strong>${String(summary.date.getDate()).padStart(2, "0")}</strong><span class="study-day-sessions" aria-hidden="true"><i class="${visibleSlots >= 1 ? "filled" : ""}"></i><i class="${visibleSlots >= 2 ? "filled" : ""}"></i></span><small>${summary.status === "complete" ? "Completo" : summary.status === "partial" ? "Parcial" : "Sem estudo"}</small>
      </li>
    `;
  }

  function renderStudyHistory(last7, study) {
    return `
      <details class="study-history">
        <summary><span>Histórico de tempo</span><small>Últimos 7 dias</small></summary>
        <div class="study-history-days">
          ${last7.map((summary, index) => renderHistoryDay(summary, study, index === 0)).join("")}
        </div>
      </details>
    `;
  }

  function renderHistoryDay(summary, study, isToday) {
    const sessions = study.sessions
      .filter((session) => session.dayKey === summary.dayKey)
      .sort((first, second) => first.slot - second.slot || dateTime(first.startedAt) - dateTime(second.startedAt));
    const breaks = study.breaks.filter((entry) => entry.dayKey === summary.dayKey);
    const studyItems = sessions.map((session) => `<li><span><strong>${escapeHTML(session.subjectName || subjectName(session.subjectId))}</strong><small>${session.topicName ? `${escapeHTML(session.topicName)} · ` : ""}Sessão ${session.slot}${session.status === "incomplete" ? " · incompleta" : ""}</small></span><b>${formatStudyDuration(session.effectiveSeconds)}</b></li>`).join("");
    const breakItems = breaks.map((entry) => `<li><span><strong>Intervalo</strong><small>${entry.skipped ? "Pulado" : "Concluído"}</small></span><b>${entry.skipped ? "—" : formatStudyDuration(entry.actualSeconds)}</b></li>`).join("");
    return `
      <article class="study-history-day">
        <header><strong>${escapeHTML(formatStudyDate(summary.dayKey, isToday))}</strong><span>${sessions.length} ${pluralize(sessions.length, "sessão registrada", "sessões registradas")}</span></header>
        <div class="study-history-study-total"><span>Tempo estudado</span><strong>${formatStudyDuration(summary.totalSeconds)}</strong></div>
        ${sessions.length ? `<ul class="study-history-sessions">${studyItems}</ul>` : '<p class="study-history-empty">Nenhuma sessão registrada.</p>'}
        ${breaks.length ? `<div class="study-history-interval"><span>Intervalo</span><ul>${breakItems}</ul></div>` : ""}
      </article>
    `;
  }

  function startRoutineFromAction(element) {
    if (activeFlow) {
      openStudyDialog();
      return;
    }
    const primaryId = element.dataset.primarySubjectId;
    const secondaryId = element.dataset.secondarySubjectId;
    if (!primaryId || !secondaryId) {
      toast("Não há duas matérias programadas para iniciar esta rotina.");
      return;
    }

    const study = getStudyState();
    const settings = getSettings(study);
    const dayKey = localDayKey(new Date());
    const routineId = routineIdForDay(dayKey);
    const sessionOne = findRoutineSession(study, routineId, 1);
    const sessionTwo = findRoutineSession(study, routineId, 2);
    const breakRecord = findRoutineBreak(study, routineId);
    if (sessionOne?.status === "completed" && sessionTwo?.status === "completed") {
      toast("A rotina de hoje já está completa.");
      return;
    }

    activeFlow = {
      version: ACTIVE_VERSION,
      routineId,
      dayKey,
      phase: "primary",
      primary: subjectDescriptor(sessionOne?.subjectId || primaryId, sessionOne?.targetMinutes || settings.primaryTargetMinutes, sessionOne?.subjectName),
      secondary: subjectDescriptor(sessionTwo?.subjectId || secondaryId, sessionTwo?.targetMinutes || settings.secondaryTargetMinutes, sessionTwo?.subjectName),
      current: null,
      breakState: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (sessionOne?.status !== "completed") {
      activeFlow.phase = "primary";
      activeFlow.current = createCurrentSession(1, activeFlow.primary, sessionOne);
    } else if (!breakRecord) {
      activeFlow.phase = "break-ready";
    } else if (sessionTwo?.status === "incomplete") {
      activeFlow.phase = "secondary";
      activeFlow.current = createCurrentSession(2, activeFlow.secondary, sessionTwo);
    } else {
      activeFlow.phase = "secondary-ready";
    }

    saveActiveFlow();
    dialogMode = "timer";
    syncTick();
    renderAfterAction();
    openStudyDialog();
  }

  function startExtraSession() {
    if (activeFlow) return openStudyDialog();
    const subjectId = document.getElementById("study-extra-subject")?.value || window.TRAJETORIA_DATA?.subjects?.[0]?.id;
    if (!subjectId) return toast("Escolha uma matéria para o estudo extra.");
    const settings = getSettings(getStudyState());
    const descriptor = subjectDescriptor(subjectId, settings.primaryTargetMinutes);
    const now = new Date();
    activeFlow = {
      version: ACTIVE_VERSION,
      extra: true,
      routineId: `study-extra-${localDayKey(now)}-${now.getTime().toString(36)}`,
      dayKey: localDayKey(now),
      phase: "primary",
      primary: descriptor,
      secondary: descriptor,
      current: null,
      breakState: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    activeFlow.current = createCurrentSession(1, descriptor);
    saveActiveFlow(); dialogMode = "timer"; syncTick(); host.renderCurrentView?.(); openStudyDialog();
  }

  function createCurrentSession(slot, descriptor, previousRecord = null) {
    const now = new Date().toISOString();
    return {
      slot,
      subjectId: descriptor.subjectId,
      subjectName: descriptor.subjectName,
      topicId: previousRecord?.topicId || descriptor.topicId || "",
      topicName: previousRecord?.topicName || descriptor.topicName || "",
      targetMinutes: descriptor.targetMinutes,
      startedAt: previousRecord?.startedAt || now,
      accumulatedMs: Math.max(0, Number(previousRecord?.effectiveSeconds || 0) * 1000),
      runningSince: now,
    };
  }

  function pauseCurrentSession() {
    const current = activeFlow?.current;
    if (!current?.runningSince) return;
    current.accumulatedMs = currentElapsedMilliseconds(current);
    current.runningSince = null;
    saveActiveFlow();
    syncTick();
    renderAfterAction();
    toast("Sessão pausada. Esse intervalo não contará como estudo.");
  }

  function continueCurrentSession() {
    const current = activeFlow?.current;
    if (!current || current.runningSince) return;
    current.runningSince = new Date().toISOString();
    saveActiveFlow();
    syncTick();
    renderAfterAction();
  }

  function finishCurrentSession() {
    const current = activeFlow?.current;
    if (!current || !["primary", "secondary"].includes(activeFlow.phase)) return;
    const now = new Date().toISOString();
    const effectiveSeconds = currentElapsedSeconds(current);
    const study = getStudyState();
    const id = sessionId(activeFlow.routineId, current.slot);
    const existing = study.sessions.find((session) => session.id === id);
    const record = {
      id,
      routineId: activeFlow.routineId,
      dayKey: activeFlow.dayKey,
      slot: current.slot,
      subjectId: current.subjectId,
      subjectName: current.subjectName,
      topicId: current.topicId,
      topicName: current.topicName,
      startedAt: current.startedAt,
      endedAt: now,
      effectiveSeconds,
      targetMinutes: current.targetMinutes,
      targetMet: effectiveSeconds >= current.targetMinutes * 60,
      status: "completed",
      createdAt: existing?.createdAt || current.startedAt || now,
      updatedAt: now,
    };
    upsertById(study.sessions, record);
    if (existing?.status !== "completed") {
      addActivity("study-session", `Sessão ${current.slot} de ${current.subjectName}: ${formatStudyDuration(effectiveSeconds)}`);
    }
    if (!persistMainState()) return;

    if (activeFlow.extra) {
      clearActiveFlow();
      closeStudyDialog();
      host.renderCurrentView?.();
      toast("Estudo extra salvo. A carga restante foi recalculada.");
      return;
    }

    if (current.slot === 1) {
      activeFlow.current = null;
      activeFlow.phase = "break-ready";
      saveActiveFlow();
      syncTick();
      dialogMode = "timer";
      renderAfterAction();
      toast("Primeira matéria salva. O intervalo está pronto para começar.");
    } else {
      clearActiveFlow();
      closeStudyDialog();
      host.renderCurrentView?.();
      toast("Segunda matéria salva. Dia de estudo completo.");
    }
  }

  function startBreak() {
    if (!activeFlow || activeFlow.phase !== "break-ready") return;
    const now = Date.now();
    const plannedSeconds = getSettings(getStudyState()).breakMinutes * 60;
    activeFlow.phase = "break";
    activeFlow.breakState = {
      id: breakId(activeFlow.routineId),
      plannedSeconds,
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + plannedSeconds * 1000).toISOString(),
      extensionsMinutes: 0,
    };
    primeBreakAlert();
    saveActiveFlow();
    syncTick();
    renderAfterAction();
  }

  function extendBreak() {
    if (!activeFlow || activeFlow.phase !== "break" || !activeFlow.breakState) return;
    const extensionSeconds = BREAK_EXTENSION_MINUTES * 60;
    const currentEnd = dateTime(activeFlow.breakState.endsAt) || Date.now();
    activeFlow.breakState.endsAt = new Date(currentEnd + extensionSeconds * 1000).toISOString();
    activeFlow.breakState.plannedSeconds += extensionSeconds;
    activeFlow.breakState.extensionsMinutes += BREAK_EXTENSION_MINUTES;
    saveActiveFlow();
    updateLiveTimerDom();
    renderAfterAction();
    toast(`${BREAK_EXTENSION_MINUTES} minutos adicionados ao intervalo.`);
  }

  function completeBreak(skipped) {
    if (!activeFlow || !["break-ready", "break"].includes(activeFlow.phase) || finishingBreak) return;
    finishingBreak = true;
    try {
      const nowMs = Date.now();
      const settings = getSettings(getStudyState());
      const source = activeFlow.breakState || {
        id: breakId(activeFlow.routineId),
        plannedSeconds: settings.breakMinutes * 60,
        startedAt: new Date(nowMs).toISOString(),
        endsAt: new Date(nowMs).toISOString(),
        extensionsMinutes: 0,
      };
      const startedMs = dateTime(source.startedAt) || nowMs;
      const plannedEndMs = dateTime(source.endsAt) || (startedMs + source.plannedSeconds * 1000);
      const endedMs = skipped ? nowMs : plannedEndMs;
      const actualSeconds = skipped
        ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
        : Math.max(0, Math.round(source.plannedSeconds));
      const nowIso = new Date(nowMs).toISOString();
      const study = getStudyState();
      const existing = study.breaks.find((entry) => entry.id === source.id);
      const record = {
        id: source.id,
        routineId: activeFlow.routineId,
        dayKey: activeFlow.dayKey,
        plannedSeconds: Math.max(0, Math.round(source.plannedSeconds)),
        actualSeconds,
        startedAt: new Date(startedMs).toISOString(),
        endedAt: new Date(endedMs).toISOString(),
        skipped: Boolean(skipped),
        extensionsMinutes: Math.max(0, Math.round(source.extensionsMinutes || 0)),
        createdAt: existing?.createdAt || source.startedAt || nowIso,
        updatedAt: nowIso,
      };
      upsertById(study.breaks, record);
      if (!persistMainState()) return;

      activeFlow.breakState = null;
      activeFlow.phase = "secondary-ready";
      saveActiveFlow();
      syncTick();
      dialogMode = "timer";
      renderAfterAction();
      if (!skipped) playBreakAlert();
      toast(skipped ? "Intervalo pulado. A segunda matéria está pronta." : "Intervalo concluído. Inicie a segunda matéria quando estiver pronto.");
    } finally {
      finishingBreak = false;
    }
  }

  function startSecondarySession() {
    if (!activeFlow || activeFlow.phase !== "secondary-ready") return;
    const existing = findRoutineSession(getStudyState(), activeFlow.routineId, 2);
    activeFlow.phase = "secondary";
    activeFlow.current = createCurrentSession(2, activeFlow.secondary, existing?.status === "incomplete" ? existing : null);
    saveActiveFlow();
    syncTick();
    renderAfterAction();
  }

  function requestCancellation() {
    if (!activeFlow) return;
    resumeAfterCancel = Boolean(activeFlow.current?.runningSince);
    if (resumeAfterCancel) {
      activeFlow.current.accumulatedMs = currentElapsedMilliseconds(activeFlow.current);
      activeFlow.current.runningSince = null;
    }
    dialogMode = "cancel";
    saveActiveFlow();
    syncTick();
    renderStudyDialog();
  }

  function leaveCancellation() {
    if (!activeFlow) return;
    dialogMode = "timer";
    if (resumeAfterCancel && activeFlow.current && !activeFlow.current.runningSince) {
      activeFlow.current.runningSince = new Date().toISOString();
    }
    resumeAfterCancel = false;
    saveActiveFlow();
    syncTick();
    renderStudyDialog();
    host.renderCurrentView?.();
  }

  function discardActiveRoutine() {
    if (!activeFlow) return;
    if (!persistMainState()) return;
    clearActiveFlow();
    closeStudyDialog();
    host.renderCurrentView?.();
    toast("Sessão em andamento descartada. Registros já concluídos foram mantidos.");
  }

  function saveIncompleteAndCancel() {
    const current = activeFlow?.current;
    if (!current) return;
    const effectiveSeconds = currentElapsedSeconds(current);
    if (effectiveSeconds < MIN_INCOMPLETE_SECONDS) return;
    const now = new Date().toISOString();
    const study = getStudyState();
    const id = sessionId(activeFlow.routineId, current.slot);
    const existing = study.sessions.find((session) => session.id === id);
    const record = {
      id,
      routineId: activeFlow.routineId,
      dayKey: activeFlow.dayKey,
      slot: current.slot,
      subjectId: current.subjectId,
      subjectName: current.subjectName,
      topicId: current.topicId,
      topicName: current.topicName,
      startedAt: current.startedAt,
      endedAt: now,
      effectiveSeconds,
      targetMinutes: current.targetMinutes,
      targetMet: effectiveSeconds >= current.targetMinutes * 60,
      status: "incomplete",
      createdAt: existing?.createdAt || current.startedAt || now,
      updatedAt: now,
    };
    upsertById(study.sessions, record);
    addActivity("study-session-incomplete", `Sessão incompleta de ${current.subjectName}: ${formatStudyDuration(effectiveSeconds)}`);
    if (!persistMainState()) return;
    clearActiveFlow();
    closeStudyDialog();
    host.renderCurrentView?.();
    toast("Tempo estudado salvo como sessão incompleta.");
  }

  function renderStudyDialog() {
    const dialog = document.getElementById("study-session-dialog");
    const eyebrow = document.getElementById("study-session-dialog-eyebrow");
    const title = document.getElementById("study-session-dialog-title");
    const body = document.getElementById("study-session-dialog-body");
    if (!dialog || !eyebrow || !title || !body || !activeFlow) return;

    if (dialogMode === "cancel") {
      renderCancellationDialog(eyebrow, title, body);
      return;
    }

    if (activeFlow.phase === "primary" || activeFlow.phase === "secondary") {
      const current = activeFlow.current;
      const elapsed = currentElapsedSeconds(current);
      eyebrow.textContent = `Sessão ${current.slot} · Meta de ${current.targetMinutes} min`;
      title.textContent = current.subjectName;
      body.innerHTML = `
        <section class="study-dialog-timer">
          ${renderTopicSelector(current)}
          <p class="study-timer-status">${current.runningSince ? "Tempo efetivo de estudo" : "Sessão pausada"}</p>
          <output id="study-session-timer" class="study-timer-value" role="timer" aria-live="off" aria-label="Tempo efetivamente estudado">${formatClock(elapsed)}</output>
          <p id="study-session-target-note" class="study-target-note">${renderTargetText(elapsed, current.targetMinutes)}</p>
          <div class="study-dialog-actions">
            <button class="secondary-button study-dialog-action" type="button" data-study-action="${current.runningSince ? "pause" : "continue"}">${current.runningSince ? "Pausar" : "Continuar"}</button>
            <button class="primary-button study-dialog-action" type="button" data-study-action="finish-subject">Finalizar matéria</button>
          </div>
          <button class="text-button study-cancel-link" type="button" data-study-action="request-cancel">Cancelar sessão</button>
        </section>
      `;
    } else if (activeFlow.phase === "break-ready") {
      const minutes = getSettings(getStudyState()).breakMinutes;
      eyebrow.textContent = "Sessão 1 salva";
      title.textContent = "Intervalo";
      body.innerHTML = `
        <section class="study-dialog-transition">
          <p>A primeira matéria já foi registrada. O temporizador regressivo só começa quando você confirmar.</p>
          <div class="study-dialog-actions">
            <button class="primary-button study-dialog-action" type="button" data-study-action="start-break">Iniciar intervalo de ${minutes} min</button>
            <button class="secondary-button study-dialog-action" type="button" data-study-action="skip-break">Pular intervalo</button>
          </div>
          <button class="text-button study-cancel-link" type="button" data-study-action="request-cancel">Encerrar rotina por hoje</button>
        </section>
      `;
    } else if (activeFlow.phase === "break") {
      eyebrow.textContent = "Pausa entre matérias";
      title.textContent = "Intervalo";
      body.innerHTML = `
        <section class="study-dialog-timer study-dialog-break">
          <p class="study-timer-status">Tempo restante</p>
          <output id="study-break-timer" class="study-timer-value" role="timer" aria-live="off" aria-label="Tempo restante do intervalo">${formatCountdown(breakRemainingSeconds(activeFlow))}</output>
          <p class="study-target-note">A segunda matéria não começará automaticamente.</p>
          <div class="study-dialog-actions">
            <button class="secondary-button study-dialog-action" type="button" data-study-action="skip-break">Pular intervalo</button>
            <button class="secondary-button study-dialog-action" type="button" data-study-action="extend-break">+${BREAK_EXTENSION_MINUTES} min</button>
          </div>
          <button class="text-button study-cancel-link" type="button" data-study-action="request-cancel">Encerrar rotina por hoje</button>
        </section>
      `;
    } else if (activeFlow.phase === "secondary-ready") {
      eyebrow.textContent = "Intervalo concluído";
      title.textContent = "Hora da segunda matéria";
      body.innerHTML = `
        <section class="study-dialog-transition">
          <div class="study-next-subject"><span aria-hidden="true">${escapeHTML(findSubject(activeFlow.secondary.subjectId)?.mark || "2")}</span><div><small>Segunda matéria</small><strong>${escapeHTML(activeFlow.secondary.subjectName)}</strong><p>Meta aproximada de ${activeFlow.secondary.targetMinutes} min.</p></div></div>
          <button class="primary-button study-dialog-action" type="button" data-study-action="start-secondary">Iniciar segunda matéria</button>
          <button class="text-button study-cancel-link" type="button" data-study-action="request-cancel">Encerrar rotina por hoje</button>
        </section>
      `;
    }
    updateLiveTimerDom();
  }

  function renderCancellationDialog(eyebrow, title, body) {
    const current = activeFlow.current;
    const elapsed = current ? currentElapsedSeconds(current) : 0;
    const canSave = Boolean(current && elapsed >= MIN_INCOMPLETE_SECONDS);
    eyebrow.textContent = "Confirmação necessária";
    title.textContent = current ? "Cancelar esta sessão?" : "Encerrar a rotina?";
    body.innerHTML = `
      <section class="study-cancel-confirmation">
        <p>${current
          ? `Você estudou ${escapeHTML(formatStudyDuration(elapsed))} nesta sessão. O descarte não remove sessões anteriores já concluídas.`
          : "Sessões e intervalos já concluídos continuarão salvos no histórico."}</p>
        <div class="study-cancel-actions">
          <button class="secondary-button study-dialog-action" type="button" data-study-action="cancel-back">Voltar</button>
          ${canSave ? '<button class="secondary-button study-dialog-action" type="button" data-study-action="cancel-save-incomplete">Salvar como incompleta</button>' : ""}
      <button class="danger-button study-dialog-action" type="button" data-study-action="cancel-discard">${current ? "Descartar sessão atual" : "Encerrar rotina"}</button>
        </div>
        ${current && !canSave ? `<small>A opção de salvar como incompleta aparece após ${MIN_INCOMPLETE_SECONDS} segundos de estudo efetivo.</small>` : ""}
      </section>
    `;
  }

  function openStudyDialog() {
    if (!activeFlow) return;
    dialogMode = dialogMode === "cancel" ? "cancel" : "timer";
    renderStudyDialog();
    const dialog = document.getElementById("study-session-dialog");
    if (!dialog || dialog.open) return;
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch {
      toast("A sessão continua ativa. Feche a outra janela para abrir o cronômetro.");
    }
  }

  function closeStudyDialog() {
    const dialog = document.getElementById("study-session-dialog");
    if (!dialog?.open) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function isStudyDialogOpen() {
    return Boolean(document.getElementById("study-session-dialog")?.open);
  }

  function bindDialogEvents() {
    const dialog = document.getElementById("study-session-dialog");
    const body = document.getElementById("study-session-dialog-body");
    const close = document.getElementById("close-study-session-dialog");
    close?.addEventListener("click", () => {
      saveActiveFlow();
      closeStudyDialog();
    });
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) {
        saveActiveFlow();
        closeStudyDialog();
      }
    });
    dialog?.addEventListener("cancel", () => saveActiveFlow());
    body?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-study-action]");
      if (!action) return;
      event.preventDefault();
      handleAction(action);
    });
    body?.addEventListener("change", (event) => {
      if (event.target.id !== "study-session-topic" || !activeFlow?.current) return;
      const selected = event.target.selectedOptions[0];
      activeFlow.current.topicId = event.target.value;
      activeFlow.current.topicName = selected?.dataset.topicName || "";
      saveActiveFlow();
      toast(activeFlow.current.topicId ? `Tempo vinculado a ${activeFlow.current.topicName}.` : "Sessão sem tópico específico.");
    });
  }

  function bindLifecycleEvents() {
    if (initialized) return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        saveActiveFlow();
      } else {
        checkBreakExpiration();
        updateLiveTimerDom();
      }
    });
    window.addEventListener("pagehide", () => saveActiveFlow());
    window.addEventListener("pageshow", () => {
      checkBreakExpiration();
      updateLiveTimerDom();
    });
  }

  function syncTick() {
    stopTick();
    if (!activeFlow) return;
    if (["primary", "secondary", "break"].includes(activeFlow.phase)) {
      tickTimer = window.setInterval(tick, 500);
      tick();
    }
  }

  function stopTick() {
    if (tickTimer !== null) window.clearInterval(tickTimer);
    tickTimer = null;
  }

  function tick() {
    if (!activeFlow) return stopTick();
    if (activeFlow.phase === "break" && breakRemainingMilliseconds(activeFlow) <= 0) {
      completeBreak(false);
      return;
    }
    updateLiveTimerDom();
  }

  function checkBreakExpiration() {
    if (activeFlow?.phase === "break" && breakRemainingMilliseconds(activeFlow) <= 0) completeBreak(false);
  }

  function updateLiveTimerDom() {
    if (!activeFlow) return;
    if (activeFlow.current) {
      const seconds = currentElapsedSeconds(activeFlow.current);
      const clock = formatClock(seconds);
      const duration = formatStudyDuration(seconds);
      const targetText = renderTargetText(seconds, activeFlow.current.targetMinutes);
      const timer = document.getElementById("study-session-timer");
      const target = document.getElementById("study-session-target-note");
      if (timer) timer.textContent = clock;
      if (target) target.textContent = targetText;
      document.querySelectorAll(`[data-study-live-elapsed="${activeFlow.current.slot}"]`).forEach((element) => {
        element.textContent = `${activeFlow.current.runningSince ? "Em andamento" : "Pausada"} — ${duration}`;
      });
    }
    if (activeFlow.phase === "break") {
      const remaining = breakRemainingSeconds(activeFlow);
      const display = formatCountdown(remaining);
      const timer = document.getElementById("study-break-timer");
      if (timer) timer.textContent = display;
      document.querySelectorAll("[data-study-live-break]").forEach((element) => {
        element.textContent = `${display} restantes`;
      });
    }
  }

  function currentElapsedMilliseconds(current) {
    if (!current) return 0;
    const accumulated = Math.max(0, Number(current.accumulatedMs) || 0);
    if (!current.runningSince) return accumulated;
    const since = dateTime(current.runningSince);
    return accumulated + Math.max(0, Date.now() - since);
  }

  function currentElapsedSeconds(current) {
    return Math.max(0, Math.floor(currentElapsedMilliseconds(current) / 1000));
  }

  function breakRemainingMilliseconds(flow) {
    return Math.max(0, dateTime(flow?.breakState?.endsAt) - Date.now());
  }

  function breakRemainingSeconds(flow) {
    return Math.max(0, Math.ceil(breakRemainingMilliseconds(flow) / 1000));
  }

  function renderTargetText(seconds, targetMinutes) {
    const targetSeconds = Math.max(1, targetMinutes * 60);
    if (seconds < targetSeconds) return `Meta: ${targetMinutes} min`;
    const extra = seconds - targetSeconds;
    return extra > 0 ? `Meta concluída +${formatExtra(extra)}` : "Meta concluída";
  }

  function formatClock(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remainder = safe % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function formatCountdown(seconds) {
    const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
    if (safe >= 3600) return formatClock(safe);
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function formatExtra(seconds) {
    return seconds >= 3600 ? formatClock(seconds) : formatCountdown(seconds);
  }

  function formatStudyDuration(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    if (safe === 0) return "0 min";
    if (safe < 60) return `${safe} s`;
    if (safe < 3600) return `${Math.floor(safe / 60)} min`;
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    return minutes ? `${hours}h ${String(minutes).padStart(2, "0")}min` : `${hours}h`;
  }

  function summarizeDay(dayKey, study) {
    const sessions = study.sessions.filter((session) => session.dayKey === dayKey);
    const completedSlots = new Set(sessions.filter((session) => session.status === "completed").map((session) => Number(session.slot)));
    const hasAnySession = sessions.length > 0;
    return {
      dayKey,
      date: dateFromDayKey(dayKey),
      status: completedSlots.has(1) && completedSlots.has(2) ? "complete" : hasAnySession ? "partial" : "empty",
      completedSlots: completedSlots.size,
      totalSeconds: sessions.reduce((total, session) => total + Math.max(0, Number(session.effectiveSeconds) || 0), 0),
    };
  }

  function calculateCurrentStreak(initialSummaries, study) {
    const summaries = [...initialSummaries];
    let cursor = startOfLocalDay(new Date());
    let first = summarizeDay(localDayKey(cursor), study);
    if (first.status === "empty") {
      cursor = addLocalDays(cursor, -1);
      first = summarizeDay(localDayKey(cursor), study);
    }
    let streak = 0;
    let summary = first;
    while (summary.status !== "empty" && streak < 3660) {
      streak += 1;
      cursor = addLocalDays(cursor, -1);
      summary = summaries.find((entry) => entry.dayKey === localDayKey(cursor)) || summarizeDay(localDayKey(cursor), study);
    }
    return streak;
  }

  function countCompleteWeekdays(study, today) {
    const monday = new Date(today);
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    let complete = 0;
    for (let index = 0; index < 5; index += 1) {
      if (summarizeDay(localDayKey(addLocalDays(monday, index)), study).status === "complete") complete += 1;
    }
    return complete;
  }

  function routineTotalWithActive(routineId, study) {
    let total = study.sessions
      .filter((session) => session.routineId === routineId)
      .reduce((sum, session) => sum + Math.max(0, Number(session.effectiveSeconds) || 0), 0);
    if (activeFlow?.routineId === routineId && activeFlow.current) {
      const id = sessionId(routineId, activeFlow.current.slot);
      const stored = study.sessions.find((session) => session.id === id);
      total -= Math.max(0, Number(stored?.effectiveSeconds) || 0);
      total += currentElapsedSeconds(activeFlow.current);
    }
    return Math.max(0, total);
  }

  function reconcileActiveWithCanonical() {
    if (!activeFlow) return false;
    const study = getStudyState();
    const sessionOne = findRoutineSession(study, activeFlow.routineId, 1);
    const sessionTwo = findRoutineSession(study, activeFlow.routineId, 2);
    const breakRecord = findRoutineBreak(study, activeFlow.routineId);
    let changed = false;

    if (sessionTwo?.status === "completed") {
      clearActiveFlow();
      closeStudyDialog();
      return true;
    }
    if (activeFlow.phase === "primary" && sessionOne?.status === "completed") {
      activeFlow.current = null;
      activeFlow.phase = breakRecord ? "secondary-ready" : "break-ready";
      changed = true;
    } else if (["break-ready", "break"].includes(activeFlow.phase) && breakRecord) {
      activeFlow.breakState = null;
      activeFlow.phase = "secondary-ready";
      changed = true;
    } else if (activeFlow.phase === "secondary" && sessionTwo?.status === "completed") {
      clearActiveFlow();
      closeStudyDialog();
      return true;
    }

    if (activeFlow?.current) {
      const external = activeFlow.current.slot === 1 ? sessionOne : sessionTwo;
      if (external?.status === "incomplete" && external.effectiveSeconds * 1000 > currentElapsedMilliseconds(activeFlow.current)) {
        const wasRunning = Boolean(activeFlow.current.runningSince);
        activeFlow.current.accumulatedMs = external.effectiveSeconds * 1000;
        activeFlow.current.runningSince = wasRunning ? new Date().toISOString() : null;
        changed = true;
      }
    }
    if (changed) saveActiveFlow();
    return changed;
  }

  function getStudyState() {
    const state = host.getState?.();
    if (!state) return { version: 1, settings: { ...DEFAULT_SETTINGS, updatedAt: null }, sessions: [], breaks: [] };
    if (!state.study || typeof state.study !== "object") {
      state.study = { version: 1, settings: { ...DEFAULT_SETTINGS, updatedAt: null }, sessions: [], breaks: [] };
    }
    if (!state.study.settings || typeof state.study.settings !== "object") state.study.settings = { ...DEFAULT_SETTINGS, updatedAt: null };
    if (!Array.isArray(state.study.sessions)) state.study.sessions = [];
    if (!Array.isArray(state.study.breaks)) state.study.breaks = [];
    return state.study;
  }

  function getSettings(study) {
    return {
      primaryTargetMinutes: clampInteger(study.settings?.primaryTargetMinutes, 1, 360, DEFAULT_SETTINGS.primaryTargetMinutes),
      breakMinutes: clampInteger(study.settings?.breakMinutes, 1, 120, DEFAULT_SETTINGS.breakMinutes),
      secondaryTargetMinutes: clampInteger(study.settings?.secondaryTargetMinutes, 1, 360, DEFAULT_SETTINGS.secondaryTargetMinutes),
    };
  }

  function findRoutineSession(study, routineId, slot) {
    return study.sessions.find((session) => session.routineId === routineId && Number(session.slot) === slot) || null;
  }

  function findRoutineBreak(study, routineId) {
    return study.breaks.find((entry) => entry.routineId === routineId) || null;
  }

  function upsertById(collection, record) {
    const index = collection.findIndex((item) => item.id === record.id);
    if (index >= 0) collection[index] = record;
    else collection.push(record);
    if (collection.length > 3000) collection.splice(0, collection.length - 3000);
  }

  function persistMainState() {
    try {
      host.persist?.();
      return true;
    } catch (error) {
      console.warn("Não foi possível salvar a rotina de estudo.", error);
      toast("Não foi possível salvar esta alteração.");
      return false;
    }
  }

  function addActivity(type, description) {
    try {
      host.addActivity?.(type, null, description);
    } catch (error) {
      console.warn("Não foi possível adicionar a atividade da sessão.", error);
    }
  }

  function saveActiveFlow() {
    if (!activeFlow) return;
    activeFlow.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(activeFlow));
    } catch (error) {
      console.warn("Não foi possível salvar o cronômetro ativo.", error);
      toast("O cronômetro continua aberto, mas não pôde ser salvo neste navegador.");
    }
  }

  function loadActiveFlow() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ACTIVE_STORAGE_KEY));
      return normalizeActiveFlow(parsed);
    } catch (error) {
      console.warn("Não foi possível restaurar o cronômetro ativo.", error);
      removeStoredActiveFlow();
      return null;
    }
  }

  function normalizeActiveFlow(candidate) {
    if (!candidate || candidate.version !== ACTIVE_VERSION || !VALID_PHASES.has(candidate.phase)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(candidate.dayKey || "")) || !candidate.routineId) return null;
    const primary = normalizeDescriptor(candidate.primary, DEFAULT_SETTINGS.primaryTargetMinutes);
    const secondary = normalizeDescriptor(candidate.secondary, DEFAULT_SETTINGS.secondaryTargetMinutes);
    if (!primary || !secondary) return null;
    const normalized = {
      version: ACTIVE_VERSION,
      extra: candidate.extra === true,
      routineId: String(candidate.routineId).slice(0, 160),
      dayKey: candidate.dayKey,
      phase: candidate.phase,
      primary,
      secondary,
      current: null,
      breakState: null,
      createdAt: validIso(candidate.createdAt) || new Date().toISOString(),
      updatedAt: validIso(candidate.updatedAt) || new Date().toISOString(),
    };
    if (["primary", "secondary"].includes(normalized.phase)) {
      const expectedSlot = normalized.phase === "primary" ? 1 : 2;
      const current = candidate.current;
      if (!current || Number(current.slot) !== expectedSlot) return null;
      normalized.current = {
        slot: expectedSlot,
        subjectId: String(current.subjectId || (expectedSlot === 1 ? primary.subjectId : secondary.subjectId)).slice(0, 100),
        subjectName: String(current.subjectName || (expectedSlot === 1 ? primary.subjectName : secondary.subjectName)).slice(0, 140),
        topicId: String(current.topicId || (expectedSlot === 1 ? primary.topicId : secondary.topicId) || "").slice(0, 160),
        topicName: String(current.topicName || (expectedSlot === 1 ? primary.topicName : secondary.topicName) || "").slice(0, 180),
        targetMinutes: clampInteger(current.targetMinutes, 1, 360, expectedSlot === 1 ? primary.targetMinutes : secondary.targetMinutes),
        startedAt: validIso(current.startedAt) || normalized.createdAt,
        accumulatedMs: Math.max(0, Number(current.accumulatedMs) || 0),
        runningSince: validIso(current.runningSince),
      };
    }
    if (normalized.phase === "break") {
      const source = candidate.breakState;
      if (!source || !validIso(source.startedAt) || !validIso(source.endsAt)) return null;
      normalized.breakState = {
        id: String(source.id || breakId(normalized.routineId)).slice(0, 160),
        plannedSeconds: clampInteger(source.plannedSeconds, 0, 86_400, DEFAULT_SETTINGS.breakMinutes * 60),
        startedAt: validIso(source.startedAt),
        endsAt: validIso(source.endsAt),
        extensionsMinutes: clampInteger(source.extensionsMinutes, 0, 1440, 0),
      };
    }
    return normalized;
  }

  function normalizeDescriptor(source, fallbackMinutes) {
    if (!source?.subjectId) return null;
    return subjectDescriptor(source.subjectId, clampInteger(source.targetMinutes, 1, 360, fallbackMinutes), source.subjectName, source.topicId, source.topicName);
  }

  function clearActiveFlow() {
    activeFlow = null;
    dialogMode = "timer";
    resumeAfterCancel = false;
    stopTick();
    removeStoredActiveFlow();
  }

  function removeStoredActiveFlow() {
    try {
      localStorage.removeItem(ACTIVE_STORAGE_KEY);
    } catch {
      // O estado em memória ainda pode ser usado durante esta abertura.
    }
  }

  function renderAfterAction() {
    host.renderCurrentView?.();
    if (isStudyDialogOpen()) renderStudyDialog();
    updateLiveTimerDom();
  }

  function subjectDescriptor(subjectId, targetMinutes, nameOverride = "", topicIdOverride = "", topicNameOverride = "") {
    const id = String(subjectId || "").slice(0, 100);
    const focus = safeSubjectFocus(id)?.topic || null;
    return {
      subjectId: id,
      subjectName: String(nameOverride || subjectName(id)).slice(0, 140),
      targetMinutes: clampInteger(targetMinutes, 1, 360, DEFAULT_SETTINGS.primaryTargetMinutes),
      topicId: String(topicIdOverride || focus?.id || "").slice(0, 160),
      topicName: String(topicNameOverride || focus?.name || "").slice(0, 180),
    };
  }

  function renderTopicSelector(current) {
    const topics = host.getSubjectTopics?.(current.subjectId) || [];
    if (!topics.length) return "";
    const options = topics.map((topic) => `<option value="${escapeHTML(topic.id)}" data-topic-name="${escapeHTML(topic.name)}" ${topic.id === current.topicId ? "selected" : ""}>${escapeHTML(topic.name)}</option>`).join("");
    return `<label class="study-topic-select" for="study-session-topic"><span>Conteúdo desta sessão</span><select id="study-session-topic"><option value="">Sem tópico específico</option>${options}</select><small>O tempo real alimenta o saldo e a comparação com a estimativa.</small></label>`;
  }

  function findSubject(subjectId) {
    return window.TRAJETORIA_DATA?.subjects?.find((subject) => subject.id === subjectId) || null;
  }

  function subjectName(subjectId) {
    return findSubject(subjectId)?.name || String(subjectId || "Matéria").replaceAll("-", " ");
  }

  function renderSubjectOptions() {
    return (window.TRAJETORIA_DATA?.subjects || []).map((subject) => `<option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`).join("");
  }

  function safeSubjectFocus(subjectId) {
    try {
      return host.getSubjectFocus?.(subjectId) || null;
    } catch {
      return null;
    }
  }

  function routineIdForDay(dayKey) {
    return `study-routine-${dayKey}`;
  }

  function sessionId(routineId, slot) {
    return `${routineId}-slot-${slot}`;
  }

  function breakId(routineId) {
    return `${routineId}-break`;
  }

  function localDayKey(date) {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  function dateFromDayKey(dayKey) {
    const [year, month, day] = String(dayKey).split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function formatDayKey(dayKey) {
    const date = dateFromDayKey(dayKey);
    return Number.isNaN(date.getTime()) ? String(dayKey) : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function formatStudyDate(dayKey, isToday = false) {
    const date = dateFromDayKey(dayKey);
    if (Number.isNaN(date.getTime())) return String(dayKey);
    const weekday = capitalize(date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""));
    const calendar = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
    return `${isToday ? "Hoje" : calendar} · ${weekday}${isToday ? `, ${calendar}` : ""}`;
  }

  function pluralize(value, singular, plural) {
    return Number(value) === 1 ? singular : plural;
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  }

  function startOfLocalDay(date) {
    const value = new Date(date);
    value.setHours(12, 0, 0, 0);
    return value;
  }

  function addLocalDays(date, days) {
    const value = new Date(date);
    value.setDate(value.getDate() + days);
    value.setHours(12, 0, 0, 0);
    return value;
  }

  function validIso(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
  }

  function dateTime(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }

  function clampInteger(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
  }

  function primeBreakAlert() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    } catch {
      audioContext = null;
    }
  }

  function playBreakAlert() {
    try {
      primeBreakAlert();
      if (audioContext) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.055, audioContext.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
      }
      navigator.vibrate?.([120, 80, 120]);
    } catch {
      // Avisos em background e políticas de áudio variam entre navegadores.
    }
  }

  function toast(message) {
    host.showToast?.(message);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.TrajetoriaStudy = {
    ACTIVE_STORAGE_KEY,
    initialize,
    renderDailyRoutine,
    renderConsistencySection,
    handleAction,
    applyExternalState,
    resetActiveSession,
  };
})();
