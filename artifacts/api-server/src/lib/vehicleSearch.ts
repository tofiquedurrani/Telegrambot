import { logger } from "./logger";

const SEARCH_URL = "https://excise.gos.pk/vehicle/vehicle_search";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
};

async function getPageToken(): Promise<{ token: string; cookies: string }> {
  const res = await fetch(SEARCH_URL, {
    headers: HEADERS,
    redirect: "follow",
  });

  logger.info({ status: res.status }, "Vehicle search page loaded");

  const rawCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = rawCookies.map((c) => c.split(";")[0]).join("; ");
  const html = await res.text();

  logger.info({ htmlLen: html.length, preview: html.slice(0, 200) }, "Page HTML preview");

  const patterns = [
    /<meta name="csrf-token" content="([^"]+)"/,
    /<meta name='csrf-token' content='([^']+)'/,
    /name=['"_]token['"]\s+value="([^"]+)"/,
    /name=['"_]token['"]\s+value='([^']+)'/,
    /"_token"\s*:\s*"([^"]+)"/,
    /csrf_token['"]\s*:\s*['"]([^'"]+)['"]/,
    /<input[^>]+name="_token"[^>]+value="([^"]+)"/,
    /<input[^>]+value="([^"]+)"[^>]+name="_token"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      logger.info("CSRF token found");
      return { token: match[1], cookies };
    }
  }

  logger.warn({ htmlPreview: html.slice(0, 500) }, "CSRF token not found in page");
  throw new Error(`Could not load search page (status ${res.status}). The site may be temporarily unavailable.`);
}

function parseVehicleDetails(html: string): Record<string, string> {
  const result: Record<string, string> = {};

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const val = cellMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      if (val) cells.push(val);
    }
    if (cells.length >= 2 && cells[0]) {
      result[cells[0]] = cells[1] || "";
    }
  }

  const dtRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let dtMatch;
  while ((dtMatch = dtRegex.exec(html)) !== null) {
    const key = dtMatch[1].replace(/<[^>]*>/g, "").trim();
    const val = dtMatch[2].replace(/<[^>]*>/g, "").trim();
    if (key && val) result[key] = val;
  }

  return result;
}

export async function searchVehicle(
  regNo: string,
  onProgress?: (msg: string) => void
): Promise<Record<string, string>> {
  logger.info({ regNo }, "Vehicle search started");

  onProgress?.("Connecting to vehicle database...");
  const { token, cookies } = await getPageToken();

  onProgress?.("Searching vehicle details...");

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
      "Referer": SEARCH_URL,
      "Origin": "https://excise.gos.pk",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({
      _token: token,
      registration_no: regNo.trim().toUpperCase(),
    }).toString(),
  });

  logger.info({ status: res.status }, "Vehicle search POST response");
  const html = await res.text();
  logger.info({ htmlLen: html.length, preview: html.slice(0, 300) }, "Vehicle search result preview");

  const lower = html.toLowerCase();
  if (
    lower.includes("no record") ||
    lower.includes("not found") ||
    lower.includes("invalid registration") ||
    lower.includes("no vehicle")
  ) {
    throw new Error(`No vehicle found for registration: ${regNo.toUpperCase()}`);
  }

  const data = parseVehicleDetails(html);

  if (Object.keys(data).length === 0) {
    logger.warn({ htmlPreview: html.slice(0, 500) }, "No data parsed from response");
    throw new Error("No vehicle details found. Please check the registration number and try again.");
  }

  return data;
}
