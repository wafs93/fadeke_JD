import { ScamChecker } from "@/components/scam/ScamChecker";

export default function ScamCheckPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold">Scam check</h1>
        <p className="mt-1 text-sm text-muted">
          Found a job on WhatsApp, Telegram or social media? Paste it here to look for common scam signs.
        </p>
      </div>
      <ScamChecker />
    </div>
  );
}
