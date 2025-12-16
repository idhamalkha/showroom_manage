import React, { useState, useRef, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
import './HRModals.css';

interface HRDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  label?: string;
  placeholder?: string;
}

export default function HRDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  label = 'Select Date',
  placeholder = 'Pick a date'
}: HRDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      try {
        return new Date(value + 'T00:00:00').getFullYear();
      } catch {
        return new Date().getFullYear();
      }
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      try {
        return new Date(value + 'T00:00:00').getMonth();
      } catch {
        return new Date().getMonth();
      }
    }
    return new Date().getMonth();
  });
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 0 });

  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update position function
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    updatePosition();
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  // Track scroll to keep popover in sync with button position
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
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen]);

  function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function firstDayIndex(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }

  function isDateDisabled(year: number, month: number, day: number): boolean {
    const dateStr = `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    
    return false;
  }

  const days = daysInMonth(viewYear, viewMonth);
  const firstIdx = firstDayIndex(viewYear, viewMonth);
  const weeks: (number | null)[] = [];

  // Populate grid
  for (let i = 0; i < firstIdx; i++) weeks.push(null);
  for (let d = 1; d <= days; d++) weeks.push(d);
  while (weeks.length % 7 !== 0) weeks.push(null);

  function selectDay(day: number) {
    const year = String(viewYear).padStart(4, '0');
    const month = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
    onChange(dateStr);
    setIsOpen(false);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return placeholder;
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      };
      return date.toLocaleDateString('id-ID', options);
    } catch {
      return dateStr;
    }
  }

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      viewMonth === today.getMonth() &&
      viewYear === today.getFullYear()
    );
  };

  return (
    <div className="hr-date-picker-wrapper">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hr-date-picker-button"
      >
        <span>{formatDate(value)}</span>
        <FiCalendar size={18} />
      </button>

      {isOpen && (
        <div ref={pickerRef} className="hr-date-picker-popover" style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}>
          {/* Header with month/year navigation */}
          <div className="hr-date-picker-header">
            <div>
              <button
                type="button"
                onClick={prevMonth}
                className="hr-date-picker-select"
                style={{ padding: '0.5rem', minWidth: '2.5rem' }}
              >
                <FiChevronLeft size={16} style={{ margin: '0 auto' }} />
              </button>
            </div>
            <div style={{ flex: 2 }}>
              <div style={{ fontWeight: '700', color: '#1a2638', fontSize: '0.95rem', textAlign: 'center' }}>
                {months[viewMonth]} {viewYear}
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={nextMonth}
                className="hr-date-picker-select"
                style={{ padding: '0.5rem', minWidth: '2.5rem' }}
              >
                <FiChevronRight size={16} style={{ margin: '0 auto' }} />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="hr-date-picker-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="hr-date-picker-weekday">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="hr-date-picker-days">
            {weeks.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="hr-date-picker-day disabled" />;
              }

              const dateStr = `${String(viewYear).padStart(4, '0')}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = dateStr === value;
              const isDisabled = isDateDisabled(viewYear, viewMonth, day);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => !isDisabled && selectDay(day)}
                  className={`hr-date-picker-day ${isSelected ? 'selected' : ''} ${isTodayDate && !isSelected ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
                  disabled={isDisabled}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
