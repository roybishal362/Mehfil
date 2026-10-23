/** Saves generated text (calendar files, CSV, JSON) as a download, entirely in the browser. */

export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/** A safe file name from a plan title: "Ananya & Rohan's Wedding" → "ananya-rohans-wedding". */
export function fileSlug(title: string): string {
  const slug = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'mehfil-plan';
}
