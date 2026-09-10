/** Route helper: page name -> path. Keeps links in one place. */
export function createPageUrl(page) {
  return page === "Home" ? "/" : `/${page.toLowerCase()}`;
}
