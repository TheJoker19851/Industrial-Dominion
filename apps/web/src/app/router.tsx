import { Routes, Route } from 'react-router-dom';
import { AppShell } from './shell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { MarketPage } from '@/features/market/MarketPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
