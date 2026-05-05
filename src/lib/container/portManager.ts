import net from 'net';

export class PortManager {
  private static assignedPorts: Map<string, number> = new Map();

  static async findAvailablePort(startPort = 3000): Promise<number> {
    const isAvailable = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        server.on('error', () => resolve(false));
        server.listen(port, () => {
          server.close(() => resolve(true));
        });
      });
    };

    let port = startPort;
    while (port < 65535) {
      if (!Array.from(this.assignedPorts.values()).includes(port)) {
        if (await isAvailable(port)) {
          return port;
        }
      }
      port++;
    }
    throw new Error('No available ports found');
  }

  static assignPort(projectId: string, port: number) {
    this.assignedPorts.set(projectId, port);
  }

  static releasePort(projectId: string) {
    this.assignedPorts.delete(projectId);
  }

  static getAssignedPort(projectId: string): number | undefined {
    return this.assignedPorts.get(projectId);
  }
}
