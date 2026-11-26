import type { KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { PlaybackControlsProps, PlaybackSpeed } from "../../types/ui";
import { mmss } from "../../lib/format";
import { Button } from "../Button";
import { SegmentedControl } from "../SegmentedControl";
import styles from "./PlaybackControls.module.css";

const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 10];
const SPEED_KEYS: Record<string, PlaybackSpeed> = { "1": 1, "2": 2, "5": 5, "0": 10 };

function spoken(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m} minute${m === 1 ? "" : "s"} ${s} second${s === 1 ? "" : "s"}`;
}

/**
 * Replay keyboard shortcuts: Space plays and pauses, arrows step, Home and End jump,
 * and 1, 2, 5, 0 set the speed. Attach to the replay card's onKeyDown.
 */
export function handlePlaybackKey(e: KeyboardEvent, p: PlaybackControlsProps) {
  const target = e.target as HTMLElement;
  const inRange = target instanceof HTMLInputElement && target.type === "range";
  if (e.key === " " && !(target instanceof HTMLButtonElement)) {
    e.preventDefault();
    p.onPlayPause();
  } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !inRange) {
    e.preventDefault();
    p.onStep(e.key === "ArrowLeft" ? -1 : 1);
  } else if ((e.key === "Home" || e.key === "End") && !inRange) {
    e.preventDefault();
    p.onJump(e.key === "Home" ? "start" : "end");
  } else if (e.key in SPEED_KEYS && !e.metaKey && !e.ctrlKey && !e.altKey) {
    p.onSpeed(SPEED_KEYS[e.key]);
  }
}

/** Transport for replay: scrubber, start, step, play/pause, step, end, time and speed. */
export function PlaybackControls(props: PlaybackControlsProps) {
  const { playing, position, duration, speed, onPlayPause, onStep, onJump, onSeek, onSpeed } = props;
  const frac = duration ? Math.max(0, Math.min(1, position / duration)) : 0;
  const pauseIfPlaying = () => {
    if (playing) onPlayPause();
  };

  return (
    <div className={styles.playback} onKeyDown={(e) => handlePlaybackKey(e, props)}>
      <div className={styles.scrub}>
        <span className={styles.rail} />
        <span className={styles.fill} style={{ width: `${(frac * 100).toFixed(2)}%` }} />
        <input
          type="range"
          className={styles.input}
          min={0}
          max={Math.max(1, Math.round(duration))}
          step={2}
          value={Math.round(position)}
          aria-label="Playback position"
          aria-valuetext={`${spoken(position)} of ${Math.round(duration / 60)} minutes`}
          onPointerDown={pauseIfPlaying}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.btns}>
          <Button variant="ghost" iconOnly icon={SkipBack} aria-label="Jump to start" onClick={() => onJump("start")} />
          <Button variant="ghost" iconOnly icon={ChevronLeft} aria-label="Step back 2 seconds" onClick={() => onStep(-1)} />
          <button type="button" className={styles.play} aria-label={playing ? "Pause" : "Play"} onClick={onPlayPause}>
            {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
          </button>
          <Button variant="ghost" iconOnly icon={ChevronRight} aria-label="Step forward 2 seconds" onClick={() => onStep(1)} />
          <Button variant="ghost" iconOnly icon={SkipForward} aria-label="Jump to end" onClick={() => onJump("end")} />
        </div>
        <span className={styles.time}>
          <b>{mmss(position)}</b> / {mmss(duration)}
        </span>
        <SegmentedControl
          size="sm"
          numeric
          label="Playback speed"
          options={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
          value={String(speed)}
          onChange={(v) => onSpeed(Number(v) as PlaybackSpeed)}
        />
      </div>
    </div>
  );
}
