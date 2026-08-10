import React from "react";
import type { ListQuery } from "../../api/client";

export type ListSort = NonNullable<ListQuery["sort"]>;

type FilterDraft<S extends ListSort> = {
  search: string;
  from: string;
  to: string;
  sort: S;
};

export function useAdminListRules<S extends ListSort>(pageSize: number, defaultSort: S) {
  const empty = React.useCallback((): FilterDraft<S> => ({ search: "", from: "", to: "", sort: defaultSort }), [defaultSort]);
  const [draft, setDraft] = React.useState<FilterDraft<S>>(empty);
  const [applied, setApplied] = React.useState<FilterDraft<S>>(empty);
  const draftRef = React.useRef<FilterDraft<S>>(draft);
  const [page, setPage] = React.useState(1);

  const updateDraft = React.useCallback(<K extends keyof FilterDraft<S>>(field: K, value: FilterDraft<S>[K]) => {
    const next = { ...draftRef.current, [field]: value };
    draftRef.current = next;
    setDraft(next);
  }, []);

  const apply = React.useCallback(() => {
    setPage(1);
    setApplied({ ...draftRef.current, search: draftRef.current.search.trim() });
  }, []);

  const reset = React.useCallback(() => {
    const next = empty();
    draftRef.current = next;
    setDraft(next);
    setApplied(next);
    setPage(1);
  }, [empty]);

  const query = React.useMemo<ListQuery>(() => ({
    page,
    page_size: pageSize,
    search: applied.search,
    from: applied.from,
    to: applied.to,
    sort: applied.sort,
  }), [applied, page, pageSize]);

  return { draft, applied, page, setPage, updateDraft, apply, reset, query };
}
