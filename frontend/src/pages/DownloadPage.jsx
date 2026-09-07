import GlassCard from "../components/GlassCard";
import { IconSmartphone } from "../components/Icons";

export default function DownloadPage() {
  return (
    <div className="page-center">
      <GlassCard className="download-card">
        <IconSmartphone className="feature-icon" size={34} />
        <h1>Aplicação móvel</h1>
        <p className="text-secondary">
          A app nativa para iOS e Android ainda está em desenvolvimento. Por
          agora, esta plataforma funciona diretamente no browser do telemóvel
          — basta acederes ao mesmo site a partir do teu telemóvel.
        </p>

        <div className="store-badges">
          <button className="glass-button glass-button-secondary" disabled>
             App Store — brevemente
          </button>
          <button className="glass-button glass-button-secondary" disabled>
             Google Play — brevemente
          </button>
        </div>

        <p className="text-secondary" style={{ marginTop: 16, fontSize: "0.85rem" }}>
          Queres ser avisado quando estiver disponível? Regista-te e falamos.
        </p>
      </GlassCard>
    </div>
  );
}
