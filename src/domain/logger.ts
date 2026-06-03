type LogFields = Record<string, unknown>;

export function logInfo(message: string, fields: LogFields = {}) {
  console.info(JSON.stringify({ level: "info", message, ...fields }));
}

export function logWarn(message: string, fields: LogFields = {}) {
  console.warn(JSON.stringify({ level: "warn", message, ...fields }));
}
