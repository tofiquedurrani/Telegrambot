import TelegramBot from "node-telegram-bot-api";
import { logger } from "./logger";
import fs from "fs";
import path from "path";
import {
  startRegistration,
  sendOtp,
  verifyOtp,
  finalizeRegistration,
} from "./govProxy";
import { searchVehicle } from "./vehicleSearch";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID);

if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");
if (!ADMIN_ID) throw new Error("ADMIN_TELEGRAM_ID is not set");

const PAID_FILE = path.resolve("./paid_users.json");

function loadPaidUsers(): Set<number> {
  try {
    if (fs.existsSync(PAID_FILE)) {
      const data = JSON.parse(fs.readFileSync(PAID_FILE, "utf-8"));
      return new Set(data);
    }
  } catch {}
  return new Set();
}

function savePaidUsers(set: Set<number>) {
  fs.writeFileSync(PAID_FILE, JSON.stringify([...set]));
}

const paidUsers = loadPaidUsers();

function isApproved(chatId: number): boolean {
  return paidUsers.has(chatId);
}

function approveUser(chatId: number) {
  paidUsers.add(chatId);
  savePaidUsers(paidUsers);
}

const USED_FREE_FILE = path.resolve("./used_free.json");

function loadUsedFree(): Set<number> {
  try {
    if (fs.existsSync(USED_FREE_FILE)) {
      const data = JSON.parse(fs.readFileSync(USED_FREE_FILE, "utf-8"));
      return new Set(data);
    }
  } catch {}
  return new Set();
}

function saveUsedFree(set: Set<number>) {
  fs.writeFileSync(USED_FREE_FILE, JSON.stringify([...set]));
}

const usedFree = loadUsedFree();

function hasUsedFree(chatId: number): boolean {
  return usedFree.has(chatId);
}

function markUsedFree(chatId: number) {
  usedFree.add(chatId);
  saveUsedFree(usedFree);
}

interface UserState {
  step:
    | "idle"
    | "await_cnic"
    | "await_reg_no"
    | "await_name"
    | "await_mobile"
    | "await_iban"
    | "confirm"
    | "processing"
    | "await_otp"
    | "done"
    | "vehicle_await_reg";
  cnic?: string;
  regNo?: string;
  name?: string;
  mobile?: string;
  iban?: string;
  sessionId?: string;
  vehicleType?: string;
}

const states = new Map<number, UserState>();

function getState(chatId: number): UserState {
  if (!states.has(chatId)) states.set(chatId, { step: "idle" });
  return states.get(chatId)!;
}

function setState(chatId: number, update: Partial<UserState>) {
  states.set(chatId, { ...getState(chatId), ...update });
}

