import TelegramBot from "node-telegram-bot-api";
import { logger } from "./logger";
import {
  startRegistration,
  sendOtp,
  verifyOtp,
  finalizeRegistration,
} from "./govProxy";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

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

export function startTelegramBot() {
  const bot = new TelegramBot(TOKEN!, { polling: true });

  logger.info("Telegram bot started with polling");

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    setState(chatId, { step: "await_cnic" });

    await bot.sendMessage(
      chatId,
      `*Welcome to Bike Subsidy Registration Bot* 🏍️\n\n` +
      `Government of Sindh — People's Motorcycle Fuel Subsidy Program\n\n` +
      `I will automatically register you step by step.\n\n` +
      `*Step 1/5:* Please send your *CNIC number*\nFormat: 42101-1234567-1`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
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
      `2. Automatically solve the captcha\n` +
      `3. Check your eligibility\n` +
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
        `⏳ Starting automated registration...\n` +
        `💰 Checking 2captcha balance...\n` +
        `🔐 Then solving captcha (30-60 seconds)...`,
        { parse_mode: "Markdown" }
      );

      try {
        const result = await startRegistration(s.cnic!, s.regNo!);
        setState(chatId, { sessionId: result.sessionId });

        await bot.sendMessage(chatId, "✅ Captcha solved!\n✅ Eligibility verified — your bike is eligible!\n\n⏳ Sending OTP to your mobile...");

        await sendOtp(result.sessionId, s.mobile!);

        setState(chatId, { step: "await_otp" });
        await bot.sendMessage(
          chatId,
          `✅ OTP sent to \`${s.mobile}\`\n\n*Please enter the 4-digit OTP* you received via SMS:`,
          { parse_mode: "Markdown" }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setState(chatId, { step: "idle" });
        await bot.sendMessage(
          chatId,
          `❌ *Registration failed:*\n${msg}\n\nSend /start to try again.`,
          { parse_mode: "Markdown" }
        );
        logger.error({ err, chatId }, "Registration start failed");
      }
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
        await verifyOtp(state.sessionId!, otp);
        await bot.sendMessage(chatId, "✅ OTP verified!\n\n⏳ Submitting your IBAN and finalizing registration...");

        const finalResult = await finalizeRegistration(state.sessionId!, state.iban!);
        setState(chatId, { step: "done" });

        await bot.sendMessage(
          chatId,
          `🎉 *Registration Complete!*\n\n${finalResult.message}\n\n` +
          `You will receive a tracking ID via SMS. The fuel subsidy of Rs 2,000/month will be deposited to your IBAN.\n\n` +
          `Send /start if you need to register again.`,
          { parse_mode: "Markdown" }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setState(chatId, { step: "await_otp" });
        await bot.sendMessage(
          chatId,
          `❌ *OTP verification failed:*\n${msg}\n\nPlease try sending the OTP again.`,
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
