export function logButtonPress(screen: string, button: string, meta?: Record<string, unknown>): void {
  const payload = {
    event: 'button_click',
    screen,
    button,
    timestamp: new Date().toISOString(),
    ...(meta ?? {}),
  };

  console.log('[ButtonClick]', JSON.stringify(payload));
}
