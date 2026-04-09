import { logger } from "./logger";

const GOV_BASE = "https://fsp.excise.gos.pk";
const RECAPTCHA_SITE_KEY = "6LczdnQsAAAAAK2YNjS9L6upyt4ng1cQiYzqXU24";
const TWO_CAPTCHA_KEY = process.env.TWO_CAPTCHA_API_KEY;

interface SessionData {
  cookies: string;
  requestId?: string;
  createdAt: number;
}

const sessions = new Map<string, SessionData>();

function makeSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function getGovSession(): Promise<string> {
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

async function solveCaptcha(): Promise<string> {
  if (!TWO_CAPTCHA_KEY) throw new Error("TWO_CAPTCHA_API_KEY is not set");

  logger.info("Submitting captcha to 2captcha...");

  const submitRes = await fetch(
    `https://2captcha.com/in.php?key=${TWO_CAPTCHA_KEY}&method=userrecaptcha&googlekey=${RECAPTCHA_SITE_KEY}&pageurl=${GOV_BASE}/home/bike_subsidies&json=1`
  );
  const submitData = await submitRes.json() as { status: number; request: string };

  if (submitData.status !== 1) {
    throw new Error(`2captcha submission failed: ${submitData.request}`);
  }

  const captchaId = submitData.request;
  logger.info({ captchaId }, "Captcha submitted, waiting for solution...");

  for (let attempt = 0; attempt < 24; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));

    const resultRes = await fetch(
      `https://2captcha.com/res.php?key=${TWO_CAPTCHA_KEY}&action=get&id=${captchaId}&json=1`
    );
    const resultData = await resultRes.json() as { status: number; request: string };

    if (resultData.status === 1) {
      logger.info("Captcha solved successfully");
      return resultData.request;
    }

    if (resultData.request !== "CAPCHA_NOT_READY") {
      throw new Error(`2captcha error: ${resultData.request}`);
    }

    logger.info({ attempt }, "Captcha not ready yet, retrying...");
  }

  throw new Error("Captcha solving timed out after 2 minutes");
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

export async function startRegistration(cnic: string, regNo: string): Promise<{ sessionId: string }> {
  const cookies = await getGovSession();
  const captchaToken = await solveCaptcha();

  const result = await govPost("bike_subsidies_check_vehicle_eligibility", cookies, {
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
    cookies,
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
    token_expire_time?: number;
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
