import { logger } from "./logger";
import { solveCaptcha } from "./govProxy";

const FSP_BASE = "https://fsp.excise.gos.pk";
const ELIGIBILITY_URL = `${FSP_BASE}/Home/bike_subsidies_check_vehicle_eligibility/`;

async function getSessionCookies(): Promise<string> {
  const res = await fetch(`${FSP_BASE}/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const rawCookies = res.headers.getSetCookie?.() ?? [];
  return rawCookies.map((c) => c.split(";")[0]).join("; ");
}

export interface VehicleResult {
  ownerName: string;
  cnic: string;
  regNo: string;
  status: string;
}

export async function searchVehicle(
  cnic: string,
  regNo: string,
  onProgress?: (msg: string) => void
): Promise<VehicleResult> {
  logger.info({ cnic, regNo }, "Vehicle search started");

  onProgress?.("Getting session...");
  const cookies = await getSessionCookies();

  onProgress?.("Solving captcha (30-60 seconds, please wait)...");
  const captchaToken = await solveCaptcha(
    onProgress ? (elapsed: number) => onProgress(`Still solving captcha... (${elapsed}s)`) : undefined
  );

  onProgress?.("Captcha solved! Checking vehicle...");

  const res = await fetch(ELIGIBILITY_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
      "Referer": FSP_BASE + "/",
      "Origin": FSP_BASE,
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "application/json, text/javascript, */*; q=0.01",
    },
    body: new URLSearchParams({
      cnic: cnic.trim(),
      reg_no: regNo.trim().toUpperCase(),
      "g-recaptcha-response": captchaToken,
    }).toString(),
  });

  const data = await res.json() as { status: string; message?: string; owner_name?: string; token_id?: string };
  logger.info({ data }, "Vehicle search response");

  if (data.status === "success" && data.owner_name) {
    return {
      ownerName: data.owner_name,
      cnic: cnic.trim(),
      regNo: regNo.trim().toUpperCase(),
      status: "found",
    };
  }

  if (data.status === "error" || data.status === "warning") {
    const msg = typeof data.message === "string" ? data.message : JSON.stringify(data.message);
    throw new Error(msg || "Vehicle not found");
  }

  throw new Error("Unexpected response from vehicle search");
}
