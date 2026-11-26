import { createContext, useContext } from "react";

export type Layout = "desktop" | "rail" | "mobile";

export interface ShellApi {
  layout: Layout;
  /** Mobile sub-pages (History, Settings under More) go back here. */
  onBack?: () => void;
  openNotifications: () => void;
  /** New directives since the list was last opened. */
  unseen: number;
}

export const ShellContext = createContext<ShellApi>({ layout: "desktop", openNotifications: () => {}, unseen: 0 });
export const useShell = () => useContext(ShellContext);
