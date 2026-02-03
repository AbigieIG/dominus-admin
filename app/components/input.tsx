import React from "react";

type Pros = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  id?: string;
  required?: boolean;
};

const Input = ({ label, name, type="text", placeholder="", id, required = false }: Pros) => {
  return (
    <div className="flex flex-col space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        id={id}
        placeholder={placeholder}
        required={required}
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
      />
    </div>
  );
};

export default Input;
