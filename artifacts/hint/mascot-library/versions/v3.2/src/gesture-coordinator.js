// One admission decision for ordinary scene feedback. There is deliberately no queue.
const priority = id => id === 'reassure' ? 4 : id === 'present-card' ? 3
  : ['welcome', 'welcome-back'].includes(id) ? 1 : 2;
const group = id => ['acknowledge', 'nod', 'celebration'].includes(id) ? 'acknowledge'
  : ['welcome', 'welcome-back'].includes(id) ? 'arrival' : id;
const cooldown = { reassure: 8000, acknowledge: 6000, arrival: 20000 };

export function createGestureCoordinator(now = () => performance.now()) {
  const last = new Map();
  return {
    accept(id, { active = null, requestedAt = now() } = {}) {
      const time = now(), kind = group(id);
      if (!Number.isFinite(requestedAt)) return false;
      if (['acknowledge', 'arrival', 'present-card'].includes(kind) && time - requestedAt > 400) return false;
      if (active && priority(id) <= priority(active)) return false;
      if (time - (last.get(kind) ?? -Infinity) < (cooldown[kind] ?? 0)) return false;
      last.set(kind, time);
      return true;
    },
  };
}
