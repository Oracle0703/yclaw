/**
 * 命令注册表 — 管理全局可执行命令
 */

export interface Command {
  id: string;
  name: string;
  icon?: string;
  shortcut?: string;
  category: 'navigation' | 'action' | 'system';
  execute: () => void;
}

type CommandListener = (commands: Command[]) => void;

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private listeners: CommandListener[] = [];

  register(command: Command): void {
    this.commands.set(command.id, command);
    this.notify();
  }

  unregister(id: string): void {
    this.commands.delete(id);
    this.notify();
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  search(query: string): Command[] {
    if (!query.trim()) return this.getAll();
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery),
    );
  }

  execute(id: string): boolean {
    const command = this.commands.get(id);
    if (command) {
      command.execute();
      return true;
    }
    return false;
  }

  onChange(listener: CommandListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const commands = this.getAll();
    this.listeners.forEach((l) => l(commands));
  }
}

// 全局单例
let instance: CommandRegistry | null = null;

export function getCommandRegistry(): CommandRegistry {
  if (!instance) {
    instance = new CommandRegistry();
  }
  return instance;
}

/** 仅用于测试 — 重置单例 */
export function resetCommandRegistry(): void {
  instance = null;
}
