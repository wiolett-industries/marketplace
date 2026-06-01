import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';

const cyan = (text: string): string => `\x1b[36m${text}\x1b[0m`;
const dim = (text: string): string => `\x1b[2m${text}\x1b[0m`;
const bold = (text: string): string => `\x1b[1m${text}\x1b[0m`;

export class CliAbortError extends Error {
  constructor(message = 'Canceled.') {
    super(message);
    this.name = 'CliAbortError';
  }
}

export function isCliAbortError(error: unknown): boolean {
  return error instanceof CliAbortError || isReadlineAbortError(error);
}

export function renderInitHeader(): void {
  process.stdout.write(`${bold('Agent Memory init')}\n`);
  process.stdout.write(`${cyan('┌')} ${bold('Add OpenAI credential')}\n`);
  process.stdout.write(`${cyan('│')}\n`);
}

export function renderInitFooter(): void {
  process.stdout.write(`${cyan('└')}\n`);
}

export async function promptText(message: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const suffix = defaultValue ? ` ${dim(`(${defaultValue})`)}` : '';
  try {
    const answer = await rl.question(`${cyan('│')} ${message}${suffix}: `);
    return answer.trim() || defaultValue || '';
  } catch (error) {
    if (isReadlineAbortError(error)) throw new CliAbortError();
    throw error;
  } finally {
    rl.close();
  }
}

export async function promptConfirm(message: string, defaultValue = false): Promise<boolean> {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  const answer = (await promptText(`${message} ${dim(`[${hint}]`)}`)).toLowerCase();
  if (!answer) return defaultValue;
  return answer === 'y' || answer === 'yes';
}

export async function promptPassword(message: string): Promise<string> {
  const input = process.stdin;
  const output = process.stdout;
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Interactive init requires a TTY. Use --key for non-interactive setup.');
  }

  readline.emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();

  let value = '';
  const prompt = `${cyan('│')} ${message}: `;

  return await new Promise((resolve, reject) => {
    const cleanup = (): void => {
      input.off('keypress', onKeypress);
      input.setRawMode(Boolean(wasRaw));
      output.write('\n');
    };

    const redraw = (): void => {
      output.write(`\r\x1b[2K${formatMaskedPasswordLine(prompt, value.length, output.columns)}`);
    };

    const onKeypress = (character: string | undefined, key: readline.Key): void => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new CliAbortError());
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(value);
        return;
      }

      if (key.name === 'backspace' || key.name === 'delete') {
        value = value.slice(0, -1);
        redraw();
        return;
      }

      if (character && !key.ctrl && !key.meta) {
        value += character.replace(/[\r\n]/g, '');
        redraw();
      }
    };

    output.write(formatMaskedPasswordLine(prompt, value.length, output.columns));
    input.on('keypress', onKeypress);
  });
}

export function formatMaskedPasswordLine(prompt: string, valueLength: number, columns = 80): string {
  const safeColumns = Number.isFinite(columns) && columns > 0 ? Math.floor(columns) : 80;
  const available = Math.max(1, safeColumns - stripAnsi(prompt).length - 1);
  if (valueLength <= available) {
    return `${prompt}${'■'.repeat(valueLength)}`;
  }
  if (available === 1) {
    return `${prompt}…`;
  }
  return `${prompt}${'■'.repeat(available - 1)}…`;
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/gu, '');
}

function isReadlineAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ABORT_ERR');
}