function formatCNIC(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

function isValidCNIC(val: string): boolean {
  return /^\d{5}-\d{7}-\d$/.test(val);
}

function isValidMobile(val: string): boolean {
  const clean = val.replace(/\D/g, "");
  return clean.length === 11 && clean.startsWith("03");
}

function normalizeIBAN(val: string): string {
  let clean = val.replace(/\s/g, "").toUpperCase();
  if (clean.startsWith("PKPK")) clean = clean.slice(2);
  if (!clean.startsWith("PK")) clean = "PK" + clean;
  return clean;
}

function isValidIBAN(val: string): boolean {
  return /^PK[A-Z0-9]{22}$/.test(val);
}

export function startTelegramBot() {
  const bot = new TelegramBot(TOKEN!, { polling: true });
  logger.info("Telegram bot started with polling");

  bot.onText(/\/bike/, async (msg) => {
    const chatId = msg.chat.id;
    setState(chatId, { step: "vehicle_await_reg", vehicleType: "bike" });
    await bot.sendMessage(chatId, "Send bike registration number:\nExample: NFH-3057 or KHI-123");
  });

  bot.onText(/\/car/, async (msg) => {
    const chatId = msg.chat.id;
    setState(chatId, { step: "vehicle_await_reg", vehicleType: "car" });
    await bot.sendMessage(chatId, "Send car registration number:\nExample: KHI-AB-1234 or LHR-5678");
  });

  bot.onText(/\/approve (.+)/, async (msg, match) => {
    if (msg.chat.id !== ADMIN_ID) return;
    const targetId = Number(match![1].trim());
    if (isNaN(targetId)) {
      await bot.sendMessage(ADMIN_ID, "Invalid ID. Usage: /approve 123456789");
      return;
    }
    approveUser(targetId);
    await bot.sendMessage(ADMIN_ID, `OK! User ${targetId} approved.`);
    await bot.sendMessage(targetId, "Payment confirmed! Send /start to register again.").catch(() => {});
  });

  bot.onText(/\/stats/, async (msg) => {
    if (msg.chat.id !== ADMIN_ID) return;
    await bot.sendMessage(
      ADMIN_ID,
      `Stats:\nFree used: ${usedFree.size}\nPaid users: ${paidUsers.size}`
    );
  });

  bot.onText(/\/myid/, async (msg) => {
    await bot.sendMessage(msg.chat.id, `Your Telegram ID: ${msg.chat.id}`);
  });

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    if (hasUsedFree(chatId) && !isApproved(chatId)) {
      await bot.sendMessage(
        chatId,
        `You have used your FREE registration.\n\n` +
          `To register again, please pay Rs 150:\n\n` +
          `Easypaisa / JazzCash:\n` +
          `Number: 03063076001\n` +
          `Name: Tofique Ahmed\n\n` +
          `After payment send screenshot on WhatsApp: 03063076001\n\n` +
          `Also include your Telegram ID: ${chatId}\n\n` +
          `You will be notified here once confirmed.`
      );
      return;
    }

    setState(chatId, { step: "await_cnic" });
    await bot.sendMessage(
      chatId,
      `Welcome to Bike Subsidy Registration Bot\n\n` +
        `Government of Sindh - Motorcycle Fuel Subsidy Program\n\n` +
        (hasUsedFree(chatId) ? "" : `First registration is FREE!\n\n`) +
        `Step 1/5: Please send your CNIC number\nFormat: 42101-1234567-1`
    );
  });

  bot.onText(/\/cancel/, async (msg) => {
    states.delete(msg.chat.id);
    await bot.sendMessage(msg.chat.id, "Cancelled. Send /start to begin again.");
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `Bike Subsidy Bot - Commands:\n\n` +
        `/start - Start bike subsidy registration\n` +
        `/bike - Check bike details by registration number\n` +
        `/car - Check car details by registration number\n` +
        `/myid - Show your Telegram ID\n` +
        `/cancel - Cancel current action\n\n` +
        `First registration is FREE.\n` +
        `Additional registrations: Rs 150\n` +
        `Payment: Easypaisa/JazzCash 03063076001 (Tofique Ahmed)`
    );
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text ?? "").trim();
    if (!text || text.startsWith("/")) return;

    const state = getState(chatId);

    if (state.step === "vehicle_await_reg") {
      const regNo = text.toUpperCase().replace(/[^A-Z0-9\-]/g, "");
      if (regNo.length < 3) {
        await bot.sendMessage(chatId, "Invalid registration number. Example: NFH-3057");
        return;
      }
      setState(chatId, { step: "processing" });
      await bot.sendMessage(chatId, `Searching ${state.vehicleType} details for ${regNo}...\nPlease wait...`);
      try {
        const data = await searchVehicle(
          regNo,
          (progress) => { bot.sendMessage(chatId, progress).catch(() => {}); }
        );
        setState(chatId, { step: "idle" });
        let reply = `Vehicle Details for ${regNo}:\n\n`;
        for (const [key, value] of Object.entries(data)) {
          if (key && value) reply += `${key}: ${value}\n`;
        }
        await bot.sendMessage(chatId, reply);
      } catch (err: unknown) {
        const errMsg = (err instanceof Error ? err.message : "Search failed")
          .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        setState(chatId, { step: "idle" });
        await bot.sendMessage(chatId, `Vehicle search failed:\n${errMsg}\n\nUse /bike or /car to try again.`);
      }
      return;
    }

    if (state.step === "idle") {
      await bot.sendMessage(chatId, "Send /start to begin registration or /help for commands.");
      return;
    }
    if (state.step === "processing") {
      await bot.sendMessage(chatId, "Please wait, processing...");
      return;
    }
    if (state.step === "done") {
      await bot.sendMessage(chatId, "Registration complete. Send /start to register again.");
      return;
    }

    if (state.step === "await_cnic") {
      const formatted = formatCNIC(text);
      if (!isValidCNIC(formatted)) {
        await bot.sendMessage(chatId, "Invalid CNIC. Format: 42101-1234567-1");
        return;
      }
      setState(chatId, { cnic: formatted, step: "await_reg_no" });
      await bot.sendMessage(
        chatId,
        `CNIC: ${formatted}\n\nStep 2/5: Send your Motorcycle Registration Number\nExample: ABC-123`
      );
      return;
    }

    if (state.step === "await_reg_no") {
      const regNo = text.toUpperCase().replace(/[^A-Z0-9\-]/g, "");
      if (regNo.length < 3) {
        await bot.sendMessage(chatId, "Invalid registration number. Example: ABC-123");
        return;
      }
      setState(chatId, { regNo, step: "await_name" });
      await bot.sendMessage(chatId, `Reg No: ${regNo}\n\nStep 3/5: Send your Full Name (as on CNIC)`);
      return;
    }

    if (state.step === "await_name") {
      if (text.length < 3) {
        await bot.sendMessage(chatId, "Please enter your full name.");
        return;
      }
      setState(chatId, { name: text, step: "await_mobile" });
      await bot.sendMessage(chatId, `Name: ${text}\n\nStep 4/5: Send your Mobile Number\nExample: 03001234567`);
      return;
    }

    if (state.step === "await_mobile") {
      const mobile = text.replace(/\D/g, "");
      if (!isValidMobile(mobile)) {
        await bot.sendMessage(chatId, "Invalid mobile. Must be 11 digits starting with 03.");
        return;
      }
      setState(chatId, { mobile, step: "await_iban" });
      await bot.sendMessage(
        chatId,
        `Mobile: ${mobile}\n\nStep 5/5: Send your IBAN\n24 characters, e.g. PK36SCBL0000001123456702`
      );
      return;
    }

    if (state.step === "await_iban") {
      const iban = normalizeIBAN(text);
      if (!isValidIBAN(iban)) {
        await bot.sendMessage(
          chatId,
          `Invalid IBAN. Must be 24 characters starting with PK.\nYou sent: ${iban} (${iban.length} chars)`
        );
        return;
      }
      setState(chatId, { iban, step: "confirm" });
      const s = getState(chatId);
      await bot.sendMessage(
        chatId,
        `Please confirm your details:\n\n` +
          `CNIC: ${s.cnic}\n` +
          `Reg No: ${s.regNo}\n` +
          `Name: ${s.name}\n` +
          `Mobile: ${s.mobile}\n` +
          `IBAN: ${iban}\n\n` +
          `Reply YES to submit\nReply NO to re-enter IBAN`
      );
      return;
    }

    if (state.step === "confirm") {
      const reply = text.toUpperCase().trim();
      if (reply === "NO" || reply === "N") {
        setState(chatId, { step: "await_iban" });
        await bot.sendMessage(chatId, "Please send your IBAN again:");
        return;
      }
      if (reply !== "YES" && reply !== "Y") {
        await bot.sendMessage(chatId, "Reply YES to confirm or NO to re-enter IBAN.");
        return;
      }

      setState(chatId, { step: "processing" });
      await bot.sendMessage(chatId, `Starting registration...\nSolving captcha (30-60 seconds, please wait)...`);

      const s = getState(chatId);
      try {
        const result = await startRegistration(s.cnic!, s.regNo!, (elapsed) => {
          bot.sendMessage(chatId, `Still solving captcha... (${elapsed}s, please wait)`).catch(() => {});
        });
        setState(chatId, { sessionId: result.sessionId });
        await bot.sendMessage(chatId, "Captcha solved!\nEligibility verified!\nSending OTP...");
        await sendOtp(result.sessionId, s.mobile!);
        setState(chatId, { step: "await_otp" });
        await bot.sendMessage(chatId, `OTP sent to ${s.mobile}\n\nPlease enter the 4-digit OTP:`);
      } catch (err: unknown) {
        const errMsg = ((err instanceof Error ? err.message : "Unknown error") || "")
          .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        setState(chatId, { step: "idle" });
        await bot.sendMessage(chatId, `Registration failed:\n${errMsg}\n\nSend /start to try again.`);
        logger.error({ err, chatId }, "Registration start failed");
      }
      return;
    }

    if (state.step === "await_otp") {
      const otp = text.replace(/\D/g, "");
      if (otp.length !== 4) {
        await bot.sendMessage(chatId, "Please enter the 4-digit OTP.");
        return;
      }
      setState(chatId, { step: "processing" });
      await bot.sendMessage(chatId, `Verifying OTP ${otp}...`);

      try {
        await verifyOtp(state.sessionId!, otp);
        await bot.sendMessage(chatId, "OTP verified!\nSubmitting IBAN...");
        const finalResult = await finalizeRegistration(state.sessionId!, state.iban!);
        setState(chatId, { step: "done" });

        if (!hasUsedFree(chatId)) markUsedFree(chatId);

        bot.sendMessage(
          ADMIN_ID,
          `New registration done!\nUser ID: ${chatId}\nCNIC: ${state.cnic}\nPaid: ${isApproved(chatId) ? "Yes" : "No (free)"}`
        ).catch(() => {});

        await bot.sendMessage(
          chatId,
          `Registration Complete!\n\n${finalResult.message}\n\n` +
            `You will receive a tracking SMS.\n\n` +
            `To register a family member send /start.\n` +
            `Additional registrations cost Rs 150 via Easypaisa/JazzCash: 03063076001`
        );
      } catch (err: unknown) {
        const errMsg = ((err instanceof Error ? err.message : "Unknown error") || "")
          .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        setState(chatId, { step: "await_otp" });
        await bot.sendMessage(chatId, `OTP failed:\n${errMsg}\n\nPlease try the OTP again.`);
        logger.error({ err, chatId }, "OTP verification failed");
      }
      return;
    }
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  return bot;
}
