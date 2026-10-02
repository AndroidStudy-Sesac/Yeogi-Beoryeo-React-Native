import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';

import { ItemPreferencesStore } from '../data/itemPreferences';

const Context = createContext<ItemPreferencesStore | null>(null);

export function ItemPreferencesProvider({ children, store: providedStore }: PropsWithChildren<{ store?: ItemPreferencesStore }>) {
  const [store] = useState(() => providedStore ?? new ItemPreferencesStore());
  useEffect(() => { void store.load(); }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useItemPreferences() {
  const store = useContext(Context);
  if (!store) throw new Error('ItemPreferencesProvider is required');
  return { ...useSyncExternalStore(store.subscribe, store.getSnapshot), store };
}
