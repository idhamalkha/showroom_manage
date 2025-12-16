import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import './HRModals.css';

interface DropdownOption {
  value: string | number;
  label: string;
}

interface HRDropdownProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: DropdownOption[];
  placeholder?: string;
  label?: string;
}

export default function HRDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  label = 'Select'
}: HRDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update position function
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  };

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    updatePosition();
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  // Track scroll to keep dropdown in sync with button position
  useEffect(() => {
    if (!isOpen) return;

    function handleScroll() {
      updatePosition();
    }

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption?.label || placeholder;

  return (
    <div className="hr-dropdown-wrapper">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hr-dropdown-button"
      >
        <span>{displayText}</span>
        <FiChevronDown size={18} className={isOpen ? 'open' : ''} />
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="hr-dropdown-menu" style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px`, width: `${dropdownPos.width}px`, maxWidth: `${dropdownPos.width}px`, minWidth: `${dropdownPos.width}px` }}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`hr-dropdown-item ${value === option.value ? 'selected' : ''}`}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
