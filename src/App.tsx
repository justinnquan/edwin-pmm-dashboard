import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import ExecutiveOverview from "./pages/ExecutiveOverview";
import MarketingPerformance from "./pages/MarketingPerformance";
import CampaignImpact, { CampaignPicker } from "./pages/CampaignImpact";
import ActivityTimeline from "./pages/ActivityTimeline";
import CampaignCalendar from "./pages/CampaignCalendar";
import AdoptionEngagement from "./pages/AdoptionEngagement";
import Segments from "./pages/Segments";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ExecutiveOverview />} />
          <Route path="/marketing" element={<MarketingPerformance />} />
          <Route path="/campaign" element={<CampaignPicker />} />
          <Route path="/campaign/:id" element={<CampaignImpact />} />
          <Route path="/timeline" element={<ActivityTimeline />} />
          <Route path="/adoption" element={<AdoptionEngagement />} />
          <Route path="/segments" element={<Segments />} />
          <Route path="/calendar" element={<CampaignCalendar />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
