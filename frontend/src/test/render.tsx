import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "../App";
import { DataSourceProvider } from "../data/source";
import type { DataSource } from "../lib/api";
import { NowProvider } from "../lib/now";
import { makeSource } from "./fixtures";

export interface RenderAppOptions {
  /** Freezes the clock the pages read (relative times); absent, they use the real one. */
  now?: Date;
}

/** Mounts the whole app at `path` over a fake data source, the way the page tests do. */
export function renderApp(
  path: string,
  source: Partial<DataSource> = {},
  { now }: RenderAppOptions = {},
) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
  return render(
    <DataSourceProvider source={makeSource(source)}>
      {now ? <NowProvider now={now}>{tree}</NowProvider> : tree}
    </DataSourceProvider>,
  );
}
