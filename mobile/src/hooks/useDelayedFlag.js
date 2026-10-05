import { useEffect, useState } from 'react';

export default function useDelayedFlag(active, delay = 2200) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) {
      const resetTimer = setTimeout(() => setVisible(false), 0);
      return () => clearTimeout(resetTimer);
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return active && visible;
}
