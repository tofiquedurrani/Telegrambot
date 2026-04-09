import { useState } from "react";
import { UserData } from "@/pages/RegistrationPage";

interface Props {
  userData: UserData;
  onBack: () => void;
}

type Phase =
  | "idle"
  | "solving_captcha"
  | "checking_eligibility"
  | "sending_otp"
  | "waiting_otp"
  | "verifying_otp"
  | "finalizing"
  | "done"
  | "error";

interface Log {
  time: string;
  text: string;
  type: "info" | "success" | "error" | "warn";
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function apiPost(path: string, body: Record<string, string>) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function now() {
  return new Date().toLocaleTimeString();
}

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Ready to start",
  solving_captcha: "Solving CAPTCHA automatically...",
  checking_eligibility: "Checking eligibility...",
  sending_otp: "Sending OTP to your mobile...",
  waiting_otp: "Waiting for OTP",
  verifying_otp: "Verifying OTP...",
  finalizing: "Finalizing registration...",
  done: "Registration Complete!",
  error: "Error occurred",
};

export default function BotRunner({ userData, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<Log[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [trackingMsg, setTrackingMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  function addLog(text: string, type: Log["type"] = "info") {
    setLogs((l) => [...l, { time: now(), text, type }]);
  }

  async function runBot() {
    setLogs([]);
    setErrorMsg("");
    setPhase("solving_captcha");
    addLog("Starting automated registration...", "info");
    addLog("Submitting CAPTCHA to solving service (this takes 30–60 seconds)...", "info");

    try {
      setPhase("checking_eligibility");
      addLog("Getting session from government website...", "info");
      addLog("Solving reCAPTCHA via 2captcha service...", "info");

      const startResult = await apiPost("/bike-subsidy/start", {
        cnic: userData.cnic,
        reg_no: userData.regNo,
      });

      addLog("✓ CAPTCHA solved!", "success");
      addLog("✓ Eligibility verified — motorcycle is eligible!", "success");
      setSessionId(startResult.sessionId);

      setPhase("sending_otp");
      addLog(`Sending OTP to ${userData.mobile}...`, "info");

      await apiPost("/bike-subsidy/send-otp", {
        session_id: startResult.sessionId,
        mobile: userData.mobile,
      });

      addLog(`✓ OTP sent to ${userData.mobile}`, "success");
      addLog("Please enter the 4-digit OTP you received via SMS.", "warn");
      setPhase("waiting_otp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addLog(`Error: ${msg}`, "error");
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  async function submitOtp() {
    if (otp.trim().length !== 4) return;
    setPhase("verifying_otp");
    addLog(`Verifying OTP: ${otp}...`, "info");

    try {
      await apiPost("/bike-subsidy/verify-otp", {
        session_id: sessionId,
        otp: otp.trim(),
      });

      addLog("✓ OTP verified!", "success");

      setPhase("finalizing");
      addLog(`Submitting IBAN: ${userData.iban}...`, "info");

      const finalResult = await apiPost("/bike-subsidy/finalize", {
        session_id: sessionId,
        iban: userData.iban,
      });

      addLog("✓ Registration completed successfully!", "success");
      setTrackingMsg(finalResult.message || "Registration submitted successfully. Check your SMS for tracking ID.");
      setPhase("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addLog(`Error: ${msg}`, "error");
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  const isRunning = ["solving_captcha", "checking_eligibility", "sending_otp", "verifying_otp", "finalizing"].includes(phase);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="bg-green-700 text-white rounded-2xl px-5 py-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-green-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="font-bold text-base">Automated Registration Bot</h1>
              <p className="text-green-200 text-xs">Government of Sindh — Bike Subsidy Program</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            phase === "done" ? "bg-green-400 text-white" :
            phase === "error" ? "bg-red-400 text-white" :
            isRunning ? "bg-yellow-400 text-yellow-900 animate-pulse" :
            "bg-green-600 text-white"
          }`}>
            {phase === "done" ? "✓ Done" : phase === "error" ? "✗ Error" : isRunning ? "Running..." : "Ready"}
          </div>
        </div>

        {/* Your Data Summary */}
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Your Registration Data</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">CNIC</p>
              <p className="font-mono font-semibold text-gray-800">{userData.cnic}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Registration No.</p>
              <p className="font-mono font-semibold text-gray-800">{userData.regNo}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Name</p>
              <p className="font-semibold text-gray-800">{userData.name}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Mobile</p>
              <p className="font-mono font-semibold text-gray-800">{userData.mobile}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 col-span-2">
              <p className="text-xs text-gray-400 mb-0.5">IBAN</p>
              <p className="font-mono font-semibold text-gray-800 break-all">{userData.iban}</p>
            </div>
          </div>
        </div>

        {/* Status Card */}
        {phase !== "idle" && (
          <div className={`rounded-2xl shadow p-5 mb-5 ${
            phase === "done" ? "bg-green-600 text-white" :
            phase === "error" ? "bg-red-50 border-2 border-red-200" :
            "bg-white"
          }`}>
            {phase === "done" ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Registration Complete!</h2>
                <p className="text-green-100 text-sm">{trackingMsg}</p>
              </div>
            ) : phase === "waiting_otp" ? (
              <div>
                <h2 className="font-bold text-gray-900 text-base mb-1">Enter OTP</h2>
                <p className="text-gray-600 text-sm mb-4">A 4-digit code was sent to <strong>{userData.mobile}</strong>. Enter it below:</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    maxLength={4}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="1234"
                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono font-bold outline-none focus:border-green-500 tracking-widest"
                    onKeyDown={(e) => e.key === "Enter" && submitOtp()}
                    autoFocus
                  />
                  <button
                    onClick={submitOtp}
                    disabled={otp.length !== 4}
                    className="px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl transition-colors"
                  >
                    Verify →
                  </button>
                </div>
              </div>
            ) : phase === "error" ? (
              <div>
                <h2 className="font-bold text-red-800 text-base mb-2">Something went wrong</h2>
                <p className="text-red-700 text-sm bg-red-100 rounded-xl p-3">{errorMsg}</p>
                <button
                  onClick={() => { setPhase("idle"); setLogs([]); setErrorMsg(""); setOtp(""); }}
                  className="mt-3 w-full border-2 border-red-200 text-red-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-red-50 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin flex-shrink-0"></div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{PHASE_LABELS[phase]}</p>
                    {phase === "solving_captcha" && (
                      <p className="text-gray-500 text-xs">Using 2captcha service — this takes 30–60 seconds</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Log Output */}
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-2xl shadow p-4 mb-5 font-mono text-xs">
            <p className="text-gray-400 mb-2 text-xs uppercase tracking-wider">Activity Log</p>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-500 flex-shrink-0">{log.time}</span>
                  <span className={
                    log.type === "success" ? "text-green-400" :
                    log.type === "error" ? "text-red-400" :
                    log.type === "warn" ? "text-yellow-400" :
                    "text-gray-300"
                  }>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Start Button */}
        {phase === "idle" && (
          <div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-amber-800">
                <strong>Keep your phone nearby.</strong> After the bot completes the eligibility check, it will send an OTP to <strong>{userData.mobile}</strong>. You will need to enter that code here.
              </div>
            </div>
            <button
              onClick={runBot}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Automatic Registration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
