// One-off live check of every job source adapter.
//
//   npm run check:sources
//
// Calls each adapter once (the same requests a normal fetch makes, so it stays
// within each provider's usage guidance; don't loop it) and prints success or
// failure, the number of jobs returned and the first job title. Writes nothing
// to the database.

// The adapters are TypeScript; tsx loads them as CommonJS, so read the named
// export from either the module or its default.
async function load(file, name) {
  const mod = await import(`../lib/${file}.ts`);
  return mod[name] ?? mod.default?.[name];
}

const [remotive, remoteok, weworkremotely, jobicy, himalayas, greenhouse, lever, ashby, workable, workingnomads, isRelevantTitle] =
  await Promise.all([
    load("sources/remotive", "remotive"),
    load("sources/remoteok", "remoteok"),
    load("sources/weworkremotely", "weworkremotely"),
    load("sources/jobicy", "jobicy"),
    load("sources/himalayas", "himalayas"),
    load("sources/ats", "greenhouse"),
    load("sources/ats", "lever"),
    load("sources/ats", "ashby"),
    load("sources/ats", "workable"),
    load("sources/workingnomads", "workingnomads"),
    load("relevance", "isRelevantTitle"),
  ]);

// `npm run check:sources -- greenhouse,lever` checks only those sources.
const only = (process.argv[2] ?? "").split(",").filter(Boolean);
const sources = [remotive, remoteok, weworkremotely, jobicy, himalayas, greenhouse, lever, ashby, workable, workingnomads].filter(
  (s) => !only.length || only.includes(s.id)
);
let failures = 0;

for (const source of sources) {
  const started = Date.now();
  try {
    const jobs = await source.fetchJobs();
    const relevant = jobs.filter((j) => isRelevantTitle(j.title));
    const first = jobs[0];
    console.log(
      `✓ ${source.name.padEnd(17)} ${String(jobs.length).padStart(4)} jobs (${relevant.length} VA-type) in ${Date.now() - started} ms` +
        (first ? `\n    first: "${first.title}" at ${first.company || "?"} | region: ${first.region_text || "-"} | posted: ${first.posted_at ?? "-"}` : "")
    );
  } catch (e) {
    failures++;
    console.log(`✕ ${source.name.padEnd(17)} FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}

process.exit(failures ? 1 : 0);
