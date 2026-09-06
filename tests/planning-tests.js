(() => {
  "use strict";
  const P = window.TrajetoriaPlanning;
  const topic = { id: "t1", name: "Tópico", budgetMinutes: 60, subject: { id: "mat", name: "Matemática" } };
  const baseState = () => ({ topics: { t1: { status: "not-started" } }, study: { settings: {}, sessions: [], breaks: [] }, planning: { startedDay: "2026-09-03", regularWeekdays: [1,2,3,4,5] } });
  const tests = [];
  function test(name, callback) { tests.push({ name, callback }); }
  function equal(actual, expected) { if (actual !== expected) throw new Error(`esperado ${expected}, recebido ${actual}`); }
  function session(dayKey, minutes, extra = {}) { return { dayKey, effectiveSeconds: minutes * 60, ...extra }; }

  test("29/11/2026 permanece como data local", () => equal(P.localDayKey(P.dateFromDayKey("2026-11-29")), "2026-11-29"));
  test("segunda a sexta até a prova somam 65 dias", () => equal(P.countRegularDays(P.dateFromDayKey("2026-08-31"), P.dateFromDayKey("2026-11-29"), [1,2,3,4,5]), 65));
  test("sábado e domingo são excluídos", () => equal(P.countRegularDays(P.dateFromDayKey("2026-09-05"), P.dateFromDayKey("2026-09-07"), [1,2,3,4,5]), 0));
  test("carga restante usa budgetMinutes", () => equal(P.calculate(baseState(), [topic], P.dateFromDayKey("2026-09-04")).remainingLoadMinutes, 60));
  test("base consolidada sai da carga", () => { const s = baseState(); s.topics.t1.status = "consolidating"; equal(P.calculate(s, [topic], P.dateFromDayKey("2026-09-04")).remainingLoadMinutes, 0); });
  test("dia passado com 60 min gera delta de menos 30", () => { const s = baseState(); s.study.sessions.push(session("2026-09-03", 60)); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-09-04")).margin.dailyDeltaMinutes, -30); });
  test("hoje não desconta meta restante", () => { const s = baseState(); s.study.sessions.push(session("2026-09-03", 90), session("2026-09-04", 80)); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-09-04")).margin.dailyDeltaMinutes, 0); });
  test("tópico concluído em 45 min gera mais 15", () => { const s = baseState(); s.topics.t1.status = "consolidating"; s.study.sessions.push(session("2026-09-03", 45, { kind: "base", topicId: "t1" })); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-09-04")).margin.topicDeltaMinutes, 15); });
  test("tópico estudando acima do orçamento gera menos 20", () => { const s = baseState(); s.study.sessions.push(session("2026-09-03", 80, { kind: "base", topicId: "t1" })); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-09-04")).margin.topicDeltaMinutes, -20); });
  test("integração acima da reserva gera overrun", () => { const s = baseState(); s.study.sessions.push(session("2026-09-03", 1500, { kind: "integration" })); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-09-04")).margin.integrationOverrunMinutes, 60); });
  test("simulado não entra na aderência", () => { const s = baseState(); s.study.sessions.push(session("2026-09-03", 180, { kind: "simulation" })); equal(P.calculate(s, [topic], P.dateFromDayKey("2026-09-04")).margin.dailyDeltaMinutes, -90); });
  test("sessão antiga continua regular sem desvio de tópico", () => { const s = baseState(); s.study.sessions.push(session("2026-09-03", 90, { topicId: "t1" })); const result = P.calculate(s, [topic], P.dateFromDayKey("2026-09-04")); equal(result.margin.dailyDeltaMinutes, 0); equal(result.margin.topicDeltaMinutes, 0); });

  const output = []; let failed = 0;
  tests.forEach(({ name, callback }) => { try { callback(); output.push(`✓ ${name}`); } catch (error) { failed += 1; output.push(`✗ ${name}: ${error.message}`); } });
  output.push(`\n${tests.length - failed}/${tests.length} testes aprovados`);
  document.getElementById("results").textContent = output.join("\n"); document.body.dataset.failed = String(failed);
})();
