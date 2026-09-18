export function scrollable(node: HTMLElement): { destroy: () => void } {
  const update = (): void => {
    node.tabIndex =
      node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight ? 0 : -1;
  };
  const resize = new ResizeObserver(update);
  const observeChildren = (): void => {
    for (const child of node.children) resize.observe(child);
  };
  const mutation = new MutationObserver(() => {
    observeChildren();
    update();
  });
  resize.observe(node);
  observeChildren();
  mutation.observe(node, { childList: true, subtree: true });
  update();
  return {
    destroy: () => {
      resize.disconnect();
      mutation.disconnect();
    },
  };
}
