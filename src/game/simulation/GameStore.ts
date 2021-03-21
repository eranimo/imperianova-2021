import { GameData } from './Game';
import localforage from 'localforage';
import uuid from 'uuid-random';

export type SavedGameEntry = {
  id: string,
  date: number,
  name: string,
  data: GameData,
}

const ENTRIES_KEY = 'saved-game-entries';
const ENTRY_PREFIX = 'game-';

export class GameStore {
  static async getSavedGames(): Promise<SavedGameEntry[]> {
    const entries = await localforage.getItem(ENTRIES_KEY);
    return entries as SavedGameEntry[] ?? [];
  }

  static async getEntry(id: string) {
    const entries = await GameStore.getSavedGames();
    return entries.find(i => i.id === id);
  }

  static async save(gameData: GameData, name: string) {
    const id = uuid();
    await localforage.setItem(`${ENTRY_PREFIX}-${id}`, gameData);
    const entries = await GameStore.getSavedGames();
    entries.push({
      id,
      date: Date.now(),
      name,
      data: gameData,
    });
    await localforage.setItem(ENTRIES_KEY, entries);
  }

  static async overwrite(gameData: GameData, id: string) {
    const entry = await GameStore.getEntry(id);
    await GameStore.delete(id);
    await localforage.setItem(`${ENTRY_PREFIX}-${id}`, gameData);
    const entries = await GameStore.getSavedGames();
    entries.push({
      id,
      date: Date.now(),
      name: entry.name,
      data: gameData,
    });
    await localforage.setItem(ENTRIES_KEY, entries);
  }

  static async delete(id: string): Promise<void> {
    const entries = await GameStore.getSavedGames();
    await localforage.removeItem(`${ENTRY_PREFIX}-${id}`);
    await localforage.setItem(ENTRIES_KEY, entries.filter(i => i.id !== id));
  }

  static async load(id: string): Promise<GameData> {
    return await localforage.getItem(`${ENTRY_PREFIX}-${id}`);
  }
}