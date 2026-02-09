export function qs<T extends Element>(sel: string): T {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el as T;
}

export function setHidden(el: HTMLElement, hidden: boolean): void {
  el.classList.toggle("hidden", hidden);
}
