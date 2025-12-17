require("dotenv").config();

const express = require("express");
const axios = require("axios");
const {trace, context, propagation} = require("@opentelemetry/api");

const {NodeSDK} = require('@opentelemetry/sdk-node');
const {getNodeAutoInstrumentations} = require('@opentelemetry/auto-instrumentations-node');
const {OTLPTraceExporter} = require('@opentelemetry/exporter-trace-otlp-http');
const {resourceFromAttributes} = require('@opentelemetry/resources');
const {ATTR_SERVICE_NAME} = require('@opentelemetry/semantic-conventions');

const port = process.env.PORT || 8080;
const urlServiceB = process.env.URL_SERVICE_B;
const urlCollector = process.env.URL_COLLECTOR;
const SERVICE_NAME = "service-a";


const exporter = new OTLPTraceExporter({
    url: urlCollector
});

const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
});

const sdk = new NodeSDK({
    resource: resource,
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const app = express();

app.get("/", async (req, res) => {
    const tracer = trace.getTracer(SERVICE_NAME);

    await tracer.startActiveSpan(`${SERVICE_NAME}:handler`, async (span) => {
        try {
            const headers = {};
            propagation.inject(context.active(), headers);

            const response = await axios.get(urlServiceB, {headers})
            span.setAttribute("order.id", "Номер заказа")
            span.addEvent("status_change", {status:"SUBMIT"})
            res.json({ok: true, data: response.data});
        } catch (e) {
            span.recordException(e);
            if (e instanceof Error) {
                console.error("error text", e.message);
            } else {
                console.error("error text", e);
            }
        } finally {
            span.end();
        }
    })
})

app.listen(port, () => console.log(`${SERVICE_NAME} listening on port ${port}`));