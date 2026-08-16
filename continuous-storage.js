(() => {
  "use strict";

  const DATA = window.TRAJETORIA_CONTINUOUS;
  const STORAGE_KEY = "trajetoria-formacao-continua-v1";
  const APP_VERSION = 1;
  const DAY_MS = 86_400_000;
  const VALID_STATUSES = ["blocked", "available", "learning", "practicing", "consolidated", "review"];
  const VALID_RESULTS = ["achieved", "partial", "stuck"];

  function id() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function defaultSkillState(skill) {
    return {
      status: skill.prerequisites.length ? "blocked" : "available",
      lastPractice: null,
      notes: "",
      updatedAt: null,
      consolidatedAt: null,
      review: { step: 0, nextAt: null },
      practiceLog: [],
    };
  }

  function createDefaultState() {
    const trails = {};
    DATA.trails.forEach((trail) => {
      const skills = {};
      trail.skills.forEach((skill) => { skills[skill.id] = defaultSkillState(skill); });
      trails[trail.id] = { currentSkillId: null, skills, repertoire: [], games: [] };
    });
    return { version: APP_VERSION, trails, activity: [] };
  }

  function loadState() {
    let candidate = null;
    try { candidate = JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch (error) { console.warn("Não foi possível ler a Formação Contínua.", error); }
    const normalized = normalizeState(candidate || createDefaultState());
    saveState(normalized);
    return normalized;
  }

  function normalizeState(candidate) {
    const defaults = createDefaultState();
    const normalized = { version: APP_VERSION, trails: {}, activity: normalizeLog(candidate.activity, 300) };
    DATA.trails.forEach((trail) => {
      const sourceTrail = candidate.trails?.[trail.id] || {};
      const skills = {};
      trail.skills.forEach((skill) => {
        const fallback = defaults.trails[trail.id].skills[skill.id];
        skills[skill.id] = normalizeSkillState(sourceTrail.skills?.[skill.id], fallback);
      });
      normalized.trails[trail.id] = {
        currentSkillId: trail.skills.some((skill) => skill.id === sourceTrail.currentSkillId) ? sourceTrail.currentSkillId : null,
        skills,
        repertoire: normalizeRepertoire(sourceTrail.repertoire),
        games: normalizeGames(sourceTrail.games),
      };
      reconcileUnlocks(normalized, trail);
    });
    return normalized;
  }

  function normalizeSkillState(source, fallback) {
    if (!source) return { ...fallback, review: { ...fallback.review }, practiceLog: [] };
    const status = VALID_STATUSES.includes(source.status) ? source.status : fallback.status;
    return {
      status,
      lastPractice: validDate(source.lastPractice),
      notes: typeof source.notes === "string" ? source.notes.slice(0, 1200) : "",
      updatedAt: validDate(source.updatedAt),
      consolidatedAt: validDate(source.consolidatedAt),
      review: {
        step: clamp(source.review?.step, 0, 20, 0),
        nextAt: validDate(source.review?.nextAt),
      },
      practiceLog: normalizeLog(source.practiceLog, 100).filter((entry) => VALID_RESULTS.includes(entry.result)),
    };
  }

  function normalizeLog(log, limit) {
    if (!Array.isArray(log)) return [];
    return log.filter((entry) => entry && validDate(entry.date || entry.timestamp)).map((entry) => ({
      ...entry,
      id: String(entry.id || id()),
      date: validDate(entry.date || entry.timestamp),
      note: typeof entry.note === "string" ? entry.note.slice(0, 600) : "",
    })).slice(-limit);
  }

  function normalizeRepertoire(items) {
    if (!Array.isArray(items)) return [];
    const statuses = ["learning", "problem", "playable", "consolidated", "maintenance"];
    return items.filter((item) => item?.title).map((item) => ({
      id: String(item.id || id()),
      title: String(item.title).slice(0, 140),
      status: statuses.includes(item.status) ? item.status : "learning",
      problem: String(item.problem || "").slice(0, 500),
      skillIds: Array.isArray(item.skillIds) ? item.skillIds.slice(0, 12) : [],
      updatedAt: validDate(item.updatedAt) || new Date().toISOString(),
    })).slice(0, 100);
  }

  function normalizeGames(items) {
    if (!Array.isArray(items)) return [];
    const categories = ["hanging-piece", "missed-tactic", "calculation", "endgame", "strategy", "opening", "time"];
    return items.filter((item) => categories.includes(item?.category)).map((item) => ({
      id: String(item.id || id()), category: item.category, result: String(item.result || "").slice(0, 30),
      note: String(item.note || "").slice(0, 600), date: validDate(item.date) || new Date().toISOString(),
    })).slice(-100);
  }

  function reconcileUnlocks(state, trail) {
    const trailState = state.trails[trail.id];
    trail.skills.forEach((skill) => {
      const skillState = trailState.skills[skill.id];
      if (skillState.status !== "blocked") return;
      const ready = skill.prerequisites.every((prerequisiteId) => trailState.skills[prerequisiteId]?.status === "consolidated");
      if (ready) skillState.status = "available";
    });
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function due(skillState) {
    return Boolean(skillState.review.nextAt) && new Date(skillState.review.nextAt).getTime() <= endOfToday().getTime();
  }

  function validDate(value) {
    if (typeof value !== "string") return null;
    return Number.isNaN(new Date(value).getTime()) ? null : value;
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback;
  }

  function addDays(days) {
    return new Date(Date.now() + days * DAY_MS).toISOString();
  }

  function endOfToday() {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  }

  window.TrajetoriaContinuousStorage = {
    STORAGE_KEY, APP_VERSION, DAY_MS, VALID_STATUSES, VALID_RESULTS, id,
    createDefaultState, loadState, normalizeState, reconcileUnlocks, saveState, due, addDays,
  };
})();
