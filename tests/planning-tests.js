(() => {
  "use strict";
  const P = window.TrajetoriaPlanning;
  const topic = { id: "t1", name: "Tópico", subject: { id: "mat", name: "Matemática" } };
  const baseState = () => ({ topics: { t1: { status: "not-started" } }, study: { settings: { primaryTargetMinutes: 60, secondaryTargetMinutes: 30, breakMinutes: 15 }, sessions: [], breaks: [] }, planning: { examDate: "2026-11-29", startedDay: "2026-08-31", safetyBufferPercent: 10, regularWeekdays: [1,2,3,4,5], topicEfforts: { t1: "normal" } } });
  const tests = [];
  function test(name, callback) { tests.push({ name, callback }); }
  function equal(actual, expected) { if (actual !== expected) throw new Error(`esperado ${expected}, recebido ${actual}`); }
  function session(dayKey, minutes, topicId = "") { return { dayKey, effectiveSeconds: minutes * 60, topicId }; }

  test("29/11/2026 permanece como data local", () => equal(P.localDayKey(P.dateFromDayKey("2026-11-29")), "2026-11-29"));
  test("segunda a sexta até a prova somam 65 dias", () => equal(P.countRegularDays(P.dateFromDayKey("2026-08-31"), P.dateFromDayKey("2026-11-29"), [1,2,3,4,5]), 65));
  test("sábado e domingo são excluídos", () => equal(P.countRegularDays(P.dateFromDayKey("2026-09-05"), P.dateFromDayKey("2026-09-07"), [1,2,3,4,5]), 0));
  test("90 min por dia produzem 5850 min teóricos", () => equal(P.calculate(baseState(), [topic], P.dateFromDayKey("2026-08-31")).theoreticalMinutes, 5850));
  test("margem de 10% produz 5265 min seguros", () => equal(P.calculate(baseState(), [topic], P.dateFromDayKey("2026-08-31")).safeCapacityMinutes, 5265));
  test("saldo é capacidade segura menos carga restante", () => { const r = P.calculate(baseState(), [topic], P.dateFromDayKey("2026-08-31")); equal(r.balanceMinutes, r.safeCapacityMinutes - r.remainingLoadMinutes); });
  test("perder uma segunda reduz 90 min no dia seguinte", () => { const a = P.calculate(baseState(), [topic], P.dateFromDayKey("2026-08-31")); const b = P.calculate(baseState(), [topic], P.dateFromDayKey("2026-09-01")); equal(a.safeCapacityMinutes - b.safeCapacityMinutes, 90); });
  test("dia parcial de 60 min não é zero", () => { const s = baseState(); s.study.sessions.push(session("2026-08-31", 60, "t1")); const r = P.calculate(s, [topic], P.dateFromDayKey("2026-08-31")); equal(r.theoreticalMinutes, 5790); equal(r.safeCapacityMinutes, 5205); equal(r.remainingLoadMinutes, 0); });
  test("estudo extra no sábado reduz carga sem reduzir capacidade", () => { const a = P.calculate(baseState(), [topic], P.dateFromDayKey("2026-09-05")); const s = baseState(); s.study.sessions.push(session("2026-09-05", 30, "t1")); const b = P.calculate(s, [topic], P.dateFromDayKey("2026-09-05")); equal(b.safeCapacityMinutes, a.safeCapacityMinutes); equal(b.remainingLoadMinutes, a.remainingLoadMinutes - 30); });
  test("Base consolidada retira carga e entra na integração", () => { const s = baseState(); s.topics.t1.status = "consolidating"; const r = P.calculate(s, [topic], P.dateFromDayKey("2026-08-31")); equal(r.remainingLoadMinutes, 0); equal(r.integrationQueue.length, 1); equal(r.validated.length, 0); });
  test("Consolidado em prova fica separado", () => { const s = baseState(); s.topics.t1.status = "mastered"; const r = P.calculate(s, [topic], P.dateFromDayKey("2026-08-31")); equal(r.integrationQueue.length, 0); equal(r.validated.length, 1); });
  test("peso grande adiciona 30 min à carga", () => { const a = P.calculate(baseState(), [topic], P.dateFromDayKey("2026-08-31")); const s = baseState(); s.planning.topicEfforts.t1 = "large"; const b = P.calculate(s, [topic], P.dateFromDayKey("2026-08-31")); equal(b.remainingLoadMinutes - a.remainingLoadMinutes, 30); });
  test("tópico acima da estimativa registra diferença", () => { const s = baseState(); s.study.sessions.push(session("2026-08-31", 75, "t1")); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-08-31")).overEstimate[0].variance, 15); });
  test("intervalo nunca entra como estudo", () => { const s = baseState(); s.study.breaks.push({ dayKey: "2026-08-31", actualSeconds: 900 }); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-08-31")).theoreticalMinutes, 5850); });
  test("poucos dados não geram ritmo confiável", () => { const s = baseState(); s.study.sessions.push(session("2026-08-31", 60)); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-08-31")).recent.reliable, false); });
  test("três dias geram ritmo e projeção", () => { const s = baseState(); s.study.sessions.push(session("2026-08-27", 60), session("2026-08-28", 60), session("2026-08-31", 60)); const r = P.calculate(s, [topic], P.dateFromDayKey("2026-08-31")); equal(r.recent.reliable, true); equal(r.recent.weeklyMinutes, 90); if (!r.projectedDate) throw new Error("projeção ausente"); });

  const output = []; let failed = 0;
  tests.forEach(({ name, callback }) => { try { callback(); output.push(`✓ ${name}`); } catch (error) { failed += 1; output.push(`✗ ${name}: ${error.message}`); } });
  output.push(`\n${tests.length - failed}/${tests.length} testes aprovados`);
  document.getElementById("results").textContent = output.join("\n"); document.body.dataset.failed = String(failed);
})();
