import { verifySubmission } from './submission-contract.mjs';

const issues = await verifySubmission(process.cwd());
if (issues.length > 0) {
  for (const issue of issues) console.error(`submission: ${issue}`);
  process.exitCode = 1;
} else {
  console.log('submission: public repository, live app, demo, survey, and local evidence verified');
}
