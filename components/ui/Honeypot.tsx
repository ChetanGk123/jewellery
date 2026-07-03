type Props = {
  /** Current decoy value (should always stay "" for real users). */
  value: string;
  /** Receives whatever a bot types into the decoy field. */
  onChange: (value: string) => void;
  /** Field name — pick something a bot would want to autofill. */
  name?: string;
};

/**
 * A spam honeypot: a text field hidden from humans (off-screen, not display
 * or `type=hidden`, which some bots skip) but visible to naive form-filling
 * bots. Real users never touch it, so a non-empty value on submit flags abuse.
 * The server (`submitCheckout`) is the enforcement point — this is only the bait.
 *
 * Accessibility: `aria-hidden` + `tabIndex={-1}` keep it out of the tab order
 * and off assistive tech; `autoComplete="off"` stops password managers filling it.
 */
export function Honeypot({ value, onChange, name = "company" }: Props) {
  return (
    <div
      aria-hidden="true"
      className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden"
    >
      <label htmlFor={name}>Company (leave this empty)</label>
      <input
        id={name}
        name={name}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
