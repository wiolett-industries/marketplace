import * as prompts from '@clack/prompts';
import { wrapTextWithPrefix } from '@clack/core';

export interface ConfigOption {
  value: string;
  label: string;
  hint?: string;
}

export interface ConfigSpinner {
  stop(message: string): void;
  error(message: string): void;
}

export interface ConfigCliUi {
  intro(title: string): void;
  info(message: string): void;
  note(message: string, title?: string): void;
  cancel(message: string): void;
  outro(message: string): void;
  text(message: string, options?: {
    placeholder?: string;
    initialValue?: string;
    validate?: (value: string | undefined) => string | Error | undefined;
  }): Promise<string | null>;
  password(message: string, options?: {
    validate?: (value: string | undefined) => string | Error | undefined;
  }): Promise<string | null>;
  select(message: string, options: ConfigOption[], initialValue?: string): Promise<string | null>;
  confirm(message: string, initialValue?: boolean): Promise<boolean | null>;
  spinner(message: string): ConfigSpinner;
}

export function createConfigCliUi(): ConfigCliUi {
  return {
    intro(title) {
      process.stdout.write('\n');
      prompts.intro(title);
    },
    info(message) {
      process.stdout.write(`│\n${formatGuidedMessage(message)}\n`);
    },
    note: prompts.note,
    cancel: prompts.cancel,
    outro: prompts.outro,
    async text(message, options) {
      const value = await prompts.text({ message, ...options });
      return prompts.isCancel(value) ? null : value.trim();
    },
    async password(message, options) {
      const value = await prompts.password({ message, mask: '•', ...options });
      return prompts.isCancel(value) ? null : value;
    },
    async select(message, options, initialValue) {
      const value = await prompts.select({ message, options, initialValue });
      return prompts.isCancel(value) ? null : value;
    },
    async confirm(message, initialValue) {
      const value = await prompts.confirm({ message, initialValue });
      return prompts.isCancel(value) ? null : value;
    },
    spinner(message) {
      const spinner = prompts.spinner();
      spinner.start(message);
      return { stop: spinner.stop.bind(spinner), error: spinner.error.bind(spinner) };
    },
  };
}

export function formatGuidedMessage(message: string): string {
  return wrapTextWithPrefix(process.stdout, message, '│  ', '◇  ', '│  ');
}
