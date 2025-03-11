import { cn } from "@/lib/utils";
import { SessionLiveURLs } from "@browserbasehq/sdk/resources/index.mjs";
import { useEffect, useState } from "react";

let abortController: AbortController | null = null;
async function getPages(sessionId: string) {
  try {
    // abort any previous requests
    if (abortController) {
      abortController.abort("Aborted previous request");
    }
    abortController = new AbortController();
    const res = await fetch(`/api/session/${sessionId}/pages`, {
      signal: abortController.signal,
    });
    const data = await res.json();
    return data.pages;
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

const refetchInterval = 5000;

export default function BrowserTabs({
  sessionId,
  activePage,
  setActivePage,
}: {
  sessionId: string;
  activePage: SessionLiveURLs.Page | null;
  setActivePage: (page: SessionLiveURLs.Page) => void;
}) {
  const [pages, setPages] = useState<SessionLiveURLs.Page[]>([]);

  useEffect(() => {
    const refetchPages = async () => {
      const pages = await getPages(sessionId);
      setPages(pages);
    };

    refetchPages();
    const interval = setInterval(refetchPages, refetchInterval);

    return () => clearInterval(interval);
  }, [sessionId]);

  // fallback to first page if activePageId is not found
  useEffect(() => {
    if (!activePage && pages.length > 0) {
      setActivePage(pages[0]);
    }
  }, [activePage, pages, setActivePage]);

  console.log(pages, activePage);

  if (pages.length === 0 || !activePage) {
    return null;
  }

  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${pages.length}, 1fr)`,
      }}
    >
      {pages.map((page) => (
        <div
          key={page.id}
          onClick={() => setActivePage(page)}
          className={cn(
            "bg-[rgb(248,248,255)] rounded-[1px] border border-[rgb(230,225,240)] text-sm flex gap-x-1 p-1 max-w-[300px] truncate whitespace-nowrap cursor-pointer hover:border-gray-400",
            {
              "bg-[rgb(245,240,255)]": page.id === activePage?.id,
            }
          )}
        >
          {page.faviconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.faviconUrl} alt={page.title} className="size-3" />
          )}
          {page.title || page.url}
        </div>
      ))}
    </div>
  );
}
