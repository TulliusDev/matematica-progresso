(() => {
  "use strict";

  const EFFORT_MINUTES = Object.freeze({ small: 30, normal: 60, large: 90, "very-large": 120 });
  const EFFORT_LABELS = Object.freeze({ small: "Pequeno", normal: "Normal", large: "Grande", "very-large": "Muito grande" });
  const DEFAULT_CONFIG = Object.freeze({
    examDate: "2026-11-29",
    safetyBufferPercent: 10,
    regularWeekdays: [1, 2, 3, 4, 5],
    defaultEffort: "normal",
  });

  function calculate(state, topics, now = new Date()) {
    const planning = state.planning || {};
    const today = startOfLocalDay(now);
    const todayKey = localDayKey(today);
    const exam = dateFromDayKey(planning.examDate || DEFAULT_CONFIG.examDate);
    const started = dateFromDayKey(planning.startedDay || todayKey);
    const weekdays = normalizedWeekdays(planning.regularWeekdays);
    const dailyMinutes = Math.max(1, Number(state.study?.settings?.primaryTargetMinutes || 60) + Number(state.study?.settings?.secondaryTargetMinutes || 30));
    const safetyPercent = clamp(Number(planning.safetyBufferPercent), 0, 50, DEFAULT_CONFIG.safetyBufferPercent);
    const remainingRegularDays = countRegularDays(today, exam, weekdays);
    const totalWindowDays = countRegularDays(started, exam, weekdays);
    const elapsedRegularDays = countRegularDays(started, today, weekdays);
    const todayStudyMinutes = weekdays.includes(today.getDay()) ? studyMinutesForDay(state.study?.sessions, todayKey) : 0;
    const theoreticalMinutes = Math.max(0, remainingRegularDays * dailyMinutes - todayStudyMinutes);
    const initialSafeBudget = totalWindowDays * dailyMinutes * (1 - safetyPercent / 100);
    const safeCapacityMinutes = Math.max(0, Math.round(initialSafeBudget - elapsedRegularDays * dailyMinutes - todayStudyMinutes));
    const topicMinutes = minutesByTopic(state.study?.sessions);
    const topicRows = topics.map((topic) => {
      const topicState = state.topics?.[topic.id] || {};
      const effort = EFFORT_MINUTES[planning.topicEfforts?.[topic.id]] || EFFORT_MINUTES[DEFAULT_CONFIG.defaultEffort];
      const used = Math.round(topicMinutes[topic.id] || 0);
      const baseReady = ["consolidating", "mastered"].includes(topicState.status);
      return {
        id: topic.id,
        name: topic.name,
        subjectId: topic.subject.id,
        subjectName: topic.subject.name,
        status: topicState.status,
        effort,
        effortSize: planning.topicEfforts?.[topic.id] || DEFAULT_CONFIG.defaultEffort,
        used,
        remaining: baseReady ? 0 : Math.max(0, effort - used),
        variance: used - effort,
        baseReady,
        validated: topicState.status === "mastered",
      };
    });
    const remainingLoadMinutes = sum(topicRows.map((row) => row.remaining));
    const balanceMinutes = safeCapacityMinutes - remainingLoadMinutes;
    const baseRemaining = topicRows.filter((row) => !row.baseReady);
    const integrationQueue = topicRows.filter((row) => row.status === "consolidating");
    const validated = topicRows.filter((row) => row.validated);
    const overEstimate = topicRows.filter((row) => row.used > 0 && row.variance > 0).sort((a, b) => b.variance - a.variance);
    const underEstimate = topicRows.filter((row) => row.baseReady && row.used > 0 && row.variance < 0).sort((a, b) => a.variance - b.variance);
    const bySubject = groupBySubject(topicRows);
    const subjectInsights = paceInsights(topicRows);
    const recent = recentPace(state.study?.sessions, today);
    const safeWeeklyMinutes = dailyMinutes * weekdays.length * (1 - safetyPercent / 100);
    const safeWeeksRemaining = safeWeeklyMinutes > 0 ? safeCapacityMinutes / safeWeeklyMinutes : 0;
    const requiredWeeklyMinutes = safeWeeksRemaining > 0 ? Math.ceil(remainingLoadMinutes / safeWeeksRemaining) : null;
    const projectedDate = recent.reliable && recent.weeklyMinutes > 0
      ? addLocalDays(today, Math.ceil(remainingLoadMinutes / recent.weeklyMinutes * 7))
      : null;
    return {
      today, todayKey, examDate: exam, startedDay: started, dailyMinutes, safetyPercent,
      regularWeekdays: weekdays, remainingRegularDays, theoreticalMinutes, safeCapacityMinutes,
      remainingLoadMinutes, balanceMinutes, status: balanceStatus(balanceMinutes, safeCapacityMinutes),
      baseRemaining, integrationQueue, validated, overEstimate, underEstimate, topicRows,
      bySubject, subjectInsights, recent, requiredWeeklyMinutes, projectedDate,
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
      .reduce((total, session) => total + Math.max(0, Number(session.effectiveSeconds) || 0) / 60, 0);
  }

  function minutesByTopic(sessions = []) {
    return sessions.reduce((result, session) => {
      if (!session.topicId) return result;
      result[session.topicId] = (result[session.topicId] || 0) + Math.max(0, Number(session.effectiveSeconds) || 0) / 60;
      return result;
    }, {});
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

  function balanceStatus(balance, capacity) {
    if (balance < 0) return { id: "behind", label: "Atrasado", description: "A carga estimada ultrapassa a capacidade segura." };
    const ratio = capacity > 0 ? balance / capacity : 0;
    if (ratio >= 0.25) return { id: "comfortable", label: "Confortável", description: "Há uma margem relevante para imprevistos." };
    if (ratio >= 0.1) return { id: "on-track", label: "No ritmo", description: "A carga cabe dentro do tempo seguro." };
    return { id: "attention", label: "Atenção", description: "A margem existe, mas está pequena." };
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
    studyMinutesForDay, minutesByTopic, recentPace, dateFromDayKey, localDayKey, addLocalDays,
  };
})();
