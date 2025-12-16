import { useCallback, useEffect, useState } from 'react';

/**
 * Hook untuk filter cards berdasarkan search query
 * Menampilkan/menyembunyikan card yang match dengan query
 */
export const useCardFilter = (containerId?: string) => {
  const [filterQuery, setFilterQuery] = useState('');

  // Apply filter to cards with data-searchable or data-brand-name
  useEffect(() => {
    if (!filterQuery.trim()) {
      // Show all cards
      document.querySelectorAll('[data-filterable-card]').forEach(el => {
        (el as HTMLElement).style.display = '';
        (el as HTMLElement).classList.remove('search-filtered-hidden');
      });
      return;
    }

    const lowerQuery = filterQuery.toLowerCase();
    
    // Find cards to filter
    const container = containerId ? document.getElementById(containerId) : document.querySelector('main');
    if (!container) return;

    const cards = container.querySelectorAll('[data-filterable-card]');
    cards.forEach(card => {
      const brandName = (card as HTMLElement).getAttribute('data-brand-name') || '';
      const searchableData = (card as HTMLElement).getAttribute('data-searchable') || '';
      const cardName = (card as HTMLElement).getAttribute('data-card-name') || '';
      
      // Combine all searchable text
      const searchableText = `${brandName} ${searchableData} ${cardName}`.toLowerCase();
      
      const matches = searchableText.includes(lowerQuery);
      
      if (matches) {
        (card as HTMLElement).style.display = '';
        (card as HTMLElement).classList.remove('search-filtered-hidden');
      } else {
        (card as HTMLElement).style.display = 'none';
        (card as HTMLElement).classList.add('search-filtered-hidden');
      }
    });
  }, [filterQuery, containerId]);

  return {
    filterQuery,
    setFilterQuery,
    clearFilter: () => setFilterQuery(''),
  };
};

/**
 * Utility function untuk cek apakah ada cards yang visible
 */
export const getVisibleCardCount = (containerId?: string): number => {
  const container = containerId ? document.getElementById(containerId) : document.querySelector('main');
  if (!container) return 0;
  
  const allCards = container.querySelectorAll('[data-filterable-card]');
  const visibleCards = Array.from(allCards).filter(
    card => (card as HTMLElement).style.display !== 'none'
  );
  
  return visibleCards.length;
};
