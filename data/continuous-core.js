(() => {
  "use strict";

  const trails = [];

  function buildTrail(definition) {
    let previousAnchor = null;
    const stages = definition.stages.map((stageDefinition, stageIndex) => {
      const [id, name, description, skillDefinitions] = stageDefinition;
      const stageAnchor = skillDefinitions[0]?.[0] || null;
      const skills = skillDefinitions.map((entry, skillIndex) => {
        const [skillId, title, objective, mastery, practice, application, why, tags = [], explicitPrerequisites] = entry;
        const prerequisites = explicitPrerequisites || (skillIndex === 0
          ? (previousAnchor ? [previousAnchor] : [])
          : (stageAnchor ? [stageAnchor] : []));
        return {
          id: skillId,
          stageId: id,
          stage: name,
          title,
          objective,
          why: why || objective,
          prerequisites,
          practices: Array.isArray(practice) ? practice : [practice],
          applications: Array.isArray(application) ? application : [application],
          mastery: Array.isArray(mastery) ? mastery : [mastery],
          tags,
          order: skillIndex,
        };
      });
      // A habilidade final costuma integrar a etapa. Ela serve como ponte para a
      // próxima sem exigir uma árvore estritamente linear entre habilidades irmãs.
      previousAnchor = skillDefinitions.at(-1)?.[0] || stageAnchor;
      return { id, name, description, order: stageIndex, skills };
    });
    return { ...definition, stages, skills: stages.flatMap((stage) => stage.skills) };
  }

  function registerTrail(definition) {
    const trail = buildTrail(definition);
    if (trails.some((item) => item.id === trail.id)) throw new Error(`Trilha duplicada: ${trail.id}`);
    trails.push(trail);
    return trail;
  }

  window.TRAJETORIA_CONTINUOUS = {
    version: 1,
    config: {
      pageTitle: "Minha Formação",
      priority: { id: "cefet-coltec", label: "CEFET / COLTEC", description: "Objetivo acadêmico prioritário atual" },
      continuousLabel: "Formação contínua",
      sessionDurations: [10, 20, 40],
      reviewIntervals: [3, 7, 14, 30],
    },
    trails,
    registerTrail,
  };
})();
