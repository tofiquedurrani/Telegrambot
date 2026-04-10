interface PendingCaptcha {
  resolve: (token: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingCaptcha>();

const TIMEOUT_MS = 10 * 60 * 1000;

export function waitForCaptcha(id: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Captcha solve timed out (10 minutes). Send /start to try again."));
    }, TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });
  });
}

export function submitCaptchaToken(id: string, token: string): boolean {
  const entry = pending.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(id);
  entry.resolve(token);
  return true;
}

export function cancelCaptcha(id: string): void {
  const entry = pending.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(id);
  entry.reject(new Error("Captcha cancelled."));
}
