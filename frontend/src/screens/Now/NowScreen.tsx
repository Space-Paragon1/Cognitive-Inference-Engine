import { useState } from "react";
import { WifiOff } from "lucide-react";
import { useGaugeState, useLive, useSources } from "../../live/LiveState";
import { useSettings } from "../../live/SettingsState";
import { useDirectiveCards } from "../../live/useDirectiveCards";
import { useToday } from "../../live/useToday";
import { CTX } from "../../lib/domain";
import { longDate, minutes } from "../../lib/format";
import { greeting } from "../../lib/order";
import { BottomSheet } from "../../components/BottomSheet";
import { Breakdown } from "../../components/Breakdown";
import { Card } from "../../components/Card";
import { ConnectionStatus } from "../../components/ConnectionStatus";
import { DirectivesFeed } from "../../components/DirectivesFeed/DirectiveCard";
import { Confidence, LoadGauge } from "../../components/LoadGauge";
import { Cell, ConnectionBanner, DndButton, Grid, Page, StartFocusButton, useShell } from "../../components/Shell";
import { Skeleton, SkeletonLines, SkeletonRegion, SkeletonRow } from "../../components/Skeleton";
import { NoDataHero } from "./NoDataHero";
import { QuickActions } from "./QuickActions";
import { TodayCard } from "./TodayCard";
import { UpNextCard } from "./UpNextCard";
import styles from "./NowScreen.module.css";

export function NowScreen() {
  const { layout } = useShell();
  const mobile = layout === "mobile";
  const g = useGaugeState();
  const noData = g.load == null && !g.loading;
  const { today } = useToday();
  const [allOpen, setAllOpen] = useState(false);

  const sub = noData
    ? "Let’s get your first reading"
    : `${longDate()}${today && today.focusMinutes > 0 ? ` · ${minutes(today.focusMinutes)} of focus so far` : ""}`;

  const actions = noData ? (
    <>
      <span className={styles.noSources}>
        <WifiOff size={14} aria-hidden="true" />
        No sources
      </span>
      <DndButton />
      <StartFocusButton />
    </>
  ) : undefined;

  const directives = <Directives onViewAll={() => setAllOpen(true)} />;

  let body;
  if (noData) {
    body = mobile ? (
      <div className={styles.stack}>
        <NoDataHero mobile />
        <QuickActions grid />
        <UpNextCard />
      </div>
    ) : (
      <Grid>
        <Cell span={8}>
          <NoDataHero />
        </Cell>
        <Cell span={4} tablet={8}>
          {directives}
          <UpNextCard />
          <QuickActions />
        </Cell>
      </Grid>
    );
  } else if (mobile) {
    body = (
      <div className={styles.stack}>
        <SkeletonRegion loading={g.loading} label="Loading your load" fallback={<MobileHeroSkeleton />}>
          <MobileHero />
        </SkeletonRegion>
        <QuickActions grid />
        <Card title="What makes up your load" titleId="breakdown-title">
          <LiveBreakdown />
        </Card>
        {directives}
        <UpNextCard />
        <TodayCard />
      </div>
    );
  } else {
    body = (
      <Grid>
        <Cell span={8}>
          <SkeletonRegion loading={g.loading} label="Loading your load" fallback={<HeroSkeleton />}>
            <Hero size={layout === "desktop" ? 280 : 240} />
          </SkeletonRegion>
          <div className={styles.pair}>
            <QuickActions />
            <TodayCard />
          </div>
        </Cell>
        <Cell span={4} tablet={8}>
          {directives}
          <UpNextCard />
        </Cell>
      </Grid>
    );
  }

  return (
    <Page title={noData ? "Welcome" : greeting()} mobileTitle="Now" sub={sub} actions={actions} banner={<ConnectionBanner lowConfidence />}>
      {body}
      <BottomSheet open={allOpen} title="What CLR is doing" onClose={() => setAllOpen(false)}>
        <AllDirectives />
      </BottomSheet>
    </Page>
  );
}

