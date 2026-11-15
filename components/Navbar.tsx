import type { ConnectionStatus } from "@/lib/types";

type NavbarProps = {
  connection: ConnectionStatus;
  connectionText: string;
};

export default function Navbar({
  connection,
  connectionText,
}: NavbarProps) {
  return (
    <header className="nav">
      <a className="logo" href="#" aria-label="Peram, kembali ke atas">
        <svg viewBox="0 0 38 30" aria-hidden="true">
          <rect width="38" height="30" rx="15" fill="#ecc97f" />
          <circle cx="12" cy="13" r="2.4" fill="#12151a" />
          <circle cx="26" cy="13" r="2.4" fill="#12151a" />
          <path
            d="M11 19c3 4 13 4 16 0"
            stroke="#12151a"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <b>peram</b>
      </a>
      <nav aria-label="Navigasi utama">
        <a href="#pantau">Pantau</a>
        <a href="#prediksi">Prediksi</a>
        <a href="#tahap">Tahapan</a>
        <a href="#riwayat">Riwayat</a>
      </nav>
      <span className={`pill ${connection}`}>
        <i />
        <span>{connectionText}</span>
      </span>
    </header>
  );
}
