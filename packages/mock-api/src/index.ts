import express from "express";
import { virtoRouter } from "./virto-mock.js";
import { contractsRouter } from "./contracts-mock.js";

const app = express();
const PORT = parseInt(process.env.MOCK_PORT || "4010");

app.use(express.json());

// Virto-api routes (adapter-api calls these via FEDERATE_SERVER)
app.use("/api", virtoRouter);

// Contracts-api routes (adapter-api calls these via SIGNING_SERVICE_URL)
app.use("/", contractsRouter);

app.listen(PORT, () => {
  console.log(`
  Mock API :${PORT}
  Mocking virto-api, contracts-api, bramp
`);
});
