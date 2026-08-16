(() => {
  "use strict";

  const PROJECT_URL = "https://gfniufjoriqppyvnxfnb.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_bozZmis5d5v_fQclT3JvHQ__ThY3sfm";
  const REVISION_KEY = "trajetoria-cloud-revisions-v1";
  const SAVE_DELAY = 900;
  const AUTH_TIMEOUT = 20_000;

  function create(options) {
    const client = window.supabase?.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        lock: async (_name, _acquireTimeout, callback) => callback(),
      },
    });
    let session = null;
    let saveTimer = null;
    let saving = false;
    let synchronizing = false;
    let pendingState = null;

    function notify(status, detail = "") {
      options.onStatus?.({ status, detail, user: session?.user || null });
    }

    async function initialize() {
      if (!client) return notify("error", "Sincronização indisponível neste navegador.");
      notify("loading", "Verificando sua conta…");
      const { data, error } = await client.auth.getSession();
      if (error) notify("error", friendlyError(error));
      session = data?.session || null;
      updateAuthUI();
      client.auth.onAuthStateChange((event, nextSession) => {
        session = nextSession;
        updateAuthUI();
        if (event === "SIGNED_IN" && session) setTimeout(() => synchronize(), 0);
      });
      if (session) await synchronize();
      else notify("signed-out", "Entre para sincronizar entre dispositivos.");
    }

    async function signIn(email) {
      notify("loading", "Enviando link de acesso…");
      try {
        const { error } = await withTimeout(client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}${location.pathname}`, shouldCreateUser: true },
        }), AUTH_TIMEOUT);
        if (error) throw error;
        notify("email-sent", "Link enviado. Abra seu e-mail neste dispositivo.");
      } catch (error) {
        const message = friendlyError(error);
        notify("error", message);
        throw new Error(message);
      }
    }

    async function signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(friendlyError(error));
      session = null;
      updateAuthUI();
      notify("signed-out", "Você saiu. Os dados continuam salvos neste navegador.");
    }

    function queueSave(nextState) {
      if (!session) return;
      pendingState = clone(nextState);
      clearTimeout(saveTimer);
      notify(navigator.onLine ? "pending" : "offline", navigator.onLine ? "Alterações aguardando envio…" : "Salvo neste dispositivo; enviaremos ao reconectar.");
      saveTimer = setTimeout(flush, SAVE_DELAY);
    }

    async function flush() {
      if (!session || saving || !pendingState || !navigator.onLine) return;
      if (synchronizing) {
        saveTimer = setTimeout(flush, SAVE_DELAY);
        return;
      }
      const nextState = pendingState;
      pendingState = null;
      saving = true;
      notify("saving", "Sincronizando…");
      try {
        await pushState(nextState);
        notify("synced", `Sincronizado agora · ${session.user.email}`);
      } catch (error) {
        pendingState = nextState;
        notify("error", friendlyError(error));
      } finally {
        saving = false;
        if (pendingState && navigator.onLine) saveTimer = setTimeout(flush, SAVE_DELAY);
      }
    }

    async function synchronize() {
      if (!session || !navigator.onLine) return notify("offline", "Sem internet; usando os dados deste dispositivo.");
      if (saving || synchronizing) return;
      synchronizing = true;
      notify("loading", "Buscando seus dados…");
      try {
        const remote = await fetchRow();
        const local = options.getState();
        if (!remote) {
          await insertRow(local);
          return notify("synced", `Primeira sincronização concluída · ${session.user.email}`);
        }
        const knownRevision = getRevision(session.user.id);
        const merged = options.mergeStates(local, remote.data, { firstSync: !knownRevision });
        if (!statesEqual(local, merged)) options.applyState(merged);
        if (!statesEqual(remote.data, merged)) {
          await updateRow(merged, remote.revision);
        } else {
          setRevision(session.user.id, remote.revision);
        }
        notify("synced", `Sincronizado agora · ${session.user.email}`);
      } catch (error) {
        notify("error", friendlyError(error));
      } finally {
        synchronizing = false;
        if (pendingState && navigator.onLine) saveTimer = setTimeout(flush, SAVE_DELAY);
      }
    }

    async function pushState(local) {
      const remote = await fetchRow();
      if (!remote) return insertRow(local);
      const knownRevision = getRevision(session.user.id);
      const latestLocal = options.getState();
      const localWithPending = options.mergeStates(latestLocal, local, { firstSync: false });
      const data = options.mergeStates(localWithPending, remote.data, { firstSync: !knownRevision });
      if (!statesEqual(data, latestLocal)) options.applyState(data);
      if (statesEqual(data, remote.data)) {
        setRevision(session.user.id, remote.revision);
        return;
      }
      return updateRow(data, remote.revision);
    }

    async function fetchRow() {
      const { data, error } = await client.from("study_progress").select("data, revision, updated_at").eq("user_id", session.user.id).maybeSingle();
      if (error) throw error;
      return data;
    }

    async function insertRow(data) {
      const { error } = await client.from("study_progress").insert({ user_id: session.user.id, data, revision: 1, updated_at: new Date().toISOString() });
      if (error) {
        if (error.code === "23505") {
          const remote = await fetchRow();
          if (!remote) throw error;
          const local = options.getState();
          const merged = options.mergeStates(local, remote.data, { firstSync: !getRevision(session.user.id) });
          if (!statesEqual(local, merged)) options.applyState(merged);
          if (!statesEqual(remote.data, merged)) return updateRow(merged, remote.revision);
          setRevision(session.user.id, remote.revision);
          return;
        }
        throw error;
      }
      setRevision(session.user.id, 1);
    }

    async function updateRow(data, revision) {
      const nextRevision = Number(revision) + 1;
      const { data: updated, error } = await client.from("study_progress")
        .update({ data, revision: nextRevision, updated_at: new Date().toISOString() })
        .eq("user_id", session.user.id).eq("revision", revision).select("revision").maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("Os dados mudaram em outro dispositivo. Tente sincronizar novamente.");
      setRevision(session.user.id, updated.revision);
    }

    function updateAuthUI() { options.onAuth?.(session?.user || null); }
    window.addEventListener("online", () => pendingState ? flush() : synchronize());
    window.addEventListener("offline", () => notify("offline", "Sem internet; alterações salvas neste dispositivo."));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || !session) return;
      pendingState ? flush() : synchronize();
    });
    return { initialize, signIn, signOut, synchronize, queueSave, flush };
  }

  function getRevision(userId) {
    try { return Number(JSON.parse(localStorage.getItem(REVISION_KEY) || "{}")[userId]) || 0; } catch { return 0; }
  }
  function setRevision(userId, revision) {
    let revisions = {};
    try { revisions = JSON.parse(localStorage.getItem(REVISION_KEY) || "{}"); } catch { /* vazio */ }
    revisions[userId] = Number(revision);
    localStorage.setItem(REVISION_KEY, JSON.stringify(revisions));
  }
  function clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  function statesEqual(first, second) { return JSON.stringify(first) === JSON.stringify(second); }
  function withTimeout(promise, milliseconds) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Tempo esgotado ao contatar o Supabase.")), milliseconds)),
    ]);
  }
  function friendlyError(error) {
    const message = String(error?.message || error || "Falha desconhecida.");
    if (message.includes("study_progress") || message.includes("schema cache")) return "A tabela study_progress ainda não foi criada no Supabase.";
    if (message.includes("Failed to fetch") || message.includes("NetworkError")) return "Não foi possível conectar ao Supabase. Verifique sua internet.";
    if (message.includes("rate limit") || message.includes("seconds")) return "Aguarde um pouco antes de solicitar outro link.";
    if (message.includes("Tempo esgotado")) return "O celular não conseguiu contatar o Supabase. Troque entre Wi-Fi e dados móveis e tente novamente.";
    return message;
  }
  window.TrajetoriaCloud = { create };
})();
