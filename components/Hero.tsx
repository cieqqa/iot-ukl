type HeroProps = {
  estimate: string;
};

export default function Hero({ estimate }: HeroProps) {
  return (
    <section className="hero">
      <div>
        <h1>
          Pantau tape, tahu kapan <em>matang</em>
        </h1>
        <p>
          Sensor suhu, kelembapan, dan gas alkohol memantau fermentasi tapemu.
          Peram memperkirakan kapan tape siap disajikan.
        </p>
        <a className="cta" href="#pantau">
          Lihat pantauan <span className="arrow">↗</span>
        </a>
      </div>
      <div className="visual">
        <svg
          className="swoosh"
          viewBox="0 0 520 420"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M60 330C20 230 120 60 300 40"
            stroke="#ecc97f"
            strokeWidth="46"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M330 400C420 390 500 330 510 230"
            stroke="#ecc97f"
            strokeWidth="40"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <div className="jarcard">
          <svg viewBox="0 0 300 340" aria-hidden="true">
            <rect
              x="82"
              y="26"
              width="136"
              height="26"
              rx="9"
              fill="#12151a"
              opacity=".85"
            />
            <rect
              x="66"
              y="48"
              width="168"
              height="270"
              rx="34"
              fill="#fff"
              opacity=".5"
              stroke="#fff"
              strokeWidth="5"
            />
            <path
              d="M72 150c30-14 60 14 90 0s52-12 66 0v132a30 30 0 0 1-30 30H102a30 30 0 0 1-30-30z"
              fill="#fff6dd"
            />
            <g fill="#fff" opacity=".9">
              <circle className="bub" cx="108" cy="270" r="9" />
              <circle className="bub" cx="150" cy="290" r="6" />
              <circle className="bub" cx="190" cy="262" r="10" />
              <circle className="bub" cx="128" cy="236" r="5" />
              <circle className="bub" cx="176" cy="300" r="7" />
              <circle className="bub" cx="100" cy="300" r="5" />
            </g>
            <ellipse cx="116" cy="92" rx="9" ry="34" fill="#fff" opacity=".6" />
          </svg>
        </div>
        <div className="note">
          <small>Perkiraan matang</small>
          <strong>{estimate}</strong>
        </div>
        <svg
          className="mascot"
          viewBox="0 0 120 120"
          aria-hidden="true"
        >
          <path
            d="M60 4c4 8 2 14-2 20"
            stroke="#52806d"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M60 22c-30 0-48 20-48 46 0 24 16 40 48 40s48-16 48-40c0-26-18-46-48-46z"
            fill="#8dbcab"
          />
          <ellipse cx="38" cy="70" rx="7" ry="9" fill="#fff" />
          <ellipse cx="82" cy="70" rx="7" ry="9" fill="#fff" />
          <circle cx="39" cy="72" r="4" fill="#12151a" />
          <circle cx="83" cy="72" r="4" fill="#12151a" />
          <path
            d="M50 88c6 6 14 6 20 0"
            stroke="#12151a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </section>
  );
}
