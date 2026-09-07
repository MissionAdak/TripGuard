import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ChaosSimulator from "./pages/ChaosSimulator";
import TravelerDashboard from "./pages/TravelerDashboard";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/operations" element={<ChaosSimulator />} />
            <Route path="/operations/:itinId" element={<ChaosSimulator />} />
            <Route path="/traveler" element={<TravelerDashboard />} />
            <Route path="/traveler/:itinId" element={<TravelerDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
