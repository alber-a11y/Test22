// Общая защита страницы: без ПКМ/контекстного меню, выделения, зума и прокрутки.
export function installPageProtection(): void {
  const prevent = (e: Event) => e.preventDefault();
  document.addEventListener('contextmenu', prevent);
  document.addEventListener('selectstart', prevent);
  document.addEventListener('dragstart', prevent);
  document.addEventListener('gesturestart', prevent as EventListener);
  document.addEventListener('gesturechange', prevent as EventListener);
  // Блокируем средний/правый клик мыши.
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) e.preventDefault();
  });
  document.addEventListener('auxclick', prevent);
  // Двойной тап (зум на iOS).
  let lastTouch = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = performance.now();
      if (now - lastTouch < 300) e.preventDefault();
      lastTouch = now;
    },
    { passive: false },
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      // Разрешаем прокрутку только внутри помеченных контейнеров.
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.('.scrollable')) e.preventDefault();
    },
    { passive: false },
  );
  // Ctrl+колесо и Ctrl +/- (зум страницы).
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
    // Игровые клавиши не должны прокручивать страницу.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
}
