import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Formula, formulaToString } from '../types';
import { useTheme } from '../hooks/useTheme';

interface FormulaDisplayProps {
  formula: Formula | string;
  className?: string;
  style?: React.CSSProperties;
}

interface BracketPair {
  openIndex: number;
  closeIndex: number;
  depth: number;       // Line depth (only counts {})
  visualDepth: number; // Visual depth for coloring (counts all brackets)
}

// Extended bracket pair for collapse functionality - tracks ALL bracket types
interface AllBracketPair {
  openIndex: number;
  closeIndex: number;
  depth: number;          // For {} SVG lines (only counts {})
  visualDepth: number;    // For coloring (counts all brackets)
  bracketType: '(' | '[' | '{';
}

export const FormulaDisplay: React.FC<FormulaDisplayProps> = ({ formula, className, style }) => {
  const { coloredBrackets, showBracketLines, collapsibleBrackets } = useTheme();
  const text = typeof formula === 'string' ? formula : formulaToString(formula);
  const containerRef = useRef<HTMLSpanElement>(null);
  const bracketRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const [bracketPositions, setBracketPositions] = useState<{ pairs: BracketPair[], positions: Map<number, DOMRect> } | null>(null);

  // Track collapsed brackets by their opening index
  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set());

  // Reset collapse state when formula changes
  useEffect(() => {
    setCollapsedSet(new Set());
  }, [text]);

  // Parse bracket pairs using stack algorithm
  // Only track { } for line rendering - skip ( ) and [ ] entirely
  const parseBracketPairs = useCallback((): BracketPair[] => {
    const pairs: BracketPair[] = [];
    const lineStack: { index: number; lineDepth: number; visualDepth: number }[] = [];
    let lineDepth = 0;   // Depth counter for line-eligible brackets only ({})
    let visualDepth = 0; // Depth counter for ALL brackets (for color matching)

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '{') {
        // Track curly brackets for lines
        lineStack.push({ index: i, lineDepth, visualDepth });
        lineDepth++;
        visualDepth++;
      } else if (char === '}') {
        lineDepth--;
        visualDepth--;
        const opening = lineStack.pop();
        if (opening !== undefined) {
          pairs.push({
            openIndex: opening.index,
            closeIndex: i,
            depth: opening.lineDepth,
            visualDepth: opening.visualDepth,
          });
        }
      } else if (char === '(' || char === '[') {
        // Track visual depth for parentheses and square brackets (for color matching) but don't create lines
        visualDepth++;
      } else if (char === ')' || char === ']') {
        visualDepth--;
      }
    }
    return pairs;
  }, [text]);

  // Parse ALL bracket pairs for collapse functionality
  const parseAllBracketPairs = useCallback((): AllBracketPair[] => {
    const pairs: AllBracketPair[] = [];
    const stack: { index: number; lineDepth: number; visualDepth: number; bracketType: '(' | '[' | '{' }[] = [];
    let lineDepth = 0;
    let visualDepth = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '(' || char === '[' || char === '{') {
        stack.push({ index: i, lineDepth, visualDepth, bracketType: char });
        if (char === '{') lineDepth++;
        visualDepth++;
      } else if (char === ')' || char === ']' || char === '}') {
        if (char === '}') lineDepth--;
        visualDepth--;
        const opening = stack.pop();
        if (opening !== undefined) {
          // Match bracket types
          const matchingClose = opening.bracketType === '(' ? ')' : opening.bracketType === '[' ? ']' : '}';
          if (char === matchingClose) {
            pairs.push({
              openIndex: opening.index,
              closeIndex: i,
              depth: opening.lineDepth,
              visualDepth: opening.visualDepth,
              bracketType: opening.bracketType,
            });
          }
        }
      }
    }
    return pairs;
  }, [text]);

  // Memoize all bracket pairs
  const allPairs = useMemo(() => parseAllBracketPairs(), [parseAllBracketPairs]);

  // Create a map of opening index to pair for quick lookup
  const pairsByOpenIndex = useMemo(() => {
    const map = new Map<number, AllBracketPair>();
    for (const pair of allPairs) {
      map.set(pair.openIndex, pair);
    }
    return map;
  }, [allPairs]);

  // Compute hidden character indices based on collapsed brackets
  const hiddenIndices = useMemo(() => {
    const hidden = new Set<number>();
    if (!collapsibleBrackets) return hidden; // No hidden indices if feature is disabled
    for (const pair of allPairs) {
      if (collapsedSet.has(pair.openIndex)) {
        // Hide everything between open and close bracket (exclusive)
        for (let i = pair.openIndex + 1; i < pair.closeIndex; i++) {
          hidden.add(i);
        }
      }
    }
    return hidden;
  }, [allPairs, collapsedSet, collapsibleBrackets]);

  // Toggle collapse state for a bracket
  const toggleCollapse = useCallback((openIndex: number) => {
    setCollapsedSet(prev => {
      const next = new Set(prev);
      if (next.has(openIndex)) {
        next.delete(openIndex);
      } else {
        next.add(openIndex);
      }
      return next;
    });
  }, []);

  // Measure bracket positions
  const measurePositions = useCallback(() => {
    if (!containerRef.current || !showBracketLines || !coloredBrackets) {
      setBracketPositions(null);
      return;
    }

    const pairs = parseBracketPairs();
    const positions = new Map<number, DOMRect>();
    const containerRect = containerRef.current.getBoundingClientRect();

    bracketRefs.current.forEach((span, index) => {
      if (span) {
        const char = text[index];
        // Validate that the index points to an actual curly bracket in the current text
        // This guards against stale refs from previous formula renders
        // Only {} get lines, so only validate those
        if (char === '{' || char === '}') {
          const rect = span.getBoundingClientRect();
          // Store position relative to container
          positions.set(index, new DOMRect(
            rect.left - containerRect.left,
            rect.top - containerRect.top,
            rect.width,
            rect.height
          ));
        }
      }
    });

    setBracketPositions({ pairs, positions });
  }, [parseBracketPairs, showBracketLines, coloredBrackets, text]);

  // Set up ResizeObserver and measure on mount/changes
  useEffect(() => {
    if (!showBracketLines || !coloredBrackets) {
      setBracketPositions(null);
      return;
    }

    // Initial measurement after a small delay to ensure DOM is ready
    const timeoutId = setTimeout(measurePositions, 0);

    // Set up ResizeObserver
    const observer = new ResizeObserver(measurePositions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Also observe window resize
    window.addEventListener('resize', measurePositions);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener('resize', measurePositions);
    };
  }, [measurePositions, showBracketLines, coloredBrackets, text]);


  // Coloring scheme:
  // () = NEVER colored
  // [] = ALWAYS color 1 (blue in light mode, cyan in high contrast)
  // {} = depth-based (depth 0 = color 2, depth 1 = color 3, ... depth 6 = color 8)
  const getColorForCurly = (depth: number): string => {
    // Start at color 2 (color 1 is reserved for [])
    // Cycle through colors 2-8 (7 colors for depths 0-6)
    return `var(--bracket-${(depth % 7) + 2})`;
  };

  // Clear refs at start of render to ensure no stale entries from previous formulas
  bracketRefs.current.clear();

  // Helper to get color for bracket based on type and depth
  const getBracketColor = (bracketType: '(' | '[' | '{' | ')' | ']' | '}', curlyDepthAtBracket: number): string | undefined => {
    if (!coloredBrackets) return undefined;
    if (bracketType === '(' || bracketType === ')') return undefined;
    if (bracketType === '[' || bracketType === ']') return 'var(--bracket-1)';
    // Curly brackets
    return getColorForCurly(curlyDepthAtBracket);
  };

  // Build elements with refs for brackets
  const elements: JSX.Element[] = [];
  // Track depth for ONLY {} brackets
  let curlyDepth = 0;
  // Track if we just rendered a collapse indicator (to avoid duplicate)
  let justRenderedIndicator = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Check if this character is hidden (inside a collapsed bracket)
    if (hiddenIndices.has(i)) {
      // Check if we need to render the collapse indicator right after the opening bracket
      const pair = pairsByOpenIndex.get(i - 1);
      if (pair && collapsedSet.has(pair.openIndex) && !justRenderedIndicator) {
        // Render collapse indicator with same color as the bracket
        const indicatorColor = getBracketColor(pair.bracketType, pair.bracketType === '{' ? pair.depth : 0);
        elements.push(
          <span
            key={`indicator-${pair.openIndex}`}
            className="collapse-indicator"
            style={{ color: indicatorColor, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(pair.openIndex);
            }}
            title="Click to expand"
          >
            ▸
          </span>
        );
        justRenderedIndicator = true;
      }
      // Track curly depth even for hidden characters
      if (char === '{') curlyDepth++;
      if (char === '}') curlyDepth--;
      continue;
    }

    justRenderedIndicator = false;

    // Check if this is an opening bracket that can be collapsed
    const pair = pairsByOpenIndex.get(i);
    const isCollapsible = collapsibleBrackets && pair !== undefined;
    const isCollapsed = isCollapsible && collapsedSet.has(i);

    if (char === '(' || char === ')') {
      // Parentheses are NEVER colored but can be clickable if opening
      if (char === '(' && isCollapsible) {
        elements.push(
          <span
            key={i}
            className="bracket-collapsible"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(i);
            }}
            title={isCollapsed ? "Click to expand" : "Click to collapse"}
          >
            {char}
          </span>
        );
      } else {
        elements.push(<span key={i}>{char}</span>);
      }
    } else if (char === '[' || char === ']') {
      // Square brackets are ALWAYS color 1
      const colorVar = coloredBrackets ? 'var(--bracket-1)' : undefined;
      if (char === '[' && isCollapsible) {
        elements.push(
          <span
            key={i}
            className="bracket-collapsible"
            style={{ color: colorVar }}
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(i);
            }}
            title={isCollapsed ? "Click to expand" : "Click to collapse"}
          >
            {char}
          </span>
        );
      } else {
        elements.push(
          <span key={i} style={{ color: colorVar }}>
            {char}
          </span>
        );
      }
    } else if (char === '{') {
      // Opening curly: color based on current depth, then increment
      const colorVar = coloredBrackets ? getColorForCurly(curlyDepth) : undefined;
      elements.push(
        <span
          key={i}
          ref={(el) => {
            if (el) bracketRefs.current.set(i, el);
            else bracketRefs.current.delete(i);
          }}
          className={isCollapsible ? "bracket-collapsible" : undefined}
          style={{ color: colorVar }}
          onClick={isCollapsible ? (e) => {
            e.stopPropagation();
            toggleCollapse(i);
          } : undefined}
          title={isCollapsible ? (isCollapsed ? "Click to expand" : "Click to collapse") : undefined}
        >
          {char}
        </span>
      );
      curlyDepth++;
    } else if (char === '}') {
      // Closing curly: decrement first, then color with that depth
      curlyDepth--;
      const colorVar = coloredBrackets ? getColorForCurly(curlyDepth) : undefined;
      elements.push(
        <span
          key={i}
          ref={(el) => {
            if (el) bracketRefs.current.set(i, el);
            else bracketRefs.current.delete(i);
          }}
          style={{ color: colorVar }}
        >
          {char}
        </span>
      );
    } else {
      elements.push(<span key={i}>{char}</span>);
    }
  }

  // Filter out collapsed bracket pairs from SVG rendering
  const visibleCurlyPairs = useMemo(() => {
    if (!bracketPositions) return [];
    return bracketPositions.pairs.filter(pair => {
      // Hide if this pair is collapsed
      if (collapsedSet.has(pair.openIndex)) return false;
      // Hide if any ancestor is collapsed (this pair is inside a collapsed bracket)
      for (const ancestor of allPairs) {
        if (collapsedSet.has(ancestor.openIndex) &&
            ancestor.openIndex < pair.openIndex &&
            ancestor.closeIndex > pair.closeIndex) {
          return false;
        }
      }
      return true;
    });
  }, [bracketPositions, collapsedSet, allPairs]);

  // Separate pairs by placement: alternate top/bottom based on depth
  // depth 0 (outermost line-eligible bracket) -> below
  // depth 1 -> above
  // depth 2 -> below, etc.
  const abovePairs = visibleCurlyPairs.filter(p => p.depth % 2 === 1);
  const belowPairs = visibleCurlyPairs.filter(p => p.depth % 2 === 0);

  // Calculate max depth overall for visual styling (use visible pairs only)
  const maxDepth = visibleCurlyPairs.reduce((max, p) => Math.max(max, p.depth), 0);

  // Helper to get color index for SVG lines (matches inline coloring)
  // {} = depth-based using colors 2-8
  const getColorIndexForPair = (pair: BracketPair) => {
    // For {}, use colors 2-8 based on depth
    return (pair.depth % 7) + 2;
  };

  // Calculate heights for each SVG layer
  // For above: depths 1, 3, 5... -> map to levels 0, 1, 2...
  // For below: depths 0, 2, 4... -> map to levels 0, 1, 2...
  const lineSpacing = 8; // pixels between each depth level
  const maxAboveLevel = abovePairs.length > 0 ? Math.max(...abovePairs.map(p => Math.floor(p.depth / 2))) : -1;
  const maxBelowLevel = belowPairs.length > 0 ? Math.max(...belowPairs.map(p => Math.floor(p.depth / 2))) : -1;
  const aboveSvgHeight = (maxAboveLevel + 1) * lineSpacing + 2;
  const belowSvgHeight = (maxBelowLevel + 1) * lineSpacing + 2;

  // Calculate stroke width and opacity based on depth (outer = thicker, more visible)
  const getStrokeWidth = (depth: number) => 1 + (maxDepth - depth) * 0.3;
  const getOpacity = (depth: number) => 0.5 + (maxDepth - depth) * 0.1;

  // Render SVG paths for bracket lines above the formula
  const renderAboveLines = () => {
    if (!bracketPositions || !showBracketLines || !coloredBrackets || abovePairs.length === 0) return null;

    const { positions } = bracketPositions;

    return (
      <svg
        className="bracket-lines-svg bracket-lines-above"
        style={{
          position: 'absolute',
          left: 0,
          bottom: '100%',
          width: '100%',
          height: aboveSvgHeight,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {abovePairs.map((pair, idx) => {
          const openRect = positions.get(pair.openIndex);
          const closeRect = positions.get(pair.closeIndex);
          if (!openRect || !closeRect) return null;

          // Calculate x positions (center of each bracket)
          const x1 = openRect.left + openRect.width / 2;
          const x2 = closeRect.left + closeRect.width / 2;

          // Map depth to level: 1->0, 3->1, 5->2, etc.
          const level = Math.floor(pair.depth / 2);
          // Y position from bottom of SVG (closer levels are closer to text)
          const y = aboveSvgHeight - (level + 1) * lineSpacing;

          // Inverted U-shape: start at bottom, go up, across, down
          const path = `M ${x1} ${aboveSvgHeight} L ${x1} ${y} L ${x2} ${y} L ${x2} ${aboveSvgHeight}`;

          const colorIndex = getColorIndexForPair(pair);
          if (colorIndex === 0) return null; // Skip if no color

          return (
            <path
              key={idx}
              d={path}
              fill="none"
              stroke={`var(--bracket-${colorIndex})`}
              strokeWidth={getStrokeWidth(pair.depth)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={getOpacity(pair.depth)}
            />
          );
        })}
      </svg>
    );
  };

  // Render SVG paths for bracket lines below the formula
  const renderBelowLines = () => {
    if (!bracketPositions || !showBracketLines || !coloredBrackets || belowPairs.length === 0) return null;

    const { positions } = bracketPositions;

    return (
      <svg
        className="bracket-lines-svg bracket-lines-below"
        style={{
          position: 'absolute',
          left: 0,
          top: '100%',
          width: '100%',
          height: belowSvgHeight,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {belowPairs.map((pair, idx) => {
          const openRect = positions.get(pair.openIndex);
          const closeRect = positions.get(pair.closeIndex);
          if (!openRect || !closeRect) return null;

          // Calculate x positions (center of each bracket)
          const x1 = openRect.left + openRect.width / 2;
          const x2 = closeRect.left + closeRect.width / 2;

          // Map depth to level: 0->0, 2->1, 4->2, etc.
          const level = Math.floor(pair.depth / 2);
          // Y position from top (closer levels are closer to text)
          const y = (level + 1) * lineSpacing;

          // U-shaped path: down from left, across, up to right
          const path = `M ${x1} 0 L ${x1} ${y} L ${x2} ${y} L ${x2} 0`;

          const colorIndex = getColorIndexForPair(pair);
          if (colorIndex === 0) return null; // Skip if no color

          return (
            <path
              key={idx}
              d={path}
              fill="none"
              stroke={`var(--bracket-${colorIndex})`}
              strokeWidth={getStrokeWidth(pair.depth)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={getOpacity(pair.depth)}
            />
          );
        })}
      </svg>
    );
  };

  const showLines = showBracketLines && coloredBrackets && bracketPositions;
  const hasAboveLines = showLines && abovePairs.length > 0;
  const hasBelowLines = showLines && belowPairs.length > 0;

  return (
    <span
      ref={containerRef}
      className={className}
      style={{
        ...style,
        position: 'relative',
        display: 'inline-block',
        paddingTop: hasAboveLines ? aboveSvgHeight : undefined,
        paddingBottom: hasBelowLines ? belowSvgHeight : undefined,
      }}
    >
      {elements}
      {renderAboveLines()}
      {renderBelowLines()}
    </span>
  );
};
