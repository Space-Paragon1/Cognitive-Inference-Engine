import { Construction } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { Page } from "../components/Shell";

/** Temporary stand-in while the screens are ported (phase 5). */
export function Placeholder({ title }: { title: string }) {
  return (
    <Page title={title}>
      <EmptyState icon={Construction} title={`${title} is on its way`} body="This screen is being rebuilt in the new design." />
    </Page>
  );
}
