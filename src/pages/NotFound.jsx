import { useSEO } from "../lib/seo.js";
import { Button } from "../components/ui/Button.jsx";

export function NotFound() {
  useSEO({ title: "Page Not Found" });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="font-heading text-6xl font-bold text-torays-red">404</p>
      <p className="text-torays-text-secondary">This page doesn't exist.</p>
      <Button href="/">Back to Home</Button>
    </div>
  );
}
