import { atom, GetRecoilValue, selector, selectorFamily } from "recoil";
import { v4 as uuid } from "uuid";

import { request } from "../utils/socket";
import { viewsAreEqual } from "../utils/view";

import * as atoms from "./atoms";
import { DATE_FIELD, DATE_TIME_FIELD, FLOAT_FIELD } from "./constants";
import * as filterAtoms from "./filters";
import * as selectors from "./selectors";
import * as schemaAtoms from "./schema";
import * as viewAtoms from "./view";
import { State } from "./types";
import { modalFilters } from "./filters";

type DateTimeBound = { datetime: number } | null;

type DateTimeBounds = [DateTimeBound, DateTimeBound];

type Bound = number | null;

type FloatBounds = {
  bounds: [Bound, Bound];
  nan: number;
  "-inf": number;
  inf: number;
};

type Bounds = [Bound, Bound] | DateTimeBounds | FloatBounds;
type Count = number;
type None = number;
type CountValues<T> = [number, [T, number][]];

type BaseAggregations = {
  Count: Count;
  None: None;
};

type CategoricalAggregations<T = unknown> = {
  CountValues: CountValues<T>;
} & BaseAggregations;

type NumericAggregations = {
  Bounds: Bounds;
} & BaseAggregations;

type Aggregations = CategoricalAggregations | NumericAggregations;

type AggregationsData = {
  [path: string]: Aggregations;
};

type AggregationsResult = {
  view: State.Stage[];
  data: AggregationsData;
};

export const addNoneCounts = (
  data: AggregationsData,
  video: boolean = false
) => {
  let count = data[""].Count;
  const frameCount = data?.frames?.Count;
  let check = true;

  for (let path in data) {
    let parent = path.includes(".")
      ? path.split(".").slice(0, -1).join(".")
      : path;

    if (video && path.startsWith("frames.")) {
      count = frameCount;
      path = path.slice("frames.".length);
      let parent = path.includes(".")
        ? path.split(".").slice(0, -1).join(".")
        : path;

      check = path.includes(".");
      path = "frames." + path;
      parent = "frames." + parent;
    }

    if (path === parent) {
      data[path] = {
        None: count - data[path].Count,
        ...data[path],
      };
    } else if (check && path.includes(".") && data[parent] && data[path]) {
      data[path] = {
        None: data[parent].Count - data[path].Count,
        ...data[path],
      };
    }
  }
};

export const aggregationsRaw = atom<AggregationsResult>({
  key: "aggregationsRaw",
  default: {
    view: null,
    data: {},
  },
});

export const aggregations = selector<AggregationsData>({
  key: "aggregations",
  get: ({ get }) => {
    let { data, view } = get(aggregationsRaw);
    if (!view) {
      return null;
    }

    if (viewsAreEqual(view, get(viewAtoms.view))) {
      data = { ...data };
      data && addNoneCounts(data);
      return data;
    }
    return null;
  },
});

type ExtendedAggregationsResult = {
  filters: State.Filters;
} & AggregationsResult;

export const extendedAggregationsRaw = atom<ExtendedAggregationsResult>({
  key: "extendedAggregationsStatsRaw",
  default: {
    view: null,
    data: null,
    filters: null,
  },
});

const normalizeFilters = (filters) => {
  const names = Object.keys(filters).sort();
  const list = names.map((n) => filters[n]);
  return JSON.stringify([names, list]);
};

export const filtersAreEqual = (filtersOne, filtersTwo) => {
  return normalizeFilters(filtersOne) === normalizeFilters(filtersTwo);
};

export const extendedAggregations = selector({
  key: "extendedAggregations",
  get: ({ get }) => {
    if (!get(filterAtoms.hasFilters(false))) {
      return get(aggregations);
    }

    let { view, filters, data } = get(extendedAggregationsRaw);
    if (!view) {
      return null;
    }
    if (!viewsAreEqual(view, get(viewAtoms.view))) {
      return null;
    }
    if (!filtersAreEqual(filters, get(filterAtoms.filters))) {
      return null;
    }

    if (!data) {
      return null;
    }

    data = { ...data };
    addNoneCounts(data);
    return data;
  },
});

const modalAggregations = selector<AggregationsData>({
  key: "modalAggregations",
  get: async ({ get }) => {
    const id = uuid();
    const { data } = await request({
      type: "modal_statistics",
      uuid: id,
      args: {
        sample_id: get(atoms.modal).sample._id,
      },
    });

    data && addNoneCounts(data, get(selectors.isVideoDataset));

    return data;
  },
});

