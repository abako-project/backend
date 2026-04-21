import express from "express";
import { virtoRouter } from "./virto-mock.js";
import { contractsRouter } from "./contracts-mock.js";
import { kreivoRouter } from "./kreivo-mock.js";
import { seedStore } from "./seed.js";

const app = express();
const PORT = parseInt(process.env.MOCK_PORT || "4010");

app.use(express.json());

// Virto-api routes (adapter-api calls these via FEDERATE_SERVER)
app.use("/api", virtoRouter);

// Kreivo chain RPC mock (frontend queries balances here)
app.use("/kreivo", kreivoRouter);

// Contracts-api routes (adapter-api calls these via SIGNING_SERVICE_URL)
app.use("/", contractsRouter);

// Populate in-memory store with realistic test data
seedStore();

app.listen(PORT, () => {
  console.log(`
  Mock API :${PORT}
  Mocking virto-api, contracts-api, bramp
`);
});
