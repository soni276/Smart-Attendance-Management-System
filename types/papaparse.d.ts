declare module "papaparse" {
  export interface ParseMeta {
    fields?: string[];
  }

  export interface ParseResult<T> {
    data: T[];
    meta: ParseMeta;
    errors: unknown[];
  }

  export interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean;
    complete?: (results: ParseResult<T>) => void;
  }

  export function parse<T>(file: File, config: ParseConfig<T>): void;

  const Papa: {
    parse: typeof parse;
  };

  export default Papa;
}
