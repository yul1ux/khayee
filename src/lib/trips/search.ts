export type TripSearchParams = Record<string, string | string[] | undefined>;

export type TripSearchFilters = {
  query: string;
  categoryId: string;
  categoryName: string;
  destinationId: string;
  destinationName: string;
  date: string;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  difficulty: string;
  sort: "soonest" | "price_low" | "price_high" | "newest";
  page: number;
};

export type ParsedTripSearch = {
  filters: TripSearchFilters;
  error?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIFFICULTIES = ["easy", "moderate", "challenging"];
const SORTS = ["soonest", "price_low", "price_high", "newest"] as const;

function firstValue(params: TripSearchParams, name: string) {
  const value = params[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parsePrice(value: string) {
  if (!value) return { value: undefined, error: undefined };
  if (!/^\d+$/.test(value)) {
    return { value: undefined, error: "Enter prices as whole MMK amounts." };
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return { value: undefined, error: "Enter a valid MMK amount." };
  }
  return { value: amount, error: undefined };
}

export function myanmarDateBounds(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const midnightUtc = Date.UTC(year, month - 1, day);
  const nextMidnightUtc = midnightUtc + 24 * 60 * 60 * 1000;
  const myanmarOffset = 390 * 60 * 1000;
  return {
    from: new Date(midnightUtc - myanmarOffset).toISOString(),
    to: new Date(nextMidnightUtc - myanmarOffset).toISOString(),
  };
}

export function parseTripSearchParams(params: TripSearchParams): ParsedTripSearch {
  const query = firstValue(params, "q").trim();
  const categoryId = firstValue(params, "categoryId");
  const categoryName = firstValue(params, "categoryName").trim();
  const destinationId = firstValue(params, "destinationId");
  const destinationName = firstValue(params, "destinationName").trim();
  const date = firstValue(params, "date");
  const difficulty = firstValue(params, "difficulty");
  const sortValue = firstValue(params, "sort");
  const pageText = firstValue(params, "page");
  const minPriceResult = parsePrice(firstValue(params, "minPrice"));
  const maxPriceResult = parsePrice(firstValue(params, "maxPrice"));

  let error =
    minPriceResult.error ??
    maxPriceResult.error ??
    undefined;
  if (query.length > 100) error = "Search text must be 100 characters or fewer.";
  if (categoryId && !UUID_PATTERN.test(categoryId)) error = "Choose a valid trip category.";
  if (categoryName && categoryName.length > 100) error = "Choose a valid trip category.";
  if (categoryName && !isValidTripFilterSlug(categoryName)) error = "Choose a valid trip category.";
  if (destinationId && !UUID_PATTERN.test(destinationId)) error = "Choose a valid destination.";
  if (destinationName && destinationName.length > 160) error = "Choose a valid destination.";
  if (destinationName && !isValidTripFilterSlug(destinationName)) error = "Choose a valid destination.";
  if (date && !myanmarDateBounds(date)) error = "Choose a valid departure date.";
  if (difficulty && !DIFFICULTIES.includes(difficulty)) error = "Choose a valid difficulty.";
  if (sortValue && !SORTS.includes(sortValue as (typeof SORTS)[number])) {
    error = "Choose a valid sort order.";
  }
  if (minPriceResult.value !== undefined && maxPriceResult.value !== undefined &&
      minPriceResult.value > maxPriceResult.value) {
    error = "Minimum price cannot exceed maximum price.";
  }
  const page = pageText ? Number(pageText) : 1;
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) {
    error = "Choose a valid results page.";
  }

  return {
    filters: {
      query,
      categoryId,
      categoryName,
      destinationId,
      destinationName,
      date,
      minPrice: minPriceResult.value,
      maxPrice: maxPriceResult.value,
      difficulty,
      sort: SORTS.includes(sortValue as (typeof SORTS)[number])
        ? (sortValue as TripSearchFilters["sort"])
        : "soonest",
      page: Number.isSafeInteger(page) && page > 0 && page <= 1000 ? page : 1,
    },
    ...(error ? { error } : {}),
  };
}

export function isValidTripFilterSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
