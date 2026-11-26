Difficulty as shape, not colour: 1, 2 or 3 bars for easy, medium and hard, and a book for review.

**Maps to** the difficulty badge in `TaskQueue`. Props: `DifficultyChipProps`.

## Use
- Always icon plus word: "Easy", "Medium", "Hard", "Review".
- Neutral styling (`--surface-sunken` fill, `--ink-muted` text). Difficulty isn't a warning, so it gets no warm or red colour.
- In the add-task form, difficulty is a `SegmentedControl` with the same four words.

## Accessibility
The bars are decorative (`aria-hidden`); the word carries the meaning.
