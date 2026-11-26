import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { ButtonProps as ContractProps } from "../../types/ui";
import { Spinner } from "../Spinner";
import styles from "./Button.module.css";

export type ButtonVariant = NonNullable<ContractProps["variant"]> | "danger-ghost" | "rest-ghost";

export type ButtonProps = Omit<ContractProps, "variant" | "onClick"> &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children" | "disabled" | "onClick"> & {
    variant?: ButtonVariant;
    /** Fully rounded (the play and pause buttons). */
    round?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  };

const VARIANT: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
  rest: styles.rest,
  "danger-ghost": styles.dangerGhost,
  "rest-ghost": styles.restGhost,
};

const ICON_SIZE = { sm: 16, md: 18, lg: 20 } as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    icon: IconLeft,
    iconRight: IconRight,
    iconOnly = false,
    block = false,
    loading = false,
    loadingLabel,
    disabled = false,
    pressed,
    type = "button",
    round = false,
    className,
    onClick,
    ...rest
  },
  ref
) {
  const label = typeof children === "string" ? children : undefined;
  const iconSize = ICON_SIZE[size];
  const classes = [
    styles.btn,
    VARIANT[variant],
    size !== "md" && styles[size],
    block && styles.block,
    iconOnly && styles.iconOnly,
    round && styles.round,
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = iconOnly ? (
    IconLeft ? <IconLeft size={iconSize} aria-hidden="true" /> : null
  ) : (
    <>
      {IconLeft && <IconLeft size={iconSize} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
    </>
  );

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-pressed={pressed}
      aria-label={iconOnly ? rest["aria-label"] ?? label : rest["aria-label"]}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      {loading || loadingLabel ? (
        <span className={styles.stack}>
          <span className={loading ? styles.hidden : undefined} aria-hidden={loading || undefined}>
            {content}
          </span>
          <span className={loading ? undefined : styles.hidden} aria-hidden={!loading || undefined}>
            <Spinner />
            {!iconOnly && (loadingLabel ?? children)}
          </span>
        </span>
      ) : (
        content
      )}
    </button>
  );
});
