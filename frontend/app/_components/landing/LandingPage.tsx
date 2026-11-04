import type { User } from "@/lib/api/types";
import ClaimScene from "./ClaimScene";
import Footer from "./Footer";
import Header from "./Header";
import Hero from "./Hero";
import Lanes from "./Lanes";
import LandingMotion from "./LandingMotion";
import LiedScene from "./LiedScene";
import SafetyControls from "./SafetyControls";
import TryIt from "./TryIt";
import WhereAiStops from "./WhereAiStops";

// Server component. Every section renders its finished state in the HTML;
// LandingMotion adds scroll motion after hydration where it is allowed.
export default function LandingPage({ user }: { user: User | null }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-paper text-ink">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header user={user} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Hero />
        <ClaimScene />
        <LiedScene />
        <WhereAiStops />
        <Lanes />
        <SafetyControls />
        <TryIt />
      </main>
      <Footer />
      <LandingMotion />
    </div>
  );
}
