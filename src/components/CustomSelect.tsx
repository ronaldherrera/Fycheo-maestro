import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
  icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  disabled = false,
  className = "",
  dropdownClassName = "",
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="custom-select-container">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`custom-select-trigger ${className}`}
      >
        <div className="custom-select-trigger-content">
          {icon && <span className="custom-select-icon-left">{icon}</span>}
          {selectedOption?.icon && <span className="custom-select-icon-left">{selectedOption.icon}</span>}
          <span className="custom-select-text-label">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={15}
          className={`custom-select-arrow ${isOpen ? "open" : ""}`}
        />
      </button>

      {isOpen && (
        <div className={`custom-select-dropdown ${dropdownClassName}`}>
          <div className="custom-select-options-list">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`custom-select-option-item ${isSelected ? "selected" : ""}`}
                >
                  <div className="custom-select-option-content">
                    {opt.icon && <span className="custom-select-option-icon">{opt.icon}</span>}
                    <div className="custom-select-option-text">
                      <span className="custom-select-option-title">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="custom-select-option-subtitle">{opt.sublabel}</span>
                      )}
                    </div>
                  </div>
                  {isSelected && <span className="custom-select-selected-indicator" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
