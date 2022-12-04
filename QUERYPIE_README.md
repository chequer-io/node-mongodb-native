# QueryPie MongoDB

## What We Changed
- Everything in `src/querypie` directory
- Add export statements in `index.ts` for classes, enums, interfaces and etc in `src/querypie`
- Change `cmap/connection.ts` for customize runCommand phase
  - Rename `write` function to `writeInternal`
  - Add `writeInternalAsync` function, it is just promisified `writeInternal`
  - Add `write` function using querypie run command phase.
    - calling `writeInterlAsync` in `write` function
  - Add some imports statements
- That's all
