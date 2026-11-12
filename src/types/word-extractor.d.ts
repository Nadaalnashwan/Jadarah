// Minimal types for word-extractor (reads legacy Word .doc files; ships no type definitions).
declare module "word-extractor" {
  interface WordDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
  }
  export default class WordExtractor {
    extract(source: Buffer | string): Promise<WordDocument>;
  }
}
