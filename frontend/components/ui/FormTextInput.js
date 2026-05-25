import React, { useState, useEffect, forwardRef } from "react";
import { TextInput } from "react-native";

export const FormTextInput = React.memo(
  forwardRef(({ value, onChangeText, id, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChangeText = (text) => {
      setLocalValue(text);
      if (onChangeText) {
        if (id !== undefined) {
          onChangeText(text, id);
        } else {
          onChangeText(text);
        }
      }
    };

    return (
      <TextInput
        ref={ref}
        value={localValue}
        onChangeText={handleChangeText}
        {...props}
      />
    );
  })
);

export default FormTextInput;
