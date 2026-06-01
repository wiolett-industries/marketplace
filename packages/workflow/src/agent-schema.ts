export interface WorkflowAgentDefinition {
  fileName: string;
  name: string;
  description: string;
  developerInstructions: string;
  content: string;
  sha256: string;
}

const STRING_FIELD_RE = (field: string) => new RegExp(`^${field}\\s*=\\s*"([^"]+)"\\s*$`, 'm');

export function parseWorkflowAgentDefinition(fileName: string, content: string, sha256: string): WorkflowAgentDefinition {
  const name = readStringField(content, 'name');
  const description = readStringField(content, 'description');
  const developerInstructions = readDeveloperInstructions(content);

  if (!fileName.endsWith('.toml')) {
    throw new Error(`${fileName}: expected .toml custom-agent file`);
  }
  if (!fileName.startsWith('workflow_')) {
    throw new Error(`${fileName}: workflow agent files must use workflow_* namespace`);
  }
  if (!name.startsWith('workflow_')) {
    throw new Error(`${fileName}: agent name must use workflow_* namespace`);
  }
  if (fileName.slice(0, -'.toml'.length) !== name) {
    throw new Error(`${fileName}: filename stem must match agent name "${name}"`);
  }
  if (!description.trim()) {
    throw new Error(`${fileName}: description is required`);
  }
  if (!developerInstructions.trim()) {
    throw new Error(`${fileName}: developer_instructions is required`);
  }

  return {
    fileName,
    name,
    description,
    developerInstructions,
    content,
    sha256,
  };
}

function readStringField(content: string, field: string): string {
  const match = STRING_FIELD_RE(field).exec(content);
  if (!match) {
    throw new Error(`Missing required string field: ${field}`);
  }
  return match[1] ?? '';
}

function readDeveloperInstructions(content: string): string {
  const match = /^developer_instructions\s*=\s*"""([\s\S]*)"""\s*$/m.exec(content);
  if (!match) {
    throw new Error('Missing required multiline field: developer_instructions');
  }
  return match[1] ?? '';
}
