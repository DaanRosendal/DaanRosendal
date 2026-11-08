A built copy of limmat (https://www.npmjs.com/package/limmat, MIT, by Daan Rosendal), the streaming markdown renderer
the chat uses. It is vendored because the v0.1 release is not on npm yet. Rebuild it in ~/repos/limmat with
`npm run build`, then copy `dist/limmat.min.js` to `index.js`, plus `dist/index.d.ts` and `dist/style.css`.
Replace this folder with the npm package once it is published.
