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
  const segmented = S.normalizeState({ version: 3, topics: {}, study: { settings: {}, sessions: [{ id: "segmented", dayKey: "2026-09-01", effectiveSeconds: 120, kind: "base", segments: [{ topicId: "fracoes", effectiveSeconds: 60 }, { topicId: "razao", effectiveSeconds: 60 }], status: "completed", createdAt: "2026-09-01T12:00:00Z" }] } });
  check("sessão segmentada preserva os dois tópicos", segmented.study.sessions[0]?.segments.length === 2);
  const simulation = S.normalizeState({ version: 3, topics: {}, simulations: [{ id: "sim", simulationId: "sim-1", result: { "Português": 99, "Ciências": 7 }, status: "completed" }] });
  check("resultado de simulado respeita limites", simulation.simulations[0]?.result["Português"] === 15 && simulation.simulations[0]?.result["Ciências"] === 7);
  const deviceA = S.normalizeState({ version: 3, topics: {}, study: { sessions: [{ id: "session-a", dayKey: "2026-09-02", effectiveSeconds: 60, createdAt: "2026-09-02T10:00:00Z", futureField: "A" }] } });
  const deviceB = S.normalizeState({ version: 3, topics: {}, study: { sessions: [{ id: "session-b", dayKey: "2026-09-02", effectiveSeconds: 90, createdAt: "2026-09-02T11:00:00Z", futureField: "B" }] } });
  const mergedDevices = S.mergeStates(deviceA, deviceB);
  check("merge preserva sessões distintas entre dispositivos", mergedDevices.study.sessions.some((session) => session.id === "session-a") && mergedDevices.study.sessions.some((session) => session.id === "session-b"));
  const unknownMerged = S.mergeStates(S.normalizeState({ version: 3, topics: {}, futureRoot: "kept" }), S.normalizeState({ version: 3, topics: {} }));
  check("merge preserva campos desconhecidos", unknownMerged.futureRoot === "kept");
  const oldBackup = S.normalizeState({ app: "trajetoria", version: 2, topics: {}, activities: [] });
  check("backup antigo recebe defaults novos", Array.isArray(oldBackup.simulations) && Array.isArray(oldBackup.study.sessions));
  const newBackup = S.normalizeState({ version: 3, topics: {}, simulations: [{ id: "new", simulationId: "sim-2", status: "reviewed" }], study: { sessions: [{ id: "new-session", kind: "base", segments: [{ topicId: "fracoes", effectiveSeconds: 30 }], createdAt: "2026-09-03T10:00:00Z" }] } });
  check("backup novo preserva sessões e simulados", newBackup.study.sessions[0]?.segments.length === 1 && newBackup.simulations[0]?.simulationId === "sim-2");
  const repaired = S.normalizeState({ version: 3, topics: { fatoracao: { status: "not-started" }, "his-o-que-e": { status: "not-started" } } });
  check("reparo histórico restaura estados conhecidos", S.repairHistoricalTopicStatuses(repaired) && repaired.topics.fatoracao.status === "consolidating" && repaired.topics["his-o-que-e"].status === "mastered");
  const preserved = S.normalizeState({ version: 3, topics: { fatoracao: { status: "studying" }, potenciacao: { status: "studying" }, radiciacao: { status: "studying" }, "expressoes-polinomios": { status: "studying" }, inequacoes: { status: "studying" }, "cie-materia-corpo-objeto": { status: "studying" }, "cie-estados-fisicos": { status: "studying" }, "his-o-que-e": { status: "studying" }, "his-fontes": { status: "studying" }, "his-tempo": { status: "studying" }, "his-pre-historia": { status: "studying" }, "his-mesopotamia": { status: "studying" } } });
  check("reparo histórico não sobrescreve estado atual", !S.repairHistoricalTopicStatuses(preserved) && preserved.topics.fatoracao.status === "studying");
  const academicWithContinuous = S.mergeStates(
    S.normalizeState({ version: 3, topics: {}, study: { sessions: [{ id: "academic", kind: "base", createdAt: "2026-09-04T10:00:00Z" }] } }),
    S.normalizeState({ version: 3, topics: {}, continuousData: { trails: { violao: { checkIns: ["2026-09-04"] } } } }),
  );
  check("merge acadêmico não descarta continuousData desconhecido", academicWithContinuous.continuousData?.trails?.violao?.checkIns?.[0] === "2026-09-04");
  const local = S.createDefaultState(); const remote = S.createDefaultState();
  local.planning.updatedAt = "2026-08-30T12:00:00Z"; remote.planning.updatedAt = "2026-08-31T12:00:00Z"; remote.planning.topicEfforts.fracoes = "large";
  check("merge usa planejamento mais recente", S.mergeStates(local, remote).planning.topicEfforts.fracoes === "large");
  check("Formação acadêmica mantém todos os tópicos", Object.keys(oldState.topics).length === S.allTopics.length);
  const failed = tests.filter((test) => !test.condition);
  document.getElementById("results").textContent = `${tests.map((test) => `${test.condition ? "✓" : "✗"} ${test.name}`).join("\n")}\n\n${tests.length - failed.length}/${tests.length} testes aprovados`;
  document.body.dataset.failed = String(failed.length);
})();
