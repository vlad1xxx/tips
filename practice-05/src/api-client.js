export class ApiError extends Error {
  constructor(message, {
    kind,
    status = null,
    code = null,
    details = null,
    url = null,
    cause,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// Проверяет baseUrl и возвращает его без завершающих "/".
function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    throw new TypeError("baseUrl должен быть непустой строкой.");
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new TypeError(`baseUrl должен быть абсолютным адресом: «${baseUrl}».`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError(`baseUrl должен использовать http или https: «${baseUrl}».`);
  }
  if (parsed.search !== "" || parsed.hash !== "" || baseUrl.includes("?") || baseUrl.includes("#")) {
    throw new TypeError("baseUrl не должен содержать query и hash.");
  }

  return parsed.href.replace(/\/+$/, "");
}

// Создаёт URL относительно baseUrl и добавляет непустые параметры query.
// Значения кодируются средствами URL и URLSearchParams, а не вручную.
export function buildUrl(baseUrl, path, query = {}) {
  const base = normalizeBaseUrl(baseUrl);

  if (typeof path !== "string") {
    throw new TypeError("path должен быть строкой.");
  }
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  if (cleanPath === "") {
    throw new TypeError("path не должен быть пустым.");
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(cleanPath) || cleanPath.includes("?") || cleanPath.includes("#")) {
    throw new TypeError("path должен быть относительным путём без query и hash.");
  }
  if (!isPlainObject(query)) {
    throw new TypeError("query должен быть обычным объектом.");
  }

  const url = new URL(`${base}/${cleanPath}`);
  for (const [name, value] of Object.entries(query)) {
    // false и 0 содержательны, поэтому пропускаются только «пустые» значения.
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(name, String(value));
  }
  return url.href;
}

function validateTimeout(timeoutMs) {
  if (!isPositiveSafeInteger(timeoutMs)) {
    throw new TypeError("timeoutMs должен быть положительным целым числом миллисекунд.");
  }
}

// Читает тело ответа с ошибкой. Если JSON нет или он повреждён, возвращает null:
// статус HTTP при этом остаётся главным признаком ошибки.
async function readErrorPayload(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    const payload = await response.json();
    return isPlainObject(payload?.error) ? payload.error : null;
  } catch {
    return null;
  }
}

// fetchFn передаётся явно, чтобы модуль можно было проверить без реальной сети.
// Возвращаемый объект: { requestJson(path, { query, signal, timeoutMs } = {}) }.
export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 2000,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (typeof fetchFn !== "function") {
    throw new TypeError("fetchFn должен быть функцией.");
  }
  validateTimeout(timeoutMs);
  const defaultTimeoutMs = timeoutMs;

  async function requestJson(path, {
    query = {},
    signal,
    timeoutMs: requestTimeoutMs = defaultTimeoutMs,
  } = {}) {
    const url = buildUrl(normalizedBaseUrl, path, query);
    validateTimeout(requestTimeoutMs);
    if (signal !== undefined && !(signal instanceof AbortSignal)) {
      throw new TypeError("signal должен быть AbortSignal.");
    }

    // Тайм-аут и внешняя отмена объединяются в один сигнал для fetch.
    const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    // Отдельный try только вокруг fetch: ошибки обработки ответа ниже
    // не должны превратиться в network.
    let response;
    try {
      response = await fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: combinedSignal,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new ApiError("Запрос отменён.", { kind: "aborted", url, cause: error });
      }
      if (timeoutSignal.aborted) {
        throw new ApiError(
          `Превышено время ожидания ответа (${requestTimeoutMs} мс).`,
          { kind: "timeout", url, cause: error },
        );
      }
      throw new ApiError("Сервер недоступен: ответ не получен.", {
        kind: "network",
        url,
        cause: error,
      });
    }

    if (!(response instanceof Response)) {
      throw new ApiError("fetchFn вернул значение, не являющееся Response.", {
        kind: "invalid-response",
        url,
      });
    }

    // Сначала статус: HTTP-ошибка важнее формата тела.
    if (!response.ok) {
      const apiError = await readErrorPayload(response);
      throw new ApiError(
        typeof apiError?.message === "string" && apiError.message !== ""
          ? apiError.message
          : `HTTP ${response.status}: запрос не выполнен.`,
        {
          kind: "http",
          status: response.status,
          code: typeof apiError?.code === "string" ? apiError.code : null,
          details: apiError?.details ?? null,
          url,
        },
      );
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new ApiError(
        `Ожидался JSON, получен Content-Type «${contentType || "не указан"}».`,
        { kind: "invalid-response", status: response.status, url },
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ApiError("Сервер вернул повреждённый JSON.", {
        kind: "invalid-response",
        status: response.status,
        url,
        cause: error,
      });
    }
  }

  return { requestJson };
}
