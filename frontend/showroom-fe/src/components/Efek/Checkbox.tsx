import React from "react";
import "./Checkbox.css";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
};

export default function SelectableCheckbox({ checked, onChange, id, ariaLabel, disabled, className }: Props) {
  return (
    <label className={`select-checkbox ${className ?? ""}`} aria-label={ariaLabel}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="select-box" aria-hidden />
    </label>
  );
}