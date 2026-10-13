// Простая шина событий.
type Handler = (...args: any[]) => void;

class EventBus {
  private map = new Map<string, Set<Handler>>();

  on(name: string, fn: Handler): () => void {
    let set = this.map.get(name);
    if (!set) this.map.set(name, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(name: string, ...args: any[]): void {
    const set = this.map.get(name);
    if (!set) return;
    for (const fn of [...set]) fn(...args);
  }
}

export const bus = new EventBus();
