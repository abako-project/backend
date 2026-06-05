import express from "express";
import { createServer } from "node:http";
import { virtoRouter } from "./virto-mock.js";
import { contractsRouter } from "./contracts-mock.js";
import { kreivoRouter } from "./kreivo-mock.js";
import { appRouter } from "./app-mock.js";
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

// Dashboard-level routes the frontend calls directly
// (mounted after contractsRouter so /projects/constructors etc. resolve first)
app.use("/", appRouter);

// Populate in-memory store with realistic test data
seedStore();

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`
  Mock API :${PORT}
  Mocking virto-api, contracts-api, bramp
`);
});
