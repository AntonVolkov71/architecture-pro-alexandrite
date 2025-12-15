require("dotenv").config();

const express = require("express");
const {context, propagation, trace} = require('@opentelemetry/api');
const {NodeSDK} = require('@opentelemetry/sdk-node');
const {getNodeAutoInstrumentations} = require('@opentelemetry/auto-instrumentations-node');
const {OTLPTraceExporter} = require('@opentelemetry/exporter-trace-otlp-http');
const {resourceFromAttributes} = require('@opentelemetry/resources');
const {ATTR_SERVICE_NAME} = require('@opentelemetry/semantic-conventions');

const port = process.env.PORT || 8080;
const urlCollector = process.env.URL_COLLECTOR;
const SERVICE_NAME = "service-b";


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
const tracer = trace.getTracer(SERVICE_NAME);

const app = express();

async function makeData() {
    return tracer.startActiveSpan(`${SERVICE_NAME}:inner_span_logic`, async (span) => {
        try {
        return "Hello from span method"
        } finally {
            span.end();
        }
    })
}

app.get("/", async (req, res) => {
    const extracted = propagation.extract(context.active(), req.headers);

    tracer.startActiveSpan(`${SERVICE_NAME}:handler`, {}, extracted,async (span) => {
        try {
            const data = await makeData()
            span.setAttribute("order.id", "Номер заказа")
            span.addEvent("status_change", {status:"CALCULATED"})
            res.send(data);
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