function Directives({ onViewAll }: { onViewAll: () => void }) {
  const { cards, loading } = useDirectiveCards();
  return (
    <SkeletonRegion
      loading={loading}
      label="Loading what CLR is doing"
      fallback={
        <Card title="What CLR is doing" titleId="dir-skel">
          <SkeletonRow />
        </Card>
      }
    >
      <DirectivesFeed directives={cards} onViewAll={onViewAll} />
    </SkeletonRegion>
  );
}

function AllDirectives() {
  const { cards } = useDirectiveCards();
  return <DirectivesFeed directives={cards} bare limit={50} />;
}

/** Desktop hero: the 280px gauge, the context, its blurb, confidence and the breakdown. */
function Hero({ size }: { size: number }) {
  const g = useGaugeState();
  const { thresholds } = useSettings();
  const ctx = CTX[g.context];
  const Icon = ctx.icon;
  return (
    <section className={styles.hero} data-ctx={g.context} aria-labelledby="hero-ctx">
      <LoadGauge
        load={g.load}
        context={g.context}
        confidence={g.confidence}
        size={size}
        thresholds={thresholds}
        status={g.status}
        lastReadingAt={g.lastReadingAt}
      />
      <div className={styles.heroText}>
        <div className={[styles.ctx, g.status !== "live" && styles.stale].filter(Boolean).join(" ")}>
          <p className={styles.overline}>Right now</p>
          <h2 id="hero-ctx" className={styles.ctxName}>
            <Icon size={24} aria-hidden="true" />
            {ctx.label}
          </h2>
          <p className={styles.blurb}>{ctx.blurb}</p>
          <Confidence value={g.confidence} />
        </div>
        <hr className={styles.divider} />
        <LiveBreakdown />
      </div>
    </section>
  );
}

function MobileHero() {
  const g = useGaugeState();
  const { thresholds } = useSettings();
  const sources = useSources();
  const ctx = CTX[g.context];
  const seen = g.lastReadingAt ? (Date.now() - g.lastReadingAt) / 1000 : undefined;
  return (
    <section className={styles.mobileHero} data-ctx={g.context} aria-label="Your load right now">
      <LoadGauge
        load={g.load}
        context={g.context}
        confidence={g.confidence}
        size={220}
        thresholds={thresholds}
        status={g.status}
        lastReadingAt={g.lastReadingAt}
      />
      <p className={styles.mobileBlurb}>{ctx.blurb}</p>
      <Confidence value={g.confidence} />
      <ConnectionStatus status={g.status} sources={sources} lastSeenSeconds={seen} kinds={["browser", "vscode", "lms"]} />
    </section>
  );
}

function LiveBreakdown() {
  const b = useLive((s) => s.state?.breakdown);
  const g = useGaugeState();
  return (
    <div className={g.status !== "live" ? styles.stale : undefined}>
      <Breakdown intrinsic={b?.intrinsic} extraneous={b?.extraneous} germane={b?.germane} uncertain={g.confidence < 0.5} empty={g.load == null} />
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className={styles.hero}>
      <Skeleton shape="gauge" width={240} height={240} />
      <div className={styles.heroText}>
        <Skeleton width={120} height={14} />
        <Skeleton width={200} height={28} />
        <SkeletonLines count={2} />
        <Skeleton width="100%" height={8} radius="xs" />
        <Skeleton width="100%" height={8} radius="xs" />
        <Skeleton width="100%" height={8} radius="xs" />
      </div>
    </div>
  );
}

function MobileHeroSkeleton() {
  return (
    <div className={styles.mobileHero}>
      <Skeleton shape="gauge" width={220} height={220} />
      <Skeleton width={120} height={28} radius="md" />
      <Skeleton width="80%" height={14} />
      <Skeleton width="60%" height={14} />
    </div>
  );
}
