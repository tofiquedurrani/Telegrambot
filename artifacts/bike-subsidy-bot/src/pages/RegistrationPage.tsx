import { useState } from "react";
import DataForm from "@/components/DataForm";
import GuidedMode from "@/components/GuidedMode";

export interface UserData {
  cnic: string;
  regNo: string;
  name: string;
  mobile: string;
  iban: string;
}

export default function RegistrationPage() {
  const [userData, setUserData] = useState<UserData | null>(null);

  if (userData) {
    return <GuidedMode userData={userData} onBack={() => setUserData(null)} />;
  }

  return <DataForm onSubmit={setUserData} />;
}
