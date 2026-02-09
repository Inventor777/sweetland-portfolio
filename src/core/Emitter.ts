export type Unsub = () => void;

export class Emitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<(payload: any) => void>>();

  on<K extends keyof T>(event: K, fn: (payload: T[K]) => void): Unsub {
    const set = this.listeners.get(event) ?? new Set();
    set.add(fn as any);
    this.listeners.set(event, set);
    return () => set.delete(fn as any);
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) fn(payload);
  }
}
