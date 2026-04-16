export const getProbableWebImage = async (productName: string): Promise<string> => {
  try {
    // We try Wikipedia first, which is free and has no CORS issues, often having good product images for generic items (like Coca-Cola, Bread, etc)
    const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(productName)}&origin=*`);
    
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      if (wikiData.query && wikiData.query.pages) {
        const pages = wikiData.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId !== '-1' && pages[pageId].original && pages[pageId].original.source) {
          return pages[pageId].original.source;
        }
      }
    }
    
    // If Wikipedia fails or doesn't have an image, we use an initials-based image with random beautiful colors
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(productName)}&background=random&size=400&bold=true`;
  } catch (error) {
    console.warn("Failed to fetch web image:", error);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(productName)}&background=random&size=400&bold=true`;
  }
};
