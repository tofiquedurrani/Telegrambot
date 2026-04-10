import { Router, type Request, type Response } from "express";
import { submitCaptchaToken } from "../lib/captchaStore";

const router = Router();

const RECAPTCHA_SITE_KEY = "6LczdnQsAAAAAK2YNjS9L6upyt4ng1cQiYzqXU24";

router.get("/captcha/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify — Bike Subsidy Registration</title>
  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4f8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 360px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      text-align: center;
    }
    .logo { font-size: 48px; margin-bottom: 12px; }
    h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
    p { font-size: 14px; color: #666; margin-bottom: 24px; line-height: 1.5; }
    .recaptcha-wrap { display: flex; justify-content: center; margin-bottom: 20px; }
    button {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 10px;
      padding: 14px 32px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background 0.2s;
    }
    button:hover { background: #1d4ed8; }
    button:disabled { background: #94a3b8; cursor: not-allowed; }
    .success {
      display: none;
      background: #dcfce7;
      border-radius: 10px;
      padding: 20px;
      color: #166534;
      font-weight: 600;
      font-size: 15px;
      margin-top: 16px;
    }
    .error-msg {
      display: none;
      background: #fee2e2;
      border-radius: 10px;
      padding: 12px;
      color: #991b1b;
      font-size: 14px;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🏍️</div>
    <h1>Sindh Bike Subsidy</h1>
    <p>Please complete the verification below to continue your registration in the Telegram bot.</p>
    <form id="form" onsubmit="submitForm(event)">
      <div class="recaptcha-wrap">
        <div class="g-recaptcha" data-sitekey="${RECAPTCHA_SITE_KEY}"></div>
      </div>
      <button type="submit" id="btn">Verify &amp; Continue</button>
    </form>
    <div class="success" id="success">
      ✅ Verified! You can now close this page and return to Telegram.
    </div>
    <div class="error-msg" id="error"></div>
  </div>

  <script>
    async function submitForm(e) {
      e.preventDefault();
      const token = grecaptcha.getResponse();
      if (!token) {
        showError('Please complete the reCAPTCHA first.');
        return;
      }
      const btn = document.getElementById('btn');
      btn.disabled = true;
      btn.textContent = 'Verifying...';
      try {
        const res = await fetch(window.location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (data.ok) {
          document.getElementById('form').style.display = 'none';
          document.getElementById('success').style.display = 'block';
        } else {
          showError(data.error || 'Something went wrong. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Verify & Continue';
          grecaptcha.reset();
        }
      } catch (err) {
        showError('Network error. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Verify & Continue';
        grecaptcha.reset();
      }
    }
    function showError(msg) {
      const el = document.getElementById('error');
      el.textContent = msg;
      el.style.display = 'block';
    }
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

router.post("/captcha/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ ok: false, error: "No token provided" });
    return;
  }

  const accepted = submitCaptchaToken(id, token);
  if (!accepted) {
    res.status(410).json({ ok: false, error: "This captcha session has expired or already been used." });
    return;
  }

  res.json({ ok: true });
});

export default router;
