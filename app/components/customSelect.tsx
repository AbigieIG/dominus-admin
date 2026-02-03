import { useEffect, useState } from "react";

interface CustomSelectProps {
  id: string;
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}

export default function CustomSelect({
  id,
  name,
  value,
  onChange,
  required,
  placeholder,
  options,
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || "");
  const [selectedLabel, setSelectedLabel] = useState("");

  useEffect(() => {
    if (value) {
      const option = options.find((opt) => opt.value === value);
      if (option) {
        setSelectedValue(value);
        setSelectedLabel(option.label);
      }
    }
  }, [value, options]);

  const handleSelect = (optionValue: string, optionLabel: string) => {
    setSelectedValue(optionValue);
    setSelectedLabel(optionLabel);
    setIsOpen(false);
    if (onChange) {
      onChange(optionValue);
    }
  };

  return (
    <div className="relative">
      <input
        type="hidden"
        name={name}
        value={selectedValue}
        required={required}
      />
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-left bg-white ${className}`}
      >
        <span className={selectedValue ? "text-gray-900" : "text-gray-500"}>
          {selectedLabel || placeholder}
        </span>
        <svg
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[300] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value, option.label)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
