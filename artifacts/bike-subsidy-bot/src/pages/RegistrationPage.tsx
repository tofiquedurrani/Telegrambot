import { useState } from "react";
import DataForm from "@/components/DataForm";
import BotRunner from "@/components/BotRunner";

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
    return <BotRunner userData={userData} onBack={() => setUserData(null)} />;
  }

  return <DataForm onSubmit={setUserData} />;
}
