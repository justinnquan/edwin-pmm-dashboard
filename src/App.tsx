import { lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";

/* Route-level code-splitting: each page (and its Recharts usage) loads on
   demand behind the Layout's Suspense fallback, keeping the initial chunk lean. */
const ExecutiveOverview = lazy(() => import("./pages/ExecutiveOverview"));
const MarketingPerformance = lazy(() => import("./pages/MarketingPerformance"));
const CampaignImpact = lazy(() => import("./pages/CampaignImpact"));
const CampaignPicker = lazy(() =>
  import("./pages/CampaignImpact").then((m) => ({ default: m.CampaignPicker }))
);
const ActivityTimeline = lazy(() => import("./pages/ActivityTimeline"));
const CampaignCalendar = lazy(() => import("./pages/CampaignCalendar"));
const AdoptionEngagement = lazy(() => import("./pages/AdoptionEngagement"));
const Segments = lazy(() => import("./pages/Segments"));

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
