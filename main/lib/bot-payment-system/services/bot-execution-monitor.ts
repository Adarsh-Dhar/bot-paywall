/**
 * Bot Execution Monitor Service for detecting webscraper execution
 */

import { BotExecutionMonitor } from '../interfaces';
import { LoggingService } from '../interfaces';
import { spawn, ChildProcess } from 'child_process';
import { watch, FSWatcher } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class BotExecutionMonitorImpl implements BotExecutionMonitor {
  private isMonitoring = false;
  private fileWatcher?: FSWatcher;
  private processWatcher?: NodeJS.Timeout;
  private callbacks: Array<(ip: string) => Promise<void>> = [];
  private readonly webscrapperPath: string;
  private readonly logFilePath: string;
  private readonly checkInterval = 5000; // Check every 5 seconds
  private lastLogSize = 0;
  private monitoredProcesses = new Set<number>();

  constructor(
    private loggingService?: LoggingService,
    options?: {
      webscrapperPath?: string;
      logFilePath?: string;
      checkInterval?: number;
    }
  ) {
    // Default paths based on existing project structure
    this.webscrapperPath = options?.webscrapperPath || path.join(process.cwd(), 'webscrapper');
    this.logFilePath = options?.logFilePath || path.join(this.webscrapperPath, 'webscrapper.log');
    
    if (options?.checkInterval) {
      this.checkInterval = options.checkInterval;
    }
  }

  /**
   * Starts monitoring for bot execution
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'warn',
        component: 'BotExecutionMonitor',
        message: 'Monitoring already started'
      });
      return;
    }

    this.isMonitoring = true;

    try {
      // Initialize log file size tracking
      await this.initializeLogTracking();

      // Start file system monitoring
      await this.startFileSystemMonitoring();

      // Start process monitoring
      await this.startProcessMonitoring();

      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotExecutionMonitor',
        message: 'Bot execution monitoring started',
        context: {
          webscrapperPath: this.webscrapperPath,
          logFilePath: this.logFilePath,
          checkInterval: this.checkInterval
        }
      });
    } catch (error) {
      this.isMonitoring = false;
      await this.loggingService?.logError('BotExecutionMonitor', error as Error, {
        operation: 'start_monitoring'
      });
      throw error;
    }
  }

  /**
   * Stops monitoring for bot execution
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Stop file system monitoring
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
    }

    // Stop process monitoring
    if (this.processWatcher) {
      clearInterval(this.processWatcher);
      this.processWatcher = undefined;
    }

    // Clear monitored processes
    this.monitoredProcesses.clear();

    await this.loggingService?.log({
      timestamp: new Date(),
      level: 'info',
      component: 'BotExecutionMonitor',
      message: 'Bot execution monitoring stopped'
    });
  }

  /**
   * Registers a callback to be called when bot execution is detected
   */
  onBotExecution(callback: (ip: string) => Promise<void>): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes a callback
   */
  removeCallback(callback: (ip: string) => Promise<void>): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Gets the current monitoring status
   */
  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * Manually triggers bot execution detection (for testing)
   */
  async triggerBotExecution(ip?: string): Promise<void> {
    const detectedIP = ip || await this.detectCurrentIP();
    await this.handleBotExecution(detectedIP);
  }

  /**
   * Gets statistics about monitoring
   */
  getMonitoringStats(): {
    isMonitoring: boolean;
    callbackCount: number;
    monitoredProcessCount: number;
    webscrapperPath: string;
    logFilePath: string;
  } {
    return {
      isMonitoring: this.isMonitoring,
      callbackCount: this.callbacks.length,
      monitoredProcessCount: this.monitoredProcesses.size,
      webscrapperPath: this.webscrapperPath,
      logFilePath: this.logFilePath
    };
  }

  /**
   * Initializes log file size tracking
   */
  private async initializeLogTracking(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(this.logFilePath);
      this.lastLogSize = stats.size;
    } catch (error) {
      // Log file might not exist yet, start with size 0
      this.lastLogSize = 0;
      
      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotExecutionMonitor',
        message: 'Log file not found, starting with size 0',
        context: { logFilePath: this.logFilePath }
      });
    }
  }

  /**
   * Starts file system monitoring for webscraper log changes
   */
  private async startFileSystemMonitoring(): Promise<void> {
    try {
      this.fileWatcher = watch(this.logFilePath, async (eventType) => {
        if (eventType === 'change') {
          await this.handleLogFileChange();
        }
      });

      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotExecutionMonitor',
        message: 'File system monitoring started',
        context: { logFilePath: this.logFilePath }
      });
    } catch (error) {
      await this.loggingService?.logError('BotExecutionMonitor', error as Error, {
        operation: 'start_file_monitoring',
        logFilePath: this.logFilePath
      });
      
      // Continue without file monitoring if it fails
      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'warn',
        component: 'BotExecutionMonitor',
        message: 'File monitoring failed, continuing with process monitoring only'
      });
    }
  }

  /**
   * Starts process monitoring for webscraper execution
   */
  private async startProcessMonitoring(): Promise<void> {
    this.processWatcher = setInterval(async () => {
      await this.checkForWebscrapperProcesses();
    }, this.checkInterval);

    await this.loggingService?.log({
      timestamp: new Date(),
      level: 'info',
      component: 'BotExecutionMonitor',
      message: 'Process monitoring started',
      context: { checkInterval: this.checkInterval }
    });
  }

  /**
   * Handles log file changes
   */
  private async handleLogFileChange(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(this.logFilePath);
      
      if (stats.size > this.lastLogSize) {
        // Log file has grown, webscraper is likely running
        this.lastLogSize = stats.size;
        
        await this.loggingService?.log({
          timestamp: new Date(),
          level: 'info',
          component: 'BotExecutionMonitor',
          message: 'Webscraper log file activity detected',
          context: { 
            logFilePath: this.logFilePath,
            newSize: stats.size
          }
        });

        // Detect IP and trigger callbacks
        const ip = await this.detectCurrentIP();
        await this.handleBotExecution(ip);
      }
    } catch (error) {
      await this.loggingService?.logError('BotExecutionMonitor', error as Error, {
        operation: 'handle_log_change'
      });
    }
  }

  /**
   * Checks for running webscraper processes
   */
  private async checkForWebscrapperProcesses(): Promise<void> {
    try {
      // Look for python processes running main.py in the webscrapper directory
      const { stdout } = await execAsync('ps aux | grep "python.*main.py" | grep -v grep');
      
      if (stdout.trim()) {
        const processes = stdout.trim().split('\n');
        
        for (const processLine of processes) {
          const parts = processLine.trim().split(/\s+/);
          const pid = parseInt(parts[1]);
          
          if (!isNaN(pid) && !this.monitoredProcesses.has(pid)) {
            this.monitoredProcesses.add(pid);
            
            await this.loggingService?.log({
              timestamp: new Date(),
              level: 'info',
              component: 'BotExecutionMonitor',
              message: 'New webscraper process detected',
              context: { 
                pid,
                processLine: processLine.trim()
              }
            });

            // Detect IP and trigger callbacks
            const ip = await this.detectCurrentIP();
            await this.handleBotExecution(ip);
          }
        }
      }
    } catch (error) {
      // ps command might fail if no processes found, which is normal
      if (error instanceof Error && !error.message.includes('No such process')) {
        await this.loggingService?.logError('BotExecutionMonitor', error, {
          operation: 'check_processes'
        });
      }
    }
  }

  /**
   * Detects the current IP address using the same method as existing scripts
   */
  private async detectCurrentIP(): Promise<string> {
    try {
      const { stdout } = await execAsync('curl -s icanhazip.com');
      const ip = stdout.trim();
      
      if (!ip) {
        throw new Error('Failed to retrieve IP address');
      }

      return ip;
    } catch (error) {
      await this.loggingService?.logError('BotExecutionMonitor', error as Error, {
        operation: 'detect_ip'
      });
      
      // Return a fallback IP if detection fails
      return '127.0.0.1';
    }
  }

  /**
   * Handles bot execution by calling all registered callbacks
   */
  private async handleBotExecution(ip: string): Promise<void> {
    await this.loggingService?.log({
      timestamp: new Date(),
      level: 'info',
      component: 'BotExecutionMonitor',
      message: 'Bot execution detected, triggering callbacks',
      context: { 
        ip,
        callbackCount: this.callbacks.length
      }
    });

    // Call all registered callbacks
    const callbackPromises = this.callbacks.map(async (callback, index) => {
      try {
        await callback(ip);
        
        await this.loggingService?.log({
          timestamp: new Date(),
          level: 'info',
          component: 'BotExecutionMonitor',
          message: `Callback ${index} executed successfully`,
          context: { ip, callbackIndex: index }
        });
      } catch (error) {
        await this.loggingService?.logError('BotExecutionMonitor', error as Error, {
          operation: 'callback_execution',
          ip,
          callbackIndex: index
        });
      }
    });

    await Promise.all(callbackPromises);
  }

  /**
   * Checks if a specific process is still running
   */
  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`ps -p ${pid}`);
      return stdout.includes(pid.toString());
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleans up finished processes from monitoring
   */
  private async cleanupFinishedProcesses(): Promise<void> {
    const processesToRemove: number[] = [];
    
    for (const pid of this.monitoredProcesses) {
      const isRunning = await this.isProcessRunning(pid);
      if (!isRunning) {
        processesToRemove.push(pid);
      }
    }

    for (const pid of processesToRemove) {
      this.monitoredProcesses.delete(pid);
      
      await this.loggingService?.log({
        timestamp: new Date(),
        level: 'info',
        component: 'BotExecutionMonitor',
        message: 'Webscraper process finished',
        context: { pid }
      });
    }
  }

  /**
   * Forces a check for webscraper activity (useful for testing)
   */
  async forceCheck(): Promise<void> {
    if (!this.isMonitoring) {
      throw new Error('Monitoring is not active');
    }

    await this.checkForWebscrapperProcesses();
    await this.handleLogFileChange();
    await this.cleanupFinishedProcesses();
  }

  /**
   * Gets the list of currently monitored process IDs
   */
  getMonitoredProcesses(): number[] {
    return Array.from(this.monitoredProcesses);
  }

  /**
   * Checks if the webscraper directory exists
   */
  async validateWebscrapperPath(): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(this.webscrapperPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the current log file size
   */
  async getCurrentLogSize(): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(this.logFilePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }
}