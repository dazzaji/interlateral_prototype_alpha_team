import { useState, useEffect, useRef, useCallback } from 'react';

interface UseNavigationOptions {
  /**
   * Threshold in pixels from bottom to consider "at bottom"
   * Default: 100
   */
  bottomThreshold?: number;

  /**
   * Callback when new events arrive while scroll-locked
   */
  onMissedEvents?: (count: number) => void;
}

interface UseNavigationReturn {
  /**
   * Ref to attach to scrollable container
   */
  containerRef: React.RefObject<HTMLDivElement>;

  /**
   * Whether auto-scroll is active (user is at bottom)
   */
  isAutoScrolling: boolean;

  /**
   * Whether user has scrolled up (paused)
   */
  isScrollLocked: boolean;

  /**
   * Number of events missed while scroll-locked
   */
  missedEventCount: number;

  /**
   * Scroll to bottom (Jump to Now)
   */
  jumpToNow: () => void;

  /**
   * Notify that new events arrived (call from parent)
   */
  onNewEvents: (count: number) => void;

  /**
   * Reset missed event count
   */
  clearMissedEvents: () => void;

  /**
   * Check if user is at bottom of scroll
   */
  isAtBottom: () => boolean;

  /**
   * Scroll to bottom smoothly
   */
  scrollToBottom: (smooth?: boolean) => void;
}

export function useNavigation(options: UseNavigationOptions = {}): UseNavigationReturn {
  const { bottomThreshold = 100, onMissedEvents } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [missedEventCount, setMissedEventCount] = useState(0);

  // Track if user manually scrolled
  const userScrolledRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Check if at bottom of scroll
  const isAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= bottomThreshold;
  }, [bottomThreshold]);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // Jump to Now (scroll to bottom and reset)
  const jumpToNow = useCallback(() => {
    scrollToBottom(true);
    setIsScrollLocked(false);
    setIsAutoScrolling(true);
    setMissedEventCount(0);
    userScrolledRef.current = false;
  }, [scrollToBottom]);

  // Handle new events arriving
  const onNewEvents = useCallback((count: number) => {
    if (isScrollLocked) {
      // User is scroll-locked, track missed events
      setMissedEventCount((prev) => {
        const newCount = prev + count;
        onMissedEvents?.(newCount);
        return newCount;
      });
    } else if (isAutoScrolling) {
      // Auto-scroll to show new events
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [isScrollLocked, isAutoScrolling, scrollToBottom, onMissedEvents]);

  // Clear missed events
  const clearMissedEvents = useCallback(() => {
    setMissedEventCount(0);
  }, []);

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const atBottom = isAtBottom();

      // Detect if user scrolled up
      if (currentScrollTop < lastScrollTopRef.current && !atBottom) {
        // User scrolled up
        userScrolledRef.current = true;
        setIsScrollLocked(true);
        setIsAutoScrolling(false);
      } else if (atBottom) {
        // User scrolled back to bottom
        if (userScrolledRef.current) {
          // Only reset if user had manually scrolled
          setIsScrollLocked(false);
          setIsAutoScrolling(true);
          setMissedEventCount(0);
          userScrolledRef.current = false;
        }
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isAtBottom]);

  return {
    containerRef,
    isAutoScrolling,
    isScrollLocked,
    missedEventCount,
    jumpToNow,
    onNewEvents,
    clearMissedEvents,
    isAtBottom,
    scrollToBottom,
  };
}

export default useNavigation;
