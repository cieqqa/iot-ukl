import { CONFIG, STAGES } from "@/lib/config";

type StagesProps = {
  activeStage: number;
};

export default function Stages({ activeStage }: StagesProps) {
  return (
    <section className="band" id="tahap">
      <h2>Tahapan fermentasi</h2>
      <div className="stages">
        {STAGES.map((stage, index) => {
          const startHour = Math.round(stage.from * CONFIG.targetHours);
          const endHour = Math.round(
            (STAGES[index + 1]?.from ?? 1) * CONFIG.targetHours,
          );
          const className = [
            "stage",
            index === activeStage ? "now" : "",
            index < activeStage ? "done" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const label =
            index === activeStage
              ? "Sekarang"
              : index === STAGES.length - 1
                ? `≥ ${startHour} jam`
                : `${startHour}–${endHour} jam`;

          return (
            <div className={className} key={stage.name}>
              <h3>{stage.name}</h3>
              <p>{stage.description}</p>
              <span className="ic">{stage.icon}</span>
              <span className="tag">{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