const extendedModalAggregations = selector<AggregationsData>({
  key: "extendedModalAggregations",
  get: async ({ get }) => {
    if (!get(filterAtoms.hasFilters(true))) {
      return get(modalAggregations);
    }

    const id = uuid();
    const { data } = await request({
      type: "modal_statistics",
      uuid: id,
      args: {
        sample_id: get(atoms.modal).sample._id,
        filters: get(modalFilters),
      },
    });

    data && addNoneCounts(data, get(selectors.isVideoDataset));

    return data;
  },
});

export const noneCount = selectorFamily<
  number,
  { path: string; modal: boolean; extended: boolean }
>({
  key: "noneCount",
  get: ({ extended, path, modal }) => ({ get }) => {
    const atom = modal
      ? extended
        ? extendedModalAggregations
        : modalAggregations
      : extended
      ? extendedAggregations
      : aggregations;

    return get(atom)[path].None;
  },
});

export const labelTagCounts = selectorFamily<
  { [key: string]: number },
  { modal: boolean; extended: boolean }
>({
  key: "labelTagCounts",
  get: ({ modal, extended }) => ({ get }) => {
    const atom = modal
      ? extended
        ? extendedModalAggregations
        : modalAggregations
      : extended
      ? extendedAggregations
      : aggregations;
    const data = get(atom);
    const paths = get(schemaAtoms.labelPaths({})).map((path) => `${path}.tags`);
    const result = {};

    for (const path of paths) {
      const pathData = data[path] as CategoricalAggregations;
      for (const [tag, count] of Object.entries(pathData.CountValues)) {
        if (!result[tag]) {
          result[tag] = 0;
        }

        result[tag] += count;
      }
    }

    return result;
  },
});

export const sampleTagCounts = selectorFamily<
  { [key: string]: number },
  { modal: boolean; extended: boolean }
>({
  key: "sampleTagCounts",
  get: ({ modal, extended }) => ({ get }) => {
    const atom = modal
      ? extended
        ? extendedModalAggregations
        : modalAggregations
      : extended
      ? extendedAggregations
      : aggregations;
    const data = get(atom).tags as CategoricalAggregations;
    return Object.fromEntries(data.CountValues[1]);
  },
});

const makeCountResults = <T>(key) =>
  selectorFamily<
    { count: number; results: [T, number][] },
    { path: string; modal: boolean; extended: boolean }
  >({
    key,
    get: ({ extended, path, modal }) => ({ get }) => {
      const atom = modal
        ? extended
          ? extendedModalAggregations
          : modalAggregations
        : extended
        ? extendedAggregations
        : aggregations;

      const data = get(atom)[path] as CategoricalAggregations<T>;

      return {
        count: data.Count + data.None,
        results: [...data.CountValues[1], [null, data.None]],
      };
    },
  });

export const booleanCountResults = makeCountResults<boolean | null>(
  "booleanCountResults"
);

export const stringCountResults = makeCountResults<string | null>(
  "stringCountResults"
);

export const labelCount = selectorFamily<number | null, boolean>({
  key: "labelCount",
  get: (modal) => ({ get }) => {
    const atom = get(filterAtoms.hasFilters(modal))
      ? modal
        ? extendedModalAggregations
        : extendedAggregations
      : modal
      ? modalAggregations
      : aggregations;

    let sum = 0;
    const data = get(atom);

    for (const label of get(schemaAtoms.activeLabelPaths({ modal }))) {
      sum += data[label].Count;
    }

    return sum;
  },
});
export const values = selectorFamily<
  string[],
  { extended: boolean; path: string; modal: boolean }
>({
  key: "values",
  get: ({ extended, path, modal }) => ({ get }) => {
    const atom = modal
      ? extended
        ? extendedModalAggregations
        : modalAggregations
      : extended
      ? extendedAggregations
      : aggregations;

    const data = get(atom);

    if (data) {
      const agg = data[path] as CategoricalAggregations<string>;
      return agg.CountValues[1].map(([value]) => value).sort();
    }

    return [];
  },
});

export const count = selectorFamily<
  number,
  {
    extended: boolean;
    path: string;
    modal: boolean;
    ftype?: string | string[];
    embeddedDocType?: string | string[];
  }
>({
  key: "count",
  get: (params) => ({ get }) => {
    const { extended, modal, path } = params;

    const atom = modal
      ? extended
        ? extendedModalAggregations
        : modalAggregations
      : extended
      ? extendedAggregations
      : aggregations;

    const data = get(atom);
    if (!data) {
      return null;
    }

    if (data[path]) {
      return data[path]?.Count;
    }

    const split = path.split(".");

    if (split.length < 2) {
      throw new Error(`invalid path ${path}`);
    }

    const parent = split.slice(0, split.length - 1).join(".");
    if (data[parent]) {
      return get(counts({ extended, path: parent, modal }))[
        split[split.length - 1]
      ];
    }

    return data ? data[path]?.Count : null;
  },
});

