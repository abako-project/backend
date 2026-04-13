import express from "express";
import { virtoRouter } from "./virto-mock.js";
import { contractsRouter } from "./contracts-mock.js";
import http from "http";

const app = express();
const PORT = parseInt(process.env.MOCK_PORT || "4010");
const ADAPTER_URL = process.env.ADAPTER_URL || "http://localhost:4000";

app.use(express.json());

// Virto-api routes (adapter-api calls these via FEDERATE_SERVER)
app.use("/api", virtoRouter);

// Proxy /adapter/v1/* → adapter-api
app.use("/adapter", (req, res) => {
  const target = new URL(req.originalUrl.replace(/^\/adapter/, ""), ADAPTER_URL);
  const proxyReq = http.request(target, { method: req.method, headers: req.headers }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => res.status(502).json({ error: "adapter-api unavailable" }));
  if (req.body && Object.keys(req.body).length > 0) {
    proxyReq.write(JSON.stringify(req.body));
  }
  proxyReq.end();
});

// Contracts-api routes (adapter-api calls these via SIGNING_SERVICE_URL)
app.use("/", contractsRouter);

app.listen(PORT, () => {
  console.log(`
  Mock API :${PORT}
  Mocking virto-api, contracts-api, bramp
  Proxying /adapter/* -> ${ADAPTER_URL}
`);
});
