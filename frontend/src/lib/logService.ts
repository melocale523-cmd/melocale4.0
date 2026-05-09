type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

function emit(entry: LogEntry) {
  const tag = `[${entry.context}]`;
  if (entry.level === 'error') console.error(tag, entry.message, entry.data ?? '');
  else if (entry.level === 'warn') console.warn(tag, entry.message, entry.data ?? '');
  else console.log(tag, entry.message, entry.data ?? '');
  // Future: forward to Sentry / Datadog via entry.level + entry.context
}

export const logService = {
  info:  (context: string, message: string, data?: unknown) => emit({ level: 'info',  context, message, data }),
  warn:  (context: string, message: string, data?: unknown) => emit({ level: 'warn',  context, message, data }),
  error: (context: string, message: string, data?: unknown) => emit({ level: 'error', context, message, data }),
};
