#!/usr/bin/env -S NODE_OPTIONS="--import=tsx" node
async function main() {
  const { execute } = await import('@oclif/core')
  await execute({ development: true, dir: import.meta.url })
}

await main()
