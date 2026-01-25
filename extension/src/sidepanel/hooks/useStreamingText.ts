import { useState, useEffect, useCallback, useRef } from 'react';

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

  // Use ref to avoid restarting animation when onComplete changes
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

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
        onCompleteRef.current?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

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
