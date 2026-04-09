import { useState, useCallback } from "react";
import { UserData } from "@/pages/RegistrationPage";

interface Props {
  userData: UserData;
  onBack: () => void;
}

interface FieldItem {
  label: string;
  value: string;
  fieldName: string;
}

interface Step {
  id: number;
  title: string;
  urdu: string;
  description: string;
  fields: FieldItem[];
  note?: string;
  phoneNote?: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <button
      onClick={handleCopy}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
        copied
          ? "bg-green-100 text-green-700 border-2 border-green-400"
          : "bg-green-600 hover:bg-green-700 text-white"
      }`}
    >
      {copied ? "✓ Copied!" : "Copy"}
    </button>
  );
}

export default function GuidedMode({ userData, onBack }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [websiteOpened, setWebsiteOpened] = useState(false);

  const steps: Step[] = [
    {
      id: 1,
      title: "Check Eligibility",
      urdu: "اہلیت چیک کریں",
      description: "On the government website, scroll to 'Check Eligibility'. Enter the values below, solve the captcha, then click 'Check Eligibility'.",
      fields: [
        { label: "CNIC Number", value: userData.cnic, fieldName: "CNIC field" },
        { label: "Registration No.", value: userData.regNo, fieldName: "Registration No. field" },
      ],
      note: "After entering both values, solve the captcha puzzle on the website, then click 'Check Eligibility'. If eligible, the form will unlock for Step 2.",
    },
    {
      id: 2,
      title: "Basic Information & OTP",
      urdu: "بنیادی معلومات اور OTP",
      description: "Enter your mobile number and click 'Send OTP'. Wait for the 4-digit code on your phone, then enter it and click 'Verify'.",
      fields: [
        { label: "Full Name", value: userData.name, fieldName: "Full Name field (may auto-fill)" },
        { label: "Mobile Number", value: userData.mobile, fieldName: "Mobile # field" },
      ],
      note: "After clicking 'Send OTP', you will receive an SMS on your mobile. Enter that 4-digit code on the website and click 'Verify'.",
      phoneNote: true,
    },
    {
      id: 3,
      title: "Account Details",
      urdu: "اکاؤنٹ کی تفصیلات",
      description: "Enter your IBAN number below and click 'Submit' to complete the registration. You will receive a tracking ID via SMS.",
      fields: [
        { label: "IBAN Number", value: userData.iban, fieldName: "IBAN# field" },
      ],
      note: "Make sure your IBAN account name exactly matches the name on your motorcycle registration certificate.",
    },
  ];

  const step = steps[currentStep - 1];
  const isLastStep = currentStep === steps.length;

  function openWebsite() {
    window.open("https://fsp.excise.gos.pk/home/bike_subsidies", "_blank", "noopener,noreferrer");
    setWebsiteOpened(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col">
      <div className="bg-green-700 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
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
            <h1 className="font-bold text-base">Bike Subsidy Registration Guide</h1>
            <p className="text-green-200 text-xs">Government of Sindh — People's Motorcycle Fuel Subsidy Program</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {steps.map((s) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(s.id)}
              title={`Go to step ${s.id}`}
              className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                s.id === currentStep
                  ? "bg-white text-green-700 shadow"
                  : s.id < currentStep
                  ? "bg-green-400 text-white"
                  : "bg-green-800 text-green-300"
              }`}
            >
              {s.id < currentStep ? "✓" : s.id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-6 gap-6">
        <div className="w-full max-w-2xl">
          {!websiteOpened && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-5 border-2 border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Open the Government Website</h2>
                  <p className="text-sm text-gray-500">Keep this app open alongside it</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Click below to open the government registration website in a new tab. Keep this guide open — it will show you exactly what to copy and paste at each step.
              </p>
              <button
                onClick={openWebsite}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open fsp.excise.gos.pk in New Tab
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Step {currentStep} of 3</span>
                </div>
                <h2 className="font-bold text-gray-900 text-lg">{step.title}</h2>
                <p className="text-gray-500 text-sm">{step.urdu}</p>
              </div>
              {websiteOpened && (
                <button
                  onClick={openWebsite}
                  className="text-xs text-green-600 hover:text-green-800 underline flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Reopen website
                </button>
              )}
            </div>

            <div className="p-6">
              <p className="text-gray-700 text-sm leading-relaxed mb-6">{step.description}</p>

              <div className="space-y-4 mb-6">
                {step.fields.map((field) => (
                  <div key={field.label} className="border-2 border-gray-100 rounded-xl p-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{field.label}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-mono font-bold text-gray-900 flex-1 break-all">{field.value}</p>
                      <CopyButton value={field.value} />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <p className="text-xs text-green-600 font-medium">Paste into "{field.fieldName}" on the website</p>
                    </div>
                  </div>
                ))}
              </div>

              {step.phoneNote && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex gap-3">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                  </svg>
                  <div>
                    <p className="text-blue-800 text-sm font-semibold">Keep your phone ready</p>
                    <p className="text-blue-700 text-sm">A 4-digit OTP will be sent to <strong>{userData.mobile}</strong> via SMS. Enter it on the website within a few minutes.</p>
                  </div>
                </div>
              )}

              {step.note && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-amber-800 text-sm">{step.note}</p>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep((s) => s - 1)}
                  className="flex-1 border-2 border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  ← Previous Step
                </button>
              )}
              {!isLastStep ? (
                <button
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
                >
                  Next Step →
                </button>
              ) : (
                <div className="flex-1 bg-green-100 border-2 border-green-300 rounded-xl py-3 text-sm font-bold text-green-800 text-center flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Registration Complete — Check your SMS for tracking ID
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 bg-white rounded-xl shadow p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Registered Data</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-400">CNIC:</span> <span className="font-mono font-medium text-gray-700">{userData.cnic}</span></div>
              <div><span className="text-gray-400">Reg No:</span> <span className="font-mono font-medium text-gray-700">{userData.regNo}</span></div>
              <div><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-700">{userData.name}</span></div>
              <div><span className="text-gray-400">Mobile:</span> <span className="font-mono font-medium text-gray-700">{userData.mobile}</span></div>
              <div className="col-span-2"><span className="text-gray-400">IBAN:</span> <span className="font-mono font-medium text-gray-700">{userData.iban}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
