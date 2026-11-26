import styles from "./Spinner.module.css";

/** A small circular spinner. Decorative: pair it with text that says what is happening. */
export function Spinner({ size = 16 }: { size?: number }) {
  return <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden="true" />;
}
