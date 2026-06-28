import { useState } from 'react';
import { api } from '../api/client';
import { relationColor } from '../lib/relations';
import { useStore } from '../state/store';
import type { QueryResult, SearchResult } from '../types';

export function PlaygroundPanel(): JSX.Element {
  const { scope, select } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchResult[] | null>(null);
  const [query, setQuery] = useState<QueryResult | null>(null);

  const run = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const [searchResult, queryResult] = await Promise.all([api.search(text, scope), api.query(text, scope)]);
      setSearch(Array.isArray(searchResult) ? searchResult : []);
      setQuery(queryResult && 'answer' in queryResult ? queryResult : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'query failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={run} className="flex items-center gap-2 border-b border-line px-4 py-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="ask the memory graph…"
          className="focusable readout flex-1 rounded-sm border border-line bg-panel px-3 py-2 text-base text-ink placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={loading}
          className="focusable label rounded-sm bg-amber px-4 py-2 text-sm text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'running…' : 'run'}
        </button>
      </form>

      {error ? <div className="readout border-b border-line px-4 py-2 text-sm text-danger">{error}</div> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-x divide-line md:grid-cols-2">
        <section className="flex min-h-0 flex-col">
          <div className="label border-b border-line/60 px-4 py-2 text-[13px]">search · hybrid</div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {search === null ? (
              <Hint text="run a query to rank memories by semantic + lexical score" />
            ) : search.length === 0 ? (
              <Hint text="no results" />
            ) : (
              search.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => select(result.id)}
                  className="focusable block w-full rounded-sm px-2 py-2 text-left hover:bg-panel-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="readout truncate text-sm text-ink">{result.file_name}</span>
                    <span className="readout shrink-0 text-[14px] text-amber">{result.score.toFixed(3)}</span>
                  </div>
                  {result.superseded ? <span className="label text-[11px] text-danger">superseded</span> : null}
                  <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-dim">{result.content}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="label border-b border-line/60 px-4 py-2 text-[13px]">query · graph-expanded</div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {query === null ? (
              <Hint text="run a query to compile an answer and surface graph-connected candidates" />
            ) : (
              <>
                {query.answer ? (
                  <div className="panel mb-3 whitespace-pre-wrap p-3 text-[15px] leading-relaxed text-ink/90">
                    {query.answer}
                  </div>
                ) : null}
                <div className="label mb-1 px-1 text-[12px]">candidates</div>
                {query.candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => select(candidate.id)}
                    className="focusable block w-full rounded-sm px-2 py-2 text-left hover:bg-panel-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="readout truncate text-sm text-ink">{candidate.file_name}</span>
                      <span className="readout shrink-0 text-[14px] text-cyan">{candidate.score.toFixed(3)}</span>
                    </div>
                    {candidate.via ? (
                      <span className="readout text-[13px]" style={{ color: relationColor(candidate.via.relation) }}>
                        via {candidate.via.relation} · {candidate.via.weight}
                      </span>
                    ) : null}
                    <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-dim">{candidate.preview}</p>
                  </button>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Hint({ text }: { text: string }): JSX.Element {
  return <p className="readout px-2 py-4 text-center text-[14px] text-ink-faint">{text}</p>;
}
