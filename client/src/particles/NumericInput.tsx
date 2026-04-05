import React from "react";
import { TextInputProps } from "react-native";
import { Input } from "./Input";

interface NumericInputProps extends Omit<
  TextInputProps,
  "value" | "onChangeText"
> {
  label?: string;
  required?: boolean;
  error?: string;
  value: number | undefined;
  onChangeValue: (value: number | undefined) => void;
}

export const NumericInput = ({
  label,
  required,
  error,
  value,
  onChangeValue,
  ...props
}: NumericInputProps) => {
  const [textValue, setTextValue] = React.useState(
    value !== undefined ? String(value) : "",
  );

  // Sync external value changes (e.g., reset to undefined or parent-driven update)
  React.useEffect(() => {
    if (value === undefined) {
      setTextValue("");
    } else {
      const parsed = parseFloat(textValue);
      if (isNaN(parsed) || parsed !== value) {
        setTextValue(String(value));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to external value changes
  }, [value]);

  const handleChange = (text: string) => {
    // Allow intermediate states like "74." or "74.0" while typing
    let cleaned = text.replace(/[^0-9.]/g, "");
    // Allow at most one decimal point
    const dotIndex = cleaned.indexOf(".");
    if (dotIndex !== -1) {
      cleaned =
        cleaned.slice(0, dotIndex + 1) +
        cleaned.slice(dotIndex + 1).replace(/\./g, "");
    }
    setTextValue(cleaned);
    const num = parseFloat(cleaned);
    onChangeValue(isNaN(num) ? undefined : num);
  };

  return (
    <Input
      label={label}
      required={required}
      error={error}
      value={textValue}
      onChangeText={handleChange}
      keyboardType="decimal-pad"
      {...props}
    />
  );
};
