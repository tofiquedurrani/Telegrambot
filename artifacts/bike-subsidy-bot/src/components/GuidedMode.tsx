import { useState, useCallback } from "react";
import { UserData } from "@/pages/RegistrationPage";

interface Props {
  userData: UserData;
  onBack: () => void;
}

interface Step {
  id: number;
  title: string;
  urdu: string;
  description: string;
  fields: { label: string; value: string; fieldName: string }[];
  note?: string;
  isOtp?: boolean;
  isSpecial?: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <button
      onClick={handleCopy}
      className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        copied
          ? "bg-green-100 text-green-700 border border-green-300"
          : "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
      }`}
    >
      {copied ? "✓ Copied!" : "Copy"}
    </button>
  );
}

export default function GuidedMode({ userData, onBack }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [iframeKey, setIframeKey] = useState(0);

  const steps: Step[] = [
    {
      id: 1,
      title: "Step 1 — Check Eligibility",
      urdu: "قدم 1 — اہلیت چیک کریں",
      description: "Enter your CNIC and Registration Number on the government website, then solve the captcha and click 'Check Eligibility'.",
      fields: [
        { label: "CNIC Number", value: userData.cnic, fieldName: "CNIC field" },
        { label: "Registration No.", value: userData.regNo, fieldName: "Registration No. field" },
      ],
      note: "After entering these, you must solve the captcha puzzle on the website, then click 'Check Eligibility'.",
    },
    {
      id: 2,
      title: "Step 2 — Basic Information & OTP",
      urdu: "قدم 2 — بنیادی معلومات اور OTP",
      description: "Enter your mobile number on the website and click 'Send OTP'. Your name may already be filled in. Then enter the 4-digit OTP you receive on your phone.",
      fields: [
        { label: "Full Name", value: userData.name, fieldName: "Full Name field" },
        { label: "Mobile Number", value: userData.mobile, fieldName: "Mobile # field" },
      ],
      note: "After clicking 'Send OTP', wait for the SMS on your mobile. Then enter the 4-digit code and click 'Verify'.",
      isOtp: true,
    },
    {
      id: 3,
      title: "Step 3 — Account Details",
      urdu: "قدم 3 — اکاؤنٹ کی تفصیلات",
      description: "Enter your IBAN number and click 'Submit' to complete the registration.",
      fields: [
        { label: "IBAN Number", value: userData.iban, fieldName: "IBAN# field" },
      ],
      note: "Make sure the IBAN account holder name matches the name on your bike's registration certificate.",
    },
  ];

  const step = steps[currentStep - 1];

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="bg-green-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-green-600 rounded-lg transition-colors"
            title="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="font-semibold text-sm">Bike Subsidy Registration Guide</h1>
            <p className="text-green-200 text-xs">Government of Sindh</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {steps.map((s) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(s.id)}
              className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                s.id === currentStep
                  ? "bg-white text-green-700"
                  : s.id < currentStep
                  ? "bg-green-500 text-white"
                  : "bg-green-800 text-green-300"
              }`}
            >
              {s.id < currentStep ? "✓" : s.id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-100 bg-green-50">
            <h2 className="font-bold text-gray-900 text-sm">{step.title}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{step.urdu}</p>
          </div>

          <div className="p-4 flex-1">
            <p className="text-gray-700 text-sm leading-relaxed mb-4">{step.description}</p>

            <div className="space-y-3">
              {step.fields.map((field) => (
                <div key={field.label} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">{field.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono font-semibold text-gray-900 flex-1 break-all">{field.value}</p>
                    <CopyButton value={field.value} />
                  </div>
                  <p className="text-xs text-green-600 mt-1">→ Paste into "{field.fieldName}"</p>
                </div>
              ))}
            </div>

            {step.note && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-amber-800 text-xs">{step.note}</p>
                </div>
              </div>
            )}

            {step.isOtp && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                  </svg>
                  <p className="text-blue-800 text-xs">Keep your phone ({userData.mobile}) nearby. A 4-digit OTP will be sent via SMS.</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 space-y-2">
            <div className="flex gap-2">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep((s) => s - 1)}
                  className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  ← Previous
                </button>
              )}
              {currentStep < steps.length ? (
                <button
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  Next Step →
                </button>
              ) : (
                <div className="flex-1 bg-green-100 border border-green-300 text-green-800 rounded-lg py-2 text-sm font-medium text-center">
                  Registration Complete!
                </div>
              )}
            </div>
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              className="w-full border border-gray-200 text-gray-500 rounded-lg py-1.5 text-xs hover:bg-gray-50 transition-colors"
            >
              ↻ Reload website
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-gray-200 px-3 py-2 flex items-center gap-2 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-500 font-mono">
              https://fsp.excise.gos.pk/home/bike_subsidies
            </div>
            <a
              href="https://fsp.excise.gos.pk/home/bike_subsidies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in tab
            </a>
          </div>
          <iframe
            key={iframeKey}
            src="https://fsp.excise.gos.pk/home/bike_subsidies"
            className="flex-1 w-full border-0"
            title="Bike Subsidy Registration - Government of Sindh"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
