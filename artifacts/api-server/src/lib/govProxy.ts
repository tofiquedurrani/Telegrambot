import { logger } from "./logger";

const GOV_BASE = "https://fsp.excise.gos.pk";

interface SessionData {
  cookies: string;
  requestId?: string;
  createdAt: number;
}

const sessions = new Map<string, SessionData>();

function makeSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function prepareGovSession(): Promise<string> {
  const res = await fetch(`${GOV_BASE}/home/bike_subsidies`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  const rawCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = rawCookies
    .map((c) => c.split(";")[0])
    .join("; ");

  logger.info({ status: res.status }, "Got government site session");
  return cookies;
}

async function govPost(
  path: string,
  cookies: string,
  body: Record<string, string>
): Promise<unknown> {
  const formBody = new URLSearchParams(body).toString();

  const res = await fetch(`${GOV_BASE}/Home/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `${GOV_BASE}/home/bike_subsidies`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      "Cookie": cookies,
    },
    body: formBody,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: "error", message: text };
  }
}

export async function startRegistration(
  cnic: string,
  regNo: string,
  captchaToken: string,
  govCookies: string
): Promise<{ sessionId: string }> {
  const result = await govPost("bike_subsidies_check_vehicle_eligibility", govCookies, {
    cnic,
    reg_no: regNo,
    "g-recaptcha-response": captchaToken,
  }) as { status: string; message: string; token_id?: string };

  logger.info({ result }, "Eligibility check result");

  if (result.status !== "success") {
    throw new Error(result.message || "Eligibility check failed");
  }

  const sessionId = makeSessionId();
  sessions.set(sessionId, {
    cookies: govCookies,
    requestId: result.token_id,
    createdAt: Date.now(),
  });

  return { sessionId };
}

export async function sendOtp(sessionId: string, mobile: string): Promise<{ timer?: number }> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found. Please restart registration.");

  const result = await govPost("bike_subsidies_get_otp", session.cookies, {
    mobile,
  }) as { status: string; message: string; token_expire_time?: number };

  logger.info({ result }, "Send OTP result");

  if (result.status !== "success") {
    throw new Error(result.message || "Failed to send OTP");
  }

  return { timer: result.token_expire_time };
}

export async function verifyOtp(sessionId: string, otp: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found. Please restart registration.");

  const body: Record<string, string> = { otp };
  if (session.requestId) body.request_id = session.requestId;

  const result = await govPost("bike_subsidies_verify_token", session.cookies, body) as {
    status: string;
    message: string;
  };

  logger.info({ result }, "OTP verify result");

  if (result.status !== "success") {
    throw new Error(result.message || "OTP verification failed");
  }
}

export async function finalizeRegistration(sessionId: string, iban: string): Promise<{ message: string }> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found. Please restart registration.");

  const body: Record<string, string> = { iban };
  if (session.requestId) body.request_id = session.requestId;

  const result = await govPost("bike_subsidies_finalize", session.cookies, body) as {
    status: string;
    message: string;
  };

  logger.info({ result }, "Finalize registration result");

  if (result.status !== "success") {
    throw new Error(result.message || "Registration finalization failed");
  }

  sessions.delete(sessionId);
  return { message: result.message };
}
