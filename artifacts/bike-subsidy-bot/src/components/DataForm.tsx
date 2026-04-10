import { useState } from "react";
import { UserData } from "@/pages/RegistrationPage";

interface Props {
  onSubmit: (data: UserData) => void;
}

function formatCNIC(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export default function DataForm({ onSubmit }: Props) {
  const [form, setForm] = useState({
    cnic: "",
    regNo: "",
    name: "",
    mobile: "",
    iban: "PK",
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  function validate() {
    const e: Partial<typeof form> = {};
    const cnicClean = form.cnic.replace(/\D/g, "");
    if (cnicClean.length !== 13) e.cnic = "CNIC must be 13 digits (e.g. 42101-1234567-1)";
    if (!form.regNo.trim()) e.regNo = "Registration number is required";
    if (form.name.trim().length < 3) e.name = "Enter your full name (at least 3 characters)";
    const mobile = form.mobile.replace(/\D/g, "");
    if (mobile.length !== 11 || !mobile.startsWith("03")) e.mobile = "Mobile must be 11 digits starting with 03";
    const ibanClean = form.iban.replace(/\s/g, "");
    if (ibanClean.length !== 24 || !ibanClean.startsWith("PK")) e.iban = "IBAN must be 24 characters starting with PK";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSubmit({
      cnic: form.cnic,
      regNo: form.regNo.toUpperCase().trim(),
      name: form.name.trim(),
      mobile: form.mobile.replace(/\D/g, ""),
      iban: form.iban.replace(/\s/g, "").toUpperCase(),
    });
  }

  function handleCNIC(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCNIC(e.target.value);
    setForm((f) => ({ ...f, cnic: formatted }));
    setErrors((er) => ({ ...er, cnic: undefined }));
  }

  function handleIBAN(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (val.startsWith("PKPK")) val = val.slice(2);
    if (!val.startsWith("PK")) val = "PK" + val;
    if (val.length > 24) val = val.slice(0, 24);
    setForm((f) => ({ ...f, iban: val }));
    setErrors((er) => ({ ...er, iban: undefined }));
  }

  function handleMobile(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    setForm((f) => ({ ...f, mobile: digits }));
    setErrors((er) => ({ ...er, mobile: undefined }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Bike Subsidy Registration</h1>
          <p className="text-gray-600 mt-1 text-sm">Government of Sindh — People's Motorcycle Fuel Subsidy Program</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex gap-2">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-800 text-sm">Enter your details below. After that, we will guide you step-by-step through the registration with one-click copy buttons.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNIC Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.cnic}
                onChange={handleCNIC}
                placeholder="42101-1234567-1"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 ${errors.cnic ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.cnic && <p className="text-red-500 text-xs mt-1">{errors.cnic}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motorcycle Registration No. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.regNo}
                onChange={(e) => {
                  setForm((f) => ({ ...f, regNo: e.target.value.toUpperCase() }));
                  setErrors((er) => ({ ...er, regNo: undefined }));
                }}
                placeholder="ABC-123"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 ${errors.regNo ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.regNo && <p className="text-red-500 text-xs mt-1">{errors.regNo}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }));
                  setErrors((er) => ({ ...er, name: undefined }));
                }}
                placeholder="Muhammad Ali Khan"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 ${errors.name ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.mobile}
                onChange={handleMobile}
                placeholder="03001234567"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 ${errors.mobile ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
              <p className="text-xs text-gray-400 mt-1">Must be registered with your CNIC. You will receive an OTP here.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IBAN Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.iban}
                onChange={handleIBAN}
                placeholder="PK00XXXX0000000000000000"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-green-500 ${errors.iban ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.iban && <p className="text-red-500 text-xs mt-1">{errors.iban}</p>}
              <p className="text-xs text-gray-400 mt-1">24 characters. Found on your cheque book. Must match the name on bike registration.</p>
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors text-sm mt-2"
            >
              Start Guided Registration →
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Your data is used only for this registration. Nothing is stored permanently.
        </p>
      </div>
    </div>
  );
}
