import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Live vs demo store for the current async request (same idea as ACE Outsource).
 * Turbopack / hot reload can load this file twice — keep one store on globalThis.
 */
const globalStore = globalThis as unknown as {
  aceFinanceDemoScope?: AsyncLocalStorage<boolean>;
};
const store =
  globalStore.aceFinanceDemoScope ?? new AsyncLocalStorage<boolean>();
globalStore.aceFinanceDemoScope = store;

/** true = demo DB/storage; false/undefined = live */
export function currentDemo(): boolean {
  return store.getStore() === true;
}

export function withDemoScope<T>(demo: boolean, run: () => Promise<T>): Promise<T> {
  return store.run(demo, run);
}

export function withDemoScopeSync<T>(demo: boolean, run: () => T): T {
  return store.run(demo, run);
}

/**
 * Bind live/demo for the rest of this request (Nest interceptor).
 * Prefer this over withDemoScopeSync around Observable.subscribe — that exits too early.
 */
export function enterDemoScope(demo: boolean): void {
  store.enterWith(demo);
}
