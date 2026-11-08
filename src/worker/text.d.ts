// wrangler bundles .txt files as strings.
declare module '*.txt' {
  const text: string;
  export default text;
}
