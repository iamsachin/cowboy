import {
  FileText, Terminal, Pencil, FilePlus, Search,
  FolderSearch, Bot, Globe, Wrench,
} from 'lucide-vue-next';
import type { Component } from 'vue';

export interface ToolIconInfo {
  icon: Component;
  colorClass: string;
}

const TOOL_ICONS: Record<string, ToolIconInfo> = {
  Read:      { icon: FileText,      colorClass: 'text-sky-400' },
  Bash:      { icon: Terminal,      colorClass: 'text-emerald-400' },
  Edit:      { icon: Pencil,        colorClass: 'text-amber-400' },
  Write:     { icon: FilePlus,      colorClass: 'text-teal-400' },
  Grep:      { icon: Search,        colorClass: 'text-violet-400' },
  Glob:      { icon: FolderSearch,  colorClass: 'text-rose-400' },
  Agent:     { icon: Bot,           colorClass: 'text-fuchsia-400' },
  WebSearch: { icon: Globe,         colorClass: 'text-cyan-400' },
};

const FALLBACK: ToolIconInfo = { icon: Wrench, colorClass: 'text-info' };

export function getToolIcon(toolName: string): ToolIconInfo {
  return TOOL_ICONS[toolName] ?? FALLBACK;
}
