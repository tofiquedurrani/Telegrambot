import TelegramBot from "node-telegram-bot-api";
import { logger } from "./logger";
import {
  prepareGovSession,
  startRegistration,
  sendOtp,
  verifyOtp,
  finalizeRegistration,
} from "./govProxy";
import { waitForCaptcha, cancelCaptcha } from "./captchaStore";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;

if (!TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

interface UserState {
  step:
    | "idle"
    | "await_cnic"
    | "await_reg_no"
    | "await_name"
    | "await_mobile"
    | "await_iban"
    | "processing"
    | "await_otp"
    | "done";
  cnic?: string;
  regNo?: string;
  name?: string;
  mobile?: string;
  iban?: string;
  sessionId?: string;
  captchaId?: string;
}

const states = new Map<number, UserState>();

function getState(chatId: number): UserState {
  if (!states.has(chatId)) {
    states.set(chatId, { step: "idle" });
  }
  return states.get(chatId)!;
}

function setState(chatId: number, update: Partial<UserState>) {
  const current = getState(chatId);
  states.set(chatId, { ...current, ...update });
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

function isValidIBAN(val: string): boolean {
  const clean = val.replace(/\s/g, "").toUpperCase();
  return /^PK[A-Z0-9]{22}$/.test(clean);
}

function makeCaptchaId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getCaptchaUrl(captchaId: string): string {
  const domain = DEV_DOMAIN
    ? `https://${DEV_DOMAIN}`
    : `http://localhost:${process.env.PORT ?? 8080}`;
  return `${domain}/captcha/${captchaId}`;
}

export function startTelegramBot() {
  const bot = new TelegramBot(TOKEN!, { polling: true });

  logger.info("Telegram bot started with polling");

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const prev = getState(chatId);
    if (prev.captchaId) cancelCaptcha(prev.captchaId);
    setState(chatId, { step: "await_cnic" });

    await bot.sendMessage(
      chatId,
      `*Welcome to Bike Subsidy Registration Bot* 🏍️\n\n` +
      `Government of Sindh — People's Motorcycle Fuel Subsidy Program\n\n` +
      `I will guide you through registration step by step.\n\n` +
      `*Step 1/5:* Please send your *CNIC number*\nFormat: 42101-1234567-1`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const prev = getState(chatId);
    if (prev.captchaId) cancelCaptcha(prev.captchaId);
    states.delete(chatId);
    await bot.sendMessage(chatId, "Registration cancelled. Send /start to begin again.");
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `*Bike Subsidy Bot Help*\n\n` +
      `/start — Start registration\n` +
      `/cancel — Cancel current registration\n\n` +
      `The bot will:\n` +
      `1. Collect your CNIC, bike reg number, name, mobile, IBAN\n` +
      `2. Send you a link to complete a quick captcha in your browser (free)\n` +
      `3. Check your eligibility automatically\n` +
      `4. Send OTP to your mobile\n` +
      `5. Ask you to enter the OTP\n` +
      `6. Submit your IBAN and complete registration`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text ?? "").trim();

    if (!text || text.startsWith("/")) return;

    const state = getState(chatId);

    if (state.step === "idle") {
      await bot.sendMessage(chatId, "Send /start to begin registration.");
      return;
    }

    if (state.step === "processing") {
      await bot.sendMessage(chatId, "⏳ Please wait, processing your registration...");
      return;
    }

    if (state.step === "done") {
      await bot.sendMessage(chatId, "✅ Registration already completed. Send /start to register again.");
      return;
    }

    if (state.step === "await_cnic") {
      const formatted = formatCNIC(text);
      if (!isValidCNIC(formatted)) {
        await bot.sendMessage(chatId, "❌ Invalid CNIC format. Please enter in format: *42101-1234567-1*", { parse_mode: "Markdown" });
        return;
      }
      setState(chatId, { cnic: formatted, step: "await_reg_no" });
      await bot.sendMessage(
        chatId,
        `✅ CNIC: \`${formatted}\`\n\n*Step 2/5:* Please send your *Motorcycle Registration Number*\nExample: ABC-123 or KHI-123`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (state.step === "await_reg_no") {
      const regNo = text.toUpperCase().replace(/[^A-Z0-9\-]/g, "");
      if (regNo.length < 3) {
        await bot.sendMessage(chatId, "❌ Invalid registration number. Please enter your bike's registration number (e.g. ABC-123).");
        return;
      }
      setState(chatId, { regNo, step: "await_name" });
      await bot.sendMessage(
        chatId,
        `✅ Reg No: \`${regNo}\`\n\n*Step 3/5:* Please send your *Full Name*\n(as it appears on your CNIC)`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (state.step === "await_name") {
      if (text.length < 3) {
        await bot.sendMessage(chatId, "❌ Please enter your full name (at least 3 characters).");
        return;
      }
      setState(chatId, { name: text, step: "await_mobile" });
      await bot.sendMessage(
        chatId,
        `✅ Name: \`${text}\`\n\n*Step 4/5:* Please send your *Mobile Number*\nMust be 11 digits starting with 03 (e.g. 03001234567)\n⚠️ You will receive an OTP on this number.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (state.step === "await_mobile") {
      const mobile = text.replace(/\D/g, "");
      if (!isValidMobile(mobile)) {
        await bot.sendMessage(chatId, "❌ Invalid mobile number. Must be 11 digits starting with 03 (e.g. 03001234567).");
        return;
      }
      setState(chatId, { mobile, step: "await_iban" });
      await bot.sendMessage(
        chatId,
        `✅ Mobile: \`${mobile}\`\n\n*Step 5/5:* Please send your *IBAN Number*\nMust be 24 characters starting with PK\nExample: PK00ABCD0000000000000000\n\n_Found on your cheque book. Must match name on bike registration._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (state.step === "await_iban") {
      const iban = text.replace(/\s/g, "").toUpperCase();
      if (!isValidIBAN(iban)) {
        await bot.sendMessage(chatId, "❌ Invalid IBAN. Must be 24 characters starting with PK (e.g. PK36SCBL0000001123456702).");
        return;
      }

      setState(chatId, { iban, step: "processing" });

      const s = getState(chatId);
      await bot.sendMessage(
        chatId,
        `✅ IBAN: \`${iban}\`\n\n*Summary of your details:*\n` +
        `• CNIC: \`${s.cnic}\`\n` +
        `• Reg No: \`${s.regNo}\`\n` +
        `• Name: \`${s.name}\`\n` +
        `• Mobile: \`${s.mobile}\`\n` +
        `• IBAN: \`${iban}\`\n\n` +
        `⏳ Preparing registration session...`,
        { parse_mode: "Markdown" }
      );

      runRegistration(bot, chatId, s.cnic!, s.regNo!, s.mobile!, iban);
      return;
    }

    if (state.step === "await_otp") {
      const otp = text.replace(/\D/g, "");
      if (otp.length !== 4) {
        await bot.sendMessage(chatId, "❌ Please enter the 4-digit OTP received via SMS.");
        return;
      }

      setState(chatId, { step: "processing" });
      await bot.sendMessage(chatId, `⏳ Verifying OTP \`${otp}\`...`, { parse_mode: "Markdown" });

      try {
        const currentState = getState(chatId);
        await verifyOtp(currentState.sessionId!, otp);
        await bot.sendMessage(chatId, "✅ OTP verified!\n\n⏳ Submitting your IBAN and finalizing registration...");

        const finalResult = await finalizeRegistration(currentState.sessionId!, currentState.iban!);
        setState(chatId, { step: "done" });

        await bot.sendMessage(
          chatId,
          `🎉 *Registration Complete!*\n\n${finalResult.message}\n\n` +
          `You will receive a tracking ID via SMS. The fuel subsidy of Rs 2,000/month will be deposited to your IBAN.\n\n` +
          `Send /start if you need to register again.`,
          { parse_mode: "Markdown" }
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        setState(chatId, { step: "await_otp" });
        await bot.sendMessage(
          chatId,
          `❌ *OTP verification failed:*\n${errMsg}\n\nPlease try entering the OTP again.`,
          { parse_mode: "Markdown" }
        );
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

async function runRegistration(
  bot: TelegramBot,
  chatId: number,
  cnic: string,
  regNo: string,
  mobile: string,
  iban: string
) {
  try {
    const govCookies = await prepareGovSession();

    const captchaId = makeCaptchaId();
    const captchaUrl = getCaptchaUrl(captchaId);
    setState(chatId, { captchaId });

    await bot.sendMessage(
      chatId,
      `✅ Session ready!\n\n` +
      `🔐 *One quick step required:*\n\n` +
      `Please tap the link below, solve the captcha in your browser (takes ~5 seconds), then come back here:\n\n` +
      `👉 ${captchaUrl}\n\n` +
      `⏳ Waiting for you to complete the captcha... (link valid for 10 minutes)`,
      { parse_mode: "Markdown" }
    );

    const captchaToken = await waitForCaptcha(captchaId);
    setState(chatId, { captchaId: undefined });

    await bot.sendMessage(chatId, "✅ Captcha solved! Checking eligibility...");

    const { sessionId } = await startRegistration(cnic, regNo, captchaToken, govCookies);
    setState(chatId, { sessionId });

    await bot.sendMessage(chatId, "✅ Eligible!\n\n⏳ Sending OTP to your mobile...");

    await sendOtp(sessionId, mobile);
    setState(chatId, { step: "await_otp" });

    await bot.sendMessage(
      chatId,
      `✅ OTP sent to \`${mobile}\`\n\n*Please enter the 4-digit OTP* you received via SMS:`,
      { parse_mode: "Markdown" }
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    setState(chatId, { step: "idle", captchaId: undefined });
    await bot.sendMessage(
      chatId,
      `❌ *Registration failed:*\n${errMsg}\n\nSend /start to try again.`,
      { parse_mode: "Markdown" }
    );
    logger.error({ err, chatId }, "Registration failed");
  }
}
