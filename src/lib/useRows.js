import { useCallback, useEffect, useState } from "react";

/* Run a Supabase query and keep its rows, with reload(). `deps` re-run it. */
export function useRows(query, deps) {
  const [state, setState] = useState({ rows: null, error: null });
  const reload = useCallback(async () => {
    const { data, error } = await query();
    setState({ rows: data ?? [], error });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
