(() => {
  "use strict";
  const S = window.TrajetoriaStorage;
  const tests = [];
  function check(name, condition) { tests.push({ name, condition }); }
  const oldState = S.normalizeState({ version: 3, topics: {}, study: { settings: {}, sessions: [{ id: "old", routineId: "r", dayKey: "2026-08-30", slot: 1, subjectId: "matematica", subjectName: "Matemática", effectiveSeconds: 600, status: "completed", createdAt: "2026-08-30T12:00:00Z" }] } });
  check("estado antigo recebe planejamento", oldState.planning.examDate === "2026-11-29");
  check("sessão antiga sem tópico continua válida", oldState.study.sessions[0]?.id === "old" && oldState.study.sessions[0].topicId === "");
  const withTopic = S.normalizeState({ version: 3, topics: {}, study: { settings: {}, sessions: [{ id: "new", routineId: "r2", dayKey: "2026-08-31", slot: 1, subjectId: "matematica", subjectName: "Matemática", topicId: "fracoes", topicName: "Frações", effectiveSeconds: 1200, status: "completed", createdAt: "2026-08-31T12:00:00Z" }] } });
  check("sessão nova preserva tópico", withTopic.study.sessions[0]?.topicId === "fracoes");
  const local = S.createDefaultState(); const remote = S.createDefaultState();
  local.planning.updatedAt = "2026-08-30T12:00:00Z"; remote.planning.updatedAt = "2026-08-31T12:00:00Z"; remote.planning.topicEfforts.fracoes = "large";
  check("merge usa planejamento mais recente", S.mergeStates(local, remote).planning.topicEfforts.fracoes === "large");
  check("Formação acadêmica mantém todos os tópicos", Object.keys(oldState.topics).length === S.allTopics.length);
  const failed = tests.filter((test) => !test.condition);
  document.getElementById("results").textContent = `${tests.map((test) => `${test.condition ? "✓" : "✗"} ${test.name}`).join("\n")}\n\n${tests.length - failed.length}/${tests.length} testes aprovados`;
  document.body.dataset.failed = String(failed.length);
})();
