import { useCallback } from 'react';

export interface SearchResult {
  id: string;
  text: string;
  section: string;
  element: HTMLElement;
  matchStart: number;
  matchEnd: number;
  type: 'text' | 'attribute' | 'brand'; // Type of match
}

export const useContentSearch = () => {
  const searchContent = useCallback((query: string): SearchResult[] => {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    const mainContent = document.querySelector('main');
    if (!mainContent) return [];

    const lowerQuery = query.toLowerCase();
    let resultId = 0;

    // 1. Search in text nodes (visible text)
    const walker = document.createTreeWalker(
      mainContent,
      NodeFilter.SHOW_TEXT,
      null
    );

    let textNode;
    while ((textNode = walker.nextNode())) {
      const text = textNode.nodeValue || '';
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes(lowerQuery)) {
        const matchStart = lowerText.indexOf(lowerQuery);
        const matchEnd = matchStart + lowerQuery.length;
        
        // Get the parent element (usually the one with actual styling)
        let element = textNode.parentElement as HTMLElement;
        
        // Try to find a more meaningful parent element
        while (element && element !== mainContent) {
          if (element.className || element.tagName.match(/^(H[1-6]|P|DIV|SECTION)$/i)) {
            break;
          }
          element = element.parentElement as HTMLElement;
        }

        if (element && element !== mainContent) {
          // Get section title (nearest heading or container label)
          const sectionTitle = findNearestSection(element, mainContent);
          
          results.push({
            id: `search-result-${resultId++}`,
            text: text.substring(Math.max(0, matchStart - 20), Math.min(text.length, matchEnd + 20)),
            section: sectionTitle,
            element,
            matchStart,
            matchEnd,
            type: 'text',
          });
        }
      }
    }

    // 2. Search in data attributes (for hidden data like brand names in cards)
    const allElements = mainContent.querySelectorAll('[data-searchable]');
    allElements.forEach(el => {
      const searchableData = (el as HTMLElement).getAttribute('data-searchable') || '';
      const lowerData = searchableData.toLowerCase();
      
      if (lowerData.includes(lowerQuery)) {
        const matchStart = lowerData.indexOf(lowerQuery);
        const matchEnd = matchStart + lowerQuery.length;
        
        const sectionTitle = findNearestSection(el as HTMLElement, mainContent);
        
        results.push({
          id: `search-result-${resultId++}`,
          text: searchableData.substring(Math.max(0, matchStart - 20), Math.min(searchableData.length, matchEnd + 20)),
          section: sectionTitle,
          element: el as HTMLElement,
          matchStart,
          matchEnd,
          type: 'attribute',
        });
      }
    });

    // 3. Search in brand names (cards with data-brand-name attribute)
    const brandElements = mainContent.querySelectorAll('[data-brand-name]');
    brandElements.forEach(el => {
      const brandName = (el as HTMLElement).getAttribute('data-brand-name') || '';
      const lowerBrand = brandName.toLowerCase();
      
      if (lowerBrand.includes(lowerQuery)) {
        const matchStart = lowerBrand.indexOf(lowerQuery);
        const matchEnd = matchStart + lowerQuery.length;
        
        const sectionTitle = findNearestSection(el as HTMLElement, mainContent);
        
        results.push({
          id: `search-result-${resultId++}`,
          text: `Brand: ${brandName}`,
          section: sectionTitle,
          element: el as HTMLElement,
          matchStart,
          matchEnd,
          type: 'brand',
        });
      }
    });

    // Remove duplicates (same element + same text)
    const uniqueResults = Array.from(
      results.reduce((map, result) => {
        const key = `${result.element.id || result.element.className}-${result.text}`;
        if (!map.has(key)) map.set(key, result);
        return map;
      }, new Map<string, SearchResult>()).values()
    );

    return uniqueResults;
  }, []);

  const highlightResults = useCallback((results: SearchResult[]) => {
    // Remove previous highlights
    document.querySelectorAll('.search-highlight').forEach(el => {
      el.classList.remove('search-highlight');
    });

    // Add highlights to new results
    results.forEach(result => {
      result.element.classList.add('search-highlight');
    });
  }, []);

  const scrollToResult = useCallback((element: HTMLElement) => {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('search-highlight-active');
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      element.classList.remove('search-highlight-active');
    }, 2000);
  }, []);

  return {
    searchContent,
    highlightResults,
    scrollToResult,
  };
};

/**
 * Find the nearest section title or container label
 */
function findNearestSection(element: HTMLElement, root: HTMLElement): string {
  let current = element.parentElement;
  
  while (current && current !== root) {
    // Check for headings
    const heading = current.querySelector('h1, h2, h3, h4');
    if (heading?.textContent) {
      return heading.textContent.substring(0, 50);
    }

    // Check for aria-label or data-section
    const label = current.getAttribute('aria-label') || current.getAttribute('data-section');
    if (label) {
      return label;
    }

    // Check for title attribute
    const title = current.getAttribute('title');
    if (title) {
      return title;
    }

    current = current.parentElement;
  }

  return 'Content';
}
