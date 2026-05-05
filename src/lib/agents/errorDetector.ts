import { ProjectMemory } from '../memory/projectMemory';
import { VersionManager } from '../memory/versionManager';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorType = 'install_error' | 'dependency_error' | 'typescript_error' | 'eslint_error' | 'build_error' | 'runtime_error' | 'browser_console_error' | 'network_error' | 'api_error' | 'database_error' | 'auth_error' | 'env_error' | 'routing_error' | 'php_error' | 'laravel_error' | 'permission_error' | 'unknown_error';

export interface ErrorReport {
  error_id: string;
  project_id: string;
  version_id: string;
  mode: string;
  error_type: ErrorType;
  severity: ErrorSeverity;
  command: string;
  message: string;
  stack_trace: string;
  related_files: string[];
  line_numbers: number[];
  likely_cause: string;
  suggested_fix: string;
  is_repeated_error: boolean;
  previous_fix_attempts: string[];
  safe_to_auto_fix: boolean;
  created_at: number;
}

export class ErrorDetector {
  private static SECRET_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/g, // OpenAI/Anthropic/Stripe keys
    /postgres:\/\/[^:]+:[^@]+@[^\/]+\/[^\s]+/g, // Postgres URLs
    /mysql:\/\/[^:]+:[^@]+@[^\/]+\/[^\s]+/g, // MySQL URLs
    /SUPABASE_SERVICE_ROLE_KEY=[^\s]+/g, // Supabase SRK
    /password=[^\s]+/g // Generic passwords
  ];

  static maskSecrets(text: string): string {
    let masked = text;
    this.SECRET_PATTERNS.forEach(pattern => {
      masked = masked.replace(pattern, (match) => {
        if (match.startsWith('postgres://') || match.startsWith('mysql://')) {
          return match.replace(/:[^@]+@/, ':****@');
        }
        if (match.includes('=')) {
          const parts = match.split('=');
          return `${parts[0]}=****masked`;
        }
        if (match.length > 8) {
          return match.slice(0, 4) + '****masked';
        }
        return '****masked';
      });
    });
    return masked;
  }

  static classifyError(log: string, mode: string): { type: ErrorType, files: string[], lines: number[], cause: string } {
    let type: ErrorType = 'unknown_error';
    const files: string[] = [];
    const lines: number[] = [];
    let cause = 'Unknown execution failure';

    const lowerLog = log.toLowerCase();

    // Classification Heuristics
    if (lowerLog.includes('ts2322') || lowerLog.includes('type error') || lowerLog.includes('ts2304')) {
      type = 'typescript_error';
      cause = 'TypeScript typing mismatch or undefined variable.';
    } else if (lowerLog.includes('module not found') || lowerLog.includes('cannot find module')) {
      type = 'dependency_error';
      cause = 'Missing NPM dependency or incorrect import path.';
    } else if (lowerLog.includes('parse error') && lowerLog.includes('.php')) {
      type = 'php_error';
      cause = 'PHP Syntax Error';
    } else if (lowerLog.includes('eaddrinuse')) {
      type = 'runtime_error';
      cause = 'Port collision. Address already in use.';
    } else if (lowerLog.includes('database') || lowerLog.includes('connection refused') || lowerLog.includes('prisma')) {
      type = 'database_error';
      cause = 'Database connection failure or schema mismatch.';
    } else if (lowerLog.includes('build failed') || lowerLog.includes('next build')) {
      type = 'build_error';
      cause = 'Next.js/Vite compilation failure.';
    } else if (lowerLog.includes('eslint')) {
      type = 'eslint_error';
      cause = 'Linter rule violation.';
    }

    // Extract File Paths
    const fileRegex = /([a-zA-Z0-9_/\-.]+\.(tsx|ts|jsx|js|php))/g;
    let match;
    while ((match = fileRegex.exec(log)) !== null) {
      if (!files.includes(match[1]) && !match[1].includes('node_modules')) {
        files.push(match[1]);
      }
    }

    // Extract Line Numbers
    const lineRegex = /:(\d+):\d+/g;
    while ((match = lineRegex.exec(log)) !== null) {
      lines.push(parseInt(match[1], 10));
    }

    return { type, files, lines, cause };
  }

  static isSafeToAutoFix(type: ErrorType, message: string): boolean {
    const unsafeTypes = ['database_error', 'permission_error', 'auth_error'];
    if (unsafeTypes.includes(type)) return false;
    
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('drop table') || lowerMessage.includes('delete from') || lowerMessage.includes('rm -rf')) {
      return false;
    }
    return true;
  }

  static checkRepeatedError(message: string): { isRepeated: boolean, previousAttempts: string[] } {
    const memory = ProjectMemory.getMemory();
    const errorItems = memory.items.filter(i => i.type === 'error');
    
    let isRepeated = false;
    const attempts: string[] = [];

    // Simple heuristic: if the message similarity is high, it's repeated.
    for (const item of errorItems) {
      if (item.content.includes(message.substring(0, 50))) {
        isRepeated = true;
        attempts.push(item.title);
      }
    }

    return { isRepeated, previousAttempts: attempts };
  }

  static async analyzeLog(rawLog: string, command: string, mode: string): Promise<ErrorReport> {
    const maskedLog = this.maskSecrets(rawLog);
    const classification = this.classifyError(maskedLog, mode);
    const repetition = this.checkRepeatedError(maskedLog);

    let severity: ErrorSeverity = 'medium';
    if (classification.type === 'build_error' || classification.type === 'database_error' || classification.type === 'php_error') severity = 'critical';

    const safeToFix = this.isSafeToAutoFix(classification.type, maskedLog) && repetition.previousAttempts.length < 3;

    const report: ErrorReport = {
      error_id: Math.random().toString(36).substring(7),
      project_id: ProjectMemory.getMemory().project_id,
      version_id: 'latest', // Ideally linked to VersionManager
      mode,
      error_type: classification.type,
      severity,
      command,
      message: maskedLog.split('\n')[0] || 'Execution Error',
      stack_trace: maskedLog,
      related_files: classification.files,
      line_numbers: classification.lines,
      likely_cause: classification.cause,
      suggested_fix: `Analyze ${classification.files.join(', ')} to resolve ${classification.type}.`,
      is_repeated_error: repetition.isRepeated,
      previous_fix_attempts: repetition.previousAttempts,
      safe_to_auto_fix: safeToFix,
      created_at: Date.now()
    };

    // Log to Memory
    ProjectMemory.addItem({
      type: 'error',
      title: `[${report.severity.toUpperCase()}] ${report.error_type}`,
      content: `${report.message}\n\nCause: ${report.likely_cause}\nRepeated: ${report.is_repeated_error}`,
      source_file: report.related_files[0] || 'Unknown',
      importance: severity === 'critical' ? 'critical' : 'high'
    });

    return report;
  }
}
