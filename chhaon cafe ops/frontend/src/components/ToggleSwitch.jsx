/** Button-based toggle — instant visual state, no peer/checkbox fighting on slow networks. */
const ToggleSwitch = ({ active, onToggle, disabled = false, size = "sm", testId }) => (
  <button
    type="button"
    role="switch"
    aria-checked={active}
    disabled={disabled}
    data-testid={testId}
    onClick={onToggle}
    className={`toggle-track toggle-track-${size} shrink-0 ${active ? "is-on" : ""} ${disabled ? "opacity-60" : ""}`}
  >
    <span />
  </button>
);

export default ToggleSwitch;
