import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import RegistrationPage from "@/pages/RegistrationPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RegistrationPage />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
