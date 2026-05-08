interface SingleInstanceAppLike {
  requestSingleInstanceLock(): boolean;
  quit(): void;
  on(event: 'second-instance', listener: () => void): void;
}

export function setupSingleInstanceGuard(
  app: SingleInstanceAppLike,
  handleSecondInstance: () => void,
): boolean {
  const acquired = app.requestSingleInstanceLock();
  if (!acquired) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    handleSecondInstance();
  });

  return true;
}
