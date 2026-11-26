import type { CognitiveContext } from "../../types";
import { CTX } from "../../lib/domain";
import type { OrderRule } from "../../lib/order";
import { RULE_COPY } from "../../lib/order";
import { Card } from "../Card";
import styles from "./HowOrderWorks.module.css";

const ROWS: { rule: OrderRule; ctx: CognitiveContext; title: string }[] = [
  { rule: "high", ctx: "fatigue", title: "High load or fatigue" },
  { rule: "normal", ctx: "deep_focus", title: "Normal load" },
  { rule: "low", ctx: "recovering", title: "Low load" },
];

/** The three ordering rules, with the one in force marked. */
export function HowOrderWorks({ current, bare = false }: { current: OrderRule | null; bare?: boolean }) {
  const list = (
    <ul className={styles.list}>
      {ROWS.map((r) => {
        const Icon = CTX[r.ctx].icon;
        const on = r.rule === current;
        return (
          <li key={r.rule} data-ctx={r.ctx} className={on ? styles.on : undefined} aria-current={on || undefined}>
            <span className={styles.icon} aria-hidden="true">
              <Icon size={16} />
            </span>
            <span>
              <b>{r.title}</b>
              {on && <span className={styles.now}> · now</span>}
              <br />
              <span className={styles.muted}>{RULE_COPY[r.rule]}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
  if (bare) return list;
  return (
    <Card title="How the order works" titleId="how-order-title">
      {list}
    </Card>
  );
}
