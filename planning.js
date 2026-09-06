(() => {
  "use strict";

  const EFFORT_MINUTES = Object.freeze({ small: 30, normal: 60, large: 90, "very-large": 120 });
  const EFFORT_LABELS = Object.freeze({ small: "Pequeno", normal: "Normal", large: "Grande", "very-large": "Muito grande" });
  const DEFAULT_CONFIG = Object.freeze({
    examDate: "2026-11-29",
    planStartDate: "2026-09-03",
    lastRegularStudyDate: "2026-11-27",
    dailyTargetsMinutes: { "2026-09": 90, "2026-10": 150, "2026-11": 180 },
    initialMarginMinutes: 630,
    integrationReserveMinutes: 1440,
    simulationReviewReserveMinutes: 240,
    safetyBufferPercent: 10,
    regularWeekdays: [1, 2, 3, 4, 5],
    defaultEffort: "normal",
  });

  function calculate(state, topics, now = new Date()) {
    const config = window.TRAJETORIA_PLANNING_CONFIG || {};
    const planning = state.planning || {};
    const today = startOfLocalDay(now);
    const todayKey = localDayKey(today);
    const exam = dateFromDayKey(config.dates?.examDate || planning.examDate || DEFAULT_CONFIG.examDate);
    const planStart = dateFromDayKey(config.dates?.planStartDate || DEFAULT_CONFIG.planStartDate);
    const lastRegularStudy = dateFromDayKey(config.dates?.lastRegularStudyDate || DEFAULT_CONFIG.lastRegularStudyDate);
    const started = dateFromDayKey(planning.startedDay || todayKey);
    const weekdays = normalizedWeekdays(planning.regularWeekdays);
    const dailyMinutes = dailyTargetForDate(today, config);
    const safetyPercent = clamp(Number(planning.safetyBufferPercent), 0, 50, DEFAULT_CONFIG.safetyBufferPercent);
    const remainingRegularDays = countRegularDays(today, addLocalDays(lastRegularStudy, 1), weekdays);
    const todayStudyMinutes = studyMinutesForDay(state.study?.sessions, todayKey);
    const topicMinutes = minutesByTopic(state.study?.sessions);
    const topicRows = topics.map((topic) => {
      const topicState = state.topics?.[topic.id] || {};
      const effort = Math.max(0, Number(topic.budgetMinutes) || 0);
      const used = Math.round(topicMinutes[topic.id] || 0);
      const baseReady = ["consolidating", "mastered"].includes(topicState.status);
      return {
        id: topic.id,
        name: topic.name,
        subjectId: topic.subject.id,
        subjectName: topic.subject.name,
        status: topicState.status,
        effort,
        effortSize: null,
        used,
        remaining: baseReady ? 0 : Math.max(0, effort - used),
        variance: used - effort,
        baseReady,
        validated: topicState.status === "mastered",
      };
    });
    const remainingLoadMinutes = sum(topicRows.map((row) => row.remaining));
    const baseRemaining = topicRows.filter((row) => !row.baseReady);
    const integrationQueue = topicRows.filter((row) => row.status === "consolidating");
    const validated = topicRows.filter((row) => row.validated);
    const overEstimate = topicRows.filter((row) => row.used > 0 && row.variance > 0).sort((a, b) => b.variance - a.variance);
    const underEstimate = topicRows.filter((row) => row.baseReady && row.used > 0 && row.variance < 0).sort((a, b) => a.variance - b.variance);
    const bySubject = groupBySubject(topicRows);
    const subjectInsights = paceInsights(topicRows);
    const recent = recentPace(state.study?.sessions, today);
    const margin = calculateMargin(state, topics, today, planStart, lastRegularStudy, weekdays, config);
    return {
      today, todayKey, examDate: exam, startedDay: started, planStart, lastRegularStudy, dailyMinutes, safetyPercent,
      regularWeekdays: weekdays, remainingRegularDays, theoreticalMinutes: 0, safeCapacityMinutes: 0,
      todayStudyMinutes, remainingLoadMinutes, balanceMinutes: margin.currentMarginMinutes, status: margin.status,
      baseRemaining, integrationQueue, validated, overEstimate, underEstimate, topicRows,
      bySubject, subjectInsights, recent, requiredWeeklyMinutes: null, projectedDate: null,
      margin, integrationMinutes: margin.integrationMinutes, simulationReviewMinutes: margin.simulationReviewMinutes,
    };
  }

  function countRegularDays(start, endExclusive, weekdays = DEFAULT_CONFIG.regularWeekdays) {
    const first = startOfLocalDay(start);
    const end = startOfLocalDay(endExclusive);
    if (!Number.isFinite(first.getTime()) || !Number.isFinite(end.getTime()) || first >= end) return 0;
    let count = 0;
    for (let cursor = first; cursor < end; cursor = addLocalDays(cursor, 1)) {
      if (weekdays.includes(cursor.getDay())) count += 1;
    }
    return count;
  }

  function studyMinutesForDay(sessions = [], dayKey) {
    return sessions.filter((session) => session.dayKey === dayKey)
      .filter((session) => session.kind !== "simulation")
      .reduce((total, session) => total + sessionSeconds(session) / 60, 0);
  }

  function minutesByTopic(sessions = []) {
    return sessions.reduce((result, session) => {
      if (session.kind !== "base") return result;
      const segments = Array.isArray(session.segments) && session.segments.length ? session.segments : [{ topicId: session.topicId, effectiveSeconds: session.effectiveSeconds }];
      segments.forEach((segment) => {
        if (!segment.topicId) return;
        result[segment.topicId] = (result[segment.topicId] || 0) + Math.max(0, Number(segment.effectiveSeconds) || 0) / 60;
      });
      return result;
    }, {});
  }

  function sessionSeconds(session) {
    if (Array.isArray(session?.segments) && session.segments.length) return session.segments.reduce((total, segment) => total + Math.max(0, Number(segment.effectiveSeconds) || 0), 0);
    return Math.max(0, Number(session?.effectiveSeconds) || 0);
  }

  function dailyTargetForDate(date, config = {}) {
    const target = config.dailyTargetsMinutes?.[localDayKey(date).slice(0, 7)] ?? DEFAULT_CONFIG.dailyTargetsMinutes[localDayKey(date).slice(0, 7)] ?? 0;
    return [0, 6].includes(date.getDay()) ? 0 : Math.max(0, Number(target) || 0);
  }

  function calculateMargin(state, topics, today, planStart, lastRegularStudy, weekdays, config) {
    const sessions = state.study?.sessions || [];
    const start = planStart.getTime() ? planStart : dateFromDayKey(DEFAULT_CONFIG.planStartDate);
    const end = lastRegularStudy.getTime() ? lastRegularStudy : dateFromDayKey(DEFAULT_CONFIG.lastRegularStudyDate);
    let dailyDelta = 0;
    for (let date = start; date <= end && date <= today; date = addLocalDays(date, 1)) {
      if (!weekdays.includes(date.getDay())) continue;
      const target = dailyTargetForDate(date, config);
      const actual = studyMinutesForDay(sessions, localDayKey(date));
      dailyDelta += date.getTime() === today.getTime() ? Math.max(0, actual - target) : actual - target;
    }
    const topicMinutes = minutesByTopic(sessions);
    let topicDelta = 0;
    topics.forEach((topic) => {
      const actual = topicMinutes[topic.id] || 0;
      const budget = Math.max(0, Number(topic.budgetMinutes) || 0);
      const status = state.topics?.[topic.id]?.status;
      if (["consolidating", "mastered"].includes(status) && actual > 0) topicDelta += budget - actual;
      else if (!(["consolidating", "mastered"].includes(status)) && actual > budget) topicDelta += budget - actual;
    });
    const integrationMinutes = sessions.filter((session) => session.kind === "integration").reduce((total, session) => total + sessionSeconds(session) / 60, 0);
    const simulationReviewMinutes = sessions.filter((session) => session.kind === "simulation-review").reduce((total, session) => total + sessionSeconds(session) / 60, 0);
    const initialMargin = Number(config.workload?.initialMarginMinutes ?? DEFAULT_CONFIG.initialMarginMinutes);
    const integrationReserve = Number(config.workload?.integrationReserveMinutes ?? DEFAULT_CONFIG.integrationReserveMinutes);
    const reviewReserve = Number(config.workload?.simulationReviewReserveMinutes ?? DEFAULT_CONFIG.simulationReviewReserveMinutes);
    const currentMarginMinutes = initialMargin + dailyDelta + topicDelta - Math.max(0, integrationMinutes - integrationReserve) - Math.max(0, simulationReviewMinutes - reviewReserve);
    return {
      initialMarginMinutes: initialMargin, dailyDeltaMinutes: dailyDelta, topicDeltaMinutes: topicDelta,
      integrationMinutes, integrationOverrunMinutes: Math.max(0, integrationMinutes - integrationReserve),
      simulationReviewMinutes, simulationReviewOverrunMinutes: Math.max(0, simulationReviewMinutes - reviewReserve),
      currentMarginMinutes, status: marginStatus(currentMarginMinutes),
    };
  }

  function marginStatus(value) {
    if (value > 180) return { id: "comfortable", label: "Plano cabe", description: "A margem planejada está acima de 180 minutos." };
    if (value >= 0) return { id: "attention", label: "Margem curta", description: "A margem existe, mas está entre 0 e 180 minutos." };
    return { id: "behind", label: "Replanejar", description: "A margem planejada ficou abaixo de zero." };
  }

  function recentPace(sessions = [], today = new Date()) {
    const firstDay = addLocalDays(today, -13);
    const firstKey = localDayKey(firstDay);
    const todayKey = localDayKey(today);
    const recent = sessions.filter((session) => session.dayKey >= firstKey && session.dayKey <= todayKey);
    const studyDays = new Set(recent.map((session) => session.dayKey));
    const totalMinutes = Math.round(recent.reduce((total, session) => total + Math.max(0, Number(session.effectiveSeconds) || 0) / 60, 0));
    return { totalMinutes, studyDays: studyDays.size, weeklyMinutes: Math.round(totalMinutes / 2), reliable: studyDays.size >= 3 };
  }

  function groupBySubject(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const group = groups.get(row.subjectId) || { subjectId: row.subjectId, subjectName: row.subjectName, remainingMinutes: 0, baseRemaining: 0, integrationPending: 0 };
      group.remainingMinutes += row.remaining;
      if (!row.baseReady) group.baseRemaining += 1;
      if (row.status === "consolidating") group.integrationPending += 1;
      groups.set(row.subjectId, group);
    });
    return [...groups.values()].sort((a, b) => b.remainingMinutes - a.remainingMinutes);
  }

  function paceInsights(rows) {
    const groups = new Map();
    rows.filter((row) => row.used > 0).forEach((row) => {
      const group = groups.get(row.subjectId) || { subjectName: row.subjectName, used: 0, expected: 0, topics: 0 };
      group.used += row.used; group.expected += row.effort; group.topics += 1; groups.set(row.subjectId, group);
    });
    return [...groups.values()].filter((group) => group.topics >= 2).map((group) => ({
      ...group,
      message: group.used > group.expected * 1.15
        ? `Seus tópicos de ${group.subjectName} estão levando mais tempo que o previsto.`
        : group.used < group.expected * 0.75
          ? `Seus tópicos de ${group.subjectName} estão avançando mais rápido que o previsto.`
          : `Seu tempo em ${group.subjectName} está próximo das estimativas.`,
    }));
  }


  function normalizedWeekdays(value) {
    if (!Array.isArray(value)) return [...DEFAULT_CONFIG.regularWeekdays];
    const days = [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
    return days.length ? days : [...DEFAULT_CONFIG.regularWeekdays];
  }

  function dateFromDayKey(dayKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ""));
    if (!match) return new Date(NaN);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  }

  function localDayKey(date) {
    const value = startOfLocalDay(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  function startOfLocalDay(date) { const value = new Date(date); value.setHours(12, 0, 0, 0); return value; }
  function addLocalDays(date, days) { const value = startOfLocalDay(date); value.setDate(value.getDate() + days); return value; }
  function sum(values) { return values.reduce((total, value) => total + Number(value || 0), 0); }
  function clamp(value, min, max, fallback) { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback; }

  window.TrajetoriaPlanning = {
    DEFAULT_CONFIG, EFFORT_MINUTES, EFFORT_LABELS, calculate, countRegularDays,
    studyMinutesForDay, minutesByTopic, recentPace, dateFromDayKey, localDayKey, addLocalDays, dailyTargetForDate,
  };
})();
