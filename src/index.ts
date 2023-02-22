import { FetchOptions, Headers, ofetch } from "ofetch";
import murmurhash from "murmurhash";

const HASH_MULTIPLIER = 2 ** 32 / 10_000;

export interface PreprClientOptions {
  token: string;

  baseUrl?: string | URL;

  timeout?: number;

  userId?: string;
}

export default class PreprClient {
  #headers = new Headers();

  #baseUrl = new URL("https://cdn.prepr.io");

  #timeout = 4000;

  #userId?: number;

  #path = "";

  #graphqlQuery?: string;
  #graphqlVariables: object = {};

  public query = new URLSearchParams();

  constructor(options: PreprClientOptions) {
    this.token(options.token);

    if (options.baseUrl) this.#baseUrl = new URL(options.baseUrl);

    if (typeof options.timeout === "number") this.#timeout = options.timeout;

    if (options.userId) this.#userId = this.calculateUserId(options.userId);
  }

  private calculateUserId(userId: string): number {
    return murmurhash(userId, 1) * HASH_MULTIPLIER;
  }

  userId(userId?: string) {
    this.#userId =
      typeof userId === "string" ? this.calculateUserId(userId) : userId;

    return this;
  }

  timeout(milliseconds: number) {
    this.#timeout = milliseconds;

    return this;
  }

  sort(field: string) {
    this.query.set("sort", field);

    return this;
  }

  limit(limit: number) {
    this.query.set("limit", `${limit}`);

    return this;
  }

  skip(skip: number) {
    this.query.set("skip", `${skip}`);

    return this;
  }

  path(path: string) {
    this.#path = path;

    return this;
  }

  token(token: string) {
    this.#headers.set("Authorization", `Bearer ${token}`);

    return this;
  }

  graphqlQuery(graphqlQuery: string) {
    this.#graphqlQuery = graphqlQuery;

    return this;
  }

  graphqlVariables(graphqlVariables: object) {
    this.#graphqlVariables = graphqlVariables;

    return this;
  }

  async fetch<T = any>(
    request: RequestInfo = this.#path,
    options?: FetchOptions<"json">
  ) {
    const controller = new AbortController();

    const fetchTimeout = setTimeout(controller.abort, this.#timeout);

    const url = new URL(this.#path, this.#baseUrl);
    url.search = this.query.toString();

    if (this.#userId) {
      this.#headers.set("Prepr-ABTesting", `${this.#userId}`);
    }

    let gqlOptions: FetchOptions = {};

    if (this.#graphqlQuery) {
      gqlOptions.method = "POST";
      gqlOptions.body = {
        query: this.#graphqlQuery,
        variables: this.#graphqlVariables,
      };
    }

    const fetcher = ofetch.create({
      baseURL: this.#baseUrl.toString(),
      headers: this.#headers,
      query: this.query,
      signal: controller.signal,
      onResponse: () => {
        clearTimeout(fetchTimeout);

        this.query = new URLSearchParams();
        this.#graphqlQuery = "";
        this.#graphqlVariables = {};
      },
      ...gqlOptions,
    });

    return fetcher<T>(request, options);
  }
}

export const createPreprClient = (options: PreprClientOptions) =>
  new PreprClient(options);
