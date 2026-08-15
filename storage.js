(() => {
  "use strict";

  const STORAGE_KEY = "trajetoria-estudos-v3";
  const V2_STORAGE_KEY = "trajetoria-matematica-v2";
  const V1_STORAGE_KEY = "trajetoria-matematica-v1";
  const APP_VERSION = 3;
  const DAY_MS = 86_400_000;
  const DEFAULT_INTERVALS = [1, 7, 21, 45];
  const INITIAL_REVIEW_OFFSETS = [1, 2, 3, 5, 7, 9, 11];
  const REQUIRED_MASTERED_MATH = new Set([
    "operacoes", "fracoes", "numeros-decimais", "porcentagem", "razao",
    "proporcao", "equacoes", "sistemas", "produtos-notaveis",
  ]);
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
      weeklyReviews: {},
      settings: {
        reviewsEnabled: true,
        reviewIntervals: [...DEFAULT_INTERVALS],
        reopenForgotten: true,
        staleReviewDays: 21,
      },
    };
  }

  function loadState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (current?.version === APP_VERSION && current.topics) return normalizeState(current);

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
      version: APP_VERSION,
      topics: {},
      activities: Array.isArray(candidate.activities) ? candidate.activities.filter((item) => item?.timestamp).slice(-200) : [],
      literatureWorks: Array.isArray(candidate.literatureWorks) ? candidate.literatureWorks.filter((work) => work?.title).slice(0, 100) : [],
      examQuestions: Array.isArray(candidate.examQuestions) ? candidate.examQuestions.filter((question) => question?.institution).slice(0, 500) : [],
      weeklyReviews: candidate.weeklyReviews && typeof candidate.weeklyReviews === "object" ? candidate.weeklyReviews : {},
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

  function normalizeTopicState(source, fallback) {
    if (!source) return { ...fallback, review: { ...fallback.review }, attempts: [], errors: [] };
    const validStatuses = ["not-started", "studying", "consolidating", "mastered"];
    const status = validStatuses.includes(source.status) ? source.status : fallback.status;
    return {
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
      id: String(attempt.id || createId()),
      correct: Math.min(total, Math.max(0, Math.round(Number(attempt.correct)))),
      total,
      timestamp: attempt.timestamp || new Date().toISOString(),
    };
  }

  function normalizeError(error) {
    return {
      id: String(error.id || createId()),
      description: String(error.description || error.text || "").slice(0, 300),
      correctAnswer: String(error.correctAnswer || error.correction || "Não registrada").slice(0, 500),
      resolved: Boolean(error.resolved),
      reviewCount: clampNumber(error.reviewCount, 0, 999, error.resolved ? 1 : 0),
      timestamp: error.timestamp || new Date().toISOString(),
      lastReviewedAt: typeof error.lastReviewedAt === "string" ? error.lastReviewedAt : null,
    };
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
    const merged = normalizeState(remote);
    allTopics.forEach((topic) => {
      const localTopic = local.topics[topic.id];
      const remoteTopic = remote.topics[topic.id];
      const localTime = new Date(localTopic.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteTopic.updatedAt || 0).getTime();
      const newest = localTime >= remoteTime ? localTopic : remoteTopic;
      merged.topics[topic.id] = {
        ...newest,
        attempts: mergeItems(localTopic.attempts, remoteTopic.attempts, "timestamp").slice(-100),
        errors: mergeItems(localTopic.errors, remoteTopic.errors, "lastReviewedAt", "timestamp").slice(-100),
      };
    });
    merged.activities = mergeItems(local.activities, remote.activities, "timestamp").slice(-200);
    merged.literatureWorks = mergeItems(local.literatureWorks, remote.literatureWorks, "updatedAt", "createdAt").slice(0, 100);
    merged.examQuestions = mergeItems(local.examQuestions, remote.examQuestions, "updatedAt", "createdAt").slice(0, 500);
    merged.weeklyReviews = { ...remote.weeklyReviews, ...local.weeklyReviews };
    merged.settings = { ...remote.settings, ...local.settings };
    return normalizeState(merged);
  }

  function mergeItems(first = [], second = [], ...dateFields) {
    const items = new Map();
    [...second, ...first].forEach((item) => {
      if (!item?.id) return;
      const existing = items.get(item.id);
      if (!existing || itemDate(item, dateFields) >= itemDate(existing, dateFields)) items.set(item.id, item);
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
    allTopics,
    createId,
    createDefaultState,
    loadState,
    migrateV2,
    normalizeState,
    mergeStates,
    saveState,
    clampNumber,
  };
})();
