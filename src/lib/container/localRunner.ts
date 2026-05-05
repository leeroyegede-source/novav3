import { spawn, spawnSync, ChildProcess } from 'child_process';
import path from 'path';
import { PortManager } from './portManager';

export type RuntimeType = 'static' | 'vite' | 'nextjs' | 'node' | 'php' | 'laravel';

export interface StartOptions {
  projectId: string;
  projectPath: string;
  runtime: RuntimeType;
}

export class LocalRunner {
  static activeProcesses: Map<string, { process: ChildProcess, port: number }> = new Map();
  static containerLogs: Map<string, string[]> = new Map();

  static getRuntimeConfig(runtime: RuntimeType, port: number, mountedPath: string) {
    switch (runtime) {
      case 'static':
        return { command: 'npx', args: ['-y', 'serve', '.', '-l', port.toString()] };
      case 'vite':
        return { command: 'npm', args: ['install', '--force', '--no-audit', '&&', 'npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', port.toString(), '--strictPort'] };
      case 'nextjs':
        return { command: 'npm', args: ['install', '--force', '--no-audit', '&&', 'npm', 'run', 'dev', '--', '-H', '127.0.0.1', '-p', port.toString()] };
      case 'node':
        return { command: 'npm', args: ['install', '&&', 'npm', 'run', 'dev'] };
      case 'php':
        return { command: 'docker', args: ['run', '--rm', '-v', `"${mountedPath}:/app"`, '-w', '/app', '-p', `${port}:8000`, 'php:latest', 'php', '-S', '0.0.0.0:8000'] };
      case 'laravel':
        return { command: 'docker', args: ['run', '--rm', '-v', `"${mountedPath}:/app"`, '-w', '/app', '-p', `${port}:8000`, 'composer:latest', 'sh', '-c', `"composer install && php artisan serve --host=0.0.0.0 --port=8000"`] };
      default:
        throw new Error(`Unsupported runtime: ${runtime}`);
    }
  }

  static async startContainer({ projectId, projectPath, runtime }: StartOptions) {
    await this.stopContainer(projectId);

    // Default container port mapping hint
    let defaultPort = 3002;
    if (runtime === 'vite') defaultPort = 3002;
    if (runtime === 'php' || runtime === 'laravel') defaultPort = 8000;

    const localPort = await PortManager.findAvailablePort(defaultPort);
    PortManager.assignPort(projectId, localPort);

    const mountedPath = path.resolve(projectPath);
    const config = this.getRuntimeConfig(runtime, localPort, mountedPath);

    this.containerLogs.set(projectId, [`Starting local process for ${runtime} on port ${localPort}...`, `Command: ${config.command} ${config.args.join(' ')}`]);

    try {
      const child = spawn(config.command, config.args, {
        cwd: mountedPath,
        shell: true,
        env: { ...process.env, PORT: localPort.toString() }
      });

      this.activeProcesses.set(projectId, { process: child, port: localPort });

      const appendLog = (data: Buffer) => {
        const logs = this.containerLogs.get(projectId) || [];
        const lines = data.toString().split('\n').filter(l => l.trim() !== '');
        const newLogs = [...logs, ...lines].slice(-500);
        this.containerLogs.set(projectId, newLogs);
      };

      child.stdout?.on('data', appendLog);
      child.stderr?.on('data', appendLog);

      child.on('error', (err) => {
        appendLog(Buffer.from(`[PROCESS ERROR] ${err.message}`));
      });

      child.on('exit', (code) => {
        appendLog(Buffer.from(`[PROCESS EXITED] code ${code}`));
      });

      return {
        projectId,
        runtime,
        containerId: `local-${child.pid}`,
        localPort,
        containerPort: localPort,
        previewUrl: `http://127.0.0.1:${localPort}`,
        status: 'running'
      };
    } catch (error: any) {
      PortManager.releasePort(projectId);
      throw new Error(`Failed to start local process: ${error.message}`);
    }
  }

  static async stopContainer(projectId: string) {
    const active = this.activeProcesses.get(projectId);
    if (active) {
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', active.process.pid!.toString(), '/f', '/t']);
          // Small delay to ensure Windows releases file locks on the SWC binary
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
        } else {
          active.process.kill('SIGTERM');
        }
      } catch (e) {
        // Ignore kill errors
      }
      this.activeProcesses.delete(projectId);
      PortManager.releasePort(projectId);
      this.containerLogs.delete(projectId);
    }
  }

  static async restartContainer(options: StartOptions) {
    await this.stopContainer(options.projectId);
    return await this.startContainer(options);
  }

  static getLogs(projectId: string) {
    return this.containerLogs.get(projectId) || [];
  }

  static getStatus(projectId: string) {
    const active = this.activeProcesses.get(projectId);
    if (!active) return { status: 'stopped' };
    return {
      status: 'running',
      localPort: active.port,
      containerId: `local-${active.process.pid}`,
      previewUrl: `http://127.0.0.1:${active.port}`
    };
  }
}
