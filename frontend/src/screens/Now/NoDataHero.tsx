import { ArrowRight } from "lucide-react";
import { usePairing } from "../../live/usePairing";
import { navigate } from "../../lib/router";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { LoadGauge } from "../../components/LoadGauge";
import { SourceCard } from "../../components/SourceCard";
import type { SourceKind } from "../../types/ui";
import styles from "./NoDataHero.module.css";

/** No data yet: an empty gauge (a dash, never 0%) and the first step to connect a source. */
export function NoDataHero({ mobile = false }: { mobile?: boolean }) {
  const pairing = usePairing();
  const card = (kind: SourceKind, recommended = false) => (
    <SourceCard
      key={kind}
      kind={kind}
      state={pairing.stateFor(kind)}
      code={pairing.waiting?.kind === kind ? pairing.waiting.code : undefined}
      codeExpiresIn={pairing.waiting?.kind === kind ? pairing.codeExpiresIn : undefined}
      recommended={recommended}
      primary={recommended}
      connecting={pairing.connecting === kind}
      lastSeen={pairing.lastSeen(kind)}
      onConnect={() => pairing.connect(kind)}
      onCancel={pairing.cancel}
    />
  );

  return (
    <>
      <section className={[styles.hero, mobile && styles.mobile].filter(Boolean).join(" ")} aria-labelledby="nodata-title" data-ctx="unknown">
        <LoadGauge load={null} context="unknown" confidence={0} size={mobile ? 180 : 240} />
        <div className={styles.text}>
          {!mobile && <p className={styles.overline}>No data yet</p>}
          <h2 id="nodata-title" className={styles.title}>
            Connect a source to see your load
          </h2>
          <p className={styles.body}>
            {mobile
              ? "CLR reads how you work, not what you work on."
              : "CLR reads how you work, not what you work on. The browser extension takes about a minute to set up, and the dashboard comes alive as soon as it sends its first signal."}
          </p>
          <div className={styles.actions}>
            <Button iconRight={ArrowRight} block={mobile} loading={pairing.connecting === "browser"} onClick={() => pairing.connect("browser")}>
              {mobile ? "Connect a source" : "Connect the browser extension"}
            </Button>
            {!mobile && (
              <Button variant="ghost" onClick={() => navigate("settings", "sources")}>
                See all sources
              </Button>
            )}
          </div>
        </div>
      </section>
      {pairing.failed && (
        <Banner tone="critical" title="Couldn't create a pairing code." body="Check your connection." action={{ label: "Retry", onClick: () => pairing.connect("browser") }} />
      )}
      <div className={styles.sources}>
        {card("browser", true)}
        {card("vscode")}
      </div>
    </>
  );
}
