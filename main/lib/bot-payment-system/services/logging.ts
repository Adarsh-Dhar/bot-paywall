/**
 * Logging Service for comprehensive system monitoring
 */

import { LoggingService } from '../interfaces';
import { LogEntry } from '../types';

export class LoggingServiceImpl implements LoggingService {
  private readonly logToConsole: boolean;
  private readonly logToFile: boolean;
  private readonly logFilePath?: string;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 1000;

  constructor(options?: {
    logToConsole?: boolean;
    logToFile?: boolean;
    logFilePath?: string;
  }) {
    this.logToConsole = options?.logToConsole ?? true;
    this.logToFile = options?.logToFile ?? false;
    this.logFilePath = options?.logFilePath;
  }

  /**
   * Logs a generic entry with timestamp and context
   */
  async log(entry: LogEntry): Promise<void> {
    // Add to buffer
    this.logBuffer.push(entry);
    
    // Trim buffer if it exceeds max size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    // Format log message
    const formattedMessage = this.formatLogEntry(entry);

    // Output to console if enabled
    if (this.logToConsole) {
      this.outputToConsole(entry.level, formattedMessage);
    }

    // Output to file if enabled
    if (this.logToFile && this.logFilePath) {
      await this.outputToFile(formattedMessage);
    }
  }

  /**
   * Logs payment verification events with transaction details
   */
  async logPaymentVerification(
    transactionId: string,
    ip: string,
    success: boolean
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: success ? 'info' : 'warn',
      component: 'PaymentVerification',
      message: `Payment verification ${success ? 'succeeded' : 'failed'} for transaction ${transactionId}`,
      context: {
        transactionId,
        ip,
        success,
        operation: 'payment_verification'
      }
    });
  }

  /**
   * Logs Cloudflare API operations with status
   */
  async logCloudflareOperation(
    operation: string,
    ip: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: success ? 'info' : 'error',
      component: 'CloudflareClient',
      message: `Cloudflare ${operation} ${success ? 'succeeded' : 'failed'} for IP ${ip}${error ? `: ${error}` : ''}`,
      context: {
        operation,
        ip,
        success,
        error,
        service: 'cloudflare'
      }
    });
  }

  /**
   * Logs database operations with status
   */
  async logDatabaseOperation(
    operation: string,
    ip: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: success ? 'info' : 'error',
      component: 'DatabaseService',
      message: `Database ${operation} ${success ? 'succeeded' : 'failed'} for IP ${ip}${error ? `: ${error}` : ''}`,
      context: {
        operation,
        ip,
        success,
        error,
        service: 'database'
      }
    });
  }

  /**
   * Logs errors with detailed context
   */
  async logError(
    component: string,
    error: Error,
    context?: Record<string, any>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: 'error',
      component,
      message: `Error in ${component}: ${error.message}`,
      context: {
        ...context,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        errorType: 'exception'
      }
    });
  }

  /**
   * Gets recent log entries
   */
  getRecentLogs(count?: number): LogEntry[] {
    if (count) {
      return this.logBuffer.slice(-count);
    }
    return [...this.logBuffer];
  }

  /**
   * Gets logs filtered by level
   */
  getLogsByLevel(level: 'info' | 'warn' | 'error'): LogEntry[] {
    return this.logBuffer.filter(entry => entry.level === level);
  }

  /**
   * Gets logs filtered by component
   */
  getLogsByComponent(component: string): LogEntry[] {
    return this.logBuffer.filter(entry => entry.component === component);
  }

  /**
   * Gets logs within a time range
   */
  getLogsByTimeRange(startTime: Date, endTime: Date): LogEntry[] {
    return this.logBuffer.filter(
      entry => entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Clears the log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Gets log statistics
   */
  getLogStats(): {
    totalLogs: number;
    infoCount: number;
    warnCount: number;
    errorCount: number;
    componentCounts: Record<string, number>;
  } {
    const stats = {
      totalLogs: this.logBuffer.length,
      infoCount: 0,
      warnCount: 0,
      errorCount: 0,
      componentCounts: {} as Record<string, number>
    };

    for (const entry of this.logBuffer) {
      // Count by level
      if (entry.level === 'info') stats.infoCount++;
      else if (entry.level === 'warn') stats.warnCount++;
      else if (entry.level === 'error') stats.errorCount++;

      // Count by component
      stats.componentCounts[entry.component] = 
        (stats.componentCounts[entry.component] || 0) + 1;
    }

    return stats;
  }

  /**
   * Formats a log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component.padEnd(20);
    const contextStr = entry.context 
      ? ` | ${JSON.stringify(entry.context)}`
      : '';

    return `[${timestamp}] ${level} [${component}] ${entry.message}${contextStr}`;
  }

  /**
   * Outputs log to console with appropriate method
   */
  private outputToConsole(level: 'info' | 'warn' | 'error', message: string): void {
    switch (level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'info':
      default:
        console.log(message);
        break;
    }
  }

  /**
   * Outputs log to file (async)
   */
  private async outputToFile(message: string): Promise<void> {
    if (!this.logFilePath) return;

    try {
      const fs = await import('fs/promises');
      await fs.appendFile(this.logFilePath, message + '\n', 'utf-8');
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Exports logs to JSON format
   */
  exportLogsAsJSON(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  /**
   * Exports logs to CSV format
   */
  exportLogsAsCSV(): string {
    const headers = ['Timestamp', 'Level', 'Component', 'Message', 'Context'];
    const rows = this.logBuffer.map(entry => [
      entry.timestamp.toISOString(),
      entry.level,
      entry.component,
      entry.message,
      JSON.stringify(entry.context || {})
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ];

    return csvLines.join('\n');
  }

  /**
   * Searches logs by message content
   */
  searchLogs(searchTerm: string): LogEntry[] {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return this.logBuffer.filter(entry =>
      entry.message.toLowerCase().includes(lowerSearchTerm) ||
      entry.component.toLowerCase().includes(lowerSearchTerm) ||
      JSON.stringify(entry.context || {}).toLowerCase().includes(lowerSearchTerm)
    );
  }

  /**
   * Gets error logs with stack traces
   */
  getErrorLogsWithStackTraces(): LogEntry[] {
    return this.logBuffer.filter(
      entry => entry.level === 'error' && entry.context?.errorStack
    );
  }

  /**
   * Logs security alert
   */
  async logSecurityAlert(message: string, context?: Record<string, any>): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: 'error',
      component: 'Security',
      message: `SECURITY ALERT: ${message}`,
      context: {
        ...context,
        alertType: 'security',
        requiresImmediateAttention: true
      }
    });
  }

  /**
   * Logs performance metric
   */
  async logPerformanceMetric(
    operation: string,
    durationMs: number,
    context?: Record<string, any>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: 'info',
      component: 'Performance',
      message: `Operation ${operation} completed in ${durationMs}ms`,
      context: {
        ...context,
        operation,
        durationMs,
        metricType: 'performance'
      }
    });
  }
}
