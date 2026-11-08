import type { Story, Save } from './types';
import { parseSave } from './engine';
export const key = (id: string) => `seoul-stories:v1:${id}`;
export function readSave(story: Story) { try { return parseSave(localStorage.getItem(key(story.id)), story); } catch { return null; } }
export function writeSave(save: Save): boolean { try { localStorage.setItem(key(save.storyId), JSON.stringify(save)); return true; } catch { return false; } }
export function clearSave(id: string): boolean { try { localStorage.removeItem(key(id)); return true; } catch { return false; } }
