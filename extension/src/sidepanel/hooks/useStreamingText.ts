import { useState, useEffect, useCallback } from 'react';

interface UseStreamingTextOptions {
  speed?: number; // ms per character
  onComplete?: () => void;
}

export function useStreamingText(
  text: string,
  options: UseStreamingTextOptions = {}
) {
  const { speed = 15, onComplete } = options;
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      setIsComplete(true);
      return;
    }

    setIsStreaming(true);
    setIsComplete(false);
    setDisplayedText('');

    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        setIsStreaming(false);
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  const skipToEnd = useCallback(() => {
    setDisplayedText(text);
    setIsComplete(true);
    setIsStreaming(false);
  }, [text]);

  return {
    displayedText,
    isComplete,
    isStreaming,
    skipToEnd,
  };
}
