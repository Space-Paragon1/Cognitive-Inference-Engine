/* Phones keep History inside Insights behind a Week | History switch. */
import { navigate } from "../../lib/router";
import { SegmentedControl } from "../../components/SegmentedControl";

export function InsightsSwitch({ value }: { value: "week" | "history" }) {
  return (
    <SegmentedControl
      block
      label="Insights view"
      options={[
        { value: "week", label: "Week" },
        { value: "history", label: "History" },
      ]}
      value={value}
      onChange={(v) => navigate(v === "week" ? "insights" : "history", null, { replace: true })}
    />
  );
}
