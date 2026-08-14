(() => {
  function createFocusCoordinator() {
    let incumbent = null;
    let challenger = null;

    function resetChallenger() {
      challenger = null;
    }

    function accept(target, now) {
      incumbent = target ? { ...target, acceptedAt: now } : null;
      challenger = null;
      return { action: target ? "commit" : "clear", target };
    }

    function observe(target, { now, delay, explicit = false } = {}) {
      if (!target?.surface) {
        resetChallenger();
        return { action: incumbent ? "hold" : "none", target: incumbent };
      }
      if (explicit) return accept(target, now);
      if (
        incumbent?.surface === target.surface &&
        incumbent.mode === target.mode
      ) {
        resetChallenger();
        return { action: "hold", target: incumbent };
      }
      if (
        challenger?.surface !== target.surface ||
        challenger?.mode !== target.mode
      ) {
        challenger = { ...target, since: now };
        return { action: "wait", remaining: delay, target: challenger };
      }
      const remaining = Math.max(0, delay - (now - challenger.since));
      if (remaining > 0)
        return { action: "wait", remaining, target: challenger };
      return accept(target, now);
    }

    function sync(target, now = Date.now()) {
      incumbent = target?.surface ? { ...target, acceptedAt: now } : null;
      challenger = null;
    }

    function suspend() {
      challenger = null;
      return { action: "suspend", target: incumbent };
    }

    function clear() {
      incumbent = null;
      challenger = null;
    }

    function snapshot() {
      return { incumbent, challenger };
    }

    return Object.freeze({
      observe,
      sync,
      suspend,
      resetChallenger,
      clear,
      snapshot,
    });
  }

  globalThis.UMBRA_CREATE_FOCUS_COORDINATOR = createFocusCoordinator;
})();
