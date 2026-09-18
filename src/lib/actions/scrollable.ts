export function scrollable(node: HTMLElement): { destroy: () => void } {
  const update = (): void => {
    node.tabIndex =
      node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight ? 0 : -1;
  };
  const observer = new ResizeObserver(update);
  observer.observe(node);
  for (const child of node.children) observer.observe(child);
  update();
  return { destroy: () => observer.disconnect() };
}
