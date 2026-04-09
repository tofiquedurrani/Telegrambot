import { Router, type IRouter } from "express";
import {
  startRegistration,
  sendOtp,
  verifyOtp,
  finalizeRegistration,
} from "../lib/govProxy";

const router: IRouter = Router();

router.post("/bike-subsidy/start", async (req, res): Promise<void> => {
  const { cnic, reg_no } = req.body as { cnic?: string; reg_no?: string };

  if (!cnic || !reg_no) {
    res.status(400).json({ error: "cnic and reg_no are required" });
    return;
  }

  try {
    const result = await startRegistration(cnic, reg_no);
    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to start registration");
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

router.post("/bike-subsidy/send-otp", async (req, res): Promise<void> => {
  const { session_id, mobile } = req.body as { session_id?: string; mobile?: string };

  if (!session_id || !mobile) {
    res.status(400).json({ error: "session_id and mobile are required" });
    return;
  }

  try {
    const result = await sendOtp(session_id, mobile);
    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to send OTP");
    const message = err instanceof Error ? err.message : "Failed to send OTP";
    res.status(400).json({ error: message });
  }
});

router.post("/bike-subsidy/verify-otp", async (req, res): Promise<void> => {
  const { session_id, otp } = req.body as { session_id?: string; otp?: string };

  if (!session_id || !otp) {
    res.status(400).json({ error: "session_id and otp are required" });
    return;
  }

  try {
    await verifyOtp(session_id, otp);
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "OTP verification failed");
    const message = err instanceof Error ? err.message : "OTP verification failed";
    res.status(400).json({ error: message });
  }
});

router.post("/bike-subsidy/finalize", async (req, res): Promise<void> => {
  const { session_id, iban } = req.body as { session_id?: string; iban?: string };

  if (!session_id || !iban) {
    res.status(400).json({ error: "session_id and iban are required" });
    return;
  }

  try {
    const result = await finalizeRegistration(session_id, iban);
    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "Finalization failed");
    const message = err instanceof Error ? err.message : "Registration finalization failed";
    res.status(400).json({ error: message });
  }
});

export default router;