export const counts = selectorFamily<
  { [key: string]: number },
  { extended: boolean; path: string; modal: boolean }
>({
  key: "counts",
  get: ({ extended, modal, path }) => ({ get }) => {
    const atom = modal
      ? extended
        ? extendedModalAggregations
        : modalAggregations
      : extended
      ? extendedAggregations
      : aggregations;

    const data = get(atom);
    return data
      ? Object.fromEntries(
          (data[path] as CategoricalAggregations).CountValues[1]
        )
      : null;
  },
});

const gatherPaths = (
  get: GetRecoilValue,
  ftype: string | string[],
  embeddedDocType?: string | string[]
) => {
  const paths = [];

  const recurseFields = (path) => {
    const field = get(schemaAtoms.field(path));
    if (get(schemaAtoms.meetsType({ path, ftype, embeddedDocType }))) {
      paths.push(path);
    }
    if (field.fields) {
      Object.keys(field.fields).forEach((name) =>
        recurseFields(`${path}.${name}`)
      );
    }
  };

  const schema = get(schemaAtoms.fieldPaths({}));
  for (const path of schema) recurseFields(path);
  return paths;
};

export const cumulativeCounts = selectorFamily<
  { [key: string]: number },
  {
    extended: boolean;
    path: string;
    modal: boolean;
    ftype: string | string[];
    embeddedDocType?: string | string[];
  }
>({
  key: "cumulativeCounts",
  get: ({ extended, path: key, modal, ftype, embeddedDocType }) => ({ get }) =>
    gatherPaths(get, ftype, embeddedDocType).reduce((result, path) => {
      const data = get(counts({ extended, modal, path: `${path}.${key}` }));
      for (const value in data) {
        if (!result[value]) {
          result[value] = 0;
        }

        result[value] += data[value];

        return result;
      }
    }, {}),
});

export const cumulativeValues = selectorFamily<
  string[],
  {
    extended: boolean;
    path: string;
    modal: boolean;
    ftype: string | string[];
    embeddedDocType?: string | string[];
  }
>({
  key: "cumulativeValues",
  get: ({ extended, path: key, modal, ftype, embeddedDocType }) => ({
    get,
  }) => {
    return Array.from(
      new Set<string>(
        gatherPaths(get, ftype, embeddedDocType).reduce(
          (result, path) => [
            ...result,
            ...get(values({ extended, modal, path: `${path}.${key}` })),
          ],
          []
        )
      )
    ).sort();
  },
});

export const bounds = selectorFamily<
  [Bound, Bound],
  { extended: boolean; path: string; modal: boolean }
>({
  key: "bounds",
  get: ({ extended, modal, path }) => ({ get }) => {
    const atom = modal
      ? extended
        ? extendedModalAggregations
        : modalAggregations
      : extended
      ? extendedAggregations
      : aggregations;

    const data = get(atom)[path] as NumericAggregations;
    const isDateOrDateTime = get(
      schemaAtoms.meetsType({ path, ftype: [DATE_FIELD, DATE_TIME_FIELD] })
    );

    if (isDateOrDateTime) {
      const [lower, upper] = data.Bounds as DateTimeBounds;

      return [lower.datetime, upper.datetime] as [Bound, Bound];
    }

    const isFloatField = get(
      schemaAtoms.meetsType({ path, ftype: FLOAT_FIELD })
    );

    if (isFloatField) {
      return (data.Bounds as FloatBounds).bounds;
    }

    return data.Bounds as [Bound, Bound];
  },
});

export interface NonfiniteCounts {
  none: number;
  inf?: number;
  ninf?: number;
  nan?: number;
}

export const nonfiniteCounts = selectorFamily<
  NonfiniteCounts,
  { extended: boolean; path: string; modal: boolean }
>({
  key: "nonfiniteCounts",
  get: ({ extended, modal, path }) => ({ get }) => {
    const atom = modal
      ? extended
        ? extendedModalAggregations
        : modalAggregations
      : extended
      ? extendedAggregations
      : aggregations;

    const data = get(atom)[path] as NumericAggregations;
    const isFloatField = get(
      schemaAtoms.meetsType({ path, ftype: [DATE_FIELD, DATE_TIME_FIELD] })
    );

    const result = { none: data.None };

    if (isFloatField) {
      const bounds = data.Bounds as FloatBounds;
      return {
        ...result,
        nan: bounds.nan,
        ninf: bounds["-inf"],
        inf: bounds.inf,
      };
    }

    return result;
  },
});
