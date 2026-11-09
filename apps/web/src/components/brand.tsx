import { PortalMark } from "./portal-mark";
import { Wordmark } from "./wordmark";
import styles from "./brand.module.css";

/** One shared lockup for website chrome and the dungeon HUD. */
export function Brand({ compact = false, onDark = false }: {
  compact?: boolean;
  onDark?: boolean;
}) {
  return (
    <span className={`${styles.brand} ${compact ? styles.compact : ""} ${onDark ? styles.onDark : ""}`}>
      <span className={styles.mark}><PortalMark size={compact ? 28 : 40} /></span>
      <Wordmark className={styles.name} />
      <span className="sr-only">ConQuest</span>
    </span>
  );
}
