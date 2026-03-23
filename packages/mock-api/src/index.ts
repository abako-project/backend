import express from "express";
import { virtoRouter } from "./virto-mock.js";
import { contractsRouter } from "./contracts-mock.js";

const app = express();
const PORT = parseInt(process.env.MOCK_PORT || "4000");

app.use(express.json());

// Virto-api routes (adapter-api calls these via FEDERATE_SERVER)
app.use("/api", virtoRouter);

// Contracts-api routes (adapter-api calls these via SIGNING_SERVICE_URL)
app.use("/", contractsRouter);

app.listen(PORT, () => {
  console.log(`\n  Mock API running on http://localhost:${PORT}`);
  console.log(`\n  Configure adapter-api with:`);
  console.log(`    FEDERATE_SERVER=http://localhost:${PORT}/api`);
  console.log(`    SIGNING_SERVICE_URL=http://localhost:${PORT}`);
  console.log(`\n  Mocked services:`);
  console.log(`    - virto-api (auth, payments, memberships)`);
  console.log(`    - contracts-api (projects, calendar, ratings)\n`);
});
