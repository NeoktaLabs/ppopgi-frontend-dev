export const addToHistory = (address: string) => {
  if (!address) return;
  const history = getHistory();
  if (!history.includes(address)) {
    // Add to beginning, keep max 50
    const newHistory = [address, ...history].slice(0, 50);
    localStorage.setItem('ppopgi_history', JSON.stringify(newHistory));
  }
};

export const getHistory = (): string[] => {
  try {
    const stored = localStorage.getItem('ppopgi_history');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};
