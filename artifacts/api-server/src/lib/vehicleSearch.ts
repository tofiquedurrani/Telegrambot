import { logger } from "./logger";

const BASE_URL = "https://www.excise.gos.pk/vehicle/vehicle_search";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  "Referer": BASE_URL,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function getCsrfToken(): Promise<{ token: string; cookies: string }> {
  const res = await fetch(BASE_URL, { headers: HEADERS, redirect: "follow" });
  const rawCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = rawCookies.map((c) => c.split(";")[0]).join("; ");
  const html = await res.text();

  const metaMatch = html.match(/<meta name="csrf-token" content="([^"]+)"/);
  if (metaMatch) return { token: metaMatch[1], cookies };

  const inputMatch = html.match(/<input[^>]+name="_token"[^>]+value="([^"]+)"/);
  if (inputMatch) return { token: inputMatch[1], cookies };

  throw new Error("Could not connect to vehicle search. Try again later.");
}

function parseVehicleTable(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
    }
    if (cells.length >= 2 && cells[0] && cells[1]) {
      result[cells[0]] = cells[1];
    }
  }
  return result;
}

export async function searchVehicle(regNo: string): Promise<Record<string, string>> {
  logger.info({ regNo }, "Searching vehicle");

  const { token, cookies } = await getCsrfToken();

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
    },
    body: new URLSearchParams({
      _token: token,
      registration_no: regNo.trim().toUpperCase(),
    }).toString(),
  });

  const html = await res.text();

  if (
    html.toLowerCase().includes("no record") ||
    html.toLowerCase().includes("not found") ||
    html.toLowerCase().includes("invalid")
  ) {
    throw new Error("No vehicle found for: " + regNo.toUpperCase());
  }

  const data = parseVehicleTable(html);

  if (Object.keys(data).length === 0) {
    throw new Error("No details found. Check registration number and try again.");
  }

  return data;
}
