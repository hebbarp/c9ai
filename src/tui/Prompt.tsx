import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export interface PromptProps {
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function Prompt({ disabled, value, onChange, onSubmit }: PromptProps) {
  if (disabled) {
    return (
      <Box>
        <Text color="gray">{'> '}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="cyan">{'> '}</Text>
      <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
    </Box>
  );
}
