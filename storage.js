(() => {
  "use strict";

  const STORAGE_KEY = "trajetoria-estudos-v3";
  const V2_STORAGE_KEY = "trajetoria-matematica-v2";
  const V1_STORAGE_KEY = "trajetoria-matematica-v1";
  const APP_VERSION = 3;
  const DAY_MS = 86_400_000;
  const DEFAULT_INTERVALS = [1, 7, 21, 45];
  const DEFAULT_STUDY_SETTINGS = Object.freeze({
    primaryTargetMinutes: 60,
    breakMinutes: 15,
    secondaryTargetMinutes: 30,
    updatedAt: null,
  });
  const DEFAULT_PLANNING = window.TrajetoriaPlanning.DEFAULT_CONFIG;
  const STUDY_RECORD_LIMIT = 3000;
  const MAX_STUDY_SECONDS = 7 * 24 * 60 * 60;
  const INITIAL_REVIEW_OFFSETS = [1, 2, 3, 5, 7, 9, 11];
  const REQUIRED_MASTERED_MATH = new Set([
    "operacoes", "fracoes", "numeros-decimais", "porcentagem", "razao",
    "proporcao", "equacoes", "sistemas", "produtos-notaveis",
  ]);
  const HISTORICAL_TOPIC_STATUSES = Object.freeze({
    fatoracao: "consolidating",
    potenciacao: "consolidating",
    radiciacao: "consolidating",
    "expressoes-polinomios": "consolidating",
    inequacoes: "consolidating",
    "cie-materia-corpo-objeto": "consolidating",
    "cie-estados-fisicos": "consolidating",
    "his-o-que-e": "mastered",
    "his-fontes": "mastered",
    "his-tempo": "mastered",
    "his-pre-historia": "mastered",
    "his-mesopotamia": "mastered",
  });
  const aliases = {
    "perimetro-area": ["area", "perimetro"],
    "geometria-espacial-volume": ["volume", "prismas"],
    "tabelas-graficos": ["estatistica"],
    "media-moda-mediana": ["media", "moda", "mediana"],
  };

  const { subjects } = window.TRAJETORIA_DATA;
  const allTopics = subjects.flatMap((subject, subjectIndex) =>
    subject.blocks.flatMap((block, blockIndex) =>
      block.topics.map((topic, topicIndex) => ({
        ...topic,
        subject,
        subjectIndex,
        block,
        blockIndex,
        topicIndex,
      }))
    )
  );

  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function createTopicState(topic, masteredIndex = 0) {
    const mastered = topic.initialStatus === "mastered";
    const now = Date.now();
    const offset = INITIAL_REVIEW_OFFSETS[masteredIndex % INITIAL_REVIEW_OFFSETS.length];
    return {
      status: topic.initialStatus || "not-started",
      confidence: 0,
      notes: "",
      attempts: [],
      errors: [],
      startedAt: null,
      updatedAt: mastered ? new Date(now).toISOString() : null,
      masteredAt: mastered ? new Date(now).toISOString() : null,
      review: {
        step: 0,
        lastAt: null,
        nextAt: mastered ? new Date(now + offset * DAY_MS).toISOString() : null,
      },
    };
  }

  function createDefaultStudyState() {
    return {
      version: 1,
      settings: { ...DEFAULT_STUDY_SETTINGS },
      sessions: [],
      breaks: [],
    };
  }

  function createDefaultState() {
    let masteredIndex = 0;
    const topics = {};
    allTopics.forEach((topic) => {
      topics[topic.id] = createTopicState(topic, masteredIndex);
      if (topic.initialStatus === "mastered") masteredIndex += 1;
    });
    return {
      version: APP_VERSION,
      topics,
      activities: [],
      literatureWorks: [],
      examQuestions: [],
      simulations: [],
      weeklyReviews: {},
      study: createDefaultStudyState(),
      planning: createDefaultPlanningState(),
      settings: {
        reviewsEnabled: true,
        reviewIntervals: [...DEFAULT_INTERVALS],
        reopenForgotten: true,
        staleReviewDays: 21,
      },
    };
  }

  function createDefaultPlanningState() {
    const today = new Date();
    return {
      version: 1,
      examDate: DEFAULT_PLANNING.examDate,
      safetyBufferPercent: DEFAULT_PLANNING.safetyBufferPercent,
      regularWeekdays: [...DEFAULT_PLANNING.regularWeekdays],
      startedDay: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
      topicEfforts: Object.fromEntries(allTopics.map((topic) => [topic.id, DEFAULT_PLANNING.defaultEffort])),
      updatedAt: null,
    };
  }

  function loadState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (current?.version === APP_VERSION && current.topics) {
        const normalized = normalizeState(current);
        if (repairHistoricalTopicStatuses(normalized)) saveState(normalized);
        return normalized;
      }

      const previous = JSON.parse(localStorage.getItem(V2_STORAGE_KEY));
      if (previous?.topics) {
        const migrated = migrateV2(previous);
        saveState(migrated);
        return migrated;
      }

      const legacy = JSON.parse(localStorage.getItem(V1_STORAGE_KEY));
      if (legacy?.progress) {
        const migrated = migrateV1(legacy);
        saveState(migrated);
        return migrated;
      }
    } catch (error) {
      console.warn("Não foi possível restaurar os dados salvos.", error);
    }
    const initial = createDefaultState();
    saveState(initial);
    return initial;
  }

  function migrateV2(previous) {
    const migrated = createDefaultState();
    allTopics.forEach((topic) => {
      const sources = [topic.id, ...(aliases[topic.id] || [])]
        .map((id) => previous.topics[id])
        .filter(Boolean);
      if (!sources.length) return;
      migrated.topics[topic.id] = mergeLegacyTopicSources(sources, migrated.topics[topic.id]);
    });

    REQUIRED_MASTERED_MATH.forEach((topicId) => {
      const topicState = migrated.topics[topicId];
      if (!topicState) return;
      topicState.status = "mastered";
      topicState.masteredAt ||= new Date().toISOString();
      topicState.updatedAt ||= topicState.masteredAt;
      topicState.review.nextAt ||= new Date(Date.now() + DAY_MS).toISOString();
    });
    const factorization = previous.topics.fatoracao;
    if (factorization) {
      migrated.topics.fatoracao.status = factorization.status === "studying" ? "studying" : factorization.status === "mastered" ? "mastered" : "not-started";
    }
    migrated.activities = Array.isArray(previous.activities) ? previous.activities.slice(-200) : [];
    migrated.settings = {
      ...migrated.settings,
      reviewsEnabled: previous.settings?.reviewsEnabled !== false,
      reviewIntervals: normalizeIntervals(previous.settings?.reviewIntervals),
      reopenForgotten: previous.settings?.reopenForgotten !== false,
    };
    return migrated;
  }

  function migrateV1(legacy) {
    const migrated = createDefaultState();
    Object.entries(legacy.progress).forEach(([topicId, completed]) => {
      if (!migrated.topics[topicId]) return;
      migrated.topics[topicId].status = completed ? "mastered" : "not-started";
    });
    REQUIRED_MASTERED_MATH.forEach((topicId) => {
      const topicState = migrated.topics[topicId];
      if (topicState) topicState.status = "mastered";
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
    return migrated;
  }

  function mergeLegacyTopicSources(sources, fallback) {
    const primary = sources[0];
    const attempts = sources.flatMap((source) => source.attempts || []);
    const errors = sources.flatMap((source) => source.errors || []);
    const notes = sources.map((source) => source.notes).filter(Boolean).join("\n\n");
    return normalizeTopicState({ ...primary, attempts, errors, notes }, fallback);
  }

  function normalizeState(candidate) {
    const defaults = createDefaultState();
    const normalized = {
      ...candidate,
      version: APP_VERSION,
      topics: {},
      activities: Array.isArray(candidate.activities) ? candidate.activities.filter((item) => item?.timestamp).slice(-200) : [],
      literatureWorks: Array.isArray(candidate.literatureWorks) ? candidate.literatureWorks.filter((work) => work?.title).slice(0, 100) : [],
      examQuestions: Array.isArray(candidate.examQuestions) ? candidate.examQuestions.filter((question) => question?.institution).slice(0, 500) : [],
      simulations: normalizeSimulations(candidate.simulations),
      weeklyReviews: candidate.weeklyReviews && typeof candidate.weeklyReviews === "object" ? candidate.weeklyReviews : {},
      study: normalizeStudyState(candidate.study),
      planning: normalizePlanningState(candidate.planning),
      settings: {
        reviewsEnabled: candidate.settings?.reviewsEnabled !== false,
        reviewIntervals: normalizeIntervals(candidate.settings?.reviewIntervals),
        reopenForgotten: candidate.settings?.reopenForgotten !== false,
        staleReviewDays: clampNumber(candidate.settings?.staleReviewDays, 7, 180, 21),
      },
    };
    allTopics.forEach((topic) => {
      normalized.topics[topic.id] = normalizeTopicState(candidate.topics?.[topic.id], defaults.topics[topic.id]);
    });
    return normalized;
  }

  function repairHistoricalTopicStatuses(state) {
    let changed = false;
    Object.entries(HISTORICAL_TOPIC_STATUSES).forEach(([topicId, status]) => {
      const topicState = state.topics?.[topicId];
      if (!topicState || topicState.status !== "not-started") return;
      topicState.status = status;
      topicState.updatedAt = topicState.updatedAt || new Date().toISOString();
      if (status === "mastered") topicState.masteredAt ||= topicState.updatedAt;
      changed = true;
    });
    return changed;
  }

  function normalizeTopicState(source, fallback) {
    if (!source) return { ...fallback, review: { ...fallback.review }, attempts: [], errors: [] };
    const validStatuses = ["not-started", "studying", "consolidating", "mastered"];
    const status = validStatuses.includes(source.status) ? source.status : fallback.status;
    return {
      ...source,
      status,
      confidence: clampNumber(source.confidence, 0, 5, 0),
      notes: typeof source.notes === "string" ? source.notes.slice(0, 1200) : "",
      attempts: Array.isArray(source.attempts) ? source.attempts.filter(isValidAttempt).map(normalizeAttempt).slice(-100) : [],
      errors: Array.isArray(source.errors) ? source.errors.filter((error) => error && (error.description || error.text)).map(normalizeError).slice(-100) : [],
      startedAt: typeof source.startedAt === "string" ? source.startedAt : null,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : source.masteredAt || null,
      masteredAt: status === "mastered" && typeof source.masteredAt === "string" ? source.masteredAt : status === "mastered" ? fallback.masteredAt : null,
      review: {
        step: clampNumber(source.review?.step, 0, 20, 0),
        lastAt: typeof source.review?.lastAt === "string" ? source.review.lastAt : null,
        nextAt: status === "mastered" && typeof source.review?.nextAt === "string" ? source.review.nextAt : status === "mastered" ? fallback.review.nextAt : null,
      },
    };
  }

  function isValidAttempt(attempt) {
    return attempt && Number.isFinite(Number(attempt.correct)) && Number.isFinite(Number(attempt.total)) && Number(attempt.total) > 0;
  }

  function normalizeAttempt(attempt) {
    const total = Math.max(1, Math.round(Number(attempt.total)));
    return {
      ...attempt,
      id: String(attempt.id || createId()),
      correct: Math.min(total, Math.max(0, Math.round(Number(attempt.correct)))),
      total,
      timestamp: attempt.timestamp || new Date().toISOString(),
    };
  }

  function normalizeError(error) {
    return {
      ...error,
      id: String(error.id || createId()),
      description: String(error.description || error.text || "").slice(0, 300),
      correctAnswer: String(error.correctAnswer || error.correction || "Não registrada").slice(0, 500),
      resolved: Boolean(error.resolved),
      reviewCount: clampNumber(error.reviewCount, 0, 999, error.resolved ? 1 : 0),
      timestamp: error.timestamp || new Date().toISOString(),
      lastReviewedAt: typeof error.lastReviewedAt === "string" ? error.lastReviewedAt : null,
    };
  }

  function normalizeStudyState(source) {
    const settings = normalizeStudySettings(source?.settings);
    return {
      ...source,
      version: 1,
      settings,
      sessions: normalizeStudySessions(source?.sessions, settings),
      breaks: normalizeStudyBreaks(source?.breaks, settings),
    };
  }

  function normalizeStudySettings(source) {
    return {
      ...source,
      primaryTargetMinutes: clampStudyNumber(source?.primaryTargetMinutes, 1, 600, DEFAULT_STUDY_SETTINGS.primaryTargetMinutes),
      breakMinutes: clampStudyNumber(source?.breakMinutes, 1, 180, DEFAULT_STUDY_SETTINGS.breakMinutes),
      secondaryTargetMinutes: clampStudyNumber(source?.secondaryTargetMinutes, 1, 600, DEFAULT_STUDY_SETTINGS.secondaryTargetMinutes),
      updatedAt: validDate(source?.updatedAt),
    };
  }

  function normalizeStudySessions(items, settings) {
    if (!Array.isArray(items)) return [];
    const sessions = items
      .filter((item) => item && typeof item === "object")
      .map((item) => normalizeStudySession(item, settings))
      .filter(Boolean);
    return mergeItems(sessions, [], "updatedAt", "endedAt", "createdAt", "startedAt").slice(-STUDY_RECORD_LIMIT);
  }

  function normalizeStudySession(source, settings) {
    const startedAt = validDate(source.startedAt);
    const endedAt = validDate(source.endedAt);
    const createdAt = validDate(source.createdAt) || startedAt || endedAt;
    if (!createdAt) return null;
    const id = normalizeIdentifier(source.id) || createId();
    const slot = Number(source.slot) === 2 ? 2 : 1;
    const targetFallback = slot === 2 ? settings.secondaryTargetMinutes : settings.primaryTargetMinutes;
    const effectiveSeconds = clampStudyNumber(source.effectiveSeconds, 0, MAX_STUDY_SECONDS, 0);
    const targetMinutes = clampStudyNumber(source.targetMinutes, 1, 600, targetFallback);
    return {
      ...source,
      id,
      routineId: normalizeIdentifier(source.routineId) || id,
      dayKey: normalizeDayKey(source.dayKey),
      slot,
      subjectId: normalizeText(source.subjectId, 100),
      subjectName: normalizeText(source.subjectName, 140),
      topicId: normalizeText(source.topicId, 160),
      topicName: normalizeText(source.topicName, 180),
      kind: ["base", "integration", "simulation-review", "simulation"].includes(source.kind) ? source.kind : "",
      simulationId: normalizeIdentifier(source.simulationId),
      segments: normalizeStudySegments(source.segments),
      startedAt,
      endedAt,
      effectiveSeconds,
      targetMinutes,
      targetMet: effectiveSeconds >= targetMinutes * 60,
      status: source.status === "completed" ? "completed" : "incomplete",
      createdAt,
      updatedAt: validDate(source.updatedAt) || endedAt || createdAt,
    };
  }

  function normalizeStudySegments(items) {
    if (!Array.isArray(items)) return [];
    return items.map((segment) => ({
      ...segment,
      topicId: normalizeIdentifier(segment?.topicId),
      topicName: normalizeText(segment?.topicName, 180),
      effectiveSeconds: clampStudyNumber(segment?.effectiveSeconds, 0, MAX_STUDY_SECONDS, 0),
    })).filter((segment) => segment.effectiveSeconds > 0 || segment.topicId);
  }

  function normalizeSimulations(items) {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => item && typeof item === "object").map((item) => ({
      ...item,
      id: normalizeIdentifier(item.id) || createId(),
      simulationId: normalizeIdentifier(item.simulationId),
      status: ["planned", "completed", "reviewing", "reviewed"].includes(item.status) ? item.status : "planned",
      result: normalizeSimulationResult(item.result),
      correctionMinutes: clampStudyNumber(item.correctionMinutes, 0, MAX_STUDY_SECONDS / 60, 0),
      createdAt: validDate(item.createdAt) || new Date().toISOString(),
      updatedAt: validDate(item.updatedAt) || validDate(item.createdAt) || new Date().toISOString(),
    }));
    return mergeSimulations(normalized, []).slice(-20);
  }

  function normalizeSimulationResult(result) {
    if (!result || typeof result !== "object") return null;
    const limits = { "Português": 15, "Matemática": 15, "Ciências": 8, "História": 6, "Geografia": 6 };
    const normalized = { ...result };
    Object.entries(limits).forEach(([subject, limit]) => {
      const value = Number(result[subject]);
      normalized[subject] = Number.isFinite(value) ? Math.min(limit, Math.max(0, Math.round(value))) : 0;
    });
    return normalized;
  }

  function normalizePlanningState(source) {
    const defaults = createDefaultPlanningState();
    const validEfforts = new Set(Object.keys(window.TrajetoriaPlanning.EFFORT_MINUTES));
    return {
      ...source,
      version: 1,
      examDate: normalizeDayKey(source?.examDate) || defaults.examDate,
      safetyBufferPercent: clampNumber(source?.safetyBufferPercent, 0, 50, defaults.safetyBufferPercent),
      regularWeekdays: normalizeWeekdays(source?.regularWeekdays),
      startedDay: normalizeDayKey(source?.startedDay) || defaults.startedDay,
      topicEfforts: Object.fromEntries(allTopics.map((topic) => {
        const effort = source?.topicEfforts?.[topic.id];
        return [topic.id, validEfforts.has(effort) ? effort : DEFAULT_PLANNING.defaultEffort];
      })),
      updatedAt: validDate(source?.updatedAt),
    };
  }

  function normalizeWeekdays(value) {
    if (!Array.isArray(value)) return [...DEFAULT_PLANNING.regularWeekdays];
    const days = [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
    return days.length ? days : [...DEFAULT_PLANNING.regularWeekdays];
  }

  function normalizeStudyBreaks(items, settings) {
    if (!Array.isArray(items)) return [];
    const breaks = items
      .filter((item) => item && typeof item === "object")
      .map((item) => normalizeStudyBreak(item, settings))
      .filter(Boolean);
    return mergeItems(breaks, [], "updatedAt", "endedAt", "createdAt", "startedAt").slice(-STUDY_RECORD_LIMIT);
  }

  function normalizeStudyBreak(source, settings) {
    const startedAt = validDate(source.startedAt);
    const endedAt = validDate(source.endedAt);
    const createdAt = validDate(source.createdAt) || startedAt || endedAt;
    if (!createdAt) return null;
    const id = normalizeIdentifier(source.id) || createId();
    return {
      ...source,
      id,
      routineId: normalizeIdentifier(source.routineId) || id,
      dayKey: normalizeDayKey(source.dayKey),
      plannedSeconds: clampStudyNumber(source.plannedSeconds, 0, 24 * 60 * 60, settings.breakMinutes * 60),
      actualSeconds: clampStudyNumber(source.actualSeconds, 0, MAX_STUDY_SECONDS, 0),
      startedAt,
      endedAt,
      skipped: source.skipped === true,
      extensionsMinutes: clampStudyNumber(source.extensionsMinutes, 0, 24 * 60, 0),
      createdAt,
      updatedAt: validDate(source.updatedAt) || endedAt || createdAt,
    };
  }

  function normalizeIdentifier(value) {
    return typeof value === "string" ? value.trim().slice(0, 160) : "";
  }

  function normalizeText(value, limit) {
    return typeof value === "string" ? value.trim().slice(0, limit) : "";
  }

  function normalizeDayKey(value) {
    if (typeof value !== "string") return "";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return "";
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
      ? value.trim()
      : "";
  }

  function validDate(value) {
    if (typeof value !== "string") return null;
    return Number.isNaN(new Date(value).getTime()) ? null : value;
  }

  function clampStudyNumber(value, minimum, maximum, fallback) {
    if (value === null || value === "" || typeof value === "boolean") return fallback;
    return clampNumber(value, minimum, maximum, fallback);
  }

  function normalizeIntervals(intervals) {
    if (!Array.isArray(intervals) || intervals.length !== 4) return [...DEFAULT_INTERVALS];
    return intervals.map((value, index) => clampNumber(value, 1, 365, DEFAULT_INTERVALS[index]));
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function mergeStates(localCandidate, remoteCandidate) {
    const local = normalizeState(localCandidate || {});
    const remote = normalizeState(remoteCandidate || {});
    const merged = normalizeState({ ...remote, ...local });
    allTopics.forEach((topic) => {
      const localTopic = local.topics[topic.id];
      const remoteTopic = remote.topics[topic.id];
      const localTime = new Date(localTopic.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteTopic.updatedAt || 0).getTime();
      const newest = localTime >= remoteTime ? localTopic : remoteTopic;
      const older = newest === localTopic ? remoteTopic : localTopic;
      const status = topicStatusRank(localTopic.status) >= topicStatusRank(remoteTopic.status)
        ? localTopic.status
        : remoteTopic.status;
      const statusSource = topicStatusRank(localTopic.status) >= topicStatusRank(remoteTopic.status) ? localTopic : remoteTopic;
      merged.topics[topic.id] = {
        ...older,
        ...newest,
        status,
        attempts: mergeItems(localTopic.attempts, remoteTopic.attempts, "timestamp").slice(-100),
        errors: mergeItems(localTopic.errors, remoteTopic.errors, "lastReviewedAt", "timestamp").slice(-100),
      };
      if (status === "mastered") {
        merged.topics[topic.id].masteredAt ||= statusSource.masteredAt;
        merged.topics[topic.id].review = { ...merged.topics[topic.id].review, ...statusSource.review };
      }
    });
    merged.activities = mergeItems(local.activities, remote.activities, "timestamp").slice(-200);
    merged.literatureWorks = mergeItems(local.literatureWorks, remote.literatureWorks, "updatedAt", "createdAt").slice(0, 100);
    merged.examQuestions = mergeItems(local.examQuestions, remote.examQuestions, "updatedAt", "createdAt").slice(0, 500);
    merged.simulations = mergeSimulations(local.simulations, remote.simulations);
    merged.weeklyReviews = { ...remote.weeklyReviews, ...local.weeklyReviews };
    merged.study = {
      version: 1,
      settings: mergeStudySettings(local.study.settings, remote.study.settings),
      sessions: mergeItems(local.study.sessions, remote.study.sessions, "updatedAt", "endedAt", "createdAt", "startedAt").slice(-STUDY_RECORD_LIMIT),
      breaks: mergeItems(local.study.breaks, remote.study.breaks, "updatedAt", "endedAt", "createdAt", "startedAt").slice(-STUDY_RECORD_LIMIT),
    };
    merged.planning = mergePlanning(local.planning, remote.planning);
    merged.settings = { ...remote.settings, ...local.settings };
    return normalizeState(merged);
  }

  function topicStatusRank(status) {
    return { "not-started": 0, studying: 1, consolidating: 2, mastered: 3 }[status] || 0;
  }

  function mergeSimulations(localItems = [], remoteItems = []) {
    const bySimulation = new Map();
    [...remoteItems, ...localItems].forEach((item) => {
      const key = item.simulationId || item.id;
      const existing = bySimulation.get(key);
      if (!existing || itemDate(item, ["updatedAt", "createdAt"]) >= itemDate(existing, ["updatedAt", "createdAt"])) {
        bySimulation.set(key, existing ? { ...existing, ...item } : item);
      }
    });
    return [...bySimulation.values()].sort((a, b) => itemDate(a, ["updatedAt", "createdAt"]) - itemDate(b, ["updatedAt", "createdAt"])).slice(-20);
  }

  function mergePlanning(localPlanning, remotePlanning) {
    const localTime = new Date(localPlanning.updatedAt || 0).getTime();
    const remoteTime = new Date(remotePlanning.updatedAt || 0).getTime();
    if (remoteTime > localTime) return { ...remotePlanning, topicEfforts: { ...remotePlanning.topicEfforts } };
    return { ...localPlanning, topicEfforts: { ...localPlanning.topicEfforts } };
  }

  function mergeStudySettings(localSettings, remoteSettings) {
    const localTime = new Date(localSettings.updatedAt || 0).getTime();
    const remoteTime = new Date(remoteSettings.updatedAt || 0).getTime();
    if (localTime > remoteTime) return { ...localSettings };
    if (remoteTime > localTime) return { ...remoteSettings };

    const merged = { updatedAt: localSettings.updatedAt || remoteSettings.updatedAt || null };
    ["primaryTargetMinutes", "breakMinutes", "secondaryTargetMinutes"].forEach((field) => {
      const fallback = DEFAULT_STUDY_SETTINGS[field];
      const localIsCustom = localSettings[field] !== fallback;
      const remoteIsCustom = remoteSettings[field] !== fallback;
      merged[field] = localIsCustom || !remoteIsCustom ? localSettings[field] : remoteSettings[field];
    });
    return merged;
  }

  function mergeItems(first = [], second = [], ...dateFields) {
    const items = new Map();
    [...second, ...first].forEach((item) => {
      if (!item?.id) return;
      const existing = items.get(item.id);
      if (!existing) {
        items.set(item.id, item);
        return;
      }
      const itemIsNewer = itemDate(item, dateFields) >= itemDate(existing, dateFields);
      items.set(item.id, itemIsNewer ? { ...existing, ...item } : { ...item, ...existing });
    });
    return [...items.values()].sort((a, b) => itemDate(a, dateFields) - itemDate(b, dateFields));
  }

  function itemDate(item, fields) {
    for (const field of fields) {
      const time = new Date(item?.[field] || 0).getTime();
      if (Number.isFinite(time) && time > 0) return time;
    }
    return 0;
  }

  window.TrajetoriaStorage = {
    APP_VERSION,
    STORAGE_KEY,
    DAY_MS,
    DEFAULT_INTERVALS,
    DEFAULT_STUDY_SETTINGS,
    DEFAULT_PLANNING,
    allTopics,
    createId,
    createDefaultState,
    loadState,
    migrateV2,
    normalizeState,
    repairHistoricalTopicStatuses,
    mergeStates,
    saveState,
    clampNumber,
  };
})();
